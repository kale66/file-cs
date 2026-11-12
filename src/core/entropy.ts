import type { EntropyConfig } from '@/types';

const BASE64_RE = /^[A-Za-z0-9+/=_-]+$/;
const HEX_RE = /^[0-9a-fA-F]+$/;

export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  const length = value.length;
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function normalized(value: string): string {
  return value.replace(/^['"`]|['"`]$/g, '').trim();
}

export function isBase64Style(value: string): boolean {
  const candidate = normalized(value);
  if (candidate.length === 0) return false;
  if (!BASE64_RE.test(candidate)) return false;
  return candidate.length >= 16;
}

export function isHexStyle(value: string): boolean {
  const candidate = normalized(value);
  if (candidate.length === 0) return false;
  return HEX_RE.test(candidate);
}

export function qualifiesAsHighEntropy(value: string, config: EntropyConfig): boolean {
  const candidate = normalized(value);
  if (candidate.length < config.minLength || candidate.length > config.maxLength) {
    return false;
  }

  let charsetMatches = false;
  if (config.charsets.includes('hex') && isHexStyle(candidate)) {
    charsetMatches = true;
  }
  if (config.charsets.includes('base64') && isBase64Style(candidate)) {
    charsetMatches = true;
  }
  if (!charsetMatches) return false;

  return shannonEntropy(candidate) > config.threshold;
}