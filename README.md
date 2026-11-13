# CommentLeak Scanner · 注释敏感信息扫描器

一个**纯前端、零后端、零网络请求**的提交前自查工具：在浏览器本地读取 zip 压缩包或文件夹，只扫描**代码注释**与 **Markdown / 文档**中的敏感信息（云密钥、私钥、通用密钥赋值、连接串、带凭证 URL、JWT、内网地址、测试凭证、高熵串等），输出分级脱敏的风险清单。

> 所有处理均在浏览器本地完成，代码不会上传到任何服务器。请确认页面无外部网络请求后再使用。

## 1. 项目简介

- **输入**：`.zip` 压缩包，或直接选择/拖入文件夹。
- **扫描对象**：注释（`//`、`/* */`、`#`、`--`、`<!-- -->`、`REM/::`、Python docstring）、Markdown 全文、`.env*` 配置全文、`README* / docs/` 等文档。
- **不扫描**：业务代码正文（除文档与 `.env*`）、`node_modules/`、构建产物、锁文件、二进制、单文件 > 2MB。
- **输出**：分级命中表（脱敏片段 + 上下文）、跳过文件原因、JSON/CSV 导出、命中路径清单复制。
- **非目标**：不做后端、登录、云端历史、自动修复，也不扫描 git 历史。

## 2. 快速开始

```bash
npm ci            # 安装依赖（首次）
npm run dev       # 本地开发：http://localhost:5173
```

标准构建（静态站点）：

```bash
npm run build
npx serve dist
```

单文件构建（双击 `index.html` 即可用，`file://` 可运行）：

```bash
npm run build:single
# 产物：dist-single/index.html
```

其他命令：

| 命令 | 作用 |
|---|---|
| `npm run test` | Vitest 单元/集成测试 |
| `npm run lint` | ESLint 安全规则检查 |
| `npm run verify:network` | 扫描 `src` 与 `dist` 的网络 API / 外部 URL |
| `npm run verify:build` | 校验单文件产物完整性与无外链 |
| `npm run fixtures` | 生成验收夹具 `fixtures/acceptance.zip`、`only-images.zip` |
| `npm run fixtures:traversal` | 生成路径穿越夹具 `traversal.zip` |
| `npm run fixtures:large` | 生成 100MB / 5000 条目性能夹具（耗时长） |
| `npm run fixtures:bomb` | 生成 200MB 全零炸弹夹具（仅本地） |

环境要求：Node `>=18.18 <25`。

### 2.1 构建链路说明

- 本项目默认使用 `esbuild-wasm`（纯 WebAssembly）作为 Vite 的转译器，避免依赖原生 `esbuild.exe`；`package.json` 的 `overrides` 已将 `esbuild` 指向 `npm:esbuild-wasm@0.21.5`。
- `npm run build` / `npm run build:single` 通过 `scripts/build.mjs` 调用 Vite JS API（`configFile: false`），在初始化 WASM 后执行构建；产物形态与标准 Vite 构建一致。
- `npm run dev` 通过 `scripts/dev.mjs` 启动开发服务器，同样先初始化 WASM。
- 若 `npm ci` 后构建提示 esbuild 初始化失败，请执行一次 `npm install --force` 让 `overrides` 生效。

## 3. 隐私说明

- **零上传**：不存在任何上传接口；`src` 与 `dist` 由 `verify-no-network` 静态扫描网络 API 与外部 URL。
- **零网络请求**：依赖全部本地打包，不使用 CDN、远程字体、埋点或分析 SDK。
- **零持久化**：不使用 `localStorage / sessionStorage / IndexedDB / Cache API`；刷新页面即清空所有结果。
- **日志策略**：日志只允许输出阶段、计数、耗时与错误码；不输出文件路径、注释片段或命中值。`src/core/log.ts` 是唯一允许 `console` 的位置。
- **内存策略**：解压后逐条读取并立即释放字节；注释片段在 Worker 内处理；命中的“完整内容”仅在二次确认后临时进入主线程内存（单条 ≤ 8KB、总量 ≤ 16MB），关闭弹窗/刷新即清除，且**永不进入导出与日志**。
- **扩展风险**：浏览器扩展可读取页面 DOM，请确认无不可信扩展后再处理真实敏感代码。
- **诊断快照**：仅含构建模式、协议版本、消息计数、失败类别、阶段与耗时；可导出为本地 JSON，**不含文件名、路径、注释片段、密钥、堆栈与完整 jobId**。

