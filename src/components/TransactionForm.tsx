import { useEffect, useRef, useState } from "react";
import {
  Affix,
  Button,
  Card,
  Group,
  Notification,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import {
  IconArrowLeft,
  IconBolt,
  IconCalendar,
  IconCheck,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import { transactions } from "../shared/db";
import type { TransactionType } from "../shared/types";
import { notifyTransactionAdded } from "../utils/events";
import { formatAmount, formatDate, toCents } from "../utils/format";

interface FormErrors {
  amount?: string;
  category?: string;
  date?: string;
}

interface QuickTemplate {
  label: string;
  type: TransactionType;
  category: string;
  amount: number;
  note: string;
}

// 高频记录模板，amount 与账单存储一致用整数分。
const QUICK_TEMPLATES: QuickTemplate[] = [
  { label: "早餐", type: "expense", category: "饮食", amount: 1500, note: "早餐" },
  { label: "地铁", type: "expense", category: "交通", amount: 400, note: "地铁" },
  { label: "午饭", type: "expense", category: "饮食", amount: 3000, note: "午饭" },
  { label: "超市", type: "expense", category: "购物", amount: 10000, note: "超市采购" },
  { label: "工资", type: "income", category: "工资", amount: 800000, note: "工资" },
];

export default function TransactionForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const amountRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(formatDate(new Date()));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState<{ text: string; at: number } | null>(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 3500);
    return () => clearTimeout(timer);
  }, [success]);

  function changeType(value: string) {
    setType(value as TransactionType);
    // 分类按收支类型分组，切换后原分类可能不在新列表里。
    setCategory(null);
    setErrors(prev => ({ ...prev, category: undefined }));
  }

  function applyTemplate(template: QuickTemplate) {
    setType(template.type);
    setCategory(template.category);
    setAmount(template.amount / 100);
    setNote(template.note);
    setErrors({});
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

  function goBack() {
    // 直接打开 /transactions 时没有上一页，退回账单列表。
    if (location.key === "default") {
      navigate("/transactions");
    }
    else {
      navigate(-1);
    }
  }

  async function handleSave(continueAdding: boolean) {
    if (!validate()) return;

    const input = {
      type,
      amount: toCents(Number(amount)),
      category: category!,
      date: date!,
      note: note.trim(),
    };

    setSaving(true);
    setSaveError("");
    try {
      await transactions.add(input);
      notifyTransactionAdded(input);

      if (continueAdding) {
        setSuccess({
          text: `已记下这笔${type === "expense" ? "支出" : "收入"} ${formatAmount(input.amount)}`,
          at: Date.now(),
        });
        // 连续记账保留日期与收支类型，只清空本笔业务字段并聚焦金额。
        setAmount("");
        setNote("");
        setCategory(null);
        setErrors({});
        amountRef.current?.focus();
      }
      else {
        goBack();
      }
    }
    catch {
      setSaveError("保存失败，请稍后重试");
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Group gap="xs" mb="sm">
          <IconBolt size={18} stroke={1.6} />
          <Text fw={600}>快捷模板</Text>
          <Text size="xs" c="dimmed">常用记录点一下就能填好</Text>
        </Group>
        <Group gap="xs">
          {QUICK_TEMPLATES.map(template => (
            <Button
              key={template.label}
              size="compact-md"
              variant="light"
              color={template.type === "income" ? "green" : "orange"}
              onClick={() => applyTemplate(template)}
            >
              {template.label}
              {" "}
              {formatAmount(template.amount)}
            </Button>
          ))}
        </Group>
      </Card>

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
              ref={amountRef}
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

          {saveError && (
            <Text size="sm" c="red">{saveError}</Text>
          )}

          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              保存并返回
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => handleSave(true)}
              loading={saving}
            >
              保存并再记一笔
            </Button>
          </Group>
        </Stack>

        {success && (
          <Affix position={{ top: 16, right: 16 }} zIndex={400}>
            <Notification
              color="green"
              icon={<IconCheck size={18} />}
              title="保存成功"
              onClose={() => setSuccess(null)}
            >
              {success.text}
            </Notification>
          </Affix>
        )}
      </Card>
    </Stack>
  );
}
