# 国内主流大模型 API Key 规则扩展 需求规格（EARS）

> **文档状态**：待评审　**版本**：1.0（增量规格）　**日期**：2026-11-13　**需求编号前缀**：CLS-RUL / CLS-ACC
> **父规格**：[`spec.md`](./spec.md) v1.0（CommentLeak Scanner）
> **本文档范围**：
> 1. 新增 4 条国内大模型 API Key 规则（`CLS-R-022` ~ `CLS-R-025`）的需求、风险口径、去重策略与验收标准；
> 2. `--git-history` 历史扫描需求的**架构兼容性结论**（不适用性评估，见 §8）。
> **阶段边界**：本文档只描述"要什么"，不包含设计、任务分解与源码改动；本阶段不修改 `src/core/rules.ts`、`README.md`、测试或任何应用源码，不运行 `npm run test`。

---

## 0. 阅读指南

### 0.1 与父规格的关系

本文档是增量规格。落地前需回灌到父规格的 `5.4.1`、`5.4.2`、`6.5`、`7`、`8`、`11` 章节（回灌清单见 §7）。回灌完成前，若父规格与本文档冲突，以本文档为本次变更的准据。

### 0.2 需求编号规则

| 编号段 | 含义 | 现状 → 本次 |
|---|---|---|
| `CLS-R-xxx` | 规则 ID（`RULES` 数组元素） | 21 条（R-001~R-021）→ 25 条（新增 R-022~R-025） |
| `CLS-RUL-xxx` | 业务需求编号 | 父规格到 CLS-RUL-017 → 本次续编 CLS-RUL-018~024 |
| `CLS-ACC-xxx` | 验收用例编号 | 父规格到 CLS-ACC-18；README §7.1 已用 ACC-19~29 → 本次统一续编 **CLS-ACC-30~44**（见 0.4 编号断层说明） |

### 0.3 EARS 陈述规范

沿用父规格定义的五种模式，变量部分使用中文：

- 事件驱动：`When <事件>, the CommentLeak Scanner shall <响应>`
- 状态驱动：`While <前置状态>, the CommentLeak Scanner shall <响应>`
- 异常驱动：`If <异常触发>, then the CommentLeak Scanner shall <响应>`
- 可选特性：`Where <可选特性启用>, the CommentLeak Scanner shall <响应>`
- 通用约束：`The CommentLeak Scanner shall <响应>`

每条需求必须可测试，验收标准统一采用"输入/操作 → 可观察结果"。

### 0.4 验收编号断层说明（重要）

父规格 §7 的验收编号止于 `CLS-ACC-18`，而 README §7.1（CLS-E-1008 缺陷修复）已占用 `ACC-19~ACC-29`。为保持全局唯一，本次新增用例使用 **`CLS-ACC-30 ~ CLS-ACC-44`**；回灌父规格 §7 时须同时修正父规格与 README 的编号衔接（列入 §7 同步清单）。

---

## 1. 组件定位（增量）

### 1.1 核心职责

本次变更使 CommentLeak Scanner 在既有 21 条规则之上，新增对 DeepSeek、豆包（火山引擎方舟）、阿里通义千问（DashScope）、智谱 GLM / Kimi（Moonshot）四类国内大模型 API Key 的检测能力，并通过「上下文关键词守卫」把同形密钥弱归因到具体厂商，同时保证与既有规则不重复报告。

### 1.2 核心输入

1. **注释/文档片段**（`CommentSnippet`）：沿用既有注释提取结果；守卫判定需要"命中所在行"的文本。
2. **扫描配置**（`ScanConfig`）：本次不新增用户可见开关项；4 条规则默认启用（见 §10 待确认项）。
3. **规则数据**（`Rule`）：新增 4 条规则数据，以及通用「上下文关键词守卫」能力所需的规则字段。
4. **规则集版本常量**：`RULE_SET_VERSION` 由 `1.0.0` 递增为 `1.1.0`。

### 1.3 核心输出

1. **Finding**：`ruleId` 为 `CLS-R-022~025` 之一，`severity = critical`，`maskedSnippet` 脱敏，`suppressedRuleIds` 记录被抑制的同族规则。
2. **RuleCatalogEntry**：规则清单快照数量由 21 变为 25。
3. **ScanSummary.severityCounts**：新增命中按 `critical` 计入，四级之和仍等于去重后总数。
4. **规则清单文档**：README §4 与父规格 §5.4.2 的规则表均为 25 行，规则集版本为 `1.1.0`。

### 1.4 职责边界（不做什么）

1. **不联网校验密钥有效性**：零网络请求是硬约束，规则只做形态 + 上下文判定。
2. **不承诺厂商归属的绝对正确**：无上下文关键词的 `sk-` 值仍由 `CLS-R-006` 以 OpenAI 名义报告，不猜测厂商。
3. **不提供逐条规则的 UI 开关面板**：沿用 `enabledByDefault`，避免用户误关产生"安全"错觉。
4. **不扫描 git 历史、不引入 CLI / Rust / 后端进程**：详见 §8。
5. **不做密钥轮换自动化、不做远端仓库校验**。
6. **不在本阶段修改任何源码、测试与 README**：本阶段只产出需求规格。

---

## 2. 领域术语

**上下文关键词守卫（context keyword guard）**
: 规则级的附加约束：命中值所在行必须同时出现规则声明的厂商关键词，否则该规则不产生命中。

**厂商归属（vendor attribution）**
: 把同形密钥判给具体厂商的能力。本规格只实现"弱归属"——依赖上下文关键词，不依赖密钥自校验。

**形态重叠（pattern overlap）**
: 两条或多条规则在同一行上的匹配区间发生交叠。重叠是否合并由去重族与 `specificity` 决定。

**去重族（dedupeFamily）**
: 去重分组维度之一。同族内重叠命中互相抑制，跨族即使区间重叠也各自保留。

**specificity**
: 同级别命中竞争时的优先级数值，越大越具体、越优先胜出。

**关键词语义域（keyword scope）**
: 守卫关键词只在命中起始位置所在的单行内匹配，不跨行、不跨片段。

**still_in_head**
: git 历史命中是否仍存在于当前 HEAD。本项目不适用，仅见于 §8 的需求原文摘要。

---

## 3. 角色与边界

### 3.1 核心角色

- **开发者**：提交代码前用本工具自查注释/文档中的密钥残留。
- **安全评审**：核对规则集是否覆盖国内主流大模型厂商，评估误报可接受度。
- **测试**：验证新增规则的命中、误报抑制与同族去重结果。

### 3.2 外部系统

- **无**。本组件零网络请求、零上传；不调用系统 git、不调用任何外部服务（见 §8）。

### 3.3 交互上下文

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
actor "开发者" as DEV
actor "安全评审 / 测试" as REV
rectangle "CommentLeak Scanner（浏览器本地）" as CLS {
}
DEV --> CLS : 选择 zip / 文件夹
CLS --> DEV : 分级脱敏命中 + 规则清单
REV --> CLS : 查看规则表 / 验收结果
note right of CLS
  外部依赖：无
  git 命令行：不接入（见 §8 不适用性评估）
