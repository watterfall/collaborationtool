# Phase 0 计划 · 协作论文平台（AI-native research paper platform）

> 这是 Plan mode 的产出，作为 Phase 0 执行前的"作战图"。批准后退出 Plan mode 才开始落代码。

---

## 一、Context（这份 plan 解决什么）

我们要从零搭建一个**研究者的「思考-写作-验证-发表」一体化工作台**，差异化锚定在四个支点：**异构内容图 / 协作主体多元 / Local-first + Provenance / 中英双语对等**（详见 `plan0/paper-platform-system-prompt.md` 与 `plan0/paper-platform-landscape.md`）。

文档在第一性原理 #10 警告："先简单后扩展"在分布式系统和数据模型上经常是骗局。所以 Phase 0 的目标**不是写出第一个能跑的 demo**，而是把 **Phase 1 不能错、Phase 3 不能重写**的底层决策一次性做对：

1. 异构内容图能否落到 Yjs + ProseMirror（H1）
2. Provenance 数据模型能否在 Phase 1 稳定 + Phase 3 不迁移（H2）
3. 协作主体抽象能否映射到权限层（H3）
4. mystmd CJK PDF 实测效果，是否需要 Typst 做 print fallback（H4）
5. Marimo 嵌入选型（molab iframe vs Pyodide）（H5）

**用户已确认的 Phase 1 范围（影响 Phase 0 边界）**：
- AI 闭环：Inline 改写 + Citation Agent 单 DOI 核查（**不做**全文异步 agent）
- Local-first 硬度：IndexedDB 本地持久化 + Yjs WebSocket 同步必需（**不是**纯 P2P，**不是**云优先）

---

## 二、Phase 0 关键设计决策（H1–H5 的回答）

经 Plan subagent 调研 prior art（Curvenote / MyST / Stencila / Liveblocks / y-sweet / Typst / Marimo / better-auth）后的取舍：

### 决策 1（H1，最关键）：Y.Doc-as-tree + Postgres-as-graph 混合模型

ProseMirror 树负责"结构化文本主干"；引用/数据集/批注锚点/可执行单元这些**带 ID 的引用节点**用 ProseMirror **atom node** 表示，挂稳定 `nodeId`，**图关系存 Postgres**，再加一个小 `Y.Map('graph:in-flight')` 给协作者看实时状态（如"正在查 DOI"）。

> 这是 Curvenote / MyST / Stencila Schema 的共同 lineage：树存内容、side-car 存图关系。**不要发明新 CRDT 模型**（NextGraph 风格的 graph-CRDT 概念虽吸引人但不成熟）。

### 决策 2（H2）：Provenance 在 Postgres，commit boundary 落库

- Yjs awareness/update history **不是** provenance（model/prompt/input_blocks 是 application data）。
- **In-flight**：`Y.Map('provenance:in-flight')` 挂临时 UUID（"Citation Agent 正在 block X 上跑 prompt …"），TTL 自动清理。
- **Committed**：在 contribution 从 `proposed` 转 `accepted` 的瞬间，单条 Postgres insert 落 `{contributor, agent, model, prompt_template_id, prompt_hash, input_blocks, tool_calls, parent_revision, ...}`。
- **awareness 预算**：50 协作者场景下，gossip 只广播最近活跃的 12 个 cursor，其他 lazy fetch。Phase 0 不实现，但架构要预留。

### 决策 3（H3）：Capability-based 权限在同步网关层

- **Yjs 没有内建权限**，Liveblocks 只有房间级，Y-Sweet 只有 doc 级 token。**所有方案都要求自建网关层鉴权。**
- Phase 0 必须定义 **capability vocabulary**（动词 × 资源，~30-40 条，如 `block.propose` / `block.commit` / `agent.invoke:citation` / `provenance.read`）。
- **Principal 抽象**统一 User / Agent / Shared-link / Service，所有 Capability 绑定到 PrincipalId（不是 UserId）。**这是让"User 与 Agent 同等公民"成立的关键 schema choice。**
- Phase 1 同步网关只校验"连接级"capability（reject if no `block.commit`），Phase 3 升级到 subdocument-per-section + 节点范围 capability。**网关 shim 必须 Phase 1 就在**——Phase 1 漏过这步，Phase 3 重写。

### 决策 4（H4）：双管线渲染——MyST 主线 + Typst 印刷线

