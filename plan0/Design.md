# Design.md

> Editorial · 局部优先 · 双语一等公民
>
> 本文档是 paper-platform 设计的 single source of truth。它来自 Claude
> Design 给出的 9-surface 低保真线框稿（`bundle TOywn3TlXABHckELmx7iLw`）
> 与 chat1.md 用户的最终决策。设计意图请回看
> [`plan0/claude-design-brief.md`](./claude-design-brief.md) 与
> [`plan0/paper-platform-system-prompt.md`](./paper-platform-system-prompt.md)。
>
> 实现请落到 `apps/web/src/app/globals.css` 的 `@theme inline` token，
> 不要在组件里硬编码颜色 / 字体 / 字号。

---

## 0 · 一句话

**编辑刊物气质（editorial），不是 SaaS 卡片。**
warm-paper 背景 · 体面的 serif · hairline rule 不要圆角填充框 · 单一沉静
accent · provenance 是布局不是 popup · 中英都是一等公民。

---

## 1 · 设计原则（决策时优先级）

照搬自 [`paper-platform-system-prompt.md`](./paper-platform-system-prompt.md) §一，
冲突时按上面顺序判断：

1. Local-first 优于云优先
2. Markup-as-source，WYSIWYM 呈现
3. AI 是协作者不是侧边栏（"协作动作"，不是 chat 框）
4. 中英双语都是一等公民
5. 可组合优于大一统
6. 延迟即设计（keystroke < 100ms / 公式 < 50ms / PDF < 5s）
7. 设计是产品的一部分（编辑/杂志气质，不是 SaaS 圆角卡片）
8. 文档是异构内容图，不是文字流
9. 协作是动词不是名词
10. 可演化性 > 当下完备
11. Provenance 即一等数据

设计层面对应的具体红线见 §11 reject criteria。

---

## 2 · Tokens（颜色）

线框稿 `--paper #f7f3ea` 被 chat 显式标为"warmer than spec, sketchbook tone"，
取了 brief 的 `#FBFAF7` 与之间——保留温暖但不至于发黄发旧。

| token | hex | 用途 |
|---|---|---|
| `--paper` | `#FBFAF7` | 主背景 / page bg |
| `--paper-2` | `#F2EEE4` | 次级面（block 引用、code block 框、chrome stripe） |
| `--paper-3` | `#E9E3D4` | canvas / focus overlay 背景 |
| `--ink` | `#1A1714` | 主文字（warm near-black） |
| `--ink-2` | `#4A443C` | 次级文字 / italic 译文 |
| `--ink-3` | `#8A8276` | 元信息 / caption / placeholder |
| `--hairline` | `rgba(26,23,20,0.10)` | 主分隔线（替代填充卡片） |
| `--pencil` | `#2B2823` | 重描边（按钮 / disc 边） |

### 2.1 Accent triad（语义化）

**只用一个 accent 一次。**禁止三个同框。

| token | hex | 语义 | 出现场景 |
|---|---|---|---|
| `--accent-ink` | `#1F3A5F` | AI / agent | 默认编辑器 chrome、`proposed` 状态、agent identity |
| `--accent-ox` | `#7B2D26` | human / 作者 / 同事 | 评论 / mention / claim-on-claim |
| `--accent-moss` | `#3F5B3A` | community / fork / 已 applied | community fork、`applied`、孤立公开链接 |

**默认 accent 是 ink-blue**（线框稿 Editor A 的选择，user 在 chat 里说
"editorial wins，OWL out"，未在 A/B/C 中钦定，但 A 是 chat 1.5 节给的
canonical 路径）。

### 2.2 不许出现的颜色

- 任何 `#3B82F6` / `#2563EB` / `#0EA5E9` 系列（chatbot blue）
- `bg-zinc-50/100/200` + 纯 `#fafafa` SaaS 卡片
- 彩虹 status pill（红/黄/绿/蓝/紫并排）
- pure black `#000` / pure white `#FFF`
- 任何 saturation > 60% 的颜色

---

## 3 · Tokens（字体）

### 3.1 字体栈

| 用途 | 栈 | 备注 |
|---|---|---|
| serif（CJK + Latin 正文 / 标题） | `'Source Serif 4', 'Newsreader', 'Source Han Serif SC', 'Noto Serif SC', Georgia, ui-serif, serif` | Latin 与 CJK 各取一族同源衬线，其它全是回退 |
| sans（chrome / 元信息） | `'Söhne', 'GT America', 'Source Han Sans SC', 'Noto Sans SC', system-ui, sans-serif` | OFL 部署时回退 SHS Sans + Noto |
| mono（代码 / TeX / DOI） | `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace` | |

