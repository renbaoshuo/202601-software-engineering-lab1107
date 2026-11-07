import { add, Dexie, type Table } from "dexie";
import type {
  LedgerBackup,
  MonthlyBudget,
  NewSavingsGoal,
  NewTransaction,
  SavingsGoal,
  Transaction,
  TransactionFilter,
  TransactionQuery,
} from "./types";

const db = new Dexie("personal-ledger") as Dexie & {
  transactions: Table<Transaction, string>;
  budgets: Table<MonthlyBudget, string>;
  savingsGoals: Table<SavingsGoal, string>;
};

db.version(1).stores({
  transactions: "id, date, amount",
  budgets: "month",
  savingsGoals: "id",
});

const { transactions: bills, budgets: monthlyBudgets, savingsGoals: goals } = db;
const ledgerTables = [bills, monthlyBudgets, goals];

function createTransaction(input: NewTransaction): Transaction {
  return { ...input, id: crypto.randomUUID() };
}

function findTransactions({
  type, category, startDate, endDate, minAmount, maxAmount, keyword, sortBy = "date",
}: TransactionQuery) {
  // 用排序字段的索引缩小扫描范围，再组合其余筛选条件。
  const lower = sortBy === "date" ? startDate : minAmount;
  const upper = sortBy === "date" ? endDate : maxAmount;
  const rows = lower === undefined && upper === undefined
    ? bills.orderBy(sortBy)
    : bills.where(sortBy).between(lower ?? Dexie.minKey, upper ?? Dexie.maxKey, true, true);

  if (type !== undefined) rows.and(bill => bill.type === type);
  if (category !== undefined) rows.and(bill => bill.category === category);
  if (sortBy !== "date" && startDate !== undefined) rows.and(bill => bill.date >= startDate);
  if (sortBy !== "date" && endDate !== undefined) rows.and(bill => bill.date <= endDate);
  if (sortBy !== "amount" && minAmount !== undefined) rows.and(bill => bill.amount >= minAmount);
  if (sortBy !== "amount" && maxAmount !== undefined) rows.and(bill => bill.amount <= maxAmount);

  const term = keyword?.trim().toLowerCase();
  if (term) {
    rows.and(bill => bill.category.toLowerCase().includes(term) || bill.note.toLowerCase().includes(term));
  }
  return rows;
}

export const transactions = {
  add(input: NewTransaction) {
    return bills.add(createTransaction(input));
  },
  addMany(inputs: NewTransaction[]) {
    const entries = inputs.map(createTransaction);
    return db.transaction("rw", bills, () => bills.bulkAdd(entries, { allKeys: true }));
  },
  get(id: string) {
    return bills.get(id);
  },
  list(query: TransactionQuery = {}) {
    const { order = "desc", offset = 0, limit } = query;
    const rows = findTransactions(query);
    if (order === "desc") rows.reverse();
    if (offset > 0) rows.offset(offset);
    if (limit !== undefined) rows.limit(limit);
    return rows.toArray();
  },
  count(filter: TransactionFilter = {}) {
    return findTransactions(filter).count();
  },
  async update(id: string, changes: Partial<NewTransaction>) {
    return (await bills.update(id, changes)) > 0;
  },
  remove(id: string) {
    return bills.delete(id);
  },
  removeMany(ids: string[]) {
    return bills.bulkDelete(ids);
  },
};

export const budgets = {
  get(month: string) {
    return monthlyBudgets.get(month);
  },
  list() {
    return monthlyBudgets.orderBy("month").reverse().toArray();
  },
  set(budget: MonthlyBudget) {
    return monthlyBudgets.put(budget);
  },
  remove(month: string) {
    return monthlyBudgets.delete(month);
  },
};

export const savingsGoals = {
  add(input: NewSavingsGoal) {
    return goals.add({ ...input, id: crypto.randomUUID(), savedAmount: 0 });
  },
  get(id: string) {
    return goals.get(id);
  },
  list() {
    return goals.toArray();
  },
  async update(id: string, changes: Partial<NewSavingsGoal>) {
    return (await goals.update(id, changes)) > 0;
  },
  async deposit(id: string, amount: number) {
    // 让 Dexie 按当前余额累加，避免并发存入覆盖彼此。
    return (await goals.update(id, { savedAmount: add(amount) })) > 0;
  },
  remove(id: string) {
    return goals.delete(id);
  },
};

export const ledgerBackup = {
  read() {
    return db.transaction<LedgerBackup>("r", ledgerTables, async () => {
      const [transactions, budgets, savingsGoals] = await Promise.all([
        bills.toArray(),
        monthlyBudgets.toArray(),
        goals.toArray(),
      ]);
      return { version: 1, transactions, budgets, savingsGoals };
    });
  },
  restore(backup: LedgerBackup) {
    return db.transaction("rw", ledgerTables, async () => {
      // 清空和写入放在同一事务，写入失败时保留恢复前的数据。
      await Promise.all(ledgerTables.map(table => table.clear()));
      await Promise.all([
        bills.bulkAdd(backup.transactions),
        monthlyBudgets.bulkAdd(backup.budgets),
        goals.bulkAdd(backup.savingsGoals),
      ]);
    });
  },
};
