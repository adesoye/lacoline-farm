import type { FarmData, Transaction } from '@/lib/domain/types';
import { getStockRows } from '@/lib/domain/calculations';
import {
  financeLabels,
  normalizeFinanceCategory
} from '@/lib/domain/constants';

export interface StatementLine {
  label: string;
  amount: number;
}

export interface ProfitAndLossStatement {
  from: string;
  to: string;
  income: StatementLine[];
  expenses: StatementLine[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  /** Accumulated result brought forward from before app records began. */
  openingRetainedEarnings: number;
  /** netProfit + openingRetainedEarnings — cumulative position to date. */
  cumulativeResult: number;
}

export interface CashFlowStatement {
  from: string;
  to: string;
  openingBalance: number;
  cashReceipts: StatementLine[];
  cashPayments: StatementLine[];
  totalReceipts: number;
  totalPayments: number;
  netCashFlow: number;
  closingBalance: number;
}

export interface BalanceSheetStatement {
  asOfDate: string;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  liabilitiesAndEquity: number;
}

function money(value: unknown) {
  return Number(value || 0);
}

export function previousDay(date: string) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function isWithinRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function normalizeCategory(value?: string) {
  if (!value) return 'Uncategorized';

  return value
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getCategoryLabel(category: string) {
  const normalizedCategory = normalizeFinanceCategory(category);

  return (
    financeLabels[normalizedCategory] ||
    normalizedCategory
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, character => character.toUpperCase())
  );
}

function groupTransactions(transactions: Transaction[]) {
  const categoryTotals = new Map<string, number>();

  transactions.forEach(transaction => {
    const category = normalizeFinanceCategory(transaction.category);

    categoryTotals.set(
      category,
      (categoryTotals.get(category) || 0) +
        Number(transaction.amount || 0)
    );
  });

  return [...categoryTotals.entries()]
    .map(([category, amount]) => ({
      label: getCategoryLabel(category),
      amount
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getTransactionNetBetween(
  transactions: Transaction[],
  from?: string,
  to?: string
) {
  const rows = transactions.filter(item => {
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    return true;
  });

  const income = rows
    .filter(item => item.type === 'income')
    .reduce((sum, item) => sum + money(item.amount), 0);

  const expense = rows
    .filter(item => item.type === 'expense')
    .reduce((sum, item) => sum + money(item.amount), 0);

  return income - expense;
}

export function getOpeningCashBalance(data: FarmData, periodStart: string) {
  const baselineAmount = money(data.financeSettings?.openingBalance);
  const baselineDate = data.financeSettings?.openingBalanceDate;

  if (!baselineDate) {
    return getTransactionNetBetween(
      data.transactions,
      undefined,
      previousDay(periodStart)
    );
  }

  const netBeforePeriod = getTransactionNetBetween(
    data.transactions,
    baselineDate,
    previousDay(periodStart)
  );

  return baselineAmount + netBeforePeriod;
}

export function getClosingCashBalance(data: FarmData, asOfDate?: string) {
  const baselineAmount = money(data.financeSettings?.openingBalance);
  const baselineDate = data.financeSettings?.openingBalanceDate;

  if (!baselineDate) {
    return getTransactionNetBetween(data.transactions, undefined, asOfDate);
  }

  return baselineAmount + getTransactionNetBetween(
    data.transactions,
    baselineDate,
    asOfDate
  );
}

export function getProfitAndLossStatement(
  data: FarmData,
  from: string,
  to: string
): ProfitAndLossStatement {
  const periodTransactions = data.transactions.filter(item =>
    isWithinRange(item.date, from, to)
  );

  const incomeRows = periodTransactions.filter(item => item.type === 'income');
  const expenseRows = periodTransactions.filter(item => item.type === 'expense');

  const income = groupTransactions(incomeRows);
  const expenses = groupTransactions(expenseRows);

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const openingRetainedEarnings = money(data.financeSettings?.openingRetainedEarnings);

  return {
    from,
    to,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit,
    openingRetainedEarnings,
    cumulativeResult: netProfit + openingRetainedEarnings
  };
}

export function getCashFlowStatement(
  data: FarmData,
  from: string,
  to: string
): CashFlowStatement {
  const openingBalance = getOpeningCashBalance(data, from);

  const periodTransactions = data.transactions.filter(item =>
    isWithinRange(item.date, from, to)
  );

  const incomeRows = periodTransactions.filter(item => item.type === 'income');
  const expenseRows = periodTransactions.filter(item => item.type === 'expense');

  const cashReceipts = groupTransactions(incomeRows);
  const cashPayments = groupTransactions(expenseRows);

  const totalReceipts = cashReceipts.reduce((sum, item) => sum + item.amount, 0);
  const totalPayments = cashPayments.reduce((sum, item) => sum + item.amount, 0);

  const netCashFlow = totalReceipts - totalPayments;

  return {
    from,
    to,
    openingBalance,
    cashReceipts,
    cashPayments,
    totalReceipts,
    totalPayments,
    netCashFlow,
    closingBalance: openingBalance + netCashFlow
  };
}

export function getBalanceSheetStatement(
  data: FarmData,
  asOfDate: string
): BalanceSheetStatement {
  const cash = getClosingCashBalance(data, asOfDate);

  const livestockValue = data.pigs
    .filter(item => item.status !== 'sold' && item.status !== 'dead')
    .reduce((sum, item) => {
      const estimatedValue = money(
        (item as unknown as { estimatedValue?: number }).estimatedValue
      );

      const purchasePrice = money(
        (item as unknown as { purchasePrice?: number }).purchasePrice
      );

      return sum + Math.max(estimatedValue, purchasePrice);
    }, 0);

  const feedInventory = getStockRows(data).reduce(
    (sum, row) => sum + Math.max(row.balance, 0) * row.avgCost,
    0
  );

  const unpaidLiabilities = data.liabilities
    .filter(item => !item.paid)
    .reduce((sum, item) => sum + money(item.amount), 0);

  const assets: StatementLine[] = [
    { label: 'Cash and Bank Balance', amount: cash },
    { label: 'Livestock Inventory', amount: livestockValue },
    { label: 'Feed Inventory', amount: feedInventory }
  ];

  const liabilities: StatementLine[] = [
    { label: 'Unpaid Liabilities', amount: unpaidLiabilities }
  ];

  const totalAssets = assets.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.amount, 0);
  const ownerEquity = totalAssets - totalLiabilities;

  // Split equity to surface any result brought forward from before app records.
  const openingRetainedEarnings = money(data.financeSettings?.openingRetainedEarnings);
  const equity: StatementLine[] = openingRetainedEarnings !== 0
    ? [
        { label: 'Opening Retained Earnings (brought forward)', amount: openingRetainedEarnings },
        { label: 'Retained Earnings — on-app activity', amount: ownerEquity - openingRetainedEarnings }
      ]
    : [
        { label: 'Owner / Organization Equity', amount: ownerEquity }
      ];

  return {
    asOfDate,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity: ownerEquity,
    liabilitiesAndEquity: totalLiabilities + ownerEquity
  };
}