### 3.2 字号阶梯（type ramp）

| token | family | size / line-height | letter-spacing | 用途 |
|---|---|---|---|---|
| `display` | serif | 80–84px / 1.05 | -0.01em | landing hero |
| `h1` | serif | 44px / 1.15 | -0.01em | docs list title / page title |
| `h2` | serif | 30px / 1.25 | -0.005em | doc title / 章节 |
| `h3` | serif | 20px / 1.35 | 0 | 子节 |
| `body-zh` | serif | 17px / 1.78 | 0 | CJK 正文 |
| `body-en` | serif | 17px / 1.7 | 0 | Latin 正文 |
| `lede` | serif italic | 19px / 1.55 | 0 | landing 副标题 |
| `ui-sans` | sans | 13px / 1.4 | 0 | chrome 文案 |
| `caption` | sans | 11px / 1.45 | 0 | 元信息 |
| `label-cap` | sans uppercase | 10px / 1.0 | 0.18em | 小标签（"§ 2 · formalism"） |
| `mono` | mono | 14px / 1.5 | 0 | 代码 / TeX / DOI / hash |

### 3.3 OpenType / 排印特性

正文与表格数字必须开 oldstyle figures：

```css
font-feature-settings: 'onum' 1, 'kern' 1;
```

CJK 与拉丁混排正文：

```css
font-feature-settings: 'palt' 1, 'pkna' 1, 'kern' 1;
```

CJK 标点必须半角化前/后压缩：「」 。， 不写成 `"".`

### 3.4 双语并排规则（一等公民）

- landing / docs list 标题：CJK 主、Latin 次以 italic 紧跟（同行）：
  `我的论文 · papers`
- 文档标题（doc card / breadcrumb）：CJK 主、Latin italic 副标紧贴下一行
- 正文：单一段落内 CJK Latin 自由混排，**不要在中间断行**
- accent / status / agent role：**双语并行**（"开始写作 · Start writing"）

---

## 4 · Tokens（间距 / 半径 / 描边）

### 4.1 间距 scale

8px base，但 vertical rhythm 按 22px / 32px 节拍走（line-height 1.78 ×
13px ≈ 23.1，圆到 22 / 32 对齐 fenced block）。

| token | px |
|---|---|
| `space-1` | 4 |
| `space-2` | 8 |
| `space-3` | 12 |
| `space-4` | 16 |
| `space-5` | 22 |
| `space-6` | 32 |
| `space-8` | 56 |
| `space-12` | 80 |

### 4.2 半径

**全局上限 4px。**
`--radius-1: 2px` / `--radius-2: 4px`。
任何 `rounded-lg / xl / 2xl / full` 在新代码里都是禁止的，唯一例外：

- 头像 / mono-disc：999px（圆形）
- pill：999px（小尺寸语义元素）
- 焦点环：与组件本身一致

### 4.3 描边

| token | 值 | 用途 |
|---|---|---|
| `--border-hairline` | `1px solid var(--hairline)` | 主分隔线 |
| `--border-pencil` | `1.25px solid var(--pencil)` | 描边按钮 / disc |
| `--border-rule-thick` | `1.5px solid var(--pencil)` | section 收束线 |
| `--focus-ring` | `2px solid var(--accent-ink)` outline | 焦点环（不要 box-shadow blur） |

---

## 5 · 组件清单

每个组件在 `apps/web/src/components/design/*` 实现一次，禁止散落硬编码。

### 5.1 Button

```
button-primary   ink fill / paper text / 2px radius / 1.25px inner border (none)
button-ghost     transparent bg / pencil 1.25px border / ink text
button-link      ink underline 0.4em offset / no border
```

不写 `bg-zinc-900` `bg-blue-600`——只用 `--ink` `--accent-*`。

### 5.2 Mono-disc（identity chip）

28px 圆形，`--paper-2` 背景，`--pencil` 1.25px 边，serif 600 单字母。
agent 用 `--accent-ink`，human 用 `--accent-ox`，community fork 用
`--accent-moss`。

### 5.3 Status pill

11–12px sans，999px radius，1px 同色边，无填充：

```
.pill-proposed   color/border: --accent-ink
.pill-applied    color/border: --accent-moss
.pill-blocked    color/border: --accent-ox
```

### 5.4 Provenance card

