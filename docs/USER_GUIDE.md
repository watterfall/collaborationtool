# 用户指南 / User Guide

> Phase 4 W4 — 两位以上作者协作写一篇双语论文，4 类 AI agent 协作（引用 / 改写 / 评审 / 调研），claim/evidence 一等节点，7 种导出格式。

本指南覆盖到 Phase 4 W4 backend 已交付的用户路径。生产部署请看
[`docs/SELF_HOST.md`](./SELF_HOST.md)；架构与决策细节看 `plan0/`；项目实时
进度看根目录 [`STATUS.md`](../STATUS.md)。

**本指南阶段标记约定**：每节末尾若有 `[Phase X+]` 表示该子能力在 Phase X
以及之后才落，更早版本不存在；标 `[backend only]` 表示后端已就绪但 UI 仍
在路上。

---

## 1. 入门 / Getting started

### 1.1 注册 / Sign up

1. 访问首页（dev: <http://localhost:3000>）
2. 点 **注册 / Sign up**
3. 填邮箱 + 姓名 + 至少 8 字符的密码

注册成功后自动登录到 `/docs`（文档列表），并在 PG 创建：
- `principal { kind: 'user', id: 'user:<uuidv7>', user_id: <better-auth-id> }`
- better-auth `user` / `session` / `account` 行

**ORCID 登录**：登录页提供 *Sign in with ORCID* 按钮（`<OrcidSignIn>`
组件）。前提是部署时设置 `ORCID_CLIENT_ID` + `ORCID_CLIENT_SECRET` +
`NEXT_PUBLIC_ORCID_ENABLED=true`（见 SELF_HOST §3）；未配置则按钮失效，走
`PROVIDER_CONFIG_NOT_FOUND`。首次 ORCID 登录会自动 bridge 到
`principal.identity.orcid`，后续 ORCID-signed peer review（ADR-0015，
Phase 4 W8）依赖该字段。 **[Phase 1.5+]**

### 1.2 创建文档 / Create a document

1. 文档列表点 **新建文档 / New document**
2. 填标题 + 选主语言（zh-Hans / zh-Hant / en）+ 双语模式（mono / parallel / mixed）
3. 提交 → 跳转到编辑器

后端做了什么：
- `document` 行落库
- `document_acl` 行落库（你拿到 `paper-author` capability bundle）
- 跳转到 `/editor/<docId>`

### 1.3 邀请第二位作者 / Invite a co-author

文档主页右上角点 **分享 / Share**：

1. 输入受邀者的邮箱 + 角色（paper-author / paper-reviewer / commenter）
2. 服务端创建一条 `doc_invitation` 行（默认 7 天有效），并通过 mailer
   发送接受链接：
   - 设了 `MAIL_WEBHOOK_URL` → POST 给 webhook（接 Resend / Postmark / 自托管 SMTP relay）
   - 未设 → 链接打印到 server stderr，复制给被邀者即可（dev / 自托管常用）
3. 受邀者打开链接 → 用 *受邀邮箱* 登录（必须邮箱匹配，否则 403）
4. 后端调 `materialiseRoleBundle` 写入 `document_acl`，进入编辑器

5 个默认 role bundle 见 ADR-0002 §2.2 + `packages/permissions/src/roles.ts`。

> 旧版 Phase 1 临时 SQL grant 方案已废弃；不再需要 `INSERT INTO document_acl`。

---

## 2. 编辑 / Editing

### 2.1 编辑器界面

打开 `/editor/<docId>` 看到：
- 标题区（slug + 主语言 + 双语模式）
- TipTap 编辑器（9 个自定义 PM extension：段落 / 标题 / 公式 / 引用 / 数据集引用 / 可执行单元 / 注释锚点 / 图 / 脚注）
- AI 协作面板（折叠）
- 待评审修订列表（仅当你有 `block.review` 或 `block.commit`）
- 导出抽屉（折叠）

### 2.2 实时协作 / Real-time collaboration

Phase 1 通过 sync-gateway WebSocket + IndexedDB 三层持久化：

```
本地输入 → IndexedDB（离线）→ sync-gateway（连接级 capability 检查）
                              → InMemory body backend（默认）
                              或 → y-sweet → MinIO/S3 (YSWEET_URL 时)
                              → snapshot-worker → PG bytea
```

两个浏览器同时打开同一文档 → 实时同步（CRDT 收敛）。

### 2.3 自定义节点 / Custom nodes

按 `/`（命令面板）或在 AI 面板手动调用。截至 Phase 2 W5，paperSchema 支
持 11 类节点：