### 3.1 错误码与降级策略

Worker 通道故障按原因分类，`CLS-E-1008` 仅作无法归类的兜底；可恢复故障会自动降级主线程继续扫描。

| 错误码 | 含义 | 是否阻断 | 处理建议 |
|---|---|---|---|
| CLS-E-1008 | 后台扫描通道异常（未能归因） | 是 | 重新上传；展开诊断信息反馈 |
| CLS-E-1011 | 引擎脚本加载失败 | 否（自动降级） | 刷新页面；或改用标准构建（http/https） |
| CLS-E-1012 | 扫描结果传输异常 | 否 | 重新尝试；反复出现则刷新页面 |
| CLS-E-1013 | 页面与引擎协议版本不一致 | 否 | 强制刷新；页面与引擎必须同源同版本 |
| CLS-E-1014 | 引擎 500ms 内未响应 | 否（自动降级） | 无需操作 |
| CLS-E-1015 | 引擎运行期 8s 无响应 | 否（自动降级） | 无需操作；大包可拆分后分批扫描 |
| CLS-E-1016 | 引擎内部异常 | 否（自动降级） | 无需操作；反复出现时反馈诊断信息 |
| CLS-E-1017 | 消息投递失败 | 否 | 重新上传 |
| CLS-E-1018 | 已有扫描正在进行 | 否 | 等待完成或先取消 |
| CLS-E-4001 | 浏览器不支持 Worker 或创建失败 | 否（自动降级） | 无需操作；大文件可能短暂卡顿 |

协议版本：`PROTOCOL_VERSION = 2`（新增 `job:pong` 心跳与 `job:error.jobId` 归属校验）。页面与引擎必须同源同版本构建。

## 4. 规则清单（26 条）

规则集版本：`1.1.0`。全部规则由 `src/core/rules.ts` 的 `RULES` 数组驱动，README 与代码由单测一致性断言（`RULES.length === 26`）。