end note
@enduml
```

---

## 4. DFX 约束（增量）

### 4.1 性能

1. 单个 8KB 注释片段新增 4 条规则后，匹配总增量应 ≤ **5ms**（P95，现代桌面 Chromium）。
2. 上下文关键词守卫为行内线性扫描，单次判定复杂度不得超过 `O(命中行长度)`，禁止对整片段反复回溯。
3. `specificity` 与 `contextKeywords` 的判定不得引入新的正则编译（沿用规则编译缓存）。

**验收条件**：8KB 片段 × 4 条新规则各 100 次匹配，总耗时 ≤ 500ms（与既有 21 条规则同量级）。

### 4.2 可靠性

1. 同一输入重复扫描，命中集合、顺序、`suppressedRuleIds` 必须完全一致（无随机、无时间依赖）。
2. 规则 ID 全局唯一；`validateRuleSet` 对新增字段的校验必须为纯函数。

**验收条件**：同一夹具连续扫描 3 次，结果深度相等。

### 4.3 安全性

1. 零网络、零上传、零持久化约束不变；关键词别名以静态常量内置，禁止运行时从网络或远端配置获取。
2. 守卫关键词与规则数据不得包含真实密钥样例。
3. 脱敏仍由 `redact.ts` 单一入口完成，新增规则只声明 `maskKind`。

**验收条件**：`npm run verify:network` 在变更后仍退出码 0（实现阶段执行）。

### 4.4 可维护性

1. 新增规则只增加规则数据 + 通用守卫能力，不得修改作业编排流程（`jobRunner`）。
2. `validateRuleSet` 必须覆盖 `contextKeywords` 的结构与作用域约束。
3. 规则说明（`description`）≤ 120 字符、修复建议（`suggestion`）≤ 160 字符（以现有代码校验为准，见 §10-R7）。

### 4.5 兼容性

1. 规则集版本 `1.0.0 → 1.1.0`，属向后兼容的能力扩展；`Finding` 与 `ExportReport` 字段不增不减。
2. 既有 21 条规则的命中行为保持不变，唯一例外是 `sk-` 占位符归一化修复（CLS-RUL-018 第 6 条，见 §10-R10）。
3. 旧报告中的 `ruleCatalog` 仍可解析；新报告可包含 25 条规则。

---

## 5. 核心能力

### 5.1 上下文关键词守卫与占位符归一化（CLS-RUL-018 · P0）

#### 5.1.1 业务规则

1. **声明式守卫**
   The CommentLeak Scanner shall 支持在规则数据上声明可选的 `contextKeywords`（字符串数组，≥1 项，大小写不敏感，按字面量子串匹配）。
   a. 验收条件：规则声明 `["DEEPSEEK"]`，命中行包含 `deepseek` 或 `DEEPSEEK` → 守卫通过；不含 → 该规则不产生命中。

2. **单行作用域**
   When 规则声明了 `contextKeywords`，the CommentLeak Scanner shall 仅以命中起始位置所在的单行（以 `\n` 分隔，不含换行符）作为守卫作用域。
   a. 验收条件：关键词出现在命中行的上一行或下一行 → 不通过；出现在同一行 → 通过。

3. **执行顺序**
   The CommentLeak Scanner shall 在占位符守卫、示例值守卫、结构校验器、熵守卫全部通过之后、生成 `RawMatch` 之前执行关键词守卫。
   a. 验收条件：占位符值即使同行含关键词，也不得命中。

4. **缺省即无守卫**
   If 规则未声明 `contextKeywords` 或声明为空数组，then the CommentLeak Scanner shall 视作无守卫，保持既有 21 条规则行为不变。
   a. 验收条件：变更前后对既有验收夹具的命中集合逐条一致。

5. **规则数据校验**
   The CommentLeak Scanner shall 在 `validateRuleSet` 中校验 `contextKeywords`：非空数组、每项长度 ≥ 2、项间不重复、不得含正则元字符、仅允许 `specificity ≥ 100` 的规则使用。
   a. 验收条件：构造违反项 → 返回对应 `field = "contextKeywords"` 的问题项。

6. **`sk-` 占位符归一化**
   When 待判定值的形态为 `sk-` 或 `sk-proj-` 前缀，the CommentLeak Scanner shall 先剥离该前缀，再复用既有占位符集合判定；剥离后以 `your|test|demo|dev|example|sample|dummy|fake|mock|placeholder|changeme|todo|fixme` 开头，或为全相同字符（如全 `0`、全 `f`）时，判定为占位符。该归一化对所有启用 `placeholderGuard` 的规则统一生效（含既有 `CLS-R-006`、`CLS-R-011`）。
   a. 验收条件：`sk-your_api_key_here`、`sk-test-key`、`sk-00000000000000000000000000000000` → 不命中；`sk-abcdefghijklmnopqrstuvwxyz012345` → 仍参与规则判定。

7. **禁止项**
   禁止把关键词守卫实现为"命中后改写规则名"、编辑距离模糊匹配或跨行搜索。
   a. 验收条件：关键词拼写不符（如 `deepsek`）→ 不通过；关键词在相邻行 → 不通过。

#### 5.1.2 交互流程

```plantuml
@startuml
skinparam defaultFontName "Microsoft YaHei"
participant "注释片段" as SNIP
participant "规则匹配" as RULE
participant "守卫判定" as GUARD
participant "去重" as DEDUPE
participant "结果" as OUT

SNIP -> RULE : 逐行文本
RULE -> RULE : 4 条新规则形态匹配
RULE -> GUARD : 候选命中（值 + 命中行）
GUARD -> GUARD : 占位符归一化 → 示例值 → 结构校验 → 熵 → 关键词
alt 任一守卫不通过
  GUARD --> RULE : 丢弃该候选（无提示）
else 全部通过
  GUARD -> DEDUPE : RawMatch(ruleId, 区间, 行号)
end
DEDUPE -> DEDUPE : 同族重叠合并，severity → specificity → ruleId 选胜者
DEDUPE --> OUT : Finding + suppressedRuleIds
@enduml
```

#### 5.1.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 关键词为空 | 规则声明 `contextKeywords: []` | 视作无守卫，行为等同既有规则 | 无提示（开发期校验告警） |
| 关键词含正则元字符 | 规则数据错误 | `validateRuleSet` 返回问题项；运行期按字面量匹配 | 开发期可见"规则配置异常" |
| 命中行被截断 | 片段超过 8KB 被截断 | 以截断后可见行文本判定，可能漏配关键词 | 命中减少但不报错；README 已知限制登记 |
| 关键词大小写差异 | 全大写/全小写混用 | 大小写不敏感匹配 | 正常命中 |

---

### 5.2 DeepSeek API Key（CLS-RUL-019 · CLS-R-022 · P0）

#### 5.2.1 业务规则

1. **匹配形态**
   The CommentLeak Scanner shall 检测 `sk-` 前缀 + **32 位或 51 位** `[A-Za-z0-9]` 的整串，且必须排除 `sk-proj-` 前缀。
   - 可执行口径（允许等价实现，但下列样例必须通过）：
     `\b(?!sk-proj-)(sk-[A-Za-z0-9]{51}|sk-[A-Za-z0-9]{32})\b`
   - 说明：长度分支只允许字母数字，**不得**允许 `-`、`_`，以避免吞掉 OpenAI `sk-proj-` 与其他厂商的带连字符 key。

2. **严重级别**
   The CommentLeak Scanner shall 将该命中判定为 **critical**。

3. **上下文关键词守卫**
   The CommentLeak Scanner shall 要求命中行出现以下任一关键词（大小写不敏感）：
   `DEEPSEEK`、`DEEPSEEK_API_KEY`、`deepseek.com`、`api.deepseek.com`。
   - 口径：关键词缺省 → `CLS-R-022` 不命中，不猜测厂商。

4. **占位符与示例值**
   The CommentLeak Scanner shall 对该规则启用占位符守卫，并执行 §5.1 第 6 条的 `sk-` 前缀归一化；不启用示例主机守卫。

5. **捕获组与脱敏**
   The CommentLeak Scanner shall 使用 `captureGroup = 1`、`maskKind = "generic"`，脱敏后只保留前 4 位（示例为 `sk-a`）与末 4 位（示例为 `2345`），中间以掩码替代，不得展示完整值。

6. **默认开关**
   The CommentLeak Scanner shall 默认启用该规则（`enabledByDefault = true`）。

7. **去重**
   The CommentLeak Scanner shall 将 `dedupeFamily = "secret-value"`、`specificity = 120`，确保有守卫时优先于 `CLS-R-006`（100）、`CLS-R-011`（10）、`CLS-R-019`（5）胜出。

8. **风险与口径（应答原始需求的技术风险）**
   - **与 R-006 完全重叠**：R-006 的 `sk-(?:proj-)?[A-Za-z0-9_-]{20,}` 天然覆盖 32/51 位。口径：靠"守卫 + 更高 specificity"取胜；**无关键词时不报 R-022**，维持 R-006 的 OpenAI 报告，避免把 OpenAI key 误标为 DeepSeek。
   - **长度不确定**：仅覆盖 32 与 51；其他长度不报 R-022，由 R-006 兜底，并在 README「已知限制」登记。
   - **51 位与 R-025 分支 B（33–64）重叠**：见 §5.6 矩阵，按 specificity 与关键词决定唯一胜者。

9. **验收标准**
   - `// DEEPSEEK_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345`（32 位）→ 1 条 critical，`ruleId = CLS-R-022`，`suppressedRuleIds` 含 `CLS-R-006`。
   - `// DEEPSEEK_API_KEY=sk-0123456789abcdef0123456789abcdef0123456789abcdef012`（51 位）→ 1 条 `CLS-R-022`。
   - `// sk-abcdefghijklmnopqrstuvwxyz012345`（无关键词）→ 1 条 `CLS-R-006`，**0 条** `CLS-R-022`。
   - `// DEEPSEEK_KEY=sk-proj-abcdefghijklmnopqrstuv` → `CLS-R-006`，**0 条** `CLS-R-022`。
   - `// DEEPSEEK_API_KEY=sk-your_api_key_here` → **0 命中**。

