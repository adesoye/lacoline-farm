import type {
  FarmData,
  Pig,
  PigProfitabilityRow,
  Transaction
} from '@/lib/domain/types';
import { isWithinRange } from '@/lib/domain/financial-statements';

export interface PigProfitabilityOptions {
  includeAcquisitionCost: boolean;
  allocateFarmWideExpenses: boolean;
  includeEstimatedValueForUnsoldPigs: boolean;
  marketPricePerKg: number;
}

function money(value: unknown) {
  return Number(value || 0);
}

function isPigLinked(transaction: Transaction, pigId: string) {
  return (
    transaction.pigId === pigId ||
    transaction.relatedPigIds?.includes(pigId)
  );
}

function latestWeightForPig(data: FarmData, pigId: string, to: string) {
  const records = data.weightRecords
    .filter(item => item.pigId === pigId && item.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));

  return money(records[0]?.weight);
}

function getPigLabel(pig: Pig) {
  return `${pig.tag}${pig.name ? ` - ${pig.name}` : ''}`;
}

function getPigAcquisitionCost(pig: Pig, from: string, to: string) {
  const purchasePrice = money(
    (pig as unknown as { purchasePrice?: number }).purchasePrice
  );

  const acquisitionDate =
    (pig as unknown as { dob?: string; acquiredAt?: string }).acquiredAt ||
    (pig as unknown as { dob?: string }).dob ||
    '';

  if (!purchasePrice || !acquisitionDate) return 0;

  return isWithinRange(acquisitionDate, from, to) ? purchasePrice : 0;
}

function getMonthlyInputCostForPig(data: FarmData, pigId: string, from: string, to: string) {
  return data.monthlyInputs
    .filter(item => {
      if (!isWithinRange(item.date, from, to)) return false;

      const record = item as unknown as {
        pigId?: string;
        specificPigId?: string;
        target?: string;
        amount?: number;
        cost?: number;
        totalCost?: number;
      };

      return record.pigId === pigId || record.specificPigId === pigId;
    })
    .reduce((sum, item) => {
      const record = item as unknown as {
        amount?: number;
        cost?: number;
        totalCost?: number;
      };

      return sum + money(record.totalCost || record.cost || record.amount);
    }, 0);
}

function getFeedCostForPig(data: FarmData, pigId: string, from: string, to: string) {
  const logs = data.feedLogs.filter(
    item => item.pigId === pigId && isWithinRange(item.date, from, to)
  );

  const feedKg = logs.reduce((sum, item) => sum + money(item.amount), 0);

  const feedCost = logs.reduce((sum, item) => {
    const costPerKg = money(
      (item as unknown as { costPerKg?: number }).costPerKg
    );

    return sum + money(item.amount) * costPerKg;
  }, 0);

  return { feedKg, feedCost };
}

function getEventSaleIncomeForPig(data: FarmData, pigId: string, from: string, to: string) {
  return data.pigEvents
    .filter(item => {
      const record = item as unknown as {
        pigId: string;
        type: string;
        date: string;
        salePrice?: number;
      };

      return (
        record.pigId === pigId &&
        record.type === 'sold' &&
        isWithinRange(record.date, from, to)
      );
    })
    .reduce((sum, item) => {
      const record = item as unknown as { salePrice?: number };
      return sum + money(record.salePrice);
    }, 0);
}

function getDirectTransactionsForPig(
  data: FarmData,
  pigId: string,
  from: string,
  to: string
) {
  return data.transactions.filter(
    item => isWithinRange(item.date, from, to) && isPigLinked(item, pigId)
  );
}

function getFarmWideExpenseAllocation(
  data: FarmData,
  from: string,
  to: string,
  pigCount: number
) {
  if (!pigCount) return 0;

  const farmWideExpenses = data.transactions.filter(item => {
    if (!isWithinRange(item.date, from, to)) return false;
    if (item.type !== 'expense') return false;
    if (item.pigId || item.relatedPigIds?.length) return false;

    return true;
  });

  const total = farmWideExpenses.reduce(
    (sum, item) => sum + money(item.amount),
    0
  );

  return total / pigCount;
}

