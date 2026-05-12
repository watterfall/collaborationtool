# Phase 6 计划（stub） · Client-first pivot + Triadic follow-up + 真服务 dogfood

> Phase 5 Wave A/B/C/D (Triadic Wave D-1~D-4) 全 AI 部分交付；Phase 5
> 剩 user-driven dogfood（C1 plan0/ 重写 + C3 学术社区 + Wave D-5 30 天
> dogfood + Wave B 5 criteria 真跑）。Phase 6 是这些 dogfood 反馈落地
> 的 phase + client-first pivot 实质起点 + 4 个 Triadic follow-up ADR。≤ 1 页。

最后更新：2026-05-12（Phase 5 W9 Wave D-4 closeout 后）

---

## 〇、Phase 5 → Phase 6 接力

Phase 5 21 个 AI commit + 4 个待 user-driven dogfood：

**已交付（Phase 5 AI 部分）**

| 维度 | Phase 5 已落 | Phase 6 dogfood 反馈后必跑 |
|---|---|---|
| Wave A 自主 agent 守护 | A1 quota / A2 cancel / A3 ExecutionContext / A4 AgentTimeline 全 `real` 或 `contract` | reviewer/researcher 真 LLM round-trip 跑通后升 `real`（Wave B/D 真用） |
| Wave B claim-on-claim review | B1-B6 全交付（schema + PM mark + 5 API + finding kind + Inbox + lineage view），27+17+15+11+1+5 测 | 5 criteria 5 年差异化锚点 dogfood gate（1 paper + 5 ORCID reviewer + JWKS 验证 + 公共 view 切换 + withdraw）—— Wave C 真 paper 落地后跑 |
| Wave C 元 dogfood | C2 demo paper + C4 landing differentiation + specimen | C1 plan0/ 重写 + C3 alpha tester 邀请，用户亲自 1-2 周 + 2 周 |
| Wave D Triadic | D-1 discovery-graph + D-2 bridge-layer + D-3 InteractionMode + cross-layer ref + jsonb 侧通道 + D-4 `/triadic` 4 surface UI skeleton，全 type-only `contract` | D-5 jili 30 天 dogfood（≥50 Night + ≥10 Bridge + ≥3 Day + 6 交互流 ≥4 + 4 角色 ≥2 + 5 模式 ≥4），通过后 ADR-0020 Proposed → Accepted |

**Phase 5 user-driven 在 Phase 6 W1-W2 收尾**。

---

## 一、Phase 6 范围（待用户 kickoff 确认）

| 维度 | Phase 5 完成情况 | Phase 6 目标 |
|---|---|---|
| Client-first pivot | spec 在 `docs/superpowers/specs/` 但未实施 | **Spike-1 Tauri shell 执行**（gated 在 Wave A-C 完成后，已 unblock）+ ADR-0017 起草 |
| 内容开放粒度 | client-first spec 含 per-subdoc visibility tier | **ADR-0018 Open content mechanisms**（dual-track storage + 开放粒度 per-subdoc + DeSCI 去区块链）|
| Plugin 跨平台 | bwrap real start 仅 Linux；macOS / Windows UI 拦截兜底 | **ADR-0019 Plugin runtime cross-platform**（Tauri shell + 各 OS 沙箱适配；当前 ADR-0012 占位 → 真启动）|
| Triadic schema 落 PG | Wave D-1~D-3 type-only；W-4 UI skeleton（无 PG fetch） | **ADR-0021 discovery-graph schema migration**（Night artifact 落 PG + visibility tier ACL 接 ADR-0014 subdoc 路径）|
| Triadic Bridge 落 PG | bridge-layer type-only | **ADR-0022 bridge-layer schema migration**（4 Bridge atomic units 真存储 + 跨 layer FK + lineage 反查路径） |
| Triadic UI 真数据 | `/triadic` 4 surface 全 skeleton，无 PG fetch | **ADR-0023 triadic UI real data wiring**（per-role default surface 选择 + 真 list/create/visualize + InteractionMode 自动建议）|
| 谜题分类 reflection | 未实施 | **ADR-0024 谜题分类反思工具**（4 类 puzzle model self-label + 30 天分布 reflection UI）|
| Maintenance 真 reviewer/researcher | 路径仍 `markDone` stub | reviewer-agent 真 LLM round-trip + researcher 真 PaperQA2-style 跑通 |
| Subdoc dogfood gate | 50 客户端 + multi-subdoc routing 仍 `mock` | **真 sync-gateway 多 subdoc 路由 + snapshot-worker 增量改造 + 50 client stress**（ADR-0014 Accepted） |
| BYO model 4 endpoint dogfood | resolver 落 + UI 落，4 endpoint 真 round-trip 推 | 真 API key 跑 vLLM / Ollama / DeepSeek / OpenRouter（ADR-0013 升 `real`） |
| macOS sandbox-exec 真写 | 占位 + UI 拦截 | macOS sandbox-exec profile 真启动（视 Tauri shell 决策） |

