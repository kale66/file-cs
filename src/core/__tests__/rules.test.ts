import { describe, expect, it } from 'vitest';
import type { CommentSnippet, Finding } from '@/types';
import { createDefaultScanConfig } from '@/core/config';
import {
  getEnabledRules,
  isPlaceholderValue,
  isSampleLikeHost,
  RULE_CATALOG,
  RULES,
  validateRuleSet,
} from '@/core/rules';
import { dedupeMatches, finalizeFindings, scanSnippets } from '@/core/scanner';
import type { ScanContext } from '@/core/scanner';

function snippet(text: string): CommentSnippet {
  return {
    startLine: 1,
    endLine: 1,
    text,
    sourceKind: 'line-comment',
    inCodeFence: false,
    truncated: false,
  };
}

function scan(text: string): Finding[] {
  const config = createDefaultScanConfig();
  const context: ScanContext = {
    config,
    rules: getEnabledRules(config),
    maxSnippetBytes: 8192,
  };
  const matches = scanSnippets([snippet(text)], context).map((match) => ({
    ...match,
    filePath: 'config.js',
  }));
  return finalizeFindings(dedupeMatches(matches, context), 'job-test');
}

describe('规则集完整性', () => {
  it('包含 21 条规则且通过启动校验', () => {
    expect(RULES).toHaveLength(21);
    expect(RULE_CATALOG).toHaveLength(21);
    expect(validateRuleSet(RULES)).toEqual([]);
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(21);
  });

  it('默认关闭联系方式规则', () => {
    const config = createDefaultScanConfig();
    const enabled = getEnabledRules(config).map((item) => item.rule.id);
    expect(enabled).not.toContain('CLS-R-020');
    expect(enabled).not.toContain('CLS-R-021');

    const withContacts = createDefaultScanConfig({ scanContactInfo: true });
    const enabledWithContacts = getEnabledRules(withContacts).map((item) => item.rule.id);
    expect(enabledWithContacts).toContain('CLS-R-020');
    expect(enabledWithContacts).toContain('CLS-R-021');
  });

  it('占位符与示例主机判定', () => {
    const genericRule = RULES.find((rule) => rule.id === 'CLS-R-011');
    expect(genericRule).toBeDefined();
    if (!genericRule) return;
    expect(isPlaceholderValue('your_api_key_here', genericRule)).toBe(true);
    expect(isPlaceholderValue('<your-secret>', genericRule)).toBe(true);
    expect(isPlaceholderValue('${TOKEN}', genericRule)).toBe(true);
    expect(isPlaceholderValue('changeme', genericRule)).toBe(true);
    expect(isPlaceholderValue('AKIAABCDEFGHIJKLMNOP', genericRule)).toBe(false);

    expect(isSampleLikeHost('example.com')).toBe(true);
    expect(isSampleLikeHost('your-domain.com')).toBe(true);
    expect(isSampleLikeHost('localhost')).toBe(true);
    expect(isSampleLikeHost('10.1.2.3')).toBe(false);
  });
});

describe('ACC 场景与规则命中', () => {
  it('ACC-01：AWS Key 命中 critical，且不重复报告', () => {
    const findings = scan('// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-001');
    expect(findings[0]?.severity).toBe('critical');
    expect(findings[0]?.maskedSnippet).toContain('AKIA************MNOP');
    expect(findings[0]?.maskedSnippet).not.toContain('AKIAABCDEFGHIJKLMNOP');
  });

  it('ACC-02：字符串内 http:// 不触发规则', () => {
    const findings = scan('const url = "http://example.com/a"; // 正常注释');
    expect(findings).toHaveLength(0);
  });

  it('ACC-03：内网 IP 与连接串同时保留', () => {
    const findings = scan('mysql://root:Passw0rd@10.1.2.3:3306/db');
    const ruleIds = findings.map((finding) => finding.ruleId);
    expect(ruleIds).toContain('CLS-R-012');
    expect(ruleIds).toContain('CLS-R-015');
    expect(findings.some((finding) => finding.severity === 'critical')).toBe(true);
    expect(findings.some((finding) => finding.severity === 'high')).toBe(true);
    expect(
      findings.some((finding) =>
        finding.maskedSnippet.includes('mysql://***:***@10.1.2.3:3306/db'),
      ),
    ).toBe(true);
  });

  it('ACC-04：中文关键词与中文冒号命中 high', () => {
    const findings = scan('数据库密码: Admin@123');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-011');
    expect(findings[0]?.severity).toBe('high');
    expect(findings[0]?.maskedSnippet).not.toContain('Admin@123');
  });

  it('ACC-06：测试凭证命中 low', () => {
    const findings = scan('TODO: 测试账号 test/test 上线前删掉');
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-018')).toBe(true);
    expect(findings.every((finding) => finding.severity !== 'critical')).toBe(true);
  });

  it('ACC-10：占位符不产生命中', () => {
    expect(scan('API_KEY = your_api_key_here')).toHaveLength(0);
    expect(scan('SECRET = <your-secret>')).toHaveLength(0);
    expect(scan('TOKEN = ${TOKEN}')).toHaveLength(0);
  });

  it('弱口令允许 4 字符，普通短值不命中', () => {
    expect(scan('PASSWORD: root')).toHaveLength(1);
    expect(scan('PASSWORD: abcd')).toHaveLength(0);
  });

  it('内网 IP 排除回环与文档示例网段', () => {
    expect(scan('127.0.0.1')).toHaveLength(0);
    expect(scan('192.0.2.10')).toHaveLength(0);
    expect(scan('10.20.30.40:8080')).toHaveLength(1);
  });

  it('示例主机连接串不产生 critical', () => {
    const findings = scan('mysql://user:password@example.com/db');
    expect(findings.every((finding) => finding.severity !== 'critical')).toBe(true);
  });

  it('私钥与 JWT 命中', () => {
    const key = scan('-----BEGIN RSA PRIVATE KEY-----');
    expect(key[0]?.ruleId).toBe('CLS-R-009');
    expect(key[0]?.maskedSnippet).toBe('-----BEGIN RSA PRIVATE KEY-----');

    const jwt = scan(
      'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk',
    );
    expect(jwt.some((finding) => finding.ruleId === 'CLS-R-014')).toBe(true);
  });

  it('高熵串由 R-019 以 medium 报告', () => {
    const findings = scan('token = "Qm9vR2V0dGhpc1NlY3JldFZhbHVlMTIzNDU2Nzg5MA"');
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-019')).toBe(true);
    expect(findings.every((finding) => finding.severity !== 'high')).toBe(true);
  });

  it('同一行两个不重叠密钥保留两条', () => {
    const findings = scan('token=aQm9vR2V0dGhpc1NlY3JldA1 token=bQm9vR2V0dGhpc1NlY3JldA2');
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });
});