#### 5.2.2 交互流程

见 §5.1.2 图：本规则在"4 条新规则形态匹配"分支内产出候选，在"关键词"守卫处要求 `DEEPSEEK` 系列关键词，通过后进入同族去重。

#### 5.2.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 无上下文 | 普通 `sk-` 32 位 | R-022 静默不命中，由 R-006 报告 | 1 条 OpenAI critical（不标注 DeepSeek） |
| 长度偏差 | 33/48 位等 | R-022 不命中，由 R-006 兜底 | 1 条 OpenAI critical；README 已说明 |
| 占位符 | `sk-your_...` | 前缀归一化后判定为占位符 | 0 命中 |
| 关键词跨行 | 关键词在上一行 | 单行作用域拦截 | R-022 不命中，R-006 兜底 |

---

### 5.3 豆包（火山引擎）API Key（CLS-RUL-020 · CLS-R-023 · P1）

#### 5.3.1 业务规则

1. **匹配形态**
   The CommentLeak Scanner shall 检测以下两种形态之一：
   - 32 位十六进制字符串（大小写不敏感）；
   - 标准 UUID（`8-4-4-4-12` 十六进制，36 字符）。
   - 可执行口径：`\b([0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b`

2. **严重级别**
   The CommentLeak Scanner shall 将该命中判定为 **critical**。

3. **强制上下文关键词守卫（硬要求）**
   The CommentLeak Scanner shall 要求命中行出现以下任一关键词（大小写不敏感）：
   `ARK_API_KEY`、`ARKAPIKEY`、`VOLCENGINE`、`VOLC`、`DOUBAO`、`火山`、`方舟`、`豆包`。
   - **禁止项**：禁止在任何缺少上述关键词的行上产生 `CLS-R-023` 命中。本规则不允许"无守卫降级为通用规则"，因为 32 位 hex/UUID 与 MD5、资源 UUID、构建指纹完全同形。

4. **示例值抑制**
   The CommentLeak Scanner shall 排除以下值：
   - 全相同字符的 32 位串（全 `0`、全 `f`、全 `a` 等）；
   - 内置文档示例 UUID 名单，至少包含 RFC 4122 示例值 `123e4567-e89b-12d3-a456-426614174000`；
   - `placeholderGuard` 既有集合命中的值。

5. **捕获组与脱敏**
   The CommentLeak Scanner shall 使用 `captureGroup = 1`、`maskKind = "generic"`，仅保留前 4 位与末 4 位。

6. **默认开关**
   The CommentLeak Scanner shall 默认启用该规则（`enabledByDefault = true`）；若评审改为默认关闭，需同步 README「默认」列为"关"（见 §10-R5）。

7. **去重**
   The CommentLeak Scanner shall 将 `dedupeFamily = "secret-value"`、`specificity = 110`；与 `CLS-R-011`（10）、`CLS-R-019`（5）同族重叠时以 critical 胜出。

8. **风险与口径（应答原始需求的技术风险）**
   - **"32 位 UUID 或 hex" 等价于任意 MD5/UUID**：误报不可接受 → 关键词守卫为**硬性前置条件**，无关键词即不实现该命中。
   - **关键词覆盖**：必须覆盖火山引擎方舟常见写法 `ARK_API_KEY` 与 `VOLCENGINE_ARK_API_KEY`；`ARK` 单独过短且易与 `ARK` 项目名冲突，不纳入。
   - **UUID 与 hex 双分支**：UUID 带连字符，长度 36；不能用单一 `{32}` 覆盖，否则整条 UUID 漏检。
   - **示例 UUID**：文档示例值必须排除，否则"文档里写示例"会被判 critical。

9. **验收标准**
   - `// ARK_API_KEY=d41d8cd98f00b204e9800998ecf8427e` → 1 条 critical，`CLS-R-023`，`suppressedRuleIds` 含 `CLS-R-019`（高熵兜底被抑制）。
   - `// VOLCENGINE_ARK_API_KEY=9c1f4b7a-2d63-4f18-9a20-7c5e8d3b1a44` → 1 条 `CLS-R-023`。
   - `// md5: d41d8cd98f00b204e9800998ecf8427e` → **0 命中**。
   - `// uuid: 9c1f4b7a-2d63-4f18-9a20-7c5e8d3b1a44` → **0 命中**。
   - `// ARK_API_KEY=123e4567-e89b-12d3-a456-426614174000` → **0 条** `CLS-R-023`（内置示例 UUID 排除）；因关键词存在，允许 1 条 `CLS-R-019` medium 高熵兜底。
   - `// ARK_API_KEY=ffffffffffffffffffffffffffffffff` → **0 条** `CLS-R-023`（全相同字符按占位符排除）；因值低熵，允许 1 条 `CLS-R-011` high。
   - `// 豆包示例: 123e4567-e89b-12d3-a456-426614174000`（无密钥关键词、无赋值）→ **0 命中**。

#### 5.3.2 交互流程

见 §5.1.2 图：本规则在形态匹配后，先执行"示例值抑制"，再执行强关键词守卫；缺一不可。

#### 5.3.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 无厂商关键词 | 普通 MD5/UUID | R-023 不命中；R-011/R-019 是否需要命中取决于其自身关键词与熵 | 通常 0 命中 |
| 关键词弱匹配 | 行内仅出现 `ARK`（非 `ARK_API_KEY`） | 不通过守卫 | 0 命中（避免误报） |
| 全 0 UUID | 构建占位值 | 示例值抑制 | 0 命中 |
| 真实 key 恰好等于示例 UUID | 概率极低 | 按示例值排除 | 可能漏检；README 说明 |

---

### 5.4 阿里通义千问（DashScope）API Key（CLS-RUL-021 · CLS-R-024 · P0）

#### 5.4.1 业务规则

