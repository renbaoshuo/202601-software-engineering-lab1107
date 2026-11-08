import {
  AppShell,
  Group,
  NavLink,
  ScrollArea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Link, Outlet, useLocation } from "react-router";
import {
  IconCalendar,
  IconChartPie,
  IconDatabase,
  IconInfoCircle,
  IconLayoutDashboard,
  IconPig,
  IconPigMoney,
  IconReceipt,
  IconTargetArrow,
} from "@tabler/icons-react";

interface NavItem {
  label: string;
  to: string;
  icon: typeof IconLayoutDashboard;
}

// 十一个功能点映射到七个业务入口：
// 收支记录 / 账单流水 / 账单编辑 / 账单查询 -> 账单
// 收支总览 -> 概览；分类分析 / 收支趋势 -> 统计分析；其余一一对应
const NAV_ITEMS: NavItem[] = [
  { label: "概览", to: "/", icon: IconLayoutDashboard },
  { label: "账单", to: "/transactions", icon: IconReceipt },
  { label: "账单日历", to: "/calendar", icon: IconCalendar },
  { label: "统计分析", to: "/reports", icon: IconChartPie },
  { label: "预算管理", to: "/budget", icon: IconTargetArrow },
  { label: "储蓄目标", to: "/savings", icon: IconPigMoney },
  { label: "数据管理", to: "/data", icon: IconDatabase },
  { label: "关于", to: "/about", icon: IconInfoCircle },
];

function isActive(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

export default function AppLayout() {
  const { pathname } = useLocation();

  return (
    <AppShell navbar={{ width: 240, breakpoint: "sm" }} padding="md">
      <AppShell.Navbar>
        <AppShell.Section>
          <Group gap="sm" px="md" py="md">
            <ThemeIcon size="lg" variant="light" color="indigo">
              <IconPig size={20} stroke={1.6} />
            </ThemeIcon>
            <Title order={4}>记账本</Title>
          </Group>
        </AppShell.Section>
        <AppShell.Section component={ScrollArea} grow my="xs">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.6} />}
              component={Link}
              to={item.to}
              active={isActive(pathname, item.to)}
            />
          ))}
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
