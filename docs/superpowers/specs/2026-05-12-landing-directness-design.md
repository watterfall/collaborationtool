# Landing 首页 v4 spec — 重新定位到 Triadic Architecture

**Status:** Proposed
**Date:** 2026-05-12（v4，全面重写。v1/v2/v3 全部废弃）
**Phase target:** Phase 5 W4-W5（与 ADR-0020 Wave D-1/D-2/D-3 已 landed
同步；Wave D-4 UI 之前需要先把首页定位对齐）
**Upstream:** ADR-0020 Night-Bridge-Day Triadic Architecture (Proposed) +
client-first pivot spec (2026-05-11) + 用户反馈"v3 偏向科研协作，需要更
具颠覆性 / 基于未来 / 更有吸引力"

---

## 0 · v3 → v4 反思（这次是大改写，不是迭代）

**v1/v2/v3 共同根本错误**：sell "用 Markdown 写论文 + AI 帮你查文献改语法" —— 这正是 ADR-0020 §1.1 已经否决的 Iteration 1（"协作论文平台 + AI 增强"被判为"等同 Overleaf/PubPub 等 commodity；护城河浅"）。

**v4 的正确定位**：项目不是协作论文平台，是**三层等价知识产出系统**——别的工具只承接最终论文（Day 层），我们把"3am 醒来想到的连接、餐桌上的争论、最后没用上的草图"（Night 层）和"把灵感翻译成可发表的原型 / 设计虚构 / 概念验证"（Bridge 层）也当一等公民。

**这是真正的颠覆性方向**——竞争对手（Curvenote/PubPub/Notion/Obsidian/GitHub Issues）**无人做三层等价**（ADR-0020 §3 Good 第一条）。

**用户对 v3 反馈的解读**：
- "偏向科研协作" → 错把项目当 Notion/Curvenote 替代品；真正定位是给**思考过程**造工具
- "更具颠覆性" → 颠覆"论文 = 科研产出"这个默认假设
- "基于未来" → ship Triadic Architecture 这个 5 年差异化锚点的叙事
- "更有吸引力" → 让访客在 Hero 5 秒内感受到"原来研究者那些被丢掉的东西其实是科学"

---

## 1 · v4 唯一原则

**首页 sell 的不是产品功能，是新的世界观**：

> 论文不是科研的全部。3am 醒来想到的连接、餐桌上的争论、最后没用上的
> 草图，也是科学——我们给这些造一等公民空间。

所有首页文字 + 视觉 mockup 必须为这个叙事服务。前 3 版 spec 的"AI 帮你
查文献"、"Markdown 写论文"、"4 个 pillar"、"5 年差异化锚点"全部废弃。

**仍守住 v3 的"大白话原则"**：不用"Triadic / Night Science / Bridge
Layer / discovery-graph / contribution-graph / interaction-mode"等内部
术语；用研究者会自己说出口的话翻译。

---

## 2 · 不做的事

- 不引入 "Night Science / Triadic / 夜科学" 等学术 / 内部术语（**用大白话翻译**）
- 不引入 `/demo` 公开路由（Phase 5 W11 单独 gate）
- 不动 server-redirect（已登录 → /docs）
- 不动 Design.md tokens / globals.css
- 不引入外部图片资产（mockup 全 HTML/CSS）
- **不 sell vaporware**：Wave D-4 UI（apps/web/src/app/triadic/）还没做、
  Wave D-5 dogfood gate（30 天 jili 自用）还没跑——首页不能承诺"现在
  就能用 Night / Bridge surface"。Hero 文案 + Pillars 表达"我们认为
  科研是三层的"（哲学立场，永真）+ "我们正在为这造工具"（进行时），
  不是"我们已有完整的三层 surface 给你用"

---

## 3 · v4 文案（双语全套字面值）

### 3.1 Hero 区域

**eyebrow（sans-serif sm 字号，小标）：**

- zh：`三层等价的知识产出系统 · 桌面端为主`
- en：`A three-layer system for what science actually produces · desktop-first`

**H1（display serif 巨号，CJK 6xl/7xl + 拆 3 行）：**

- zh：
  ```
  论文不是科研的全部。
  想法、原型、论文 —
  三个空间，等价对待。
  ```
