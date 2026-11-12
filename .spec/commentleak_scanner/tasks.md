# CommentLeak Scanner 编码任务清单（阶段 3）

## 0. 文档信息

| 项 | 内容 |
|---|---|
| 特性 | `commentleak_scanner`（浏览器端注释敏感信息扫描器） |
| 上游文档 | `.codeartsdoer/specs/commentleak_scanner/spec.md`（1531 行，92 条需求）、`.codeartsdoer/specs/commentleak_scanner/design.md`（3312 行） |
| 文档版本 | v1.0 / 2026-11-12 |
| 任务规模 | 8 个任务组、76 个子任务 |
| 编号规则 | 组号.序号；组号即实施层级，子任务按依赖顺序编号 |
| 复杂度口径 | S ≤ 0.5 天；M ≈ 1 天；L ≈ 2 天；XL > 2 天 |
| 阶段边界 | 本文件只描述"做什么/做到什么程度"，不含应用源码；不得在本阶段初始化工程、安装依赖或执行构建 |

**任务分层顺序（强制）**：脚手架与构建 → 类型与基础设施 → 核心纯函数（unzip → fileFilter → commentExtractor → rules → redact → scanner）→ Worker 与协议 → UI → 导出 → 验收夹具与自测 → README。

**每个任务卡的固定字段**：编号与标题、目标、涉及文件、前置依赖、验收断言、预估复杂度。

## 1. 里程碑与任务总览

### 1.1 里程碑定义

| 里程碑 | 出口标准 | 覆盖任务 |
|---|---|---|
| M1 可跑通最小闭环 | `npm run dev` 可启动；上传 zip → Worker 解压 → js/py 注释提取 → 核心规则匹配 → 基础脱敏 → 结果表展示；`tsc --noEmit` 通过 | 1.1~1.5、2.1~2.6、3.1、3.2、3.4~3.7、3.16、3.18~3.22、4.1~4.3、4.5、4.6、5.1~5.6 |
| M2 规则与提取完善 | 9 个提取器全部可用、21 条规则与守卫齐备、文件夹输入与取消/进度/raw 预算完成、提取与核心单测通过 | 3.3、3.8~3.15、3.17、4.4、4.7、7.1、7.4~7.6 |
| M3 UI 与导出 | 统计卡/过滤/分页/分组/展开/Skip 面板/配置面板/隐私声明完成，JSON/CSV/路径复制可用 | 3.23、5.7~5.15、6.1~6.4 |
| M4 验收与文档 | 18 条验收用例有结论、双构建验证通过、README 与验收证据齐全 | 1.6、6.5、7.2、7.3、7.7~7.10、8.1~8.4 |

### 1.2 任务总览表

| 编号 | 任务 | 里程碑 | 前置依赖 | 复杂度 |
|---|---|---|---|---|
| 1.1 | 初始化 npm 工程、脚本与依赖 | M1 | — | S |
| 1.2 | TypeScript 与标准 Vite 构建配置 | M1 | 1.1 | M |
| 1.3 | 单文件构建与 Worker 工厂 alias | M1 | 1.2 | M |
| 1.4 | Tailwind/PostCSS、index.html、入口骨架 | M1 | 1.2 | S |
| 1.5 | ESLint 安全规则与 Vitest 配置 | M1 | 1.1 | S |
| 1.6 | 零网络与产物完整性校验脚本 | M4 | 1.2、7.9 | S |
| 2.1 | `src/types.ts` 全量契约 | M1 | 1.2 | L |
| 2.2 | 错误目录与 `ClsError` | M1 | 2.1 | S |
| 2.3 | 路径规范化与稳定排序 | M1 | 2.1 | S |
| 2.4 | UTF-8 解码、换行与字节切片 | M1 | 2.1 | S |
| 2.5 | 默认配置、配置变更与快照 | M1 | 2.1、2.2 | S |
| 2.6 | 安全日志 | M1 | 2.1、2.2 | S |
| 3.1 | zip 打开与条目按需读取 | M1 | 1.1、2.1~2.4 | L |
| 3.2 | zip 炸弹防护与非法路径判定 | M1 | 3.1、2.3 | M |
| 3.3 | 本地文件夹读取器 | M2 | 3.1、3.2 | M |
| 3.4 | 扫描范围判定与忽略组 | M1 | 2.1、2.3 | M |
| 3.5 | 提取器骨架、语言映射与片段构造 | M1 | 2.1、2.4、3.4 | M |
| 3.6 | C 系注释状态机 | M1 | 3.5 | L |
| 3.7 | 井号系注释提取 | M1 | 3.5 | M |
| 3.8 | SQL 注释提取 | M2 | 3.5 | S |
| 3.9 | HTML/XML/Vue/Svelte 注释提取 | M2 | 3.5、3.6 | M |
| 3.10 | Lua 注释提取 | M2 | 3.5 | S |
| 3.11 | Batch 注释提取与 `.bat/.cmd` 白名单 | M2 | 3.5、3.4 | S |
| 3.12 | Python 注释与 docstring | M2 | 3.5 | M |
| 3.13 | Markdown 围栏追踪 | M2 | 3.5 | M |
| 3.14 | 纯文本与文档全文提取 | M2 | 3.5 | S |
| 3.15 | Shannon 熵与字符集判定 | M2 | 2.1 | S |
| 3.16 | 规则框架、编译缓存与核心规则 | M1 | 2.1、2.2 | L |
| 3.17 | 21 条规则、守卫与三处规则偏差 | M2 | 3.16、3.15 | L |
| 3.18 | 值级脱敏 | M1 | 2.1 | M |
| 3.19 | 片段脱敏、上下文与截断 | M1 | 3.18、3.5 | M |
| 3.20 | 片段匹配与单文件扫描 | M1 | 3.16、3.5、2.4 | L |
| 3.21 | 去重、排序与命中编号 | M1 | 3.20、3.18、3.16 | L |
| 3.22 | 摘要与级别统计 | M1 | 2.1、3.21 | S |
| 3.23 | 导出清洗与 `RawSnippetStore` | M3 | 3.18、3.19 | M |
| 4.1 | Worker 消息协议与运行时守卫 | M1 | 2.1、3.22 | M |
| 4.2 | Worker 入口 | M1 | 4.1、4.3 | S |
| 4.3 | 作业编排主流程 | M1 | 3.1~3.4、3.20~3.22 | L |
| 4.4 | 取消、进度节流与 raw 预算 | M2 | 4.3 | M |
| 4.5 | 主线程 Worker 客户端 | M1 | 4.1 | L |
| 4.6 | 标准/内联 Worker 工厂 | M1 | 1.3、4.1 | S |
| 4.7 | Worker 不可用与主线程降级 | M2 | 4.5、4.6 | M |
| 5.1 | `App` 状态机与 `useScanJob` | M1 | 4.5、2.5 | L |
| 5.2 | 上传入口 | M1 | 5.1 | M |
| 5.3 | 进度面板与取消 | M1 | 5.1、5.6 | S |
| 5.4 | 错误态 | M1 | 2.2、5.6 | S |
| 5.5 | 空态 | M1 | 5.6 | S |
| 5.6 | 基础组件与级别徽标 | M1 | 1.4 | S |
| 5.7 | 统计卡片 | M3 | 5.1、3.22 | S |
| 5.8 | 结果工具栏与过滤 hook | M3 | 5.1、2.1 | M |
| 5.9 | 结果表与分页 | M3 | 5.8、5.6 | L |
| 5.10 | 单条命中行 | M3 | 5.9、3.19 | M |
| 5.11 | 二次确认展开弹窗 | M3 | 3.23、5.10 | M |
| 5.12 | 跳过文件面板 | M3 | 5.1、3.4 | S |
| 5.13 | 忽略规则与规则说明面板 | M3 | 2.5 | M |
| 5.14 | 隐私声明与工具边界 | M3 | 5.6 | S |
| 5.15 | 主题、响应式、可访问性与中文文案 | M3 | 5.2~5.14 | M |
| 6.1 | 导出报告构造 | M3 | 3.23、3.22 | M |
| 6.2 | CSV 转义、路径清单与编码 | M3 | 3.23 | M |
| 6.3 | 下载与剪贴板能力 | M3 | 2.2 | S |
| 6.4 | 导出交互接线 | M3 | 6.1~6.3、5.8 | M |
| 6.5 | 导出脱敏与公式注入审计 | M4 | 6.4、7.5 | S |
| 7.1 | 验收夹具生成脚本 | M2 | 1.1 | M |
| 7.2 | 路径穿越夹具 | M4 | 7.1 | S |
| 7.3 | 大包与炸弹夹具 | M4 | 1.1、7.1 | M |
| 7.4 | 提取器单元测试集 | M2 | 3.6~3.14 | M |
| 7.5 | 核心纯函数单元测试集 | M2 | 3.4、3.15~3.19、2.3~2.5 | M |
| 7.6 | 作业编排集成测试 | M2 | 4.3、7.1 | L |
| 7.7 | ACC-01~18 自动化验证 | M4 | 7.4~7.6、6.5 | M |
| 7.8 | 手动 E2E 与离线验收 | M4 | 7.9、7.1~7.3 | M |
| 7.9 | 双构建与静态校验验证 | M4 | 1.2、1.3、1.6、7.7 | M |
| 7.10 | 性能与安全专项验证 | M4 | 7.9、7.3 | M |
| 8.1 | README 主体 | M4 | 7.8 | M |
| 8.2 | 21 条规则表一致性 | M4 | 3.17、8.1 | S |
| 8.3 | 已知限制、免责与隐私说明 | M4 | 8.1 | S |
| 8.4 | 验收证据与回归清单 | M4 | 7.8~7.10、8.1 | S |

