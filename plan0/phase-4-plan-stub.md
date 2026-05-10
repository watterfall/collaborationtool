# Phase 4 计划（stub） · Dogfood gates + Plugin marketplace + Subdocument scale + Open peer review

> Phase 3 W1-W7 backend + 2 ADR (0012/0013 Proposed) 全部交付；Phase 4
> 的核心是把"Phase 3 推迟到真服务测"的 dogfood gate 跑通，并启动
> §三"Phase 3 不做的事"清单（章节级 fork/merge / 50+ 公开同行评审 /
> 跨设备同步 / Loro 切换评估）。≤ 1 页。

最后更新：2026-05-10（Phase 3 closeout）

---

## 〇、Phase 3 → Phase 4 接力

Phase 3 8 commits + 4 closeout commits 的状态：

**已交付（backend / 代码 / schema）**

| 维度 | Phase 3 已落 | Phase 4 必跑 |
|---|---|---|
| Source ingestion | source + source_extraction PG 表 + plugins/source-extractor scaffold | 真 PDF.js / readability ingestion 联调 + Source Reader UI |
| Knowledge maintenance | maintenance_finding PG 表 + scan job descriptor | pgboss `maintenance-scan` queue 真跑 + 6 类 finding 真生成 + dashboard UI |
| Plugin sandbox (ADR-0012) | plugin_install PG 表 + capability 提示设计 | bwrap 真启动 + capability deny e2e + install API 路由（Linux host） |
| Coordinator (W6) | handoff types + dispatch helpers + agent_job.parent_job_id | LLM-driven dispatch loop（plugins/coordinator-agent 真跑）+ async handoff 子 job 真插入 |
| BYO model (ADR-0013) | 4 wireFormat 全 adapter + user_model_pref + document_model_override | 真 endpoint round-trip（vLLM / Ollama / DeepSeek / OpenRouter）+ settings UI + plugin manifest prefers_provider |
| Draft Composer (W3) | 推迟（dogfood-trigger） | dogfood 1-2 周后决定是否做（user 哲学：不痛不做） |
| Spatial canvas (W8) | 推迟 | spike report + 是否做的决策 |

**Phase 3 推迟项收尾在 Phase 4 W1-W2**。

---

## 一、Phase 4 范围（待用户 kickoff 确认）

| 维度 | Phase 3 完成情况 | Phase 4 目标 |
|---|---|---|
| Plugin 第三方装载 | schema 就位 | bwrap 真隔离 + UI install + 真 third-party plugin（github fixture）装载 e2e |
| Coordinator agent | scaffold + dispatch helper | LLM-driven 跨多 agent 真跑（goal: "把这一节改投 Nature 风格 + 补全所有引用 + 评审"）|
| BYO model | 4 adapter + schema | 4 endpoint 真 round-trip 实测 + tool-use 兼容矩阵 + UI |
| Maintenance scan | schema | pgboss queue + 6 类 finding 真生成 + dashboard + 1 周自动跑 |
| 50+ 协作者 | Phase 3 推迟（subdocument） | **Yjs subdocument 章节级拆分** + 50 客户端 stress test + cross-doc reference sync |
| 章节级 fork/merge | 不做（subdocument 跑稳前） | **章节级 fork → 独立编辑 → merge 回主文档**（subdocument 跑稳后启用）|
| 开放同行评审 | 不做（reputation 系统前） | **开放评审 / public peer review**（受 ORCID + signed reviews 控制；reputation 推 Phase 5）|
| 跨设备同步 | 不做 | **跨设备同步 + 用户挂自己 storage backend**（user-installed MCP server 已就位作前置）|
| Loro / Automerge 3 | 不做 | **Loro 1.0 / Automerge 3 切换评估**（spike + ADR review 决定是否切）|
| Plugin marketplace | 不做（GitHub-discovery only） | **GitHub Discoveries / 跑稳后才考虑 dedicated registry**（Phase 4 不商业化） |
| Spatial canvas | 推迟 | spike + 是否做（同 Draft Composer，dogfood-trigger）|

---

## 二、必须先答的开放问题

### 2.1 Subdocument 拆分粒度

essay §16 多人 vault 模型 + ADR-0001 §6 long debt 都列了 subdocument。

**待答**：
- 拆分粒度：章节（heading-1）？任意 heading？block-set 用户手动 group？
- subdocument 之间的 cross-reference（同一 figure 在 ch1 引用 ch3 出现）
  如何 sync？Y.Doc rootMap 共享 vs subdocument 独立 Y.Doc？
- 拆分时机：自动（章节字数 > 阈值）vs 手动（用户主动 split）？
- ACL 粒度：每个 subdocument 独立 ACL 还是父 doc 继承？

### 2.2 章节级 fork / merge UI

**前置**：subdocument 拆分跑稳。fork = subdocument 复制；merge = revision-stream
跨 subdocument。
**待答**：
- fork 时 author 不变（contribution stream）还是新建 author（branch）？
- merge UI 是 ADR-0009 既有 RevisionInbox 复用还是新建 BranchMerge view？
- conflict 解决：fork 期间 base 改 + fork 内改 → 双向 rebase 还是 hybrid？

### 2.3 开放同行评审

