import type {
  CompiledRule,
  EntropyConfig,
  Rule,
  RuleCatalogEntry,
  RuleValidationIssue,
  ScanConfig,
  Severity,
} from '@/types';

export const RULE_SET_VERSION = '1.1.0';

const HIGH_ENTROPY: EntropyConfig = {
  threshold: 3.5,
  minLength: 16,
  maxLength: 128,
  charsets: ['base64', 'hex'],
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const RULES: readonly Rule[] = [
  {
    id: 'CLS-R-001',
    name: 'AWS Access Key',
    severity: 'critical',
    pattern: '\\bAKIA[0-9A-Z]{16}\\b',
    flags: 'g',
    description: '命中 AWS Access Key ID 形态的硬编码凭证。',
    suggestion: '立即在 AWS 控制台轮换该密钥，改用环境变量或密钥托管服务。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-002',
    name: 'AWS Secret Access Key',
    severity: 'critical',
    pattern:
      '(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?secret[_-]?key)["\']?\\s*[:=]\\s*["\']?([A-Za-z0-9/+=]{40})',
    flags: 'gi',
    description: '关键词附近的 40 位 base64 值疑似 AWS Secret Access Key。',
    suggestion: '轮换对应 IAM 用户的密钥，并检查 CloudTrail 是否存在异常调用。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-003',
    name: 'Google API Key',
    severity: 'critical',
    pattern: '\\bAIza[0-9A-Za-z_-]{35}\\b',
    flags: 'g',
    description: '命中 Google API Key 形态的字符串。',
    suggestion: '在 Google Cloud Console 撤销并重建密钥，同时限制 API 与来源。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-004',
    name: 'GitHub Token',
    severity: 'critical',
    pattern: '\\b(?:ghp|gho|ghs|ghu|ghr)_[A-Za-z0-9]{36}\\b',
    flags: 'g',
    description: '命中 GitHub 个人访问令牌或应用令牌。',
    suggestion: '在 GitHub Settings 中撤销该 Token，并改为最小权限的短期凭据。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-005',
    name: 'Slack Token',
    severity: 'critical',
    pattern: '\\bxox[baprs]-[A-Za-z0-9-]{10,}\\b',
    flags: 'g',
    description: '命中 Slack Bot/User/App Token 形态。',
    suggestion: '在 Slack App 管理页撤销令牌并重新安装应用。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-006',
    name: 'OpenAI API Key',
    severity: 'critical',
    pattern: '\\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\\b',
    flags: 'g',
    description: '命中 OpenAI 风格 API Key（含 sk-proj- 前缀）。',
    suggestion: '在 OpenAI 控制台撤销该 Key 并检查用量记录。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-007',
    name: 'Stripe Key',
    severity: 'critical',
    pattern: '\\b(?:sk|pk)_live_[A-Za-z0-9]{16,}\\b',
    flags: 'g',
    description: '命中 Stripe live 模式密钥。',
    suggestion: '在 Stripe Dashboard 轮换密钥，并检查是否存在异常支付活动。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-008',
    name: 'SendGrid Key',
    severity: 'critical',
    pattern: '\\bSG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}\\b',
    flags: 'g',
    description: '命中 SendGrid API Key 形态。',
    suggestion: '在 SendGrid 控制台删除该 Key 并创建权限更小的新 Key。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-009',
    name: '私钥文件头',
    severity: 'critical',
    pattern: '-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----',
    flags: 'g',
    description: '注释或文档中出现私钥 PEM 头部。',
    suggestion: '立即轮换该私钥对应的证书或密钥对，并从历史记录中清除。',
    maskKind: 'private-key',
    captureGroup: 0,
    validator: 'private-key',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-010',
    name: '证书内容',
    severity: 'critical',
    pattern: '-----BEGIN CERTIFICATE-----',
    flags: 'g',
    description: '出现 PEM 证书块头部，可能泄露内部证书。',
    suggestion: '确认证书是否包含内部域名或私钥线索；必要时重新签发。',
    maskKind: 'private-key',
    captureGroup: 0,
    validator: 'private-key',
    dedupeFamily: 'secret-value',
    specificity: 100,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-011',
    name: '通用密钥赋值',
    severity: 'high',
    pattern:
      '(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|secret[_-]?key|private[_-]?key|auth|密码|口令|密钥|令牌|凭证)\\s*[:=：]\\s*["\']?([^\\s"\']{4,})',
    flags: 'gi',
    description: '注释中出现“关键词 = 值”的硬编码口令或密钥。',
    suggestion: '改为从环境变量或密钥管理系统读取，并轮换已泄露的值。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'password-like',
    dedupeFamily: 'secret-value',
    specificity: 10,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-012',
    name: '数据库连接串',
    severity: 'critical',
    pattern:
      '\\b(?:mysql|postgres|postgresql|mongodb(?:\\+srv)?|redis|amqp|mssql):\\/\\/[^\\s\\/:@]+:[^\\s\\/@]+@[^\\s]+',
    flags: 'gi',
    description: '连接串中直接包含账号与密码。',
    suggestion: '改用密钥管理服务注入凭据，并轮换该数据库账号密码。',
    maskKind: 'connection-string',
    captureGroup: 0,
    validator: 'no-sample-host',
    dedupeFamily: 'connection',
    specificity: 90,
    placeholderGuard: false,
    sampleGuard: true,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-013',
    name: '带凭证的 URL',
    severity: 'critical',
    pattern: '\\bhttps?:\\/\\/[^\\s\\/:@]+:[^\\s\\/@]+@[^\\s]+',
    flags: 'gi',
    description: 'HTTP(S) URL 中内嵌用户名与密码。',
    suggestion: '移除 URL 中的凭据，改用请求头或登录流程，并轮换该密码。',
    maskKind: 'url-credentials',
    captureGroup: 0,
    validator: 'no-sample-host',
    dedupeFamily: 'connection',
    specificity: 90,
    placeholderGuard: false,
    sampleGuard: true,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-014',
    name: 'JWT',
    severity: 'high',
    pattern:
      '\\beyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b',
    flags: 'g',
    description: '注释中存在三段式 JWT，可能包含可复用会话令牌。',
    suggestion: '缩短令牌有效期并轮换签名密钥；不要把 JWT 写入注释。',
    maskKind: 'jwt',
    captureGroup: 0,
    validator: 'jwt-three-segments',
    dedupeFamily: 'secret-value',
    specificity: 80,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-015',
    name: '内网 IP',
    severity: 'high',
    pattern:
      '\\b(?:10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|192\\.168\\.\\d{1,3}\\.\\d{1,3}|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3})\\b',
    flags: 'g',
    description: '注释中暴露内网 IPv4 地址，可能帮助攻击者定位内网资产。',
    suggestion: '移除具体内网地址，改用配置项或文档化的示例网段。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'ipv4-private',
    dedupeFamily: 'network-location',
    specificity: 60,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-016',
    name: '内网域名',
    severity: 'medium',
    pattern: '\\b[A-Za-z0-9][A-Za-z0-9._-]*\\.(?:local|internal|corp|lan|intra|intranet)\\b',
    flags: 'gi',
    description: '注释中出现内网专用域名后缀。',
    suggestion: '移除内部主机名或替换为通用示例域名。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'network-location',
    specificity: 50,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-017',
    name: '本地服务地址',
    severity: 'low',
    pattern: '\\blocalhost:\\d{1,5}\\b',
    flags: 'gi',
    description: '注释中出现 localhost 端口，提示本地调试配置残留。',
    suggestion: '确认是否为调试残留；生产文档建议使用通用占位地址。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'network-location',
    specificity: 40,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-018',
    name: '测试/默认凭证',
    severity: 'low',
    pattern:
      '\\b(?:test|admin|root|demo|guest|user)\\s*[:=/]\\s*["\']?(?:test|admin|root|123456|password|passwd|demo|guest)["\']?',
    flags: 'gi',
    description: '注释中留下测试或默认账号口令组合。',
    suggestion: '在上线前删除测试账号，并确保默认口令已修改。',
    maskKind: 'generic',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'default-credential',
    specificity: 50,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-019',
    name: '高熵密钥串',
    severity: 'medium',
    pattern:
      '(?:secret|token|key|password|passwd|pwd|api[_-]?key|access[_-]?key|private[_-]?key)\\s*[:=]\\s*["\']?([A-Za-z0-9+/=_-]{16,128})["\']?',
    flags: 'gi',
    description: '关键词附近的 16–128 位高熵字符串，疑似真实密钥。',
    suggestion: '确认该值是否为真实密钥；若是，立即轮换并改用密钥管理服务。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 5,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: HIGH_ENTROPY,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-020',
    name: '邮箱地址',
    severity: 'low',
    pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
    flags: 'g',
    description: '注释或文档中留下个人邮箱地址（默认关闭）。',
    suggestion: '确认是否需要公开个人联系方式；必要时移除或改用团队邮箱。',
    maskKind: 'email',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'contact',
    specificity: 30,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: false,
  },
  {
    id: 'CLS-R-021',
    name: '手机号',
    severity: 'medium',
    pattern: '\\b1[3-9]\\d{9}\\b',
    flags: 'g',
    description: '注释或文档中留下中国大陆手机号（默认关闭）。',
    suggestion: '移除个人手机号，改用团队联系方式或工单系统。',
    maskKind: 'phone',
    captureGroup: 0,
    validator: 'none',
    dedupeFamily: 'contact',
    specificity: 30,
    placeholderGuard: false,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: false,
  },
  {
    id: 'CLS-R-022',
    name: 'DeepSeek API Key',
    severity: 'critical',
    pattern:
      '(?:DEEPSEEK|deepseek)[^\\n]{0,40}?\\b(sk-(?!proj-)[A-Za-z0-9]{32}(?:[A-Za-z0-9]{16})?)\\b',
    flags: 'g',
    description: '注释中出现 DeepSeek API Key 形态的硬编码凭证。',
    suggestion: '在 DeepSeek 开放平台撤销并重建该 Key，改用环境变量或密钥管理服务。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 120,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-023',
    name: '豆包（火山引擎）API Key（UUID）',
    severity: 'critical',
    pattern:
      '(?:ARK_API_KEY|VOLCENGINE|VOLC|DOUBAO|doubao|火山|方舟|豆包)[^\\n]{0,40}?\\b([a-fA-F0-9]{32}|[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})\\b',
    flags: 'g',
    description: '注释中出现豆包/火山引擎 API Key 的 UUID 或 32 位十六进制形态。',
    suggestion: '在火山引擎方舟控制台禁用并重建该 Key，改用环境变量或密钥管理服务。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'doubao-uuid',
    dedupeFamily: 'secret-value',
    specificity: 110,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-024',
    name: '阿里通义千问（DashScope）API Key',
    severity: 'critical',
    pattern:
      '(?:DASHSCOPE|QWEN|通义|千问|aliyun)[^\\n]{0,40}?\\b(sk-(?!proj-)[A-Za-z0-9]{32})\\b',
    flags: 'g',
    description: '注释中出现 DashScope / 通义千问 API Key 形态的硬编码凭证。',
    suggestion: '在阿里云百炼控制台撤销并重建该 Key，改用环境变量或密钥管理服务。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 120,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-025',
    name: '智谱 GLM / Kimi API Key',
    severity: 'critical',
    pattern:
      '(?:GLM|ZHIPU|BIGMODEL|智谱|MOONSHOT|KIMI|月之暗面)[^\\n]{0,40}?\\b((?:sk-(?!proj-)[A-Za-z0-9]{32,64})|(?:[a-fA-F0-9]{32}\\.[A-Za-z0-9]{16}))\\b',
    flags: 'g',
    description: '注释中出现智谱 GLM 点号密钥或 Kimi/Moonshot 的 sk- 密钥。',
    suggestion: '在智谱开放平台或 Moonshot 控制台撤销并重建该 Key，改用环境变量。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'none',
    dedupeFamily: 'secret-value',
    specificity: 130,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
  {
    id: 'CLS-R-026',
    name: '豆包（火山引擎）API Key（ark- 前缀）',
    severity: 'critical',
    pattern:
      '\\b(ark-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[A-Za-z0-9_-]+)(?![A-Za-z0-9_-])',
    flags: 'g',
    description:
      '注释中出现豆包/火山引擎新版 ark- 前缀 API Key（ark-UUID-suffix）形态。',
    suggestion: '在火山引擎方舟控制台禁用并重建该 Key，改用环境变量或密钥管理服务。',
    maskKind: 'generic',
    captureGroup: 1,
    validator: 'doubao-uuid',
    dedupeFamily: 'secret-value',
    specificity: 130,
    placeholderGuard: true,
    sampleGuard: false,
    entropy: null,
    enabledByDefault: true,
  },
];

export const RULE_CATALOG: readonly RuleCatalogEntry[] = RULES.map((rule) => ({
  id: rule.id,
  name: rule.name,
  severity: rule.severity,
  description: rule.description,
  suggestion: rule.suggestion,
  enabledByDefault: rule.enabledByDefault,
}));

function countCaptureGroups(rule: Rule): number {
  try {
    const probe = new RegExp(`(?:${rule.pattern})|`);
    const match = probe.exec('');
    return match ? match.length - 1 : 0;
  } catch {
    return 0;
  }
}

export function validateRuleSet(rules: readonly Rule[]): RuleValidationIssue[] {
  const issues: RuleValidationIssue[] = [];
  const seen = new Set<string>();
  const validSeverities: readonly Severity[] = ['critical', 'high', 'medium', 'low'];

  for (const rule of rules) {
    if (!/^CLS-R-\d{3}$/.test(rule.id)) {
      issues.push({ ruleId: rule.id, field: 'id', message: '规则 ID 格式不合法' });
    }
    if (seen.has(rule.id)) {
      issues.push({ ruleId: rule.id, field: 'id', message: '规则 ID 重复' });
    }
    seen.add(rule.id);

    if (!validSeverities.includes(rule.severity)) {
      issues.push({ ruleId: rule.id, field: 'severity', message: '严重级别不合法' });
    }
    if (rule.name.trim().length === 0) {
      issues.push({ ruleId: rule.id, field: 'name', message: '规则名称为空' });
    }
    if (rule.description.trim().length === 0 || rule.description.length > 120) {
      issues.push({ ruleId: rule.id, field: 'description', message: '说明为空或过长' });
    }
    if (rule.suggestion.trim().length === 0 || rule.suggestion.length > 160) {
      issues.push({ ruleId: rule.id, field: 'suggestion', message: '建议为空或过长' });
    }
    try {
      // 编译校验：失败即抛出
      new RegExp(rule.pattern, rule.flags.includes('g') ? rule.flags : `${rule.flags}g`);
    } catch {
      issues.push({ ruleId: rule.id, field: 'pattern', message: '正则无法编译' });
    }
    const groupCount = countCaptureGroups(rule);
    if (rule.captureGroup > groupCount) {
      issues.push({
        ruleId: rule.id,
        field: 'captureGroup',
        message: `捕获组 ${rule.captureGroup} 超过实际组数 ${groupCount}`,
      });
    }
    if (rule.entropy) {
      if (
        rule.entropy.threshold <= 0 ||
        rule.entropy.minLength <= 0 ||
        rule.entropy.maxLength < rule.entropy.minLength
      ) {
        issues.push({ ruleId: rule.id, field: 'entropy', message: '熵配置不合法' });
      }
    }
  }

  return issues;
}

const compiledCache = new Map<string, CompiledRule>();

export function compileRule(rule: Rule): CompiledRule {
  const cached = compiledCache.get(rule.id);
  if (cached) return cached;
  const flags = rule.flags.includes('g') ? rule.flags : `${rule.flags}g`;
  const compiled: CompiledRule = {
    rule,
    regex: new RegExp(rule.pattern, flags),
  };
  compiledCache.set(rule.id, compiled);
  return compiled;
}

export function getEnabledRules(config: ScanConfig): readonly CompiledRule[] {
  return RULES.filter(
    (rule) =>
      rule.enabledByDefault ||
      (rule.dedupeFamily === 'contact' && config.scanContactInfo),
  )
    .slice()
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map(compileRule);
}

const REPEATED_CHARACTER_RE = /^[x*._-]{3,}$/;
const TEMPLATE_PLACEHOLDER_RES: readonly RegExp[] = [
  /^<.*>$/,
  /^\{\{.*\}\}$/,
  /^\$\{.*\}$/,
  /^\$\w+$/,
  /^%[A-Z_]+%$/,
];

const SECRET_PREFIX_RE = /^(?:sk|pk|rk|ghp|gho|ghs|ghu|ghr|xox[baprs]|ark|sg)[-_]?/i;

export function normalizePlaceholderCandidate(value: string): string {
  return value
    .replace(/^['"`]|['"`]$/g, '')
    .trim()
    .toLowerCase()
    .replace(SECRET_PREFIX_RE, '');
}

export function isPlaceholderValue(value: string, rule: Rule): boolean {
  if (!rule.placeholderGuard) return false;
  const candidate = normalizePlaceholderCandidate(value);

  if (candidate.length === 0) return true;
  if (REPEATED_CHARACTER_RE.test(candidate)) return true;
  if (/^(changeme|change_me|replace_me)$/.test(candidate)) return true;
  if (/^your[_-]?/.test(candidate)) return true;
  if (/^(example|sample|dummy|fake|mock)/.test(candidate)) return true;
  if (/^(placeholder|todo|fixme)$/.test(candidate)) return true;
  if (/^(null|none|undefined|nil)$/.test(candidate)) return true;
  if (/xxx/.test(candidate)) return true;
  if (TEMPLATE_PLACEHOLDER_RES.some((pattern) => pattern.test(candidate))) return true;

  return false;
}

export function isSampleLikeHost(host: string): boolean {
  const candidate = host
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/:\d+$/, '');
  if (candidate.length === 0) return false;
  if (candidate === 'localhost' || candidate === '127.0.0.1' || candidate === '0.0.0.0') {
    return true;
  }
  if (
    candidate === 'example.com' ||
    candidate === 'example.org' ||
    candidate === 'example.net'
  ) {
    return true;
  }
  if (/(^|\.)example\.(com|org|net)$/.test(candidate)) return true;
  if (candidate === 'your-domain.com' || candidate === 'yourdomain.com') return true;
  return false;
}

export function getSeverityRank(severity: Severity): number {
  return SEVERITY_ORDER[severity];
}