1. **匹配形态**
   The CommentLeak Scanner shall 检测 `sk-` 前缀 + **严格 32 位** `[A-Za-z0-9]`，且排除 `sk-proj-`。
   - 可执行口径：`\b(?!sk-proj-)(sk-[A-Za-z0-9]{32})\b`

2. **严重级别**
   The CommentLeak Scanner shall 将该命中判定为 **critical**。

3. **上下文关键词守卫**
   The CommentLeak Scanner shall 要求命中行出现以下任一关键词（大小写不敏感）：
   `DASHSCOPE`、`DASHSCOPE_API_KEY`、`QWEN`、`qwen`、`通义`、`千问`、`aliyun`、`dashscope.aliyuncs.com`。

4. **占位符与示例值**
   The CommentLeak Scanner shall 启用占位符守卫与 §5.1 第 6 条 `sk-` 前缀归一化；不启用示例主机守卫。

5. **捕获组与脱敏**
   The CommentLeak Scanner shall 使用 `captureGroup = 1`、`maskKind = "generic"`。

6. **默认开关**
   The CommentLeak Scanner shall 默认启用（`enabledByDefault = true`）。

7. **去重**
   The CommentLeak Scanner shall 使用 `dedupeFamily = "secret-value"`、`specificity = 120`。

8. **风险与口径（应答原始需求的技术风险）**
   - **与 R-006 / R-022 三方重叠**：三者在 32 位 `sk-` 上区间完全一致。口径：R-024 依赖 DashScope 关键词；与 R-022 同分（120）时按 `ruleId` 字典序，`CLS-R-022` 胜（仅当同一行同时出现 `deepseek` 与 `dashscope` 关键词时发生）。
   - **禁止用长度区分 R-022 与 R-024**：两者都可能是 32 位，唯一区分维度是上下文关键词。
   - **长度偏差**（31/33 位）→ R-024 不命中，由 R-006 兜底，README 登记。

9. **验收标准**
   - `// DASHSCOPE_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345` → 1 条 `CLS-R-024`，`suppressedRuleIds` 含 `CLS-R-006`。
   - `// qwen api key: sk-abcdefghijklmnopqrstuvwxyz012345` → 1 条 `CLS-R-024`。
   - 同一文本去掉关键词后 → 1 条 `CLS-R-006`，0 条 `CLS-R-024`。
   - `// DASHSCOPE_API_KEY=sk-abcdefghijklmnopqrstuvwxyz0123456`（33 位）→ `CLS-R-006`，0 条 `CLS-R-024`。
   - 同一行同时含 `deepseek` 与 `dashscope` → 只保留 `CLS-R-022`（字典序）1 条。

#### 5.4.2 交互流程

见 §5.1.2 图；本规则的守卫关键词集合与 R-022 互斥，冲突时由去重确定性规则裁决。

#### 5.4.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 无上下文 | `sk-` + 32 位 | R-024 不命中，R-006 报告 | 1 条 OpenAI critical |
| 双关键词同行 | `deepseek` 与 `dashscope` 同时出现 | specificity 同为 120，`CLS-R-022` 胜 | 1 条 DeepSeek critical，R-006/R-024 被抑制 |
| 长度偏差 | 33 位 | R-024 不命中 | 1 条 OpenAI critical |

---

### 5.5 智谱 GLM / Kimi（Moonshot）API Key（CLS-RUL-022 · CLS-R-025 · P1）

#### 5.5.1 业务规则

1. **匹配形态（必须收窄，禁止宽泛点号通配）**
   The CommentLeak Scanner shall 仅检测以下两种形态：
   - **分支 A（GLM 点号）**：恰好两段，每段 16–32 位 `[A-Za-z0-9]`，中间一个点；前后不得紧邻点或字母数字；第一段不得以 `eyJ` 开头（排除 JWT 前两段）。
   - **分支 B（Kimi `sk-` 变体）**：`sk-` + **33–64 位** `[A-Za-z0-9]`，排除 `sk-proj-`；**不含 32 位**，避免与 R-022/R-024 的 32 位区间重叠。
   - 可执行口径（允许等价实现）：
     `(?<![\w.])((?!eyJ)[A-Za-z0-9]{16,32}\.[A-Za-z0-9]{16,32}|(?!sk-proj-)sk-[A-Za-z0-9]{33,64})(?![\w.])`

2. **严重级别**
   The CommentLeak Scanner shall 将该命中判定为 **critical**。

3. **上下文关键词守卫**
   The CommentLeak Scanner shall 要求命中行出现以下任一关键词（大小写不敏感）：
   `GLM`、`ZHIPU`、`BIGMODEL`、`CHATGLM`、`智谱`、`MOONSHOT`、`KIMI`、`月之暗面`、`moonshot.cn`。

4. **占位符与示例值**
   The CommentLeak Scanner shall 启用占位符守卫与 §5.1 第 6 条归一化；点号形态的占位符样例 `your_glm_key_here.your_glm_secret_here` 必须被排除。

5. **捕获组与脱敏**
   The CommentLeak Scanner shall 使用 `captureGroup = 1`、`maskKind = "generic"`。

6. **默认开关**
   The CommentLeak Scanner shall 默认启用（`enabledByDefault = true`）；若评审改为默认关闭，需同步 README「默认」列（见 §10-R5）。

7. **去重**
   The CommentLeak Scanner shall 使用 `dedupeFamily = "secret-value"`、`specificity = 130`，确保 Kimi `sk-` 分支在关键词存在时优先于 `CLS-R-006`（100）、`CLS-R-022`（120）、`CLS-R-024`（120）胜出。

8. **风险与口径（应答原始需求的技术风险）**
   - **"32–64 位点号分割"过于宽泛**：若写成 `\S+\.\S+` 会把域名、IPv4、版本号、文件路径全部命中。口径：限定"恰好两段 + 每段 16–32 位字母数字 + 前后边界 + 关键词守卫"。
   - **JWT 误命中**：JWT 前两段常为 16–32 位且以 `eyJ` 开头，必须用 `(?!eyJ)` 与"前后不得为点"双重排除。
   - **Kimi 与 `sk-` 家族重叠**：分支 B 取 33–64 位并与关键词绑定；32 位 Kimi key 降级由 R-006 报告（README 登记）。
   - **GLM 真实形态需校准**：本规格采用"两段 16–32 位"，若官方实际为单段 32 位或其他结构，需在实现前确认（§10-R3），仅调整量词与分支，不改变守卫语义。

9. **验收标准**
   - `// ZHIPU_API_KEY=abcdef0123456789.abcdef0123456789` → 1 条 `CLS-R-025`。
   - `// GLM-4 key: 0123456789abcdef.0123456789abcdef` → 1 条 `CLS-R-025`。
   - `// MOONSHOT_API_KEY=sk-0123456789abcdef0123456789abcdef0123456789abcdef`（48 位）→ 1 条 `CLS-R-025`，`suppressedRuleIds` 含 `CLS-R-006`。
   - `// api.example.com/v1/user.profile` → **0 命中**。
   - `// version=1.2.3.4` → **0 命中**。
   - JWT 样例 `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk` → **0 条** `CLS-R-025`（仍由 `CLS-R-014` 命中）。
   - `// ZHIPU_API_KEY=your_glm_key_here.your_glm_secret_here` → **0 命中**。
   - 三段式点号串（如 `abcdef0123456789.abcdef0123456789.abcdef0123456789`）→ **0 命中**（前后边界约束）。

#### 5.5.2 交互流程

见 §5.1.2 图；本规则在形态匹配后先排除 JWT/三段结构，再做关键词守卫。

