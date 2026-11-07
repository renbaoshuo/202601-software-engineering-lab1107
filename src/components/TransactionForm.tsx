import { useRef, useState } from "react";
import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconBolt,
  IconCalendar,
  IconDeviceFloppy,
  IconWand,
} from "@tabler/icons-react";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import { transactions } from "../shared/db";
import type { NewTransaction, Transaction, TransactionType } from "../shared/types";
import { formatAmount, formatDate, fromCents, toCents } from "../utils/format";
import { parseTransactionText } from "../utils/smartParse";

interface FormErrors {
  amount?: string;
  category?: string;
  date?: string;
}

interface TransactionFormProps {
  transaction?: Transaction;
  onCancel: () => void;
  onSaved: (transaction: NewTransaction, continueAdding: boolean) => void;
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

export default function TransactionForm({ transaction, onCancel, onSaved }: TransactionFormProps) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [amount, setAmount] = useState<number | string>(transaction ? fromCents(transaction.amount) : "");
  const [category, setCategory] = useState<string | null>(transaction?.category ?? null);
  const [date, setDate] = useState(() => transaction?.date ?? formatDate(new Date()));
  const [note, setNote] = useState(transaction?.note ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [parseText, setParseText] = useState("");
  const [parseError, setParseError] = useState("");
  const [parseTip, setParseTip] = useState("");

  const categories = DEFAULT_CATEGORIES[type];
  // 导入的账单可能使用自定义类别，编辑时仍可保留该类别。
  const categoryOptions = transaction?.type === type && !categories.includes(transaction.category)
    ? [transaction.category, ...categories]
    : categories;

  function changeType(value: string) {
    const nextType = value as TransactionType;
    setType(nextType);
    // 只有新类型也支持的类别才可以沿用。
    if (!category || !DEFAULT_CATEGORIES[nextType].includes(category)) setCategory(null);
    setErrors(prev => ({ ...prev, category: undefined }));
  }

  function applyTemplate(template: QuickTemplate) {
    setType(template.type);
    setCategory(template.category);
    setAmount(fromCents(template.amount));
    setNote(template.note);
    setErrors({});
    setParseTip("");
  }

  function handleParse() {
    const result = parseTransactionText(parseText);
    if (!result) {
      setParseError("请输入大于 0、最多两位小数的金额，例如「昨天打车花了 25」");
      setParseTip("");
      return;
    }

    setType(result.type);
    setCategory(result.category);
    setAmount(fromCents(result.amount));
    setDate(result.date);
    setNote(result.note);
    setErrors({});
    setParseError("");
    setParseTip(`已识别：${result.date} · ${result.category} · ${formatAmount(result.amount)}`);
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
    else if (!Number.isSafeInteger(toCents(value))) {
      next.amount = "金额超出可记录范围";
    }

    if (!category) next.category = "请选择类别";
    if (!date) next.date = "请选择日期";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave(continueAdding: boolean) {
    if (saving || !validate() || !category) return;

    const input = {
      type,
      amount: toCents(Number(amount)),
      category,
      date,
      note: transaction ? note : note.trim(),
    };

    setSaving(true);
    setSaveError("");
    try {
      if (transaction) {
        const updated = await transactions.update(transaction.id, input);
        if (!updated) {
          setSaveError("这笔账单已不存在");
          return;
        }
      }
      else {
        await transactions.add(input);
      }

      if (continueAdding) {
        // 连续记账保留日期与收支类型，只清空本笔业务字段并聚焦金额。
        setAmount("");
        setNote("");
        setCategory(null);
        setErrors({});
        setParseTip("");
        amountRef.current?.focus();
      }

      onSaved(input, continueAdding);
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
      {!transaction && (
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
      )}

      <Card withBorder radius="md" padding="lg" shadow="sm">
        <Stack gap="md">
          {!transaction && (
            <>
              <TextInput
                label="智能识别"
                placeholder="一句话记账，例如：昨天打车花了 25"
                value={parseText}
                leftSection={<IconWand size={16} />}
                rightSectionWidth={76}
                rightSection={(
                  <Button size="compact-sm" variant="light" onClick={handleParse}>
                    识别
                  </Button>
                )}
                onChange={(event) => {
                  setParseText(event.currentTarget.value);
                  setParseError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleParse();
                  }
                }}
                error={parseError}
              />
              {parseTip && (
                <Text size="xs" c="green">{parseTip}</Text>
              )}
            </>
          )}

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
            <TextInput
              label="日期"
              type="date"
              leftSection={<IconCalendar size={16} />}
              value={date}
              onChange={event => setDate(event.currentTarget.value)}
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
              data={categoryOptions}
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
              maxLength={transaction ? undefined : 100}
              onChange={event => setNote(event.currentTarget.value)}
            />
          </SimpleGrid>

          {saveError && (
            <Text size="sm" c="red">{saveError}</Text>
          )}

          {transaction
            ? (
                <Group justify="flex-end" gap="sm">
                  <Button variant="default" onClick={onCancel} disabled={saving}>取消</Button>
                  <Button onClick={() => handleSave(false)} loading={saving}>保存</Button>
                </Group>
              )
            : (
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
              )}
        </Stack>
      </Card>
    </Stack>
  );
}