### 1.3 关键路径

```text
1.1 → 1.2 → 2.1 → 2.2/2.3/2.4 → 3.1 → 3.2 → 3.4 → 3.5 → 3.6 → 3.16 → 3.18 → 3.19 → 3.20 → 3.21 → 3.22
→ 4.1 → 4.3 → 4.2 → 4.5 → 4.6 → 5.1 → 5.2/5.3/5.6 → M1 闭环 → 3.17 → 4.4 → 5.8 → 5.9 → 6.1 → 6.2 → 6.4 → 7.6 → 7.9 → 8.1 → 8.4
```

- 决定性瓶颈：3.6（C 系状态机，决定 ACC-02）、3.20/3.21（匹配与去重，决定 ACC-01/03）、4.3（编排，决定所有端到端用例）。
- M1 闭环前不得提前投入 UI 细节与导出，避免核心契约未稳定导致返工。

### 1.4 可并行批次

| 批次 | 可并行任务 | 前提 |
|---|---|---|
| P1 | 1.2、1.4、1.5 | 1.1 完成 |
| P2 | 2.2、2.3、2.4、2.6 | 2.1 完成 |
| P3 | 3.4、3.5 骨架内并行前置；3.6、3.7 并行 | 3.1/3.2 与 3.5 完成 |
| P4 | 3.8、3.9、3.10、3.11、3.12、3.13、3.14、3.15 | 3.5 完成；互不共享文件 |
| P5 | 4.1 可提前穿插 | 2.1 完成 |
| P6 | 5.2、5.3、5.4、5.5、5.6 | 5.1 契约确定 |
| P7 | 5.7、5.8、5.12、5.13、5.14 | 5.1 完成 |
| P8 | 6.1、6.2、6.3 | 3.23 完成 |
| P9 | 7.1 可与 M1 并行；7.4/7.5 随模块完成推进 | 1.1 / 对应模块完成 |

### 1.5 风险任务提示

| 任务 | 风险 | 必须的关注点 |
|---|---|---|
| 3.1 / 3.2 | jszip 内部 `_data.uncompressedSize` 非公开 API（设计 R-03） | 窄接口 `ZipEntryInternals` 隔离；字段缺失回退实际读取 + 2MB 上限；锁定 jszip 版本 |
| 3.6 | 正则字面量启发式误判（R-01） | `/` 判定顺序不可调换；ACC-02 必须 0 命中；歧义写入 README |
| 3.17 | 规则漏检/误报（R-09/R-10） | 三处规则偏差必须落地；占位符/示例主机守卫先于命中生成 |
| 3.20/3.21 | 同族合并与跨族共存冲突（ACC-01 vs ACC-03） | 分组键必须含 `dedupeFamily`；排序键不可用 `localeCompare` |
| 3.23 | 保留 raw 与"仅保留脱敏结果"的张力（R-06） | raw 只在主线程内存；不导出、不日志、刷新即清；16MB/8KB 双上限 |
| 4.3/4.4 | 取消时序与消息顺序 | `done` 前发完批次；旧 jobId 消息一律丢弃；超时 terminate |
| 5.9 | 5000 条渲染卡顿（R-14） | 分页 200 + `content-visibility` + `useMemo` |
| 6.2 | Excel 公式注入（ACC-14） | 转义顺序不可颠倒：先前置 `'`，再引号包裹，最后 `""` |
| 1.3/4.6/7.9 | 单文件 Blob Worker 被 `file://` 拒绝（R-07） | 内联工厂 + 500ms 无进度降级；双构建分别验证 |

## 2. 任务详细清单

### 2.1 组 1：脚手架与构建配置

#### 1.1 初始化 npm 工程、脚本与依赖
- **目标**：建立可复现安装与统一命令入口。
- **涉及文件**：`package.json`、`package-lock.json`、`.gitignore`
- **前置依赖**：—
- **验收断言**：`npm ci` 成功；scripts 含 `dev/build/build:single/preview/test/lint/verify:network/verify:build/fixtures/fixtures:large/fixtures:bomb`；运行期依赖仅 `react@^18.3.1`、`react-dom@^18.3.1`、`jszip@^3.10.1`；无 `postinstall`；`.gitignore` 覆盖 `node_modules/dist/dist-single/fixtures`。
- **复杂度**：S

#### 1.2 TypeScript 与标准 Vite 构建配置
- **目标**：建立严格类型检查与标准站点构建。
- **涉及文件**：`tsconfig.json`、`tsconfig.node.json`、`vite.config.ts`、`src/vite-env.d.ts`
- **前置依赖**：1.1
- **验收断言**：`strict`、`noUncheckedIndexedAccess`、`verbatimModuleSyntax`、`isolatedModules` 开启；`vite.config.ts` 设 `base:'./'`、`build.outDir:'dist'`、`target:'es2020'`、`sourcemap:false`、`cssCodeSplit:false`、`worker.format:'iife'`、`publicDir:false`、alias `@`→`/src`、`@worker-factory`→`/src/workers/factory.standard.ts`、`define.__APP_VERSION__`；`tsc --noEmit` 0 错误。
- **复杂度**：M

#### 1.3 单文件构建与 Worker 工厂 alias
- **目标**：产出可 `file://` 双击运行的自包含页面。
- **涉及文件**：`vite.config.single.ts`
- **前置依赖**：1.2
- **验收断言**：`outDir:'dist-single'`、`assetsInlineLimit:100_000_000`、`cssCodeSplit:false`、`inlineDynamicImports:true`、`modulePreload:false`、`define.__SINGLE_FILE__=true`、`@worker-factory`→`/src/workers/factory.inline.ts`；接入 `viteSingleFile({ removeViteModuleLoader:true, useRecommendedBuildConfig:true })`；构建后 `dist-single` 仅一个 `index.html`。
- **复杂度**：M

#### 1.4 Tailwind/PostCSS、index.html、入口骨架
- **目标**：建立无外链的单页宿主与主题基线。
- **涉及文件**：`index.html`、`src/index.css`、`src/main.tsx`、`tailwind.config.ts`、`postcss.config.js`
- **前置依赖**：1.2
- **验收断言**：`index.html` 的 `lang="zh-CN"`、含 `#root`、`color-scheme`、无任何外部 `<link>`/`<script src>`；Tailwind `darkMode:'media'`、`content` 覆盖 `index.html` 与 `src/**/*.{ts,tsx}`、系统字体栈；`main.tsx` 仅 `createRoot` 挂载、无 Service Worker 注册、无导出。
- **复杂度**：S

#### 1.5 ESLint 安全规则与 Vitest 配置
- **目标**：把安全与可测性变成可执行门禁。
- **涉及文件**：`eslint.config.js`、`vitest.config.ts`
- **前置依赖**：1.1
- **验收断言**：`react/no-danger`、`no-eval`、`no-implied-eval`、`no-new-func`、`no-script-url`、`no-console`（仅 `src/core/log.ts` 白名单）、`no-restricted-globals`（`localStorage/sessionStorage/indexedDB/fetch/XMLHttpRequest`）生效；Vitest `environment:'node'`、`include:['src/**/*.test.ts']`、`testTimeout:20000`、`pool:'forks'`；`npm run lint` 与 `npm run test` 可执行。
- **复杂度**：S

#### 1.6 零网络与产物完整性校验脚本
- **目标**：用静态检查阻断外部依赖与产物外链。
- **涉及文件**：`scripts/verify-no-network.mjs`、`scripts/verify-build.mjs`
- **前置依赖**：1.2、7.9
- **验收断言**：`verify-no-network` 扫描 `src/**/*.{ts,tsx,js,mjs}` 与 `dist/**/*.{html,js,css}`，按词边界拦截 `fetch/XMLHttpRequest/WebSocket/EventSource/sendBeacon/importScripts/RTCPeerConnection`；`https?://` 仅允许带 `allow-url` 标记的说明；检查 `dist/index.html` 的 `<script src>`/`<link href>`/`url()`；失败退出码 1 且只打印文件与行号。`verify-build` 断言 `dist-single/index.html` 唯一、无外链、含 Worker 内联载荷、`dist/assets` 无 `*.map`、体积超 2MB 仅告警。
- **复杂度**：S

### 2.2 组 2：类型定义与基础设施

#### 2.1 `src/types.ts` 全量契约
- **目标**：一次性固化跨模块/跨线程契约，避免后续签名漂移。
- **涉及文件**：`src/types.ts`
- **前置依赖**：1.2
- **验收断言**：与 design 2.4.2 完全一致的枚举（`Severity/ScanPhase/ScanStatus/FileKind/LanguageId/SourceKind/SkipReason/IgnoreGroupId/MaskKind/IllegalPathReason/ClsErrorCode`）与接口（`ScanConfig/IgnoreGroups/PathValidation/ArchiveEntryMeta/FileClassification/LanguageSpec/ScanDecision/BombGuardDecision/CommentSnippet/各 ExtractOptions/ExtractResult/FileScanInput/FileScanOutput/RawMatch/FindingSeed/Finding/FindingContext/RawSnippetStore/SkippedFile/SeverityCounts/ScanSummary/ScanResult/ScanProgress/FindingBatch/SkippedBatch/ScanCompletion/WorkerFailure/各 StartPayload/WorkerRequest/WorkerResponse/ExportFinding/ExportReport/ExportReportInput/FilterState/FindingGroup/FilteredFindingsResult/AppState/RevealState`）；仅含 `LIMITS`、`PROTOCOL_VERSION=1`、`REPORT_VERSION='1.0'` 三个常量，无函数；`Finding`/`ExportFinding` 无 `rawSnippet/fullValue/secret/unmasked` 字段；`types.ts` 不 import 任何业务模块。
- **复杂度**：L