- en：
  ```
  Papers are not the whole of science.
  Ideas, prototypes, papers —
  three spaces, treated equally.
  ```

**tagline（serif italic 4xl，紧贴 H1）：**

- zh：`3am 想到的隐喻 · 餐桌上的争论 · 最后没用上的草图 — 也都是科学。`
- en：`The 3am metaphor · the dinner argument · the sketch you never used — these are science too.`

**主 CTA：**

- zh：`开始用` → `/signup`
- en：`Start` → `/signup`

**次 CTA：**

- zh：`怎么装到自己电脑 →` → `docs/SELF_HOST.md`
- en：`How to self-host →` → `docs/SELF_HOST.md`

**底部辅助说明（sans-serif 12px）：**

- zh：`桌面端为主 · 数据存在你电脑上 · 开源 · 可自托管`
- en：`Desktop-first · stored on your machine · open-source · self-hostable`

### 3.2 Hero 右半：产品 mockup（HTML/CSS inline，无外部图片）

**展示什么** —— 不是"AI 改论文段落 + provenance"（v3 错误），而是**三层
artifact 之间的 lineage edge**——让访客一眼看到"原来想法、原型、论文是
连在一起的三件事"。

**Mockup 结构（垂直堆叠 3 个卡片 + 之间的连接线）：**

```
┌──────────────────────────────────────────┐
│ NIGHT · 想法 / idea                       │
│ "Google 2024 在 NISQ 上测到 0.8% 错误     │
│  率，但理论极限是 1%。会不会错误率不     │
│  是常数？"                                │
│ — 矛盾观察 · contradiction                │
└──────────────────────────────────────────┘
          ↓  metaphor-bridge
┌──────────────────────────────────────────┐
│ BRIDGE · 原型 / prototype                 │
│ toy model：错误率 = f(device, time)       │
│ 三个可测参数：T1、串扰、温漂              │
│ — 假设形式化 · hypothesis sketch          │
└──────────────────────────────────────────┘
          ↓  hypothesis-output
┌──────────────────────────────────────────┐
│ DAY · 论文 / paper                        │
│ "We propose a device-dependent error      │
│  model with three measurable parameters…" │
│ — 论文草稿 · manuscript draft             │
└──────────────────────────────────────────┘
```

**视觉规则：**

- 3 个 artifact card 视觉权重**完全等价**（同字号、同 border、同 padding）
  —— 物质化 "三层等价" invariant
- 连接箭头用 `↓` ascii glyph + 旁边 mono 小字标注 interaction_mode 名（
  "矛盾 → 隐喻桥 / contradiction → metaphor-bridge"），但**箭头标注用
  大白话**：把"metaphor-bridge"翻译为"想法变原型"，"hypothesis-output"
  翻译为"原型变论文"
- 每个 card 顶上有一个 layer 标签（NIGHT / BRIDGE / DAY），mono caps，
  字号 11px，颜色 `--color-accent-ink`，**不**当 status pill 风格
- card 用 hairline border + `--color-paper-2` bg，无 shadow / 无圆角
  / 无 saturated 色

**新组件：** `apps/web/src/components/landing/TriadicMockup.tsx`

**新增 locale 字段 `landing.heroMockup`（zh.ts + en.ts 各 18 字段）：**

```ts
heroMockup: {
  // Night card
  nightLabel: 'NIGHT · 想法 / idea',
  nightBody: 'Google 2024 在 NISQ 上测到 0.8% 错误率，但理论极限是 1%。会不会错误率不是常数？',
  nightTag: '矛盾观察 · contradiction',
  // edge label 1
  edge1Label: '想法变原型',          // en: "idea → prototype"
  edge1Mode: 'metaphor-bridge',
  // Bridge card
  bridgeLabel: 'BRIDGE · 原型 / prototype',
  bridgeBody: 'toy model：错误率 = f(device, time)。三个可测参数：T1、串扰、温漂。',
  bridgeTag: '假设形式化 · hypothesis sketch',
  // edge label 2
  edge2Label: '原型变论文',          // en: "prototype → paper"
  edge2Mode: 'hypothesis-output',
  // Day card
  dayLabel: 'DAY · 论文 / paper',
  dayBody: 'We propose a device-dependent error model with three measurable parameters…',
  dayTag: '论文草稿 · manuscript draft',
  // footer hint
  footerHint: '三个空间之间的连接被独立记下来：哪个想法变成了哪个原型，哪个原型变成了哪段论文。',
}
```

