# 角色评审 · Editorial Designer + 排版工程师

> 评审对象：第一性原理 #4（中英双语一等公民）+ #7（编辑/杂志气质，反 SaaS 反模式）。
> 评审日期：2026-05-10。基线：Phase 4 W4 closeout（D12 渲染三剑客 + W4 dashboard UI + settings 双页落地后）。

---

## 1. 已经做对的设计护城河

**1.1 字体栈是真锁定的，不是 Inter 兜底**
`packages/typography/src/font-tokens.ts:28-58` 把 SC/TC 双链分开建：`Source Han Serif SC → Songti SC → Noto Serif CJK SC` 落正文，繁体走 `Source Han Serif TC`。Latin-primary 文档里 CJK 家族**仍挂在链上**（line 81-86），保证英文论文里突然冒出的"研究者"四个字不会变 fallback 方块。`apps/web/src/app/globals.css:14-18` 把同一条链铺到 web app `:root`。**这是项目里最 editorial 的一段代码**——比任何 UI tweak 都重要。

**1.2 双管线都消费同一个 typography pre-pass**
`render-myst/src/{html,jats,docx}.ts` 和 `render-typst/src/source-from-pm.ts` 全部 `import { applyCjkSpacing, smartQuoteByLang, getFontTokens, fontTokensToCss/Typst } from '@collaborationtool/typography'`。Typst preamble (`source-from-pm.ts:62-66`) 还显式 `set text(lang: "zh", region: "cn", font: ...)` —— 这是 Typst CJK 排版的标准做法，多数项目都漏。HTML emitter (`html.ts:52-54`) 给 body / heading / mono 三档分别铺 token。**两端一致** = "中文凑合一下/英文凑合一下"那一类裂缝在源头堵掉。

**1.3 引号智能化按 script 分而非按文档**
`smart-quote-by-lang.ts:99-108` 用 ±8 字符 window 跑 `classifyText`，CJK 行用全宽 `“ ” ‘ ’`，英文行用 curly EN，identifier (`x86_64`) 保留 ASCII。这恰好是 proto-b/findings.md §3.4 列的 mystmd `smart` 扩展破坏 mixed-script 的根因 —— 项目自己写了个对的版本。

**1.4 specimen 是真试金石**
`apps/web/public/demo/specimen-bilingual.md` 一段里同时有：MyST `{cite}` 全宽句号、`$\mathcal{L}$` block 公式、Python fence、`图 1 / Figure 1` 双语 caption、`损失函数` 中英混排嵌 inline math。配 D15 验收"4 格式导出 PASS"（STATUS:99） —— 这不是声明，是回归基线。

**1.5 反 SaaS 反模式落地度可量化**
跑 grep 实测 `apps/web/src`：
- `bg-blue-500/600/700`：**0 命中**
- `rounded-lg / rounded-xl / rounded-2xl`：**0 命中**
- `shadow-sm/md/lg/xl`：**0 命中**
- 排前 4 的色 token：`text-zinc-500 (49) / border-zinc-300 (40) / text-zinc-700 (34) / border-zinc-200 (23)` —— 全 zinc 中性灰
- accent 是 `bg-zinc-900` 黑（CTA），不是蓝
- 唯一彩色是 ORCID 官方绿 `#a6ce39`（`(app)/layout.tsx:51` 引用 ORCID brand），算正确品牌引用而非装饰

**这是非常严格的纪律**——比绝大多数 Tailwind 项目克制 10 倍。

---

## 2. 正在滑向 SaaS 反模式的信号

**2.1 globals.css 仍是 Phase 1 baseline**
注释自承 "Phase 1 keeps this minimal so the auth flow + docs list don't look broken but we also don't pre-bake a design system we'll throw away"（globals.css:3-5）。Phase 4 已经完成了，这块 baseline 没有 promote。**风险**：editorial 实际只活在 export 物（HTML/Typst PDF）里，**web app 本身仍是中性 zinc 工具气**——研究者打开应用看到的不是 Stripe Press，是 GitHub Settings。

