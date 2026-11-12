# CommentLeak Scanner 需求规格说明书（EARS）

> **文档状态**：待评审　**版本**：1.0　**日期**：2026-11-12　**需求编号前缀**：CLS
> **适用对象**：产品、研发、测试、安全评审
> **一句话定位**：纯前端、零上传的「注释与文档敏感信息」提交前自查工具。

---

## 0. 阅读指南

### 0.1 需求编号规则

| 前缀 | 业务域 | 说明 |
|---|---|---|
| CLS-INP | 文件接收与解压 | 上传、校验、解压、炸弹防护、取消、资源释放 |
| CLS-FLT | 扫描范围判定 | 忽略规则、白名单、跳过登记 |
| CLS-EXT | 注释提取 | 按语言提取注释/文档内容、行号与围栏标记 |
| CLS-RUL | 敏感信息检测 | 规则集、级别、去重、误报抑制 |
| CLS-RPT | 结果与脱敏 | 统计、结果表、过滤、脱敏、上下文、成功态 |
| CLS-EXP | 报告导出 | JSON、CSV、路径复制 |
| CLS-UIX | 界面与交互 | 布局、主题、响应式、文案、可访问性 |
| CLS-PRV | 隐私与安全 | 零网络、零上传、零持久化、日志、依赖 |
| CLS-BLD | 交付与构建 | 技术栈、双构建、README、自测证据 |
| CLS-NFR | 非功能约束 | 性能、可靠性、安全、可维护性、兼容性 |
| CLS-ACC | 验收用例 | 端到端可执行验收场景 |

### 0.2 优先级定义

| 优先级 | 含义 | 交付要求 |
|---|---|---|
| P0 | 核心必需 | 缺失即视为本次交付失败，验收阻塞 |
| P1 | 本次应交付 | 在 P0 完成后必须实现，纳入验收 |
| P2 | 可选 / 默认关闭 | 可交付为开关能力，不影响主流程 |

### 0.3 需求陈述规范（EARS）

所有需求采用 EARS 五种模式，保留英文触发词，变量部分使用中文：

- **事件驱动**：`When <事件>, the CommentLeak Scanner shall <响应>`
- **状态驱动**：`While <前置状态>, the CommentLeak Scanner shall <响应>`
- **异常驱动**：`If <异常触发>, then the CommentLeak Scanner shall <响应>`
- **可选特性**：`Where <可选特性启用>, the CommentLeak Scanner shall <响应>`
- **通用约束**：`The CommentLeak Scanner shall <响应>`

每条需求必须可测试，验收标准采用「输入/操作 → 可观察结果」形式。

---

## 1. 组件定位

### 1.1 核心职责

本组件负责在浏览器本地对用户提交的源码包中**注释与文档内容**进行敏感信息检测，实现提交前「零上传」自查与风险报告。

### 1.2 核心输入

1. **压缩包**：用户显式选择或拖入的 `.zip` 文件（≤100MB），来源为本地文件系统。
2. **本地文件夹**：用户显式拖入的目录（P1 加分项），来源为本地文件系统。
3. **扫描配置**：忽略规则组开关、Python docstring 扫描开关、邮箱/手机号规则开关等，来源为用户在界面上的操作。
4. **操作指令**：开始扫描、取消、过滤、排序、折叠、导出、复制路径、二次确认查看完整内容。

### 1.3 核心输出

1. **扫描进度**：当前阶段（校验/解压/筛选/提取/检测/完成）、百分比、已处理条目数、当前文件路径。
2. **扫描报告**：统计摘要、命中列表（文件路径、行号、规则、级别、脱敏片段、上下文）、未扫描文件清单及原因。
3. **导出产物**：JSON 报告、CSV 报表、命中文件路径文本，均在本地生成并交由浏览器下载/剪贴板。
4. **状态反馈**：进度态、成功态（未发现风险）、错误态（含具体原因与错误码）。

### 1.4 职责边界（不做什么）

- **不做后端**：无服务端接口、无账号体系、无云端历史记录、无团队协作。
- **不上传、不联网**：不产生任何外部网络请求，不引入埋点、CDN、远程字体。
- **不扫描业务代码正文**：仅扫描注释；`Markdown/README` 文档、`.env` 类配置文件除外（全量）。用户手动开启的"邮箱/手机号"规则仍只作用于已提取的注释/文档片段。
- **不自动修复**：不改写、不删除、不格式化用户代码。
- **不替代专业工具**：不做 git 历史扫描，不保证覆盖所有密钥形态，不提供密钥轮换能力。
- **不做持久化**：不在浏览器存储中保存任何扫描内容或命中片段。
- **不引入重量级语法分析**：不使用 acorn/tree-sitter 等 AST 解析器。
- **不做登录、支付、多租户、IDE/CI 插件**。

---

## 2. 领域术语

**注释片段（Comment Snippet）**
: 从某个文件中按语言规则提取出的一段注释或文档内容，携带其在原文件中的 1-based 起始行号。

**文档类文件（Document File）**
: 以 `.md/.markdown/.mdx/.rst/.txt/.adoc` 结尾，或文件名匹配 `README*/CONTRIBUTING*/CHANGELOG*/SECURITY*`，或位于任意 `docs/` 目录下的文本文件；其全文参与检测。

**代码类文件（Code File）**
: 扩展名在扫描白名单内、但仅提取注释参与检测的源文件。

**配置文件（Config File）**
: 以 `.env` 开头的文件，按全量键值内容参与检测，不按注释提取处理。

**命中（Finding）**
: 某条检测规则在某个注释片段/文档内容中匹配成功所产生的一条风险记录。

**脱敏片段（Masked Snippet）**
: 对命中原文按固定策略掩码后用于展示与导出的字符串，不得还原出完整敏感值。

**疑似示例（Sample Suspect）**
: 命中位于 Markdown 代码围栏（```）内时附加的标记，表示该值可能是文档示例而非真实凭证，展示排序靠后，但级别不改变。

**忽略规则组（Ignore Group）**
: 一组可整体启停的跳过规则，例如"依赖目录组""构建产物组""二进制扩展名组""单文件体积组"。

**风险等级（Severity）**
: 取值为 `critical / high / medium / low` 之一，用于表示命中项的危险程度与处置紧迫性。

**扫描作业（Scan Job）**
: 一次从文件接收到报告产出的完整处理过程，只能存在一个活动作业。

**跳过文件（Skipped File）**
: 未参与检测的文件，必须登记其路径、跳过原因与体积，不得静默丢弃。

**zip 炸弹（Zip Bomb）**
: 通过超高压缩比或超大解压总量使客户端耗尽内存/CPU 的恶意压缩包特征。

**二次确认查看（Reveal Confirm）**
: 用户查看完整命中内容前的显式风险确认动作，确认后仅当前页面内存展开，不写日志、不持久化。

**失败开放（Fail-Loud）**
: 任何无法完成的处理都必须以具体原因告知用户，禁止静默失败或吞掉异常。

---

## 3. 角色与边界

### 3.1 核心角色

- **开发者 / 提交者**：在推送开源仓库前上传本地代码包，执行自查，查看并处理命中项，导出报告附在 PR 中。
- **安全审查者 / 代码评审人**：接收导出的报告或路径清单，复核风险分布与处置结果。

### 3.2 外部系统

- **本地文件系统**：提供用户显式选择的 `.zip` 文件或目录内容（只读，浏览器 File API）。
- **浏览器下载 / 剪贴板**：承接用户显式触发的报告下载与路径清单复制。
- **外部网络服务**：**不存在调用关系**；本组件与其交互恒为空（硬性禁止）。

### 3.3 交互上下文

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
skinparam componentStyle rectangle

actor "开发者 / 提交者" as Dev
actor "安全审查者 / 评审人" as Rev
rectangle "CommentLeak Scanner\n（纯前端单页工具）" as CLS
storage "本地文件系统\n（用户显式选择，只读）" as FS
cloud "外部网络服务" as NET

Dev --> CLS : 上传 zip / 文件夹、启动扫描、导出
Rev --> CLS : 查看 / 过滤 / 复制风险路径
CLS --> FS : 读取所选内容（仅浏览器内存）
CLS ..> NET : 禁止建立任何连接
note right of CLS : 无后端、无上传、无埋点、无持久化
@enduml
```

---

## 4. DFX 约束

### 4.1 性能

| 编号 | 约束 | 验证基准 |
|---|---|---|
| CLS-NFR-001 | 100MB、5000 条目的 zip 解压 + 扫描总耗时 ≤ 60s | Chrome 最新版，8 核 / 16GB，本地 SSD |
| CLS-NFR-002 | 单文件注释提取耗时 ≤ 200ms（文件 ≤ 2MB） | 同上，Worker 内计时 |
| CLS-NFR-003 | 扫描期间主线程单次长任务 ≤ 200ms，页面保持可交互 | Performance 面板 Long Task 检查 |
| CLS-NFR-004 | 命中 5000 条时结果表滚动帧率 ≥ 30fps | 表格滚动采样 |
| CLS-NFR-005 | 浏览器内存峰值 ≤ 1.5GB（解压总量受 500MB 上限约束） | Chrome 任务管理器采样 |
| CLS-NFR-006 | 进度信息更新间隔 ≤ 200ms，且单调不回退 | 人工观察 + 日志计数 |

### 4.2 可靠性

| 编号 | 约束 |
|---|---|
| CLS-NFR-007 | 断网环境下，`dist` 与单文件构建产物功能完全可用（零外部依赖）。 |
| CLS-NFR-008 | 单个文件解析/提取失败不得中断整体作业，应记录为"解析失败"跳过项并继续。 |
| CLS-NFR-009 | 后台扫描任务异常终止时，界面必须显示含错误码与原因的错误态，禁止白屏。 |
| CLS-NFR-010 | 相同输入与相同配置重复扫描，命中集合与排序结果一致（确定性）。 |
| CLS-NFR-011 | 作业进行中重复上传应被阻止或先取消当前作业，不得并发运行两个作业。 |

### 4.3 安全性

| 编号 | 约束 |
|---|---|
| CLS-NFR-012 | 运行期对外网络请求数恒为 0；源码中不得存在指向外部地址的 `fetch / XMLHttpRequest / sendBeacon / WebSocket`。 |
| CLS-NFR-013 | 任何扫描内容、命中片段不得写入 localStorage / sessionStorage / IndexedDB / Cache API。 |
| CLS-NFR-014 | 生产代码不得 `console.log` 命中内容，仅允许输出计数、耗时、错误码等非敏感信息。 |
| CLS-NFR-015 | 压缩包条目路径中的 `..` / 绝对路径必须被拒绝并登记，防止通过路径伪装规避忽略规则。 |
| CLS-NFR-016 | 文件路径、注释内容在界面渲染时按纯文本处理，禁止作为 HTML 注入（防 XSS）。 |
| CLS-NFR-017 | 完整敏感值默认永不可见；查看前必须二次确认，且不进入剪贴板、日志、导出文件。 |

### 4.4 可维护性

