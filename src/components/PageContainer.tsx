import { Container } from "@mantine/core";
import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return <Container size="xl" px={0} className={className}>{children}</Container>;
}