#### 5.5.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 普通域名/版本号 | 段长 < 16 | 不匹配 | 0 命中 |
| JWT 前两段 | 第一段以 `eyJ` 开头 | 负向断言排除 | 仅 R-014 命中 |
| 三段点号串 | 存在第三个点 | 前后边界排除 | 0 命中 |
| 无 GLM/Kimi 关键词 | 两段随机串 | 守卫拦截 | 0 命中 |
| 32 位 Kimi key | 分支 B 要求 33–64 | R-025 不命中，R-006 兜底 | 1 条 OpenAI critical |

---

### 5.6 与既有规则的重叠与去重策略（CLS-RUL-023 · P0）

#### 5.6.1 业务规则

1. **同族归属**
   The CommentLeak Scanner shall 将 `CLS-R-022~025` 的 `dedupeFamily` 统一声明为 `secret-value`，与 `CLS-R-006`、`CLS-R-011`、`CLS-R-019` 同族。

2. **分组键与合并**
   The CommentLeak Scanner shall 沿用 `filePath#line#dedupeFamily` 分组；同组内匹配区间重叠（含互相包含）的命中合并为一个簇。

3. **胜出顺序**
   The CommentLeak Scanner shall 按"severity 高 → specificity 大 → ruleId 字典序小"选唯一胜者，其余规则的 `ruleId` 写入 `suppressedRuleIds`。

4. **跨族共存**
   The CommentLeak Scanner shall 不因新增规则抑制其他去重族（如 `network-location` 的内网 IP）；同一行不重叠的两把不同密钥仍保留 2 条。

5. **去重矩阵（必须由单测逐行覆盖）**

> 下表按既有 `password-like` 校验器语义列候选：高熵 base64/hex 值会让 `CLS-R-011` 主动让位（不命中），含点号的值不属于 base64/hex 字符集，故 `CLS-R-011` 会命中。`CLS-R-019` 是否命中取决于该值熵是否 > 3.5。

| 命中行样例 | 候选规则（级别/specificity） | 胜出 | `suppressedRuleIds` |
|---|---|---|---|
| `DEEPSEEK_API_KEY=sk-<32>` | R-022(critical/120)、R-006(critical/100)、R-019(medium/5) | **R-022** | R-006、R-019 |
| `sk-<32>`（无关键词） | R-006(critical/100)、R-019(medium/5) | **R-006** | R-019 |
| `DEEPSEEK_API_KEY=sk-<51>` | R-022(120)、R-025(130，但无 Kimi/GLM 关键词→不命中)、R-006(100) | **R-022** | R-006 |
| `ARK_API_KEY=<32hex>` | R-023(critical/110)、R-019(medium/5) | **R-023** | R-019 |
| `md5: <32hex>` | 无候选 | — | — |
| `DASHSCOPE_API_KEY=sk-<32>` | R-024(critical/120)、R-006(critical/100)、R-019(medium/5) | **R-024** | R-006、R-019 |
| `deepseek dashscope sk-<32>` | R-022(120)、R-024(120)、R-006(100) | **R-022**（字典序） | R-024、R-006 |
| `MOONSHOT_API_KEY=sk-<48>` | R-025(critical/130)、R-022(120，无 DEEPSEEK 关键词→不命中)、R-006(100)、R-019(5) | **R-025** | R-006、R-019 |
| `ZHIPU_API_KEY=<16>.<16>` | R-025(130)、R-011(high/10)、R-019 仅第一段(medium/5) | **R-025** | R-011、R-019 |
| `mysql://root:Passw0rd@10.1.2.3/db` | R-012(connection)、R-015(network-location) | 两条都保留 | — |

6. **确定性**
   The CommentLeak Scanner shall 保证同一输入的去重结果与规则遍历顺序无关；`specificity` 相同且区间相同时按 `ruleId` 字典序裁决。

7. **验收标准**
   - 矩阵每一行都有对应单测，断言胜出 `ruleId` 与 `suppressedRuleIds` 集合。
   - `// DEEPSEEK_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345` → 命中总数为 1。
   - 同一行两个不重叠的 `sk-` 值 → 保留 2 条。

#### 5.6.2 交互流程

见 §5.1.2 图末段"同族重叠合并"；矩阵为判定真值表。

#### 5.6.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 区间部分重叠 | 两个值相邻但共享 1 个字符 | 同族合并为 1 条（胜者） | 可能少报 1 条，README 已知限制 |
| `suppressedRuleIds` 为空 | 无竞争命中 | 空数组 | 正常 |
| 新增规则未命中守卫 | 关键词缺失 | 不产生候选，不写入抑制列表 | 无提示 |

---

### 5.7 规则集与文档一致性（CLS-RUL-024 · P0）

#### 5.7.1 业务规则

1. **数量一致**
   The CommentLeak Scanner shall 保证 `RULES.length = 25`、`RULE_CATALOG.length = 25`，且 ID 集合与 README 规则表 25 行完全一致。
   a. 验收条件：`new Set(RULES.map(r => r.id)).size === 25`；README 表格行数（不含表头）为 25。

2. **启动校验**
   The CommentLeak Scanner shall 保证 `validateRuleSet(RULES)` 返回空数组，包含新增 `contextKeywords` 校验。
   a. 验收条件：单测 `expect(validateRuleSet(RULES)).toEqual([])`。

3. **版本递增**
   The CommentLeak Scanner shall 将 `RULE_SET_VERSION` 设为 `1.1.0`，并保证 `createDefaultScanConfig().ruleSetVersion === "1.1.0"`。
   a. 验收条件：配置快照与导出报告均出现 `1.1.0`。

4. **文案约束**
   每条新规则必须提供中文 `name`、`description`、`suggestion`，且 `description` ≤ 120 字符、`suggestion` ≤ 160 字符。

5. **默认启用一致性**
   The CommentLeak Scanner shall 保证 4 条新规则出现在 `getEnabledRules(createDefaultScanConfig())` 的返回中（若评审决定某条默认关闭，则以评审结论为准并同步 README）。

#### 5.7.2 交互流程

用户查看"规则说明" → 规则清单渲染 25 条 → 与 README 表格一致。

#### 5.7.3 异常场景

| 场景 | 触发条件 | 系统行为 | 用户感知 |
|---|---|---|---|
| 只改代码未改 README | 规则数 25 而文档 21 | 一致性单测失败 | 测试报告明确指出数量不一致 |
| ID 重复 | 复制粘贴错误 | `validateRuleSet` 返回"规则 ID 重复" | 开发期阻断 |
| 捕获组越界 | `captureGroup=1` 但无分组 | 校验返回"捕获组超过实际组数" | 开发期阻断 |

---

## 6. 数据约束

> 本章仅定义业务字段含义与可验证约束，不涉及存储方式与实现结构。

### 6.1 检测规则（Rule，扩展后）

1. **id**：`CLS-R-xxx`，全局唯一；本次新增 `CLS-R-022~025`。
2. **name**：中文规则名，非空（示例：`DeepSeek API Key`）。
3. **severity**：四级枚举之一；本次 4 条均为 `critical`。
4. **pattern**：正则模式字符串，必须可编译；形态要求见 §5.2~§5.5。
5. **flags**：必须含 `g`；本次 4 条均为 `g`（大小写敏感，靠关键词守卫做大小写不敏感匹配）。
6. **description**：一句话中文说明，非空，≤ 120 字符。
7. **suggestion**：中文修复建议，非空，≤ 160 字符。
8. **maskKind**：本次 4 条均为 `generic`。
9. **captureGroup**：本次 4 条均为 `1`（值必须落在分组内，避免把关键词一起脱敏）。
10. **validator**：本次 4 条均为 `none`（结构校验由守卫与形态约束承担）。
11. **dedupeFamily**：本次 4 条均为 `secret-value`。
12. **specificity**：R-022=120、R-023=110、R-024=120、R-025=130。
13. **placeholderGuard**：本次 4 条均为 `true`。
14. **sampleGuard**：本次 4 条均为 `false`（示例值抑制由 §5.1/§5.3 规则承担）。
15. **entropy**：本次 4 条均为 `null`（不引入熵门槛，避免 UUID/hex 低熵漏检）。
16. **enabledByDefault**：本次 4 条均为 `true`（R-023/R-025 需评审确认，见 §10-R5）。
17. **contextKeywords（新增字段）**：可选字符串数组；非空时每项长度 ≥ 2、不重复、不含正则元字符；仅允许 `specificity ≥ 100` 的规则声明；缺省或空数组表示无守卫。