#### 2.2 错误目录与 `ClsError`
- **目标**：所有失败路径统一到 15 个错误码与固定中文文案。
- **涉及文件**：`src/core/errors.ts`
- **前置依赖**：2.1
- **验收断言**：`ERROR_CATALOG` 覆盖 `CLS-E-1001~1010/2001/2002/3001/3002/4001`，每项含中文 message、hint、是否中止；`ClsError` 仅持有 `code/hint`，不含原文、路径、堆栈字段；`isClsError`/`toErrorInfo` 对未知异常返回通用错误信息且不泄露 `error.message` 内容。
- **复杂度**：S

#### 2.3 路径规范化与稳定排序
- **目标**：路径安全判定与跨平台确定性排序的唯一入口。
- **涉及文件**：`src/core/path.ts`
- **前置依赖**：2.1
- **验收断言**：`normalizeArchivePath` 反斜杠转 `/`、丢空段与 `.` 段；`isIllegalArchivePath` 拒绝 `..`、前导 `/`、盘符、`[\x00-\x1F\x7F]`、段 >255、总长 >1024，并返回对应 `IllegalPathReason`；`comparePathAsc` 按码点比较（不用 `localeCompare`）；`toDisplayPath` 中间省略且保留扩展名。
- **复杂度**：S

#### 2.4 UTF-8 解码、换行与字节切片
- **目标**：为提取器提供统一、可计量的文本预处理。
- **涉及文件**：`src/core/text.ts`
- **前置依赖**：2.1
- **验收断言**：`decodeUtf8` 返回 `text/replacementCount/hadBom`，BOM 去除；`normalizeNewlines` 将 `\r\n`、`\r` 归一为 `\n`；`splitLines` 保留 1-based 语义可映射；`sliceByBytes` 按 UTF-8 字节边界截断、不切断多字节字符、返回 `truncated`。
- **复杂度**：S

#### 2.5 默认配置、配置变更与快照
- **目标**：保证配置默认值、变更提示与作业快照语义。
- **涉及文件**：`src/core/config.ts`
- **前置依赖**：2.1、2.2
- **验收断言**：`createDefaultScanConfig` 忽略组全开、`scanPythonDocstring=true`、`scanContactInfo=false`、三个体积上限取 `LIMITS`、`scannedAt` 为 ISO；`withConfigChange` 返回新对象并附"规则已变更，重新扫描后生效"，不触发重扫；`snapshotConfig` 深拷贝并冻结，扫描中改 UI 不影响当前作业与导出。
- **复杂度**：S

#### 2.6 安全日志
- **目标**：在类型层阻断路径与片段进入日志。
- **涉及文件**：`src/core/log.ts`
- **前置依赖**：2.1、2.2
- **验收断言**：`LogRecord` 仅含 `kind/count/durationMs/code/phase`，无任意字符串内容字段；`logEvent` 在开发构建输出阶段与计数、生产构建仅输出 `error-code` 与 `duration`；`grep` 确认业务代码无直接 `console.*`。
- **复杂度**：S

### 2.3 组 3：核心纯函数

#### 3.1 zip 打开与条目按需读取
- **目标**：用 jszip 只解析中央目录，按需逐条解压。
- **涉及文件**：`src/core/unzip.ts`
- **前置依赖**：1.1、2.1~2.4
- **验收断言**：导出 `openZipArchive(data, options): Promise<ArchiveReader>`、`ArchiveReader{kind,entries,totalUncompressedBytes,readEntry,dispose}`；`entries` 按路径字典序排序且每个含 `pathValidation`；未持有解压正文；仅串行 `await readEntry`（禁止 `Promise.all`）；加密条目映射 `CLS-E-1004`，中央目录/条目损坏映射 `CLS-E-1003`（含 `readIndex`），条目数 >50000 或元数据总量 >500MB 映射 `CLS-E-1005`；单条读取失败登记 `CLS-E-1010` 非致命；用 `ZipEntryInternals` 窄接口集中隔离 `any`。
- **复杂度**：L

#### 3.2 zip 炸弹防护与非法路径判定
- **目标**：在读取前与读取后双重拦截炸弹与路径穿越。
- **涉及文件**：`src/core/unzip.ts`、`src/core/path.ts`
- **前置依赖**：3.1、2.3
- **验收断言**：`createBombGuard(config, entryCount): BombGuard` 的 `inspectMetadata/accountRead` 返回 `BombGuardDecision`；累计字节只增，超 500MB、单条压缩比 >100 且解压 >10MB、条目数 >50000 均返回 `abort` 且中止后持续 `abort`；`validateArchivePath` 对 `../../etc/passwd.js` 返回 `parent-segment` 并登记 `illegal-path` 而非中止；`200MB 全零条目` 在元数据阶段被拦截。
- **复杂度**：M

#### 3.3 本地文件夹读取器
- **目标**：让拖入目录复用同一扫描管线。
- **涉及文件**：`src/core/unzip.ts`
- **前置依赖**：3.1、3.2
- **验收断言**：`buildFolderReader(files, options)` 返回 `kind:'folder'`，`totalUncompressedBytes` 为 `File.size` 之和，`readEntry` 调用 `File.arrayBuffer()`；输入路径已去重并通过 `validateArchivePath`；单文件读取失败 `CLS-E-1010`；目录 API 不可用 `CLS-E-1009`；文件夹输入跳过解压阶段、进度从 `filtering` 开始。
- **复杂度**：M

#### 3.4 扫描范围判定与忽略组
- **目标**：在解压前决定扫描/跳过及原因。
- **涉及文件**：`src/core/fileFilter.ts`
- **前置依赖**：2.1、2.3
- **验收断言**：导出 `DEFAULT_IGNORE_GROUPS`、`classifyPath`、`decideScan`、`summarizeSkipReasons`；分类优先级为 配置 > 文档 > 代码 > 未知；`.env*`、`*.md/*.rst/*.txt`、`docs/**`、`src/README.js` 均判为全量文本；`.min.js`、`data.map`、`yarn.lock`、`logo.png`、`node_modules/**` 分别命中忽略类型/目录/二进制；`mybuild` 不误判为 `build`；`.BAT/.CMD` 大小写不敏感命中代码类；跳过优先级为 体积 > 类型 > 目录；`summarizeSkipReasons` 对 8 种 `SkipReason` 全量计数；忽略组全关时仍受 2MB 硬上限约束。
- **复杂度**：M

#### 3.5 提取器骨架、语言映射与片段构造
- **目标**：提供统一分派、行号索引与片段收集。
- **涉及文件**：`src/core/commentExtractor/index.ts`、`languageMap.ts`、`comments.ts`
- **前置依赖**：2.1、2.4、3.4
- **验收断言**：导出 `resolveLanguage(relPath,displayName)`、`extractSnippets(input): ExtractResult`、`LANGUAGE_SPECS/EXTENSION_TO_LANGUAGE/FILENAME_PATTERNS/lookupByExtension/lookupByFileName`、`buildLineIndex/LineIndex.lineAt`、`createSnippetBuilder`（`addLine/addBlock/finish`）；语言映射覆盖 design 2.5.1 全部扩展名与特殊文件名（`Makefile*`、`Dockerfile*`、`.env*` 除外走配置）；片段按 `startLine` 升序；跨行片段保留 `\n`；超 8KB 置 `truncated` 并产生 `snippet-truncated` 诊断；提取器异常转 `parse-error` 不中断。
- **复杂度**：M

#### 3.6 C 系注释状态机
- **目标**：实现单遍字符扫描的注释/字符串/正则状态机。
- **涉及文件**：`src/core/commentExtractor/cFamily.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractCFamily(text, options)`；`/` 判定严格按 `//` → `/*` → JS/TS 正则 → 除法 顺序；`const url = "http://example.com/a"; // 正常注释` 只产出"正常注释"一条片段；转义字符串、跨行模板串、`${}` 括号配对、正则字符类、`a / b //` 除法、未闭合块注释、Rust/Swift 嵌套块注释均有单测；未闭合产生 `unclosed-block-comment`/`unclosed-string`；`startLine` 与实际行号一致。
- **复杂度**：L

#### 3.7 井号系注释提取
- **目标**：覆盖脚本/配置/构建文件的行注释。
- **涉及文件**：`src/core/commentExtractor/hashFamily.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractHashFamily(text, options)`；`#` 在引号外才成为注释；第 1 行 `#!` 整行丢弃；`value: "a # b"` 不产片段；Makefile 支持 `#`；Dockerfile 仅行首 `#`、行内 `#` 不识别；连续纯注释行合并；`.env*` 不走该提取器。
- **复杂度**：M

