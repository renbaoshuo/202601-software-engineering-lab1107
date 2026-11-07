import { useEffect, useState } from "react";
import {
  Affix,
  Alert,
  Button,
  Card,
  Group,
  Modal,
  Notification,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import PageContainer from "../components/PageContainer";
import {
  IconArrowsSort,
  IconCheck,
  IconClock,
  IconPlus,
} from "@tabler/icons-react";
import TransactionForm from "../components/TransactionForm";
import TransactionQuery from "../components/TransactionQuery";
import TransactionTable from "../components/TransactionTable";
import useTransactionQuery from "../hooks/useTransactionQuery";
import { transactions } from "../shared/db";
import type { NewTransaction, Transaction, TransactionFilter, TransactionQuery as Query } from "../shared/types";
import { formatAmount } from "../utils/format";

const PAGE_SIZE = 8;

// 演示用示例数据，金额单位为「分」（与 types.ts 约定一致）
const DEMO_TRANSACTIONS: NewTransaction[] = [
  { type: "expense", amount: 3250, category: "饮食", date: "2026-11-07", note: "午饭" },
  { type: "income", amount: 800000, category: "工资", date: "2026-11-05", note: "11月工资" },
  { type: "expense", amount: 1500, category: "交通", date: "2026-11-07", note: "地铁" },
  { type: "expense", amount: 19900, category: "购物", date: "2026-11-06", note: "买书" },
  { type: "expense", amount: 8800, category: "娱乐", date: "2026-11-04", note: "电影" },
  { type: "expense", amount: 4500, category: "饮食", date: "2026-11-03", note: "晚饭" },
  { type: "income", amount: 50000, category: "其他", date: "2026-11-02", note: "兼职" },
  { type: "expense", amount: 20000, category: "购物", date: "2026-11-01", note: "日用品" },
  { type: "expense", amount: 6000, category: "交通", date: "2026-10-30", note: "打车" },
  { type: "expense", amount: 2500, category: "饮食", date: "2026-10-29", note: "早餐" },
];

type SortField = NonNullable<Query["sortBy"]>;
type SortOrder = NonNullable<Query["order"]>;

export default function Transactions() {
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [showRecent, setShowRecent] = useState(false);

  const [form, setForm] = useState<{ transaction?: Transaction } | null>(null);
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  const result = useTransactionQuery(filter, {
    page: showRecent ? 1 : page,
    pageSize: showRecent ? 5 : PAGE_SIZE,
    sortBy: showRecent ? "date" : sortField,
    order: showRecent ? "desc" : sortOrder,
  });

  // 列表内容变化后重新选择，避免批量删除包含不可见的账单。
  const visibleRowsKey = result?.records.map(record => record.id).join(",");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  function handleSaved(transaction: NewTransaction, continueAdding: boolean) {
    const message = form?.transaction
      ? "账单已保存"
      : `已记录${transaction.type === "income" ? "收入" : "支出"} ${formatAmount(transaction.amount)}`;
    setNotice({ message });
    if (!continueAdding) setForm(null);
  }

  function handleSortFieldChange(value: string | null) {
    if (value) {
      setSortField(value as SortField);
      setPage(1);
    }
  }

  function toggleSortOrder() {
    setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  // 写入示例数据到 IndexedDB，方便演示
  async function loadDemoData() {
    await transactions.addMany(DEMO_TRANSACTIONS);
    setPage(1);
  }

  return (
    <PageContainer>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2}>账单</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setForm({})}>记一笔</Button>
        </Group>

        <TransactionQuery
          categories={result?.categories ?? []}
          onSearch={(nextFilter) => {
            setFilter(nextFilter);
            setPage(1);
          }}
        />

        <Group justify="space-between">
          <SegmentedControl
            value={showRecent ? "recent" : "all"}
            onChange={(v) => {
              setShowRecent(v === "recent");
              setPage(1);
            }}
            data={[
              { label: "全部账单", value: "all" },
              { label: "最近 5 条", value: "recent" },
            ]}
          />
          <Group gap="sm">
            <Text size="sm" c="dimmed">
              <IconClock size={16} style={{ verticalAlign: -3 }} />
              {" "}
              排序方式
            </Text>
            <Select
              w={140}
              size="sm"
              disabled={showRecent}
              value={sortField}
              onChange={handleSortFieldChange}
              data={[
                { label: "按日期", value: "date" },
                { label: "按金额", value: "amount" },
              ]}
            />
            <Button
              size="sm"
              variant="light"
              leftSection={<IconArrowsSort size={16} />}
              disabled={showRecent}
              onClick={toggleSortOrder}
            >
              {sortOrder === "asc" ? "升序" : "降序"}
            </Button>
          </Group>
        </Group>

        {result?.error
          ? <Alert color="red" title="读取失败">{result.error}</Alert>
          : (
              <Card withBorder padding={0}>
                {!result
                  ? <Text role="status" ta="center" c="dimmed" py="xl">正在加载账单…</Text>
                  : result.records.length === 0
                    ? (
                        <Stack align="center" py="xl" gap="sm">
                          <Text c="dimmed">{result.total === 0 ? "暂无账单记录" : "暂无符合条件的账单"}</Text>
                          {result.total === 0 && (
                            <Button size="sm" variant="light" onClick={loadDemoData}>加载示例数据</Button>
                          )}
                        </Stack>
                      )
                    : (
                        <TransactionTable
                          key={visibleRowsKey}
                          records={result.records}
                          onEdit={transaction => setForm({ transaction })}
                          onDeleted={count => setNotice({ message: `已删除 ${count} 笔账单` })}
                        />
                      )}
              </Card>
            )}

        {result && !result.error && (
          <Group justify="space-between">
            <Text role="status" size="sm" c="dimmed">
              {`匹配 ${result.count} 条，共 ${result.total} 条账单${showRecent ? "（展示最近 5 条）" : ""}`}
            </Text>
            {!showRecent && result.pages > 1 && (
              <Pagination total={result.pages} value={result.page} onChange={setPage} />
            )}
          </Group>
        )}
      </Stack>

      <Modal
        opened={form !== null}
        onClose={() => setForm(null)}
        title={form?.transaction ? "编辑账单" : "记一笔"}
        size="lg"
        centered
      >
        {form && (
          <TransactionForm
            transaction={form.transaction}
            onCancel={() => setForm(null)}
            onSaved={handleSaved}
          />
        )}
      </Modal>

      {notice && (
        <Affix position={{ bottom: 24, right: 24 }} zIndex={400}>
          <Notification
            color="green"
            icon={<IconCheck size={18} />}
            title="操作成功"
            closeButtonProps={{ "aria-label": "关闭提示" }}
            onClose={() => setNotice(null)}
          >
            {notice.message}
          </Notification>
        </Affix>
      )}
    </PageContainer>
  );
}