- **mystmd 的 HTML/Word/JATS 输出可信**（生态成熟、journal 模板多）。
- **mystmd 的 PDF 走 LaTeX，CJK 路径脆弱**（xeCJK 模板兼容性、标点挤压、CJK-Latin 间距、断行 hint 都不可靠）。
- **Typst 的 CJK 显著领先**于 LaTeX-via-mystmd（W3C clreq 跟踪表 typst-doc-cn/clreq 显示主要项已支持），但仍有 punctuation squeeze / font fallback 边角缺口（typst#7643, #2439）。
- **方案**：Phase 0 做 MyST vs Typst 同文档双输出 side-by-side 对比，写决策报告。Phase 1+ 默认 MyST 出 web/Word，Typst 出印刷 PDF，再加 `pangu`-风格的 CJK-Latin spacing 预处理 + clreq 断行 hint 在 AST 层做。

### 决策 5（H5）：Marimo 用 molab iframe（Phase 1/2），延后 Pyodide-inline 到 Phase 3

- **molab** 提供官方 iframe embed（`?embed=true`）+ share URL，2026 年可直接用。
- **Pyodide-inline 自建**需要直接调用 Marimo 的 `PyodideSession` 内部类，没有打包成 React 组件级 SDK，3+ 个月 rabbit hole。
- **schema 解决**：`ComputationalCell` 的 `kernel: 'molab' | 'pyodide-inline' | 'remote-jupyter'` 字段从 Phase 0 起就在，未来切换不动 schema，只换 renderer。
- Phase 0 不集成任何执行——atom node 占位即可。

---

## 三、Phase 0 交付物（按依赖排序，6 项）

| # | 交付物 | 工作量 | 关键路径 | 可并行 |
|---|--------|------|---------|--------|
| D1 | **ADR-0：数据模型 & CRDT/PG split** | 2 天 | ✅ | — |
| D2 | **ADR-1：权限模型 + 3 个 Phase 3 场景走查** | 1.5 天 | ✅ | 依赖 D1 |
| D3 | **Prototype A：y-prosemirror 异构 schema 双 tab 验证** | 3 天 | ✅ | 依赖 D1 |
| D4 | **Prototype B：MyST vs Typst CJK 渲染对比** | 2 天 | — | 与 D3 并行 |
| D5 | **Prototype C：MCP + Skill 端到端最小 demo** | 2 天 | — | 与 D3/D4 并行 |
| D6 | **ADR-2：技术栈最终锁定** | 1 天 | ✅ | 依赖 D1/D2/至少一个原型 |

**总工作量**：串行 ~11.5 天；D3/D4/D5 并行后 ~7-8 天（单人全职）。**这是 Phase 0 的硬预算**——超出 30% 就停下来重新 scope。

---

### D1 · ADR-0：数据模型 & CRDT/PG split

**目标**：锁定 8 实体的 TypeScript 定义 + Y.Doc / Postgres 字段归属规则。**这是后期最贵的决策**——Phase 0 必须做对。

**输入**：本计划 + 两份 plan0 设计文档 + Stencila Schema spec（参考）

**输出文件**：
- `plan0/adr/0001-data-model-and-crdt-split.md`（1-1.5 页）

**8 个核心实体**（详细字段见研究报告）：
- `Document`（论文/章节）— 标题、语言、模板、root blocks 在 Y；owner、snapshot 在 PG
- `Block`（异构节点：paragraph/heading/equation/citation-ref/dataset-ref/computational-cell/annotation-anchor/figure/footnote/...）— 树位置 + atom attrs 在 Y；指向的实体在 PG
- `Citation`（书目实体，CSL-JSON）— 全在 PG
- `Annotation`（结构化讨论：Thread + Comment + Anchor）— anchor 在 Y（随文本 CRDT 跟随），thread/comment 在 PG（append-only）
- `Revision`（提议中的修改，可拒）— 全在 PG
- `Contribution`（已 commit 的修改单元，含 PM diff + state vector）— 全在 PG，append-only
- `Provenance`（actor + agent_context: model/prompt/tool_calls/input_skill_ids）— Postgres 主表 + 短期 Y.Map 反映 in-flight
- `Agent`（注册的协作主体）+ `Principal`（统一 User/Agent/Shared-link）+ `Capability` — 全在 PG

**Y/PG 拆分规则**：
- `[Y]` 并发编辑必须正确合并的 → Y.Doc
- `[PG]` 审计/事件溯源/跨文档查询/身份与权限 → Postgres
- `[Y.in-flight]` 短暂广播状态 → `Y.Map`，TTL 清理
- `[Y+PG]` 周期性快照 → Postgres BLOB 备份 Y.Doc