---

## 二、必须先答的开放问题（Phase 6 kickoff 前）

| # | 问题 | 决策来源 |
|---|---|---|
| Q1 | Wave D-5 dogfood gate jili 是否真跑了 30 天？通过指标如何？ADR-0020 升 Accepted 还是 Accepted with caveat？ | dogfood 完成后 |
| Q2 | Spike-1 Tauri shell 与 ADR-0017/0018/0019 实施顺序（先 spike 还是先 ADR） | 用户决定 |
| Q3 | ADR-0021~0024 4 个 follow-up ADR 是顺序起草还是并行（Triadic schema 真落 PG 是大件） | 视 Wave D-5 反馈 |
| Q4 | Phase 6 是否包含 Phase 5+ 推迟的 reviewer/researcher 真 LLM round-trip + maintenance dogfood，还是另开 phase？ | 视 dogfood-trigger 是否激活 |
| Q5 | Wave B 5 criteria dogfood gate（需真 paper + 5 ORCID）跑通后 ADR-0016 升 Accepted —— 由 user-driven dogfood 期间完成还是单独 phase？ | 视 C1/C3 完成情况 |
| Q6 | 数据迁移路径：Phase 5 Triadic type-only artifact（jili dogfood 30 天产生的 Night artifact）如果 ADR-0020 升 Accepted 且决定落 PG，迁移到 ADR-0021 schema 是 dump+reload 还是 in-place 改造？ | ADR-0021 起草时决定 |
| Q7 | improvement-plan §四原砍清单（spatial canvas / 章节 fork-merge UI / Loro 切换 / 跨设备 storage / plugin marketplace）— 是否任何项在 Wave D-5 / Wave B dogfood 中找到复活条件？ | 视 dogfood 反馈 |

---

## 三、Phase 6 不做的事（明示）

- **大改 ADR-0020 §2 决策** —— 战略 ADR Status: Proposed → Accepted 是 Wave D-5 跑通的产物，不在 Phase 6 反向修订。若 dogfood 失败应是 Status: Superseded by ADR-XXXX（新决策），不是改 §2。
- **新 ADR moratorium 解除前不开 ADR** —— 仍维持 improvement-plan §四 moratorium 原则（除 ADR-0017/0018/0019 client-first + ADR-0021~0024 Triadic follow-up + 视具体痛点起草的 ADR）。新增 ADR 仍需"已 Proposed 真做穿"才解禁同主题新 ADR。
- **plugin marketplace（dedicated registry）** —— 仍走 GitHub Discoveries；改 dedicated registry 需要 1000+ plugin 用量 trigger。
- **跨设备 storage adapter** —— 仅在 client-first pivot Tauri shell 跑稳后才考虑（依赖 ADR-0019）。
- **章节 fork-merge UI** —— ADR-0014 subdocument dogfood 跑通后才评估；当前不复活。
- **Loro 切换** —— 仍按 ADR-0001 §8 长期方向：不主动启动，trigger 决定。
- **AI scientist 完全自主**（per ADR-0008 §5 红线）—— quota + timeout + 可中断 三件套强制；propose 默认，自主修改需明确 opt-in + 配额。

