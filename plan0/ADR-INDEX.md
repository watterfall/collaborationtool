# ADR Index · 架构决策记录导航

> 22 ADR 的 single page 导航。**当前状态以根目录 [`STATUS.md`](../STATUS.md) §2 为准**——
> 个别 ADR 的文件头 `Status:` 字段在 promote 后未必每次都同步更新，本 index
> 给出 reconcile 后的视图（标 † 的项目即文件头滞后）。
>
> 模板：[`adr/0000-template.md`](./adr/0000-template.md)。新增 ADR 顺序写
> `00NN-<slug>.md`，落盘前在本 index 加一行 + 在 STATUS.md §2 表加一行。

最后更新：2026-07-18（补登记 ADR-0021 vault-native + ADR-0025 贡献声明/验证协议）

---

## 1. 快表（按 id 排序）

| ADR | 标题 | Status | Phase landed | Phase gate / Promote 条件 |
|---|---|---|---|---|
| [0001](./adr/0001-data-model-and-crdt-split.md) | 数据模型 & CRDT/Postgres 拆分 | Accepted | 0 D1 | D3 dual-tab Playwright ✅ |
| [0002](./adr/0002-permission-model.md) | 权限模型（Capability + Principal） | Accepted | 0 D2 | D8 + D9 + D14 + D15 ✅ |
| [0003](./adr/0003-tech-stack-lockdown.md) | 技术栈锁定（11 项 + 双管线渲染） | Accepted | 0 D6 | D7-D15 全用本 ADR 11 项栈 ✅ |
| [0004](./adr/0004-deployment-and-security.md) | 部署拓扑 + 安全基线 | Accepted | 1 D16 | D7-D15 全部交付完成 ✅ |
| [0005](./adr/0005-render-api-boundary.md) | Render API 边界 | Accepted | 1 D16 | 5 emitter 签名锁 + Phase 2 stable ✅ |
| [0006](./adr/0006-mcp-server-registry.md) | MCP server 注册与发现 | Accepted † | 2 W1-W3 | mcp_server PG 表 + registry.json + plugin loader ✅ |
| [0007](./adr/0007-computational-cell-embedding.md) | Computational cell embedding + iframe 协议 | Accepted (with caveat) † | 2 W4 | molab-protocol 6 kind + cell auth-token JWT ✅；真 molab.org 端到端推 Phase 2.5 |
| [0008](./adr/0008-long-horizon-agent-runtime.md) | Long-horizon agent runtime + reviewer/researcher | Accepted (with caveat) † | 2 W2 / 2.5 | agent_job + agent_job_event + pgboss subscribe ✅；真 reviewer/researcher dogfood 推 Phase 4 W3 |
| [0009](./adr/0009-diff-library-and-revision-rebase.md) | Diff library + revision overlay UI + rebase 语义 | Accepted (Phase 0 spike + Phase 1 D14 实证) † | 0 + 1 D14 | proto-d-diff-library + acceptRevision 流程 ✅ |
| [0010](./adr/0010-extension-system-and-plugin-api.md) | 扩展系统边界 + Plugin API + Skill 元数据扩展 | Accepted † | 2 W3-W5 | citation/inline-editor 切 plugin 路径 + agents/ 目录已删 ✅ |
| [0011](./adr/0011-claim-evidence-knowledge-object.md) | Claim/Evidence 一等知识对象层 | Accepted † | 2 W5-W7 | schema + PM 节点 + Evidence Map / AI context pack 路由 ✅ |
| [0012](./adr/0012-plugin-sandbox-and-user-install.md) | Plugin sandbox + 用户安装路径 + capability 提示 UI | Proposed | 3 closeout + 4 W1 backend | bwrap 真启动 + capability deny e2e 推 Phase 4 W1 末（require Linux host） |
| [0013](./adr/0013-model-provider-abstraction.md) | ModelProvider 抽象 + BYO 模型 + 配置存储 | Proposed | 3 closeout + 4 W2 backend | 4 endpoint 真 round-trip 推 Phase 4 W2 末（require API key） |
| [0014](./adr/0014-yjs-subdocument-and-crossref.md) | Yjs subdocument 章节级拆分 + cross-reference sync | Proposed | 4 W1（draft）| Phase 4 W5-W6 dogfood gate（50 客户端 stress + cross-doc reference sync） |
| [0015](./adr/0015-open-peer-review-and-orcid.md) | Open peer review + ORCID-signed reviews | Proposed | 4 W1（draft）| Phase 4 W8 dogfood gate（真 ORCID 端到端 + author reject-review + withdrawn archive） |
| [0016](./adr/0016-claim-on-claim-review.md) | Claim-on-Claim Review — annotation on claim 的 ORCID-signed provenance lineage | Proposed | 5 Wave B（draft）| Phase 5 Wave B dogfood gate（1 篇双语论文 / 10 claim / 5 真 ORCID reviewer / 公共 review DAG 渲染） |
| [0017](./adr/0017-client-first-runtime.md) | Client-first Runtime — Desktop Truth + Relay Server + Markdown-Yjs 双轨 | Proposed | 6 W2（3 Spike ✅） | Phase 6 W2-W3 runtime gates（3 平台 binary + notarize/signing）+ ADR-0001 §5.A revision log |
| [0018](./adr/0018-open-content-mechanisms.md) | Open Content — Open Question / Dataset / Peer Review + Merkle-signed Provenance（DeSCI 去区块链） | Proposed | 6 W2（migration 0016 + publish route ✅） | Phase 6 W6-W7 dogfood gate G4（open question 陌生人回答闭环）+ G8（DOI mint + Merkle log 完整） |
| [0019](./adr/0019-plugin-runtime-cross-platform.md) | 跨平台 plugin runtime — WASM Extism 为主 + 各 OS 原生沙箱 fallback | Proposed | 6 W2（起草） | Phase 6 W9-W10 dogfood gate G7（3 OS 同一 plugin 安装 + sandbox spawn + secret-reject） |
| [0020](./adr/0020-night-bridge-day-triadic-architecture.md) | Night-Bridge-Day Triadic — 三层等价知识产出系统（**战略 ADR**，定位权威） | Proposed | 5 W3+ 横跨 5/6（Wave D-1~D-4 契约层 ✅） | 30 天 dogfood gate（每周 ≥5 Night + ≥2 Bridge + ≥1 Day promotion + 6 交互模式触发 ≥4） |
| [0021](./adr/0021-discovery-graph-vault-native-storage.md) | Discovery-graph vault-native 存储 — Night artifact 长在用户 vault | Proposed | 6 Wave A2（6 kind + vault spine ✅） | 30 天 Night dogfood + 分享投影 Principal 映射 + 并发窗口实证 |
| [0025](./adr/0025-contribution-claims-attestations-verification.md) | Contribution Claims & Attestations — 协作贡献信用与验证协议 | Proposed | 6 post-A4（设计） | Night 本地签名 + Bridge 双人 claim/ack/challenge + agent 三主体 + public receipt |

