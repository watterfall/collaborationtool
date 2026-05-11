# Client-First, Open-Science Collaboration Pivot — Design Spec

> **Status**: Draft (awaiting user review) — produced via `superpowers:brainstorming` skill
> **Date**: 2026-05-11
> **Author**: project owner + Claude (合伙人模式)
> **Supersedes / 扩展**:
> - `.brainstorm/E2EE-APP-DECISION.md` (2026-05-11, 初版决策分析 — 三轴拆解)
> - `.brainstorm/CLIENT-FIRST-PIVOT.md` (2026-05-11, 第二版 — 含 E2EE，本 spec 弃)
> - `.brainstorm/DESKTOP-APP-SCOPE.md` (2026-05-11, 第三版 — E2EE 退场, 三档 scope)
> - `plan0/improvement-plan-2026-05.md` (Council 评审 Phase 4 W6-W10 + Phase 5 trigger)
> **Pre-reqs**: `STATUS.md` / `plan0/paper-platform-system-prompt.md` / `plan0/Design.md` /
> 当前 ADR-0001…0015

---

## 0. Why this spec exists

2026-05-11 用户在 9 轮对话中 explicit 表达了项目的方向 pivot：从**服务端权威 + Web-first 协作平台**转向**客户端权威 + Desktop-first + Open Science 协作平台**。

本 spec 把方向锁定到可执行的 design contract，避免凭直觉做 ADR-级决策。下游产出：3 个新 ADR（0017/0018/0019）+ 3 major revision（ADR-0001/0004/0008）+ 8 个 review log + Phase 5 Wave B/C + Phase 6 W1-W12 implementation plan。

---

## 1. 决策摘要（Q1-Q5 → 答案）

| Q | 决定 | 影响 |
|---|---|---|
| 1 | **Local-first / peer-to-peer 架构** | client 是 truth，server 是 relay |
| 2 | **Dual-track storage**：`~/MyVault/*.md` 人可读 + `.vault/yjs/*.bin` CRDT sidecar | 用户可用 git / VS Code 直接操作 markdown；CRDT history 通过 sidecar 保留 |
| 3 | **Web = first-class open content surface**（发布 + 评论 + 轻量改稿 + open question feed）；**desktop = 主创作** | web 不再是平等 client；保留学术场景特殊价值（reviewer / DOI landing / open feed） |
| 4 | **"鼓励开放"是核心价值** + granular open mechanisms（per-subdoc visibility / open question / open dataset / open peer review）+ **DeSCI 去区块链** | Merkle log signed provenance + ed25519 而非 on-chain；排除 NFT / token / DAO |
| 5a | **Source of truth 反转**：client 文件是 truth，PG 退到 replicated cache | ADR-0001 §5.A **major revision** |
| 5b | **Server scope = relay + open-content agent** | subdoc visibility 决定 agent 跑哪边：visibility=public/unlisted → server agent 候选；visibility=private → 客户端 agent |

**关于"open project" 语义的精化**（用户原话："部分开放部分开源" 触发）：

- 没有项目级 binary `collab_mode`。粒度在 **subdocument visibility**。
- 项目有 `default_visibility ∈ {private, unlisted, public}` 字段，仅作**新建 subdoc 时的默认**。
- 每个 subdoc 可覆盖：`visibility ∈ {inherit, private, unlisted, public}`。
- "Open project" 是 **derived 状态**：任一 subdoc 是 public / 项目有 ≥1 个 open question / 项目主动 declared 在 open-content-index 索引中。
- Agent dispatch 决策按 **subdoc visibility at invocation time**，不按项目级。

**未决但已留 hook**：
- 端到端协议加密（E2EE）—— 用户明确"现阶段不重点"，但承认"长期有价值"。Spec 在 sync-gateway 层留 `cipher_mode ∈ {plaintext, e2e}` 字段为 Phase 7+ 预留。

**已 explicit 排除**：
- IP-NFT / token economy / DAO / on-chain provenance（DeSCI 去区块链立场）
- Web 与 desktop 功能完全对等（Q3=C 而非 D）
- 客户端纯封闭数据库（Q2=B 排除 sqlite-only）
- E2EE 全局加密（Q1 修正 → 不是密码学 e2e）

---

## 2. 核心 invariants

设计中**任何子系统不得违反**：

