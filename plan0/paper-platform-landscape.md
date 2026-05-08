# 协作论文平台 · 竞品地图与可借鉴模式（2026）

> 这份文档是 system prompt 的配套参考。挂在 Project 里供 AI 查阅，不需要每轮对话重读。
> 更新于 2026-05。

---

## 一、竞品地图（按"差异化威胁"排序）

### 第一梯队：直接竞争者

#### OpenAI Prism（2026 年 1 月发布，免费）
**核心定位**：AI-native LaTeX 协作工作区，GPT-5.2 项目级集成。

**已经做对的（不要再发明）**：
- 不限协作者、不限编译时长、不限项目数（OpenAI 财力托底）
- AI 不是侧边栏 chatbox，是项目上下文感知的协作者
- Inline 选段 → AI 提议 → diff 高亮 → accept/reject 的标准流
- Agent 模式：可创建多个 agent 并行跑任务，每次改动前 approval
- 白板/手写图 → LaTeX 自动转换
- 语音编辑（review 时不打断阅读）
- 自动编译错误修复（auto-fix retry loop）
- 直接吃 Overleaf .zip 项目导入

**没解的（我们的差异化空间）**：
- 仍然 LaTeX-native，文档是 .tex 文件树，不是异构内容图
- 没有可执行单元、数据集引用、复现性工具链
- 完全云优先，必须 ChatGPT 账号，数据在 OpenAI
- 模型锁定 GPT，不能换 Claude/本地模型/领域模型
- 默认英文学术圈，CJK 排版不是一等公民
- 没有开放协作 / 群体智慧基础设施

**对我们的影响**：Prism 把"AI-native LaTeX 协作"的高水位线划得很高。任何"AI + LaTeX 编辑器"的方向都已经被它占住了。**不要重做**。

#### Curvenote（YC，2025 年 7 月种子轮 140 万美元）
**核心定位**：所见即所得学术写作 + Jupyter 集成 + 模板导出。

**值得借鉴**：
- WYSIWYG 学术编辑器的现代实现
- 可导出多种期刊模板（解决"换期刊重排版"痛点）
- Jupyter notebook 集成（交互图表保留 Plotly/Bokeh/Altair 交互性）
- 引用悬浮预览
- 基于开源的 MyST Markdown 生态

**短板**：
- 小公司，迭代速度有限
- 中文/CJK 支持弱
- AI 集成浅
- 协作规模有限

#### Authorea（Wiley 旗下）
**核心定位**：老牌学术协作平台，模板丰富，免费。

**值得借鉴**：与期刊投稿流程的接入设计

**短板**：UI 老旧，迭代慢，AI 几乎没有

#### Overleaf
**核心定位**：LaTeX 协作的事实标准。

**对我们的影响**：基础体验门槛——人们对"LaTeX 协作"的预期是 Overleaf 级别的稳定。我们底层渲染走 MyST/Typst 但**必须能无损吃下 LaTeX 项目**。

### 第二梯队：值得长期观察的工具

| 工具 | 定位 | 借鉴点 |
|------|------|--------|
| TypeTeX | Typst-first AI 学术编辑器 | Typst 路线的产品化 |
| Octree | AI-integrated LaTeX，自主编辑 | "AI 直接修改"的 UX |
| Bibby AI | LaTeX 编辑器 + AI 学术写作 | 引用 + 写作合一 |
| PapersFlow | 论文库 + LaTeX + AI 引用核查 | 引用工作流 |
| Crixet | OpenAI 收购前身（已并入 Prism） | / |

### 第三梯队：相关但不直接竞争的工具

**研究/阅读工具**（可作为 MCP 集成对象）：
- **Undermind**：多 agent 深度学术搜索，被图书馆员评为最彻底的小众主题搜索
- **ResearchRabbit**：论文关系可视化（"Spotify for research papers"），免费
- **Elicit**：自动化文献综述
- **SciSpace**：综合研究工具，含 AI 写作
- **Consensus**：超过 2 亿同行评议论文的语义搜索
- **Scite**：引用上下文分析

