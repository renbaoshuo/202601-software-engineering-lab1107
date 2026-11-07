import { useState } from "react";
import { ActionIcon, Alert, Badge, Button, Checkbox, Group, Modal, Stack, Table, Text } from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { transactions } from "../shared/db";
import type { Transaction } from "../shared/types";
import { formatAmount } from "../utils/format";

interface TransactionTableProps {
  records: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDeleted: (count: number) => void;
}

interface DeleteTarget {
  ids: string[];
  title: string;
  description: string;
}

export default function TransactionTable({ records, onEdit, onDeleted }: TransactionTableProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const allSelected = selected.size === records.length;

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeDelete() {
    setTarget(null);
    setDeleteError(false);
  }

  async function confirmDelete() {
    if (!target || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await transactions.removeMany(target.ids);
      setSelected(new Set());
      closeDelete();
      onDeleted(target.ids.length);
    }
    catch {
      setDeleteError(true);
    }
    finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {selected.size > 0 && (
        <Group justify="space-between" p="sm">
          <Text size="sm" c="dimmed">{`已选中当前页 ${selected.size} 笔账单`}</Text>
          <Button
            color="red"
            variant="light"
            size="xs"
            leftSection={<IconTrash size={16} />}
            onClick={() => setTarget({
              ids: [...selected],
              title: "批量删除",
              description: `选中的 ${selected.size} 笔账单`,
            })}
          >
            批量删除
          </Button>
        </Group>
      )}
      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={44}>
                <Checkbox
                  aria-label="全选当前页"
                  checked={allSelected}
                  indeterminate={!allSelected && selected.size > 0}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(records.map(record => record.id)))}
                />
              </Table.Th>
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
                <Table.Td>
                  <Checkbox
                    aria-label={`选择 ${record.date} ${record.category} 账单`}
                    checked={selected.has(record.id)}
                    onChange={() => toggleRow(record.id)}
                  />
                </Table.Td>
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
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      aria-label={`编辑 ${record.date} ${record.category} 账单`}
                      onClick={() => onEdit(record)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`删除 ${record.date} ${record.category} 账单`}
                      onClick={() => setTarget({
                        ids: [record.id],
                        title: "删除账单",
                        description: ` ${record.date} 的这笔${record.category}账单`,
                      })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Modal
        opened={target !== null}
        onClose={closeDelete}
        title={target?.title}
        centered
        size="sm"
        closeOnEscape={!deleting}
        closeOnClickOutside={!deleting}
        withCloseButton={!deleting}
      >
        <Stack>
          <Text size="sm">{`确定删除${target?.description ?? ""}吗？删除后无法恢复。`}</Text>
          {deleteError && <Alert color="red">删除失败，请重试</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete} disabled={deleting}>取消</Button>
            <Button color="red" onClick={confirmDelete} loading={deleting}>删除</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