1. **Client owns truth**：用户的 markdown 文件 + Yjs sidecar 是权威。Server 任何状态都是 derived / cached / replicated。冲突时 client wins。
2. **Markdown 人可读**：用户用 cat / VS Code / git 看 markdown 文件能立即理解内容。Yjs sidecar 是元数据，用户不需要碰。
3. **Yjs CRDT 实时协作能力保留**：多人编辑通过 Yjs binary relay 实时 merge；客户端独立保留 CRDT history。
4. **Server outage 不阻塞 local editing**：sync-gateway 挂了，用户继续本地编辑，重连时 batch sync。
5. **AI 数据不出户 by default**：private project 的 inline / long-horizon agent 都跑客户端；open project 才走 server agent。
6. **Open is encouraged but opt-in per scope**：项目 default = private，UI 推用户向 open（"publish this section / question / dataset" 低摩擦），不是 default open。
7. **Provenance 不可伪造**：每次 commit / publish / agent action 用 user ed25519 key 签名，Merkle log 追加，可第三方独立 verify。**不上链**。
8. **Web 是 open content 的 first-class surface**：DOI landing / share-link / comment / open question feed 都是 web 必备；private project 的内容 web 不能看。

---

## 3. System Topology

```
┌────────────────────────────────────────────────────────────────┐
│                  Desktop App (Tauri 2.x, primary client)      │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ ~/MyVault/  (user-chosen path, default ~/Documents/...) │   │
│  │  ├─ paper-1.md          ← human-readable source        │   │
│  │  ├─ paper-2.typ         ← typst source                 │   │
│  │  ├─ attachments/        ← figures / datasets           │   │
│  │  └─ .vault/                                             │   │
│  │     ├─ yjs/paper-1.bin  ← Yjs CRDT state sidecar       │   │
│  │     ├─ index.sqlite     ← local search index (FTS5)    │   │
│  │     ├─ provenance.log   ← ed25519-signed commit log    │   │
│  │     ├─ keys/            ← ed25519 keypair + ORCID link │   │
│  │     ├─ pending-sync/    ← server-outage 排队           │   │
│  │     ├─ published.yaml   ← snapshot permalinks          │   │
│  │     └─ config.yaml      ← visibility / sync prefs      │   │
│  │                                                          │   │
│  │ In-memory: Y.Doc + ProseMirror editor                  │   │
│  │ Local services: ollama (inline AI) + plugin sandbox    │   │
│  │ Long-horizon agent: runs locally for private projects  │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬────────────────────────┘
                                        │ Yjs binary wire
                                        │ (plaintext, e2e hook reserved)
        ┌───────────────────────────────┴───────────────┐
        │                                                │
┌───────▼───────────────────────────┐    ┌───────────────▼──────────────┐
│   Server (relay-mode, weak truth) │    │   Web Client (secondary)     │
│   ┌─────────────────────────────┐ │    │   ┌──────────────────────┐   │
│   │ sync-gateway: pure relay     │ │    │   │ Open content reader  │   │
│   │ replicated-cache (PG)        │ │    │   │ (DOI / share-link)   │   │
│   │ share-snapshot store         │ │    │   │ Inline comment       │   │
│   │ comment-store                │ │    │   │ Margin annotation    │   │
│   │ open-content-index           │◀┼────┼─▶│ Suggest-edit (light) │   │
│   │ provenance-merkle-log        │ │    │   │ Open question feed   │   │
│   │ open-agent-worker            │ │    │   │ Reviewer onboarding  │   │
│   │  (only for open projects)    │ │    │   │ ORCID auth           │   │
│   └─────────────────────────────┘ │    │   └──────────────────────┘   │
└───────────────────────────────────┘    └──────────────────────────────┘
```

---

## 4. Components 职责