export function getPigProfitabilityRows(
  data: FarmData,
  from: string,
  to: string,
  options: PigProfitabilityOptions
): PigProfitabilityRow[] {
  const pigs = data.pigs;

  const allocationPerPig = options.allocateFarmWideExpenses
    ? getFarmWideExpenseAllocation(data, from, to, pigs.length)
    : 0;

  return pigs.map(pig => {
    const latestWeight = latestWeightForPig(data, pig.id, to);
    const { feedKg, feedCost } = getFeedCostForPig(data, pig.id, from, to);
    const inputCost = getMonthlyInputCostForPig(data, pig.id, from, to);

    const directTransactions = getDirectTransactionsForPig(
      data,
      pig.id,
      from,
      to
    );

    const directIncome = directTransactions
      .filter(item => item.type === 'income')
      .reduce((sum, item) => sum + money(item.amount), 0);

    const directExpense = directTransactions
      .filter(item => item.type === 'expense')
      .reduce((sum, item) => sum + money(item.amount), 0);

    const saleIncomeFromEvents = getEventSaleIncomeForPig(
      data,
      pig.id,
      from,
      to
    );

    const saleIncome = Math.max(saleIncomeFromEvents, 0);

    const acquisitionCost = options.includeAcquisitionCost
      ? getPigAcquisitionCost(pig, from, to)
      : 0;

    const estimatedValue =
      options.includeEstimatedValueForUnsoldPigs && pig.status === 'active'
        ? latestWeight * money(options.marketPricePerKg)
        : 0;

    const income = directIncome + saleIncome + estimatedValue;

    const expenses =
      acquisitionCost +
      feedCost +
      inputCost +
      directExpense +
      allocationPerPig;

    const profit = income - expenses;

    const marginPercent = income > 0 ? (profit / income) * 100 : 0;
    const roiPercent = expenses > 0 ? (profit / expenses) * 100 : 0;
    const profitPerKg = latestWeight > 0 ? profit / latestWeight : 0;

    const notes: string[] = [];

    if (!latestWeight) notes.push('No weight record');
    if (!feedCost) notes.push('No feed cost captured');
    if (!directTransactions.length && !saleIncome) notes.push('No pig-linked transactions');

    return {
      pigId: pig.id,
      tag: pig.tag,
      name: pig.name,
      type: pig.type,
      status: pig.status,

      income,
      saleIncome,
      directIncome,
      estimatedValue,

      expenses,
      acquisitionCost,
      feedCost,
      inputCost,
      directExpense,
      allocatedFarmExpense: allocationPerPig,

      profit,
      marginPercent,
      roiPercent,

      latestWeight,
      profitPerKg,
      feedKg,

      notes
    };
  });
}

export function getPigProfitabilitySummary(rows: PigProfitabilityRow[]) {
  const income = rows.reduce((sum, item) => sum + item.income, 0);
  const expenses = rows.reduce((sum, item) => sum + item.expenses, 0);
  const profit = income - expenses;

  const profitable = rows.filter(item => item.profit > 0).length;
  const lossMaking = rows.filter(item => item.profit < 0).length;

  const bestPig = [...rows].sort((a, b) => b.profit - a.profit)[0];
  const worstPig = [...rows].sort((a, b) => a.profit - b.profit)[0];

  return {
    income,
    expenses,
    profit,
    profitable,
    lossMaking,
    bestPig,
    worstPig
  };
}

export function getPigProfitabilityCsv(rows: PigProfitabilityRow[]) {
  const headers = [
    'Tag',
    'Name',
    'Type',
    'Status',
    'Income',
    'Expenses',
    'Profit',
    'Margin %',
    'ROI %',
    'Latest Weight',
    'Profit per Kg',
    'Feed Kg',
    'Feed Cost',
    'Acquisition Cost',
    'Input Cost',
    'Direct Expense',
    'Allocated Farm Expense',
    'Notes'
  ];

  const body = rows.map(row => [
    row.tag,
    row.name || '',
    row.type || '',
    row.status || '',
    row.income,
    row.expenses,
    row.profit,
    row.marginPercent.toFixed(2),
    row.roiPercent.toFixed(2),
    row.latestWeight,
    row.profitPerKg.toFixed(2),
    row.feedKg,
    row.feedCost,
    row.acquisitionCost,
    row.inputCost,
    row.directExpense,
    row.allocatedFarmExpense,
    row.notes.join('; ')
  ]);

  return [headers, ...body]
    .map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export { getPigLabel };