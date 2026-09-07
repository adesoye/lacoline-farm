import type { Role, RouteKey } from './types';

export const feedTypes = ['starter', 'grower', 'finisher', 'sow-lactating', 'sow-gestation', 'boar', 'custom'];

export const financeCategories = {
  income: ['pig-sales', 'poultry-sales', 'egg-sales', 'manure-sales', 'grant', 'investment', 'other-income'],
  expense: ['feed', 'medication', 'vaccine', 'labour', 'salary', 'transport', 'equipment', 'utilities', 'repairs', 'rent', 'other-expense']
};

export const financeLabels: Record<string, string> = {
  'pig-sales': 'Pig Sales',
  'poultry-sales': 'Poultry Sales',
  'egg-sales': 'Egg Sales',
  'manure-sales': 'Manure Sales',
  grant: 'Grant',
  investment: 'Investment',
  'other-income': 'Other Income',
  feed: 'Feed',
  medication: 'Medication',
  vaccine: 'Vaccine',
  labour: 'Labour',
  salary: 'Salary',
  transport: 'Transport',
  equipment: 'Equipment',
  utilities: 'Utilities',
  repairs: 'Repairs',
  rent: 'Rent',
  'other-expense': 'Other Expense'
};

export const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  viewer: 'Viewer'
};

export const routeLabels: Record<RouteKey, string> = {
  dashboard: 'Dashboard',
  pigs: 'Pig Inventory',
  poultry: 'Poultry',
  feed: 'Daily Feed Log',
  'feed-stock': 'Feed Stock',
  weights: 'Weight Records',
  finance: 'Expenses & Income',
  'monthly-inputs': 'Monthly Inputs',
  'pig-profitability': 'Pig Profitability',
  'financial-statements': 'Financial Statements',
  reports: 'Reports',
  users: 'User Management',
  organizations: 'Organizations'
};

export const roleAccess: Record<Role, RouteKey[]> = {
  admin: ['dashboard', 'pigs', 'poultry', 'feed', 'feed-stock', 'weights', 'finance', 'pig-profitability', 'monthly-inputs', 'financial-statements', 'reports', 'users', 'organizations'],
  manager: ['dashboard', 'pigs', 'poultry', 'feed', 'feed-stock', 'weights', 'finance', 'pig-profitability', 'monthly-inputs', 'financial-statements', 'reports', 'users'],
  staff: ['dashboard', 'pigs', 'poultry', 'feed', 'feed-stock', 'weights', 'monthly-inputs', 'reports'],
  viewer: ['dashboard', 'pigs', 'poultry', 'feed', 'feed-stock', 'weights', 'monthly-inputs', 'financial-statements', 'reports']
};

export function normalizeFinanceCategory(category: string) {
  if (category === 'labour') {
    return 'labor';
  }

  return category;
}