| 组件 | 状态 | 职责 | 实现量 |
|---|---|---|---|
| **`packages/identity/`** | 新建 | ed25519 keypair 生成 / 存储 / 加密备份（passphrase-derived）/ ORCID identity 链接 / 签名 + verify helper | Phase 6 W1-W2（与 vault-fs 同期）|
| **`apps/desktop/`** | 新建 | Tauri shell + 文件系统访问 + Ollama 集成 + 系统托盘 + 自动更新 + 文件关联 | Phase 5 Wave B Spike-1 PoC + Phase 6 W1-W2 生产化 |
| **`packages/vault-fs/`** | 新建 | markdown ↔ Y.Doc 双向 reconcile + 文件 watch + sidecar IO + 3-way merge UI | Phase 5 Wave B Spike-2 PoC + Phase 6 W1-W2 生产化 |
| **`packages/doc-store/`** | 扩展 | 加 `FileSystemBackend` impl `DocumentHandle`，与 `YjsDocumentHandle` 平级；现 Phase 4 W7.1 抽象**已就位** | Phase 6 W3-W4 |
| **`apps/web/`** | 瘦身 | 退到 open content reader / comment / 轻量改稿 surface；移除 server-only auth + agent dispatch UI（迁到 desktop）| Phase 6 W11 |
| **`apps/sync-gateway/`** | 改造 | `BodyBackend` 抽象**已就位** → 退到 pure relay；加 `cipher_mode` hook；加客户端权威协商（client wins on conflict） | Phase 6 W3-W4 |
| **`apps/open-agent-worker/`** | 重命名 | 自 `apps/agent-worker/`；只处理 subdoc visibility ∈ {public, unlisted} 的 long-horizon agent；visibility=private 的 dispatch 转发回 desktop 本地 agent | Phase 6 W9-W10 |
| **`packages/ai-runtime-client/`** | 新 fork | 客户端版 plugin host + ModelProvider resolver（local ollama / BYO key）；与 server-side `ai-runtime` 共享接口（plugin contract、provider 协议） | Phase 6 W9-W10 |
| **`packages/plugin-runtime-wasm/`** | 新建 | 跨平台 WASM plugin runtime（Extism-based 推荐）—— pending Spike-3 选型 | Phase 6 W9-W10 |
| **`packages/open-content/`** | 新建 | open question / open dataset / open peer review entity + Merkle signed provenance + ORCID 集成 | Phase 6 W6-W7 |
| **`apps/publish-pipeline/`** | 新建或并入 | desktop → server snapshot + DOI mint + share-link 生成 + Merkle entry append | Phase 6 W8 |
| **`infra/migrate-to-client-first/`** | 新建 | 一次性数据迁移：production PG Y.Doc → user vault folder | Phase 6 W5 |

---

## 5. Data Flows

### F1. 打开文档（desktop）
```
user opens paper-1.md
  → vault-fs reads .vault/yjs/paper-1.bin (if exists)
  → hydrate Y.Doc from sidecar
  → diff markdown file vs Y.Doc emitted markdown
  → if drift: prompt user "external edit detected, merge?" (3-way merge UI)
  → else: ProseMirror mounts on Y.Doc
```
若 sidecar 缺失：直接从 markdown hydrate Y.Doc（冷启动场景）。

### F2. 本地编辑（无网）
```
keystroke → ProseMirror tx → Y.Doc update
  → in-memory CRDT update (即时)
  → debounced sidecar flush (.vault/yjs/paper-1.bin, every 500ms)
  → debounced markdown flush (paper-1.md, every 2000ms or on blur)
  → if online: also broadcast via sync-gateway
```
markdown 是 derived view，编辑器从不直接改 markdown 文件，永远走 Y.Doc → emit。

### F3. 协作 sync（多 client）
```
Client A edits → Y.Doc update → sync-gateway WS frame (yjs binary)
  → sync-gateway broadcasts to all clients in room
  → server persists to replicated-cache PG (truth backup, not authority)
  → Client B receives update → Y.Doc merge → ProseMirror reflect → sidecar + markdown flush
```
server 走 pure relay，与现 `BodyBackend.persist` 抽象**已兼容**（语义从 truth 降级到 cache）。

### F4. 发布 open content
```
user clicks "Publish this section"
  → desktop emits markdown snapshot + Y.Doc binary + Merkle entry signed by user ed25519 key
  → POST /api/publish { kind: 'section'|'question'|'dataset'|'preprint', payload, signature }
  → server validates signature + writes to share-snapshot store
  → if kind ∈ {question, preprint}: server appends to open-content-index (web feed)
  → server returns permalink (DOI for preprint, hash-based for others)
  → desktop stores permalink in .vault/published.yaml
```

### F5. Web reviewer 评论
```
web visitor opens share-link → server renders snapshot HTML (Server Component)
  → visitor (with ORCID auth or anonymous) leaves inline comment
  → POST /api/comments { snapshot_id, range, body, author }
  → server stores in comment-store
  → desktop polls or WS subscribes → display comments as margin annotations
  → owner can "merge suggestion" → Y.Doc edit → flush → markdown updated
```

