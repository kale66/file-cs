import { LIMITS } from '@/types';
import type {
  CommentSnippet,
  CompiledRule,
  FileScanInput,
  FileScanOutcome,
  Finding,
  FindingSeed,
  RawMatch,
  Rule,
  ScanConfig,
  ScanSummary,
  ScanStatus,
  Severity,
  SeverityCounts,
  SummaryInput,
} from '@/types';
import { comparePathAsc } from '@/core/path';
import { sliceByBytes } from '@/core/text';
import { extractSnippets } from '@/core/commentExtractor';
import {
  getSeverityRank,
  isPlaceholderValue,
  isSampleLikeHost,
} from '@/core/rules';
import { qualifiesAsHighEntropy } from '@/core/entropy';
import {
  buildFindingContext,
  maskValue,
  truncateLine,
} from '@/core/redact';

export interface ScanContext {
  readonly config: ScanConfig;
  readonly rules: readonly CompiledRule[];
  readonly maxSnippetBytes: number;
}

const WEAK_PASSWORDS = new Set([
  'root',
  'admin',
  'test',
  'guest',
  'demo',
  '123456',
  'password',
  'passwd',
]);

const HIGH_ENTROPY_PROBE = {
  threshold: 3.5,
  minLength: 16,
  maxLength: 128,
  charsets: ['base64', 'hex'] as const,
};

const PRIVATE_DOCUMENT_PREFIXES = ['192.0.2.', '198.51.100.', '203.0.113.'];

