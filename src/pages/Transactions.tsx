import { useEffect, useState } from "react";
import {
  ActionIcon,
  Affix,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Notification,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCheck, IconEdit, IconTrash, IconTrashX } from "@tabler/icons-react";
import currency from "currency.js";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import { transactions } from "../shared/db";
import type { Transaction, TransactionType } from "../shared/types";
import { formatAmount } from "../utils/format";

const TYPE_LABEL: Record<TransactionType, string> = {
  income: "收入",
  expense: "支出",
};

export default function Transactions() {
  const rows = useLiveQuery(() => transactions.list(), []);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // 编辑表单：金额以「元」为单位输入，保存时经 currency.js 换算回整数分。
  const [type, setType] = useState<TransactionType>("expense");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const loaded = rows ?? [];
  const allSelected = loaded.length > 0 && loaded.every(row => selected.has(row.id));
  const someSelected = loaded.some(row => selected.has(row.id));

  const categories = DEFAULT_CATEGORIES[type];
  // 导入的账单可能带外来分类，编辑时把它并入选项，避免 Select 显示不出当前值。
  const categoryOptions = category !== "" && !categories.includes(category)
    ? [category, ...categories]
    : categories;

  const formValid = date !== "" && category !== "" && typeof amount === "number" && amount > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(loaded.map(row => row.id)));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchType(next: TransactionType) {
    setType(next);
    // 类别选项随收支类型联动，旧类别不属于新类型时清空，避免存出不匹配的分类。
    if (category !== "" && !DEFAULT_CATEGORIES[next].includes(category)) setCategory("");
  }

  function openEdit(row: Transaction) {
    setEditing(row);
    setType(row.type);
    setDate(row.date);
    setAmount(currency(row.amount, { fromCents: true }).value);
    setCategory(row.category);
    setNote(row.note);
  }

  async function saveEdit() {
    if (!editing || typeof amount !== "number") return;
    await transactions.update(editing.id, {
      type,
      date,
      category,
      note,
      amount: currency(amount).intValue,
    });
    setEditing(null);
    setNotice("账单已保存");
  }

  async function confirmSingleDelete() {
    if (!deleting) return;
    await transactions.remove(deleting.id);
    const id = deleting.id;
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeleting(null);
    setNotice("账单已删除");
  }

  async function confirmBatchDelete() {
    const ids = loaded.filter(row => selected.has(row.id)).map(row => row.id);
    await transactions.removeMany(ids);
    setSelected(new Set());
    setBatchOpen(false);
    setNotice(`已删除 ${ids.length} 笔账单`);
  }

  return (
    <Stack gap="md">
      <Title order={2}>账单编辑</Title>

      <Group justify="space-between">
        <Group gap="md">
          <Checkbox
            label="全选"
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onChange={toggleAll}
          />
          {selected.size > 0 && (
            <Text size="sm" c="dimmed">
              已选
              {selected.size}
              {" "}
              项
            </Text>
          )}
        </Group>
        <Button
          color="red"
          variant="light"
          leftSection={<IconTrashX size={16} />}
          disabled={!someSelected}
          onClick={() => setBatchOpen(true)}
        >
          批量删除
        </Button>
      </Group>

      {rows === undefined
        ? <Text c="dimmed">加载中…</Text>
        : (
            <Table.ScrollContainer minWidth={720}>
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40} />
                    <Table.Th>日期</Table.Th>
                    <Table.Th>类型</Table.Th>
                    <Table.Th>分类</Table.Th>
                    <Table.Th ta="right">金额</Table.Th>
                    <Table.Th>备注</Table.Th>
                    <Table.Th>操作</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {loaded.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={7}>
                        <Text c="dimmed" ta="center" py="xl">暂无账单数据</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {loaded.map(row => (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Checkbox
                          aria-label={`选择 ${row.date} ${row.category} 账单`}
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </Table.Td>
                      <Table.Td>{row.date}</Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={row.type === "income" ? "green" : "red"}
                        >
                          {TYPE_LABEL[row.type]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{row.category}</Table.Td>
                      <Table.Td ta="right">
                        <Text fw={500} c={row.type === "income" ? "green" : undefined}>
                          {formatAmount(row.amount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" lineClamp={1} maw={240}>
                          {row.note || "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="编辑"
                            onClick={() => openEdit(row)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="删除"
                            onClick={() => setDeleting(row)}
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
          )}

      <Modal
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title="编辑账单"
        centered
      >
        <Stack gap="sm">
          <SegmentedControl
            fullWidth
            value={type}
            onChange={value => switchType(value as TransactionType)}
            data={[
              { label: "支出", value: "expense" },
              { label: "收入", value: "income" },
            ]}
          />
          <TextInput
            label="日期"
            type="date"
            value={date}
            onChange={event => setDate(event.currentTarget.value)}
            required
          />
          <NumberInput
            label="金额"
            prefix="¥"
            min={0.01}
            decimalScale={2}
            fixedDecimalScale
            thousandSeparator=","
            value={amount}
            onChange={setAmount}
            required
          />
          <Select
            label="分类"
            placeholder="请选择分类"
            data={categoryOptions}
            value={category}
            onChange={value => setCategory(value ?? "")}
            required
          />
          <TextInput
            label="备注"
            placeholder="选填"
            value={note}
            onChange={event => setNote(event.currentTarget.value)}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={saveEdit} disabled={!formValid}>保存</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title="删除账单"
        centered
        size="sm"
      >
        <Text size="sm">
          确定删除
          {" "}
          {deleting?.date}
          {" "}
          的这笔
          {deleting ? TYPE_LABEL[deleting.type] : ""}
          账单吗？删除后不可恢复。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleting(null)}>取消</Button>
          <Button color="red" onClick={confirmSingleDelete}>删除</Button>
        </Group>
      </Modal>

      <Modal
        opened={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="批量删除"
        centered
        size="sm"
      >
        <Text size="sm">
          确定删除选中的
          {" "}
          {selected.size}
          {" "}
          笔账单吗？删除后不可恢复。
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setBatchOpen(false)}>取消</Button>
          <Button color="red" onClick={confirmBatchDelete}>删除</Button>
        </Group>
      </Modal>

      <Affix position={{ bottom: 24, right: 24 }}>
        {notice !== null && (
          <Notification
            color="green"
            title="操作成功"
            icon={<IconCheck size={18} />}
            withCloseButton
            onClose={() => setNotice(null)}
          >
            {notice}
          </Notification>
        )}
      </Affix>
    </Stack>
  );
}
