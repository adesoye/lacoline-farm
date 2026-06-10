'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { addRecord, collectionNames, deleteRecord, useFarmData } from '@/lib/firebase/firestore';
import { canDeleteRecords, canManageFinance, canWriteFarm } from '@/lib/rbac';
import type { MonthlyInputCategory, MonthlyInputTarget } from '@/lib/domain/types';
import { asNumber, asString, dateLabel, formatMoney, today } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';

export function MonthlyInputsPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'add' | 'history' | 'summary'>('history');
  const [submitting, setSubmitting] = useState(false);
  const canWrite = canWriteFarm(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    const cost = asNumber(form.get('cost'));
    setSubmitting(true);
    try {
      const category = asString(form.get('category')) as MonthlyInputCategory;
      await addRecord(profile?.activeOrgId, collectionNames.monthlyInputs, {
        date: asString(form.get('date')) || today(),
        category,
        product: asString(form.get('product')),
        target: asString(form.get('target')) as MonthlyInputTarget,
        pigId: asString(form.get('pigId')),
        quantity: asNumber(form.get('quantity')),
        cost,
        nextDue: asString(form.get('nextDue')),
        notes: asString(form.get('notes'))
      }, profile?.uid);
      if (cost > 0 && canManageFinance(profile?.role)) {
        await addRecord(profile?.activeOrgId, collectionNames.transactions, {
          date: asString(form.get('date')) || today(),
          type: 'expense',
          category: category === 'vaccine' ? 'vaccine' : category === 'medication' ? 'medication' : 'other-expense',
          description: `${category} — ${asString(form.get('product'))}`,
          amount: cost,
          method: 'transfer',
          ref: ''
        }, profile?.uid);
      }
      event.currentTarget.reset();
      setTab('history');
    } finally {
      setSubmitting(false);
    }
  }

  const dueSoon = data.monthlyInputs.filter(item => item.nextDue && item.nextDue >= today()).sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue))).slice(0, 20);
  const totalCost = data.monthlyInputs.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div>
      <PageHeader title="Monthly Inputs" description="Track vaccines, medications, disinfectants, vitamins, costs, target pigs, and next due dates." />
      <Tabs tabs={[{ value: 'history', label: 'History' }, { value: 'add', label: 'Add Input' }, { value: 'summary', label: 'Summary' }]} active={tab} onChange={setTab} />

      {tab === 'add' && (
        <Card>
          <CardTitle title="Record Farm Input" description="Cost entries automatically create expense transactions." />
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Date" name="date" type="date" defaultValue={today()} disabled={!canWrite} />
            <Select label="Category" name="category" disabled={!canWrite} options={[{value:'vaccine',label:'Vaccine'}, {value:'medication',label:'Medication'}, {value:'disinfectant',label:'Disinfectant'}, {value:'vitamin',label:'Vitamin'}, {value:'other',label:'Other'}]} />
            <Input label="Product" name="product" required disabled={!canWrite} />
            <Select label="Target" name="target" disabled={!canWrite} options={[{value:'all',label:'All pigs'}, {value:'piglets',label:'Piglets'}, {value:'sows',label:'Sows'}, {value:'boars',label:'Boars'}, {value:'growers',label:'Growers'}, {value:'finishers',label:'Finishers'}, {value:'specific',label:'Specific Pig'}]} />
            <Select label="Specific Pig" name="pigId" disabled={!canWrite}><option value="">Not specific</option>{data.pigs.map(pig => <option key={pig.id} value={pig.id}>{pig.tag}</option>)}</Select>
            <Input label="Quantity" name="quantity" type="number" min="0" step="0.1" disabled={!canWrite} />
            <Input label="Cost (₦)" name="cost" type="number" min="0" step="0.01" disabled={!canWrite} />
            <Input label="Next Due" name="nextDue" type="date" disabled={!canWrite} />
            <div className="md:col-span-2 xl:col-span-3"><Textarea label="Notes" name="notes" disabled={!canWrite} /></div>
            <div className="md:col-span-2 xl:col-span-3"><Button loading={submitting} disabled={!canWrite} icon={<Plus size={17} />}>Save Input</Button></div>
          </form>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardTitle title="Input History" description="Vaccination, medication, vitamin, and sanitation records." />
          {data.monthlyInputs.length ? (
            <Table headers={['Date', 'Category', 'Product', 'Target', 'Cost', 'Next Due', 'Actions']}>
              {data.monthlyInputs.map(item => (
                <tr key={item.id}><td className="px-4 py-3 font-semibold">{dateLabel(item.date)}</td><td className="px-4 py-3 capitalize">{item.category}</td><td className="px-4 py-3 font-bold">{item.product}</td><td className="px-4 py-3 capitalize">{item.target}</td><td className="px-4 py-3 font-bold">{formatMoney(item.cost)}</td><td className="px-4 py-3">{dateLabel(item.nextDue)}</td><td className="px-4 py-3">{canDelete && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => deleteRecord(profile?.activeOrgId, collectionNames.monthlyInputs, item.id)}>Delete</Button>}</td></tr>
              ))}
            </Table>
          ) : <EmptyState title="No monthly input records" />}
        </Card>
      )}

      {tab === 'summary' && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card><CardTitle title="Upcoming Due Items" description="Next due dates from your input records." />{dueSoon.length ? <Table headers={['Product', 'Category', 'Due', 'Target']}>{dueSoon.map(item => <tr key={item.id}><td className="px-4 py-3 font-bold">{item.product}</td><td className="px-4 py-3 capitalize">{item.category}</td><td className="px-4 py-3">{dateLabel(item.nextDue)}</td><td className="px-4 py-3 capitalize">{item.target}</td></tr>)}</Table> : <EmptyState title="No upcoming due items" />}</Card>
          <Card><CardTitle title="Input Cost Summary" description="Total cost recorded across farm inputs." /><div className="rounded-3xl bg-forest-700 p-8 text-white"><p className="text-sm font-bold text-white/70">Total Input Cost</p><p className="mt-2 text-4xl font-black">{formatMoney(totalCost)}</p></div></Card>
        </div>
      )}
    </div>
  );
}
