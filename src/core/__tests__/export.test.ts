import { describe, expect, it } from 'vitest';
import type { ExportFinding, Finding, ScanResult } from '@/types';
import { createDefaultScanConfig } from '@/core/config';
import { RULE_CATALOG } from '@/core/rules';
import {
  buildExportReport,
  buildPathList,
  escapeCsvCell,
  toCsv,
} from '@/core/export';

function sampleFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-1',
    ruleId: 'CLS-R-001',
    ruleName: 'AWS Access Key',
    severity: 'critical',
    filePath: 'config.js',
    line: 2,
    maskedSnippet: 'const AWS_KEY = "AKIA************MNOP"',
    context: { before: null, after: null },
    sourceKind: 'line-comment',
    inCodeFence: false,
    description: '说明',
    suggestion: '建议',
    suppressedRuleIds: [],
    snippetTruncated: false,
    ...overrides,
  };
}

function sampleResult(): ScanResult {
  return {
    jobId: 'job-1',
    config: createDefaultScanConfig(),
    summary: {
      totalFiles: 1,
      scannedFiles: 1,
      skippedFiles: 0,
      riskFiles: 1,
      severityCounts: { critical: 1, high: 0, medium: 0, low: 0 },
      durationMs: 12,
      status: 'completed',
    },
    findings: [sampleFinding()],
    skippedFiles: [],
    skipReasonCounts: {
      'ignored-directory': 0,
      'ignored-type': 0,
      'too-large': 0,
      'unsupported-extension': 0,
      'illegal-path': 0,
      'parse-error': 0,
      'non-text': 0,
      'archive-encrypted': 0,
    },
    diagnostics: [],
  };
}

describe('CSV 转义与编码', () => {
  it('公式注入前置单引号', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@x')).toBe("'@x");
    expect(escapeCsvCell('\tx')).toBe("'\tx");
  });

  it('逗号引号与换行包裹', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
  });

  it('CSV 含 BOM、CRLF 与 13 列', () => {
    const exported: ExportFinding = {
      id: 'f-1',
      ruleId: 'CLS-R-001',
      ruleName: 'AWS Access Key',
      severity: 'critical',
      filePath: '=SUM(A1).js',
      line: 2,
      maskedSnippet: 'AKIA************MNOP',
      context: { before: null, after: null },
      sourceKind: 'line-comment',
      inCodeFence: false,
      description: '说明',
      suggestion: '建议',
      suppressedRuleIds: [],
    };
    const csv = toCsv([exported]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('\r\n');
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.split(',')).toHaveLength(13);
    expect(csv).toContain("'=SUM(A1).js");
    expect(csv).not.toContain('AKIAABCDEFGHIJKLMNOP');
  });
});

describe('报告与路径清单', () => {
  it('JSON 报告不含 raw 字段与完整密钥', () => {
    const result = sampleResult();
    const report = buildExportReport({
      result,
      ruleCatalog: RULE_CATALOG,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    const json = JSON.stringify(report);
    expect(json).not.toContain('rawSnippet');
    expect(json).not.toContain('AKIAABCDEFGHIJKLMNOP');
    expect(report.version).toBe('1.0');
    expect(report.ruleCatalog).toHaveLength(RULE_CATALOG.length);
    expect(report.ruleCatalog.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        'CLS-R-022',
        'CLS-R-023',
        'CLS-R-024',
        'CLS-R-025',
        'CLS-R-026',
      ]),
    );
  });

  it('路径清单去重排序且仅含路径', () => {
    const findings = [
      sampleFinding({ filePath: 'b.js' }),
      sampleFinding({ filePath: 'a.js' }),
      sampleFinding({ filePath: 'b.js', id: 'f-2' }),
    ];
    expect(buildPathList(findings)).toBe('a.js\nb.js');
  });
});