import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { WorkerResponse } from '@/types';
import { PROTOCOL_VERSION } from '@/types';
import { createDefaultScanConfig } from '@/core/config';
import { createCancelSignal, runJob } from '@/workers/jobRunner';

const fixtureUrl = new URL('../../../fixtures/acceptance.zip', import.meta.url);
const fixtureAvailable = existsSync(fixtureUrl);

async function runFixture(): Promise<WorkerResponse[]> {
  const buffer = readFileSync(fixtureUrl);
  const data = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const messages: WorkerResponse[] = [];
  await runJob(
    {
      protocol: PROTOCOL_VERSION,
      type: 'job:start',
      jobId: 'job-acceptance',
      config: createDefaultScanConfig(),
      payload: {
        source: 'zip',
        fileName: 'acceptance.zip',
        sizeBytes: data.byteLength,
        data,
      },
    },
    (message) => messages.push(message),
    createCancelSignal(),
  );
  return messages;
}

const describeFixture = fixtureAvailable ? describe : describe.skip;

describeFixture('验收夹具 acceptance.zip（需先执行 npm run fixtures）', () => {
  it('ACC-01/03/04/06/10：命中与脱敏符合预期', async () => {
    const messages = await runFixture();
    const findings = messages
      .filter((message) => message.type === 'job:findings')
      .flatMap((message) =>
        message.type === 'job:findings' ? message.batch.findings : [],
      );

    expect(
      findings.some(
        (finding) => finding.filePath === 'config.js' && finding.ruleId === 'CLS-R-001',
      ),
    ).toBe(true);

    expect(
      findings.some(
        (finding) =>
          finding.filePath === 'README.md' &&
          finding.ruleId === 'CLS-R-012' &&
          finding.severity === 'critical',
      ),
    ).toBe(true);
    expect(
      findings.some(
        (finding) =>
          finding.filePath === 'README.md' &&
          finding.ruleId === 'CLS-R-015' &&
          finding.severity === 'high',
      ),
    ).toBe(true);

    expect(
      findings.some(
        (finding) =>
          finding.filePath === 'main.py' &&
          finding.sourceKind === 'docstring' &&
          finding.severity === 'high',
      ),
    ).toBe(true);

    expect(
      findings.some(
        (finding) => finding.filePath === 'main.go' && finding.ruleId === 'CLS-R-018',
      ),
    ).toBe(true);

    const serialized = JSON.stringify(findings);
    expect(serialized).not.toContain('AKIAABCDEFGHIJKLMNOP');
    expect(serialized).not.toContain('Passw0rd');
    expect(serialized).not.toContain('Admin@123');
    expect(serialized).toContain('AKIA************MNOP');
  });

  it('ACC-05/13：忽略目录、类型、二进制并计入跳过', async () => {
    const messages = await runFixture();
    const skipped = messages
      .filter((message) => message.type === 'job:skipped')
      .flatMap((message) =>
        message.type === 'job:skipped' ? message.batch.items : [],
      );

    expect(
      skipped.some(
        (item) => item.path === 'app.min.js' && item.reason === 'ignored-type',
      ),
    ).toBe(true);
    expect(
      skipped.some(
        (item) =>
          item.path === 'node_modules/left-pad/index.js' &&
          item.reason === 'ignored-directory',
      ),
    ).toBe(true);
    expect(
      skipped.some((item) => item.path === 'logo.png' && item.reason === 'non-text'),
    ).toBe(true);
    expect(
      skipped.some(
        (item) => item.path === 'unknown.xyz' && item.reason === 'unsupported-extension',
      ),
    ).toBe(true);
    expect(
      skipped.some((item) => item.path === 'data.map' && item.reason === 'ignored-type'),
    ).toBe(true);
    expect(
      skipped.some((item) => item.path === 'yarn.lock' && item.reason === 'ignored-type'),
    ).toBe(true);
  });

  it('ACC-14/17：公式注入与 XSS 文件名作为普通路径保留并扫描', async () => {
    const messages = await runFixture();
    const findings = messages
      .filter((message) => message.type === 'job:findings')
      .flatMap((message) =>
        message.type === 'job:findings' ? message.batch.findings : [],
      );
    const paths = findings.map((finding) => finding.filePath);

    expect(paths).toContain('=SUM(A1).js');
    expect(paths).toContain('<img src=x onerror=alert(1)>.js');
  });

  it('作业在夹具上正常完成', async () => {
    const messages = await runFixture();
    const done = messages.find((message) => message.type === 'job:done');
    expect(done).toBeDefined();
    if (!done || done.type !== 'job:done') return;
    expect(done.completion.summary.status).toBe('completed');
    expect(done.completion.summary.scannedFiles).toBeGreaterThanOrEqual(8);
    expect(done.completion.skippedTotal).toBeGreaterThanOrEqual(6);
  });
});