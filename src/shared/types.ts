export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  // 金额统一用整数分，避免小数累加误差；收支方向由 type 决定。
  amount: number;
  category: string;
  // 使用本地账单日（YYYY-MM-DD），不经过 UTC 转换。
  date: string;
  note: string;
}

export type NewTransaction = Omit<Transaction, "id">;

export interface TransactionFilter {
  type?: TransactionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;
}

export interface TransactionQuery extends TransactionFilter {
  sortBy?: "date" | "amount";
  order?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export interface MonthlyBudget {
  month: string; // YYYY-MM，每月一条
  amount: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
}

export type NewSavingsGoal = Pick<SavingsGoal, "name" | "targetAmount">;

export interface LedgerBackup {
  version: 1;
  transactions: Transaction[];
  budgets: MonthlyBudget[];
  savingsGoals: SavingsGoal[];
}