**笔记/知识管理**（学术研究者常用）：
- Obsidian、Logseq、Roam Research、Zettlr
- Notion、Capacities、Tana

**写作辅助**：
- ThesisAI（端到端论文生成，与 Prism 形成对比的"生成派" vs "编辑派"）
- Trinka、Wordvice AI（学术英语润色）

---

## 二、技术工具地图（按层）

### 编辑器内核
| 选项 | 状态 | 适用 |
|------|------|------|
| **TipTap** (ProseMirror) | 成熟，主流 | **首选**，schema 灵活 |
| Lexical (Meta) | 较新，性能好 | 备选；Meta 内部使用，移动端友好 |
| Slate.js | 老牌但 React 重 | 不推荐新项目 |
| BlockNote | TipTap 之上的 block UI | 如果走 block-based 路线 |
| ProseMirror 直接用 | 最强但学习曲线陡 | 极端定制场景 |

### CRDT 协作
| 选项 | 2026 状态 | 何时用 |
|------|----------|--------|
| **Yjs** | 生产就绪，生态最完整 | **Phase 1 默认** |
| Loro | 作者声明 not production-ready，API 未稳 | 持续观察，Phase 1 不用 |
| Automerge 3 + automerge-repo | 生产可用，JSON 模型 | 异构内容图 / fork-merge / 跨设备同步场景 |
| Y-Sweet (Jamsocket) | Yjs 商业托管 | 不想自建同步基础设施时 |
| Liveblocks | 商业全栈协作 SDK | 快速起步，但有 vendor lock-in |
| Replicache / Zero (Rocicorp) | Local-first sync 框架 | 不是 CRDT 但是 local-first 哲学的实现 |
| ElectricSQL | Postgres-based local-first | 数据库层 sync，与 CRDT 互补 |

**决策原则**：Phase 1 用 Yjs，但在 document store 层抽象出 CRDT 引擎接口，让未来切到 Automerge 3 不是地狱。

### 渲染管线
| 选项 | 角色 | 备注 |
|------|------|------|
| **MyST CLI** (`mystmd`) | 主线 | Project Jupyter 维护，PDF/HTML/JATS/Word 全格式 |
| **Typst.ts** | 实验线 | WASM 客户端编译，速度极快，未来感 |
| Pandoc | fallback | 通用文档转换瑞士军刀 |
| LaTeX (TeX Live / Tectonic) | 兼容层 | 必须支持，但不是主推 |
| Quarto | 不直接用 | 协作弱，但渲染质量参考 |

### 公式
| 工具 | 用途 |
|------|------|
| **KaTeX** | 渲染（最快，覆盖学术常用） |
| **MathLive** | 输入（手写、语音、键盘混合 IDE） |
| MathJax | 兜底（覆盖 KaTeX 不支持的高级宏） |
| Mathpix | 截图 → LaTeX OCR（外部 API） |

### 可执行单元
| 工具 | 优劣 |
|------|------|
| **Marimo** | **首选**：reactive、Pyodide 浏览器执行、pure Python（Git/Agent 友好）、AI-native |
| Jupyter | 标准但有 hidden state、JSON 格式不友好 |
| Observable Framework | JS-first，交互可视化强 |
| Pluto.jl | Julia 生态，reactive |
| Quarto kernel | 多语言，但偏静态渲染 |

### AI / Agent 框架
| 工具 | 用途 |
|------|------|
| **Vercel AI SDK** | 前端 streaming + 工具调用抽象 |
| **AI Elements** / Assistant UI | UI 组件（chat、suggestion、approval flow） |
| **MCP** (Model Context Protocol) | 工具 bus 标准——这是 2026 年最重要的协议 |
| Mastra | TypeScript agent 框架 |
| LangGraph | Python 多 agent 编排 |
| CrewAI | Python 多 agent，role-based |

