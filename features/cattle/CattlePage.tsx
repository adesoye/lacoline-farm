'use client';

import { useMemo, useState } from 'react';
import { Beef, Trash2, Plus, Utensils, HeartPulse, Milk, Scale } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  addRecord,
  addRecordWithTransaction,
  collectionNames,
  deleteRecord,
  setRecord,
  updateRecordWithTransaction,
  useCattleData
} from '@/lib/firebase/firestore';
import { canManageFinance, canWriteFarm, canDeleteRecords } from '@/lib/rbac';
import { asNumber, asString, dateLabel, formatMoney, formatNumber, formatTimestamp, today } from '@/lib/utils';
import type {
  Cattle,
  CattleSex,
  CattleType,
  MilkLog,
  AnimalWeight,
  HerdEvent,
  HerdEventType,
  HerdFeedLog,
  LivestockStatus,
  PigSource,
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

type CattleTab = 'overview' | 'herd' | 'milk' | 'weights' | 'health' | 'feed';

const eventTypes: HerdEventType[] = ['vaccination', 'treatment', 'deworming', 'sold', 'dead', 'other'];

export function CattlePage() {
  const { profile } = useAuth();
  const { orgId, herd, milkLogs, weights, events, feedLogs, loading, errors } = useCattleData();

  const canWrite = canWriteFarm(profile?.role);
  const canFinance = canManageFinance(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const uid = profile?.uid;

  const [tab, setTab] = useState<CattleTab>('overview');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const emptyAnimal = {
    tag: '', name: '', type: 'dairy' as CattleType, sex: 'cow' as CattleSex,
    breed: '', dob: '', source: 'purchased' as PigSource, purchasePrice: '', initialWeight: '',
    status: 'active' as LivestockStatus
  };
  const [animalForm, setAnimalForm] = useState({ ...emptyAnimal });
  const [editingAnimalId, setEditingAnimalId] = useState<string | null>(null);

  const [editingMilk, setEditingMilk] = useState<MilkLog | null>(null);
  const [editingWeight, setEditingWeight] = useState<AnimalWeight | null>(null);
  const [editingEvent, setEditingEvent] = useState<HerdEvent | null>(null);
  const [editingFeed, setEditingFeed] = useState<HerdFeedLog | null>(null);

  const activeHerd = herd.filter(a => a.status === 'active');
  const animalLabel = (id: string) => {
    const a = herd.find(x => x.id === id);
    return a ? `${a.tag}${a.name ? ` — ${a.name}` : ''}` : 'Unknown';
  };
  const lastWeight = (animalId: string) => {
    const rows = weights.filter(w => w.animalId === animalId).slice().sort((a, b) => a.date.localeCompare(b.date));
    return rows.length ? rows[rows.length - 1] : null;
  };

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const milkThisMonth = milkLogs.filter(l => l.date?.startsWith(month)).reduce((s, l) => s + (l.total || 0), 0);
    return { active: activeHerd.length, milkThisMonth };
  }, [activeHerd.length, milkLogs]);

  function flash(tone: 'success' | 'error', text: string) {
    setNotice({ tone, text });
    setTimeout(() => setNotice(null), 4000);
  }

  function resetAnimalForm() {
    setAnimalForm({ ...emptyAnimal });
    setEditingAnimalId(null);
  }

  function startEditAnimal(animal: Cattle) {
    setEditingAnimalId(animal.id);
    setAnimalForm({
      tag: animal.tag || '',
      name: animal.name || '',
      type: animal.type || 'dairy',
      sex: animal.sex || 'cow',
      breed: animal.breed || '',
      dob: animal.dob || '',
      source: animal.source || 'purchased',
      purchasePrice: animal.purchasePrice ? String(animal.purchasePrice) : '',
      initialWeight: '',
      status: animal.status || 'active'
    });
    setTab('herd');
  }

  async function submitAnimal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const tag = animalForm.tag.trim();
    if (!tag) return flash('error', 'Ear tag is required.');
    const duplicate = herd.find(a => a.tag === tag && a.id !== editingAnimalId);
    if (duplicate) return flash('error', 'Another animal already uses this tag.');

    setBusy(true);
    try {
      const payload = {
        tag,
        name: animalForm.name.trim(),
        type: animalForm.type,
        sex: animalForm.sex,
        breed: animalForm.breed.trim(),
        dob: animalForm.dob,
        source: animalForm.source,
        purchasePrice: Number(animalForm.purchasePrice) || 0,
        status: animalForm.status
      };
      if (editingAnimalId) {
        await setRecord(orgId, collectionNames.cattle, editingAnimalId, payload, uid);
        flash('success', `${tag} updated.`);
      } else {
        const id = await addRecord(orgId, collectionNames.cattle, { ...payload, status: 'active' }, uid);
        const initial = Number(animalForm.initialWeight) || 0;
        if (initial > 0) {
          await addRecord(orgId, collectionNames.cattleWeights, { animalId: (id as { id: string }).id, date: animalForm.dob || today(), weight: initial, notes: 'Initial weight' }, uid);
        }
        flash('success', `${tag} registered.`);
      }
      resetAnimalForm();
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save animal.');
    } finally {
      setBusy(false);
    }
  }

  async function submitMilk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const animalId = asString(form.get('animalId'));
    if (!animalId) return flash('error', 'Select an animal.');
    const date = asString(form.get('date')) || today();
    const morning = asNumber(form.get('morning'));
    const evening = asNumber(form.get('evening'));
    const total = morning + evening;
    const pricePerLitre = asNumber(form.get('pricePerLitre'));
    const revenue = total * pricePerLitre;
    const record = { animalId, date, morning, evening, total, pricePerLitre, revenue, notes: asString(form.get('notes')) };
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && revenue > 0
        ? { date, type: 'income', category: 'milk-sales', description: `Milk — ${animalLabel(animalId)}`, amount: revenue, method: 'cash' }
        : null;
    setBusy(true);
    try {
      if (editingMilk) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.cattleMilkLogs, editingMilk.id, record, editingMilk.transactionId, transaction, canFinance, uid);
        setEditingMilk(null);
        flash('success', 'Milk record updated.');
      } else {
        await addRecordWithTransaction<Omit<MilkLog, 'id'>>(orgId, collectionNames.cattleMilkLogs, record, transaction, uid);
        formElement.reset();
        flash('success', 'Milk logged.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save milk record.');
    } finally {
      setBusy(false);
    }
  }

  async function submitWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const animalId = asString(form.get('animalId'));
    if (!animalId) return flash('error', 'Select an animal.');
    const weight = asNumber(form.get('weight'));
    if (!weight) return flash('error', 'Weight is required.');
    const record = { animalId, date: asString(form.get('date')) || today(), weight, notes: asString(form.get('notes')) };
    setBusy(true);
    try {
      if (editingWeight) {
        await setRecord(orgId, collectionNames.cattleWeights, editingWeight.id, record, uid);
        setEditingWeight(null);
        flash('success', 'Weight record updated.');
      } else {
        await addRecord(orgId, collectionNames.cattleWeights, record, uid);
        formElement.reset();
        flash('success', 'Weight recorded.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save weight.');
    } finally {
      setBusy(false);
    }
  }

  async function submitEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const animalId = asString(form.get('animalId'));
    if (!animalId) return flash('error', 'Select an animal.');
    const date = asString(form.get('date')) || today();
    const type = asString(form.get('type')) as HerdEventType;
    const cost = asNumber(form.get('cost'));
    const record = { animalId, date, type, drug: asString(form.get('drug')), cost, notes: asString(form.get('notes')) };

    let transaction: Omit<Transaction, 'id'> | null = null;
    if (canFinance && cost > 0) {
      if (type === 'sold') {
        transaction = { date, type: 'income', category: 'cattle-sales', description: `Cattle sale — ${animalLabel(animalId)}`, amount: cost, method: 'cash' };
      } else if (type === 'vaccination' || type === 'treatment' || type === 'deworming') {
        transaction = { date, type: 'expense', category: type === 'vaccination' ? 'vaccine' : 'medication', description: `Cattle ${type} — ${animalLabel(animalId)}`, amount: cost, method: 'cash' };
      }
    }

    setBusy(true);
    try {
      if (editingEvent) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.cattleEvents, editingEvent.id, record, editingEvent.transactionId, transaction, canFinance, uid);
        setEditingEvent(null);
        flash('success', 'Event updated.');
      } else {
        await addRecordWithTransaction<Omit<HerdEvent, 'id'>>(orgId, collectionNames.cattleEvents, record, transaction, uid);
        formElement.reset();
        flash('success', 'Event recorded.');
      }
      if (type === 'sold' || type === 'dead') {
        await setRecord(orgId, collectionNames.cattle, animalId, { status: type === 'sold' ? 'sold' : 'dead' }, uid);
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save event.');
    } finally {
      setBusy(false);
    }
  }

  async function submitFeed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const animalIdRaw = asString(form.get('animalId'));
    const quantity = asNumber(form.get('quantity'));
    if (!quantity) return flash('error', 'Quantity is required.');
    const date = asString(form.get('date')) || today();
    const cost = asNumber(form.get('cost'));
    const record = { animalId: animalIdRaw || null, date, feedType: asString(form.get('feedType')) || 'Feed', quantity, cost, notes: asString(form.get('notes')) };
    const transaction: Omit<Transaction, 'id'> | null =
      canFinance && cost > 0
        ? { date, type: 'expense', category: 'feed', description: `Cattle feed${animalIdRaw ? ` — ${animalLabel(animalIdRaw)}` : ' — herd'}`, amount: cost, method: 'cash' }
        : null;
    setBusy(true);
    try {
      if (editingFeed) {
        await updateRecordWithTransaction<typeof record>(orgId, collectionNames.cattleFeedLogs, editingFeed.id, record, editingFeed.transactionId, transaction, canFinance, uid);
        setEditingFeed(null);
        flash('success', 'Feed record updated.');
      } else {
        await addRecordWithTransaction<Omit<HerdFeedLog, 'id'>>(orgId, collectionNames.cattleFeedLogs, record, transaction, uid);
        formElement.reset();
        flash('success', 'Feed logged.');
      }
    } catch (error) {
      flash('error', error instanceof Error ? error.message : 'Could not save feed record.');
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
    canWrite ? <Button variant="outline" size="sm" onClick={() => { onClick(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</Button> : null;
  const deleteBtn = (collection: string, id: string, label: string) =>
    canDelete ? <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => removeRecord(collection, id, label)}>Delete</Button> : null;

  if (loading) {
    return <div className="rounded-3xl bg-white p-6 font-bold text-slate-600 shadow-card">Loading cattle records...</div>;
  }

  const milkAnimals = herd.filter(a => a.status === 'active' && (a.type === 'dairy' || a.type === 'dual'));

  return (
    <div>
      <PageHeader
        title="Cattle"
        description="Individual animal records — milk production, weight gain, health events, and feed for dairy and beef cattle. Milk, sales, treatments, and feed post to finance automatically."
      />

      {errors.length ? <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{errors.join(', ')}</div> : null}
      {notice ? <div className={`mb-5 rounded-2xl p-4 text-sm font-semibold ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{notice.text}</div> : null}

      <Tabs<CattleTab>
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'herd', label: 'Herd Register' },
          { value: 'milk', label: 'Milk Production' },
          { value: 'weights', label: 'Weight Records' },
          { value: 'health', label: 'Health & Events' },
          { value: 'feed', label: 'Feed Log' }
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active cattle" value={formatNumber(stats.active)} tone="forest" icon={<Beef size={18} />} />
          <StatCard label="Milk this month (L)" value={formatNumber(stats.milkThisMonth, 1)} tone="clay" icon={<Milk size={18} />} />
          <StatCard label="Sold" value={formatNumber(herd.filter(a => a.status === 'sold').length)} tone="slate" />
          <StatCard label="Deaths" value={formatNumber(herd.filter(a => a.status === 'dead').length)} tone="red" />
        </div>
      ) : null}

      {tab === 'herd' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingAnimalId ? 'Edit animal' : 'Register animal'} action={editingAnimalId ? <Button variant="ghost" size="sm" onClick={resetAnimalForm}>Cancel edit</Button> : undefined} />
              <form onSubmit={submitAnimal} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Input label="Ear tag / ID" value={animalForm.tag} onChange={e => setAnimalForm(f => ({ ...f, tag: e.target.value }))} placeholder="e.g. CTL-001" />
                <Input label="Name" value={animalForm.name} onChange={e => setAnimalForm(f => ({ ...f, name: e.target.value }))} placeholder="Optional" />
                <Select label="Type" value={animalForm.type} onChange={e => setAnimalForm(f => ({ ...f, type: e.target.value as CattleType }))}
                  options={[{ label: 'Dairy Cow', value: 'dairy' }, { label: 'Beef Cattle', value: 'beef' }, { label: 'Dual Purpose', value: 'dual' }]} />
                <Select label="Sex" value={animalForm.sex} onChange={e => setAnimalForm(f => ({ ...f, sex: e.target.value as CattleSex }))}
                  options={[{ label: 'Cow', value: 'cow' }, { label: 'Bull', value: 'bull' }, { label: 'Heifer', value: 'heifer' }, { label: 'Steer', value: 'steer' }, { label: 'Calf', value: 'calf' }]} />
                <Input label="Breed" value={animalForm.breed} onChange={e => setAnimalForm(f => ({ ...f, breed: e.target.value }))} placeholder="e.g. Friesian" />
                <Input label="DOB / acquired" type="date" value={animalForm.dob} onChange={e => setAnimalForm(f => ({ ...f, dob: e.target.value }))} />
                <Select label="Source" value={animalForm.source} onChange={e => setAnimalForm(f => ({ ...f, source: e.target.value as PigSource }))}
                  options={[{ label: 'Purchased', value: 'purchased' }, { label: 'Born on farm', value: 'born' }]} />
                <Input label="Purchase price (₦)" type="number" min={0} value={animalForm.purchasePrice} onChange={e => setAnimalForm(f => ({ ...f, purchasePrice: e.target.value }))} placeholder="0.00" />
                {editingAnimalId ? (
                  <Select label="Status" value={animalForm.status} onChange={e => setAnimalForm(f => ({ ...f, status: e.target.value as LivestockStatus }))}
                    options={[{ label: 'Active', value: 'active' }, { label: 'Sold', value: 'sold' }, { label: 'Dead', value: 'dead' }]} />
                ) : (
                  <Input label="Initial weight (kg)" type="number" min={0} step="0.1" value={animalForm.initialWeight} onChange={e => setAnimalForm(f => ({ ...f, initialWeight: e.target.value }))} placeholder="0.0" />
                )}
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<Plus size={16} />}>{editingAnimalId ? 'Save changes' : 'Register animal'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Herd" />
            {herd.length ? (
              <Table headers={['Tag', 'Name', 'Type', 'Sex', 'Status', 'Last Weight', 'Actions']}>
                {herd.map(a => {
                  const lw = lastWeight(a.id);
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-black text-emerald-800">
                        {a.tag}
                        {formatTimestamp(a.updatedAt) ? <span className="block text-[11px] font-semibold text-slate-400">✏️ edited {formatTimestamp(a.updatedAt)}</span> : null}
                      </td>
                      <td className="px-4 py-3">{a.name || '—'}</td>
                      <td className="px-4 py-3 capitalize">{a.type}</td>
                      <td className="px-4 py-3 capitalize">{a.sex}</td>
                      <td className="px-4 py-3 capitalize">{a.status}</td>
                      <td className="px-4 py-3">{lw ? `${formatNumber(lw.weight, 1)} kg` : '—'}</td>
                      <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => startEditAnimal(a))}{deleteBtn(collectionNames.cattle, a.id, 'animal')}</div></td>
                    </tr>
                  );
                })}
              </Table>
            ) : <EmptyState title="No cattle registered yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'milk' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingMilk ? 'Edit milk record' : 'Log milk production'} description="Milk sales value posts to finance." action={editingMilk ? <Button variant="ghost" size="sm" onClick={() => setEditingMilk(null)}>Cancel edit</Button> : undefined} />
              <form key={editingMilk?.id ?? 'milk-new'} onSubmit={submitMilk} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Animal" name="animalId" defaultValue={editingMilk?.animalId ?? ''} required>
                  <option value="">Select animal…</option>
                  {milkAnimals.map(a => <option key={a.id} value={a.id}>{a.tag}{a.name ? ` — ${a.name}` : ''}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingMilk?.date ?? today()} />
                <Input label="Morning (L)" name="morning" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingMilk?.morning ?? ''} />
                <Input label="Evening (L)" name="evening" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingMilk?.evening ?? ''} />
                <Input label="Price per litre (₦)" name="pricePerLitre" type="number" min={0} placeholder="0.00" defaultValue={editingMilk?.pricePerLitre ?? ''} />
                <Input label="Notes" name="notes" placeholder="Optional" defaultValue={editingMilk?.notes ?? ''} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<Milk size={16} />}>{editingMilk ? 'Save changes' : 'Log milk'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Milk log" />
            {milkLogs.length ? (
              <Table headers={['Date', 'Animal', 'Total (L)', 'Revenue', 'Actions']}>
                {milkLogs.map(l => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">{dateLabel(l.date)}</td>
                    <td className="px-4 py-3 font-semibold">{animalLabel(l.animalId)}</td>
                    <td className="px-4 py-3">{formatNumber(l.total, 1)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{l.revenue > 0 ? formatMoney(l.revenue) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingMilk(l))}{deleteBtn(collectionNames.cattleMilkLogs, l.id, 'milk log')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No milk records yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'weights' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingWeight ? 'Edit weight record' : 'Record weight'} action={editingWeight ? <Button variant="ghost" size="sm" onClick={() => setEditingWeight(null)}>Cancel edit</Button> : undefined} />
              <form key={editingWeight?.id ?? 'wt-new'} onSubmit={submitWeight} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Animal" name="animalId" defaultValue={editingWeight?.animalId ?? ''} required>
                  <option value="">Select animal…</option>
                  {activeHerd.map(a => <option key={a.id} value={a.id}>{a.tag}{a.name ? ` — ${a.name}` : ''}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingWeight?.date ?? today()} />
                <Input label="Weight (kg)" name="weight" type="number" min={0} step="0.1" placeholder="0" defaultValue={editingWeight?.weight ?? ''} />
                <Input label="Notes" name="notes" placeholder="Optional" defaultValue={editingWeight?.notes ?? ''} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<Scale size={16} />}>{editingWeight ? 'Save changes' : 'Record weight'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Weight records" />
            {weights.length ? (
              <Table headers={['Date', 'Animal', 'Weight (kg)', 'Notes', 'Actions']}>
                {weights.map(w => (
                  <tr key={w.id}>
                    <td className="px-4 py-3">{dateLabel(w.date)}</td>
                    <td className="px-4 py-3 font-semibold">{animalLabel(w.animalId)}</td>
                    <td className="px-4 py-3">{formatNumber(w.weight, 1)}</td>
                    <td className="px-4 py-3 text-slate-500">{w.notes || '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingWeight(w))}{deleteBtn(collectionNames.cattleWeights, w.id, 'weight record')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No weight records yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'health' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingEvent ? 'Edit event' : 'Record health event or sale'} description="Sale posts income; treatments post expenses; sold/dead update the animal's status." action={editingEvent ? <Button variant="ghost" size="sm" onClick={() => setEditingEvent(null)}>Cancel edit</Button> : undefined} />
              <form key={editingEvent?.id ?? 'evt-new'} onSubmit={submitEvent} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Animal" name="animalId" defaultValue={editingEvent?.animalId ?? ''} required>
                  <option value="">Select animal…</option>
                  {herd.map(a => <option key={a.id} value={a.id}>{a.tag}{a.name ? ` — ${a.name}` : ''}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingEvent?.date ?? today()} />
                <Select label="Type" name="type" defaultValue={editingEvent?.type ?? 'vaccination'} options={eventTypes.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: t }))} />
                <Input label="Drug / vaccine" name="drug" placeholder="Optional" defaultValue={editingEvent?.drug ?? ''} />
                <Input label="Cost / sale price (₦)" name="cost" type="number" min={0} placeholder="0.00" defaultValue={editingEvent?.cost ?? ''} />
                <Textarea label="Notes" name="notes" placeholder="Optional" defaultValue={editingEvent?.notes ?? ''} />
                <div className="flex items-end"><Button type="submit" loading={busy} icon={<HeartPulse size={16} />}>{editingEvent ? 'Save changes' : 'Record event'}</Button></div>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardTitle title="Health & event log" />
            {events.length ? (
              <Table headers={['Date', 'Animal', 'Type', 'Drug', 'Amount', 'Actions']}>
                {events.map(e => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">{dateLabel(e.date)}</td>
                    <td className="px-4 py-3 font-semibold">{animalLabel(e.animalId)}</td>
                    <td className="px-4 py-3 capitalize">{e.type}</td>
                    <td className="px-4 py-3">{e.drug || '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${e.type === 'sold' ? 'text-emerald-700' : ''}`}>{e.cost > 0 ? formatMoney(e.cost) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingEvent(e))}{deleteBtn(collectionNames.cattleEvents, e.id, 'event')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No events yet" />}
          </Card>
        </div>
      ) : null}

      {tab === 'feed' ? (
        <div className="space-y-5">
          {canWrite ? (
            <Card>
              <CardTitle title={editingFeed ? 'Edit feed record' : 'Log cattle feed'} description="Feed cost posts to finance." action={editingFeed ? <Button variant="ghost" size="sm" onClick={() => setEditingFeed(null)}>Cancel edit</Button> : undefined} />
              <form key={editingFeed?.id ?? 'feed-new'} onSubmit={submitFeed} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Select label="Animal (optional — blank = herd)" name="animalId" defaultValue={editingFeed?.animalId ?? ''}>
                  <option value="">Whole herd</option>
                  {activeHerd.map(a => <option key={a.id} value={a.id}>{a.tag}{a.name ? ` — ${a.name}` : ''}</option>)}
                </Select>
                <Input label="Date" name="date" type="date" defaultValue={editingFeed?.date ?? today()} />
                <Input label="Feed type" name="feedType" placeholder="e.g. Hay & concentrate" defaultValue={editingFeed?.feedType ?? ''} />
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
              <Table headers={['Date', 'Scope', 'Feed type', 'Qty (kg)', 'Cost', 'Actions']}>
                {feedLogs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{dateLabel(log.date)}</td>
                    <td className="px-4 py-3 font-semibold">{log.animalId ? animalLabel(log.animalId) : 'Whole herd'}</td>
                    <td className="px-4 py-3">{log.feedType}</td>
                    <td className="px-4 py-3">{formatNumber(log.quantity, 1)}</td>
                    <td className="px-4 py-3">{log.cost > 0 ? formatMoney(log.cost) : '—'}</td>
                    <td className="px-4 py-3"><div className="flex gap-2">{editBtn(() => setEditingFeed(log))}{deleteBtn(collectionNames.cattleFeedLogs, log.id, 'feed log')}</div></td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState title="No feed records yet" />}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