| 编号 | 约束 |
|---|---|
| CLS-NFR-018 | 检测规则以数据数组定义，新增/调整规则不修改扫描编排逻辑。 |
| CLS-NFR-019 | 语言与提取器的映射关系集中维护，新增语言仅需增加映射与提取器。 |
| CLS-NFR-020 | 核心逻辑（筛选、提取、脱敏、导出转义）为纯函数，可独立单元测试。 |
| CLS-NFR-021 | 错误统一使用 `CLS-E-xxxx` 错误码，并在界面展示"原因 + 建议动作"。 |
| CLS-NFR-022 | README 必须包含规则清单表、隐私说明、验收证据与免责声明，规则变更时同步更新。 |

### 4.5 兼容性与交付约束

| 编号 | 约束 |
|---|---|
| CLS-NFR-023 | 支持 Chrome / Edge 最近 2 个主版本、Firefox 最近 2 个主版本；Safari 16.4+ 尽力兼容。 |
| CLS-NFR-024 | 技术栈固定为 Vite + React + TypeScript + Tailwind CSS，全部依赖本地打包，不使用任何运行时联网 SDK / CDN / 远程字体。 |
| CLS-NFR-025 | 交付两个构建入口：`npm run build`（可由 `npx serve dist` 运行）与 `npm run build:single`（产出可双击打开的单文件 `index.html`）。 |
| CLS-NFR-026 | 源码结构必须包含 `src/core/unzip.ts`、`fileFilter.ts`、`commentExtractor/`、`rules.ts`、`scanner.ts`、`redact.ts`、`workers/scan.worker.ts`、`ui/*`、`types.ts`。 |
| CLS-NFR-027 | 不得出现占位实现、TODO 桩函数或"演示用假数据"；每个模块必须真实跑通。 |
| CLS-NFR-028 | 单文件构建需在 `file://` 协议下可用，不依赖 Service Worker、不依赖绝对资源路径。 |

---

## 5. 核心能力

### 5.1 文件接收与解压

#### 5.1.1 业务规则（EARS）

##### CLS-INP-001 · 上传入口（拖拽 / 点击 / 文件夹） `P0`

**EARS**：When 用户将文件拖入拖拽区、将文件夹拖入拖拽区，或点击"选择压缩包"并在系统文件选择器中确认选择，the CommentLeak Scanner shall 在浏览器本地接收该输入并进入校验流程，且不发起任何网络请求。

**验收标准**

- 点击"选择压缩包"→ 文件选择器仅展示 `.zip`；取消选择后页面状态不变。
- 拖入合法 `.zip` → 拖拽区高亮并显示文件名、体积，松手后 300ms 内进入解压态。
- 拖入普通文本/链接 → 提示"请拖入 `.zip` 压缩包或文件夹"，不进入解压态。

##### CLS-INP-002 · 文件类型校验 `P0`

**EARS**：If 接收到的条目不是 `.zip` 文件且不是文件夹输入，then the CommentLeak Scanner shall 拒绝处理并显示"仅支持 .zip 压缩包，当前文件为 `<扩展名>`"，同时保留重新选择入口。

**验收标准**

- 选择 `a.rar` / `a.tar.gz` / `a.txt` → 显示上述具体提示，不读取内容。
- 选择 `A.ZIP`（大写扩展名）→ 应被接受（扩展名判定不区分大小写）。

##### CLS-INP-003 · 压缩包体积上限 `P0`

**EARS**：If 压缩包字节数超过 100MB，then the CommentLeak Scanner shall 在读取内容前中止，并显示"压缩包大小 `<X>` MB，超过 100 MB 上限，请拆分后重试"。

**验收标准**

- 100.01MB 文件 → 拒绝，显示含实际体积的具体提示。
- 恰好 100MB（按 100×1024×1024 字节）→ 接受并进入解压。
- 校验阶段不得读取/解压任何条目。

##### CLS-INP-004 · 本地文件夹直接读取 `P1`

**EARS**：Where 运行环境支持目录读取能力（`webkitdirectory` 或 `DataTransferItem` 递归读取），the CommentLeak Scanner shall 递归枚举所选文件夹内的文件，在内存中构造与 zip 等价的文件清单，并同样应用单文件 2MB 上限与全部忽略规则。

**验收标准**

- 拖入含 20 个文件的文件夹 → 扫描文件数 + 跳过文件数 = 20（不含被忽略目录内文件，且忽略项登记在跳过原因中）。
- 文件夹内不存在的 `.zip` 解压阶段应被跳过，直接进入筛选。

##### CLS-INP-005 · 解压进度可见 `P0`

**EARS**：While 解压正在进行，the CommentLeak Scanner shall 持续显示阶段名、百分比、已处理条目数与当前条目名；当条目数 ≥ 100 时，进度更新间隔不得超过 200ms。

**验收标准**

- 5000 条目 zip → 进度从 0% 单调递增至 100%，无回退、无长时间停滞（> 2s）。
- 当前条目名过长的路径应中间省略展示，不撑破布局。

##### CLS-INP-006 · 主线程不被阻塞 `P0`

**EARS**：While 解压或扫描作业进行中，the CommentLeak Scanner shall 保持界面可交互（可展开忽略规则、可点击取消、可滚动），主线程不得出现超过 200ms 的无响应窗口。

**验收标准**

- 100MB zip 处理期间点击"忽略规则"面板 → 面板正常展开。
- Performance 面板记录的最长 Long Task ≤ 200ms。

##### CLS-INP-007 · 作业取消 `P0`

**EARS**：While 解压或扫描进行中，the CommentLeak Scanner shall 提供"取消"操作；When 用户点击取消，the CommentLeak Scanner shall 在 1s 内终止后台处理、丢弃未完成结果并回到可重新上传状态，同时显示"已取消本次扫描"。

**验收标准**

- 扫描中点击取消 → 1s 内回到上传态，进度条消失，出现"已取消"提示。
- 取消后再次上传 → 可正常开始新作业，旧作业不残留进度事件。

##### CLS-INP-008 · zip 炸弹防护 `P0`

**EARS**：If 解压累计输出字节数超过 500MB，或单个条目的解压后/压缩后体积比超过 100 且解压后体积超过 10MB，then the CommentLeak Scanner shall 立即中止解压、释放已占用内存，并显示"检测到异常压缩内容（解压总量或压缩比超限），已中止扫描"。

**验收标准**

- 构造高压缩比炸弹包（200MB 全零文件）→ 中止，显示上述提示，页面不崩溃。
- 正常 100MB 源码包（压缩比 ~3:1）→ 不被误判中止。

##### CLS-INP-009 · 非法路径条目 `P0`

**EARS**：If 压缩包内某条目路径包含 `..` 段、以 `/` 或盘符开头、或包含非法控制字符，then the CommentLeak Scanner shall 拒绝该条目，将其登记为"非法路径条目"跳过项，并在报告中提示存在可疑压缩包结构。

**验收标准**

- 含 `../../etc/x.js` 的 zip → 该条目不出现在扫描结果，跳过原因显示"非法路径条目"。
- 正常 `src/app.js` → 正常参与扫描。

##### CLS-INP-010 · 损坏 / 加密压缩包 `P0`

**EARS**：If 压缩包无法解析或包含加密条目，then the CommentLeak Scanner shall 中止当前作业并显示具体原因："压缩包已损坏，无法读取第 `<N>` 个条目"或"压缩包包含加密条目，无法在本地读取，请先解压后重新打包"。

**验收标准**

- 截断的 zip → 显示损坏提示，含条目序号。
- 加密 zip → 显示加密提示，不显示"扫描失败"等笼统文案。

##### CLS-INP-011 · 无可扫描文件 `P0`

**EARS**：If 压缩包内不存在任何符合扫描条件的文本文件，then the CommentLeak Scanner shall 显示"压缩包内未找到可扫描的文本文件"，并列出跳过文件总数及前 5 类跳过原因分布。

**验收标准**

- 仅含图片与 `node_modules` 的 zip → 显示该文案，并展示"二进制文件 8 个 / 忽略目录 120 个"类明细。
- 不得展示空白结果表或误导性的"未发现风险"成功态。

##### CLS-INP-012 · 原始内容及时释放 `P0`

**EARS**：When 扫描作业完成、被取消或用户重新上传，the CommentLeak Scanner shall 释放已解压文件内容，仅保留脱敏结果、统计与跳过清单，不长期驻留原始文件字节。

**验收标准**

- 扫描完成后连续上传第二个包 → 内存占用不随作业次数线性增长（±10% 内）。
- 页面刷新后无任何扫描内容残留（见 CLS-PRV-003）。

#### 5.1.2 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
participant "界面（可见页面）" as UI
participant "后台扫描任务" as BG

