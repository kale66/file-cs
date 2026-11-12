# 一、需求与存量功能关系分析

> **分析基线**：2026-11-12。项目目录 `E:\everypro\IDEProjects\Risk_Scanner` 为空白工程，仅存在 `.codeartsdoer/specs/commentleak_scanner/spec.md` 与 `.spec/commentleak_scanner/spec.md` 两份同源需求文档；不存在 `package.json`、`node_modules`、`src/`、构建配置或任何源文件。
> **结论**：本期为**全量新建**，不存在可复用的业务实现；设计重点是"从零建立可验证的最小架构"，并确保所有需求编号在模块与接口层面可追踪。

## 1.1 需求功能与存量功能对比

### 1.1.1 已实现功能

经 `glob` 全仓检索，除两份 `spec.md` 外无任何 `.ts/.tsx/.js/.json/.css/.html` 文件，因此**没有任何需求功能已被实现**。下表按业务模块给出核对结论；模板的四档匹配度（100%/75%/50%/25%）在本空仓特例下统一记为 **0%**，判定依据为"文件系统内不存在对应实现文件"，而非主观评估。

| 需求功能 | 存量功能 | 代码位置 | 匹配度 |
|---|---|---|---|
| 文件接收、zip 解压、炸弹防护（CLS-INP-001~012） | 无 | 无源文件（仅 `spec.md`） | 0% |
| 扫描范围判定与忽略组（CLS-FLT-001~010） | 无 | 无源文件 | 0% |
| 按语言提取注释（CLS-EXT-001~015） | 无 | 无源文件 | 0% |
| 数据驱动敏感信息检测（CLS-RUL-001~017） | 无 | 无源文件 | 0% |
| 统计、过滤、脱敏与上下文展示（CLS-RPT-001~012） | 无 | 无源文件 | 0% |
| JSON/CSV 导出与路径复制（CLS-EXP-001~004） | 无 | 无源文件 | 0% |
| 单页界面、深浅色、响应式、可访问性（CLS-UIX-001~008） | 无 | 无源文件 | 0% |
| 零网络、零持久化、日志安全（CLS-PRV-001~008） | 无 | 无源文件 | 0% |
| 双构建入口与单文件产物（CLS-BLD-001~006） | 无 | 无 `package.json` / `vite.config.*` | 0% |

**空仓特例说明**：模板要求匹配度取 100/75/50/25 四档，但本项目为全新工程，若强行归入 25% 会造成"存在可改造实现"的误导。故此处以 0% + 明确判定依据记录，便于评审区分"未实现"与"部分实现"。

### 1.1.2 需要扩展的功能

**无。** 空仓不存在可扩展的既有功能。

需要区分的是"平台基线能力"与"存量业务功能"：浏览器提供的 `File API`、`Web Worker`、`Blob/URL.createObjectURL`、`TextDecoder`、`Clipboard API` 属于运行环境能力，不是本项目的存量代码，不构成可复用实现，但会约束设计（见 1.2.3）。

| 需求功能 | 存量功能 | 差异说明 | 扩展方向 |
|---|---|---|---|
| — | — | 无可扩展对象 | 全部按新增设计 |

### 1.1.3 需要新增的功能或接口

以下按业务模块分组。每组功能点均说明输入、输出与依赖，作为第二章模块划分与接口设计的输入。

#### A. 文件接收与解压（`src/core/unzip.ts`、`src/workers/scan.worker.ts`、`src/ui/*`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 上传入口（拖拽/点击/文件夹） | `DragEvent` / `File` / `FileSystemEntry` | 规范化后的 `FileInputCandidate` | File API、DataTransferItem |
| 类型与体积校验 | 候选文件 | 通过 / `CLS-E-1001` / `CLS-E-1002` | 无 |
| zip 中央目录解析与条目枚举 | `ArrayBuffer` | `ArchiveEntryMeta[]` | jszip |
| 炸弹预检与实时累计 | 条目元数据 + 实际解压字节 | 通过 / 中止 `CLS-E-1005` | 无 |
| 条目路径安全校验 | 条目原始路径 | `PathCheck`（合法/非法+原因） | 无 |
| 单条目读取 | 条目路径 | `Uint8Array`（用后即弃） | jszip |
| 解压进度上报 | 当前条目序号/总数 | `ProgressEvent`（≤200ms 间隔） | Worker 消息通道 |
| 作业取消与资源释放 | 取消指令 | 丢弃引用、终止 Worker、回上传态 | Worker.terminate |

#### B. 扫描范围判定（`src/core/fileFilter.ts`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 文档类识别（全量扫描） | 相对路径 | `FileClassification` | 路径规范化 |
| 代码类识别（仅注释） | 相对路径 | `LanguageSpec \| null` | 语言映射表 |
| 配置类识别（`.env*` 全量） | 文件名 | `config` 分类 | 无 |
| 忽略目录/类型/锁文件判定 | 路径 + 忽略组开关 | `SkipReason \| null` | `IgnoreGroups` |
| 单文件 2MB 上限判定 | 解压后体积 | 跳过记录 | 无 |
| 未识别扩展名登记 | 路径 | `unsupported-extension` 跳过项 | 语言映射表 |

#### C. 注释提取（`src/core/commentExtractor/*`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 语言分派 | 相对路径 | `LanguageSpec` | 映射表 |
| C 系词法提取（含字符串/模板/正则） | 文本 + 选项 | `CommentSnippet[]` | 无 |
| 井号系提取（含 shebang 排除） | 文本 | `CommentSnippet[]` | 无 |
| SQL 提取 | 文本 | `CommentSnippet[]` | 无 |
| HTML/XML/Vue/Svelte 提取（含内嵌 script/style） | 文本 | `CommentSnippet[]` | 子提取器 |
| Lua / Batch 提取 | 文本 | `CommentSnippet[]` | 无 |
| Python 注释 + docstring（可开关） | 文本 + 开关 | `CommentSnippet[]` | 无 |
| Markdown 全文 + 围栏状态 | 文本 | 带 `inCodeFence` 的片段 | 围栏追踪 |
| 片段 8KB 截断标记 | 片段 | `truncated` 标记 | 无 |

#### D. 敏感信息检测（`src/core/rules.ts`、`src/core/scanner.ts`、`src/core/entropy.ts`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 规则数组与启动校验 | — | `Rule[]` / 校验结果 | 无 |
| 单片段多规则匹配 | `CommentSnippet` + 启用规则 | `RawMatch[]` | 正则引擎 |
| 占位符/示例值抑制 | 匹配值 + 规则声明 | 保留 / 丢弃 / 降级 | 无 |
| 高熵兜底 | 匹配值 | 是否命中 | Shannon 熵 |
| 重叠区间去重 | 同文件同行的 `RawMatch[]` | 去重后命中 + `suppressedRuleIds` | 无 |
| 稳定排序与编号 | 全部命中 + 配置 | `Finding[]`（`f-<序号>`） | 无 |

#### E. 结果与脱敏（`src/core/redact.ts`、`src/ui/*`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 值级脱敏 | 原文值 + 脱敏类型 | 脱敏字符串 | 无 |
| 连接串/URL 结构化脱敏 | 匹配串 | `scheme://***:***@host/...` | 无 |
| 私钥/证书仅 BEGIN 行 | 匹配串 | 单行摘要 | 无 |
| 上下文构造（上下各 1 行） | 文件行数组 + 命中行 | 脱敏上下文 | 行缓存 |
| 二次确认临时展开 | `findingId` + 用户确认 | 当前页面内存文本 | 内存 raw 存储 |
| 统计聚合与筛选 | 命中集合 + 过滤条件 | 计数、可见列表 | 无 |

#### F. 报告导出（`src/core/export.ts`、`src/ui/*`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| JSON 报告构造 | 结果 + 配置快照 | `ExportReport` | 无 |
| CSV 生成（BOM/CRLF/防注入） | 命中列表 | `string` | 无 |
| 本地下载 | 文本 + 文件名 | `Blob` 下载 | Blob/URL |
| 路径清单复制 | 去重文件路径 | 剪贴板文本 | Clipboard API |

#### G. 界面与交互（`src/ui/*`、`src/App.tsx`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 单页状态机 | 用户操作 + Worker 事件 | 视图状态 | React `useReducer` |
| 忽略规则/规则说明面板 | `ScanConfig` / `Rule[]` | 开关变更事件 | 无 |
| 结果表（分页/折叠/过滤/排序） | `Finding[]` + `FilterState` | 渲染列表 | 无 |
| 进度与取消 | `ProgressEvent` | 进度区 + 取消按钮 | Worker 客户端 |
| 深浅色与响应式 | `prefers-color-scheme` / 视口 | 样式 | Tailwind `darkMode: 'media'` |
| 错误态与成功态 | 错误码 / 空结果 | 文案 + 可执行动作 | 错误目录 |

#### H. 构建、自检与验证（根目录配置、`scripts/*`）

| 功能点 | 输入 | 输出 | 关键依赖 |
|---|---|---|---|
| 标准构建 | `npm run build` | `dist/` | Vite |
| 单文件构建 | `npm run build:single` | `dist-single/index.html` | vite-plugin-singlefile |
| 零网络静态校验 | `src/` + `dist/` | 校验报告/退出码 | Node 脚本 |
| 验收夹具生成 | 脚本参数 | `fixtures/*.zip` | Node + jszip |
| 单元测试 | 纯函数模块 | 测试结果 | Vitest |

## 1.2 存量功能详细分析

### 1.2.1 空仓约束（对设计的直接影响）

1. **无工程脚手架**：需一次性建立 `package.json`、`tsconfig`、Vite/Tailwind/PostCSS 配置、ESLint 配置与目录结构；不存在可继承的团队约定，因此所有约定必须在本设计中显式声明。
2. **无设计系统与组件库**：不得引入重型 UI 库（会扩大离线打包体积与供应链面），界面采用 Tailwind 原子类 + 少量自研组件（按钮、面板、表格、进度条、弹窗）。
3. **无测试基线**：需从零建立 Vitest 单元测试与验收脚本，否则"纯函数可独立测试"（CLS-NFR-020）无法证明。
4. **无 CI**：零网络校验、类型检查、单测需以 `npm run` 脚本形式交付，便于人工或后续 CI 复用。

### 1.2.2 环境基线

| 环境项 | 实测值 | 设计影响 |
|---|---|---|
| Node.js | 24.21.0 | 满足 Vite 5.x 的 Node ≥18 要求；构建脚本使用 ESM |
| npm | 11.19.0 | 支持 lockfile v3 与 `npm ci` 可复现安装 |
| Python | 3.7.4 | 仅作为可选辅助（不纳入主构建链），夹具生成以 Node 脚本为主，避免双运行时依赖 |
| 浏览器 | Chrome/Edge/Firefox 最近 2 个主版本；Safari 16.4+ 尽力 | 需处理 `file://` 下 Worker、Blob URL、模块 Worker 的差异 |
| 网络 | 运行期必须为 0 外部请求 | 依赖全部本地打包；字体使用系统字体栈 |

### 1.2.3 平台能力约束

1. **File API 只读**：浏览器不能把 zip 解压到磁盘，所有中间数据只能驻留内存，因此"解压总量上限 + 逐条目释放"是硬性设计前提，而非优化项。
2. **Worker 无 DOM**：解压、筛选、提取、匹配、脱敏全部可在 Worker 内完成；但错误文案渲染、剪贴板、下载必须回主线程。
3. **Worker 通信为结构化克隆**：大对象复制会产生主线程长任务，因此结果必须分批回传（见 2.6）。
4. **`file://` 协议限制**：单文件构建下，独立 Worker 文件不存在，需使用内联 Worker（Blob URL）；部分浏览器对 `file://` 的 Worker 有限制，必须提供主线程降级路径并明确提示（CLS-UIX 异常场景）。
5. **无持久化权限假设**：不依赖 localStorage/IndexedDB；刷新即清空，符合 CLS-PRV-003。
6. **无服务端**：无任何鉴权、配额、CORS 设计；网络层设计为"空实现"。

### 1.2.4 对第二章设计的约束结论

- 核心逻辑（筛选、提取、脱敏、导出转义）必须是**无 DOM、无全局状态、可单测的纯函数**（CLS-NFR-020）。
- Worker 与主线程共享的只有 `types.ts` 中的协议类型与 `core/*` 纯函数，禁止 Worker 反向依赖 `ui/*`。
- 所有配置必须序列化后随作业下发，Worker 不读取任何浏览器存储。
- 构建必须支持两条互不污染的产物路径，且单文件产物不得依赖绝对资源路径（CLS-NFR-028）。

# 二、增量设计方案

## 2.1 实现模型

### 2.1.1 上下文视图

本工具的上下游关系极简：唯一的数据入口是用户显式选择的本地文件，唯一的出口是用户显式触发的本地下载/剪贴板；与外部网络服务**不存在任何调用边**。下图中的虚线是"必须被验证为空"的禁止关系，而不是实际存在的连接。

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
skinparam componentStyle rectangle

actor "开发者 / 提交者" as Dev
actor "安全审查者 / 评审人" as Rev

node "浏览器（单页应用，单作业）" as Browser {
  component "CommentLeak Scanner\nReact UI + Web Worker" as CLS
  component "浏览器内存\n（结果 / 临时 raw / 配置）" as Mem
}

storage "本地文件系统\n（只读，用户显式选择）" as FS
cloud "外部网络服务" as NET

