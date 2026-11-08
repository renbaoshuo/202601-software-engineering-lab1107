import { Anchor, Paper, Stack, Text, Title } from "@mantine/core";
import PageContainer from "../components/PageContainer";

export default function About() {
  return (
    <PageContainer>
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>关于</Title>
          <Text c="dimmed">个人记账本，用于记录收支和查看账单统计。</Text>
        </Stack>

        <Paper withBorder p="lg" radius="md">
          <Stack gap="md">
            <Title order={3}>项目说明</Title>
            <Text>
              本项目为福州大学202601学期《软件工程实践》作业。这可能并不是一个会持续完善维护的项目，因此在使用本项目前请谨慎评估其适用性。
            </Text>
            <Stack gap="xs" align="flex-start">
              <Anchor href="https://baoshuo.ren">
                个人主页
              </Anchor>
              <Anchor href="https://github.com/renbaoshuo/202601-software-engineering-lab1107">
                GitHub 项目仓库
              </Anchor>
              <Anchor href="https://www.cnblogs.com/baoshuo/p/23584691">
                项目介绍博文
              </Anchor>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </PageContainer>
  );
}