---

## 四、Phase 6 路线图节奏（粗，待 kickoff 拍板）

| Wave | 内容 | 谁做 | 工程量 |
|---|---|---|---|
| **W0** | Wave D-5 retrospective + ADR-0020 Proposed → Accepted（或 Accepted with caveat / Superseded）| AI 协助 jili 写 | 0.5 天 |
| | Wave B 5 criteria retrospective + ADR-0016 升 Accepted | AI 协助 | 0.5 天 |
| **W0.5** | **Spike-2 plan 起草** (`docs/superpowers/plans/2026-05-12-spike-2-vault-fs.md`, ~1400 行 / 12 tasks) | AI | ✅ |
| | **Spike-3 plan 起草** (`docs/superpowers/plans/2026-05-12-spike-3-plugin-runtime.md`, ~900 行 / 7 tasks) | AI | ✅ |
| **W1** | **Spike-3 plugin runtime selection execution** —— 全 7 task 完成 (`5ce6a97` merge)；ADR-0019 Proposed；hybrid runtime decision (WASM primary + per-OS native fallback) | AI | ✅ |
| | **Spike-1 Tauri shell execution**（subagent-driven 重启）—— 全 13 task 完成 (`98e3f30` merge of `d762212..1db6f37`)；apps/desktop/ Tauri 2.x 全套 (tray / notifications / .paper / deep-link / Updater) + apps/web/{desktop-bridge,local-ollama,InlineAgentMenu local-AI toggle} + GH Actions desktop-release.yml + ADR-0003 review log；code-side 全 PASS（Rust 3 mockito + TS 14 node:test）；runtime gates (binary build / remote URL smoke / notarize+sign) DEFERRED Phase 6 W2 | AI | ✅ |
| | **Spike-2 vault-fs PoC execution**（subagent-driven 重启）—— 全 12 task 完成 (`6492b36` merge of `60281ce..28c3036`)；packages/vault-fs/ 9 src + 11 test 含 5 spec §8 fixture (cold-start / external-edit / 3-way merge / sidecar 损坏 / sync 中断) + Design.md reject grep + 5-client stress + Y.Doc/PM JSON wire 兼容；**4/4 验收 PASS / 31 测全绿**；ADR-0001 §8.6 + ADR-0005 review log；subagent fix 6 处 plan API mismatch (含 plan 修复未覆盖的 3 处：yXmlFragmentToProsemirrorJSON 1-arg / Y.XmlText 必需 / 多 client 共享 seed) | AI | ✅ |
| **W2** | **ADR-0017 client-first runtime drafting**（plan0/adr/0017-client-first-runtime.md ~280 行）—— Status: Proposed | AI | ✅ |
| | **ADR-0018 open content mechanisms drafting**（plan0/adr/0018-open-content-mechanisms.md ~260 行）—— Status: Proposed；含 packages/identity/ spec | AI | ✅ |
| | **Spike-1 runtime acceptance playbook** —— docs/superpowers/runtime-acceptance/2026-05-12-spike-1-runtime-gates.md ~350 行；4 gate user-executable | AI | ✅ |
| | Phase 6 W2-W3 runtime gates 实操（G1 3-platform binary / G2 套远端 URL / G3 系统集成 / G4 notarize+sign）| **user-driven** | 1-3 周 |
| **W2 P1** | **`packages/identity/`** ed25519 + argon2id + ORCID（ADR-0018 §2.1，commit `c7af95f`）—— 6 src + 5 test files；DEFAULT_KDF_OPTS t=3/m=64MiB；canonical ORCID link payload 共享 JWS signing；**34 测 PASS** | AI | ✅ |
| **W2 P1** | **doc-store FileSystemBackend**（ADR-0017 §1.3，commit `c7af95f`）—— FileSystemDocumentHandle + cold-start 三档（sidecar→markdown→empty）+ debounced flush 双通道（sidecar 500ms / markdown 2000ms）+ DI hooks（避免 doc-store ← editor-core ← vault-fs 循环）；**13 测 PASS**；doc-store 17→30 测 | AI | ✅ |
| **W2 P2** | **migration 0016 + `packages/open-content/`**（ADR-0018 §2.2-§2.3，commit `7e6c730`）—— 4 entity 表 + provenance_merkle_log + 1 enum + canonical-payload (sorted-key sha-256) + merkle-log (4 invariants 含 fork detection) + Drizzle schema 同步；**33 测 PASS** | AI | ✅ |
| **W2 P2b** | **F4 publish service + /api/publish + open-content-feed**（ADR-0018 §2.4-§2.5，commit `71c8228`）—— validatePublish 9 reject reasons + 4 entity content shape validators + parseFeedFilter + validateOpenQuestionAnswer + 单端点 POST /api/publish 6-step flow；**37 测 PASS** | AI | ✅ |
| **W2 P3** | **5 ADR Phase 6 review log + Merkle invariant 4 fork detection**（commit `2569422`）—— ADR-0001 §8.7 PG-truth→client-truth 正式反转 + ADR-0003 3 项新 stack (Tauri + @noble 避 libsodium + WASM Extism) + ADR-0008 two-tier agent + ADR-0011 signed provenance + ADR-0015 §7.4 open question via ORCID | AI | ✅ |
| **W3-W4** | ADR-0018 open content mechanisms 起草 + Proposed | AI | 0.5 天 |
| | ADR-0019 plugin runtime cross-platform 起草 + Proposed（与 Tauri shell 联动）| AI | 0.5 天 |
| **W5-W6** | ADR-0021 discovery-graph schema migration（Night artifact 落 PG，含 visibility tier ACL 接 ADR-0014 subdoc 路径）| AI | 1-2 天 |
| | ADR-0022 bridge-layer schema migration | AI | 1-2 天 |
| **W7-W8** | ADR-0023 triadic UI real data wiring（4 surface 接 PG + per-role default + InteractionMode 自动建议）| AI | 1-2 天 |
| | ADR-0024 谜题分类 reflection UI | AI | 1 天 |
| **W9-W10** | reviewer/researcher 真 LLM round-trip（reviewer 单 doc fixture / researcher PaperQA2-style）| AI | 2-3 天 |
| | maintenance dogfood 真 1 周自动跑（pgboss schedule + 报警）| AI | 1 天 |
| **W11-W12** | Phase 6 closeout 矩阵 + Phase 7 plan stub 起草 | AI | 1-2 天 |