### 6.2 新增规则参数表

| 规则 ID | 名称 | 级别 | 匹配形态（摘要） | flags | captureGroup | maskKind | contextKeywords | specificity | dedupeFamily | placeholderGuard | sampleGuard | entropy | 默认 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CLS-R-022 | DeepSeek API Key | critical | `sk-` + 32 或 51 位字母数字，排除 `sk-proj-` | g | 1 | generic | `DEEPSEEK`、`deepseek.com` | 120 | secret-value | true | false | null | 开 |
| CLS-R-023 | 豆包（火山引擎）API Key | critical | 32 位 hex 或标准 UUID，**强制**关键词守卫 | g | 1 | generic | `ARK_API_KEY`、`VOLCENGINE`、`VOLC`、`DOUBAO`、`火山`、`方舟`、`豆包` | 110 | secret-value | true | false | null | 开 |
| CLS-R-024 | 通义千问（DashScope）API Key | critical | `sk-` + 严格 32 位字母数字，排除 `sk-proj-` | g | 1 | generic | `DASHSCOPE`、`QWEN`、`通义`、`千问`、`aliyun` | 120 | secret-value | true | false | null | 开 |
| CLS-R-025 | 智谱 GLM / Kimi API Key | critical | 两段 16–32 位点号串，或 `sk-` + 33–64 位字母数字 | g | 1 | generic | `GLM`、`ZHIPU`、`BIGMODEL`、`CHATGLM`、`智谱`、`MOONSHOT`、`KIMI`、`月之暗面` | 130 | secret-value | true | false | null | 开 |

### 6.3 命中项（Finding）

1. **ruleId**：必须是 25 条规则之一；新增命中为 `CLS-R-022~025`。
2. **severity**：新增命中固定 `critical`，并计入 `severityCounts.critical`。
3. **maskedSnippet**：不得包含完整密钥；`generic` 掩码保留前 4 位与末 4 位（长度 > 40 时为"前 4 + 16 星 + … + 末 4"）。
4. **suppressedRuleIds**：当新增规则胜出时，必须包含被抑制的 `CLS-R-006`（若其命中），以及同族重叠的 `CLS-R-011`/`CLS-R-019`（若命中）；不得包含跨族规则。
5. **description / suggestion**：来自对应规则数据，非空。
6. **禁止字段**：不得新增 `rawValue`、`fullValue`、`commit` 等未在父规格白名单中的字段。

### 6.4 规则集版本

1. **RULE_SET_VERSION**：取值 `1.1.0`，语义为"向后兼容的新增规则"。
2. **ScanConfig.ruleSetVersion**：由该常量注入，不得硬编码第二处。
3. **ExportReport.ruleCatalog**：25 条快照；报告可自解释新增规则。

---

## 7. 文档与测试同步范围（D）

> 本节是"实现阶段必须同步"的清单，本阶段**不执行**。

### 7.1 代码与测试同步

| 文件 | 位置 | 现状 | 变更后 | 校验方式 |
|---|---|---|---|---|
| `src/core/rules.ts` | `RULE_SET_VERSION` | `'1.0.0'` | `'1.1.0'` | 单测断言 |
| `src/core/rules.ts` | `RULES` 数组 | 21 条 | 追加 4 条（R-022~025） | `RULES.length` |
| `src/core/rules.ts` | `validateRuleSet` | 无 `contextKeywords` 校验 | 新增结构/长度/元字符/specificity 校验 | 构造非法规则断言 |
| `src/core/scanner.ts` | `scanSnippets` | 无关键词守卫 | 在 RawMatch 生成前执行单行关键词判定 | 守卫用例 |
| `src/types.ts` | `Rule` 接口 | 无 `contextKeywords` | 新增可选字段 | `tsc --noEmit` |
| `src/core/__tests__/rules.test.ts` | 第 41–46 行 | `toHaveLength(21)` ×2、`Set.size = 21` | 全部改为 25 | `npm run test`（实现阶段） |
| `src/core/__tests__/rules.test.ts` | 新增 describe | 无 | 新增 §5.6 矩阵、§5.2~§5.5 验收用例 | 逐条断言 |
| `README.md` | §4 标题 | 「规则清单（21 条）」 | 「规则清单（25 条）」 | 人工/脚本比对 |
| `README.md` | §4 版本行 | `1.0.0`、`RULES.length === 21` | `1.1.0`、`25` | 人工 |
| `README.md` | §4 表格 | 21 行 | 追加 4 行（含默认列） | 行数比对 |
| `README.md` | §5 已知限制 | 无国内规则条目 | 新增：长度偏差降级、豆包需关键词、GLM 形态待校准 | 人工 |
| `README.md` | §7 验收证据 | 止于 ACC-29 | 追加 `CLS-ACC-30~43`（git 历史 44 标 NA） | 人工 + 单测映射 |
| `README.md` | §8.1 目录注释 | `rules.ts # 21 条` | `# 25 条` | 人工 |
| `README.md` | §8.3 新增规则步骤 | 3 步 | 增加"声明 contextKeywords 并补守卫用例" | 人工 |

### 7.2 父规格回灌清单

| 父规格章节 | 变更 |
|---|---|
| `5.4.1` | 新增 `CLS-RUL-018~024`（守卫能力、4 条规则、去重、一致性） |
| `5.4.2` | 规则表追加 4 行，并修正 `CLS-R-020` 的邮箱/手机号拆分表述 |
| `5.4.3` | 时序图增加"关键词守卫"节点 |
| `5.4.4` | 异常表增加"关键词缺失/跨行"场景 |
| `6.5` | 增加 `contextKeywords` 约束；统一 `description/suggestion` 长度口径（见 §10-R7） |
| `7` | 追加 `CLS-ACC-30~43`，并修正与 README 的编号衔接 |
| `8` | 敏感信息检测条目数由 17 增至 24；合计 92 → 99 |
| `9` | 保持"不扫描 git 历史"；不新增 CLI 形态 |
| `11` | 新增 1.1 变更记录 |

### 7.3 devices / 端侧资产

本项目为纯 Web 应用（Vite + React + TypeScript，产物为静态站点与单文件 HTML），**不存在 devices、端侧目录、安装包、权限声明或设备兼容矩阵**。本次变更不涉及任何端侧同步项。

---

## 8. `--git-history` 历史扫描需求：架构兼容性评估（不适用性结论）

### 8.1 需求原文摘要（保留原始要求）

1. **新增可选模式**：`--git-history <off|since:1y|since:6m|commits:N|all>`，默认 `off`；用于发现"曾提交过、后来删除"的敏感信息。
2. **实现方式**：调用系统 git（`std::process::Command`）；
   - `git -C <root> rev-list --all`（按 since/commits 限制）取 commit 列表；
   - `git -C <root> log -p --no-color --unified=0 --no-merges <range>` 或 `git cat-file --batch` 取内容；
   - 自写 patch 解析器：识别 `+++ b/<path>`、`@@ -a,b +c,d @@`，只提取 `+` 新增行，映射为 `(commit, path, line_no, content)`。