### 文献与数据集成（通过 MCP）
- Zotero MCP（已有第三方实现）
- CrossRef MCP（DOI 元数据）
- Semantic Scholar MCP（语义搜索）
- arXiv MCP
- PubMed MCP
- 知网 / 万方（中文场景，需自建）
- Hugging Face Datasets MCP
- Zenodo / DataCite MCP

### 设计参考（Editorial 气质）
**站点**：
- Stripe Press（书籍版式 web 化典范）
- Distill.pub（科学交互论文）
- The Pudding（数据叙事）
- Are.na（克制、内容优先）
- Posts by Maggie Appleton（个人学术博客的设计天花板）

**字体**（serif 优先）：
- 思源宋体 / 方正悠宋（中文）
- iA Writer Quattro / Tiempos / Source Serif（英文）
- JetBrains Mono / IBM Plex Mono（代码）

**反例**：
- 通用 SaaS 看板（Linear、Notion、Slate）—不是不好，是不适合学术
- Inter + 圆角 + 蓝紫渐变的"AI 创业公司模板"

---

## 三、可借鉴的设计模式库

### 模式 1：Inline AI 建议 + Diff 视图
**场景**：用户选中一段文字，调用 AI 改写。

**Prism / Cursor 标准流**：
1. 用户选段 → 输入指令（"改得更学术"）
2. AI 在原位生成新版本，旧版本以划掉显示，新增以高亮显示
3. 用户可以一键 accept、reject，或继续修改

**反模式**：把 AI 输出放在右侧 chat 框，要求用户手动复制粘贴。

### 模式 2：Agent Approval Flow（批量审阅）
**场景**：用户派 Citation Agent 检查全文引用。

**标准流**：
1. Agent 异步跑任务，状态可见（"正在检查 47 个引用…"）
2. 跑完返回一份变更清单：12 处建议改动，每处含原文 / 提议 / 理由
3. 用户可批量 accept、逐条 review、整体 reject
4. accept 后变更进入正常的 commit history（带 provenance）

**反模式**：Agent 直接修改文档，用户事后看 history 才发现。

### 模式 3：Auto-Fix Retry Loop
**场景**：编译/渲染/引用解析失败。

**标准流**：
1. 系统检测到失败，捕获错误信息
2. 自动调用 AI："这是错误信息和上下文，给修正方案"
3. AI 给修正，系统重试，最多 N 次
4. 全程对用户可见但不打扰（侧边小角标），失败时才弹通知

**OpenPrism 进一步加了 VLM layout check**：渲染成功后用视觉模型检查 PDF 是否真的好看。

### 模式 4：Provenance 链路
**每一处修改的元数据**：
```
{
  "blockId": "...",
  "diff": [...],
  "actor": { "type": "user|agent", "id": "..." },
  "timestamp": "...",
  "agent_context": {
    "model": "claude-opus-4.7",
    "prompt_template_id": "...",
    "input_blocks": [...],
    "tool_calls": [...]
  } | null,
  "parent_revision": "...",
  "approved_by": ["user_id_1"]
}
```

这条链路从 Phase 1 第一个 commit 起就要存。

### 模式 5：MCP-First 工具集成
**架构**：所有外部工具（Zotero、CrossRef、Jupyter、自定义研究工具）都通过 MCP server 接入，不是直接 API 调用。

**好处**：
- 用户能挂载自己的 MCP server（私有数据、领域工具）
- 工具能力是声明式的，可以让 AI agent 自动发现和使用
- 统一的权限和审计模型

### 模式 6：Document Forking
**Manubot / Octopus 借鉴**：
- 任何用户可以 fork 一篇公开论文
- fork 出的版本是独立编辑空间，但保留与原文的关系图
- 当 fork 想合并回主线时，触发原作者的 review（GitHub PR 风格）
- 这是开放协作和群体智慧的基础

