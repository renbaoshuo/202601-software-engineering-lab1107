import { Loader } from "@mantine/core";
import { useTimeout } from "@mantine/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { useState, type FormEvent } from "react";
import { budgets, transactions } from "../shared/db";
import "./Budget.css";

// 金额在库里统一存整数分（见 src/shared/types.ts 注释），页面输入与展示均用元
const fenToYuan = (fen: number) => (fen / 100).toFixed(2);

const monthOf = (date: string) => date.slice(0, 7);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// 进度条颜色：低于 80% 为绿色，80% 到 100% 为黄色，超支为红色
function barColor(spent: number, amount: number) {
  if (amount > 0 && spent > amount) return "budget-bar__fill--over";
  if (amount > 0 && spent >= amount * 0.8) return "budget-bar__fill--warn";
  return "";
}

// 安全的百分比，避免 amount 为 0 时除零产生 NaN
function percent(spent: number, amount: number) {
  if (amount <= 0) return 0;
  return Math.min(100, (spent / amount) * 100);
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
    return <Loader role="status" aria-label="正在加载预算" />;
  }

  const editing = rows.find(row => row.month === month);
  const spent = spendMap[month] ?? 0;
  const remaining = (editing?.amount ?? 0) - spent;

  // 切换月份时预填已有预算
  function switchMonth(next: string) {
    if (next === "") return;
    setMonth(next);
    setError("");
    const found = rows.find(row => row.month === next);
    setDraft(found ? fenToYuan(found.amount) : "");
  }

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
    <div className="budget-page">
      <section className="budget-card">
        <h2 className="budget-card__title">{month} 概览</h2>
        {editing === undefined ? (
          <p className="budget-empty">
            这个月还没设预算，在下方设置后即可跟踪。
          </p>
        ) : (
          <>
            <div className="budget-overview">
              <div>
                预算 <strong>¥{fenToYuan(editing.amount)}</strong>
              </div>
              <div>
                已花 <strong>¥{fenToYuan(spent)}</strong>
              </div>
              <div className={remaining < 0 ? "budget-negative" : undefined}>
                剩余 <strong>¥{fenToYuan(remaining)}</strong>
              </div>
            </div>
            <div className="budget-bar">
              <span
                className={`budget-bar__fill ${barColor(spent, editing.amount)}`}
                style={{ width: `${percent(spent, editing.amount)}%` }}
              />
            </div>
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
              onChange={(event) => switchMonth(event.target.value)}
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
              onChange={(event) => setDraft(event.target.value)}
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
        {rows.length === 0 ? (
          <p className="budget-empty">还没有任何预算记录。</p>
        ) : (
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
                    <td>¥{fenToYuan(row.amount)}</td>
                    <td>¥{fenToYuan(rowSpent)}</td>
                    <td>
                      <div className="budget-bar budget-bar--small">
                        <span
                          className={`budget-bar__fill ${barColor(rowSpent, row.amount)}`}
                          style={{ width: `${percent(rowSpent, row.amount)}%` }}
                        />
                      </div>
                    </td>
                    <td className={rowLeft < 0 ? "budget-negative" : undefined}>
                      <strong>¥{fenToYuan(rowLeft)}</strong>
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
        )}
      </section>
    </div>
  );
}