**验收**：
- ADR 含 8 个实体 TS verbatim、Y/PG 注释、决策日志（"为什么不选 NextGraph / Loro / Automerge per-block"）
- 显式回答 `system-prompt §1-7` 的 7 项底层决策
- ADR 接受 **gated on D3 通过**（schema 实测能并发合并才算成立）

**失败模式**：`[Y.in-flight]` 边界不清 → 实现分歧；schema 在 D3 翻车 → 退到草图重做。

---

### D2 · ADR-1：权限模型 + Phase 3 场景走查

**目标**：定义 Capability 词汇、Principal 模型、网关执行策略，并用 3 个 Phase 3 场景证明它"封闭"。

**输入**：D1 的 ADR-0（Capability 引用 PrincipalId / BlockId）

**输出文件**：
- `plan0/adr/0002-permission-model.md`

**内容**：
- 完整 capability 词汇表（动词 × 资源矩阵，~30-40 条；不超过 50）
- Phase 1 默认 5 个 role（capability bundle）：`paper-author` / `paper-reviewer` / `commenter` / `inline-editor-agent` / `citation-agent`
- ER 图（Mermaid）：Principal / User / Agent / Role / Capability / DocumentACL
- **3 个 Phase 3 场景走通**：
  - A. 50 人开放评审（陌生贡献者只有 `block.propose`，原作者批量 review）
  - B. 评审者派外部 AI agent，scope 到 section 3 + propose-only
  - C. Fork-and-merge：fork 继承作者 Principal 集合，对原 history 只读
- 网关执行示意图（JWT 在哪签发、claim 含什么、WebSocket 握手如何校验）

**验收**：
- 3 个场景全部解析成功（不需要"再加一个 capability 概念"）
- 后续工程师能据此实现网关
- `shared-link` Principal kind 从 schema 第一天就存在（避免 Phase 2 加共享只读链接时迁移）

---

### D3 · Prototype A：y-prosemirror 异构 schema + 双 tab

**目标**：实证 H1。证明带 atom node 的 ProseMirror schema 在 Yjs 下双 tab 并发编辑能正确合并。

**输入**：D1 的 BlockType 列表

**输出**：`apps/prototypes/proto-a-yjs-schema/`
- Vite + React minimal 应用
- TipTap + 自定义 extensions：`paragraph` / `heading` / `equation`(KaTeX) / `citation-ref`(atom NodeView) / `figure` / `computational-cell`(atom 占位) / `annotation-anchor`
- Yjs + `y-indexeddb` + `y-webrtc`（**无后端**，纯 P2P 验证 schema）
- 双 tab 测试页 + 三个手测：
  1. 两 tab 同时插 citation-ref
  2. 两 tab 编辑相邻段落与公式
  3. tab1 删除一个 block，tab2 在同一 block 加 annotation-anchor
- 脚本压力测试 `pnpm run stress`：5 client × 50 随机操作，结束时断言 schema valid

**验收**：
- 三个手测全过
- 压力测试无 `RangeError` / 隐藏的 schema-recovery 警告
- 写一份 `findings.md`：y-prosemirror 处理了什么、struggle 了什么、workaround 是什么

**关键风险**：
- y-prosemirror 对并发 atom 插入处理不优雅（重复节点/顺序错乱）→ 用 **uuidv7 / ClientID-prefixed UUID** 做确定性 ID + 自定义 dedupe plugin
- y-prosemirror "schema recovery" 静默删内容 → log 每次 recovery；高频则放宽 schema

---

### D4 · Prototype B：MyST vs Typst CJK 渲染对比

**目标**：实证 H4。给印刷 PDF backend 的选型一个有数据的答案。

**输入**：1 篇双语测试文档（中文段落 + 拉丁技术词、display equation、双语 citation、双语图说、脚注）

**输出**：`apps/prototypes/proto-b-cjk-render/`
- 两份同源 PDF：`mystmd build --pdf` 和 Typst.ts 各一份（Phase 0 手译 Typst source；AST→Typst transform 留 Phase 1）
- side-by-side 对比 markdown，截图标注：
  - 标点挤压（中文，English. 不出现双空格 / 句逗间距正确）
  - CJK-Latin 间距（76% 与 English term 间）
  - 「」边界处的断行
  - 公式 display 对齐
  - Citation 渲染（数字 vs author-year）
- 推荐报告：哪个 backend 出印刷、缺口在哪、需要做什么补丁

**验收**：印刷 PDF backend 决策落地，**不延后到 Phase 1**。

