import { useState } from 'react';
import type { DiagnosticsSnapshot } from '@/types';
import { Button } from '@/ui/Button';
import {
  buildReportFileStem,
  copyTextToClipboard,
  downloadTextFile,
} from '@/core/export';
import { snapshotToJson } from '@/core/diagnostics';

export interface DiagnosticsPanelProps {
  readonly snapshot: DiagnosticsSnapshot;
  readonly compact?: boolean;
}

export function DiagnosticsPanel({
  snapshot,
  compact = false,
}: DiagnosticsPanelProps): JSX.Element {
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleCopy = (): void => {
    const json = snapshotToJson(snapshot);
    void (async () => {
      const ok = await copyTextToClipboard(json);
      setManualCopy(ok ? null : json);
    })();
  };

  const handleExport = (): void => {
    try {
      downloadTextFile(
        `${buildReportFileStem(new Date(), 'commentleak-diagnostics')}.json`,
        snapshotToJson(snapshot),
        'application/json;charset=utf-8',
      );
      setExportError(null);
    } catch {
      setExportError('CLS-E-3001 · 下载被浏览器拦截，请使用“复制诊断信息”。');
    }
  };

  const json = snapshotToJson(snapshot);

  return (
    <div
      className={
        compact
          ? 'mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950'
          : 'mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950'
      }
    >
      <p className="text-[11px] text-slate-600 dark:text-slate-300">
        诊断信息仅含运行元数据，不含文件名、路径、注释片段与密钥。
      </p>
      <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
        诊断编号：{snapshot.diagnosticId}
      </p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded border border-slate-200 bg-white p-2 font-mono text-[10px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        {json}
      </pre>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleExport}>
          导出诊断 JSON
        </Button>
        <Button onClick={handleCopy}>复制诊断信息</Button>
      </div>
      {exportError ? (
        <p className="mt-2 text-[11px] text-red-700 dark:text-red-300">{exportError}</p>
      ) : null}
      {manualCopy ? (
        <textarea
          readOnly
          value={manualCopy}
          rows={6}
          aria-label="诊断信息文本"
          className="mt-2 w-full rounded border border-slate-300 bg-white p-2 font-mono text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
      ) : null}
    </div>
  );
}