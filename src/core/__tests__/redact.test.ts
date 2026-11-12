import { describe, expect, it } from 'vitest';
import type { Finding } from '@/types';
import {
  buildFindingContext,
  maskConnectionString,
  maskJwt,
  maskPrivateKey,
  maskUrlCredentials,
  maskValue,
  scrubForExport,
  truncateLine,
} from '@/core/redact';

function sampleFinding(): Finding {
  return {
    id: 'f-1',
    ruleId: 'CLS-R-001',
    ruleName: 'AWS Access Key',
    severity: 'critical',
    filePath: 'config.js',
    line: 2,
    maskedSnippet: 'const AWS_KEY = "AKIA************MNOP"',
    context: { before: '// 配置', after: null },
    sourceKind: 'line-comment',
    inCodeFence: false,
    description: '说明',
    suggestion: '建议',
    suppressedRuleIds: ['CLS-R-011'],
    snippetTruncated: false,
  };
}

describe('值级脱敏', () => {
  it('generic 分级掩码', () => {
    expect(maskValue('Abc123', 'generic')).toBe('******');
    expect(maskValue('AKIAABCDEFGHIJKLMNOP', 'generic')).toBe('AKIA************MNOP');
    expect(maskValue('A'.repeat(48), 'generic')).toBe(`${'A'.repeat(4)}${'*'.repeat(16)}…${'A'.repeat(4)}`);
  });

  it('连接串保留主机与端口', () => {
    expect(
      maskConnectionString('mysql://root:Passw0rd@10.1.2.3:3306/db'),
    ).toBe('mysql://***:***@10.1.2.3:3306/db');
    expect(maskValue('mongodb://a:b@10.0.0.1:27017/x', 'connection-string')).toBe(
      'mongodb://***:***@10.0.0.1:27017/x',
    );
  });

  it('URL 凭证脱敏', () => {
    expect(
      maskUrlCredentials('http://admin:secret@192.168.1.10/admin'),
    ).toBe('http://***:***@192.168.1.10/admin');
  });

  it('私钥只保留 BEGIN 行', () => {
    expect(maskPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nMIIE...')).toBe(
      '-----BEGIN RSA PRIVATE KEY-----',
    );
  });

  it('JWT 只保留前 8 字符', () => {
    expect(maskJwt('eyJhbGciOiJIUzI1NiJ9.payload.signature')).toBe('eyJhbGci…');
  });

  it('邮箱与手机号掩码', () => {
    expect(maskValue('admin@corp.com', 'email')).toBe('a***n@corp.com');
    expect(maskValue('13812348000', 'phone')).toBe('138****8000');
  });

  it('full 固定 8 个星号', () => {
    expect(maskValue('anything', 'full')).toBe('********');
  });

  it('结构解析失败回退通用掩码', () => {
    expect(maskValue('not-a-connection', 'connection-string')).toBe(
      maskValue('not-a-connection', 'generic'),
    );
    expect(maskValue('not-a-connection', 'connection-string')).not.toBe(
      'not-a-connection',
    );
  });
});

describe('上下文与截断', () => {
  it('截断在安全边界并追加省略号', () => {
    const value = 'a'.repeat(300);
    const truncated = truncateLine(value, 200);
    expect(truncated.endsWith('…')).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(200);
  });

  it('上下文取上下各 1 行并脱敏', () => {
    const context = buildFindingContext({
      lines: ['before AKIAABCDEFGHIJKLMNOP', 'hit line', 'after'],
      hitLine: 2,
      masker: (line) => line.replace('AKIAABCDEFGHIJKLMNOP', 'AKIA************MNOP'),
    });
    expect(context.before).toBe('before AKIA************MNOP');
    expect(context.after).toBe('after');
  });

  it('边界返回 null', () => {
    const context = buildFindingContext({
      lines: ['only line'],
      hitLine: 1,
      masker: (line) => line,
    });
    expect(context.before).toBeNull();
    expect(context.after).toBeNull();
  });
});

describe('导出清洗', () => {
  it('白名单拷贝且不含 raw 字段', () => {
    const finding = sampleFinding();
    const exported = scrubForExport(finding);
    expect(exported).toEqual({
      id: finding.id,
      ruleId: finding.ruleId,
      ruleName: finding.ruleName,
      severity: finding.severity,
      filePath: finding.filePath,
      line: finding.line,
      maskedSnippet: finding.maskedSnippet,
      context: finding.context,
      sourceKind: finding.sourceKind,
      inCodeFence: finding.inCodeFence,
      description: finding.description,
      suggestion: finding.suggestion,
      suppressedRuleIds: finding.suppressedRuleIds,
    });
    expect(Object.keys(exported)).not.toContain('rawSnippet');
    expect(Object.keys(exported)).not.toContain('rawValue');
  });
});