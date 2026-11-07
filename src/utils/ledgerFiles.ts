import Papa from "papaparse";
import type {
  LedgerBackup,
  MonthlyBudget,
  NewTransaction,
  SavingsGoal,
  Transaction,
  TransactionType,
} from "../shared/types";
import {
  formatCsvAmount,
  formatFileStamp,
  isValidDateString,
  parseAmountText,
} from "./format";

export type ImportFormat = "json" | "csv";
export type ImportMode = "append" | "overwrite";

export interface ImportIssue {
  row?: number;
  message: string;
}

export interface ImportPreview {
  fileName: string;
  format: ImportFormat | null;
  transactions: NewTransaction[];
  budgets: MonthlyBudget[];
  savingsGoals: SavingsGoal[];
  backup?: LedgerBackup;
  issues: ImportIssue[];
}

const CSV_COLUMNS = ["类型", "金额", "分类", "日期", "备注"];

const HEADER_ALIASES = {
  type: ["类型", "收支类型", "type"],
  amount: ["金额", "amount"],
  category: ["分类", "category"],
  date: ["日期", "date"],
  note: ["备注", "note"],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readType(value: string): TransactionType | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "收入" || normalized === "income") return "income";
  if (normalized === "支出" || normalized === "expense") return "expense";
  return undefined;
}

function readTransactionFields(
  value: unknown,
  row: number,
  issues: ImportIssue[],
): NewTransaction | undefined {
  if (!isRecord(value)) {
    issues.push({ row, message: "记录不是有效对象" });
    return undefined;
  }

  const type = readType(String(value.type ?? ""));
  const category = String(value.category ?? "").trim();
  const date = String(value.date ?? "").trim();
  const note = String(value.note ?? "");
  const rawAmount = value.amount;
  const amount = typeof rawAmount === "number"
    ? rawAmount
    : parseAmountText(String(rawAmount ?? ""));
  let valid = true;

  if (!type) {
    issues.push({ row, message: "收支类型必须是收入或支出" });
    valid = false;
  }
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    issues.push({ row, message: "金额必须是大于 0 的有效数值" });
    valid = false;
  }
  if (!category) {
    issues.push({ row, message: "分类不能为空" });
    valid = false;
  }
  if (!isValidDateString(date)) {
    issues.push({ row, message: "日期格式应为 YYYY-MM-DD" });
    valid = false;
  }

  if (!valid || !type || typeof amount !== "number") return undefined;
  return { type, amount, category, date, note };
}

function readFullTransaction(
  value: unknown,
  row: number,
  issues: ImportIssue[],
): Transaction | undefined {
  const transaction = readTransactionFields(value, row, issues);
  if (!transaction || !isRecord(value)) return undefined;

  const id = String(value.id ?? "").trim();
  if (!id) {
    issues.push({ row, message: "账单记录缺少 id，无法作为完整备份恢复" });
    return undefined;
  }
  return { id, ...transaction };
}

function readBudget(value: unknown, row: number, issues: ImportIssue[]): MonthlyBudget | undefined {
  if (!isRecord(value)) {
    issues.push({ row, message: "预算记录不是有效对象" });
    return undefined;
  }

  const month = String(value.month ?? "");
  const amount = value.amount;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    issues.push({ row, message: "预算月份格式应为 YYYY-MM" });
    return undefined;
  }
  if (!Number.isSafeInteger(amount) || Number(amount) < 0) {
    issues.push({ row, message: "预算金额必须是非负整数分" });
    return undefined;
  }
  return { month, amount: Number(amount) };
}

function readSavingsGoal(
  value: unknown,
  row: number,
  issues: ImportIssue[],
): SavingsGoal | undefined {
  if (!isRecord(value)) {
    issues.push({ row, message: "储蓄目标不是有效对象" });
    return undefined;
  }

  const id = String(value.id ?? "").trim();
  const name = String(value.name ?? "").trim();
  const targetAmount = value.targetAmount;
  const savedAmount = value.savedAmount;
  if (!id || !name) {
    issues.push({ row, message: "储蓄目标必须包含 id 和名称" });
    return undefined;
  }
  if (!Number.isSafeInteger(targetAmount) || Number(targetAmount) < 0) {
    issues.push({ row, message: "目标金额必须是非负整数分" });
    return undefined;
  }
  if (!Number.isSafeInteger(savedAmount) || Number(savedAmount) < 0) {
    issues.push({ row, message: "已存金额必须是非负整数分" });
    return undefined;
  }
  return {
    id,
    name,
    targetAmount: Number(targetAmount),
    savedAmount: Number(savedAmount),
  };
}

function emptyPreview(fileName: string, format: ImportFormat): ImportPreview {
  return {
    fileName,
    format,
    transactions: [],
    budgets: [],
    savingsGoals: [],
    issues: [],
  };
}

