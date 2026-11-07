import { Anchor, Container, Group, Text, Title } from "@mantine/core";
import { Link } from "react-router";

export default function About() {
  return (
    <Container pt="xl" size="sm">
      <Title order={1}>About</Title>
      <Text c="dimmed" mt="sm">
        关于本页面
      </Text>
      <Group mt="md">
        <Anchor component={Link} to="/">
          返回 Home
        </Anchor>
      </Group>
    </Container>
  );
}
