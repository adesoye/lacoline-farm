'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { addRecord, collectionNames, deleteRecord, useFarmData } from '@/lib/firebase/firestore';
import { financeCategories, financeLabels } from '@/lib/domain/constants';
import { getFinancialTotals, groupTransactionsByCategory } from '@/lib/domain/calculations';
import { canDeleteRecords, canManageFinance } from '@/lib/rbac';
import { asNumber, asString, dateLabel, formatMoney, today } from '@/lib/utils';
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

export function FinancePage() {
  const { data } = useFarmData();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'add' | 'ledger' | 'summary' | 'liabilities'>('ledger');
  const [txnType, setTxnType] = useState<'income' | 'expense'>('expense');
  const [submitting, setSubmitting] = useState(false);
  const canWrite = canManageFinance(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const totals = getFinancialTotals(data.transactions);
  const byCategory = groupTransactionsByCategory(data.transactions);
  const categories = txnType === 'income' ? financeCategories.income : financeCategories.expense;

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await addRecord(profile?.activeOrgId, collectionNames.transactions, {
        date: asString(form.get('date')) || today(),
        type: txnType,
        category: asString(form.get('category')),
        description: asString(form.get('description')),
        amount: asNumber(form.get('amount')),
        method: asString(form.get('method')) || 'transfer',
        ref: asString(form.get('ref'))
      }, profile?.uid);
      event.currentTarget.reset();
      setTab('ledger');
    } finally {
      setSubmitting(false);
    }
  }

  async function addLiability(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    try {
      await addRecord(profile?.activeOrgId, collectionNames.liabilities, {
        description: asString(form.get('description')),
        category: asString(form.get('category')),
        amount: asNumber(form.get('amount')),
        date: asString(form.get('date')) || today(),
        dueDate: asString(form.get('dueDate')),
        type: asString(form.get('type')) || 'current',
        paid: false,
        notes: asString(form.get('notes'))
      }, profile?.uid);
      event.currentTarget.reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Expenses & Income" description="Manage ledger transactions, farm expenses, income, and liabilities. Finance writes are limited to admins and managers." />
      <Tabs tabs={[{ value: 'ledger', label: 'Ledger' }, { value: 'add', label: 'Add Transaction' }, { value: 'summary', label: 'Summary' }, { value: 'liabilities', label: 'Liabilities' }]} active={tab} onChange={setTab} />

      {tab === 'ledger' && (
        <Card>
          <CardTitle title="Transaction Ledger" description="Feed purchases and pig sales can auto-create transactions." />
          {data.transactions.length ? (
            <Table headers={['Date', 'Description', 'Category', 'Type', 'Method', 'Amount', 'Actions']}>
              {data.transactions.map(item => (
                <tr key={item.id}><td className="px-4 py-3 font-semibold">{dateLabel(item.date)}</td><td className="px-4 py-3">{item.description}</td><td className="px-4 py-3">{financeLabels[item.category] || item.category}</td><td className="px-4 py-3 capitalize">{item.type}</td><td className="px-4 py-3 capitalize">{item.method}</td><td className="px-4 py-3 font-black">{formatMoney(item.amount)}</td><td className="px-4 py-3">{canDelete && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => deleteRecord(profile?.activeOrgId, collectionNames.transactions, item.id)}>Delete</Button>}</td></tr>
              ))}
            </Table>
          ) : <EmptyState title="No transactions yet" />}
        </Card>
      )}

      {tab === 'add' && (
        <Card>
          <CardTitle title="Add Transaction" description="Record manual farm income or expense." />
          <form onSubmit={addTransaction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Date" name="date" type="date" defaultValue={today()} disabled={!canWrite} />
            <Select label="Type" value={txnType} onChange={event => setTxnType(event.target.value as 'income' | 'expense')} disabled={!canWrite} options={[{value:'expense',label:'Expense'}, {value:'income',label:'Income'}]} />
            <Select label="Category" name="category" disabled={!canWrite}>{categories.map(item => <option key={item} value={item}>{financeLabels[item] || item}</option>)}</Select>
            <Input label="Description" name="description" required disabled={!canWrite} />
            <Input label="Amount (₦)" name="amount" type="number" min="0" step="0.01" required disabled={!canWrite} />
            <Select label="Method" name="method" disabled={!canWrite} options={[{value:'cash',label:'Cash'}, {value:'transfer',label:'Transfer'}, {value:'card',label:'Card'}, {value:'credit',label:'Credit'}, {value:'other',label:'Other'}]} />
            <Input label="Reference" name="ref" disabled={!canWrite} />
            <div className="md:col-span-2 xl:col-span-3"><Button loading={submitting} disabled={!canWrite} icon={<Plus size={17} />}>Save Transaction</Button></div>
          </form>
        </Card>
      )}

      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Total Income" value={formatMoney(totals.income)} tone="forest" /><StatCard label="Total Expenses" value={formatMoney(totals.expense)} tone="clay" /><StatCard label="Net Profit / Loss" value={formatMoney(totals.profit)} tone={totals.profit >= 0 ? 'slate' : 'red'} /></div>
          <Card><CardTitle title="Totals by Category" />{Object.keys(byCategory).length ? <Table headers={['Category', 'Amount']}>{Object.entries(byCategory).map(([cat, amount]) => <tr key={cat}><td className="px-4 py-3 font-bold">{financeLabels[cat] || cat}</td><td className="px-4 py-3 font-black">{formatMoney(amount)}</td></tr>)}</Table> : <EmptyState />}</Card>
        </div>
      )}

      {tab === 'liabilities' && (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardTitle title="Add Liability" description="Loans, feed credit, equipment loans, and payables." />
            <form onSubmit={addLiability} className="space-y-4">
              <Input label="Description" name="description" required disabled={!canWrite} />
              <Select label="Category" name="category" disabled={!canWrite} options={[{value:'bank-loan',label:'Bank Loan'}, {value:'trade-credit',label:'Trade Credit'}, {value:'feed-credit',label:'Feed Credit'}, {value:'equipment-loan',label:'Equipment Loan'}, {value:'other',label:'Other'}]} />
              <Input label="Amount" name="amount" type="number" min="0" step="0.01" required disabled={!canWrite} />
              <Input label="Date Incurred" name="date" type="date" defaultValue={today()} disabled={!canWrite} />
              <Input label="Due Date" name="dueDate" type="date" disabled={!canWrite} />
              <Select label="Type" name="type" disabled={!canWrite} options={[{value:'current',label:'Current'}, {value:'non-current',label:'Non-current'}]} />
              <Textarea label="Notes" name="notes" disabled={!canWrite} />
              <Button loading={submitting} disabled={!canWrite}>Add Liability</Button>
            </form>
          </Card>
          <Card><CardTitle title="Recorded Liabilities" />{data.liabilities.length ? <Table headers={['Description', 'Category', 'Amount', 'Due', 'Type', 'Actions']}>{data.liabilities.map(item => <tr key={item.id}><td className="px-4 py-3 font-bold">{item.description}</td><td className="px-4 py-3">{item.category}</td><td className="px-4 py-3 font-black">{formatMoney(item.amount)}</td><td className="px-4 py-3">{dateLabel(item.dueDate)}</td><td className="px-4 py-3 capitalize">{item.type}</td><td className="px-4 py-3">{canDelete && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => deleteRecord(profile?.activeOrgId, collectionNames.liabilities, item.id)}>Delete</Button>}</td></tr>)}</Table> : <EmptyState />}</Card>
        </div>
      )}
    </div>
  );
}