- **段落 / 标题** — 基础结构
- **行内 / 显示公式** (`equation` / `inline-equation`) — LaTeX 字符串，KaTeX 渲染
- **引用** (`citation-ref`) — 指向 PG `citation` 行（DOI / arXiv / 数据集 / 代码）
- **数据集引用** (`dataset-ref`) — kind='dataset' 的 citation
- **可执行单元** (`computational-cell`) — molab iframe 占位 + 6 种
  postMessage（参 `packages/molab-protocol`），iframe 通过
  `/api/document/<docId>/cell/<cellId>/auth-token` 拿短 JWT 回吊  **[Phase 2+]**
- **图 + 标题** (`figure`) — `figure.sourceCellId` 可绑定到一个
  computational-cell（图表的双向绑定）
- **脚注** (`footnote-ref`)
- **注释锚点** (`annotation-anchor`) — inline mark，CRDT 自然跟随文本
- **Claim** (`claim`) — 一等"论断"节点，记录 `subject` / `predicate` /
  `confidence`，UI 上以下划线 + 悬浮标签呈现  **[Phase 2 W5+]**
- **Evidence** (`evidence`) — block container，把若干段落 / 引用 /
  computational-cell 包成"为某 claim 服务的证据 block"，写入
  `evidence.supports_claim_id`  **[Phase 2 W5+]**

Claim / Evidence 是 ADR-0011 的一等知识对象层 —— Phase 4 maintenance
scan 会扫"unsupported-claim"（claim 没有任何 evidence 链接）等 finding。

---

## 3. AI 协作 / AI agents

Phase 4 W4 已交付 4 类内置 agent + 1 个 coordinator。同步类（citation /
inline-editor）走 `/api/agent/invoke`，长流程类（reviewer / researcher）
走 `/api/document/<docId>/agent-job` 异步队列。

| Agent kind | 路径 | 模式 | 引入 phase |
|---|---|---|---|
| citation | `/api/agent/invoke` (sync) | propose-fragment | Phase 1 D13 |
| inline-editor | `/api/agent/invoke` (sync) | propose-fragment | Phase 1 D13 |
| reviewer | `/api/document/<docId>/agent-job` (async + SSE) | long-horizon | Phase 2.5 |
| researcher | `/api/document/<docId>/agent-job` (async + SSE) | long-horizon | Phase 2.5 |
| coordinator | （内部 dispatcher，不直接暴露 endpoint） | multi-agent loop | Phase 3 W6 + Phase 4 W3 |

打开编辑器页底部的 **AI 协作 / AI agent panel** 触发 sync 类。reviewer /
researcher 需要单独的入口卡片（提交后跳到 job status 页 + SSE 实时进度）。

### 3.1 Citation Agent

任务：核查段落里的 DOI 候选；命中 → propose 修订；未命中 → 进 `uncertainties`。

输入：
- 段落文本
- DOI 候选列表（逗号或换行分隔）

行为（mock 模式 / 没有 ANTHROPIC_API_KEY 时）：
1. 对每个候选调 `lookup_doi` MCP 工具
2. 如果 not_found，尝试 `O → 0` 拼写修复
3. 命中 → 加进 `revisedFragments`，附完整 CSL-JSON
4. 未命中 → 进 `uncertainties`，留待人工

输出：proposal 自动写入 PG，状态 `proposed`，含完整 Provenance（actorPrincipalId / agentContext / promptHash / toolCalls[]）。

### 3.2 Inline Editor Agent

任务：按指令重写段落，**保留** 所有引用 / 公式 / 注释锚点。

输入：
- 段落文本
- 重写指令（"make this more formal"、"tighten this paragraph"、"翻译成中文")

行为（mock 模式）：
- 给段落加 `[FORMAL]` 前缀（占位；真实 Anthropic 模式做语义重写）

输出：同 Citation Agent — proposal 写入 PG status='proposed'。

### 3.3 Reviewer Agent **[Phase 2.5+]**

任务：在整篇文档上做"批判性审阅"——找逻辑跳跃、不严谨论断、未支撑的
claim、过强结论。

提交：

```
POST /api/document/<docId>/agent-job
{ "kind": "reviewer", "input": { "style": "nature-pmre" /* 可选 */ } }
→ 201 { jobId, statusUrl, streamUrl }
```

需要 capability `agent.invoke:reviewer`（默认 `paper-author` /
`paper-reviewer` 都有）。worker 异步跑，通过 SSE 把 `revisionProposed` /
`uncertaintyRaised` / `phaseAdvanced` 推到前端。完成后 reviewer-style
skill（`skills/reviewer-style/SKILL.md`）下的 prompt 决定 review 风格。

### 3.4 Researcher Agent **[Phase 2.5+]**

