import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconArrowsSort,
  IconClock,
  IconList,
} from "@tabler/icons-react";
import { transactions } from "../shared/db";
import type { NewTransaction } from "../shared/types";

// 不依赖 dexie-react-hooks，直接用 Dexie 内置的 liveQuery 实现响应式查询
function useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[] = []) {
  const [value, setValue] = useState<T | undefined>();
  // deps 由调用方控制，querier 是闭包，无需加入依赖
  useEffect(() => {
    const subscription = liveQuery(querier).subscribe(setValue);
    return () => subscription.unsubscribe();
  }, deps);
  return value;
}

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

// 分 -> 元，收入带 +，支出带 -
function formatAmount(type: "income" | "expense", cents: number) {
  const sign = type === "income" ? "+" : "-";
  return `${sign}¥${(cents / 100).toFixed(2)}`;
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    饮食: "orange",
    交通: "blue",
    工资: "green",
    购物: "pink",
    娱乐: "violet",
    其他: "gray",
  };
  return map[category] ?? "gray";
}

type SortField = "date" | "amount";
type SortOrder = "asc" | "desc";

export default function Transactions() {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 列表数据：按排序字段和方向查询
  const pageData = useLiveQuery(
    () =>
      transactions.list({
        sortBy: sortField,
        order: sortOrder,
      }),
    [sortField, sortOrder],
  );

  // 总条数
  const total = useLiveQuery(() => transactions.count(), []);

  function handleSortFieldChange(value: string | null) {
    if (value) {
      setSortField(value as SortField);
    }
  }

  function toggleSortOrder() {
    setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
  }

  // 写入示例数据到 IndexedDB，方便演示
  async function loadDemoData() {
    await transactions.addMany(DEMO_TRANSACTIONS);
  }

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>账单流水</Title>

        {/* 排序控制区 */}
        <Card withBorder padding="sm">
          <Group gap="md">
            <Text size="sm" c="dimmed">
              <IconClock size={16} style={{ verticalAlign: -3 }} />
              {" "}
              排序方式
            </Text>
            <Select
              w={140}
              size="sm"
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
              onClick={toggleSortOrder}
            >
              {sortOrder === "asc" ? "升序" : "降序"}
            </Button>
          </Group>
        </Card>

        {/* 账单列表 */}
        <Card withBorder padding={0}>
          {pageData === undefined
            ? (
                <Text ta="center" c="dimmed" py="xl">
                  加载中…
                </Text>
              )
            : pageData.length === 0
              ? (
                  <Stack align="center" py="xl" gap="sm">
                    <Text c="dimmed">暂无账单记录</Text>
                    <Button size="sm" variant="light" onClick={loadDemoData}>
                      加载示例数据（测试用）
                    </Button>
                  </Stack>
                )
              : (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>日期</Table.Th>
                        <Table.Th>类别</Table.Th>
                        <Table.Th>备注</Table.Th>
                        <Table.Th ta="right">金额</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pageData.map(t => (
                        <Table.Tr key={t.id}>
                          <Table.Td>{t.date}</Table.Td>
                          <Table.Td>
                            <Badge color={categoryColor(t.category)} variant="light">
                              {t.category}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{t.note || "—"}</Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600} c={t.type === "income" ? "green" : "red"}>
                              {formatAmount(t.type, t.amount)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
        </Card>

        {/* 统计信息 */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            <IconList size={16} style={{ verticalAlign: -3 }} />
            {" "}
            共
            {" "}
            {total ?? 0}
            {" "}
            条记录
          </Text>
        </Group>
      </Stack>
    </Container>
  );
}