paper bg / 1.5px sketch border（非 SVG filter，普通 1px solid 即可）/ 3
节：

1. `label-cap` "provenance · ¶ N · {kind}"
2. mono-disc + actor name + 时间
3. 引号 italic 一句 commit 意图 / mono prompt block / 工具调用列表
   `tool · ms` / hash + model + cost

### 5.5 Citation popover

CrossRef-shaped：APA 字段（作者 / "标题" / Phys. Lett. B · 59(1) · pp.85–87
· 1975）+ DOI（mono，dotted underline accent）+ "Bind to claim · ¶N"
primary CTA + "Open" ghost。

### 5.6 Block hover-rail

行内 ¶ 左侧悬浮 4 个 22px sketch 方块 glyph：lock / propose / cite /
history。`opacity:0`，hover 整段 `opacity:0.85`。

### 5.7 Margin marginalia entry

`border-left: 2px solid var(--accent-*)` + 12px padding，
caption-cap accent-color actor + 时间，2 行 italic / cjk 描述，下方 pill
+ meta。

### 5.8 Hairline rule

`<hr class="rule">` = 1px hairline。`<hr class="rule-thick">` = 1.5px
pencil。**这是默认分隔器。**禁止 `<div class="card">` 卡片包裹。

---

## 6 · Layout grids

### 6.1 Editor A · Classic asymmetric（默认）

3 列 grid：`72px outline-rail | 1fr main(70ch) | 360px margin-rail`。

```
┌──────┬─────────────────────────────────┬──────────────┐
│ §nav │  § 2 · formalism · 形式化         │ margin · 边注 │
│      │  H2 · 30px serif                 │              │
│      │                                  │ ¶ Citation   │
│      │  ¶ 17px serif body, 70ch         │ ¶ Han Liu    │
│      │  ─ block hover rail ─            │ ¶ community  │
│      │                                  │ ─ active ─   │
│      │  eq · 2.4 (mono in --paper-2)    │ studio chips │
│      │                                  │              │
└──────┴─────────────────────────────────┴──────────────┘
```

main column padding：56px top/bottom · 80px right · 100px left（左侧
更多以让 hover-rail 浮在 padding 内）。

### 6.2 Editor B / C（变体，未默认实现）

- B `floating provenance`：单列 70ch 居中，paragraph 锚点 + 浮动 card
  +连线 svg + 右下 5-agent dock。`--accent-ox`。
- C `split-rail tabbed`：2 列 `1fr | 440px`，rail 内 4 tabs：Agent ·
  Citations · Threads · History。`--accent-moss`。

### 6.3 Landing

12-col 简化为 `1.1fr 0.9fr` 不等宽 hero：

- 左：eyebrow label-cap + display 84px CJK + 19px italic lede + 2 CTA
+ caption hint
- 右：preview block（"§2.3 mass term"）+ 紧贴的 marginalia 列（150px
fixed 列，2 entry，分别 ink-blue / oxblood，sup 引用脚标）
- 底：`Local-first · MyST · BYO · OFL` 4 项 hairline 内联

### 6.4 Docs list

12-col 简化为 `200px 1fr` 双栏：

- 左 aside：collections 列表（`borderLeft 1.5px ink` 标当前），language
filter, agents filter——纯链接，不要 dropdown
- 右 main：`H1 · 我的论文 · papers` + 元行 + search/new 行 +
  `<ol>` 索引（每行 4 列 grid: `40px 1fr 200px 160px` = 序号 + 标题/作者
  + 时间&agent + lang&status）
- 每行 hairline top + 22px padding-y，编号 `01..14` mono onum

### 6.5 5 个剩余 surface（M0 后续）

- /login + /signup：单 column `400px` + 右侧大字 specimen quote · ORCID
  CTA + email/password 折叠次级
- /docs/new：3-template 选择 + "import existing" 链接（typst / latex /
  myst / md）
- /maintenance：finding 表 = hairline list，6 类 finding 各自 mono-disc
  + accent-ink for new / moss for resolved
- /settings + /settings/models + /settings/plugins：tab navigation
  hairline，model adapter card（4 endpoint × 状态），plugin install
  capability prompt
- /orgs/new + /invite/[id]：与 docs list 同 chrome；invite 卡 paper-2
  + provenance "who invited / when / role / 期限"

---

## 7 · 9 surfaces 准则（priority 排序）