---

## 四、可观测的"哪里走偏了"信号

如果你（AI 合伙人）发现自己在做下面的事，停下来问我：

- 在 Phase 1 加 Prism 已经做得很好的功能（一对一比较时我们不会赢）
- 在异构内容图、研究工作流、local-first、双语对等之外的某个方向投入超过 20% 精力
- CRDT / 数据模型 / provenance 设计草草过关，急着写编辑器 UI
- AI 集成模式回到"右侧 chat 边栏"
- 中文 UI 是英文翻译过去的，不是平行设计的
- 开始讨论某个看起来酷但与差异化无关的 feature（"我们也加个 spatial canvas 吧"——除非你能说清它服务于哪条差异化）

---

## 五、外部资源 & 长期跟踪

**社区与思潮**：
- Ink & Switch（local-first software 思潮源头）
- Project Jupyter（MyST 生态）
- crdt.tech（CRDT 实现汇总）
- DeSci 社区、ResearchHub

**重要 RFC / 论文**：
- "Local-first software" by Ink & Switch (2019)
- "Open collaborative writing with Manubot" (PLOS Comp Bio, 2019)
- Fugue CRDT paper (2023)
- 关注 arXiv 上 multi-agent、agent observability、document understanding 方向

**值得每月看一眼的项目**：
- mystmd / Curvenote / Marimo / Loro / Automerge 的 release notes
- Anthropic / OpenAI 的 agent 相关产品发布
- shadcn/ui / TipTap 的更新

---

## 六、平台 / 插件生态参考（核心借鉴）

我们要做的是平台，不是产品。下面这些项目在"如何让一个工具变成生态"上各有可借鉴之处。

### VSCode（扩展 API 标杆）
**核心借鉴**：
- 极小内核 + 极强扩展 API 的范式：编辑器、调试器、Git 集成、终端——全部是扩展
- Capability-based extension manifest（`package.json` 里声明 `activationEvents` 和 `contributes`）
- 命令系统 (Commands)：所有功能都是命令，命令可以被键盘、菜单、AI、其他扩展调用——这是 AI agent 友好的天然结构
- Webview API：复杂 UI 用 iframe sandbox 实现，与主进程通过 message passing
- VSIX 包格式 + Marketplace
- Language Server Protocol (LSP)：把语言能力抽离成独立进程，多个客户端可复用

**陷阱**：VSCode 扩展 API 经过 8+ 年才达到当前水平，我们不可能一步到位。但**核心抽象（命令、贡献点、capability）从 Phase 1 就要在**。

### Obsidian（社区驱动的轻量插件）
**核心借鉴**：
- 文件优先（数据是用户的本地 Markdown）—— local-first 哲学
- 插件用 TypeScript 写，加载到主进程（不 sandbox）—— 简单但有安全代价
- 社区插件极其活跃，因为 API 简单、文档好、用户群对修改自己的工具有动力
- "核心团队克制"：很多大功能（Dataview、Excalidraw、Templater）都是社区插件，不是官方
- 主题与 CSS 变量系统：用户能完全自定义视觉

**给我们的启示**：不要 sandbox 一切（会扼杀社区贡献），但要给 capability 边界让用户知道风险。

### Cursor（AI-native IDE，新范式）
**核心借鉴**：
- AI 不是独立功能，是"复制 VSCode 但每个交互都加了 AI 层"——这是 AI-native 改造的范本
- Composer (agent 模式)：批量改动的 approval flow
- `.cursorrules` / Project Rules：用户能定义 AI 在这个项目里的行为约束——**这就是项目级 skill 的雏形**
- MCP 集成（2024 年加入）：让 Cursor 接外部工具
- 商业模式：免费 + Pro 订阅 + Enterprise——AI usage 是付费门槛，不是功能

**给我们的启示**：AI-native 改造不是加一个 chat 边栏，而是让每个交互（hover、select、command）都获得 AI 增强能力。

