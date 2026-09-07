'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getBalanceSheetStatement,
  getCashFlowStatement,
  getProfitAndLossStatement
} from '@/lib/domain/financial-statements';
import type { StatementPeriodType } from '@/lib/domain/types';
import { collectionNames, setRecord, useFarmData } from '@/lib/firebase/firestore';
import { useAuth } from '@/lib/firebase/auth-context';
import { canManageFinance } from '@/lib/rbac';

type StatementTab = 'profit-loss' | 'cash-flow' | 'balance-sheet';

function formatMoney(value: number) {
  return `₦${Number(value || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function monthStart(month: string) {
  return `${month}-01`;
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10);
}

function yearStart(year: string) {
  return `${year}-01-01`;
}

function yearEnd(year: string) {
  return `${year}-12-31`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function currentYear() {
  return String(new Date().getFullYear());
}

function StatementPage({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="statement-print-area mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-card md:p-10">
      <header className="border-b-2 border-slate-900 pb-5 text-center">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-forest-700">
          Lacoline Farm
        </p>
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide text-slate-950">
          {title}
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">{subtitle}</p>
      </header>

      <div className="mt-8">{children}</div>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Generated from Lacoline Farm SaaS Management System
      </footer>
    </section>
  );
}

function StatementSection({
  title,
  rows,
  totalLabel,
  totalAmount
}: {
  title: string;
  rows: { label: string; amount: number }[];
  totalLabel: string;
  totalAmount: number;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 border-b border-slate-300 pb-2 text-sm font-black uppercase tracking-[0.2em] text-slate-800">
        {title}
      </h2>

      <div className="space-y-1">
        {rows.length ? (
          rows.map(row => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm"
            >
              <span className="font-semibold text-slate-600">{row.label}</span>
              <span className="font-bold tabular-nums text-slate-900">
                {formatMoney(row.amount)}
              </span>
            </div>
          ))
        ) : (
          <div className="rounded-xl px-3 py-3 text-sm font-semibold italic text-slate-400">
            No records for this period.
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t-2 border-slate-900 px-3 py-3 text-sm font-black text-slate-950">
          <span>{totalLabel}</span>
          <span className="tabular-nums">{formatMoney(totalAmount)}</span>
        </div>
      </div>
    </section>
  );
}

export function FinancialStatementsPage() {
  const { data, loading, errors } = useFarmData();
  const { profile } = useAuth();
  const canEditSettings = canManageFinance(profile?.role);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [openingRE, setOpeningRE] = useState('');

  useEffect(() => {
    const fs = data.financeSettings;
    setOpeningCash(fs?.openingBalance ? String(fs.openingBalance) : '');
    setOpeningDate(fs?.openingBalanceDate || '');
    setOpeningRE(fs?.openingRetainedEarnings ? String(fs.openingRetainedEarnings) : '');
  }, [data.financeSettings]);

  async function saveFinanceSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditSettings) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await setRecord(
        profile?.activeOrgId,
        collectionNames.settings,
        'finance',
        {
          openingBalance: Number(openingCash) || 0,
          openingBalanceDate: openingDate || '',
          openingRetainedEarnings: Number(openingRE) || 0
        },
        profile?.uid
      );
      setSettingsSaved(true);
    } finally {
      setSavingSettings(false);
    }
  }

  const [activeTab, setActiveTab] = useState<StatementTab>('profit-loss');
  const [periodType, setPeriodType] = useState<StatementPeriodType>('monthly');

  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [customFrom, setCustomFrom] = useState(`${currentYear()}-01-01`);
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));

  const period = useMemo(() => {
    if (periodType === 'monthly') {
      return {
        from: monthStart(month),
        to: monthEnd(month),
        label: `For the month ended ${formatDate(monthEnd(month))}`
      };
    }

    if (periodType === 'annual') {
      return {
        from: yearStart(year),
        to: yearEnd(year),
        label: `For the year ended December 31, ${year}`
      };
    }

    return {
      from: customFrom,
      to: customTo,
      label: `For the period ${formatDate(customFrom)} to ${formatDate(customTo)}`
    };
  }, [customFrom, customTo, month, periodType, year]);

  const pnl = useMemo(
    () => getProfitAndLossStatement(data, period.from, period.to),
    [data, period.from, period.to]
  );

  const cashFlow = useMemo(
    () => getCashFlowStatement(data, period.from, period.to),
    [data, period.from, period.to]
  );

  const balanceSheet = useMemo(
    () => getBalanceSheetStatement(data, period.to),
    [data, period.to]
  );

  function printStatement() {
    window.print();
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 font-bold text-slate-600 shadow-card">
        Loading financial statements...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print rounded-[2rem] bg-white p-5 shadow-card">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-forest-700">
              Financial Statements
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Formal farm financial reports
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              View and print Profit & Loss, Cash Flow, and Balance Sheet reports.
            </p>
          </div>

          <button
            type="button"
            onClick={printStatement}
            className="rounded-2xl bg-forest-700 px-5 py-3 text-sm font-black text-white shadow-soft hover:bg-forest-800"
          >
            Print current statement
          </button>
        </div>

        {errors.length ? (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errors.join(', ')}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
              Period Type
            </span>
            <select
              value={periodType}
              onChange={event => setPeriodType(event.target.value as StatementPeriodType)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom Range</option>
            </select>
          </label>

          {periodType === 'monthly' ? (
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                Month
              </span>
              <input
                type="month"
                value={month}
                onChange={event => setMonth(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
              />
            </label>
          ) : null}

          {periodType === 'annual' ? (
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                Year
              </span>
              <input
                type="number"
                value={year}
                onChange={event => setYear(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
              />
            </label>
          ) : null}

          {periodType === 'custom' ? (
            <>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  From
                </span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={event => setCustomFrom(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  To
                </span>
                <input
                  type="date"
                  value={customTo}
                  onChange={event => setCustomTo(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
                />
              </label>
            </>
          ) : null}
        </div>

        {canEditSettings ? (
          <form
            onSubmit={saveFinanceSettings}
            className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              Opening Balances &amp; Pre-App History
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Carry forward figures from before you started recording in the app.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  Opening Cash Balance (₦)
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={openingCash}
                  onChange={event => setOpeningCash(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  Opening Date
                </span>
                <input
                  type="date"
                  value={openingDate}
                  onChange={event => setOpeningDate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                  Opening Retained Earnings (₦)
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={openingRE}
                  onChange={event => setOpeningRE(event.target.value)}
                  placeholder="e.g. -150000 for a prior loss"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Negative = prior accumulated loss (deficit); positive = retained profit.
                </span>
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-2xl bg-forest-700 px-5 py-2.5 text-sm font-black text-white shadow-soft hover:bg-forest-800 disabled:opacity-60"
              >
                {savingSettings ? 'Saving…' : 'Save opening balances'}
              </button>
              {settingsSaved ? (
                <span className="text-sm font-bold text-emerald-700">Saved ✓</span>
              ) : null}
            </div>
          </form>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ['profit-loss', 'Profit & Loss'],
            ['cash-flow', 'Cash Flow'],
            ['balance-sheet', 'Balance Sheet']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as StatementTab)}
              className={`rounded-2xl px-4 py-2 text-sm font-black ${
                activeTab === key
                  ? 'bg-forest-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'profit-loss' ? (
        <StatementPage title="Profit and Loss Statement" subtitle={period.label}>
          <StatementSection
            title="Income"
            rows={pnl.income}
            totalLabel="Total Income"
            totalAmount={pnl.totalIncome}
          />

          <StatementSection
            title="Expenses"
            rows={pnl.expenses}
            totalLabel="Total Expenses"
            totalAmount={pnl.totalExpenses}
          />

          <div
            className={`mt-8 flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-lg font-black ${
              pnl.netProfit >= 0
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <span>{pnl.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
            <span className="tabular-nums">{formatMoney(Math.abs(pnl.netProfit))}</span>
          </div>

          {pnl.openingRetainedEarnings !== 0 ? (
            <section className="mt-6">
              <h2 className="mb-3 border-b border-slate-300 pb-2 text-sm font-black uppercase tracking-[0.2em] text-slate-800">
                Memo — Cumulative Position
              </h2>
              <div className="space-y-1">
                <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-600">
                    Net {pnl.netProfit >= 0 ? 'profit' : 'loss'} this period
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatMoney(pnl.netProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-600">
                    Accumulated result brought forward (pre-app)
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {formatMoney(pnl.openingRetainedEarnings)}
                  </span>
                </div>
                <div
                  className={`mt-3 flex items-center justify-between rounded-xl border-t-2 border-slate-900 px-3 py-3 text-sm font-black ${
                    pnl.cumulativeResult >= 0 ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  <span>
                    Cumulative {pnl.cumulativeResult >= 0 ? 'Profit' : 'Loss'} to date
                  </span>
                  <span className="tabular-nums">{formatMoney(pnl.cumulativeResult)}</span>
                </div>
              </div>
            </section>
          ) : null}
        </StatementPage>
      ) : null}

      {activeTab === 'cash-flow' ? (
        <StatementPage title="Cash Flow Statement" subtitle={period.label}>
          <section className="mb-8">
            <div className="flex items-center justify-between rounded-2xl bg-slate-100 px-5 py-4 text-sm font-black text-slate-900">
              <span>Opening Cash Balance</span>
              <span className="tabular-nums">
                {formatMoney(cashFlow.openingBalance)}
              </span>
            </div>
          </section>

          <StatementSection
            title="Cash Receipts"
            rows={cashFlow.cashReceipts}
            totalLabel="Total Cash Receipts"
            totalAmount={cashFlow.totalReceipts}
          />

          <StatementSection
            title="Cash Payments"
            rows={cashFlow.cashPayments}
            totalLabel="Total Cash Payments"
            totalAmount={cashFlow.totalPayments}
          />

          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-100 px-5 py-4 text-sm font-black text-slate-900">
              <span>Net Cash Flow</span>
              <span className="tabular-nums">
                {formatMoney(cashFlow.netCashFlow)}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border-2 border-slate-900 px-5 py-4 text-lg font-black text-slate-950">
              <span>Closing Cash Balance</span>
              <span className="tabular-nums">
                {formatMoney(cashFlow.closingBalance)}
              </span>
            </div>
          </div>
        </StatementPage>
      ) : null}

      {activeTab === 'balance-sheet' ? (
        <StatementPage
          title="Balance Sheet"
          subtitle={`As at ${formatDate(period.to)}`}
        >
          <StatementSection
            title="Assets"
            rows={balanceSheet.assets}
            totalLabel="Total Assets"
            totalAmount={balanceSheet.totalAssets}
          />

          <StatementSection
            title="Liabilities"
            rows={balanceSheet.liabilities}
            totalLabel="Total Liabilities"
            totalAmount={balanceSheet.totalLiabilities}
          />

          <StatementSection
            title="Equity"
            rows={balanceSheet.equity}
            totalLabel="Total Equity"
            totalAmount={balanceSheet.totalEquity}
          />

          <div className="mt-8 grid gap-3 rounded-2xl border-2 border-slate-900 p-5 text-sm font-black text-slate-950">
            <div className="flex items-center justify-between">
              <span>Total Assets</span>
              <span>{formatMoney(balanceSheet.totalAssets)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Total Liabilities + Equity</span>
              <span>{formatMoney(balanceSheet.liabilitiesAndEquity)}</span>
            </div>
          </div>
        </StatementPage>
      ) : null}
    </div>
  );
}