| ID | 名称 | 级别 | 说明 | 修复建议 | 默认 |
|---|---|---|---|---|---|
| CLS-R-001 | AWS Access Key | critical | 命中 AWS Access Key ID 形态的硬编码凭证。 | 立即在 AWS 控制台轮换该密钥，改用环境变量或密钥托管服务。 | 开 |
| CLS-R-002 | AWS Secret Access Key | critical | 关键词附近的 40 位 base64 值疑似 AWS Secret Access Key。 | 轮换对应 IAM 用户的密钥，并检查 CloudTrail 是否存在异常调用。 | 开 |
| CLS-R-003 | Google API Key | critical | 命中 Google API Key 形态的字符串。 | 在 Google Cloud Console 撤销并重建密钥，同时限制 API 与来源。 | 开 |
| CLS-R-004 | GitHub Token | critical | 命中 GitHub 个人访问令牌或应用令牌。 | 在 GitHub Settings 中撤销该 Token，并改为最小权限的短期凭据。 | 开 |
| CLS-R-005 | Slack Token | critical | 命中 Slack Bot/User/App Token 形态。 | 在 Slack App 管理页撤销令牌并重新安装应用。 | 开 |
| CLS-R-006 | OpenAI API Key | critical | 命中 OpenAI 风格 API Key（含 sk-proj- 前缀）。 | 在 OpenAI 控制台撤销该 Key 并检查用量记录。 | 开 |
| CLS-R-007 | Stripe Key | critical | 命中 Stripe live 模式密钥。 | 在 Stripe Dashboard 轮换密钥，并检查是否存在异常支付活动。 | 开 |
| CLS-R-008 | SendGrid Key | critical | 命中 SendGrid API Key 形态。 | 在 SendGrid 控制台删除该 Key 并创建权限更小的新 Key。 | 开 |
| CLS-R-009 | 私钥文件头 | critical | 注释或文档中出现私钥 PEM 头部。 | 立即轮换该私钥对应的证书或密钥对，并从历史记录中清除。 | 开 |
| CLS-R-010 | 证书内容 | critical | 出现 PEM 证书块头部，可能泄露内部证书。 | 确认证书是否包含内部域名或私钥线索；必要时重新签发。 | 开 |
| CLS-R-011 | 通用密钥赋值 | high | 注释中出现“关键词 = 值”的硬编码口令或密钥。 | 改为从环境变量或密钥管理系统读取，并轮换已泄露的值。 | 开 |
| CLS-R-012 | 数据库连接串 | critical | 连接串中直接包含账号与密码。 | 改用密钥管理服务注入凭据，并轮换该数据库账号密码。 | 开 |
| CLS-R-013 | 带凭证的 URL | critical | HTTP(S) URL 中内嵌用户名与密码。 | 移除 URL 中的凭据，改用请求头或登录流程，并轮换该密码。 | 开 |
| CLS-R-014 | JWT | high | 注释中存在三段式 JWT，可能包含可复用会话令牌。 | 缩短令牌有效期并轮换签名密钥；不要把 JWT 写入注释。 | 开 |
| CLS-R-015 | 内网 IP | high | 注释中暴露内网 IPv4 地址，可能帮助攻击者定位内网资产。 | 移除具体内网地址，改用配置项或文档化的示例网段。 | 开 |
| CLS-R-016 | 内网域名 | medium | 注释中出现内网专用域名后缀。 | 移除内部主机名或替换为通用示例域名。 | 开 |
| CLS-R-017 | 本地服务地址 | low | 注释中出现 localhost 端口，提示本地调试配置残留。 | 确认是否为调试残留；生产文档建议使用通用占位地址。 | 开 |
| CLS-R-018 | 测试/默认凭证 | low | 注释中留下测试或默认账号口令组合。 | 在上线前删除测试账号，并确保默认口令已修改。 | 开 |
| CLS-R-019 | 高熵密钥串 | medium | 关键词附近的 16–128 位高熵字符串，疑似真实密钥。 | 确认该值是否为真实密钥；若是，立即轮换并改用密钥管理服务。 | 开 |
| CLS-R-020 | 邮箱地址 | low | 注释或文档中留下个人邮箱地址（默认关闭）。 | 确认是否需要公开个人联系方式；必要时移除或改用团队邮箱。 | 关 |
| CLS-R-021 | 手机号 | medium | 注释或文档中留下中国大陆手机号（默认关闭）。 | 移除个人手机号，改用团队联系方式或工单系统。 | 关 |
| CLS-R-022 | DeepSeek API Key | critical | 注释中出现 DeepSeek API Key 形态的硬编码凭证。 | 在 DeepSeek 开放平台撤销并重建该 Key，改用环境变量或密钥管理服务。 | 开 |
| CLS-R-023 | 豆包（火山引擎）API Key（UUID） | critical | 注释中出现豆包/火山引擎 API Key 的 UUID 或 32 位十六进制形态。 | 在火山引擎方舟控制台禁用并重建该 Key，改用环境变量或密钥管理服务。 | 开 |
| CLS-R-024 | 阿里通义千问（DashScope）API Key | critical | 注释中出现 DashScope / 通义千问 API Key 形态的硬编码凭证。 | 在阿里云百炼控制台撤销并重建该 Key，改用环境变量或密钥管理服务。 | 开 |
| CLS-R-025 | 智谱 GLM / Kimi API Key | critical | 注释中出现智谱 GLM 点号密钥或 Kimi/Moonshot 的 sk- 密钥。 | 在智谱开放平台或 Moonshot 控制台撤销并重建该 Key，改用环境变量。 | 开 |
| CLS-R-026 | 豆包（火山引擎）API Key（ark- 前缀） | critical | 注释中出现豆包/火山引擎新版 ark- 前缀 API Key（ark-UUID-suffix）形态。 | 在火山引擎方舟控制台禁用并重建该 Key，改用环境变量或密钥管理服务。 | 开 |

