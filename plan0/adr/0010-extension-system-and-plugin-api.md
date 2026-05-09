# ADR-0010: 扩展系统边界 + Plugin API + Skill 元数据扩展 + Dogfood 路径

- **Status**: Proposed
- **Date**: 2026-05-09
- **Phase**: 2 W1（headline）
- **Deciders**: tech-lead
- **Gated on**: Phase 2 W3 末 dogfood 硬 gate（citation agent 切到本 ADR
  plugin API 可跑，否则停 W4 重新设计）

---

## 1. Context

### 1.1 为什么这是 Phase 2 W1 头号 ADR

`plan0/paper-platform-system-prompt.md` 第 12 / 13 / 14 / 15 条第一性原理 +
§六 "扩展系统设计草图" + 反模式 §348 反复强调：

> 平台优于产品。任何能力优先考虑作为插件 / skill / MCP server 实现，而不是
> 塞进核心。"先做 MVP 再加扩展系统"是错的——加扩展系统几乎一定要重构核心。

`plan0/paper-platform-landscape.md §六/七` 给出具体借鉴范式（VSCode capability
+ Obsidian 简单加载 + Cursor `.cursorrules` + Anthropic Skills 自然语言定义 +
shadcn registry 轻量分发 + Figma iframe sandbox）。

Phase 1 D7-D16 落地了**ADR-0001 数据模型 / ADR-0002 capability 权限 / ADR-0003
技术栈 / ADR-0004 部署 / ADR-0005 render API 边界**——这些是平台的"内核
基础"，但**显式的 kernel vs plugin 边界、plugin manifest、按需 skill 加载
dispatch、用户安装 plugin 的流程都还没立过 ADR**。

具体落差（review-project-goals-TpFuH 诊断）：

- `packages/ai-runtime/src/agents/{citation,inline-editor}.ts` **hardcode** 在
  ai-runtime 包内，第三方插件不能用同一接口注册
- `skills/_registry.json` + `skills/<id>/SKILL.md` 已经存在但元数据**缺
  `trigger_patterns` / `provides_tools`**，AI 不能按需自主加载多 skill
- `mcp-servers/*` 注册靠环境变量（`CROSSREF_MCP_COMMAND/ARGS/CWD`）写死，
  没有用户级 install/uninstall/audit 流程（ADR-0006 一并答）
- `packages/editor-core/src/extensions/` 是 TipTap extension（底层框架），
  与"平台 plugin"概念**没有明确划线**——是同一个抽象的两个层级，还是不同抽象？

如果 Phase 3 才补，**反模式 §348 警告会兑现**：ai-runtime / mcp-client /
skills-loader 全部要重构，外加 Phase 1 已 ship 的 36 capability 词汇可能要
新增"plugin.install / plugin.invoke / plugin.contribute" 一组。

### 1.2 用户哲学约束（2026-05-09 review-project-goals）

1. **平台性非常重要** → ADR-0010 是 W1 头号；W3 末 dogfood 是**硬 gate**
   （不通过停 W4，不能"且做且看"）
2. **避免过多兼容性问题** → manifest schema 不为存量 npm 包 / VSCode
   extension / Obsidian plugin 做兼容层；从零设计但**借鉴**它们的好部分
3. **尽量用新技术** → plugin 加载机制可以选用 ESM dynamic import / Web
   Workers / WASI / Wasm Component Model 等新栈，不绑死在 CommonJS 上

---

## 2. Decision

### 2.1 Kernel vs Plugin 边界

**核心 (Kernel) 包**——只有这些是 core，不通过 plugin API 加载：

