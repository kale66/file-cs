import type {
  FileNamePattern,
  LanguageId,
  LanguageSpec,
} from '@/types';

export const LANGUAGE_SPECS: readonly LanguageSpec[] = [
  {
    id: 'c-family',
    displayName: 'C 系语言',
    extensions: [
      'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'java', 'kt',
      'scala', 'groovy', 'go', 'rs', 'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php',
      'swift', 'm', 'mm', 'css', 'scss', 'less', 'sass',
    ],
    fullText: false,
    sourceKinds: ['line-comment', 'block-comment'],
  },
  {
    id: 'hash',
    displayName: '井号注释语言',
    extensions: [
      'py', 'rb', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'yaml', 'yml', 'toml',
      'ini', 'conf', 'cfg', 'properties', 'r', 'pl',
    ],
    fullText: false,
    sourceKinds: ['line-comment'],
  },
  {
    id: 'sql',
    displayName: 'SQL',
    extensions: ['sql'],
    fullText: false,
    sourceKinds: ['line-comment', 'block-comment'],
  },
  {
    id: 'markup',
    displayName: 'HTML / XML / Vue / Svelte',
    extensions: ['html', 'htm', 'xml', 'vue', 'svelte'],
    fullText: false,
    sourceKinds: ['block-comment'],
  },
  {
    id: 'lua',
    displayName: 'Lua',
    extensions: ['lua'],
    fullText: false,
    sourceKinds: ['line-comment', 'block-comment'],
  },
  {
    id: 'batch',
    displayName: 'Batch 脚本',
    extensions: ['bat', 'cmd'],
    fullText: false,
    sourceKinds: ['line-comment'],
  },
  {
    id: 'python',
    displayName: 'Python',
    extensions: ['py'],
    fullText: false,
    sourceKinds: ['line-comment', 'docstring'],
  },
  {
    id: 'markdown',
    displayName: 'Markdown',
    extensions: ['md', 'markdown', 'mdx'],
    fullText: true,
    sourceKinds: ['document', 'fence-sample'],
  },
  {
    id: 'text',
    displayName: '纯文本',
    extensions: ['rst', 'txt', 'adoc'],
    fullText: true,
    sourceKinds: ['document'],
  },
];

export function buildExtensionMap(): Readonly<Record<string, LanguageId>> {
  const map: Record<string, LanguageId> = {};
  for (const spec of LANGUAGE_SPECS) {
    for (const extension of spec.extensions) {
      map[extension] = spec.id;
    }
  }
  return map;
}

export const EXTENSION_TO_LANGUAGE: Readonly<Record<string, LanguageId>> =
  buildExtensionMap();

export const FILENAME_PATTERNS: readonly FileNamePattern[] = [
  { pattern: /^makefile(\..*)?$/i, languageId: 'hash' },
  { pattern: /^gnumakefile$/i, languageId: 'hash' },
  { pattern: /^dockerfile(\..*)?$/i, languageId: 'hash' },
  { pattern: /^(readme|contributing|changelog|security)(\..*)?$/i, languageId: 'text' },
];

const SPEC_BY_ID = new Map<LanguageId, LanguageSpec>(
  LANGUAGE_SPECS.map((spec) => [spec.id, spec]),
);

export function lookupByExtension(extension: string): LanguageSpec | null {
  const id = EXTENSION_TO_LANGUAGE[extension.toLowerCase()];
  return id ? (SPEC_BY_ID.get(id) ?? null) : null;
}

export function lookupByFileName(fileName: string): LanguageSpec | null {
  for (const item of FILENAME_PATTERNS) {
    if (item.pattern.test(fileName)) {
      return SPEC_BY_ID.get(item.languageId) ?? null;
    }
  }
  return null;
}

export function getLanguageSpec(id: LanguageId): LanguageSpec | null {
  return SPEC_BY_ID.get(id) ?? null;
}