**与原始需求及后续确认的调整**

1. `CLS-R-011` 关键词扩展了中文：`密码 / 口令 / 密钥 / 令牌 / 凭证`，并支持中文冒号 `：`（验收用例要求 `数据库密码: Admin@123` 命中）。
2. `CLS-R-011` 对已知弱口令（`root/admin/test/guest/demo/123456/password/passwd`）允许 4 字符；普通值仍要求 ≥ 6 字符。
3. 邮箱与手机号拆分为 `CLS-R-020`（low）与 `CLS-R-021`（medium），因为两者严重级别不同；均默认关闭，由“扫描联系方式”开关启用。
4. 新增国内模型规则 `CLS-R-022~026`：DeepSeek（`sk-` + 32/48 位）、豆包 UUID（specificity 110）与 `ark-` 前缀（130）、通义千问（`sk-` + 32 位）、智谱 GLM / Kimi。豆包按两种形态拆为两条规则，以落实用户确认的 specificity 区分；同时修复 `sk-your_api_key_here` 占位符漏判。

**扫描范围补充**：`.bat / .cmd` 已纳入代码类白名单（仅注释扫描），否则 Batch 注释需求无法触发。

## 5. 已知限制

| 编号 | 限制 | 影响 | 缓解 |
|---|---|---|---|
| LIM-01 | JS 正则字面量启发式可能把除法误判为正则 | 可能漏检该行后续注释 | ACC-02 覆盖典型场景；README 明示 |
| LIM-02 | 模板字符串 `${}` 内的注释不提取 | 可能漏检嵌套注释 | 常见密钥不写在模板表达式内 |
| LIM-03 | 未闭合字符串按保守策略回退 | 可能漏检后续 `//` | 产生 `unclosed-string` 诊断 |
| LIM-04 | 不做 AST / docstring 语义判定 | Python 三引号全部按 docstring 处理 | 提供开关；README 明示 |
| LIM-05 | YAML 块标量、Makefile 变量内的 `#` | 可能误判 | README 明示 |
| LIM-06 | 嵌套块注释仅 Rust / Swift 支持 | 其他语言按首次 `*/` 结束 | README 明示 |
| LIM-07 | Markdown 围栏未闭合 | 后续内容全部标记为围栏内 | 产生 `unclosed-fence` 诊断 |
| LIM-08 | 单文件 `file://` 下内联 Worker 可能被浏览器拒绝 | 扫描改在主线程执行 | 自动降级并完成扫描（验收以“完成”为准） |
| LIM-09 | 运行期 8s 无活性且连续 3 次心跳无应答即判定引擎冻结 | 极端大包可能触发降级 | 静默期 pong 心跳可延长等待；判定后主线程继续 |
| LIM-10 | 降级后大文件在主线程处理 | 页面可能短暂卡顿 | 非阻断提示；可改用标准构建 |
| LIM-11 | zip 字节已转移且无法在本地重读 | 需要重新上传 | 明确提示“需要重新上传”，上传区保持可用 |

其他已知行为：

- 未识别的扩展名与单文件 > 2MB 始终跳过，并登记到“已跳过文件”。
- `.env*` 按配置文件全文扫描，不区分注释与键值。
- 内网域名规则可能对内网命名示例产生误报（如 `example.local`）。
- 单文件构建在 `file://` 下若 Blob Worker 被拒绝，会自动降级为主线程处理并提示性能风险。
- `file://` 属于非安全上下文，剪贴板可能不可用，此时提供只读文本框供手动复制。

## 6. 免责声明

