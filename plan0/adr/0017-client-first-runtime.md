# ADR-0017: Client-first Runtime — Desktop Truth + Relay Server + Markdown-Yjs Dual-Track

- **Status**: Proposed
- **Date**: 2026-05-12
- **Phase**: 6 W2
- **Deciders**: tech-lead (jili)
- **Gated on**:
  - 3 Spike PASS（Spike-1 Tauri shell `98e3f30` / Spike-2 vault-fs `6492b36` / Spike-3 plugin runtime `5ce6a97`）—— ✅ landed
  - Phase 6 W2-W3 runtime gates（GH Actions 3-platform binary + 套远端 URL smoke + macOS notarize + Win signing）—— ⏳ user-driven
  - ADR-0001 §5.A formal revision review log（"PG truth" → "PG replicated cache"）—— ⏳ 本 ADR Accepted 后追加

---

## 1. Context

### 1.1 为什么现在决定

Phase 5 末整体方向 pivot 至 **client-first / open science**（per memory `client_first_pivot_2026_05.md` + spec `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`）。spec §1 Q5a 明确：

> "Source of truth 反转：client 文件是 truth，PG 退到 replicated cache —— ADR-0001 §5.A **major revision**"

这是 Phase 1 第一性原理 #10 ("可演化性 > 当下完备") **红线区**：数据模型反转不能凭决心，必须 spike 实证。Phase 6 W0.5-W1 三 spike 全 PASS 提供了实证基础：

- **Spike-1 (`98e3f30`)**：Tauri 2.x shell + apps/desktop/ + Ollama inline AI + 系统托盘 / 通知 / `.paper` 文件关联 / deep-link / Updater 全可行
- **Spike-2 (`6492b36`)**：markdown ↔ Y.Doc 双向 reconcile（emit / parse / sidecar IO / 3-way merge）+ 5 fixture（cold-start / external-edit / 3-way / sidecar 损坏 / sync 中断）+ 5-client stress 1000 ops + offline/online 切换收敛 全 PASS
- **Spike-3 (`5ce6a97`)**：plugin runtime hybrid (WASM Extism primary + per-OS native fallback) 选型决断 + ADR-0019 Proposed

本 ADR 是 client-first pivot 的 **主 ADR**（per spec §14 ADR 影响表"0017 主 ADR"）；ADR-0018（open content）+ ADR-0019（plugin runtime）是其 satellite。

### 1.2 这是 **底层 Phase 6 锁定 / Phase 7+ 不可重写** 的决策

严格度更高（per template §1 提示）：
- Source-of-truth 反转一旦 ship 给真用户，不可回滚（用户 vault 文件夹已存在，server 已退到 cache）
- Yjs CRDT 协议保留（spec §2 invariant #3）—— 不切 Loro / Automerge
- Tauri 2.x 锁定 desktop runtime（spec §3 system topology）—— 不切 Electron / 原生 Cocoa+WinForms

### 1.3 既有 prior art / Phase 4 沉没成本保留

本 ADR **不重写** 既有代码 —— 仅 reframe：

| 既有 | reframe 后角色 |
|---|---|
| `packages/doc-store/` (ADR-0001 §5.D) | 加 `FileSystemBackend` impl `DocumentHandle`，与 `YjsDocumentHandle` 平级；现有抽象**已就位**（Phase 4 W7.1 落地） |
| `apps/sync-gateway/` | 退到 pure relay；`BodyBackend` 抽象**已就位**；加 `cipher_mode` hook 为 Phase 7+ E2EE 预留 |
| `apps/agent-worker/` | 重命名为 `apps/open-agent-worker/`；只处理 visibility ∈ {public, unlisted} 的 long-horizon agent；private visibility 转发回 desktop 本地 agent（per ADR-0008 caveat 演化） |
| PG schema（ADR-0001） | 不删字段；语义从 "truth" 降级 "replicated cache"；本 ADR Accepted 后 ADR-0001 §8.7 review log 形式记录 |
| `apps/web/` | 瘦身：退到 open content reader / comment / 轻量改稿 surface（spec §3 web client 角色）；server-only auth + agent dispatch UI 迁到 desktop |

### 1.4 与 ADR-0020 Triadic Architecture 的关系

ADR-0020（Phase 5 战略 ADR，Status: Proposed，**Wave D-5 dogfood gate 跑通后** promote）规定三层等价知识产出（Night / Bridge / Day）。本 ADR 是其 **runtime substrate**：

- Night artifact（private by default）→ 本地 vault `.vault/yjs/night-*.bin` + markdown 永不 leave 本机
- Bridge artifact（collaborator by default）→ 同 vault；可选 publish 到 server share-snapshot
- Day artifact（visibility-driven）→ public 走 server / private 走本地