#### 3.8 SQL 注释提取
- **目标**：处理 `--` 与 `/* */` 并避免字符串误判。
- **涉及文件**：`src/core/commentExtractor/sql.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractSql(text, options)`；`--` 至行尾、`/* */` 跨行；`'a--b'`、`"a/*b*/"`、反引号标识符不产片段；`''`/`""` 转义；未闭合块注释产生诊断。
- **复杂度**：S

#### 3.9 HTML/XML/Vue/Svelte 注释提取
- **目标**：提取标记注释并复用子提取器处理内嵌脚本/样式。
- **涉及文件**：`src/core/commentExtractor/markup.ts`
- **前置依赖**：3.5、3.6
- **验收断言**：导出 `extractMarkup(text, options)`；`<!-- -->` 产 `block-comment` 且不含定界符；`&lt;!--` 不误判；Vue/Svelte 的 `<script>` 交给 C 系、`<style>` 只取 `/* */`；`finding.line = 内部行号 + 起始行 - 1`；同一文件可返回多组片段且不合并。
- **复杂度**：M

#### 3.10 Lua 注释提取
- **目标**：支持 `--`、`--[[ ]]` 与长字符串。
- **涉及文件**：`src/core/commentExtractor/lua.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractLua(text, options)`；`--` 行注释、`--[[ ... ]]` 块注释、`--[==[ ... ]==]` 等号变体；`[[...]]` 长字符串内 `--` 不产片段；未闭合块产生诊断。
- **复杂度**：S

#### 3.11 Batch 注释提取与 `.bat/.cmd` 白名单
- **目标**：实现 `REM`/`::` 识别并把 `.bat/.cmd` 纳入代码类白名单（设计偏差 1）。
- **涉及文件**：`src/core/commentExtractor/batch.ts`、`src/core/commentExtractor/languageMap.ts`、`src/core/fileFilter.ts`
- **前置依赖**：3.5、3.4
- **验收断言**：导出 `extractBatch(text, options)`；`REM`（不区分大小写，后接空白或行尾）、`::`、`@REM` 识别；`echo REM`、`echo ::` 不产片段；`.bat`、`.cmd`（含大写变体）在 `languageMap` 与 `fileFilter` 中同时命中代码类仅注释扫描，确保 CLS-EXT-008 可触发。
- **复杂度**：S

#### 3.12 Python 注释与 docstring
- **目标**：覆盖 `#` 与可开关的三引号块。
- **涉及文件**：`src/core/commentExtractor/python.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractPython(text, options)`；`#` 行注释合并；`r/b/u/f` 前缀 `"""`/`'''` 产 `docstring`；`scanDocstring=false` 时不产片段但三引号内 `#` 不误判；未闭合到 EOF 产生 `unclosed-string`；`startLine` 为三引号所在行。
- **复杂度**：M

#### 3.13 Markdown 围栏追踪
- **目标**：区分文档正文与疑似示例围栏块。
- **涉及文件**：`src/core/commentExtractor/markdown.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractMarkdown(text, options)`；围栏允许 0–3 前导空格、≥3 个 ` 或 `~`、结束长度不小于起始且仅允许尾随空白；围栏外 `document`、围栏内 `fence-sample` 且 `inCodeFence=true`；未闭合围栏到 EOF 全部标记并产生 `unclosed-fence`（行号为起始行）；块内行号映射精确。
- **复杂度**：M

#### 3.14 纯文本与文档全文提取
- **目标**：为 `.txt/.rst/.adoc` 等提供全文片段。
- **涉及文件**：`src/core/commentExtractor/plainText.ts`
- **前置依赖**：3.5
- **验收断言**：导出 `extractPlainText(text, options)`；`sourceKind='document'`、`inCodeFence=false`；按行合并或每 200 行分块且行号连续；`.env*` 不在本提取器处理（由配置全量路径覆盖）。
- **复杂度**：S

#### 3.15 Shannon 熵与字符集判定
- **目标**：为高熵兜底规则提供纯函数判定。
- **涉及文件**：`src/core/entropy.ts`
- **前置依赖**：2.1
- **验收断言**：导出 `shannonEntropy/isBase64Style/isHexStyle/qualifiesAsHighEntropy`；`aaaaaaaaaaaaaaaa` 熵 0、`short` 长度不足、`Admin@123` 字符集不达标均不命中；40–128 位 base64/hex 高熵命中，129 位不命中；阈值严格 `>3.5`；字符集匹配率 ≥95%；结果不写入报告。
- **复杂度**：S

#### 3.16 规则框架、编译缓存与核心规则
- **目标**：建立数据驱动规则引擎与 M1 所需核心规则。
- **涉及文件**：`src/core/rules.ts`
- **前置依赖**：2.1、2.2
- **验收断言**：导出 `RULE_SET_VERSION`、`RULES`、`validateRuleSet`、`compileRule`、`getEnabledRules`、`isPlaceholderValue`、`isSampleLikeHost`；`validateRuleSet` 校验 ID 格式 `^CLS-R-\d{3}$`/唯一、正则可编译、文案非空且不超长、级别合法、捕获组存在、flags 自动补 `g`、熵配置合法；编译结果按 ID 缓存，匹配循环内不出现 `new RegExp`；M1 至少含 R-001/002/011/012/013/015；`getEnabledRules` 恒启用默认规则、`scanContactInfo=true` 才启用联系方式规则；占位符判定覆盖重复字符、your_*、example*/sample*/dummy*、`<...>`/`{{...}}`/`${...}`/`$VAR`、null/none/undefined；示例主机覆盖 `example.com/org/net`、`*.example.*`、`your-domain.com`、`localhost`、`127.0.0.1`、`0.0.0.0`。
- **复杂度**：L

#### 3.17 21 条规则、守卫与三处规则偏差
- **目标**：补齐全部规则并固化设计偏差 2、3。
- **涉及文件**：`src/core/rules.ts`
- **前置依赖**：3.16、3.15
- **验收断言**：`RULES` 为 21 条且 ID/级别/`dedupeFamily`/`specificity` 与 design 2.5.2 一致；R-011 关键词含 `password/passwd/pwd/secret/token/api[_-]?key/apikey/access[_-]?key/secret[_-]?key/private[_-]?key/auth/密码/口令/密钥/令牌/凭证`，支持中英文冒号，普通值 ≥6、已知弱口令（`root/admin/test/guest/demo/123456/password/passwd`）允许 ≥4（由 `password-like` 校验器实现）；R-020 邮箱（low）与 R-021 手机号（medium）拆为两条默认关闭规则，`scanContactInfo` 控制启用；R-002 关键词距离 ≤3 换行/80 字符；R-006 覆盖 `sk-proj-` 且排除 `sk_live_`；R-009/010 只命中 BEGIN 行；R-012 必须含 `user:pass@`；R-014 恰三段且前两段 `eyJ`；R-015 逐段校验并排除回环/保留网段；R-018 支持 `/` 分隔；R-019 配置熵阈值 3.5、长度 16–128、base64/hex。
- **复杂度**：L

#### 3.18 值级脱敏
- **目标**：实现唯一的值级脱敏入口。
- **涉及文件**：`src/core/redact.ts`
- **前置依赖**：2.1
- **验收断言**：导出 `maskValue`、`maskUrlCredentials`、`maskConnectionString`、`maskPrivateKey`、`maskJwt`；`generic` 长度 1–8 全 `*`、9–40 前 4+`*`+后 4、>40 前 4+16 个 `*`+`…`+后 4；`mysql://root:Passw0rd@10.1.2.3:3306/db` → `mysql://***:***@10.1.2.3:3306/db`；`http://admin:secret@192.168.1.10/admin` → `http://***:***@192.168.1.10/admin`；私钥只保留 BEGIN 行；JWT 保留前 8 字符 + `…`；邮箱/手机号按规则掩码；`full` 固定 8 个 `*`；结构解析失败回退全掩码；`AKIAABCDEFGHIJKLMNOP` → `AKIA************MNOP`。
- **复杂度**：M

#### 3.19 片段脱敏、上下文与截断
- **目标**：只替换命中值，保留关键词与可判断的上下文。
- **涉及文件**：`src/core/redact.ts`
- **前置依赖**：3.18、3.5
- **验收断言**：`truncateLine(line, maxLength=200)` 在代理对边界安全截断并追加 `…`；`buildFindingContext({lines,hitLine,masker})` 取上下各 1 行、经同一 masker 脱敏、越界返回 `null`、不保存原文；片段级替换只作用于 `[startIndex,endIndex)`，单行 ≤200 字符、多行 ≤5 行；禁止整段正则替换；最终 `maskedSnippet` 不含完整敏感值。
- **复杂度**：M

#### 3.20 片段匹配与单文件扫描
- **目标**：把提取片段送入编译后规则，产出未去重命中。
- **涉及文件**：`src/core/scanner.ts`
- **前置依赖**：3.16、3.5、2.4
- **验收断言**：导出 `ScanContext`、`scanSnippets(snippets, context)`、`scanFile(input, context): FileScanOutcome`；每条规则每次 `exec` 前重置 `lastIndex`，零宽匹配前移 1 避免死循环；命中行 = `snippet.startLine + 片段内换行偏移`；占位符/示例主机/校验器在生成 `RawMatch` 前执行；`rawValue` 取捕获组、`matchedText` 取完整匹配；规则入口只接收片段，不暴露整文件文本入口；单文件 >200ms 记诊断不中止；返回 `snippets/matches/diagnostics/truncatedSnippetCount`。
- **复杂度**：L

