/* ============ 1. 基础枚举 ============ */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type ScanPhase =
  | 'idle'
  | 'validating'
  | 'unzipping'
  | 'filtering'
  | 'scanning'
  | 'finalizing';

export type ScanStatus = 'completed' | 'empty' | 'cancelled' | 'failed';

export type FileKind = 'document' | 'code' | 'config' | 'unknown';

export type LanguageId =
  | 'c-family'
  | 'hash'
  | 'sql'
  | 'markup'
  | 'lua'
  | 'batch'
  | 'python'
  | 'markdown'
  | 'text';

export type SourceKind =
  | 'line-comment'
  | 'block-comment'
  | 'docstring'
  | 'document'
  | 'config'
  | 'fence-sample';

export type SkipReason =
  | 'ignored-directory'
  | 'ignored-type'
  | 'too-large'
  | 'unsupported-extension'
  | 'illegal-path'
  | 'parse-error'
  | 'non-text'
  | 'archive-encrypted';

export type IgnoreGroupId =
  | 'ignore-directories'
  | 'ignore-build-output'
  | 'ignore-lock-files'
  | 'ignore-binary-types'
  | 'ignore-large-files'
  | 'ignore-unknown-extensions';

export type MaskKind =
  | 'generic'
  | 'url-credentials'
  | 'connection-string'
  | 'private-key'
  | 'jwt'
  | 'email'
  | 'phone'
  | 'full';

export type IllegalPathReason =
  | 'parent-segment'
  | 'absolute-path'
  | 'drive-letter'
  | 'control-character'
  | 'empty-segment'
  | 'path-too-long';

export type ClsErrorCode =
  | 'CLS-E-1001'
  | 'CLS-E-1002'
  | 'CLS-E-1003'
  | 'CLS-E-1004'
  | 'CLS-E-1005'
  | 'CLS-E-1006'
  | 'CLS-E-1007'
  | 'CLS-E-1008'
  | 'CLS-E-1009'
  | 'CLS-E-1010'
  | 'CLS-E-1011'
  | 'CLS-E-1012'
  | 'CLS-E-1013'
  | 'CLS-E-1014'
  | 'CLS-E-1015'
  | 'CLS-E-1016'
  | 'CLS-E-1017'
  | 'CLS-E-1018'
  | 'CLS-E-2001'
  | 'CLS-E-2002'
  | 'CLS-E-3001'
  | 'CLS-E-3002'
  | 'CLS-E-4001';

/* ============ 2. 硬性上限常量 ============ */

export const LIMITS = {
  maxArchiveBytes: 104_857_600,
  maxFileSizeBytes: 2_097_152,
  maxTotalUnzipBytes: 524_288_000,
  maxSnippetBytes: 8_192,
  maxEntries: 50_000,
  maxCompressionRatio: 100,
  maxCompressionRatioFloorBytes: 10_485_760,
  maxContextLineChars: 200,
  maxRevealBytesPerFinding: 8_192,
  maxRevealTotalBytes: 16_777_216,
  resultsPageSize: 200,
  skippedPreviewCount: 100,
} as const;

export const PROTOCOL_VERSION = 2 as const;
export const REPORT_VERSION = '1.0' as const;

/* ============ 3. 扫描配置 ============ */

export interface IgnoreGroups {
  readonly ignoreDirectories: boolean;
  readonly ignoreBuildOutput: boolean;
  readonly ignoreLockFiles: boolean;
  readonly ignoreBinaryTypes: boolean;
  readonly ignoreLargeFiles: boolean;
  readonly ignoreUnknownExtensions: boolean;
}

export interface ScanConfig {
  readonly ignoreGroups: IgnoreGroups;
  readonly scanPythonDocstring: boolean;
  readonly scanContactInfo: boolean;
  readonly maxFileSizeBytes: number;
  readonly maxTotalUnzipBytes: number;
  readonly maxArchiveBytes: number;
  readonly ruleSetVersion: string;
  readonly scannedAt: string;
}

export interface ConfigChangeNotice {
  readonly changed: boolean;
  readonly message: string;
}

/* ============ 4. 归档与文件元数据 ============ */

export interface PathValidation {
  readonly legal: boolean;
  readonly normalized: string;
  readonly reason: IllegalPathReason | null;
}

export interface ArchiveEntryMeta {
  readonly path: string;
  readonly displayName: string;
  readonly isDirectory: boolean;
  readonly compressedSize: number | null;
  readonly uncompressedSize: number | null;
  readonly encrypted: boolean;
  readonly pathValidation: PathValidation;
  readonly readIndex: number;
}

export interface FileClassification {
  readonly kind: FileKind;
  readonly language: LanguageSpec | null;
  readonly fullText: boolean;
  readonly matchedRule: 'extension' | 'filename' | 'docs-dir' | 'env-prefix' | 'none';
}

