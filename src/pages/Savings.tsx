import type { ReactNode } from "react";
import {
  Card,
  Center,
  Container,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconPigMoney } from "@tabler/icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { savingsGoals } from "../shared/db";
import type { SavingsGoal } from "../shared/types";
import { formatAmount } from "../utils/format";

interface GoalCardProps {
  goal: SavingsGoal;
}

// 目标金额在数据层可能为 0（如恢复外部备份），兜底避免算出 NaN 破坏进度条。
function getPercent(goal: SavingsGoal) {
  return goal.targetAmount > 0
    ? Math.round((goal.savedAmount / goal.targetAmount) * 100)
    : 0;
}

function GoalCard({ goal }: GoalCardProps) {
  const percent = getPercent(goal);
  const amounts = `已存 ${formatAmount(goal.savedAmount)} / 目标 ${formatAmount(goal.targetAmount)}`;

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Title order={4}>{goal.name}</Title>
          <IconPigMoney size={20} stroke={1.6} />
        </Group>
        <Text size="sm" c="dimmed">{amounts}</Text>
        <Progress
          value={Math.min(percent, 100)}
          size="lg"
          radius="xl"
          transitionDuration={200}
          color={percent >= 100 ? "teal" : "indigo"}
        />
        <Text size="sm" fw={500}>{`${percent}%`}</Text>
      </Stack>
    </Card>
  );
}

export default function Savings() {
  const goals = useLiveQuery(() => savingsGoals.list(), []);

  let content: ReactNode;
  if (goals === undefined) {
    content = (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  else if (goals.length === 0) {
    content = (
      <Card withBorder radius="md" padding="xl">
        <Text c="dimmed" ta="center">还没有储蓄目标，先新建一个吧</Text>
      </Card>
    );
  }
  else {
    content = (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {goals.map(goal => <GoalCard key={goal.id} goal={goal} />)}
      </SimpleGrid>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>储蓄目标</Title>
      </Group>
      {content}
    </Container>
  );
}