#### 3.21 去重、排序与命中编号
- **目标**：实现同族抑制、跨族共存与确定性排序。
- **涉及文件**：`src/core/scanner.ts`
- **前置依赖**：3.20、3.18、3.16
- **验收断言**：导出 `dedupeMatches(matches, context): FindingSeed[]`、`finalizeFindings(seeds, jobId): Finding[]`；分组键为 `filePath#line#dedupeFamily`；簇按 `startIndex` 升序/级别降序/`specificity` 降序/规则 ID 升序；胜出者为级别最高→specificity 最大→ID 字典序最小；其余写入 `suppressedRuleIds`；`password = "AKIAABCDEFGHIJKLMNOP"` 仅 1 条 R-001 critical 且抑制 R-011；`mysql://root:Passw0rd@10.1.2.3:3306/db` 同时保留 R-012 critical 与 R-015 high；同一行两个不重叠 secret 值保留两条；最终排序级别降序→非围栏优先→`comparePathAsc`→行号→规则 ID；编号 `f-1` 起连续且重复扫描一致。
- **复杂度**：L

#### 3.22 摘要与级别统计
- **目标**：保证统计不变量可验证。
- **涉及文件**：`src/core/scanner.ts`
- **前置依赖**：2.1、3.21
- **验收断言**：导出 `buildSummary(args)`、`buildSeverityCounts(findings)`；`scannedFiles+skippedFiles===totalFiles`、`severityCounts` 四项之和 `===findings.length`、`riskFiles<=scannedFiles`、`durationMs>=0`、`status` 属于四值枚举；开发期不一致断言 `CLS-E-2001`，生产记录计数继续。
- **复杂度**：S

#### 3.23 导出清洗与 `RawSnippetStore`
- **目标**：建立"仅脱敏可导出"的白名单与受控 raw 内存（设计偏差 4）。
- **涉及文件**：`src/core/redact.ts`、`src/ui/hooks/rawSnippetStore.ts`
- **前置依赖**：3.18、3.19
- **验收断言**：`scrubForExport(finding)` 逐字段白名单拷贝为 `ExportFinding`，不使用展开运算符；`createRawSnippetStore` 实现 `RawSnippetStore`（`get/set/delete/clear/totalBytes/count`），单条 ≤8KB、总量 ≤16MB，超限 `set` 返回 false；store 不进入 `ScanResult`/`ExportReport`/日志；类型中不存在 raw 导出通道。
- **复杂度**：M

### 2.4 组 4：Worker 与消息协议

#### 4.1 Worker 消息协议与运行时守卫
- **目标**：固化版本化消息与逐字段校验。
- **涉及文件**：`src/workers/protocol.ts`
- **前置依赖**：2.1、3.22
- **验收断言**：导出 `PROTOCOL_VERSION`、`createStartRequest`、`createCancelRequest`、`isWorkerResponse`；请求/响应 `type/protocol/jobId` 与关键字段类型校验；版本不匹配可被客户端识别；非法消息开发期抛错、生产丢弃并计数；协议载荷均为可结构化克隆数据。
- **复杂度**：M

#### 4.2 Worker 入口
- **目标**：绑定消息、创建取消信号并驱动 `runJob`。
- **涉及文件**：`src/workers/scan.worker.ts`
- **前置依赖**：4.1、4.3
- **验收断言**：顶部自定义最小 `WorkerScope`（`postMessage/onmessage/close`）并以 `declare const self` 访问，不引入 DOM 全局；同一时刻仅一个活动 `jobId`，新 `job:start` 先取消旧作业；`job:cancel` 只设置 `CancelSignal`，不调用 `close()`；入口无 `window/document/localStorage`。
- **复杂度**：S

#### 4.3 作业编排主流程
- **目标**：串起解压→筛选→读取→解码→提取→匹配→去重→批次发送。
- **涉及文件**：`src/workers/jobRunner.ts`
- **前置依赖**：3.1~3.4、3.20~3.22
- **验收断言**：导出 `CancelSignal`、`createCancelSignal`、`runJob(request, emit, signal)`；阶段依次 `validating→unzipping→filtering→scanning→finalizing`；先筛选后解压；每个 `readEntry` 后立即解码并释放字节；`finally` 中调用 `dispose()`；`job:findings`/`job:skipped` 每 100 条一批且 `sequence` 单调递增，全部批次发完后才发 `job:done`；错误转 `WorkerFailure`（不含堆栈/路径/原文）；无可扫描文件发 `CLS-E-1007` 空结果。
- **复杂度**：L

#### 4.4 取消、进度节流与 raw 预算
- **目标**：满足取消时限、进度单调与 raw 传输上限。
- **涉及文件**：`src/workers/jobRunner.ts`
- **前置依赖**：4.3
- **验收断言**：每条目后、每文件后、每 50 次匹配检查 `signal.cancelled`；检查到取消后 ≤200ms 发送 `job:cancelled` 并释放读取器；`job:progress` 间隔 ≥100ms 且百分比用 `max(lastPercent, computed)` 单调不减；`FindingBatch.rawByFindingId` 累计 ≤16MB，超预算停止附带 raw；批次之间让出事件循环（`await new Promise(r=>setTimeout(r,0))`）。
- **复杂度**：M

#### 4.5 主线程 Worker 客户端
- **目标**：封装创建、消息路由、超时终止与重建。
- **涉及文件**：`src/workers/workerClient.ts`
- **前置依赖**：4.1
- **验收断言**：`ScanWorkerClient` 暴露 `supported`、`start(payload,handlers): jobId`、`cancel(jobId)`、`dispose()`；zip 以 Transferable `[buffer]` 传输；`jobId !== activeJobId` 的消息全部丢弃；取消先发消息、800ms 超时后 `terminate`（不立即重建），≤1s 内回调 `onCancelled`；`onerror` 仅在零有效消息时归因 `CLS-E-1011`（加载失败）、已有有效消息时归因 `CLS-E-1016`（引擎异常），`onmessageerror` 归因 `CLS-E-1012`，协议版本不符归因 `CLS-E-1013`，就绪 500ms 无消息归因 `CLS-E-1014`，运行期 8s 无活性且连续 3 次 ping 无应答归因 `CLS-E-1015`，投递异常归因 `CLS-E-1017`，并发提交归因 `CLS-E-1018`，仅无法归类时使用 `CLS-E-1008` 兜底；启动前拒绝并发作业。
- **追加断言**：`activeJobId` 在 `postMessage` 成功后置位，启动失败必须回滚，后续 `start` 不因残留直接失败；`terminate` 后不立即重建，空闲期不创建 Worker，每作业 `rebuildCount ≤ 1`；`job:error` 必须校验 `jobId === activeJobId`，不匹配只累加 `counters.staleJob`；非法消息计入 `counters.invalid`，同作业同类别只回调一次 `onChannelIssue`；暴露 `snapshotCounters()` 供诊断快照使用。
- **复杂度**：L

#### 4.6 标准/内联 Worker 工厂
- **目标**：用同一契约支持两种构建形态。
- **涉及文件**：`src/workers/workerFactory.ts`、`src/workers/factory.standard.ts`、`src/workers/factory.inline.ts`
- **前置依赖**：1.3、4.1
- **验收断言**：三文件均导出 `createScanWorker: WorkerFactory`；`factory.standard.ts` 使用 `new Worker(new URL('./scan.worker.ts', import.meta.url))`；`factory.inline.ts` 使用 `?worker&inline`；`workerClient.ts` 只 import `@worker-factory`；两个 Vite 配置的 alias 分别指向对应实现。
- **追加断言**：工厂允许抛错，由 `ensureWorker()` 捕获并归因 `construct`（`CLS-E-4001`）；构造成功不代表可用（以首条有效消息为判据）；工厂不得在模块加载期创建实例（懒创建由 client 负责）；Worker 子构建必须保留 `worker.plugins` 中的 TS 转译能力。
- **复杂度**：S

#### 4.7 Worker 不可用与主线程降级
- **目标**：保证无 Worker 环境功能完整。
- **涉及文件**：`src/workers/workerClient.ts`、`src/App.tsx`、`src/ui/ProgressPanel.tsx`
- **前置依赖**：4.5、4.6
- **验收断言**：`typeof Worker === 'undefined'` 或工厂抛错时 `supported=false`，主线程直接调用同一 `runJob`；`file://` 下 Blob Worker 创建后 500ms 无 `job:progress` 且无错误视为不可用；降级提示按原因显示 `CLS-E-4001 / 1011 / 1014 / 1015 / 1016`（非阻断、单槽），仅在无法自动恢复时显示 `CLS-E-1008`（阻断）；上传/扫描/导出仍可用。
- **追加断言**：四类触发点（创建失败 / 加载失败 / 就绪超时 / 运行期无响应）均应在同一作业内自动继续；`acquire()` 重取输入失败时明确提示“需要重新上传”，上传区保持可用且不进入红色错误态；`runFallback` 必须 try/catch，主线程异常转具体错误码；降级后本作业内不切回 Worker，新作业可重新尝试；降级态与错误态均提供“查看诊断信息 / 导出 JSON”入口。
- **复杂度**：M

### 2.5 组 5：UI 组件