export interface LanguageSpec {
  readonly id: LanguageId;
  readonly displayName: string;
  readonly extensions: readonly string[];
  readonly fullText: boolean;
  readonly sourceKinds: readonly SourceKind[];
}

export interface FileNamePattern {
  readonly pattern: RegExp;
  readonly languageId: LanguageId;
}

export interface ScanDecision {
  readonly action: 'scan' | 'skip';
  readonly classification: FileClassification;
  readonly skipReason: SkipReason | null;
  readonly detail: string;
}

export interface BombGuardDecision {
  readonly action: 'continue' | 'abort';
  readonly reason: 'total-bytes' | 'compression-ratio' | 'entry-count' | null;
  readonly observed: number;
  readonly limit: number;
}

/* ============ 5. 注释片段 ============ */

export interface CommentSnippet {
  readonly startLine: number;
  readonly endLine: number;
  readonly text: string;
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly truncated: boolean;
}

export interface ExtractOptions {
  readonly maxSnippetBytes: number;
  readonly startLine?: number;
  readonly onDiagnostic?: (diagnostic: ExtractDiagnostic) => void;
}

export interface CFamilyOptions extends ExtractOptions {
  readonly enableRegexLiteral: boolean;
  readonly enableTemplateLiteral: boolean;
  readonly nestedBlockComments?: boolean;
}

export interface HashFamilyOptions extends ExtractOptions {
  readonly ignoreShebang: boolean;
  readonly dockerfileStyle?: boolean;
}

export interface MarkupOptions extends ExtractOptions {
  readonly extractEmbeddedScript: boolean;
  readonly extractEmbeddedStyle: boolean;
}

export interface PythonOptions extends ExtractOptions {
  readonly scanDocstring: boolean;
}

export interface MarkdownOptions extends ExtractOptions {
  readonly fenceChars: readonly string[];
}

export interface ExtractInput {
  readonly relPath: string;
  readonly displayName: string;
  readonly text: string;
  readonly classification: FileClassification;
  readonly options: ExtractOptions;
  readonly scanPythonDocstring: boolean;
}

export type ExtractDiagnosticCode =
  | 'unclosed-block-comment'
  | 'unclosed-string'
  | 'unclosed-fence'
  | 'snippet-truncated'
  | 'non-text';

export interface ExtractDiagnostic {
  readonly code: ExtractDiagnosticCode;
  readonly line: number | null;
  readonly detail: string;
}

export interface ExtractResult {
  readonly snippets: readonly CommentSnippet[];
  readonly language: LanguageSpec | null;
  readonly diagnostics: readonly ExtractDiagnostic[];
}

/* ============ 5.1 单文件扫描输入与产出 ============ */

export interface FileScanInput {
  readonly filePath: string;
  readonly text: string;
  readonly classification: FileClassification;
}

export interface FileScanOutcome {
  readonly filePath: string;
  readonly snippets: readonly CommentSnippet[];
  readonly matches: readonly RawMatch[];
  readonly diagnostics: readonly ExtractDiagnostic[];
  readonly truncatedSnippetCount: number;
}

export interface SummaryInput {
  readonly totalFiles: number;
  readonly scannedFiles: number;
  readonly skippedFiles: number;
  readonly findings: readonly Finding[];
  readonly durationMs: number;
  readonly status: ScanStatus;
}

/* ============ 6. 检测规则 ============ */

export interface EntropyConfig {
  readonly threshold: number;
  readonly minLength: number;
  readonly maxLength: number;
  readonly charsets: readonly ('base64' | 'hex')[];
}

export type DedupeFamily =
  | 'secret-value'
  | 'connection'
  | 'network-location'
  | 'default-credential'
  | 'contact';

export type RuleValidator =
  | 'none'
  | 'ipv4-private'
  | 'password-like'
  | 'no-sample-host'
  | 'jwt-three-segments'
  | 'private-key'
  | 'doubao-uuid';

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly severity: Severity;
  readonly pattern: string;
  readonly flags: string;
  readonly description: string;
  readonly suggestion: string;
  readonly maskKind: MaskKind;
  readonly captureGroup: number;
  readonly validator: RuleValidator;
  readonly dedupeFamily: DedupeFamily;
  readonly specificity: number;
  readonly placeholderGuard: boolean;
  readonly sampleGuard: boolean;
  readonly entropy: EntropyConfig | null;
  readonly enabledByDefault: boolean;
}

export interface CompiledRule {
  readonly rule: Rule;
  readonly regex: RegExp;
}

export interface RuleValidationIssue {
  readonly ruleId: string;
  readonly field: string;
  readonly message: string;
}

export interface RuleCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly severity: Severity;
  readonly description: string;
  readonly suggestion: string;
  readonly enabledByDefault: boolean;
}

