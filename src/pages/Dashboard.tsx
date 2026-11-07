import {
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowDownLeft,
  IconArrowUpRight,
  IconWallet,
} from "@tabler/icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReactNode } from "react";
import { transactions } from "../shared/db";
import { formatAmount } from "../utils/format";

interface SummaryCardProps {
  title: string;
  amount: number;
  color: string;
  icon: ReactNode;
}

function SummaryCard({ title, amount, color, icon }: SummaryCardProps) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={8}>
          <Text c="dimmed" fw={500} size="sm">
            {title}
          </Text>
          <Text c={color} fw={700} size="xl">
            {formatAmount(amount)}
          </Text>
        </Stack>
        <ThemeIcon color={color} radius="md" size="xl" variant="light">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export default function Dashboard() {
  const records = useLiveQuery(() => transactions.list()) ?? [];

  const { totalIncome, totalExpense } = records.reduce(
    (summary, transaction) => {
      if (transaction.type === "income") {
        summary.totalIncome += transaction.amount;
      }
      else {
        summary.totalExpense += transaction.amount;
      }
      return summary;
    },
    { totalIncome: 0, totalExpense: 0 },
  );
  const balance = totalIncome - totalExpense;

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>收支总览</Title>
        <Text c="dimmed">查看全部账单的收入、支出和当前结余</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <SummaryCard
          amount={totalIncome}
          color="green"
          icon={<IconArrowDownLeft size={22} stroke={1.8} />}
          title="总收入"
        />
        <SummaryCard
          amount={totalExpense}
          color="red"
          icon={<IconArrowUpRight size={22} stroke={1.8} />}
          title="总支出"
        />
        <SummaryCard
          amount={balance}
          color="indigo"
          icon={<IconWallet size={22} stroke={1.8} />}
          title="当前结余"
        />
      </SimpleGrid>
    </Stack>
  );
}