Dev --> CLS : 选择 zip / 拖入文件夹\n启动 / 取消 / 过滤 / 导出
Rev --> CLS : 查看报告 / 复制路径
CLS --> FS : File API 读取（仅内存，0 上传）
CLS --> Mem : 读写（无持久化）
CLS ..> NET : 禁止建立任何连接（0 请求）
note right of CLS : 无后端、无账号、无埋点、无 CDN、无远程字体
@enduml
```

**通信契约**

| 关系 | 协议/方式 | 频率 | 方向 |
|---|---|---|---|
| 用户 ↔ 界面 | DOM 事件（拖拽、点击、输入） | 用户触发 | 双向 |
| 界面 ↔ 本地文件系统 | File API（`File.arrayBuffer()` / `webkitdirectory` / `DataTransferItem`） | 每次作业 1 次入口 | 读 |
| 主线程 ↔ Worker | `postMessage` 结构化克隆 + `ArrayBuffer` 转移 | 进度 ≤10 次/秒；结果按批 | 双向 |
| 界面 ↔ 剪贴板/下载 | Clipboard API、`Blob` + `a[download]` | 用户触发 | 写 |
| 界面 ↔ 外部网络 | **无实现**（代码中不存在网络客户端） | 0 | 禁止 |

### 2.1.2 服务/组件总体架构

系统采用"主线程只做渲染、Worker 承担全部重计算"的双层结构。`core/*` 为无副作用纯函数库，被 Worker 调用；主线程只通过 `ScanWorkerClient` 与 Worker 交互，不直接触碰解压与扫描逻辑。

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
skinparam componentStyle rectangle

package "主线程（UI Thread）" {
  [App.tsx\n页面状态机] as App
  [ui/*\n展示与交互组件] as UI
  [ScanWorkerClient\n消息路由 / 超时 / 取消] as Client
  [ResultStore\n结果拼装 + 临时 raw Map] as Store
  [export.ts\nJSON / CSV / 剪贴板] as Export
}

package "Web Worker（scan.worker.ts）" {
  [JobRunner\n作业编排 / 阶段进度] as Runner
  [unzip.ts\njszip 封装 / 炸弹 / 路径] as Unzip
  [fileFilter.ts\n分类与忽略] as Filter
  [commentExtractor/*\n词法状态机] as Extractor
  [rules.ts + entropy.ts\n规则匹配 / 去重] as Rules
  [redact.ts\n脱敏 / 上下文] as Redact
}

database "浏览器内存\n（无 localStorage/IndexedDB）" as Mem
cloud "外部网络" as Net

UI --> App
App --> Client : start / cancel
Client --> Runner : job:start / job:cancel
Runner --> Unzip
Runner --> Filter
Runner --> Extractor
Runner --> Rules
Runner --> Redact
Runner --> Client : job:progress / job:findings / job:done / job:error
Client --> Store
Store --> App
App --> Export
Store --> Mem
App ..> Net : 0 请求（构建期与运行期双重校验）
@enduml
```

**组件职责与边界**

| 组件 | 职责 | 明确不做 | 依赖方向 |
|---|---|---|---|
| `App.tsx` | 页面阶段机、配置持有、作业启停、结果汇总 | 不做解压/提取/正则匹配 | → `ui/*`、`ScanWorkerClient`、`ResultStore` |
| `ui/*` | 纯展示与用户事件上抛；结果表分页/折叠/过滤 | 不持有原始文件字节；不写浏览器存储 | → `types.ts` |
| `ScanWorkerClient` | 创建/重建 Worker、消息编解码、进度节流、取消与降级 | 不做业务判断 | → `protocol.ts`、Worker |
| `ResultStore` | 拼装命中批次、保存脱敏结果与二次确认 raw、生成统计 | 不参与扫描；不导出 raw | ← Worker 消息 |
| `export.ts` | 报告构造、CSV 转义、下载/复制 | 不读取 raw；不做检测 | ← 结果快照 |
| `JobRunner` | 单一作业的生命周期编排、阶段切换、进度计算、取消检查 | 不直接操作 DOM | → `core/*` |
| `unzip.ts` | zip 打开、条目元数据、路径校验、炸弹判定、逐条读取 | 不做文本解码以外的业务 | → jszip |
| `fileFilter.ts` | 分类（文档/代码/配置）、忽略组、体积上限 | 不做注释提取 | → `languageMap.ts` |
| `commentExtractor/*` | 按语言产出带行号与来源的片段 | 不做规则匹配、不做脱敏 | → 无 |
| `rules.ts` | 规则数据、编译缓存、匹配策略字段 | 不做去重与排序（由 `scanner.ts`） | → `entropy.ts` |
| `redact.ts` | 值级/结构级脱敏、上下文截断 | 不做检测、不做导出格式化 | → 无 |
| `export.ts` | 报告 JSON、CSV、路径清单 | 不包含 raw 字段 | → `types.ts` |

### 2.1.3 技术选型与版本策略

**选型结果**

| 技术项 | 选定版本 | 选择理由 | 备选与放弃原因 |
|---|---|---|---|
| 构建工具 | Vite `^5.4.x` | Node 18+ 兼容、Worker 与 `?worker&inline` 支持成熟、配置面小 | Vite 7 更新但插件兼容窗口短；无必要追新 |
| UI 框架 | React `^18.3.x` + `react-dom` | 生态稳定、并发渲染可避免大列表重绘阻塞、团队认知成本低 | React 19 可用但收益不足以承担生态迁移风险 |
| 语言 | TypeScript `~5.6.x`，`strict: true` | 类型安全是跨线程协议正确性的前提；`~` 锁定次版本避免编译差异 | 允许 `any` 会破坏协议校验，明确禁止 |
| 样式 | Tailwind CSS `^3.4.x` + PostCSS + Autoprefixer | 原子类便于深色/响应式；配置显式；不引入运行时 CSS-in-JS | Tailwind 4 采用 CSS-first，配置与文档生态仍在迁移，暂不采用 |
| zip 解压 | jszip `^3.10.1` | 用户指定；纯 JS、无网络；支持条目枚举与按需 `async()` | fflate 更快但 API 与元数据访问方式不同，且违背既定依赖 |
| 单文件构建 | vite-plugin-singlefile `^2.0.x` | 官方常用方案，内联 JS/CSS，支持 `file://` | 手写内联脚本不可维护 |
| 单元测试 | Vitest `^2.1.x`（devDependency） | 与 Vite 同源配置、零额外构建 | Jest 需额外转译配置 |
| 代码规范 | ESLint `^9.x` + `typescript-eslint`（devDependency） | 阻断 `dangerouslySetInnerHTML`、`eval`、外部 URL 常量等 | 可选项，不影响运行期产物 |
| 状态管理 | React `useReducer` + 局部 `useState` | 单页单作业，状态树浅；避免额外依赖 | Redux/Zustand 属于过度设计 |
| 路由 | 不引入 | 单页信息架构（CLS-UIX-001） | React Router 无使用场景 |
| 虚拟列表 | 不引入库，采用**分页 + `content-visibility`** | 满足 5000 条滚动性能；实现可控；避免第三方依赖 | `react-window` 增加依赖且与折叠分组组合复杂 |
| 字体 | 系统字体栈（`system-ui`、`Segoe UI`、`Microsoft YaHei`） | 满足零远程字体要求 | Web Font 会引入外部资源或大体积内联 |
| 网络客户端 | **无** | CLS-PRV-001 硬约束 | axios/fetch 封装一律禁止 |

**版本锁定策略**

1. `package.json` 使用 caret 范围表达意图，但**必须提交 `package-lock.json`**；构建与验证统一使用 `npm ci`，确保可复现。
2. 运行期依赖仅允许上表中的 6 项（react、react-dom、jszip、tailwind 产物、singlefile 仅构建期、Vite 仅构建期）；任何新增运行期依赖须经隐私与体积评审。
3. `engines.node` 声明 `>=18.18 <25`；README 标注实测 Node 24.21.0、npm 11.19.0。
4. 禁止 `postinstall` 下载二进制或远程资源；依赖安装后即可离线构建。
5. 规则集版本 `RULE_SET_VERSION` 与 `package.json` 版本解耦，规则变更时单独递增并写入导出报告（CLS-RPT-012）。

### 2.1.4 关键架构决策（ADR）

| 编号 | 决策 | 备选 | 选择理由 | 代价/缓解 |
|---|---|---|---|---|
| ADR-01 | **解压、筛选、提取、匹配全部在 Worker 内完成** | 主线程分片 + `requestIdleCallback` | 满足主线程长任务 ≤200ms；取消可通过 `terminate` 兜底 | Worker 无 DOM，需设计消息协议；单文件构建需内联 Worker |
| ADR-02 | **jszip 逐条目 `async()` 读取，处理完立即释放** | 一次性解压全部条目 | 避免 500MB 解压总量同时驻留内存 | 逐条 `await` 有调度开销；通过批量元数据预检降低无效解压 |
| ADR-03 | **Worker 双形态：标准构建独立文件 / 单文件构建 inline** | 统一 inline；或统一独立 | 标准构建保持 worker 可缓存、主包小；单文件必须自包含 | 通过 `@worker-factory` 别名在构建期切换，接口保持一致 |
| ADR-04 | **规则数据驱动 + 少量声明式策略字段**（`captureGroup`、`maskKind`、`suppressIf`、`entropy`） | 每条规则写独立函数 | 满足 CLS-RUL-001"新增规则不改编排"；同时能处理连接串/私钥等结构 | 策略字段需类型化并有启动校验，防止规则作者写错 |
| ADR-05 | **命中区间重叠即去重（保留最高级别）** | 仅完全相同的起止位置去重 | 验收 ACC-01 中通用密钥规则与 AWS 规则区间不同但必须只留 1 条 | 可能吞掉同一行相邻且部分重叠的第二个命中；通过"不重叠才保留"的边界测试约束 |
| ADR-06 | **保留命中片段 raw 于内存 Map，供二次确认展开** | 不保留 raw（无法展开）；或向 Worker 二次请求（Worker 已释放） | CLS-RPT-005 要求展开；刷新即失、不导出、不日志 | 与 CLS-INP-012"仅保留脱敏结果"存在张力，作为**受控例外**：仅保留命中片段而非整文件，且设总上限（见 2.7.4） |
| ADR-07 | **结果表分页 + CSS `content-visibility: auto`** | 自研虚拟滚动 | 实现简单、无依赖、满足 30fps 与 ≤300ms 过滤 | 分页切换有一次重绘；通过每页 200 条与 `useMemo` 控制 |
| ADR-08 | **不引入 AST / tree-sitter** | acorn / tree-sitter | 体积、离线构建、跨语言成本；需求明确禁止 | 词法级误判需在 README 明示（CLS-EXT-004、5.3.3） |
| ADR-09 | **单作业串行** | 并发多作业 | 内存与状态可控；CLS-NFR-011 要求 | 上传中再次上传必须阻止或先取消 |
| ADR-10 | **构建期零网络静态校验 + 运行期人工 Network 验证** | 运行期 monkey-patch `fetch` | 不改写全局 API，避免与扩展/宿主冲突；静态校验可 CI 化 | 需要 README 提供可复现的手工验证步骤（ACC-09） |

### 2.1.5 作业生命周期（实现设计文档 · 高层状态机）

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"

[*] --> Idle
Idle --> Validating : 用户选择 zip / 拖入文件夹
Validating --> Failed : 类型/体积不合法（CLS-E-1001/1002）
Validating --> Unzipping : 合法（zip）
Validating --> Filtering : 合法（文件夹，跳过解压）
Unzipping --> Failed : 损坏/加密/炸弹（CLS-E-1003/1004/1005）
Unzipping --> Filtering : 解压完成
Filtering --> Empty : 可扫描集合为空（CLS-E-1007）
Filtering --> Scanning : 存在可扫描文件
Scanning --> Cancelled : 用户取消
Scanning --> Failed : Worker 异常（CLS-E-1008）
Scanning --> Finalizing : 全部文件处理完成
Finalizing --> Completed : 有命中
Finalizing --> Empty : 无命中（成功态）
Completed --> Idle : 重新上传 / 重置
Empty --> Idle : 重新上传
Failed --> Idle : 重新上传
Cancelled --> Idle : 重新上传
@enduml
```

**阶段与进度权重**

| 阶段 | 进度区间 | 进度分母 | 说明 |
|---|---|---|---|
| `validating` | 0% | 1 | 仅校验扩展名与字节数，不解压 |
| `unzipping` | 2%–35% | 条目总数 | 元数据预检计入前 2%；逐条读取按条目数递增 |
| `filtering` | 35%–40% | 条目总数 | 分类、忽略、体积判定 |
| `scanning` | 40%–95% | 可扫描文件数 | 单文件内部不再细分，避免进度抖动 |
| `finalizing` | 95%–100% | 1 | 去重、排序、统计、结果封包 |

**单调性保障**：`JobRunner` 维护 `lastPercent`，每次上报取 `max(lastPercent, computed)`，并采用"向下取整到 0.1%"避免浮点回退；同一阶段内 `processed` 只增不减。

## 2.2 目录结构与模块职责

### 2.2.1 目录树

```text
Risk_Scanner/
├─ index.html                     # 单页宿主，仅一个 #root 与内联主题色 meta
├─ package.json                   # scripts: dev/build/build:single/test/lint/verify:*
├─ package-lock.json              # 必须提交，npm ci 可复现
├─ tsconfig.json                  # strict + noUncheckedIndexedAccess
├─ tsconfig.node.json             # vite.config / scripts 的 Node 侧类型
├─ vite.config.ts                 # 标准构建（Worker 独立文件）
├─ vite.config.single.ts          # 单文件构建（Worker inline + 资源内联）
├─ tailwind.config.ts             # darkMode: 'media'，content 扫描 src
├─ postcss.config.js
├─ eslint.config.js               # 禁止 dangerouslySetInnerHTML / eval / 外部 URL
├─ vitest.config.ts               # node 环境；include src/**/*.test.ts
├─ README.md                      # 使用、隐私、规则表、已知限制、免责声明、验收证据
├─ .gitignore                     # node_modules / dist / dist-single / fixtures
├─ scripts/
│  ├─ make-fixtures.mjs           # 生成 ACC-01~06、10、12~14、16~18 夹具
│  ├─ make-large-fixture.mjs      # 生成 ~100MB / 多条目性能夹具
│  ├─ make-bomb-fixture.mjs       # 生成高压缩比炸弹（仅本地验证，不入库）
│  ├─ verify-no-network.mjs       # 扫描 src 与 dist 的网络 API / 外部 URL
│  └─ verify-build.mjs            # 校验两种产物完整性（单文件无外链）
├─ fixtures/                      # 脚本生成物，.gitignore
└─ src/
   ├─ main.tsx                    # createRoot 挂载，不注册任何 Service Worker
   ├─ App.tsx                     # 单页状态机与作业编排（唯一持有作业状态）
   ├─ index.css                   # @tailwind 三件套 + 系统字体栈 + 主题变量
   ├─ types.ts                    # 全量共享类型（见 2.4）
   ├─ vite-env.d.ts               # __APP_VERSION__ / __SINGLE_FILE__ 全局声明
   ├─ core/
   │  ├─ unzip.ts                 # zip/文件夹读取、路径校验、炸弹防护
   │  ├─ fileFilter.ts            # 文档/代码/配置分类与忽略组
   │  ├─ scanner.ts               # 单文件扫描、去重、排序、统计
   │  ├─ rules.ts                 # 规则数组、编译缓存、启动校验
   │  ├─ redact.ts                # 脱敏、上下文、导出前清洗
   │  ├─ entropy.ts               # Shannon 熵与字符集判定
   │  ├─ export.ts                # JSON/CSV/路径清单/下载/剪贴板
   │  ├─ errors.ts                # CLS-E-xxxx 错误目录与用户文案
   │  ├─ path.ts                  # 路径规范化、非法路径判定、稳定排序
   │  ├─ text.ts                  # UTF-8 解码、换行归一、行切分
   │  ├─ config.ts                # 默认 ScanConfig、忽略组、配置变更提示
   │  ├─ log.ts                   # 计数/耗时/错误码日志（禁止内容与路径）
   │  └─ commentExtractor/
   │     ├─ index.ts              # 语言分派与统一提取入口
   │     ├─ languageMap.ts        # 扩展名/文件名 → 语言组映射表
   │     ├─ comments.ts           # 行号索引与片段收集的共享工具
   │     ├─ cFamily.ts            # C 系状态机（JS 正则/模板串特殊处理）
   │     ├─ hashFamily.ts         # 井号系（含 Makefile/Dockerfile）
   │     ├─ sql.ts                # SQL -- 与 /* */
   │     ├─ markup.ts             # HTML/XML/Vue/Svelte（含 script/style 子提取）
   │     ├─ lua.ts                # Lua -- 与 --[[ ]]
   │     ├─ batch.ts              # Batch REM / ::
   │     ├─ python.ts             # Python # 与 docstring
   │     ├─ markdown.ts           # Markdown 全文 + 围栏追踪
   │     └─ plainText.ts          # .rst/.txt/.adoc 等纯文本全文
   ├─ workers/
   │  ├─ scan.worker.ts           # Worker 入口：绑定消息、创建/取消 JobRunner
   │  ├─ jobRunner.ts             # 单作业编排、阶段进度、取消检查
   │  ├─ protocol.ts              # 协议版本、消息构造与运行时守卫
   │  ├─ workerClient.ts          # 主线程侧客户端：创建/重建/超时/降级
   │  ├─ factory.standard.ts      # new Worker(new URL(...))（classic/iife）
   │  ├─ factory.inline.ts        # ?worker&inline Blob Worker
   │  └─ workerFactory.ts         # 工厂类型契约（被 alias 替换实现）
   └─ ui/
      ├─ UploadDropzone.tsx       # 拖拽/点击/文件夹入口
      ├─ ProgressPanel.tsx        # 阶段、百分比、当前文件、取消
      ├─ SummaryCards.tsx         # 统计卡片与筛选计数
      ├─ ResultToolbar.tsx        # 过滤、排序、折叠、导出、复制
      ├─ FindingsTable.tsx        # 分组表格 + 分页 + content-visibility
      ├─ FindingRow.tsx           # 单条命中（脱敏片段、上下文、展开入口）
      ├─ RevealDialog.tsx         # 二次确认弹窗与临时展开
      ├─ SkippedFilesPanel.tsx    # 跳过文件分组与“前 100 条”
      ├─ ConfigPanels.tsx         # 忽略规则组 + 检测规则说明（默认折叠）
      ├─ PrivacyNotice.tsx        # 顶部/底部隐私声明与工具边界
      ├─ EmptyState.tsx           # 无命中成功态 / 无可扫描文件
      ├─ ErrorState.tsx           # 错误码、原因、建议动作
      ├─ Button.tsx / Panel.tsx / ProgressBar.tsx / SeverityBadge.tsx
      └─ hooks/
         ├─ useScanJob.ts         # 串接 ScanWorkerClient 与 App 状态
         └─ useFilteredFindings.ts# 过滤/排序/分组的纯计算封装
