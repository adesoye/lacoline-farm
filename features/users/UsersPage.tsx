'use client';

import { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Trash2,
  UserPlus
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/auth-context';
import { useFarmData } from '@/lib/firebase/firestore';
import {
  createFirebaseUser,
  deleteFirebaseUserAccount,
  setFirebaseUserActive,
  updateFirebaseUserRole
} from '@/lib/firebase/cloud-functions';
import { roleLabels } from '@/lib/domain/constants';
import type { Role } from '@/lib/domain/types';
import {
  canManageMember,
  canManageUsers,
  getAssignableRoles
} from '@/lib/rbac';
import { asString } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
      .replace('FirebaseError: ', '')
      .replace(/^functions\/[^:]+:\s*/i, '');
  }

  return 'The requested action could not be completed.';
}

export function UsersPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();

  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');

  const canManage = canManageUsers(profile?.role);

  const assignableRoles = useMemo(
    () => getAssignableRoles(profile?.role),
    [profile?.role]
  );

  function clearMessages() {
    setMessage('');
    setErrorMessage('');
  }

  async function createUser(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManage) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const role = asString(form.get('role')) as Role;

    clearMessages();

    if (!assignableRoles.includes(role)) {
      setErrorMessage(
        'You are not allowed to assign the selected role.'
      );
      return;
    }

    setSubmitting(true);

    try {
      await createFirebaseUser({
        orgId: profile?.activeOrgId || '',
        email: asString(form.get('email')).trim().toLowerCase(),
        password: asString(form.get('password')),
        fullName: asString(form.get('fullName')).trim(),
        role
      });

      formElement.reset();

      setMessage(
        `User created and added as ${roleLabels[role]}.`
      );

      setTab('list');
    } catch (error) {
      console.error('Failed to create organization user:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(
    uid: string,
    currentRole: Role,
    nextRole: Role
  ) {
    const isSelf = uid === profile?.uid;

    if (
      !canManageMember(
        profile?.role,
        currentRole,
        isSelf
      )
    ) {
      return;
    }

    if (!assignableRoles.includes(nextRole)) {
      setErrorMessage(
        'You are not allowed to assign that role.'
      );
      return;
    }

    clearMessages();
    setBusyUserId(uid);

    try {
      await updateFirebaseUserRole({
        orgId: profile?.activeOrgId || '',
        uid,
        role: nextRole
      });

      setMessage(
        `User role changed to ${roleLabels[nextRole]}.`
      );
    } catch (error) {
      console.error('Failed to update role:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyUserId('');
    }
  }

  async function toggleActive(
    uid: string,
    currentRole: Role,
    active: boolean
  ) {
    const isSelf = uid === profile?.uid;

    if (
      !canManageMember(
        profile?.role,
        currentRole,
        isSelf
      )
    ) {
      return;
    }

    clearMessages();
    setBusyUserId(uid);

    try {
      await setFirebaseUserActive({
        orgId: profile?.activeOrgId || '',
        uid,
        active
      });

      setMessage(
        active
          ? 'Organization access enabled.'
          : 'Organization access disabled.'
      );
    } catch (error) {
      console.error('Failed to update access:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyUserId('');
    }
  }

  async function removeUser(
    uid: string,
    role: Role,
    fullName: string
  ) {
    const isSelf = uid === profile?.uid;

    if (
      !canManageMember(
        profile?.role,
        role,
        isSelf
      )
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${fullName} from this organization? ` +
        'Their Firebase account will not be deleted if they belong to another organization.'
    );

    if (!confirmed) return;

    clearMessages();
    setBusyUserId(uid);

    try {
      await deleteFirebaseUserAccount({
        orgId: profile?.activeOrgId || '',
        uid
      });

      setMessage(
        `${fullName} was removed from the organization.`
      );
    } catch (error) {
      console.error('Failed to remove user:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyUserId('');
    }
  }

  async function sendReset(
    uid: string,
    role: Role,
    email: string
  ) {
    const isSelf = uid === profile?.uid;

    if (
      !canManageMember(
        profile?.role,
        role,
        isSelf
      )
    ) {
      return;
    }

    clearMessages();
    setBusyUserId(uid);

    try {
      await sendPasswordResetEmail(auth, email);

      setMessage(
        `Password reset email sent to ${email}.`
      );
    } catch (error) {
      console.error('Failed to send password reset:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setBusyUserId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description={
          profile?.role === 'manager'
            ? 'Create and manage staff and viewer accounts for the current organization.'
            : 'Create organization users, assign roles, and manage access.'
        }
      />

      <Tabs
        tabs={[
          {
            value: 'list',
            label: 'All Users'
          },
          {
            value: 'add',
            label: 'Add User'
          }
        ]}
        active={tab}
        onChange={setTab}
      />

      {message ? (
        <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {tab === 'list' ? (
        <Card>
          <CardTitle
            title="Organization Users"
            description={
              profile?.role === 'manager'
                ? 'Managers can modify only staff and viewer memberships.'
                : 'Manage users belonging to the active organization.'
            }
          />

          {data.users.length ? (
            <Table
              headers={[
                'User',
                'Email',
                'Role',
                'Status',
                'Actions'
              ]}
            >
              {data.users.map(user => {
                const isSelf = user.uid === profile?.uid;

                const canEdit = canManageMember(
                  profile?.role,
                  user.role,
                  isSelf
                );

                const isBusy = busyUserId === user.uid;

                return (
                  <tr key={user.uid}>
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">
                        {user.fullName}
                      </p>

                      {isSelf ? (
                        <span className="mt-1 inline-flex rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-black uppercase text-forest-800">
                          You
                        </span>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      {user.email}
                    </td>

                    <td className="px-4 py-3">
                      <Select
                        aria-label={`Role for ${user.fullName}`}
                        value={user.role}
                        disabled={!canEdit || isBusy}
                        onChange={event =>
                          changeRole(
                            user.uid,
                            user.role,
                            event.target.value as Role
                          )
                        }
                        className="min-w-[140px]"
                      >
                        {canEdit ? (
                          assignableRoles.map(role => (
                            <option
                              key={role}
                              value={role}
                            >
                              {roleLabels[role]}
                            </option>
                          ))
                        ) : (
                          <option value={user.role}>
                            {roleLabels[user.role]}
                          </option>
                        )}
                      </Select>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          user.active
                            ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800'
                            : 'rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800'
                        }
                      >
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canEdit || isBusy}
                          onClick={() =>
                            sendReset(
                              user.uid,
                              user.role,
                              user.email
                            )
                          }
                        >
                          Reset
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canEdit || isBusy}
                          onClick={() =>
                            toggleActive(
                              user.uid,
                              user.role,
                              !user.active
                            )
                          }
                        >
                          {user.active ? 'Disable' : 'Enable'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canEdit || isBusy}
                          icon={<Trash2 size={15} />}
                          onClick={() =>
                            removeUser(
                              user.uid,
                              user.role,
                              user.fullName
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState
              title="No organization members found"
              description="Create the first staff or viewer account for this organization."
            />
          )}
        </Card>
      ) : null}

      {tab === 'add' ? (
        <Card>
          <CardTitle
            title="Create Organization User"
            description={
              profile?.role === 'manager'
                ? 'Managers may create only staff and viewer accounts.'
                : 'Create a Firebase Auth account and add it to this organization.'
            }
          />

          <form
            onSubmit={createUser}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <Input
              label="Full Name"
              name="fullName"
              required
              disabled={!canManage}
            />

            <Input
              label="Email"
              name="email"
              type="email"
              required
              disabled={!canManage}
            />

            <Select
              label="Role"
              name="role"
              disabled={!canManage}
            >
              {assignableRoles.map(role => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </Select>

            <Input
              label="Temporary Password"
              name="password"
              type="password"
              minLength={6}
              required
              disabled={!canManage}
            />

            <div className="md:col-span-2 xl:col-span-3">
              <Button
                loading={submitting}
                disabled={!canManage}
                icon={<UserPlus size={17} />}
              >
                Create User
              </Button>
            </div>
          </form>

          <div className="mt-5 flex gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-forest-700"
              size={18}
            />

            <div>
              <p>
                Passwords are stored only by Firebase Authentication.
                Organization roles are stored separately for each tenant.
              </p>

              {profile?.role === 'manager' ? (
                <p className="mt-2 font-semibold text-slate-700">
                  As a manager, you cannot create, promote, disable,
                  or remove another manager or administrator.
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}