**2.2 settings + maintenance 已经是"通用管理后台"骨架**
`(app)/settings/{plugins,models}/page.tsx` 和 `(app)/maintenance/page.tsx` 全是 `divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white` 列表 + emerald/amber/red badge。
- maintenance: severity 用 `bg-red-100 / bg-amber-100 / bg-blue-100`（page.tsx:38-42）—— 这是 Tailwind 默认色板，**不是项目自己的 editorial token**。`info` 用蓝色违反 #7 的精神（虽然不是 #3B82F6 而是 100 档）。
- plugins: `bg-emerald-100 text-emerald-900`（plugins/page.tsx:172-176）+ `bg-amber-100`、`bg-red-50` —— 与 maintenance 各打各的，没有 token 化。

**2.3 H1 用 serif 但 body 没有 hierarchy**
globals.css:36-43 只让 h1-h4 切 serif；正文 sans。所有 page 用 `text-3xl font-medium` 标题 + `text-sm text-zinc-500` 副标题，**完全没有 small caps / drop cap / measure / serif body 段** —— editorial 气质在 export 物里有，在 app shell 里**0**。

**2.4 ligatures / 可变字体 / hyphenation 没看到**
`font-feature-settings: 'cv01' on, 'cv11' on'`（globals.css:26-29） —— 这是 Inter 的 stylistic alt，但项目并没有引入 Inter（fallback 走 system-ui）。这两行**几乎不起作用**。`hyphens: auto`、`text-wrap: pretty`、`font-variant-numeric: tabular-nums` 一个都没。

**2.5 CJK 字体打包未到位**
font-tokens.ts:9-11 注释承诺 "Phase 1 production: docker images install Source Han Serif/Sans + Noto Sans CJK so the FIRST entry always lands"。**没有验证**这条 docker COPY 真在 `infra/docker/` 里跑（typography 包测试只测 token chain string）。Demo 部署 / SELF_HOST 用户拉镜像，第一档 miss 就降级到 PingFang —— Linux 服务端没有 PingFang —— 再降到 Noto，行高、字重不一致。建议：加 `pnpm typo:fontcheck` 脚本，启动时探测 `fc-list` 命中 Source Han 的字面证据。

**2.6 `print(energy(...))` specimen 但没 print specimen**
specimen-bilingual.md 有 markdown 源，但 `apps/web/public/demo/` 没有提交 PDF render 的视觉证据（VP 截图 / 渲染 snapshot）。设计回归靠肉眼，目前是脆的。

---

## 3. specimen 实测

specimen-bilingual.md 第 9 行：

> ...的 Yjs CRDT design from {cite}`10.48550/arXiv.2310.06770`。开放评审场景的可信度问题参照 {cite}`...`。

`{cite}` 后紧跟全宽句号 `。` —— `applyCjkSpacing` 看 `\`` (Latin-ish) 与 `。`（CJK 标点 0x3002），不在 isHanCharacter / isAsciiLetterOrDigit 任一类（language.ts:34-40），**所以不插空格**——结果对的（CJK 标点不应空格）。但 line 11 `dataset {cite}\`...\`.` 后是 ASCII 句号，前一个 token 是 backtick + 半宽 ASCII，**也不插**——同样对。但下面 line 31 `{cite}\`...\`。Phase 1 D15 验收要求双语样张...` —— `Phase` 前 `。` 是全宽 CJK 标点，规则 boundary = `(prevHan && curLatin) || (prevLatin && curHan)`，**全宽标点不算 Han 也不算 Latin**，**这里漏插空格**。视觉上"。Phase"会贴一起。

**Bug 等级**：cjk-spacing.ts 没把 CJK 标点纳入"伪 Han"集合做 boundary。修法 1 行：boundary 加 `(isCjkPunct(prev) && curLatin) || (prevLatin && isCjkPunct(cur))` —— 用上 language.ts:27 已经写好的 `isCjkPunctuation`。

---

## 4. editorial 气质 vs 工具气质 —— 当前位置

