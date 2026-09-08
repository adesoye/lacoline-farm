'use client';

import { useMemo, useState } from 'react';
import { Fish, Trash2, Plus, Utensils, HeartPulse, Waves } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  addRecord,
  addRecordWithTransaction,
  collectionNames,
  deleteRecord,
  setRecord,
  updateRecordWithTransaction,
  useFisheryData
} from '@/lib/firebase/firestore';
import { canManageFinance, canWriteFarm, canDeleteRecords } from '@/lib/rbac';
import { asNumber, asString, dateLabel, formatMoney, formatNumber, formatTimestamp, today } from '@/lib/utils';
import type {
  FishPond,
  FishPondType,
  FishStocking,
  FishFeedLog,
  FishHarvest,
  FishHealthLog,
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

type FisheryTab = 'overview' | 'ponds' | 'stocking' | 'feed' | 'harvests' | 'health';

export function FisheryPage() {
  const { profile } = useAuth();
  const { orgId, ponds, stockings, feedLogs, harvests, healthLogs, loading, errors } = useFisheryData();

  const canWrite = canWriteFarm(profile?.role);
  const canFinance = canManageFinance(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const uid = profile?.uid;

  const [tab, setTab] = useState<FisheryTab>('overview');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const emptyPond = { name: '', type: 'earthen' as FishPondType, size: '', unit: 'sqm', notes: '', status: 'active' as FishPond['status'] };
  const [pondForm, setPondForm] = useState({ ...emptyPond });
  const [editingPondId, setEditingPondId] = useState<string | null>(null);

  const [editingStocking, setEditingStocking] = useState<FishStocking | null>(null);
  const [editingFeed, setEditingFeed] = useState<FishFeedLog | null>(null);
  const [editingHarvest, setEditingHarvest] = useState<FishHarvest | null>(null);
  const [editingHealth, setEditingHealth] = useState<FishHealthLog | null>(null);

  const pondName = (id: string) => ponds.find(p => p.id === id)?.name || 'Unknown pond';
  const activePonds = ponds.filter(p => p.status === 'active');

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const harvestedThisMonth = harvests
      .filter(h => h.date?.startsWith(month))
      .reduce((sum, h) => sum + (h.weightKg || 0), 0);
    const stockingCost = stockings.reduce((sum, s) => sum + (s.count || 0) * (s.costPerFish || 0), 0);
    // Estimated live fish: stocked - full-harvest counts - mortality.
    const stocked = stockings.reduce((sum, s) => sum + (s.count || 0), 0);
    const harvestedCount = harvests.filter(h => h.type === 'full').reduce((sum, h) => sum + (h.fishCount || 0), 0);
    const mortality = healthLogs.reduce((sum, h) => sum + (h.count || 0), 0);
    return { harvestedThisMonth, stockingCost, liveFish: Math.max(0, stocked - harvestedCount - mortality) };
  }, [harvests, stockings, healthLogs]);

  function flash(tone: 'success' | 'error', text: string) {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 4000);
  }

  function resetPondForm() {
    setPondForm({ ...emptyPond });
    setEditingPondId(null);
  }

  function startEditPond(pond: FishPond) {
    setEditingPondId(pond.id);
    setPondForm({
      name: pond.name || '',
      type: pond.type || 'earthen',
      size: pond.size ? String(pond.size) : '',
      unit: pond.unit || 'sqm',
      notes: pond.notes || '',
      status: pond.status || 'active'
    });
    setTab('ponds');
  }

  async function submitPond(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const name = pondForm.name.trim();
    if (!name) return flash('error', 'Pond name is required.');
    setBusy(true);
    try {
      const payload = {
        name,
        type: pondForm.type,
        size: Number(pondForm.size) || 0,
        unit: pondForm.unit,
        notes: pondForm.notes.trim(),
        status: pondForm.status
      };
      if (editingPondId) {
        await setRecord(orgId, collectionNames.fishPonds, editingPondId, payload, uid);
        flash('success', `Pond "${name}" updated.`);
      } else {
        await addRecord(orgId, collectionNames.fishPonds, { ...payload, status: 'active' }, uid);
        flash('success', `Pond "${name}" added.`);
      }
      resetPondForm();
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save pond.');
    } finally {
      setBusy(false);
    }
  }

  async function submitStocking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const pondId = asString(form.get('pondId'));
    if (!pondId) return flash('error', 'Select a pond.');
    const count = asNumber(form.get('count'));
    if (!count) return flash('error', 'Fingerling count is required.');
    const date = asString(form.get('date')) || today();
    const costPerFish = asNumber(form.get('costPerFish'));
    const record = {
      pondId,
      date,
      species: asString(form.get('species')),
      count,
      avgWeightG: asNumber(form.get('avgWeightG')),
      costPerFish,
      supplier: asString(form.get('supplier'))
    };
    const cost = count * costPerFish;
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && cost > 0
        ? { date, type: 'expense', category: 'fingerling-purchase', description: `Fish stocking — ${pondName(pondId)}`, amount: cost, method: 'cash' }
        : null;
    setBusy(true);
    try {
      if (editingStocking) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.fishStockings, editingStocking.id, record, editingStocking.transactionId, transaction, canFinance, uid);
        setEditingStocking(null);
        flash('success', 'Stocking updated.');
      } else {
        await addRecordWithTransaction<Omit<FishStocking, 'id'>>(orgId, collectionNames.fishStockings, record, transaction, uid);
        formElement.reset();
        flash('success', 'Stocking recorded.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save stocking.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const pondId = asString(form.get('pondId'));
    if (!pondId) return flash('error', 'Select a pond.');
    const quantity = asNumber(form.get('quantity'));
    if (!quantity) return flash('error', 'Quantity is required.');
    const date = asString(form.get('date')) || today();
    const cost = asNumber(form.get('cost'));
    const record = { pondId, date, feedType: asString(form.get('feedType')) || 'Feed', quantity, cost, notes: asString(form.get('notes')) };
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && cost > 0
        ? { date, type: 'expense', category: 'feed', description: `Fish feed — ${pondName(pondId)}`, amount: cost, method: 'cash' }
        : null;
    setBusy(true);
    try {
      if (editingFeed) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.fishFeedLogs, editingFeed.id, record, editingFeed.transactionId, transaction, canFinance, uid);
        setEditingFeed(null);
        flash('success', 'Feed record updated.');
      } else {
        await addRecordWithTransaction<Omit<FishFeedLog, 'id'>>(orgId, collectionNames.fishFeedLogs, record, transaction, uid);
        formElement.reset();
        flash('success', 'Feed logged.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save feed record.');
    } finally {
      setBusy(false);
    }
  }

  async function submitHarvest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const pondId = asString(form.get('pondId'));
    if (!pondId) return flash('error', 'Select a pond.');
    const weightKg = asNumber(form.get('weightKg'));
    if (!weightKg) return flash('error', 'Harvest weight is required.');
    const date = asString(form.get('date')) || today();
    const pricePerKg = asNumber(form.get('pricePerKg'));
    const revenue = weightKg * pricePerKg;
    const record = {
      pondId,
      date,
      species: asString(form.get('species')),
      fishCount: asNumber(form.get('fishCount')),
      weightKg,
      pricePerKg,
      revenue,
      buyer: asString(form.get('buyer')),
      type: (asString(form.get('type')) as FishHarvest['type']) || 'partial'
    };
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && revenue > 0
        ? { date, type: 'income', category: 'fish-sales', description: `Fish harvest — ${pondName(pondId)}`, amount: revenue, method: 'cash' }
        : null;
    setBusy(true);
    try {
      if (editingHarvest) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.fishHarvests, editingHarvest.id, record, editingHarvest.transactionId, transaction, canFinance, uid);
        setEditingHarvest(null);
        flash('success', 'Harvest updated.');
      } else {
        await addRecordWithTransaction<Omit<FishHarvest, 'id'>>(orgId, collectionNames.fishHarvests, record, transaction, uid);
        formElement.reset();
        flash('success', 'Harvest recorded.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save harvest.');
    } finally {
      setBusy(false);
    }
  }

  async function submitHealth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const pondId = asString(form.get('pondId'));
    if (!pondId) return flash('error', 'Select a pond.');
    const date = asString(form.get('date')) || today();
    const cost = asNumber(form.get('cost'));
    const record = { pondId, date, count: asNumber(form.get('count')), drug: asString(form.get('drug')), cost, notes: asString(form.get('notes')) };
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && cost > 0
        ? { date, type: 'expense', category: 'medication', description: `Fish treatment — ${pondName(pondId)}`, amount: cost, method: 'cash' }
        : null;
    setBusy(true);
    try {
      if (editingHealth) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.fishHealth, editingHealth.id, record, editingHealth.transactionId, transaction, canFinance, uid);
        setEditingHealth(null);
        flash('success', 'Health record updated.');
      } else {
        await addRecordWithTransaction<Omit<FishHealthLog, 'id'>>(orgId, collectionNames.fishHealth, record, transaction, uid);
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

  const editBtn = (onClick: () => void) =>
    canWrite ? (
      <Button variant="outline" size="sm" onClick={() => { onClick(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button>
    ) : null;

  const deleteBtn = (collection: string, id: string, label: string) =>
    canDelete ? (
      <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => removeRecord(collection, id, label)}>Delete</Button>
    ) : null;

  if (loading) {
    return <div className="rounded-3xl bg-white p-6 font-bold text-slate-600 shadow-card">Loading fishery records...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Fishery"
        description="Manage ponds and tanks — stocking, feeding, harvests, and pond health. Stocking, feed, treatment, and harvest sales post to your finance ledger automatically."
      />

      {errors.length ? <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{errors.join(', ')}</div> : null}
      {notice ? (
        <div className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{notice.text}</div>
      ) : null}

      <Tabs<FisheryTab>
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'ponds', label: 'Ponds' },
          { value: 'stocking', label: 'Stocking' },
          { value: 'feed', label: 'Feed' },
          { value: 'harvests', label: 'Harvests' },
          { value: 'health', label: 'Mortality & Health' }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active ponds" value={formatNumber(activePonds.length)} tone="forest" icon={<Waves size={18} />} />
          <StatCard label="Est. live fish" value={formatNumber(stats.liveFish)} tone="slate" icon={<Fish size={18} />} />
          <StatCard label="Harvested this month (kg)" value={formatNumber(stats.harvestedThisMonth, 1)} tone="clay" />
          <StatCard label="Stocking cost to date" value={canFinance ? formatMoney(stats.stockingCost) : 'Hidden'} tone="slate" />
        </div>
      ) : null}

      {tab === 'ponds' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle
                title={editingPondId ? 'Edit pond' : 'Register pond / tank'}
                action={editingPondId ? <Button variant="ghost" size="sm" onClick={resetPondForm}>Cancel edit</Button> : undefined}
              />
              <form onSubmit={submitPond} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Input label="Pond name / ID" value={pondForm.name} onChange={e => setPondForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pond 1 — Catfish" />
                <Select label="Type" value={pondForm.type} onChange={e => setPondForm(f => ({ ...f, type: e.target.value as FishPondType }))}
                  options={[
                    { label: 'Earthen pond', value: 'earthen' },
                    { label: 'Concrete pond', value: 'concrete' },
                    { label: 'Tank / tarpaulin', value: 'tank' },
                    { label: 'Cage culture', value: 'cage' }
                  ]} />
                <Input label="Size / capacity" type="number" min={0} value={pondForm.size} onChange={e => setPondForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 500" />
                <Select label="Unit" value={pondForm.unit} onChange={e => setPondForm(f => ({ ...f, unit: e.target.value }))}
                  options={[
                    { label: 'sq metres', value: 'sqm' },
                    { label: 'litres', value: 'litres' },
                    { label: 'cubic metres', value: 'm3' }
                  ]} />
                <Input label="Location / notes" value={pondForm.notes} onChange={e => setPondForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Back plot" />
                {editingPondId ? (
                  <Select label="Status" value={pondForm.status} onChange={e => setPondForm(f => ({ ...f, status: e.target.value as FishPond['status'] }))}
                    options={[{ label: 'Active', value: 'active' }, { label: 'Closed', value: 'closed' }]} />
                ) : null}
                <div className="flex items-end">
                  <Button type="submit" loading={busy} icon={<Plus size={16} />}>{editingPondId ? 'Save changes' : 'Add pond'}</Button>
                </div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Ponds" />
            {ponds.length ? (
              <Table headers={['Pond', 'Type', 'Size', 'Status', 'Actions']}>
                {ponds.map(pond => (
                  <tr key={pond.id}>
                    <td className="px-4 py-3 font-black text-emerald-800">
                      {pond.name}
                      {formatTimestamp(pond.updatedAt) ? <span className="block text-[11px] font-semibold text-slate-400">✏️ edited {formatTimestamp(pond.updatedAt)}</span> : null}
                    </td>
                    <td className="px-4 py-3 capitalize">{pond.type}</td>
                    <td className="px-4 py-3">{pond.size > 0 ? `${formatNumber(pond.size)} ${pond.unit}` : '—'}</td>
                    <td className="px-4 py-3 capitalize">{pond.status}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => startEditPond(pond))}{deleteBtn(collectionNames.fishPonds, pond.id, 'pond')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No ponds yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'stocking' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingStocking ? 'Edit stocking' : 'Record stocking'} description="Cost of fingerlings posts to finance." action={editingStocking ? <Button variant="ghost" size="sm" onClick={() => setEditingStocking(null)}>Cancel edit</Button> : undefined} />
              <form key={editingStocking?.id ?? 'stock-new'} onSubmit={submitStocking} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Pond" name="pondId" defaultValue={editingStocking?.pondId ?? ''} required>
                  <option value="">Select pond…</option>
                  {ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingStocking?.date ?? today()} />
                <Input label="Species" name="species" placeholder="e.g. Catfish" defaultValue={editingStocking?.species ?? ''} />
                <Input label="Fingerling count" name="count" type="number" min={0} placeholder="0" defaultValue={editingStocking?.count ?? ''} />
                <Input label="Avg weight (g)" name="avgWeightG" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingStocking?.avgWeightG ?? ''} />
                <Input label="Cost per fish (₦)" name="costPerFish" type="number" min={0} step="0.01" placeholder="0.00" defaultValue={editingStocking?.costPerFish ?? ''} />
                <Input label="Supplier" name="supplier" placeholder="Optional" defaultValue={editingStocking?.supplier ?? ''} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<Plus size={16} />}>{editingStocking ? 'Save changes' : 'Record stocking'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Stocking log" />
            {stockings.length ? (
              <Table headers={['Date', 'Pond', 'Species', 'Count', 'Cost', 'Actions']}>
                {stockings.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{dateLabel(s.date)}</td>
                    <td className="px-4 py-3 font-semibold">{pondName(s.pondId)}</td>
                    <td className="px-4 py-3">{s.species || '—'}</td>
                    <td className="px-4 py-3">{formatNumber(s.count)}</td>
                    <td className="px-4 py-3">{s.costPerFish > 0 ? formatMoney(s.count * s.costPerFish) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingStocking(s))}{deleteBtn(collectionNames.fishStockings, s.id, 'stocking')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No stocking records yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'feed' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingFeed ? 'Edit feed record' : 'Log fish feed'} description="Feed cost posts to finance." action={editingFeed ? <Button variant="ghost" size="sm" onClick={() => setEditingFeed(null)}>Cancel edit</Button> : undefined} />
              <form key={editingFeed?.id ?? 'feed-new'} onSubmit={submitFeed} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Pond" name="pondId" defaultValue={editingFeed?.pondId ?? ''} required>
                  <option value="">Select pond…</option>
                  {activePonds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingFeed?.date ?? today()} />
                <Input label="Feed type" name="feedType" placeholder="e.g. Floating pellets" defaultValue={editingFeed?.feedType ?? ''} />
                <Input label="Quantity (kg)" name="quantity" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingFeed?.quantity ?? ''} />
                <Input label="Cost (₦)" name="cost" type="number" min={0} placeholder="0.00" defaultValue={editingFeed?.cost ?? ''} />
                <Input label="Notes" name="notes" placeholder="Optional" defaultValue={editingFeed?.notes ?? ''} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<Utensils size={16} />}>{editingFeed ? 'Save changes' : 'Log feed'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Feed log" />
            {feedLogs.length ? (
              <Table headers={['Date', 'Pond', 'Feed type', 'Qty (kg)', 'Cost', 'Actions']}>
                {feedLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{dateLabel(log.date)}</td>
                    <td className="px-4 py-3 font-semibold">{pondName(log.pondId)}</td>
                    <td className="px-4 py-3">{log.feedType}</td>
                    <td className="px-4 py-3">{formatNumber(log.quantity, 1)}</td>
                    <td className="px-4 py-3">{log.cost > 0 ? formatMoney(log.cost) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingFeed(log))}{deleteBtn(collectionNames.fishFeedLogs, log.id, 'feed log')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No feed records yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'harvests' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingHarvest ? 'Edit harvest' : 'Record harvest'} description="Harvest sales post to finance as income." action={editingHarvest ? <Button variant="ghost" size="sm" onClick={() => setEditingHarvest(null)}>Cancel edit</Button> : undefined} />
              <form key={editingHarvest?.id ?? 'harvest-new'} onSubmit={submitHarvest} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Pond" name="pondId" defaultValue={editingHarvest?.pondId ?? ''} required>
                  <option value="">Select pond…</option>
                  {ponds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingHarvest?.date ?? today()} />
                <Input label="Species" name="species" placeholder="e.g. Catfish" defaultValue={editingHarvest?.species ?? ''} />
                <Input label="Fish count" name="fishCount" type="number" min={0} placeholder="0" defaultValue={editingHarvest?.fishCount ?? ''} />
                <Input label="Weight (kg)" name="weightKg" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingHarvest?.weightKg ?? ''} />
                <Input label="Price per kg (₦)" name="pricePerKg" type="number" min={0} placeholder="0.00" defaultValue={editingHarvest?.pricePerKg ?? ''} />
                <Input label="Buyer" name="buyer" placeholder="Optional" defaultValue={editingHarvest?.buyer ?? ''} />
                <Select label="Type" name="type" defaultValue={editingHarvest?.type ?? 'partial'} options={[{ label: 'Partial', value: 'partial' }, { label: 'Full (pond emptied)', value: 'full' }]} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<Fish size={16} />}>{editingHarvest ? 'Save changes' : 'Record harvest'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Harvest log" />
            {harvests.length ? (
              <Table headers={['Date', 'Pond', 'Weight (kg)', 'Revenue', 'Type', 'Actions']}>
                {harvests.map(h => (
                  <tr key={h.id}>
                    <td className="px-4 py-3">{dateLabel(h.date)}</td>
                    <td className="px-4 py-3 font-semibold">{pondName(h.pondId)}</td>
                    <td className="px-4 py-3">{formatNumber(h.weightKg, 1)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{h.revenue > 0 ? formatMoney(h.revenue) : '—'}</td>
                    <td className="px-4 py-3 capitalize">{h.type}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingHarvest(h))}{deleteBtn(collectionNames.fishHarvests, h.id, 'harvest')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No harvest records yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'health' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingHealth ? 'Edit health record' : 'Log mortality or treatment'} description="Treatment cost posts to finance." action={editingHealth ? <Button variant="ghost" size="sm" onClick={() => setEditingHealth(null)}>Cancel edit</Button> : undefined} />
              <form key={editingHealth?.id ?? 'health-new'} onSubmit={submitHealth} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Pond" name="pondId" defaultValue={editingHealth?.pondId ?? ''} required>
                  <option value="">Select pond…</option>
                  {activePonds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingHealth?.date ?? today()} />
                <Input label="Mortality count" name="count" type="number" min={0} placeholder="0" defaultValue={editingHealth?.count ?? ''} />
                <Input label="Drug / treatment" name="drug" placeholder="Optional" defaultValue={editingHealth?.drug ?? ''} />
                <Input label="Cost (₦)" name="cost" type="number" min={0} placeholder="0.00" defaultValue={editingHealth?.cost ?? ''} />
                <Textarea label="Notes" name="notes" placeholder="Optional" defaultValue={editingHealth?.notes ?? ''} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<HeartPulse size={16} />}>{editingHealth ? 'Save changes' : 'Log record'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Mortality & health log" />
            {healthLogs.length ? (
              <Table headers={['Date', 'Pond', 'Mortality', 'Drug', 'Cost', 'Actions']}>
                {healthLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{dateLabel(log.date)}</td>
                    <td className="px-4 py-3 font-semibold">{pondName(log.pondId)}</td>
                    <td className="px-4 py-3">{formatNumber(log.count)}</td>
                    <td className="px-4 py-3">{log.drug || '—'}</td>
                    <td className="px-4 py-3">{log.cost > 0 ? formatMoney(log.cost) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingHealth(log))}{deleteBtn(collectionNames.fishHealth, log.id, 'health log')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No health records yet" />}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
