import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { LIMITS } from '@/types';
import type { FolderFilePayload, WorkerFailure } from '@/types';
import { Button } from '@/ui/Button';

export interface UploadDropzoneProps {
  readonly disabled: boolean;
  readonly onZip: (file: File) => void;
  readonly onFolder: (files: FolderFilePayload[]) => void;
  readonly onError: (failure: WorkerFailure) => void;
}

interface DataTransferItemWithEntry {
  webkitGetAsEntry?: () => FileSystemEntry | null;
}

const ZIP_LIMIT_LABEL = '100MB';

async function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  return new Promise((resolve, reject) => {
    const readBatch = (): void => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          readBatch();
        },
        (error) => reject(error),
      );
    };
    readBatch();
  });
}

async function collectEntry(
  entry: FileSystemEntry,
  prefix: string,
  output: FolderFilePayload[],
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
    output.push({
      path: `${prefix}${file.name}`,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      file,
    });
    return;
  }
  if (entry.isDirectory) {
    const directory = entry as FileSystemDirectoryEntry;
    const children = await readDirectoryEntries(directory.createReader());
    const nextPrefix = `${prefix}${directory.name}/`;
    for (const child of children) {
      await collectEntry(child, nextPrefix, output);
    }
  }
}

export function UploadDropzone({
  disabled,
  onZip,
  onFolder,
  onError,
}: UploadDropzoneProps): JSX.Element {
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [readingFolder, setReadingFolder] = useState(false);

  const handleZipFile = (file: File): void => {
    if (!/\.zip$/i.test(file.name)) {
      onError({
        code: 'CLS-E-1001',
        message: '请选择 zip 压缩包或文件夹。',
        hint: '仅支持 .zip 压缩包；若需扫描目录，请选择文件夹。',
        fatal: true,
      });
      return;
    }
    if (file.size > LIMITS.maxArchiveBytes) {
      onError({
        code: 'CLS-E-1002',
        message: `压缩包体积超过 ${ZIP_LIMIT_LABEL} 上限，已停止读取。`,
        hint: '请先在本地拆分压缩包后重新上传；工具不会读取超大文件内容。',
        fatal: true,
      });
      return;
    }
    onZip(file);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>): Promise<void> => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;

    const items = event.dataTransfer.items;
    const entries: FileSystemEntry[] = [];
    if (items) {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index] as unknown as DataTransferItemWithEntry | undefined;
        const entry = item?.webkitGetAsEntry?.() ?? null;
        if (entry) entries.push(entry);
      }
    }

    if (entries.some((entry) => entry.isDirectory)) {
      setReadingFolder(true);
      try {
        const collected: FolderFilePayload[] = [];
        for (const entry of entries) {
          await collectEntry(entry, '', collected);
        }
        if (collected.length === 0) {
          onError({
            code: 'CLS-E-1006',
            message: '文件夹为空，没有可处理的文件。',
            hint: '请选择包含文件的文件夹。',
            fatal: true,
          });
          return;
        }
        onFolder(collected);
      } catch {
        onError({
          code: 'CLS-E-1009',
          message: '无法读取拖入的文件夹。',
          hint: '请将目录打包为 zip 后再上传。',
          fatal: true,
        });
      } finally {
        setReadingFolder(false);
      }
      return;
    }

    const file = event.dataTransfer.files.item(0);
    if (file) handleZipFile(file);
  };

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const list = event.target.files;
    if (!list || list.length === 0) return;
    const files: FolderFilePayload[] = [];
    for (let index = 0; index < list.length; index += 1) {
      const file = list[index];
      if (!file) continue;
      const relative =
        (file as unknown as { webkitRelativePath?: string }).webkitRelativePath ??
        file.name;
      files.push({
        path: relative,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        file,
      });
    }
    if (files.length === 0) {
      onError({
        code: 'CLS-E-1006',
        message: '文件夹为空，没有可处理的文件。',
        hint: '请选择包含文件的文件夹。',
        fatal: true,
      });
      return;
    }
    onFolder(files);
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          void handleDrop(event);
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-800">
          ↑
        </div>
        <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">
          将 zip 压缩包或文件夹拖到这里
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          也可以选择本地文件；全部处理仅在本机浏览器内完成
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            disabled={disabled || readingFolder}
            onClick={() => zipInputRef.current?.click()}
          >
            选择 zip 文件
          </Button>
          <Button
            disabled={disabled || readingFolder}
            onClick={() => folderInputRef.current?.click()}
            title="选择文件夹后将按目录扫描"
          >
            选择文件夹
          </Button>
        </div>
        {readingFolder ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            正在读取文件夹……
          </p>
        ) : null}
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleZipFile(file);
            event.target.value = '';
          }}
        />
        <input
          ref={(element) => {
            folderInputRef.current = element;
            element?.setAttribute('webkitdirectory', '');
            element?.setAttribute('directory', '');
          }}
          type="file"
          multiple
          className="hidden"
          onChange={handleFolderChange}
        />
      </div>
    </div>
  );
}