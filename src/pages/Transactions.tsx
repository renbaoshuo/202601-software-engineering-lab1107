import { Container, Stack, Text, Title } from "@mantine/core";
import TransactionForm from "../components/TransactionForm";

export default function Transactions() {
  return (
    <Container size="md">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2}>收支记录</Title>
          <Text size="sm" c="dimmed">随手记下一笔，日期、金额、类别一次填好。</Text>
        </Stack>
        <TransactionForm />
      </Stack>
    </Container>
  );
}