en 镜像（保持 1:1 翻译，不重复列）。

**为什么这个 mockup 是颠覆性的：**

研究者从未在任何工具里见过"我的灵感 → 我的 toy model → 我的论文"被显式
画在一起。Notion/Obsidian 只把它们当文档；Curvenote/Quarto 只承接论文；
GitHub Issues for Science 只有 issue（≈ Night question）。**没人把三层
之间的 lineage edge 当一等公民显式画出来**。访客看完这张图，5 秒内会
想"啊我也有这种链条，原来可以这么记"。

### 3.3 「能做什么」节（3 个 pillar，取代 v3 的 4 个）

**节标题：**
- zh：`能做什么`
- en：`What it does`

**节副标：**
- zh：`三个工作空间。每个空间有自己的内容类型、自己的协作方式、自己的 archive。`
- en：`Three workspaces. Each has its own content types, collaboration patterns and archive.`

**① 想点子的地方**
- zh title：`想点子的地方`（注：括号内 en sub 不用括号样式，用 hairline 标签）
- en title：`The thinking space`
- zh desc：`你 3am 醒来想到的连接、和朋友餐桌上的争论、把一个数学方法用到生物上的"咦"——都是 first-class 内容。可以是文字、可以是手画草图、可以是一个矛盾观察、可以是一个反例。允许半成品。`
- en desc：`The 3am connection, the dinner argument, the "huh, what if this method from math applies to biology?" — all first-class. Words, hand sketches, a contradiction you noticed, a counter-example. Half-baked is allowed.`

**② 做原型的地方**
- zh title：`做原型的地方`
- en title：`The prototyping space`
- zh desc：`想用一个想法做点什么——一个 toy model、一段把"我感觉这有关系"翻译成"可测的三个参数"、一个还不到论文水平但能让别人理解你在想什么的设计草图。这一层做完，离论文还差一截，但已经能给同行看了。`
- en desc：`Turn an idea into something. A toy model, a translation from "I feel these are connected" to "three measurable parameters", a design sketch that's not paper-grade but gets your idea across. Done here, you're not at a paper yet — but you can show colleagues.`

**③ 写论文的地方**
- zh title：`写论文的地方`
- en title：`The paper space`
- zh desc：`传统的写论文、跑实验、走评审、导出 PDF / Word / JATS——这一层我们做得和别人一样好。但只占三层中的一层；不是全部。`
- en desc：`The traditional part — write the paper, run the experiments, go through review, export to PDF / Word / JATS. We do this layer as well as anyone. But it's one of three layers, not all of them.`

**第 4 节（独立 visual 节，不并入上面 3 个 pillar 的 grid）：**

**「每一个想法都有名字」**
- zh title：`每一个想法都有名字`
- en title：`Every idea has a name`
- zh desc：`不再是"first author et al."。每个想法是谁提的、每个隐喻是谁想到的、每个矛盾是谁挖出来的——都被记下来，都独立可被引用。论文里"作者"不再是排第几的游戏。`
- en desc：`No more "first author et al." Every idea, every metaphor, every contradiction is tracked to who proposed it, with timestamps. Each contribution is independently citable. Authorship is no longer a ranking game.`

### 3.4 「看一眼」节（specimens，3 张）

**节标题：**
- zh：`看一眼`
- en：`Take a look`

**节副标：**
- zh：`一张想法手稿、一张原型表、一张三层之间的连接图。`
- en：`A thinking sketch, a prototype table, a map of how the three layers connect.`

**Figure 1 — Night 层 artifact 实物（替代 v3 的 Typst PDF）**
- zh alt：`想点子空间里的一页内容 —— 包含一个矛盾观察、一段隐喻草稿`
- zh caption：`想点子空间的一页：矛盾观察、隐喻草稿、一段还没确定的提问。允许半成品，允许"不知道是不是对的"。`
- en alt：`A page in the thinking space — a contradiction noticed, a metaphor draft`
- en caption：`A page in the thinking space: a contradiction noticed, a metaphor in draft, a question that may or may not lead anywhere. Half-baked is allowed.`
- 图源：`/demo/landing-specimen-night.svg`（**待造，简易 SVG**——可用现有
  `landing-specimen-typst.svg` 修改：把论文段落改成手稿风格的几行文字 +
  圆圈标注）