| 包 | 角色 | 为什么是 core |
|---|---|---|
| `packages/schema` | 8 实体 single source of truth | 平台所有插件都依赖，schema 漂移=平台漂移 |
| `packages/permissions` | 36 capability 词汇 + Principal 桥 | capability 是 plugin manifest 的语言；它本身不能是 plugin |
| `packages/editor-core` | PM schema 总装 + Y.Doc 同步 + commit serializer | 文档生命周期 owner；plugin 只能贡献 PM extension，不能替换内核 |
| `packages/render-{myst,typst,typography}` | 渲染**引擎**（不是模板/输出适配器） | Phase 0 D4 双管线决策；模板是 plugin |
| `packages/ai-runtime` 的 **runtime shell** | agent runner / mcp client / provenance writer / skill loader | shell 是 core；具体 agent/skill/mcp 是 plugin |
| `apps/sync-gateway` | WebSocket capability gate | 安全边界，第三方无权替换 |
| `apps/web` 的 **app shell** | 路由、auth、editor/exporter 入口 | app frame 是 core；侧边面板/视图是 plugin |

**Built-in Plugin 包**（用 plugin API 加载，第三方能复刻）：

| 当前位置 | 类型 | dogfood 优先级 |
|---|---|---|
| `packages/ai-runtime/src/agents/citation.ts` | Agent plugin | **W3 dogfood gate**（first reference impl） |
| `packages/ai-runtime/src/agents/inline-editor.ts` | Agent plugin | W4-W5 跟切 |
| `mcp-servers/crossref/` | MCP server plugin | W3（与 ADR-0006 注册表一起） |
| `skills/citation-lookup/` | Skill plugin | W3（dogfood 配套） |
| `skills/inline-editor/` | Skill plugin | W4-W5 |
| `templates/myst/`、`templates/typst/`（未来） | Template plugin（render 贡献点） | W6 |
| 引用导出格式（CSL / BibTeX / JATS-bib） | Export-format plugin | Phase 3 |

**边界**：TipTap PM extension（如 `extensions/equation`）**不是平台 plugin**——
它是 editor-core 内部的 PM schema 装配单元，由 core 控制注册。Phase 3 评估
"PM extension 也走 plugin API"（让第三方加 theorem-block / proof-block 等
schema 节点），本 ADR 不开此口子。

### 2.2 Plugin 类型分层（4 类）

借鉴 system-prompt §六.6.1，但合并/简化：

| 类型 | 形态 | 加载位置 | 安全模型 |
|---|---|---|---|
| **Skill** | SKILL.md + 资源（自然语言 + 模板） | ai-runtime（按需注入 prompt） | 数据 only，无执行；prompt injection 审计 |
| **Agent** | TS module + manifest + prompt + tool 引用 | ai-runtime（受信进程内） | trusted；capability 检查在网关层 |
| **MCP Server** | 独立进程（stdio / HTTP） | sync-gateway proxy 调用（详 ADR-0006） | 进程隔离；用户挂 untrusted MCP 的 capability 控制 |
| **UI Panel** | iframe + postMessage（Figma-style） | apps/web sidebar / drawer host | iframe sandbox + capability-mediated message bus |

**不分**："Template plugin" 归 Skill 的特例（资源型）；"Export format" 归 Agent
的特例（无 prompt 的纯函数 agent）。Phase 2 不增 5/6 类。

### 2.3 Plugin Manifest（统一基础 + 类型扩展）

**所有 plugin 共享的 base manifest**（YAML，per Anthropic Skills 范式而非 JSON
package.json，刻意区分）：

```yaml
# plugin.yaml — base
id: zotero-citations          # globally unique，命名空间 @owner/name 形式
version: 0.1.0                 # SemVer
type: agent | skill | mcp-server | ui-panel
title: { zh: "Zotero 引用", en: "Zotero Citations" }
description: { zh: "...", en: "..." }
authors: ["@owner"]
license: MIT | Apache-2.0 | proprietary
homepage: https://...
required_capabilities:         # ADR-0002 词汇；用户安装时显式授权
  - document.read.citations
  - document.write.citations
  - network.fetch:
      domains: [api.zotero.org]
provides_capabilities: []      # 该 plugin 自身贡献的 capability（Phase 3）
runtime:
  kernel_version: "^2.0.0"     # 内核语义版本
  node: ">=20"                 # Phase 2 仅 Node；Phase 3 评估 WASI
```

