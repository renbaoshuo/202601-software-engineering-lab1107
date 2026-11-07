import { ActionIcon, Badge, Table, Text } from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import type { Transaction } from "../shared/types";
import { formatAmount } from "../utils/format";

interface TransactionTableProps {
  records: Transaction[];
  onEdit: (transaction: Transaction) => void;
}

export default function TransactionTable({ records, onEdit }: TransactionTableProps) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>日期</Table.Th>
            <Table.Th>收支类型</Table.Th>
            <Table.Th>类别</Table.Th>
            <Table.Th>备注</Table.Th>
            <Table.Th ta="right">金额</Table.Th>
            <Table.Th>操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {records.map(record => (
            <Table.Tr key={record.id}>
              <Table.Td>{record.date}</Table.Td>
              <Table.Td>
                <Badge color={record.type === "income" ? "green" : "red"} variant="light">
                  {record.type === "income" ? "收入" : "支出"}
                </Badge>
              </Table.Td>
              <Table.Td>{record.category}</Table.Td>
              <Table.Td>{record.note || "—"}</Table.Td>
              <Table.Td ta="right">
                <Text fw={600} c={record.type === "income" ? "green" : "red"}>
                  {`${record.type === "income" ? "+" : "-"}${formatAmount(record.amount)}`}
                </Text>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="subtle"
                  aria-label={`编辑 ${record.date} ${record.category} 账单`}
                  onClick={() => onEdit(record)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
