import { Stack, Text, Title } from "@mantine/core";
import CategoryAnalysis from "../components/CategoryAnalysis";

export default function Reports() {
  return (
    <Stack>
      <Title order={2}>统计分析</Title>
      <Text c="dimmed" size="sm">按全部支出账单计算，账单变化后自动更新。</Text>
      <CategoryAnalysis />
    </Stack>
  );
}
