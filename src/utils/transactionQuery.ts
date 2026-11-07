import type { TransactionFilter, TransactionType } from "../shared/types";
import { toCents } from "./format";

export interface QueryValues {
  type: TransactionType | "";
  category: string;
  startDate: string;
  endDate: string;
  minAmount: string | number;
  maxAmount: string | number;
  keyword: string;
}

export type QueryErrors = Partial<Record<keyof QueryValues, string>>;

export const EMPTY_QUERY: QueryValues = {
  type: "",
  category: "",
  startDate: "",
  endDate: "",
  minAmount: "",
  maxAmount: "",
  keyword: "",
};

export function validateQuery(values: QueryValues): QueryErrors {
  const errors: QueryErrors = {};
  if (values.startDate && values.endDate && values.startDate > values.endDate) {
    errors.endDate = "结束日期不能早于开始日期";
  }
  for (const field of ["minAmount", "maxAmount"] as const) {
    const amount = values[field];
    if (amount !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(String(amount))
      || !Number.isSafeInteger(toCents(amount)))) {
      errors[field] = "请输入非负金额，最多两位小数，且不能超过安全金额范围";
    }
  }
  if (!errors.minAmount && !errors.maxAmount && values.minAmount !== "" && values.maxAmount !== ""
    && toCents(values.minAmount) > toCents(values.maxAmount)) {
    errors.maxAmount = "最高金额不能小于最低金额";
  }
  return errors;
}

/** 输入框以元展示；仅在提交边界换成数据库要求的整数分，保留 0 上限。 */
export function toTransactionFilter(values: QueryValues): TransactionFilter {
  return {
    type: values.type || undefined,
    category: values.category || undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate || undefined,
    minAmount: values.minAmount === "" ? undefined : toCents(values.minAmount),
    maxAmount: values.maxAmount === "" ? undefined : toCents(values.maxAmount),
    keyword: values.keyword.trim() || undefined,
  };
}
