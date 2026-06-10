'use client';

import { useState } from 'react';
import { Building2, CheckCircle2, Plus } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { createOrganization } from '@/lib/firebase/cloud-functions';
import { useUserOrganizations } from '@/lib/firebase/firestore';
import { roleLabels } from '@/lib/domain/constants';
import { canManageUsers } from '@/lib/rbac';
import { asString } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';

export function OrganizationsPage() {
  const { profile, switchOrganization } = useAuth();
  const { items, loading } = useUserOrganizations();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canCreate = canManageUsers(profile?.role);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;
    const form = new FormData(event.currentTarget);
    const name = asString(form.get('name'));
    if (!name) return;
    setSubmitting(true);
    setMessage('');
    try {
      const result = await createOrganization({ name });
      const orgId = (result.data as { orgId?: string }).orgId;
      if (orgId) await switchOrganization(orgId);
      event.currentTarget.reset();
      setMessage('Organization workspace created and selected.');
    } catch (error) {
      console.error(error);
      setMessage('Could not create organization. Make sure Firebase Functions are deployed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="SaaS workspace management. Each organization has isolated users, pigs, feed, finance, reports, settings, and statistics."
      />

      {message && <div className="mb-5 rounded-3xl border border-forest-200 bg-forest-50 px-5 py-4 text-sm font-semibold text-forest-800">{message}</div>}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardTitle title="Your Workspaces" description="Switch between organizations without mixing their farm records." />
          {items.length ? (
            <Table headers={['Organization', 'Your Role', 'Status', 'Action']}>
              {items.map(org => {
                const active = org.orgId === profile?.activeOrgId;
                return (
                  <tr key={org.orgId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-forest-50 text-forest-800"><Building2 size={18} /></span>
                        <div>
                          <p className="font-black text-slate-900">{org.orgName}</p>
                          <p className="text-xs text-slate-500">Org ID: {org.orgId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold">{roleLabels[org.role]}</td>
                    <td className="px-4 py-3">
                      <span className={org.active ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800' : 'rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800'}>
                        {org.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {active ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-forest-100 px-3 py-1 text-xs font-black text-forest-800"><CheckCircle2 size={14} /> Current</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => switchOrganization(org.orgId)}>Switch</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : loading ? (
            <EmptyState title="Loading organizations..." />
          ) : (
            <EmptyState title="No organizations found" description="Seed your first admin organization, or ask an organization admin to invite you." />
          )}
        </Card>

        <Card>
          <CardTitle title="Create Organization" description="For new customers/companies. The creator becomes the first admin." />
          <form onSubmit={submit} className="space-y-4">
            <Input label="Organization / Farm Name" name="name" placeholder="e.g. Green Valley Farms Ltd" required disabled={!canCreate} />
            <Button loading={submitting} disabled={!canCreate} icon={<Plus size={17} />}>Create Workspace</Button>
          </form>
          {!canCreate && (
            <div className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Only organization admins can create additional workspaces from this app.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