**类型扩展**：

```yaml
# Skill
type: skill
trigger_patterns:              # NEW（landscape §七 草图）
  - "投稿 Nature"
  - regex: '\\\\cite\\{[^}]+\\}'
provides_tools:                # NEW
  - check_word_count
  - validate_reference_format
allowed_mcp_servers: [crossref, semantic-scholar]
nested_skills: ["@official/nature-style"]   # Phase 3
```

```yaml
# Agent
type: agent
kind: editor | citation | reviewer | researcher | custom
prompt_template: ./prompt.md
tools:                         # MCP server tool 引用 + 内置 tool
  - mcp:crossref:lookupDoi
  - builtin:proposeRevision
runtime_mode: propose | autonomous   # ADR-0002 role 4/5
quota:
  daily_invocations: 100
  timeout_seconds: 60
```

```yaml
# MCP Server（与 ADR-0006 注册表协调）
type: mcp-server
transport: stdio | http | http-sse
command: ["tsx", "src/server.ts"]   # stdio 时
url: https://...                     # http 时
declares_tools: [lookupDoi, search]   # 静态声明，install 时校验
```

```yaml
# UI Panel
type: ui-panel
mount_point: sidebar | drawer | inspector
entry: ./dist/index.html
postMessage_protocol_version: 1
```

### 2.4 Skill 按需加载 dispatch（替换当前"启动单一加载"）

Phase 1 现状：`packages/ai-runtime/src/agent-runner.ts` 启动 agent 时根据
`agentKind` 单加载一个 SKILL.md。Phase 2 改：

1. **启动时扫**：ai-runtime 启动时枚举 `skills/**/SKILL.md` + 用户级
   `~/.platform/skills/**/SKILL.md`，索引 `id → trigger_patterns`
2. **invocation 时匹配**：agent 接到任务上下文（document selection +
   user instruction）后做两阶匹配：
   - 阶段 1：正则/关键词匹配 trigger_patterns，召回候选 skill ≤ 10
   - 阶段 2：LLM 在召回集上做"哪些相关"二次判定（参 Anthropic Skills 范式）
3. **加载 top-K 进 prompt**（K=3 默认，可 manifest 覆盖）
4. **provenance 记**：`provenance.agentContext.skillsLoaded[]` 加 skill id +
   promptHash 数组（替代当前单 promptTemplateId）

**反模式排除**：不做"用户在 UI 里手动选 skill"——那是 plugin marketplace
的事，本 ADR 不开。

### 2.5 用户安装 plugin 的流程（Phase 2 范围最小）

借鉴 shadcn registry 的轻量做法：

1. **install**：CLI / web UI 输入 Git URL / npm 名字 / registry id →
   clone 到 `~/.platform/plugins/<id>/` → 读 plugin.yaml → 校验
   required_capabilities 都在 ADR-0002 词汇内 → 提示用户授权 →
   写 `principal/<user>/granted_capabilities` 表
2. **enable / disable**：toggle 不删文件
3. **uninstall**：删目录 + 撤 capability grant
4. **audit log**：每次 install/enable/disable/uninstall 写 provenance（
   actor=user，target=plugin id，diff=manifest hash）

**Phase 2 不做**：marketplace UI、商业化、自动更新、依赖解析（plugin 间
依赖留 Phase 3）、跨设备 plugin 同步。

**Phase 2 范围严格**（user 哲学：避免过多兼容性投入）：
- 只支持从 Git URL 安装（不做 npm proxy / private registry / tarball
  upload）
- 只支持单文件 manifest，不做多目录嵌套 plugin
- 不为存量 VSCode / Obsidian / Logseq plugin 写兼容层

### 2.6 Plugin 运行时 + sandbox

