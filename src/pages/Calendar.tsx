import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Center,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  type MantineColor,
} from "@mantine/core";
import PageContainer from "../components/PageContainer";
import { DatePicker } from "@mantine/dates";
import { useLiveQuery } from "dexie-react-hooks";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { transactions } from "../shared/db";
import type { TransactionType } from "../shared/types";
import { formatAmount, parseDate } from "../utils/format";

// 写成函数而不是模块级常量：页面重新挂载时才能拿到当天日期，避免跨天后仍显示旧日期。
function today() {
  return format(new Date(), "yyyy-MM-dd");
}

// 日历数字用圆体：优先 Windows 自带幼圆，macOS 用圆体-简，缺失时退回 Comic Sans。
const DAY_FONT = {
  fontFamily: "'YouYuan', '幼圆', 'Yuanti SC', 'Comic Sans MS', sans-serif",
  fontWeight: 600,
};

// 分类 emoji 只影响展示，分类名称仍以 shared/constants.ts 为准。
const CATEGORY_EMOJI: Record<string, string> = {
  饮食: "🍜",
  交通: "🚌",
  购物: "🛍️",
  娱乐: "🎮",
  医疗: "💊",
  居住: "🏠",
  工资: "💼",
  奖金: "🎁",
  理财: "📈",
};

// CSV 导入可能带来自定义分类，按收支方向兜底，避免出现空白图标。
// 用 hasOwn 判定自有属性：分类名可能是 __proto__ 之类的继承属性，直接索引会取到原型对象导致渲染崩溃。
function categoryEmoji(category: string, type: TransactionType) {
  return Object.hasOwn(CATEGORY_EMOJI, category)
    ? CATEGORY_EMOJI[category]
    : (type === "income" ? "💰" : "🧾");
}

interface DailyStat {
  income: number;
  expense: number;
}

interface StatCardProps {
  label: string;
  amount: number;
  color: MantineColor;
}

// 日期区间统一由 "YYYY-MM-DD" 字符串计算，避免页面里再拼日期字符串。
function monthRange(date: string): [string, string] {
  const value = parseDate(date);
  return [format(startOfMonth(value), "yyyy-MM-dd"), format(endOfMonth(value), "yyyy-MM-dd")];
}

function dayOfMonth(date: string) {
  return Number(date.slice(8, 10));
}

function summarize(bills: { type: "income" | "expense"; amount: number }[]) {
  return bills.reduce(
    (total, bill) => {
      if (bill.type === "income") total.income += bill.amount;
      else total.expense += bill.amount;
      return total;
    },
    { income: 0, expense: 0 },
  );
}

function StatBlock({ label, amount, color }: StatCardProps) {
  return (
    <Box>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="lg" fw={600} c={color}>{formatAmount(amount)}</Text>
    </Box>
  );
}

function StatCard({ label, amount, color }: StatCardProps) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={600} c={color}>{formatAmount(amount)}</Text>
    </Paper>
  );
}

export default function Calendar() {
  // useState 传函数会走惰性初始化，只在挂载时取一次当天日期。
  const [visibleMonth, setVisibleMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);

  const [startDate, endDate] = useMemo(() => monthRange(visibleMonth), [visibleMonth]);

  // 当月账单只用于日历上的收支标记和月度合计，明细单独查选中日期。
  const monthBills = useLiveQuery(
    () => transactions.list({ startDate, endDate }),
    [startDate, endDate],
  );

  const dayBills = useLiveQuery(
    () => transactions.list({ startDate: selectedDate, endDate: selectedDate }),
    [selectedDate],
  );

  const dailyStats = useMemo(() => {
    const stats = new Map<string, DailyStat>();
    for (const bill of monthBills ?? []) {
      const stat = stats.get(bill.date) ?? { income: 0, expense: 0 };
      if (bill.type === "income") stat.income += bill.amount;
      else stat.expense += bill.amount;
      stats.set(bill.date, stat);
    }
    return stats;
  }, [monthBills]);

  const monthSummary = useMemo(() => summarize(monthBills ?? []), [monthBills]);
  const daySummary = useMemo(() => summarize(dayBills ?? []), [dayBills]);

  return (
    <PageContainer>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Box>
            <Title order={2}>账单日历</Title>
            <Text size="sm" c="dimmed">按月查看每日收支，点击日期查看当天明细</Text>
          </Box>
          <Group gap={28}>
            <StatBlock label="本月收入 💰" amount={monthSummary.income} color="teal" />
            <StatBlock label="本月支出 💸" amount={monthSummary.expense} color="red" />
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Paper withBorder p="md" radius="md">
            <DatePicker
              value={selectedDate}
              onChange={value => value && setSelectedDate(value)}
              date={visibleMonth}
              onDateChange={setVisibleMonth}
              size="lg"
              fullWidth
              highlightToday
              // 选中态默认是深蓝底白字，颜文字颜色几乎看不见，这里换成浅蓝底深蓝字。
              getDayProps={date => (date === selectedDate
                ? {
                    style: {
                      backgroundColor: "var(--mantine-color-blue-1)",
                      color: "var(--mantine-color-blue-8)",
                    },
                  }
                : {})}
              renderDay={(date) => {
                const stat = dailyStats.get(date);
                // 颜文字看当日结余（收入 - 支出）的正负，而不是有没有收支。
                const net = stat ? stat.income - stat.expense : 0;
                const positive = net >= 0;
                return (
                  <Stack gap={2} align="center" justify="center" h="100%">
                    <Text fz={18} lh={1.2} style={DAY_FONT}>{dayOfMonth(date)}</Text>
                    <Group gap={4} h={12} justify="center" wrap="nowrap">
                      {stat
                        ? <Text fz={9} c={positive ? "teal" : "red"} lh={1.2}>{positive ? "(^▽^)" : "(T_T)"}</Text>
                        : null}
                    </Group>
                  </Stack>
                );
              }}
            />
          </Paper>

          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>{format(parseDate(selectedDate), "yyyy年M月d日")}</Title>
              <Badge variant="light">{`${dayBills?.length ?? 0} 笔`}</Badge>
            </Group>

            <SimpleGrid cols={3} spacing="sm">
              <StatCard label="当日收入 💰" amount={daySummary.income} color="teal" />
              <StatCard label="当日支出 💸" amount={daySummary.expense} color="red" />
              <StatCard label="当日结余 🪙" amount={daySummary.income - daySummary.expense} color="indigo" />
            </SimpleGrid>

            {dayBills?.length
              ? (
                  <Stack gap="xs">
                    {dayBills.map(bill => (
                      <Paper key={bill.id} withBorder p="sm" radius="md">
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap">
                            <ThemeIcon
                              variant="light"
                              radius="md"
                              color={bill.type === "income" ? "teal" : "red"}
                            >
                              {categoryEmoji(bill.category, bill.type)}
                            </ThemeIcon>
                            <Box>
                              <Text fw={500}>{bill.category}</Text>
                              <Text size="xs" c="dimmed">{bill.note || "无备注"}</Text>
                            </Box>
                          </Group>
                          <Text fw={600} c={bill.type === "income" ? "teal" : "red"}>
                            {bill.type === "income" ? "+" : "-"}
                            {formatAmount(bill.amount)}
                          </Text>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )
              : (
                  <Center p="xl">
                    <Text c="dimmed">这一天没有账单记录</Text>
                  </Center>
                )}
          </Stack>
        </SimpleGrid>
      </Stack>
    </PageContainer>
  );
}