† 文件头 `Status:` 字段未同步 —— Reconcile 视图见 STATUS.md §2 / Phase implementation review log。

---

## 2. Phase gate 时间线

```
Phase 0  ─┬─ ADR-0001  数据模型（D1） ─────────────────┐
         ├─ ADR-0002  权限模型（D2） ─────────────────┤
         ├─ ADR-0003  技术栈（D6） ────────────────────┤
         └─ + 3 prototype 验证                         │
                                                       │
Phase 1  ─┬─ D7-D15 实施（全部用 ADR-0001/2/3 11 项栈）│
         └─ ADR-0004  部署拓扑（D16） ─────────────────┤
            ADR-0005  Render API 边界（D16） ──────────┘
                                                       │
Phase 2  ─┬─ ADR-0010  扩展系统（W1 头号；W3 dogfood gate）
W1-W7    ├─ ADR-0006  MCP server registry（W1）
         ├─ ADR-0008  Long-horizon agent runtime（W2-W3）
         ├─ ADR-0007  Computational cell（W4）
         ├─ ADR-0009  Diff library + rebase（W2-W3）
         └─ ADR-0011  Claim/Evidence（W5；W7 Evidence Map dogfood gate）
                                                       │
Phase 3  ─┬─ ADR-0012  Plugin sandbox（W5 起草；4 W1 backend；4 W1 dogfood gate）
W1-W7    └─ ADR-0013  ModelProvider abstraction（W7 起草；4 W2 backend；4 W2 dogfood gate）
                                                       │
Phase 4  ─┬─ ADR-0014  Yjs subdocument（W5-W6 dogfood gate）
W1-W10   └─ ADR-0015  Open peer review + ORCID（W8 dogfood gate）
                                                       │
Phase 5  ─┬─ ADR-0016  Claim-on-Claim Review（Wave B kickoff draft；Wave B 末 dogfood gate）
         └─ ADR-0020  Night-Bridge-Day Triadic（W3+ 起草；横跨 5/6；30 天 dogfood gate）
                                                       │
Phase 6  ─┬─ ADR-0017  Client-first runtime（W2 起草；3 Spike ✅；W2-W3 runtime gates）
W1-W12   ├─ ADR-0018  Open content mechanisms（W2 起草；W6-W7 dogfood gate G4/G8）
         ├─ ADR-0019  跨平台 plugin runtime（W2 起草；W9-W10 dogfood gate G7）
         ├─ ADR-0021  Discovery-graph vault-native（Wave A2；6 kind + spine ✅）
         └─ ADR-0025  Contribution claims/attestations（post-A4；Bridge slice 前置）
```

