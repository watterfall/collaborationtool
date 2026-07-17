# Improvement Plan · 2026-08 —— Vault-native Triadic 统一升级（路线 A）

> Status: In progress · Date: 2026-07-18 · Driver: 三路系统调研（代码真实度审计 + 2026 年中外部格局刷新 + 结构性死锁诊断）
> 前序：`improvement-plan-2026-07.md`（Wave 1/2/3 已完成）→ 本文档
> 决策：项目所有者 2026-07-18 拍板路线 A（三选一，见 §二）

---

## 一、现状诊断（2026-07-18 快照）

**一句话**：底层技术赌注全部站得住，差距在"接线而非造件"；真正需要动底层的只有一件事——
**两次 pivot（client-first + triadic）从未在数据模型层整合**，必须把 triadic 从"计划落 PG"
改为"原生长在 vault"，同时解开 dogfood 死锁。

### 1.1 三个结构性发现

| # | 发现 | 证据 |
|---|------|------|
| 1 | **dogfood 死锁**：runbook 指定的 30 天 dogfood 入口是 `/triadic` 零持久化静态 skeleton；gate 挡住 triadic 升 real，dogfood 又需要真工具，互相锁死 | `docs/dogfood-runbook.md` §1 "操作入口" vs `triadic/discover/page.tsx:4-5` 自陈 "No DB fetching" |
| 2 | **两次 pivot 未整合**：phase-6 stub 计划 Night artifact 落 PG（ADR-0021/0022），直接违背 client-first 原则 #1（client 文件是权威）与 Night 隐私承诺（"夜科学需要未被监视的空间"）；client-first spec 中 night/triadic 零命中 | `phase-6-plan-stub.md` §一 vs `paper-platform-system-prompt.md` 原理 #1；`grep -i night docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` = 0 |
| 3 | **substrate 无消费者**：vault-host IPC / identity / doc-store filesystem 全真全测试绿，但 `vault-host-bridge.ts` 调用方 = 0（"有发动机没方向盘"） | `grep vault-host-bridge apps/web/src` 仅命中自身 |

### 1.2 代码真实度审计（2026-07-18，subagent 全文另存对话记录）

- **一条真脊柱**：web TipTap 编辑器 → sync-gateway → snapshot-worker → PG + 导出 / agent invoke / 维护扫描——真实可跑
- **三圈契约外壳**：triadic UI（纯静态，migration 零 triadic 表）、desktop vault（引擎真、UI 没接）、跨平台 sandbox（占位）
- **e2e 名不副实**：19 个测试中 ~18 个是"读源码断言契约"，真浏览器行为测试仅 1 条（two-author MVP）
- **Yjs 耦合面**：doc-store `DocumentHandle` 泄漏 Y 类型（`types.ts` yDoc escape hatch + getText/getMap 返回 Y 类型）；vault-fs 纯 y-prosemirror 原生；换引擎 ≈ 3-4 周且不增真实度
- **杠杆排序**：① 接通 vault UI（5-8 天，最高 ROI）② triadic 单 kind 垂直切片（4-6 天）③ 真脊柱 e2e（5-7 天）

### 1.3 2026 年中外部格局刷新（subagent 调研，关键来源见对话记录）