**总 AI 工程量**：~ 15-25 天（含 spike-1 5-7 天）；user-driven 部分（Wave D-5 30 天 + Wave B / C1 / C3 dogfood）与 Phase 6 并行。

---

## 五、Phase 6 期间技术雷达

| 维度 | 当前状态 | Phase 6 关注 |
|---|---|---|
| Tauri stable | 2.x stable | 2026 中 Tauri 2.x 稳定性 + bun bundler 联调 |
| Yjs / Loro / Automerge | Yjs 主线；Loro 1.x / Automerge 3.x 仍在评估 | Loro 在 Tauri 客户端 native 性能 vs WASM 评估 |
| ORCID 真 OAuth | sandbox.orcid.org `contract` | 升 `real` 通过 Wave B dogfood criteria #3 |
| 4 ModelProvider 真 round-trip | `contract` × 4 wire | Wave 6 W9-W10 跑通升 `real`（取决 API key 可用性）|
| bwrap real start | Linux only `contract` | 视 Tauri shell 决策 + Phase 6 ADR-0019 评估替代 sandbox 路径 |
| PG schema 演化 | Drizzle migration 0001-0015 全 idempotent | ADR-0021/0022 引入 ~3 个新表（night_artifact / bridge_artifact / cross_layer_reference），migration 0016+ |