U -> UI : 拖入 zip / 选择文件 / 拖入文件夹
UI -> UI : 校验类型与大小（≤100MB）
UI -> BG : 移交文件字节（仅本地内存）
BG -> BG : 解压 → 炸弹与路径校验
BG -> BG : 文件筛选 → 注释提取 → 规则匹配 → 脱敏
BG --> UI : 进度（阶段/百分比/当前条目）[持续]
BG --> UI : 结果（统计/命中/跳过清单）
UI -> UI : 渲染结果表或"未发现风险"成功态
U -> UI : 过滤 / 折叠 / 导出 / 二次确认查看
@enduml
```

#### 5.1.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 非 zip 文件 | 上传扩展名非 `.zip` | 不读取内容，状态不变 | "仅支持 .zip 压缩包，当前文件为 `.rar`" |
| 超限压缩包 | 压缩包 > 100MB | 不读取内容 | "压缩包大小 120.4 MB，超过 100 MB 上限，请拆分后重试" |
| 压缩包损坏 | 解析异常 | 终止作业并释放资源 | "压缩包已损坏，无法读取第 12 个条目"（CLS-E-1003） |
| 加密压缩包 | 条目加密标志 | 终止作业 | "压缩包包含加密条目，无法在本地读取，请先解压后重新打包"（CLS-E-1004） |
| 压缩炸弹 | 总量 > 500MB 或比例异常 | 终止并释放内存 | "检测到异常压缩内容（解压总量或压缩比超限），已中止扫描"（CLS-E-1005） |
| 非法路径条目 | 条目含 `..`/绝对路径 | 拒绝该条目并登记 | 跳过清单显示"非法路径条目"（CLS-E-1006） |
| 无可扫描文件 | 筛选后扫描集合为空 | 停止流程 | "压缩包内未找到可扫描的文本文件" + 跳过原因分布（CLS-E-1007） |
| 后台任务异常 | 后台线程崩溃 | 清理资源、回到上传态 | "扫描引擎异常终止（CLS-E-1008），请重试或刷新页面" |
| 作业取消 | 用户点击取消 | 终止任务、丢弃中间结果 | "已取消本次扫描" |

---

### 5.2 扫描范围判定

#### 5.2.1 业务规则（EARS）

##### CLS-FLT-001 · 默认忽略目录 `P0`

**EARS**：The CommentLeak Scanner shall 默认忽略路径中任意层级命中 `node_modules/`、`.git/`、`dist/`、`build/`、`out/`、`vendor/`、`.venv/`、`__pycache__/`、`target/`、`coverage/` 的文件，并将它们计入"忽略目录"跳过统计。

**验收标准**

- `node_modules/left-pad/index.js` → 不扫描，跳过原因"忽略目录（node_modules）"。
- `src/build/report.md` → 不扫描（目录名精确匹配 `build/` 段）。
- `mybuild/app.js` → 正常参与扫描（不得按子串误判）。

##### CLS-FLT-002 · 默认忽略文件类型 `P0`

**EARS**：The CommentLeak Scanner shall 默认忽略 `*.min.js`、`*.map`、`*.lock`、`package-lock.json`、`yarn.lock`、`pnpm-lock.yaml`，以及图片、字体、音视频、压缩包、可执行文件等二进制扩展名。

**验收标准**

- `app.min.js`、`data.map`、`yarn.lock`、`logo.png`、`font.woff2`、`movie.mp4` → 均不扫描且登记跳过原因。
- `app.js`、`README.md` → 正常扫描。

##### CLS-FLT-003 · 单文件体积上限 `P0`

**EARS**：If 单个文件解压后体积超过 2MB，then the CommentLeak Scanner shall 跳过该文件，并在跳过清单中记录原因"文件超过 2MB"与实际体积。

**验收标准**

- 2.01MB 的 `.md` → 跳过；2.00MB → 扫描。
- 跳过项数量计入统计，不显示为"扫描失败"。

##### CLS-FLT-004 · 文档类文件全量扫描 `P0`

**EARS**：The CommentLeak Scanner shall 对扩展名为 `.md`、`.markdown`、`.mdx`、`.rst`、`.txt`、`.adoc` 的文件，以及文件名（不区分大小写）匹配 `README*`、`CONTRIBUTING*`、`CHANGELOG*`、`SECURITY*` 的文件、任意层级 `docs/` 目录下的文本文件执行**全文**检测。

**验收标准**

- `readme.md`、`ReadMe.txt`、`README_zh.markdown`、`docs/guide/usage.rst` → 均全文扫描。
- `docs/logo.png` → 仍按二进制忽略。
- `src/README.js`（名称匹配）→ 按文档类全文扫描，优先于代码类注释规则。

##### CLS-FLT-005 · 代码类文件仅注释扫描 `P0`

**EARS**：The CommentLeak Scanner shall 对下列扩展名执行"仅注释"检测：`.js .jsx .ts .tsx .mjs .cjs .vue .svelte .java .kt .scala .groovy .go .rs .c .h .cc .cpp .hpp .cs .php .swift .m .mm .py .rb .sh .bash .zsh .fish .ps1 .lua .r .pl .sql .yaml .yml .toml .ini .conf .cfg .properties .html .htm .xml .css .scss .less .sass .gradle .hcl .tf`，以及文件名匹配 `Dockerfile*`、`Makefile*`、`*.gradle`、`*.tf` 的文件。

**验收标准**

- `src/config.js` 正文 `const url = "http://example.com"` 不被检测，其 `//` 注释参与检测。
- `Dockerfile.prod`、`Makefile`、`build.gradle`、`main.tf` → 进入注释提取流程。

##### CLS-FLT-006 · `.env` 类配置文件全量扫描 `P0`

**EARS**：Where 文件以 `.env` 开头（如 `.env`、`.env.local`、`.env.production`），the CommentLeak Scanner shall 将其归类为配置文件并执行全量键值检测，不按注释提取处理。

**验收标准**

- `.env.production` 中 `DB_PASSWORD=Admin@123` → 命中（high），且不要求该行含注释符号。
- `.env` 中 `API_KEY=your_api_key_here` → 命中占位符排除规则，不产生风险。

##### CLS-FLT-007 · 未识别文件登记 `P0`

**EARS**：If 文件的扩展名不在文档类/代码类/配置类白名单内，then the CommentLeak Scanner shall 跳过该文件，并在报告"未扫描文件"清单中列出路径与原因"未支持的扩展名"，不得静默丢弃。

**验收标准**

- `data.xyz`、`script.php7`、`unknown` → 出现在未扫描清单，且计数一致。
- 跳过清单可展开查看前 100 条，超出部分显示总数与"导出 JSON 查看全部"。

##### CLS-FLT-008 · 忽略规则可视化与开关 `P0`

**EARS**：The CommentLeak Scanner shall 在界面中展示当前生效的忽略规则组（目录组、构建产物组、锁文件组、二进制组、大文件组、未识别扩展名策略），并允许用户按组启用/禁用；When 用户修改开关并确认，the CommentLeak Scanner shall 提示"规则已变更，重新扫描后生效"，不自动重扫。

**验收标准**

- 关闭"忽略目录组"并重新上传同一包 → `node_modules` 内文件进入扫描（受 2MB 限制）。
- 界面展示的规则与代码内实际规则一致（文案可核对）。
- 开关状态仅保存在内存，刷新后恢复默认。

##### CLS-FLT-009 · 跳过原因统计 `P1`

**EARS**：The CommentLeak Scanner shall 按原因分类统计跳过文件数（忽略目录、忽略类型、超大文件、未识别扩展名、非法路径、解析失败），并允许用户在结果区查看每类明细。

**验收标准**

- 跳过总数 = 各分类之和，无漏计。
- 分类名称与界面文案一致，可被导出 JSON 引用。

##### CLS-FLT-010 · 特殊文件名大小写与变体 `P0`

**EARS**：The CommentLeak Scanner shall 对文件名匹配忽略大小写（如 `ReadMe.MD`、`dockerfile`、`Makefile.am`、`SECURITY.txt`），并优先按文档类规则处理同名文件。

**验收标准**

- `dockerfile`、`Dockerfile.dev`、`DOCKERFILE` → 均被识别。
- `security.md` → 文档类全文扫描。

#### 5.2.2 交互流程

本模块嵌入主流程（5.1.2）的"文件筛选"步骤，无独立用户交互；用户唯一可操作点为**忽略规则组开关**（见 CLS-FLT-008）。

#### 5.2.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 全部被忽略 | 筛选后集合为空 | 转 CLS-INP-011 流程 | "压缩包内未找到可扫描的文本文件" |
| 忽略规则冲突 | 同一文件同时命中"文档类全量"与"代码类注释" | 按文档类全量处理，只产生一份结果 | 结果表仅出现一条来源标记"文档" |
| 开关全关 | 用户关闭所有忽略组 | 仍受 2MB 与 500MB 硬上限约束 | 提示"体积上限为安全硬限制，不可关闭" |

---

### 5.3 注释提取

#### 5.3.1 业务规则（EARS）

##### CLS-EXT-001 · 按语言分派提取器 `P0`

**EARS**：When 文件通过扫描范围判定，the CommentLeak Scanner shall 依据"扩展名/文件名 → 语言组"映射表分派到对应注释提取器，输出 `{ 起始行号, 文本, 来源类型, 是否位于代码围栏 }` 的片段列表；未映射文件不得进入提取阶段。

**验收标准**

- `.ts` → C 系提取器；`.py` → 井号系 + docstring；`.sql` → SQL 提取器；`.md` → 文档全文。
- 映射表中不存在的扩展名不会进入提取（已在 FLT-007 登记跳过）。

##### CLS-EXT-002 · C 系行注释与块注释 `P0`

**EARS**：Where 文件属于 C 系语言组（`js jsx ts tsx mjs cjs vue svelte java kt scala groovy go rs c cpp h cc hpp cs php swift m mm css scss less sass`），the CommentLeak Scanner shall 提取 `//` 至行尾的行注释与 `/* ... */` 块注释；块注释记录其起始行，跨行文本合并为一条片段。

**验收标准**

- `// 账号 admin/123456` → 一条片段，行号正确。
- 单行 `/* secret=abc123 */` → 一条片段。
- 跨行块注释 → 起始行号取 `/*` 所在行，文本完整保留换行。

##### CLS-EXT-003 · 字符串状态机（核心） `P0`

**EARS**：While 提取 C 系注释，the CommentLeak Scanner shall 通过字符级状态机识别 `'`、`"`、`` ` `` 字符串及 `\` 转义，字符串内部出现的 `//`、`/*`、`*/` 不得被识别为注释起始或结束。

**验收标准**

- `const url = "http://example.com/a"; // 正常注释` → 仅提取"正常注释"，**不得**把 `http://` 误判为注释。
- `const s = "/* not a comment */";` → 不产生任何注释片段。
- `const p = 'it\\'s // inside';` → 不产生注释片段。
- 模板字符串中跨行包含 `//` → 不产生注释片段。

##### CLS-EXT-004 · JavaScript 正则字面量边界（简化） `P0`

**EARS**：While 提取 JS/TS 注释，the CommentLeak Scanner shall 采用基于前序字符的简化判定来区分 `/` 是正则字面量起始还是除法/注释；允许在极少数歧义场景出现误判，但该限制必须在源码注释与 README"已知限制"章节中明确说明。

**验收标准**

- `const re = /\\/\\//; // 注释` → 至少正确提取尾部"注释"。
- `a / b // 注释` → 正确提取"注释"，不把除法后的内容吞为正则。
- 已知歧义样例被记录在 README，不视为缺陷。

##### CLS-EXT-005 · 井号系注释 `P0`

**EARS**：Where 文件属于井号系（`py rb sh bash zsh fish ps1 yaml yml toml ini conf cfg properties r pl` 以及 `Makefile*`、`Dockerfile*`），the CommentLeak Scanner shall 提取 `#` 至行尾内容；位于文件第 1 行的 shebang（`#!`）应当被忽略。

**验收标准**

- `# DB_PASSWORD=Admin@123` → 命中片段。
- `#!/usr/bin/env bash` → 不产生片段、不命中。
- `echo "#not-comment"`（双引号内）→ 应当不产生片段（字符串内 `#` 不视为注释）。
- YAML 中 `value: "a # b"` → 不产生片段。

##### CLS-EXT-006 · SQL 注释 `P0`

**EARS**：Where 文件扩展名为 `.sql`，the CommentLeak Scanner shall 提取 `--` 行注释与 `/* ... */` 块注释，并保证 `'...'` 与 `"..."` 字符串内的 `--` 不被识别为注释。

**验收标准**

- `-- password: root` → 命中。
- `INSERT INTO t VALUES ('a--b');` → 不产生注释片段。

##### CLS-EXT-007 · HTML / XML / Vue / Svelte 注释 `P0`

**EARS**：Where 文件属于 HTML/XML 组（`html htm xml vue svelte`），the CommentLeak Scanner shall 提取 `<!-- ... -->` 注释；`Vue/Svelte` 文件还应分别提取 `<script>` 内的 JS 注释与 `<style>` 内的 CSS 块注释。

**验收标准**

- `<!-- 内网测试地址 10.1.2.3 -->` → 命中。
- Vue 文件 `<script>// token=abc123</script>` → 提取并命中。
- 普通标签属性中的 `<!--` 文本（转义后）不误判。

##### CLS-EXT-008 · Lua 与 Batch 注释 `P0`

**EARS**：Where 文件为 `.lua`，the CommentLeak Scanner shall 提取 `--` 行注释与 `--[[ ... ]]` 块注释；Where 文件为 `.bat/.cmd`，the CommentLeak Scanner shall 提取行首（允许前导空白）的 `REM ` 与 `::` 注释，`REM` 不区分大小写。