#### 5.1 `App` 状态机与 `useScanJob`
- **目标**：单页唯一持有作业状态并编排上传/扫描/结果。
- **涉及文件**：`src/App.tsx`、`src/ui/hooks/useScanJob.ts`
- **前置依赖**：4.5、2.5
- **验收断言**：`App` 为唯一默认导出；`AppPhase` 覆盖 `idle/validating/scanning/result/empty/cancelled/error`；`useScanJob` 串接 `ScanWorkerClient`、进度、批次拼装、完成/错误/取消回调；`phase==='scanning'` 时拒绝新上传并提示"请等待当前扫描完成或先取消"；新作业开始或重新上传时清空 `RawSnippetStore`、结果与进度；不使用任何持久化 API。
- **复杂度**：L

#### 5.2 上传入口
- **目标**：提供拖拽、点击与文件夹三种入口并前置校验。
- **涉及文件**：`src/ui/UploadDropzone.tsx`
- **前置依赖**：5.1
- **验收断言**：支持拖拽文件/目录、点击选择 `.zip`、目录选择（`webkitdirectory`）；非 zip 且非文件夹报 `CLS-E-1001`，压缩包 >100MB 报 `CLS-E-1002`，均不读内容；扫描中入口禁用；文件名按键值纯文本渲染。
- **复杂度**：M

#### 5.3 进度面板与取消
- **目标**：让长任务可见、可中止。
- **涉及文件**：`src/ui/ProgressPanel.tsx`
- **前置依赖**：5.1、5.6
- **验收断言**：阶段文案固定为"校验中/解压中/筛选中/扫描中/整理结果"；显示百分比、已处理/总数、当前文件中间省略路径、耗时；取消按钮调用 `cancel(jobId)` 并在 ≤1s 回到 `idle`；取消后显示"已取消本次扫描"而非错误码；进度不回退。
- **复杂度**：S

#### 5.4 错误态
- **目标**：把错误码转成可执行的中文提示。
- **涉及文件**：`src/ui/ErrorState.tsx`
- **前置依赖**：2.2、5.6
- **验收断言**：展示错误码、原因、建议动作三要素；15 个错误码均有对应文案与动作；原始异常消息与路径不出现在界面；提供"重试/重新上传"入口；页面在炸弹/损坏/加密场景仍可交互。
- **复杂度**：S

#### 5.5 空态
- **目标**：区分"无命中成功"与"无可扫描文件"。
- **涉及文件**：`src/ui/EmptyState.tsx`
- **前置依赖**：5.6
- **验收断言**：`status='empty'` 且无命中时显示成功态（0 命中、扫描文件数）；`CLS-E-1007` 时显示"压缩包内未找到可扫描的文本文件"并引导查看跳过原因；两种状态不混用；文案全中文。
- **复杂度**：S

#### 5.6 基础组件与级别徽标
- **目标**：统一视觉与级别色彩，避免动态类名失效。
- **涉及文件**：`src/ui/Button.tsx`、`Panel.tsx`、`ProgressBar.tsx`、`SeverityBadge.tsx`
- **前置依赖**：1.4
- **验收断言**：四组件具名导出；`SeverityBadge` 使用 design 2.9.5 的完整类名映射（critical/high/medium/low，浅色+深色）；无 `dangerouslySetInnerHTML`；键盘可聚焦；不引入图标字体或外部资源。
- **复杂度**：S

#### 5.7 统计卡片
- **目标**：展示扫描规模与风险分布。
- **涉及文件**：`src/ui/SummaryCards.tsx`
- **前置依赖**：5.1、3.22
- **验收断言**：展示 total/scanned/skipped/riskFiles、四级命中数、跳过原因计数；数值直接取自 `ScanSummary` 与 `SkipReasonCounts`，不在 UI 重算；点击级别卡片可作为过滤入口；计数与表格总数一致。
- **复杂度**：S

#### 5.8 结果工具栏与过滤 hook
- **目标**：提供过滤、排序、折叠、分页的纯计算封装。
- **涉及文件**：`src/ui/ResultToolbar.tsx`、`src/ui/hooks/useFilteredFindings.ts`
- **前置依赖**：5.1、2.1
- **验收断言**：`useFilteredFindings(findings, filter, page)` 返回 `groups/visibleCount/totalCount/pageCount`；支持按级别、规则、路径查询、是否含围栏样本、仅看围栏样本；每页 200；过滤 ≤300ms（5000 条）；结果用 `useMemo`；路径匹配大小写不敏感；分页越界自动收敛。
- **复杂度**：M

#### 5.9 结果表与分页
- **目标**：在 5000 条规模下保持可交互。
- **涉及文件**：`src/ui/FindingsTable.tsx`
- **前置依赖**：5.8、5.6
- **验收断言**：按文件分组、组内按既有排序展示；列含级别/规则/路径/行号/脱敏片段/来源/疑似示例；仅渲染当前页 200 条；`content-visibility` 应用于行容器；滚动 ≥30fps；表头可排序但不改变导出顺序契约；空组折叠状态可保持。
- **复杂度**：L

#### 5.10 单条命中行
- **目标**：在最小泄露前提下提供判断信息。
- **涉及文件**：`src/ui/FindingRow.tsx`
- **前置依赖**：5.9、3.19
- **验收断言**：只展示 `maskedSnippet` 与已脱敏上下文；显示来源标记（行注释/块注释/docstring/文档/配置/围栏示例）、截断提示、`suppressedRuleIds` 摘要；围栏样本带"疑似示例"徽标；"我需要看完整内容"入口仅在 raw 可展开时可用；所有内容按文本节点渲染。
- **复杂度**：M

#### 5.11 二次确认展开弹窗
- **目标**：用受控临时展开满足人工复核。
- **涉及文件**：`src/ui/RevealDialog.tsx`、`src/ui/hooks/rawSnippetStore.ts`
- **前置依赖**：3.23、5.10
- **验收断言**：打开先显示风险说明，确认后才 `store.get(findingId)`；内容用 `<pre>` + `white-space: pre-wrap` 纯文本渲染；不提供"复制完整值"；收起时 `delete(findingId)`，刷新即清空；超出 16MB/8KB 预算显示"该条完整内容不可展开（超出内存预算）"；展开内容不进入导出。
- **复杂度**：M

#### 5.12 跳过文件面板
- **目标**：让"为什么没扫"可解释。
- **涉及文件**：`src/ui/SkippedFilesPanel.tsx`
- **前置依赖**：5.1、3.4
- **验收断言**：按 8 种原因分组并显示计数；每类最多展示前 100 条并提示总数；展示路径、体积、详情（≤200 字符）；`illegal-path`、`parse-error`、`archive-encrypted` 有独立说明；完整清单仅通过 JSON 导出获取。
- **复杂度**：S

#### 5.13 忽略规则与规则说明面板
- **目标**：提供 6 个忽略组、2 个扫描开关与 21 条规则说明。
- **涉及文件**：`src/ui/ConfigPanels.tsx`
- **前置依赖**：2.5
- **验收断言**：6 个忽略组可独立开关，`scanPythonDocstring`、`scanContactInfo` 可切换；变更调用 `withConfigChange` 并显示"规则已变更，重新扫描后生效"，不自动重扫；规则说明按 21 条展示 ID/名称/级别/说明/建议/默认状态；面板默认折叠；不提供逐条关闭关键规则。
- **复杂度**：M

#### 5.14 隐私声明与工具边界
- **目标**：逐字满足隐私与边界告知要求。
- **涉及文件**：`src/ui/PrivacyNotice.tsx`
- **前置依赖**：5.6
- **验收断言**：固定声明逐字为"所有处理均在浏览器本地完成，代码不会上传到任何服务器。请确认页面无外部网络请求后再使用。"；可展开边界说明含"不替代专业工具/不扫 git 历史/密钥必须轮换/扩展风险"；顶部与底部均可见；纯文本渲染。
- **复杂度**：S

#### 5.15 主题、响应式、可访问性与中文文案
- **目标**：完成界面体验与 DFX 收口。
- **涉及文件**：`src/index.css`、`src/App.tsx`、全部 `src/ui/*.tsx`
- **前置依赖**：5.2~5.14
- **验收断言**：深浅色完全由 `prefers-color-scheme` 驱动，无 JS 状态与存储；移动/窄屏布局无横向溢出；正文对比度 ≥4.5:1；关键控件有 `aria-label`/可见焦点/键盘可达；全部界面文案为简体中文；无外部字体与图标资源；`dangerouslySetInnerHTML` 全局为 0 处。
- **复杂度**：M

### 2.6 组 6：导出功能

#### 6.1 导出报告构造
- **目标**：生成自解释且不可泄露原文的 JSON 报告。
- **涉及文件**：`src/core/export.ts`
- **前置依赖**：3.23、3.22
- **验收断言**：`buildExportReport(args)` 返回 `version='1.0'`、ISO `generatedAt`、作业启动时的 `config` 快照、`summary`、`findings`（`ExportFinding`）、`skippedFiles`、`ruleCatalog`、`diagnostics`；不含 `rawSnippet/fullValue/secret/unmasked`；导出前断言每条 `maskedSnippet` 不含对应原值；不缓存报告字符串。
- **复杂度**：M

