import { Text, Title } from "@mantine/core";
import PageContainer from "./PageContainer";

interface PagePlaceholderProps {
  title: string;
}

export default function PagePlaceholder({ title }: PagePlaceholderProps) {
  return (
    <PageContainer>
      <Title order={2}>{title}</Title>
      <Text c="dimmed" mt="xs">
        页面建设中，此处为占位内容
      </Text>
    </PageContainer>
  );
}