---

## 3. 依赖图

每个 ADR 引用其它 ADR 的关系（基于文件 grep `ADR-00NN`）。`A → B` 读作 "A 依赖 B 或与 B 协调"。

```
0001 ←─────┬─ 0002, 0005, 0007, 0008, 0010, 0011, 0012, 0014, 0015, 0016
0002 ←─────┬─ 0003, 0004, 0006, 0007, 0008, 0010, 0011, 0012, 0014, 0015, 0016
0003 ←─────┬─ 0004, 0005, 0006, 0007, 0008, 0010, 0013
0004 ←─────┬─ 0005, 0006, 0007, 0008, 0010, 0012, 0014
0005 ←─────┬─ 0007, 0010
0006 ←─────┬─ 0010, 0012
0007 ←─────┬─ 0010
0008 ←─────┬─ 0009, 0010, 0013, 0015, 0016
0009 ←─────┬─ 0014
0010 ←─────┬─ 0011, 0012, 0013, 0014, 0015
0011 ←─────┬─ 0014, 0015, 0016
0012 ←─────┬─ 0013, 0019
0014 ←─────┬─ 0015
0015 ←─────┬─ 0016, 0018, 0025
0017 ←─────┬─ 0018, 0019, 0020, 0021, 0025
0018 ←─────┬─ 0020, 0025
0020 ←─────┬─ 0021, 0025
0021 ←─────┬─ 0025
```

Pivot 层补充：**0001 亦被 0017（§5.A "PG truth"→"PG replicated cache" major revision）与
0020（PM tree 之外新增 discovery-graph + bridge-layer 两个 first-class data model）修订/扩展**；
0008 被 0020 重定义（coordinator = 双向 metabolic orchestrator）。

**核心枢纽**：