**验收标准**

- `--[[ password=root ]]` → 一条块注释片段。
- `REM test/test`、`:: 内网 10.0.0.1` → 均命中。
- `echo REM` → 不视为注释。

##### CLS-EXT-009 · Python docstring 扫描开关 `P0`

**EARS**：Where "扫描 Python docstring"开关为开启（默认开启），the CommentLeak Scanner shall 将 `"""` 与 `'''` 包裹的块纳入扫描范围并记录起始行；When 用户关闭该开关，the CommentLeak Scanner shall 仅提取 `#` 注释。

**验收标准**

- `"""数据库密码: Admin@123"""` → 默认开启时命中 high。
- 关闭开关后重新扫描同一文件 → 该命中消失，`#` 注释仍正常扫描。
- 开关状态在界面上可见，并随导出配置记录。

##### CLS-EXT-010 · Markdown 全文与代码围栏标记 `P0`

**EARS**：Where 文件为 Markdown 类文档，the CommentLeak Scanner shall 将全文作为文档内容参与检测，并对落在 ```（三个反引号）围栏代码块内的命中附加"疑似示例"标记；标记不改变风险等级，但默认排序应当排在非围栏命中之后。

**验收标准**

- README 中围栏内示例 `AKIA...` → 命中并显示"疑似示例"标签。
- 围栏外同值 → 不显示该标签，排序靠前。
- 未闭合围栏 → 从起始位置到文件末尾均标记为围栏内，并在报告提示"围栏未闭合"。

##### CLS-EXT-011 · 行号准确性 `P0`

**EARS**：The CommentLeak Scanner shall 为每个片段提供在原文件中 1-based 的起始行号；结果表展示的行号必须与源文件行号一致（±0）。

**验收标准**

- 注释位于文件第 37 行 → 结果表显示 37。
- 跨行块注释起始于第 10 行 → 显示 10；上下文取第 9 行与第 11 行（若有）。

##### CLS-EXT-012 · 禁止全文正则冒充注释识别 `P0`

**EARS**：The CommentLeak Scanner shall 仅对提取后的注释/文档片段执行规则匹配；**禁止**直接对整个文件内容套用检测正则来替代注释提取。

**验收标准**

- `config.js` 正文中的 `AKIAABCDEFGHIJKLMNOP`（字符串常量，非注释）→ 不产生命中。
- 代码审计可确认规则匹配入口仅接收片段列表。

##### CLS-EXT-013 · 超长片段保护 `P1`

**EARS**：If 单条注释片段长度超过 8KB，then the CommentLeak Scanner shall 仅将前 8KB 参与规则匹配，并在结果中标记"片段已截断"，避免规则回溯造成卡死。

**验收标准**

- 构造 1MB 单行注释 → 扫描耗时 ≤ 200ms，结果标记"片段已截断"。
- 前 8KB 内的命中仍正常报告。

##### CLS-EXT-014 · 非 UTF-8 编码容错 `P1`

**EARS**：If 文件包含 BOM 或非 UTF-8 字节序列，then the CommentLeak Scanner shall 以 UTF-8 尽力解码、替换无法解码的字节，并继续扫描，不因编码问题整体跳过。

**验收标准**

- GBK 编码的 `.md` → 不报错；ASCII 部分的密钥仍能被检出。
- 二进制误判为文本 → 在 1000 字符内出现大量替换符时登记"疑似非文本"跳过（不产生崩溃）。

##### CLS-EXT-015 · 片段来源标记 `P0`

**EARS**：The CommentLeak Scanner shall 为每个片段标注来源类型（行注释 / 块注释 / 文档全文 / docstring / 配置文件 / 围栏内示例），供结果表展示与导出使用。

**验收标准**

- 导出的 JSON 中每条命中均含 `sourceKind`。
- 结果表悬浮提示显示来源类型的中文名称。

#### 5.3.2 交互流程

本模块无直接用户交互，位于主流程（5.1.2）"注释提取"步骤；用户仅能通过 Python docstring 开关影响提取范围（CLS-EXT-009）。

#### 5.3.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 提取器异常 | 单文件状态机抛出异常 | 捕获，登记"解析失败"，继续下一文件 | 跳过清单出现"解析失败：`path`"，扫描不中断 |
| 非法编码 | 解码出现大量替换符 | 尝试继续；超阈值登记"疑似非文本" | 跳过原因"疑似非文本文件" |
| 未闭合块注释 | `/*` 无对应 `*/` | 提取至文件末尾为一条片段 | 结果可命中；README 已知限制说明 |
| 未闭合字符串 | 字符串状态未闭合 | 保守处理为字符串，后续 `//` 不提取 | 可能漏检，README 记录限制 |
| 超长片段 | 片段 > 8KB | 截断至 8KB 匹配 | 标记"片段已截断" |

---

### 5.4 敏感信息检测

#### 5.4.1 业务规则（EARS）

##### CLS-RUL-001 · 数据驱动规则集 `P0`

**EARS**：The CommentLeak Scanner shall 以可扩展规则数组驱动检测，每条规则至少包含 `id、name、severity、pattern、flags、description、suggestion`，可选 `entropy` 配置；新增规则不得要求修改扫描编排流程。

**验收标准**

- 规则数组中新增一条自定义模式 → 无需改动其他代码即可在扫描中生效。
- 规则 `id` 全局唯一，重复 `id` 时应启动即报错（开发期可见）。
- 每条规则必须提供中文说明与修复建议（空值视为不合法）。

##### CLS-RUL-002 · 云厂商密钥检测 `P0`

**EARS**：The CommentLeak Scanner shall 检测 AWS Access Key（`AKIA[0-9A-Z]{16}`）、AWS Secret Access Key（关键词邻近距离内的 40 位 base64 串）、Google API Key（`AIza[0-9A-Za-z_-]{35}`）、GitHub Token（`ghp_/gho_/ghs_` + 36 位字母数字）、Slack Token（`xox[baprs]-`）、OpenAI Key（`sk-[A-Za-z0-9]{20,}`）、Stripe Key（`sk_live_/pk_live_`）、SendGrid Key（`SG.` + 22 位 + `.` + 43 位），并将这些命中判定为 **critical**。

**验收标准**

- 注释 `// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"` → 1 条 critical，规则名"AWS Access Key"。
- 注释 `// sk-abcdefghijklmnopqrstuvwxyz123456` → 1 条 critical（OpenAI）。
- `// pk_test_xxx` → 不命中（仅 `sk_live_/pk_live_`）。
- 大小写不匹配的 `akia...` → 不命中（云密钥规则区分大小写）。

##### CLS-RUL-003 · 私钥与证书检测 `P0`

**EARS**：The CommentLeak Scanner shall 检测 `-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----` 与 `-----BEGIN CERTIFICATE-----`，判定为 **critical**，报告中只展示 BEGIN 行。

**验收标准**

- `// -----BEGIN RSA PRIVATE KEY-----` → 1 条 critical，脱敏展示仅含 BEGIN 行。
- 注释中出现完整私钥正文 → 仅 1 条命中，不重复按行报出。

##### CLS-RUL-004 · 通用密钥赋值检测 `P0`

**EARS**：When 注释/文档片段中出现关键词（`password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|secret[_-]?key|private[_-]?key|auth`）并紧随 `:` 或 `=`（允许空白与引号），且值长度 ≥ 6，the CommentLeak Scanner shall 判定为 **high**；If 该值属于占位符集合（`xxx`、`***`、`changeme`、`your_xxx`、`example`、`placeholder`、`<...>`、`{{...}}`、`${...}` 等），then the CommentLeak Scanner shall 不产生命中。

**验收标准**

- `// password=Admin@123` → high。
- `// api_key = "your_api_key_here"` → 不命中。
- `// token = ${TOKEN}`、`// secret = <your-secret>` → 不命中。
- `// password = "abc"`（长度 < 6）→ 不命中。
- `// PASSWORD: root`（大写关键词）→ 命中（关键词不区分大小写）。

##### CLS-RUL-005 · 数据库 / 中间件连接串 `P0`

**EARS**：The CommentLeak Scanner shall 检测带账号密码的 `mysql://`、`postgres://`、`postgresql://`、`mongodb://`、`mongodb+srv://`、`redis://`、`amqp://`、`mssql://` 连接串（形如 `scheme://user:pass@host`），判定为 **critical**。

**验收标准**

- `mysql://root:Passw0rd@10.1.2.3:3306/db` → critical，脱敏后不含 `Passw0rd`。
- `postgres://user@host/db`（无密码）→ 不命中连接串规则；若 host 为内网 IP，由 CLS-RUL-008 报 high。
- 正文（非注释）中的连接串 → 不命中。

##### CLS-RUL-006 · 带凭证的 URL `P0`

**EARS**：The CommentLeak Scanner shall 检测形如 `https?://user:pass@host` 的带凭证 URL，判定为 **critical**，脱敏时保留协议与主机、掩码账号密码。

**验收标准**

- `// http://admin:secret@192.168.1.10/admin` → critical。
- `// https://example.com/path` → 不命中。

##### CLS-RUL-007 · JWT 检测 `P0`

**EARS**：The CommentLeak Scanner shall 检测三段式 JWT（`eyJ` 前缀 + 三段 base64url），判定为 **high**，脱敏时仅保留前缀。

**验收标准**

- `// eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiYWRtaW4ifQ.sig1234567890` → high。
- 普通 base64 文本（非三段）→ 不命中。

##### CLS-RUL-008 · 内网 IP 检测 `P0`

**EARS**：The CommentLeak Scanner shall 检测 `10.x.x.x`、`192.168.x.x`、`172.16.x.x`–`172.31.x.x` 的 IPv4 地址，判定为 **high**；并排除 `127.0.0.1`、`0.0.0.0` 与文档示例段 `192.0.2.*`、`198.51.100.*`、`203.0.113.*`。

**验收标准**

- `10.20.30.40:8080` → high（识别端口但仅对 IP 报告）。
- `172.15.0.1`、`172.32.0.1` → 不命中（不在私网段）。
- `192.0.2.10`、`203.0.113.5` → 不命中。
- 注释正文（非注释）中的 IP → 不命中。

##### CLS-RUL-009 · 内网主机名 / 域名 `P1`

**EARS**：The CommentLeak Scanner shall 检测 `*.local`、`*.internal`、`*.corp`、`*.lan`、`*.intra`、`*.intranet`、`*.svc.cluster.local` 域名，判定为 **medium**；检测 `localhost:<端口>` 判定为 **low**。

**验收标准**

- `// db.internal` → medium；`// api.svc.cluster.local` → medium。
- `// localhost:8080` → low。
- `// example.local?` 仍应命中（后缀匹配），但 README 说明存在误报可能。

##### CLS-RUL-010 · 测试 / 默认凭证 `P1`

**EARS**：The CommentLeak Scanner shall 检测 `(test|admin|root|demo|guest|user)` 后紧跟 `:` 或 `=` 与 `(test|admin|root|123456|password|passwd|demo|guest)` 的组合，判定为 **low**。

**验收标准**

- `// TODO: 测试账号 test/test 上线前删掉` → low。
- `// admin:admin` → low。
- `// username: john` → 不命中（值不在默认凭证集合）。

