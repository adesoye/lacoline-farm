'use client';

import { Activity, Boxes, PiggyBank, Wallet } from 'lucide-react';
import {
  useCattleData,
  useFarmData,
  useFisheryData,
  useGoatData,
  usePoultryData
} from '@/lib/firebase/firestore';
import { getFinancialTotals, getStockRows } from '@/lib/domain/calculations';
import { formatMoney, formatNumber } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Table } from '@/components/ui/Table';

interface DivisionRow {
  label: string;
  active: number;
  revenue: number;
  cost: number;
}

export function ReportsPage() {
  const { data } = useFarmData();
  const poultry = usePoultryData();
  const fishery = useFisheryData();
  const cattle = useCattleData();
  const goats = useGoatData();

  const totals = getFinancialTotals(data.transactions);
  const stock = getStockRows(data);
  const activePigs = data.pigs.filter(item => item.status === 'active').length;
  const avgFeedPerPig = activePigs ? data.feedLogs.reduce((sum, item) => sum + item.amount, 0) / activePigs : 0;

  const sum = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((s, r) => s + (pick(r) || 0), 0);

  // Per-division performance derived from each module's own records. This is an
  // operational view; the Financial Statements remain the source of truth for
  // the consolidated ledger.
  const divisions: DivisionRow[] = [
    {
      label: '🐖 Pigs',
      active: activePigs,
      revenue: sum(data.transactions.filter(t => t.type === 'income' && (t.category === 'pig-sales' || t.category === 'manure-sales')), t => t.amount),
      cost: sum(data.feedLogs, f => f.totalCost) + sum(data.monthlyInputs, m => m.cost)
    },
    {
      label: '🐔 Poultry',
      active: poultry.batches.filter(b => b.status === 'active').reduce((s, b) => s + (b.currentCount ?? b.count ?? 0), 0),
      revenue: sum(poultry.eggLogs, e => (e.crates || 0) * (e.pricePerCrate || 0)),
      cost: sum(poultry.feedLogs, f => f.cost) + sum(poultry.healthLogs, h => h.cost)
    },
    {
      label: '🐟 Fishery',
      active: fishery.ponds.filter(p => p.status === 'active').length,
      revenue: sum(fishery.harvests, h => h.revenue),
      cost: sum(fishery.stockings, s => (s.count || 0) * (s.costPerFish || 0)) + sum(fishery.feedLogs, f => f.cost) + sum(fishery.healthLogs, h => h.cost)
    },
    {
      label: '🐄 Cattle',
      active: cattle.herd.filter(a => a.status === 'active').length,
      revenue: sum(cattle.milkLogs, l => l.revenue) + sum(cattle.events.filter(e => e.type === 'sold'), e => e.cost),
      cost: sum(cattle.feedLogs, f => f.cost) + sum(cattle.events.filter(e => ['vaccination', 'treatment', 'deworming'].includes(e.type)), e => e.cost)
    },
    {
      label: '🐐 Goats',
      active: goats.herd.filter(a => a.status === 'active').length,
      revenue: sum(goats.milkLogs, l => l.revenue) + sum(goats.events.filter(e => e.type === 'sold'), e => e.cost),
      cost: sum(goats.feedLogs, f => f.cost) + sum(goats.events.filter(e => ['vaccination', 'treatment', 'deworming'].includes(e.type)), e => e.cost)
    }
  ];

  const totalLivestock =
    activePigs +
    divisions[1].active +
    cattle.herd.filter(a => a.status === 'active').length +
    goats.herd.filter(a => a.status === 'active').length;

  return (
    <div>
      <PageHeader title="Reports" description="Operational and financial reports generated from Firebase data across all modules." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Pigs" value={activePigs} icon={<PiggyBank size={18} />} tone="forest" />
        <StatCard label="Total Livestock (pigs, birds, cattle, goats)" value={formatNumber(totalLivestock)} icon={<Activity size={18} />} tone="clay" />
        <StatCard label="Avg Feed / Pig" value={`${formatNumber(avgFeedPerPig, 1)} kg`} icon={<Boxes size={18} />} />
        <StatCard label="Net Profit / Loss (all modules)" value={formatMoney(totals.profit)} icon={<Wallet size={18} />} tone={totals.profit >= 0 ? 'slate' : 'red'} />
      </div>

      <div className="mt-6">
        <Card>
          <CardTitle
            title="Performance by Livestock Division"
            description="Revenue and direct costs derived from each module's records. See Financial Statements for the consolidated ledger."
          />
          <Table headers={['Division', 'Active', 'Revenue', 'Direct Cost', 'Net']}>
            {divisions.map(row => {
              const net = row.revenue - row.cost;
              return (
                <tr key={row.label}>
                  <td className="px-4 py-3 font-black">{row.label}</td>
                  <td className="px-4 py-3">{formatNumber(row.active)}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{formatMoney(row.revenue)}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">{formatMoney(row.cost)}</td>
                  <td className={`px-4 py-3 font-black ${net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatMoney(net)}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card><CardTitle title="Pig Herd by Type" />{data.pigs.length ? <Table headers={['Type', 'Count']}>{Object.entries(data.pigs.reduce<Record<string, number>>((acc, pig) => { acc[pig.type] = (acc[pig.type] || 0) + 1; return acc; }, {})).map(([type, count]) => <tr key={type}><td className="px-4 py-3 font-bold capitalize">{type}</td><td className="px-4 py-3 font-black">{count}</td></tr>)}</Table> : <EmptyState />}</Card>
        <Card><CardTitle title="Feed Stock Report (pigs)" />{stock.length ? <Table headers={['Feed', 'Purchased', 'Consumed', 'Balance']}>{stock.map(row => <tr key={row.feedType}><td className="px-4 py-3 font-bold capitalize">{row.feedType}</td><td className="px-4 py-3">{formatNumber(row.purchased, 1)} kg</td><td className="px-4 py-3">{formatNumber(row.consumed, 1)} kg</td><td className="px-4 py-3 font-black">{formatNumber(row.balance, 1)} kg</td></tr>)}</Table> : <EmptyState />}</Card>
      </div>
    </div>
  );
}