3. **规则复用**：对每个新增行复用 §5 规则引擎与 §6 误报抑制，产出 finding 时附加：
   `source="git_history"`、`commit`、`author`、`commit_date`、`commit_subject`、`still_in_head`（`git merge-base --is-ancestor` 或比对 HEAD 文件内容）。
4. **去重键**：`(blob_sha, line_no, rule_id)`。
5. **跳过**：二进制 blob、> 2MB blob、`.git/` 内部文件、merge commit 的 diff。
6. **摘要**：单独统计"仅存在于历史的命中数"，终端醒目提示"⚠ N 处命中仅存在于 git 历史，删除无效，必须轮换密钥"。
7. **失败语义**：无 git 或当前目录不是 git 仓库时，`--git-history` 开启必须明确报错并以退出码 **2** 结束，不得静默降级。
8. **依赖约束**：禁止引入 `gix`/`git2` 等 Rust git 实现（v1 保持零重依赖），只调系统 git。
9. **参数表新增**：`--git-history <...>`（默认 off）、`--git-remote-check`（提示"若已 push，本地删除/force-push 也不保证清除，需轮换"）。
10. **验收用例 16/17/18**：历史删除仍可发现、多次提交去重、非 git 目录退出码 2。

### 8.2 结论

**不适用于本项目（Not Applicable）。** 该需求应在**独立的 CLI 项目**中立项实现，不应纳入 CommentLeak Scanner 本期范围。

三条决定性理由：

1. **形态不匹配**：本项目没有 CLI 入口。`package.json` 无 `bin` 字段，`scripts` 仅有 dev/build/test/lint/fixtures；`src/` 中不存在 `process.argv`、`child_process`、`fs` 等 Node 能力。`--git-history` 这类命令行参数在本项目中**没有消费方**。
2. **运行时能力不匹配**：扫描发生在浏览器（主线程 / Web Worker）内，浏览器沙箱**无法调用系统 git**，无法执行 `std::process::Command`；本项目也没有 Rust 工具链，构建链为 Vite + `esbuild-wasm`。原文"只调系统 git、禁止 gix/git2"的前提（存在 Rust 宿主进程）在本项目中不成立。
3. **隐私契约冲突**：要读取 `.git`，只有两条路径：其一，引入本地宿主进程/本地服务（破坏"静态站点 + 单文件双击可用"）；其二，让用户把 `.git` 目录打包上传到浏览器（破坏"零上传"与"只处理 zip/文件夹中的注释与文档"的承诺，且 `.git/objects` 默认被忽略）。

### 8.3 现状证据

| 既有约束 | 现状 | 出处 |
|---|---|---|
| 无 CLI | 无 `bin`；`scripts` 仅构建/测试/夹具 | `package.json` |
| 无 Rust | 无 `Cargo.toml`、无 `*.rs`；构建走 `esbuild-wasm` | 仓库根目录、`package.json.overrides` |
| 纯浏览器本地 | "纯前端、零后端、零网络请求" | `README.md` §1、§3 |
| 单文件构建 | `dist-single/index.html` 双击即用，`file://` 可运行 | `README.md` §2 |
| 不扫 git 历史 | Non-Goals 第 3 条 | 父规格 §9 第 3 条 |
| `.git` 被忽略 | 忽略目录含 `node_modules`、`.git` | `src/core/fileFilter.ts` 第 18–19 行 |
| 无 Node 能力 | `src/` 无 `child_process` / `process.argv` / `fs` | 源码检索 |
| 零网络校验 | `npm run verify:network` 静态扫描网络 API 与外链 | `README.md` §2、§3 |
| 单文件体积约束 | 内联 Worker、无外部资源 | `vite.config.single.mjs` |

### 8.4 若强行落地的破坏清单

| 既有约束 | 破坏方式 | 后果 |
|---|---|---|
| 零网络 / 零上传 | 需本地 HTTP 服务（宿主进程）或上传 `.git` 目录 | 隐私声明失效，`verify:network` 可能仍需通过但架构已变 |
| 零后端 | 需 Node/Rust 宿主执行 git 命令 | 不再是纯静态前端 |
| 单文件构建 | `file://` 下无法启动宿主进程 | `dist-single` 能力名存实亡 |
| README 免责声明 | "不扫描 git 历史、提交记录或远端仓库" | 必须改写 §1、§6 |
| 扫描对象 | 从"注释与文档"扩展到"历史 diff 行" | 需新增 source 概念与展示列 |
| 2MB / 忽略目录 | `.git/objects` 与 packfile 常远超 2MB，且被忽略 | 需新上限、新豁免与新的炸弹防护模型 |
| 错误码体系 | 无 git / 非仓库 / 解析失败 / 超时 | 需新增 CLS-E 系列；而"退出码 2"在浏览器中无表达载体 |
| 性能模型 | 100MB 包 / 5000 文件 / 500MB 解压上限 | 全历史 packfile 规模不可预估，需重做预算 |
| 测试分层 | L1–L4 不含进程与环境依赖 | 需新增 L5（真实仓库、真实 git、退出码） |

### 8.5 浏览器端解析 `.git` 的可行性与成本

| 子能力 | 可行性 | 说明与成本 |
|---|---|---|
| loose object 读取（`.git/objects/xx/yyyy`） | 可行 | zlib 解压可用 `DecompressionStream('deflate')`（现代 Chromium/Firefox）；commit/tree/blob 解析约 150–200 行 |
| packfile（`.git/objects/pack/*.pack` + `.idx`） | 高成本 | 需实现 idx v2、offset/ref-delta 解压与对象重建；约 600+ 行，且易受损坏包与超大包影响。多数真实仓库以 pack 为主，只做 loose 会大量漏检 |
| `rev-list --all` 等价 | 需自写 | 提交图遍历 + 拓扑排序；浅克隆（shallow）、reflog、replace refs 会破坏 `--all` 语义 |
| `merge-base --is-ancestor` 等价 | 需自写 | 祖先判定 + HEAD tree 递归比对；无完整性校验时 `still_in_head` 不可信 |
| 退出码 2 语义 | **不可行** | 浏览器页面无进程退出码；只能弹错，无法满足原文硬性语义 |
| 零上传 | 可保持 | 用户主动选择本地文件夹，数据不出浏览器；但会破坏"不扫 git 历史"声明与 `.git` 忽略策略 |

**成本估算**：
- 最小可用（仅 loose object、不支持 pack/delta、`still_in_head` 仅做 HEAD 文本比对）≥ **3 人日 / ≥600 行**，需新增 zlib 解压依赖或依赖 `DecompressionStream` 的浏览器兼容矩阵。
- 完整实现（pack + delta + 提交图 + 严格 `still_in_head`）≥ **10 人日**，且仍无法满足"调用系统 git""退出码 2""禁止引入 git 库"三条原文约束。

### 8.6 若未来立项 CLI 项目的前置条件（迁移清单）

1. 将 `src/core/rules.ts`、`scanner.ts`、`redact.ts` 抽为无 DOM 依赖的共享包（现状 core 已不引用 ui/workers，但使用 `@/types` 别名，需改为包内相对引用或路径映射）。
2. 新建 CLI 宿主（Node 24 可用；若坚持 Rust，则需放弃"零重依赖"并引入 Rust 工具链）。
3. 实现 `git rev-list` / `git log -p` / `git cat-file --batch` 调用与 patch 解析（`+++ b/`、`@@ -a,b +c,d @@`、仅取 `+` 行）。
4. 新增错误码与退出码 2 语义（无 git、非仓库、无法解析）。
5. 去重键切换为 `(blob_sha, line_no, rule_id)`；跳过二进制、>2MB blob、`.git/` 内部文件、merge commit diff。
6. 摘要新增"仅存在于历史的命中数"，终端输出醒目警示文案。
7. 原样启用验收用例 16/17/18。
8. 需产品确认：CLI 场景下"系统 git"属于外部运行时依赖，是否仍满足"零重依赖"的原始意图。

