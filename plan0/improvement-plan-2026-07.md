# Improvement Plan · 2026-07 —— 定位收敛 + client-first substrate 迭代

> Status: In progress · Date: 2026-07-05 · Driver: 三路系统侦察（项目状态 / 定位演化 / 代码真实度）
> 前序：`improvement-plan-2026-05.md`（已完成，历史文档）→ `phase-6-plan-stub.md`（当前 phase 承接 doc）

---

## 一、现状诊断（2026-07-05 快照）

**一句话**：定位叙事已演进到 "Night-Bridge-Day 三层等价知识产出系统"（ADR-0020）+
client-owns-truth 桌面优先基础设施（ADR-0017/0018/0019），引擎层代码已是真肌肉，
但对外与导航文档还停在两次 pivot 之前 —— **名实倒挂是当前最大张力**。

### 1.1 定位张力（侦察证据）

| # | 张力 | 位置 |
|---|------|------|
| 1 | README 仍写"面向研究者的协作论文平台"+"浏览器写论文"+ server-centric 架构图，对 tauri/desktop/triadic/vault 零命中 | `README.md` |
| 2 | ADR-INDEX 只收录到 0016，缺 0017-0020（整个 client-first pivot + Triadic 架构在导航里隐形） | `plan0/ADR-INDEX.md` |
| 3 | system-prompt 内部分层不一致：项目脉络段是论文平台时代，原理 #12/#13 已是 triadic 时代；用户画像未更新 4 角色 | `plan0/paper-platform-system-prompt.md` |
| 4 | Design.md §1 原则只列到第 11 条，缺 #12/#13 | `plan0/Design.md` |
| 5 | STATUS 顶部滞后（未覆盖 design-warmth-v2 九笔 + harden verification） | `STATUS.md` |
| 6 | CLAUDE.md §8 仍记"3 处诚实度赤字"，实际 doc-store 与 provider 已消解，仅剩 macOS/Windows sandbox 占位 | `CLAUDE.md` |
| 7 | "Wave D" 一词双关（Phase 5 closeout Wave D vs ADR-0020 Triadic Wave D-1~D-5） | 多处 |

### 1.2 代码成熟度地形（侦察证据）

- **真肌肉**：ai-runtime（5742 LoC/19 测/4 真 provider + coordinator + provenance 真写库）、
  editor-core、permissions、vault-fs（12 测最密）、doc-store、open-content、identity
- **契约骨架（by design，等 W12 gate）**：discovery-graph / bridge-layer 纯类型 SoT；
  triadic 6 页 UI 静态 skeleton（零 fetch）
- **最薄两块**：apps/desktop 最小 Tauri spike（托盘 + ollama 探针，identity/vault-fs 未接入）；
  macOS/Windows sandbox 公开披露式占位（唯一剩余诚实度赤字）

---

## 二、本轮范围（三波）

### Wave 1 · 定位收敛（文档 SoT 对齐，最高杠杆）

| 项 | 动作 |
|----|------|
| 1.1 | README.md 重写：triadic 定位 + client-first 架构（desktop 主创作 / web open-content surface），中英同等打磨 |
| 1.2 | ADR-INDEX.md 补 0017-0020：快表 + 时间线 + 依赖图 + 主题聚类，header 更新 |
| 1.3 | system-prompt 项目脉络段对齐 triadic（保留原始声音，用户画像补 4 角色） |
| 1.4 | Design.md §1 补原则 #12/#13 |
| 1.5 | STATUS.md 顶部 + §1 补 design-warmth-v2 轮次与本轮（append-only） |
| 1.6 | improvement-plan-2026-05.md 顶部加"已完成/历史文档"横幅，指向 phase-6-plan-stub + 本文档 |
| 1.7 | CLAUDE.md：§2 必读清单换入本文档、§8 地雷更新（赤字 3→1）、Wave D 双关注记 |

### Wave 2 · 核心模块升级（AI substrate）

| 项 | 动作 | 规模 |
|----|------|------|
| 2.1 | migration 0017：`principal.ed25519_public_key` + publish strict verify（缺 key 拒绝而非跳过）+ round-trip 测试 | ~0.5d |
| 2.2 | apps/desktop 真接线：Tauri commands 挂 identity（keypair 载入/签名）+ vault-fs（open/read/write/watch）+ doc-store filesystem-backend，桌面端从 spike 变 substrate | ~2-3d |

### Wave 3 · dogfood 铺路（AI 写 runbook，执行属用户）

| 项 | 动作 |
|----|------|
| 3.1 | `docs/dogfood-runbook.md`：Wave D-5 30 天 triadic dogfood 清单 + Wave B 5 criteria 步骤 + G1 三平台 binary 验收 + ADR-0013 API key round-trip 步骤 |

---

## 三、不做的事（先别做，反过度工程）

| 项 | 原因 | 复活条件 |
|----|------|----------|
| triadic 升 real（持久化/API 接入） | ADR-0020 W12 dogfood gate 明确挡住 | Wave D-5 30 天 dogfood 跑通 |
| ADR-0021/0022/0023 起草 | moratorium（feature ADR 等 W12 gate） | 同上 |
| macOS sandbox-exec 真实现 | ADR-0019 主路径是 WASM Extism（W9-W10 gate），fallback 不先行 | Extism 路径落地后仍有 npm-heavy 需求 |
| Loro 切换 / plugin marketplace / 章节 fork-merge / spatial canvas | 砍单（improvement-plan-2026-05 §四） | 各自复活条件 |

---

## 四、验收标准

1. Wave 1：`grep -ri "协作论文平台" README.md` 不再是定位主语；ADR-INDEX 收录 20 个 ADR；
   system-prompt / Design.md / STATUS / CLAUDE.md 四处一致性口径统一
2. Wave 2.1：`pnpm db:migrate db:test` PASS；缺 pubkey 的 publish 被拒绝（新测试覆盖）
3. Wave 2.2：桌面端 Tauri command 层对 identity/vault-fs 的调用有单测；`pnpm typecheck` 全绿
4. 全程：不触碰 apps/web/src 视觉层（不触发 Design.md commit gate）；commit 按
   `P6(W3): ...` 风格；分支 `claude/iteration-2026-07`