**Figure 2 — Bridge 层 artifact 实物（替代 v3 的 AgentTimeline）**
- zh alt：`原型空间里的一张表 —— 一个假设的三个可测参数 + 风险点`
- zh caption：`原型空间的一张表：一个假设、三个可测参数、两个风险点、一段"如果这真的成立会推翻什么"。这不是论文，但已经能给同行看。`
- en alt：`A table in the prototyping space — a hypothesis with three measurable parameters and risks`
- en caption：`A table in the prototyping space: one hypothesis, three measurable parameters, two risks, one line on "what this would overturn if true". Not a paper — but enough to show.`
- 图源：`/demo/landing-specimen-bridge.svg`（**待造**）

**Figure 3 — Lineage graph 实物（替代 v3 的 Review DAG）**
- zh alt：`三层 artifact 之间的连接图 —— 想法 → 原型 → 论文 的 lineage`
- zh caption：`一张三层之间的连接图：哪个 3am 灵感最后变成了哪一段论文？哪个原型从来没用上？每条连接都带"是什么方式转化的"标注。`
- en alt：`Lineage graph between three layers — idea → prototype → paper`
- en caption：`A map across layers: which 3am idea ended up in which paragraph? Which prototypes were never used? Each edge is labelled with how the transformation happened.`
- 图源：`/demo/landing-specimen-lineage.svg`（**待造**——3 个 layer 的
  小 node graph）

**所有 3 个 specimen SVG 是 v4 新资产**——不复用 v3 的 typst / timeline /
dag SVG（那 3 张都是 Day 层视角）。

### 3.5 「和别的工具有啥不同」节

**节标题：**
- zh：`和别的工具有啥不同`
- en：`How it's different`

**节副标：**
- zh：`简单说：别的工具只承接最终论文。我们承接想法 → 原型 → 论文整个链条。`
- en：`Short version: other tools handle just the paper. We handle the whole chain — idea → prototype → paper.`

**5 行（替代 v3 的 4 行，加 Obsidian/GitHub Issues for Science 作为新对比）：**

**vs Notion / Obsidian**
- 它做的 zh：`通用笔记软件。所有内容都是同一种文档。AI 在右边聊天侧栏。`
- 它做的 en：`General-purpose notes. Everything is one kind of document. AI lives in a right-side chat panel.`
- 我们 zh：`三层显式分开。每层有自己的内容类型（想法 / 原型 / 论文）和协作方式。AI 在内容里直接帮你改，不在聊天框。`
- 我们 en：`Three layers explicit. Each has its own content types and collaboration patterns. AI edits inline — not in a chat box.`

**vs Curvenote / Quarto / Overleaf**
- 它做的 zh：`只承接论文这一层。想法和原型阶段它不管。`
- 它做的 en：`Just the paper layer. Ideas and prototypes are not their job.`
- 我们 zh：`论文这一层我们做得同样好。但只占三层中的一层。`
- 我们 en：`We do the paper layer just as well. But it's one of three.`

**vs GitHub Issues for Science / FutureHouse**
- 它做的 zh：`只有"问题"一种东西。`
- 它做的 en：`Only "questions" as the unit of work.`
- 我们 zh：`想点子空间里除了问题，还可以放隐喻、矛盾观察、思想实验、草图、念头。原型空间里有 toy model、设计虚构、概念验证、类比映射。`
- 我们 en：`The thinking space holds questions but also metaphors, contradictions, thought experiments, sketches, raw thoughts. The prototyping space holds toy models, design fictions, proofs-of-concept, analogy maps.`

