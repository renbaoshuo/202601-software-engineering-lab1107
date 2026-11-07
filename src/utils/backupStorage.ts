import type { LedgerBackup } from "../shared/types";
import { formatFileStamp } from "./format";
import { createJson } from "./ledgerFiles";

export type BackupKind = "manual" | "auto-import" | "auto-restore";

export interface BackupMeta {
  id: string;
  name: string;
  createdAt: string;
  kind: BackupKind;
  counts: {
    transactions: number;
    budgets: number;
    savingsGoals: number;
  };
  size: number;
}

export interface StoredBackup extends BackupMeta {
  snapshot: LedgerBackup;
}

export const BACKUP_KIND_LABELS: Record<BackupKind, string> = {
  "manual": "手动备份",
  "auto-import": "导入前自动备份",
  "auto-restore": "恢复前自动备份",
};

const INDEX_KEY = "personal-ledger-backups-v1";
const INDEX_TEMP_KEY = `${INDEX_KEY}:pending`;
const ITEM_PREFIX = "personal-ledger-backup-v1:";

function countSnapshot(snapshot: LedgerBackup): BackupMeta["counts"] {
  return {
    transactions: snapshot.transactions.length,
    budgets: snapshot.budgets.length,
    savingsGoals: snapshot.savingsGoals.length,
  };
}

function readIndex(): BackupMeta[] {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as BackupMeta[] : [];
  }
  catch {
    return [];
  }
}

export function listBackups(): BackupMeta[] {
  return readIndex().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readBackup(id: string): StoredBackup | undefined {
  const raw = localStorage.getItem(`${ITEM_PREFIX}${id}`);
  if (!raw) return undefined;
  return JSON.parse(raw) as StoredBackup;
}

export function createBackup(snapshot: LedgerBackup, kind: BackupKind): BackupMeta {
  const now = new Date();
  const id = crypto.randomUUID();
  const meta: BackupMeta = {
    id,
    name: `ledger-${kind}-${formatFileStamp(now)}.json`,
    createdAt: now.toISOString(),
    kind,
    counts: countSnapshot(snapshot),
    size: 0,
  };
  const record: StoredBackup = { ...meta, snapshot };
  const serialized = createJson(snapshot);
  record.size = new Blob([serialized]).size;

  const tempItemKey = `${ITEM_PREFIX}pending:${id}`;
  const finalItemKey = `${ITEM_PREFIX}${id}`;
  try {
    // 先写临时项、校验后再替换正式项，避免留下半截备份。
    localStorage.setItem(tempItemKey, JSON.stringify({ ...record, size: record.size }));
    const pending = JSON.parse(localStorage.getItem(tempItemKey) ?? "") as StoredBackup;
    if (
      pending.snapshot.transactions.length !== record.counts.transactions
      || pending.snapshot.budgets.length !== record.counts.budgets
      || pending.snapshot.savingsGoals.length !== record.counts.savingsGoals
    ) {
      throw new Error("备份校验失败");
    }

    localStorage.setItem(finalItemKey, JSON.stringify(record));
    const nextIndex = [record, ...readIndex()].map(item => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      kind: item.kind,
      counts: item.counts,
      size: item.size,
    }));
    localStorage.setItem(INDEX_TEMP_KEY, JSON.stringify(nextIndex));
    const pendingIndex = JSON.parse(localStorage.getItem(INDEX_TEMP_KEY) ?? "") as BackupMeta[];
    if (pendingIndex[0]?.id !== id) {
      throw new Error("备份索引校验失败");
    }

    localStorage.setItem(INDEX_KEY, JSON.stringify(nextIndex));
    localStorage.removeItem(tempItemKey);
    localStorage.removeItem(INDEX_TEMP_KEY);
    return nextIndex[0];
  }
  catch (error) {
    localStorage.removeItem(tempItemKey);
    localStorage.removeItem(INDEX_TEMP_KEY);
    const message = error instanceof Error ? error.message : "未知错误";
    throw new Error(`无法保存备份：${message}。请检查浏览器本地存储空间`, { cause: error });
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
