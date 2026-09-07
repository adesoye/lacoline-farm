'use client';

import { useMemo, useState } from 'react';
import { Egg, Trash2, Plus, Bird, Utensils, HeartPulse } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  addRecord,
  addRecordWithTransaction,
  collectionNames,
  deleteRecord,
  setRecord,
  updateRecordWithTransaction,
  usePoultryData
} from '@/lib/firebase/firestore';
import { canManageFinance, canWriteFarm, canDeleteRecords } from '@/lib/rbac';
import {
  asNumber,
  asString,
  dateLabel,
  formatMoney,
  formatNumber,
  formatTimestamp,
  today
} from '@/lib/utils';
import type {
  EggLog,
  PoultryBatch,
  PoultryBatchType,
  PoultryFeedLog,
  PoultryHealthLog,
  PoultryHealthType,
  Transaction
} from '@/lib/domain/types';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { Table } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';

type PoultryTab = 'overview' | 'batches' | 'eggs' | 'feed' | 'health';

const healthTypes: PoultryHealthType[] = [
  'vaccination',
  'medication',
  'deworming',
  'mortality',
  'other'
];

const EGGS_PER_CRATE = 30;

export function PoultryPage() {
  const { profile } = useAuth();
  const { orgId, batches, eggLogs, feedLogs, healthLogs, loading, errors } = usePoultryData();

  const canWrite = canWriteFarm(profile?.role);
  const canFinance = canManageFinance(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const uid = profile?.uid;

  const [tab, setTab] = useState<PoultryTab>('overview');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Batch add/edit form state (controlled to support editing).
  const emptyBatch = {
    name: '',
    type: 'layers' as PoultryBatchType,
    date: today(),
    count: '',
    breed: '',
    costPerBird: '',
    shed: '',
    supplier: '',
    status: 'active' as PoultryBatch['status']
  };
  const [batchForm, setBatchForm] = useState({ ...emptyBatch });
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  // Log edit state — the form for each log type remounts (via key) with the
  // selected record's values prefilled, then submits as an update.
  const [editingEgg, setEditingEgg] = useState<EggLog | null>(null);
  const [editingFeed, setEditingFeed] = useState<PoultryFeedLog | null>(null);
  const [editingHealth, setEditingHealth] = useState<PoultryHealthLog | null>(null);

  const batchName = (id: string) => batches.find(b => b.id === id)?.name || 'Unknown batch';
  const layerBatches = batches.filter(b => b.type === 'layers');
  const activeBatches = batches.filter(b => b.status === 'active');

  const stats = useMemo(() => {
    const birds = activeBatches.reduce((sum, b) => sum + (b.currentCount ?? b.count ?? 0), 0);
    const month = today().slice(0, 7);
    const eggsThisMonth = eggLogs
      .filter(log => log.date?.startsWith(month))
      .reduce((sum, log) => sum + (log.crates || 0) * EGGS_PER_CRATE + (log.cracked || 0), 0);
    const flockValue = activeBatches.reduce(
      (sum, b) => sum + (b.currentCount ?? b.count ?? 0) * (b.costPerBird || 0),
      0
    );
    return { birds, eggsThisMonth, flockValue };
  }, [activeBatches, eggLogs]);

  function flash(tone: 'success' | 'error', text: string) {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 4000);
  }

  function resetBatchForm() {
    setBatchForm({ ...emptyBatch, date: today() });
    setEditingBatchId(null);
  }

  function startEditBatch(batch: PoultryBatch) {
    setEditingBatchId(batch.id);
    setBatchForm({
      name: batch.name || '',
      type: batch.type || 'layers',
      date: batch.date || today(),
      count: String(batch.count ?? ''),
      breed: batch.breed || '',
      costPerBird: batch.costPerBird ? String(batch.costPerBird) : '',
      shed: batch.shed || '',
      supplier: batch.supplier || '',
      status: batch.status || 'active'
    });
    setTab('batches');
  }

  async function submitBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const name = batchForm.name.trim();
    const count = Number(batchForm.count) || 0;
    if (!name) return flash('error', 'Batch name is required.');
    if (!count) return flash('error', 'Bird count is required.');

    setBusy(true);
    try {
      if (editingBatchId) {
        const existing = batches.find(b => b.id === editingBatchId);
        const mortality = (existing?.count ?? 0) - (existing?.currentCount ?? existing?.count ?? 0);
        await setRecord(
          orgId,
          collectionNames.poultryBatches,
          editingBatchId,
          {
            name,
            type: batchForm.type,
            date: batchForm.date || today(),
            count,
            currentCount: Math.max(0, count - Math.max(0, mortality)),
            breed: batchForm.breed.trim(),
            costPerBird: Number(batchForm.costPerBird) || 0,
            shed: batchForm.shed.trim(),
            supplier: batchForm.supplier.trim(),
            status: batchForm.status
          },
          uid
        );
        flash('success', `Batch "${name}" updated.`);
      } else {
        await addRecord(
          orgId,
          collectionNames.poultryBatches,
          {
            name,
            type: batchForm.type,
            date: batchForm.date || today(),
            count,
            currentCount: count,
            breed: batchForm.breed.trim(),
            costPerBird: Number(batchForm.costPerBird) || 0,
            shed: batchForm.shed.trim(),
            supplier: batchForm.supplier.trim(),
            status: 'active'
          },
          uid
        );
        flash('success', `Batch "${name}" added.`);
      }
      resetBatchForm();
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save batch.');
    } finally {
      setBusy(false);
    }
  }

  async function submitEgg(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const batchId = asString(form.get('batchId'));
    if (!batchId) return flash('error', 'Select a layer batch.');
    const date = asString(form.get('date')) || today();
    const crates = asNumber(form.get('crates'));
    const cracked = asNumber(form.get('cracked'));
    const pricePerCrate = asNumber(form.get('pricePerCrate'));
    const notes = asString(form.get('notes'));

    const revenue = crates * pricePerCrate;
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && revenue > 0
        ? {
            date,
            type: 'income',
            category: 'egg-sales',
            description: `Egg sales — ${batchName(batchId)}`,
            amount: revenue,
            method: 'cash'
          }
        : null;
    const record = { batchId, date, crates, cracked, pricePerCrate, notes };

    setBusy(true);
    try {
      if (editingEgg) {
        await updateRecordWithTransaction<typeof record>(
          orgId,
          collectionNames.eggLogs,
          editingEgg.id,
          record,
          editingEgg.transactionId,
          transaction,
          canFinance,
          uid
        );
        setEditingEgg(null);
        flash('success', 'Egg record updated.');
      } else {
        await addRecordWithTransaction<Omit<EggLog, 'id'>>(
          orgId,
          collectionNames.eggLogs,
          record,
          transaction,
          uid
        );
        formElement.reset();
        flash(
          'success',
          transaction
            ? 'Egg collection logged and sales posted to finance.'
            : 'Egg collection logged.'
        );
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save egg record.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const batchId = asString(form.get('batchId'));
    if (!batchId) return flash('error', 'Select a batch.');
    const date = asString(form.get('date')) || today();
    const quantity = asNumber(form.get('quantity'));
    if (!quantity) return flash('error', 'Feed quantity is required.');
    const cost = asNumber(form.get('cost'));
    const feedType = asString(form.get('feedType')) || 'Feed';
    const notes = asString(form.get('notes'));

    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && cost > 0
        ? {
            date,
            type: 'expense',
            category: 'feed',
            description: `Poultry feed — ${batchName(batchId)}`,
            amount: cost,
            method: 'cash'
          }
        : null;
    const record = { batchId, date, feedType, quantity, cost, notes };

    setBusy(true);
    try {
      if (editingFeed) {
        await updateRecordWithTransaction<typeof record>(
          orgId,
          collectionNames.poultryFeedLogs,
          editingFeed.id,
          record,
          editingFeed.transactionId,
          transaction,
          canFinance,
          uid
        );
        setEditingFeed(null);
        flash('success', 'Feed record updated.');
      } else {
        await addRecordWithTransaction<Omit<PoultryFeedLog, 'id'>>(
          orgId,
          collectionNames.poultryFeedLogs,
          record,
          transaction,
          uid
        );
        formElement.reset();
        flash('success', 'Feed logged.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save feed record.');
    } finally {
      setBusy(false);
    }
  }

  async function submitHealth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const batchId = asString(form.get('batchId'));
    if (!batchId) return flash('error', 'Select a batch.');
    const date = asString(form.get('date')) || today();
    const type = asString(form.get('type')) as PoultryHealthType;
    const count = asNumber(form.get('count'));
    const cost = asNumber(form.get('cost'));
    const product = asString(form.get('product'));
    const notes = asString(form.get('notes'));

    const isTreatment = type === 'vaccination' || type === 'medication' || type === 'deworming';
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && cost > 0 && isTreatment
        ? {
            date,
            type: 'expense',
            category: type === 'vaccination' ? 'vaccine' : 'medication',
            description: `Poultry ${type} — ${batchName(batchId)}`,
            amount: cost,
            method: 'cash'
          }
        : null;
    const record = { batchId, date, type, count, product, cost, notes };

    // Adjust each affected batch's live count for mortality changes.
    async function applyFlockDeltas(deltas: Record<string, number>) {
      for (const [bid, delta] of Object.entries(deltas)) {
        if (!delta) continue;
        const batch = batches.find(b => b.id === bid);
        if (!batch) continue;
        await setRecord(
          orgId,
          collectionNames.poultryBatches,
          bid,
          { currentCount: Math.max(0, (batch.currentCount ?? batch.count ?? 0) + delta) },
          uid
        );
      }
    }

    setBusy(true);
    try {
      if (editingHealth) {
        await updateRecordWithTransaction<typeof record>(
          orgId,
          collectionNames.poultryHealth,
          editingHealth.id,
          record,
          editingHealth.transactionId,
          transaction,
          canFinance,
          uid
        );
        // Restore the old mortality effect, then apply the new one.
        const deltas: Record<string, number> = {};
        if (editingHealth.type === 'mortality') {
          deltas[editingHealth.batchId] = (deltas[editingHealth.batchId] || 0) + (editingHealth.count || 0);
        }
        if (type === 'mortality') {
          deltas[batchId] = (deltas[batchId] || 0) - count;
        }
        await applyFlockDeltas(deltas);
        setEditingHealth(null);
        flash('success', 'Health record updated.');
      } else {
        await addRecordWithTransaction<Omit<PoultryHealthLog, 'id'>>(
          orgId,
          collectionNames.poultryHealth,
          record,
          transaction,
          uid
        );
        if (type === 'mortality' && count > 0) {
          await applyFlockDeltas({ [batchId]: -count });
        }
        formElement.reset();
        flash('success', 'Health record logged.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save health record.');
    } finally {
      setBusy(false);
    }
  }

  async function removeRecord(collection: string, id: string, label: string) {
    if (!canDelete) return;
    if (!window.confirm(`Delete this ${label}?`)) return;
    try {
      await deleteRecord(orgId, collection, id);
      flash('success', `${label} deleted.`);
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not delete.');
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 font-bold text-slate-600 shadow-card">
        Loading poultry records...
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Poultry"
        description="Manage layer and broiler batches — flock inventory, egg production, feed, and health. Sales, feed, and treatment costs post to your finance ledger automatically."
      />

      {errors.length ? (
        <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errors.join(', ')}
        </div>
      ) : null}

      {notice ? (
        <div
          className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${
            notice.tone === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <Tabs<PoultryTab>
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'batches', label: 'Batches' },
          { value: 'eggs', label: 'Egg Log' },
          { value: 'feed', label: 'Feed' },
          { value: 'health', label: 'Mortality & Health' }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active batches" value={formatNumber(activeBatches.length)} tone="forest" icon={<Bird size={18} />} />
            <StatCard label="Birds on hand" value={formatNumber(stats.birds)} tone="slate" icon={<Bird size={18} />} />
            <StatCard label="Eggs this month" value={formatNumber(stats.eggsThisMonth)} tone="clay" icon={<Egg size={18} />} />
            <StatCard label="Flock value (at cost)" value={canFinance ? formatMoney(stats.flockValue) : 'Hidden'} tone="slate" />
          </div>

          <Card>
            <CardTitle title="Batches" description="All poultry batches in this organization." />
            {batches.length ? (
              <Table headers={['Batch', 'Type', 'Birds', 'Started', 'Status']}>
                {batches.map(batch => (
                  <tr key={batch.id}>
                    <td className="px-4 py-3 font-black text-emerald-800">{batch.name}</td>
                    <td className="px-4 py-3 capitalize">{batch.type}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatNumber(batch.currentCount ?? batch.count)} / {formatNumber(batch.count)}
                    </td>
                    <td className="px-4 py-3">{dateLabel(batch.date)}</td>
                    <td className="px-4 py-3 capitalize">{batch.status}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No batches yet" description="Add a batch in the Batches tab." />
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'batches' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle
                title={editingBatchId ? 'Edit batch' : 'Add new batch'}
                description="Layer or broiler flock intake."
                action={
                  editingBatchId ? (
                    <Button variant="ghost" size="sm" onClick={resetBatchForm}>
                      Cancel edit
                    </Button>
                  ) : undefined
                }
              />
              <form onSubmit={submitBatch} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Input
                  label="Batch name"
                  value={batchForm.name}
                  onChange={e => setBatchForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Layers A — June 2026"
                />
                <Select
                  label="Type"
                  value={batchForm.type}
                  onChange={e => setBatchForm(f => ({ ...f, type: e.target.value as PoultryBatchType }))}
                  options={[
                    { label: 'Layers', value: 'layers' },
                    { label: 'Broilers', value: 'broilers' }
                  ]}
                />
                <Input
                  label="Intake / start date"
                  type="date"
                  value={batchForm.date}
                  onChange={e => setBatchForm(f => ({ ...f, date: e.target.value }))}
                />
                <Input
                  label="Bird count"
                  type="number"
                  min={0}
                  value={batchForm.count}
                  onChange={e => setBatchForm(f => ({ ...f, count: e.target.value }))}
                  placeholder="e.g. 500"
                />
                <Input
                  label="Breed / strain"
                  value={batchForm.breed}
                  onChange={e => setBatchForm(f => ({ ...f, breed: e.target.value }))}
                  placeholder="e.g. Isa Brown"
                />
                <Input
                  label="Cost per bird (₦)"
                  type="number"
                  min={0}
                  value={batchForm.costPerBird}
                  onChange={e => setBatchForm(f => ({ ...f, costPerBird: e.target.value }))}
                  placeholder="0.00"
                />
                <Input
                  label="Pen / shed"
                  value={batchForm.shed}
                  onChange={e => setBatchForm(f => ({ ...f, shed: e.target.value }))}
                  placeholder="e.g. Pen 1"
                />
                <Input
                  label="Supplier"
                  value={batchForm.supplier}
                  onChange={e => setBatchForm(f => ({ ...f, supplier: e.target.value }))}
                  placeholder="e.g. ABC Hatchery"
                />
                {editingBatchId ? (
                  <Select
                    label="Status"
                    value={batchForm.status}
                    onChange={e => setBatchForm(f => ({ ...f, status: e.target.value as PoultryBatch['status'] }))}
                    options={[
                      { label: 'Active', value: 'active' },
                      { label: 'Sold', value: 'sold' },
                      { label: 'Closed', value: 'closed' }
                    ]}
                  />
                ) : null}
                <div className="flex items-end">
                  <Button type="submit" loading={busy} icon={<Plus size={16} />}>
                    {editingBatchId ? 'Save changes' : 'Add batch'}
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="All batches" />
            {batches.length ? (
              <Table headers={['Batch', 'Type', 'Birds', 'Cost/bird', 'Started', 'Status', 'Actions']}>
                {batches.map(batch => (
                  <tr key={batch.id}>
                    <td className="px-4 py-3 font-black text-emerald-800">
                      {batch.name}
                      {batch.shed ? <span className="block text-xs font-semibold text-slate-400">{batch.shed}</span> : null}
                      {formatTimestamp(batch.updatedAt) ? (
                        <span className="block text-[11px] font-semibold text-slate-400">✏️ edited {formatTimestamp(batch.updatedAt)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 capitalize">{batch.type}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatNumber(batch.currentCount ?? batch.count)} / {formatNumber(batch.count)}
                    </td>
                    <td className="px-4 py-3">{canFinance ? formatMoney(batch.costPerBird) : '—'}</td>
                    <td className="px-4 py-3">{dateLabel(batch.date)}</td>
                    <td className="px-4 py-3 capitalize">{batch.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canWrite ? (
                          <Button variant="outline" size="sm" onClick={() => startEditBatch(batch)}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={15} />}
                            className="bg-red-50 text-red-700 hover:bg-red-100"
                            onClick={() => removeRecord(collectionNames.poultryBatches, batch.id, 'batch')}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No batches yet" />
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'eggs' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle
                title={editingEgg ? 'Edit egg record' : 'Log egg collection'}
                description="Layer batches only. Sales value posts to finance."
                action={editingEgg ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditingEgg(null)}>Cancel edit</Button>
                ) : undefined}
              />
              <form key={editingEgg?.id ?? 'egg-new'} onSubmit={submitEgg} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Layer batch" name="batchId" defaultValue={editingEgg?.batchId ?? ''} required>
                  <option value="">Select batch…</option>
                  {layerBatches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingEgg?.date ?? today()} />
                <Input label="Full crates (30 eggs)" name="crates" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingEgg?.crates ?? ''} />
                <Input label="Loose / cracked eggs" name="cracked" type="number" min={0} placeholder="0" defaultValue={editingEgg?.cracked ?? ''} />
                <Input label="Price per crate (₦)" name="pricePerCrate" type="number" min={0} placeholder="0.00" defaultValue={editingEgg?.pricePerCrate ?? ''} />
                <Input label="Notes" name="notes" placeholder="Optional" defaultValue={editingEgg?.notes ?? ''} />
                <div className="flex items-end">
                  <Button type="submit" loading={busy} icon={<Egg size={16} />}>{editingEgg ? 'Save changes' : 'Log collection'}</Button>
                </div>
              </form>
              {!canFinance ? (
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Note: you don't have finance access, so egg sales won't be posted to the ledger.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Egg log" />
            {eggLogs.length ? (
              <Table headers={['Date', 'Batch', 'Crates', 'Cracked', 'Revenue', 'Actions']}>
                {eggLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{dateLabel(log.date)}</td>
                    <td className="px-4 py-3 font-semibold">{batchName(log.batchId)}</td>
                    <td className="px-4 py-3">{formatNumber(log.crates, 1)}</td>
                    <td className="px-4 py-3">{formatNumber(log.cracked)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">
                      {log.pricePerCrate > 0 ? formatMoney(log.crates * log.pricePerCrate) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canWrite ? (
                          <Button variant="outline" size="sm" onClick={() => { setEditingEgg(log); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => removeRecord(collectionNames.eggLogs, log.id, 'egg log')}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No egg records yet" />
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'feed' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle
                title={editingFeed ? 'Edit feed record' : 'Log poultry feed'}
                description="Feed cost posts to finance as an expense."
                action={editingFeed ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditingFeed(null)}>Cancel edit</Button>
                ) : undefined}
              />
              <form key={editingFeed?.id ?? 'feed-new'} onSubmit={submitFeed} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Batch" name="batchId" defaultValue={editingFeed?.batchId ?? ''} required>
                  <option value="">Select batch…</option>
                  {activeBatches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingFeed?.date ?? today()} />
                <Input label="Feed type" name="feedType" placeholder="e.g. Layer mash" defaultValue={editingFeed?.feedType ?? ''} />
                <Input label="Quantity (kg)" name="quantity" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingFeed?.quantity ?? ''} />
                <Input label="Cost (₦)" name="cost" type="number" min={0} placeholder="0.00" defaultValue={editingFeed?.cost ?? ''} />
                <Input label="Notes" name="notes" placeholder="Optional" defaultValue={editingFeed?.notes ?? ''} />
                <div className="flex items-end">
                  <Button type="submit" loading={busy} icon={<Utensils size={16} />}>{editingFeed ? 'Save changes' : 'Log feed'}</Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Feed log" />
            {feedLogs.length ? (
              <Table headers={['Date', 'Batch', 'Feed type', 'Qty (kg)', 'Cost', 'Actions']}>
                {feedLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{dateLabel(log.date)}</td>
                    <td className="px-4 py-3 font-semibold">{batchName(log.batchId)}</td>
                    <td className="px-4 py-3">{log.feedType}</td>
                    <td className="px-4 py-3">{formatNumber(log.quantity, 1)}</td>
                    <td className="px-4 py-3">{log.cost > 0 ? formatMoney(log.cost) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canWrite ? (
                          <Button variant="outline" size="sm" onClick={() => { setEditingFeed(log); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => removeRecord(collectionNames.poultryFeedLogs, log.id, 'feed log')}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No feed records yet" />
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'health' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle
                title={editingHealth ? 'Edit health record' : 'Log mortality or health event'}
                description="Treatment costs post to finance; mortality reduces the flock count."
                action={editingHealth ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditingHealth(null)}>Cancel edit</Button>
                ) : undefined}
              />
              <form key={editingHealth?.id ?? 'health-new'} onSubmit={submitHealth} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Batch" name="batchId" defaultValue={editingHealth?.batchId ?? ''} required>
                  <option value="">Select batch…</option>
                  {activeBatches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingHealth?.date ?? today()} />
                <Select label="Type" name="type" defaultValue={editingHealth?.type ?? 'vaccination'} options={healthTypes.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))} />
                <Input label="Bird count (deaths / treated)" name="count" type="number" min={0} placeholder="0" defaultValue={editingHealth?.count ?? ''} />
                <Input label="Product / vaccine" name="product" placeholder="e.g. Newcastle vaccine" defaultValue={editingHealth?.product ?? ''} />
                <Input label="Cost (₦)" name="cost" type="number" min={0} placeholder="0.00" defaultValue={editingHealth?.cost ?? ''} />
                <Textarea label="Notes" name="notes" placeholder="Optional" defaultValue={editingHealth?.notes ?? ''} />
                <div className="flex items-end">
                  <Button type="submit" loading={busy} icon={<HeartPulse size={16} />}>{editingHealth ? 'Save changes' : 'Log record'}</Button>
                </div>
              </form>
              {editingHealth ? (
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Editing a mortality record re-adjusts the flock count automatically.
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Mortality & health log" />
            {healthLogs.length ? (
              <Table headers={['Date', 'Batch', 'Type', 'Count', 'Product', 'Cost', 'Actions']}>
                {healthLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{dateLabel(log.date)}</td>
                    <td className="px-4 py-3 font-semibold">{batchName(log.batchId)}</td>
                    <td className="px-4 py-3 capitalize">{log.type}</td>
                    <td className="px-4 py-3">{formatNumber(log.count)}</td>
                    <td className="px-4 py-3">{log.product || '—'}</td>
                    <td className="px-4 py-3">{log.cost > 0 ? formatMoney(log.cost) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canWrite ? (
                          <Button variant="outline" size="sm" onClick={() => { setEditingHealth(log); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => removeRecord(collectionNames.poultryHealth, log.id, 'health log')}>
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No health records yet" />
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
