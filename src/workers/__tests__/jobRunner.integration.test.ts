import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type {
  ScanCompletion,
  ScanConfig,
  WorkerResponse,
  WorkerStartRequest,
} from '@/types';
import { PROTOCOL_VERSION } from '@/types';
import { createDefaultScanConfig } from '@/core/config';
import { createCancelSignal, runJob } from '@/workers/jobRunner';

async function runZip(
  files: Record<string, string>,
  config: ScanConfig = createDefaultScanConfig(),
): Promise<WorkerResponse[]> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const data = await zip.generateAsync({ type: 'arraybuffer' });
  const messages: WorkerResponse[] = [];
  const request: WorkerStartRequest = {
    protocol: PROTOCOL_VERSION,
    type: 'job:start',
    jobId: 'job-integration',
    config,
    payload: {
      source: 'zip',
      fileName: 'test.zip',
      sizeBytes: data.byteLength,
      data,
    },
  };
  await runJob(request, (message) => messages.push(message), createCancelSignal());
  return messages;
}

function completionOf(messages: WorkerResponse[]): ScanCompletion {
  const done = messages.find((message) => message.type === 'job:done');
  if (!done || done.type !== 'job:done') {
    throw new Error('未收到 job:done');
  }
  return done.completion;
}

describe('作业编排集成', () => {
  it('ACC-01/03/04/06：核心命中与脱敏', async () => {
    const messages = await runZip({
      'config.js': 'const url = "http://example.com/a"; // 正常注释\n// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"\n',
      'README.md': '# 说明\n\n内部服务 10.20.30.40:8080\n连接串 mysql://root:Passw0rd@10.1.2.3:3306/db\n',
      'main.py': '"""数据库密码: Admin@123"""\n',
      'main.go': 'package main\n// TODO: 测试账号 test/test 上线前删掉\n',
    });

    const findings = messages
      .filter((message) => message.type === 'job:findings')
      .flatMap((message) => (message.type === 'job:findings' ? message.batch.findings : []));

    expect(findings.some((finding) => finding.ruleId === 'CLS-R-001')).toBe(true);
    expect(
      findings.some(
        (finding) =>
          finding.ruleId === 'CLS-R-012' && finding.severity === 'critical',
      ),
    ).toBe(true);
    expect(
      findings.some((finding) => finding.ruleId === 'CLS-R-015' && finding.severity === 'high'),
    ).toBe(true);
    expect(
      findings.some(
        (finding) => finding.ruleId === 'CLS-R-011' && finding.sourceKind === 'docstring',
      ),
    ).toBe(true);
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-018')).toBe(true);

    const json = JSON.stringify(findings);
    expect(json).not.toContain('AKIAABCDEFGHIJKLMNOP');
    expect(json).not.toContain('Passw0rd');
    expect(json).not.toContain('Admin@123');

    const completion = completionOf(messages);
    expect(completion.summary.status).toBe('completed');
    expect(completion.summary.scannedFiles).toBe(4);
  });

  it('ACC-05：忽略目录/类型/二进制并登记跳过', async () => {
    const zip = new JSZip();
    zip.file('app.min.js', '// password=Admin@123');
    zip.file('node_modules/left-pad/index.js', '// dep');
    zip.file('logo.png', new Uint8Array([137, 80, 78, 71]), { binary: true });
    zip.file('src/main.js', '// clean');
    const data = await zip.generateAsync({ type: 'arraybuffer' });

    const messages: WorkerResponse[] = [];
    await runJob(
      {
        protocol: PROTOCOL_VERSION,
        type: 'job:start',
        jobId: 'job-skip',
        config: createDefaultScanConfig(),
        payload: { source: 'zip', fileName: 'skip.zip', sizeBytes: data.byteLength, data },
      },
      (message) => messages.push(message),
      createCancelSignal(),
    );

    const skipped = messages
      .filter((message) => message.type === 'job:skipped')
      .flatMap((message) =>
        message.type === 'job:skipped' ? message.batch.items : [],
      );
    expect(skipped.some((item) => item.path === 'app.min.js' && item.reason === 'ignored-type')).toBe(
      true,
    );
    expect(
      skipped.some(
        (item) =>
          item.path === 'node_modules/left-pad/index.js' &&
          item.reason === 'ignored-directory',
      ),
    ).toBe(true);
    expect(skipped.some((item) => item.path === 'logo.png' && item.reason === 'non-text')).toBe(
      true,
    );
  });

  it('ACC-13：无可扫描文件返回 empty 状态', async () => {
    const zip = new JSZip();
    zip.file('logo.png', new Uint8Array([137, 80, 78, 71]), { binary: true });
    zip.file('node_modules/left-pad/index.js', '// dep');
    const data = await zip.generateAsync({ type: 'arraybuffer' });

    const messages: WorkerResponse[] = [];
    await runJob(
      {
        protocol: PROTOCOL_VERSION,
        type: 'job:start',
        jobId: 'job-empty',
        config: createDefaultScanConfig(),
        payload: { source: 'zip', fileName: 'empty.zip', sizeBytes: data.byteLength, data },
      },
      (message) => messages.push(message),
      createCancelSignal(),
    );

    const completion = completionOf(messages);
    expect(completion.summary.status).toBe('empty');
    expect(completion.skippedTotal).toBe(2);
  });

  it('取消后发送 job:cancelled 且不发送 job:done', async () => {
    const zip = new JSZip();
    zip.file('config.js', '// password=Admin@123');
    const data = await zip.generateAsync({ type: 'arraybuffer' });

    const messages: WorkerResponse[] = [];
    const signal = createCancelSignal();
    signal.cancel();
    await runJob(
      {
        protocol: PROTOCOL_VERSION,
        type: 'job:start',
        jobId: 'job-cancel',
        config: createDefaultScanConfig(),
        payload: { source: 'zip', fileName: 'cancel.zip', sizeBytes: data.byteLength, data },
      },
      (message) => messages.push(message),
      signal,
    );

    expect(messages.some((message) => message.type === 'job:cancelled')).toBe(true);
    expect(messages.some((message) => message.type === 'job:done')).toBe(false);
  });

  it('批次序号单调递增且 done 在最后', async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 250; index += 1) {
      files[`src/f-${String(index).padStart(3, '0')}.js`] = '// password=Admin@123';
    }
    const messages = await runZip(files);
    const sequences = messages
      .filter(
        (message) => message.type === 'job:findings' || message.type === 'job:skipped',
      )
      .map((message) =>
        message.type === 'job:findings' || message.type === 'job:skipped'
          ? message.batch.sequence
          : -1,
      );
    for (let index = 1; index < sequences.length; index += 1) {
      expect(sequences[index]).toBeGreaterThan(sequences[index - 1] ?? -1);
    }
    expect(messages[messages.length - 1]?.type).toBe('job:done');
  });
});