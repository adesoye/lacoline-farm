export type Role = 'admin' | 'manager' | 'staff' | 'viewer';
export type OrganizationPlan = 'starter' | 'growth' | 'enterprise';
export type OrganizationStatus = 'trialing' | 'active' | 'suspended';
export type PigStatus = 'active' | 'sold' | 'dead';
export type PigType = 'boar' | 'sow' | 'piglet' | 'grower' | 'finisher';
export type PigSource = 'born' | 'purchased';
export type PigEventType = 'sold' | 'dead' | 'farrowed' | 'birth' | 'treatment' | 'weaned';
export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'credit' | 'other';
export type MonthlyInputCategory = 'vaccine' | 'medication' | 'disinfectant' | 'vitamin' | 'other';
export type MonthlyInputTarget = 'all' | 'piglets' | 'sows' | 'boars' | 'growers' | 'finishers' | 'specific';
export type LiabilityType = 'current' | 'non-current';
export type LitterStatus = 'active' | 'weaned' | 'closed';
export type StatementPeriodType = 'monthly' | 'annual' | 'custom';

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrganizationMembership {
  id: string;
  orgId: string;
  orgName: string;
  uid: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  active: boolean;
  role: Role;
  activeOrgId: string;
  activeOrgName: string;
  orgIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export interface BaseUserProfile {
  uid: string;
  email: string;
  fullName: string;
  active: boolean;
  activeOrgId?: string;
  orgIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
  lastLoginAt?: unknown;
}

export interface Pig {
  id: string;
  tag: string;
  name?: string;
  type: PigType;
  breed?: string;
  dob: string;
  source: PigSource;
  purchasePrice: number;
  notes?: string;
  status: PigStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
  motherId?: string;
  fatherId?: string;
  litterId?: string;
  birthEventId?: string;
  birthWeight?: number;
  sex?: 'male' | 'female' | 'unknown';
}

export interface LitterRecord {
  id: string;
  litterTag: string;
  sowId: string;
  boarId?: string;
  farrowEventId?: string;
  farrowDate: string;
  bornAlive: number;
  stillborn: number;
  maleCount: number;
  femaleCount: number;
  totalBorn: number;
  aliveCount: number;
  deadCount: number;
  weanedCount: number;
  averageBirthWeight?: number;
  notes?: string;
  status: LitterStatus;
  createdAt?: string;
  createdBy?: string;
}

export interface PigEvent {
  id: string;
  pigId: string;
  date: string;
  type: PigEventType;
  notes?: string;
  salePrice?: number;
  saleWeight?: number;
  litterSize?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface FeedLog {
  id: string;
  date: string;
  pigId: string;
  feedType: string;
  amount: number;
  costPerKg: number;
  totalCost: number;
  feedingTime: 'morning' | 'afternoon' | 'evening' | 'all-day';
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface FeedPurchase {
  id: string;
  date: string;
  feedType: string;
  quantity: number;
  costPerKg: number;
  totalCost: number;
  supplier?: string;
  notes?: string;
  transactionId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface FeedSettings {
  id: 'reorderLevels';
  levels: Record<string, number>;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface FinanceSettings {
  id: 'finance';
  openingBalance: number;
  openingBalanceDate: string;
  /**
   * Accumulated profit (positive) or loss (negative) carried forward from
   * before the organization started recording in the app. Negative = deficit.
   */
  openingRetainedEarnings?: number;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface WeightRecord {
  id: string;
  pigId: string;
  date: string;
  weight: number;
  bcs?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  ref?: string;
  pigId?: string;
  relatedPigIds?: string[];
  /**
   * Used for labor and salary transactions.
   */
  payeeName?: string;

  /**
   * Used for hired labor or contractors.
   */
  serviceDescription?: string;

  /**
   * Used for salary transactions.
   */
  employmentType?: 'full-time' | 'part-time';

  /**
   * YYYY-MM value representing the salary month.
   */
  payPeriod?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface MonthlyInput {
  id: string;
  date: string;
  category: MonthlyInputCategory;
  product: string;
  target: MonthlyInputTarget;
  pigId?: string;
  quantity: number;
  cost: number;
  nextDue?: string;
  notes?: string;
  transactionId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface Liability {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  dueDate?: string;
  type: LiabilityType;
  paid: boolean;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface FarmData {
  pigs: Pig[];
  pigEvents: PigEvent[];
  feedLogs: FeedLog[];
  feedPurchases: FeedPurchase[];
  weightRecords: WeightRecord[];
  transactions: Transaction[];
  monthlyInputs: MonthlyInput[];
  liabilities: Liability[];
  users: UserProfile[];
  feedSettings: FeedSettings | null;
  financeSettings: FinanceSettings | null;
}

export interface PigProfitabilityRow {
  pigId: string;
  tag: string;
  name?: string;
  type?: string;
  status?: string;

  income: number;
  saleIncome: number;
  directIncome: number;
  estimatedValue: number;

  expenses: number;
  acquisitionCost: number;
  feedCost: number;
  inputCost: number;
  directExpense: number;
  allocatedFarmExpense: number;

  profit: number;
  marginPercent: number;
  roiPercent: number;

  latestWeight: number;
  profitPerKg: number;
  feedKg: number;

  notes: string[];
}

export type RouteKey =
  | 'dashboard'
  | 'pigs'
  | 'feed'
  | 'feed-stock'
  | 'weights'
  | 'finance'
  | 'pig-profitability'
  | 'monthly-inputs'
  | 'financial-statements'
  | 'reports'
  | 'users'
  | 'organizations';
