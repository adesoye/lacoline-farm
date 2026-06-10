'use client';

import { Activity, Boxes, PiggyBank, Wallet } from 'lucide-react';
import { useFarmData } from '@/lib/firebase/firestore';
import { getFinancialTotals, getStockRows } from '@/lib/domain/calculations';
import { formatMoney, formatNumber } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Table } from '@/components/ui/Table';

export function ReportsPage() {
  const { data } = useFarmData();
  const totals = getFinancialTotals(data.transactions);
  const stock = getStockRows(data);
  const activePigs = data.pigs.filter(item => item.status === 'active').length;
  const avgFeedPerPig = activePigs ? data.feedLogs.reduce((sum, item) => sum + item.amount, 0) / activePigs : 0;

  return (
    <div>
      <PageHeader title="Reports" description="Operational and financial reports generated from Firebase data across all modules." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Herd" value={activePigs} icon={<PiggyBank size={18} />} tone="forest" />
        <StatCard label="Total Feed Used" value={`${formatNumber(data.feedLogs.reduce((s, item) => s + item.amount, 0), 1)} kg`} icon={<Boxes size={18} />} tone="clay" />
        <StatCard label="Avg Feed / Pig" value={`${formatNumber(avgFeedPerPig, 1)} kg`} icon={<Activity size={18} />} />
        <StatCard label="Net Profit / Loss" value={formatMoney(totals.profit)} icon={<Wallet size={18} />} tone={totals.profit >= 0 ? 'slate' : 'red'} />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card><CardTitle title="Herd by Type" />{data.pigs.length ? <Table headers={['Type', 'Count']}>{Object.entries(data.pigs.reduce<Record<string, number>>((acc, pig) => { acc[pig.type] = (acc[pig.type] || 0) + 1; return acc; }, {})).map(([type, count]) => <tr key={type}><td className="px-4 py-3 font-bold capitalize">{type}</td><td className="px-4 py-3 font-black">{count}</td></tr>)}</Table> : <EmptyState />}</Card>
        <Card><CardTitle title="Feed Stock Report" />{stock.length ? <Table headers={['Feed', 'Purchased', 'Consumed', 'Balance']}>{stock.map(row => <tr key={row.feedType}><td className="px-4 py-3 font-bold capitalize">{row.feedType}</td><td className="px-4 py-3">{formatNumber(row.purchased, 1)} kg</td><td className="px-4 py-3">{formatNumber(row.consumed, 1)} kg</td><td className="px-4 py-3 font-black">{formatNumber(row.balance, 1)} kg</td></tr>)}</Table> : <EmptyState />}</Card>
      </div>
    </div>
  );
}
