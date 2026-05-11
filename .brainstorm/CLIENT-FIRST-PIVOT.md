# Client-First Pivot 准备 — 2026-05-11

> 用户决定（2026-05-11 对话）：**AI 本地跑 / 主协作走本地 app / E2EE 私密项目 / web 退到辅助展示**
>
> 本文不是 ADR（improvement-plan §四 new ADR moratorium 仍生效，等 0012/0013/0014 promote）。
> 目的：把方向翻译成 phased pivot 路径 + 列必须先答的 4 个技术难题 + 与 Phase 5 Wave A 的兼容性。

---

## 1. 方向声明（用户原话翻译）

| 用户语 | 技术翻译 | 三轴位置 |
|---|---|---|
| "AI 不在 server-side，本地 AI 更好" | C4 / C2 客户端 ModelProvider + 客户端 plugin host + 客户端 coordinator loop | 轴 C |
| "主要协作用本地 app" | A3 desktop app + 本地 source-of-truth（sqlite/IndexedDB）+ relay-only server | 轴 A |
| "端到端加密，给私密项目更大帮助" | **B3 per-project E2EE compartment**（非 B2 全局 E2EE） | 轴 B |
| "web 为辅助展示和轻量级" | web 退到 reader / share link / 评论 surface；非私密文档可走 web 编辑 | 轴 A |

**B3 而非 B2 的关键理由（如果用户接受）**：
- 公开论文 / 已发表 / 邀请 reviewer 的文档 → 走 web + server-trusted，享受服务端 search / export / community surface
- 私密项目（grant draft / 未发表 / 内部讨论）→ 走 desktop app + E2EE，server 只见密文
- 这是 Cryptpad-shared workspaces / Anytype-vault / Notion-private-pages 的成熟模式

**B3 触发新决策**：用户在 UI 上**选 mode** —— "公开 / 受邀 / 私密"，schema 加 `document.encryption_mode`。

---

## 2. 第一性原理对齐度（不是 spy gatekeeper，是确认这条路对）

| 原则 | 当前 | Pivot 后 |
|---|---|---|
| #1 Local-first 优于云优先 | **弱**（Yjs 在客户端但 PG 是 truth） | **强**（客户端 sqlite/IndexedDB 是 truth） |
| #2 Markup-as-source | 不变 | 不变 |
| #3 AI 是协作者 | 不变 | **更强**（本地 ollama / 用户自家 key 不出户） |
| #5 可组合优于大一统 | 不变 | 更强（plugin / MCP 客户端化让用户更可控） |
| #6 延迟即设计 | 不变 | **更强**（不走网络 round-trip） |
| #9 协作是动词 | server-trusted 模型下 community surface 是天然能力 | **B3 私密文档失去 community 能力**（但用户接受这个 trade-off） |
| #11 Provenance 即一等数据 | server 写 provenance | 客户端签名 provenance + relay 转发 |

**对齐度净增**：方向**符合**第一性原理。**不应**用 "§5.3 不要过度工程" 红线否决——这是 Phase 5/6 的 deliberate pivot，不是 mid-phase scope creep。

---

## 3. 与现行 Phase 5 Wave A 的兼容性（关键好消息）

Phase 5 Wave A trigger A = **reviewer dogfood + 单文档 + ADR-0008 caveat 堵漏**（quota enforcer / cancel API / AgentTimeline / Provenance reveal）。

**所有 Wave A 工作产出在 pivot 后仍然有用**：
- `packages/ai-runtime/src/quota-enforcer.ts` → 客户端 quota counter（本地 sqlite）也需要
- AgentTimeline UI → 客户端 long-horizon agent 仍需要可视化
- Provenance reveal 动效 → 客户端 provenance chain 仍需要
- ORCID 真 OAuth → 跨 mode 都需要

**唯一需要重 design 的**：`apps/agent-worker/` 进程 → pivot 后变 "可选 server-side coordinator for collaborative non-encrypted docs"，**B3 私密文档跑客户端 coordinator**。

**结论**：**Phase 5 Wave A 不停**，照原计划跑完。pivot 启动点 = **Phase 5 Wave B 或 Phase 6 起**。

---

## 4. 4 个真技术难题（必须先答，否则 ADR-0017 写不出来）