1. **Landing /** — 编辑刊物 hero · 不要 hero gradient · 公开陌生人就要
   被排版震一下
2. **Login·Signup /(auth)/** — ORCID 优先按钮 + email fallback · 不要
   两个等权 column
3. **Docs list /docs** — 索引页气质 · 不是 SaaS table
4. **/docs/new** — 模板选择 + import existing
5. **Editor /editor/[docId]**（centerpiece） — Editor A，详 §6.1
6. **Maintenance /maintenance** — finding list，6 类 finding
7. **Settings /settings(+/models +/plugins)** — tab 不卡片
8. **/orgs/new** — 同 docs chrome
9. **Invite /invite/[id]** — provenance 卡片即 invite 卡片

---

## 8 · AI-as-collaborator pattern

线框稿 chat 强调"AI 是动词，不是侧边栏"。落到 UI：

- **不要** chat bubble drawer。
- **要** AI verb-menu 按钮：editor top chrome 右上 "AI · ⋯" 触发
  inline-agent-menu（line 5 个动词："cite this · review · find sources
  · translate · maintain"）。
- **要** propose/apply 二元状态：dashed underline = proposed / 实线
  applied / line-through = struck out。
- **要** identity chip 一律 mono-disc 风格（"YW" / "C" / "R"）。
- **要** quota + interrupt：每 agent 显示 `7 / 25 tool calls today`
  + 一个 pause icon button（ADR-0008 强制）。

---

## 9 · Provenance reveal（delight moment）

**唯一被 chat 钦定的"动效"，必须做。**

3 状态：

| state | 视觉 |
|---|---|
| ① idle | 段落静止，无 chrome；hover 浮出左侧 2px hairline tick |
| ② click | tick 变为 8px 圆 + soft halo（`--accent-ink` 18% alpha）· 段落 bg `--accent-ink` 5% alpha · 180ms ease |
| ③ unfolded | 280px provenance card 从右 margin 滑入：actor + prompt + tool calls + hash + model + cost |

动效曲线：`cubic-bezier(0.2, 0, 0, 1)`，180ms。**不要 spring，不要
bounce。**

---

## 10 · Latency / motion

| 操作 | 上限 |
|---|---|
| keystroke → 屏幕反馈 | 100ms |
| 公式 KaTeX render | 50ms |
| PDF export → blob | 5s |
| transition / animation 默认 | 180ms ease-out |
| transition / animation 上限 | 240ms |
| respect `prefers-reduced-motion` | 必须 |

**typographic hover before chromatic.** 先变字重 / italic / underline
offset，再考虑变颜色。

焦点环：2px outline `--accent-ink`，不要 box-shadow blur 圈。

---

## 11 · Reject criteria（违反即 P1）

如果你看到下列任意一条，**回头改**，不要 ship：

1. `bg-blue-500/600` 或任意 saturation > 60% 的颜色
2. `rounded-lg` `rounded-xl` `rounded-2xl` `rounded-full`（除头像 / pill）
3. AI 出现在 sidebar drawer 里、像 chatbot
4. emoji 当 icon（🚀 ✨ 📚 ❤️ 🎯）
5. status pill 有红黄绿蓝四色齐发
6. data table（DataGrid 风），不是 hairline list
7. 一行只有 CJK 或只有 Latin 而对应另一语言区域有翻译
8. provenance 出现在 popup / tooltip 而不是布局里
9. landing hero 用 stock photo / illustrated 3D
10. dark mode 用 slate（`#0F172A`）；当前阶段 light only，dark 留 v2
11. 字号低于 11px、行高低于 1.4
12. 焦点态用模糊 box-shadow 圈不用实线 outline
13. 任何 keystroke → 屏幕反馈 > 100ms 的输入交互

---

## 12 · 实现指南

### 12.1 Tokens 落到代码

`apps/web/src/app/globals.css` 用 Tailwind v4 `@theme inline`：

```css
@theme inline {
  --color-paper: #FBFAF7;
  --color-paper-2: #F2EEE4;
  --color-ink: #1A1714;
  --color-accent-ink: #1F3A5F;
  /* ... */
  --font-serif: 'Source Serif 4', 'Source Han Serif SC', ...;
  --font-sans:  'Söhne', 'Source Han Sans SC', system-ui, ...;
  --font-mono:  'JetBrains Mono', ui-monospace, ...;
}
```

JS 里读取走 CSS var：`color: 'var(--color-accent-ink)'`，禁止
`'#1F3A5F'`。

### 12.2 字体加载

- dev：Google Fonts API（`Source Serif 4` + `Noto Serif SC` + `Noto Sans SC` +
  `JetBrains Mono`）
