import { Container, Text, Title } from "@mantine/core";

interface PagePlaceholderProps {
  title: string;
}

export default function PagePlaceholder({ title }: PagePlaceholderProps) {
  return (
    <Container size="lg">
      <Title order={2}>{title}</Title>
      <Text c="dimmed" mt="xs">
        页面建设中，此处为占位内容
      </Text>
    </Container>
  );
}
