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
  it('包含 26 条规则且通过启动校验', () => {
    expect(RULES).toHaveLength(26);
    expect(RULE_CATALOG).toHaveLength(26);
    expect(validateRuleSet(RULES)).toEqual([]);
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(26);
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
describe('国内大模型 API Key 规则（CLS-R-022~026）', () => {
  it('DeepSeek：32/48 位 sk- 命中 R-022，并抑制同族 R-006', () => {
    const key32 = `sk-${'a'.repeat(32)}`;
    const findings32 = scan(`DEEPSEEK_API_KEY=${key32}`);
    expect(findings32).toHaveLength(1);
    expect(findings32[0]?.ruleId).toBe('CLS-R-022');
    expect(findings32[0]?.severity).toBe('critical');
    expect(findings32[0]?.suppressedRuleIds).toContain('CLS-R-006');

    const key48 = `sk-${'b'.repeat(48)}`;
    const findings48 = scan(`DEEPSEEK_API_KEY=${key48}`);
    expect(findings48).toHaveLength(1);
    expect(findings48[0]?.ruleId).toBe('CLS-R-022');
  });

  it('无关键词的 sk- Key 仍由 R-006 识别，不误标为 DeepSeek', () => {
    const findings = scan(`sk-${'c'.repeat(32)}`);
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-006')).toBe(true);
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-022')).toBe(false);
  });

  it('豆包 UUID 命中 R-023；全零 UUID 被排除', () => {
    const findings = scan('ARK_API_KEY=0123456789abcdef0123456789abcdef');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-023');
    expect(findings[0]?.severity).toBe('critical');

    const zero = scan('ARK_API_KEY=00000000000000000000000000000000');
    expect(zero.some((finding) => finding.ruleId === 'CLS-R-023')).toBe(false);
  });

  it('豆包 ark- 前缀（新格式）命中 R-026', () => {
    const key = 'ark-7f3a9c2e-4b1d-4e8a-9c5f-2d6b7a8c9d10-x7y8z9';
    const findings = scan(`ARK_API_KEY=${key}`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-026');
    expect(findings[0]?.severity).toBe('critical');
  });

  it('通义千问 sk-32 命中 R-024', () => {
    const findings = scan(`DASHSCOPE_API_KEY=sk-${'d'.repeat(32)}`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-024');
  });

  it('智谱 GLM 点号格式命中 R-025', () => {
    const key = `${'0123456789abcdef'.repeat(2)}.AbCdEf0123456789`;
    const findings = scan(`ZHIPU_API_KEY=${key}`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-025');
  });

  it('Kimi sk- 长 Key 命中 R-025', () => {
    const findings = scan(`MOONSHOT_API_KEY=sk-${'e'.repeat(48)}`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-025');
  });

  it('sk-your_api_key_here 占位符不再命中', () => {
    expect(scan('API_KEY = sk-your_api_key_here')).toHaveLength(0);
    expect(scan('DEEPSEEK_API_KEY = sk-your_api_key_here')).toHaveLength(0);
  });

  it('DeepSeek 严格 32/48 位边界：31 位与 49 位不命中 R-022', () => {
    const tooShort = scan(`DEEPSEEK_API_KEY=sk-${'f'.repeat(31)}`);
    expect(tooShort.some((finding) => finding.ruleId === 'CLS-R-022')).toBe(false);

    const tooLong = scan(`DEEPSEEK_API_KEY=sk-${'f'.repeat(49)}`);
    expect(tooLong.some((finding) => finding.ruleId === 'CLS-R-022')).toBe(false);
  });

  it('豆包连字符 UUID 形态命中 R-023', () => {
    const findings = scan('ARK_API_KEY=7f3a9c2e-4b1d-4e8a-9c5f-2d6b7a8c9d10');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-023');
    expect(findings[0]?.severity).toBe('critical');
  });

  it('ark- Key 缺少 suffix 时不按新格式 R-026 命中', () => {
    const findings = scan('ARK_API_KEY=ark-7f3a9c2e-4b1d-4e8a-9c5f-2d6b7a8c9d10');
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-026')).toBe(false);
  });

  it('ark- Key 不依赖关键词上下文也能命中 R-026', () => {
    const findings = scan(
      'const key = "ark-7f3a9c2e-4b1d-4e8a-9c5f-2d6b7a8c9d10-abc123";',
    );
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-026')).toBe(true);
    expect(
      findings.find((finding) => finding.ruleId === 'CLS-R-026')?.severity,
    ).toBe('critical');
  });

  it('通义千问 48 位不命中 R-024（规则严格限定 32 位）', () => {
    const findings = scan(`DASHSCOPE_API_KEY=sk-${'g'.repeat(48)}`);
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-024')).toBe(false);
  });

  it('智谱 GLM 第二段不足 16 位不命中 R-025', () => {
    const key = `${'0123456789abcdef'.repeat(2)}.AbCdEf012345678`;
    const findings = scan(`ZHIPU_API_KEY=${key}`);
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-025')).toBe(false);
  });

  it('Kimi 64 位 sk- 长 Key 命中 R-025 并抑制同族 R-006', () => {
    const findings = scan(`MOONSHOT_API_KEY=sk-${'f'.repeat(64)}`);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('CLS-R-025');
    expect(findings[0]?.suppressedRuleIds).toContain('CLS-R-006');
  });

  it('R-022~026 默认开启，且 specificity 呈 110/120/130 梯度', () => {
    const byId = new Map(RULES.map((rule) => [rule.id, rule]));
    for (const id of [
      'CLS-R-022',
      'CLS-R-023',
      'CLS-R-024',
      'CLS-R-025',
      'CLS-R-026',
    ]) {
      expect(byId.get(id)?.enabledByDefault).toBe(true);
    }
    expect(byId.get('CLS-R-023')?.specificity).toBe(110);
    expect(byId.get('CLS-R-022')?.specificity).toBe(120);
    expect(byId.get('CLS-R-024')?.specificity).toBe(120);
    expect(byId.get('CLS-R-025')?.specificity).toBe(130);
    expect(byId.get('CLS-R-026')?.specificity).toBe(130);
  });

  it('ark- 形态的全零 UUID 被校验器排除', () => {
    const findings = scan(
      'ARK_API_KEY=ark-00000000-0000-0000-0000-000000000000-abc123',
    );
    expect(findings.some((finding) => finding.ruleId === 'CLS-R-026')).toBe(false);
  });
});