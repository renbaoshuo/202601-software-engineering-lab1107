import type { NewTransaction } from "../shared/types";

// 账单写库后广播一次，供没有用 useLiveQuery 订阅的模块（总览、流水等）主动刷新。
// 用 window 事件而不是全局状态，避免记账页与其他模块产生状态耦合。
export const TRANSACTION_ADDED_EVENT = "ledger:transaction-added";

export function notifyTransactionAdded(transaction: NewTransaction) {
  window.dispatchEvent(
    new CustomEvent<NewTransaction>(TRANSACTION_ADDED_EVENT, { detail: transaction }),
  );
}