### F6. Agent dispatch（分叉）
```
desktop AgentPanel: user clicks "reviewer agent"
  → check enclosing subdoc.visibility (after inherit resolution)
  → if visibility ∈ {public, unlisted}:
      POST /api/agent/invoke → open-agent-worker (server-side, pgboss, anthropic/openai API)
      → agent reads from replicated-cache → emits suggestions → server stores
      → desktop pulls suggestions via WS
  → if visibility = private (default):
      local ai-runtime-client spawns plugin (wasm or native sandbox)
      → reads from local Y.Doc → calls local ollama or BYO API key
      → writes suggestions directly to Y.Doc
```

### F7. Open question lifecycle
```
desktop: user 标记 paragraph 为 "open question" + 写 ask body
  → publish flow (F4 kind='question')
  → web feed (/open) shows question card
  → stranger sees, clicks "I'll help" → ORCID auth
  → replies via web inline editor (轻量)
  → comment-store stores reply linked to question_id
  → desktop owner pulls reply → can "accept" → Y.Doc edit + sign provenance log
```

---

## 6. Error Handling

| # | 场景 | 处理 |
|---|---|---|
| E1 | 用户在 client 关闭后用 VS Code 改了 paper-1.md | client 启动时 `vault-fs` 比对 file mtime vs Y.Doc last-flush mtime；若 file 较新 → 3-way merge UI（markdown 解析为 PM JSON → 与 Y.Doc 比对 → 用户选 conflicts）|
| E2 | .vault/yjs/paper-1.bin 损坏 / 被删 | fallback rehydrate Y.Doc from markdown；丢失 CRDT history（warn user）；当前 session 的 sync 仍能工作 |
| E3 | sync-gateway outage（server 挂）| client 继续本地编辑（local-first）；update 排队到 `.vault/pending-sync/`；server 恢复后批量 send；冲突走 CRDT auto-merge |
| E4 | 两 client 离线各自编辑同一文档 | 各自 Yjs 独立累积 update；重连时 sync-gateway 同步双方 update；CRDT 自动 merge（Yjs 保证最终一致）；markdown 从 merged Y.Doc emit |
| E5 | open-agent-worker 跑到一半 server 重启 | pgboss job state 持久化（现状）；worker 重启后 resume；client 通过 agent_job timeline poll 看到 reconnect |
| E6 | DOI mint 失败（CrossRef 5xx）| 写 `failed_publish` 队列 + UI banner "DOI 待重试"；client 后台 retry；不阻塞 share-snapshot 立即可访问 |
| E7 | web visitor 看到过期 snapshot | snapshot 有 `version_hash`；desktop publish 时 server invalidate 旧版本；web 强 cache-control + e-tag；如果 stale，浏览器自动 304 + 拉新版 |
| E8 | plugin sandbox crash（WASM trap or native sandbox kill）| plugin host 捕获 → 写 plugin error event → UI 显示 "plugin X 异常退出" + "重启 / 禁用 / 报告"；不影响主 editor |
| E9 | 用户 markdown 文件被外部工具改成不合法语法 | `vault-fs` markdown parser fail-soft：能 parse 的 block 加载，bad block 标记 ⚠️ 不可编辑（直到用户手动 fix）|
| E10 | ed25519 signing key 丢失（用户重装系统）| `.vault/keys/` 加密备份（passphrase-derived），未备份则新 commit 用新 key 签名，旧 commit 仍由旧 pubkey 验证；provenance log 跨 key 链接通过 ORCID identity |
| E11 | 用户从 server-trust 模式迁移到 client-first（一次性数据迁移）| `pnpm migrate:to-client-first` —— 把 PG 现存 Y.Doc binary 导出到用户选择的 ~/MyVault/；之后 server PG 退到 cache 角色 |

---

## 7. Phase Rollout

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5 Wave A — 现状，不动                       (~2026-05-11 起)│
│ reviewer dogfood / quota enforcer / cancel API /                │
│ AgentTimeline / Provenance reveal / Design.md surface 收尾       │
│ 全部产出在 pivot 后仍直接复用                                    │
└─────────────────────────────────────────────────────────────────┘
        ↓ Wave A 6 项硬验收信号全部命中
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5 Wave B — 并行 3 spike + Claim-on-Claim Review 主线      │
│ Spike-1: Tauri shell + 本地 ollama inline (5-7 d)               │
│ Spike-2: Dual-track storage PoC (10-14 d)                       │
│ Spike-3: Cross-platform plugin runtime 选型 (7-10 d)            │
└─────────────────────────────────────────────────────────────────┘
        ↓ ADR moratorium 解除 (0012/0013/0014 dogfood gate 跑通)
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5 Wave C — 起 3 ADR + alpha tester 招募                   │
│ ADR-0017 Client-first runtime                                   │
│ ADR-0018 Open content mechanisms                                │
│ ADR-0019 Plugin runtime cross-platform                          │
│ + alpha tester 招募 (≥ 4 名)                                    │
└─────────────────────────────────────────────────────────────────┘
        ↓ 3 ADR Proposed + alpha 反馈基线
