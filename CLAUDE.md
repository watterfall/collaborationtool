# CLAUDE.md

> 给 Claude Code（与任何在本仓库里干活的 AI 协作者）的工作指南。
> 目的：少走弯路，少触碰几条会被项目所有者明确反对的红线。

---

## 1. 这是什么项目

面向研究者的协作论文平台。详见 [`README.md`](./README.md) 与
`plan0/paper-platform-system-prompt.md`。任何"显然"的选择都先自问
"现成方案能不能直接用"，只有能说出**具体差异化收益**时才继续造。

### 第一性原理（决策时优先级，照搬自 system prompt）

1. Local-first 优于云优先（数据所有权在用户）
2. Markup-as-source，WYSIWYM 呈现
3. AI 是协作者不是侧边栏（"协作动作"，不是聊天框）
4. 中英双语都是一等公民（CJK 与拉丁排版同等精细）
5. 可组合优于大一统（不发明私有格式）
6. 延迟即设计（keystroke < 100ms / 公式 < 50ms / PDF < 5s）
7. 设计是产品的一部分（编辑/杂志气质，不是通用 SaaS 圆角卡片）
8. 文档是异构内容图，不是文字流（Phase 0 就预留所有节点类型）
9. 协作是动词不是名词（人 / agent / 社区 / reviewer 异质叠加）
10. 可演化性 > 当下完备（Phase 1 必须扛 Phase 3/4 场景）
11. Provenance 即一等数据（每段文字、每次 AI 介入可追溯）

冲突时按上面顺序判断。

---

## 2. 必读文件（顺序）

新会话开始时**先读完这六份**，再动代码：

1. [`STATUS.md`](./STATUS.md) — 唯一的"项目当前在哪"快照（每次 phase
   推进 / commit landed / ADR 状态变化时更新）
2. [`plan0/paper-platform-system-prompt.md`](./plan0/paper-platform-system-prompt.md) — 项目所有者的技术品味与第一性原理
3. 当前 phase 的 plan stub：`plan0/phase-{0,1,2,3,4}-execution-plan.md` /
   `phase-*-plan-stub.md`（看 STATUS §1 知道当前在哪个 phase）
4. [`plan0/improvement-plan-2026-05.md`](./plan0/improvement-plan-2026-05.md)
   — Council 评审驱动的 Phase 4 W6-W10 + Phase 5 范围调整（Proposed），含
   砍 / 推 Phase 6+ 清单 + ADR 影响表 + 9 项 dogfood gate +
   §11 Design.md 对齐章节
5. [`plan0/Design.md`](./plan0/Design.md) — 设计 SoT（2026-06-03 **v2**：warmth +
   concretization）：tokens（颜色 / 字体 / 间距 / 半径 / 描边 + v2 暖色 / 无阴影立体 /
   motion / accent wash）+ 9 surface 准则 + **reject criteria 16 条** +
   AI-as-collaborator pattern + provenance reveal 动效 + ProductFrame/Icon/LineGlyph。
   rationale 见 [`plan0/design-notes/2026-06-03-warmth-concretization.md`](./plan0/design-notes/2026-06-03-warmth-concretization.md)。
   **动到 `apps/web/src/` 前必读；reject criteria 是 commit gate**
6. [`wiki/graph/README.md`](./wiki/graph/README.md) — graphify 跑出的项目
   知识图谱导览（plan0/ + code/ 两份 `graph.html`）。**新会话先看 god
   nodes** 与"Surprising Connections"，再决定要不要 grep——比 grep 50 次
   找 prior art 快。`/graphify query`/`/graphify path` 可问图。

ADR 在 `plan0/adr/0001-0015`——动到对应模块前先读相应 ADR。
导航 / 依赖图 / 主题聚类 / 阅读顺序建议看 [`plan0/ADR-INDEX.md`](./plan0/ADR-INDEX.md)。
Council 评审证据基线：[`.brainstorm/COUNCIL.md`](./.brainstorm/COUNCIL.md)
+ 5 份 role 报告（产品 / 架构 / 用户 / AI / 设计）。

---

## 3. 仓库地图（pnpm workspace）