#### 6.2 CSV 转义、路径清单与编码
- **目标**：产出 Excel 兼容、防公式注入的 CSV。
- **涉及文件**：`src/core/export.ts`
- **前置依赖**：3.23
- **验收断言**：`escapeCsvCell` 顺序为 首字符 `= + - @ \t \r` 前置 `'` → 含逗号/双引号/换行时双引号包裹 → `"` 转 `""`；`toCsv` 列顺序固定 13 列、UTF-8 BOM、CRLF、表头 1 行 + 命中行；`null` 上下文输出空串；`buildPathList` 去重、码点升序、`\n` 连接、仅路径；`=SUM(A1)` 路径输出以 `'=` 开头。
- **复杂度**：M

#### 6.3 下载与剪贴板能力
- **目标**：封装浏览器下载与复制，失败可降级。
- **涉及文件**：`src/core/export.ts`
- **前置依赖**：2.2
- **验收断言**：`downloadTextFile(fileName, content, mime)` 用 `Blob`+`a[download]`，下载后 1s 内 `URL.revokeObjectURL`，失败映射 `CLS-E-3001`；`copyTextToClipboard(text)` 返回 boolean，不可用/被拒返回 false 并映射 `CLS-E-3002`；不使用任何网络 API。
- **复杂度**：S

#### 6.4 导出交互接线
- **目标**：在结果区完成 JSON/CSV/路径复制三条路径。
- **涉及文件**：`src/ui/ResultToolbar.tsx`、`src/ui/ErrorState.tsx`
- **前置依赖**：6.1~6.3、5.8
- **验收断言**：按钮提供"导出 JSON/导出 CSV/复制命中路径"；文件名 `commentleak-report-YYYYMMDD-HHmmss.json|csv`（本地时区补零）；下载被拦截时展示手动下载链接（`CLS-E-3001`）；剪贴板不可用时展开只读 `<textarea>` 供手动复制；导出始终使用 `maskedSnippet`，与是否展开无关。
- **复杂度**：M

#### 6.5 导出脱敏与公式注入审计
- **目标**：用自动化断言锁定两条最高风险导出红线。
- **涉及文件**：`src/core/__tests__/export.test.ts`、`src/core/__tests__/redact.test.ts`
- **前置依赖**：6.4、7.5
- **验收断言**：展开 raw 后导出 JSON/CSV，在产物字符串中检索 `AKIAABCDEFGHIJKLMNOP`、`Passw0rd`、`Admin@123` 均 0 命中；`=SUM(A1)`、`+1`、`-1`、`@x`、`\t`、`\r` 开头单元格均前置 `'`；CSV 含 BOM 与 CRLF；代码审计确认 `ExportFinding` 无 raw 字段通路。
- **复杂度**：S

### 2.7 组 7：验收夹具与自测

#### 7.1 验收夹具生成脚本
- **目标**：用脚本稳定复现 ACC 所需的 zip。
- **涉及文件**：`scripts/make-fixtures.mjs`、`fixtures/acceptance.zip`、`fixtures/only-images.zip`
- **前置依赖**：1.1
- **验收断言**：`acceptance.zip` 含 `config.js`（AWS 注释 + `http://example.com` 行）、`README.md`（内网 IP、连接串、围栏样本）、`main.py`（docstring + `# token`）、`main.go`（test/test）、`app.min.js`、`node_modules/left-pad/index.js`、`logo.png`、`docs/guide/usage.rst`、`src/README.js`、`.env.production`（含占位符）、`unknown.xyz`、`=SUM(A1).js`、`<img src=x onerror=alert(1)>.js`、`data.map`、`yarn.lock`；`only-images.zip` 仅含图片与 `node_modules`；脚本可重复执行且输出确定性；`fixtures/` 被 gitignore。
- **复杂度**：M

#### 7.2 路径穿越夹具
- **目标**：构造条目名不被改写的恶意 zip。
- **涉及文件**：`scripts/make-traversal-fixture.mjs`、`fixtures/traversal.zip`
- **前置依赖**：7.1
- **验收断言**：条目名原样为 `../../etc/passwd.js`；若 jszip 规范化则改用本地文件头+中央目录手工写入；产物可被 `openZipArchive` 打开且 `pathValidation.reason='parent-segment'`；脚本不进入运行期代码。
- **复杂度**：S

#### 7.3 大包与炸弹夹具
- **目标**：提供性能与炸弹复现输入。
- **涉及文件**：`scripts/make-large-fixture.mjs`、`scripts/make-bomb-fixture.mjs`、`fixtures/large-many.zip`、`fixtures/large-one.zip`、`fixtures/bomb.zip`
- **前置依赖**：1.1、7.1
- **验收断言**：`large-many.zip` 为 5000 个 20KB 文件、含少量命中；`large-one.zip` 约 100MB、50 个 ≤2MB 文件；`bomb.zip` 为 200MB 全零条目且压缩后很小；`bomb.zip` 仅本地生成、不入库；生成耗时与内存有输出记录。
- **复杂度**：M

#### 7.4 提取器单元测试集
- **目标**：用单测锁定 9 个提取器的边界行为。
- **涉及文件**：`src/core/commentExtractor/__tests__/cFamily.test.ts`、`hashFamily.test.ts`、`sql.test.ts`、`markup.test.ts`、`python.test.ts`、`markdown.test.ts`、`lua-batch.test.ts`
- **前置依赖**：3.6~3.14
- **验收断言**：覆盖 design 2.10.2 提取器矩阵全部用例：`//`/`/* */`/字符串内 `http://` 不误判/转义/模板串/正则/除法/嵌套块/未闭合；shebang/引号内 `#`/Dockerfile 行首；SQL `'a--b'`；Vue script/style 行号偏移；`--[[ ]]`/`REM`/`echo REM`；docstring 开关与前缀；围栏内外与未闭合；`npm run test` 全绿。
- **复杂度**：M

#### 7.5 核心纯函数单元测试集
- **目标**：锁定过滤、规则、熵、脱敏、导出、路径、解码与配置。
- **涉及文件**：`src/core/__tests__/fileFilter.test.ts`、`rules.test.ts`、`entropy.test.ts`、`redact.test.ts`、`export.test.ts`、`path.test.ts`、`text.test.ts`、`config.test.ts`
- **前置依赖**：3.4、3.15~3.19、2.3~2.5
- **验收断言**：`fileFilter` 覆盖 `node_modules` 精确段、`mybuild` 不误判、`.min.js`、2MB 边界、`src/README.js` 文档优先、`.env*`；`rules` 覆盖 21 条数量、ID 唯一/可编译/文案非空、占位符、弱口令、中文关键词、示例主机、捕获组；`entropy` 覆盖 7 个边界；`redact` 覆盖 8 种 MaskKind 与全掩码兜底；`export` 覆盖 BOM/CRLF/注入/无 raw；`path`/`text`/`config` 覆盖设计矩阵；全绿。
- **复杂度**：M

#### 7.6 作业编排集成测试
- **目标**：在内存 zip 上验证完整 core 路径与消息语义。
- **涉及文件**：`src/workers/__tests__/jobRunner.integration.test.ts`
- **前置依赖**：4.3、7.1
- **验收断言**：用 jszip 内存包覆盖 正常流程、跳过统计、炸弹中止、取消、单文件异常继续、确定性重复扫描；断言批次 100 条、`sequence` 单调、`done` 前批次发完；ACC-01/03/04/05/06/10/12/13/17 的 core 结果在测试中断言；同一输入两次结果与编号一致。
- **复杂度**：L

#### 7.7 ACC-01~18 自动化验证
- **目标**：把可自动化的验收用例固化为测试与记录。
- **涉及文件**：`src/core/__tests__/*`、`src/workers/__tests__/jobRunner.integration.test.ts`、`README.md`（验收表）
- **前置依赖**：7.4~7.6、6.5
- **验收断言**：ACC-01/02/03/04/05/06/10/11/12/13/14/16/17/18 均有自动化断言并通过（映射见第 4 章）；每条记录用例编号、测试文件、断言要点；P0 用例无失败；未自动化项在 README 标注手动任务编号。
- **复杂度**：M

#### 7.8 手动 E2E 与离线验收
- **目标**：完成依赖浏览器与环境的 5 条 P0/P1 用例。
- **涉及文件**：`README.md`（验收证据草稿）
- **前置依赖**：7.9、7.1~7.3
- **验收断言**：ACC-07（100MB 包页面可交互、进度更新、无 >200ms 长任务、不白屏）、ACC-08（断网下 `dist` 与单文件 `index.html` 全流程可用）、ACC-09（Network 面板 0 条外部请求）、ACC-15（5000 条滚动 ≥30fps、过滤 ≤300ms）、ACC-17 手动复核无脚本执行；取消、展开、剪贴板降级各执行一次并记录结果。
- **复杂度**：M

#### 7.9 双构建与静态校验验证
- **目标**：证明两种交付形态可构建、可校验、可运行。
- **涉及文件**：`package.json`（scripts）、`dist/`、`dist-single/`、`README.md`
- **前置依赖**：1.2、1.3、1.6、7.7
- **验收断言**：依次执行 `npm run lint` → `npm run test` → `npm run build` → `npm run verify:network` → `npm run build:single` → `npm run verify:build` 全部退出码 0；`dist/` 含 `index.html/assets/*.js/css` 与独立 `scan.worker-*.js`，无 `*.map`；`dist-single/` 仅 `index.html` 且无外链、含 Worker 内联载荷；单文件体积 ≤2MB 或记录告警；`npx serve dist` 与双击单文件均可加载。
- **复杂度**：M