### 难题 1：E2EE × MCP 边界冲突

**问题**：
- agent 调 crossref / pubmed / web-search MCP 时，prompt 必带"论文当前段落"作为 context。
- 这段明文一旦出客户端 → 已经出 E2EE 边界。
- "私密文档 + MCP" 是天然矛盾。

**三种解**（用户选）：
1. **A. 私密文档禁用所有外部 MCP** —— 最干净，但 reviewer / researcher 失能
2. **B. 用户授权 per-call exfiltration** —— 每次 MCP 调用前 UI 提示"将把这段发给 crossref.org"，用户点同意
3. **C. 区分 "全局 MCP"（如 local-grep / local-sqlite）vs "外部 MCP"** —— 私密文档只允许本地 MCP，禁用外部

**我倾向 C + B 兜底**：默认 C，UI 给"临时允许这次外部调用"escape hatch。

### 难题 2：跨平台 sandbox real（ADR-0012 caveat 升级为 P0）

**问题**：
- 当前 ADR-0012 caveat：macOS sandbox-exec / Windows AppContainer 都是占位，UI 拦截兜底（plugin install 非 Linux 直接拒）。
- client-first 后**所有用户都是 macOS / Windows / Linux**，"plugin 只能 Linux" 不成立。
- desktop app 的 plugin host 跑客户端 → 必须 cross-platform sandbox。

**工程量参考**：
- macOS sandbox-exec profile DSL：3-5 周（参考 Firefox seatbelt profile）
- Windows AppContainer：5-8 周（更复杂，需要 capability mapping）
- 替代方案：**WASM-based plugin runtime**（Extism / WebAssembly Component Model）—— 跨平台天然解决，**但要求所有 plugin 编译到 WASM** —— 牺牲生态兼容（npm package 不能直接跑）

**这是 pivot 最大的工程门槛**。可能值得专门做一个 ADR-0017a "Plugin runtime cross-platform strategy"。

### 难题 3：协作 E2EE 的 key 管理

**问题**：
- 真 E2EE 协作 = 每个 document 一对（或一组）encryption key，**所有 collaborator 必须有 key 才能解密**。
- 邀请 = key exchange（X3DH / Sealed Sender / 简化 ECDH）。
- 撤销访问 = **rotate key + re-encrypt 整个 doc**（不能简单删 ACL row，因为对方已有 key）。
- 丢设备 = **lost forever**（除非有 recovery passphrase 或 social recovery）。

**简化路径**：
- v1 只支持"单人 E2EE 笔记本"（无协作）—— 避免 key exchange，1 个用户 1 个 master key（Argon2 from passphrase）
- v2 支持"小组 E2EE"（2-5 人，trust-on-first-add）—— 用 Matrix Megolm 协议 or libsignal-client
- 不支持开放评审 / community / 大组（>20 人）E2EE —— 性能 + 复杂度爆

**reasonable scope**：v1 single-user E2EE + v2 small-team E2EE。**放弃**"E2EE 开放评审"幻想。

### 难题 4：Yjs E2EE 的真实可行性

**问题**：
- 当前 `apps/sync-gateway/src/doc-room.ts` `backend.persist({ bytes: update.bytes })` 直接看明文 Y.Doc binary update。
- 真 E2EE Yjs 要求 server 只存 encrypted blob，client 自己合并 CRDT state。
- **挑战**：Yjs garbage collection / state vector 需要看 binary 结构 → 不能简单"加密整个 update binary"。

**现有 prior art**：
- **Jamsocket Y-sweet** —— 支持 transport-level encryption（TLS），不是 E2EE
- **Cryptpad** —— 用 ChainPad（自家 CRDT），不是 Yjs；E2EE 模式下 server 只 relay opaque blob
- **Hocuspocus extensions** —— 没有官方 E2EE extension
- **yjs-encryption (npm)** —— 第三方，~200 weekly downloads，**未 prod-grade**