---

### D5 · Prototype C：MCP + Skill 端到端最小 demo

**目标**：验证 AI agent 集成管线。**完整闭环**：Skill 加载 → Agent 调 MCP tool → 结果生成 Revision → 用户接受 → Provenance 入库。

**输入**：D1 的 Provenance / Revision / Contribution schema

**输出**：`apps/prototypes/proto-c-mcp-skill/` + `mcp-servers/crossref-mock/` + `skills/citation-lookup/`
- Mock CrossRef MCP server（TS，`@modelcontextprotocol/sdk`），返回 5 个固定 DOI 的 metadata
- `skills/citation-lookup/SKILL.md`，按 Anthropic Skills 元数据格式
- CLI 脚本 `pnpm run demo:citation-agent`：
  1. 读 hardcoded 文档片段（含 typo'd DOI）
  2. 加载 skill
  3. 用 Vercel AI SDK 调 Claude（attach MCP server）
  4. 收 tool call → MCP 响应
  5. 构造 Revision proposal
  6. 自动 accept（demo 简化）
  7. 写 Provenance 行入 SQLite（Postgres-compatible）
- 报告 markdown：展示生成的 provenance JSON 全字段

**验收**：
- 端到端跑通
- Provenance 行含：`actor_kind=agent`、`model_id`、`prompt_hash`、`tool_calls=[{tool_name: "crossref.lookup_doi", ...}]`、`input_skill_ids: [...]`
- Skill 通过 SKILL.md `description` 被发现，**不是 hardcoded**——证明 progressive-disclosure 能跑

---

### D6 · ADR-2：技术栈最终锁定

**目标**：把 Plan subagent 调研给出的 7 个推荐选项过一次"打钩或挑战"，写下最终决定。

**输出文件**：`plan0/adr/0003-tech-stack-lockdown.md`

**7 项决策（默认 = subagent 推荐，Phase 0 执行中如有反证再改）**：

| 决策项 | 默认 | 不选的原因（简） |
|--------|------|----------------|
| 前端框架 | **Next.js 15 (App Router)** | TanStack Start 生态较小、AI SDK 文档少；公开论文/评审页 RSC 友好 |
| 同步层 | **y-sweet 自托管**（OSS Rust + S3） | Liveblocks MAU 计费 + 不可自托管；CF DO 锁死 CF |
| Auth | **better-auth** | Lucia 已弃维；Clerk 价格 + 数据不归用户；Supabase 绑定 PG 实例 |
| Provenance 存储 | **Hybrid**：Y.Map in-flight + PG committed | 见决策 2 |
| 文档持久化 | y-indexeddb + y-sweet（S3 binary）+ PG snapshot | 与 Notion/Linear 同 pattern |
| Agent 运行位置 | **服务端默认**（Vercel function），schema 含 `runtime: "server" \| "client"` | 客户端 BYO 模型 Phase 3 加 |
| MCP server 宿主 | **服务端代理默认**；用户自挂 localhost MCP 留 Phase 3（桌面伴侣 / 浏览器扩展桥） | 安全 + 鉴权集中 |

D6 在 D1/D2 + 至少一个原型完成后写。

---

## 四、Repo 结构（pnpm workspaces monorepo）