#### 7.10 性能与安全专项验证
- **目标**：采集 DFX 证据并确认无隐私回退。
- **涉及文件**：`README.md`（性能与安全记录）
- **前置依赖**：7.9、7.3
- **验收断言**：记录机器配置、浏览器版本、总耗时（目标 ≤60s）、各阶段耗时、内存峰值（目标 ≤1.5GB）、最长 Long Task（≤200ms）；SEC-01~SEC-10 逐项有结论；Application 面板无扫描相关 Storage/IndexedDB/Cache；Console 检索完整密钥 0 命中；加密/损坏 zip 分别提示 `CLS-E-1004`/`CLS-E-1003`。
- **复杂度**：M

### 2.8 组 8：README 与交付

#### 8.1 README 主体
- **目标**：交付可直接上手的说明。
- **涉及文件**：`README.md`
- **前置依赖**：7.8
- **验收断言**：含 项目简介/快速开始（`npm ci`→`npm run dev`；`npm run build`+`npx serve dist`；`npm run build:single` 双击）/隐私说明/规则清单/已知限制/免责声明/验收证据/开发说明 8 章；命令与 `package.json` 一致；目录结构与模块职责和 `src/` 实际一致。
- **复杂度**：M

#### 8.2 21 条规则表一致性
- **目标**：确保文档、代码、导出三处规则口径一致。
- **涉及文件**：`README.md`、`src/core/rules.ts`、`src/core/__tests__/rules.test.ts`
- **前置依赖**：3.17、8.1
- **验收断言**：README 规则表 21 行，ID/名称/级别/说明/建议/默认开关与 `RULES` 完全一致；单测断言 `RULES.length===21`、ID 集合与 README 表格一致；`RULE_SET_VERSION` 在 README 与代码一致；`.bat/.cmd` 扫描范围、R-011 中文关键词与弱口令、R-020/R-021 拆分均在规则表或范围表注明。
- **复杂度**：S

#### 8.3 已知限制、免责与隐私说明
- **目标**：把设计已知风险转为用户可理解文本。
- **涉及文件**：`README.md`
- **前置依赖**：8.1
- **验收断言**：完整列出 LIM-01~07（正则启发式、模板 `${}`、未闭合字符串、无 AST/docstring、YAML 块标量/Makefile、嵌套块注释、未闭合围栏）；免责声明含"不替代 gitleaks/trufflehog""git 历史密钥必须轮换""浏览器扩展风险"；隐私说明含零上传/零网络/零持久化/日志策略；加密夹具与炸弹夹具生成方法可复现；CSP 可选说明存在。
- **复杂度**：S

#### 8.4 验收证据与回归清单
- **目标**：形成可审计的交付证据。
- **涉及文件**：`README.md`
- **前置依赖**：7.8~7.10、8.1
- **验收断言**：18 条验收用例逐条记录编号/结论/证据位置/偏差说明；P0 13 条全通过、P1 5 条通过或记录偏差影响；记录性能数据与 Network/Console/Storage 检查结论；列出回归触发条件（规则变更、提取器变更、依赖升级、构建配置变更需重跑 L1~L4）；附设计偏差落地说明（4 处）与阶段边界声明。
- **复杂度**：S

## 3. 设计偏差落地位置（必须显式实现）

| 偏差 | 设计依据 | 落地任务 | 验收锚点 |
|---|---|---|---|
| `.bat/.cmd` 纳入代码类白名单（仅注释扫描） | design 2.5.1「Batch（`.bat`/`.cmd`）」范围补充；CLS-EXT-008 | 3.11 修改 `languageMap.ts` 与 `fileFilter.ts`；8.2 README 扫描范围表同步 | `.BAT/.CMD` 大写变体可被扫描；README 范围表含该两类；ACC 夹具可验证 `REM`/`::` |
| R-011 扩展中文关键词、中文冒号与 4 字符已知弱口令 | design 2.5.2「相对 spec 的三处必要调整」第 1、2 条；ACC-04 | 3.17 在 `rules.ts` 的 `pattern`、`password-like` 校验器、弱口令集合实现；8.2 规则表说明 | `数据库密码: Admin@123` 命中 high；`PASSWORD: root` 命中；普通 5 字符非弱口令不命中 |
| R-020 邮箱 / R-021 手机号拆分为两条默认关闭规则 | design 2.5.2 第 3 条；CLS-RUL-012 | 3.17 规则数据与 `getEnabledRules`；8.2 规则表 21 行 | `scanContactInfo=false` 时均不命中；开启后邮箱 low、手机号 medium |
| 命中 raw 片段受控保留（仅内存、不导出、不日志） | design 2.5.3「二次确认与临时展开」、2.11 风险 R-06；CLS-RPT-005 | 3.23 `RawSnippetStore`；4.4 `rawByFindingId` 16MB 预算；5.11 展开弹窗；6.5 导出审计；8.3 风险说明 | 展开后导出 JSON/CSV 检索完整值 0 命中；刷新/收起即清空；单条 ≤8KB、总量 ≤16MB |

## 4. 验收用例覆盖矩阵（CLS-ACC-01~18）

| 编号 | 级别 | 验证方式与任务 | 关键断言 |
|---|---|---|---|
| CLS-ACC-01 | P0 | 自动：3.16/3.17/3.18/3.21、7.5、7.6 | 1 条 critical（R-001）；片段 `AKIA************MNOP`；`suppressedRuleIds` 含 R-011 |
| CLS-ACC-02 | P0 | 自动：3.6、7.4 | `"http://example.com/a"` 不产注释；仅"正常注释"1 条片段；规则层 0 命中 |
| CLS-ACC-03 | P0 | 自动：3.18/3.21、7.5、7.6 | 内网 IP high 与连接串 critical 同时保留；展示 `mysql://***:***@10.1.2.3:3306/db` |
| CLS-ACC-04 | P0 | 自动：3.12/3.17、7.4、7.6 | docstring 命中 high；`sourceKind='docstring'`；中文关键词与中文冒号生效 |
| CLS-ACC-05 | P0 | 自动：3.4、7.5、7.6；手动复核 7.8 | `app.min.js`→ignored-type、`node_modules/**`→ignored-directory、`logo.png`→non-text，均出现在跳过明细 |
| CLS-ACC-06 | P0 | 自动：3.17、7.5 | `test/test` 命中 R-018 low |
| CLS-ACC-07 | P0 | 手动：7.3、7.8、7.10 | 页面可交互、进度更新、无 >200ms 长任务、≤60s、不白屏 |
| CLS-ACC-08 | P0 | 手动：7.8、7.9 | 断网下 `dist` 与单文件均完成上传→扫描→导出；Worker 被拒时降级可用 |
| CLS-ACC-09 | P0 | 手动：1.6、7.9、7.10 | Network 面板 0 条外部请求；`verify:network` 退出码 0 |
| CLS-ACC-10 | P0 | 自动：3.16、7.5、7.1 | `your_api_key_here`、`<your-secret>`、`${TOKEN}` 均 0 命中 |
| CLS-ACC-11 | P0 | 自动：3.2、7.6；手动：7.3、7.8 | `CLS-E-1005` 中止；页面不崩溃；可再次上传 |
| CLS-ACC-12 | P0 | 自动：3.2、7.2、7.6 | `../../etc/passwd.js` 被拒并登记 `illegal-path`；不中止作业 |
| CLS-ACC-13 | P0 | 自动：3.4、7.1、7.6 | `CLS-E-1007` + 跳过原因分布；不展示成功态 |
| CLS-ACC-14 | P1 | 自动：6.2、6.5、7.5 | `=SUM(A1).js` 路径单元格以 `'=` 开头；Excel 不计算 |
| CLS-ACC-15 | P1 | 手动：7.8、7.10 | 5000 条滚动 ≥30fps；过滤响应 ≤300ms |
| CLS-ACC-16 | P0 | 自动：6.5、7.5；手动：7.8 | 展开后导出 JSON/CSV 检索不到完整密钥；Storage 无残留 |
| CLS-ACC-17 | P0 | 自动：5.2/5.10、7.6；手动：7.8 | 恶意文件名按键值文本渲染，无弹窗、无脚本执行 |
| CLS-ACC-18 | P1 | 自动：3.12、7.4 | 关闭 docstring 后 docstring 命中消失，`#` 注释命中保留 |

## 5. 交付完成定义（DoD）与阶段边界

**完成定义**

1. 76 个子任务全部勾选，M1~M4 出口标准逐项满足。
2. `npm run lint`、`npm run test`、`npm run build`、`npm run build:single`、`npm run verify:network`、`npm run verify:build` 全部通过。
3. 18 条验收用例有结论；P0 13 条全通过；P1 5 条通过或记录偏差影响。
4. 4 处设计偏差均在上表任务中落地，并有单测或 README 证据。
5. README 8 章齐全，规则表 21 条与代码一致，验收证据可追溯。
6. 无 `dangerouslySetInnerHTML`、无网络 API、无持久化 API、`Finding`/导出中无 raw 字段。

**阶段边界**：本阶段只产出 `tasks.md`。不得初始化 npm 工程、不得执行 `npm install/npm ci`、不得创建应用源码或测试文件、不得执行构建与验收。编码与实施由后续编码代理按本清单执行。