```

**依赖方向（强制）**

```text
types.ts  ← 任何模块（types 不得 import 其他模块）
core/*    ← workers/*、ui/*（core 不得 import ui 或 workers）
workers/* ← App.tsx（ui 组件不得直接 import workerClient）
ui/*      ← App.tsx
```

- `core/*` 内不允许出现 `window`、`document`、`localStorage`、`fetch`、`XMLHttpRequest`。
- `ui/*` 不允许出现 `jszip`、正则规则数组、解压逻辑。
- 任何模块不得使用 default export（`App.tsx` 与 `main.tsx` 除外），避免重命名漂移。

### 2.2.2 模块职责与导出签名

以下签名以 TypeScript 声明形式给出，仅表达契约，不含实现。所有参数与返回值均引用 `src/types.ts` 中的类型（见 2.4）。

#### `src/core/unzip.ts`

| 导出 | 职责 |
|---|---|
| `openZipArchive` | 用 jszip 打开 `ArrayBuffer`，返回可按需读取的 `ArchiveReader` |
| `buildFolderReader` | 将拖入目录的 `File[]` 包装为与 zip 等价的 `ArchiveReader` |
| `validateArchivePath` | 条目路径规范化与非法判定（`..`、绝对路径、控制字符） |
| `createBombGuard` | 维护累计解压字节、单条压缩比、条目数上限 |

```ts
export interface ArchiveReadOptions {
  jobId: string;
  config: ScanConfig;
  onEntryChecked?: (checked: number, total: number) => void;
}

export interface ArchiveReader {
  readonly kind: 'zip' | 'folder';
  readonly entries: readonly ArchiveEntryMeta[];
  readonly totalUncompressedBytes: number;
  readEntry(entry: ArchiveEntryMeta): Promise<Uint8Array>;
  dispose(): void;
}

export interface FolderInputFile {
  readonly path: string;
  readonly file: File;
}

export async function openZipArchive(
  data: ArrayBuffer,
  options: ArchiveReadOptions,
): Promise<ArchiveReader>;

export function buildFolderReader(
  files: readonly FolderInputFile[],
  options: ArchiveReadOptions,
): ArchiveReader;

export function validateArchivePath(rawPath: string): PathValidation;

export interface BombGuard {
  inspectMetadata(meta: ArchiveEntryMeta): BombGuardDecision;
  accountRead(meta: ArchiveEntryMeta, actualBytes: number): BombGuardDecision;
}

export function createBombGuard(config: ScanConfig, entryCount: number): BombGuard;
```

#### `src/core/fileFilter.ts`

| 导出 | 职责 |
|---|---|
| `classifyPath` | 判定文档/代码/配置/未知，并给出语言规格 |
| `decideScan` | 结合忽略组与体积给出"扫描/跳过 + 原因" |
| `summarizeSkipReasons` | 跳过项按原因聚合，供 UI 与导出 |

```ts
export const DEFAULT_IGNORE_GROUPS: IgnoreGroups;

export function classifyPath(relPath: string, config: ScanConfig): FileClassification;

export function decideScan(
  entry: ArchiveEntryMeta,
  config: ScanConfig,
): ScanDecision;

export function summarizeSkipReasons(
  skipped: readonly SkippedFile[],
): SkipReasonCounts;
```

#### `src/core/commentExtractor/index.ts`

```ts
export function resolveLanguage(
  relPath: string,
  displayName: string,
): LanguageSpec | null;

export function extractSnippets(input: ExtractInput): ExtractResult;
```

#### `src/core/commentExtractor/languageMap.ts`

```ts
export const LANGUAGE_SPECS: readonly LanguageSpec[];
export const EXTENSION_TO_LANGUAGE: Readonly<Record<string, LanguageId>>;
export const FILENAME_PATTERNS: readonly FileNamePattern[];

export function lookupByExtension(ext: string): LanguageSpec | null;
export function lookupByFileName(fileName: string): LanguageSpec | null;
```

#### `src/core/commentExtractor/comments.ts`

```ts
export interface LineIndex {
  readonly starts: readonly number[];
  lineAt(offset: number): number;
}

export function buildLineIndex(text: string): LineIndex;

export interface SnippetBuilder {
  addLine(
    startLine: number,
    text: string,
    sourceKind: SourceKind,
    inCodeFence: boolean,
  ): void;
  addBlock(
    startLine: number,
    endLine: number,
    text: string,
    sourceKind: SourceKind,
    inCodeFence: boolean,
  ): void;
  finish(): readonly CommentSnippet[];
}

export function createSnippetBuilder(maxSnippetBytes: number): SnippetBuilder;
```

#### 各语言提取器

```ts
export function extractCFamily(text: string, options: CFamilyOptions): CommentSnippet[];
export function extractHashFamily(text: string, options: HashFamilyOptions): CommentSnippet[];
export function extractSql(text: string, options: ExtractOptions): CommentSnippet[];
export function extractMarkup(text: string, options: MarkupOptions): CommentSnippet[];
export function extractLua(text: string, options: ExtractOptions): CommentSnippet[];
export function extractBatch(text: string, options: ExtractOptions): CommentSnippet[];
export function extractPython(text: string, options: PythonOptions): CommentSnippet[];
export function extractMarkdown(text: string, options: MarkdownOptions): CommentSnippet[];
export function extractPlainText(text: string, options: ExtractOptions): CommentSnippet[];

// 各 Options 类型定义见 2.4（types.ts），此处不重复声明
```

#### `src/core/rules.ts`

```ts
export const RULE_SET_VERSION: string;
export const RULES: readonly Rule[];

// RuleValidationIssue、CompiledRule 类型定义见 2.4（types.ts），此处不重复声明
export function validateRuleSet(rules: readonly Rule[]): RuleValidationIssue[];

export function compileRule(rule: Rule): CompiledRule;
export function getEnabledRules(config: ScanConfig): readonly CompiledRule[];
export function isPlaceholderValue(value: string, rule: Rule): boolean;
export function isSampleLikeHost(host: string): boolean;
```

#### `src/core/entropy.ts`

```ts
export function shannonEntropy(value: string): number;
export function isBase64Style(value: string): boolean;
export function isHexStyle(value: string): boolean;
export function qualifiesAsHighEntropy(value: string, config: EntropyConfig): boolean;
```

#### `src/core/scanner.ts`

```ts
export interface ScanContext {
  readonly config: ScanConfig;
  readonly rules: readonly CompiledRule[];
  readonly maxSnippetBytes: number;
}

export function scanSnippets(
  snippets: readonly CommentSnippet[],
  context: ScanContext,
): RawMatch[];

export function scanFile(input: FileScanInput, context: ScanContext): FileScanOutcome;

export function dedupeMatches(
  matches: readonly RawMatch[],
  context: ScanContext,
): FindingSeed[];

export function finalizeFindings(
  seeds: readonly FindingSeed[],
  jobId: string,
): Finding[];

export function buildSummary(args: SummaryInput): ScanSummary;

export function buildSeverityCounts(findings: readonly Finding[]): SeverityCounts;
```

#### `src/core/redact.ts`

```ts
export function maskValue(value: string, kind: MaskKind): string;
export function maskUrlCredentials(matchText: string): string;
export function maskConnectionString(matchText: string): string;
export function maskPrivateKey(matchText: string): string;
export function maskJwt(matchText: string): string;
export function truncateLine(line: string, maxLength?: number): string;

export interface ContextInput {
  readonly lines: readonly string[];
  readonly hitLine: number;          // 1-based
  readonly masker: (line: string) => string;
}

export function buildFindingContext(input: ContextInput): FindingContext;

export function scrubForExport(finding: Finding): ExportFinding;
```

#### `src/core/export.ts`

```ts
export function buildExportReport(args: ExportReportInput): ExportReport;
export function escapeCsvCell(value: string): string;
export function toCsv(findings: readonly ExportFinding[]): string;
export function buildPathList(findings: readonly Finding[]): string;

export function downloadTextFile(fileName: string, content: string, mime: string): void;
export async function copyTextToClipboard(text: string): Promise<boolean>;
```

#### `src/core/errors.ts`

```ts
export const ERROR_CATALOG: Readonly<Record<ClsErrorCode, ErrorInfo>>;

export class ClsError extends Error {
  readonly code: ClsErrorCode;
  readonly hint: string;
  constructor(code: ClsErrorCode, hint?: string);
}

export function isClsError(value: unknown): value is ClsError;
export function toErrorInfo(value: unknown): ErrorInfo;
```

#### `src/core/path.ts`

```ts
export function normalizeArchivePath(rawPath: string): string;
export function isIllegalArchivePath(rawPath: string): PathValidation;
export function comparePathAsc(a: string, b: string): number;
export function toDisplayPath(path: string, maxLength?: number): string;
```

#### `src/core/text.ts`

```ts
export interface DecodeResult {
  readonly text: string;
  readonly replacementCount: number;
  readonly hadBom: boolean;
}

export function decodeUtf8(bytes: Uint8Array): DecodeResult;
export function normalizeNewlines(text: string): string;
export function splitLines(text: string): string[];
export function sliceByBytes(text: string, maxBytes: number): { text: string; truncated: boolean };
```

#### `src/core/config.ts`

```ts
export function createDefaultScanConfig(overrides?: Partial<ScanConfig>): ScanConfig;

export function withConfigChange(
  current: ScanConfig,
  patch: Partial<Pick<ScanConfig, 'ignoreGroups' | 'scanPythonDocstring' | 'scanContactInfo'>>,
): { config: ScanConfig; notice: ConfigChangeNotice };

export function snapshotConfig(config: ScanConfig): ScanConfig;
```

- `createDefaultScanConfig`：忽略组全开、`scanPythonDocstring = true`、`scanContactInfo = false`、三个体积上限取 `LIMITS`、`scannedAt` 为当前 ISO 时间。
- `withConfigChange`：返回**新对象**（不原地修改），并附带"规则已变更，重新扫描后生效"提示；不自动重扫（CLS-FLT-008）。
- `snapshotConfig`：作业启动时深拷贝并冻结，扫描过程中修改 UI 开关不影响当前作业与导出 `config`（CLS-RPT-012）。

#### `src/core/log.ts`

```ts
export type LogKind = 'phase' | 'progress' | 'skip-count' | 'duration' | 'error-code';

export interface LogRecord {
  readonly kind: LogKind;
  readonly count?: number;
  readonly durationMs?: number;
  readonly code?: ClsErrorCode;
  readonly phase?: ScanPhase;
}

export function logEvent(record: LogRecord): void;
```

- `LogRecord` **不包含** `string` 内容字段（无路径、无片段、无错误原文），在类型层面阻断敏感信息进入日志。
- 生产构建仅输出 `error-code` 与 `duration`；开发构建额外输出计数与阶段。
- 禁止在业务代码中直接调用 `console.*`；ESLint `no-console` 仅允许 `core/log.ts` 内部使用。

#### `src/workers/protocol.ts`

```ts
export const PROTOCOL_VERSION: number;

export function createStartRequest(
  payload: StartPayload,
  config: ScanConfig,
): WorkerStartRequest;

export function createCancelRequest(jobId: string): WorkerCancelRequest;

export function isWorkerResponse(value: unknown): value is WorkerResponse;
```

#### `src/workers/scan.worker.ts`

```ts
// Worker 入口：无业务导出
export {};
```

- 职责：绑定 `WorkerScope.onmessage` → 校验 `WorkerRequest` → 创建 `CancelSignal` → 调用 `runJob` → 通过 `postMessage` 回传 `WorkerResponse`。
- 同一时刻只允许一个活动 `jobId`；收到新 `job:start` 时先取消旧作业（防御性，主线程已串行化）。
- `job:cancel` 只设置 `CancelSignal`，不直接 `close()`；由主线程超时后 `terminate`。
- 入口不引用 DOM/`window`/存储 API。

#### `src/workers/jobRunner.ts`

```ts
export interface CancelSignal {
  readonly cancelled: boolean;
  cancel(): void;
}

export function createCancelSignal(): CancelSignal;

export async function runJob(
  request: WorkerStartRequest,
  emit: (message: WorkerResponse) => void,
  signal: CancelSignal,
): Promise<void>;
```

#### `src/workers/workerClient.ts`

```ts
export interface ScanHandlers {
  onProgress(event: ScanProgress): void;
  onFindings(batch: FindingBatch): void;
  onSkipped(batch: SkippedBatch): void;
  onDone(result: ScanCompletion): void;
  onError(error: WorkerFailure): void;
  onCancelled(jobId: string): void;
}

export type WorkerFactory = () => Worker;

export class ScanWorkerClient {
  constructor(factory: WorkerFactory);
  get supported(): boolean;
  start(payload: StartPayload, handlers: ScanHandlers): string; // 返回 jobId
  cancel(jobId: string): void;
  dispose(): void;
}
```

#### `src/workers/workerFactory.ts` / `factory.standard.ts` / `factory.inline.ts`

`workerFactory.ts` 只声明契约，两个 `factory.*` 提供实现（由 alias 在构建期选择）：

```ts
// workerFactory.ts
export const createScanWorker: WorkerFactory;
```

```ts
// factory.standard.ts：classic/iife 独立 Worker
export const createScanWorker: WorkerFactory;
```

```ts
// factory.inline.ts：?worker&inline，Blob Worker
export const createScanWorker: WorkerFactory;
```

#### `src/App.tsx` / `src/main.tsx`

```ts
// App.tsx：唯一允许的默认导出例外
export default function App(): JSX.Element;

// main.tsx：仅执行 createRoot 挂载，无导出
export {};
```

#### UI 组件与 hooks

```ts
export function UploadDropzone(props: UploadDropzoneProps): JSX.Element;
export function ProgressPanel(props: ProgressPanelProps): JSX.Element;
export function SummaryCards(props: SummaryCardsProps): JSX.Element;
export function ResultToolbar(props: ResultToolbarProps): JSX.Element;
export function FindingsTable(props: FindingsTableProps): JSX.Element;
export function FindingRow(props: FindingRowProps): JSX.Element;
export function RevealDialog(props: RevealDialogProps): JSX.Element;
export function SkippedFilesPanel(props: SkippedFilesPanelProps): JSX.Element;
export function ConfigPanels(props: ConfigPanelsProps): JSX.Element;
export function PrivacyNotice(props: PrivacyNoticeProps): JSX.Element;
export function EmptyState(props: EmptyStateProps): JSX.Element;
export function ErrorState(props: ErrorStateProps): JSX.Element;

export function useScanJob(options: UseScanJobOptions): UseScanJobResult;
export function useFilteredFindings(
  findings: readonly Finding[],
  filter: FilterState,
  page: number,
): FilteredFindingsResult;
```

> **Props 类型边界**：各组件 Props（`UploadDropzoneProps` 等）与 hooks 的私有 Options/Result（`UseScanJobOptions`、`UseScanJobResult`）就近定义在对应 `.tsx/.ts` 文件，不进入 `types.ts`。只有跨组件、跨线程共享的状态类型（`FilterState`、`FindingGroup`、`AppState`、`RevealState` 等）才放入 `types.ts`，避免共享类型膨胀。

**签名使用约定**

1. 只读输入优先使用 `readonly T[]` / `Readonly`，禁止修改调用方数据。
2. 所有可能失败的核心函数返回判别联合（`{ ok: true, ... } | { ok: false, code }`）或抛 `ClsError`，不得返回 `null` 表示"未知原因失败"。
3. 跨 Worker 边界的函数参数必须是可结构化克隆的纯数据；禁止传 `File` 以外的 DOM 对象、函数、类实例（`ClsError` 在跨边界前转为 `WorkerFailure`）。

## 2.3 接口设计

### 2.3.1 总体设计

**接口分层**

| 层 | 接口集合 | 调用方向 | 稳定性 | 变更策略 |
|---|---|---|---|---|
| L1 纯函数核心 API | `unzip` / `fileFilter` / `commentExtractor` / `rules` / `scanner` / `redact` / `export` | Worker、主线程降级路径、单测 | 稳定 | 破坏性变更需同步更新单测与 README 规则表 |
| L2 线程协议 API | `protocol.ts` 消息类型 + `ScanWorkerClient` | 主线程 ↔ Worker | 稳定（`PROTOCOL_VERSION = 1`） | 新增可选字段向后兼容；删除/改义字段必须提升协议版本 |
| L3 UI 契约 | 组件 Props、`useScanJob` 返回值 | `App.tsx` → `ui/*` | 稳定 | 仅内部使用，允许随迭代调整 |
| L4 导出契约 | `ExportReport` / CSV 列定义 | 用户下载产物 | 稳定（`REPORT_VERSION = "1.0"`） | 只增字段不删字段；删除字段提升主版本 |

**命名与参数原则**

1. 函数名使用动词短语（`openZipArchive`、`decideScan`、`buildFindingContext`），类型名使用名词（`ArchiveEntryMeta`、`Finding`）。
2. 输入参数对象化，禁止超过 3 个位置参数；所有可选参数集中在 options 对象。
3. 不使用 `Map<string, string>` 承载业务字段；结构化数据必须有显式接口。
4. 所有金额/大小字段以 `*Bytes` 结尾，行号以 `line` 结尾且明确 1-based；时间统一 ISO 8601 字符串（`scannedAt`、`generatedAt`）。
5. 禁止 `any`；确需动态访问 jszip 内部元数据时，使用窄接口 `ZipEntryInternals` 并在 `unzip.ts` 内集中隔离。

**接口稳定性等级**

| 等级 | 含义 | 本期对象 |
|---|---|---|
| 稳定 | 对外承诺语义，变更需评审 | `ScanWorkerClient`、`ExportReport`、错误码、`ScanConfig` |
| 实验 | 随实现调整，但需保持单测通过 | 各语言提取器的内部 options |
| 内部 | 不对外暴露，允许重构 | `comments.ts` 的片段收集器、`workerFactory.ts` |

### 2.3.2 接口清单

#### 接口组 A：压缩包与文件夹读取

##### A-1 `openZipArchive`

| 项 | 内容 |
|---|---|
| 签名 | `openZipArchive(data: ArrayBuffer, options: ArchiveReadOptions): Promise<ArchiveReader>` |
| 业务说明 | 将用户选择的 zip 字节交给 jszip 解析中央目录，产出条目元数据与按需读取能力；不解压任何文件正文 |
| 前置条件 | `data.byteLength > 0` 且 `≤ maxArchiveBytes`；已通过扩展名校验；运行于 Worker 或主线程降级路径 |
| 后置条件 | 返回的 `entries` 已按路径字典序排序；每个条目已标记 `pathValidation`；未持有解压后的文件字节 |
| 异常映射 | 解析失败 → `CLS-E-1003`（`detail` 含条目序号）；加密条目 → `CLS-E-1004`；条目数超 50000 → `CLS-E-1005`；元数据总量超 500MB → `CLS-E-1005` |
| 调用要点 | 打开成功后必须先调用 `createBombGuard` 做元数据预检，再进入逐条读取 |
| 调用示例 | `const reader = await openZipArchive(buffer, { jobId, config });` |

##### A-2 `readEntry`

| 项 | 内容 |
|---|---|
| 签名 | `readEntry(entry: ArchiveEntryMeta): Promise<Uint8Array>` |
| 业务说明 | 按需解压单个条目，供文本解码与注释提取使用 |
| 前置条件 | `entry.pathValidation.legal === true`；`entry.uncompressedSize ≤ maxFileSizeBytes`；未触发炸弹中止 |
| 后置条件 | 返回字节；调用方在解码后必须立即丢弃引用（不进入长期缓存） |
| 异常映射 | 单条解压失败 → 登记 `parse-error` 跳过项并继续；整体结构损坏 → `CLS-E-1003` 中止 |
| 调用要点 | 串行 `await`，禁止 `Promise.all` 全量并发解压；每读完一条调用 `accountRead` 累计实际字节 |

##### A-3 `buildFolderReader`

| 项 | 内容 |
|---|---|
| 签名 | `buildFolderReader(files: readonly FolderInputFile[], options: ArchiveReadOptions): ArchiveReader` |
| 业务说明 | 把拖入目录的 `File[]` 转为与 zip 等价的读取器，复用后续筛选与扫描管线 |
| 前置条件 | 每个 `path` 为相对路径且已通过 `validateArchivePath`；`files.length` 已去重 |
| 后置条件 | `kind === 'folder'`；`totalUncompressedBytes` 为各 `File.size` 之和；`readEntry` 内部调用 `File.arrayBuffer()` |
| 异常映射 | 单个文件读取失败 → `CLS-E-1010` 非致命；目录 API 不可用 → `CLS-E-1009`（界面降级提示） |
| 调用要点 | 文件夹输入跳过解压阶段，进度从 `filtering` 开始 |

##### A-4 `createBombGuard` / `validateArchivePath`

| 项 | 内容 |
|---|---|
| 签名 | `createBombGuard(config, entryCount): BombGuard`；`validateArchivePath(raw): PathValidation` |
| 业务说明 | 炸弹防护与路径安全的唯一判定入口，所有条目在读取前必须经过 |
| 前置条件 | `config.maxTotalUnzipBytes = 524288000`、`config.maxFileSizeBytes = 2097152` 为硬编码 |
| 后置条件 | 累计字节只增；一旦判定中止，后续 `inspectMetadata/accountRead` 均返回 `abort` |
| 异常映射 | 总量超限 / 比例异常 → `CLS-E-1005`；非法路径 → 登记 `illegal-path`，不中止 |
| 调用要点 | 元数据阶段先预检（防止 200MB 全零条目被完整解压）；实际读取后再复核一次 |

#### 接口组 B：扫描范围判定

##### B-1 `classifyPath`

| 项 | 内容 |
|---|---|
| 签名 | `classifyPath(relPath: string, config: ScanConfig): FileClassification` |
| 业务说明 | 按"配置类 > 文档类 > 代码类 > 未知"的优先级判定文件类别与语言 |
| 前置条件 | `relPath` 已规范化（`/` 分隔、无 `..`、无前导 `/`） |
| 后置条件 | 返回 `{ kind, language, fullText, matchedRule }`；`kind === 'unknown'` 时 `language === null` |
| 异常映射 | 无异常；未知扩展名作为正常业务结果返回 |
| 调用要点 | `.env*` 优先于文档/代码；`src/README.js` 按文档类全量（CLS-FLT-004） |

##### B-2 `decideScan`

| 项 | 内容 |
|---|---|
| 签名 | `decideScan(entry: ArchiveEntryMeta, config: ScanConfig): ScanDecision` |
| 业务说明 | 综合类型、忽略组、体积、路径合法性，输出"扫描/跳过 + 跳过原因" |
| 前置条件 | `entry` 已完成路径校验与体积估算 |
| 后置条件 | `scanned + skipped` 决策互斥；跳过项含 `reason` 与 `detail` |
| 异常映射 | 无异常；`too-large` 与 `ignored-type` 同时命中时按固定优先级取第一个（体积 > 类型 > 目录） |
| 调用要点 | 忽略组关闭时仍受 2MB 硬上限约束（CLS-FLT-003、异常场景"开关全关"） |

#### 接口组 C：注释提取

##### C-1 `extractSnippets`

| 项 | 内容 |
|---|---|
| 签名 | `extractSnippets(input: ExtractInput): ExtractResult` |
| 业务说明 | 统一提取入口：解码后的文本 + 分类结果 → 带行号/来源/围栏标记的片段列表 |
| 前置条件 | `input.text` 已完成 UTF-8 解码与换行归一；`input.language` 非空 |
| 后置条件 | 片段按 `startLine` 升序；跨行片段保留 `\n`；每条片段长度 ≤ 8KB（超出置 `truncated`） |
| 异常映射 | 提取器抛出异常 → `CLS-E-2002` 转为 `parse-error` 跳过项，作业继续（CLS-NFR-008） |
| 调用要点 | 禁止对整文件直接套检测正则；规则匹配入口只接收片段（CLS-EXT-012） |

##### C-2 `resolveLanguage`

| 项 | 内容 |
|---|---|
| 签名 | `resolveLanguage(relPath, displayName): LanguageSpec \| null` |
| 业务说明 | 语言映射表的唯一查询入口，集中维护扩展名与特殊文件名 |
| 前置条件 | 文件名大小写不敏感匹配 |
| 后置条件 | 返回的 `LanguageSpec` 含 `id`、`extractors`、`commentStyles`、`fullText` |
| 异常映射 | 未命中返回 `null`，由 `decideScan` 登记 `unsupported-extension` |
| 调用要点 | 新增语言只需追加映射与提取器，不改编排（CLS-NFR-019） |

#### 接口组 D：检测与结果

##### D-1 `scanFile`

| 项 | 内容 |
|---|---|
| 签名 | `scanFile(input: FileScanInput, context: ScanContext): FileScanOutcome` |
| 业务说明 | 单个文件的完整处理：提取 → 逐片段匹配 → 生成种子命中（未去重） |
| 前置条件 | `input.text` 已完成解码；`context.rules` 已编译并通过启动校验 |
| 后置条件 | 返回 `{ snippets, matches, truncatedSnippetCount }`；不生成 `Finding`（去重在作业级完成） |
| 异常映射 | 规则匹配异常 → 跳过该规则并记录计数；超时 → `CLS-E-2002` 非致命 |
| 调用要点 | 单文件 ≤200ms（CLS-NFR-002）；超长片段先 `sliceByBytes` 再匹配 |

##### D-2 `dedupeMatches` / `finalizeFindings`

| 项 | 内容 |
|---|---|
| 签名 | `dedupeMatches(matches, context): FindingSeed[]`；`finalizeFindings(seeds, jobId): Finding[]` |
| 业务说明 | 作业级去重、稳定排序、编号、脱敏与上下文补齐 |
| 前置条件 | 所有文件的 `RawMatch[]` 已收集完毕；`dedupeMatches` 输入按 `filePath` 分组 |
| 后置条件 | 同一文件同一行的重叠区间只保留最高级别；`suppressedRuleIds` 记录被抑制规则；排序稳定可复现（CLS-NFR-010） |
| 异常映射 | 脱敏失败 → 全掩码兜底（CLS-RPT-005 异常场景），不抛错 |
| 调用要点 | 排序键固定为：级别降序 → 非围栏优先 → 路径升序 → 行号升序 → 规则 ID 升序 |

##### D-3 `buildSummary` / `buildSeverityCounts`

| 项 | 内容 |
|---|---|
| 签名 | `buildSummary(args): ScanSummary`；`buildSeverityCounts(findings): SeverityCounts` |
| 业务说明 | 生成统计摘要，保证 `scanned + skipped = total` 与各级别之和等于去重后总数 |
| 前置条件 | 去重完成，跳过清单已合并所有来源（目录、类型、体积、非法路径、解析失败） |
| 后置条件 | `durationMs ≥ 0`；`status ∈ completed/empty/cancelled/failed` |
| 异常映射 | 计数不一致 → 开发期断言失败（`CLS-E-2001`），生产环境记录计数并继续 |
| 调用要点 | 统计只依赖内存对象，不重新遍历文件 |

#### 接口组 E：脱敏与上下文

##### E-1 `maskValue`

| 项 | 内容 |
|---|---|
| 签名 | `maskValue(value: string, kind: MaskKind): string` |
| 业务说明 | 值级脱敏的唯一实现，按 `MaskKind` 分派到通用、URL、连接串、私钥、JWT、邮箱、手机号策略 |
| 前置条件 | `value` 非空；`kind` 由规则声明，不由 UI 猜测 |
| 后置条件 | 返回值不含完整原值；长度 ≤ 8 时全 `*`；> 8 时前 4 + 中段 `*` + 后 4 |
| 异常映射 | 结构解析失败 → 全掩码兜底 |
| 调用要点 | UI 与导出必须调用同一函数，禁止各自实现脱敏 |

##### E-2 `buildFindingContext`

| 项 | 内容 |
|---|---|
| 签名 | `buildFindingContext({ lines, hitLine, masker }): FindingContext` |
| 业务说明 | 取命中行的上下各 1 行，执行同一脱敏器并截断到 200 字符 |
| 前置条件 | `lines` 为归一化换行后的文件行数组；`hitLine` 为 1-based |
| 后置条件 | `before/after` 可为 `null`；单行超 200 字符以 `…` 结尾 |
| 异常映射 | 行号越界 → 返回 `null`，不抛错 |
| 调用要点 | 上下文只保存脱敏结果，不保存原始相邻行 |

#### 接口组 F：导出

##### F-1 `buildExportReport` / `toCsv`

| 项 | 内容 |
|---|---|
| 签名 | `buildExportReport(args): ExportReport`；`toCsv(findings): string` |
| 业务说明 | 生成可自解释的报告快照与 Excel 兼容 CSV |
| 前置条件 | 入参为 `scrubForExport` 后的 `ExportFinding[]`；`config` 为作业启动时的快照 |
| 后置条件 | JSON 无 `rawSnippet/fullValue/secret/unmasked` 字段；CSV 带 UTF-8 BOM、CRLF、公式注入防护 |
| 异常映射 | 下载失败 → `CLS-E-3001` 并提供手动下载链接 |
| 调用要点 | 导出前再次断言每个 `maskedSnippet` 不包含对应原值（开发期断言） |

#### 接口组 G：Worker 客户端

##### G-1 `ScanWorkerClient.start`

| 项 | 内容 |
|---|---|
| 签名 | `start(payload: StartPayload, handlers: ScanHandlers): string` |
| 业务说明 | 创建（或复用）Worker，发送 `job:start`，返回本次 `jobId` |
| 前置条件 | 当前无活动作业（CLS-NFR-011）；`payload` 中 zip 字节已转为 `ArrayBuffer` |
| 后置条件 | 返回的 `jobId` 与后续所有消息关联；`handlers` 在作业结束前有效 |
| 异常映射 | Worker 创建失败 → 降级主线程 `runJob`，并触发 `CLS-E-4001` 提示（CLS-UIX 异常场景） |
| 调用要点 | 传输 zip 时使用 Transferable 列表 `[buffer]`，主线程不再持有该 buffer |

##### G-2 `ScanWorkerClient.cancel`

| 项 | 内容 |
|---|---|
| 签名 | `cancel(jobId: string): void` |
| 业务说明 | 请求取消当前作业；先发消息，超时则终止并重建 Worker |
| 前置条件 | `jobId` 为当前活动作业 |
| 后置条件 | ≤1s 内回调 `onCancelled`；旧作业的后续消息按 `jobId` 丢弃；Worker 实例可用 |
| 异常映射 | Worker 已崩溃 → 直接清理并回调 `onCancelled` |
| 调用要点 | 取消后必须重置 `ResultStore` 与进度，防止旧批次污染新作业 |

#### 错误码映射（异常 → 用户文案 → 动作）

| 错误码 | 触发场景 | 是否中止作业 | 用户文案要点 | 建议动作 |
|---|---|---|---|---|
| `CLS-E-1001` | 非 `.zip` 且非文件夹 | 是（未开始） | "仅支持 .zip 压缩包，当前文件为 `<ext>`" | 压缩为 zip 后重试 |
| `CLS-E-1002` | 压缩包 > 100MB | 是 | "压缩包大小 X MB，超过 100 MB 上限" | 拆分压缩包 |
| `CLS-E-1003` | zip 解析失败 | 是 | "压缩包已损坏，无法读取第 N 个条目" | 重新打包 |
| `CLS-E-1004` | 加密条目 | 是 | "压缩包包含加密条目，无法在本地读取" | 先解压后重新打包 |
| `CLS-E-1005` | 炸弹 / 条目数超限 | 是 | "检测到异常压缩内容（解压总量或压缩比超限），已中止扫描" | 确认包来源 |
| `CLS-E-1006` | 非法路径条目 | 否（登记） | "存在可疑压缩包结构（非法路径条目）" | 检查压缩包 |
| `CLS-E-1007` | 无可扫描文件 | 是（空结果） | "压缩包内未找到可扫描的文本文件" | 查看跳过原因 |
| `CLS-E-1008` | Worker 崩溃 / 未捕获异常 | 是 | "扫描引擎异常终止（CLS-E-1008）" | 重试或刷新 |
| `CLS-E-1009` | 文件夹递归不可用 | 是 | "当前浏览器不支持读取文件夹" | 改用 zip |
| `CLS-E-1010` | 单条目读取失败 | 否（登记） | 跳过清单"读取失败" | 检查文件 |
| `CLS-E-2001` | 规则配置非法 | 开发期阻断 | "规则 `<id>` 配置异常，已跳过" | 修复规则数据 |
| `CLS-E-2002` | 提取/匹配超时 | 否（登记） | 跳过清单"解析失败/匹配超时" | 检查该文件 |
| `CLS-E-3001` | 下载被拦截 | 否 | "自动下载被拦截，请点击此处下载" | 手动下载 |
| `CLS-E-3002` | 剪贴板不可用 | 否 | "复制失败，请手动选择文本复制" | 手动复制 |
| `CLS-E-4001` | Worker 不可用 | 否（降级） | "当前浏览器不支持后台扫描，处理大文件可能卡顿" | 继续使用 |

## 2.4 数据模型

### 2.4.1 设计目标

1. **与领域术语一一对应**：`CommentSnippet`（注释片段）、`Finding`（命中）、`SkippedFile`（跳过文件）、`ScanConfig`（扫描配置）、`ScanSummary`（扫描摘要）与 `spec.md` 第 2 章术语完全同名，避免"数据库表名"式命名。
2. **跨线程可克隆**：所有跨 Worker 边界的对象只包含 `string / number / boolean / null / 数组 / 普通对象 / ArrayBuffer / File`；不使用 `Date`、`Map`、`Set`、类实例、函数。时间统一为 ISO 8601 字符串。
3. **不可变优先**：类型字段尽量 `readonly`；扫描过程中不原地修改对象，采用"构造新对象"的方式，便于比较与调试。
4. **默认不含原文**：`Finding` 类型中不存在 `rawSnippet/fullValue/secret/unmasked` 字段；完整片段由独立的 `RawSnippetStore` 在内存中按 `findingId` 关联，导出路径无法触及。
5. **空值语义明确**：体积未知用 `null`（不是 `-1`）；上下文缺失用 `null`（不是空字符串）；跳过原因必须是封闭枚举。
6. **可演进**：协议消息带 `protocol` 版本；导出报告带 `version`；规则带 `id` 与版本，新增字段不破坏旧解析。

**核心不变量（开发期断言 + 单测覆盖）**

| 编号 | 不变量 | 验证点 |
|---|---|---|
| INV-01 | `summary.scannedFiles + summary.skippedFiles === summary.totalFiles` | CLS-RPT-001、6.2 |
| INV-02 | `severityCounts` 四项之和 `=== findings.length` | CLS-RPT-001 |
| INV-03 | 每个 `Finding.ruleId` 必须存在于本次 `ruleCatalog` | CLS-EXP-001 |
| INV-04 | `Finding.line ≥ 1` 且等于 `snippet.startLine + 片段内行偏移` | CLS-EXT-011 |
| INV-05 | `maskedSnippet` 不包含 `rawSnippet` 的完整值 | CLS-RPT-004、CLS-EXP-004 |
| INV-06 | `filePath` 不以 `/` 开头、不含 `..`、使用 `/` 分隔 | CLS-NFR-015、6.3 |
| INV-07 | `scannedFiles` 中每个路径在 `skippedFiles` 中不重复出现 | CLS-FLT-007 |
| INV-08 | `sourceKind === 'fence-sample'` 时 `inCodeFence === true` | CLS-EXT-010 |

### 2.4.2 模型实现

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
skinparam classAttributeIconSize 0

class ScanConfig {
  ignoreGroups: IgnoreGroups
  scanPythonDocstring: boolean
  scanContactInfo: boolean
  maxFileSizeBytes: number
  maxTotalUnzipBytes: number
  maxArchiveBytes: number
  ruleSetVersion: string
  scannedAt: string
}

class IgnoreGroups {
  ignoreDirectories: boolean
  ignoreBuildOutput: boolean
  ignoreLockFiles: boolean
  ignoreBinaryTypes: boolean
  ignoreLargeFiles: boolean
  ignoreUnknownExtensions: boolean
}

class ArchiveEntryMeta {
  path: string
  compressedSize: number | null
  uncompressedSize: number | null
  encrypted: boolean
  pathValidation: PathValidation
}

class CommentSnippet {
  startLine: number
  endLine: number
  text: string
  sourceKind: SourceKind
  inCodeFence: boolean
  truncated: boolean
}

class Rule {
  id: string
  name: string
  severity: Severity
  pattern: string
  flags: string
  description: string
  suggestion: string
  maskKind: MaskKind
  entropy: EntropyConfig | null
}

class Finding {
  id: string
  ruleId: string
  severity: Severity
  filePath: string
  line: number
  maskedSnippet: string
  context: FindingContext
  sourceKind: SourceKind
  inCodeFence: boolean
  suppressedRuleIds: string[]
}

class SkippedFile {
  path: string
  reason: SkipReason
  sizeBytes: number | null
  detail: string
}

class ScanSummary {
  totalFiles: number
  scannedFiles: number
  skippedFiles: number
  riskFiles: number
  severityCounts: SeverityCounts
  durationMs: number
  status: ScanStatus
}

class ScanResult {
  jobId: string
  config: ScanConfig
  summary: ScanSummary
  findings: Finding[]
  skippedFiles: SkippedFile[]
  skipReasonCounts: SkipReasonCounts
}

ScanConfig *-- IgnoreGroups : 1
Finding --> Rule : ruleId
ScanResult *-- ScanSummary : 1
ScanResult *-- Finding : 0..*
ScanResult *-- SkippedFile : 0..*
CommentSnippet --> Finding : 派生
ArchiveEntryMeta --> CommentSnippet : 解码/提取
@enduml
```

**完整类型定义（`src/types.ts`）**

> 该文件是唯一的跨模块契约源。除类型外，仅允许放置 `LIMITS`、`PROTOCOL_VERSION`、`REPORT_VERSION` 三个不可变常量；不允许出现函数实现。

```ts
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
  | 'CLS-E-2001'
  | 'CLS-E-2002'
  | 'CLS-E-3001'
  | 'CLS-E-3002'
  | 'CLS-E-4001';

/* ============ 2. 硬性上限常量 ============ */