三层架构与本 ADR client-first 的 visibility-per-subdoc 模型严格兼容（spec §2 invariant #6）。

---

## 2. Decision

**Client owns truth + Markdown-Yjs dual-track + relay-mode server + visibility-per-subdoc agent routing**。

### 2.1 5 核心 invariants（不可违反）

per spec §2，本 ADR 锁定为 ADR-level invariants：

1. **Client owns truth** —— 用户 `~/MyVault/*.md` + `.vault/yjs/*.bin` 是权威。Server 任何状态都是 derived / cached / replicated。冲突时 client wins。
2. **Markdown 人可读** —— 用户用 `cat` / VS Code / git 看 markdown 文件能立即理解内容。Yjs sidecar 是元数据，用户不需要碰。
3. **Yjs CRDT 实时协作能力保留** —— 多人编辑通过 Yjs binary relay 实时 merge；客户端独立保留 CRDT history。
4. **Server outage 不阻塞 local editing** —— sync-gateway 挂 30 min，5 客户端独立编辑无丢失，重连后批量 sync 成功（spec §9 gate G9）。
5. **AI 数据不出户 by default** —— private project 的 agent invocation 走客户端本地 ollama / BYO key；public/unlisted project 才走 server agent worker。

### 2.2 System topology（per spec §3）

```
Desktop App (Tauri 2.x, primary)
├── ~/MyVault/                       ← 用户选路径
│   ├── paper-1.md                   ← human-readable source
│   ├── attachments/                 ← figures / datasets
│   └── .vault/
│       ├── yjs/paper-1.bin          ← Y.Doc CRDT state sidecar
│       ├── index.sqlite             ← local search (FTS5)
│       ├── provenance.log           ← ed25519-signed commit log (ADR-0018)
│       ├── keys/                    ← ed25519 keypair + ORCID link (ADR-0018)
│       ├── pending-sync/            ← server-outage 排队
│       ├── published.yaml           ← snapshot permalinks
│       └── config.yaml              ← visibility / sync prefs
├── In-memory: Y.Doc + ProseMirror editor
├── Local: ollama (inline AI) + plugin sandbox (ADR-0019)
└── Local long-horizon agent: private projects
        ▼ Yjs binary wire (plaintext, cipher_mode hook reserved)
┌────────────────────────────┐    ┌─────────────────────────────┐
│ Server (relay-mode)        │    │ Web Client (secondary)      │
│ - sync-gateway pure relay  │◀──▶│ - Open content reader       │
│ - replicated-cache (PG)    │    │ - DOI / share-link landing  │
│ - share-snapshot store     │    │ - Inline comment + margin   │
│ - comment-store            │    │ - Suggest-edit (light)      │
│ - open-content-index       │    │ - Open question feed        │
│ - provenance-merkle-log    │    │ - Reviewer onboarding ORCID │
│ - open-agent-worker        │    └─────────────────────────────┘
│   (only for open projects) │
└────────────────────────────┘
```

### 2.3 Vault 文件契约（per Spike-2 vault-fs 实证）

`packages/vault-fs/`（已 land `6492b36`）暴露的 6 public API 即 vault contract：

```ts
emitMarkdown(yDoc: Y.Doc): string                  // Y.Doc → markdown
parseMarkdown(md: string, opts?): Y.Doc            // markdown → Y.Doc
readSidecar(path: string): Promise<Uint8Array|null>
writeSidecar(path: string, bytes: Uint8Array): Promise<void>  // atomic via .tmp rename
watchVault(root: string, handler): VaultWatchHandle           // chokidar wrap，.vault/ 排除
detectDrift({yDoc, markdownFileContent}): DriftReport         // sha256 hex 比较
threeWayMerge({base, local, remoteMarkdown}): ThreeWayMergeResult  // diff3 + conflict regions
```

Phase 6 W3-W4 swap：(a) markdown-it directive plugin (`::claim{...}`) 替代 HTML comment 兜底；(b) Myers diff 替代 naive line diff；(c) trailing-blank canonicalizer。

### 2.4 Visibility-per-subdoc + agent routing（per spec §1 修正）

**没有项目级 binary `collab_mode`**。粒度在 **subdocument visibility**：

```ts
// 项目级（仅 default）
project.default_visibility: 'private' | 'unlisted' | 'public'

// subdoc 级（可覆盖）
subdoc.visibility: 'inherit' | 'private' | 'unlisted' | 'public'
```

Agent dispatch 决策按 **subdoc visibility at invocation time**：

```
desktop AgentPanel: user click "reviewer agent" on subdoc X
  → resolve X.visibility (inherit → project.default_visibility)
  → if ∈ {public, unlisted}: POST /api/agent/invoke → open-agent-worker (server)
  → if = private: local ai-runtime-client spawn plugin (WASM/native per ADR-0019)
                  → reads local Y.Doc, calls local ollama or BYO key
                  → writes suggestions directly to Y.Doc, NO server roundtrip
```

