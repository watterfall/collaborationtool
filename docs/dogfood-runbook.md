# Dogfood Runbook —— ADR promote 的人工验收手册

> AI 铺路，执行属项目所有者（jili）。每个 gate 跑通后：改对应 ADR 文件头
> `Status:` + 末尾追加 review log + STATUS.md §2 表 + ADR-INDEX §1 快表。
> 生成日期：2026-07-05（improvement-plan-2026-07 Wave 3）。

---

## 1. ADR-0020 Wave D-5 · 30 天 Triadic dogfood（最高优先——定位验证）

**目的**：验证 Night-Bridge-Day 三层等价不是纸上架构，而是 jili 自己真实工作流。

**节奏要求（每周，连续 30 天）**：
- [ ] ≥ 5 个 Night artifact（thought / question / metaphor / sketch / contradiction / thought-experiment 任意组合）
- [ ] ≥ 2 个 Bridge artifact（analogy-mapping / hypothesis-formalization / concept-prototype / design-fiction）
- [ ] ≥ 1 次 Day promotion（Night/Bridge 内容进入论文 / 代码 / 数据产出）

**30 天累计要求**：
- [ ] Night 总量 ≥ 50 · Bridge 总量 ≥ 10 · Day promotion 总量 ≥ 3
- [ ] 6 种 InteractionMode 至少触发 4 种（hypothesis-output / anomaly-input / constraint-transfer / metaphor-bridge / question-return / method-transfer）
- [ ] 4 角色 surface 切换 ≥ 2 次（Explorer / Bridge-builder / Validator / Connector）
- [ ] 5 创意触发模式分布 ≥ 4 种（metaphor / contradiction / reframe / cross-domain / thought-experiment）

**操作入口**：`apps/web` `/triadic` 六页（当前为 contract-tier skeleton + jsonb 侧通道）。
**记录**：每周在 `plan0/dogfood-log/`（首次创建）追加一篇周记：数量 + 触发的交互模式 + 摩擦点。
**通过后**：ADR-0020 Proposed → Accepted；解除 ADR-0021/0022/0023（discovery-graph / bridge-layer schema / triadic UI）moratorium，契约层升 real。
**失败信号**（诚实记录）：连续 2 周达不到节奏 → 回到 ADR-0020 §4 反思架构假设，不硬凑数。

---

## 2. ADR-0016 Wave B · Claim-on-Claim Review 真跑

- [ ] 1 篇**双语** paper（真实内容，非 lorem）
- [ ] ≥ 10 个 claim 节点（绑 evidence）
- [ ] 5 位真 ORCID reviewer（sandbox.orcid.org 或真 ORCID）
- [ ] 每个 claim ≥ 3 个 verdict + 至少 1 个 challenge with evidence
- [ ] 公共 review lineage DAG 正确渲染
- [ ] withdraw 流程正确（mark-only，不删历史）

**通过后**：ADR-0016 Proposed → Accepted；同时给 ADR-0015 补真 ORCID OAuth 回跳 caveat 消解。

---

## 3. ADR-0017 · Phase 6 W2-W3 runtime gates（client-first）

- [ ] **G1 三平台 binary**：GH Actions `desktop-release.yml` 真跑 Linux / macOS / Windows 三平台构建产物；下载安装各自能启动
  - 已知 DEFERRED：macOS notarize + Windows signing——gate 只要求能构建能跑，签名公证另计
- [ ] **G3 `.paper` 文件关联**：三台机器（或三 OS 虚拟机）双击 `.paper` 文件唤起 desktop app
- [ ] 套远端 relay URL smoke：desktop 连远端 sync-gateway 能同步
- [ ] 通过后补 ADR-0001 §5.A formal revision review log（"PG truth" → "PG replicated cache"）

**通过后**：ADR-0017 Proposed → Accepted。

---

## 4. ADR-0013 · ModelProvider 4 endpoint 真 round-trip（消 caveat）

前置：真实 API key（不入库，环境变量注入）。

- [ ] anthropic：`ANTHROPIC_API_KEY` → 真实补全 round-trip
- [ ] openai-compat：任一兼容端点（如 DeepSeek / Moonshot）→ round-trip
- [ ] ollama：本机 `ollama serve` + 任一小模型 → round-trip（desktop 端有现成探针 `apps/desktop/src-tauri/src/commands/ollama.rs`）
- [ ] custom-http：自定义 endpoint fixture → round-trip

**通过后**：ADR-0013 "Accepted with caveat" → Accepted（去 caveat），STATUS §2 对应行更新。

---

## 5. 其余挂账 gate（顺手清单，不阻塞上面四项）

| Gate | 内容 | 前置 |
|---|---|---|
| ADR-0012 | bwrap 真启动 + capability deny e2e | Linux host |
| ADR-0008 | 端到端真 multi-agent goal（真 LLM + crossref MCP） | API key + `CROSSREF_MCP_COMMAND` |
| ADR-0014 | 50 客户端 stress + cross-doc reference 真同步 | 跑 `pnpm proto-a:stress` 加规模 |
| ADR-0018 | G4 open question 陌生人闭环 + G8 DOI mint + Merkle 完整 | Phase 6 W6-W7 落地后 |
| ADR-0019 | G7 三 OS plugin 安装 + spawn + secret-reject | Phase 6 W9-W10 Extism 落地后 |
| Phase 5 C1 | 用本平台重写 plan0/（元 dogfood） | 无——随时可开始 |
| Phase 5 C3 | alpha tester 邀请 | C1 之后 |

---

## 6. 记录纪律

每个 gate 跑完（无论过/不过）：
1. ADR 文件末尾追加 review log（commit hash + 测试证据 + 残余 caveat）
2. STATUS.md 顶部"最后更新"行 + §2 表同步
3. 失败也写——失败记录是下一轮迭代的输入，不是丢脸的事
