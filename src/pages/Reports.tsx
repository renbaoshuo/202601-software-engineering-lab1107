import { Container, Stack, Text, Title } from "@mantine/core";
import TrendChart from "../components/TrendChart";

export default function Reports() {
  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <div>
          <Title order={2}>统计分析</Title>
          <Text c="dimmed" mt={4}>收支趋势按当前账单实时汇总，无需手动刷新。</Text>
        </div>
        <TrendChart />
      </Stack>
    </Container>
  );
}