ADR-0008 §2.2 multi-step dispatch loop **保留**；本 ADR 仅加 visibility-routing 前置。

### 2.5 5 关键数据流

per spec §5 F1-F7（F4 / F5 / F7 在 ADR-0018 详）：

| Flow | 客户端行为 | 服务端行为 |
|---|---|---|
| F1 打开文档 | vault-fs read sidecar → hydrate Y.Doc → emit vs file → 3-way merge UI if drifted | none |
| F2 本地编辑（无网） | keystroke → Y.Doc update → debounced sidecar (500ms) + markdown (2000ms) flush | none |
| F3 协作 sync | Y.Doc update → WS frame → broadcast | replicated-cache write |
| F6 agent dispatch | visibility routing per §2.4 | open-agent-worker only for public/unlisted |

### 2.6 Two-tier agent runtime（ADR-0008 演化）

| 维度 | client-side (`packages/ai-runtime-client/`) | server-side (`apps/open-agent-worker/`) |
|---|---|---|
| 服务对象 | private subdoc | public / unlisted subdoc |
| Model provider | local ollama / BYO key (`packages/ai-runtime/providers`) | server env API key (Anthropic / OpenAI / etc) |
| Plugin sandbox | WASM Extism + native fallback (ADR-0019) | bwrap (ADR-0012) |
| Quota | per-vault local（不入 server）| server-side per-principal (Phase 5 Wave A A1) |
| Provenance | `.vault/provenance.log` ed25519 signed (ADR-0018) | PG `provenance` table (ADR-0001) |

`packages/ai-runtime-client/` 与 `packages/ai-runtime/` **共享 plugin contract + provider 协议**（接口同源），运行时分叉 by visibility。

---

## 3. Consequences

### Good

- **5 年差异化锚点深化**：local-first + open content + AI 数据不出户 三组合，竞争对手（Curvenote / PubPub / Notion）无人完整覆盖
- **Phase 4 沉没成本保留**：claim/evidence/render-*/reviewer agent 全部保留作 server-side adapter；叙事降级而不删除
- **server outage resilience**：spec §9 G9 显式 30 min 离线编辑不丢失
- **AI 隐私模型清晰**：private = client only / open = server allowed —— 用户授权前提下用 server AI
- **CRDT 协作能力不丢**：Yjs 双向 binary relay 模式与 Phase 4 W6-W10 实现完全兼容（pure relay 退化）
- **Tauri 客户端独立分发**：用户可以脱离 web 部署独立用 desktop app

### Bad / Trade-offs

- **复杂度增加**：3 个 worktree（main + server cache + client truth）的 reconciliation 边界比单 PG truth 高 —— 缓解：Spike-2 实证 6 API 足够；Phase 6 W3-W4 doc-store FileSystemBackend 用消费
- **离线 vs 在线协作不对称**：离线 client wins on conflict（spec §2 invariant #1）—— 对协作者意味着自己 push 给离线客户端的改动可能被覆盖；缓解：sync-gateway 重连后 3-way merge 触发 UI（spec §5 F3）
- **桌面分发负担**：3 平台 binary 维护（macOS notarize + Windows signing + Linux AppImage）= 持续工程量；缓解：GH Actions matrix（spike-1 task 10）+ Tauri Updater minisign 自动化
- **server 退到 cache 后**：现有 web auth flow 不再是 single truth；better-auth + ORCID 仍走 server 但 user 可独立 desktop ORCID-sign（ADR-0018）
- **Yjs binary 不可读**：sidecar `.vault/yjs/*.bin` 用户看不懂；缓解：markdown 永远人可读（spec §2 invariant #2），sidecar 是元数据

### Neutral / Need watching

- **E2EE crypto 未实施**：spec §1 Q1 显式 "现阶段不重点，长期有价值"；sync-gateway `cipher_mode ∈ {plaintext, e2e}` hook 已为 Phase 7+ 预留
- **跨设备 storage**：spec §16 列 Phase 7+；本 ADR scope 内 single-device + sync-gateway relay 足够
- **macOS sandbox-exec Apple-deprecated**（per Spike-3 decision）：每个 macOS major version 实测 sandbox-exec 仍 work；坏掉则评估 Endpoint Security Framework

---

## 4. Alternatives considered

### A: 不 pivot，server 仍是 truth（Phase 4 status quo）

- 为什么不选：Council 评审 + 第一性原理 #1 (local-first) 全部反对；commodity 红海；护城河浅；AI 数据隐私无清晰边界
- 什么情况下回头：Phase 6 W2-W3 runtime gates **彻底失败**（GH Actions binary 三平台 ≥ 2 个无法 produce），desktop 分发不可行

