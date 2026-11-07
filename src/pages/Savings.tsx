import { useState, type ReactNode } from "react";
import {
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  NumberInput,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import PageContainer from "../components/PageContainer";
import { IconPigMoney, IconPlus } from "@tabler/icons-react";
import currency from "currency.js";
import { useLiveQuery } from "dexie-react-hooks";
import { savingsGoals } from "../shared/db";
import type { SavingsGoal } from "../shared/types";
import { formatAmount } from "../utils/format";

interface GoalCardProps {
  goal: SavingsGoal;
  onDeposit: () => void;
}

// 输入框以元为单位，入库前统一转成整数分。
function toCents(yuan: number) {
  return currency(yuan).intValue;
}

// 目标金额在数据层可能为 0（如恢复外部备份），兜底避免算出 NaN 破坏进度条。
// 先乘 100 再除并向下取整：先除后乘会有浮点误差（29/100*100 得 28.99…），
// 且四舍五入会让 99.5% 提前显示 100%，误判为已完成。
function getPercent(goal: SavingsGoal) {
  return goal.targetAmount > 0
    ? Math.floor((goal.savedAmount * 100) / goal.targetAmount)
    : 0;
}

function GoalCard({ goal, onDeposit }: GoalCardProps) {
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
        <Button variant="light" fullWidth onClick={onDeposit}>存入</Button>
      </Stack>
    </Card>
  );
}

export default function Savings() {
  const goals = useLiveQuery(() => savingsGoals.list(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<string | number>("");
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositAmount, setDepositAmount] = useState<string | number>("");
  const [creating, setCreating] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const canCreate = name.trim().length > 0 && typeof target === "number" && target > 0;
  const canDeposit = depositGoal !== null
    && typeof depositAmount === "number"
    && depositAmount > 0;

  function closeCreate() {
    setCreateOpen(false);
    setName("");
    setTarget("");
  }

  async function handleCreate() {
    if (creating || typeof target !== "number" || !name.trim() || target <= 0) return;
    // 写入期间锁住按钮，避免连点重复创建目标。
    setCreating(true);
    try {
      await savingsGoals.add({ name: name.trim(), targetAmount: toCents(target) });
      closeCreate();
    }
    finally {
      setCreating(false);
    }
  }

  function closeDeposit() {
    setDepositGoal(null);
    setDepositAmount("");
  }

  async function handleDeposit() {
    if (depositing || !depositGoal || typeof depositAmount !== "number" || depositAmount <= 0) return;
    // 存入是累加操作，写入期间重复提交会把同一笔钱记多次。
    setDepositing(true);
    try {
      await savingsGoals.deposit(depositGoal.id, toCents(depositAmount));
      closeDeposit();
    }
    finally {
      setDepositing(false);
    }
  }

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
        {goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} onDeposit={() => setDepositGoal(goal)} />
        ))}
      </SimpleGrid>
    );
  }

  return (
    <PageContainer>
      <Group justify="space-between" mb="lg">
        <Title order={2}>储蓄目标</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>
          新建目标
        </Button>
      </Group>
      {content}
      <Modal opened={createOpen} onClose={closeCreate} title="新建储蓄目标" centered>
        <Stack gap="md">
          <TextInput
            label="目标名称"
            placeholder="例如：旅行基金"
            value={name}
            onChange={event => setName(event.currentTarget.value)}
            data-autofocus
          />
          <NumberInput
            label="目标金额（元）"
            placeholder="0.00"
            min={0.01}
            decimalScale={2}
            fixedDecimalScale
            leftSection="¥"
            value={target}
            onChange={setTarget}
          />
          <Button disabled={!canCreate || creating} loading={creating} onClick={handleCreate}>创建</Button>
        </Stack>
      </Modal>
      <Modal
        opened={depositGoal !== null}
        onClose={closeDeposit}
        title={`存入 · ${depositGoal?.name ?? ""}`}
        centered
      >
        <Stack gap="md">
          <NumberInput
            label="存入金额（元）"
            placeholder="0.00"
            min={0.01}
            decimalScale={2}
            fixedDecimalScale
            leftSection="¥"
            value={depositAmount}
            onChange={setDepositAmount}
            data-autofocus
          />
          <Button disabled={!canDeposit || depositing} loading={depositing} onClick={handleDeposit}>确认存入</Button>
        </Stack>
      </Modal>
    </PageContainer>
  );
}
