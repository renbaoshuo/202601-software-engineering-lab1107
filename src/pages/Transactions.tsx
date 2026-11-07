import { useEffect, useState } from "react";
import { Affix, Button, Card, Container, Group, Notification, Stack, Table, Text, Title } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useSearchParams } from "react-router";
import TransactionForm from "../components/TransactionForm";
import { transactions } from "../shared/db";
import type { NewTransaction } from "../shared/types";
import { formatAmount } from "../utils/format";

function RecentTransactions() {
  const records = useLiveQuery(() => transactions.list({ limit: 10 }));

  if (records === undefined) return <Text c="dimmed">正在加载账单…</Text>;
  if (records.length === 0) return <Text c="dimmed">暂无账单记录</Text>;

  return (
    <Card withBorder radius="md">
      <Table.ScrollContainer minWidth={420}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>日期</Table.Th>
              <Table.Th>类别</Table.Th>
              <Table.Th>备注</Table.Th>
              <Table.Th ta="right">金额</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map(record => (
              <Table.Tr key={record.id}>
                <Table.Td>{record.date}</Table.Td>
                <Table.Td>{record.category}</Table.Td>
                <Table.Td>{record.note || "—"}</Table.Td>
                <Table.Td ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatAmount(record.type === "expense" ? -record.amount : record.amount)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [saved, setSaved] = useState<NewTransaction | null>(null);
  const showList = searchParams.get("view") === "list";

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 3500);
    return () => clearTimeout(timer);
  }, [saved]);

  function handleSaved(transaction: NewTransaction, continueAdding: boolean) {
    setSaved(transaction);
    if (!continueAdding) setSearchParams({ view: "list" }, { replace: true });
  }

  return (
    <Container size="md">
      <Stack gap="lg">
        {showList
          ? (
              <>
                <Group justify="space-between">
                  <Title order={2}>最近账单</Title>
                  <Button component={Link} to="/transactions" replace>记一笔</Button>
                </Group>
                <RecentTransactions />
              </>
            )
          : (
              <>
                <Stack gap={4}>
                  <Title order={2}>收支记录</Title>
                  <Text size="sm" c="dimmed">随手记下一笔，日期、金额、类别一次填好。</Text>
                </Stack>
                <TransactionForm onSaved={handleSaved} />
              </>
            )}
      </Stack>
      {saved && (
        <Affix position={{ top: 16, right: 16 }} zIndex={400}>
          <Notification
            color="green"
            icon={<IconCheck size={18} />}
            title="保存成功"
            closeButtonProps={{ "aria-label": "关闭保存提示" }}
            onClose={() => setSaved(null)}
          >
            {`已记下这笔${saved.type === "expense" ? "支出" : "收入"} ${formatAmount(saved.amount)}`}
          </Notification>
        </Affix>
      )}
    </Container>
  );
}