##### CLS-RUL-011 · 高熵串兜底 `P1`

**EARS**：Where 高熵兜底规则启用（默认启用），the CommentLeak Scanner shall 对"密钥类关键词"关联的值计算 Shannon 熵，当熵 > 3.5、长度 16–128、且字符集为 base64/hex 风格时额外报告为 **medium**。

**验收标准**

- `// secret = "Qm9vR2V0dGhpc1NlY3JldFZhbHVlMTIzNDU2Nzg5MA"` → medium 高熵命中。
- `// secret = "aaaaaaaaaaaaaaaa"`（低熵）→ 不命中。
- `// secret = "short"`（< 16）→ 不命中。

##### CLS-RUL-012 · 邮箱 / 手机号（默认关闭） `P2`

**EARS**：Where 用户开启"个人联系方式检测"开关，the CommentLeak Scanner shall 对邮箱（`xxx@xxx.xx`）与中国大陆手机号（`1[3-9]\d{9}`）进行检测，分别判定为 **low / medium**；默认关闭时不产生任何相关命中。

**验收标准**

- 开关关闭 → 注释中邮箱不产生命中。
- 开关开启 → 邮箱 1 条 low、手机号 1 条 medium，脱敏展示。
- 开关状态随导出配置记录。

##### CLS-RUL-013 · 风险等级定义与排序 `P0`

**EARS**：The CommentLeak Scanner shall 按固定映射定义级别：critical = 私钥/证书、云厂商密钥、带凭证连接串与 URL；high = 通用密钥赋值、JWT、内网 IP；medium = 内网域名、高熵串、手机号；low = 测试凭证、localhost、邮箱；结果默认按 critical → high → medium → low 排序，同级按文件路径、行号升序。

**验收标准**

- 构造四级各 1 条命中 → 展示顺序为 critical、high、medium、low。
- 同文件多条同级命中 → 按行号升序。

##### CLS-RUL-014 · 说明与修复建议 `P0`

**EARS**：The CommentLeak Scanner shall 为每条规则提供中文规则名、一句话说明与修复建议，并在结果详情与导出报告中展示。

**验收标准**

- 每条命中可展开看到"说明"与"修复建议"。
- 规则清单表与 README 规则表一致。

##### CLS-RUL-015 · 命中去重 `P0`

**EARS**：If 同一文件、同一行、同一匹配区间被多条规则命中，then the CommentLeak Scanner shall 仅保留级别最高的一条结果，并记录被抑制规则的 `id` 列表用于导出审计。

**验收标准**

- `// password = "AKIAABCDEFGHIJKLMNOP"` → 仅 1 条 critical（AWS），不得重复 2 条。
- 同一行两个不同密钥值 → 保留 2 条（匹配区间不同）。

##### CLS-RUL-016 · 示例值误报抑制 `P1`

**EARS**：The CommentLeak Scanner shall 对明显示例值（如 `example.com`、`your-domain.com`、`<...>`、`{{...}}`、`xxx` 占位）降低误报：不得将其判为 critical/high，仅在确有必要时以低级别展示；判定依据必须在规则数据中声明。

**验收标准**

- `// password = "example_password"` → 不命中。
- `// mysql://user:password@example.com/db` → 不判 critical（不命中连接串规则）。

##### CLS-RUL-017 · 规则清单可追溯 `P0`

**EARS**：The CommentLeak Scanner shall 在界面与 README 中提供完整规则清单（规则 ID、名称、级别、说明、修复建议、示例），供用户核对检测能力边界。

**验收标准**

- README 规则表条目数 = 规则数组条目数（不含默认关闭规则的标注）。
- 界面"规则说明"可查看，默认折叠。

#### 5.4.2 规则清单（规则 ID 与需求映射）

| 规则 ID | 规则名称 | 级别 | 检测目标（摘要） | 对应需求 | 修复建议（摘要） |
|---|---|---|---|---|---|
| CLS-R-001 | AWS Access Key | critical | `AKIA[0-9A-Z]{16}` | CLS-RUL-002 | 立即在 AWS 控制台禁用并轮换密钥 |
| CLS-R-002 | AWS Secret Access Key | critical | 关键词邻近距离 40 位 base64 | CLS-RUL-002 | 轮换 Secret，改用环境变量/密钥托管 |
| CLS-R-003 | Google API Key | critical | `AIza[0-9A-Za-z_-]{35}` | CLS-RUL-002 | 吊销 Key，限制来源与配额 |
| CLS-R-004 | GitHub Token | critical | `ghp_/gho_/ghs_` + 36 位 | CLS-RUL-002 | 在 GitHub 设置中吊销并重新签发 |
| CLS-R-005 | Slack Token | critical | `xox[baprs]-` | CLS-RUL-002 | 吊销 Token，改用 OAuth 管理 |
| CLS-R-006 | OpenAI API Key | critical | `sk-[A-Za-z0-9]{20,}` | CLS-RUL-002 | 吊销并重建 Key，设置用量上限 |
| CLS-R-007 | Stripe Key | critical | `sk_live_/pk_live_` | CLS-RUL-002 | 轮换受限 Key，禁止提交到仓库 |
| CLS-R-008 | SendGrid Key | critical | `SG.` + 22 + `.` + 43 | CLS-RUL-002 | 吊销并重建 API Key |
| CLS-R-009 | 私钥文件头 | critical | `BEGIN ... PRIVATE KEY` | CLS-RUL-003 | 移除私钥并重新生成密钥对 |
| CLS-R-010 | 证书内容 | critical | `BEGIN CERTIFICATE` | CLS-RUL-003 | 移除证书，改由部署系统注入 |
| CLS-R-011 | 通用密钥赋值 | high | 关键词 + `:`/`=` + 值 ≥ 6 | CLS-RUL-004 | 改用环境变量/密钥管理服务 |
| CLS-R-012 | 数据库连接串 | critical | `scheme://user:pass@host` | CLS-RUL-005 | 轮换数据库口令，改由配置中心下发 |
| CLS-R-013 | 带凭证 URL | critical | `https?://user:pass@host` | CLS-RUL-006 | 移除 URL 凭证并轮换账号密码 |
| CLS-R-014 | JWT | high | `eyJ...eyJ...` 三段式 | CLS-RUL-007 | 缩短有效期并轮换签名密钥 |
| CLS-R-015 | 内网 IP | high | 10/172.16-31/192.168 网段 | CLS-RUL-008 | 改为可配置项或脱敏为示例地址 |
| CLS-R-016 | 内网域名 | medium | `*.local/internal/corp/lan/...` | CLS-RUL-009 | 移除内部域名，使用占位域名 |
| CLS-R-017 | localhost 地址 | low | `localhost:<port>` | CLS-RUL-009 | 确认是否属于可公开的默认配置 |
| CLS-R-018 | 测试/默认凭证 | low | test/admin/root 等组合 | CLS-RUL-010 | 删除测试账号并改用临时凭证 |
| CLS-R-019 | 高熵密钥串 | medium | 熵 > 3.5、16–128 位 | CLS-RUL-011 | 人工复核，疑似真实密钥时轮换 |
| CLS-R-020 | 邮箱/手机号 | low/medium | 邮箱、大陆手机号（默认关） | CLS-RUL-012 | 删除个人联系方式或改为公共邮箱 |

#### 5.4.3 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
participant "界面" as UI
participant "后台扫描任务" as BG
U -> UI : 发起扫描（规则集默认全开）
UI -> BG : 注释/文档片段集合 + 扫描配置
BG -> BG : 逐条片段执行规则数组匹配
BG -> BG : 占位符排除 → 高熵兜底 → 去重取最高级别
BG --> UI : 命中列表（含规则说明与修复建议）
UI -> UI : 按级别排序、脱敏展示
U -> UI : 展开规则说明 / 调整过滤条件
@enduml
```

#### 5.4.4 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 规则正则非法 | 规则数据包含非法模式 | 启动时校验失败；运行期跳过该规则并记录 | "规则 `<id>` 配置异常，已跳过"（开发期阻断） |
| 规则匹配超时 | 单片段回溯过久 | 对该片段放弃该规则匹配，记录"匹配超时" | 结果不中断，跳过清单可见 |
| 规则全关 | 用户关闭某类规则（若提供） | 按配置执行，不产生该类命中 | 统计中不出现该类级别；导出记录配置 |
| 值过短/占位符 | 命中被排除条件拦截 | 不产生结果 | 无提示（按预期不命中） |

---

### 5.5 结果统计与脱敏展示

#### 5.5.1 业务规则（EARS）

##### CLS-RPT-001 · 统计卡片 `P0`

**EARS**：When 扫描作业完成，the CommentLeak Scanner shall 在结果区顶部展示：扫描文件数、命中文件数、critical/high/medium/low 命中数、跳过文件数、总耗时，数值与导出报告一致。

**验收标准**

- 扫描 10 个文件、3 个命中 → 显示"扫描文件 10 / 命中文件 3"。
- 各级别计数之和 = 命中总数（去重后）。
- 跳过数 = 各跳过原因之和。

##### CLS-RPT-002 · 结果表字段与默认排序 `P0`

**EARS**：The CommentLeak Scanner shall 以表格展示每条命中的文件路径、行号、规则名、级别、脱敏片段，默认按级别降序、同级按路径与行号升序；"疑似示例"命中排在同级非围栏命中之后。

**验收标准**

- 四级混合 → 顺序 critical→high→medium→low。
- 同级别下 `docs/a.md` 排在 `src/b.js` 前（按路径字典序）。
- 表格列在 375px 宽度下可横向滚动且不重叠。

##### CLS-RPT-003 · 过滤与折叠 `P0`

**EARS**：The CommentLeak Scanner shall 支持按级别、按规则、按文件路径关键字过滤，并支持按文件折叠/展开命中列表；过滤条件变更后统计卡片应显示"当前筛选结果数 / 总数"。

**验收标准**

- 勾选"仅 critical" → 表格只剩 critical，计数显示"3 / 12"。
- 路径输入 `src/` → 仅保留 `src/` 下命中。
- 折叠 `main.go` → 该文件命中收起，再次点击展开。

##### CLS-RPT-004 · 脱敏策略 `P0`

**EARS**：The CommentLeak Scanner shall 按命中类型执行脱敏：普通字符串长度 ≤ 8 时全掩码为等长 `*`，长度 > 8 时保留前 4 位与后 4 位、中间以 `*` 替换；连接串/带凭证 URL 保留协议与主机、账号与密码整体掩码；私钥与证书仅显示 BEGIN 行；JWT 仅保留前 8 位后接省略号。**任何情况下界面默认不得展示完整敏感值。**

**验收标准**

- 值 `Abc123` → 展示 `******`。
- 值 `AKIAABCDEFGHIJKLMNOP` → 展示 `AKIA**********MNOP`（不出现完整串）。
- `mysql://root:Passw0rd@10.1.2.3:3306/db` → 展示 `mysql://***:***@10.1.2.3:3306/db`。
- `-----BEGIN RSA PRIVATE KEY-----` 长段 → 仅展示 BEGIN 行。
- JWT → 展示 `eyJhbGci…`。

