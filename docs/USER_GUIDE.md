# 用户指南 / User Guide

> Phase 1 D15 — 两位作者协作写一篇双语论文，AI 帮校对引用，导出多种格式。

本指南覆盖 Phase 1 MVP 的核心用户路径。生产部署请看
`docs/SELF_HOST.md`；架构与决策细节看 `plan0/`。

---

## 1. 入门 / Getting started

### 1.1 注册 / Sign up

1. 访问首页（dev: <http://localhost:3000>）
2. 点 **注册 / Sign up**
3. 填邮箱 + 姓名 + 至少 8 字符的密码

注册成功后自动登录到 `/docs`（文档列表），并在 PG 创建：
- `principal { kind: 'user', id: 'user:<uuidv7>', user_id: <better-auth-id> }`
- better-auth `user` / `session` / `account` 行

> Phase 1 不实施 OAuth (Google / ORCID) 和邮箱验证 — Phase 1.5 加。

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

按 `/`（Phase 2 命令面板）或在 AI 面板手动调用：
- 引用 (citation-ref) — 指向 PG `citation` 行
- 数据集引用 (dataset-ref) — 同上 kind='dataset'
- 行内 / 显示公式 — LaTeX 字符串（KaTeX 渲染）
- 可执行单元 (computational-cell) — Phase 1 占位（Phase 2 接 Marimo iframe）
- 图 + 标题
- 注释锚点 (annotation-anchor) — inline mark，CRDT 自然跟随文本

---

## 3. AI 协作 / AI agents

打开编辑器页底部的 **AI 协作 / AI agent panel**。

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

### 3.3 接受 / 拒绝 / 反提议

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

编辑器页底部 **导出 / Export** 抽屉支持 6 种格式：

| 格式 | 实现 | 备注 |
|---|---|---|
| HTML | render-myst → 自定义 emitter | 包含 CJK 字体 fallback chain，typography pre-pass 处理标点挤压 + 引号 |
| JATS XML | render-myst | 投 NCBI / Crossref pipeline 标准；含 `xml:lang` |
| Markdown | render-myst | MyST flavored；可重新导入 |
| Typst source | render-typst | `.typ` 源；需要本地装 typst 编译 PDF |
| PDF (Typst) | render-typst + typst CLI | **需要服务器 PATH 上有 typst (>= 0.14)**；否则 503 + hint |
| Word (.docx) | render-myst → docx emitter | Phase 1.5 加入；纯 TS，无外部 CLI；图片 binary fetch 留 Phase 2 |

### 4.1 双语 specimen

`/demo/specimen-bilingual.json` (PM JSON) + `.md` 源是 D15 验收用的标准
样张（500 字中英混排，5 引用 / 1 公式 / 1 figure / 1 注释锚点 / 1
computational-cell）。验收时 6 格式都应当能成功导出。

---

## 5. 已知限制 / Phase 1 known limitations

- 章节级隔离：网关连接级鉴权，不能在同一连接里"section A 可写、section B 只读"。Phase 3 加 Yjs subdocument 后解锁。
- 邀请流程：✅ Phase 1.5 #1 已交付（参见 §1.3）。
- ORCID 登录：缺。Phase 1.5 加。
- Marimo 嵌入：仅 schema 占位。Phase 1.5/2 接入 molab iframe。
- MathLive 输入：缺。Phase 2。
- fork / merge UI：缺。Phase 3。
- 开放评审 / 50+ 协作者：架构预留，UI / 性能调优 Phase 4。

---

## 6. 反馈 / Feedback

Bug / 想法 / 验收疑虑 → 写在 GitHub issue 或 commit 评论上。
Phase 1 D16 收尾时会再次 review 已知限制清单。