**vs 传统论文 "first author et al."**
- 它做的 zh：`第一作者排第一，其他作者排第二第三。引用看 first author。谁先 submit 谁拿 priority。`
- 它做的 en：`First author gets the first slot, others second/third. Citations name first author. Whoever submits first wins priority.`
- 我们 zh：`每个想法、每个隐喻、每个矛盾的作者独立记录、独立可被引用。"谁先想到"不再是单赢的比赛。`
- 我们 en：`Every idea, metaphor, contradiction has its own attribution and citation. "Who first" is no longer a winner-takes-all race.`

**vs 关在云端的协作工具**
- 它做的 zh：`必须用他们的服务器。你的 3am 灵感被传到他们的数据库。`
- 它做的 en：`Cloud-hosted. Your 3am ideas live in their database.`
- 我们 zh：`桌面端为主。数据存在你电脑上。AI 默认在本地跑。开源、可自托管。`
- 我们 en：`Desktop-first. Data stays on your machine. AI runs locally by default. Open-source and self-hostable.`

**底注：**
- zh：`详细对比见 README。`
- en：`See README for the full comparison.`

### 3.6 「装好之后长这样」节（architecture）

**节标题：**
- zh：`装好之后长这样`
- en：`After self-hosting`

**节副标：**
- zh：`桌面端为主：你的内容、你的 AI 都在你电脑上。要协作时再通过你自己的服务器同步。`
- en：`Desktop-first: your content and your AI live on your machine. When collaborating, you sync through your own server.`

**ASCII 图改**（v3 的图是"浏览器 + 服务器" 二元，v4 改成"桌面 + 服务器 + 协作者"三方）：

```
   你的桌面 (主)               你的服务器（可选）             协作者的桌面
   ┌─────────────┐              ┌──────────────┐             ┌─────────────┐
   │ 编辑器      │  ──同步──→  │ 协作中转     │ ←──同步──   │ 编辑器      │
   │ 想法/原型   │              │ + 备份      │             │ 想法/原型   │
   │ /论文       │              │              │             │ /论文       │
   │ 本地 AI     │              │              │             │ 本地 AI     │
   └─────────────┘              └──────────────┘             └─────────────┘
```

**Caption：**
- zh：`内容和 AI 都跑在你的桌面端。需要和合作者同步时，过你自己的服务器中转一次。不需要协作的项目，连服务器都可以不要。`
- en：`Content and AI run on your desktop. To sync with collaborators, route through your own server. For solo projects, you don't need the server at all.`

### 3.7 底部 nav（保留）

`README · ADR 索引 · 用户手册 · 开源协议` —— 保留。

### 3.8 删除项

- **删** v3 / 旧 Landing 的"vol. 01 · issue 00 · pre-release" 期刊号
  eyebrow（v3 已删，v4 沿用）
- **删** 旧 Landing 的 4 个 ASCII 微图（v3 已删）
- **删** "5 年差异化锚点 · claim 级 ORCID-签名评审 DAG" 节副标
- **删** 现有 specimens 节的所有 3 张图（Typst PDF / AgentTimeline / Review DAG）—— 替换为 v4 的 3 张 Night/Bridge/Lineage SVG

## 4 · 视觉决策（保留 v2/v3 的视觉骨架，不动）

- 巨号 H1（`text-5xl sm:text-6xl lg:text-7xl` + `leading-[0.98]` + `tracking-[-0.02em]`）
- Hero 2 列：左文字 + 右 TriadicMockup（HTML/CSS inline）
- Pillars 节无 ASCII 微图
- Design.md §11 reject criteria 13 条 100% 遵守（v4 没引入新 visual
  red line；triadic mockup 内 3 个 layer card 都是方角 hairline +
  paper-2 bg + 无 shadow）

## 5 · 实现工作量估计

| step | 文件 | 估时 |
|---|---|---|
| §3.1 Hero eyebrow / H1 / tagline / CTA / 辅助说明（双语 8 字段 + 字号升档） | zh.ts / en.ts / Landing.tsx | 30 min |
| §3.2 TriadicMockup 组件 + heroMockup locale（zh + en 各 18 字段） | TriadicMockup.tsx（新）+ Landing.tsx + locales | 100 min |
| §3.3 3 个 pillar + 第 4 节 "每个想法都有名字" 改写 | Landing.tsx + locales | 30 min |
| §3.4 specimens 节 3 张 caption + alt 改 | locales | 15 min |
| §3.4 specimens **3 张 SVG 新造**（landing-specimen-night/bridge/lineage.svg） | public/demo/ | 90 min |
| §3.5 differentiation 节 5 行重写 | locales | 30 min |
| §3.6 architecture ASCII 图改 + caption 改 | locales | 15 min |
| 节顺序与移动端 stack 适配 | Landing.tsx | 15 min |
| `pnpm web:typecheck` + `pnpm web:test` + 浏览器手测 + reject grep gate + v4 行话清零 gate | — | 25 min |

