import {
  Alert,
  Badge,
  Button,
  Container,
  Grid,
  Group,
  Modal,
  Paper,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArchive,
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconHistory,
  IconInfoCircle,
  IconRestore,
  IconUpload,
} from "@tabler/icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import BackupTable from "../components/BackupTable";
import DataFileDrop from "../components/DataFileDrop";
import { ledgerBackup, transactions } from "../shared/db";
import type { LedgerBackup } from "../shared/types";
import {
  BACKUP_KIND_LABELS,
  createBackup,
  formatFileSize,
  listBackups,
  readBackup,
  type BackupMeta,
  type StoredBackup,
} from "../utils/backupStorage";
import {
  formatDateTime,
  isValidDateString,
  todayString,
} from "../utils/format";
import {
  buildFileName,
  createCsv,
  createJson,
  downloadText,
  readImportFile,
  type ImportFormat,
  type ImportMode,
  type ImportPreview,
} from "../utils/ledgerFiles";

type TabValue = "export" | "import" | "backup" | "restore";
type ExportScope = "all" | "month" | "custom";
type RestoreSource = "library" | "file";

interface Feedback {
  type: "success" | "warning" | "error";
  title: string;
  message: string;
}

interface RestoreCandidate {
  name: string;
  createdAt: string;
  source: RestoreSource;
  snapshot: LedgerBackup;
}

interface SnapshotCountsProps {
  transactions: number;
  budgets: number;
  savingsGoals: number;
}

const EXPORT_FORMATS = [
  { value: "json", label: "JSON · 完整备份" },
  { value: "csv", label: "CSV · 查看与交换" },
];

const CSV_SCOPES = [
  { value: "all", label: "全部账单" },
  { value: "month", label: "本月账单" },
  { value: "custom", label: "自定义日期范围" },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误";
}

function feedbackColor(type: Feedback["type"]) {
  switch (type) {
    case "success":
      return "teal";
    case "warning":
      return "yellow";
    case "error":
      return "red";
  }
}

function SnapshotCounts({ transactions, budgets, savingsGoals }: SnapshotCountsProps) {
  return (
    <Group gap="xs">
      <Badge color="indigo" size="lg" variant="light">{`${transactions} 条账单`}</Badge>
      <Badge color="grape" size="lg" variant="light">{`${budgets} 条预算`}</Badge>
      <Badge color="teal" size="lg" variant="light">{`${savingsGoals} 个储蓄目标`}</Badge>
    </Group>
  );
}