- **ADR-0001**（数据模型）：所有后续 ADR 都建在它之上 —— 改它要重写半个项目
- **ADR-0002**（权限模型）：除了 0005/0009/0013 之外都依赖
- **ADR-0010**（扩展系统）：Phase 2-4 所有 plugin / sandbox / model / review ADR 都建在它之上
- **ADR-0008**（agent runtime）：reviewer / researcher / coordinator / open peer review 都引用它
- **ADR-0017**（client-first）：Phase 6 基础设施枢纽——0018 open content 与 0019 plugin runtime 都建在它之上
- **ADR-0020**（triadic，战略 ADR）：定位权威——不锁 schema，锁"架构哲学"；ADR-0021 已按 client-first 修订为 vault-native，0022/0023/0024 仍受 dogfood gate 约束
- **ADR-0021**（vault-native）：Night 内容权威与私密边界；ADR-0025 的本地 attestation 存储建在其上
- **ADR-0025**（贡献验证窄腰）：连接 0001 operational contribution、0018 public integrity 与 0020 contribution-graph，不替换三者

---

## 4. 按主题聚类

### 数据 / CRDT / 渲染
- [ADR-0001](./adr/0001-data-model-and-crdt-split.md) Y.Doc-as-tree + PG-as-graph
- [ADR-0005](./adr/0005-render-api-boundary.md) PM JSON wire format + 5 emitter 签名
- [ADR-0014](./adr/0014-yjs-subdocument-and-crossref.md) Subdocument 章节拆分 + cross-ref

### 权限 / 部署 / 安全
- [ADR-0002](./adr/0002-permission-model.md) Capability + Principal + 同步网关
- [ADR-0004](./adr/0004-deployment-and-security.md) 6 进程拓扑 + secrets / TLS / CORS / CSP / 备份基线
- [ADR-0012](./adr/0012-plugin-sandbox-and-user-install.md) Bubblewrap / sandbox-exec / AppContainer + 用户安装路径

### 技术栈 / API 边界
- [ADR-0003](./adr/0003-tech-stack-lockdown.md) 11 项 + 双管线渲染
- [ADR-0009](./adr/0009-diff-library-and-revision-rebase.md) prosemirror-changeset 选型 + rebase 语义

### 扩展系统 / Plugin / MCP / Skill
- [ADR-0006](./adr/0006-mcp-server-registry.md) MCP server 注册 + 发现 + capability gating
- [ADR-0010](./adr/0010-extension-system-and-plugin-api.md) Plugin API + Skill 元数据扩展 + Dogfood 路径

### AI runtime / Agent
- [ADR-0008](./adr/0008-long-horizon-agent-runtime.md) Long-horizon runtime + reviewer/researcher 形状
- [ADR-0013](./adr/0013-model-provider-abstraction.md) ModelProvider 4 wireFormat + BYO 模型

### 知识对象 / Citation / Evidence
- [ADR-0011](./adr/0011-claim-evidence-knowledge-object.md) Claim/Evidence/Counterpoint/Synthesis 一等节点

### Computational / Iframe
- [ADR-0007](./adr/0007-computational-cell-embedding.md) molab postMessage 6 kind + cell auth-token JWT

### 协作 / 评审 / Identity
- [ADR-0015](./adr/0015-open-peer-review-and-orcid.md) ORCID OAuth + JWS-signed review + visibility 矩阵（document-level review）
- [ADR-0016](./adr/0016-claim-on-claim-review.md) Claim-on-Claim Review（claim-level verdict + reused ORCID-sign + maintenance unverified-claim finding）
- [ADR-0025](./adr/0025-contribution-claims-attestations-verification.md) Contribution claim / acknowledge / challenge / verify DAG + identity/content-signature 分离

### Client-first / 开放科学（Phase 6 pivot）
- [ADR-0017](./adr/0017-client-first-runtime.md) Desktop truth + relay server + markdown-Yjs 双轨（修订 ADR-0001 §5.A）
- [ADR-0018](./adr/0018-open-content-mechanisms.md) Open question / dataset / peer review + ed25519 + Merkle log（DeSCI 去区块链）
- [ADR-0019](./adr/0019-plugin-runtime-cross-platform.md) WASM Extism 为主 + 原生沙箱 fallback