/* ============ 7. 命中与去重 ============ */

export interface RawMatch {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly filePath: string;
  readonly line: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly rawValue: string;
  readonly matchedText: string;
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly snippetIndex: number;
  readonly snippetTruncated: boolean;
  readonly maskedSnippet: string;
  readonly snippetText: string;
}

export interface FindingContext {
  readonly before: string | null;
  readonly after: string | null;
}

export interface FindingSeed {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly filePath: string;
  readonly line: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly maskedSnippet: string;
  readonly context: FindingContext;
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly description: string;
  readonly suggestion: string;
  readonly suppressedRuleIds: readonly string[];
  readonly snippetTruncated: boolean;
  /** 仅驻留 Worker 内存，用于二次确认展开；不进入 Finding/导出/日志。 */
  readonly rawSnippet: string;
}

export interface Finding {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly filePath: string;
  readonly line: number;
  readonly maskedSnippet: string;
  readonly context: FindingContext;
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly description: string;
  readonly suggestion: string;
  readonly suppressedRuleIds: readonly string[];
  readonly snippetTruncated: boolean;
}

/** 仅驻留主线程内存；不进入 Finding、不进入导出、不写日志。 */
export interface RawSnippetStore {
  get(findingId: string): string | undefined;
  set(findingId: string, raw: string): boolean;
  delete(findingId: string): void;
  clear(): void;
  readonly totalBytes: number;
  readonly count: number;
}

/* ============ 8. 跳过项与摘要 ============ */

export interface SkippedFile {
  readonly path: string;
  readonly reason: SkipReason;
  readonly sizeBytes: number | null;
  readonly detail: string;
}

export type SkipReasonCounts = Readonly<Record<SkipReason, number>>;

export interface SeverityCounts {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

export interface ScanSummary {
  readonly totalFiles: number;
  readonly scannedFiles: number;
  readonly skippedFiles: number;
  readonly riskFiles: number;
  readonly severityCounts: SeverityCounts;
  readonly durationMs: number;
  readonly status: ScanStatus;
}

export interface ScanDiagnostic {
  readonly filePath: string;
  readonly code: ExtractDiagnosticCode;
  readonly line: number | null;
  readonly detail: string;
}

export interface ScanResult {
  readonly jobId: string;
  readonly config: ScanConfig;
  readonly summary: ScanSummary;
  readonly findings: readonly Finding[];
  readonly skippedFiles: readonly SkippedFile[];
  readonly skipReasonCounts: SkipReasonCounts;
  readonly diagnostics: readonly ScanDiagnostic[];
}

/* ============ 9. 进度与线程协议 ============ */

export interface ScanProgress {
  readonly jobId: string;
  readonly phase: ScanPhase;
  readonly percent: number;
  readonly processed: number;
  readonly total: number;
  readonly currentPath: string | null;
  readonly elapsedMs: number;
}

export interface FindingBatch {
  readonly jobId: string;
  readonly sequence: number;
  readonly findings: readonly Finding[];
  readonly rawByFindingId: Readonly<Record<string, string>>;
}

export interface SkippedBatch {
  readonly jobId: string;
  readonly sequence: number;
  readonly items: readonly SkippedFile[];
}

export interface ScanCompletion {
  readonly jobId: string;
  readonly summary: ScanSummary;
  readonly skippedTotal: number;
  readonly skipReasonCounts: SkipReasonCounts;
  readonly diagnostics: readonly ScanDiagnostic[];
  readonly diagnosticTotal: number;
}

export type ChannelFailureCategory =
  | 'construct'
  | 'load'
  | 'parse'
  | 'protocol'
  | 'timeout'
  | 'engine'
  | 'delivery'
  | 'concurrency'
  | 'unclassified';

export type ChannelPhase = 'create' | 'load' | 'ready' | 'running' | 'finalize';

export type RetryAction = 'retry' | 'reupload' | 'refresh' | 'none';

export interface ChannelCounters {
  readonly progress: number;
  readonly findings: number;
  readonly skipped: number;
  readonly invalid: number;
  readonly staleJob: number;
  readonly ping: number;
  readonly pong: number;
  readonly loadFailure: number;
  readonly rebuild: number;
  readonly stalledAlive: number;
}

export interface ChannelIssue {
  readonly failure: WorkerFailure;
  readonly needsReacquire: boolean;
  readonly counts: ChannelCounters;
}

export interface WorkerFailure {
  readonly code: ClsErrorCode;
  readonly message: string;
  readonly hint: string;
  readonly fatal: boolean;
  readonly category?: ChannelFailureCategory;
  readonly phase?: ChannelPhase;
  readonly recovered?: boolean;
  readonly retryable?: RetryAction;
  readonly diagnosticId?: string;
}

export interface FolderFilePayload {
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
  readonly file: File;
}

export interface StartPayloadZip {
  readonly source: 'zip';
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly data: ArrayBuffer;
}

export interface StartPayloadFolder {
  readonly source: 'folder';
  readonly folderName: string;
  readonly files: readonly FolderFilePayload[];
  readonly totalBytes: number;
}

export type StartPayload = StartPayloadZip | StartPayloadFolder;

export interface WorkerStartRequest {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:start';
  readonly jobId: string;
  readonly config: ScanConfig;
  readonly payload: StartPayload;
}

export interface WorkerCancelRequest {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:cancel';
  readonly jobId: string;
}

export interface WorkerPingRequest {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:ping';
  readonly jobId: string;
}

export type WorkerRequest = WorkerStartRequest | WorkerCancelRequest | WorkerPingRequest;

export interface WorkerProgressResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:progress';
  readonly event: ScanProgress;
}

