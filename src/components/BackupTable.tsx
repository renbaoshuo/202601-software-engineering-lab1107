import { Badge, Button, Group, Table, Text } from "@mantine/core";
import { IconDownload, IconEye } from "@tabler/icons-react";
import {
  BACKUP_KIND_LABELS,
  formatFileSize,
  type BackupMeta,
  type BackupKind,
} from "../utils/backupStorage";
import { formatDateTime } from "../utils/format";

interface BackupTableProps {
  backups: BackupMeta[];
  onDownload: (backup: BackupMeta) => void;
  onView: (backup: BackupMeta) => void;
}

const KIND_COLORS: Record<BackupKind, string> = {
  "manual": "indigo",
  "auto-import": "orange",
  "auto-restore": "red",
};

export default function BackupTable({ backups, onDownload, onView }: BackupTableProps) {
  return (
    <Table.ScrollContainer minWidth={760}>
      <Table highlightOnHover striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>备份文件</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>创建时间</Table.Th>
            <Table.Th>记录数</Table.Th>
            <Table.Th>大小</Table.Th>
            <Table.Th ta="right">操作</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {backups.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" py="lg" ta="center">暂无备份，点击“立即备份”创建第一份快照</Text>
              </Table.Td>
            </Table.Tr>
          )}
          {backups.map(backup => (
            <Table.Tr key={backup.id}>
              <Table.Td>
                <Text fw={500} size="sm">{backup.name}</Text>
              </Table.Td>
              <Table.Td>
                <Badge color={KIND_COLORS[backup.kind]} size="sm" variant="light">
                  {BACKUP_KIND_LABELS[backup.kind]}
                </Badge>
              </Table.Td>
              <Table.Td>{formatDateTime(backup.createdAt)}</Table.Td>
              <Table.Td>
                {`${backup.counts.transactions} 账单 / ${backup.counts.budgets} 预算 / ${backup.counts.savingsGoals} 目标`}
              </Table.Td>
              <Table.Td>{formatFileSize(backup.size)}</Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end" wrap="nowrap">
                  <Button
                    leftSection={<IconEye size={15} />}
                    size="xs"
                    variant="subtle"
                    onClick={() => onView(backup)}
                  >
                    查看
                  </Button>
                  <Button
                    leftSection={<IconDownload size={15} />}
                    size="xs"
                    variant="light"
                    onClick={() => onDownload(backup)}
                  >
                    下载
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
