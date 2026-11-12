import { LIMITS, REPORT_VERSION } from '@/types';
import type {
  ExportFinding,
  ExportReport,
  ExportReportInput,
  Finding,
  Severity,
  SourceKind,
} from '@/types';
import { ClsError } from '@/core/errors';
import { scrubForExport } from '@/core/redact';
import { comparePathAsc } from '@/core/path';

const SEVERITY_LABELS: Readonly<Record<Severity, string>> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
};

const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
  'line-comment': '行注释',
  'block-comment': '块注释',
  docstring: '文档字符串',
  document: '文档正文',
  config: '配置文件',
  'fence-sample': '代码围栏示例',
};

const CSV_HEADER = [
  '序号',
  '级别',
  '规则ID',
  '规则名称',
  '文件路径',
  '行号',
  '来源类型',
  '疑似示例',
  '脱敏片段',
  '上文',
  '下文',
  '说明',
  '修复建议',
] as const;

export function buildExportReport(args: ExportReportInput): ExportReport {
  const findings = args.result.findings.map(scrubForExport);
  return {
    version: REPORT_VERSION,
    generatedAt: args.generatedAt,
    config: {
      ...args.result.config,
      ignoreGroups: { ...args.result.config.ignoreGroups },
    },
    summary: { ...args.result.summary },
    findings,
    skippedFiles: args.result.skippedFiles.map((item) => ({ ...item })),
    ruleCatalog: args.ruleCatalog.map((item) => ({ ...item })),
    diagnostics: args.result.diagnostics.map((item) => ({ ...item })),
  };
}

export function escapeCsvCell(value: string): string {
  let cell = value ?? '';
  if (/^[=+\-@\t\r]/.test(cell)) {
    cell = `'${cell}`;
  }
  if (/[",\r\n]/.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function toCsv(findings: readonly ExportFinding[]): string {
  const rows: string[] = [];
  rows.push(CSV_HEADER.map(escapeCsvCell).join(','));
  findings.forEach((finding, index) => {
    const cells: string[] = [
      String(index + 1),
      SEVERITY_LABELS[finding.severity],
      finding.ruleId,
      finding.ruleName,
      finding.filePath,
      String(finding.line),
      SOURCE_LABELS[finding.sourceKind],
      finding.inCodeFence ? '是' : '否',
      finding.maskedSnippet,
      finding.context.before ?? '',
      finding.context.after ?? '',
      finding.description,
      finding.suggestion,
    ];
    rows.push(cells.map(escapeCsvCell).join(','));
  });
  return `\uFEFF${rows.join('\r\n')}`;
}

export function buildPathList(findings: readonly Finding[]): string {
  const unique = [...new Set(findings.map((finding) => finding.filePath))];
  unique.sort(comparePathAsc);
  return unique.join('\n');
}

export function downloadTextFile(fileName: string, content: string, mime: string): void {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    throw new ClsError('CLS-E-3001');
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function buildReportFileStem(now: Date, prefix = 'commentleak-report'): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function toJsonReport(report: ExportReport): string {
  return JSON.stringify(report, null, 2);
}

export const EXPORT_LIMITS = {
  maxCsvBytes: LIMITS.skippedPreviewCount,
} as const;