任务：根据指令做文献调研——查 CrossRef / arXiv，列候选 paper，附上 DOI +
abstract + 与当前段落的相关性评分；输出进 `claim.candidate_evidence`
（claim 的"待引证据池"）。

提交：

```
POST /api/document/<docId>/agent-job
{ "kind": "researcher", "input": { "query": "transformer + 中文分词" } }
→ 201 { jobId, statusUrl, streamUrl }
```

需要 capability `agent.invoke:researcher`。

### 3.5 Coordinator Agent **[Phase 3 W6+ / 真 LLM dispatch loop Phase 4 W3]**

任务：跨多 agent 编排。例：goal = "把这一节改投 Nature 风格 + 补全所有
引用 + 评审"——coordinator 先 inline-editor，再 citation，最后 reviewer，
中间维护 scratchpad 累积上下文。

实现：`packages/ai-runtime/src/coordinator/loop.ts:runCoordinatorLoop`
多步 dispatcher（sync + async 混合 + scratchpad 累积 + `[final]` 终止 +
maxSteps 硬停 + allowedAgentKinds 过滤）。Phase 4 W3 已落 backend；真
LLM 端到端 dispatch 推 W3 末 dogfood gate。

### 3.6 接受 / 拒绝 / 反提议

每条 pending revision 显示：
- 提议者（agent / user 标记）
- 时间戳 + rationale 文本
- diff（红色 = 原文 / 绿色 = 替换文）
- uncertainties 列表

操作（按 capability）：
| 操作 | 需要 capability | 后端动作 |
|---|---|---|
| Accept | `block.commit` | revision → accepted；contribution 行落库；approval_chain 加 'accept' |
| Reject | `block.review` | revision → rejected；approval_chain 加 'reject' + notes |
| Modify | `block.review` | 原 revision → superseded；新 revision 由 reviewer 提（kind='user'）|

reviewer (`paper-reviewer` role) 只能 reject / modify，不能直接 accept；author (`paper-author` role) 可以三种都做。

---

## 4. 导出 / Export

编辑器页底部 **导出 / Export** 抽屉支持 7 种格式：

| 格式 | URL 形参 | 实现 | 备注 |
|---|---|---|---|
| HTML | `html` | render-myst → 自定义 emitter | 包含 CJK 字体 fallback chain，typography pre-pass 处理标点挤压 + 引号 |
| JATS XML | `jats` | render-myst | 投 NCBI / Crossref pipeline 标准；含 `xml:lang` |
| Markdown | `markdown` | render-myst | MyST flavored；可重新导入 |
| Typst source | `typst-source` | render-typst | `.typ` 源；需要本地装 typst 编译 PDF |
| PDF (Typst) | `pdf` | render-typst + typst CLI | **需要服务器 PATH 上有 typst (>= 0.14)**；否则 503 + hint |
| Word (.docx) | `docx` | render-myst → docx emitter | Phase 1.5 加入；纯 TS，无外部 CLI；图片 binary fetch 留 Phase 2  **[Phase 1.5+]** |
| AI Context Pack | `ai-context-pack` | claims + evidences + claim_links + sources + provenance 打包 JSON | 给第三方 plugin / 外部 researcher 直接灌 LLM context；ADR-0011 §2.7  **[Phase 2 W7+]** |

通用入口：`GET /api/export/<docId>/<format>`。

### 4.1 双语 specimen

`/demo/specimen-bilingual.json` (PM JSON) + `.md` 源是 D15 验收用的标准
样张（500 字中英混排，5 引用 / 1 公式 / 1 figure / 1 注释锚点 / 1
computational-cell）。验收时 7 格式都应当能成功导出。

---

## 5. 知识对象层 / Claim · Evidence · Sources **[Phase 2 W5+ / Phase 3+]**

### 5.1 Evidence Map

```
GET /api/document/<docId>/evidence-map
→ { claims, evidences, claimLinks, sources, crossDocReuse }
```

返回该文档下所有 claim + 支撑 evidence + claim 之间的 link
（supports / contradicts / refines）+ 引用过的 source + 跨文档 reuse 视图
（同一 claim 在多篇 paper 里被引）。Phase 4 之后会上 DAG UI；目前只读
JSON 给第三方工具消费。

### 5.2 Sources（PDF / readability）**[Phase 3 W1-W2 schema + scaffold]**

`source` + `source_extraction` 两张 PG 表 + `plugins/source-extractor`
plugin scaffold。用户可以把 PDF / 网页扔进来，extractor 抽出元数据 +
正文 + 引用 → claim/evidence 链路的"原始素材池"。

**当前状态**：schema 已落，extractor scaffold 已落。**Source Reader UI +
真 PDF.js / readability ingestion 推 Phase 4 W4 实施**。

### 5.3 Maintenance findings