┌─────────────────────────────────────────────────────────────────┐
│ Phase 6 W1-W12 — pivot 真落地 (~6 月)                            │
│ W1-W2  apps/desktop/ + packages/vault-fs/ 生产化                │
│ W3-W4  doc-store FileSystemBackend + sync-gateway pure relay    │
│ W5     一次性迁移工具 pnpm migrate:to-client-first              │
│ W6-W7  open-content/ entity (question/dataset/peer-review)      │
│ W8     publish-pipeline + DOI mint + Merkle signed provenance   │
│ W9-W10 ai-runtime-client + plugin-runtime-wasm (or native)      │
│ W11    apps/web/ 瘦身                                            │
│ W12    ADR-0017/0018/0019 promote Proposed→Accepted             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Spike 验收标准（Phase 5 Wave B）

### Spike-1 Tauri shell
- 3 平台 binary 通过 GitHub Actions release pipeline 产出
- 套远端 web URL 跑通登录 / 编辑 / 同步
- 系统托盘 + 通知 + `.paper` 文件关联 + deep-link 工作
- inline AI toggle 检测 + 调用 localhost:11434 ollama 成功
- macOS notarization + Windows code signing pipeline OK
- **failure mode**：若 webview 跨平台 CJK 排版差异 ≥ 2 个 Design.md §11 reject criteria → 标记 Phase 6 W1 webview font shim

### Spike-2 vault-fs PoC
- 5 fixture 全 pass：cold-start / external-edit drift / 3-way merge / sidecar 损坏 / sync 中断
- markdown emit 通过 Design.md reject grep（不引入 hex / Tailwind palette）
- Y.Doc → markdown emit 与 PM JSON wire format（ADR-0005）兼容
- 5 客户端 stress 1000 ops + 离线 / 在线切换 → CRDT 最终一致 + markdown 单一
- **failure mode**：若 markdown reconcile 复杂度 > Phase 6 W3-W4 预算 2x → 倒退到 sqlite + markdown export-only fallback；用户重审定位

### Spike-3 Plugin runtime 选型
- macOS sandbox-exec / Windows AppContainer / WASM Extism 三选一 PoC 都跑通至少一个 echo plugin
- 各选项 trade-off 表：实现工程量（人周）/ 安全保证 / npm ecosystem 兼容度 / cold-start 延迟
- ADR-0019 draft 完成，含拒绝选项的 trade-off 文档
- **failure mode**：若三选项都不满足"跨平台 + npm 兼容 + 沙箱可信" → 回退到 "plugin 暂时只 Linux" + desktop 走 ssh-into-server-sandbox 兜底，重审定位

---

## 9. Phase 6 Dogfood Gates

| Gate | 验收 | 来源 ADR |
|---|---|---|
| G1 离线 round-trip | desktop 关网络 30 min 编辑 → 重连 → sync 完成 → markdown 无 drift | 0017 |
| G2 双 client 离线分叉 + merge | 两 desktop 各自 50 ops 离线 → 重连 → CRDT auto-merge → 两侧 markdown emit 一致 | 0017 |
| G3 vault 外部编辑 reconcile | VS Code 改 markdown → desktop 启动 3-way merge UI → user 选 conflicts → 落定 | 0017 |
| G4 open question → 陌生人回答 | desktop publish question → web feed 露出 → 第二 alpha tester ORCID 登录回答 → desktop 收到 reply → owner accept → provenance 链有签名 | 0018 |
| G5 open agent (server) round-trip | open project → invoke reviewer agent on server → suggestion 写 share-snapshot → desktop pull → owner 接受 | 0017+0008 |
| G6 private agent (client) round-trip | private project → invoke maintenance agent locally → local ollama 调用 → finding 写 Y.Doc → 无网络外发 | 0017+0008 |
| G7 跨平台 plugin install | macOS / Windows / Linux 三机器同一 plugin install + sandbox spawn 成功 | 0019 |
| G8 DOI mint + Merkle log 完整 | preprint publish → DOI 真获取 → Merkle entry append → 可独立 verify signature chain | 0018 |
| G9 server outage 兜底 | sync-gateway 挂 30 min → 5 客户端独立编辑 → 服务恢复后批量 sync 成功 → 无丢失 | 0017 |
| G10 一次性迁移工具 | production PG 真实数据 → `pnpm migrate:to-client-first` → 用户 vault 文件夹 → desktop 打开内容一致 | 0017 |

