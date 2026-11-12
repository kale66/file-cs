import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@/types';
import { classifyInbound, isWorkerResponse } from '@/workers/protocol';

const JOB = 'job-1';

describe('协议 v2 解析与归因', () => {
  it('接受匹配 jobId 的 progress', () => {
    const value = {
      protocol: PROTOCOL_VERSION,
      type: 'job:progress',
      event: {
        jobId: JOB,
        phase: 'scanning',
        percent: 10,
        processed: 1,
        total: 10,
        currentPath: null,
        elapsedMs: 1,
      },
    };
    const result = classifyInbound(value, JOB);
    expect(result.kind).toBe('accepted');
  });

  it('协议版本不匹配优先于结构判定', () => {
    const result = classifyInbound(
      { protocol: 1, type: 'job:progress', event: { jobId: JOB } },
      JOB,
    );
    expect(result.kind).toBe('protocol-mismatch');
    if (result.kind === 'protocol-mismatch') {
      expect(result.received).toBe(1);
    }
  });

  it('旧作业消息归为 stale', () => {
    const result = classifyInbound(
      {
        protocol: PROTOCOL_VERSION,
        type: 'job:progress',
        event: {
          jobId: 'job-old',
          phase: 'scanning',
          percent: 1,
          processed: 1,
          total: 1,
          currentPath: null,
          elapsedMs: 1,
        },
      },
      JOB,
    );
    expect(result.kind).toBe('stale');
  });

  it('未知类型归为 invalid', () => {
    expect(classifyInbound({ protocol: PROTOCOL_VERSION, type: 'x' }, JOB).kind).toBe(
      'invalid',
    );
    expect(classifyInbound(null, JOB).kind).toBe('invalid');
    expect(classifyInbound([], JOB).kind).toBe('invalid');
  });

  it('job:error 必须携带 jobId，否则 invalid', () => {
    expect(
      isWorkerResponse({
        protocol: PROTOCOL_VERSION,
        type: 'job:error',
        failure: { code: 'CLS-E-1003' },
      }),
    ).toBe(false);
    expect(
      isWorkerResponse({
        protocol: PROTOCOL_VERSION,
        type: 'job:error',
        jobId: JOB,
        failure: { code: 'CLS-E-1003' },
      }),
    ).toBe(true);
  });

  it('job:pong 被识别并校验归属', () => {
    const pong = {
      protocol: PROTOCOL_VERSION,
      type: 'job:pong',
      jobId: JOB,
      phase: 'running',
    };
    expect(isWorkerResponse(pong)).toBe(true);
    expect(classifyInbound(pong, JOB).kind).toBe('accepted');
    expect(classifyInbound(pong, 'other-job').kind).toBe('stale');
  });
});