| 类型 | 运行进程 | 隔离手段 | Phase 2 决策 |
|---|---|---|---|
| Skill | ai-runtime（数据 only） | 无需执行隔离；prompt-injection 静态扫描 | 简单 keyword/regex 扫；Phase 3 LLM-judged |
| Agent | ai-runtime（信任内嵌） | capability 在网关层；agent 不能越权调 MCP/tool | 与 ADR-0008 pgboss 协同 |
| MCP Server | 独立 OS 进程 | OS 进程边界 + ADR-0006 capability gate | stdio 默认；HTTP 远端是 Phase 3 |
| UI Panel | iframe（apps/web 内） | iframe sandbox + postMessage capability bus | postMessage 协议 v1：`{kind, capability, payload}` |

**新技术倾向**（user 哲学：尽量用新技术）：
- Phase 3 评估 **Wasm Component Model** 作为 Agent plugin 的跨语言
  load+sandbox 机制（Component Model 2024 已稳定）
- Phase 3 评估 **WebContainers** / **StackBlitz SDK** 在浏览器侧跑 MCP
  server（local-first 强化）
- Phase 2 不上这些，但 manifest `runtime` 字段预留 `wasm` / `webcontainer`
  enum 值

### 2.7 Dogfood 路径（W3 末硬 gate）

**目标**：把 `packages/ai-runtime/src/agents/citation.ts` 改造成"通过 ADR-0010
plugin API 加载的第一个外部 reference 实现"——和**所有第三方 agent plugin
走同一接口**。

**步骤**：
1. W1 末：plugin loader 骨架在 `packages/ai-runtime/src/plugins/loader.ts`，
   能读 plugin.yaml + 校验 manifest + dispatch
2. W2：把 citation agent 抽出 `packages/ai-runtime/src/agents/citation.ts`
   → 新位置 `plugins/citation-agent/{plugin.yaml, agent.ts, prompt.md}`
3. W3：apps/web `/api/agent/invoke` 不再 import 具体 agent，改 loader
   按 `agentKind` 找 plugin → 加载 → 调
4. **W3 末 gate criteria**（user 哲学：硬 gate）：
   - **同一组 E2E 测试**（D13 17 条 + D14 4 条）通过 plugin API 路径全 PASS
   - 第三方 plugin manifest（写一个 mock 的 citation-v2 在 `/tmp/test-plugin/`）
     能被 loader 识别 + 加载 + 调用
   - 与 hardcode 路径**没有任何特权 API 差异**——ai-runtime 内部不存在
     "internal-only API"
5. **不通过怎么办**：停 W4，回头改 ADR-0010 §2.3 manifest 或 §2.4 dispatch；
   不允许"且做且看 / 留 Phase 3 修"（user 哲学）

---

## 3. Consequences

### 3.1 正面

- 第 5 差异化轴（开放平台）从隐性变显性；Phase 3 开放协作 / 社区 skill
  仓库不需重构 ai-runtime
- SKILL.md 加 `trigger_patterns` 后 AI 按需加载多 skill，对齐 Anthropic Skills
  范式（landscape §六 / §七 草图）
- `provenance.agentContext.skillsLoaded[]` 让 agent 行为可观测增强（
  哪个 skill 在什么场景被激活）
- Manifest 显式声明 capability，与 ADR-0002 词汇直接对接，install 时
  授权对用户可见

### 3.2 负面

- W1 多 1.5 天起草；W3 末有"必须停下来重新设计"的 hard gate 风险
- ai-runtime 的内部 import 改造涉及 17 + 4 个 E2E 测试 rerun
- skill 按需加载使 prompt 长度可变，对模型 token 预算管理增加复杂度

### 3.3 长期债

- 本 ADR 不解决"PM extension 也走 plugin API"——TipTap extension 仍是
  内核装配；如 Phase 3 想让第三方加 theorem-block / proof-block，需新 ADR
- Marketplace 商业化全推 Phase 4+
- Plugin 间依赖解析（A 依赖 B@^1.0）推 Phase 3
- Wasm Component Model / WebContainers 新栈推 Phase 3 评估

---