function parseCsv(text: string, fileName: string): ImportPreview {
  const preview = emptyPreview(fileName, "csv");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: header => header.replace(/^\uFEFF/, "").trim(),
  });

  const parseErrorRows = new Set<number>();
  let hasGlobalParseError = false;
  result.errors.forEach((error) => {
    if (typeof error.row === "number") {
      parseErrorRows.add(error.row);
    }
    else {
      hasGlobalParseError = true;
    }
    preview.issues.push({
      row: typeof error.row === "number" ? error.row + 2 : undefined,
      message: error.message,
    });
  });

  const headers = result.meta.fields ?? [];
  const columns = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
      field,
      headers.find(header => aliases.some(alias => alias.toLowerCase() === header.toLowerCase())),
    ]),
  ) as Record<keyof typeof HEADER_ALIASES, string | undefined>;
  const missing = Object.entries(columns)
    .filter(([, header]) => !header)
    .map(([field]) => field);

  if (missing.length > 0) {
    preview.issues.push({
      message: `缺少必需列：${missing.map(field => HEADER_ALIASES[field as keyof typeof HEADER_ALIASES][0]).join("、")}`,
    });
    return preview;
  }
  if (hasGlobalParseError) return preview;

  result.data.forEach((row, index) => {
    if (parseErrorRows.has(index)) return;
    const transaction = readCsvTransaction(row, columns, index + 2, preview.issues);
    if (transaction) preview.transactions.push(transaction);
  });
  return preview;
}

function readCsvTransaction(
  row: Record<string, string>,
  columns: Record<keyof typeof HEADER_ALIASES, string | undefined>,
  rowNumber: number,
  issues: ImportIssue[],
): NewTransaction | undefined {
  const value = {
    type: row[columns.type!],
    amount: row[columns.amount!],
    category: row[columns.category!],
    date: row[columns.date!],
    note: row[columns.note!] ?? "",
  };
  return readTransactionFields(value, rowNumber, issues);
}

function parseJson(text: string, fileName: string): ImportPreview {
  const preview = emptyPreview(fileName, "json");
  let value: unknown;

  try {
    value = JSON.parse(text);
  }
  catch {
    preview.issues.push({ message: "JSON 语法无效，请检查文件内容" });
    return preview;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const transaction = readTransactionFields(item, index + 1, preview.issues);
      if (transaction) preview.transactions.push(transaction);
    });
    return preview;
  }

  if (!isRecord(value)) {
    preview.issues.push({ message: "JSON 顶层应为备份对象或账单数组" });
    return preview;
  }
  if (value.version !== 1) {
    preview.issues.push({ message: "备份版本不受支持，仅支持版本 1" });
  }
  if (!Array.isArray(value.transactions)) {
    preview.issues.push({ message: "备份缺少 transactions 数组" });
  }
  if (!Array.isArray(value.budgets)) {
    preview.issues.push({ message: "备份缺少 budgets 数组" });
  }
  if (!Array.isArray(value.savingsGoals)) {
    preview.issues.push({ message: "备份缺少 savingsGoals 数组" });
  }
  if (!Array.isArray(value.transactions) || !Array.isArray(value.budgets) || !Array.isArray(value.savingsGoals)) {
    return preview;
  }

  const transactions: Transaction[] = [];
  value.transactions.forEach((item, index) => {
    const transaction = readFullTransaction(item, index + 1, preview.issues);
    if (transaction) transactions.push(transaction);
  });
  const budgets: MonthlyBudget[] = [];
  value.budgets.forEach((item, index) => {
    const budget = readBudget(item, index + 1, preview.issues);
    if (budget) budgets.push(budget);
  });
  const savingsGoals: SavingsGoal[] = [];
  value.savingsGoals.forEach((item, index) => {
    const goal = readSavingsGoal(item, index + 1, preview.issues);
    if (goal) savingsGoals.push(goal);
  });

  preview.transactions = transactions.map(transaction => ({
    type: transaction.type,
    amount: transaction.amount,
    category: transaction.category,
    date: transaction.date,
    note: transaction.note,
  }));
  preview.budgets = budgets;
  preview.savingsGoals = savingsGoals;
  if (preview.issues.length === 0) {
    preview.backup = { version: 1, transactions, budgets, savingsGoals };
  }
  return preview;
}

export function parseImportText(text: string, fileName: string): ImportPreview {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const trimmed = text.trim();
  const format = extension === "json" || trimmed.startsWith("{") || trimmed.startsWith("[")
    ? "json"
    : extension === "csv"
      ? "csv"
      : null;

  if (!format) {
    return {
      ...emptyPreview(fileName, "csv"),
      format: null,
      issues: [{ message: "无法识别文件格式，仅支持 JSON 或 CSV" }],
    };
  }
  return format === "json" ? parseJson(text, fileName) : parseCsv(text, fileName);
}

export async function readImportFile(file: File): Promise<ImportPreview> {
  return parseImportText(await file.text(), file.name);
}

export function createJson(snapshot: LedgerBackup): string {
  return JSON.stringify(snapshot, null, 2);
}

function escapeCsvFormula(value: string): string {
  // 表格软件会把部分前导字符当作公式执行，导出用户文本时强制转为普通文本。
  return /^[\t\r]|^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function createCsv(transactions: Transaction[]): string {
  const rows = transactions.map(transaction => ({
    类型: transaction.type === "income" ? "收入" : "支出",
    金额: formatCsvAmount(transaction.amount),
    分类: escapeCsvFormula(transaction.category),
    日期: transaction.date,
    备注: escapeCsvFormula(transaction.note),
  }));
  return `\uFEFF${Papa.unparse(rows, { columns: CSV_COLUMNS, newline: "\r\n" })}`;
}

export function buildFileName(prefix: string, extension: ImportFormat): string {
  const cleanPrefix = prefix.trim().replace(/[\\/:*?"<>|]/g, "-") || "ledger-data";
  return `${cleanPrefix}-${formatFileStamp()}.${extension}`;
}

export function downloadText(text: string, fileName: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