### 8.7 原验收用例 16/17/18 的处置

| 原编号 | 原预期结果 | 本项目处置 | 理由 |
|---|---|---|---|
| 16 | 工作区不报；`--git-history=all` 报 1 条 critical，`still_in_head=false`，带 commit hash | **NA（不适用）** | 无 CLI、无系统 git 调用能力 |
| 17 | 同一密钥在 3 个 commit 反复出现，按 `(blob_sha,line,rule)` 去重后只报 1 条 | **NA（不适用）** | 无历史扫描入口；承诺不做 git 历史 |
| 18 | 非 git 目录执行 `--git-history=all` → 退出码 2，错误明确 | **NA（不可实现）** | 浏览器无退出码语义 |

> 处置方式：在父规格 §7 与 README §7 中以 `CLS-ACC-44` 记录"NA + 理由"，不删除原始需求文本；待未来 CLI 项目立项时整体迁移。

---

## 9. 验收用例（新增）

> 所有用例均可在 `src/core/__tests__/rules.test.ts` 中以"片段 → `scan()` → 断言 Finding"的方式自动化（实现阶段）。

| 编号 | 输入 / 前置 | 操作 | 预期结果 | 对应需求 | 级别 |
|---|---|---|---|---|---|
| CLS-ACC-30 | `// DEEPSEEK_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345` | 扫描 | 1 条 critical，`CLS-R-022`，抑制 `CLS-R-006` | CLS-RUL-019 | P0 |
| CLS-ACC-31 | `// DEEPSEEK_API_KEY=sk-0123456789abcdef0123456789abcdef0123456789abcdef012`（51 位） | 扫描 | 1 条 `CLS-R-022` | CLS-RUL-019 | P0 |
| CLS-ACC-32 | `// sk-abcdefghijklmnopqrstuvwxyz012345`（无关键词） | 扫描 | 1 条 `CLS-R-006`，0 条 `CLS-R-022` | CLS-RUL-019 | P0 |
| CLS-ACC-33 | `// DEEPSEEK_KEY=sk-proj-abcdefghijklmnopqrstuv` | 扫描 | 1 条 `CLS-R-006`，0 条 `CLS-R-022` | CLS-RUL-019 | P0 |
| CLS-ACC-34 | `// ARK_API_KEY=d41d8cd98f00b204e9800998ecf8427e` | 扫描 | 1 条 critical `CLS-R-023` | CLS-RUL-020 | P1 |
| CLS-ACC-35 | `// VOLCENGINE_ARK_API_KEY=9c1f4b7a-2d63-4f18-9a20-7c5e8d3b1a44` | 扫描 | 1 条 `CLS-R-023`；将值换成 `123e4567-e89b-12d3-a456-426614174000` → **0 条** `CLS-R-023`（允许 1 条 `CLS-R-019` medium 兜底） | CLS-RUL-020 | P1 |
| CLS-ACC-36 | `// md5: d41d8cd98f00b204e9800998ecf8427e`、`// uuid: 9c1f4b7a-2d63-4f18-9a20-7c5e8d3b1a44` | 扫描 | 均为 0 命中 | CLS-RUL-020 | P1 |
| CLS-ACC-37 | `// DASHSCOPE_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345` | 扫描 | 1 条 `CLS-R-024`，抑制 `CLS-R-006` | CLS-RUL-021 | P0 |
| CLS-ACC-38 | 上一行去掉 `DASHSCOPE` 关键词；再测 33 位变体 | 扫描 | 均只 1 条 `CLS-R-006`，0 条 `CLS-R-024` | CLS-RUL-021 | P0 |
| CLS-ACC-39 | `// ZHIPU_API_KEY=abcdef0123456789.abcdef0123456789` | 扫描 | 1 条 `CLS-R-025` | CLS-RUL-022 | P1 |
| CLS-ACC-40 | `// MOONSHOT_API_KEY=sk-0123456789abcdef0123456789abcdef0123456789abcdef`（48 位） | 扫描 | 1 条 `CLS-R-025`，抑制 `CLS-R-006` | CLS-RUL-022 | P1 |
| CLS-ACC-41 | `// api.example.com/v1/user.profile`、`// version=1.2.3.4`、JWT 样例、三段点号串 | 扫描 | 均 0 条 `CLS-R-025`（JWT 仍由 `CLS-R-014` 命中） | CLS-RUL-022 | P1 |
| CLS-ACC-42 | `sk-your_api_key_here`、`sk-test-key`、`your_glm_key_here.your_glm_secret_here`、全 0 串 | 扫描 | 均 0 命中 | CLS-RUL-018 | P0 |
| CLS-ACC-43 | 默认配置 | 断言规则集 | `RULES.length=25`、`RULE_CATALOG.length=25`、`validateRuleSet` 空、ID 唯一、版本 `1.1.0`、4 条默认启用 | CLS-RUL-024 | P0 |
| CLS-ACC-44 | §8.7 的 git 历史用例 16/17/18 | 评审 | 标记 NA 并记录理由；不进入自动化套件 | §8 | P2 |

**去重矩阵用例**：§5.6.1 表格的 10 行必须逐行成为独立断言（可并入 CLS-ACC-30~43）。

---

## 10. 风险与待确认事项

| 编号 | 事项 | 本规格的假设 | 影响 | 需用户确认 |
|---|---|---|---|---|
| R1 | DeepSeek key 长度 | `sk-` + 32 或 51 位字母数字 | 长度不符会漏检或降级为 R-006 | 是否与官方文档一致？ |
| R2 | 豆包 key 形态 | 32 位 hex 或标准 UUID | 形态不符会漏检 | 是否还有 `ark-` 等其他前缀？ |
| R3 | 智谱 GLM key 形态 | 两段 16–32 位字母数字（点号） | 形态不符会漏检 | 真实样例结构是否为 `id.secret`？各段长度？ |
| R4 | Kimi key 形态 | `sk-` + 33–64 位 | 32 位 Kimi key 会降级到 R-006 | Kimi 是否 `sk-` 前缀？最小长度？ |
| R5 | R-023 / R-025 默认开关 | 默认开启 | 影响 README「默认」列与首屏命中量 | 是否接受默认开启？ |
| R6 | specificity 取值 | R-022/024=120、R-023=110、R-025=130 | 决定同族胜出与 `suppressedRuleIds` | 是否接受该优先级梯度？ |
| R7 | 文案长度口径 | 以代码校验为准（120/160） | 父规格写 80/120，存在文档偏差 | 回灌时是否统一为 120/160？ |
| R8 | 新增需求编号 | 占用 CLS-RUL-018~024 | 父规格编号连续性 | 是否同意该编号段？ |
| R9 | 验收编号 | 使用 CLS-ACC-30~44 | 避开 README 已用的 ACC-19~29 | 是否同意？ |
| R10 | `sk-` 占位符归一化 | 修复 `sk-your_...` 误报 | 会改变既有 R-006 的行为（减少误报） | 是否作为本次附带修复？ |
| R11 | GLM 关键词 `GLM` 子串 | 大小写不敏感子串 | 可能与无关单词偶然匹配 | 是否需要改为整词匹配？ |
| R12 | git 历史需求处置 | NA，另立 CLI 项目 | 不进入本期验收 | 是否认可 §8 结论？ |

---

## 11. 变更记录

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| 1.0 | 2026-11-13 | 新增国内 4 条大模型 API Key 规则（CLS-R-022~025）增量需求；给出与 R-006/R-011/R-019 的重叠与去重口径；完成 `--git-history` 不适用性评估 | 需求规格 Agent |