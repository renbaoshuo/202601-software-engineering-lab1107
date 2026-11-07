import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Card, Center, Group, Loader, SegmentedControl, Stack, Title } from "@mantine/core";
import { useInterval } from "@mantine/hooks";
import { IconTrendingUp } from "@tabler/icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { transactions } from "../shared/db";
import type { Transaction } from "../shared/types";
import { formatAmount, parseDate } from "../utils/format";

type Dimension = "day" | "week" | "month";

const RANGE: Record<Dimension, number> = { day: 7, week: 8, month: 6 };

const RANGE_LABEL: Record<Dimension, string> = { day: "最近 7 天", week: "最近 8 周", month: "最近 6 个月" };

const DIMENSION_OPTIONS = [
  { label: "按日", value: "day" },
  { label: "按周", value: "week" },
  { label: "按月", value: "month" },
];

interface TrendBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

// 把日期归到所在维度的时间桶，桶的 key 同时用于和账单日期对齐。
function bucketKey(date: Date, dimension: Dimension): string {
  if (dimension === "month") return format(startOfMonth(date), "yyyy-MM");
  if (dimension === "week") return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(date, "yyyy-MM-dd");
}

function bucketLabel(date: Date, dimension: Dimension): string {
  if (dimension === "month") return format(date, "yyyy-MM");
  if (dimension === "week") return `${format(startOfWeek(date, { weekStartsOn: 1 }), "MM-dd")} 周`;
  return format(date, "MM-dd");
}

// 时间桶先按维度预生成，保证没有账单的日期也出现在横轴上，趋势线不会被压缩。
function buildBuckets(dimension: Dimension, today: Date): TrendBucket[] {
  const buckets: TrendBucket[] = [];
  for (let offset = RANGE[dimension] - 1; offset >= 0; offset -= 1) {
    let date = today;
    if (dimension === "day") date = subDays(today, offset);
    if (dimension === "week") date = subWeeks(today, offset);
    if (dimension === "month") date = subMonths(today, offset);
    buckets.push({
      key: bucketKey(date, dimension),
      label: bucketLabel(date, dimension),
      income: 0,
      expense: 0,
    });
  }
  return buckets;
}

// 查询只取当前时间窗口内的账单，交给 Dexie 的日期索引过滤，避免每次更新都全量扫描。
function queryRange(today: Date, dimension: Dimension) {
  if (dimension === "month") {
    return {
      startDate: format(startOfMonth(subMonths(today, RANGE.month - 1)), "yyyy-MM-dd"),
      endDate: format(endOfMonth(today), "yyyy-MM-dd"),
    };
  }
  if (dimension === "week") {
    return {
      startDate: format(startOfWeek(subWeeks(today, RANGE.week - 1), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      endDate: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    };
  }
  return {
    startDate: format(subDays(today, RANGE.day - 1), "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
  };
}

function summarize(bills: Transaction[], dimension: Dimension, today: Date): TrendBucket[] {
  const buckets = buildBuckets(dimension, today);
  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
  for (const bill of bills) {
    const bucket = byKey.get(bucketKey(parseDate(bill.date), dimension));
    if (bucket) bucket[bill.type] += bill.amount;
  }
  return buckets;
}

export default function TrendChart() {
  const [dimension, setDimension] = useState<Dimension>("day");
  // 图表窗口以本地日期为准，跨过午夜后要自动推进到新的一天。
  const [todayText, setTodayText] = useState(() => format(new Date(), "yyyy-MM-dd"));
  useInterval(() => setTodayText(format(new Date(), "yyyy-MM-dd")), 60_000);

  const today = useMemo(() => parseDate(todayText), [todayText]);
  const { startDate, endDate } = useMemo(() => queryRange(today, dimension), [today, dimension]);
  const bills = useLiveQuery(
    () => transactions.list({ sortBy: "date", order: "asc", startDate, endDate }),
    [startDate, endDate],
  );
  const buckets = useMemo(() => summarize(bills ?? [], dimension, today), [bills, dimension, today]);

  const option = useMemo<EChartsOption>(() => {
    const peak = Math.max(0, ...buckets.map(bucket => Math.max(bucket.income, bucket.expense)));
    const totalIncome = buckets.reduce((sum, bucket) => sum + bucket.income, 0);
    const totalExpense = buckets.reduce((sum, bucket) => sum + bucket.expense, 0);
    return {
      // ECharts 默认不生成无障碍描述，开启后为读屏软件提供格式化后的人民币金额。
      aria: {
        enabled: true,
        label: {
          description: `收支趋势图（${RANGE_LABEL[dimension]}），收入合计 ${formatAmount(totalIncome)}，支出合计 ${formatAmount(totalExpense)}。`,
        },
      },
      tooltip: {
        trigger: "axis",
        // 数据以整数分参与计算，展示时统一交给 formatAmount，避免各页口径不一致。
        valueFormatter: value => formatAmount(Number(value)),
      },
      legend: { data: ["收入", "支出"], bottom: 0 },
      grid: { left: 72, right: 24, top: 32, bottom: 48 },
      xAxis: {
        type: "category",
        data: buckets.map(bucket => bucket.label),
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        // 全为 0 时给一个默认量程，避免坐标轴出现 ¥0.01 这类无效刻度。
        max: peak === 0 ? 10000 : undefined,
        axisLabel: { formatter: value => formatAmount(value) },
        splitLine: { lineStyle: { type: "dashed" } },
      },
      series: [
        {
          name: "收入",
          type: "line",
          smooth: true,
          symbolSize: 6,
          data: buckets.map(bucket => bucket.income),
          itemStyle: { color: "#12b886" },
          areaStyle: { opacity: 0.08 },
        },
        {
          name: "支出",
          type: "line",
          smooth: true,
          symbolSize: 6,
          data: buckets.map(bucket => bucket.expense),
          itemStyle: { color: "#fa5252" },
          areaStyle: { opacity: 0.08 },
        },
      ],
    };
  }, [buckets, dimension]);

  if (bills === undefined) {
    return (
      <Card withBorder radius="md" padding="lg">
        <Center h={320}>
          <Loader size="sm" />
        </Center>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconTrendingUp size={20} stroke={1.6} />
          <Title order={4}>收支趋势</Title>
        </Group>
        <SegmentedControl
          size="xs"
          data={DIMENSION_OPTIONS}
          value={dimension}
          onChange={value => setDimension(value as Dimension)}
        />
      </Group>
      <Card withBorder radius="md" padding="md">
        <EChart option={option} />
      </Card>
    </Stack>
  );
}

function EChart({ option }: { option: EChartsOption }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = chartRef.current;
    if (!container) return;
    const chart = echarts.init(container);
    chartInstance.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartInstance.current = null;
    };
  }, []);

  // 账单变化时只重设 option，不重建实例，避免切换维度时图表闪烁。
  useEffect(() => {
    chartInstance.current?.setOption(option, true);
  }, [option]);

  return <Box ref={chartRef} h={320} />;
}
