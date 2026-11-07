import { Stack, Text, Title } from "@mantine/core";
import PageContainer from "../components/PageContainer";
import CategoryAnalysis from "../components/CategoryAnalysis";
import TrendChart from "../components/TrendChart";

export default function Reports() {
  return (
    <PageContainer>
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>统计分析</Title>
          <Text c="dimmed">查看近期收支趋势和全部支出的分类占比，账单变化后自动更新。</Text>
        </Stack>
        <TrendChart />
        <CategoryAnalysis />
      </Stack>
    </PageContainer>
  );
}
