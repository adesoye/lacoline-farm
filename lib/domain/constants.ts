import type { Role, RouteKey } from './types';

export const feedTypes = ['starter', 'grower', 'finisher', 'sow-lactating', 'sow-gestation', 'boar', 'custom'];

export const financeCategories = {
  income: ['pig-sales', 'manure-sales', 'grant', 'investment', 'other-income'],
  expense: ['feed', 'medication', 'vaccine', 'labour', 'transport', 'equipment', 'utilities', 'repairs', 'rent', 'other-expense']
};

export const financeLabels: Record<string, string> = {
  'pig-sales': 'Pig Sales',
  'manure-sales': 'Manure Sales',
  grant: 'Grant',
  investment: 'Investment',
  'other-income': 'Other Income',
  feed: 'Feed',
  medication: 'Medication',
  vaccine: 'Vaccine',
  labour: 'Labour',
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
  feed: 'Daily Feed Log',
  'feed-stock': 'Feed Stock',
  weights: 'Weight Records',
  finance: 'Expenses & Income',
  'monthly-inputs': 'Monthly Inputs',
  'financial-statements': 'Financial Statements',
  reports: 'Reports',
  users: 'User Management',
  organizations: 'Organizations'
};

export const roleAccess: Record<Role, RouteKey[]> = {
  admin: ['dashboard', 'pigs', 'feed', 'feed-stock', 'weights', 'finance', 'monthly-inputs', 'financial-statements', 'reports', 'users', 'organizations'],
  manager: ['dashboard', 'pigs', 'feed', 'feed-stock', 'weights', 'finance', 'monthly-inputs', 'financial-statements', 'reports', 'organizations'],
  staff: ['dashboard', 'pigs', 'feed', 'feed-stock', 'weights', 'monthly-inputs', 'reports', 'organizations'],
  viewer: ['dashboard', 'pigs', 'feed', 'feed-stock', 'weights', 'monthly-inputs', 'financial-statements', 'reports', 'organizations']
};