**总计：~5.5–6 小时**，1 个 commit。**比 v3 多 2h，主因是 3 张新 SVG**。

## 6 · 验收

- [ ] `pnpm web:typecheck` PASS
- [ ] `pnpm web:test` PASS
- [ ] 3 张新 SVG 在浏览器渲染正常、CJK 字体不缺
- [ ] `pnpm web:dev` 浏览器手测（1440×900 desktop + 375×667 mobile）：
  - H1 不溢出、TriadicMockup 3 个 card 等宽对齐、连接箭头清晰
  - 中 / 英 i18n 切换，mockup 18 字段全部跟随
  - 5 秒识别测试：找 ≥3 个研究者朋友点开，问"这工具和 Notion / Curvenote /
    Overleaf 有啥不同"。目标：≥ 2/3 能说出"它把想法和原型也当一等内容"
    或等价表述。**这是 v4 vs v3 的核心 acceptance**——v3 测的是"5 秒
    懂这是干嘛的"（commodity），v4 测的是"5 秒懂这和别的不一样在哪"
- [ ] `git diff --staged apps/web/src | grep -E "bg-blue-(500|600|700)|rounded-(lg|xl|2xl|full)|bg-zinc-(50|100|200)|shadow-(sm|md|lg|xl)"` 返回空
- [ ] **行话清零 gate（v4 调整）**：以下词在 `apps/web/src` grep 返回空：
  ```bash
  rg -o "Triadic|triadic|Night Science|night-science|夜科学|Bridge Layer|bridge-layer|discovery-graph|contribution-graph|interaction-mode|Yanai|Lercher|Markup-as-source|WYSIWYM|双月刊|vol\. 01" apps/web/src
  ```
  （内部架构名禁止出现在生产 i18n 字面值；只能用大白话翻译）

## 7 · Design.md §11 reject criteria 逐条复核

| # | red line | v4 状态 |
|---|---|---|
| 1 | `bg-blue-500/600` 或 saturation > 60% | ✅ 全用 token (`--color-accent-ink`) |
| 2 | `rounded-lg/xl/2xl/full`（除头像 / pill） | ✅ TriadicMockup 3 个 card 全方角 |
| 3 | AI 在 sidebar drawer / chatbot | ✅ AI 不在本 mockup 主体（本 mockup 是 lineage graph，不是 AI demo） |
| 4 | emoji 当 icon | ✅ ASCII `↓` glyph 不算 emoji |
| 5 | status pill 4 色 | ✅ 没有 |
| 6 | data table | ✅ differentiation 仍 hairline-list |
| 7 | 单语降级 | ✅ 双语字典严格 1:1 |
| 8 | provenance popup | ✅ 本 mockup 没 provenance（不是 demo AI 的 mockup） |
| 9 | stock photo / 3D 插画 | ✅ 3 张新 SVG 均原创 |
| 10 | dark mode 用 slate | ✅ v4 仍 light only |
| 11 | 字号 < 11px 或行高 < 1.4 | ✅ 最小 11px |
| 12 | focus 用 box-shadow | ✅ 没有 |
| 13 | keystroke 反馈 > 100ms | ✅ mockup 静态 |

## 8 · 透明风险记录（用户必须明示接受）

**风险 A — sell vaporware**：Wave D-4 UI（`/discover` / `/translate` /
`/manuscript` / `/network` 4 surface）还没做、Wave D-5 dogfood gate
（30 天 jili 自用 ≥ 5 Night artifact/周 + ≥ 2 Bridge/周 + 6 交互流至少
触发 4 种）还没跑。首页 sell"三层等价" → 访客 signup 进来发现**没有
显式的三层 UI surface**，只有 Day 层（现有 `/docs` `/editor`）。