| 技术赌注 | 判断 | 一句理由 |
|---|---|---|
| Yjs | **KEEP** | Yjs 14 正做 Attributed Version History + Track Changes（正中原理 #11）；Loro binding 无生产案例 + 10× bundle |
| Tauri 2.x | **KEEP** | 2026 新桌面项目默认选择；内容型 app 甜区 |
| Extism WASM | **KEEP + WATCH** | "WASM 沙箱跑第三方插件"已是行业标准；长期盯 Component Model + WASI 0.3，插件接口按 WIT 心智设计留退路 |
| 三层定位 | **KEEP** | "论文之前的产出作为一等公民"2026 年中仍是空位；Prism 无数据所有权、Curvenote SCMS 止步已完成工作 |
| 去区块链 | **KEEP** | DeSci 仍 crypto/token 重绑；ed25519 + Merkle 是对的非链替代 |
| provenance 容器 | **REPLACE→C2PA** | C2PA + 内嵌 W3C VC 已是全球事实标准 + 部分司法辖区法定要求；ed25519/Merkle 作签名后端不冲突 |
| Node sidecar 打包 | **ADJUST** | Deno compile（唯一真自包含）为主、Bun compile 备选；Node SEA 太受限；注意 +90MB 包体税 |
| Night 捕捉 UX | **ADJUST** | 参照 Heptabase（空间 card）+ Tana（typed node）+ NotebookLM（行级 citation）；别做成通用 markdown 笔记 |
| Day 层组件化元数据 | **ADJUST (later)** | 对标 Curvenote SCMS + CrossRef/ORCID/DataCite + Octopus 8 段式，防自造格式 |

---

## 二、路线决策（2026-07-18 拍板）

三选一，所有者选 **A**：

- **A（选定）· Vault-native Triadic 统一升级**：Night/Bridge artifact 原生长在 `~/MyVault`
  （markdown + frontmatter 按 discovery-graph 类型约束 + Yjs sidecar），桌面端是 Night 捕捉
  主入口，PG 只存被显式分享/发布的投影。dogfood 工具先行，ADR promote 仍守 gate。
- B（否决）· 按原 phase-6 stub 落 PG：最快"有数据"，但私密夜间思考进服务器 DB，与
  client-first 和 Night 隐私正面冲突；桌面 substrate 继续闲置。
- C（否决）· 彻底重构底层（换 CRDT 等）：两路调研共同否定——3-4 周等价件替换不增真实度；
  仅保留 doc-store 抽象收敛（并入 Wave A3 顺手做）。

### 治理修正（本节即修正记录）

1. **improvement-plan-2026-07 §三第一行修订**："triadic 升 real（持久化/API 接入）挡在
   W12 dogfood gate 后" → "**dogfood 最小工具集先行；ADR-0020 Proposed → Accepted 仍需
   30 天 dogfood 通过**"。Gate 从"挡工具"改为"挡结论"，死锁解除。
2. **ADR-0021 改向**：起草为 "discovery-graph **vault-native** 存储"（替代 stub 中"落 PG"
   方案）；Octopus.ac 8 段式 micro-publication 作 prior art 精读输入。ADR-0021~0024 本就在
   moratorium 例外清单（phase-6 stub §三）。
3. phase-6-plan-stub §一 "Triadic schema 落 PG" 两行以本文档为准（stub 不改，append-only）。

---

## 三、本轮范围（四波）

### Wave A1 · 接通 vault UI（最高 ROI，~5-8 天）

| 项 | 动作 |
|----|------|
| A1.1 | `apps/web` 新增 vault surface（desktop-only，Tauri 环境检测）：打开 vault / 列文档 / 打开文档 |
| A1.2 | 编辑器挂 vault-host：`doc.open → state → applyUpdate → flush` 真 round-trip（vault-host-bridge 首个真实调用方） |
| A1.3 | `vault-host://event` 监听接入（外部编辑侦测 → UI 提示） |
| A1.4 | 单测 + typecheck + Design.md §11 reject grep 全过 |

### Wave A2 · ADR-0021 改向起草 + thought 垂直切片（~5-7 天）

| 项 | 动作 |
|----|------|
| A2.1 | ADR-0021 起草（vault-native 存储契约：frontmatter schema + `.vault/` 布局 + 分享投影路径）Status: Proposed |
| A2.2 | thought 单 kind 端到端：桌面捕捉 UX（Tana typed-node 范式）→ vault 落盘 → 本地 provenance 记录 |
| A2.3 | 剩余 5 Night kind 留同构复制（dogfood 期间 AI 并行做，不阻塞 dogfood 开跑） |

