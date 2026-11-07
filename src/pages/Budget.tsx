import { Loader, Progress, Table } from "@mantine/core";
import PageContainer from "../components/PageContainer";
import { useTimeout } from "@mantine/hooks";
import currency from "currency.js";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { budgets, transactions } from "../shared/db";
import { formatAmount } from "../utils/format";
import "./Budget.css";

const monthOf = (date: string) => date.slice(0, 7);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface BudgetProgressProps {
  month: string;
  spent: number;
  amount: number;
  compact?: boolean;
}

function percent(spent: number, amount: number) {
  return amount > 0 ? (spent / amount) * 100 : 0;
}

function BudgetProgress({ month, spent, amount, compact }: BudgetProgressProps) {
  const usage = percent(spent, amount);
  const overBudget = amount > 0 && spent > amount;
  const color = overBudget ? "#dc2626" : usage >= 80 ? "#f59e0b" : "#22c55e";
  const value = Math.min(100, usage);
  const usageText = usage.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

  return (
    <Progress.Root
      size={compact ? 6 : 10}
      miw={compact ? 90 : undefined}
      radius="xl"
      transitionDuration={300}
      role="progressbar"
      aria-label={`${month} 预算使用率`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${usageText}%${overBudget ? "，已超支" : ""}`}
    >
      <Progress.Section value={value} color={color} withAria={false} />
    </Progress.Root>
  );
}

export default function Budget() {
  const [month, setMonth] = useState(currentMonth);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const { start, clear } = useTimeout(() => setConfirmId(""), 3000);

  const rows = useLiveQuery(() => budgets.list());
  const spendMap = useLiveQuery(async () => {
    const bills = await transactions.list({ type: "expense" });
    const map: Record<string, number> = {};
    for (const bill of bills) {
      const billMonth = monthOf(bill.date);
      map[billMonth] = (map[billMonth] ?? 0) + bill.amount;
    }
    return map;
  });

  if (rows === undefined || spendMap === undefined) {
    return (
      <PageContainer>
        <Loader role="status" aria-label="正在加载预算" />
      </PageContainer>
    );
  }

  const editing = rows.find(row => row.month === month);
  const spent = spendMap[month] ?? 0;
  const remaining = (editing?.amount ?? 0) - spent;

  // 切换月份时预填已有预算
  const switchMonth = (next: string) => {
    if (next === "") return;
    setMonth(next);
    setError("");
    const found = rows.find(row => row.month === next);
    setDraft(found ? currency(found.amount, { fromCents: true }).toString() : "");
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    const yuan = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(yuan) || yuan <= 0) {
      setError("请输入大于 0 的金额");
      return;
    }
    await budgets.set({ month, amount: Math.round(yuan * 100) });
    setDraft("");
    setError("");
  }

  async function removeOne(target: string) {
    clear();
    if (confirmId !== target) {
      setConfirmId(target);
      start();
      return;
    }
    setConfirmId("");
    await budgets.remove(target);
    if (target === month) {
      setDraft("");
      setError("");
    }
  }

  return (
    <PageContainer className="budget-page">
      <section className="budget-card">
        <h2 className="budget-card__title">{`${month} 概览`}</h2>
        {editing === undefined
          ? (
              <p className="budget-empty">
                这个月还没设预算，在下方设置后即可跟踪。
              </p>
            )
          : (
              <>
                <div className="budget-overview">
                  <div>
                    预算
                    {" "}
                    <strong>{formatAmount(editing.amount)}</strong>
                  </div>
                  <div>
                    已花
                    {" "}
                    <strong>{formatAmount(spent)}</strong>
                  </div>
                  <div className={remaining < 0 ? "budget-negative" : undefined}>
                    剩余
                    {" "}
                    <strong>{formatAmount(remaining)}</strong>
                  </div>
                </div>
                <BudgetProgress month={month} spent={spent} amount={editing.amount} />
                <p className="budget-bar__text">
                  {editing.amount > 0 && spent > editing.amount
                    ? "本月预算已超支！"
                    : `已使用 ${Math.round(percent(spent, editing.amount))}%`}
                </p>
              </>
            )}
      </section>

      <section className="budget-card">
        <h2 className="budget-card__title">设置预算</h2>
        <form className="budget-form" onSubmit={save}>
          <label>
            月份
            <input
              type="month"
              value={month}
              onChange={event => switchMonth(event.target.value)}
            />
          </label>
          <label>
            预算（元）
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="如 3000"
              value={draft}
              onChange={event => setDraft(event.target.value)}
            />
          </label>
          <button type="submit" className="budget-button">
            {editing === undefined ? "新建" : "更新"}
          </button>
        </form>
        {error !== "" && <p className="budget-error">{error}</p>}
      </section>

      <section className="budget-card">
        <h2 className="budget-card__title">历史预算</h2>
        {rows.length === 0
          ? (
              <p className="budget-empty">还没有任何预算记录。</p>
            )
          : (
              <Table.ScrollContainer minWidth={600}>
                <table className="budget-table">
                  <thead>
                    <tr>
                      <th>月份</th>
                      <th>预算</th>
                      <th>已花</th>
                      <th>进度</th>
                      <th>剩余</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rowSpent = spendMap[row.month] ?? 0;
                      const rowLeft = row.amount - rowSpent;
                      return (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{formatAmount(row.amount)}</td>
                          <td>{formatAmount(rowSpent)}</td>
                          <td>
                            <BudgetProgress month={row.month} spent={rowSpent} amount={row.amount} compact />
                          </td>
                          <td className={rowLeft < 0 ? "budget-negative" : undefined}>
                            <strong>{formatAmount(rowLeft)}</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={
                                confirmId === row.month
                                  ? "budget-button budget-button--danger"
                                  : "budget-button budget-button--ghost"
                              }
                              onClick={() => removeOne(row.month)}
                            >
                              {confirmId === row.month ? "确认删除？" : "删除"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Table.ScrollContainer>
            )}
      </section>
    </PageContainer>
  );
}
