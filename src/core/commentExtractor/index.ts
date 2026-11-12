import type {
  CommentSnippet,
  ExtractDiagnostic,
  ExtractInput,
  ExtractResult,
  LanguageSpec,
} from '@/types';
import { normalizeNewlines } from '@/core/text';
import {
  getLanguageSpec,
  lookupByExtension,
  lookupByFileName,
} from '@/core/commentExtractor/languageMap';
import { extractCFamily } from '@/core/commentExtractor/cFamily';
import { extractHashFamily } from '@/core/commentExtractor/hashFamily';
import { extractSql } from '@/core/commentExtractor/sql';
import { extractMarkup } from '@/core/commentExtractor/markup';
import { extractLua } from '@/core/commentExtractor/lua';
import { extractBatch } from '@/core/commentExtractor/batch';
import { extractPython } from '@/core/commentExtractor/python';
import { extractMarkdown } from '@/core/commentExtractor/markdown';
import { extractPlainText } from '@/core/commentExtractor/plainText';

const REGEX_LANGUAGES = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs']);
const TEMPLATE_LANGUAGES = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs']);
const NESTED_BLOCK_LANGUAGES = new Set(['rs', 'swift']);
const SHEBANG_LANGUAGES = new Set(['py', 'sh', 'bash', 'zsh', 'fish', 'rb', 'pl']);

function getExtension(relPath: string): string {
  const lastSegment = relPath.slice(relPath.lastIndexOf('/') + 1);
  const dot = lastSegment.lastIndexOf('.');
  return dot > 0 ? lastSegment.slice(dot + 1).toLowerCase() : '';
}

function getBaseName(relPath: string): string {
  return relPath.slice(relPath.lastIndexOf('/') + 1);
}

export function resolveLanguage(relPath: string, displayName: string): LanguageSpec | null {
  const baseName = displayName.length > 0 ? displayName : getBaseName(relPath);
  const byName = lookupByFileName(baseName);
  if (byName) return byName;
  return lookupByExtension(getExtension(relPath));
}

export function extractSnippets(input: ExtractInput): ExtractResult {
  const language =
    input.classification.language ?? resolveLanguage(input.relPath, input.displayName);
  const diagnostics: ExtractDiagnostic[] = [];
  const onDiagnostic = (diagnostic: ExtractDiagnostic): void => {
    diagnostics.push(diagnostic);
    input.options.onDiagnostic?.(diagnostic);
  };
  const text = normalizeNewlines(input.text);
  const baseOptions = {
    maxSnippetBytes: input.options.maxSnippetBytes,
    startLine: input.options.startLine,
    onDiagnostic,
  };
  const extension = getExtension(input.relPath);
  const baseName = getBaseName(input.relPath);

  let snippets: CommentSnippet[] = [];

  if (input.classification.kind === 'config') {
    snippets = extractPlainText(text, baseOptions, 'config');
  } else if (!language) {
    snippets = [];
  } else {
    switch (language.id) {
      case 'c-family':
        snippets = extractCFamily(text, {
          ...baseOptions,
          enableRegexLiteral: REGEX_LANGUAGES.has(extension),
          enableTemplateLiteral: TEMPLATE_LANGUAGES.has(extension),
          nestedBlockComments: NESTED_BLOCK_LANGUAGES.has(extension),
        });
        break;
      case 'hash':
        snippets = extractHashFamily(text, {
          ...baseOptions,
          ignoreShebang: SHEBANG_LANGUAGES.has(extension),
          dockerfileStyle: /^dockerfile/i.test(baseName),
        });
        break;
      case 'sql':
        snippets = extractSql(text, baseOptions);
        break;
      case 'markup':
        snippets = extractMarkup(text, {
          ...baseOptions,
          extractEmbeddedScript: true,
          extractEmbeddedStyle: true,
        });
        break;
      case 'lua':
        snippets = extractLua(text, baseOptions);
        break;
      case 'batch':
        snippets = extractBatch(text, baseOptions);
        break;
      case 'python':
        snippets = extractPython(text, {
          ...baseOptions,
          scanDocstring: input.scanPythonDocstring,
        });
        break;
      case 'markdown':
        snippets = extractMarkdown(text, {
          ...baseOptions,
          fenceChars: ['```', '~~~'],
        });
        break;
      case 'text':
        snippets = extractPlainText(text, baseOptions, 'document');
        break;
      default:
        snippets = [];
    }
  }

  for (const snippet of snippets) {
    if (snippet.truncated) {
      diagnostics.push({
        code: 'snippet-truncated',
        line: snippet.startLine,
        detail: '注释片段超过 8KB，已截断后再匹配',
      });
    }
  }

  snippets.sort((a, b) => a.startLine - b.startLine);

  return {
    snippets,
    language: language ?? (input.classification.kind === 'config' ? getLanguageSpec('text') : null),
    diagnostics,
  };
}