### Wave A3 · 真脊柱 e2e + 抽象收敛（~5-7 天）

| 项 | 动作 |
|----|------|
| A3.1 | 一条真行为 e2e：web 编辑 → gateway → snapshot → PG → 导出 |
| A3.2 | vault 落盘往返 e2e（A1 产物防腐） |
| A3.3 | doc-store 三个 Y.Doc 直穿点收敛 + getText/getMap 返回值抽象化（引擎可换性保险，~2-3 天） |

### Wave A4 · 格局修正三小件（~3-4 天）

| 项 | 动作 |
|----|------|
| A4.1 | C2PA + W3C VC 容器方向写进 ADR-0018 review log（本轮只定方向不实现） |
| A4.2 | sidecar 打包 Deno compile spike（量化 +90MB 对总包体冲击，产 decision memo） |
| A4.3 | nightly verify-merkle-log worker（挂账已久，~1-2 天） |

### → dogfood 开跑

Wave A1+A2 完成即可开跑 30 天 dogfood（runbook §1 操作入口改为桌面 vault surface）；
AI 在 dogfood 期间并行 A2.3 / A3 / A4。

---

## 四、不做的事（先别做，反过度工程）

| 项 | 原因 | 复活条件 |
|----|------|----------|
| 换 CRDT 引擎（Loro/Automerge） | 3-4 周等价件替换，不增真实度；Yjs 14 attributed history 在路上 | 真实 dogfood 痛点 + Loro PM binding 生产就绪 |
| C2PA 完整实现 | 本轮只定方向；publish 无真实流量 | open-content 有真实发布流量 |
| macOS/Win sandbox 真实现 | ADR-0019 主路径是 Extism；fallback 不先行 | Extism 落地后仍有 npm-heavy 需求 |
| Day 层 SCMS 式组件元数据 | 等 dogfood 反馈 | dogfood 中出现组件级 cite 痛点 |
| spatial canvas 完整版 | 仍在砍单；Heptabase 仅作 Night UX 参照 | improvement-plan-2026-05 §四原条件 |
| Bridge kind 垂直切片 | Night thought 先行验证模式 | thought 切片跑通 + dogfood 第 1 周反馈 |

---

## 五、验收标准

1. **Wave A1**：桌面 app（或 Tauri dev webview）能打开真实 vault、列出文档、编辑落盘
   `~/MyVault/*.md`；`vault-host-bridge.ts` 有真实调用方；外部编辑触发 UI 侦测；
   `pnpm typecheck` 全绿 + Design.md reject grep 0 命中
2. **Wave A2**：能创建 thought Night artifact 并以 markdown + frontmatter 落 vault，
   带 provenance 记录；ADR-0021 Status: Proposed
3. **Wave A3**：≥ 2 条真行为 e2e 在 CI 可跑；doc-store 公开 API 无裸 Y 类型泄漏（escape hatch 显式标注除外）
4. **Wave A4**：ADR-0018 review log 有 C2PA 方向条目；Deno compile decision memo 落
   `docs/superpowers/`；verify-merkle-log worker 有真 ed25519 verify + 测试
5. **总闸**：dogfood 30 天可在真工具上开跑（runbook §1 入口更新）；ADR-0020 promote
   仍以 dogfood 结果为准，本轮不动其 Status

---

## 六、参考

- 代码真实度审计 + 2026 外部格局刷新：2026-07-18 会话内 subagent 报告（关键结论已录 §1.2/§1.3）
- `plan0/adr/0020-night-bridge-day-triadic-architecture.md`（战略 ADR，本轮不动 Status）
- `docs/dogfood-runbook.md`（§1 操作入口待 Wave A2 后更新）
- `plan0/improvement-plan-2026-07.md`（§三第一行被本文档 §二治理修正 1 修订）
- `plan0/phase-6-plan-stub.md`（§一 triadic 落 PG 两行以本文档为准）
