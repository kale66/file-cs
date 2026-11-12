import { useCallback, useMemo, useState } from 'react';
import type {
  ConfigChangeNotice,
  DiagnosticsSnapshot,
  FilterState,
  FolderFilePayload,
  ScanConfig,
  ScanResult,
  Severity,
  StartPayload,
  WorkerFailure,
} from '@/types';
import { ClsError, toErrorInfo } from '@/core/errors';
import { createDefaultScanConfig, withConfigChange } from '@/core/config';
import { RULE_CATALOG } from '@/core/rules';
import { scrubForExport } from '@/core/redact';
import {
  buildExportReport,
  buildPathList,
  buildReportFileStem,
  copyTextToClipboard,
  downloadTextFile,
  toCsv,
  toJsonReport,
} from '@/core/export';
import { UploadDropzone } from '@/ui/UploadDropzone';
import { ProgressPanel } from '@/ui/ProgressPanel';
import { ErrorState } from '@/ui/ErrorState';
import { EmptyState } from '@/ui/EmptyState';
import { SummaryCards } from '@/ui/SummaryCards';
import { ResultToolbar } from '@/ui/ResultToolbar';
import { FindingsTable } from '@/ui/FindingsTable';
import { RevealDialog } from '@/ui/RevealDialog';
import { SkippedFilesPanel } from '@/ui/SkippedFilesPanel';
import { ConfigPanels } from '@/ui/ConfigPanels';
import { PrivacyNotice } from '@/ui/PrivacyNotice';
import { DiagnosticsPanel } from '@/ui/DiagnosticsPanel';

import { useScanJob } from '@/ui/hooks/useScanJob';
import { useFilteredFindings } from '@/ui/hooks/useFilteredFindings';
import { rawSnippetStore } from '@/ui/hooks/rawSnippetStore';

const EMPTY_FILTER: FilterState = {
  severities: [],
  ruleIds: [],
  pathQuery: '',
  includeFenceSamples: true,
  onlyFenceSamples: false,
};

