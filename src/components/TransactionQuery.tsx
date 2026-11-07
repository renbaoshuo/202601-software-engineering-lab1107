import { useState } from "react";
import { Button, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import type { TransactionFilter, TransactionType } from "../shared/types";
import { EMPTY_QUERY, toTransactionFilter, validateQuery } from "../utils/transactionQuery";
import type { QueryErrors, QueryValues } from "../utils/transactionQuery";

interface TransactionQueryProps {
  categories: string[];
  onSearch: (filter: TransactionFilter) => void;
}

export default function TransactionQuery({ categories, onSearch }: TransactionQueryProps) {
  const [values, setValues] = useState<QueryValues>({ ...EMPTY_QUERY });
  const [errors, setErrors] = useState<QueryErrors>({});

  function update<K extends keyof QueryValues>(field: K, value: QueryValues[K]) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors({});
  }

  function reset() {
    setValues({ ...EMPTY_QUERY });
    setErrors({});
    onSearch({});
  }

  return (
    <Paper component="section" aria-label="账单筛选条件" p="lg" radius="md" withBorder>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const nextErrors = validateQuery(values);
          setErrors(nextErrors);
          if (Object.keys(nextErrors).length === 0) onSearch(toTransactionFilter(values));
        }}
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <TextInput
              label="开始日期"
              type="date"
              value={values.startDate}
              onChange={event => update("startDate", event.currentTarget.value)}
            />
            <TextInput
              label="结束日期"
              type="date"
              value={values.endDate}
              error={errors.endDate}
              onChange={event => update("endDate", event.currentTarget.value)}
            />
            <Select
              label="收支类型"
              placeholder="全部类型"
              data={[{ value: "income", label: "收入" }, { value: "expense", label: "支出" }]}
              value={values.type || null}
              clearable
              onChange={value => update("type", (value ?? "") as TransactionType | "")}
            />
            <Select
              label="账单类别"
              placeholder="全部类别"
              data={categories}
              value={values.category || null}
              clearable
              searchable
              nothingFoundMessage="没有匹配的类别"
              onChange={value => update("category", value ?? "")}
            />
            <NumberInput
              label="最低金额（元）"
              placeholder="不限，例如 10.00"
              value={values.minAmount}
              error={errors.minAmount}
              decimalScale={2}
              allowNegative={false}
              clampBehavior="none"
              hideControls
              onChange={value => update("minAmount", value)}
            />
            <NumberInput
              label="最高金额（元）"
              placeholder="不限，例如 100.00"
              value={values.maxAmount}
              error={errors.maxAmount}
              decimalScale={2}
              allowNegative={false}
              clampBehavior="none"
              hideControls
              onChange={value => update("maxAmount", value)}
            />
            <TextInput
              label="关键词"
              placeholder="搜索类别或备注"
              value={values.keyword}
              onChange={event => update("keyword", event.currentTarget.value)}
            />
          </SimpleGrid>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">条件可组合使用，留空表示不限。</Text>
            <Group gap="sm">
              <Button variant="default" type="button" onClick={reset}>重置</Button>
              <Button type="submit">查询</Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
