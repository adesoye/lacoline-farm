'use client';

import { useMemo, useState } from 'react';
import { getBalanceSheet, getProfitAndLoss } from '@/lib/domain/calculations';
import { useFarmData } from '@/lib/firebase/firestore';
import { formatMoney, monthKey } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';

export function FinancialStatementsPage() {
  const { data } = useFarmData();
  const [tab, setTab] = useState<'pl' | 'cashflow' | 'balance'>('pl');
  const [month, setMonth] = useState(monthKey());
  const from = `${month}-01`;
  const to = `${month}-31`;
  const pnl = useMemo(() => getProfitAndLoss(data, from, to), [data, from, to]);
  const balance = useMemo(() => getBalanceSheet(data), [data]);
  const before = data.transactions.filter(item => item.date < from);
  const opening = before.filter(item => item.type === 'income').reduce((s, item) => s + item.amount, 0) - before.filter(item => item.type === 'expense').reduce((s, item) => s + item.amount, 0);
  const closing = opening + pnl.netProfit;

  return (
    <div>
      <PageHeader title="Financial Statements" description="Profit & Loss, Cash Flow, and Balance Sheet generated from Firebase transactions, livestock, feed stock, and liabilities." />
      <div className="mb-5 max-w-xs"><Input label="Period" type="month" value={month} onChange={event => setMonth(event.target.value)} /></div>
      <Tabs tabs={[{ value: 'pl', label: 'Profit & Loss' }, { value: 'cashflow', label: 'Cash Flow' }, { value: 'balance', label: 'Balance Sheet' }]} active={tab} onChange={setTab} />

      {tab === 'pl' && (
        <Card className="max-w-3xl">
          <CardTitle title="Profit & Loss Statement" description={`For ${month}`} />
          <StatementRow label="Revenue" value={pnl.revenue} strong />
          <StatementRow label="Cost of Sales" value={pnl.cogs} />
          <StatementRow label="Gross Profit" value={pnl.grossProfit} strong />
          <StatementRow label="Operating Expenses" value={pnl.expenses - pnl.cogs} />
          <StatementRow label={pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'} value={pnl.netProfit} total />
          <p className="mt-5 text-sm text-slate-500">Net margin: <strong>{pnl.netMargin.toFixed(1)}%</strong></p>
        </Card>
      )}

      {tab === 'cashflow' && (
        <Card className="max-w-3xl">
          <CardTitle title="Cash Flow Statement" description={`For ${month}`} />
          <StatementRow label="Opening Cash Balance" value={opening} />
          <StatementRow label="Cash Inflows" value={pnl.revenue} strong />
          <StatementRow label="Cash Outflows" value={pnl.expenses} />
          <StatementRow label="Net Cash Flow" value={pnl.netProfit} strong />
          <StatementRow label="Closing Cash Balance" value={closing} total />
        </Card>
      )}

      {tab === 'balance' && (
        <Card className="max-w-3xl">
          <CardTitle title="Balance Sheet" description="Estimated from current records." />
          <Table headers={['Item', 'Amount']}>
            <tr><td className="px-4 py-3 font-bold">Cash</td><td className="px-4 py-3 font-black">{formatMoney(balance.cash)}</td></tr>
            <tr><td className="px-4 py-3 font-bold">Livestock Value</td><td className="px-4 py-3 font-black">{formatMoney(balance.livestock)}</td></tr>
            <tr><td className="px-4 py-3 font-bold">Feed Inventory</td><td className="px-4 py-3 font-black">{formatMoney(balance.feedInventory)}</td></tr>
            <tr><td className="px-4 py-3 font-bold">Total Assets</td><td className="px-4 py-3 font-black">{formatMoney(balance.assets)}</td></tr>
            <tr><td className="px-4 py-3 font-bold">Liabilities</td><td className="px-4 py-3 font-black">{formatMoney(balance.liabilities)}</td></tr>
            <tr><td className="px-4 py-3 font-black">Owner Equity</td><td className="px-4 py-3 text-lg font-black text-forest-800">{formatMoney(balance.equity)}</td></tr>
          </Table>
        </Card>
      )}
    </div>
  );
}

function StatementRow({ label, value, strong, total }: { label: string; value: number; strong?: boolean; total?: boolean }) {
  return <div className={`${total ? 'mt-4 rounded-2xl bg-forest-700 px-4 py-4 text-white' : 'border-b border-slate-100 px-2 py-3'} flex items-center justify-between`}><span className={strong || total ? 'font-black' : 'font-semibold text-slate-600'}>{label}</span><span className={total ? 'text-xl font-black' : 'font-black text-slate-900'}>{formatMoney(value)}</span></div>;
}