- 本工具是“提交前自查”辅助工具，**不替代 gitleaks / trufflehog 等专业密钥扫描**，不保证覆盖所有密钥类型。
- 只扫描当前压缩包/文件夹中的注释与指定文档，**不扫描 git 历史、提交记录或远端仓库**。
- **一旦密钥曾经进入过 git 历史，仅删除注释不够，必须轮换密钥**，并视情况清理历史记录。
- 结果仅供参考；命中不代表一定可利用，未命中也不代表代码整体安全。
- 请勿在不可信的浏览器环境中处理真实生产密钥；浏览器扩展与宿主页面可能读取 DOM。
- 可选 CSP：部署方可在标准构建的 `index.html` 中自行添加 `Content-Security-Policy`（`connect-src 'none'`）；单文件构建因内联脚本需要 `'unsafe-inline'`，收益有限，默认不强制。

## 7. 验收证据

自动验证（`npm run test` / `npm run verify:network` / `npm run verify:build`）执行后填写实测结果；手动项需在浏览器中完成并记录。

实测结果（2026-11-12，`npm run test` 共 14 个测试文件 / 125 条断言全部通过；`npm run verify:network` 与 `npm run verify:build` 退出码 0）。标注“手动待执行”的项需要浏览器与真实大包，本环境未执行。

| 用例 | 级别 | 验证方式 | 结论 |
|---|---|---|---|
| CLS-ACC-01 AWS Key | P0 | `rules.test` + `jobRunner.integration` + `acceptanceFixture.test` | ✅ 通过：1 条 critical，片段 `AKIA************MNOP` |
| CLS-ACC-02 http:// 不误判 | P0 | `cFamily.test` | ✅ 通过：字符串内 `//` 不产注释，规则层 0 命中 |
| CLS-ACC-03 内网 IP + 连接串 | P0 | `rules.test` + `acceptanceFixture.test` | ✅ 通过：critical + high 同时保留，展示 `mysql://***:***@10.1.2.3:3306/db` |
| CLS-ACC-04 Python docstring | P0 | `python.test` + `acceptanceFixture.test` | ✅ 通过：docstring 命中 high |
| CLS-ACC-05 忽略目录/类型/二进制 | P0 | `fileFilter.test` + `acceptanceFixture.test` | ✅ 通过：ignored-type / ignored-directory / non-text 均登记 |
| CLS-ACC-06 test/test 低危 | P0 | `rules.test` + `acceptanceFixture.test` | ✅ 通过：R-018 low |
| CLS-ACC-07 100MB 大包不卡死 | P0 | 手动 + `fixtures:large` | ⏳ 手动待执行 |
| CLS-ACC-08 断网可用 | P0 | 手动（dist 与单文件） | ⏳ 手动待执行 |
| CLS-ACC-09 零外部请求 | P0 | 手动 Network + `verify:network` | ✅ 静态校验通过；Network 面板待手动复核 |
| CLS-ACC-10 占位符不误报 | P0 | `rules.test` | ✅ 通过：`your_api_key_here`、`<your-secret>`、`${TOKEN}` 均 0 命中 |
| CLS-ACC-11 zip 炸弹中止 | P0 | `unzip.test`（高压缩比条目） + `fixtures:bomb` | ✅ 自动通过（CLS-E-1005）；200MB 夹具需本地生成 |
| CLS-ACC-12 路径穿越拒绝 | P0 | `path.test` + `unzip.test`（手工 zip） + `fixtures:traversal` | ✅ 通过：原始条目名 `../../etc/passwd.js` 登记 `parent-segment` |
| CLS-ACC-13 无扫描文件空态 | P0 | `jobRunner.integration` + `only-images.zip` | ✅ 通过：`status='empty'` + 跳过分布 |
| CLS-ACC-14 CSV 公式注入 | P1 | `export.test` | ✅ 通过：`=SUM(A1)` 前置 `'` |
| CLS-ACC-15 5000 条渲染流畅 | P1 | 手动 + `fixtures:large` | ⏳ 手动待执行 |
| CLS-ACC-16 展开后导出无完整值 | P0 | `export.test` + `redact.test` | ✅ 通过：导出白名单无 raw 字段 |
| CLS-ACC-17 XSS 文件名安全 | P0 | `acceptanceFixture.test` + 手动 | ✅ 路径按文本保留并扫描；React 文本渲染，无 dangerouslySetInnerHTML |
| CLS-ACC-18 docstring 开关 | P1 | `python.test` | ✅ 通过：关闭后 docstring 命中消失，`#` 注释保留 |