```
collaborationtool/
├── pnpm-workspace.yaml
├── package.json                       # 根脚本
├── tsconfig.base.json
├── plan0/
│   ├── paper-platform-system-prompt.md      # 已存在
│   ├── paper-platform-landscape.md          # 已存在
│   ├── adr/                                  # ⭐ 新建
│   │   ├── 0000-template.md
│   │   ├── 0001-data-model-and-crdt-split.md   # D1 输出
│   │   ├── 0002-permission-model.md            # D2 输出
│   │   └── 0003-tech-stack-lockdown.md         # D6 输出
│   └── prototypes-report.md                  # 三原型综合发现
├── packages/
│   ├── schema/                          # ⭐ 八实体单一来源（zero-deps）
│   │   └── src/{document,block,citation,annotation,revision,contribution,provenance,agent,principal,capability,index}.ts
│   ├── doc-store/                       # CRDT 抽象（Yjs 现在 / Loro 留 Phase 4）
│   │   └── src/{interface,yjs-impl,loro-impl}/...
│   ├── editor-core/                     # TipTap + 自定义 extension
│   │   └── src/extensions/{equation,citation-ref,computational-cell,...}.ts
│   ├── render-myst/                     # MyST AST → HTML/Word/JATS
│   ├── render-typst/                    # 文档模型 → Typst.ts PDF
│   ├── typography/                      # CJK 预处理：pangu + clreq 断行
│   ├── ai-runtime/                      # 服务端 agent 运行时
│   │   └── src/{agents,skills-loader,mcp-client,provenance-writer}.ts
│   ├── permissions/                     # capability evaluator
│   └── ui-elements/                     # 设计中性组件（Phase 1）
├── apps/
│   ├── web/                             # Next.js 主应用（Phase 1+）
│   ├── sync-gateway/                    # WebSocket 网关 + capability 鉴权
│   │   └── src/{server,auth,capability-gate}.ts
│   └── prototypes/                      # ⭐ Phase 0 三原型
│       ├── proto-a-yjs-schema/
│       ├── proto-b-cjk-render/
│       └── proto-c-mcp-skill/
├── mcp-servers/                         # 自建 MCP servers
│   └── crossref-mock/                   # D5 用
├── skills/                              # ⭐ Anthropic-style Skills 文件夹
│   ├── _registry.json
│   ├── citation-lookup/{SKILL.md, examples.md}
│   ├── nature-submission/                # 占位
│   └── chinese-academic-style/           # 占位
├── templates/                           # journal templates（Phase 2+，Phase 0 占位）
├── infra/{docker,drizzle}/              # Phase 1 起用
└── tools/{stress-test,cjk-render-runner}/
```

**为什么这样**（关键点）：
- `packages/schema` zero-deps、所有人都能 import；**这是 keystone**
- `packages/doc-store` 抽象 CRDT engine——Phase 4 想换 Loro/Automerge 是 1-2 周迁移而不是重写
- `apps/sync-gateway` 是独立 app（不在 web 里）——它单独部署到 CF Worker / 自托管 Node，扩展性曲线不一样
- `skills/` 和 `templates/` 在 repo 根，**作为内容而非代码**——参考 shadcn/ui 的 source-as-distribution
- `apps/prototypes/proto-*` 是抛弃式的，Phase 0 结束时**删除原型代码、保留 findings**

---

## 五、Phase 0 反模式（不做什么）

按优先级：

1. **不要先起后端**——D3 是 `y-webrtc` 双 tab，无后端。后端拉起浪费 3+ 天
2. **不要先选编辑器再定 schema**——D1 必须先于任何 TipTap 配置代码
3. **不要做 agent UI**——D5 是 CLI 脚本，Approval flow UI 留 Phase 1
4. **不要在 Phase 0 集成 Marimo**——atom NodeView 占位即可
5. **不要打磨排版**——单文档双 backend 对比就够，CJK kerning 是无底洞
6. **不要选设计系统 / typography palette**——Phase 0 用裸 HTML 即可
7. **不要写任何用户文案（中或英）**——bilingual i18n 文件 Phase 1 起
8. **不要把 schema 扩到 8 实体之外**——Notification/Activity 都从 Contribution 派生
9. **不要做移动端原型**
10. **不要先搭 monorepo + 空包 + CI**——会感觉很有产出但学到 0；端到端做完一个原型再形式化
11. **不要让 schema 绑定 UI 库**——ADR-0 里不出现 "TipTap node" / "BlockNote node" 字样
12. **不要在每次 keystroke 写 provenance**——只在 commit boundary 写
13. **不要选 Loro 或 Automerge 3**——Loro 官方说"非生产就绪"（2026.1）；Automerge 3 ProseMirror 集成不成熟。Phase 4 重新评估
14. **不要加 Activity / Notification 表**——派生的，不进 ADR-0
15. **不要在 Phase 0 polish typography**——Phase 0 只回答"MyST 还是 Typst 出印刷"

---

## 六、Phase 0 → Phase 1 验收门槛

Phase 0 完成的判据（**全部**满足才推进 Phase 1）：

- [ ] D1 ADR-0 评审通过 + D3 schema 实测无遗留 RangeError / 隐藏 recovery
- [ ] D2 ADR-1 的 3 个 Phase 3 场景全部走通（不缺概念）
- [ ] D3 双 tab 三 case + 压力测试通过；findings 写下了 y-prosemirror 边角案例（已用 `pnpm proto-a:e2e` Playwright 自动化覆盖人手手测）
- [ ] D4 印刷 backend 决策落地（默认：Typst 出印刷，MyST 出 web/Word/JATS）
- [ ] D5 端到端跑通 + Provenance 行字段完整 + Skill 通过 description 被发现
- [ ] D6 ADR-2 7 项技术栈决策全部锁定（含 deferred 字段：`Agent.runtime`）
- [ ] `packages/schema` 单一来源已创建，被 D3 与 D5 共同 import
- [ ] 一份综合 `plan0/prototypes-report.md`，列出 H1–H5 的 Phase 0 答案

