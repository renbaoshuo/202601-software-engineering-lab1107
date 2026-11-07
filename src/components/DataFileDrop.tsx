import { Button, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconFileCheck, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";

interface DataFileDropProps {
  accept: string;
  description: string;
  fileName?: string;
  loading?: boolean;
  onFile: (file: File) => void;
}

export default function DataFileDrop({
  accept,
  description,
  fileName,
  loading = false,
  onFile,
}: DataFileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function chooseFile(file: File | undefined) {
    if (file) onFile(file);
  }

  return (
    <Paper
      withBorder
      p="xl"
      radius="md"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        chooseFile(event.dataTransfer.files[0]);
      }}
      style={{
        borderStyle: "dashed",
        borderWidth: 2,
        borderColor: dragging ? "var(--mantine-color-indigo-5)" : undefined,
        backgroundColor: dragging ? "var(--mantine-color-indigo-0)" : undefined,
      }}
    >
      <Stack align="center" gap="sm">
        <ThemeIcon color={fileName ? "teal" : "indigo"} size={48} radius="xl" variant="light">
          {fileName ? <IconFileCheck size={26} stroke={1.6} /> : <IconUpload size={26} stroke={1.6} />}
        </ThemeIcon>
        <Stack align="center" gap={4}>
          <Text fw={600}>{fileName ?? "拖放文件到这里"}</Text>
          <Text c="dimmed" size="sm" ta="center">{description}</Text>
        </Stack>
        <Group gap="xs">
          <input
            ref={inputRef}
            accept={accept}
            hidden
            type="file"
            onChange={(event) => {
              chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            loading={loading}
            variant="light"
            onClick={() => inputRef.current?.click()}
          >
            选择文件
          </Button>
          {fileName && <Text c="dimmed" size="sm">支持重新选择覆盖预览</Text>}
        </Group>
      </Stack>
    </Paper>
  );
}