##### CLS-RPT-005 · 二次确认查看完整内容 `P0`

**EARS**：When 用户点击某条命中上的"我需要看完整内容"，the CommentLeak Scanner shall 先展示二次确认弹窗（说明风险与"仅本地临时展开"），仅在用户确认后于当前页面内存中展开该条完整片段；该内容不得进入日志、存储、剪贴板或导出文件，再次点击后应收起。

**验收标准**

- 未确认 → 显示脱敏片段，无完整值。
- 确认后 → 仅该条展开；刷新页面后恢复脱敏态。
- DevTools Network / Application 中无完整值痕迹。
- 导出 JSON/CSV 仍为脱敏值。

##### CLS-RPT-006 · 上下文展示 `P0`

**EARS**：The CommentLeak Scanner shall 为每条命中展示其上 1 行与下 1 行注释上下文（若存在），上下文同样脱敏，单行超过 200 字符时截断并加省略号。

**验收标准**

- 命中位于 `// a`、`// b`（命中）、`// c` → 展示 a/b/c 三行。
- 相邻行无注释 → 仅展示"无上下文"。
- 超长行 → 截断至 200 字符，不影响布局。

##### CLS-RPT-007 · 空结果成功态 `P0`

**EARS**：If 扫描完成且没有任何命中，then the CommentLeak Scanner shall 展示明确的"未发现风险"成功态，并说明扫描文件数、跳过文件数、跳过原因摘要与耗时；不得仅展示空白表格。

**验收标准**

- 无命中 → 绿色成功态 + "已扫描 128 个文件，跳过 36 个文件（其中依赖目录 30 个）"。
- 成功态下仍可查看规则说明与未扫描清单。

##### CLS-RPT-008 · 未扫描文件可查看 `P0`

**EARS**：The CommentLeak Scanner shall 提供"未扫描文件"入口，按跳过原因分组展示文件路径（至少前 100 条）与总数；当无法展示全部时提示可通过导出 JSON 查看完整清单。

**验收标准**

- 跳过 1200 个文件 → 分组计数正确，每组可展开前 100 条。
- 提示文案明确说明完整清单在导出文件中。

##### CLS-RPT-009 · 底部隐私声明 `P0`

**EARS**：The CommentLeak Scanner shall 在页面底部以固定可见（吸底或页脚常驻）方式展示："所有处理均在浏览器本地完成，代码不会上传到任何服务器。请确认页面无外部网络请求后再使用。"

**验收标准**

- 任意滚动位置（含手机）均可见该声明。
- 文案逐字一致，不得省略。

##### CLS-RPT-010 · 大结果集渲染性能 `P1`

**EARS**：While 命中条数 ≥ 5000，the CommentLeak Scanner shall 采用虚拟滚动或分页渲染，保证表格滚动帧率 ≥ 30fps、展开/过滤操作响应 ≤ 300ms。

**验收标准**

- 5000 条命中滚动无白屏、无长时间卡顿。
- 切换"仅 critical"过滤 → 300ms 内完成重绘。

##### CLS-RPT-011 · 结果不持久化 `P0`

**EARS**：The CommentLeak Scanner shall 仅在内存中保存当前作业结果；When 页面刷新或关闭，the CommentLeak Scanner shall 丢失全部扫描结果，不得写入任何浏览器持久化存储。

**验收标准**

- 刷新后回到初始上传态，无任何命中残留。
- Application → Local Storage / Session Storage / IndexedDB 中无扫描内容。

##### CLS-RPT-012 · 扫描配置摘要 `P1`

**EARS**：The CommentLeak Scanner shall 在结果区与导出报告中记录本次扫描配置：忽略规则组状态、docstring 开关、联系方式规则开关、单文件上限、总量上限、规则集版本、扫描时间戳。

**验收标准**

- 导出 JSON 的 `config` 字段与界面开关一致。
- 时间戳采用 ISO 8601 格式。

#### 5.5.2 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
participant "结果区界面" as R
participant "本地脱敏能力" as M

U -> R : 扫描完成
R -> M : 请求脱敏片段与上下文
M --> R : 脱敏结果（默认态）
R --> U : 统计卡片 + 结果表 + 未扫描清单
U -> R : 过滤 / 排序 / 折叠 / 查看说明
U -> R : 点击"我需要看完整内容"
R -> U : 二次确认弹窗
U -> R : 确认
R -> M : 临时展开（仅内存）
M --> R : 完整片段（不落盘、不导出）
U -> R : 收起 / 刷新
R -> M : 丢弃完整内容
@enduml
```

#### 5.5.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 脱敏失败 | 值结构异常 | 采取全掩码兜底 | 展示全 `*`，不暴露原文 |
| 上下文缺失 | 相邻行无注释 | 显示"无上下文" | 不出现空白块 |
| 结果过大 | 命中 > 20000 条 | 分页 + 提示"结果过多，建议导出后分析" | 列表可分页浏览，页面不崩溃 |
| 剪贴板不可用 | 浏览器拒绝写权限 | 降级为可选中文本区域 | 提示"复制失败，请手动选择文本复制" |

---

### 5.6 报告导出

#### 5.6.1 业务规则（EARS）

##### CLS-EXP-001 · 导出 JSON `P1`

**EARS**：When 用户点击"导出 JSON"，the CommentLeak Scanner shall 在本地生成包含 `version、generatedAt、config、summary、findings、skippedFiles` 的报告文件并触发浏览器下载，文件名含时间戳（如 `commentleak-report-20261112-153000.json`）。

**验收标准**

- 文件可被 JSON 解析，字段完整；`findings` 每条含 `ruleId/ruleName/severity/filePath/line/maskedSnippet/context/sourceKind/inCodeFence/suggestion`。
- 不含完整敏感值（即使用户曾展开查看）。
- 文件名时间戳与 `generatedAt` 一致。

##### CLS-EXP-002 · 导出 CSV `P1`

**EARS**：The CommentLeak Scanner shall 导出 UTF-8（含 BOM）、CRLF 换行的 CSV，Excel 可直接打开；If 单元格以 `= + - @` 开头，then the CommentLeak Scanner shall 前置单引号 `'` 防止公式注入；含逗号、引号、换行的单元格应正确加引号转义。

**验收标准**

- Excel 打开中文不乱码。
- 规则名/片段以 `=` 开头时，CSV 中显示为 `'=...`。
- 含逗号的路径 `a,b/c.js` 正确包裹。
- 行数 = 命中数 + 1 表头。

##### CLS-EXP-003 · 复制命中文件路径 `P1`

**When 用户点击"复制文件路径"，the CommentLeak Scanner shall 将命中文件的去重路径列表（按字母排序、相对路径、每行一个）写入剪贴板，并显示"已复制 N 个文件路径"。

**验收标准**

- 同一文件多条命中 → 路径只出现一次。
- 复制内容可直接粘贴到 PR 描述。
- 剪贴板写入失败 → 提示可手动选择复制。

##### CLS-EXP-004 · 导出内容始终脱敏 `P0`

**EARS**：The CommentLeak Scanner shall 保证所有导出产物仅包含脱敏片段；即使当前界面已临时展开完整内容，导出也不得包含完整值。

**验收标准**

- 展开完整内容后导出 JSON → 检索不到完整密钥字符串。
- 导出 CSV 中片段列均为脱敏态。

#### 5.6.2 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
participant "界面" as UI
participant "本地导出能力" as EX

U -> UI : 点击导出 JSON / CSV / 复制路径
UI -> UI : 校验结果为脱敏态
UI -> EX : 在本地生成内容
EX --> U : 触发下载 / 写入剪贴板
UI --> U : 显示"已导出/已复制"提示
@enduml
```

#### 5.6.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 无结果导出 | 命中为 0 | 仍允许导出（含空 findings） | 提示"当前无命中，将导出仅含统计的报告" |
| 下载被拦截 | 浏览器策略限制 | 提供 Blob 链接手动下载 | "自动下载被拦截，请点击此处下载" |
| 剪贴板拒绝 | 权限/非安全上下文 | 降级为文本选择 | "复制失败，请手动选择文本复制" |

---

### 5.7 界面与交互

#### 5.7.1 业务规则（EARS）

##### CLS-UIX-001 · 单页信息架构 `P0`

**EARS**：The CommentLeak Scanner shall 采用单页结构，自上而下为：标题 + 隐私声明 → 拖拽/选择区 →（扫描中进度区）→ 结果区 → 底部固定隐私声明；不得使用多页路由跳转。

**验收标准**

- 初始仅见标题、拖拽区、底部声明，不出现空结果表。
- 扫描中拖拽区被进度区替代，完成后结果区出现在下方。

##### CLS-UIX-002 · 深浅色跟随系统 `P0`

**EARS**：The CommentLeak Scanner shall 跟随操作系统 `prefers-color-scheme` 自动切换深色/浅色主题，两种主题下文字对比度 ≥ 4.5:1，且不依赖远程字体。

**验收标准**

- 系统切换深色 → 页面自动切换，无需刷新。
- 两种主题下结果表、按钮、提示均可读。

##### CLS-UIX-003 · 响应式 `P0`

**EARS**：The CommentLeak Scanner shall 在 1280px 桌面宽度与 375px 手机宽度下均可用：关键操作（上传、扫描、导出、查看）可达，结果表可横向滚动，无元素重叠或溢出遮挡。

**验收标准**

- 375×667 视口 → 无横向页面滚动（表格内部滚动除外）。
- 统计卡片在手机端换行排列，不压缩到不可读。

##### CLS-UIX-004 · 错误文案具体化 `P0`

**EARS**：The CommentLeak Scanner shall 对所有错误显示"具体原因 + 可采取动作 + 错误码"，禁止使用"扫描失败""出错了"等模糊文案。

**验收标准**

- 上传 rar → "仅支持 .zip 压缩包，当前文件为 `.rar`。请压缩为 zip 后重试"。
- 空包 → "压缩包内未找到可扫描的文本文件（已跳过 128 个二进制或忽略文件）"。
- 每个错误均含 `CLS-E-xxxx` 错误码，可被复制。

##### CLS-UIX-005 · 全中文文案 `P0`

**EARS**：The CommentLeak Scanner shall 使用简体中文呈现全部界面文案、错误提示与规则说明；技术标识（如 `.zip`、`severity` 值）可保留原文。

**验收标准**

- 页面可见文案无未翻译英文句子（代码/文件名/规则 ID 除外）。
- 规则说明、修复建议均为中文。

##### CLS-UIX-006 · 扫描中状态 `P0`

**EARS**：While 扫描进行中，the CommentLeak Scanner shall 显示当前阶段、百分比、当前文件路径与"取消"按钮，并禁止重复上传。

**验收标准**

- 进度区可见当前文件路径（超长中间省略）。
- 扫描中拖入新文件 → 被阻止并提示"请等待当前扫描完成或先取消"。

##### CLS-UIX-007 · 可访问性 `P1`

**EARS**：The CommentLeak Scanner shall 提供键盘可达的上传/取消/筛选/导出操作，按钮具备可读名称，进度条具备 `role="progressbar"` 与当前值语义。

**验收标准**

- Tab 键可依次到达全部交互控件并触发。
- 进度条可通过辅助技术读出百分比。

##### CLS-UIX-008 · 忽略规则与规则说明入口 `P0`

**EARS**：The CommentLeak Scanner shall 在结果区上方提供"忽略规则"与"检测规则说明"两个可展开面板，默认折叠，展开后展示当前生效配置。

**验收标准**

- 面板内容与 CLS-FLT-008 / CLS-RUL-017 一致。
- 折叠状态不影响扫描执行。

#### 5.7.2 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "用户" as U
boundary "标题 + 隐私声明" as H
boundary "拖拽/选择区" as D
boundary "进度区" as P
boundary "结果区" as R
boundary "底部声明" as F

U -> H : 阅读隐私承诺
U -> D : 选择/拖入 zip
D -> P : 显示进度与取消
P -> R : 展示统计、命中、未扫描清单
U -> R : 过滤 / 折叠 / 导出 / 二次确认查看
R -> F : 底部声明常驻可见
@enduml
```

