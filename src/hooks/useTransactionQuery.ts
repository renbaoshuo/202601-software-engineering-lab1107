import { useLiveQuery } from "dexie-react-hooks";
import { transactions } from "../shared/db";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import type { Transaction, TransactionFilter } from "../shared/types";

export default function useTransactionQuery(filter: TransactionFilter, page = 1, pageSize = 10) {
  // 分类和总条数只订阅账单变化，不随页码或筛选条件重新读取全部账单。
  const summary = useLiveQuery(async () => {
    try {
      const all = await transactions.list();
      const categories = [...new Set([
        ...DEFAULT_CATEGORIES.expense,
        ...DEFAULT_CATEGORIES.income,
        ...all.map(record => record.category),
      ])]
        .sort((a, b) => a.localeCompare(b, "zh-CN"));
      return { total: all.length, categories, error: "" };
    }
    catch {
      return {
        total: 0, categories: [] as string[],
        error: "账单读取失败，请刷新页面重试，并确认浏览器允许本地数据存储。",
      };
    }
  }, []);

  const result = useLiveQuery(async () => {
    try {
      const count = await transactions.count(filter);
      const pages = Math.max(1, Math.ceil(count / pageSize));
      // 删除或导入导致页数变化时，仍查询最后一个有效页。
      const currentPage = Math.min(page, pages);
      const records = await transactions.list({
        ...filter,
        sortBy: "date",
        order: "desc",
        offset: (currentPage - 1) * pageSize,
        limit: pageSize,
      });
      return { records, count, page: currentPage, pages, error: "" };
    }
    catch {
      return {
        records: [] as Transaction[], count: 0, page: 1, pages: 1,
        error: "账单读取失败，请刷新页面重试，并确认浏览器允许本地数据存储。",
      };
    }
  }, [filter, page, pageSize]);

  if (!summary || !result) return undefined;
  return { ...result, total: summary.total, categories: summary.categories, error: summary.error || result.error };
}