function extractHost(matchText: string): string {
  const match = /:\/\/(?:[^@]*@)?([^/:?#\s]+)/.exec(matchText);
  return match ? (match[1] ?? '') : '';
}

function passesIpv4Private(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((number) => !Number.isInteger(number) || number < 0 || number > 255)) {
    return false;
  }
  const [first = -1, second = -1, third = -1, fourth = -1] = numbers;
  if (first === 127 && second === 0 && third === 0 && fourth === 1) return false;
  if (first === 0 && second === 0 && third === 0 && fourth === 0) return false;
  if (PRIVATE_DOCUMENT_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return false;
  }
  return true;
}

function passesPasswordLike(value: string): boolean {
  const candidate = value.trim().replace(/^['"`]|['"`]$/g, '');
  if (WEAK_PASSWORDS.has(candidate.toLowerCase())) return true;
  if (candidate.length < 6) return false;
  if (qualifiesAsHighEntropy(candidate, HIGH_ENTROPY_PROBE)) return false;
  return true;
}

function passesValidator(rule: Rule, matchedText: string, rawValue: string): boolean {
  switch (rule.validator) {
    case 'ipv4-private':
      return passesIpv4Private(rawValue.trim());
    case 'password-like':
      return passesPasswordLike(rawValue);
    case 'no-sample-host':
      return !isSampleLikeHost(extractHost(matchedText));
    case 'jwt-three-segments': {
      const segments = rawValue.split('.');
      return (
        segments.length === 3 &&
        (segments[0] ?? '').startsWith('eyJ') &&
        (segments[1] ?? '').startsWith('eyJ')
      );
    }
    case 'private-key':
      return rawValue.startsWith('-----BEGIN');
    case 'none':
    default:
      return true;
  }
}

function countNewlines(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

function maskedLineFor(snippetText: string, matchStart: number, matchLength: number): string {
  const lineStart = snippetText.lastIndexOf('\n', matchStart) + 1;
  const newline = snippetText.indexOf('\n', matchStart);
  const lineEnd = newline === -1 ? snippetText.length : newline;
  void matchLength;
  return snippetText.slice(lineStart, lineEnd);
}

export function scanSnippets(
  snippets: readonly CommentSnippet[],
  context: ScanContext,
): RawMatch[] {
  const matches: RawMatch[] = [];
  const maskedLineCache = new Map<string, string>();

  for (let snippetIndex = 0; snippetIndex < snippets.length; snippetIndex += 1) {
    const snippet = snippets[snippetIndex];
    if (!snippet) continue;

    for (const compiled of context.rules) {
      const regex = compiled.regex;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null = regex.exec(snippet.text);
      let guard = 0;

      while (match !== null && guard < 2000) {
        guard += 1;
        if (match[0].length === 0) {
          regex.lastIndex += 1;
          match = regex.exec(snippet.text);
          continue;
        }

        const rawValue = match[compiled.rule.captureGroup] ?? match[0];
        const matchedText = match[0];

        const placeholderBlocked =
          compiled.rule.placeholderGuard && isPlaceholderValue(rawValue, compiled.rule);
        const sampleBlocked =
          compiled.rule.sampleGuard && isSampleLikeHost(extractHost(matchedText));
        const validatorBlocked = !passesValidator(compiled.rule, matchedText, rawValue);
        const entropyBlocked =
          compiled.rule.entropy !== null &&
          !qualifiesAsHighEntropy(rawValue, compiled.rule.entropy);

        if (!placeholderBlocked && !sampleBlocked && !validatorBlocked && !entropyBlocked) {
          const line = snippet.startLine + countNewlines(snippet.text.slice(0, match.index));
          const rawLine = maskedLineFor(snippet.text, match.index, matchedText.length);
          const cacheKey = `${snippetIndex}:${line}`;
          const cachedLine = maskedLineCache.get(cacheKey);
          const maskedLine =
            cachedLine ?? maskLineWithRules(rawLine, context.rules);
          if (cachedLine === undefined) {
            maskedLineCache.set(cacheKey, maskedLine);
          }
          matches.push({
            ruleId: compiled.rule.id,
            ruleName: compiled.rule.name,
            severity: compiled.rule.severity,
            filePath: '',
            line,
            startIndex: match.index,
            endIndex: match.index + matchedText.length,
            rawValue,
            matchedText,
            sourceKind: snippet.sourceKind,
            inCodeFence: snippet.inCodeFence,
            snippetIndex,
            snippetTruncated: snippet.truncated,
            maskedSnippet: truncateLine(maskedLine),
            snippetText: snippet.text,
          });
        }

        match = regex.exec(snippet.text);
      }
    }
  }

  return matches;
}

export function scanFile(input: FileScanInput, context: ScanContext): FileScanOutcome {
  const extracted = extractSnippets({
    relPath: input.filePath,
    displayName: input.filePath.slice(input.filePath.lastIndexOf('/') + 1),
    text: input.text,
    classification: input.classification,
    options: { maxSnippetBytes: context.maxSnippetBytes },
    scanPythonDocstring: context.config.scanPythonDocstring,
  });

  const matches = scanSnippets(extracted.snippets, context).map((match) => ({
    ...match,
    filePath: input.filePath,
  }));

  return {
    filePath: input.filePath,
    snippets: extracted.snippets,
    matches,
    diagnostics: extracted.diagnostics,
    truncatedSnippetCount: extracted.snippets.filter((snippet) => snippet.truncated).length,
  };
}

function maskLineWithRules(
  line: string,
  rules: readonly CompiledRule[],
): string {
  const candidates: { start: number; end: number; text: string; specificity: number }[] = [];

  for (const compiled of rules) {
    compiled.regex.lastIndex = 0;
    let match: RegExpExecArray | null = compiled.regex.exec(line);
    let guard = 0;
    while (match !== null && guard < 100) {
      guard += 1;
      if (match[0].length > 0) {
        const group = compiled.rule.captureGroup;
        const value = match[group] ?? match[0];
        let start = match.index;
        let end = match.index + match[0].length;
        if (group > 0 && value.length > 0) {
          const relative = match[0].indexOf(value);
          if (relative >= 0) {
            start = match.index + relative;
            end = start + value.length;
          }
        }
        candidates.push({
          start,
          end,
          text: maskValue(value, compiled.rule.maskKind),
          specificity: compiled.rule.specificity,
        });
      } else {
        compiled.regex.lastIndex += 1;
      }
      match = compiled.regex.exec(line);
    }
  }

  candidates.sort(
    (a, b) => b.specificity - a.specificity || a.start - b.start,
  );

  const chosen: typeof candidates = [];
  for (const candidate of candidates) {
    if (
      chosen.some(
        (existing) => candidate.start < existing.end && existing.start < candidate.end,
      )
    ) {
      continue;
    }
    chosen.push(candidate);
  }

  chosen.sort((a, b) => a.start - b.start);

  let result = '';
  let cursor = 0;
  for (const replacement of chosen) {
    result += line.slice(cursor, replacement.start);
    result += replacement.text;
    cursor = replacement.end;
  }
  result += line.slice(cursor);
  return result;
}

function familyOf(ruleId: string, rules: readonly CompiledRule[]): string {
  const compiled = rules.find((item) => item.rule.id === ruleId);
  return compiled?.rule.dedupeFamily ?? 'secret-value';
}

function specificityOf(ruleId: string, rules: readonly CompiledRule[]): number {
  const compiled = rules.find((item) => item.rule.id === ruleId);
  return compiled?.rule.specificity ?? 0;
}

function pickWinner(cluster: readonly RawMatch[], rules: readonly CompiledRule[]): RawMatch {
  const sorted = cluster.slice().sort((a, b) => {
    const severityDiff = getSeverityRank(a.severity) - getSeverityRank(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const specificityDiff =
      specificityOf(b.ruleId, rules) - specificityOf(a.ruleId, rules);
    if (specificityDiff !== 0) return specificityDiff;
    return comparePathAsc(a.ruleId, b.ruleId);
  });
  return sorted[0] as RawMatch;
}

function toSeed(
  winner: RawMatch,
  suppressedRuleIds: readonly string[],
  context: ScanContext,
): FindingSeed {
  const compiled = context.rules.find((item) => item.rule.id === winner.ruleId);
  const lines = winner.snippetText.split('\n');
  const hitLineWithinSnippet =
    countNewlines(winner.snippetText.slice(0, winner.startIndex)) + 1;
  const findingContext = buildFindingContext({
    lines,
    hitLine: hitLineWithinSnippet,
    masker: (line) => maskLineWithRules(line, context.rules),
  });
  const rawLineStart = winner.snippetText.lastIndexOf('\n', winner.startIndex) + 1;
  const rawLineNewline = winner.snippetText.indexOf('\n', winner.startIndex);
  const rawLineEnd =
    rawLineNewline === -1 ? winner.snippetText.length : rawLineNewline;
  const rawSnippet = sliceByBytes(
    winner.snippetText.slice(rawLineStart, rawLineEnd),
    LIMITS.maxRevealBytesPerFinding,
  ).text;

  return {
    ruleId: winner.ruleId,
    ruleName: winner.ruleName,
    severity: winner.severity,
    filePath: winner.filePath,
    line: winner.line,
    startIndex: winner.startIndex,
    endIndex: winner.endIndex,
    maskedSnippet: winner.maskedSnippet,
    context: findingContext,
    sourceKind: winner.sourceKind,
    inCodeFence: winner.inCodeFence,
    description: compiled?.rule.description ?? '',
    suggestion: compiled?.rule.suggestion ?? '',
    suppressedRuleIds,
    snippetTruncated: winner.snippetTruncated,
    rawSnippet,
  };
}

export function dedupeMatches(
  matches: readonly RawMatch[],
  context: ScanContext,
): FindingSeed[] {
  const groups = new Map<string, RawMatch[]>();

  for (const match of matches) {
    const family = familyOf(match.ruleId, context.rules);
    const key = `${match.filePath}#${match.line}#${family}`;
    const list = groups.get(key);
    if (list) {
      list.push(match);
    } else {
      groups.set(key, [match]);
    }
  }

  const seeds: FindingSeed[] = [];

  for (const group of groups.values()) {
    const sorted = group.slice().sort((a, b) => {
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      const severityDiff = getSeverityRank(a.severity) - getSeverityRank(b.severity);
      if (severityDiff !== 0) return severityDiff;
      const specificityDiff =
        specificityOf(b.ruleId, context.rules) - specificityOf(a.ruleId, context.rules);
      if (specificityDiff !== 0) return specificityDiff;
      return comparePathAsc(a.ruleId, b.ruleId);
    });

    let cluster: RawMatch[] = [];
    let clusterEnd = -1;

    const flush = (): void => {
      if (cluster.length === 0) return;
      const winner = pickWinner(cluster, context.rules);
      const suppressed = [
        ...new Set(
          cluster
            .filter((item) => item !== winner)
            .map((item) => item.ruleId),
        ),
      ].filter((id) => id !== winner.ruleId);
      seeds.push(toSeed(winner, suppressed, context));
      cluster = [];
      clusterEnd = -1;
    };

    for (const match of sorted) {
      if (cluster.length === 0) {
        cluster = [match];
        clusterEnd = match.endIndex;
        continue;
      }
      if (match.startIndex < clusterEnd) {
        cluster.push(match);
        clusterEnd = Math.max(clusterEnd, match.endIndex);
      } else {
        flush();
        cluster = [match];
        clusterEnd = match.endIndex;
      }
    }
    flush();
  }

  return seeds;
}

function compareSeeds(a: FindingSeed, b: FindingSeed): number {
  const severityDiff = getSeverityRank(a.severity) - getSeverityRank(b.severity);
  if (severityDiff !== 0) return severityDiff;
  if (a.inCodeFence !== b.inCodeFence) return a.inCodeFence ? 1 : -1;
  const pathDiff = comparePathAsc(a.filePath, b.filePath);
  if (pathDiff !== 0) return pathDiff;
  if (a.line !== b.line) return a.line - b.line;
  return comparePathAsc(a.ruleId, b.ruleId);
}

export function sortFindingSeeds(seeds: readonly FindingSeed[]): FindingSeed[] {
  return seeds.slice().sort(compareSeeds);
}

export function finalizeFindings(
  seeds: readonly FindingSeed[],
  _jobId: string,
): Finding[] {
  const sorted = sortFindingSeeds(seeds);

  return sorted.map((seed, index) => ({
    id: `f-${index + 1}`,
    ruleId: seed.ruleId,
    ruleName: seed.ruleName,
    severity: seed.severity,
    filePath: seed.filePath,
    line: seed.line,
    maskedSnippet: seed.maskedSnippet,
    context: seed.context,
    sourceKind: seed.sourceKind,
    inCodeFence: seed.inCodeFence,
    description: seed.description,
    suggestion: seed.suggestion,
    suppressedRuleIds: seed.suppressedRuleIds,
    snippetTruncated: seed.snippetTruncated,
  }));
}

export function buildSeverityCounts(findings: readonly Finding[]): SeverityCounts {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return counts;
}

export function buildSummary(args: SummaryInput): ScanSummary {
  const severityCounts = buildSeverityCounts(args.findings);
  const riskFiles = new Set(args.findings.map((finding) => finding.filePath)).size;
  const status: ScanStatus = args.status;
  return {
    totalFiles: args.totalFiles,
    scannedFiles: args.scannedFiles,
    skippedFiles: args.skippedFiles,
    riskFiles,
    severityCounts,
    durationMs: Math.max(0, Math.round(args.durationMs)),
    status,
  };
}