#### 5.7.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 浏览器不支持后台线程 | 环境受限 | 降级到主线程但提示性能风险（不得静默） | "当前浏览器不支持后台扫描，处理大文件可能卡顿" |
| 拖拽非文件 | 拖入文本/链接 | 忽略并提示 | "请拖入 .zip 压缩包或文件夹" |
| 窗口过窄 | 视口 < 320px | 纵向堆叠，保持可操作 | 无内容被裁切不可达 |

---

### 5.8 隐私与安全

#### 5.8.1 业务规则（EARS）

##### CLS-PRV-001 · 零外部网络 `P0`

**EARS**：The CommentLeak Scanner shall 在运行期不发起任何外部网络请求；源码中不得存在指向外部地址的 `fetch / XMLHttpRequest / sendBeacon / WebSocket` 调用。

**验收标准**

- 从上传到导出全过程，DevTools Network 面板除本地页面资源外请求数为 0。
- 断网环境下全部功能可用。
- 构建产物中不存在外部字体、CDN、埋点脚本引用。

##### CLS-PRV-002 · 零上传、零后端 `P0`

**EARS**：The CommentLeak Scanner shall 不包含后端、登录、云端历史；任何代码内容不得离开浏览器进程。

**验收标准**

- 代码检索无 HTTP 客户端调用外部域名。
- 无任何账号/登录入口。

##### CLS-PRV-003 · 零持久化 `P0`

**EARS**：The CommentLeak Scanner shall 不使用 localStorage / sessionStorage / IndexedDB / Cache API 保存扫描内容、文件路径或命中片段；如需保存非敏感界面偏好（如上次主题），仅允许保存布尔型 UI 偏好且不得包含任何扫描数据。

**验收标准**

- Application 面板中无与扫描内容相关的键。
- 刷新后结果清空。

##### CLS-PRV-004 · 日志安全 `P0`

**EARS**：The CommentLeak Scanner shall 在生产构建中不输出命中内容；允许输出的日志仅限计数、耗时、阶段与错误码。

**验收标准**

- 扫描含密钥的样例包 → Console 中检索不到完整密钥。
- 错误日志不含注释原文。

##### CLS-PRV-005 · 依赖与资源本地化 `P0`

**EARS**：The CommentLeak Scanner shall 将全部运行期依赖与资源本地打包；不得引入运行时联网的 SDK、CDN 资源、远程字体或第三方分析脚本。

**验收标准**

- `npm run build` 产物目录内可离线运行。
- 构建产物检索无 `http(s)://` 外部资源引用（用户内容中的 URL 除外）。

##### CLS-PRV-006 · 压缩包安全防护 `P0`

**EARS**：The CommentLeak Scanner shall 实施 zip 炸弹防护（CLS-INP-008）与非法路径拦截（CLS-INP-009），并在 UI 呈现"压缩包结构可疑"的提示。

**验收标准**

- 炸弹包、路径穿越包均被拦截且有具体提示。
- 拦截后页面可继续使用。

##### CLS-PRV-007 · 工具边界与免责声明 `P0`

**EARS**：The CommentLeak Scanner shall 在 README 与界面中声明：本工具为"提交前自查"辅助工具，不替代 gitleaks / trufflehog 等专业密钥扫描；一旦密钥曾进入 git 历史，仅删除注释不足，必须轮换密钥。

**验收标准**

- README 含上述两段声明。
- 界面"隐私声明"可展开查看工具边界说明。

##### CLS-PRV-008 · 渲染安全 `P0`

**EARS**：The CommentLeak Scanner shall 将文件路径、注释内容、错误信息作为纯文本渲染，不得拼接为 HTML；避免通过恶意文件名/内容触发脚本执行。

**验收标准**

- 文件名含 `<img src=x onerror=alert(1)>` → 按文本展示，不执行脚本。
- 注释含 HTML 标签 → 结果表按原文显示。

#### 5.8.2 交互流程

隐私与安全为横切约束，无独立用户流程；其可验证点嵌入主流程（5.1.2、5.5.2、5.6.2）。

#### 5.8.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 外部资源误引入 | 构建产物出现外部引用 | 构建/自测阶段阻断发布 | 开发侧发现并修复；用户侧无感知 |
| 浏览器存储被其他脚本写入 | 宿主环境插件 | 本工具不读取、不写入该数据 | 结果区不出现非本次扫描内容 |
| 恶意文件名 | 文件名含脚本片段 | 纯文本渲染 | 原样显示，不执行 |

---

### 5.9 交付与构建

#### 5.9.1 业务规则（EARS）

##### CLS-BLD-001 · 技术栈约束 `P0`

**EARS**：The CommentLeak Scanner shall 使用 Vite + React + TypeScript + Tailwind CSS 实现，所有依赖本地打包，不引入运行时联网 SDK / CDN 资源 / 远程字体。

**验收标准**

- `package.json` 依赖清单不含分析类联网 SDK。
- 构建产物无外部资源引用。

##### CLS-BLD-002 · 标准构建 `P0`

**EARS**：When 执行 `npm run build`，the CommentLeak Scanner shall 产出可直接由 `npx serve dist` 提供访问的静态站点，且功能完整。

**验收标准**

- 构建成功、无 TypeScript 错误。
- `npx serve dist` 后浏览器访问可完成上传→扫描→导出全流程。

##### CLS-BLD-003 · 单文件构建 `P0`

**EARS**：When 执行 `npm run build:single`，the CommentLeak Scanner shall 通过 vite-plugin-singlefile 产出单文件 `index.html`，双击（`file://` 协议）即可离线使用。

**验收标准**

- 产物为单个 HTML（内联脚本/样式），无外部资源依赖。
- 双击打开后可完成完整扫描流程（含 Worker 逻辑的等价降级/内联处理）。

##### CLS-BLD-004 · 代码组织约束 `P0`

**EARS**：The CommentLeak Scanner 的源码应当按交付约定组织：`src/core/unzip.ts`（解压与文件枚举）、`src/core/fileFilter.ts`（扫描范围判定）、`src/core/commentExtractor/`（按语言提取器 + 映射表）、`src/core/rules.ts`（规则数组）、`src/core/scanner.ts`（编排）、`src/core/redact.ts`（脱敏与上下文）、`src/workers/scan.worker.ts`（扫描后台任务）、`src/ui/*`（组件）、`src/types.ts`（类型定义）。

**验收标准**

- 上述路径全部存在且承担对应职责（可通过代码走查确认）。
- 不存在空壳文件或 TODO 桩。

##### CLS-BLD-005 · README 交付内容 `P1`

**EARS**：The CommentLeak Scanner shall 提供 README，包含：使用方式（两种构建的运行方法）、隐私说明、检测规则清单表、已知限制（正则字面量简化、注释提取边界）、免责声明、验收用例执行结果。

**验收标准**

- README 章节齐全，规则表与代码中规则一致。
- 含"密钥曾进入 git 历史必须轮换"的明确警示。

##### CLS-BLD-006 · 真实实现 `P0`

**EARS**：The CommentLeak Scanner shall 不存在占位实现、TODO 桩、假数据演示路径；所有 P0 模块必须端到端跑通。

**验收标准**

- 代码检索无 `TODO` / `FIXME` / `throw new Error('not implemented')`。
- 验收用例 5 章全部可实际执行通过。