10 gate 全 PASS = ADR-0017/0018/0019 promote Proposed → Accepted。

---

## 10. Testing Strategy

| 层 | 覆盖 |
|---|---|
| **Unit** | `vault-fs` markdown↔Y.Doc emit/parse pure functions / `open-content` signature verify / `doc-store` FileSystemBackend lifecycle |
| **Contract** | sync-gateway pure-relay 协议 / publish API signature / comment-store ACL |
| **Integration** | `packages/vault-fs` 5 fixture / `apps/desktop` E2E（Tauri WebDriver）/ `apps/web` open content reader |
| **E2E** | tests/e2e Playwright 双 desktop + 1 web reviewer 三方场景 / 离线分叉 merge / cross-platform plugin install |
| **Stress** | 5 desktop × 1000 ops 离线 / 50 client open project simultaneous read-only / 100 open question feed pagination |
| **Migration** | `pnpm migrate:to-client-first` 跑现 production fixtures（不含真用户数据）|

---

## 11. Per-ADR Promote Criteria

| ADR | promote 条件 |
|---|---|
| 0017 Client-first runtime | G1+G2+G3+G6+G9+G10 全 PASS |
| 0018 Open content mechanisms | G4+G8 全 PASS + ≥ 2 alpha tester 跑通 open question 全 lifecycle |
| 0019 Plugin runtime cross-platform | G7 PASS + 一个第三方 plugin install on 三平台 |
| 0001 §5.A 反转 review log | 与 0017 同时 promote |
| 0008 agent runtime two-tier review log | G5+G6 PASS + 现 reviewer / researcher / maintenance / inline-editor 各自跑通新拓扑 |
| 0012 caveat 升 P0 → 解除 | 由 0019 替代解决（Spike-3 选 WASM）or 真做 macOS+Windows sandbox（Spike-3 选 native） |

---

## 12. 已知 Open Issues / Risks

| # | 风险 | 触发条件 | 缓解 |
|---|---|---|---|
| R1 | markdown ↔ Y.Doc reconcile 比预想复杂 | Spike-2 跑 > 14 天仍未通过 5 fixture | failure mode: 倒退 sqlite + markdown export-only；重审 Q2 |
| R2 | 跨平台 plugin runtime 三选一都不满足 | Spike-3 三选项均失败 | failure mode: plugin Linux-only + ssh-into-server-sandbox |
| R3 | alpha tester 招募失败（< 4 名 = Wave C 推迟） | Wave C 招募 4 周内 < 4 名响应 | 缓解：先用项目所有者自身 dogfood + 联系 ≥ 2 位认识的研究生 |
| R4 | DeSCI "去区块链" 立场被社区误读 | 第三方 / VC 把项目当 Web3 / token 项目 | 缓解：landing page 显式声明 "no token, no NFT, no chain"；公开 stance 文档 |
| R5 | ORCID 依赖（open peer review 全靠 ORCID auth） | ORCID 服务变更或 deprecation | 缓解：抽 ProviderInterface（参 ADR-0013 ModelProvider 模式），ORCID 是第一 impl，后续可加 institutional SSO / FedCM |
| R6 | Phase 6 真实工程量超 6 个月 | W12 时 3 ADR 仍未 Accepted | 缓解：W6 设 mid-phase checkpoint，>2x 预算时砍 W9-W10 ai-runtime-client，agent 仍 server-side 兜底 |
| R7 | E2EE 长期目标在 Phase 6 落地后再加，破坏 sync-gateway API | Phase 7 / 8 真加 E2EE 时 | 缓解：本 spec §2 invariant + sync-gateway `cipher_mode` 字段已为此预留 |
| R8 | 用户实际 dogfood 后发现 markdown 形式不够 expressive | Phase 5 Wave C alpha tester 反馈 | 缓解：ADR-0001 markdown 扩展 paperSchema（含 claim / evidence / cell 节点）必须保留；Yjs sidecar 永远是 fallback truth |

