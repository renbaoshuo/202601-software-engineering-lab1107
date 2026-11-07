import { groupBy, orderBy, sumBy, union } from "lodash-es";
import type { Transaction } from "../shared/types";
import { DEFAULT_CATEGORIES } from "../shared/constants";

export interface CategoryTotal {
  name: string;
  amount: number;
}

export function getCategoryTotals(records: Transaction[]): CategoryTotal[] {
  const expenses = records.filter(record => record.type === "expense");
  const groups = groupBy(expenses, record => record.category);
  const names = union(DEFAULT_CATEGORIES.expense, Object.keys(groups));
  const totals = names.filter(name => Object.hasOwn(groups, name)).map(name => ({
    name,
    amount: sumBy(groups[name], "amount"),
  }));

  return orderBy(totals, ["amount"], ["desc"]);
}