```
apps/web/              Next.js 15 + better-auth + Editor + 导出 + AI invoke
apps/sync-gateway/     WebSocket capability gate
apps/snapshot-worker/  Y.Doc → PG bytea
apps/agent-worker/     pgboss subscribe + maintenance-scan
apps/prototypes/       Phase 0/2 spike（proto-a/b/c/d）
packages/schema/       8 实体 single source of truth
packages/permissions/  capability + role bundle + JWT
packages/editor-core/  TipTap 9 ext + paperSchema + commit serializer
packages/typography/   CJK pre-pass + font tokens
packages/render-{myst,typst}/  PM → 5 emitter
packages/ai-runtime/   plugin host + skill loader + MCP client + ModelProvider 4 adapter + coordinator loop
packages/molab-protocol/  iframe 6 kind postMessage
packages/{import-typst,import-latex,auto-fix}/  Phase 2 W6
plugins/               6 内置 plugin（citation/inline-editor/reviewer/researcher/source-extractor/coordinator）
skills/                6 SKILL.md
mcp-servers/           crossref（真）+ crossref-mock（fixture）
infra/{docker,drizzle,walg}/  compose + migrations + WAL-G
tests/e2e/             Playwright 双作者 spec
docs/                  USER_GUIDE.md + SELF_HOST.md
plan0/                 ADR + plan stub + system prompt + landscape
```

---

## 4. 工作流约定

### 4.1 ADR-driven

任何技术决策先写 ADR（`plan0/adr/00NN-<slug>.md`，**一页内**说清 trade-off）：

- Status: Proposed → Accepted （/ Accepted with caveat / Superseded）
- Phase / Date / Deciders / Gated on
- Context（为什么要做这个决策）
- Decision（选了什么；显式列没选 X/Y/Z 的原因）
- Consequences（接住的代价 / 长期债）
- Phase N implementation review log（promote 时追加）

模板：`plan0/adr/0000-template.md`。

### 4.2 STATUS.md 是 source of truth

- phase 推进 / commit landed / ADR 状态变化都同步 STATUS.md
- 不要在 PR 描述里复述 STATUS——PR 描述里 link 到 STATUS 相关 section
- 每次 commit 至少更新 STATUS 顶部"最后更新"行 + §1 当前阶段 + §2 ADR 表

### 4.3 commit message 风格

照 `git log` 风格：

```
P<phase>(<n>): <短描述> — <要点>
W<n>: <短描述>           # phase 内部 weekly milestone
Phase N closeout: ...
```

例：

```
P4(3): W1 plugin install backend — capability prompt + sandbox descriptor + 13 单元测试
```

中英文混排都行；技术术语保留英文。

### 4.4 测试 / typecheck 是 gate

- 全 workspace：`pnpm typecheck`（必须 PASS 才能 commit）
- 包级测试：`pnpm <pkg>:test`（动到的包都跑一遍）
- e2e：`pnpm e2e:test`（HTTP-driven，~22s；动 web/gateway/editor 都跑）

不要 `--no-verify` 跳 hook。Hook 失败先查根因。

### 4.5 分支与 PR

- feature work 在 `claude/<short-slug>` 分支
- 当前会话指定分支：见 system prompt"Git Development Branch Requirements"
- 推送到分支后**用户明确请求**才开 PR（默认不开）

### 4.6 Design.md commit gate（动 `apps/web/src/` 时）

提 commit 前自查 Design.md §11 reject criteria **16 条**（v2），**新增不能为正**：

```bash
# 不能新增的字符串（grep diff staged 文件）
git diff --staged apps/web/src | grep -E "bg-blue-(500|600|700)|rounded-(lg|xl|2xl|full)|bg-zinc-(50|100|200)|shadow-(sm|md|lg|xl)|#3B82F6|#2563EB|#0EA5E9"
# v2 新增：禁任何 blur radius > 0 的 box-shadow（只允许硬边 --elev-lift）
git diff --staged apps/web/src | grep -E "box-shadow:\s*[^;]*[1-9][0-9]*px\s+[1-9]"
# 命中即不通过；改用 Design.md tokens（var(--color-paper) / var(--color-ink) / var(--color-accent-ink) / var(--color-warm-wash) / .rule / .pill-* / .elev-lift / .surface-raised / button-primary / button-ghost）
```

例外仅头像 / pill 999px 圆形 + ORCID 官方绿。

新组件**必须**落到 `apps/web/src/components/design/*`（token-driven，禁止散落硬编码）。

---

## 5. 设计红线（项目所有者反复强调，触碰前先问）

### 5.1 不要"先简单后扩展"在数据模型 / 同步协议 / 权限模型上

第一性原理 #10 直接说"在分布式系统和数据模型上经常是骗局"。Phase 1 的核心
schema 必须扛 Phase 3/4 场景；如果你想"先简单"就要显式标注为技术债 + 写
ADR review log。

### 5.2 不要塞功能到 core

第一性原理 #12-#15（详见 system prompt §六 扩展系统）：能力优先做 plugin /
skill / MCP server。Phase 2 W1 ADR-0010 已立明显的 kernel vs plugin 边界。
新能力先想"是不是 plugin"，再想"是不是 core"。

### 5.3 不要过度工程

