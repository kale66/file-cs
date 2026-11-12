import { LIMITS } from '@/types';
import type {
  ExportFinding,
  Finding,
  FindingContext,
  MaskKind,
} from '@/types';

const FULL_MASK = '********';

function maskGeneric(value: string): string {
  const length = value.length;
  if (length === 0) return '';
  if (length <= 8) return '*'.repeat(length);
  if (length <= 40) {
    return `${value.slice(0, 4)}${'*'.repeat(length - 8)}${value.slice(-4)}`;
  }
  return `${value.slice(0, 4)}${'*'.repeat(16)}…${value.slice(-4)}`;
}

export function maskConnectionString(matchText: string): string {
  const parsed = /^([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^@]*)@(.*)$/.exec(matchText);
  if (!parsed) return maskGeneric(matchText);
  const scheme = parsed[1] ?? '';
  const rest = parsed[3] ?? '';
  if (scheme.length === 0 || rest.length === 0) return maskGeneric(matchText);
  return `${scheme}***:***@${rest}`;
}

export function maskUrlCredentials(matchText: string): string {
  const parsed = /^(https?:\/\/)([^@]*)@(.*)$/i.exec(matchText);
  if (!parsed) return maskGeneric(matchText);
  const scheme = parsed[1] ?? '';
  const rest = parsed[3] ?? '';
  if (scheme.length === 0 || rest.length === 0) return maskGeneric(matchText);
  return `${scheme}***:***@${rest}`;
}

export function maskPrivateKey(matchText: string): string {
  const begin = /-----BEGIN[^\n]*-----/.exec(matchText);
  return begin ? (begin[0] ?? FULL_MASK) : FULL_MASK;
}

export function maskJwt(matchText: string): string {
  const value = matchText.trim();
  if (value.length <= 8) return FULL_MASK;
  return `${value.slice(0, 8)}…`;
}

function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at <= 0) return FULL_MASK;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const maskedLocal =
    local.length <= 3
      ? '***'
      : `${local.slice(0, 1)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

function maskPhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 7) return FULL_MASK;
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`;
}

export function maskValue(value: string, kind: MaskKind): string {
  try {
    switch (kind) {
      case 'connection-string':
        return maskConnectionString(value);
      case 'url-credentials':
        return maskUrlCredentials(value);
      case 'private-key':
        return maskPrivateKey(value);
      case 'jwt':
        return maskJwt(value);
      case 'email':
        return maskEmail(value);
      case 'phone':
        return maskPhone(value);
      case 'full':
        return FULL_MASK;
      case 'generic':
      default:
        return maskGeneric(value);
    }
  } catch {
    return FULL_MASK;
  }
}

export function truncateLine(line: string, maxLength = LIMITS.maxContextLineChars): string {
  if (line.length <= maxLength) return line;
  let end = Math.max(0, maxLength - 1);
  if (end > 0) {
    const code = line.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  }
  return `${line.slice(0, end)}…`;
}

export interface ContextInput {
  readonly lines: readonly string[];
  readonly hitLine: number;
  readonly masker: (line: string) => string;
}

export function buildFindingContext(input: ContextInput): FindingContext {
  const { lines, hitLine, masker } = input;
  const beforeIndex = hitLine - 2;
  const afterIndex = hitLine;
  const beforeRaw = beforeIndex >= 0 ? lines[beforeIndex] : undefined;
  const afterRaw = afterIndex >= 0 ? lines[afterIndex] : undefined;

  return {
    before:
      beforeRaw === undefined
        ? null
        : truncateLine(masker(beforeRaw), LIMITS.maxContextLineChars),
    after:
      afterRaw === undefined
        ? null
        : truncateLine(masker(afterRaw), LIMITS.maxContextLineChars),
  };
}

export function scrubForExport(finding: Finding): ExportFinding {
  return {
    id: finding.id,
    ruleId: finding.ruleId,
    ruleName: finding.ruleName,
    severity: finding.severity,
    filePath: finding.filePath,
    line: finding.line,
    maskedSnippet: finding.maskedSnippet,
    context: {
      before: finding.context.before,
      after: finding.context.after,
    },
    sourceKind: finding.sourceKind,
    inCodeFence: finding.inCodeFence,
    description: finding.description,
    suggestion: finding.suggestion,
    suppressedRuleIds: [...finding.suppressedRuleIds],
  };
}