function PreviewSummary({ preview }: { preview: ImportPreview }) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <IconInfoCircle size={18} />
        <Text fw={600}>{preview.fileName}</Text>
        <Badge size="sm" variant="outline">{preview.format?.toUpperCase() ?? "未知"}</Badge>
      </Group>
      <SnapshotCounts
        budgets={preview.budgets.length}
        savingsGoals={preview.savingsGoals.length}
        transactions={preview.transactions.length}
      />
      <Text c={preview.issues.length > 0 ? "orange.7" : "teal.7"} size="sm">
        {preview.issues.length > 0
          ? `发现 ${preview.issues.length} 个格式错误，确认后将仅导入有效账单`
          : "字段、日期和金额校验全部通过"}
      </Text>
    </Stack>
  );
}

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState<TabValue>("export");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const transactionCount = useLiveQuery(() => transactions.count(), []) ?? 0;
  const [backups, setBackups] = useState<BackupMeta[]>(() => listBackups());

  const [exportFormat, setExportFormat] = useState<ImportFormat>("json");
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fileNamePrefix, setFileNamePrefix] = useState("ledger-data");
  const [exporting, setExporting] = useState(false);

  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("append");
  const [readingImport, setReadingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  const [backingUp, setBackingUp] = useState(false);
  const [viewedBackup, setViewedBackup] = useState<StoredBackup | null>(null);

  const [restoreSource, setRestoreSource] = useState<RestoreSource>("library");
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<RestoreCandidate | null>(null);
  const [readingRestore, setReadingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const latestBackup = backups[0];
  const backupOptions = useMemo(
    () => backups.map(backup => ({
      value: backup.id,
      label: `${backup.name} · ${formatDateTime(backup.createdAt)}`,
    })),
    [backups],
  );
  const canImport = Boolean(
    importPreview
    && importPreview.transactions.length > 0
    && (importPreview.format === "csv" || importPreview.issues.length === 0),
  );

  function refreshBackups() {
    setBackups(listBackups());
  }

  async function handleExport() {
    if (exportScope === "custom") {
      if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
        setFeedback({
          type: "error",
          title: "无法导出",
          message: "请填写完整的开始日期和结束日期",
        });
        return;
      }
      if (startDate > endDate) {
        setFeedback({
          type: "error",
          title: "无法导出",
          message: "开始日期不能晚于结束日期",
        });
        return;
      }
    }

    setExporting(true);
    setFeedback(null);
    try {
      const snapshot = await ledgerBackup.read();
      let rows = snapshot.transactions;
      if (exportFormat === "csv" && exportScope === "month") {
        const month = todayString().slice(0, 7);
        rows = rows.filter(transaction => transaction.date.startsWith(month));
      }
      if (exportFormat === "csv" && exportScope === "custom") {
        rows = rows.filter(transaction => transaction.date >= startDate && transaction.date <= endDate);
      }

      const fileName = buildFileName(fileNamePrefix, exportFormat);
      if (exportFormat === "json") {
        downloadText(createJson(snapshot), fileName, "application/json;charset=utf-8");
      }
      else {
        downloadText(createCsv(rows), fileName, "text/csv;charset=utf-8");
      }
      setFeedback({
        type: "success",
        title: "导出成功",
        message: exportFormat === "json"
          ? `${fileName} 已生成，包含完整账单、预算和储蓄目标`
          : `${fileName} 已生成，共 ${rows.length} 条账单`,
      });
    }
    catch (error) {
      setFeedback({ type: "error", title: "导出失败", message: errorMessage(error) });
    }
    finally {
      setExporting(false);
    }
  }

  function handleFormatChange(value: string | null) {
    if (!value) return;
    setExportFormat(value as ImportFormat);
    if (value === "json") setExportScope("all");
  }

  async function handleImportFile(file: File) {
    setReadingImport(true);
    setFeedback(null);
    try {
      setImportPreview(await readImportFile(file));
    }
    catch (error) {
      setImportPreview(null);
      setFeedback({ type: "error", title: "读取文件失败", message: errorMessage(error) });
    }
    finally {
      setReadingImport(false);
    }
  }

  async function executeImport() {
    if (!importPreview || !canImport) return;
    setImporting(true);
    setFeedback(null);
    const preview = importPreview;

    try {
      const before = await ledgerBackup.read();
      if (importMode === "overwrite") {
        createBackup(before, "auto-import");
      }

      if (importMode === "append") {
        await transactions.addMany(preview.transactions);
      }
      else if (preview.format === "json" && preview.backup) {
        await ledgerBackup.restore(preview.backup);
      }
      else {
        const replacement = preview.transactions.map(transaction => ({
          ...transaction,
          id: crypto.randomUUID(),
        }));
        await ledgerBackup.restore({ ...before, transactions: replacement });
      }

      const after = await ledgerBackup.read();
      const expectedTransactions = importMode === "append"
        ? before.transactions.length + preview.transactions.length
        : preview.transactions.length;
      const expectedBudgets = importMode === "append" || preview.format === "csv"
        ? before.budgets.length
        : preview.budgets.length;
      const expectedGoals = importMode === "append" || preview.format === "csv"
        ? before.savingsGoals.length
        : preview.savingsGoals.length;
      const countsMatch = (
        after.transactions.length !== expectedTransactions
        || after.budgets.length !== expectedBudgets
        || after.savingsGoals.length !== expectedGoals
      ) === false;

      refreshBackups();
      setImportPreview(null);
      setImportConfirmOpen(false);
      const message = `已${importMode === "append" ? "追加" : "覆盖"}导入 ${preview.transactions.length} 条账单`
        + (preview.issues.length > 0 ? `，跳过 ${preview.issues.length} 个错误项` : "")
        + (importMode === "overwrite" ? "，覆盖前数据已自动备份" : "");
      setFeedback({
        type: countsMatch ? "success" : "warning",
        title: countsMatch ? "导入成功" : "导入完成，数量校验有变化",
        message: countsMatch
          ? message
          : `${message}。提交后记录数发生变化；为避免覆盖并发保存，未执行整库回滚`,
      });
    }
    catch (error) {
      setFeedback({ type: "error", title: "导入失败", message: `${errorMessage(error)}，原数据未覆盖` });
    }
    finally {
      setImporting(false);
    }
  }

  async function handleManualBackup() {
    setBackingUp(true);
    setFeedback(null);
    try {
      const snapshot = await ledgerBackup.read();
      const backup = createBackup(snapshot, "manual");
      refreshBackups();
      setFeedback({
        type: "success",
        title: "备份成功",
        message: `${backup.name} 已保存，共 ${backup.counts.transactions} 条账单`,
      });
    }
    catch (error) {
      setFeedback({ type: "error", title: "备份失败", message: errorMessage(error) });
    }
    finally {
      setBackingUp(false);
    }
  }

  function handleViewBackup(backup: BackupMeta) {
    try {
      setViewedBackup(readBackup(backup.id) ?? null);
    }
    catch (error) {
      setFeedback({ type: "error", title: "读取备份失败", message: errorMessage(error) });
    }
  }

  function handleDownloadBackup(backup: BackupMeta) {
    try {
      const stored = readBackup(backup.id);
      if (!stored) throw new Error("备份文件不存在");
      downloadText(createJson(stored.snapshot), stored.name, "application/json;charset=utf-8");
      setFeedback({ type: "success", title: "下载已开始", message: stored.name });
    }
    catch (error) {
      setFeedback({ type: "error", title: "下载失败", message: errorMessage(error) });
    }
  }

  function handleSelectBackup(value: string | null) {
    setSelectedBackupId(value);
    setRestoreCandidate(null);
    if (!value) return;
    try {
      const backup = readBackup(value);
      if (!backup) throw new Error("备份文件不存在");
      setRestoreCandidate({
        name: backup.name,
        createdAt: backup.createdAt,
        source: "library",
        snapshot: backup.snapshot,
      });
    }
    catch (error) {
      setFeedback({ type: "error", title: "读取备份失败", message: errorMessage(error) });
    }
  }

  async function handleRestoreFile(file: File) {
    setReadingRestore(true);
    setFeedback(null);
    try {
      const preview = await readImportFile(file);
      if (preview.format !== "json" || !preview.backup || preview.issues.length > 0) {
        throw new Error("恢复需要字段完整且校验通过的 JSON 备份文件");
      }
      setRestoreCandidate({
        name: file.name,
        createdAt: new Date(file.lastModified).toISOString(),
        source: "file",
        snapshot: preview.backup,
      });
    }
    catch (error) {
      setRestoreCandidate(null);
      setFeedback({ type: "error", title: "备份文件无效", message: errorMessage(error) });
    }
    finally {
      setReadingRestore(false);
    }
  }

  async function executeRestore() {
    if (!restoreCandidate) return;
    setRestoring(true);
    setFeedback(null);

    try {
      const before = await ledgerBackup.read();
      createBackup(before, "auto-restore");
      await ledgerBackup.restore(restoreCandidate.snapshot);
      const after = await ledgerBackup.read();
      const target = restoreCandidate.snapshot;
      const countsMatch = (
        after.transactions.length !== target.transactions.length
        || after.budgets.length !== target.budgets.length
        || after.savingsGoals.length !== target.savingsGoals.length
      ) === false;

      refreshBackups();
      setRestoreConfirmOpen(false);
      setFeedback({
        type: countsMatch ? "success" : "warning",
        title: countsMatch ? "恢复成功" : "恢复完成，数量校验有变化",
        message: countsMatch
          ? `已从 ${restoreCandidate.name} 恢复 ${target.transactions.length} 条账单，恢复前数据已自动备份`
          : `已从 ${restoreCandidate.name} 恢复 ${target.transactions.length} 条账单；提交后记录数发生变化，未执行整库回滚以保留并发保存`,
      });
    }
    catch (error) {
      setFeedback({ type: "error", title: "恢复失败", message: `${errorMessage(error)}，原数据未覆盖` });
    }
    finally {
      setRestoring(false);
    }
  }

  return (
    <Container px={0} size="xl">
      <Stack gap="lg">
        <Group align="flex-start" gap="md" justify="space-between" wrap="wrap">
          <Stack gap={4}>
            <Title order={2}>数据管理</Title>
            <Text c="dimmed">导出、导入、备份与恢复均在本机完成</Text>
          </Stack>
          <Group gap="xs" wrap="wrap">
            <Badge color="indigo" size="lg" variant="light">{`当前账单 ${transactionCount} 条`}</Badge>
            <Badge color={latestBackup ? "teal" : "gray"} size="lg" variant="light">
              {`最近备份 ${latestBackup ? formatDateTime(latestBackup.createdAt) : "暂无"}`}
            </Badge>
          </Group>
        </Group>

        {feedback && (
          <Alert
            color={feedbackColor(feedback.type)}
            icon={feedback.type === "success"
              ? <IconCircleCheck size={22} />
              : <IconAlertTriangle size={22} />}
            title={feedback.title}
            withCloseButton
            onClose={() => setFeedback(null)}
          >
            {feedback.message}
          </Alert>
        )}

        <Paper p={{ base: "md", md: "lg" }} radius="lg" withBorder>
          <Tabs
            color="indigo"
            value={activeTab}
            variant="outline"
            onChange={value => value && setActiveTab(value as TabValue)}
          >
            <Tabs.List
              style={{
                flexWrap: "nowrap",
                overflowX: "auto",
                overflowY: "hidden",
              }}
            >
              <Tabs.Tab
                leftSection={<IconDownload size={17} />}
                style={{ flex: "0 0 auto" }}
                value="export"
              >
                导出数据
              </Tabs.Tab>
              <Tabs.Tab
                leftSection={<IconUpload size={17} />}
                style={{ flex: "0 0 auto" }}
                value="import"
              >
                导入数据
              </Tabs.Tab>
              <Tabs.Tab
                leftSection={<IconArchive size={17} />}
                style={{ flex: "0 0 auto" }}
                value="backup"
              >
                备份管理
              </Tabs.Tab>
              <Tabs.Tab
                leftSection={<IconHistory size={17} />}
                style={{ flex: "0 0 auto" }}
                value="restore"
              >
                恢复数据
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel pt="xl" value="export">
              <Stack gap="lg">
                <Stack gap={4}>
                  <Title order={3}>导出数据</Title>
                  <Text c="dimmed" size="sm">
                    JSON 可完整恢复账单、预算和储蓄目标；CSV 适合在表格软件中查看与交换。
                  </Text>
                </Stack>

                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      allowDeselect={false}
                      data={EXPORT_FORMATS}
                      label="文件格式"
                      value={exportFormat}
                      onChange={handleFormatChange}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Select
                      allowDeselect={false}
                      data={exportFormat === "json"
                        ? [{ value: "all", label: "全部数据（含预算与储蓄）" }]
                        : CSV_SCOPES}
                      disabled={exportFormat === "json"}
                      label="导出范围"
                      value={exportFormat === "json" ? "all" : exportScope}
                      onChange={value => value && setExportScope(value as ExportScope)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput
                      description="导出时自动追加时间戳和扩展名"
                      label="文件名前缀"
                      value={fileNamePrefix}
                      onChange={event => setFileNamePrefix(event.currentTarget.value)}
                    />
                  </Grid.Col>
                </Grid>

                {exportFormat === "csv" && exportScope === "custom" && (
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="开始日期"
                        type="date"
                        value={startDate}
                        onChange={event => setStartDate(event.currentTarget.value)}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="结束日期"
                        type="date"
                        value={endDate}
                        onChange={event => setEndDate(event.currentTarget.value)}
                      />
                    </Grid.Col>
                  </Grid>
                )}

                <Paper bg="gray.0" p="md" radius="md" withBorder>
                  <Group align="flex-start" gap="sm" wrap="nowrap">
                    <ThemeIcon color="indigo" variant="light"><IconInfoCircle size={19} /></ThemeIcon>
                    <Stack gap={3}>
                      <Text fw={600}>本次导出</Text>
                      <Text c="dimmed" size="sm">
                        {exportFormat === "json"
                          ? `完整数据快照，包含 ${transactionCount} 条账单以及全部预算和储蓄目标`
                          : exportScope === "all"
                            ? "全部账单，不包含预算和储蓄目标"
                            : exportScope === "month"
                              ? "本月账单，不包含预算和储蓄目标"
                              : "所选日期范围内的账单，不包含预算和储蓄目标"}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>

                <Group>
                  <Button
                    leftSection={<IconDownload size={18} />}
                    loading={exporting}
                    onClick={handleExport}
                  >
                    导出文件
                  </Button>
                  <Text c="dimmed" size="sm">文件只会下载到本机，不会上传</Text>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel pt="xl" value="import">
              <Stack gap="lg">
                <Stack gap={4}>
                  <Title order={3}>导入数据</Title>
                  <Text c="dimmed" size="sm">
                    读取 JSON 或 CSV 后先校验并预览。覆盖导入会在写入前自动备份当前数据。
                  </Text>
                </Stack>

                <Radio.Group
                  label="导入模式"
                  value={importMode}
                  onChange={value => setImportMode(value as ImportMode)}
                >
                  <Group gap="lg" mt={6}>
                    <Radio label="追加到现有账单" value="append" />
                    <Radio label="覆盖现有数据" value="overwrite" />
                  </Group>
                </Radio.Group>

                {importMode === "overwrite" && (
                  <Alert color="orange" icon={<IconAlertTriangle size={20} />} title="覆盖模式">
                    确认后会替换现有账单；JSON 完整备份还会替换预算和储蓄目标。系统会先自动备份当前数据。
                  </Alert>
                )}

                <DataFileDrop
                  accept=".json,.csv,application/json,text/csv"
                  description="支持 JSON 完整备份和 CSV 账单，拖放后立即校验"
                  fileName={importPreview?.fileName}
                  loading={readingImport}
                  onFile={handleImportFile}
                />

                {importPreview && (
                  <Paper p="md" radius="md" withBorder>
                    <Stack gap="md">
                      <PreviewSummary preview={importPreview} />
                      {importPreview.issues.length > 0 && (
                        <Table.ScrollContainer minWidth={440}>
                          <Table>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th w={90}>位置</Table.Th>
                                <Table.Th>错误原因</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {importPreview.issues.slice(0, 8).map((issue, index) => (
                                <Table.Tr key={`${issue.row ?? "file"}-${index}`}>
                                  <Table.Td>{issue.row ? `第 ${issue.row} 行` : "文件"}</Table.Td>
                                  <Table.Td>{issue.message}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </Table.ScrollContainer>
                      )}
                    </Stack>
                  </Paper>
                )}

                <Group>
                  <Button
                    disabled={!canImport}
                    leftSection={<IconUpload size={18} />}
                    onClick={() => setImportConfirmOpen(true)}
                  >
                    确认导入
                  </Button>
                  {importPreview && !canImport && (
                    <Text c="red.7" size="sm">
                      {importPreview.issues.length > 0
                        ? "JSON 文件存在错误，请修正后重新选择"
                        : "文件中没有可导入的有效账单"}
                    </Text>
                  )}
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel pt="xl" value="backup">
              <Stack gap="lg">
                <Group align="flex-end" justify="space-between" wrap="wrap">
                  <Stack gap={4}>
                    <Title order={3}>备份管理</Title>
                    <Text c="dimmed" size="sm">
                      备份保存在浏览器本地，文件名包含创建时间。建议同时下载重要备份另存。
                    </Text>
                  </Stack>
                  <Button
                    leftSection={<IconArchive size={18} />}
                    loading={backingUp}
                    onClick={handleManualBackup}
                  >
                    立即备份
                  </Button>
                </Group>

                <BackupTable
                  backups={backups}
                  onDownload={handleDownloadBackup}
                  onView={handleViewBackup}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel pt="xl" value="restore">
              <Stack gap="lg">
                <Stack gap={4}>
                  <Title order={3}>恢复数据</Title>
                  <Text c="dimmed" size="sm">
                    选择应用内备份或上传 JSON 备份。恢复前会展示摘要并再次确认，同时自动备份当前数据。
                  </Text>
                </Stack>

                <SegmentedControl
                  data={[
                    { value: "library", label: "应用内备份" },
                    { value: "file", label: "上传备份文件" },
                  ]}
                  fullWidth
                  value={restoreSource}
                  onChange={(value) => {
                    setRestoreSource(value as RestoreSource);
                    setRestoreCandidate(null);
                    setSelectedBackupId(null);
                  }}
                />

                {restoreSource === "library" && backups.length > 0 && (
                  <Select
                    clearable
                    data={backupOptions}
                    label="选择备份"
                    placeholder="请选择要恢复的备份"
                    value={selectedBackupId}
                    onChange={handleSelectBackup}
                  />
                )}
                {restoreSource === "library" && backups.length === 0 && (
                  <Alert color="gray" icon={<IconInfoCircle size={20} />}>
                    还没有本地备份，请先在“备份管理”中立即备份，或上传 JSON 备份文件。
                  </Alert>
                )}
                {restoreSource === "file" && (
                  <DataFileDrop
                    accept=".json,application/json"
                    description="仅支持校验通过的完整 JSON 备份，上传后先展示恢复摘要"
                    fileName={restoreCandidate?.name}
                    loading={readingRestore}
                    onFile={handleRestoreFile}
                  />
                )}

                {restoreCandidate && (
                  <Paper p="md" radius="md" withBorder>
                    <Stack gap="md">
                      <Group gap="xs" wrap="wrap">
                        <ThemeIcon color="teal" variant="light"><IconRestore size={19} /></ThemeIcon>
                        <Text fw={600}>{restoreCandidate.name}</Text>
                        <Badge variant="outline">
                          {restoreCandidate.source === "library" ? "应用内备份" : "上传文件"}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        {`创建或修改时间：${formatDateTime(restoreCandidate.createdAt)} · ${formatFileSize(new Blob([createJson(restoreCandidate.snapshot)]).size)}`}
                      </Text>
                      <SnapshotCounts
                        budgets={restoreCandidate.snapshot.budgets.length}
                        savingsGoals={restoreCandidate.snapshot.savingsGoals.length}
                        transactions={restoreCandidate.snapshot.transactions.length}
                      />
                      <Group>
                        <Button
                          color="red"
                          leftSection={<IconRestore size={18} />}
                          onClick={() => setRestoreConfirmOpen(true)}
                        >
                          恢复此备份
                        </Button>
                        <Text c="dimmed" size="sm">下一步仍需二次确认</Text>
                      </Group>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>

      <Modal
        centered
        opened={importConfirmOpen}
        size="lg"
        title="确认导入数据"
        onClose={() => !importing && setImportConfirmOpen(false)}
      >
        {importPreview && (
          <Stack gap="md">
            <Alert
              color={importMode === "overwrite" ? "red" : "indigo"}
              icon={importMode === "overwrite"
                ? <IconAlertTriangle size={20} />
                : <IconCheck size={20} />}
              title={importMode === "overwrite" ? "将覆盖当前数据" : "将追加账单"}
            >
              {importMode === "overwrite"
                ? "系统会先创建自动备份，再执行覆盖。写入失败时原数据保持不变。"
                : "现有数据不会被删除，只会追加预览中校验通过的账单。"}
            </Alert>
            <PreviewSummary preview={importPreview} />
            <Group justify="flex-end">
              <Button disabled={importing} variant="default" onClick={() => setImportConfirmOpen(false)}>
                取消
              </Button>
              <Button loading={importing} onClick={executeImport}>
                确认导入
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        centered
        opened={Boolean(viewedBackup)}
        size="lg"
        title="备份详情"
        onClose={() => setViewedBackup(null)}
      >
        {viewedBackup && (
          <Stack gap="md">
            <Stack gap={4}>
              <Text fw={600}>{viewedBackup.name}</Text>
              <Text c="dimmed" size="sm">{BACKUP_KIND_LABELS[viewedBackup.kind]}</Text>
            </Stack>
            <Text>{`创建时间：${formatDateTime(viewedBackup.createdAt)}`}</Text>
            <Text>{`文件大小：${formatFileSize(viewedBackup.size)}`}</Text>
            <SnapshotCounts
              budgets={viewedBackup.snapshot.budgets.length}
              savingsGoals={viewedBackup.snapshot.savingsGoals.length}
              transactions={viewedBackup.snapshot.transactions.length}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setViewedBackup(null)}>关闭</Button>
              <Button
                leftSection={<IconDownload size={17} />}
                onClick={() => handleDownloadBackup(viewedBackup)}
              >
                下载备份
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        centered
        opened={restoreConfirmOpen}
        title="再次确认恢复"
        onClose={() => !restoring && setRestoreConfirmOpen(false)}
      >
        {restoreCandidate && (
          <Stack gap="md">
            <Alert color="red" icon={<IconAlertTriangle size={20} />} title="恢复将覆盖当前数据">
              当前账单、预算和储蓄目标会被备份内容替换。系统会先自动备份当前数据，恢复失败时保留原数据。
            </Alert>
            <Text fw={600}>{restoreCandidate.name}</Text>
            <SnapshotCounts
              budgets={restoreCandidate.snapshot.budgets.length}
              savingsGoals={restoreCandidate.snapshot.savingsGoals.length}
              transactions={restoreCandidate.snapshot.transactions.length}
            />
            <Group justify="flex-end">
              <Button disabled={restoring} variant="default" onClick={() => setRestoreConfirmOpen(false)}>
                取消
              </Button>
              <Button color="red" loading={restoring} onClick={executeRestore}>
                确认恢复
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