**结论**：**真 E2EE Yjs 没有现成方案**。3 个路径：
1. **a. 写自家 encrypted-yjs adapter**：把 update binary 加密成 opaque blob，server 当存储用，**放弃** server-side merge 优化 → client-only merge → 50+ 协作者性能塌方
2. **b. 切换到 ChainPad-style CRDT**：放弃 Yjs 生态（y-prosemirror / y-monaco / awareness）→ **极大 cost**
3. **c. B3 私密文档放弃实时协作**：私密文档 = single-user OR small-team-with-async-sync（push/pull commits 类似 git，不实时）

**c 最务实**：私密文档 = "git-like 协作"（commit + push + pull + manual conflict），**放弃 CRDT 实时**。这是 Anytype / Logseq 的做法。

---

## 5. ADR 影响速查（pivot 后）

| ADR | 当前 Status | Pivot 影响 |
|---|---|---|
| **0001** data-model + CRDT | Accepted | **Major revision**：加 `document.encryption_mode ∈ {public, invited, encrypted}`；encrypted → client sqlite truth，server 只存 opaque blob；public/invited 走现状 |
| **0002** permission | Accepted | review log：E2EE 文档 ACL check 客户端执行（server 不知 capability） |
| **0003** tech-stack | Accepted | review log：加 Tauri / IndexedDB / sqlite client / libsodium / Argon2 |
| **0004** deploy + security | Accepted | **Major revision**：relay-only server topology；client distribution channel |
| **0006** MCP registry | Accepted | **大 review log**：区分 local-MCP vs external-MCP；私密文档限制 |
| **0008** agent runtime | Accepted (caveat) | **Major revision**：worker 变 client coordinator；agent-worker 进程降级为 "shared docs co-pilot"，B3 私密走客户端 |
| **0010** plugin API | Accepted | review log：plugin host 客户端化；与 0012 强绑定 |
| **0011** claim-evidence | Proposed | review log：E2EE 文档 claim 签名链客户端写 |
| **0012** plugin sandbox | Accepted (caveat) | **caveat 升级为 P0**：macOS / Windows real sandbox **必做**（或 WASM runtime） |
| **0013** ModelProvider | Accepted | review log：client-side resolver；用户本地保管 key |
| **0014** subdocument | Proposed | review log：E2EE 文档 subdoc 加密粒度 |
| **0015** ORCID 开放评审 | Proposed | review log：开放评审 = public docs only |
| **新 0017** Client-first runtime | **未起**（待 moratorium 解除） | 主 ADR |
| **新 0017a** Plugin runtime cross-platform | **未起** | 决定 sandbox vs WASM 路线 |
| **新 0017b** Per-document encryption mode | **未起** | 决定 B3 schema + UI |

**8 个 review log + 2 个 major revision + 3 个新 ADR** = **Phase 6+ 级别 pivot**。

---

## 6. 推荐的 Phased Pivot 路径

### Phase 5 Wave A（现在 - 进行中）— **不动**

照原计划：reviewer dogfood + quota enforcer + cancel API + AgentTimeline + Provenance reveal + Design.md surface 收尾。

**这些工作在 pivot 后全部有用**。

### Phase 5 Wave B（trigger 后）— 平行启动 **3 个 spike**

不阻塞 Wave B 主线（Claim-on-Claim Review），并行加 3 个 1-2 周 spike：

1. **Spike-1: Tauri shell + local SQLite roundtrip**（A2 → A3 桥）
   - 把现有 Next.js web 套 Tauri，验证 IPC / 本地存储 / 自动更新
   - 1 周

2. **Spike-2: Encrypted-yjs adapter PoC**（B 轴可行性）
   - 写最小 encrypted-yjs adapter：client 加密 → server opaque relay → client 解密 + merge
   - 在 proto-a-yjs-schema 沿用 stress harness 跑 5 client × 50 ops
   - 2 周
   - 输出 = "encrypted-yjs 真可行 / 不可行"决断

3. **Spike-3: 跨平台 plugin sandbox 选型**（ADR-0012 caveat 升级前置）
   - 三选一：macOS sandbox-exec real / Windows AppContainer real / WASM runtime
   - 2 周对比 + 决断
   - 输出 = ADR-0017a draft

### Phase 5 Wave C 或 Phase 6 W1-W4 — 起 **3 个新 ADR**