---

## 六、Phase 6 kickoff 前的准备清单（待办）

- [ ] **Wave D-5 retrospective**：jili 30 天 dogfood 数据汇总（Night/Bridge/Day 数量 + 6 交互流分布 + 4 角色切换次数 + 5 模式分布 + 真实痛点 list）
- [ ] **Wave B retrospective**：5 criteria 跑通报告（如有真 paper / ORCID reviewer 进展）
- [ ] **5 个 night-science 大文件 jili 通读**：Night.md 87KB / Night_Science_Cases_Expanded.md 75KB / Night_Science_Enhanced_PPT.md 46KB / pptx / pdf —— 决定是否需修订 ADR-0020 review log（per ADR-0020 §5 关键反对意见 3）
- [ ] **Phase 5 状态债清零**：确认 STATUS §1 closeout matrix + 8 既有 ADR review log + Phase 6 plan stub（本文件）全 commit
- [ ] **MEMORY.md 同步**：记录 Phase 5 closeout + Phase 6 kickoff 时间点 + 两个"Wave D"命名歧义已通过 `triadic_wave_d_progress.md` memory 解决
- [x] **`docs/superpowers/specs/` 内容核对**：`2026-05-11-client-first-pivot-design.md`（420 行 / 16 节）已 commit；ADR-0001 §5.A 反转决策 + 16 ADR 影响表 + 10 dogfood gate 全在
- [x] **Spike-1 plan 状态确认**：`docs/superpowers/plans/2026-05-11-spike-1-tauri-shell.md` 1685 行 / 13 tasks / subagent-driven mode 已锁
- [x] **Spike-2 plan 起草**：`docs/superpowers/plans/2026-05-12-spike-2-vault-fs.md` 12 tasks（packages/vault-fs/ scaffold + emit/parse markdown + sidecar IO + watcher + drift + 3-way merge + 5 fixture + stress + reject grep + ADR review log + 报告）
- [x] **Spike-3 plan 起草**：`docs/superpowers/plans/2026-05-12-spike-3-plugin-runtime.md` 7 tasks（spec + macOS sandbox-exec PoC + WASM Extism PoC + Windows AppContainer stub + trade-off matrix + decision + ADR-0019 draft + 报告）
- [ ] **3 spike 执行前 toolchain 检查**：cargo 1.95 ✅ / Node 26 ✅ / pnpm 11 ✅ / **tauri CLI 未装**（spike-1 前 `cargo install tauri-cli`）/ Extism CLI（spike-3 前 `brew install extism/extism/extism` 或 `cargo install extism-cli`）

---

## 七、参考

- `plan0/improvement-plan-2026-05.md`（Council 评审 + §三 Wave A-D + §十二 Night-Bridge-Day Pivot + §四原砍清单 + ADR moratorium）
- `plan0/adr/0020-night-bridge-day-triadic-architecture.md`（战略 ADR，§2.7 路线 + §6 Phase 5 review log）
- `plan0/adr/0001/0002/0008/0010/0011/0014/0015/0016`（Phase 5 Triadic review log 已追加，本笔同步）
- `plan0/phase-{2,3,4}-plan-stub.md`（前 phase 模板）
- `docs/superpowers/specs/`（client-first pivot spec，ADR-0017 起草前必读）
- memory `client_first_pivot_2026_05.md`（pivot 方向锁定 2026-05-11）
- memory `spike1_execution_queued.md`（Tauri shell spike，subagent-driven 模式锁定）
- memory `triadic_wave_d_progress.md`（Triadic Wave D-1~D-4 + 两个 "Wave D" 命名歧义）