- 主动给"**先别做**"的反建议
- 任何加 feature 要说明"它替换或省去了哪两个现有 feature"
- 不做 Phase N+1 才需要的事（看 plan stub §三"不做的事"）
- 没有 dogfood 痛点不上 ADR-0014（subdocument）等大件
- **新 ADR moratorium**（improvement-plan-2026-05.md §四）：在
  ADR-0012 / 0013 / 0014 dogfood gate 跑通并 promote 到 Accepted 之前，
  **不再起草新 ADR**。先把已 Proposed 的真做穿。例外：
  ADR-0016 Claim-on-Claim Review 在 Phase 5 Wave B kickoff 前 1 周起草。

### 5.4 不要重新发明 prior art

每次提方案先 grep `paper-platform-landscape.md`、ADR Context 节、findings.md
是否已经讨论过。

### 5.5 中英文都是一等公民

- UI 文案 / 文档 / 错误提示 / 内置 prompt **必须中英都打磨**
- 技术讨论与 ADR **中文为主**，库名 / API / 变量名保留英文
- CJK 排版与拉丁排版同等精细（standard 在 `packages/typography`）

### 5.6 不要给 AI 行为留 provenance 空白

每次 AI 介入（agent dispatch / inline edit / citation lookup）都必须写
Provenance：`actorPrincipalId / agentContext / promptHash / toolCalls[]`。
缺一个就是 P1 bug。`packages/ai-runtime/src/provenance-writer.ts` 是唯一入口。

### 5.7 不要给"自主修改模式"留无 quota / 无中断的路径

ADR-0008 long-horizon agent runtime 明确：任何 agent 自主行为都要有
**quota + timeout + 可中断**。default 走 propose 模式。

---

## 6. 常用脚本（package.json scripts）

```bash
# 起服务
pnpm db:up / db:down / db:logs
pnpm web:dev / web:start / web:build
pnpm gateway:dev / gateway:start
pnpm snapshot:start / snapshot:tick

# 单包 test / typecheck（前缀 pkg 名）
pnpm <pkg>:test           # db / perms / gateway / web / editor / snapshot / typo / render-myst / render-typst / ai-runtime / mcp-crossref / e2e
pnpm <pkg>:typecheck

# 全 workspace
pnpm typecheck            # 必须 PASS

# Phase 0 prototypes（仍然能跑作回归）
pnpm proto-a:e2e          # Playwright dual-tab CRDT
pnpm proto-a:stress       # 5 client × 50 ops 收敛
pnpm proto-d:demo         # diff library spike

# DB 维护
pnpm db:migrate           # idempotent
pnpm db:seed              # service principal + demo user + 2 platform agent
```

完整列表看 root `package.json` scripts 段。

---

## 7. 常见任务套路

### 7.1 加一个新 capability（permissions）

1. `packages/permissions/src/capability-vocab.ts` 加常量
2. `packages/permissions/src/roles.ts` 决定 5 role bundle 哪些自动持有
3. `pnpm perms:test` —— 加测试覆盖
4. ADR-0002 review log 追一行（如果是新动词）

### 7.2 加一个新 PM 节点 / mark

1. `packages/editor-core/src/extensions/<name>.ts` 写 TipTap extension
2. `packages/editor-core/src/schema/paper-schema.ts` 加 schema 定义
3. `packages/editor-core/src/wire/commit-serializer.ts` 处理 commit 边界
4. `packages/render-myst/`、`packages/render-typst/` 加对应 emitter
5. `pnpm editor:test render-myst:test render-typst:test`
6. ADR-0001 / ADR-0005 review log 追

### 7.3 加一个新 agent plugin

1. `plugins/<name>/{plugin.yaml, prompt.md, agent.ts, package.json, tsconfig.json}` scaffold
2. `plugins/registry.json` 加条目（id / kind / path / skillId）
3. `skills/<id>/SKILL.md` + `skills/_registry.json` 条目
4. `pnpm ai-runtime:test` 加 plugin loader 单测
5. ADR-0010 review log 追

### 7.4 加一个新 ModelProvider adapter

1. `packages/ai-runtime/src/providers/<wire>.ts` 实现 ModelProvider 接口
2. `packages/ai-runtime/src/providers/index.ts` 注册
3. `packages/ai-runtime/src/providers/resolver.ts` 4 档优先级若需调整
4. 加 stub-fetch 单测
5. ADR-0013 review log 追

### 7.5 加一个 PG migration

1. `infra/drizzle/migrations/00NN_<slug>.sql` —— 数字顺序，**不可改历史
   migration**
2. `infra/drizzle/src/schema/*.ts` 同步 Drizzle schema
3. `pnpm db:migrate db:test` —— 加 round-trip 测试
4. 涉及 schema 改 → ADR-0001 / 相关 ADR review log