export default function App(): JSX.Element {
  const [config, setConfig] = useState<ScanConfig>(() => createDefaultScanConfig());
  const [notice, setNotice] = useState<ConfigChangeNotice | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  const [revealFindingId, setRevealFindingId] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [exportError, setExportError] = useState<WorkerFailure | null>(null);
  const [uploadError, setUploadError] = useState<WorkerFailure | null>(null);
  const [diagnosticsSnapshot, setDiagnosticsSnapshot] =
    useState<DiagnosticsSnapshot | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleResult = useCallback((next: ScanResult) => {
    setResult(next);
    setFilter(EMPTY_FILTER);
    setPage(1);
    setCopyFallback(null);
    setExportError(null);
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setFilter(EMPTY_FILTER);
    setPage(1);
    setRevealFindingId(null);
    setCopyFallback(null);
    setExportError(null);
    setUploadError(null);
  }, []);

  const job = useScanJob({
    config,
    onResult: handleResult,
    onReset: handleReset,
  });

  const busy = job.phase === 'validating' || job.phase === 'scanning';

  const filtered = useFilteredFindings(result?.findings ?? [], filter, page);
  const hasFindings = (result?.findings.length ?? 0) > 0;

  const revealFinding = useMemo(
    () => result?.findings.find((finding) => finding.id === revealFindingId) ?? null,
    [result, revealFindingId],
  );

  const displayError = job.error ?? uploadError;

  const handleShowDiagnostics = (): void => {
    setDiagnosticsSnapshot(job.buildDiagnostics());
    setShowDiagnostics(true);
  };

  const handleZip = async (file: File): Promise<void> => {
    setUploadError(null);
    const acquire = async (): Promise<StartPayload> => {
      const data = await file.arrayBuffer();
      return {
        source: 'zip',
        fileName: file.name,
        sizeBytes: file.size,
        data,
      };
    };
    try {
      const data = await file.arrayBuffer();
      job.start(
        {
          source: 'zip',
          fileName: file.name,
          sizeBytes: file.size,
          data,
        },
        acquire,
      );
    } catch {
      setUploadError({
        code: 'CLS-E-1010',
        message: '读取所选压缩包失败。',
        hint: '请确认文件未被其他程序占用，或重新打包后重试。',
        fatal: true,
      });
    }
  };

  const handleFolder = (files: FolderFilePayload[]): void => {
    setUploadError(null);
    const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
    const firstName = files[0]?.path ?? 'folder';
    const folderName = firstName.includes('/')
      ? (firstName.split('/')[0] ?? 'folder')
      : 'folder';
    const payload: StartPayload = {
      source: 'folder',
      folderName,
      files,
      totalBytes,
    };
    job.start(payload, async () => payload);
  };

  const handleConfigChange = (
    patch: Partial<
      Pick<ScanConfig, 'ignoreGroups' | 'scanPythonDocstring' | 'scanContactInfo'>
    >,
  ): void => {
    const changed = withConfigChange(config, patch);
    setConfig(changed.config);
    setNotice(changed.notice);
  };

  const handleSelectSeverity = (severity: Severity): void => {
    setFilter((current) => ({
      ...current,
      severities: current.severities.includes(severity)
        ? current.severities.filter((item) => item !== severity)
        : [...current.severities, severity],
    }));
    setPage(1);
  };

  const handleExportJson = (): void => {
    if (!result) return;
    setExportError(null);
    try {
      const report = buildExportReport({
        result,
        ruleCatalog: RULE_CATALOG,
        generatedAt: new Date().toISOString(),
      });
      downloadTextFile(
        `${buildReportFileStem(new Date())}.json`,
        toJsonReport(report),
        'application/json;charset=utf-8',
      );
    } catch (error) {
      const info = toErrorInfo(error);
      setExportError({
        code: info.code,
        message: info.message,
        hint: info.hint,
        fatal: info.fatal,
      });
    }
  };

  const handleExportCsv = (): void => {
    if (!result) return;
    setExportError(null);
    try {
      const exportFindings = result.findings.map(scrubForExport);
      downloadTextFile(
        `${buildReportFileStem(new Date())}.csv`,
        toCsv(exportFindings),
        'text/csv;charset=utf-8',
      );
    } catch (error) {
      const info = toErrorInfo(error);
      setExportError({
        code: info.code,
        message: info.message,
        hint: info.hint,
        fatal: info.fatal,
      });
    }
  };

  const handleCopyPaths = async (): Promise<void> => {
    if (!result) return;
    const pathList = buildPathList(result.findings);
    const ok = await copyTextToClipboard(pathList);
    setCopyFallback(ok ? null : pathList);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-2 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              CommentLeak Scanner
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              注释敏感信息扫描器 · 开源仓库提交前自查 · 全本地运行
            </p>
          </div>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            v{__APP_VERSION__}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-5">
        <PrivacyNotice variant="top" />

        <UploadDropzone
          disabled={busy}
          onZip={(file) => {
            void handleZip(file);
          }}
          onFolder={handleFolder}
          onError={(failure) => {
            setUploadError(failure);
          }}
        />

        {job.channelIssue && !displayError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <p className="font-medium">
              {job.channelIssue.failure.code} · {job.channelIssue.failure.message}
            </p>
            <p className="mt-1">{job.channelIssue.failure.hint}</p>
            <button
              type="button"
              onClick={handleShowDiagnostics}
              className="cls-focus mt-1 underline decoration-amber-500 underline-offset-2"
            >
              查看诊断信息
            </button>
          </div>
        ) : null}

        {job.degraded && !busy && !job.channelIssue && job.phase !== 'result' && job.phase !== 'empty' ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            CLS-E-4001 · 当前浏览器不支持后台扫描，将降级为主线程处理；处理大文件时页面可能短暂卡顿。
          </p>
        ) : null}

        {busy ? (
          <ProgressPanel
            progress={job.progress}
            degraded={job.degraded}
            channelIssue={job.channelIssue}
            currentJobId={job.activeJobId}
            onCancel={job.cancel}
            busy={busy}
            onShowDiagnostics={handleShowDiagnostics}
          />
        ) : null}

        {displayError ? (
          <div className="space-y-2">
            <ErrorState
              failure={displayError}
              onRetry={() => {
                setUploadError(null);
                setShowDiagnostics(false);
                setDiagnosticsSnapshot(null);
                job.reset();
              }}
              diagnostics={showDiagnostics ? diagnosticsSnapshot : null}
              onShowDiagnostics={handleShowDiagnostics}
            />
            {showDiagnostics && diagnosticsSnapshot ? (
              <DiagnosticsPanel snapshot={diagnosticsSnapshot} />
            ) : null}
          </div>
        ) : null}

        {job.phase === 'cancelled' ? (
          <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            已取消本次扫描，未保留任何中间结果。可以重新上传压缩包开始新的扫描。
          </section>
        ) : null}

        {showDiagnostics && diagnosticsSnapshot && !displayError ? (
          <DiagnosticsPanel snapshot={diagnosticsSnapshot} />
        ) : null}

        {job.phase === 'empty' && result ? (
          <EmptyState
            kind="no-scannable"
            summary={result.summary}
            onReset={job.reset}
          />
        ) : null}

        {job.phase === 'result' && result ? (
          hasFindings ? (
            <>
              <SummaryCards
                summary={result.summary}
                skipReasonCounts={result.skipReasonCounts}
                onSelectSeverity={handleSelectSeverity}
              />
              <ResultToolbar
                filter={filter}
                findings={result.findings}
                onFilterChange={(next) => {
                  setFilter(next);
                  setPage(1);
                }}
                page={page}
                pageCount={filtered.pageCount}
                onPageChange={setPage}
                totalCount={filtered.totalCount}
                visibleCount={filtered.visibleCount}
                onExportJson={handleExportJson}
                onExportCsv={handleExportCsv}
                onCopyPaths={() => {
                  void handleCopyPaths();
                }}
                copyFallback={copyFallback}
                exportError={exportError}
              />
              <FindingsTable
                groups={filtered.groups}
                onReveal={(finding) => setRevealFindingId(finding.id)}
              />
            </>
          ) : (
            <EmptyState kind="success" summary={result.summary} onReset={job.reset} />
          )
        ) : null}

        {result && (job.phase === 'result' || job.phase === 'empty') ? (
          <SkippedFilesPanel
            skippedFiles={result.skippedFiles}
            skipReasonCounts={result.skipReasonCounts}
          />
        ) : null}

        {result && result.diagnostics.length > 0 ? (
          <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <summary className="cls-focus cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              扫描诊断（{result.diagnostics.length}）
            </summary>
            <ul className="space-y-1 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              {result.diagnostics.slice(0, 50).map((diagnostic, index) => (
                <li
                  key={`${diagnostic.filePath}-${diagnostic.line ?? 0}-${index}`}
                  className="font-mono text-[11px] text-slate-600 dark:text-slate-300"
                >
                  {diagnostic.filePath}
                  {diagnostic.line !== null ? `:${diagnostic.line}` : ''} · [
                  {diagnostic.code}] {diagnostic.detail}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {notice ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            {notice.message}
          </p>
        ) : null}

        <ConfigPanels
          config={config}
          notice={notice}
          onConfigChange={handleConfigChange}
        />

        <p className="pb-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
          本工具为提交前自查辅助工具，不替代 gitleaks / trufflehog 等专业密钥扫描；密钥一旦进入 git 历史，仅删除注释不足，必须轮换密钥。
        </p>
      </main>

      <PrivacyNotice variant="bottom" />

      {revealFinding ? (
        <RevealDialog
          finding={revealFinding}
          onClose={() => {
            setRevealFindingId(null);
          }}
        />
      ) : null}
    </div>
  );
}

export function clearRevealStore(): void {
  rawSnippetStore.clear();
}

export { ClsError };