**缓解**：v4 spec §1 已把文案口径改成"我们认为科研是三层的（哲学立场，
永真）+ 我们正在为这造工具（进行时）"，而不是"已有三层 surface 给你
用"。但**研究者从 Hero 看到 mockup 后会期待 signup 后能用到**——这个
gap 必须在 ADR-0020 Wave D-4 落地前显式管理（比如 signup 后给一个
"目前 Day 层已可用，Night/Bridge 在 beta / 仅 dogfood 邀请"提示）。

**风险 B — Triadic 是 Proposed**：ADR-0020 Status: Proposed，Wave D-5
dogfood gate 跑通后才 promote 到 Accepted。**Proposed 状态期间把它作
首页主叙事 = 战略外露**。如果 dogfood gate 失败（jili 自己用不顺手），
v4 文案需要回退；Day 层 commodity 叙事可能重新有合理性。

**风险 C — 受众错配**：Council Contrarian 第一次评议里说的"普通研究者
打开后 onboard 不下去"风险，v4 比 v3 更大——因为 v4 sell 的是哲学颠覆
而不是 commodity 功能，普通研究者第一反应可能是"我不知道这是干嘛的"。
v4 的吸引力主要来自**已经在做 cross-domain / unconventional research
的人**，对纯 publish-or-perish 模式的研究者反而可能反感。

**用户做选择**：

- **A. 接受 v4 全部风险**，照本 spec 落地 → 进 superpowers:writing-plans
- **B. v4 保 hero 颠覆叙事，但 Pillars 退到"我们正在造，目前 Day 层
  可用"** → 我修订 spec §3.3 pillar 3 改成 "已可用 vs 在做" 区分
- **C. 等 Wave D-4 UI ship 后再 ship v4 首页** → spec 不动，时序后推
- **D. 用 v4 颠覆叙事但 fallback 一些 v3 的 commodity 文案**（双重定位
  伞）→ 我修订 spec 把"AI 帮你查文献"等 v3 文案作 second-fold 节加回
  来作过渡

## 9 · Trade-off 明示

| 选项 | 我们选 | 没选 | 没选的理由 |
|---|---|---|---|
| 项目定位 | 三层等价知识产出系统（ADR-0020） | "AI-native 协作论文平台"（v1/v2/v3） | ADR-0020 §1.1 已否决 Iteration 1 = commodity |
| 首页 sell 的对象 | 颠覆性世界观（论文不是科研全部） | 产品功能列表 | 用户明确"颠覆性 / 基于未来 / 吸引人" |
| Mockup 内容 | 三层 lineage graph (Night → Bridge → Day) | AI 改论文 + provenance（v2/v3） | v2/v3 mockup 是 Day 层视角，不反映新定位 |
| Hero 文案 | 「论文不是科研的全部」 | 「用 Markdown 写论文，AI 帮你查文献」（v3） | v3 H1 把项目定位为 Overleaf 替代品 |
| Specimens | 3 张全新 Night/Bridge/Lineage SVG | 复用现有 typst/timeline/dag SVG | 现有 3 张都是 Day 层视角，不符 v4 定位 |
| 项目术语处理 | 全部翻译为大白话 | 用 "Triadic / Night Science" 学术语 | 用户明确"标准、大家可以理解的语言" |
| /demo 公开路由 | 不进本 spec | 加进来 | Phase 5 W11 单独 gate；Wave D-4 未落地 |
| 风险管理 | spec §8 明示 3 个风险 + 4 个用户选项 | 默默接受 | 这是首页战略 + 哲学定位级别决策，必须用户明示 |

## 10 · 后续（不在本 spec）

- `/demo` 公开路由：Phase 5 W11
- Wave D-4 UI（`/discover` / `/translate` / `/manuscript` / `/network`
  4 surface）：Phase 5 W9-W10（ADR-0020 §2.7）
- 5 秒识别测试数据回灌：v4 ship 后第 2 周做
- 真实用户访谈"对三层等价的反应"：v4 ship 后第 4 周
- 若 ADR-0020 Wave D-5 dogfood gate 失败 → v4 文案紧急回退到 v3 的
  "commodity + 大白话"版本（保留为 git history，回退用 ~1h）