---

## 13. Out of Scope（明确不做，防 scope creep）

- ❌ E2EE 密码学加密（Phase 7+，留 hook，本 spec 不实现）
- ❌ 完整移动端（iOS / Android）—— Tauri 2 支持但不在 Phase 6 范围
- ❌ Mac App Store / Microsoft Store 上架（用 GitHub Releases 起点）
- ❌ IP-NFT / token / DAO / on-chain provenance / Decentralized funding
- ❌ Web 与 desktop 功能完全对等
- ❌ Reputation score 量化 / 论文影响因子计算
- ❌ Multi-tenant SaaS hosting 优化
- ❌ Plugin marketplace（improvement-plan §四已砍 Phase 6+）
- ❌ Spatial canvas / 章节 fork-merge UI（improvement-plan §四已砍）
- ❌ Loro 切换评估（同上）

---

## 14. ADR 影响速查

| ADR | 当前 Status | Pivot 后影响 |
|---|---|---|
| 0001 data-model + CRDT | Accepted | **§5.A major revision**（PG truth → cache）；review log 补 W7.1 doc-store FileSystemBackend |
| 0002 permission | Accepted | review log：subdocument-level visibility 加 enum `{inherit, private, unlisted, public}` |
| 0003 tech-stack | Accepted | review log：加 Tauri 2.x + ed25519 + libsodium hook |
| 0004 deploy + security | Accepted | **major revision**：distributed clients + relay server topology |
| 0006 MCP registry | Accepted | review log：区分 local-MCP / external-MCP；private project 限制 external |
| 0008 agent runtime | Accepted (caveat) | **major revision**：two-tier runtime（client + open-server） |
| 0010 plugin API | Accepted | review log：plugin host 客户端化 |
| 0011 claim-evidence | Proposed | review log：signed provenance 链 + Merkle log |
| 0012 plugin sandbox | Accepted (caveat) | **caveat 升 P0 / 由 0019 解决** |
| 0013 ModelProvider | Accepted | review log：client-side resolver |
| 0014 subdocument | Proposed | review log：visibility 与 subdoc 绑定 |
| 0015 ORCID 开放评审 | Proposed | review log：open project 走 ORCID；open question stranger reply 触发 |
| **0017 Client-first runtime** | **新** | 主 ADR |
| **0018 Open content mechanisms** | **新** | open question / dataset / peer review / Merkle log |
| **0019 Plugin runtime cross-platform** | **新** | Spike-3 决定 sandbox vs WASM |

---

## 15. 决策日志（追溯）

| 日期 | 决定 | 来源 |
|---|---|---|
| 2026-05-11 | 项目方向 pivot 启动 | 用户主动提出（9 轮对话）|
| 2026-05-11 | E2EE 推后到 Phase 7+ | 用户："现阶段没必要重点在加密" |
| 2026-05-11 | 保留 Yjs 实时 CRDT 作为核心价值 | 用户："不碰 Yjs 还是有问题" |
| 2026-05-11 | 客户端 dual-track storage（markdown + yjs sidecar）| Q2 = B |
| 2026-05-11 | Web 角色 = 发布 + 评论 + 轻量改稿 | Q3 = C |
| 2026-05-11 | 开放是核心价值观，granular open mechanisms | 用户："鼓励开放，部分开放部分开源" |
| 2026-05-11 | DeSCI 风格但去区块链 | 用户："不那么过分强调区块链技术" |
| 2026-05-11 | Source of truth 反转 | Q5a = Yes |
| 2026-05-11 | Server scope = relay + open-project agent | Q5b = B |
| 2026-05-11 | 落地路径 = Phased pivot with current momentum | 用户选 B |

---

## 16. Next Steps（本 spec approved 之后）

1. **用户复审本 spec**（你正在做）
2. **commit spec 到 git**（已 commit）
3. **调用 `superpowers:writing-plans` skill** 起草 Phase 5 Wave B Spike-1 / Spike-2 / Spike-3 的 implementation plan
4. **Phase 5 Wave A 继续不动**，按现 plan stub 跑
5. **Wave A 跑完后**，启 Wave B + 3 spike 并行

**本 spec 不直接触发任何 implementation。** 任何 code 改动 / 新文件 / ADR 起草都要等 implementation plan approved 后才开始。

—— END of design spec ——