export interface WorkerFindingsResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:findings';
  readonly batch: FindingBatch;
}

export interface WorkerSkippedResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:skipped';
  readonly batch: SkippedBatch;
}

export interface WorkerDoneResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:done';
  readonly completion: ScanCompletion;
}

export interface WorkerErrorResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:error';
  readonly jobId: string;
  readonly failure: WorkerFailure;
}

export interface WorkerCancelledResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:cancelled';
  readonly jobId: string;
}

export interface WorkerPongResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:pong';
  readonly jobId: string;
  readonly phase: ChannelPhase;
}

export type WorkerResponse =
  | WorkerProgressResponse
  | WorkerFindingsResponse
  | WorkerSkippedResponse
  | WorkerDoneResponse
  | WorkerErrorResponse
  | WorkerCancelledResponse
  | WorkerPongResponse;

export interface DiagnosticsSnapshot {
  readonly schema: 1;
  readonly diagnosticId: string;
  readonly generatedAt: string;
  readonly appVersion: string;
  readonly buildMode: 'standard' | 'single';
  readonly pageProtocol: 'http' | 'https' | 'file' | 'other';
  readonly engineAvailable: boolean;
  readonly engineSource: 'external' | 'inline' | 'none';
  readonly protocolVersion: number | null;
  readonly protocolExpected: number;
  readonly counters: ChannelCounters;
  readonly lastFailure: {
    readonly code: ClsErrorCode;
    readonly category: ChannelFailureCategory;
    readonly phase: ChannelPhase;
    readonly atMs: number;
  } | null;
  readonly degraded: boolean;
  readonly degradeReason: ChannelFailureCategory | null;
  readonly phase: string;
  readonly elapsedMs: number | null;
}

/* ============ 10. 导出 ============ */

export interface ExportFinding {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly filePath: string;
  readonly line: number;
  readonly maskedSnippet: string;
  readonly context: FindingContext;
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly description: string;
  readonly suggestion: string;
  readonly suppressedRuleIds: readonly string[];
}

export interface ExportReport {
  readonly version: typeof REPORT_VERSION;
  readonly generatedAt: string;
  readonly config: ScanConfig;
  readonly summary: ScanSummary;
  readonly findings: readonly ExportFinding[];
  readonly skippedFiles: readonly SkippedFile[];
  readonly ruleCatalog: readonly RuleCatalogEntry[];
  readonly diagnostics: readonly ScanDiagnostic[];
}

export interface ExportReportInput {
  readonly result: ScanResult;
  readonly ruleCatalog: readonly RuleCatalogEntry[];
  readonly generatedAt: string;
}

/* ============ 11. UI 共享状态 ============ */

export interface FilterState {
  readonly severities: readonly Severity[];
  readonly ruleIds: readonly string[];
  readonly pathQuery: string;
  readonly includeFenceSamples: boolean;
  readonly onlyFenceSamples: boolean;
}

export interface FindingGroup {
  readonly filePath: string;
  readonly findings: readonly Finding[];
  readonly severityCounts: SeverityCounts;
  readonly collapsed: boolean;
}

export interface FilteredFindingsResult {
  readonly groups: readonly FindingGroup[];
  readonly visibleCount: number;
  readonly totalCount: number;
  readonly pageCount: number;
}

export type AppPhase =
  | 'idle'
  | 'validating'
  | 'scanning'
  | 'result'
  | 'empty'
  | 'cancelled'
  | 'error';

export interface AppState {
  readonly phase: AppPhase;
  readonly config: ScanConfig;
  readonly progress: ScanProgress | null;
  readonly result: ScanResult | null;
  readonly error: WorkerFailure | null;
  readonly filter: FilterState;
  readonly page: number;
  readonly activeJobId: string | null;
  readonly reveal: RevealState | null;
  readonly configNotice: ConfigChangeNotice | null;
}

export interface RevealState {
  readonly findingId: string;
  readonly confirmed: boolean;
  readonly raw: string;
}