- prod：自托管 OFL（Source Serif 4 + Source Han Serif SC + Source Han
  Sans SC + JetBrains Mono），`@font-face` `font-display: swap`
  + `unicode-range` 切 CJK 与 Latin

### 12.3 编辑器排版

`packages/typography` 已经在 Phase 1 做 CJK pre-pass。新 token 不要绕过
那一层，而是把它的输出 token 化（"font-family: var(--font-serif)"）。

### 12.4 dark mode

**v1 不做。**留 `--color-bg / --color-fg` token 接口在 globals.css，但
dark 类下的 token 值 `TODO v2` 占位即可。Reject criteria #10 的"slate"
警告是给 v2 做的（届时 warm-deep，不是 slate）。

---

## 13 · 与 wireframe 的差异（合理偏离）

| 项 | wireframe（low-fi） | 生产 |
|---|---|---|
| paper | `#f7f3ea`（sketchbook tone） | `#FBFAF7`（chat brief 中间值，更亮） |
| filter `wob` 抖动 | 用 SVG `feTurbulence` + `feDisplacementMap` | **不用**——production 不要 sketchy effect，纯几何线 |
| `Kalam` / `Caveat` 手写字体 | 全局 chrome | **不用**——chrome 用 sans，正文用 serif |
| `tape` / `coffee` ring 装饰 | landing 角落 | **不用**——只在 docs list 里偶尔 1 处 `--paper-3` 圆形 stain 作 visual |
| `sketch` 1.5px wob border | 通用 | 普通 `1.25px solid var(--pencil)`，**filter:url(#wob) 删掉** |
| icon | 手画 stroke glyph | Phosphor `bold` 1.4px stroke |

### Phase 1 做不到 / 推迟到 Phase 2 的

- 段落 hover-rail（lock/propose/cite/history）— 等 doc-store W7.1 暴露
  block ID 后接
- 公式 KaTeX render（已在 ai-runtime / editor 接 KaTeX，未在 globals
  里调字号）— Phase 2 W6 import-typst / latex 同期接
- provenance card 三状态动效 — Phase 4 W7.2 完成后接

### Phase 1 必须做（本次 ship）

- [x] tokens：颜色 / 字体 / 间距 / 半径在 globals.css
- [x] Landing：从 zinc-only 重写到 paper + serif + accent-ink
- [x] Docs list：从 SaaS table 重写到 hairline list
- [x] 编辑器 chrome：top bar + breadcrumb + AI verb menu + collaborators

---

## 14 · 不做的事（Phase 1）

- 不写 dark mode（reject #10 提的"warm-deep"v2 再说）
- 不引入 shadcn/ui（与本设计的 design vocabulary 互斥）
- 不引入 Framer Motion / GSAP（180ms ease 用 CSS 即可）
- 不做 illustrated icon set（Phosphor `bold` 即可）
- 不做 hero gradient / glow / blur effect
- 不做 marketing animation（particle / scroll-jacking）

---

## 15 · 如何验证

每次动 design 之后：

```
pnpm web:typecheck     # 必须 PASS
pnpm web:test          # globals + landing snapshot 必须不破
pnpm web:dev → http://localhost:3000
```

肉眼检查：

1. landing 主背景 是 `#FBFAF7` 不是 `#fafafa`
2. hero h1 是 serif onum 不是 sans
3. CTA primary 按钮是 `--ink` 不是 `bg-zinc-900` 也不是 `bg-blue-600`
4. docs list 是 hairline list 不是 table 不是 grid card
5. accent 一屏只出现一次（AI 用 ink-blue OR human 用 oxblood OR
   community 用 moss）
6. focus 状态是 2px outline 不是 box-shadow blur

---

## 16 · 来源 / 修订

- 2026-05-11 v1：从 Claude Design bundle `TOywn3TlXABHckELmx7iLw`
  提炼。Editor A 作为默认实现路径。Phase 1 必做项目落地。
- 上游线框：`/tmp/claude/cdesign-paper/extracted/.../project/Wireframes.html`
- chat 决策：`chats/chat1.md`（中文 lead / editorial wins / OWL out / light
  only / accent triad / provenance reveal as delight moment）
- 设计 brief：[`plan0/claude-design-brief.md`](./claude-design-brief.md)

修订时同步：`apps/web/src/app/globals.css` token block + `STATUS.md` §2
ADR 表（如新增 ADR-0017 设计系统）+ 本文件 §16。