## 4. Alternatives considered

### 4.1 沿用 npm 包 + import.meta 动态加载（rejected）

不写 manifest，让 plugin 暴露默认 export，loader 用 `import()` 动态加载。
**拒绝原因**：(a) 依赖 Node 生态不能跨运行时（WASI / browser）；(b) 不能
做 capability 静态校验；(c) prompt-injection 静态扫描没立足点；(d) 存量
npm 兼容层违反 user "避免过多兼容性投入" 哲学。

### 4.2 复用 VSCode contribution points 模型（rejected）

VSCode `contributes` 极强，但**8+ 年才达到当前水平**（system-prompt §299 提
醒）。我们不可能一步到位；强行套用会得到一个"VSCode shape 但残缺"的接口。
**结论**：借鉴**capability + activationEvents** 思想，但 manifest 形态从
零设计（YAML / 双语 i18n 内置 / capability 引用 ADR-0002 词汇）。

### 4.3 Skill 用代码而不是自然语言（rejected）

把 skill 做成 TypeScript module，开发者写 `function shouldActivate(ctx)`。
**拒绝原因**：违反 system-prompt §57 + landscape §六.6.4 核心：
**Skills 的精髓是研究者能写**，不需要懂代码。这是 OWL 团队 / 实验室 / 领域
专家能贡献的入口；做成 code 等于退化成普通 Agent plugin，把社区拒之门外。

### 4.4 把 plugin 加载推到 Phase 3（rejected——user 哲学不允许）

User 2026-05-09 明确"平台性非常重要"。Phase 3 才补 = 反模式 §348，回头
重构 ai-runtime / mcp-client / skills-loader。

---

## 5. Open questions（Phase 2 W1 起草细节填进来）

- **manifest schema 用 YAML 还是 TOML**：YAML 与 SKILL.md frontmatter 一致；
  TOML 与 Cargo.toml / pyproject.toml 一致。**倾向 YAML**（与现有 SKILL.md
  对齐，少一种格式）
- **capability 命名空间**：`document.read.citations` vs `document:read:citations`
  ——Phase 1 ADR-0002 用点号，沿用
- **plugin id 命名约定**：`@owner/name` 强制还是建议？**强制**（与 npm
  scoped name 一致，避免命名冲突）
- **Skill `trigger_patterns` 是 OR 还是 AND**：默认 OR；可在 manifest 写
  `match_all: true` 改 AND
- **ai-runtime 内部 import 重构怎么走最少回归**：W2 起 dual-path
  （hardcode + plugin path 并存，feature flag），W3 末硬切

---

## 6. 与其他 ADR 的关系

- **ADR-0001（数据模型）**：plugin 安装/卸载写 provenance，actor
  字段加 `actor.kind = 'plugin'`（review log 时确认是否动 schema）
- **ADR-0002（权限模型）**：plugin manifest `required_capabilities` 引用
  ADR-0002 36 词汇；不增新 capability 类型（user 哲学）。可能新增
  `plugin.install / plugin.invoke` 两个，作为 review log 候选
- **ADR-0003（技术栈）**：plugin runtime Phase 2 仅 Node + browser；
  Wasm Component Model / WebContainers 推 Phase 3
- **ADR-0006（MCP server 注册）**：MCP plugin 是本 ADR plugin 类型之一；
  ADR-0006 详化 MCP 特定的注册/发现/health-check
- **ADR-0007（computational cell）**：molab iframe 不走本 ADR plugin 系统
  （是 PM node 的渲染产物），但 W4 实施时复审
- **ADR-0008（long-horizon agent）**：Reviewer / Research agent 都按 Agent
  plugin 形态实现；W3 dogfood 验证后再 ship

---

## 7. Review log

（W3 末 dogfood gate 后填；预期内容：(a) gate pass/fail；(b) 哪些
manifest 字段在实施中调整；(c) skill 按需加载 dispatch 在真实 agent 任务
里的 token 预算结果；(d) §5 open questions 答案）