**渲染管线（export）**：8/10 editorial。font token + lang region + CJK pre-pass + Typst justify+leading 是 Distill 级别。

**web app shell**：4/10 editorial，6/10 工具气。当前是"克制版 GitHub Settings"——做对了反 SaaS 一半（无蓝、无圆角卡），但没做正向 editorial（无 serif body、无 measure 优化、无 chrome typography）。从研究者打开 app 的瞬间看不到杂志气。

**下一步该往 editorial 推 0.5 档，不是 1 档**。研究工具不是 Distill（每页都是动态文章），是 Stripe Press dashboard——大量元数据、列表、表单仍是 SaaS 形态，但**字体、留白、标点、分隔线**做到位即可。

---

## 5. 强化建议（设计层 · 5 条 ≤ 1 周成本）

**5.1 修 cjk-spacing 标点 boundary（4 行代码 + 1 测试）**
specimen 实测的 bug。`packages/typography/src/cjk-spacing.ts:44-46` 加 `isCjkPunctuation` 分支。优先级 P0。

**5.2 把 globals.css 升到 editorial token 第一版（1 天）**
- 加 `--measure: 38rem`（CJK 论文比 Latin 短 4rem）
- 加 `--leading-cjk: 1.75`、`--leading-latin: 1.65`，body `line-height: var(--leading-cjk)`
- 加 `font-feature-settings: 'palt' on, 'pkna' on, 'kern' on`（CJK 比例标点压缩）替换无效的 cv01/cv11
- 加 `text-wrap: pretty`、`hyphens: auto`、`font-variant-numeric: tabular-nums`
- body 切 serif（不只是 heading）；UI chrome 保持 sans

**5.3 共抽 severity / status badge token（半天）**
maintenance + plugins 各画各的颜色。抽 `apps/web/src/lib/badge-tokens.ts`：`severity → ring-1 ring-zinc-200 + bg-zinc-50` for low/info（**不要彩色**），`amber-50` for medium，`red-50` for high。info 必须不是蓝。

**5.4 字体可用性自检（半天）**
`pnpm typo:fontcheck` 脚本，启动时 `fc-list` grep `Source Han` 失败就 console.warn。docker 镜像加 `RUN apt-get install fonts-noto-cjk fonts-source-han-sans-cn`（如果还没）。SELF_HOST.md 加一节 "字体打包自检"。

**5.5 给 specimen 加一张 visual snapshot regression（半天）**
`tests/e2e` 加一条 `specimen.spec.ts`：build 完跑 specimen → HTML → playwright screenshot → 提交 baseline PNG 到 `tests/e2e/specimen-baseline/`。任何排版回归（多空格、引号错、字重塌）肉眼可见 diff。

---

## 6. 突出特色建议（README / landing / docs 截图）

**镜头 1：specimen-bilingual.md 的 Typst PDF 渲染上半页**（标题 + 双语摘要 + 第一段 inline math + 第一个 `{cite}`）—— 一帧讲清"中英 + 公式 + 引用 + serif body" 四件事。Typst justify + Source Han Serif + KaTeX 一起出现，这是 Curvenote/MyST 截图都做不到的画面。

**镜头 2：editor + maintenance 二联屏**（max-w-5xl 居中 + zinc-200 分隔线 + 中文 severity 徽章 "高/中/低/提示"）—— 不卖功能，卖"研究者后台不像 SaaS"的克制感。

**镜头 3：font-tokens.ts 的代码片段**（SC/TC 分链 + Latin-first 仍挂 CJK fallback）—— 给设计师看的"我们认真到这种程度"硬证据。比任何 marketing 文案有说服力。

**避免**：截 `(app)/layout.tsx` 的导航条（"文档 · Docs / 维护 · Maintenance / 设置 · Settings" 中英对照）—— 看着像翻译练习不像产品。

---

## 7. 总分

护城河（renderer 端）：A−。反 SaaS 纪律（web app 端）：B+。正向 editorial（web app 端）：C+。完成 §5 三条后整体可到 B+/A−。
