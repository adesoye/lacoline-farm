'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { addRecord, collectionNames, deleteRecord, useFarmData } from '@/lib/firebase/firestore';
import { feedTypes } from '@/lib/domain/constants';
import { getAverageCostPerKg, getFeedDailySummary } from '@/lib/domain/calculations';
import { canDeleteRecords, canWriteFarm } from '@/lib/rbac';
import { asNumber, asString, dateLabel, formatMoney, formatNumber, today } from '@/lib/utils';
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

export function FeedPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'log' | 'history' | 'summary'>('log');
  const [summaryDate, setSummaryDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);
  const canWrite = canWriteFarm(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const activePigs = useMemo(() => data.pigs.filter(item => item.status === 'active'), [data.pigs]);
  const summary = getFeedDailySummary(data.feedLogs, summaryDate);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    const feedType = asString(form.get('feedType'));
    const amount = asNumber(form.get('amount'));
    const enteredCost = asNumber(form.get('costPerKg'));
    const avgCost = getAverageCostPerKg(data.feedPurchases, feedType);
    const costPerKg = enteredCost > 0 ? enteredCost : avgCost;
    setSubmitting(true);
    try {
      await addRecord(profile?.activeOrgId, collectionNames.feedLogs, {
        date: asString(form.get('date')) || today(),
        pigId: asString(form.get('pigId')),
        feedType,
        amount,
        costPerKg,
        totalCost: amount * costPerKg,
        feedingTime: asString(form.get('feedingTime')) || 'morning',
        notes: asString(form.get('notes'))
      }, profile?.uid);
      event.currentTarget.reset();
      setTab('history');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Daily Feed Log" description="Record feed given to each pig or pen, calculate cost from stock purchases, and review daily summaries." />
      <Tabs tabs={[{ value: 'log', label: 'Log Feed' }, { value: 'history', label: 'History' }, { value: 'summary', label: 'Daily Summary' }]} active={tab} onChange={setTab} />

      {tab === 'log' && (
        <Card>
          <CardTitle title="Record Feed Entry" description="Cost per kg can be left empty to use the average purchase cost for the selected feed type." />
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Date" name="date" type="date" defaultValue={today()} disabled={!canWrite} />
            <Select label="Pig / Pen" name="pigId" required disabled={!canWrite}>
              <option value="">Select pig</option>
              {activePigs.map(pig => <option key={pig.id} value={pig.id}>{pig.tag} {pig.name ? `— ${pig.name}` : ''}</option>)}
            </Select>
            <Select label="Feed Type" name="feedType" disabled={!canWrite}>
              {feedTypes.map(item => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Input label="Amount (kg)" name="amount" type="number" min="0" step="0.1" required disabled={!canWrite} />
            <Input label="Cost / kg (₦)" name="costPerKg" type="number" min="0" step="0.01" disabled={!canWrite} />
            <Select label="Feeding Time" name="feedingTime" disabled={!canWrite} options={[{value:'morning',label:'Morning'}, {value:'afternoon',label:'Afternoon'}, {value:'evening',label:'Evening'}, {value:'all-day',label:'All Day'}]} />
            <div className="md:col-span-2 xl:col-span-3"><Textarea label="Notes" name="notes" disabled={!canWrite} /></div>
            <div className="md:col-span-2 xl:col-span-3"><Button loading={submitting} disabled={!canWrite} icon={<Plus size={17} />}>Log Feed</Button></div>
          </form>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardTitle title="Feed History" description="All feed records from Firestore." />
          {data.feedLogs.length ? (
            <Table headers={['Date', 'Pig', 'Feed', 'Time', 'Amount', 'Cost', 'Actions']}>
              {data.feedLogs.map(item => {
                const pig = data.pigs.find(p => p.id === item.pigId);
                return <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold">{dateLabel(item.date)}</td>
                  <td className="px-4 py-3">{pig?.tag || 'Unknown'}</td>
                  <td className="px-4 py-3 capitalize">{item.feedType}</td>
                  <td className="px-4 py-3 capitalize">{item.feedingTime}</td>
                  <td className="px-4 py-3">{formatNumber(item.amount, 1)} kg</td>
                  <td className="px-4 py-3 font-bold">{formatMoney(item.totalCost)}</td>
                  <td className="px-4 py-3">{canDelete && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => deleteRecord(profile?.activeOrgId, collectionNames.feedLogs, item.id)}>Delete</Button>}</td>
                </tr>;
              })}
            </Table>
          ) : <EmptyState title="No feed records" />}
        </Card>
      )}

      {tab === 'summary' && (
        <div className="space-y-5">
          <Card>
            <CardTitle title="Daily Feed Summary" description="Breakdown by pig and feed type." />
            <Input className="max-w-xs" label="Summary Date" type="date" value={summaryDate} onChange={event => setSummaryDate(event.target.value)} />
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total kg Fed" value={`${formatNumber(summary.totalKg, 1)} kg`} tone="forest" />
            <StatCard label="Feed Cost" value={formatMoney(summary.totalCost)} tone="clay" />
            <StatCard label="Pigs Fed" value={Object.keys(summary.byPig).length} />
          </div>
          <Card>
            <CardTitle title="Breakdown by Pig" />
            {Object.keys(summary.byPig).length ? (
              <Table headers={['Pig', 'Feed Types', 'Total kg', 'Total Cost']}>
                {Object.entries(summary.byPig).map(([pigId, row]) => {
                  const pig = data.pigs.find(item => item.id === pigId);
                  const feeds = [...new Set(row.entries.map(item => item.feedType))].join(', ');
                  return <tr key={pigId}><td className="px-4 py-3 font-bold">{pig?.tag || 'Unknown'}</td><td className="px-4 py-3">{feeds}</td><td className="px-4 py-3">{formatNumber(row.kg, 1)} kg</td><td className="px-4 py-3 font-bold">{formatMoney(row.cost)}</td></tr>;
                })}
              </Table>
            ) : <EmptyState title={`No feed records for ${dateLabel(summaryDate)}`} />}
          </Card>
        </div>
      )}
    </div>
  );
}
