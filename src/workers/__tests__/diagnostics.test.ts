import { describe, expect, it } from 'vitest';
import type { DiagnosticsSnapshot } from '@/types';
import { PROTOCOL_VERSION } from '@/types';
import {
  EMPTY_COUNTERS,
  assertSnapshotSafe,
  buildDiagnosticsSnapshot,
  createDiagnosticId,
  currentBuildMode,
  currentPageProtocol,
  snapshotToJson,
} from '@/core/diagnostics';

const snapshot = buildDiagnosticsSnapshot({
  diagnosticId: 'diag-test-0001',
  generatedAt: '2026-11-12T00:00:00.000Z',
  appVersion: '1.0.0',
  buildMode: 'standard',
  pageProtocol: 'https',
  engineAvailable: true,
  engineSource: 'external',
  protocolVersion: 2,
  counters: { ...EMPTY_COUNTERS, progress: 3, ping: 2, pong: 2 },
  lastFailure: {
    code: 'CLS-E-1015',
    message: '后台扫描引擎已停止响应，已切换为主线程继续扫描。',
    hint: '无需操作。',
    fatal: false,
    category: 'timeout',
    phase: 'running',
  },
  degraded: true,
  degradeReason: 'timeout',
  phase: 'scanning',
  elapsedMs: 8123,
});

describe('诊断快照', () => {
  it('只包含白名单元数据', () => {
    expect(snapshot.schema).toBe(1);
    expect(snapshot.protocolExpected).toBe(PROTOCOL_VERSION);
    expect(snapshot.lastFailure?.code).toBe('CLS-E-1015');
    expect(snapshot.lastFailure?.category).toBe('timeout');
    expect(snapshot.counters.progress).toBe(3);
    const keys = Object.keys(snapshot);
    expect(keys).not.toContain('jobId');
    expect(keys).not.toContain('fileName');
    expect(keys).not.toContain('findings');
  });

  it('序列化后不包含路径、密钥、堆栈或 jobId 字段', () => {
    const json = snapshotToJson(snapshot);
    expect(json).not.toMatch(/[A-Za-z]:\\/);
    expect(json).not.toContain('jobId');
    expect(json).not.toContain('AKIA');
    expect(json).not.toContain('Passw0rd');
    expect(json).not.toContain('stack');
    expect(json).toContain('diag-test-0001');
  });

  it('非法字段会被安全断言拦截', () => {
    const unsafe = {
      ...snapshot,
      phase: 'C:\\Users\\secret\\file.js',
    } as DiagnosticsSnapshot;
    expect(() => assertSnapshotSafe(unsafe)).toThrow();

    const withKey = {
      ...snapshot,
      rawSnippet: 'AKIAABCDEFGHIJKLMNOP',
    } as unknown as DiagnosticsSnapshot;
    expect(() => assertSnapshotSafe(withKey)).toThrow();
  });

  it('环境探测函数返回枚举值', () => {
    expect(['http', 'https', 'file', 'other']).toContain(currentPageProtocol());
    expect(['standard', 'single']).toContain(currentBuildMode());
    expect(createDiagnosticId()).toMatch(/^diag-[a-z0-9]+-[a-z0-9]+$/);
  });
});