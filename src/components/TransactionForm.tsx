import { useState } from "react";
import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import { IconCalendar, IconDeviceFloppy } from "@tabler/icons-react";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import { transactions } from "../shared/db";
import type { TransactionType } from "../shared/types";
import { formatDate, toCents } from "../utils/format";

interface FormErrors {
  amount?: string;
  category?: string;
  date?: string;
}

export default function TransactionForm() {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(formatDate(new Date()));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  function changeType(value: string) {
    setType(value as TransactionType);
    // 分类按收支类型分组，切换后原分类可能不在新列表里。
    setCategory(null);
    setErrors(prev => ({ ...prev, category: undefined }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    const value = Number(amount);

    if (amount === "") {
      next.amount = "请输入金额";
    }
    else if (!Number.isFinite(value)) {
      next.amount = "请输入有效金额";
    }
    else if (value < 0) {
      next.amount = "金额不能为负数";
    }
    else if (value === 0) {
      next.amount = "金额必须大于 0";
    }
    else if (!/^\d+(\.\d{1,2})?$/.test(String(amount))) {
      next.amount = "金额最多保留两位小数";
    }

    if (!category) next.category = "请选择类别";
    if (!date) next.date = "请选择日期";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    await transactions.add({
      type,
      amount: toCents(Number(amount)),
      category: category!,
      date: date!,
      note: note.trim(),
    });

    setAmount("");
    setNote("");
    setCategory(null);
    setErrors({});
  }

  return (
    <Card withBorder radius="md" padding="lg" shadow="sm">
      <Stack gap="md">
        <SegmentedControl
          fullWidth
          value={type}
          onChange={changeType}
          color={type === "income" ? "green" : "red"}
          data={[
            { label: "支出", value: "expense" },
            { label: "收入", value: "income" },
          ]}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <DatePickerInput
            label="日期"
            placeholder="选择日期"
            valueFormat="YYYY-MM-DD"
            leftSection={<IconCalendar size={16} />}
            value={date}
            onChange={setDate}
            allowDeselect={false}
            error={errors.date}
          />
          <NumberInput
            label="金额（元）"
            description="最多保留两位小数"
            placeholder="0.00"
            decimalScale={2}
            leftSection="¥"
            value={amount}
            onChange={(value) => {
              setAmount(value);
              setErrors(prev => ({ ...prev, amount: undefined }));
            }}
            error={errors.amount}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="类别"
            placeholder="选择类别"
            data={DEFAULT_CATEGORIES[type]}
            value={category}
            onChange={(value) => {
              setCategory(value);
              setErrors(prev => ({ ...prev, category: undefined }));
            }}
            allowDeselect={false}
            error={errors.category}
          />
          <TextInput
            label="备注"
            placeholder="选填，例如：和同事聚餐"
            value={note}
            maxLength={100}
            onChange={event => setNote(event.currentTarget.value)}
          />
        </SimpleGrid>

        <Group justify="flex-end">
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave}>
            保存
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