essay §17 + §11.5 反对锁定但要 reputation。Phase 4 先做 ORCID-signed review
不做 reputation score（Phase 5 启动 reputation）。
**待答**：
- 评审是 annotation_thread{kind:'reviewer-note'} 模型的延伸还是新表 review？
- 公开 vs 邀请：默认私有；user 可 publish（生成 readonly URL）；review 可 public
- author 接受 vs 拒绝某 review 的 UI；rejected review 是否仍 visible 给读者？

### 2.4 跨设备同步 + 用户 storage backend

ADR-0011 §三 "用户挂自己 MCP server" 就位为前置；Phase 4 加用户挂自己
storage（Drive / S3 / iCloud / Synology）作 Y.Doc 持久化 backend。
**待答**：
- y-sweet body backend 抽象（既有）还是 plugin 化（让用户写 storage adapter）？
- 跨设备同步是 multiplayer Y.Doc（同一时刻多设备改同一 doc）还是 archival
  sync（后台 push pull，单 active device）？

### 2.5 Loro / Automerge 3 切换评估

Phase 2.5 spike report 已写：Phase 3 期间 Loro 1.0 未发；2026 年初 Loro
1.0 / Automerge 3 stable 已发布。
**待答**：
- 切 Loro：subdocument 模型对齐度？rich-text PM 集成成本？
- 切 Automerge 3：相比 Yjs 1.0 的具体收益？
- 不切：明确写 ADR review log 锁定 Yjs through Phase 5

### 2.6 Spatial canvas spike

essay §10.3 研究地图。Phase 3 推迟。
**前置**：Phase 4 W1 dogfood 1-2 周后决定是否启动。
**待答**：
- 视觉对象：是 PM 节点扩展还是独立 canvas store？
- 跨 doc canvas（researcher 跨 source）vs doc-internal（一篇 paper 内部
  argument map）？

---

## 三、Phase 4 不做的事（明示）

- **Reputation score / 评审者积分系统**（推 Phase 5；Phase 4 仅 ORCID
  identity + signed review）
- **Plugin marketplace 商业化 / 收费**（推 Phase 5+；Phase 4 仅 GitHub-
  discovery + git URL install）
- **真 cloud SaaS 部署**（推 Phase 5；Phase 4 仍 self-host 主线，docker-
  compose + 一键安装）
- **Mobile app**（推 Phase 5+；Phase 4 仍是 web 主线 + responsive 不做
  native）
- **多语言模型本地化 prompt（中文 / 日文 native LLM tuning）**（推
  Phase 5）

---

## 四、Phase 4 路线图节奏（粗，待 kickoff 拍板）

预估 8-10 周（比 Phase 3 8 周略多，因 subdocument + dogfood gate 是大件）：

- **W1**：Plugin sandbox dogfood gate（bwrap + capability deny + 真 third-party
  plugin 装）→ ADR-0012 promote Accepted
- **W2**：BYO model dogfood gate（4 endpoint round-trip + settings UI +
  manifest prefers_provider）→ ADR-0013 promote Accepted
- **W3**：Coordinator agent 真 LLM dispatch loop（plugins/coordinator-agent
  + apps/agent-worker 子 job 插入 + 1 个真实 multi-agent 场景跑通）
- **W4**：Maintenance scan 真跑（pgboss queue 起；6 类 finding 各 1 个
  fixture；dashboard UI）+ Source Reader UI 第 1 版（PDF.js 单 source）
- **W5-W6**：Yjs subdocument 拆分 + 50 协作者 stress + cross-reference sync
- **W7**：章节级 fork / merge UI（subdocument 跑稳后；ADR-0009 复用）
- **W8**：开放同行评审 v1（ORCID-signed review；annotation_thread 扩展 vs
  新表决策）
- **W9**：跨设备同步 + 用户挂 storage backend
- **W10**：Phase 4 验收 e2e（4 个 essay §13 真实场景 + dogfood report）+
  Loro / Automerge 3 ADR review

具体 D-list 在 Phase 4 kickoff 时拉满。

---

## 五、Phase 4 期间技术雷达

继承 Phase 3：

- **Loro 1.0 / Automerge 3** — 已发布，W10 review log 写决策
- **WASM target plugin** — Phase 4 W1 sandbox 验收后再评估（admin 可
  装 WASM target plugin 是 ADR-0012 §3.3 长期债）
- **prosemirror-changeset 升级** — 跟 ProseMirror 1.x 主线
- **better-auth ORCID 集成** — Phase 1 推到 Phase 1.5 → 推到 Phase 4 W8
  开放评审需要

---

## 六、Phase 4 kickoff 前的准备清单（待办）

- [ ] Phase 3 closeout 4 commit landed
- [ ] Phase 3 推迟 6 项（W3 Draft Composer / W8 spatial / 6 plugin 真 LLM /
      bwrap / Linux 部署 / Real reviewer-researcher 跑通）逐项决定 Phase 4
      W1-W4 接力 vs 继续推
- [ ] 用 1-2 周 dogfood Phase 3 完整流程（Source ingestion → claim 抽取 →
      maintenance scan → coordinator dispatch）找 gap
- [ ] essay §13 4 个真实场景各跑 1 次找新 gap
- [ ] Loro 1.0 + Automerge 3 release notes 看一遍
- [ ] 选定 ORCID 集成时机（W8 启动 vs Phase 1.5 之后立刻）
