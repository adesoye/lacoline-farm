'use client';

import { useState } from 'react';
import { Boxes, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { collectionNames, createFeedPurchaseWithExpense, deleteRecord, setRecord, useFarmData } from '@/lib/firebase/firestore';
import { feedTypes } from '@/lib/domain/constants';
import { getStockRows } from '@/lib/domain/calculations';
import { canDeleteRecords, canManageFinance, canWriteFarm } from '@/lib/rbac';
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

export function FeedStockPage() {
  const { data } = useFarmData();
  const { profile } = useAuth();
  const [tab, setTab] = useState<'levels' | 'purchase' | 'history'>('levels');
  const [submitting, setSubmitting] = useState(false);
  const canWrite = canWriteFarm(profile?.role);
  const canDelete = canDeleteRecords(profile?.role);
  const stockRows = getStockRows(data);

  async function addPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    const quantity = asNumber(form.get('quantity'));
    const costPerKg = asNumber(form.get('costPerKg'));
    setSubmitting(true);
    try {
      await createFeedPurchaseWithExpense(profile?.activeOrgId, {
        date: asString(form.get('date')) || today(),
        feedType: asString(form.get('feedType')),
        quantity,
        costPerKg,
        totalCost: quantity * costPerKg,
        supplier: asString(form.get('supplier')),
        notes: asString(form.get('notes'))
      }, profile?.uid, canManageFinance(profile?.role));

      const reorder = asNumber(form.get('reorderLevel'));
      if (reorder > 0) {
        const currentLevels = data.feedSettings?.levels ?? {};
        await setRecord(profile?.activeOrgId, collectionNames.feedSettings, 'reorderLevels', { id: 'reorderLevels', levels: { ...currentLevels, [asString(form.get('feedType'))]: reorder } }, profile?.uid);
      }
      event.currentTarget.reset();
      setTab('levels');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveReorderLevels(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const form = new FormData(event.currentTarget);
    const levels = Object.fromEntries(feedTypes.map(type => [type, asNumber(form.get(`level-${type}`))]));
    await setRecord(profile?.activeOrgId, collectionNames.feedSettings, 'reorderLevels', { id: 'reorderLevels', levels }, profile?.uid);
  }

  const totalBalance = stockRows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0);
  const totalValue = stockRows.reduce((sum, row) => sum + Math.max(row.balance, 0) * row.avgCost, 0);
  const alertCount = stockRows.filter(row => row.alert).length;

  return (
    <div>
      <PageHeader title="Feed Stock & Purchases" description="Track feed inventory, purchases, reorder levels, stock value, and automatic finance entries using Firestore." />
      <Tabs tabs={[{ value: 'levels', label: 'Stock Levels' }, { value: 'purchase', label: 'Record Purchase' }, { value: 'history', label: 'Purchase History' }]} active={tab} onChange={setTab} />

      {tab === 'levels' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Feed Balance" value={`${formatNumber(totalBalance, 1)} kg`} icon={<Boxes size={18} />} tone="forest" />
            <StatCard label="Estimated Stock Value" value={formatMoney(totalValue)} tone="clay" />
            <StatCard label="Reorder Alerts" value={alertCount} tone={alertCount ? 'amber' : 'slate'} />
          </div>
          <Card>
            <CardTitle title="Current Stock Levels" description="Purchased minus consumed feed, with alert checks against reorder levels." />
            <form onSubmit={saveReorderLevels}>
              <Table headers={['Feed Type', 'Purchased', 'Consumed', 'Balance', 'Avg Cost/kg', 'Reorder Level', 'Status']}>
                {stockRows.map(row => (
                  <tr key={row.feedType} className={row.alert ? 'bg-amber-50' : undefined}>
                    <td className="px-4 py-3 font-black capitalize text-forest-800">{row.feedType}</td>
                    <td className="px-4 py-3">{formatNumber(row.purchased, 1)} kg</td>
                    <td className="px-4 py-3">{formatNumber(row.consumed, 1)} kg</td>
                    <td className="px-4 py-3 font-black">{formatNumber(row.balance, 1)} kg</td>
                    <td className="px-4 py-3">{formatMoney(row.avgCost)}</td>
                    <td className="px-4 py-3"><Input aria-label={`${row.feedType} reorder level`} name={`level-${row.feedType}`} type="number" defaultValue={row.reorderLevel} min="0" step="0.1" disabled={!canWrite} /></td>
                    <td className="px-4 py-3"><span className={row.alert ? 'rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800' : 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800'}>{row.alert ? 'Reorder' : 'OK'}</span></td>
                  </tr>
                ))}
              </Table>
              <div className="mt-4"><Button disabled={!canWrite} icon={<Save size={16} />}>Save Reorder Levels</Button></div>
            </form>
          </Card>
        </div>
      )}

      {tab === 'purchase' && (
        <Card>
          <CardTitle title="Record Feed Purchase" description="Every feed purchase also creates an expense transaction in Firebase." />
          <form onSubmit={addPurchase} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Date" name="date" type="date" defaultValue={today()} disabled={!canWrite} />
            <Select label="Feed Type" name="feedType" disabled={!canWrite}>{feedTypes.map(type => <option key={type} value={type}>{type}</option>)}</Select>
            <Input label="Quantity (kg)" name="quantity" type="number" min="0" step="0.1" required disabled={!canWrite} />
            <Input label="Cost / kg (₦)" name="costPerKg" type="number" min="0" step="0.01" required disabled={!canWrite} />
            <Input label="Supplier" name="supplier" disabled={!canWrite} />
            <Input label="Reorder Level (kg)" name="reorderLevel" type="number" min="0" step="0.1" disabled={!canWrite} />
            <div className="md:col-span-2 xl:col-span-3"><Textarea label="Notes" name="notes" disabled={!canWrite} /></div>
            <div className="md:col-span-2 xl:col-span-3"><Button loading={submitting} disabled={!canWrite} icon={<Plus size={17} />}>Record Purchase</Button></div>
          </form>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardTitle title="Purchase History" description="Latest feed purchases and total costs." />
          {data.feedPurchases.length ? (
            <Table headers={['Date', 'Feed', 'Quantity', 'Cost/kg', 'Total', 'Supplier', 'Actions']}>
              {data.feedPurchases.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-semibold">{dateLabel(item.date)}</td>
                  <td className="px-4 py-3 capitalize">{item.feedType}</td>
                  <td className="px-4 py-3">{formatNumber(item.quantity, 1)} kg</td>
                  <td className="px-4 py-3">{formatMoney(item.costPerKg)}</td>
                  <td className="px-4 py-3 font-black">{formatMoney(item.totalCost)}</td>
                  <td className="px-4 py-3">{item.supplier || '—'}</td>
                  <td className="px-4 py-3">{canDelete && <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} onClick={() => deleteRecord(profile?.activeOrgId, collectionNames.feedPurchases, item.id)}>Delete</Button>}</td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState title="No feed purchases" />}
        </Card>
      )}
    </div>
  );
}
