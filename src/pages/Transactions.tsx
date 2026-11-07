import { useState } from "react";
import { Alert, Badge, Container, Group, Loader, Pagination, Stack, Table, Text, Title } from "@mantine/core";
import TransactionQuery from "../components/TransactionQuery";
import useTransactionQuery from "../hooks/useTransactionQuery";
import type { TransactionFilter } from "../shared/types";
import { formatAmount } from "../utils/format";

export default function Transactions() {
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [page, setPage] = useState(1);
  const result = useTransactionQuery(filter, page);

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>账单</Title>
          <Text c="dimmed" mt="xs">按日期、类别、金额和关键词查询收支记录。</Text>
        </div>
        <TransactionQuery
          categories={result?.categories ?? []}
          onSearch={(nextFilter) => {
            setFilter(nextFilter);
            setPage(1);
          }}
        />
        {!result
          ? (
              <Group role="status">
                <Loader size="sm" />
                <Text>正在加载账单…</Text>
              </Group>
            )
          : result.error
            ? <Alert color="red" title="读取失败" role="alert">{result.error}</Alert>
            : (
                <>
                  <Text role="status" aria-live="polite" size="sm">
                    {`匹配 ${result.count} 条，共 ${result.total} 条账单`}
                  </Text>
                  {result.count === 0
                    ? <Text c="dimmed" ta="center" py="xl">暂无符合条件的账单</Text>
                    : (
                        <Table.ScrollContainer minWidth={620}>
                          <Table striped highlightOnHover withTableBorder>
                            <Table.Caption>按日期从新到旧排列</Table.Caption>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>日期</Table.Th>
                                <Table.Th>收支类型</Table.Th>
                                <Table.Th>金额</Table.Th>
                                <Table.Th>类别</Table.Th>
                                <Table.Th>备注</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {result.records.map(transaction => (
                                <Table.Tr key={transaction.id}>
                                  <Table.Td>{transaction.date}</Table.Td>
                                  <Table.Td>
                                    <Badge color={transaction.type === "income" ? "teal" : "orange"} variant="light">
                                      {transaction.type === "income" ? "收入" : "支出"}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td>{formatAmount(transaction.amount)}</Table.Td>
                                  <Table.Td>{transaction.category}</Table.Td>
                                  <Table.Td>{transaction.note || "—"}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Table.ScrollContainer>
                      )}
                  {result.pages > 1 && (
                    <Group justify="center">
                      <Pagination total={result.pages} value={result.page} onChange={setPage} />
                    </Group>
                  )}
                </>
              )}
      </Stack>
    </Container>
  );
}