### 7.1 通道故障修复验收（CLS-E-1008 缺陷）

| 用例 | 验证方式 | 结论 |
|---|---|---|
| ACC-19 Worker 加载失败可区分 | `workerClient.channel.test`（onerror 零消息 → 1011） | ✅ 自动通过 |
| ACC-20 就绪超时 500ms | `workerClient.channel.test`（fake timers） | ✅ 自动通过：1014 |
| ACC-21 运行期 8s 无活性 | `workerClient.channel.test`（ping 3 次无 pong） | ✅ 自动通过：1015；判定后主线程继续 |
| ACC-22 协议版本失配 | `workerClient.channel.test` + `protocol.test` | ✅ 自动通过：1013 |
| ACC-23 旧 jobId 串扰 | `workerClient.channel.test` + `protocol.test` | ✅ 自动通过：仅累加 `staleJob`，不提示 |
| ACC-24 投递异常 | `workerClient.channel.test`（postMessage 抛错） | ✅ 自动通过：1017，后续可重新提交 |
| ACC-25 并发提交 | `workerClient.channel.test` | ✅ 自动通过：1018 |
| ACC-26 降级路径能力等价 | 复用同一 `runJob`；`useScanJob` 桥接 | ✅ 代码路径等价；浏览器复测待执行 |
| ACC-27 诊断快照白名单 | `diagnostics.test`（路径/密钥/堆栈/jobId 断言） | ✅ 自动通过 |
| ACC-28 100MB 大包不误判 | 浏览器 + `fixtures:large` | ⏳ 手动待执行 |
| ACC-29 单文件 `file://` 降级完成 | 浏览器双击 `dist-single/index.html` | ⏳ 手动待执行（以“自动降级并完成扫描”为通过标准） |

安全验证清单：

| 编号 | 验证项 | 方法 | 结论 |
|---|---|---|---|
| SEC-01 | 零外部请求 | DevTools Network（Fetch/XHR/WS/Other） | ✅ 静态校验通过；Network 面板待手动复核 |
| SEC-02 | 断网可用 | 离线模式完成上传→扫描→导出 | ⏳ 手动待执行 |
| SEC-03 | 无持久化 | Application 面板检查 Storage/IndexedDB/Cache | ✅ 代码审计通过（无持久化 API，ESLint 拦截）；面板待手动 |
| SEC-04 | 日志无内容 | Console 检索完整密钥 | ✅ 代码审计通过（log.ts 仅计数/耗时/错误码） |
| SEC-05 | XSS 文件名 | `<img src=x onerror=alert(1)>.js` | ✅ 自动：路径按文本渲染，无 dangerouslySetInnerHTML |
| SEC-06 | 路径穿越 | `../../etc/passwd.js` 条目 | ✅ 自动：`unzip.test` 登记 `parent-segment` |
| SEC-07 | zip 炸弹 | 200MB 全零文件包 | ✅ 自动：高压缩比条目触发 CLS-E-1005；大夹具需本地生成 |
| SEC-08 | 加密包 | 加密 zip | ⏳ 需手工生成加密压缩包后验证 |
| SEC-09 | 导出脱敏 | 展开完整值后导出 JSON/CSV | ✅ 自动：导出白名单不含 raw 字段 |
| SEC-10 | 外部资源 | 产物全文检索外部 URL | ✅ 自动：`verify:network` 与 `verify:build` 均通过 |

## 8. 开发说明

### 8.1 目录结构

