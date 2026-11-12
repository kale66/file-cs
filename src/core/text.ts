export interface DecodeResult {
  readonly text: string;
  readonly replacementCount: number;
  readonly hadBom: boolean;
}

const BOM = '\uFEFF';

export function decodeUtf8(bytes: Uint8Array): DecodeResult {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = decoder.decode(bytes);
  const hadBom = text.startsWith(BOM);
  if (hadBom) text = text.slice(BOM.length);
  let replacementCount = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 0xfffd) replacementCount += 1;
  }
  return { text, replacementCount, hadBom };
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function splitLines(text: string): string[] {
  return text.split('\n');
}

const encoder = new TextEncoder();

export function sliceByBytes(
  text: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  if (maxBytes <= 0) return { text: '', truncated: text.length > 0 };
  if (encoder.encode(text).byteLength <= maxBytes) {
    return { text, truncated: false };
  }

  let bytes = 0;
  let end = 0;
  for (const char of text) {
    const size = encoder.encode(char).byteLength;
    if (bytes + size > maxBytes) break;
    bytes += size;
    end += char.length;
  }
  return { text: text.slice(0, end), truncated: true };
}