dogfood gate 跑通后（0012/0013/0014 promote → moratorium 解除），起：
- **ADR-0017** Client-first runtime（主 ADR）
- **ADR-0017a** Plugin runtime cross-platform（基于 Spike-3）
- **ADR-0017b** Per-document encryption mode B3（基于 Spike-2）

### Phase 6 W5-W12 — pivot 真落地

按 ADR 落地，估 6 月工程量（参考 Anytype-go 从 0 到 v1 时间线）。

---

## 7. 4 个必须用户确认的开放问题

按答案影响顺序：

### Q1：B3 per-project E2EE，还是 B2 全局 E2EE？

我推荐 **B3**（per-project mode）—— 公开论文走云协作 享 community surface，私密项目走 E2EE。
**你**：(a) B3 / (b) B2 全局 / (c) 还要再讨论

### Q2：E2EE × 外部 MCP 怎么处理？

我推荐 **C + B 兜底**：默认私密文档禁用外部 MCP，UI 给"临时允许这次"按钮。
**你**：(a) A 完全禁 / (b) B 全开启逐次授权 / (c) C 区分本地外部 / (d) C+B 兜底

### Q3：E2EE 协作 scope？

我推荐 **v1 单人 E2EE + v2 小组 E2EE（≤10 人）**，**放弃** "E2EE 开放评审"。
**你**：(a) 仅单人 / (b) 小组 ≤10 / (c) 全 scale E2EE / (d) 其它

### Q4：Yjs E2EE 的取舍？

我推荐 **c: 私密文档放弃实时 CRDT 协作**，改 "git-like push/pull commits"（参考 Anytype / Logseq）。
**你**：(a) 自家 encrypted-yjs adapter 硬上 / (b) 切 ChainPad-style 放弃 Yjs / (c) git-like async / (d) v1 只支持单人，多人 v2 再说

---

## 8. 立即可做的非阻塞动作（不等 4 问题答案）

1. **Tauri shell spike**（Spike-1）—— **0 风险 / 0 ADR 影响 / 1 周可出结果**，可以现在就开 `claude/spike-tauri-shell` 分支并行做。Phase 5 Wave A 不影响。
2. **paper-platform-landscape.md 更新** —— 加 Anytype / Cryptpad / Logseq / Standard Notes / Obsidian Sync 5 个 prior art 案例（每个 ≤ 5 句 + B/C 轴位置 + 学到什么）。**0 工程 / 半天 / 永久收益**。
3. **dogfood survey** —— 在 alpha tester 招募时（improvement-plan §五 Wave C C3）问"哪些场景你希望本地 / E2EE"，让 v1 scope 由真痛点驱动。

---

## 9. 我的诚实判断（合伙人视角）

**好的部分**：
- 方向与第一性原理 #1 / #3 / #5 / #6 / #11 强对齐
- 同类项目（Anytype / Logseq / Cryptpad）证明这条路走得通
- 现有基础设施（ollama adapter / capability gate / doc-store W7.1 / plugin install scaffold）**已经准备了一半**
- 与 Phase 5 Wave A 不冲突 —— 不需要立即停现工作

**风险部分**：
- 工程量 6-12 月（不是周级）
- 4 个技术难题没有一个是 trivial（尤其难题 4 Yjs E2EE 没有现成方案）
- 大概率最终 scope 是 **B3 + "私密文档 = single-user OR small-team async-commit"** —— 与"完整 E2EE 实时协作"幻想有距离，**这条要早跟用户对齐预期**
- 触发 ADR-0012 caveat P0 升级 = 跨平台 sandbox 必须做（这是隐藏 cost，最容易低估）

**最务实的下一动作（不需要 4 问题答案就能开始）**：
- 现在并行开 Spike-1 Tauri shell（1 周）
- 同时 update landscape.md 加 Anytype / Cryptpad / Logseq prior art（半天）
- 答 Q1-Q4 后启动 Spike-2 / Spike-3
- 等 0012/0013/0014 dogfood gate 跑通（Phase 5 Wave A/B），起 ADR-0017

**不建议**：立即停 Phase 5 Wave A 全力转 E2EE。会失去 Wave A 已积累动量 + 7 个 ADR 半完成状态 + 没有真用户痛点验证就上 6 月重构 = 触发 §5.3"先 dogfood 痛点再上大件"红线。