### 定位 / Triadic（战略层）
- [ADR-0020](./adr/0020-night-bridge-day-triadic-architecture.md) Night-Bridge-Day 三层等价 + 6 InteractionMode + 4 角色 + contribution-graph attribution
- [ADR-0021](./adr/0021-discovery-graph-vault-native-storage.md) Night artifact vault-native 存储 + 私密默认的物理兑现
- [ADR-0025](./adr/0025-contribution-claims-attestations-verification.md) 三层共享贡献声明协议 + 不同 proof policy

---

## 5. 读 ADR 的顺序建议

**新 onboard 先读 4 个**（覆盖 70% 的设计语境）：

1. ADR-0001 数据模型 —— 知道 Y.Doc / PG 边界
2. ADR-0002 权限模型 —— 知道 capability / principal / role bundle
3. ADR-0010 扩展系统 —— 知道 plugin / skill / MCP 三层关系
4. ADR-0008 agent runtime —— 知道 propose / accept 状态机 + provenance

**做 Phase 4 backend 工作**先看：

- W1 plugin install → ADR-0010 + ADR-0012
- W2 BYO model → ADR-0013
- W3 coordinator → ADR-0008 + ADR-0010
- W4 maintenance scan → ADR-0011（claim 没绑 evidence 的 finding 来自这个 schema）
- W5-W6 subdocument → ADR-0014（依赖 ADR-0001 §6 long debt）
- W7 fork/merge → ADR-0009（diff library 复用）
- W8 open peer review → ADR-0015 + ADR-0011（review 是 claim 上的 annotation）

**做 Phase 5 Wave B 工作**先看：

- Wave B Claim-on-Claim Review → ADR-0016 + ADR-0011（claim 基线）+ ADR-0015（ORCID 签名机制复用）+ ADR-0008（AI ↔ 人类区分）

**做 Phase 6 client-first / open-content 工作**先看：

- desktop / vault-fs / doc-store → ADR-0017 + client-first spec（`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`）
- publish / identity / Merkle log → ADR-0018 + ADR-0015（签名机制前身）
- plugin 跨平台 → ADR-0019 + ADR-0012（原生沙箱基线）

**理解项目定位 / 做 triadic（Night/Bridge/Day）工作**先看：

- ADR-0020 全文（战略 ADR，定位权威）+ ADR-0021（vault-native truth）+ system-prompt 第一性原理 #12/#13 + `packages/discovery-graph` / `packages/bridge-layer` 类型 SoT

**做协作归属 / 贡献验证 / public provenance 工作**先看：

- ADR-0025（claim/attestation 窄腰）+ ADR-0001（operational contribution）+ ADR-0018（公开签名/receipt）+ ADR-0015/0016（identity/review）

---

## 6. 维护规则

### 6.1 增加新 ADR

1. `cp plan0/adr/0000-template.md plan0/adr/00NN-<slug>.md`
2. 填充 8 节：Context / Decision / Consequences / Alternatives / 三种角色风险 / 接受准则 / Phase gate / Review log
3. 把"显式没选 X / Y / Z"写清楚（trade-off 记录是 ADR 的核心，不是 decision 本身）
4. 在 STATUS.md §2 加一行
5. 在本 ADR-INDEX §1 快表 + §2 phase gate 时间线 + §3 依赖图 + §4 主题聚类（任选 1-2 个相关主题）加引用

### 6.2 Promote `Proposed → Accepted`

1. 跑通 dogfood gate（在 ADR §"Gated on" 里写明的硬条件）
2. 改文件头 `Status: Proposed` → `Status: Accepted`
3. 在 ADR 末尾追加 `## Phase N Implementation Review Log`，写跑通 dogfood gate 时的 commit / 测试 / 残余 caveat
4. 改 STATUS.md §2 表对应行
5. 改本 INDEX §1 快表对应行（去掉 † 标记）

### 6.3 Supersede / Reject

不改老 ADR 的 `Status:`（保留 Accepted）；写新 ADR 设
`Status: Supersedes ADR-XXX`；老 ADR 末尾追加 superseded log。STATUS.md §2 表
新增一行新 ADR，老 ADR 行加注脚。