### 7.6 跑 dogfood gate

dogfood gate 是 ADR promote 的硬条件。Phase 4 W9 集中跑：

- ADR-0012 = "bwrap 真启动 + capability deny e2e"（require Linux host）
- ADR-0013 = "4 endpoint 真 round-trip"（require API key）
- ADR-0008 = "端到端真 multi-agent goal 跑通"（require 真 LLM + crossref MCP）
- ADR-0011 = "pgboss queue + 6 finding 各 1 fixture + dashboard 实测"
- ADR-0014 = "50 客户端 stress + cross-doc reference 真同步 + subdocument-level ACL"

跑通后 ADR Status: Proposed → Accepted；STATUS §2 表更新；改 plan
stub / improvement-plan ADR 影响表对应行。

---

### 7.7 多 agent 并行执行子任务

把 ≥ 2 个相互独立子任务发给 subagent 并行做：

1. 切独立 feature 分支（`claude/<short-slug>`）
2. 每个 agent 锁定**互不重叠的文件路径**（同包同文件不能两 agent 同改）
3. 每个 agent 跑包级 `pnpm <pkg>:test` + `pnpm <pkg>:typecheck` 后 commit
4. 用 `git add <显式路径>` 不要 `-A` / `.`（避免吃掉别人 WIP）
5. 不允许在 agent 内 `pnpm install`（依赖已就位，并发装 lock 风险）
6. 每个 agent 简短回报：改的文件 + 测试 PASS 数 + commit hash

依赖图：W6.4 / W6.5 / W6.2 / W7.3 / W7.4 互不冲突可并行；
W7.1 doc-store 抽象 → 阻塞 W6.1 AgentPanel inline；
W6.1 + W7.2 → 阻塞 W6.3 DOI 一键。

---

## 8. 已知地雷

- **不要 amend 已发出去的 commit**（hook 失败时改下一笔 commit，不要
  rewrite history）
- **不要 force push** 任何分支（除非用户明确要求）
- **migration 不可重排 / 不可改历史**（idempotent run 靠 `_drizzle_migrations` 表）
- **Yjs schema 改动很贵**：`y-prosemirror` 有 schema-recovery silent-drop；
  proto-a findings.md 列了 4 个缺口
- **更新 STATUS.md 时不要乱改"最后更新"以外的旧条目**（grow append-only，
  老条目作历史快照）
- **better-auth org → Principal kind=org 不直接对应**：用
  `packages/permissions/src/principal-bridge.ts:createOrgPrincipal`
- **Phase 1 SQL grant 已废弃**：用 document-level invitation flow 替代
- **CrossRef MCP 默认走 in-memory mock**（5 条 fixture）；真 stdio MCP 要
  设 `CROSSREF_MCP_COMMAND`
- **3 处 ADR-vs-代码诚实度赤字**（Phase 4 W7-W8 必须堵）：
  (1) `packages/doc-store/` ADR-0001 §5.D 承诺但从未存在 → W7.1 落地；
  (2) `AgentPluginInput.anthropic` 仍在 → W7.2 改 `provider: ModelProvider`；
  (3) macOS / Windows sandbox 是字符串占位 → W8 真写 OR UI 显式拦截。
  详见 `.brainstorm/role-architecture.md` + `improvement-plan-2026-05.md §五`
- **Phase 5+ 砍 / 推清单**：spatial canvas / 章节 fork-merge UI / Loro 切换
  评估 / 跨设备 storage adapter / plugin marketplace —— 触碰前先读
  `improvement-plan-2026-05.md §四`，每条都有"复活条件"

---

## 9. 在 Claude Code 里干活的额外建议

- **Plan first**：动代码前用 TodoWrite 把任务拆成 ≤7 项 todos
- **并行读**：搜代码时多个 grep / Read 一起发
- **先小后大**：动到任何 ADR-级模块前先 read 对应 ADR + STATUS 相关段
- **commit message 用 HEREDOC**：参 system prompt 的"Committing changes"段
- **不主动开 PR**：用户**明确请求**才开
- **测试是 gate**：`pnpm typecheck` + 包级 `:test` 都过了再 commit

---

## 10. 项目所有者的协作风格备忘

- 默认 2-3 选项 + trade-off，不要直接给答案
- 看到过度工程倾向直接说"先别做"
- 看到 prior art 没查完直接说"先 grep <X>"
- 提反对意见时**给具体 trade-off 分析**，不是个人偏好
- 任何加 feature 要说明替换 / 省去了什么
- 中英技术品味同等：库名 / API 英文，讨论 / 文档中文

—— 这是合伙人的协作模式，不是助手 / 代码生成器模式。
