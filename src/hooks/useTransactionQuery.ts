import { useLiveQuery } from "dexie-react-hooks";
import { transactions } from "../shared/db";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import type { Transaction, TransactionFilter } from "../shared/types";

export default function useTransactionQuery(filter: TransactionFilter, page = 1, pageSize = 10) {
  return useLiveQuery(async () => {
    try {
      const [count, all] = await Promise.all([
        transactions.count(filter),
        transactions.list(),
      ]);
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
      const categories = [...new Set([
        ...DEFAULT_CATEGORIES.expense,
        ...DEFAULT_CATEGORIES.income,
        ...all.map(record => record.category),
      ])]
        .sort((a, b) => a.localeCompare(b, "zh-CN"));
      return { records, count, total: all.length, categories, page: currentPage, pages, error: "" };
    }
    catch {
      return {
        records: [] as Transaction[], count: 0, total: 0, categories: [] as string[], page: 1, pages: 1,
        error: "账单读取失败，请刷新页面重试，并确认浏览器允许本地数据存储。",
      };
    }
  }, [filter, page, pageSize]);
}
