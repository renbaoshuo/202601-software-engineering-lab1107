import { useMemo, useState } from "react";
import {
  Box,
  Card,
  ColorSwatch,
  getThemeColor,
  Group,
  NumberFormatter,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { DonutChart, PieChart } from "@mantine/charts";
import { useElementSize } from "@mantine/hooks";
import { sumBy } from "lodash-es";
import type { Transaction } from "../shared/types";
import { getCategoryTotals } from "../utils/categoryTotals";
import { formatAmount } from "../utils/format";
// 团队入口已冻结，新增图表样式随业务组件加载。
import "@mantine/charts/styles.css";

interface CategoryChartProps {
  records: Transaction[];
}

const colors = ["blue.6", "teal.6", "orange.6", "grape.6", "indigo.6", "pink.6"];

export default function CategoryChart({ records }: CategoryChartProps) {
  const [chartType, setChartType] = useState<"pie" | "donut">("pie");
  const [labelType, setLabelType] = useState<"percent" | "value">("percent");
  const { ref, width } = useElementSize();
  const theme = useMantineTheme();
  const totals = useMemo(() => getCategoryTotals(records), [records]);
  const total = sumBy(totals, "amount");
  const data = totals.map((category, index) => ({
    name: category.name,
    value: category.amount,
    color: colors[index % colors.length],
  }));
  const Chart = chartType === "pie" ? PieChart : DonutChart;
  const size = Math.min(320, Math.max(160, width - 120));
  const chart = total === 0
    ? <Text c="dimmed" py="xl">暂无支出记录</Text>
    : (
        <Chart
          data={data}
          size={size}
          w="100%"
          miw={0}
          h={size + 160}
          withLabels
          withLabelsLine
          labelsType={labelType}
          withLegend
          withTooltip
          tooltipDataSource="segment"
          valueFormatter={formatAmount}
          strokeWidth={0}
        />
      );

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack>
        <Group justify="space-between">
          <Title order={3}>分类分析</Title>
          <Text fw={500} aria-live="polite">
            总支出
            {" "}
            {formatAmount(total)}
          </Text>
        </Group>
        <Group align="end">
          <SegmentedControl
            aria-label="图表类型"
            value={chartType}
            onChange={value => setChartType(value as "pie" | "donut")}
            data={[
              { label: "饼图", value: "pie" },
              { label: "圆环图", value: "donut" },
            ]}
          />
          <Select
            label="图表标签"
            value={labelType}
            allowDeselect={false}
            onChange={value => setLabelType(value as "percent" | "value")}
            data={[
              { label: "百分比", value: "percent" },
              { label: "金额", value: "value" },
            ]}
          />
        </Group>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Box ref={ref} miw={0} role="group" aria-label="各消费分类的支出金额和占比">
            {chart}
          </Box>
          {total > 0 && (
            <Table.ScrollContainer minWidth={280}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>消费类别</Table.Th>
                    <Table.Th ta="right">金额</Table.Th>
                    <Table.Th ta="right">占比</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {totals.map((category, index) => (
                    <Table.Tr key={category.name}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ColorSwatch color={getThemeColor(colors[index % colors.length], theme)} size={12} />
                          <Text size="sm">{category.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">{formatAmount(category.amount)}</Table.Td>
                      <Table.Td ta="right">
                        <NumberFormatter value={category.amount / total * 100} decimalScale={1} suffix="%" />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
