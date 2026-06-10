'use client';

import { useState } from 'react';
import { ShieldCheck, UserPlus, Trash2 } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/auth-context';
import { useFarmData } from '@/lib/firebase/firestore';
import { createFirebaseUser, deleteFirebaseUserAccount, setFirebaseUserActive, updateFirebaseUserRole } from '@/lib/firebase/cloud-functions';
import { roleLabels } from '@/lib/domain/constants';
import type { Role } from '@/lib/domain/types';
import { canManageUsers } from '@/lib/rbac';
import { asString } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';

export function UsersPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'list' | 'add'>('list');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canAdmin = canManageUsers(profile?.role);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdmin) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage('');
    try {
      await createFirebaseUser({
        orgId: profile?.activeOrgId || '',
        email: asString(form.get('email')),
        password: asString(form.get('password')),
        fullName: asString(form.get('fullName')),
        role: asString(form.get('role')) as Role
      });
      event.currentTarget.reset();
      setMessage('User created in Firebase Auth and added to this organization workspace.');
      setTab('list');
    } catch (error) {
      console.error(error);
      setMessage('Could not create user. Make sure Firebase Functions are deployed and you are an admin.');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(uid: string, role: Role) {
    if (!canAdmin) return;
    await updateFirebaseUserRole({ orgId: profile?.activeOrgId || '', uid, role });
  }

  async function toggleActive(uid: string, active: boolean) {
    if (!canAdmin) return;
    await setFirebaseUserActive({ orgId: profile?.activeOrgId || '', uid, active });
  }

  async function deleteUser(uid: string) {
    if (!canAdmin || uid === profile?.uid) return;
    if (!confirm('Remove this user from the current organization?')) return;
    await deleteFirebaseUserAccount({ orgId: profile?.activeOrgId || '', uid });
  }

  async function sendReset(email: string) {
    await sendPasswordResetEmail(auth, email);
    setMessage(`Password reset email sent to ${email}.`);
  }

  return (
    <div>
      <PageHeader title="User Management" description="Create Firebase Auth users, assign organization roles, disable org access, and manage privileges for the current workspace. Admin-only page." />
      <Tabs tabs={[{ value: 'list', label: 'All Users' }, { value: 'add', label: 'Add User' }]} active={tab} onChange={setTab} />
      {message && <div className="mb-5 rounded-3xl border border-forest-200 bg-forest-50 px-5 py-4 text-sm font-semibold text-forest-800">{message}</div>}

      {tab === 'list' && (
        <Card>
          <CardTitle title="Organization Users" description="Users listed here belong only to the active organization workspace." />
          {data.users.length ? (
            <Table headers={['User', 'Email', 'Role', 'Status', 'Actions']}>
              {data.users.map(user => (
                <tr key={user.uid}>
                  <td className="px-4 py-3 font-black text-slate-900">{user.fullName}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <Select aria-label="Role" value={user.role} onChange={event => changeRole(user.uid, event.target.value as Role)} disabled={!canAdmin || user.uid === profile?.uid} className="min-w-[140px]">
                      {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3"><span className={user.active ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800' : 'rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800'}>{user.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="space-x-2 px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => sendReset(user.email)}>Reset</Button>
                    <Button variant="outline" size="sm" disabled={!canAdmin || user.uid === profile?.uid} onClick={() => toggleActive(user.uid, !user.active)}>{user.active ? 'Disable' : 'Enable'}</Button>
                    <Button variant="ghost" size="sm" disabled={!canAdmin || user.uid === profile?.uid} icon={<Trash2 size={15} />} onClick={() => deleteUser(user.uid)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState title="No organization members found" description="Seed your first organization admin, then create more members from this page." />}
        </Card>
      )}

      {tab === 'add' && (
        <Card>
          <CardTitle title="Create New Organization User" description="This calls a secured Firebase Function, creates the Auth account if needed, and adds the user to the current organization." />
          <form onSubmit={createUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Full Name" name="fullName" required disabled={!canAdmin} />
            <Input label="Email" name="email" type="email" required disabled={!canAdmin} />
            <Select label="Role" name="role" disabled={!canAdmin}>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</Select>
            <Input label="Temporary Password" name="password" type="password" minLength={6} required disabled={!canAdmin} />
            <div className="md:col-span-2 xl:col-span-3"><Button loading={submitting} disabled={!canAdmin} icon={<UserPlus size={17} />}>Create User</Button></div>
          </form>
          <div className="mt-5 flex gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
            <ShieldCheck className="mt-0.5 text-forest-700" size={18} />
            <p>Client code never stores passwords in Firestore. Firebase Authentication owns sign-in, while each organization stores member role and active status separately.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