`maintenance_finding` PG 表 + `apps/agent-worker` 的 `maintenance-scan`
job 路由。3 类 SQL-pure finding 生成器：

- `unsupported-claim` — claim 没绑任何 evidence
- `outdated-source` — 引的 source 在 N 天后被发现有更新版本
- `unverified-ai-block` — AI propose 出来未被 author 处理的 evidence
  block

跑 worker：`pnpm --filter @collaborationtool/agent-worker dev`（pgboss
queue 起来后跑出 finding）。Dashboard UI + 残 3 finding kind
（duplicated-claim / contradicted-conclusion / broken-citation）推 Phase
4 W4 末。**[Phase 4 W4 backend]**

---

## 6. Plugin / Skill / MCP 三层扩展 **[Phase 2 W1+ / 用户安装路径 Phase 4 W1+]**

平台核心是"内核 + plugin"架构（ADR-0010）：

- **Plugin** = agent 实现单元（manifest + prompt + agent.ts），见
  `plugins/`；6 个内置 plugin 通过 `plugins/registry.json` 注册
- **Skill** = 自然语言定义的能力包（Anthropic-style SKILL.md），见
  `skills/`；6 个内置 skill 通过 `skills/_registry.json` 注册
- **MCP server** = 数据 / 工具 bus（CrossRef / Zotero / 私有 PDF 库 / 本
  地 Jupyter kernel 等），见 `mcp-servers/registry.json` + PG `mcp_server` 表

### 6.1 用户安装第三方 plugin **[Phase 4 W1 backend]**

ADR-0012 plugin sandbox + ADR-0010 §2.5 用户安装路径。Phase 4 W1 已落
backend：

- `buildCapabilityPrompt` — 装前展示 plugin 想要的 capability，让用户拍板
- `buildSandboxDescriptor` — 三平台沙箱描述符（bwrap arg vector / macOS
  sandbox-exec 占位 / Windows AppContainer 占位）
- `buildInstallRowPayload` — install row 校验（capability superset /
  https-only git URL）
- `plugin_install` PG 表（migration 0010）

**当前状态**：UI 装载入口 + bwrap 真启动 + capability deny e2e 推 Phase
4 W1 末 dogfood gate（require Linux host）。在那之前用户可以手 git clone
到 `plugins/`，写 `plugins/registry.json` 条目即可（仅 admin / self-host
场景）。

### 6.2 BYO 模型 / 自带 LLM **[Phase 4 W2 backend]**

ADR-0013 ModelProvider abstraction：4 wireFormat 全 adapter 已落
（anthropic / openai-compat / ollama / custom-http）；4 档优先级 resolver
（document-override > user-pref > manifest-hint > env-default）+ plugin
manifest `prefers_provider` 字段已落。

**当前状态**：backend + 11 stub-fetch 单测 + 9 resolver 单测全 PASS。
**用户 Settings UI + 4 endpoint 真 round-trip 推 Phase 4 W2 末 dogfood
gate**。在那之前 self-host 部署可通过 env vars 配置（`ANTHROPIC_API_KEY`
默认 anthropic；其他 wireFormat 见 `packages/ai-runtime/src/providers/`）。

---

## 7. 已知限制 / Known limitations（截至 Phase 4 W4）

| 限制 | 状态 | 解锁 phase |
|---|---|---|
| 章节级隔离（subdocument）| 设计就位（ADR-0014 Proposed） | Phase 4 W5-W6 |
| 章节级 fork / merge UI | — | Phase 4 W7 |
| 开放同行评审 + ORCID-signed | ADR-0015 Proposed | Phase 4 W8 |
| 跨设备同步 + 用户挂自己 storage | — | Phase 4 W9 |
| Marimo / Jupyter 实跑（不止占位）| iframe 协议就位 | Phase 4 dogfood |
| MathLive 手写 / 语音公式输入 | — | Phase 5 |
| Source Reader UI | extractor scaffold + schema 就位 | Phase 4 W4 |
| Plugin 装载 UI（bwrap 真启动）| backend ready | Phase 4 W1 dogfood gate |
| BYO 模型 Settings UI | 4 adapter ready | Phase 4 W2 dogfood gate |
| Coordinator 真 LLM 跨多 agent | loop ready | Phase 4 W3 dogfood gate |
| Maintenance scan dashboard | 3/6 finding generator ready | Phase 4 W4 dogfood gate |
| Plugin marketplace 商业化 | — | Phase 5+ |
| Mobile native app | — | Phase 5+ |

---

## 8. 反馈 / Feedback

Bug / 想法 / 验收疑虑 → 写在 GitHub issue 或 commit 评论上。
每个 Phase 收尾时会 review 已知限制清单 + ADR review log。
