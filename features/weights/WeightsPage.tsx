'use client';

import { useMemo, useState } from 'react';
import { Plus, TrendingUp, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { addRecord, collectionNames, deleteRecord, useFarmData } from '@/lib/firebase/firestore';
import { canDeleteRecords, canWriteFarm } from '@/lib/rbac';
import { asNumber, asString, dateLabel, formatNumber, today } from '@/lib/utils';
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

export function WeightsPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'add' | 'history' | 'growth'>('add');
  const [submitting, setSubmitting] = useState(false);
  const canWrite = canWriteFarm(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const activePigs = useMemo(() => data.pigs.filter(item => item.status === 'active'), [data.pigs]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await addRecord(profile?.activeOrgId, collectionNames.weightRecords, {
        pigId: asString(form.get('pigId')),
        date: asString(form.get('date')) || today(),
        weight: asNumber(form.get('weight')),
        bcs: asString(form.get('bcs')),
        notes: asString(form.get('notes'))
      }, profile?.uid);
      event.currentTarget.reset();
      setTab('history');
    } finally {
      setSubmitting(false);
    }
  }

  const avgWeight = data.weightRecords.length ? data.weightRecords.reduce((s, item) => s + item.weight, 0) / data.weightRecords.length : 0;
  const pigsTracked = new Set(data.weightRecords.map(item => item.pigId)).size;

  return (
    <div>
      <PageHeader title="Weight Records" description="Track pig weights, body condition scores, and growth performance from Firestore." />
      <Tabs tabs={[{ value: 'add', label: 'Record Weight' }, { value: 'history', label: 'History' }, { value: 'growth', label: 'Growth Analysis' }]} active={tab} onChange={setTab} />

      {tab === 'add' && (
        <Card>
          <CardTitle title="Record Weight Measurement" description="Capture current weight and body condition score." />
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Date" name="date" type="date" defaultValue={today()} disabled={!canWrite} />
            <Select label="Pig" name="pigId" required disabled={!canWrite}>
              <option value="">Select pig</option>
              {activePigs.map(pig => <option key={pig.id} value={pig.id}>{pig.tag} {pig.name ? `— ${pig.name}` : ''}</option>)}
            </Select>
            <Input label="Weight (kg)" name="weight" type="number" min="0" step="0.1" required disabled={!canWrite} />
            <Select label="Body Condition Score" name="bcs" disabled={!canWrite} options={[{value:'',label:'Not set'}, {value:'1',label:'1 - Emaciated'}, {value:'2',label:'2 - Thin'}, {value:'3',label:'3 - Good'}, {value:'4',label:'4 - Fat'}, {value:'5',label:'5 - Obese'}]} />
            <div className="md:col-span-2 xl:col-span-3"><Textarea label="Notes" name="notes" disabled={!canWrite} /></div>
            <div className="md:col-span-2 xl:col-span-3"><Button loading={submitting} disabled={!canWrite} icon={<Plus size={17} />}>Save Weight</Button></div>
          </form>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardTitle title="Weight History" description="Latest records first." />
          {data.weightRecords.length ? (
            <Table headers={['Date', 'Pig', 'Weight', 'BCS', 'Notes', 'Actions']}>
              {data.weightRecords.map(item => {
                const pig = data.pigs.find(p => p.id === item.pigId);
                return <tr key={item.id}><td className="px-4 py-3 font-semibold">{dateLabel(item.date)}</td><td className="px-4 py-3 font-bold">{pig?.tag || 'Unknown'}</td><td className="px-4 py-3">{formatNumber(item.weight, 1)} kg</td><td className="px-4 py-3">{item.bcs || '—'}</td><td className="px-4 py-3">{item.notes || '—'}</td><td className="px-4 py-3">{canDelete && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => deleteRecord(profile?.activeOrgId, collectionNames.weightRecords, item.id)}>Delete</Button>}</td></tr>;
              })}
            </Table>
          ) : <EmptyState title="No weight records" />}
        </Card>
      )}

      {tab === 'growth' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Average Recorded Weight" value={`${formatNumber(avgWeight, 1)} kg`} tone="forest" icon={<TrendingUp size={18} />} />
            <StatCard label="Pigs Tracked" value={pigsTracked} tone="clay" />
            <StatCard label="Total Measurements" value={data.weightRecords.length} />
          </div>
          <Card>
            <CardTitle title="Growth by Pig" description="Latest and earliest weight comparison." />
            {pigsTracked ? (
              <Table headers={['Pig', 'First Weight', 'Latest Weight', 'Gain']}>
                {Array.from(new Set(data.weightRecords.map(item => item.pigId))).map(pigId => {
                  const pig = data.pigs.find(item => item.id === pigId);
                  const rows = data.weightRecords.filter(item => item.pigId === pigId).sort((a, b) => a.date.localeCompare(b.date));
                  const first = rows[0]?.weight || 0;
                  const latest = rows[rows.length - 1]?.weight || 0;
                  return <tr key={pigId}><td className="px-4 py-3 font-bold">{pig?.tag || 'Unknown'}</td><td className="px-4 py-3">{formatNumber(first, 1)} kg</td><td className="px-4 py-3">{formatNumber(latest, 1)} kg</td><td className="px-4 py-3 font-black">{formatNumber(latest - first, 1)} kg</td></tr>;
                })}
              </Table>
            ) : <EmptyState title="No growth data yet" />}
          </Card>
        </div>
      )}
    </div>
  );
}
