'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bird,
  Beef,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Fish,
  PawPrint,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wheat,
} from 'lucide-react';
import {
  useCattleData,
  useFarmData,
  useFisheryData,
  useGoatData,
  usePoultryData,
} from '@/lib/firebase/firestore';
import { getDashboardKpis, getStockRows } from '@/lib/domain/calculations';
import { dateLabel, formatMoney, formatNumber, today } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Table } from '@/components/ui/Table';

export function DashboardPage() {
  const { data, loading, errors } = useFarmData();

  const kpis = getDashboardKpis(data);

  const stockAlerts = getStockRows(data).filter((item) => item.alert);

  const dueSoon = data.monthlyInputs
    .filter((item) => item.nextDue && item.nextDue >= today())
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)))
    .slice(0, 5);

  const recentFeedLogs = [...data.feedLogs]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  const recentTransactions = [...data.transactions]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);

  const totalAlerts = kpis.stockAlerts + kpis.dueSoon;
  const isProfitable = kpis.allTotals.profit >= 0;

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-forest-100 bg-gradient-to-br from-forest-950 via-forest-800 to-emerald-700 p-5 text-white shadow-xl sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 right-10 hidden h-24 w-24 rounded-full bg-amber-300/20 blur-xl sm:block" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-50">
              <CheckCircle2 size={14} />
              Live farm overview
            </p>

            <PageHeader
              title="Farm Dashboard"
              description="Monitor herd performance, feed usage, stock alerts, income, expenses, and upcoming farm inputs."
              //light
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <QuickAction href="/pigs" icon={<Plus size={16} />} label="Add Pig" />
            <QuickAction href="/feed" icon={<Wheat size={16} />} label="Record Feed" />
            <QuickAction href="/finance" icon={<Wallet size={16} />} label="View Finance" />
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p>Firestore error: {errors[0]}</p>
          </div>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active Pigs"
              value={kpis.activePigs}
              icon={<PiggyBank size={20} />}
              tone="forest"
              hint={`${kpis.soldPigs} sold · ${kpis.deadPigs} dead`}
            />

            <StatCard
              label="Feed Today"
              value={`${formatNumber(kpis.feedToday, 1)} kg`}
              icon={<Wheat size={20} />}
              tone="clay"
              hint={today()}
            />

            <StatCard
              label="Net Profit / Loss"
              value={formatMoney(kpis.allTotals.profit)}
              icon={isProfitable ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              tone={isProfitable ? 'slate' : 'red'}
              hint={`${formatMoney(kpis.allTotals.income)} income`}
            />

            <StatCard
              label="Alerts"
              value={totalAlerts}
              icon={<AlertTriangle size={20} />}
              tone={totalAlerts ? 'amber' : 'slate'}
              hint="Stock + due inputs"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MiniInsight
              title="Total Income"
              value={formatMoney(kpis.allTotals.income)}
              icon={<Wallet size={18} />}
            />
            <MiniInsight
              title="Total Expenses"
              value={formatMoney(kpis.allTotals.expense)}
              icon={<ClipboardList size={18} />}
            />
            <MiniInsight
              title="Farm Status"
              value={totalAlerts ? `${totalAlerts} needs attention` : 'Healthy'}
              icon={totalAlerts ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
              warning={Boolean(totalAlerts)}
            />
          </div>

          <SpeciesOverview />

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardTitle
                title="Feed Stock Alerts"
                description="Items currently below reorder level."
                action={<CardLink href="/feed-stock" label="Manage stock" />}
              />

              {stockAlerts.length ? (
                <div className="space-y-3">
                  {stockAlerts.map((item) => (
                    <div
                      key={item.feedType}
                      className="group flex flex-col gap-3 rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                          <Boxes size={19} />
                        </span>

                        <div>
                          <p className="font-black capitalize text-amber-950">
                            {item.feedType}
                          </p>
                          <p className="text-sm font-medium text-amber-700">
                            Reorder at {formatNumber(item.reorderLevel, 1)} kg
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white/70 px-4 py-2 text-left sm:text-right">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                          Balance
                        </p>
                        <strong className="text-lg text-amber-950">
                          {formatNumber(item.balance, 1)} kg
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Stock levels look good"
                  description="No feed item is currently below its reorder level."
                />
              )}
            </Card>

            <Card>
              <CardTitle
                title="Upcoming Monthly Inputs"
                description="Vaccines, medications, vitamins, sanitation, and other recurring inputs."
                action={<CardLink href="/monthly-inputs" label="Open inputs" />}
              />

              {dueSoon.length ? (
                <div className="space-y-3">
                  {dueSoon.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:border-forest-200 hover:bg-forest-50"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest-100 text-forest-700">
                        <CalendarClock size={18} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black text-slate-900">
                          {item.product}
                        </p>
                        <p className="text-sm font-medium text-slate-500">
                          {item.category} · due {dateLabel(item.nextDue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No upcoming input due"
                  description="Records with next due dates will appear here."
                />
              )}
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardTitle
                title="Recent Feed Logs"
                description="Latest feed consumption entries."
                action={<CardLink href="/feed-logs" label="View all" />}
              />

              {recentFeedLogs.length ? (
                <>
                  <div className="hidden md:block">
                    <Table headers={['Date', 'Feed', 'Amount', 'Cost']}>
                      {recentFeedLogs.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-semibold">
                            {dateLabel(item.date)}
                          </td>
                          <td className="px-4 py-3 capitalize">{item.feedType}</td>
                          <td className="px-4 py-3">
                            {formatNumber(item.amount, 1)} kg
                          </td>
                          <td className="px-4 py-3 font-bold">
                            {formatMoney(item.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {recentFeedLogs.map((item) => (
                      <MobileRow
                        key={item.id}
                        title={item.feedType}
                        meta={dateLabel(item.date)}
                        value={`${formatNumber(item.amount, 1)} kg`}
                        subValue={formatMoney(item.totalCost)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState />
              )}
            </Card>

            <Card>
              <CardTitle
                title="Recent Transactions"
                description="Latest expenses and income."
                action={<CardLink href="/transactions" label="View all" />}
              />

              {recentTransactions.length ? (
                <>
                  <div className="hidden md:block">
                    <Table headers={['Date', 'Category', 'Type', 'Amount']}>
                      {recentTransactions.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-semibold">
                            {dateLabel(item.date)}
                          </td>
                          <td className="px-4 py-3">{item.category}</td>
                          <td className="px-4 py-3 capitalize">{item.type}</td>
                          <td className="px-4 py-3 font-bold">
                            {formatMoney(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {recentTransactions.map((item) => (
                      <MobileRow
                        key={item.id}
                        title={item.category}
                        meta={`${dateLabel(item.date)} · ${item.type}`}
                        value={formatMoney(item.amount)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SpeciesOverview() {
  const poultry = usePoultryData();
  const fishery = useFisheryData();
  const cattle = useCattleData();
  const goats = useGoatData();

  const month = today().slice(0, 7);

  const activeBatches = poultry.batches.filter((b) => b.status === 'active');
  const birds = activeBatches.reduce((s, b) => s + (b.currentCount ?? b.count ?? 0), 0);

  const activePonds = fishery.ponds.filter((p) => p.status === 'active').length;
  const stocked = fishery.stockings.reduce((s, r) => s + (r.count || 0), 0);
  const fullHarvested = fishery.harvests.filter((h) => h.type === 'full').reduce((s, h) => s + (h.fishCount || 0), 0);
  const fishMortality = fishery.healthLogs.reduce((s, h) => s + (h.count || 0), 0);
  const liveFish = Math.max(0, stocked - fullHarvested - fishMortality);

  const activeCattle = cattle.herd.filter((a) => a.status === 'active').length;
  const cattleMilk = cattle.milkLogs.filter((l) => l.date?.startsWith(month)).reduce((s, l) => s + (l.total || 0), 0);

  const activeGoats = goats.herd.filter((a) => a.status === 'active').length;
  const goatMilk = goats.milkLogs.filter((l) => l.date?.startsWith(month)).reduce((s, l) => s + (l.total || 0), 0);

  const cards = [
    { href: '/poultry', icon: <Bird size={18} />, label: 'Poultry', primary: `${formatNumber(birds)} birds`, secondary: `${activeBatches.length} active batch${activeBatches.length === 1 ? '' : 'es'}` },
    { href: '/fishery', icon: <Fish size={18} />, label: 'Fishery', primary: `${formatNumber(liveFish)} fish`, secondary: `${activePonds} active pond${activePonds === 1 ? '' : 's'}` },
    { href: '/cattle', icon: <Beef size={18} />, label: 'Cattle', primary: `${formatNumber(activeCattle)} head`, secondary: `${formatNumber(cattleMilk, 1)} L milk this month` },
    { href: '/goats', icon: <PawPrint size={18} />, label: 'Goats', primary: `${formatNumber(activeGoats)} head`, secondary: `${formatNumber(goatMilk, 1)} L milk this month` },
  ];

  return (
    <Card>
      <CardTitle title="Other Livestock" description="Poultry, fishery, cattle, and goats at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-forest-200 hover:bg-forest-50"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-forest-100 text-forest-700">
                {c.icon}
              </span>
              <ArrowRight size={16} className="text-slate-300 transition group-hover:text-forest-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">{c.label}</p>
              <p className="mt-0.5 text-xl font-black text-slate-900">{c.primary}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{c.secondary}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-50"
    >
      {icon}
      {label}
    </Link>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-black text-forest-700 hover:text-forest-900"
    >
      {label}
      <ArrowRight size={15} />
    </Link>
  );
}

function MiniInsight({
  title,
  value,
  icon,
  warning,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 shadow-sm ${
        warning
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-slate-100 bg-white text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <p className="mt-1 text-xl font-black">{value}</p>
        </div>

        <span
          className={`grid h-11 w-11 place-items-center rounded-2xl ${
            warning ? 'bg-amber-100 text-amber-700' : 'bg-forest-100 text-forest-700'
          }`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function MobileRow({
  title,
  meta,
  value,
  subValue,
}: {
  title: string;
  meta: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black capitalize text-slate-900">{title}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{meta}</p>
        </div>

        <div className="text-right">
          <p className="font-black text-slate-900">{value}</p>
          {subValue && <p className="text-sm font-bold text-slate-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-3xl border border-slate-100 bg-slate-100"
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-80 animate-pulse rounded-3xl border border-slate-100 bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}