### Anthropic Claude Skills（Skills 范式的源头）
**核心借鉴**：
- **Skills 是自然语言定义 + 资源文件，不是代码**——研究者、文档工作者、领域专家都能创建
- `SKILL.md` 元数据头：`description` 描述何时加载，AI 自主选择
- 文件夹结构：SKILL.md + 资源（参考文档、模板、示例）
- "按需加载"：AI 在执行任务时根据上下文动态加载相关 skill，不是用户预先选
- 嵌套与组合：skills 可以引用其他 skills

**直接对应到我们的领域**：
- `nature-submission/`：投稿 Nature 的格式、引用规范、常见拒稿原因
- `chinese-academic-writing/`：中文学术写作风格、避免的西化表达
- `replication-methodology/`：实验复现方法论的描述模板
- `peer-review-as-reviewer/`：作为审稿人时的评审框架

**这是 Phase 1 必须做对的核心**——它直接决定平台能否被研究者社区接受。

### shadcn/ui（轻量 registry 范式）
**核心借鉴**：
- **不是 npm 包，是源码复制**——用户拥有代码，可以修改
- CLI 工具 (`npx shadcn add ...`) 处理依赖和文件复制
- 组件 registry 是 JSON 索引 + Git 仓库，没有中心服务器
- 可以有多个 registry（官方 + 社区 + 私有）

**给我们的启示**：插件分发不一定要做 npm 那么重的包管理。一个简单的 registry JSON + Git 仓库 + CLI 工具，就能让 Phase 1/2 跑起来。

### Figma Plugins（受信沙箱模型）
**核心借鉴**：
- 插件运行在 iframe sandbox 里，与主应用通过 postMessage 通信
- 严格的能力边界：插件能做什么完全由 host 控制
- 插件 API 是声明式的，不是直接操作 DOM
- 商业模式：免费插件 + 收费插件（开发者收入分成）

**给我们的启示**：UI 类插件用 iframe sandbox 是合理的安全选择，但要设计好高质量的 message-based API。

### Notion Integrations（弱平台，反例）
**为什么是反例**：
- Integrations 只能通过 API 进出数据，不能扩展 UI、不能扩展编辑能力
- 结果是生态局限于"数据搬运"，没有真正改变 Notion 本身的能力
- 启示：如果只做"数据集成"不算平台，那是 SaaS 后端而已

---

## 七、Skills 系统的具体设计草图（Phase 0 参考）

```
~/platform/skills/                          # 用户本地 skills 目录
├── _personal/
│   └── my-writing-style/
│       ├── SKILL.md
│       └── examples.md
├── @owl-team/                              # 团队/组织命名空间
│   └── education-research-paper/
│       ├── SKILL.md
│       ├── methodology-template.md
│       ├── common-frameworks.md            # Bloom, UDL, etc.
│       └── chinese-citations.md
└── @official/                              # 官方维护的核心 skills
    ├── nature-submission/
    ├── ieee-conference/
    └── chinese-cssci/
```

`SKILL.md` 的元数据头：

```markdown
---
name: nature-submission
description: |
  指导论文符合 Nature 系列期刊的格式、风格、引用规范。
  在用户表明要投稿 Nature 子刊、或在论文最终阶段需要格式检查时激活。
trigger_patterns:
  - "投稿 Nature"
  - "Nature submission"
  - "format for Nature"
required_capabilities:
  - document.read.full
  - document.write.suggest
provides_tools:
  - check_word_count
  - validate_reference_format
  - suggest_title_revision
---

# Nature Submission Skill

## When to use
...

## Style guide
...
```

AI agent 在执行任务前扫描相关 skills，根据 `description` 和 `trigger_patterns` 决定加载哪些。这与 Anthropic Skills 的设计直接对应。

---

文档结束。这是一份活文档，每个 phase 结束时回头补充。