export const LIMITS = {
  maxArchiveBytes: 104_857_600,          // 100MB
  maxFileSizeBytes: 2_097_152,           // 2MB
  maxTotalUnzipBytes: 524_288_000,       // 500MB
  maxSnippetBytes: 8_192,                // 8KB
  maxEntries: 50_000,
  maxCompressionRatio: 100,
  maxCompressionRatioFloorBytes: 10_485_760, // 10MB
  maxContextLineChars: 200,
  maxRevealBytesPerFinding: 8_192,
  maxRevealTotalBytes: 16_777_216,       // 16MB
  resultsPageSize: 200,
  skippedPreviewCount: 100,
} as const;

export const PROTOCOL_VERSION = 1 as const;
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
  readonly scannedAt: string; // ISO 8601
}

export interface ConfigChangeNotice {
  readonly changed: boolean;
  readonly message: string; // "规则已变更，重新扫描后生效"
}

/* ============ 4. 归档与文件元数据 ============ */

export interface PathValidation {
  readonly legal: boolean;
  readonly normalized: string;
  readonly reason: IllegalPathReason | null;
}

export interface ArchiveEntryMeta {
  readonly path: string;                 // 规范化相对路径
  readonly displayName: string;          // 用于 UI 中间省略
  readonly isDirectory: boolean;
  readonly compressedSize: number | null;
  readonly uncompressedSize: number | null;
  readonly encrypted: boolean;
  readonly pathValidation: PathValidation;
  readonly readIndex: number;            // 原始条目序号，用于错误定位
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
  readonly startLine: number;   // 1-based
  readonly endLine: number;     // 1-based，含
  readonly text: string;        // 已归一化换行为 \n
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly truncated: boolean;
}

export interface ExtractOptions {
  readonly maxSnippetBytes: number;
  readonly startLine?: number;
}

export interface CFamilyOptions extends ExtractOptions {
  readonly enableRegexLiteral: boolean; // JS/TS 为 true，其他 C 系为 false
  readonly enableTemplateLiteral: boolean;
}

export interface HashFamilyOptions extends ExtractOptions {
  readonly ignoreShebang: boolean;
}

export interface MarkupOptions extends ExtractOptions {
  readonly extractEmbeddedScript: boolean;
  readonly extractEmbeddedStyle: boolean;
}

export interface PythonOptions extends ExtractOptions {
  readonly scanDocstring: boolean;
}

export interface MarkdownOptions extends ExtractOptions {
  readonly fenceChars: readonly string[]; // ['```', '~~~']
}

export interface ExtractInput {
  readonly relPath: string;
  readonly displayName: string;
  readonly text: string;
  readonly classification: FileClassification;
  readonly options: ExtractOptions;
  readonly scanPythonDocstring: boolean; // 由 ScanConfig 透传，仅 Python 提取器使用
}

export type ExtractDiagnosticCode =
  | 'unclosed-block-comment'
  | 'unclosed-string'
  | 'unclosed-fence'
  | 'snippet-truncated'
  | 'non-text';

export interface ExtractDiagnostic {
  readonly code: ExtractDiagnosticCode;
  readonly line: number | null;        // 1-based；无法定位时为 null
  readonly detail: string;             // 非敏感描述
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
  readonly threshold: number;      // 3.5
  readonly minLength: number;      // 16
  readonly maxLength: number;      // 128
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
  | 'private-key';

export interface Rule {
  readonly id: string;               // CLS-R-xxx
  readonly name: string;
  readonly severity: Severity;
  readonly pattern: string;
  readonly flags: string;            // 'g' | 'gi' | 'gm' ...
  readonly description: string;      // ≤80 字
  readonly suggestion: string;       // ≤120 字
  readonly maskKind: MaskKind;
  readonly captureGroup: number;     // 默认 0
  readonly validator: RuleValidator;
  readonly dedupeFamily: DedupeFamily;
  readonly specificity: number;      // 同族同级别时的优先级，越大越具体
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
  readonly line: number;               // 1-based
  readonly startIndex: number;         // 相对片段文本
  readonly endIndex: number;           // 不含
  readonly rawValue: string;           // 仅驻留 Worker 内存，不回传
  readonly matchedText: string;        // 完整匹配文本
  readonly sourceKind: SourceKind;
  readonly inCodeFence: boolean;
  readonly snippetIndex: number;       // 用于上下文定位
  readonly snippetTruncated: boolean;
}

export interface FindingContext {
  readonly before: string | null;      // 已脱敏、≤200 字符
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
}

export interface Finding {
  readonly id: string;                 // f-<序号>
  readonly ruleId: string;
  readonly ruleName: string;
  readonly severity: Severity;
  readonly filePath: string;
  readonly line: number;
  readonly maskedSnippet: string;      // 唯一允许展示/导出的片段
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
  set(findingId: string, raw: string): boolean; // 超出总量上限返回 false
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
  readonly detail: string;             // ≤200 字符
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
  readonly percent: number;            // 0–100，单调不减
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
  readonly diagnostics: readonly ScanDiagnostic[]; // 最多 200 条，防止消息过大
  readonly diagnosticTotal: number;
}

export interface WorkerFailure {
  readonly code: ClsErrorCode;
  readonly message: string;
  readonly hint: string;
  readonly fatal: boolean;
}

export interface FolderFilePayload {
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
  readonly file: File;                 // 结构化克隆，不转移
}

export interface StartPayloadZip {
  readonly source: 'zip';
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly data: ArrayBuffer;          // 以 Transferable 转移
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
  readonly failure: WorkerFailure;
}

export interface WorkerCancelledResponse {
  readonly protocol: typeof PROTOCOL_VERSION;
  readonly type: 'job:cancelled';
  readonly jobId: string;
}

export type WorkerResponse =
  | WorkerProgressResponse
  | WorkerFindingsResponse
  | WorkerSkippedResponse
  | WorkerDoneResponse
  | WorkerErrorResponse
  | WorkerCancelledResponse;

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
  readonly raw: string;                // 仅在确认后由 RawSnippetStore 取出
}
```

**类型使用约定**

1. **字段与导出映射**：`Finding` → `ExportFinding` 通过 `scrubForExport` 白名单式拷贝，禁止展开运算符整体复制（防止未来新增内部字段被误导出）。
2. **跳过原因封闭**：`SkipReasonCounts` 使用 `Record<SkipReason, number>`，新增原因时 TypeScript 强制补全统计逻辑。
3. **数组而非 Set**：`FilterState.severities` 使用只读数组，保证可序列化与可复原；UI 内部可临时构造 `Set` 做 O(1) 判断，但不进入状态树。
4. **File 的边界**：`File` 只出现在 `FolderFilePayload` 中，且只在 `job:start` 消息里出现；扫描过程中产生的任何对象都不持有 `File`。
5. **raw 的边界**：`RawSnippetStore` 是唯一允许保存完整值的类型；它不实现 `Serializable` 约定，不传入 Worker，不进入 `ExportReport`。

### 2.4.3 数据生命周期

| 阶段 | 创建的数据 | 释放时机 | 说明 |
|---|---|---|---|
| 上传校验 | `File` / `ArrayBuffer` | 转入 Worker 后主线程立即丢弃 buffer | Transferable 转移后原 buffer 不可再读 |
| 解压 | `ArchiveEntryMeta[]`、当前条目 `Uint8Array` | 条目解码完成后丢弃字节；`ArchiveReader` 在作业结束/取消时 `dispose()` | 不保留任何解压后文件集合 |
| 提取 | `CommentSnippet[]`（单文件） | 单文件匹配完成后丢弃 | 片段仅在 Worker 内存在，不回传 |
| 匹配 | `RawMatch[]`（单文件） | 去重后仅保留种子字段 | `rawValue` 用于脱敏与 raw 存储，不进入消息 |
| 结果 | `Finding[]`、`SkippedFile[]` | 新作业开始时清空 | 仅主线程持有 |
| 二次确认 | `RawSnippetStore` 条目 | 用户收起、重新上传、刷新页面 | 总量上限 16MB；超出时禁用展开并提示 |
| 导出 | `ExportReport` / CSV 字符串 | 下载触发后由浏览器回收 | 不含 raw；`URL.revokeObjectURL` 及时释放 |

## 2.5 关键算法设计

### 2.5.1 注释提取状态机

#### 通用执行模型

1. **单遍字符扫描**：每个文件只遍历一次字符流，O(n) 时间复杂度；不使用全文正则替代词法（CLS-EXT-012）。
2. **输入预处理**：`decodeUtf8` 解码 → 去除 BOM → `normalizeNewlines`（`\r\n`/`\r` → `\n`）→ 建立行起始偏移表 `lineStarts`。归一化不改变字符数之外的语义，行号仍按归一化后的 `\n` 计。
3. **状态与产物分离**：状态机只负责"当前是否在注释/字符串/正则中"，产物由 `SnippetBuilder` 收集；两者解耦便于单测。
4. **行号计算**：维护 `line`（1-based）与 `lineStartOffset`；每消费一个 `\n` 递增。片段 `startLine` 在进入注释状态时记录，`endLine` 在退出时记录。块注释文本保留内部 `\n`，命中行 = `snippet.startLine + 片段内换行序号`。
5. **片段文本规范**：去除注释定界符（`//`、`/*`、`*/`、`#`、`--`、`<!--`、`-->` 等），保留定界符之后的原始内容与缩进；不裁剪行尾空白以外的内容。这样规则匹配只看到"语义正文"，同时不改变行号。
6. **片段合并**：同一段连续的行注释合并为一条片段（`text` 用 `\n` 连接，`startLine` 为首行）；块注释、docstring、围栏块各自独立。合并可减少规则遍历次数，并让上下文可取片段内相邻行。
7. **截断**：片段超过 8KB 时按 UTF-8 字节边界截断（不切断多字节字符），`truncated = true`，并产生 `snippet-truncated` 诊断；截断只影响匹配范围，不影响行号。
8. **异常隔离**：提取器抛出异常时，`extractSnippets` 捕获并转为 `parse-error` 跳过项，单文件失败不终止作业（CLS-NFR-008）。

#### 状态集合

| 状态 | 含义 | 是否产出注释 | 典型语言 |
|---|---|---|---|
| `CODE` | 普通代码/文本 | 否 | 全部 |
| `LINE_COMMENT` | 行注释，至行尾 | 是 | C 系、井号系、SQL、Lua、Python |
| `BLOCK_COMMENT` | 块注释 | 是 | C 系、SQL、Lua、HTML |
| `SINGLE_QUOTE` / `DOUBLE_QUOTE` | 单/双引号字符串 | 否 | 全部含字符串语言 |
| `TEMPLATE` | 模板字符串（可跨行） | 否 | JS/TS |
| `TEMPLATE_EXPR` | 模板 `${}` 表达式区（仅做括号配对） | 否（简化） | JS/TS |
| `REGEX` / `REGEX_CLASS` | 正则字面量 / 字符类 | 否 | JS/TS（简化） |
| `TRIPLE_QUOTE` | Python 三引号块 | 视开关 | Python |
| `LONG_STRING` | Lua `[[...]]` 长字符串 | 否 | Lua |
| `HTML_COMMENT` | `<!-- ... -->` | 是 | HTML/XML/Vue/Svelte |
| `EMBEDDED_SCRIPT` / `EMBEDDED_STYLE` | 内嵌 JS/CSS 区域 | 交由子提取器 | Vue/Svelte/HTML |
| `FENCE` | Markdown 围栏内 | 是（文档全文） | Markdown |

#### C 系状态转移（核心）

适用范围：`js jsx ts tsx mjs cjs vue svelte java kt scala groovy go rs c h cc cpp hpp cs php swift m mm css scss less sass`。

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"

