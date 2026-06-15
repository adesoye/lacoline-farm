'use client';

import { useMemo, useState } from 'react';
import {
  downloadCsv,
  getPigProfitabilityCsv,
  getPigProfitabilityRows,
  getPigProfitabilitySummary
} from '@/lib/domain/pig-profitability';
import { useFarmData } from '@/lib/firebase/firestore';

function formatMoney(value: number) {
  return `₦${Number(value || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatNumber(value: number, digits = 1) {
  return Number(value || 0).toLocaleString('en-NG', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function currentMonthStart() {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PigProfitabilityPage() {
  const { data, loading, errors } = useFarmData();

  const [from, setFrom] = useState(currentMonthStart());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedPigId, setSelectedPigId] = useState('');

  const [includeAcquisitionCost, setIncludeAcquisitionCost] = useState(true);
  const [allocateFarmWideExpenses, setAllocateFarmWideExpenses] = useState(false);
  const [includeEstimatedValue, setIncludeEstimatedValue] = useState(false);
  const [marketPricePerKg, setMarketPricePerKg] = useState(0);

  const rows = useMemo(() => {
    return getPigProfitabilityRows(data, from, to, {
      includeAcquisitionCost,
      allocateFarmWideExpenses,
      includeEstimatedValueForUnsoldPigs: includeEstimatedValue,
      marketPricePerKg
    });
  }, [
    allocateFarmWideExpenses,
    data,
    from,
    includeAcquisitionCost,
    includeEstimatedValue,
    marketPricePerKg,
    to
  ]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const text = `${row.tag} ${row.name || ''}`.toLowerCase();

      if (search && !text.includes(search.toLowerCase())) return false;
      if (status && row.status !== status) return false;

      return true;
    });
  }, [rows, search, status]);

  const summary = useMemo(
    () => getPigProfitabilitySummary(filteredRows),
    [filteredRows]
  );

  const selectedPig = filteredRows.find(row => row.pigId === selectedPigId);

  function exportCsv() {
    downloadCsv(
      `pig-profitability-${from}-to-${to}.csv`,
      getPigProfitabilityCsv(filteredRows)
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-6 font-bold text-slate-600 shadow-card">
        Loading pig profitability...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-white p-5 shadow-card">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-forest-700">
              Pig Profitability
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Profit and loss per pig
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              See which pigs are profitable based on feed cost, expenses, sale income,
              acquisition cost, treatments, and direct transactions.
            </p>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="rounded-2xl bg-forest-700 px-5 py-3 text-sm font-black text-white shadow-soft hover:bg-forest-800"
          >
            Export CSV
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
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={event => setFrom(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
              To
            </span>
            <input
              type="date"
              value={to}
              onChange={event => setTo(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
              Search Pig
            </span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Tag or name"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
              Status
            </span>
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-forest-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="dead">Dead</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={includeAcquisitionCost}
              onChange={event => setIncludeAcquisitionCost(event.target.checked)}
            />
            Include acquisition cost
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={allocateFarmWideExpenses}
              onChange={event => setAllocateFarmWideExpenses(event.target.checked)}
            />
            Allocate farm-wide expenses
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={includeEstimatedValue}
              onChange={event => setIncludeEstimatedValue(event.target.checked)}
            />
            Include unsold estimated value
          </label>

          <label className="block rounded-2xl bg-slate-50 px-4 py-3">
            <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">
              Market ₦/kg
            </span>
            <input
              type="number"
              min="0"
              value={marketPricePerKg}
              onChange={event => setMarketPricePerKg(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Income
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {formatMoney(summary.income)}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Expenses
          </p>
          <p className="mt-2 text-2xl font-black text-red-700">
            {formatMoney(summary.expenses)}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Net Result
          </p>
          <p
            className={`mt-2 text-2xl font-black ${
              summary.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatMoney(summary.profit)}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Profitable Pigs
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {summary.profitable}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Loss-Making Pigs
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {summary.lossMaking}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-4">Pig</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4 text-right">Income</th>
                <th className="px-4 py-4 text-right">Expenses</th>
                <th className="px-4 py-4 text-right">Profit/Loss</th>
                <th className="px-4 py-4 text-right">Margin</th>
                <th className="px-4 py-4 text-right">ROI</th>
                <th className="px-4 py-4 text-right">Weight</th>
                <th className="px-4 py-4 text-right">Profit/Kg</th>
                <th className="px-4 py-4">Notes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => (
                <tr
                  key={row.pigId}
                  onClick={() => setSelectedPigId(row.pigId)}
                  className="cursor-pointer hover:bg-forest-50"
                >
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{row.tag}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {row.name || 'Unnamed'} · {row.type || 'Unknown'}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">
                      {row.status || 'unknown'}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-right font-bold text-emerald-700">
                    {formatMoney(row.income)}
                  </td>

                  <td className="px-4 py-4 text-right font-bold text-red-700">
                    {formatMoney(row.expenses)}
                  </td>

                  <td
                    className={`px-4 py-4 text-right font-black ${
                      row.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {formatMoney(row.profit)}
                  </td>

                  <td className="px-4 py-4 text-right font-bold">
                    {formatNumber(row.marginPercent, 1)}%
                  </td>

                  <td className="px-4 py-4 text-right font-bold">
                    {formatNumber(row.roiPercent, 1)}%
                  </td>

                  <td className="px-4 py-4 text-right font-bold">
                    {formatNumber(row.latestWeight, 1)} kg
                  </td>

                  <td className="px-4 py-4 text-right font-bold">
                    {formatMoney(row.profitPerKg)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {row.notes.length ? (
                        row.notes.map(note => (
                          <span
                            key={note}
                            className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"
                          >
                            {note}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                          Complete
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredRows.length ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center font-bold text-slate-400">
                    No pigs found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPig ? (
        <section className="rounded-[2rem] bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-forest-700">
                Pig Breakdown
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {selectedPig.tag} {selectedPig.name ? `— ${selectedPig.name}` : ''}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setSelectedPigId('')}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <BreakdownCard label="Sale Income" value={selectedPig.saleIncome} positive />
            <BreakdownCard label="Direct Income" value={selectedPig.directIncome} positive />
            <BreakdownCard label="Estimated Value" value={selectedPig.estimatedValue} positive />

            <BreakdownCard label="Feed Cost" value={selectedPig.feedCost} />
            <BreakdownCard label="Acquisition Cost" value={selectedPig.acquisitionCost} />
            <BreakdownCard label="Medication/Input Cost" value={selectedPig.inputCost} />

            <BreakdownCard label="Direct Expense" value={selectedPig.directExpense} />
            <BreakdownCard label="Allocated Farm Expense" value={selectedPig.allocatedFarmExpense} />
            <BreakdownCard label="Net Profit/Loss" value={selectedPig.profit} positive={selectedPig.profit >= 0} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BreakdownCard({
  label,
  value,
  positive = false
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-black ${
          positive ? 'text-emerald-700' : 'text-slate-950'
        }`}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}