### B: E2EE 全局加密（密码学 e2e）

- 为什么不选：spec §1 Q1 显式 user 说"现阶段不重点"；E2EE 加密 server-side agent 不可读 → public review feed 不可工作 —— 与"鼓励开放"价值冲突
- 什么情况下回头：Phase 7+ 单独评估；sync-gateway `cipher_mode` hook 已预留

### C: SQLite-only 客户端（无 markdown）

- 为什么不选：spec §1 Q2 显式 "dual-track storage" + invariant #2 markdown 人可读；用户 git/VS Code 直接操作 markdown 是核心 affordance
- 什么情况下回头：若 markdown reconcile 复杂度真超 Phase 6 W3-W4 预算 2x（spike-2 failure mode）→ 降级 sqlite + markdown export-only

### D: Pure web（无 desktop）

- 为什么不选：spec §1 Q3 显式 "desktop = 主创作"；离线编辑 + AI 数据不出户 + 文件系统访问 都需 native 客户端
- 什么情况下回头：Tauri 2.x 长期生态死掉 + Electron 没接班（不可能）

### E: 完全重写

- 为什么不选：Phase 4 W6-W10 sunk cost + Phase 5 Wave A/B/C/D 大量代码可作 server adapter；spike-1/2 实证 reframe 路径可行
- 什么情况下回头：Phase 6 W3-W6 实施中发现 **结构性不兼容**（如 sync-gateway BodyBackend 抽象不能 cleanly 降级到 relay）

---

## 5. Decision log

- **2026-05-11** spec `2026-05-11-client-first-pivot-design.md` Q1-Q5 锁定（user 11 轮 brainstorm 后；memory `client_first_pivot_2026_05.md`）
- **2026-05-12 W0.5** 3 spike plan 起草（spike-1 已存；spike-2 + spike-3 新增 `3a25fe5`）
- **2026-05-12 W1** Plan C parallel subagent execution → 3 spike 两轮全 PASS（`5ce6a97` / `98e3f30` / `6492b36`）
- **2026-05-12 W2** 本 ADR 起草 Proposed —— 三 spike 实证支撑齐备
- **关键反对意见 1**：复杂度 —— 3 truth source（client / server cache / Yjs sidecar）的 reconciliation 边界。**回应**：Spike-2 实证 6 API + 5 fixture + 5-client stress 全 PASS 即足够；Phase 6 W3-W4 落 doc-store FileSystemBackend 时单一消费
- **关键反对意见 2**：Apple notarization / Windows signing 长期工程量。**回应**：spike-1 task 9 minisign + UPDATER_README.md 已写 keypair 流程；cert procurement 推 Phase 6 W2 user-driven
- **关键反对意见 3**：ADR-0001 §5.A 反转是 Phase 1 红线区。**回应**：第一性原理 #10 ("可演化性 > 当下完备") 显式认可"在数据模型上经常是骗局"—— 本 ADR 是骗局识别后的纠偏，三 spike 实证非空话

---

## 6. Phase 6 implementation review log

待 Phase 6 W2-W12 实施过程追加。每个 Wave landed 后追加一行。

W12 末 dogfood gate retrospective 时统一 review 本 ADR：
- spec §9 10 个 dogfood gate G1-G10 pass/fail
- 三 spike runtime 验收（GH Actions binary / remote URL smoke / notarize+sign）
- ADR-0001 §5.A 反转的副作用（sync-gateway 退化 / open-agent-worker 重命名）
- ADR Status: Proposed → Accepted（如 dogfood gate 通过）

---

## 7. References

### 项目内部
- `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`（client-first pivot 设计 spec，420 行）
- `docs/superpowers/reports/2026-05-11-spike-1-report.md`（Tauri shell 实证）
- `docs/superpowers/reports/2026-05-12-spike-2-report.md`（vault-fs 实证）
- `docs/superpowers/reports/2026-05-12-spike-3-report.md`（plugin runtime 选型）
- ADR-0001 §5.A（PG truth 反转点，本 ADR 实施后 §8.7 review log 追加）
- ADR-0004（部署拓扑 —— relay-mode server topology revision）
- ADR-0008（agent runtime —— two-tier 演化）
- ADR-0018（open content mechanisms，satellite ADR）
- ADR-0019（plugin runtime cross-platform，satellite ADR，已 Proposed）
- memory `client_first_pivot_2026_05.md`（pivot 方向锁定 2026-05-11）

### 外部
- Tauri 2.x docs: https://v2.tauri.app
- Yjs subdocuments: https://docs.yjs.dev/api/subdocuments
- minisign: https://jedisct1.github.io/minisign/
- Local-first software (Kleppmann et al 2019): https://www.inkandswitch.com/local-first/