[*] --> CODE
CODE --> LINE_COMMENT : 遇到双斜杠
CODE --> BLOCK_COMMENT : 遇到斜杠星号
CODE --> SINGLE_QUOTE : 遇到单引号
CODE --> DOUBLE_QUOTE : 遇到双引号
CODE --> TEMPLATE : 遇到反引号（仅 JS/TS）
CODE --> REGEX : 斜杠且前序 token 允许（仅 JS/TS）
LINE_COMMENT --> CODE : 遇到换行或 EOF
BLOCK_COMMENT --> BLOCK_COMMENT : 任意字符（含换行）
BLOCK_COMMENT --> CODE : 遇到星号斜杠
SINGLE_QUOTE --> CODE : 遇到未转义单引号
DOUBLE_QUOTE --> CODE : 遇到未转义双引号
TEMPLATE --> CODE : 遇到未转义反引号
TEMPLATE --> TEMPLATE_EXPR : 遇到美元花括号
TEMPLATE_EXPR --> TEMPLATE : 花括号配对完成
REGEX --> REGEX_CLASS : 遇到左方括号
REGEX_CLASS --> REGEX : 遇到右方括号
REGEX --> CODE : 遇到未转义斜杠 + 标志位
@enduml
```

**判定优先级（关键）**：在 `CODE` 状态下遇到 `/` 时，严格按以下顺序判定，顺序错误会直接导致 ACC-02 失败：

| 顺序 | 条件 | 动作 |
|---|---|---|
| 1 | 下一个字符是 `/` | 进入 `LINE_COMMENT` |
| 2 | 下一个字符是 `*` | 进入 `BLOCK_COMMENT` |
| 3 | 语言为 JS/TS 且"正则起始启发式"成立 | 进入 `REGEX` |
| 4 | 其他 | 视为除法运算符，消费一个字符，保持 `CODE` |

**正则起始启发式（简化，允许误判）**：

- 取"前一个有效 token"（跳过空白、行注释、块注释后的最后一个 token）。
- 若前 token 为空（行首）或属于以下集合，则 `/` 可能是正则起始：
  `(` `,` `=` `:` `[` `!` `&` `|` `?` `{` `}` `;` `=>` `return` `typeof` `instanceof` `in` `of` `new` `delete` `void` `throw` `case` `do` `else` `yield` `await`
- 若前 token 是标识符、数字、`)`、`]`、`}`（非上述上下文），则 `/` 视为除法。
- `REGEX_CLASS` 内的 `/` 不结束正则；`\` 转义下一个字符；遇到未转义换行视为正则未闭合，回退为除法处理（保守，避免吞掉后续代码）。
- **已知歧义**：`a = b / c / d` 中第二个 `/` 可能被误判为正则起始；`x = {} / 2` 等。该限制写入 README"已知限制"，不作为验收阻塞（CLS-EXT-004）。

**字符串与转义规则**

| 场景 | 处理 |
|---|---|
| `\` 后跟任意字符 | 被转义，跳过下一个字符；若转义字符是 `\n`，行号递增 |
| 单/双引号内遇到未转义换行（C 系） | 视为字符串未闭合：产出 `unclosed-string` 诊断，回到 `CODE` 并继续下一行（保守策略，避免整文件被吞） |
| 模板字符串内换行 | 合法，行号递增，继续 `TEMPLATE` |
| 模板 `${` | 进入 `TEMPLATE_EXPR`，记录花括号深度；深度归零回到 `TEMPLATE`；`${}` 内**不提取注释**（见限制） |
| 正则 `\/` | 转义，不结束 |
| 正则字符类 `[/]` | `/` 不结束 |

**块注释**

- 默认不嵌套（C/Java/Go/PHP/CSS 等标准行为）；`.rs`（Rust）与 `.swift` 启用嵌套深度计数，深度归零才结束。
- 未闭合 `/*`：从起始位置到 EOF 记为一条片段，`endLine = 最后一行`，产生 `unclosed-block-comment` 诊断。
- 跨行块注释的 `text` 保留 `\n`；行尾 `*/` 同行结束后，后续代码继续扫描。

#### 井号系

适用范围：`py rb sh bash zsh fish ps1 yaml yml toml ini conf cfg properties r pl`、`Makefile*`、`Dockerfile*`、`.env*`（`.env*` 不进入提取器，走全量配置路径）。

- 逐行扫描，维护 `SINGLE_QUOTE` / `DOUBLE_QUOTE` 两个单行字符串状态；字符串内 `#` 不视为注释。
- `#` 在 `CODE` 状态 → 该行剩余部分为一条行注释；连续的纯注释行合并。
- **shebang 排除**：仅当 `line === 1` 且文本以 `#!` 开头时整行丢弃，不产出片段（CLS-EXT-005）。
- **Makefile**：`#` 行注释；`$(...)` 内 `#` 可能被误判为注释，作为已知限制记录。
- **Dockerfile**：仅识别行首（允许前导空白）的 `#`；行内 `#` 不作为注释（Dockerfile 语法约定）。
- **PowerShell**：需求仅要求 `#`；`<# #>` 块注释列为 P1 可选，不纳入本期验收。
- **YAML/TOML 多行块**（`|`、`>`、`"""`）：不做完整块标量解析；字符串状态可覆盖常见引号场景，未覆盖部分写入已知限制。

#### SQL

适用范围：`.sql`。

- `--` 至行尾为行注释（无论前面是否有空白，符合常见 SQL 方言）。
- `/* ... */` 为块注释，默认不嵌套。
- 字符串 `'...'` 与 `"..."`：`''` / `""` 为转义引号；字符串内 `--`、`/*` 不识别。
- 反引号标识符（MySQL）按字符串处理，防止标识符中的 `--` 误判。
- `INSERT INTO t VALUES ('a--b');` → 不产出片段（ACC 场景）。

#### HTML / XML / Vue / Svelte

- `<!-- ... -->` 为块注释，`text` 不含定界符；未闭合到 EOF 记一条并产生诊断。
- 转义后的 `&lt;!--` 不匹配字面 `<!--`，不会误判。
- Vue/Svelte：识别顶层 `<script ...>` 与 `</script>`（大小写不敏感），把内部文本交给 C 系提取器；识别 `<style ...>` 与 `</style>`，内部交给 CSS 块注释提取（`/* */`）。行号偏移 = 内部起始行 - 1。
- `<template>` 区域按普通 HTML 注释处理。
- 同一文件会产出多组片段（HTML 注释 + 脚本注释 + 样式注释），`sourceKind` 分别为 `block-comment` / `line-comment` / `block-comment`，不合并。

#### Lua

- `--` 至行尾为行注释。
- `--[[ ... ]]` 为块注释；支持 `--[==[ ... ]==]` 等等号变体（P1，实现成本低则纳入）。
- 字符串 `'...'`、`"..."`；长字符串 `[[...]]` 视为字符串，不提取其内部 `--`。
- 块注释未闭合到 EOF 产生诊断。

#### Batch（`.bat` / `.cmd`）

> **范围补充**：CLS-FLT-005 的扩展名列表未列出 `.bat/.cmd`，但 CLS-EXT-008 要求提取 Batch 注释。本设计将 `.bat/.cmd` 纳入代码类白名单（仅注释扫描）；README 的扫描范围表必须同步注明，否则该需求无法触发。

- 逐行、去除前导空白后判定：
  - `REM`（大小写不敏感）且后接空白或行尾 → 注释；
  - `::` → 注释；
  - `@REM` → 注释（`@` 后允许空白）。
- `echo REM`、`echo ::` 不匹配（因为不在行首）。
- 注释内容为 `REM`/`::` 之后的整行文本。

#### Python

- `#` 行注释：字符串状态外的 `#` 至行尾；连续行合并。
- docstring：识别可带前缀（`r`、`b`、`u`、`f` 及其组合）的 `"""` 与 `'''` 块，跨行保留 `\n`，`sourceKind = 'docstring'`，`startLine` 为起始三引号所在行。
- 开关 `scanPythonDocstring = false` 时：三引号仍进入字符串状态（避免内部 `#` 被误判），但不产出片段。
- 单/双引号字符串按行处理；`\` 转义；三引号内 `\` 转义。
- 未闭合三引号 → 到 EOF 为一条片段 + `unclosed-string` 诊断。
- **限制**：Python 无法在不做 AST 的情况下区分"docstring"与"普通多行字符串"，本设计将所有三引号块按 docstring 处理，可能产生误报，README 明示并提供开关。

#### 纯文本与文档类

- `.txt/.rst/.adoc`：全文作为一个文档片段（按行合并为单条或按 200 行分块），`sourceKind = 'document'`，`inCodeFence = false`。
- `.md/.markdown/.mdx`：见 2.5.5 围栏追踪。
- `.env*`：不走提取器，直接全文作为一个 `sourceKind = 'config'` 的片段，行号逐行保留（见 2.5.6 的配置扫描路径）。

#### 行号与片段映射（可验证）

| 规则 | 公式/说明 |
|---|---|
| 行注释命中 | `finding.line = snippet.startLine + 片段内行序号` |
| 块注释命中 | 同上；`text` 中每个 `\n` 对应源文件下一行 |
| 跨行合并行注释 | 合并时只合并"相邻且中间无代码行"的注释行，行号连续 |
| 子提取器（Vue script/style） | `finding.line = 内部行号 + scriptStartLine - 1` |
| Markdown 围栏 | 逐行映射，`inCodeFence` 由围栏状态决定 |
| 截断片段 | 行号仍按原文计算，截断只影响匹配区间 |

#### 已知限制清单（必须写入 README）

| 编号 | 限制 | 影响 | 缓解 |
|---|---|---|---|
| LIM-01 | JS 正则字面量启发式可能把除法误判为正则 | 可能漏检该行后续注释 | README 明示；ACC-02 覆盖典型场景 |
| LIM-02 | 模板字符串 `${}` 内的注释不提取 | 可能漏检嵌套注释 | README 明示；常见密钥不写在模板表达式内 |
| LIM-03 | 未闭合字符串按保守策略回退 | 可能漏检后续 `//` | 记录 `unclosed-string` 诊断 |
| LIM-04 | 不做 AST/docstring 语义判定 | Python 三引号全按 docstring | 提供开关；README 明示 |
| LIM-05 | YAML 块标量、Makefile 变量内的 `#` | 可能误判 | README 明示 |
| LIM-06 | 嵌套块注释仅 Rust/Swift 支持 | 其他语言按首次 `*/` 结束 | README 明示 |
| LIM-07 | Markdown 围栏未闭合 | 后续内容全部标记为围栏内 | 产生 `unclosed-fence` 诊断并在报告提示 |

### 2.5.2 规则引擎匹配与去重

#### 规则集（21 条，含默认关闭 2 条）

| 规则 ID | 名称 | 级别 | 模式要点（非完整正则） | flags | 捕获组 | 守卫 | 脱敏类型 |
|---|---|---|---|---|---|---|---|
| `CLS-R-001` | AWS Access Key | critical | `AKIA` + 16 位大写字母/数字 | g | 0 | — | generic |
| `CLS-R-002` | AWS Secret Access Key | critical | 关键词（aws_secret_access_key 等）+ `:`/`=` + 40 位 base64 | gi | 2 | P | generic |
| `CLS-R-003` | Google API Key | critical | `AIza` + 35 位字母数字/`_`/`-` | g | 0 | — | generic |
| `CLS-R-004` | GitHub Token | critical | `ghp_/gho_/ghs_/ghu_/ghr_` + 36 位字母数字 | g | 0 | — | generic |
| `CLS-R-005` | Slack Token | critical | `xox[baprs]-` + 至少 10 位 | g | 0 | — | generic |
| `CLS-R-006` | OpenAI API Key | critical | `sk-` + 20 位以上字母数字 | g | 0 | P | generic |
| `CLS-R-007` | Stripe Key | critical | `sk_live_`/`pk_live_` + 至少 16 位 | g | 0 | — | generic |
| `CLS-R-008` | SendGrid Key | critical | `SG.` + 22 位 + `.` + 43 位 | g | 0 | — | generic |
| `CLS-R-009` | 私钥文件头 | critical | `BEGIN (RSA/EC/DSA/OPENSSH/PGP) PRIVATE KEY` | g | 0 | V | private-key |
| `CLS-R-010` | 证书内容 | critical | `BEGIN CERTIFICATE` | g | 0 | V | private-key |
| `CLS-R-011` | 通用密钥赋值 | high | 中英文关键词 + `:`/`=`/`：` + 值（≥6；已知弱口令 ≥4） | gi | 2 | P + V | generic |
| `CLS-R-012` | 数据库连接串 | critical | `mysql/postgres/mongodb/redis/amqp/mssql` + `://user:pass@host` | gi | 0 | S | connection-string |
| `CLS-R-013` | 带凭证 URL | critical | `http(s)://user:pass@host` | gi | 0 | S | url-credentials |
| `CLS-R-014` | JWT | high | `eyJ…` + `.eyJ…` + `.签名段` | g | 0 | V | jwt |
| `CLS-R-015` | 内网 IP | high | 10/172.16–31/192.168 网段 | g | 0 | V | generic |
| `CLS-R-016` | 内网域名 | medium | `.local/.internal/.corp/.lan/.intra/.intranet/.svc.cluster.local` | gi | 0 | — | generic |
| `CLS-R-017` | localhost 地址 | low | `localhost:<端口>` | gi | 0 | — | generic |
| `CLS-R-018` | 测试/默认凭证 | low | test/admin/root/demo/guest/user + `:`/`=`/`/` + 弱值 | gi | 0 | — | generic |
| `CLS-R-019` | 高熵密钥串 | medium | 密钥关键词 + 16–128 位 base64/hex 值 | gi | 1 | P + E | generic |
| `CLS-R-020` | 邮箱（默认关闭） | low | `xxx@xxx.xx` | g | 0 | — | email |
| `CLS-R-021` | 手机号（默认关闭） | medium | `1[3-9]\d{9}`（中国大陆） | g | 0 | — | phone |

> **守卫图例**：P = 占位符排除；S = 示例主机排除（`example.com`、`your-domain.com` 等）；E = 高熵配置；V = 结构校验器。

**规则启用策略**：`enabledByDefault = true` 的规则在作业中始终启用；`CLS-R-020` / `CLS-R-021` 的 `enabledByDefault = false`，仅当 `ScanConfig.scanContactInfo = true` 时由 `getEnabledRules` 启用。本期不提供逐条关闭关键规则的 UI，避免用户误关后产生"安全"的错觉；仅提供 docstring 与联系方式两个明确开关。

**去重族与优先级**（解决"何时合并、何时共存"的判定）：

| 规则 | `dedupeFamily` | `specificity` | 说明 |
|---|---|---|---|
| R-001 ~ R-010 | `secret-value` | 100 | 云密钥、私钥、证书：最具体，优先保留 |
| R-014 JWT | `secret-value` | 80 | 与通用密钥同族，但比通用规则具体 |
| R-011 通用密钥 | `secret-value` | 10 | 同族内优先级最低，避免淹没具体规则 |
| R-019 高熵 | `secret-value` | 5 | 兜底规则，优先级最低 |
| R-012 / R-013 | `connection` | 90 | 连接串/URL 自成一族，不与 IP 互相抑制 |
| R-015 内网 IP | `network-location` | 60 | 与连接串**不同族**，可同时报告（ACC-03） |
| R-016 内网域名 | `network-location` | 50 | 同上 |
| R-017 localhost | `network-location` | 40 | 同上 |
| R-018 测试凭证 | `default-credential` | 50 | 独立族，不与通用密钥合并 |
| R-020 / R-021 | `contact` | 30 | 独立族 |

**相对 spec 的三处必要调整（已在设计中固化，需在 README 规则表说明）**

1. **CLS-R-011 关键词扩展中文**：spec 的关键词表只有英文，但验收 ACC-04 要求 `数据库密码: Admin@123` 命中。因此关键词集合扩展为 `password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|secret[_-]?key|private[_-]?key|auth|密码|口令|密钥|令牌|凭证`，并支持中文冒号 `：`。
2. **CLS-R-011 弱口令长度例外**：CLS-RUL-004 规定值长度 ≥6，但其验收标准要求 `PASSWORD: root`（4 字符）命中。采用"验收优先"：普通值仍要求 ≥6；若值属于已知弱口令集合（`root/admin/test/guest/demo/123456/password/passwd`），允许 ≥4。该规则由 `password-like` 校验器实现，不改变通用规则的语义。
3. **邮箱/手机号拆分为 R-020 / R-021**：两者级别不同（low / medium），单一 `Rule` 无法表达两个级别；拆分为两条默认关闭规则，README 规则表相应展示为 21 条。spec 中的 `CLS-R-020` 在本设计中对应"邮箱"，手机号为 `CLS-R-021`。

**其他规则细节**

- `CLS-R-002`：仅当关键词与 40 位值在同一片段中且距离 ≤ 3 个换行/80 字符时命中，避免把无关 base64 串误报为 AWS Secret。
- `CLS-R-006`：`sk-` 规则须排除 `sk_live_`（Stripe）与 `sk-proj-` 之外的误报；OpenAI 新前缀 `sk-proj-` 纳入匹配。
- `CLS-R-009/010`：只匹配 BEGIN 行；完整 PEM 正文不会产生多条命中（正则只命中头部一次）。
- `CLS-R-012`：必须同时存在账号与密码（`user:pass@`），`postgres://user@host/db` 不命中连接串规则。
- `CLS-R-013`：仅 `http/https`；`ftp://user:pass@` 不在本期范围。
- `CLS-R-014`：结构校验器要求恰好三个以 `.` 分隔的段，且前两段以 `eyJ` 开头；普通 base64 不命中。
- `CLS-R-015`：结构校验器逐段验证 0–255；排除 `127.0.0.1`、`0.0.0.0`、`192.0.2.*`、`198.51.100.*`、`203.0.113.*`。
- `CLS-R-016`：后缀匹配 `.local` 等；`example.local?` 仍命中，README 说明可能误报。
- `CLS-R-018`：分隔符包含 `/`，以覆盖 `test/test`；`username: john` 不命中（值不在弱值集合）。
- `CLS-R-019`：与 `CLS-R-011` 的边界由 `password-like` 校验器协调——高熵 base64/hex 值跳过通用 high 规则，交给熵规则报 medium；AWS Secret 的 40 位值由 `CLS-R-002` 以 critical 命中并去重胜出。

#### 规则编译与启动校验

| 校验项 | 规则 | 失败处理 |
|---|---|---|
| ID 唯一 | `id` 在数组中唯一 | 开发期 `CLS-E-2001` 阻断；生产环境跳过重复项并记录计数 |
| ID 格式 | 匹配 `^CLS-R-\d{3}$` | 同上 |
| 正则可编译 | `new RegExp(pattern, flags)` | 同上 |
| 必填文案 | `name/description/suggestion` 非空且不超长 | 同上 |
| 级别合法 | 四级枚举 | 同上 |
| 捕获组存在 | `captureGroup <= regex 捕获组数量` | 同上 |
| 标志位 | 必须含 `g`（否则 `exec` 死循环） | 自动补 `g` 并记录开发期警告 |
| 熵配置 | 阈值/长度/charset 合法 | 同上 |

编译结果按 `id` 缓存为 `CompiledRule`；每个作业只编译一次。**禁止**在匹配循环内 `new RegExp`。

#### 匹配流水线

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"

start
:取一条 CommentSnippet（已截断至 8KB）;
:读取启用规则（按 severity 优先级排序）;
while (还有未匹配规则?) is (是)
  :regex.lastIndex = 0;
  while (还有 exec 结果?) is (是)
    if (匹配区间为零宽?) then (是)
      :lastIndex 前移 1，跳过;
    else (否)
      :取 captureGroup 对应值;
      if (占位符守卫命中?) then (是)
        :抑制计数 +1，不生成命中;
      else (否)
        if (示例主机守卫命中?) then (是)
          :抑制计数 +1，不生成命中;
        else (否)
          if (校验器通过?) then (是)
            :生成 RawMatch\n（line = 片段行 + 片段内换行偏移）;
          else (否)
            :不生成命中;
          endif
        endif
      endif
    endif
  endwhile
endwhile
:作业级去重;
:稳定排序与编号;
stop
@enduml
```

**匹配执行约束**

1. 每个片段对每条规则执行一次全局 `exec` 循环；`lastIndex` 必须重置，零宽匹配必须前移，防止死循环。
2. 规则按 `severity` 从高到低排序执行，便于去重时"先到先得"的确定性；最终仍以显式级别比较为准，不依赖顺序。
3. `RawMatch.rawValue` 取捕获组值（无捕获组时取完整匹配）；`matchedText` 始终为完整匹配，用于结构脱敏。
4. `line` 计算：`snippet.startLine + snippet.text.slice(0, match.index).split('\n').length - 1`；同一片段内多行块注释可精确定位。
5. 单文件匹配耗时用 `performance.now()` 记录；超过 200ms 记入诊断但不中止（同步正则无法抢占，主要依靠 8KB 截断抑制回溯）。
6. 规则匹配入口**只接收片段**，`scanner.ts` 不暴露"直接传入整文件文本"的路径（CLS-EXT-012 的代码审计点）。

#### 占位符与示例值抑制

**占位符判定**（对捕获值归一化：去首尾引号/反引号、去空白、转小写）：

| 类别 | 模式（语义） | 示例 |
|---|---|---|
| 重复字符 | 连续 `x/*/./_` ≥3 | `xxx`、`***`、`...` |
| 修改提示 | `changeme`、`change_me`、`replace_me` | `changeme` |
| 你的值 | `your_*`、`your-*`、`your*` | `your_api_key_here` |
| 示例 | `example*`、`sample*`、`dummy*`、`fake*`、`mock*` | `example_password` |
| 占位 | `placeholder`、`todo`、`fixme` | `placeholder` |
| 模板 | `<...>`、`{{...}}`、`${...}`、`%VAR%`、`$VAR` | `${TOKEN}`、`<your-secret>` |
| 空值 | `null`、`none`、`undefined`、`nil` | `null` |

**示例主机判定**（用于 R-012/R-013）：`example.com/org/net`、`*.example.*`、`your-domain.com`、`yourdomain.com`、`localhost`、`127.0.0.1`、`0.0.0.0`。命中时**不产生 critical**；若同时命中内网 IP/域名规则，则由对应规则以较低级别报告（符合 CLS-RUL-016）。

#### 去重算法（同族重叠合并，跨族共存）

**两个必须同时满足的验收约束**：

1. `// password = "AKIAABCDEFGHIJKLMNOP"`：R-011（覆盖 `password = "AKIA..."`）与 R-001（覆盖 `AKIA...`）区间重叠，但只应保留 1 条 critical（ACC-01）。
2. `mysql://root:Passw0rd@10.1.2.3:3306/db`：R-012 覆盖整串，R-015 覆盖其中的 `10.1.2.3`，区间重叠，但 ACC-03 要求 critical（连接串）与 high（内网 IP）**同时保留**。

**解决方式**：去重按 `filePath + '#' + line + '#' + dedupeFamily` 分组，**只有同一去重族内的重叠命中才互相抑制**；跨族命中即使区间重叠也各自保留。

**算法步骤**：

1. 以 `filePath + '#' + line + '#' + dedupeFamily` 为分组键，把 `RawMatch[]` 分组。
2. 组内按 `startIndex` 升序、`severity` 降序、`specificity` 降序、`ruleId` 升序排序（保证确定性）。
3. 组内顺序扫描，维护当前"合并簇"的 `[clusterStart, clusterEnd)`：
   - 若下一条的 `startIndex < clusterEnd`（存在重叠，含包含关系），并入当前簇；
   - 否则开启新簇。
4. 每个簇内选"胜出命中"：级别最高者胜；同级别按 `specificity` 大者胜；仍相同按规则 ID 字典序小者胜。
5. 胜出者保留，其余 `ruleId` 去重后写入 `suppressedRuleIds`；被抑制命中的 `rawValue` 丢弃。
6. 跨族命中不参与彼此的簇计算，直接保留；同一行两个同族但不重叠的密钥值 → 两条命中（CLS-RUL-015）。

**示例**

| 输入行 | 命中、区间与族 | 去重结果 |
|---|---|---|
| `password = "AKIAABCDEFGHIJKLMNOP"` | R-011 high `[0,30)`、secret-value；R-001 critical `[12,32)`、secret-value | 1 条 R-001 critical；`suppressedRuleIds=["CLS-R-011"]` |
| `mysql://root:Passw0rd@10.1.2.3:3306/db` | R-012 critical `[0,45)`、connection；R-015 high `[26,34)`、network-location | **2 条**：critical + high（ACC-03） |
| `// 10.20.30.40:8080` | R-015 high、network-location；R-017 不命中 | 1 条 high |
| `password = "Qm9vR2V0..."`（40 位 base64） | R-011 被 `password-like` 跳过；R-019 medium、secret-value | 1 条 R-019 medium |
| 同一行 `token=a` 与 `token=b` | 两个不重叠的 secret-value 区间 | 2 条 |
| `// eyJ...` 同时命中 R-011 与 R-014 | 同族 secret-value；R-014 specificity 80 > R-011 10 | 1 条 R-014 high |

#### 排序、编号与确定性

| 排序键 | 方向 | 说明 |
|---|---|---|
| `severity` | critical → high → medium → low | 固定 rank 映射 |
| `inCodeFence` | `false` 在前 | "疑似示例"靠后（CLS-EXT-010） |
| `filePath` | 码点升序（`comparePathAsc`） | 不用 `localeCompare`，避免区域设置影响确定性 |
| `line` | 升序 | 同行再按规则 ID |
| `ruleId` | 升序 | 最终稳定键 |

编号 `f-1`、`f-2`……在排序完成后统一分配，保证相同输入与配置重复扫描得到相同编号（CLS-NFR-010）。

### 2.5.3 脱敏算法

#### 设计原则

1. **单一实现**：`redact.ts` 是唯一的脱敏入口；UI 与导出不得自行拼接掩码。
2. **默认不可见**：所有展示与导出路径只接受 `maskedSnippet`；完整值只存在于 Worker 内存与主线程 `RawSnippetStore`。
3. **结构优先**：连接串、URL、私钥必须按结构脱敏，不能用"首尾保留"破坏可读性。
4. **失败即全掩码**：任何解析异常一律退化为等长/固定长度全 `*`，绝不回退到原文。

#### 值级脱敏规则

| `MaskKind` | 输入形态 | 输出规则 | 示例 |
|---|---|---|---|
| `generic` | 普通密钥/Token/IP/域名 | 长度 1–8：等长 `*`；9–40：前 4 + `*`×(len−8) + 后 4；>40：前 4 + 16 个 `*` + `…` + 后 4 | `Abc123` → `******`；`AKIAABCDEFGHIJKLMNOP` → `AKIA************MNOP` |
| `connection-string` | `scheme://user:pass@host:port/path` | 保留 scheme、host、port、path；账号与密码整体替换为 `***`；query 参数只保留键、值掩码 | `mysql://root:Passw0rd@10.1.2.3:3306/db` → `mysql://***:***@10.1.2.3:3306/db` |
| `url-credentials` | `http(s)://user:pass@host/path` | 保留协议、host、path；账号密码替换为 `***` | `http://admin:secret@192.168.1.10/admin` → `http://***:***@192.168.1.10/admin` |
| `private-key` | PEM/证书块 | 只输出 `-----BEGIN …-----` 行；正文与 END 行全部丢弃 | 只显示 `-----BEGIN RSA PRIVATE KEY-----` |
| `jwt` | 三段式 JWT | 保留前 8 个字符 + `…` | `eyJhbGci…` |
| `email` | `local@domain` | local ≤3：`***`；否则首字符 + `***` + 末字符；domain 保留 | `admin@corp.com` → `a***n@corp.com` |
| `phone` | 11 位手机号 | 前 3 + 4 个 `*` + 后 4 | `13812348000` → `138****8000` |
| `full` | 任意 | 固定 8 个 `*`（不泄露长度） | `secret-value` → `********` |

**结构脱敏的解析失败兜底**：连接串/URL 使用受限正则解析；若捕获组缺失或 host 为空，直接调用 `maskValue(matchedText, 'generic')`，并在开发期记录计数（不记录内容）。

**长度泄露控制**：`generic` 对 >40 字符的值不再按真实长度输出 `*`，避免通过掩码长度推断密钥长度。

#### 片段级脱敏

`maskedSnippet` 不是"整行脱敏"，而是**只替换命中的敏感值，保留上下文关键词**，以便用户判断风险类型：

| 原文片段 | 命中规则 | 输出片段 |
|---|---|---|
| `// password=Admin@123` | R-011 | `password=*********`（值部分掩码） |
| `// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"` | R-001 | `const AWS_KEY = "AKIA************MNOP"` |
| `// mysql://root:Passw0rd@10.1.2.3:3306/db` | R-012 | `mysql://***:***@10.1.2.3:3306/db` |

实现顺序：取 `matchedText` → 按 `maskKind` 得到 `maskedMatch` → 在片段文本中把 `[startIndex, endIndex)` 区间替换为 `maskedMatch` → 截断到合理展示长度（单行 200 字符、多行最多 5 行）→ 去掉行首注释定界符残留。**禁止**对整段文本做正则替换后再暴露（会误伤并可能泄露）。

#### 上下文构造

| 场景 | 取行策略 | 输出 |
|---|---|---|
| 命中在行注释片段中 | 取同一片段内的上一行/下一行 | 已脱敏文本 |
| 命中在块注释/文档中 | 取片段内命中行的上一行/下一行 | 已脱敏文本 |
| 片段内无相邻行 | 取源文件相邻行（前一行/后一行） | 执行"行级敏感值脱敏"后输出 |
| 文件边界 | `null` | UI 显示"无上下文" |

- **行级脱敏器**：对相邻行依次运行所有启用规则，把每个命中替换为对应掩码；无法解析的匹配统一 `full`。该过程只产出字符串，不生成 `Finding`，避免递归。
- 单行超过 200 字符时截断并追加 `…`；截断在 UTF-16 代理对边界安全处进行。
- 上下文**不保存原文**，`FindingContext` 只含脱敏结果。

#### 二次确认与临时展开

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
participant "FindingRow" as Row
participant "RevealDialog" as Dialog
participant "RawSnippetStore" as Store

U -> Row : 点击“我需要看完整内容”
Row -> Dialog : 打开二次确认（风险说明）
U -> Dialog : 确认“仅本地临时展开”
Dialog -> Store : get(findingId)
alt 存在且未超预算
  Store --> Dialog : rawSnippet（内存字符串）
  Dialog --> U : 纯文本展示（<pre>，不可导出）
else 不存在或超预算
  Store --> Dialog : undefined
  Dialog --> U : “该条完整内容不可展开（超出内存预算）”
end
U -> Dialog : 收起 / 刷新
Dialog -> Store : delete(findingId) / 页面刷新自动清空
@enduml
```

- 展开内容以 React 文本节点渲染（`<pre>` + `white-space: pre-wrap`），**禁止** `dangerouslySetInnerHTML`。
- 不提供"复制完整值"按钮；用户手动选中属于其自主行为，界面明确提示风险。
- 展开状态不进入 `ExportReport`；导出时仍取 `maskedSnippet`。
- `RawSnippetStore` 总预算 16MB、单条 ≤8KB；超预算时停止写入，UI 对该条禁用展开。

### 2.5.4 Shannon 熵计算

**公式**

对字符串 `s`（长度 `n`，字符 `c` 的出现次数 `count(c)`）：

`H(s) = -Σ_{c} (count(c)/n) · log₂(count(c)/n)`

**实现要点**

1. 先归一化：去首尾引号/反引号与空白；长度不在 `[16, 128]` 直接返回"不适用"（不计算）。
2. 字符集判定：base64 风格允许 `A-Z a-z 0-9 + / = - _`；hex 风格允许 `0-9 a-f A-F`；要求至少 95% 字符属于集合，否则不判定为高熵密钥。
3. 频次统计用普通对象或 `Map`，单次遍历 O(n)；`n ≤ 128`，无需优化到极致。
4. 判定阈值：`H > 3.5`（严格大于，等于不命中），且长度为 16–128，且字符集匹配。
5. 结果只用于布尔判定，不把熵值写入报告（避免提供额外指纹信息）。

**边界校验（单测必覆盖）**

| 输入 | 期望 |
|---|---|
| `aaaaaaaaaaaaaaaa` | 熵 0，不命中 |
| `short` | 长度不足，不命中 |
| `Qm9vR2V0dGhpc1NlY3JldFZhbHVlMTIzNDU2Nzg5MA` | 熵约 5.0，命中 medium |
| `AKIAABCDEFGHIJKLMNOP` | 熵约 4.1，但由 R-001 critical 命中并去重胜出 |
| `Admin@123` | 含 `@`，不符合 base64/hex 95% 阈值，不进入熵兜底 |
| 128 位随机 hex | 熵约 4.0，命中 |
| 129 位随机 base64 | 超过上限，不命中 |

**与通用规则的协调**：`password-like` 校验器在值满足高熵条件时返回 false，使 `CLS-R-011` 不产生 high；随后 `CLS-R-019` 以 medium 报告。这样既保留"高熵兜底"，又避免同一值同时产生 high 与 medium。

### 2.5.5 Markdown 围栏追踪

**围栏识别规则**

1. 仅当行首允许 0–3 个空格，且连续出现 ≥3 个反引号（```` ``` ````）或 ≥3 个波浪号（`~~~`）时，视为围栏起始。
2. 起始行可带 info string（如 ```` ```ts ````），不影响状态。
3. 结束围栏必须与起始字符相同、长度 ≥ 起始长度，且其后仅允许空白。
4. 行内代码（单个反引号）不改变围栏状态；缩进 4 空格的代码块不标记为围栏（仅围栏代码块有 `inCodeFence` 语义）。
5. 未闭合围栏：从起始行到文件末尾全部标记为围栏内，并产生 `unclosed-fence` 诊断（`line` = 起始行），UI 在结果区提示"围栏未闭合"。

**输出构造**

- Markdown 全文按"连续相同围栏状态"切块：围栏外块 `sourceKind = 'document'`，围栏内块 `sourceKind = 'fence-sample'`，`inCodeFence = true`。
- 每块保留精确 `startLine`、`endLine`；块内命中行 = `startLine + 块内换行序号`。
- 围栏起止行本身计入围栏内块（通常不含密钥，无副作用）。
- 排序时 `inCodeFence = false` 在前，同级"疑似示例"靠后（CLS-RPT-002）。

**示例**

| Markdown 内容 | 输出 |
|---|---|
| 第 3 行 ```` ``` ````，第 5 行 ```` ``` ````，中间 `AKIA...` | 第 3–5 行为 `fence-sample` 块，命中带"疑似示例" |
| 围栏外 `AKIA...` | `document` 块，不带标记，排序靠前 |
| 第 7 行 ```` ``` ```` 后无结束 | 第 7 行至 EOF 全部 `fence-sample` + 诊断 |

### 2.5.6 `.env` 配置全量扫描

- 文件以 `.env` 开头（`.env`、`.env.local`、`.env.production`）→ `kind = 'config'`，**不进入注释提取**。
- 全文按行切块，`sourceKind = 'config'`，每行保留 1-based 行号；空行与纯注释行同样参与（注释中的密钥也要报）。
- 值匹配仍走同一规则数组；占位符守卫对 `API_KEY=your_api_key_here` 生效（CLS-FLT-006）。
- `.env` 中的 `#` 不作为特殊语法处理（全量扫描已覆盖），避免"注释内密钥漏检"。

### 2.5.7 CSV 防注入与导出编码

**CSV 列定义（固定顺序）**

`序号, 级别, 规则ID, 规则名称, 文件路径, 行号, 来源类型, 疑似示例, 脱敏片段, 上文, 下文, 说明, 修复建议`

**单元格转义顺序（不可颠倒）**

1. **公式注入防护**：若单元格首个字符属于 `= + - @`（并额外覆盖制表符 `\t` 与回车 `\r`，防止 Excel 变体绕过），前置一个英文单引号 `'`。
2. **引号包裹**：若单元格包含逗号、双引号、`\r` 或 `\n`，整体用双引号包裹。
3. **双引号转义**：单元格内的每个 `"` 变为 `""`。
4. 空值输出空字符串；`null` 上下文输出空字符串（不输出 `"null"`）。

**文件级编码**

- UTF-8 BOM：文件开头写入 `\uFEFF`，确保 Excel 正确识别中文。
- 换行：CRLF（`\r\n`），行数 = 命中数 + 1 表头。
- MIME：`text/csv;charset=utf-8`。

**JSON 报告**

- `JSON.stringify(report, null, 2)`，UTF-8，无 BOM。
- 字段白名单由 `scrubForExport` 构造，禁止展开 `Finding`（防止未来新增内部字段被带出）。
- 文件名：`commentleak-report-YYYYMMDD-HHmmss.json` / `.csv`，时间取本地时区并补零；`generatedAt` 为 ISO 8601（UTC），两者来自同一时间点。

**路径清单复制**

- 取命中文件路径去重 → 码点升序 → 每行一个 → `\n` 连接（不使用 CRLF，便于粘贴到 PR/Markdown）。
- 复制内容不含级别、行号、片段，仅路径。
- 剪贴板失败时降级为只读 `<textarea>` 供手动选择。

## 2.6 Worker 架构与消息协议

### 2.6.1 线程拓扑与职责

| 线程 | 职责 | 禁止事项 |
|---|---|---|
| 主线程 | DOM 渲染、文件选择、配置开关、结果拼装、过滤/分页、导出、剪贴板 | 不执行解压、不执行正则匹配、不读取条目正文 |
| Worker | zip 解析、逐条读取、解码、筛选、提取、匹配、去重前的全部计算 | 不访问 DOM、不访问 localStorage/IndexedDB、不发网络请求 |

**Worker 创建方式**

| 构建 | 工厂实现 | Worker 形态 | 说明 |
|---|---|---|---|
| `npm run build` | `factory.standard.ts` | `new Worker(new URL('./scan.worker.ts', import.meta.url))`（classic/iife） | 独立文件，可被浏览器缓存；Vite 负责产出 |
| `npm run build:single` | `factory.inline.ts` | `import ScanWorker from './scan.worker?worker&inline'` | 由 Vite 编码为 Blob URL，保证单文件自包含 |

两个工厂实现同一 `WorkerFactory` 契约，通过 `vite.config.single.ts` 的 `resolve.alias` 将 `@worker-factory` 指向不同文件；`workerClient.ts` 只依赖别名，不感知构建模式。

### 2.6.2 消息协议

**协议版本**：`PROTOCOL_VERSION = 1`。所有消息带 `protocol` 字段；客户端收到不匹配版本时立即报 `CLS-E-1008` 并重建 Worker。

**请求（主线程 → Worker）**

| 消息 | 载荷 | 频率 | 语义 |
|---|---|---|---|
| `job:start` | `jobId`、`config`、`StartPayload` | 每作业 1 次 | 启动唯一活动作业；zip 的 `ArrayBuffer` 以 Transferable 转移 |
| `job:cancel` | `jobId` | 用户取消时 1 次 | 请求协作式取消；不保证立即停止同步正则 |
| `job:ping` | `jobId` | 仅诊断时 | 健康检查，Worker 回 `job:progress`（不改变进度） |

**响应（Worker → 主线程）**

| 消息 | 载荷 | 频率/批量 | 语义 |
|---|---|---|---|
| `job:progress` | `ScanProgress` | 节流 ≤10 次/秒（≥100ms 间隔） | 阶段、百分比、已处理/总数、当前路径、耗时 |
| `job:findings` | `FindingBatch`（100 条/批） | 每 100 条或作业结束前 | 仅含脱敏结果 + `rawByFindingId`（受预算限制） |
| `job:skipped` | `SkippedBatch`（100 条/批） | 每 100 条或作业结束前 | 跳过项，含原因与体积 |
| `job:done` | `ScanCompletion` | 每作业 1 次 | 摘要、跳过总数、原因分布、诊断摘要（≤200 条） |
| `job:error` | `WorkerFailure` | 每作业 ≤1 次 | 致命错误，携带错误码/文案/建议 |
| `job:cancelled` | `jobId` | 每作业 ≤1 次 | 协作式取消成功确认 |

**消息不变量**

1. 所有响应必须带当前 `jobId`；客户端丢弃 `jobId !== activeJobId` 的消息（防止旧作业污染）。
2. `job:done` 之前必须先发送完所有 `job:findings` / `job:skipped` 批次；`sequence` 单调递增。
3. `job:error` 与 `job:done` 互斥；`job:cancelled` 与二者互斥。
4. 消息只包含可结构化克隆数据；`ClsError` 转 `WorkerFailure`，`Error.stack` 不传输（避免泄露路径/内容）。
5. 任何消息不得包含 `rawValue` 以外的完整敏感值；`rawByFindingId` 仅用于二次确认，键为 `findingId`；Worker 侧累计发送 ≤16MB，超出后停止附带 raw（UI 对该条禁用展开并提示）。

### 2.6.3 作业启动与结果分批时序

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
participant "App" as App
participant "ScanWorkerClient" as Client
participant "Worker" as W
participant "JobRunner" as R

U -> App : 选择 zip
App -> App : 扩展名/体积校验（主线程，不读内容）
App -> Client : start({ source:'zip', data }, handlers)
Client -> W : job:start（transfer: [data]）
W -> R : runJob(request, emit, signal)
R -> R : openZipArchive → 元数据预检（炸弹/路径）
R --> Client : job:progress（validating→unzipping）
loop 每个条目
  R -> R : 路径校验 → 筛选 → 读取 → 解码 → 提取 → 匹配
  R --> Client : job:progress（节流）
  R --> Client : job:findings / job:skipped（每 100 条）
end
R --> Client : job:done(completion)
Client --> App : onDone
App -> App : 汇总 Finding + Skipped + Summary + Diagnostics → ScanResult
@enduml
```

**传输策略**

| 数据 | 方式 | 说明 |
|---|---|---|
| zip 字节 | `ArrayBuffer` + Transferable | 转移后主线程 `byteLength = 0`，避免双份驻留 |
| 文件夹 `File[]` | 结构化克隆 | `File` 不可转移；仅传递句柄，实际读取在 Worker 内 `arrayBuffer()` |
| 进度消息 | 普通克隆 | 对象小，节流后开销可忽略 |
| 命中批次 | 普通克隆 | 每批 ≤100 条；估算 ≤100KB；主线程单批拼装 <5ms |
| 跳过批次 | 普通克隆 | 每批 ≤100 条，避免一次克隆上千项 |

**背压**：不做显式 ack。批次之间 `await new Promise(r => setTimeout(r, 0))` 让出事件循环，使消息队列可被主线程消费；单批 100 条保证主线程回调短于 16ms。5000 条命中约 50 批，峰值队列 ≤2 批。

### 2.6.4 取消与超时

| 步骤 | 行为 | 时限 |
|---|---|---|
| 1 | 用户点击"取消" → `Client.cancel(jobId)` 发送 `job:cancel` | 立即 |
| 2 | Worker 在"每条目后/每文件后/每 50 次匹配后"检查 `signal.cancelled` | 下一检查点 |
| 3 | 检查到取消 → 释放 `ArchiveReader`/当前字节 → 发送 `job:cancelled` | ≤200ms（同步正则除外） |
| 4 | 客户端等待 `job:cancelled`；超时 800ms | 800ms |
| 5 | 超时 → `worker.terminate()` → 重建 Worker → 回调 `onCancelled` | ≤1s（满足 CLS-INP-007） |
| 6 | 主线程清空进度、`ResultStore`、未消费批次，回到 `idle` | 立即 |

**关键点**

- 取消后**不保留**任何中间结果；旧 `jobId` 的迟到消息一律丢弃。
- 同步正则无法被中断，因此超时后必须 `terminate`；重建 Worker 的成本（~10ms）可接受。
- 取消不是错误：UI 显示"已取消本次扫描"，不显示错误码。
- 作业进行中再次上传：`App` 在 `phase === 'scanning'` 时拒绝并提示"请等待当前扫描完成或先取消"（CLS-NFR-011）。

### 2.6.5 Worker 不可用与降级

| 场景 | 检测方式 | 行为 |
|---|---|---|
| 浏览器不支持 Worker | `typeof Worker === 'undefined'` | `supported = false`；直接主线程 `runJob`，页面顶部提示 `CLS-E-4001` |
| 工厂创建抛错 | `try/catch` | 同上；记录计数，不记录错误内容 |
| Worker 运行中崩溃 | `worker.onerror` / `messageerror` | 清理 → 若已有批次结果则丢弃 → 回调 `onError(CLS-E-1008)`；可重试 |
| 单文件构建 `file://` 下 Blob Worker 被拒 | 创建后 500ms 无 `job:progress` 且无错误 | 视为不可用，降级主线程并提示性能风险 |
| 降级时的 UI | `App` 显示"当前浏览器不支持后台扫描，处理大文件可能卡顿" | 功能完整可用（CLS-UIX 异常场景） |

**降级路径复用**：主线程直接调用 `runJob`（同一 `jobRunner.ts`），`emit` 改为同步回调；因此消息协议与业务逻辑无需第二套实现。

### 2.6.6 协议守卫与调试

- `protocol.ts` 导出 `isWorkerResponse(value: unknown)`，逐字段校验 `type`、`protocol`、`jobId` 与关键字段类型；开发期断言失败即抛错，生产环境丢弃非法消息并计数。
- 调试日志仅输出：`jobId`、消息类型、批次序号、条数、阶段、耗时；**不输出路径、片段、规则匹配值**。
- 生产构建通过 `import.meta.env.DEV` 关闭详细日志；仅保留错误码与计数（CLS-PRV-004）。

## 2.7 性能设计

### 2.7.1 性能预算（对齐 CLS-NFR-001~006）

| 阶段 | 目标耗时（100MB / 5000 条目） | 主要成本 | 控制手段 |
|---|---|---|---|
| 文件校验 | ≤0.2s | 读取 `File.size` | 主线程仅读元数据 |
| zip 解析 + 元数据预检 | ≤2s | jszip 中央目录解析 | 一次性 `loadAsync`；预检不做解压 |
| 解压 + 筛选 | ≤25s | 逐条 `async()` + 解码 | 先筛选后解压；只读取通过筛选的条目 |
| 注释提取 + 匹配 | ≤25s | 字符扫描 + 正则 | 8KB 截断、规则编译缓存、单文件串行 |
| 去重 + 排序 + 封包 | ≤3s | 5000 条排序与构造 | O(n log n) 排序；一次构造 |
| 结果传输 | ≤2s | 50 批消息 | 每批 100 条 + 让出事件循环 |
| 总计 | **≤60s** | — | 任一阶段超时记录耗时计数，不中止 |

### 2.7.2 内存预算与释放

| 对象 | 峰值估算 | 生命周期 | 释放策略 |
|---|---|---|---|
| zip 压缩数据（jszip 内部） | 100–200MB | 作业全程 | `ArchiveReader.dispose()` + 置空引用 + `terminate` |
| 当前条目解压字节 | ≤2MB（超过即跳过） | 单条目 | 解码后立即置 `null`；`finally` 保证 |
| 当前文件文本 | ≤2MB（UTF-16 约 4MB） | 单文件 | 扫描完丢弃，不进入结果 |
| 当前文件片段 | ≤8KB × 片段数（通常 <100） | 单文件 | 扫描完丢弃 |
| `RawMatch[]` | 单文件通常 <100 条 | 单文件 | 去重后仅保留种子字段 |
| `Finding[]` | 5000 × ~0.6KB ≈ 3MB | 作业结束至新作业 | 新作业/刷新清空 |
| `RawSnippetStore` | ≤16MB | 作业结束至新作业 | 新作业/收起/刷新清空 |
| `SkippedFile[]` | 12000 × ~0.2KB ≈ 2.4MB | 作业结束 | 新作业清空 |
| React 虚拟 DOM + 分页 | 通常 <100MB | 页面 | 分页仅渲染 200 条 |

**峰值目标**：≤1.5GB（含浏览器自身）。关键约束是"任何时刻只保留 1 个解压文件"，因此解压总量上限 500MB 不会转化为 500MB 常驻内存。

**释放检查清单**

1. `readEntry` 返回的 `Uint8Array` 在 `decodeUtf8` 后立即解除引用（局部变量置 `null`，不进入闭包）。
2. `ArchiveReader.dispose()` 在 `finally` 中调用，无论成功、失败、取消。
3. `worker.terminate()` 后旧 Worker 的闭包与堆整体回收；客户端置 `worker = null`。
4. `URL.revokeObjectURL` 在下载触发后 1s 内调用。
5. 导出字符串生成后不缓存；再次导出重新构造。
6. 重新上传时 `RawSnippetStore.clear()`、`result = null`、`progress = null`。

### 2.7.3 进度反馈粒度

| 指标 | 设计值 | 说明 |
|---|---|---|
| 进度发送间隔 | ≥100ms，≤200ms | 满足 CLS-NFR-006；用 `lastEmitAt` 节流 |
| 百分比精度 | 0.1% | 向下取整，避免抖动 |
| 单调性 | `max(lastPercent, computed)` | 任何阶段切换不回退 |
| 当前文件名 | 每条目更新，但 UI 仅在变化时重渲染 | 长路径中间省略（`toDisplayPath`） |
| 阶段标签 | 中文固定文案 | "校验中/解压中/筛选中/扫描中/整理结果" |
| 完成后 | 100% + 耗时 | `job:done` 后停止定时器 |

### 2.7.4 大文件与极端输入

| 输入 | 处理 | 性能保障 |
|---|---|---|
| 单文件 2MB | 正常扫描 | 解码 + 单遍扫描通常 <200ms |
| 单文件 >2MB | 不解压，登记 `too-large` | 元数据阶段拦截，避免无效解压 |
| 单条注释 1MB | 截断 8KB 后匹配 | 避免正则回溯；标记"片段已截断" |
| 20000 条命中 | 分页 200 条/页 | 表格仅渲染当前页；过滤用 `useMemo` |
| 12000 个跳过文件 | 每类展示前 100 条 | 完整清单仅导出 JSON |
| 5000 条目 zip | 串行处理 + 节流进度 | 不并发解压，避免内存尖峰与线程争用 |
| 未识别扩展名大量存在 | 只在元数据阶段分类，不读取内容 | O(1)/条目 |

### 2.7.5 性能测量与回归

- Worker 内按阶段累计 `performance.now()`：解析、解压、筛选、提取、匹配、封包；仅在 `job:done` 回传各阶段耗时（数字），不包含路径或内容。
- 开发期在 `console` 输出计数与耗时（`import.meta.env.DEV`）；生产构建不输出。
- `scripts/make-large-fixture.mjs` 生成两类夹具：
  1. `large-many.zip`：5000 个 20KB 文本文件，含少量注释命中；
  2. `large-one.zip`：约 100MB 的少量大文件（每个 ≤2MB，共 50 个），验证解压与解码。
- 验收记录写入 README"验收证据"：机器配置、Chrome 版本、耗时、内存峰值、Long Task 最大值。

## 2.8 安全与隐私设计

### 2.8.1 威胁模型

| 威胁 | 载体 | 可能后果 | 设计缓解 | 验证 |
|---|---|---|---|---|
| 代码/密钥外泄 | 运行时网络请求 | 隐私承诺失效 | 无网络客户端；构建期静态校验；断网验收 | ACC-09、CLS-PRV-001 |
| 路径穿越 | 恶意 zip 条目名 | 绕过忽略规则、伪装文件来源 | 段级校验；拒绝 `..`/绝对路径/盘符/控制字符；不写文件系统 | ACC-12、CLS-NFR-015 |
| zip 炸弹 | 高压缩比条目 | 内存耗尽/页面崩溃 | 100MB 包上限、500MB 总量、单条比例、条目数上限、元数据预检 | ACC-11、CLS-INP-008 |
| XSS | 恶意文件名/注释内容 | 脚本执行、数据被读取 | React 文本转义；禁用 `dangerouslySetInnerHTML`；不渲染链接/Markdown | ACC-17、CLS-PRV-008 |
| 持久化残留 | localStorage/IndexedDB | 刷新后仍留存敏感内容 | 不使用任何持久化 API；刷新即清空 | CLS-PRV-003 |
| 日志泄露 | console/错误堆栈 | 密钥进入 DevTools | 日志白名单；错误不携带原文；生产仅计数 | CLS-PRV-004 |
| ReDoS | 恶意超长注释 | Worker 长时间占用 | 8KB 截断；规则模式评审；取消可 terminate | CLS-EXT-013 |
| 供应链 | 第三方依赖 | 恶意代码/联网 | 仅 6 个运行期依赖；锁定 lockfile；无 postinstall；产物扫描 | CLS-PRV-005 |
| 剪贴板泄露 | 复制路径/手动复制 | 用户主动操作 | 不提供复制完整值；路径清单不含片段 | CLS-EXP-003 |
| 浏览器扩展读取 DOM | 宿主环境 | 无法完全防护 | 页面提示"确认无外部扩展"；展开需二次确认 | CLS-PRV-007 |
| 本地其他脚本写 storage | 宿主环境 | 误读非本次结果 | 本工具不读取 storage；结果只来自本次内存 | CLS-PRV-003 异常场景 |

### 2.8.2 零网络设计

**允许的浏览器 API（白名单）**

| API | 用途 | 是否产生网络 |
|---|---|---|
| `File` / `Blob` / `File.arrayBuffer()` | 读取用户选择的本地文件 | 否 |
| `Worker` / `postMessage` | 本地线程通信 | 否 |
| `TextDecoder` | UTF-8 解码 | 否 |
| `URL.createObjectURL` / `revokeObjectURL` | 本地下载 | 否（`blob:`） |
| `navigator.clipboard.writeText` | 复制路径 | 否 |
| `Blob` + `a[download]` | 本地导出 | 否 |
| `crypto.getRandomValues`（如需） | 生成 `jobId` | 否 |

**禁止的 API（源码级）**

`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`navigator.sendBeacon`、`importScripts`（远程）、`RTCPeerConnection`、`WebTransport`、`<script src="http…">`、`@import url(http…)`、`url(http…)`、`fonts.googleapis.com`、任何 CDN 域名。

**三重保障**

1. **依赖与资源本地化**：运行期依赖仅 `react`、`react-dom`、`jszip`；样式由 Tailwind 构建产出；字体使用系统字体栈；`index.html` 不含外部 `<link>`/`<script>`。
2. **构建期静态校验**：`scripts/verify-no-network.mjs` 扫描 `src/` 与 `dist/`：
   - 命中禁用标识符（按词边界）→ 退出码 1；
   - 命中 `https?://` 字面量 → 检查白名单（规则数据中的示例 URL、README/注释中的说明除外，需显式标注 `// allow-url`）；
   - 扫描 `dist/index.html` 的 `<script src>`、`<link href>`、`url(`；发现非 `data:`/`blob:`/相对路径即失败；
   - 该脚本纳入 `npm run verify:network`，并在 `npm run build` 后自动执行（`postbuild`）。
3. **运行期人工验收**：DevTools Network 面板过滤 `Fetch/XHR/WS`，完成上传→扫描→导出，请求数应为 0；断网后重复全流程（ACC-08、ACC-09）。

**为什么不做运行期 monkey-patch**：改写全局 `fetch`/`XMLHttpRequest` 会与浏览器扩展、宿主页面冲突，且可能掩盖真实调用。静态校验 + 代码审计 + Network 面板证据更可靠（ADR-10）。

**CSP 权衡**：标准构建可选添加 `Content-Security-Policy` meta（`connect-src 'none'`）；单文件构建因内联脚本/样式需要 `'unsafe-inline'`，CSP 收益有限且易误伤，本期**不强制**，在 README 说明可由部署方自行添加。XSS 主防线为 React 转义与禁用危险 API。

### 2.8.3 零持久化与日志安全

| 约束 | 实现 |
|---|---|
| 不使用 localStorage/sessionStorage/IndexedDB/Cache API | 代码中不出现这些标识符；ESLint `no-restricted-globals` 拦截 |
| 不保存主题偏好 | 深浅色完全由 `prefers-color-scheme` CSS 媒体查询驱动，无需 JS 状态与存储 |
| 刷新即清空 | 所有结果在 React 内存状态与 `RawSnippetStore` 中；无恢复逻辑 |
| 日志白名单 | 自定义 `logEvent(kind, count, durationMs, code)`；参数类型限制为 `number/string/boolean`，不接收文件内容对象 |
| 错误对象 | `ClsError` 只含错误码、简短 hint、非敏感 detail；不含 `fileContent`、`snippet`、`rawValue` |
| 生产日志 | `import.meta.env.DEV` 控制详细日志；生产仅错误码与计数；构建不输出 `console.log` 的业务内容 |

**开发期断言（仅 DEV）**：`assertNoSensitiveInLog(value)` 检查日志参数中是否包含长 base64/密钥模式；命中则抛出开发期错误，迫使开发者修正。生产构建移除该断言。

### 2.8.4 XSS 防护

| 入口 | 风险 | 防护 |
|---|---|---|
| 文件名 / 文件路径 | `<img onerror>` 等 | React 文本插值；不拼接 HTML；不渲染为链接 |
| 注释片段 / 上下文 | HTML/JS 片段 | `<pre>` 文本节点；`white-space: pre-wrap`；不使用 Markdown 渲染 |
| 规则说明 / 修复建议 | 规则数据被篡改 | 规则数据为源码常量，仍按文本渲染 |
| 错误信息 | 异常消息含用户内容 | `ClsError` 只保留错误码与固定文案；原始异常不展示 |
| 展开的完整片段 | 同上 | 纯文本；`dangerouslySetInnerHTML` 全局禁用 |
| 导出 CSV | Excel 公式注入 | 见 2.5.7 前置 `'`；CSV 不是 HTML，但仍防公式 |

**ESLint 规则**：`react/no-danger`、`no-eval`、`no-implied-eval`、`no-new-func`、`no-script-url`、`no-restricted-properties`（`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`）。

### 2.8.5 路径穿越防护

**校验流程**

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
start
:读取原始条目名;
:反斜杠统一为斜杠;
if (以斜杠开头 或 匹配盘符前缀?) then (是)
  :拒绝：absolute-path / drive-letter;
elseif (包含控制字符 0x00-0x1F 或 0x7F?) then (是)
  :拒绝：control-character;
else
  :按斜杠分段，丢弃空段与单点段;
  if (存在双点段?) then (是)
    :拒绝：parent-segment;
  elseif (段长 > 255 或总长 > 1024?) then (是)
    :拒绝：path-too-long;
  else
    :通过，生成规范化相对路径;
  endif
endif
:非法条目登记为 illegal-path（不中止作业）;
stop
@enduml
```

**规则细节**

| 规则 | 判定 | 处理 |
|---|---|---|
| 反斜杠 | `\` → `/` | 规范化，不作为独立文件 |
| 前导 `/` | `^/` | 拒绝（`absolute-path`） |
| 盘符 | `^[A-Za-z]:` | 拒绝（`drive-letter`） |
| 父目录段 | 任一段 `=== '..'` | 拒绝（`parent-segment`） |
| 当前目录段 | `=== '.'` | 丢弃该段 |
| 空段 | 连续 `//` | 丢弃空段（不拒绝，规范化） |
| 控制字符 | `[\x00-\x1F\x7F]` | 拒绝（`control-character`） |
| 长度 | 段 >255 或总长 >1024 | 拒绝（`path-too-long`） |
| Windows 设备名 | `CON/PRN/AUX/NUL/COM1…` | 不改名、不特殊处理（不写文件系统）；仅在详情中提示 |

**根本缓解**：浏览器端不把 zip 解压到文件系统，路径只作为结果展示与分组键；即使绕过校验也无法写入磁盘。但为避免"路径伪装规避忽略规则"（CLS-NFR-015），仍必须拒绝并登记。

### 2.8.6 zip 炸弹防护

**检测参数**

| 参数 | 值 | 判定 |
|---|---|---|
| 压缩包体积 | 100MB | 主线程校验，不读取内容 |
| 解压总量 | 500MB | 元数据累计 + 实际读取累计，任一超限即中止 |
| 单条压缩比 | `uncompressed / max(compressed, 1) > 100` | 且 `uncompressed > 10MB` 才中止（避免小文件误判） |
| 条目数 | 50,000 | 超过即中止（防中央目录炸弹） |
| 单文件体积 | 2MB | 超过即跳过（不参与扫描），不解压正文 |

**实现策略**

1. **元数据预检（第一道）**：`readEntryMeta` 通过窄接口读取 jszip 内部 `_data.uncompressedSize/compressedSize`；若字段存在，累计并判定。200MB 全零文件在预检阶段即被拦截，不发生 200MB 分配。
2. **实际读取复核（第二道）**：每读完一条，用实际 `byteLength` 累加并与元数据对比；若元数据缺失或不一致，以实际值为准。超限立即停止并 `dispose()`。
3. **单条读取上限**：若 `uncompressedSize` 未知，读取后立即检查 `byteLength > 2MB` → 登记 `too-large` 并丢弃；受 jszip API 限制，无法在解压过程中流式截断，因此"未知大小 + 超大条目"是残余风险（见 2.11）。
4. **中止后处理**：停止循环 → `dispose()` → 清空所有局部引用 → 发送 `job:error(CLS-E-1005)` → 主线程清理并显示具体提示；页面保持可用。

**为什么不用 `entry.async('string')` 直接解码**：字符串解码前无法检查字节数，且会额外分配；统一用 `uint8array` 便于精确计量与释放。

### 2.8.7 损坏与加密压缩包

| 场景 | 检测 | 错误映射 | 用户提示 |
|---|---|---|---|
| 中央目录损坏 | `loadAsync` 抛错 | `CLS-E-1003` | "压缩包已损坏，无法读取第 N 个条目" |
| 条目数据损坏 | `async()` 抛错 | `CLS-E-1003` | 同上；`N` 为当前 `readIndex + 1` |
| 加密条目 | jszip 抛错含 "encrypted"（大小写不敏感） | `CLS-E-1004` | "压缩包包含加密条目，无法在本地读取，请先解压后重新打包" |
| 密码错误 | 同上 | `CLS-E-1004` | 同上 |
| 空压缩包 | 条目数 0 | `CLS-E-1007` | "压缩包内未找到可扫描的文本文件" |

**错误消息映射原则**：只按错误类型映射，不回显 jszip 原始错误文本（可能包含内部路径）；`detail` 只含条目序号与固定中文说明。

### 2.8.8 依赖与供应链

| 措施 | 说明 |
|---|---|
| 运行期依赖最小化 | 仅 `react`、`react-dom`、`jszip`；其余为构建期/测试期 |
| 锁文件 | 提交 `package-lock.json`；`npm ci` 安装；评审 lockfile 变更 |
| 无 postinstall | 禁止安装脚本下载二进制/远程资源；依赖安装即可离线构建 |
| 无 CDN/远程字体 | 系统字体栈；`index.html` 无外部链接 |
| 产物扫描 | `verify-no-network.mjs` 检查 `dist` 外部引用；`verify-build.mjs` 检查单文件完整性 |
| 供应链残余风险 | 依赖本身若含联网代码，静态扫描可能漏检；README 建议使用前审计 `node_modules` 与构建产物 |

### 2.8.9 隐私声明与工具边界（文案基线）

**页面底部固定声明（逐字，CLS-RPT-009）**

> 所有处理均在浏览器本地完成，代码不会上传到任何服务器。请确认页面无外部网络请求后再使用。

**工具边界说明（可展开）**

- 本工具是"提交前自查"辅助工具，不替代 gitleaks / trufflehog 等专业密钥扫描。
- 只扫描当前压缩包/文件夹中的注释与指定文档，不扫描 git 历史、提交记录或远端仓库。
- 一旦密钥曾进入 git 历史，仅删除注释不足，**必须轮换密钥**。
- 浏览器扩展可读取页面 DOM，请确认无不可信扩展后再处理敏感代码。

**README 对应章节**：使用方式、隐私说明、规则清单表、已知限制、免责声明、验收证据；规则变更时同步更新（CLS-NFR-022）。

### 2.8.10 安全验证清单

| 编号 | 验证项 | 方法 | 通过标准 |
|---|---|---|---|
| SEC-01 | 零外部请求 | DevTools Network（Fetch/XHR/WS/Other） | 全流程 0 条外部请求 |
| SEC-02 | 断网可用 | 离线模式完成上传→扫描→导出 | 全流程成功 |
| SEC-03 | 无持久化 | Application 面板检查 Storage/IndexedDB/Cache | 无扫描相关键 |
| SEC-04 | 日志无内容 | Console 检索完整密钥/片段 | 0 命中 |
| SEC-05 | XSS 文件名 | `<img src=x onerror=alert(1)>.js` | 纯文本显示，无弹窗 |
| SEC-06 | 路径穿越 | `../../etc/passwd.js` 条目 | 拒绝并登记 `illegal-path` |
| SEC-07 | zip 炸弹 | 200MB 全零文件包 | 中止并提示 CLS-E-1005，页面可用 |
| SEC-08 | 加密包 | 加密 zip | 提示 CLS-E-1004，非笼统失败 |
| SEC-09 | 导出脱敏 | 展开完整值后导出 JSON/CSV | 检索不到完整值 |
| SEC-10 | 外部资源 | 产物全文检索 `http(s)://`、`<script src>` | 仅规则示例/注释白名单 |

## 2.9 构建配置

### 2.9.1 构建目标与脚本

| 脚本 | 命令（要点） | 产物 | 用途 |
|---|---|---|---|
| `npm run dev` | `vite` | 内存开发服务器 | 本地开发；HMR 仅在开发期存在，不进入产物 |
| `npm run build` | `tsc --noEmit && vite build && node scripts/verify-no-network.mjs` | `dist/` | 标准静态站点，可由 `npx serve dist` 提供 |
| `npm run build:single` | `tsc --noEmit && vite build --config vite.config.single.ts && node scripts/verify-build.mjs` | `dist-single/index.html` | 单文件，双击（`file://`）可用 |
| `npm run preview` | `vite preview` | — | 本地预览标准构建 |
| `npm run test` | `vitest run` | — | 纯函数单元测试 |
| `npm run lint` | `eslint src scripts *.ts` | — | 阻断危险 API/外部 URL |
| `npm run verify:network` | `node scripts/verify-no-network.mjs src dist` | — | 独立零网络校验 |
| `npm run verify:build` | `node scripts/verify-build.mjs` | — | 单文件完整性与无外链校验 |
| `npm run fixtures` | `node scripts/make-fixtures.mjs` | `fixtures/*.zip` | 生成验收夹具（ACC-01~06、10、12~14、16~18） |
| `npm run fixtures:large` | `node scripts/make-large-fixture.mjs` | `fixtures/large-*.zip` | 性能夹具（100MB / 5000 条目） |
| `npm run fixtures:bomb` | `node scripts/make-bomb-fixture.mjs` | `fixtures/bomb.zip` | 炸弹夹具（仅本地；`.gitignore`） |

**构建前置**：Node `>=18.18 <25`；实测 24.21.0 可用。`npm ci` 安装后无需联网即可构建。

### 2.9.2 依赖清单

**dependencies（运行期，仅 3 项）**

| 包 | 版本 | 用途 |
|---|---|---|
| `react` | `^18.3.1` | UI |
| `react-dom` | `^18.3.1` | 渲染 |
| `jszip` | `^3.10.1` | zip 解析与逐条读取 |

**devDependencies（构建/测试/规范）**

| 包 | 版本 | 用途 |
|---|---|---|
| `vite` | `^5.4.x` | 构建与开发服务器 |
| `@vitejs/plugin-react` | `^4.3.x` | React JSX/Fast Refresh |
| `typescript` | `~5.6.x` | 类型检查 |
| `@types/react` / `@types/react-dom` | `^18.3.x` | React 类型 |
| `@types/node` | `^24.x` | 构建脚本类型 |
| `tailwindcss` | `^3.4.x` | 原子样式 |
| `postcss` / `autoprefixer` | `^8.4.x` / `^10.4.x` | 浏览器前缀 |
| `vite-plugin-singlefile` | `^2.0.x` | 单文件构建 |
| `vitest` | `^2.1.x` | 单元测试 |
| `eslint` + `typescript-eslint` | `^9.x` / `^8.x` | 规范与安全规则 |
| `eslint-plugin-react-hooks` | `^5.x` | Hooks 规则 |
| `eslint-plugin-react` | `^7.x` | `react/no-danger`（阻断 `dangerouslySetInnerHTML`） |

**不引入**：任何 UI 组件库、图标库、日期库、状态管理库、路由、HTTP 客户端、字体包、分析 SDK、Markdown 渲染器。

### 2.9.3 `vite.config.ts`（标准构建）

| 配置项 | 值 | 理由 |
|---|---|---|
| `base` | `'./'` | 相对路径，兼容 `npx serve dist` 的子路径部署与 `file://` 预览习惯 |
| `plugins` | `[react()]` | JSX 与 Fast Refresh（仅 dev） |
| `build.outDir` | `'dist'` | 标准产物 |
| `build.target` | `'es2020'` | 覆盖 Chrome/Edge/Firefox 近两版；避免过新语法 |
| `build.sourcemap` | `false` | 减小产物；避免源码路径外泄 |
| `build.cssCodeSplit` | `false` | 单一样式文件，简化单文件构建与首屏 |
| `build.assetsInlineLimit` | `4096` | 小资源内联；本项目几乎无图片资源 |
| `build.rollupOptions.output.manualChunks` | 不拆分 | 主包仅 React；jszip 在 Worker chunk 内；拆分收益低 |
| `worker.format` | `'iife'` | classic worker，兼容性最好；Worker 内无动态 import |
| `resolve.alias['@']` | `'/src'` | 稳定导入路径 |
| `resolve.alias['@worker-factory']` | `'/src/workers/factory.standard.ts'` | 构建期切换 Worker 形态 |
| `define.__APP_VERSION__` | `JSON.stringify(pkg.version)` | 报告/页脚显示版本，不引入运行时读取 package.json |
| `esbuild.drop` | `['debugger']` | 移除调试语句；保留受控日志 |
| `publicDir` | `false` | 无静态资源目录，避免意外外链 |

### 2.9.4 `vite.config.single.ts`（单文件构建）

| 配置项 | 值 | 与标准构建差异 |
|---|---|---|
| `plugins` | `[react(), viteSingleFile({ removeViteModuleLoader: true, useRecommendedBuildConfig: true })]` | 新增单文件插件 |
| `build.outDir` | `'dist-single'` | 与 `dist/` 隔离，避免互相覆盖 |
| `build.assetsInlineLimit` | `100_000_000` | 所有资源内联 |
| `build.cssCodeSplit` | `false` | CSS 内联到 HTML |
| `build.rollupOptions.output.inlineDynamicImports` | `true` | 禁止动态 chunk |
| `build.modulePreload` | `false` | 单文件无预加载需求 |
| `resolve.alias['@worker-factory']` | `'/src/workers/factory.inline.ts'` | Worker 以 Blob 内联 |
| `define.__SINGLE_FILE__` | `true` | 运行期可感知构建形态（仅用于诊断文案） |
| `worker.format` | `'iife'` | 避免 `file://` 下 module worker 限制 |

**单文件构建的特殊约束**

1. **不得依赖 Service Worker**（`file://` 不支持）：本项目不注册任何 SW。
2. **不得使用绝对资源路径**：`base: './'` + 插件内联，产物只有一个 `index.html`。
3. **Worker 内联**：`?worker&inline` 生成 Blob URL；若浏览器拒绝，走主线程降级并提示（2.6.5）。
4. **剪贴板限制**：`file://` 属于非安全上下文，`navigator.clipboard` 可能不可用；必须降级为只读 `<textarea>` + 手动复制（CLS-EXP-003 异常场景）。
5. **字体与图标**：只使用系统字体与内联 SVG/CSS 图形，禁止外部字体与图标字体。
6. **体积预算**：单文件目标 ≤2MB（未压缩），超过时在构建日志告警；主要体积来自 React + jszip + Worker base64。

### 2.9.5 Tailwind 与 PostCSS

| 配置 | 值 | 说明 |
|---|---|---|
| `darkMode` | `'media'` | 跟随 `prefers-color-scheme`，无需 JS 与持久化 |
| `content` | `['./index.html', './src/**/*.{ts,tsx}']` | 仅扫描实际源码 |
| `theme.extend.fontFamily.sans` | `['system-ui','-apple-system','Segoe UI','Microsoft YaHei','sans-serif']` | 零远程字体 |
| `theme.extend.colors` | 复用 Tailwind 默认 `slate/red/orange/amber/emerald` | 避免自定义色板维护成本 |
| `plugins` | `[]` | 不引入 typography/forms（无 Markdown 渲染、表单简单） |
| `safelist` | 不使用 | 级别颜色使用完整类名映射，避免动态拼接导致 purge 失效 |
| `postcss.plugins` | `tailwindcss`、`autoprefixer` | 标准配置 |

**对比度要求**：正文使用 `slate-900` on `white`（浅色）与 `slate-100` on `slate-950`（深色）；按钮/徽标使用 `*-700` 以上前景或深色背景反白。开发期用浏览器对比度检查器抽检 ≥4.5:1（CLS-UIX-002）。

**级别颜色映射（组件内完整类名）**

| 级别 | 浅色 | 深色 |
|---|---|---|
| critical | `text-red-700 bg-red-50 border-red-200` | `dark:text-red-300 dark:bg-red-950 dark:border-red-900` |
| high | `text-orange-700 bg-orange-50 border-orange-200` | `dark:text-orange-300 dark:bg-orange-950 dark:border-orange-900` |
| medium | `text-amber-700 bg-amber-50 border-amber-200` | `dark:text-amber-300 dark:bg-amber-950 dark:border-amber-900` |
| low | `text-slate-600 bg-slate-50 border-slate-200` | `dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700` |

### 2.9.6 TypeScript 配置

| 选项 | 值 | 理由 |
|---|---|---|
| `target` | `ES2022` | 现代浏览器；支持顶层 await 等（构建期） |
| `lib` | `["ES2022","DOM","DOM.Iterable"]` | 主线程与类型定义需要 DOM 类型 |
| `module` / `moduleResolution` | `ESNext` / `Bundler` | 与 Vite 一致 |
| `jsx` | `react-jsx` | 无需显式 import React |
| `strict` | `true` | 类型安全基础 |
| `noUncheckedIndexedAccess` | `true` | 强制处理数组/记录越界，路径与行号逻辑受益 |
| `noImplicitOverride` / `noFallthroughCasesInSwitch` | `true` | 减少状态机分支错误 |
| `isolatedModules` | `true` | 与 esbuild 单文件转译兼容 |
| `verbatimModuleSyntax` | `true` | 强制 `import type`，利于 tree-shaking |
| `skipLibCheck` | `true` | 避免第三方库类型噪声阻塞构建 |
| `types` | `["vite/client"]` | 提供 `import.meta.env` 与资源类型 |
| `include` | `["src"]` | 仅业务源码 |
| `tsconfig.node.json` | `module: NodeNext`、`types: ["node"]` | 覆盖 `vite.config.*`、`tailwind.config.ts`、`scripts/*.mjs` 的类型检查 |

**Worker 类型策略（避免 DOM/WebWorker 重复声明）**

- `types.ts` 使用 `File`（DOM 与 Worker 运行时均存在），不引入 `lib.webworker`。
- `scan.worker.ts` 顶部自定义最小接口 `WorkerScope`（`postMessage`、`onmessage`、`close`），通过 `declare const self: WorkerScope` 访问；不引入 `DedicatedWorkerGlobalScope` 全局类型，避免与 DOM lib 冲突。
- Worker 文件禁止引用 `window`/`document`；由 ESLint `no-restricted-globals` 校验。

### 2.9.7 `index.html`

| 元素 | 内容 | 说明 |
|---|---|---|
| `lang` | `zh-CN` | 全中文界面 |
| `meta charset` | `UTF-8` | 中文与 emoji 安全 |
| `meta viewport` | `width=device-width, initial-scale=1` | 响应式 |
| `meta color-scheme` | `light dark` | 表单控件跟随系统主题 |
| `meta description` | 中文一句话说明 | 无外部依赖 |
| `title` | `CommentLeak Scanner · 注释敏感信息扫描器` | 浏览器标签 |
| 外部资源 | 无 | 不含 `<link href="http…">`、`<script src="http…">`、字体链接 |
| 挂载点 | `<div id="root"></div>` | React 根节点 |
| 入口脚本 | `<script type="module" src="/src/main.tsx"></script>` | 构建时由 Vite 处理 |

### 2.9.8 产物结构与校验

**标准构建**

```text
dist/
├─ index.html
└─ assets/
   ├─ index-[hash].js        # React + 业务（不含 jszip）
   ├─ index-[hash].css       # Tailwind 产物
   └─ scan.worker-[hash].js  # Worker + jszip + core/*
```

**单文件构建**

```text
dist-single/
└─ index.html                # HTML + 内联 CSS + 内联 JS + 内联 Worker（Blob）
```

**`verify-build.mjs` 检查项**

1. `dist-single/index.html` 存在且为唯一产物文件（允许无其他文件）。
2. HTML 中无 `src="http`、`href="http`、`@import url(http`、`url(http`。
3. HTML 包含 `Blob`/`worker` 内联标记（至少一个 `data:` 或 base64 的 Worker 载荷）。
4. 标准构建 `dist/assets` 中不存在 `*.map`。
5. 输出文件大小与预算（单文件 ≤2MB）对比，超限仅告警不阻断。

**`verify-no-network.mjs` 检查项**

1. 扫描 `src/**/*.{ts,tsx,js,mjs}` 与 `dist/**/*.{html,js,css}`。
2. 禁用标识符（词边界）：`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`、`sendBeacon`、`importScripts`、`RTCPeerConnection`。
3. 外部 URL：`https?://` 字面量；白名单为规则示例、README/注释中的说明（需 `allow-url` 标记）。
4. `dist/index.html` 的外部 `<script src>` / `<link href>` / CSS `url()`。
5. 失败时打印文件与行号（仅路径，不打印源码内容），退出码 1。

### 2.9.9 README 结构（交付要求）

| 章节 | 内容 |
|---|---|
| 项目简介 | 一句话定位、非目标 |
| 快速开始 | `npm ci` → `npm run dev`；`npm run build` + `npx serve dist`；`npm run build:single` 双击 |
| 隐私说明 | 零上传、零网络、零持久化、日志策略、扩展风险提示 |
| 规则清单 | 21 条规则表（ID/名称/级别/说明/修复建议/默认开关） |
| 已知限制 | LIM-01~07、正则误判、未闭合字符串、YAML 块标量等 |
| 免责声明 | 不替代专业工具；密钥曾进 git 历史必须轮换 |
| 验收证据 | 18 条验收用例结果、性能数据、Network 截图说明 |
| 开发说明 | 目录结构、模块职责、如何新增规则/语言、测试与校验脚本 |

## 2.10 测试与验收方案

> **口径说明**：原始提示词提到"9 条验收"，但 `spec.md` 实际定义了 **18 条**（CLS-ACC-01~18）。本设计以 spec 为准，全部覆盖；其中 P0 13 条、P1 5 条。若评审只要求 9 条，可按"P0 且自动化"子集执行，但交付证据仍建议记录 18 条。

### 2.10.1 测试分层

| 层级 | 工具 | 范围 | 运行方式 | 产出 |
|---|---|---|---|---|
| L1 纯函数单元测试 | Vitest（node 环境） | 提取器、过滤器、规则、熵、脱敏、CSV、路径、解码 | `npm run test` | 通过/失败、覆盖率（可选） |
| L2 编排集成测试 | Vitest + jszip（内存 zip） | `runJob` 全流程、炸弹、跳过统计、去重、导出快照 | `npm run test` | 与真实 Worker 相同的 core 路径 |
| L3 静态安全校验 | Node 脚本 | 零网络、产物外链、单文件完整性 | `npm run verify:*` | 退出码与文件/行号 |
| L4 手动 E2E | 浏览器 | 上传、进度、取消、过滤、展开、导出、断网、性能 | 验收清单 | README 验收证据 |
| L5 性能采样 | Chrome DevTools | Long Task、内存、滚动帧率 | 手动 | 数据记录 |

**测试文件清单**

```text
vitest.config.ts
src/core/commentExtractor/__tests__/cFamily.test.ts
src/core/commentExtractor/__tests__/hashFamily.test.ts
src/core/commentExtractor/__tests__/sql.test.ts
src/core/commentExtractor/__tests__/markup.test.ts
src/core/commentExtractor/__tests__/python.test.ts
src/core/commentExtractor/__tests__/markdown.test.ts
src/core/commentExtractor/__tests__/lua-batch.test.ts
src/core/__tests__/fileFilter.test.ts
src/core/__tests__/rules.test.ts
src/core/__tests__/entropy.test.ts
src/core/__tests__/redact.test.ts
src/core/__tests__/export.test.ts
src/core/__tests__/path.test.ts
src/core/__tests__/text.test.ts
src/core/__tests__/config.test.ts
src/workers/__tests__/jobRunner.integration.test.ts
```

**Vitest 配置要点**：`environment: 'node'`（Node 24 原生提供 `File`/`Blob`）、`include: ['src/**/*.test.ts']`、`testTimeout: 20000`（大夹具）、`pool: 'forks'`（隔离内存）。

### 2.10.2 单元/集成测试覆盖矩阵

| 模块 | 必测用例 | 对应需求 |
|---|---|---|
| `cFamily` | `//` 行注释；`/* */` 单行/跨行；`"http://"` 不误判；`'it\\'s //'` 转义；模板串跨行；`/\/\//` 正则；`a / b //` 除法；未闭合块注释；Rust 嵌套块注释 | CLS-EXT-002~004、ACC-02 |
| `hashFamily` | `#` 注释；shebang 排除；`"a # b"` 不误判；Dockerfile 行首限定；Makefile | CLS-EXT-005 |
| `sql` | `--`；`'a--b'` 不误判；`/* */` | CLS-EXT-006 |
| `markup` | `<!-- -->`；Vue `<script>` 内 `//`；`<style>` 内 `/* */`；行号偏移 | CLS-EXT-007 |
| `lua/Batch` | `--[[ ]]`；`REM`/`::`；`echo REM` 不命中 | CLS-EXT-008 |
| `python` | `#`；三引号；开关关闭；`r"""` 前缀；未闭合 | CLS-EXT-009、ACC-04、ACC-18 |
| `markdown` | 围栏内外标记；未闭合围栏；行号；`~~~` | CLS-EXT-010 |
| `fileFilter` | `node_modules` 精确段；`mybuild` 不误判；`.min.js`；2MB 边界；`src/README.js` 文档优先；`.env*` | CLS-FLT-001~010、ACC-05 |
| `rules` | ID 唯一/正则可编译/文案非空；占位符；弱口令；中文关键词；示例主机；捕获组 | CLS-RUL-001~017、ACC-10 |
| `entropy` | 高低熵边界；长度边界；字符集；128/129 位 | CLS-RUL-011、ACC-11 相关 |
| `redact` | 各 `MaskKind`；连接串/URL；私钥 BEGIN；JWT；上下文截断；全掩码兜底 | CLS-RPT-004~006、ACC-01/03 |
| `export` | BOM/CRLF；逗号/引号/换行；`=`/`+`/`-`/`@` 前置 `'`；JSON 无 raw | CLS-EXP-001~004、ACC-14/16 |
| `path` | `..`、绝对路径、盘符、控制字符、空段、超长 | CLS-NFR-015、ACC-12 |
| `text` | BOM、替换符计数、CRLF 归一、8KB UTF-8 截断 | CLS-EXT-013/014 |
| `jobRunner` | 正常流程、跳过统计、炸弹中止、取消、单文件异常继续、确定性 | CLS-INP-005~012、CLS-NFR-008/010 |

### 2.10.3 验收夹具设计

**`scripts/make-fixtures.mjs`（Node + jszip）生成 `fixtures/acceptance.zip`**

| 夹具路径 | 内容 | 覆盖用例 |
|---|---|---|
| `config.js` | `const url = "http://example.com/a"; // 正常注释` + `// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"` | ACC-01、ACC-02 |
| `README.md` | `10.20.30.40:8080`、`mysql://root:Passw0rd@10.1.2.3:3306/db`、围栏内示例 `AKIA…` | ACC-03、ACC-10 |
| `main.py` | `"""数据库密码: Admin@123"""`；`# token = abcdef123456` | ACC-04、ACC-18 |
| `main.go` | `// TODO: 测试账号 test/test 上线前删掉` | ACC-06 |
| `app.min.js` | 含一处密钥注释 | ACC-05（应跳过） |
| `node_modules/left-pad/index.js` | 普通代码 | ACC-05（忽略目录） |
| `logo.png` | 1×1 PNG 字节 | ACC-05（二进制） |
| `docs/guide/usage.rst` | 文档全文，含 `password=Admin@123` | CLS-FLT-004 |
| `src/README.js` | 名称匹配文档类，正文含连接串 | CLS-FLT-004/010 |
| `.env.production` | `DB_PASSWORD=Admin@123`、`API_KEY=your_api_key_here` | CLS-FLT-006、ACC-10 |
| `unknown.xyz` | 任意文本 | CLS-FLT-007 |
| `=SUM(A1).js` | `// password=Admin@123` | ACC-14（路径列以 `=` 开头） |
| `<img src=x onerror=alert(1)>.js` | `// password=Admin@123` | ACC-17 |
| `data.map` / `yarn.lock` | 任意内容 | CLS-FLT-002 |

**其他夹具**

| 脚本/方式 | 产物 | 说明 |
|---|---|---|
| `make-large-fixture.mjs` | `large-many.zip`（5000 个文件，每个 20KB，含 1 条命中） | ACC-07、ACC-15 |
| `make-large-fixture.mjs` | `large-one.zip`（约 100MB、50 个 ≤2MB 文件） | ACC-07 |
| `make-bomb-fixture.mjs` | `bomb.zip`（200MB 全零文件，压缩后很小） | ACC-11 |
| `make-fixtures.mjs` | `only-images.zip`（仅 `logo.png` + `node_modules/`） | ACC-13 |
| 手工截断合法 zip 末尾 100 字节 | `corrupted.zip` | CLS-INP-010 |
| 7-Zip 手动加密 | `encrypted.zip` | CLS-INP-010 |
| 手工构造条目名 `../../etc/passwd.js` | `traversal.zip` | ACC-12 |

**路径穿越夹具的实现风险**：部分 zip 写入库会规范化 `..`。`make-fixtures.mjs` 优先用 jszip 写入；若条目名被改写，改用 `scripts/make-traversal-fixture.mjs` 直接构造本地文件头与中央目录（仅写条目名，不压缩正文），确保条目名原样保留。该脚本只在本地验收使用，不进入运行期代码。

**加密包说明**：jszip 不支持写入加密条目，故加密夹具需 7-Zip/WinRAR 手动生成；README 记录生成命令与校验方式，避免验收时临时找工具。

### 2.10.4 18 条验收用例执行路径

| 编号 | 输入 | 自动化路径 | 手动路径 | 预期 |
|---|---|---|---|---|
| ACC-01 | `config.js` AWS | `rules.test` + `jobRunner.integration` | 上传 `acceptance.zip` | 1 条 critical，片段 `AKIA************MNOP` |
| ACC-02 | `"http://example.com"` | `cFamily.test`（片段仅为"正常注释"） | 同上 | 0 条；`http://` 不误判 |
| ACC-03 | README 内网 IP + 连接串 | `redact.test` + `jobRunner.integration` | 同上 | high + critical；连接串 `mysql://***:***@10.1.2.3:3306/db` |
| ACC-04 | Python docstring | `python.test` + `jobRunner.integration` | 同上 | high，`sourceKind=docstring` |
| ACC-05 | 忽略类型/目录/二进制 | `fileFilter.test` + `jobRunner.integration` | 同上 | 三者均跳过，原因正确 |
| ACC-06 | Go 测试凭证 | `rules.test` | 同上 | low（R-018） |
| ACC-07 | 100MB / 大文件 | 无（性能采样） | 上传 `large-*.zip` | 页面可交互；Long Task ≤200ms；≤60s |
| ACC-08 | 断网 | 无 | 断网打开 `dist` 与单文件 | 全流程可用 |
| ACC-09 | 正常网络 | 无 | Network 面板 | 0 条外部请求 |
| ACC-10 | 占位符 | `rules.test` | 上传夹具 | 0 命中 |
| ACC-11 | 炸弹包 | `jobRunner.integration`（内存包） | 上传 `bomb.zip` | 中止 + CLS-E-1005，页面可用 |
| ACC-12 | 路径穿越 | `path.test` + `jobRunner.integration` | 上传 `traversal.zip` | 拒绝并登记 `illegal-path` |
| ACC-13 | 仅图片 + node_modules | `jobRunner.integration` | 上传专用夹具 | CLS-E-1007 + 跳过分布，不显示成功态 |
| ACC-14 | `=` 开头路径 | `export.test` | 导出 CSV，Excel 打开 | 单元格前置 `'`，不执行公式 |
| ACC-15 | 5000 条命中 | 无（渲染采样） | 上传 `large-many.zip` | 滚动 ≥30fps；过滤 ≤300ms |
| ACC-16 | 展开后导出 | `export.test`（scrub 不含 raw） | 展开一条后导出 JSON | 检索不到完整值 |
| ACC-17 | XSS 文件名 | `jobRunner.integration`（路径保留） | 上传夹具 | 纯文本显示，无脚本执行 |
| ACC-18 | docstring 开关 | `python.test` | 关闭开关重扫 | docstring 命中消失，`#` 命中保留 |

**执行顺序建议（验收当天）**

1. `npm ci` → `npm run lint` → `npm run test`（全部自动化用例）。
2. `npm run fixtures` → `npm run build` → `npm run verify:network`。
3. `npx serve dist` → 浏览器执行 ACC-01~06、10、12~14、16~18。
4. 断网重复 ACC-08；Network 面板记录 ACC-09。
5. `npm run build:single` → 双击 `dist-single/index.html` → 重复核心流程（ACC-08）。
6. 性能夹具执行 ACC-07、ACC-15，记录数据到 README。

### 2.10.5 性能与安全专项验证步骤

**性能（ACC-07 / ACC-15）**

1. Chrome 最新版，8 核 / 16GB / 本地 SSD；关闭无关扩展。
2. DevTools Performance 开始录制 → 上传 `large-many.zip` → 扫描完成 → 停止录制。
3. 检查 Long Task：最长 ≤200ms；主线程在扫描期间可展开"忽略规则"面板。
4. Chrome 任务管理器记录扫描峰值内存（目标 ≤1.5GB）。
5. 5000 条结果滚动 10 秒，Performance 采样帧率 ≥30fps；切换"仅 critical"记录响应 ≤300ms。
6. 记录总耗时（目标 ≤60s）与各阶段耗时（Worker 回传的计数）。

**零网络（ACC-09）**

1. DevTools Network 勾选 `Fetch/XHR/WS/Other`，清空记录。
2. 完成上传→扫描→过滤→展开→导出 JSON/CSV→复制路径。
3. 断言外部请求数 = 0；本地页面资源（`index.html`、JS、CSS、Worker）除外。
4. 断开网络（DevTools Offline 或系统断网）重复全流程（ACC-08）。

**单文件（ACC-08）**

1. `npm run build:single` → 产物目录仅 `index.html`。
2. 双击打开（`file://`）；完成上传→扫描→导出。
3. 若 Worker 被拒，应出现性能提示并仍可完成扫描（降级）。
4. 剪贴板不可用时，出现"手动选择文本复制"降级（不是静默失败）。

**展开与导出（ACC-16）**

1. 展开某条完整内容 → 导出 JSON/CSV。
2. 在导出文件中检索完整值（如 `AKIAABCDEFGHIJKLMNOP`、`Passw0rd`），必须 0 命中。
3. Application 面板检查 Storage/IndexedDB/Cache，无扫描内容。

### 2.10.6 通过标准与回归

| 项 | 通过标准 |
|---|---|
| 类型与构建 | `tsc --noEmit` 无错误；`npm run build` 与 `build:single` 均成功 |
| 单元/集成测试 | 全部通过；核心模块（提取、规则、脱敏、导出、路径）用例覆盖需求矩阵 |
| P0 验收 | 13 条全部通过；任何一条失败视为交付失败 |
| P1 验收 | 5 条通过或记录明确偏差与影响 |
| 零网络 | 静态校验退出码 0 + Network 面板 0 外部请求 + 断网全流程可用 |
| 性能 | 达到 CLS-NFR-001~006 的预算或记录偏差与原因 |
| 文档 | README 章节齐全；规则表 21 条与代码一致；已知限制与免责声明完整 |
| 回归触发 | 规则变更、提取器变更、依赖升级、构建配置变更时，必须重跑 L1~L4 |

## 2.11 风险与权衡

### 2.11.1 主要风险

| 编号 | 风险 | 概率 | 影响 | 缓解 | 残余风险 |
|---|---|---|---|---|---|
| R-01 | JS 正则字面量启发式误判，导致漏检或误检 | 中 | 中 | 明确判定顺序与 token 集合；README 已知限制；ACC-02 覆盖 | 复杂表达式仍可能误判 |
| R-02 | 模板字符串 `${}` 内注释不提取 | 中 | 低 | README 明示；常见密钥不在表达式内 | 嵌套注释可能漏检 |
| R-03 | jszip 内部 `_data.uncompressedSize` 非公开 API，升级后失效 | 中 | 高（炸弹预检失效） | 窄接口隔离；字段缺失时回退实际读取 + 2MB 上限；锁版本 | 未知大小超大条目仍可能分配内存 |
| R-04 | 单条注释 1MB 导致正则回溯 | 低 | 高 | 8KB 截断；规则模式评审；取消可 terminate | 极端模式仍可能超时 |
| R-05 | 100MB zip + 结果 + raw 接近内存红线 | 中 | 中 | 逐条释放；raw 16MB 上限；分页渲染；总量 500MB 上限 | 低内存设备可能触发浏览器回收 |
| R-06 | 保留命中 raw 与 CLS-INP-012"仅保留脱敏结果"存在张力 | 高（设计张力） | 中 | 仅保留命中片段（≤8KB/条，总量 16MB）；不保留整文件；不导出/不日志/刷新即失；README 说明 | 严格审计可能要求完全移除展开能力 |
| R-07 | 单文件构建下 Blob Worker 被浏览器拒绝 | 中 | 中 | 主线程降级 + 明确提示；ACC-08 覆盖 | 降级时大文件可能卡顿 |
| R-08 | `file://` 下剪贴板不可用 | 高 | 低 | `<textarea>` 降级与提示 | 用户需手动复制 |
| R-09 | 规则覆盖不足，漏检新型密钥 | 中 | 高（安全） | 数据驱动可扩展；README 声明不替代专业工具 | 不能保证全覆盖 |
| R-10 | 误报导致用户疲劳 | 中 | 中 | 占位符/示例抑制；规则分级；可疑示例排序靠后 | 内网域名/测试凭证仍可能误报 |
| R-11 | 供应链依赖被投毒 | 低 | 高 | 依赖最小化、lockfile、无 postinstall、产物扫描 | 静态扫描无法证明依赖无恶意代码 |
| R-12 | Safari 16.4+ 兼容性差异（Worker/Blob/剪贴板） | 中 | 低 | 主线程降级；不使用新 API；README 标注"尽力兼容" | 部分交互降级 |
| R-13 | 18 条验收中 5 条依赖手动，证据主观 | 中 | 中 | 固定步骤、记录数据、截图/日志；性能夹具可复现 | 人工采样存在波动 |
| R-14 | 结果表 5000 条渲染卡顿 | 低 | 中 | 分页 200 + `content-visibility` + `useMemo` | 极端过滤组合可能慢 |
| R-15 | 规则数据与 README 不同步 | 中 | 低 | `RULE_SET_VERSION`；单测断言规则数与必填文案；README 更新列入验收 | 人工维护仍有遗漏 |

### 2.11.2 关键权衡说明

1. **准确率 vs 体积/复杂度**：不引入 AST/tree-sitter，换取零额外运行时与离线可用；代价是词法级误判。该权衡符合 CLS-EXT-004 的"允许极少数歧义"。
2. **安全 vs 可用性（二次确认）**：保留命中 raw 是为了满足"展开完整内容"；通过内存上限、不导出、不日志、刷新即失控制风险。若安全评审要求更严，可移除展开能力，仅保留脱敏片段与上下文。
3. **性能 vs 实现复杂度**：不使用虚拟滚动库，采用分页；5000 条场景下更易验证与维护，代价是跨页浏览不如连续滚动流畅。
4. **兼容性 vs 单文件**：Worker 使用 classic/iife + inline，放弃 module worker 的现代加载方式，换取 `file://` 与旧浏览器可用；标准构建同样使用 iife，减少两套行为差异。
5. **零网络验证方式**：不 monkey-patch 全局网络 API，避免副作用；依赖静态扫描 + Network 面板 + 断网验收，代价是静态扫描可能漏检混淆代码（本项目为自研源码，可信度较高）。
6. **规则数量 vs spec 一致性**：为满足"不同级别"与"中文关键词/弱口令"验收，规则从 20 条调整为 21 条（邮箱/手机号拆分）并扩展 R-011 关键词；README 规则表与导出 `ruleCatalog` 必须同步，这是对 spec 的必要实现细化，不改变需求意图。

### 2.11.3 设计约束回顾（不可在实现阶段随意更改）

| 约束 | 原因 |
|---|---|
| 规则匹配只接收 `CommentSnippet`，禁止整文件正则 | CLS-EXT-012 的验收与审计点 |
| `Finding` 类型不得出现 raw 字段 | CLS-PRV-003、CLS-EXP-004 |
| 不使用 localStorage/sessionStorage/IndexedDB/Cache API | CLS-PRV-003 |
| 不引入网络客户端与外部资源 | CLS-PRV-001/005 |
| 解压必须逐条读取并及时释放 | 内存红线与 CLS-INP-012 |
| 路径非法条目必须登记而非静默丢弃 | CLS-NFR-015、CLS-FLT-007 |
| 脱敏只有 `redact.ts` 一个实现 | 防止 UI/导出不一致导致泄露 |
| 单作业串行，取消后旧 jobId 消息丢弃 | CLS-NFR-011、CLS-INP-007 |
| 单文件构建必须自包含且可 `file://` 运行 | CLS-BLD-003、CLS-NFR-028 |

---

**设计文档结束**。本文件仅描述"如何构建"，不包含应用代码、任务分解或实现顺序；后续任务拆分由 `spec-task-agent` 负责。