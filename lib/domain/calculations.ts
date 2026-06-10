import { feedTypes, financeCategories } from './constants';
import type { FarmData, FeedLog, FeedPurchase, Liability, Pig, Transaction } from './types';
import { percent, today } from '@/lib/utils';

export function getStockBalance(feedPurchases: FeedPurchase[], feedLogs: FeedLog[], feedType: string) {
  const purchased = feedPurchases.filter(item => item.feedType === feedType).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const consumed = feedLogs.filter(item => item.feedType === feedType).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return purchased - consumed;
}

export function getAverageCostPerKg(feedPurchases: FeedPurchase[], feedType: string) {
  const purchases = feedPurchases.filter(item => item.feedType === feedType);
  const qty = purchases.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const amount = purchases.reduce((sum, item) => sum + Number(item.totalCost || item.quantity * item.costPerKg || 0), 0);
  return qty > 0 ? amount / qty : 0;
}

export function getStockRows(data: FarmData) {
  const levels = data.feedSettings?.levels ?? {};
  return feedTypes.map(feedType => {
    const purchased = data.feedPurchases.filter(item => item.feedType === feedType).reduce((sum, item) => sum + item.quantity, 0);
    const consumed = data.feedLogs.filter(item => item.feedType === feedType).reduce((sum, item) => sum + item.amount, 0);
    const balance = purchased - consumed;
    const reorderLevel = Number(levels[feedType] || 0);
    return {
      feedType,
      purchased,
      consumed,
      balance,
      reorderLevel,
      avgCost: getAverageCostPerKg(data.feedPurchases, feedType),
      alert: reorderLevel > 0 && balance <= reorderLevel
    };
  });
}

export function getFinancialTotals(transactions: Transaction[], month?: string) {
  const rows = month ? transactions.filter(item => item.date.startsWith(month)) : transactions;
  const income = rows.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = rows.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  return { income, expense, profit: income - expense, transactions: rows };
}

export function groupTransactionsByCategory(transactions: Transaction[]) {
  return transactions.reduce<Record<string, number>>((acc, txn) => {
    acc[txn.category] = (acc[txn.category] || 0) + txn.amount;
    return acc;
  }, {});
}

export function getFeedDailySummary(logs: FeedLog[], date: string) {
  const rows = logs.filter(item => item.date === date);
  const totalKg = rows.reduce((sum, item) => sum + item.amount, 0);
  const totalCost = rows.reduce((sum, item) => sum + item.totalCost, 0);
  const byFeed = rows.reduce<Record<string, { kg: number; cost: number }>>((acc, item) => {
    acc[item.feedType] ||= { kg: 0, cost: 0 };
    acc[item.feedType].kg += item.amount;
    acc[item.feedType].cost += item.totalCost;
    return acc;
  }, {});
  const byPig = rows.reduce<Record<string, { kg: number; cost: number; entries: FeedLog[] }>>((acc, item) => {
    acc[item.pigId] ||= { kg: 0, cost: 0, entries: [] };
    acc[item.pigId].kg += item.amount;
    acc[item.pigId].cost += item.totalCost;
    acc[item.pigId].entries.push(item);
    return acc;
  }, {});
  return { rows, totalKg, totalCost, byFeed, byPig };
}

export function getDashboardKpis(data: FarmData) {
  const activePigs = data.pigs.filter(item => item.status === 'active').length;
  const soldPigs = data.pigs.filter(item => item.status === 'sold').length;
  const deadPigs = data.pigs.filter(item => item.status === 'dead').length;
  const feedToday = data.feedLogs.filter(item => item.date === today()).reduce((sum, item) => sum + item.amount, 0);
  const allTotals = getFinancialTotals(data.transactions);
  const stockAlerts = getStockRows(data).filter(item => item.alert).length;
  const dueSoon = data.monthlyInputs.filter(item => {
    if (!item.nextDue) return false;
    const due = new Date(`${item.nextDue}T00:00:00`).getTime();
    const now = new Date(`${today()}T00:00:00`).getTime();
    return due >= now && due <= now + 1000 * 60 * 60 * 24 * 30;
  }).length;
  return { activePigs, soldPigs, deadPigs, feedToday, allTotals, stockAlerts, dueSoon };
}

export function latestWeightForPig(pigId: string, data: FarmData) {
  return [...data.weightRecords].filter(item => item.pigId === pigId).sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function getHerdValue(pigs: Pig[]) {
  return pigs.filter(item => item.status === 'active').reduce((sum, pig) => sum + Number(pig.purchasePrice || 0), 0);
}

export function getBalanceSheet(data: FarmData) {
  const cash = getFinancialTotals(data.transactions).profit;
  const livestock = getHerdValue(data.pigs);
  const feedInventory = getStockRows(data).reduce((sum, row) => sum + Math.max(row.balance, 0) * row.avgCost, 0);
  const liabilities = data.liabilities.filter(item => !item.paid).reduce((sum, item) => sum + item.amount, 0);
  const assets = cash + livestock + feedInventory;
  return { cash, livestock, feedInventory, liabilities, assets, equity: assets - liabilities };
}

export function getProfitAndLoss(data: FarmData, from?: string, to?: string) {
  const txns = data.transactions.filter(item => (!from || item.date >= from) && (!to || item.date <= to));
  const revenue = txns.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const cogs = txns.filter(item => financeCategories.expense.includes(item.category) && ['feed', 'medication', 'vaccine'].includes(item.category)).reduce((sum, item) => sum + item.amount, 0);
  const expenses = txns.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const grossProfit = revenue - cogs;
  const netProfit = revenue - expenses;
  return { revenue, cogs, expenses, grossProfit, netProfit, grossMargin: percent(grossProfit, revenue), netMargin: percent(netProfit, revenue), rows: txns };
}