```text
src/
├─ App.tsx                     # 单页状态机（唯一默认导出）
├─ main.tsx                    # createRoot 挂载
├─ index.css                   # Tailwind 与主题基线
├─ types.ts                    # 跨模块/跨线程契约（唯一类型源）
├─ core/
│  ├─ unzip.ts                 # zip/文件夹读取、路径校验、炸弹防护
│  ├─ fileFilter.ts            # 分类、忽略组、跳过原因
│  ├─ scanner.ts               # 单文件扫描、去重、排序、摘要
│  ├─ rules.ts                 # 26 条数据驱动规则与编译缓存
│  ├─ redact.ts                # 脱敏、上下文、导出清洗
│  ├─ entropy.ts               # Shannon 熵与字符集判定
│  ├─ export.ts                # JSON/CSV/路径清单/下载/剪贴板
│  ├─ errors.ts                # 错误码目录（CLS-E-xxxx）
│  ├─ path.ts / text.ts        # 路径安全、UTF-8 解码与换行归一
│  ├─ config.ts / log.ts       # 默认配置、配置快照、安全日志
│  └─ commentExtractor/        # 9 个提取器 + 语言映射 + 片段构造
├─ workers/
│  ├─ scan.worker.ts           # Worker 入口
│  ├─ jobRunner.ts             # 作业编排（解压→筛选→扫描→封包）
│  ├─ protocol.ts              # 版本化消息与运行时守卫
│  ├─ workerClient.ts          # 主线程客户端（取消/超时/重建）
│  └─ factory.*.ts             # 标准 / 内联 Worker 工厂
└─ ui/                         # 上传、进度、统计、表格、弹窗、配置面板
```

依赖方向：`types.ts ← core ← workers ← App ← ui`。`core/*` 不引用 `ui/*` 或 `workers/*`；除 `App.tsx` / `main.tsx` 外不使用默认导出。

### 8.2 关键实现约定

- **注释提取为词法状态机**：不引入 AST / tree-sitter；C 系在 `CODE` 状态遇到 `/` 时按 `//` → `/*` → 正则 → 除法顺序判定。
- **片段截断**：单条注释片段超过 8KB 按 UTF-8 字节边界截断，避免正则回溯。
- **规则编译缓存**：`compileRule` 按规则 ID 缓存 `RegExp`，匹配循环内禁止 `new RegExp`。
- **去重按族**：分组键为 `filePath#line#dedupeFamily`，同族重叠才互相抑制；连接串与内网 IP 属不同族，可同时报告。
- **脱敏单一入口**：`redact.ts` 是唯一脱敏实现；展示与导出只接受 `maskedSnippet`。
- **导出白名单**：`scrubForExport` 逐字段拷贝，禁止展开 `Finding`；CSV 单元格先防公式注入、再引号包裹、最后转义双引号。
- **消息协议**：所有响应带 `protocol` 与 `jobId`；`job:done` 前必须发完所有批次；旧 `jobId` 消息一律丢弃。
- **取消**：Worker 协作式取消 + 800ms 超时 `terminate` 重建；取消不保留任何中间结果。

### 8.3 如何新增规则

1. 在 `src/core/rules.ts` 的 `RULES` 中追加一条符合 `Rule` 契约的数据（ID 格式 `CLS-R-xxx`）。
2. 在 `README.md` 规则表同步新增一行（单测会断言 ID 集合一致）。
3. 运行 `npm run test`（含规则校验与关键场景）与 `npm run lint`。

### 8.4 如何新增语言

1. 在 `src/core/commentExtractor/languageMap.ts` 注册扩展名与 `LanguageSpec`。
2. 实现提取器并导出 `extractXxx(text, options): CommentSnippet[]`。
3. 在 `src/core/commentExtractor/index.ts` 的 `switch` 中分派。
4. 在 `src/core/fileFilter.ts` 的二进制/锁文件名单中确认不会误伤。
5. 增补提取器单测并运行 `npm run test`。

### 8.5 测试与校验分层

| 层级 | 内容 | 命令 |
|---|---|---|
| L1 | 提取器、规则、熵、脱敏、CSV、路径、过滤 | `npm run test` |
| L2 | `runJob` 内存 zip 全流程、跳过统计、取消、批次顺序 | `npm run test` |
| L3 | 零网络、产物外链、单文件完整性 | `npm run verify:network` / `npm run verify:build` |
| L4 | 上传、进度、过滤、展开、导出、断网、性能 | 手动 |