---

## 七、关键文件清单（Phase 0 将创建）

**ADR 文档**：
- `plan0/adr/0000-template.md`
- `plan0/adr/0001-data-model-and-crdt-split.md` ← D1
- `plan0/adr/0002-permission-model.md` ← D2
- `plan0/adr/0003-tech-stack-lockdown.md` ← D6
- `plan0/prototypes-report.md` ← 三原型综合发现

**核心代码（最小集，Phase 0 内）**：
- `packages/schema/src/{document,block,citation,annotation,revision,contribution,provenance,agent,principal,capability,index}.ts` ← D1 实现
- `apps/prototypes/proto-a-yjs-schema/src/main.ts` + `extensions/*.ts` ← D3
- `apps/prototypes/proto-b-cjk-render/test-document.{md,typ}` + 渲染脚本 ← D4
- `apps/prototypes/proto-c-mcp-skill/src/{run,write-provenance}.ts` ← D5
- `mcp-servers/crossref-mock/src/server.ts` ← D5
- `skills/citation-lookup/SKILL.md` ← D5

**Repo 基建（轻量，D3 起逐步加）**：
- `pnpm-workspace.yaml` / `package.json` / `tsconfig.base.json`

---

## 八、参考的 prior art（执行时查阅）

- **y-prosemirror** — github.com/yjs/y-prosemirror（注意 README 关于 schema recovery 的说明）
- **MyST Spec** — mystmd.org/spec
- **Stencila Schema** — github.com/stencila/schema（Article + atom-style references 的 lineage）
- **Curvenote architecture blog** — curvenote.com/blog/architecture-of-a-myst-website
- **Yjs subdocuments** — docs.yjs.dev/api/subdocuments（Phase 3 section-per-subdoc）
- **y-sweet** — github.com/jamsocket/y-sweet
- **Anthropic Skills** — platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- **MCP TypeScript SDK** — github.com/modelcontextprotocol/typescript-sdk
- **Marimo embedding** — docs.marimo.io/guides/publishing/embedding/
- **W3C clreq** — w3.org/TR/clreq/
- **typst-doc-cn/clreq** — typst-doc-cn.github.io/clreq/（CJK 项跟踪）
- **better-auth org plugin** — better-auth.com/docs/plugins/organization
- **Vercel AI SDK + AI Elements** — ai-sdk.dev / elements.ai-sdk.dev

---

## 九、执行前需要再确认的开放问题

下列任一项你想挑战，告诉我：

1. **D6 默认技术栈（Next.js 15 / y-sweet / better-auth）有任何想换的**——尤其如果你已经更熟某个其他选项（如 Convex、Clerk、TanStack Start），现在说，省得 Phase 1 才发现想换。
2. **Phase 0 节奏**——subagent 估算 7-8 天并行（单人全职）。如果是 part-time / 需要外审，时间线翻倍到 2-3 周。这是你的实际情况吗？
3. **D4 印刷 backend 默认**——subagent 推荐 Typst 出印刷 + MyST 出 web。如果你对 mystmd CJK 已有强信心或反例，可以跳过 D4 直接选一个。
4. **Phase 0 是否需要中文 demo 文档真实样张**——D4 的测试文档"双语混排"需要你给一段真实的研究内容（不要 Lorem ipsum 风格的），还是我自己造一个？

---

## 十、Phase 0 之后（前瞻，不在本计划承诺）

- **Phase 1（一个月）**：基于 Phase 0 的 8 实体 schema + 网关 shim + Typst 印刷线，建可用的两人协作 MVP（写、引、导出、评论；中英文渲染都过关；AI 以 propose 模式介入）
- **Phase 2**：multi-agent 协作层（Reviewer Agent 异步任务）、版本/diff 语义级展示、Marimo 嵌入接入
- **Phase 3**：spatial canvas、agent 自主任务、fork/merge 工作流（这一阶段开始前，回头检查 Phase 0 八实体 schema 是否真扛得住）
- **Phase 4+**：开放协作、社区评审、声誉图（依赖 Phase 0 的 Capability + Principal 抽象）

---

> **状态**：本计划是 Phase 0 的"作战图"，等你 review + ExitPlanMode 批准后开始执行 D1（ADR-0）。
