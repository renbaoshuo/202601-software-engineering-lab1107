import { Anchor, Container, Group, Text, Title } from "@mantine/core";
import { Link } from "react-router";

export default function Home() {
  return (
    <Container pt="xl" size="sm">
      <Title order={1}>Home</Title>
      <Text c="dimmed" mt="sm">
        Vite + React Router + Mantine UI
      </Text>
      <Group mt="md">
        <Anchor component={Link} to="/about">
          前往 About
        </Anchor>
      </Group>
    </Container>
  );
}
