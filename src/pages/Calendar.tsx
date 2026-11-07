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
import { DatePicker } from "@mantine/dates";
import { IconArrowDownLeft, IconArrowUpRight } from "@tabler/icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { transactions } from "../shared/db";
import { formatAmount, parseDate } from "../utils/format";

const today = format(new Date(), "yyyy-MM-dd");

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
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Box>
          <Title order={2}>账单日历</Title>
          <Text size="sm" c="dimmed">按月查看每日收支，点击日期查看当天明细</Text>
        </Box>
        <Group gap={28}>
          <StatBlock label="本月收入" amount={monthSummary.income} color="teal" />
          <StatBlock label="本月支出" amount={monthSummary.expense} color="red" />
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
            renderDay={(date) => {
              const stat = dailyStats.get(date);
              return (
                <Stack gap={2} align="center" justify="center" h="100%">
                  <Text size="sm">{dayOfMonth(date)}</Text>
                  <Group gap={3} h={6}>
                    {stat?.income ? <Box w={5} h={5} bg="teal" style={{ borderRadius: 3 }} /> : null}
                    {stat?.expense ? <Box w={5} h={5} bg="red" style={{ borderRadius: 3 }} /> : null}
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
            <StatCard label="当日收入" amount={daySummary.income} color="teal" />
            <StatCard label="当日支出" amount={daySummary.expense} color="red" />
            <StatCard label="当日结余" amount={daySummary.income - daySummary.expense} color="indigo" />
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
                            {bill.type === "income"
                              ? <IconArrowDownLeft size={16} />
                              : <IconArrowUpRight size={16} />}
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
  );
}