#### 5.9.2 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "开发者" as D
participant "构建工具" as B
participant "静态产物" as O
D -> B : npm run build
B --> O : dist/（可由静态服务器托管）
D -> B : npm run build:single
B --> O : dist/index.html（单文件，可双击）
D -> O : 断网验证全流程
@enduml
```

#### 5.9.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 构建失败 | 依赖/类型错误 | 阻断交付，输出具体错误 | 开发者看到编译错误定位 |
| 单文件产物异常 | 内联资源缺失 | 阻断交付 | 双击白屏视为不通过验收 |
| 版本不一致 | Node 版本过低 | 提示最低 Node 版本要求 | 开发者按 README 升级环境 |

---

## 6. 数据约束

> 本章仅定义业务字段含义与可验证约束，不涉及存储方式、数据库类型与索引设计。

### 6.1 扫描配置（ScanConfig）

1. **ignoreGroups**：6 个可独立启停的忽略规则组状态，布尔值，默认全部开启。
2. **scanPythonDocstring**：布尔值，默认 `true`；控制 `"""`/`'''` 是否参与扫描。
3. **scanContactInfo**：布尔值，默认 `false`；控制邮箱/手机号规则。
4. **maxFileSizeBytes**：单文件上限，固定 `2097152`（2MB），不允许用户调高。
5. **maxTotalUnzipBytes**：解压总量硬上限，固定 `524288000`（500MB）。
6. **maxArchiveBytes**：压缩包上限，固定 `104857600`（100MB）。
7. **ruleSetVersion**：规则集版本字符串，必填，随规则变更递增。
8. **scannedAt**：本次扫描时间戳，ISO 8601 格式，必填。

### 6.2 扫描摘要（ScanSummary）

1. **totalFiles**：压缩包内（或文件夹内）文件总数，整数 ≥ 0。
2. **scannedFiles**：实际参与检测的文件数，整数 ≥ 0。
3. **skippedFiles**：跳过文件数，整数 ≥ 0，且 `scannedFiles + skippedFiles = totalFiles`。
4. **riskFiles**：存在至少 1 条命中的文件数，整数 ≥ 0，且 ≤ `scannedFiles`。
5. **severityCounts**：`{critical, high, medium, low}` 四个非负整数，其和等于去重后的命中总数。
6. **durationMs**：作业耗时（毫秒），整数 ≥ 0。
7. **status**：取值 `completed / empty / cancelled / failed` 之一。

### 6.3 命中项（Finding）

1. **id**：命中唯一标识，本次作业内唯一，格式 `f-<序号>`。
2. **ruleId**：对应规则 ID，必填，必须在规则清单中存在。
3. **ruleName**：规则中文名，必填，非空。
4. **severity**：取值 `critical / high / medium / low`，必填；与 CLS-RUL-013 映射一致。
5. **filePath**：相对压缩包根目录的路径，使用 `/` 分隔，不得以 `/` 开头，不得含 `..` 段。
6. **line**：1-based 起始行号，整数 ≥ 1。
7. **maskedSnippet**：脱敏片段，必填；不得包含完整敏感值（可通过原文包含检查验证）。
8. **contextBefore / contextAfter**：命中所在注释片段的上下各 1 行（若存在），同样脱敏，单行 ≤ 200 字符。
9. **sourceKind**：取值 `line-comment / block-comment / docstring / document / config / fence-sample` 之一。
10. **inCodeFence**：布尔值，仅 Markdown 文档命中可为 `true`，其余恒为 `false`。
11. **description**：规则说明，中文，必填。
12. **suggestion**：修复建议，中文，必填。
13. **suppressedRuleIds**：被去重抑制的规则 ID 列表，可为空数组。

### 6.4 跳过文件（SkippedFile）

1. **path**：文件相对路径，必填，非空。
2. **reason**：取值 `ignored-directory / ignored-type / too-large / unsupported-extension / illegal-path / parse-error / non-text / archive-encrypted` 之一。
3. **sizeBytes**：文件解压后体积，整数 ≥ 0；无法获取时为 `null`。
4. **detail**：补充说明（如命中的目录名、错误摘要），非必填，≤ 200 字符。

### 6.5 检测规则（Rule）

1. **id**：规则唯一标识，格式 `CLS-R-xxx`，全局唯一。
2. **name**：中文规则名，必填，非空。
3. **severity**：四级枚举之一。
4. **pattern**：正则模式字符串，必填，必须能被本地正则引擎编译。
5. **flags**：大小写等标志位声明，必填（可为空集）。
6. **description**：一句话中文说明，≤ 80 字。
7. **suggestion**：中文修复建议，≤ 120 字。
8. **entropy**：可选的熵阈值配置（阈值 3.5、长度 16–128），仅密钥类规则使用。

### 6.6 导出报告（ExportReport）

1. **version**：报告格式版本，必填，字符串。
2. **generatedAt**：生成时间戳，ISO 8601，必填。
3. **config**：完整扫描配置快照，必填。
4. **summary**：扫描摘要，必填。
5. **findings**：命中数组，可为空；每项字段同 6.3，且仅含脱敏片段。
6. **skippedFiles**：跳过文件数组，可为空；字段同 6.4。
7. **ruleCatalog**：本次使用的规则清单快照，用于报告自解释。
8. **禁止字段**：任何 `rawSnippet / fullValue / secret / unmasked` 字段一律不允许出现。

---

## 7. 验收用例（对应原始需求第 5 节）

| 编号 | 输入 / 前置 | 操作步骤 | 预期结果 | 对应需求 | 级别 |
|---|---|---|---|---|---|
| CLS-ACC-01 | `config.js` 含 `// const AWS_KEY = "AKIAABCDEFGHIJKLMNOP"` | 上传 zip → 扫描 | 1 条 **critical**（AWS Access Key）；脱敏片段不含完整 AKIA 串 | CLS-RUL-002、CLS-RPT-004 | P0 |
| CLS-ACC-02 | `config.js` 含 `const url = "http://example.com/a"; // 正常注释` | 上传 → 扫描 | **0 命中**；注释片段仅为"正常注释"，`http://` 未被当作注释 | CLS-EXT-003、CLS-EXT-012 | P0 |
| CLS-ACC-03 | `README.md` 含 `10.20.30.40:8080` 与 `mysql://root:Passw0rd@10.1.2.3:3306/db` | 上传 → 扫描 | 分别命中 **high**（内网 IP）与 **critical**（连接串）；连接串展示为 `mysql://***:***@10.1.2.3:3306/db` | CLS-RUL-005、CLS-RUL-008、CLS-RPT-004 | P0 |
| CLS-ACC-04 | `main.py` 含 `"""数据库密码: Admin@123"""` | 默认开关扫描 | 命中 **high**（通用密钥赋值），来源为 docstring | CLS-EXT-009、CLS-RUL-004 | P0 |
| CLS-ACC-05 | 包内含 `app.min.js`、`node_modules/**`、`logo.png` | 上传 → 扫描 | 三者均不参与扫描，且出现在"已跳过"统计与明细中，原因分别为忽略类型/忽略目录/二进制 | CLS-FLT-001、CLS-FLT-002、CLS-FLT-009 | P0 |
| CLS-ACC-06 | `main.go` 含 `// TODO: 测试账号 test/test 上线前删掉` | 上传 → 扫描 | 命中 **low**（测试/默认凭证） | CLS-RUL-010 | P0 |
| CLS-ACC-07 | 100MB 级压缩包（大文件 + 多条目） | 上传并观察 | 页面可交互、进度持续更新；Performance 面板无 > 200ms 长任务；扫描完成不白屏 | CLS-INP-006、CLS-NFR-003 | P0 |
| CLS-ACC-08 | 断网环境 | 打开 `dist`（本地服务器）与单文件 `index.html` | 上传、扫描、导出全流程可用 | CLS-BLD-002、CLS-BLD-003、CLS-NFR-007 | P0 |
| CLS-ACC-09 | 正常网络 + DevTools Network 面板 | 完成一次完整扫描与导出 | 全程 0 条外部网络请求（仅本地资源加载） | CLS-PRV-001、CLS-NFR-012 | P0 |
| CLS-ACC-10 | `// password = "your_api_key_here"` / `<your-secret>` / `${TOKEN}` | 扫描 | **0 命中**（占位符排除） | CLS-RUL-004、CLS-RUL-016 | P0 |
| CLS-ACC-11 | 高压缩比炸弹包（解压 > 500MB） | 上传 | 中止并提示"检测到异常压缩内容…已中止扫描"，页面不崩溃 | CLS-INP-008、CLS-PRV-006 | P0 |
| CLS-ACC-12 | zip 含 `../../etc/passwd.js` 条目 | 上传 | 该条目被拒绝，跳过清单显示"非法路径条目" | CLS-INP-009 | P0 |
| CLS-ACC-13 | 仅含图片与 `node_modules` 的 zip | 上传 | 显示"压缩包内未找到可扫描的文本文件" + 跳过原因分布，不展示成功态 | CLS-INP-011 | P0 |
| CLS-ACC-14 | 命中片段以 `=` 开头，导出 CSV | 用 Excel 打开 | 单元格前置 `'`，不触发公式计算 | CLS-EXP-002 | P1 |
| CLS-ACC-15 | 构造 5000 条命中 | 滚动与过滤 | 滚动 ≥ 30fps，过滤响应 ≤ 300ms | CLS-RPT-010、CLS-NFR-004 | P1 |
| CLS-ACC-16 | 展开完整内容后导出 JSON | 检索导出文件 | 检索不到完整密钥字符串 | CLS-EXP-004、CLS-PRV-003 | P0 |
| CLS-ACC-17 | 文件名含 `<img src=x onerror=alert(1)>` | 上传扫描 | 文件名按纯文本展示，无脚本执行 | CLS-PRV-008 | P0 |
| CLS-ACC-18 | 关闭 docstring 开关后重扫 `main.py` | 对比两次结果 | docstring 命中消失，`#` 注释命中保留 | CLS-EXT-009 | P1 |

---

## 8. 需求追踪矩阵

| 业务模块 | 需求编号 | 条目数 | 交付位置（用户指定结构） | 验收用例 |
|---|---|---|---|---|
| 文件接收与解压 | CLS-INP-001 ~ 012 | 12 | `src/core/unzip.ts`、`src/ui/*`、`src/workers/scan.worker.ts` | ACC-07、ACC-11、ACC-12、ACC-13 |
| 扫描范围判定 | CLS-FLT-001 ~ 010 | 10 | `src/core/fileFilter.ts`、`src/ui/*` | ACC-05 |
| 注释提取 | CLS-EXT-001 ~ 015 | 15 | `src/core/commentExtractor/*`、`src/types.ts` | ACC-01、ACC-02、ACC-04、ACC-06、ACC-18 |
| 敏感信息检测 | CLS-RUL-001 ~ 017 | 17 | `src/core/rules.ts`、`src/core/scanner.ts` | ACC-01、ACC-03、ACC-04、ACC-06、ACC-10、ACC-11 |
| 结果与脱敏 | CLS-RPT-001 ~ 012 | 12 | `src/core/redact.ts`、`src/ui/*` | ACC-01、ACC-03、ACC-15、ACC-16 |
| 报告导出 | CLS-EXP-001 ~ 004 | 4 | `src/ui/*`（导出交互）、`src/core/redact.ts` | ACC-14、ACC-16 |
| 界面与交互 | CLS-UIX-001 ~ 008 | 8 | `src/ui/*` | ACC-07、ACC-17 |
| 隐私与安全 | CLS-PRV-001 ~ 008 | 8 | 全局（构建配置、`src/core/*`） | ACC-08、ACC-09、ACC-11、ACC-12、ACC-17 |
| 交付与构建 | CLS-BLD-001 ~ 006 | 6 | `package.json`、`vite.config.*`、README | ACC-08 |
| 非功能约束 | CLS-NFR-001 ~ 028 | 28 | 全局 | ACC-07、ACC-09、ACC-15 |

**合计**：共 92 条，其中 P0 77 条、P1 14 条、P2 1 条（CLS-RUL-012 默认关闭）。

---

## 9. 范围外事项（Non-Goals）

1. 后端服务、账号体系、云端历史、团队协作、分享链接。
2. 扫描业务代码正文（Markdown / README / `.env` 等全量文档与配置除外）。
3. 扫描 git 历史、提交记录、远端仓库。
4. 自动修复、批量删除注释、代码改写。
5. 大型 AST 解析器、语义分析、跨文件污点追踪。
6. IDE 插件、CI Action、CLI 工具形态。
7. 多语言界面（本期仅简体中文）。
8. 把本工具当作专业密钥扫描的替代方案。

---

## 10. 假设、依赖与风险

| 类别 | 内容 | 应对 |
|---|---|---|
| 假设 | 用户使用现代 Chromium/Firefox 浏览器，支持 Web Worker 与 File API | 不支持时降级并明确提示（CLS-UIX 异常场景） |
| 假设 | 待扫描仓库以 zip 或本地文件夹提供 | README 说明打包方式 |
| 依赖 | zip 解压能力需在本地实现（用户指定 jszip），不得联网 | 依赖本地打包，断网可用 |
| 风险 | 手写词法在正则/模板字符串等边界存在少量误判 | README"已知限制"明示，不视为验收失败 |
| 风险 | 规则为模式匹配，可能漏检新型密钥格式 | 规则数据驱动可扩展；README 提示不替代专业工具 |
| 风险 | 100MB 压缩包 + 500MB 解压上限可能触及内存红线 | 硬上限 + 及时释放 + 进度与取消能力 |
| 风险 | 密钥一旦进入 git 历史，删除注释无法消除泄露 | README 与界面双重警示"必须轮换密钥" |
| 风险 | 浏览器扩展可读取页面 DOM，破坏隐私承诺 | 页面提示"请确认无外部扩展/网络请求后再使用" |

---

## 11. 变更记录

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| 1.0 | 2026-11-12 | 基于《实现「注释敏感信息扫描器」(CommentLeak Scanner)》初始需求生成 EARS 规格 | 需求规格 Agent |