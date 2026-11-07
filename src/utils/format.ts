import currency from "currency.js";
import { parse } from "date-fns";

// 金额以整数分存储，展示统一经 currency.js 换算，保证全站千分位与两位小数一致。
// 不要在页面里手写除以 100 或 toFixed。
export function formatAmount(cents: number): string {
  return currency(cents, { fromCents: true, symbol: "¥" }).format();
}

// "YYYY-MM-DD" 字符串必须经 date-fns 按本地时区解析；
// new Date(iso) 会走 UTC，在时区偏移为负的地区会偏移一天。
export function parseDate(date: string): Date {
  return parse(date, "yyyy-MM-dd", new Date());
}
