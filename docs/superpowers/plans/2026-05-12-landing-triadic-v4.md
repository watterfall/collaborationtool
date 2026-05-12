# Landing v4 — Triadic Architecture Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web` 首页从"AI 协作论文工作台"重定位到"三层等价知识产出系统"（ADR-0020 Triadic Architecture），首页 sell 颠覆性世界观"论文不是科研的全部"，全文案大白话化，对齐 client-first pivot 桌面端为主叙事。

**Architecture:** 文件层 i18n source-of-truth（zh.ts 是源，en.ts 走 i18n.test.ts shape parity 自动校验），首页结构层 `apps/web/src/app/page.tsx` + `apps/web/src/components/landing/Landing.tsx` + 新组件 `TriadicMockup.tsx`。文案改在 locales，结构改在 Landing.tsx + TriadicMockup。3 张新 SVG 作 specimens。**所有 8 个 Task 都通过 `apps/web/tests/landing.test.ts` 的 contract 断言；任何 task 完成后 `pnpm web:typecheck` + `pnpm web:test` 必须 PASS。**

**Tech Stack:** Next.js 15 App Router（Server Components），TypeScript strict，Tailwind v4，node:test + tsx 测试，`@theme inline` token system（Design.md §12.1）。

**Spec:** `docs/superpowers/specs/2026-05-12-landing-directness-design.md`（v4，已 user 接受全部风险）

---

## File Structure

**Modify：**
- `apps/web/src/lib/i18n/locales/zh.ts:41-141`（landing 节，整段重写）
- `apps/web/src/lib/i18n/locales/en.ts:41-141`（landing 节，整段重写，shape 必与 zh.ts parity）
- `apps/web/src/components/landing/Landing.tsx`（整文件重写：hero 2 列 + 3 pillar + attribution 节 + specimens 3 新图 + differentiation 5 行 + architecture 3 方）
- `apps/web/tests/landing.test.ts`（contract 断言全部改为 v4）

**Create：**
- `apps/web/src/components/landing/TriadicMockup.tsx`（新组件，Hero 右半三层 lineage graph）
- `apps/web/public/demo/landing-specimen-night.svg`（新 SVG，Night artifact 实物）
- `apps/web/public/demo/landing-specimen-bridge.svg`（新 SVG，Bridge artifact 实物）
- `apps/web/public/demo/landing-specimen-lineage.svg`（新 SVG，三层 lineage graph）

**Untouched（但被消费）：**
- `apps/web/src/app/page.tsx:1-79`（server redirect + metadata 逻辑不动；只依赖 `t.landing.meta.title/description` 字段值变化）
- `apps/web/src/lib/i18n/types.ts`（`LocaleDict = Widen<typeof zh>` 自动跟随 zh.ts 改）
- `apps/web/tests/i18n.test.ts`（自动 walk zh/en shape parity，零改动；任何 task shape 不齐它自动报错）
- `apps/web/public/demo/landing-specimen-typst.svg` / `landing-specimen-timeline.svg` / `desci-review-pilot-fig1.svg`（v3 specimens；不删，留作历史；不再被 Landing.tsx 引用）

---

## Task 1: Hero locale 重写 + Landing.tsx hero typography 升档

**Files:**
- Modify: `apps/web/src/lib/i18n/locales/zh.ts:41-77`（`landing.meta` + `landing.hero` 整块）
- Modify: `apps/web/src/lib/i18n/locales/en.ts:41-77`（镜像）
- Modify: `apps/web/src/components/landing/Landing.tsx:36-76`（hero section: eyebrow / H1 / tagline / CTAs / 辅助说明）
- Modify: `apps/web/tests/landing.test.ts:67-77`（hero 断言重写）

**Goal of this task:** Hero 文案 + 字号巨号升档，先不动 mockup（mockup 是 Task 3）。Hero 仍单列，Task 3 再切 2 列。

### - [ ] Step 1.1: Update zh.ts landing.meta + landing.hero

替换 `apps/web/src/lib/i18n/locales/zh.ts` 第 41-77 行整块为：

```ts
  landing: {
    meta: {
      title: '三层等价的知识产出系统 · 桌面端为主',
      description:
        '论文不是科研的全部。想法、原型、论文 — 三个空间，等价对待。3am 想到的隐喻、餐桌上的争论、最后没用上的草图 — 也都是科学。桌面端为主，数据存在你电脑上，开源可自托管。',
    },
    hero: {
      eyebrow: '三层等价的知识产出系统 · 桌面端为主',
      headline: '论文不是科研的全部。\n想法、原型、论文 —\n三个空间，等价对待。',
      sub: '3am 想到的隐喻 · 餐桌上的争论 · 最后没用上的草图 — 也都是科学。',
      tagline: '桌面端为主 · 数据存在你电脑上 · 开源 · 可自托管',
      ctaPrimary: '开始用',
      ctaSecondary: '怎么装到自己电脑',
    },
```

注意：H1 用 `\n` 字面（不是 `<br>`）；Landing.tsx 用 `whitespace-pre-line` class 解析。

### - [ ] Step 1.2: Mirror to en.ts

替换 `apps/web/src/lib/i18n/locales/en.ts` 第 41-77 行整块为：

```ts
  landing: {
    meta: {
      title: 'A three-layer system for what science actually produces · desktop-first',
      description:
        "Papers are not the whole of science. Ideas, prototypes, papers — three spaces, treated equally. The 3am metaphor, the dinner argument, the sketch you never used — these are science too. Desktop-first, data on your machine, open-source and self-hostable.",
    },
    hero: {
      eyebrow: 'A three-layer system for what science actually produces · desktop-first',
      headline: 'Papers are not the whole of science.\nIdeas, prototypes, papers —\nthree spaces, treated equally.',
      sub: 'The 3am metaphor · the dinner argument · the sketch you never used — these are science too.',
      tagline: 'Desktop-first · data stays on your machine · open-source · self-hostable',
      ctaPrimary: 'Start',
      ctaSecondary: 'How to self-host',
    },
```

### - [ ] Step 1.3: Rewrite landing.test.ts hero assertions

替换 `apps/web/tests/landing.test.ts` 第 41-94 行：

- 删 `zh.landing.meta.description` 含 `本地优先` / `双语|中英` 断言（lines 59-60）
- 删 `en.landing.meta.description` 含 `local-first` / `bilingual` 断言（lines 62-63）
- 删 `zh.landing.hero.sub` 含 `本地优先` / `AI` / `协作者` 断言（lines 68-71）
- 删 `en.landing.hero.sub` 含 `Local-first` / `AI` / `collaborator` 断言（lines 73-76）
- 删 `pillars` 四子键迭代断言（lines 85-93）—— Task 2 重写

新增断言（v4 contract）：

```ts
describe('landing — v4 meta is bilingual + carries triadic positioning', () => {
  it('includes zh title + en title + zh description + en description', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'app/page.tsx'),
      'utf8',
    );
    assert.match(src, /zh\.landing\.meta\.title/);
    assert.match(src, /en\.landing\.meta\.title/);
    assert.match(src, /zh\.landing\.meta\.description/);
    assert.match(src, /en\.landing\.meta\.description/);
  });

  it('zh meta description carries the triadic-positioning claim', () => {
    // v4: 三个空间等价 + 桌面端为主（替代 v3 的 "本地优先"）
    assert.match(zh.landing.meta.description, /三个空间/);
    assert.match(zh.landing.meta.description, /桌面端|本地/);
  });

  it('en meta description carries the triadic-positioning claim', () => {
    assert.match(en.landing.meta.description, /three spaces/i);
    assert.match(en.landing.meta.description, /desktop-first|local/i);
  });
});

describe('landing — v4 hero copy (triadic positioning)', () => {
  it('zh headline opens with "论文不是科研的全部"', () => {
    assert.match(zh.landing.hero.headline, /论文不是科研的全部/);
  });
  it('zh headline mentions 想法、原型、论文 three spaces', () => {
    assert.match(zh.landing.hero.headline, /想法/);
    assert.match(zh.landing.hero.headline, /原型/);
    assert.match(zh.landing.hero.headline, /论文/);
  });
  it('en headline opens with "Papers are not the whole of science"', () => {
    assert.match(en.landing.hero.headline, /Papers are not the whole of science/i);
  });
  it('en headline mentions ideas, prototypes, papers', () => {
    assert.match(en.landing.hero.headline, /Ideas/i);
    assert.match(en.landing.hero.headline, /prototypes/i);
    assert.match(en.landing.hero.headline, /papers/i);
  });
  it('zh hero sub mentions 3am + 隐喻 / 草图 etc. (specific imagery)', () => {
    assert.match(zh.landing.hero.sub, /3am|隐喻|草图|争论/);
  });
  it('en hero sub mentions 3am + metaphor / sketch (specific imagery)', () => {
    assert.match(en.landing.hero.sub, /3am/);
    assert.match(en.landing.hero.sub, /metaphor|sketch|argument/i);
  });
  it('zh hero tagline mentions 桌面端 + 自托管', () => {
    assert.match(zh.landing.hero.tagline, /桌面端/);
    assert.match(zh.landing.hero.tagline, /自托管/);
  });
  it('en hero tagline mentions Desktop-first + self-hostable', () => {
    assert.match(en.landing.hero.tagline, /Desktop-first/i);
    assert.match(en.landing.hero.tagline, /self-hostable/i);
  });
  it('zh ctaPrimary is "开始用"', () => {
    assert.equal(zh.landing.hero.ctaPrimary, '开始用');
  });
  it('en ctaPrimary is "Start"', () => {
    assert.equal(en.landing.hero.ctaPrimary, 'Start');
  });
});
```

保留 line 25-39 redirect / 96-101 Landing component shape 断言（不改）。

### - [ ] Step 1.4: Run tests — expect FAIL (Landing.tsx 仍然 render v3 hero strings + tagline field 未被 render)

```bash
cd /Users/jili/Documents/GitHub/collaborationtool
pnpm web:test
```

Expected: shape parity test PASS（zh + en 字段都加了 tagline），但 Landing.tsx 还没用 tagline，i18n.test 也只检字段非空——所以可能直接 PASS。这里步骤的意义在于：landing.test.ts 的新断言依赖**字符串值**而非 render，所以 update locale 完即 PASS。

如 i18n.test.ts shape parity 报错"missing key tagline in en" → 复查 Step 1.2 en.ts 是否漏 `tagline`。

### - [ ] Step 1.5: Update Landing.tsx hero section

替换 `apps/web/src/components/landing/Landing.tsx` 第 36-76 行 hero `<section>`：

```tsx
      {/* Hero — v4 triadic positioning. H1 巨号 display serif，
          拆 3 行（whitespace-pre-line 解析 \n）。tagline 是新字段，
          放在 H1 + sub 之间。Mockup 在 Task 3 加，本 task hero
          仍单列。 */}
      <section className="flex flex-col gap-6">
        <p className="label-cap">{hero.eyebrow}</p>
        <h1
          className="whitespace-pre-line font-serif text-5xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-6xl lg:text-7xl"
          style={{ color: 'var(--color-ink)' }}
          data-prose="bilingual"
        >
          {hero.headline}
        </h1>
        <p
          className="max-w-prose font-serif text-lg italic leading-[1.55] sm:text-xl"
          style={{ color: 'var(--color-ink-2)' }}
          data-prose="bilingual"
        >
          {hero.sub}
        </p>
        <p
          className="font-sans text-sm leading-[1.6]"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {hero.tagline}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn-primary">
            {hero.ctaPrimary}
          </Link>
          <a
            href={`${REPO_URL}/blob/main/docs/SELF_HOST.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            {hero.ctaSecondary}
          </a>
        </div>
      </section>
```

注意：
- `data-prose="bilingual"` 保留（typography 的 CJK pre-pass 走它）
- 旧的 micro copy "本地优先 · Markdown / MyST / Typst 为源文件 · ORCID 登录" 行（line 69-74）**删掉**——tagline 字段已经替代
- `eyebrow` 字段是已有的 v3 字段，v4 改了字符串值（"vol. 01 · issue 00 · pre-release" → 新值），结构不变

### - [ ] Step 1.6: Run typecheck + tests

```bash
pnpm web:typecheck
pnpm web:test
```

Expected: 两者均 PASS。

### - [ ] Step 1.7: Commit

```bash
git add apps/web/src/lib/i18n/locales/zh.ts \
        apps/web/src/lib/i18n/locales/en.ts \
        apps/web/src/components/landing/Landing.tsx \
        apps/web/tests/landing.test.ts
git commit -m "$(cat <<'EOF'
P5(landing-v4 T1): hero locale + typography — triadic positioning

- zh+en landing.hero / landing.meta 整段重写：
  - H1: "论文不是科研的全部 / 想法、原型、论文 / 三个空间，等价对待"
  - sub: "3am 隐喻 · 餐桌争论 · 最后没用上的草图 — 也都是科学"
  - 新增 tagline 字段：桌面端为主 · 开源 · 自托管
  - ctaPrimary "开始试用" → "开始用"
  - eyebrow 改 "三层等价的知识产出系统 · 桌面端为主"
- Landing.tsx hero H1 字号升档 text-5xl/6xl/7xl + leading 0.98 +
  tracking -2% + whitespace-pre-line
- landing.test.ts hero 断言重写为 v4 contract

ADR-0020 §2.1 三层等价对齐。spec §3.1 落地。Task 1/8。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pillars 重构 4→3 + 新增 attribution 节

**Files:**
- Modify: `apps/web/src/lib/i18n/locales/zh.ts`（landing.pillars 整块 + 新增 landing.attribution 顶层节）
- Modify: `apps/web/src/lib/i18n/locales/en.ts`（镜像）
- Modify: `apps/web/src/components/landing/Landing.tsx`（Pillar helper 删 `<pre>` ASCII 微图；render 3 pillars 而非 4；新增 attribution 节 render）
- Modify: `apps/web/tests/landing.test.ts`（pillar 断言重写）

**Goal of this task:** Pillars 从 4 个（editor/ai/provenance/bilingual）改为 3 个（thinking/prototyping/paper），删 4 个 ASCII 微图，新增 attribution 顶层节（"每一个想法都有名字"）。

### - [ ] Step 2.1: Update zh.ts landing.pillars + add landing.attribution

替换 `apps/web/src/lib/i18n/locales/zh.ts` 当前 `pillars: { editor: {...}, ai: {...}, provenance: {...}, bilingual: {...} }` 整块为：

```ts
    pillars: {
      heading: '能做什么',
      sub: '三个工作空间。每个空间有自己的内容类型、自己的协作方式、自己的 archive。',
      thinking: {
        title: '想点子的地方',
        desc: '你 3am 醒来想到的连接、和朋友餐桌上的争论、把一个数学方法用到生物上的"咦"——都是 first-class 内容。可以是文字、可以是手画草图、可以是一个矛盾观察、可以是一个反例。允许半成品。',
      },
      prototyping: {
        title: '做原型的地方',
        desc: '想用一个想法做点什么——一个 toy model、一段把"我感觉这有关系"翻译成"可测的三个参数"、一个还不到论文水平但能让别人理解你在想什么的设计草图。这一层做完，离论文还差一截，但已经能给同行看了。',
      },
      paper: {
        title: '写论文的地方',
        desc: '传统的写论文、跑实验、走评审、导出 PDF / Word / JATS——这一层我们做得和别人一样好。但只占三层中的一层；不是全部。',
      },
    },
    attribution: {
      heading: '每一个想法都有名字',
      desc: '不再是"first author et al."。每个想法是谁提的、每个隐喻是谁想到的、每个矛盾是谁挖出来的——都被记下来，都独立可被引用。论文里"作者"不再是排第几的游戏。',
    },
```

注意：
- `pillars` 子键从 `editor / ai / provenance / bilingual` 改为 `thinking / prototyping / paper`，每个仅 `title` + `desc`（**删 diagram 字段**）
- `attribution` 是与 `pillars` 平级的新顶层节（不嵌入 pillars 内，便于 Landing.tsx 单独 render）

### - [ ] Step 2.2: Mirror to en.ts

替换 en.ts 对应块为：

```ts
    pillars: {
      heading: 'What it does',
      sub: 'Three workspaces. Each has its own content types, collaboration patterns and archive.',
      thinking: {
        title: 'The thinking space',
        desc: 'The 3am connection, the dinner argument, the "huh, what if this method from math applies to biology?" — all first-class. Words, hand sketches, a contradiction you noticed, a counter-example. Half-baked is allowed.',
      },
      prototyping: {
        title: 'The prototyping space',
        desc: 'Turn an idea into something. A toy model, a translation from "I feel these are connected" to "three measurable parameters", a design sketch that\'s not paper-grade but gets your idea across. Done here, you\'re not at a paper yet — but you can show colleagues.',
      },
      paper: {
        title: 'The paper space',
        desc: "The traditional part — write the paper, run the experiments, go through review, export to PDF / Word / JATS. We do this layer as well as anyone. But it's one of three layers, not all of them.",
      },
    },
    attribution: {
      heading: 'Every idea has a name',
      desc: 'No more "first author et al." Every idea, every metaphor, every contradiction is tracked to who proposed it, with timestamps. Each contribution is independently citable. Authorship is no longer a ranking game.',
    },
```

### - [ ] Step 2.3: Update landing.test.ts pillar assertions

替换原 `'all four pillars are translated'` 测试（landing.test.ts:85-93）为 v4 三 pillar 测试：

```ts
  it('all three pillars (thinking/prototyping/paper) are translated', () => {
    for (const k of ['thinking', 'prototyping', 'paper'] as const) {
      const z = zh.landing.pillars[k].title;
      const e = en.landing.pillars[k].title;
      assert.notEqual(z, '', `zh.landing.pillars.${k}.title empty`);
      assert.notEqual(e, '', `en.landing.pillars.${k}.title empty`);
      assert.notEqual(z, e, `pillar ${k}: zh and en titles must differ`);
    }
  });
  it('zh thinking-space pillar mentions 3am + 草图 + 矛盾', () => {
    assert.match(zh.landing.pillars.thinking.desc, /3am/);
    assert.match(zh.landing.pillars.thinking.desc, /草图|矛盾/);
  });
  it('en thinking-space pillar mentions 3am + sketch + contradiction', () => {
    assert.match(en.landing.pillars.thinking.desc, /3am/);
    assert.match(en.landing.pillars.thinking.desc, /sketch|contradiction/i);
  });
  it('attribution section rejects first-author framing', () => {
    assert.match(zh.landing.attribution.desc, /first author|排第几/);
    assert.match(en.landing.attribution.desc, /first author/i);
  });
```

### - [ ] Step 2.4: Update Landing.tsx Pillar helper + pillars section + add attribution section

**(a) 修改 Pillar helper（line 353-389）**：删 `diagram` 参数 + 删 `<pre>` 渲染：

```tsx
function Pillar({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <article className="flex flex-col gap-3">
      <h3
        className="font-serif text-lg font-medium leading-[1.35]"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {title}
      </h3>
      <p
        className="font-serif text-[15px] leading-[1.78]"
        style={{ color: 'var(--color-ink-2)' }}
        data-prose="bilingual"
      >
        {desc}
      </p>
    </article>
  );
}
```

**(b) 修改 pillars section（line 80-116）** —— 替换为 3 pillar grid：

```tsx
      {/* Pillars — v4: 3 个空间（想点子 / 做原型 / 写论文），删 v3 的
          4 个 ASCII 微图（实现路径写法）。grid 在 ≥md 是 3 列（不是
          v3 的 2 列），让"三层"视觉权重对齐。 */}
      <section className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="label-cap">{pillars.heading}</p>
          <h2
            className="font-serif text-3xl font-medium"
            style={{
              color: 'var(--color-ink)',
              letterSpacing: '-0.005em',
            }}
            data-prose="bilingual"
          >
            {pillars.sub}
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <Pillar
            title={pillars.thinking.title}
            desc={pillars.thinking.desc}
          />
          <Pillar
            title={pillars.prototyping.title}
            desc={pillars.prototyping.desc}
          />
          <Pillar
            title={pillars.paper.title}
            desc={pillars.paper.desc}
          />
        </div>
      </section>
```

**(c) 在 pillars section 之后插入 attribution section**：

```tsx
      {/* Attribution — v4 新节，反 first-author. 独立 visual 节，
          不并入 pillars grid（spec §3.3 第 4 节）。 */}
      <section className="flex flex-col gap-3">
        <p className="label-cap">{attribution.heading}</p>
        <p
          className="max-w-prose font-serif text-[16px] leading-[1.78]"
          style={{ color: 'var(--color-ink)' }}
          data-prose="bilingual"
        >
          {attribution.desc}
        </p>
      </section>
```

**(d) 在文件顶部 `const pillars = t.landing.pillars;` 附近加 `const attribution = t.landing.attribution;`**（line 22-28 那块解构）。

### - [ ] Step 2.5: Run typecheck + tests

```bash
pnpm web:typecheck
pnpm web:test
```

Expected: PASS。i18n.test.ts shape parity 自动检 zh+en attribution 节齐全。

### - [ ] Step 2.6: Commit

```bash
git add apps/web/src/lib/i18n/locales/zh.ts \
        apps/web/src/lib/i18n/locales/en.ts \
        apps/web/src/components/landing/Landing.tsx \
        apps/web/tests/landing.test.ts
git commit -m "$(cat <<'EOF'
P5(landing-v4 T2): pillars 4→3 + attribution — 三层 + 反 first-author

- pillars 子键 editor/ai/provenance/bilingual → thinking/prototyping/paper
- 删 4 个 ASCII 微图（Council 诊断"实现路径而非用户收益"，spec §3.3）
- 新增 landing.attribution 顶层节："每一个想法都有名字"，反 first-author
  ranking（ADR-0020 §2.5 contribution-graph attribution）
- pillar grid md:grid-cols-2 → md:grid-cols-3，物质化"三层等价"
- landing.test.ts pillar 断言重写

Spec §3.3 落地。Task 2/8。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TriadicMockup 组件 + Hero 2 列布局 + heroMockup locale

**Files:**
- Create: `apps/web/src/components/landing/TriadicMockup.tsx`
- Modify: `apps/web/src/lib/i18n/locales/zh.ts`（新增 `landing.heroMockup` 14 字段）
- Modify: `apps/web/src/lib/i18n/locales/en.ts`（镜像 14 字段）
- Modify: `apps/web/src/components/landing/Landing.tsx`（hero 单列 → 2 列；引入 TriadicMockup）
- Modify: `apps/web/tests/landing.test.ts`（新增 mockup contract 断言）

**Goal of this task:** Hero 右半装入 TriadicMockup，左右 2 列布局。Mockup 是 3 个等权重 card（Night / Bridge / Day）+ 2 个连接箭头 + footer 提示。

### - [ ] Step 3.1: Update zh.ts — add landing.heroMockup（在 landing.hero 之后插入）

在 zh.ts 的 `landing.hero` 块（以 `ctaSecondary: '怎么装到自己电脑',` 结束的对象）之后，插入：

```ts
    heroMockup: {
      nightLabel: 'NIGHT · 想法 / idea',
      nightBody: 'Google 2024 在 NISQ 上测到 0.8% 错误率，但理论极限是 1%。会不会错误率不是常数？',
      nightTag: '矛盾观察 · contradiction',
      edge1Label: '想法变原型',
      edge1Mode: 'metaphor-bridge',
      bridgeLabel: 'BRIDGE · 原型 / prototype',
      bridgeBody: 'toy model：错误率 = f(device, time)。三个可测参数：T1、串扰、温漂。',
      bridgeTag: '假设形式化 · hypothesis sketch',
      edge2Label: '原型变论文',
      edge2Mode: 'hypothesis-output',
      dayLabel: 'DAY · 论文 / paper',
      dayBody: 'We propose a device-dependent error model with three measurable parameters…',
      dayTag: '论文草稿 · manuscript draft',
      footerHint: '三个空间之间的连接被独立记下来：哪个想法变成了哪个原型，哪个原型变成了哪段论文。',
    },
```

### - [ ] Step 3.2: Mirror to en.ts — add landing.heroMockup

```ts
    heroMockup: {
      nightLabel: 'NIGHT · idea',
      nightBody: 'Google 2024 measured 0.8% error rate on NISQ — but the theoretical bound is 1%. What if the error rate is not a constant?',
      nightTag: 'Contradiction noticed',
      edge1Label: 'idea → prototype',
      edge1Mode: 'metaphor-bridge',
      bridgeLabel: 'BRIDGE · prototype',
      bridgeBody: 'toy model: error rate = f(device, time). Three measurable parameters: T1, crosstalk, thermal drift.',
      bridgeTag: 'Hypothesis sketch',
      edge2Label: 'prototype → paper',
      edge2Mode: 'hypothesis-output',
      dayLabel: 'DAY · paper',
      dayBody: 'We propose a device-dependent error model with three measurable parameters…',
      dayTag: 'Manuscript draft',
      footerHint: 'The connections between the three spaces are recorded independently: which idea became which prototype, which prototype became which paragraph of the paper.',
    },
```

### - [ ] Step 3.3: Create TriadicMockup.tsx

新建 `apps/web/src/components/landing/TriadicMockup.tsx`，内容：

```tsx
// TriadicMockup — Hero 右半。3 个等权重 layer card（Night / Bridge / Day）
// + 2 个 interaction-mode 连接箭头 + 1 行 footer 提示。
//
// 视觉规则（Design.md §11 reject criteria 守护）：
//   - 3 card 完全等价（同字号 / 同 border / 同 padding）—— 物质化"三层等价"invariant
//   - 全方角 hairline border + paper-2 bg + 无 shadow（§11 #2 + #12）
//   - 箭头用 ascii `↓` glyph + 小字标签（不是 SVG icon，不是 emoji，§11 #4）
//   - layer 标签（NIGHT / BRIDGE / DAY）用 mono caps + accent-ink，不当 status pill
//
// 无 JS 交互。文案全走 locale 字典。

import type { LocaleDict } from '@/lib/i18n/types';

export function TriadicMockup({ t }: { t: LocaleDict }) {
  const m = t.landing.heroMockup;
  return (
    <div className="flex flex-col gap-2">
      <LayerCard
        label={m.nightLabel}
        body={m.nightBody}
        tag={m.nightTag}
      />
      <EdgeArrow label={m.edge1Label} mode={m.edge1Mode} />
      <LayerCard
        label={m.bridgeLabel}
        body={m.bridgeBody}
        tag={m.bridgeTag}
      />
      <EdgeArrow label={m.edge2Label} mode={m.edge2Mode} />
      <LayerCard
        label={m.dayLabel}
        body={m.dayBody}
        tag={m.dayTag}
      />
      <p
        className="mt-3 font-serif text-[12px] italic leading-[1.55]"
        style={{ color: 'var(--color-ink-3)' }}
        data-prose="bilingual"
      >
        {m.footerHint}
      </p>
    </div>
  );
}

function LayerCard({
  label,
  body,
  tag,
}: {
  label: string;
  body: string;
  tag: string;
}) {
  return (
    <article
      className="flex flex-col gap-2 px-4 py-3"
      style={{
        border: '1px solid var(--color-hairline)',
        background: 'var(--color-paper-2)',
      }}
    >
      <p
        className="font-mono text-[11px] uppercase tracking-wider"
        style={{ color: 'var(--color-accent-ink)' }}
      >
        {label}
      </p>
      <p
        className="font-serif text-[13px] leading-[1.55]"
        style={{ color: 'var(--color-ink)' }}
        data-prose="bilingual"
      >
        {body}
      </p>
      <p
        className="font-mono text-[11px]"
        style={{ color: 'var(--color-ink-3)' }}
      >
        — {tag}
      </p>
    </article>
  );
}

function EdgeArrow({ label, mode }: { label: string; mode: string }) {
  return (
    <div
      className="flex items-center gap-3 self-center font-mono text-[11px]"
      style={{ color: 'var(--color-ink-3)' }}
    >
      <span
        aria-hidden="true"
        style={{ color: 'var(--color-accent-ink)' }}
      >
        ↓
      </span>
      <span data-prose="bilingual">{label}</span>
      <span style={{ color: 'var(--color-ink-3)' }}>· {mode}</span>
    </div>
  );
}
```

### - [ ] Step 3.4: Update Landing.tsx — import + 2-col hero

**(a) 顶部 import 加：**

```tsx
import { TriadicMockup } from './TriadicMockup';
```

**(b) 修改 `<main>` 的 max-width**（line 33）：

```tsx
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-20 px-6 py-16 lg:max-w-6xl"
```

**(c) 修改 hero section 包裹结构**：把 Task 1 Step 1.5 写的 hero section（当前是单列 flex）改为 2 列 grid。把原 hero 的所有子节点（`<p eyebrow>` / `<h1>` / `<p sub>` / `<p tagline>` / `<div CTA>`）放进左半 wrapper；新增右半 wrapper 放 `<TriadicMockup t={t}/>`：

```tsx
      {/* Hero — v4 triadic. Desktop: 2 列（左文字 1.1fr · 右 mockup 0.9fr，
          asymmetric per Design.md §6.3 同款）。Mobile: stack 单列。 */}
      <section className="flex flex-col gap-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-x-12">
        {/* 左半 — Hero copy */}
        <div className="flex flex-col gap-6">
          <p className="label-cap">{hero.eyebrow}</p>
          <h1
            className="whitespace-pre-line font-serif text-5xl font-medium leading-[0.98] tracking-[-0.02em] sm:text-6xl lg:text-7xl"
            style={{ color: 'var(--color-ink)' }}
            data-prose="bilingual"
          >
            {hero.headline}
          </h1>
          <p
            className="max-w-prose font-serif text-lg italic leading-[1.55] sm:text-xl"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            {hero.sub}
          </p>
          <p
            className="font-sans text-sm leading-[1.6]"
            style={{ color: 'var(--color-ink-3)' }}
          >
            {hero.tagline}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-primary">
              {hero.ctaPrimary}
            </Link>
            <a
              href={`${REPO_URL}/blob/main/docs/SELF_HOST.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              {hero.ctaSecondary}
            </a>
          </div>
        </div>
        {/* 右半 — TriadicMockup */}
        <div className="lg:pt-2">
          <TriadicMockup t={t} />
        </div>
      </section>
```

### - [ ] Step 3.5: Update landing.test.ts — TriadicMockup contract

在 landing.test.ts 的 `'Landing component module shape'` describe 块（line 96-101）之后追加：

```ts
describe('landing — TriadicMockup module shape', () => {
  it('exports a TriadicMockup function', async () => {
    const mod = await import('../src/components/landing/TriadicMockup');
    assert.equal(typeof mod.TriadicMockup, 'function');
  });
});

describe('landing — heroMockup locale carries triadic content', () => {
  it('zh heroMockup names all three layers (NIGHT / BRIDGE / DAY)', () => {
    assert.match(zh.landing.heroMockup.nightLabel, /NIGHT/);
    assert.match(zh.landing.heroMockup.bridgeLabel, /BRIDGE/);
    assert.match(zh.landing.heroMockup.dayLabel, /DAY/);
  });
  it('en heroMockup names all three layers', () => {
    assert.match(en.landing.heroMockup.nightLabel, /NIGHT/);
    assert.match(en.landing.heroMockup.bridgeLabel, /BRIDGE/);
    assert.match(en.landing.heroMockup.dayLabel, /DAY/);
  });
  it('edge modes are valid InteractionMode values from ADR-0020 §2.3', () => {
    // ADR-0020 lists 6 interaction modes; we use 2 in the mockup.
    const valid = new Set([
      'hypothesis-output',
      'anomaly-input',
      'constraint-transfer',
      'metaphor-bridge',
      'question-return',
      'method-transfer',
    ]);
    assert.ok(valid.has(zh.landing.heroMockup.edge1Mode), 'edge1Mode zh');
    assert.ok(valid.has(zh.landing.heroMockup.edge2Mode), 'edge2Mode zh');
    assert.ok(valid.has(en.landing.heroMockup.edge1Mode), 'edge1Mode en');
    assert.ok(valid.has(en.landing.heroMockup.edge2Mode), 'edge2Mode en');
  });
  it('TriadicMockup component does not use rounded-lg/xl/2xl', async () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'components/landing/TriadicMockup.tsx'),
      'utf8',
    );
    assert.doesNotMatch(
      src,
      /rounded-(lg|xl|2xl|full)/,
      'Design.md §11 #2 — no large radius (except .pill 999px)',
    );
    assert.doesNotMatch(
      src,
      /shadow-(sm|md|lg|xl)/,
      'Design.md §11 #12 — no box-shadow',
    );
    assert.doesNotMatch(
      src,
      /bg-blue-(500|600|700)/,
      'Design.md §11 #1 — no saturated blue',
    );
  });
});
```

### - [ ] Step 3.6: Run typecheck + tests

```bash
pnpm web:typecheck
pnpm web:test
```

Expected: PASS。i18n.test.ts 自动验 heroMockup 14 字段 shape parity。

### - [ ] Step 3.7: Commit

```bash
git add apps/web/src/components/landing/TriadicMockup.tsx \
        apps/web/src/components/landing/Landing.tsx \
        apps/web/src/lib/i18n/locales/zh.ts \
        apps/web/src/lib/i18n/locales/en.ts \
        apps/web/tests/landing.test.ts
git commit -m "$(cat <<'EOF'
P5(landing-v4 T3): TriadicMockup + hero 2-col — 三层 lineage in Hero

- 新组件 TriadicMockup.tsx：3 等权重 layer card (Night/Bridge/Day) +
  2 个 ↓ 箭头标 interaction-mode (metaphor-bridge / hypothesis-output)
  + footer 提示，全 HTML/CSS inline，无外部图片资产
- Hero 单列 → 2 列 grid lg:grid-cols-[1.1fr_0.9fr]（Design.md §6.3
  asymmetric 同款），mobile stack
- max-w-3xl → lg:max-w-6xl（仅 hero 节，下方 pillars/specimens 保持 3xl）
- locale 加 landing.heroMockup 14 字段 zh+en（i18n.test.ts shape parity
  自动校验）
- landing.test.ts 加 mockup contract 断言 + reject criteria grep gate

ADR-0020 §2.1 三层等价 + §2.3 6 交互流物质化。spec §3.2 落地。Task 3/8。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Specimens locale 重写 + 3 张新 SVG

**Files:**
- Create: `apps/web/public/demo/landing-specimen-night.svg`
- Create: `apps/web/public/demo/landing-specimen-bridge.svg`
- Create: `apps/web/public/demo/landing-specimen-lineage.svg`
- Modify: `apps/web/src/lib/i18n/locales/zh.ts`（landing.specimens 整块）
- Modify: `apps/web/src/lib/i18n/locales/en.ts`（镜像）
- Modify: `apps/web/src/components/landing/Landing.tsx`（specimens section src + props 改）
- Modify: `apps/web/tests/landing.test.ts`（specimens 断言）

**Goal of this task:** Specimens 节 3 张换图，从 Day 视角（typst PDF / agentTimeline / DAG）换到三层视角（Night / Bridge / Lineage）。

### - [ ] Step 4.1: Create landing-specimen-night.svg

新建 `apps/web/public/demo/landing-specimen-night.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" font-family="ui-serif, 'Source Serif 4', serif">
  <rect width="480" height="600" fill="#FBFAF7"/>
  <rect x="20" y="20" width="440" height="560" fill="none" stroke="#D8D4CC" stroke-width="1"/>
  <text x="40" y="60" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F" letter-spacing="2">NIGHT · 想点子空间</text>
  <text x="40" y="100" font-size="18" font-weight="500" fill="#1A1714">2026-03-12 — 一页手稿</text>
  <line x1="40" y1="115" x2="440" y2="115" stroke="#D8D4CC" stroke-width="1"/>
  <text x="40" y="155" font-size="14" font-style="italic" fill="#1A1714">"为什么 Google 2024 的 0.8% 错误率比理论极</text>
  <text x="40" y="178" font-size="14" font-style="italic" fill="#1A1714">限 1% 还低？理论错在哪里？"</text>
  <text x="40" y="220" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F">— 矛盾观察 · contradiction noticed</text>
  <line x1="40" y1="250" x2="440" y2="250" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>
  <text x="40" y="290" font-size="14" font-style="italic" fill="#1A1714">"会不会错误率不是 device-independent 的</text>
  <text x="40" y="313" font-size="14" font-style="italic" fill="#1A1714">常数？像血压一样，会随状态变化？"</text>
  <text x="40" y="355" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F">— 隐喻 · metaphor (生理学 ↔ 物理)</text>
  <line x1="40" y1="385" x2="440" y2="385" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>
  <text x="40" y="425" font-size="14" font-style="italic" fill="#1A1714">"如果是，T1/串扰/温漂 哪个最主导？"</text>
  <text x="40" y="467" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F">— 问题 · question</text>
  <text x="40" y="540" font-size="11" font-family="ui-monospace, monospace" fill="#7D766C">half-baked · 允许不知道是不是对</text>
  <text x="40" y="560" font-size="11" font-family="ui-monospace, monospace" fill="#7D766C">3 个 atomic units · contradiction + metaphor + question</text>
</svg>
```

### - [ ] Step 4.2: Create landing-specimen-bridge.svg

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" font-family="ui-serif, 'Source Serif 4', serif">
  <rect width="480" height="600" fill="#FBFAF7"/>
  <rect x="20" y="20" width="440" height="560" fill="none" stroke="#D8D4CC" stroke-width="1"/>
  <text x="40" y="60" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F" letter-spacing="2">BRIDGE · 做原型空间</text>
  <text x="40" y="100" font-size="18" font-weight="500" fill="#1A1714">假设形式化 · hypothesis sketch</text>
  <line x1="40" y1="115" x2="440" y2="115" stroke="#D8D4CC" stroke-width="1"/>
  <text x="40" y="150" font-size="13" fill="#1A1714">toy model：</text>
  <text x="40" y="173" font-size="13" font-family="ui-monospace, monospace" fill="#1A1714">err(t, d) = α·T1(d)^-1 + β·crosstalk(d) + γ·drift(t)</text>
  <line x1="40" y1="205" x2="440" y2="205" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>
  <text x="40" y="240" font-size="13" font-weight="500" fill="#1A1714">三个可测参数 · three measurable parameters</text>
  <text x="60" y="270" font-size="13" fill="#1A1714">• T1（退相干时间）— 已有标准测法</text>
  <text x="60" y="295" font-size="13" fill="#1A1714">• 串扰（crosstalk）— Google 2023 给了基线</text>
  <text x="60" y="320" font-size="13" fill="#1A1714">• 温漂（thermal drift）— 我们的设备能测</text>
  <line x1="40" y1="345" x2="440" y2="345" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>
  <text x="40" y="380" font-size="13" font-weight="500" fill="#1A1714">两个风险 · risks</text>
  <text x="60" y="408" font-size="13" fill="#1A1714">• α/β/γ 可能 device-coupled，跨设备无法迁移</text>
  <text x="60" y="430" font-size="13" fill="#1A1714">• 若 γ 主导，文献无 prior art 作 baseline</text>
  <line x1="40" y1="455" x2="440" y2="455" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>
  <text x="40" y="490" font-size="13" font-weight="500" fill="#1A1714">如果这真的成立 · what it would overturn</text>
  <text x="40" y="513" font-size="13" font-style="italic" fill="#1A1714">→ surface code threshold 理论需要重新参数化</text>
  <text x="40" y="560" font-size="11" font-family="ui-monospace, monospace" fill="#7D766C">还不是论文 · 但已经能给同行看</text>
</svg>
```

### - [ ] Step 4.3: Create landing-specimen-lineage.svg

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" font-family="ui-serif, 'Source Serif 4', serif">
  <rect width="720" height="360" fill="#FBFAF7"/>

  <!-- column headers -->
  <text x="120" y="35" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F" letter-spacing="2" text-anchor="middle">NIGHT · 想法</text>
  <text x="360" y="35" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F" letter-spacing="2" text-anchor="middle">BRIDGE · 原型</text>
  <text x="600" y="35" font-size="11" font-family="ui-monospace, monospace" fill="#1F3A5F" letter-spacing="2" text-anchor="middle">DAY · 论文</text>
  <line x1="30" y1="50" x2="690" y2="50" stroke="#D8D4CC" stroke-width="1"/>

  <!-- column dividers -->
  <line x1="240" y1="50" x2="240" y2="340" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>
  <line x1="480" y1="50" x2="480" y2="340" stroke="#D8D4CC" stroke-width="0.5" stroke-dasharray="3,4"/>

  <!-- Night nodes -->
  <rect x="40" y="80" width="160" height="40" fill="none" stroke="#D8D4CC"/>
  <text x="120" y="105" font-size="12" fill="#1A1714" text-anchor="middle">矛盾观察：0.8% < 1%</text>
  <rect x="40" y="150" width="160" height="40" fill="none" stroke="#D8D4CC"/>
  <text x="120" y="175" font-size="12" font-style="italic" fill="#1A1714" text-anchor="middle">隐喻：像血压</text>
  <rect x="40" y="220" width="160" height="40" fill="none" stroke="#D8D4CC"/>
  <text x="120" y="245" font-size="12" fill="#1A1714" text-anchor="middle">问题：T1/串扰/温漂?</text>
  <rect x="40" y="290" width="160" height="40" fill="none" stroke="#D8D4CC"/>
  <text x="120" y="315" font-size="12" fill="#7D766C" text-anchor="middle" font-style="italic">类比：基因调控</text>

  <!-- Bridge nodes -->
  <rect x="280" y="115" width="160" height="50" fill="none" stroke="#D8D4CC"/>
  <text x="360" y="135" font-size="12" fill="#1A1714" text-anchor="middle">toy model: err = f(d, t)</text>
  <text x="360" y="153" font-size="11" font-family="ui-monospace, monospace" fill="#7D766C" text-anchor="middle">3 params</text>
  <rect x="280" y="225" width="160" height="40" fill="none" stroke="#D8D4CC"/>
  <text x="360" y="250" font-size="12" fill="#1A1714" text-anchor="middle">设计虚构：未来设备表</text>

  <!-- Day node -->
  <rect x="520" y="135" width="160" height="50" fill="none" stroke="#D8D4CC"/>
  <text x="600" y="155" font-size="12" fill="#1A1714" text-anchor="middle">论文：device-dependent</text>
  <text x="600" y="172" font-size="11" font-family="ui-monospace, monospace" fill="#7D766C" text-anchor="middle">error model</text>

  <!-- Edges with interaction-mode tags -->
  <line x1="200" y1="100" x2="280" y2="135" stroke="#1F3A5F" stroke-width="1"/>
  <text x="240" y="112" font-size="10" font-family="ui-monospace, monospace" fill="#1F3A5F" text-anchor="middle">anomaly-input</text>
  <line x1="200" y1="170" x2="280" y2="145" stroke="#1F3A5F" stroke-width="1"/>
  <text x="240" y="158" font-size="10" font-family="ui-monospace, monospace" fill="#1F3A5F" text-anchor="middle">metaphor-bridge</text>
  <line x1="200" y1="240" x2="280" y2="155" stroke="#1F3A5F" stroke-width="1"/>
  <line x1="440" y1="160" x2="520" y2="160" stroke="#1F3A5F" stroke-width="1"/>
  <text x="480" y="152" font-size="10" font-family="ui-monospace, monospace" fill="#1F3A5F" text-anchor="middle">hypothesis-output</text>

  <!-- Orphan note (bridge with no day) -->
  <text x="480" y="280" font-size="10" font-family="ui-monospace, monospace" fill="#7D766C" text-anchor="middle">↑ 这个设计虚构</text>
  <text x="480" y="295" font-size="10" font-family="ui-monospace, monospace" fill="#7D766C" text-anchor="middle">没进论文 · 单独 archive</text>

  <text x="360" y="345" font-size="11" font-family="ui-monospace, monospace" fill="#7D766C" text-anchor="middle">3 想法 + 2 原型 + 1 论文 · 每条 edge 带 interaction-mode</text>
</svg>
```

### - [ ] Step 4.4: Update zh.ts landing.specimens

替换 `apps/web/src/lib/i18n/locales/zh.ts` 当前 `specimens: { ... }` 整块为：

```ts
    specimens: {
      heading: '看一眼',
      sub: '一张想法手稿、一张原型表、一张三层之间的连接图。',
      nightAlt: '想点子空间里的一页内容 —— 包含一个矛盾观察、一段隐喻草稿、一个未答问题',
      nightCaption: '想点子空间的一页：矛盾观察、隐喻草稿、一段还没确定的提问。允许半成品，允许"不知道是不是对的"。',
      bridgeAlt: '原型空间里的一张表 —— 一个假设的三个可测参数 + 风险点',
      bridgeCaption: '原型空间的一张表：一个假设、三个可测参数、两个风险点、一段"如果这真的成立会推翻什么"。这不是论文，但已经能给同行看。',
      lineageAlt: '三层 artifact 之间的连接图 —— 想法 → 原型 → 论文 的 lineage',
      lineageCaption: '一张三层之间的连接图：哪个 3am 灵感最后变成了哪一段论文？哪个原型从来没用上？每条连接都带"是什么方式转化的"标注。',
    },
```

### - [ ] Step 4.5: Mirror to en.ts

```ts
    specimens: {
      heading: 'Take a look',
      sub: 'A thinking sketch, a prototype table, a map of how the three layers connect.',
      nightAlt: 'A page in the thinking space — a contradiction noticed, a metaphor draft, an open question',
      nightCaption: 'A page in the thinking space: a contradiction noticed, a metaphor in draft, a question that may or may not lead anywhere. Half-baked is allowed.',
      bridgeAlt: 'A table in the prototyping space — a hypothesis with three measurable parameters and risks',
      bridgeCaption: 'A table in the prototyping space: one hypothesis, three measurable parameters, two risks, one line on "what this would overturn if true". Not a paper — but enough to show.',
      lineageAlt: 'Lineage graph between three layers — idea → prototype → paper',
      lineageCaption: "A map across layers: which 3am idea ended up in which paragraph? Which prototypes were never used? Each edge is labelled with how the transformation happened.",
    },
```

### - [ ] Step 4.6: Update Landing.tsx specimens section

修改 Landing.tsx 当前 specimens section（line 187-218），3 个 `<SpecimenFigure>` src + alt + caption 全换：

```tsx
      {/* Specimens — v4: 3 张三层视角图（替代 v3 的 typst/timeline/dag
          这 3 张 Day-视角图）。Source: /public/demo/landing-specimen-
          {night,bridge,lineage}.svg。 */}
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="label-cap">{specimens.heading}</p>
          <p
            className="font-serif text-base italic leading-[1.6]"
            style={{ color: 'var(--color-ink-2)' }}
            data-prose="bilingual"
          >
            {specimens.sub}
          </p>
        </header>
        <div className="flex flex-col gap-8">
          <SpecimenFigure
            src="/demo/landing-specimen-night.svg"
            alt={specimens.nightAlt}
            caption={specimens.nightCaption}
            aspectRatio="480 / 600"
          />
          <SpecimenFigure
            src="/demo/landing-specimen-bridge.svg"
            alt={specimens.bridgeAlt}
            caption={specimens.bridgeCaption}
            aspectRatio="480 / 600"
          />
          <SpecimenFigure
            src="/demo/landing-specimen-lineage.svg"
            alt={specimens.lineageAlt}
            caption={specimens.lineageCaption}
            aspectRatio="720 / 360"
          />
        </div>
      </section>
```

### - [ ] Step 4.7: Update landing.test.ts specimens assertions

在 landing.test.ts 加入：

```ts
describe('landing — v4 specimens reference triadic SVGs', () => {
  it('Landing.tsx references three new triadic SVG specimens', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'components/landing/Landing.tsx'),
      'utf8',
    );
    assert.match(src, /landing-specimen-night\.svg/);
    assert.match(src, /landing-specimen-bridge\.svg/);
    assert.match(src, /landing-specimen-lineage\.svg/);
  });
  it('Landing.tsx no longer references v3 specimens', () => {
    const src = readFileSync(
      path.join(repoWebSrc, 'components/landing/Landing.tsx'),
      'utf8',
    );
    assert.doesNotMatch(src, /landing-specimen-typst\.svg/);
    assert.doesNotMatch(src, /landing-specimen-timeline\.svg/);
    assert.doesNotMatch(src, /desci-review-pilot-fig1\.svg/);
  });
  it('zh specimen captions describe night/bridge/lineage content', () => {
    assert.match(zh.landing.specimens.nightCaption, /矛盾|隐喻|半成品/);
    assert.match(zh.landing.specimens.bridgeCaption, /原型|参数|假设/);
    assert.match(zh.landing.specimens.lineageCaption, /3am|连接|lineage|转化/);
  });
});
```

### - [ ] Step 4.8: Run typecheck + tests + verify SVG files exist

```bash
pnpm web:typecheck
pnpm web:test
ls -la apps/web/public/demo/landing-specimen-{night,bridge,lineage}.svg
```

Expected: tests PASS。SVG 文件 3 个均存在。

### - [ ] Step 4.9: Commit

```bash
git add apps/web/public/demo/landing-specimen-night.svg \
        apps/web/public/demo/landing-specimen-bridge.svg \
        apps/web/public/demo/landing-specimen-lineage.svg \
        apps/web/src/lib/i18n/locales/zh.ts \
        apps/web/src/lib/i18n/locales/en.ts \
        apps/web/src/components/landing/Landing.tsx \
        apps/web/tests/landing.test.ts
git commit -m "$(cat <<'EOF'
P5(landing-v4 T4): specimens — 3 张三层视角 SVG 替代 Day-only specimens

- 新增 3 张 SVG：
  - landing-specimen-night.svg —— 一页手稿（矛盾 + 隐喻 + 问题）
  - landing-specimen-bridge.svg —— 假设形式化（toy model + 3 params + 2 risks）
  - landing-specimen-lineage.svg —— 三层 lineage graph（带 anomaly-input /
    metaphor-bridge / hypothesis-output 标注）
- v3 specimens（typst/timeline/dag SVG）从 Landing.tsx 解绑，文件保留 /public/demo/
- locale specimens 节键名 typst/timeline/dag → night/bridge/lineage
- SVG 用 Design.md tokens (#FBFAF7 paper, #1A1714 ink, #1F3A5F accent-ink,
  #D8D4CC hairline)，全 hairline border + 无 shadow

ADR-0020 §2.1 三层 atomic units 视觉化。spec §3.4 落地。Task 4/8。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Differentiation 5 行重写 + 节标题改

**Files:**
- Modify: `apps/web/src/lib/i18n/locales/zh.ts`（landing.differentiation 整块）
- Modify: `apps/web/src/lib/i18n/locales/en.ts`（镜像）
- Modify: `apps/web/tests/landing.test.ts`（differentiation 断言）
- Landing.tsx **不动**（rows.map 适应任意长度）

### - [ ] Step 5.1: Replace zh.ts landing.differentiation

替换 zh.ts 当前 `differentiation: { ... }` 整块为：

```ts
    differentiation: {
      heading: '和别的工具有啥不同',
      sub: '简单说：别的工具只承接最终论文。我们承接想法 → 原型 → 论文整个链条。',
      rows: [
        {
          competitor: 'Notion / Obsidian',
          theyDo: '通用笔记软件。所有内容都是同一种文档。AI 在右边聊天侧栏。',
          weDo: '三层显式分开。每层有自己的内容类型（想法 / 原型 / 论文）和协作方式。AI 在内容里直接帮你改，不在聊天框。',
        },
        {
          competitor: 'Curvenote / Quarto / Overleaf',
          theyDo: '只承接论文这一层。想法和原型阶段它不管。',
          weDo: '论文这一层我们做得同样好。但只占三层中的一层。',
        },
        {
          competitor: 'GitHub Issues for Science',
          theyDo: '只有"问题"一种东西。',
          weDo: '想点子空间里除了问题，还可以放隐喻、矛盾观察、思想实验、草图、念头。原型空间里有 toy model、设计虚构、概念验证、类比映射。',
        },
        {
          competitor: '传统论文 "first author et al."',
          theyDo: '第一作者排第一，其他作者排第二第三。引用看 first author。谁先 submit 谁拿 priority。',
          weDo: '每个想法、每个隐喻、每个矛盾的作者独立记录、独立可被引用。"谁先想到"不再是单赢的比赛。',
        },
        {
          competitor: '关在云端的协作工具',
          theyDo: '必须用他们的服务器。你的 3am 灵感被传到他们的数据库。',
          weDo: '桌面端为主。数据存在你电脑上。AI 默认在本地跑。开源、可自托管。',
        },
      ],
      footnote: '详细对比见 README。',
    },
```

### - [ ] Step 5.2: Mirror to en.ts

```ts
    differentiation: {
      heading: "How it's different",
      sub: 'Short version: other tools handle just the paper. We handle the whole chain — idea → prototype → paper.',
      rows: [
        {
          competitor: 'Notion / Obsidian',
          theyDo: 'General-purpose notes. Everything is one kind of document. AI lives in a right-side chat panel.',
          weDo: 'Three layers explicit. Each has its own content types and collaboration patterns. AI edits inline — not in a chat box.',
        },
        {
          competitor: 'Curvenote / Quarto / Overleaf',
          theyDo: 'Just the paper layer. Ideas and prototypes are not their job.',
          weDo: "We do the paper layer just as well. But it's one of three.",
        },
        {
          competitor: 'GitHub Issues for Science',
          theyDo: 'Only "questions" as the unit of work.',
          weDo: 'The thinking space holds questions but also metaphors, contradictions, thought experiments, sketches, raw thoughts. The prototyping space holds toy models, design fictions, proofs-of-concept, analogy maps.',
        },
        {
          competitor: 'Traditional "first author et al."',
          theyDo: 'First author gets the first slot, others second/third. Citations name first author. Whoever submits first wins priority.',
          weDo: 'Every idea, metaphor, contradiction has its own attribution and citation. "Who first" is no longer a winner-takes-all race.',
        },
        {
          competitor: 'Cloud-hosted collaboration tools',
          theyDo: "Cloud-hosted. Your 3am ideas live in their database.",
          weDo: 'Desktop-first. Data stays on your machine. AI runs locally by default. Open-source and self-hostable.',
        },
      ],
      footnote: 'See README for the full comparison.',
    },
```

### - [ ] Step 5.3: Update landing.test.ts

```ts
describe('landing — v4 differentiation (5 rows)', () => {
  it('zh has exactly 5 differentiation rows', () => {
    assert.equal(zh.landing.differentiation.rows.length, 5);
  });
  it('en has exactly 5 differentiation rows', () => {
    assert.equal(en.landing.differentiation.rows.length, 5);
  });
  it('zh heading is "和别的工具有啥不同"', () => {
    assert.equal(zh.landing.differentiation.heading, '和别的工具有啥不同');
  });
  it('one of the rows is "first author"-framing rejection', () => {
    const zhFirstAuthor = zh.landing.differentiation.rows.find(r =>
      r.competitor.includes('first author'),
    );
    const enFirstAuthor = en.landing.differentiation.rows.find(r =>
      r.competitor.toLowerCase().includes('first author'),
    );
    assert.ok(zhFirstAuthor, 'zh missing first-author row');
    assert.ok(enFirstAuthor, 'en missing first-author row');
  });
});
```

### - [ ] Step 5.4: Run tests

```bash
pnpm web:typecheck && pnpm web:test
```

### - [ ] Step 5.5: Commit

```bash
git add apps/web/src/lib/i18n/locales/zh.ts \
        apps/web/src/lib/i18n/locales/en.ts \
        apps/web/tests/landing.test.ts
git commit -m "$(cat <<'EOF'
P5(landing-v4 T5): differentiation 4→5 行 — 加 GitHub Issues + first-author + cloud-tools

- 节标题 "5 年差异化锚点" → "和别的工具有啥不同"
- 4 行 → 5 行：
  - Notion / Obsidian (合并)
  - Curvenote / Quarto / Overleaf (合并)
  - GitHub Issues for Science (新)
  - 传统 "first author et al." (新，反 priority race)
  - 关在云端的协作工具 (新，对齐 client-first)
- footnote 删 "ADR-0016 dogfood gate" 行话
- 全大白话翻译，无 "ORCID-签名 / claim 级 / JWS"

ADR-0020 §3 Good 第 1 条 5 年差异化锚点深化对齐。spec §3.5 落地。Task 5/8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Architecture ASCII 图 + caption 改

**Files:**
- Modify: `apps/web/src/lib/i18n/locales/zh.ts`（landing.architecture 整块）
- Modify: `apps/web/src/lib/i18n/locales/en.ts`（镜像）
- Modify: `apps/web/tests/landing.test.ts`（architecture 断言）
- Landing.tsx **不动**（架构 section render 不依赖具体行数）

### - [ ] Step 6.1: Replace zh.ts landing.architecture

```ts
    architecture: {
      heading: '装好之后长这样',
      sub: '桌面端为主：你的内容、你的 AI 都在你电脑上。要协作时再通过你自己的服务器同步。',
      caption:
        '内容和 AI 都跑在你的桌面端。需要和合作者同步时，过你自己的服务器中转一次。不需要协作的项目，连服务器都可以不要。',
      ascii: [
        '   你的桌面 (主)              你的服务器（可选）            协作者桌面',
        '   ┌────────────┐  WebSocket  ┌──────────────┐  WebSocket  ┌────────────┐',
        '   │  编辑器    │ ─────────── │  协作中转    │ ─────────── │  编辑器    │',
        '   │  想法/原型 │             │  + 备份      │             │  想法/原型 │',
        '   │  /论文     │             │              │             │  /论文     │',
        '   │  本地 AI   │             │              │             │  本地 AI   │',
        '   └────────────┘             └──────────────┘             └────────────┘',
      ],
    },
```

### - [ ] Step 6.2: Mirror to en.ts

```ts
    architecture: {
      heading: 'After self-hosting',
      sub: 'Desktop-first: your content and your AI live on your machine. When collaborating, you sync through your own server.',
      caption:
        "Content and AI run on your desktop. To sync with collaborators, route through your own server. For solo projects, you don't need the server at all.",
      ascii: [
        '   Your desktop (main)        Your server (optional)        Collaborator desktop',
        '   ┌────────────┐  WebSocket  ┌──────────────┐  WebSocket  ┌────────────┐',
        '   │  Editor    │ ─────────── │  Sync relay  │ ─────────── │  Editor    │',
        '   │  ideas /   │             │  + backups   │             │  ideas /   │',
        '   │  prototypes│             │              │             │  prototypes│',
        '   │  / papers  │             │              │             │  / papers  │',
        '   │  local AI  │             │              │             │  local AI  │',
        '   └────────────┘             └──────────────┘             └────────────┘',
      ],
    },
```

注意：zh 和 en ascii **行数必须相同**（landing.test.ts:78 已有断言走 length parity）。zh 有 7 行；en 也是 7 行。

### - [ ] Step 6.3: Update landing.test.ts architecture assertions

替换原 architecture ASCII 行数断言（line 78-84）保留不动（自动适应新长度），新增内容断言：

```ts
  it('zh architecture mentions 桌面端 + 协作者', () => {
    assert.match(zh.landing.architecture.sub, /桌面端/);
    assert.match(zh.landing.architecture.caption, /桌面|本地|服务器/);
  });
  it('en architecture mentions desktop + collaborator', () => {
    assert.match(en.landing.architecture.sub, /Desktop-first/i);
    assert.match(en.landing.architecture.caption, /desktop|server/i);
  });
```

### - [ ] Step 6.4: Run tests

```bash
pnpm web:typecheck && pnpm web:test
```

### - [ ] Step 6.5: Commit

```bash
git add apps/web/src/lib/i18n/locales/zh.ts \
        apps/web/src/lib/i18n/locales/en.ts \
        apps/web/tests/landing.test.ts
git commit -m "$(cat <<'EOF'
P5(landing-v4 T6): architecture 三方图 — 桌面端为主 + 协作者对齐 client-first

- 节标题 "架构一图" → "装好之后长这样"
- ASCII 图从 2 方（浏览器 + 服务器）→ 3 方（桌面 + 服务器 + 协作者桌面）
- caption 删 "Editor/Sync/Snapshot/Agent Worker 四件套 / pgboss / WAL-G" 行话
- 强调桌面端为主（content + AI 都跑在桌面）+ 服务器可选

client-first pivot invariant #1+#3+#5+#8 对齐。spec §3.6 落地。Task 6/8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 节顺序调整 + 移动端 stack 验证

**Files:**
- Modify: `apps/web/src/components/landing/Landing.tsx`（节顺序）

### - [ ] Step 7.1: Verify current section order

读 `apps/web/src/components/landing/Landing.tsx`，确认当前节顺序（在 Task 2 已 reorder attribution 紧贴 pillars 后；本 task 调 specimens / differentiation / architecture 位置）：

v3 旧顺序：Hero → Pillars → Differentiation → Specimens → Architecture
v4 目标顺序：Hero → Pillars → **Attribution**（Task 2 已加）→ **Specimens**（提到 Differentiation 之前）→ Differentiation → Architecture

### - [ ] Step 7.2: Reorder sections in Landing.tsx

调整 `<main>` 内 section 顺序，使其按以下顺序排列：

1. Hero section（含 2 列 TriadicMockup，已在 Task 3）
2. Pillars section（已在 Task 2）
3. Attribution section（已在 Task 2）
4. Specimens section（**从 differentiation 之后挪到之前**，已在 Task 4 内容更新过；只调位置）
5. Differentiation section
6. Architecture section
7. Bottom nav section
8. Footer

具体做法：cut Specimens section（在 Differentiation 之后的位置），paste 到 Differentiation section 之前。

### - [ ] Step 7.3: Run tests + smoke check

```bash
pnpm web:typecheck && pnpm web:test
```

启动 dev server 浏览器手测：

```bash
pnpm web:dev
# 浏览器打开 http://localhost:3000/ （未登录）
# 1440×900 desktop：
#   - 看到 Hero 左文字 + 右 TriadicMockup（3 个 card + 2 个 ↓）
#   - 节顺序：Hero → 能做什么 → 每一个想法都有名字 → 看一眼（3 SVG）→ 和别的工具有啥不同（5 行） → 装好之后长这样 → 链接 → footer
#   - H1 巨号不溢出
#   - 中/英 i18n 切换都正常
# 375×667 mobile：
#   - Hero stack 单列（文字 → mockup）
#   - 其余节点都正常 stack
#   - H1 仍 readable，不溢出
```

### - [ ] Step 7.4: Commit

```bash
git add apps/web/src/components/landing/Landing.tsx
git commit -m "$(cat <<'EOF'
P5(landing-v4 T7): 节顺序 — Hero → Pillars → Attribution → 看一眼 → vs → 架构

- Specimens 从 Differentiation 之后挪到之前：访客看完 pillar 文字立刻看
  到三层实物（spec §3.4 顺序）
- Differentiation 下沉到第 5 节，服务"已经感兴趣、要做横向比较"的访客
- 移动端 stack 单列验证通过

spec §0/§3.4/§3.5 节顺序落地。Task 7/8。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 最终 quality gates + 行话清零 grep + 浏览器手测

**Files:** 无新增；仅校验 + 视实际发现回补 commit。

### - [ ] Step 8.1: Full workspace typecheck

```bash
cd /Users/jili/Documents/GitHub/collaborationtool
pnpm typecheck
```

Expected: PASS（全 workspace）。

### - [ ] Step 8.2: Full apps/web test suite

```bash
pnpm web:test
```

Expected: PASS（含 i18n.test.ts shape parity + landing.test.ts v4 contract + 其他 apps/web tests 不受影响）。

### - [ ] Step 8.3: Design.md §11 reject criteria grep gate（CLAUDE.md §4.6）

```bash
git diff origin/main..HEAD -- apps/web/src apps/web/public | grep -E "bg-blue-(500|600|700)|rounded-(lg|xl|2xl|full)|bg-zinc-(50|100|200)|shadow-(sm|md|lg|xl)|#3B82F6|#2563EB|#0EA5E9"
```

Expected: 空输出。若有命中，回相关 Task 修。

例外：可能在 SVG 里出现 `#1F3A5F`（这是 `--color-accent-ink` token 值，Design.md §12.1 定义）—— 在 SVG 里 inline 是允许的（SVG 不支持 CSS var）。grep 范围限制到 `apps/web/src` 可避免 SVG 假阳性：

```bash
git diff origin/main..HEAD -- apps/web/src | grep -E "bg-blue-(500|600|700)|rounded-(lg|xl|2xl|full)|bg-zinc-(50|100|200)|shadow-(sm|md|lg|xl)|#3B82F6|#2563EB|#0EA5E9"
```

### - [ ] Step 8.4: v4 行话清零 grep gate（spec §6）

```bash
rg -o "Triadic|triadic|Night Science|night-science|夜科学|Bridge Layer|bridge-layer|discovery-graph|contribution-graph|interaction-mode|Yanai|Lercher|Markup-as-source|WYSIWYM|双月刊|vol\. 01" apps/web/src/lib/i18n/locales apps/web/src/components/landing
```

Expected: 空输出。**例外**：
- `edge1Mode: 'metaphor-bridge'` 和 `edge2Mode: 'hypothesis-output'` 在 heroMockup locale —— 这两个字符串是 InteractionMode 枚举值，**会**在 mockup 里渲染显示。这是 Hero mockup 内的小字标签，不是首页主文案；属于"标签性技术术语"，可保留。但 `interaction-mode` 这个**字段名/概念名**不会出现在 locale 字面值中。

确认时只检：locale 字面值（非字段名）中**不**出现 `Triadic / Night Science / Bridge Layer` 等概念性术语。`metaphor-bridge` / `hypothesis-output` 作为具体 mode 标签是允许的（mockup 已包装在 mono 小字里）。

### - [ ] Step 8.5: 浏览器手测（5 秒识别测试 prep）

```bash
pnpm web:dev
```

在 1440×900 + 375×667 两 viewport 检：

- [ ] Hero 首屏内能看到：左 H1 "论文不是科研的全部" + 右 TriadicMockup 3 个 card
- [ ] 节顺序：Hero → Pillars (3 个 + Attribution) → Specimens (3 SVG) → Differentiation (5 行) → Architecture → nav → footer
- [ ] 3 张新 SVG 加载正常，CJK 字符显示（不缺字体）
- [ ] 中/英 i18n toggle 切换无文案降级
- [ ] 无 console warning / error

5 秒识别测试（spec §6 验收 + §5 acceptance）：

- 找 ≥ 3 个不知项目的研究者朋友打开页面 5 秒后问"这工具和 Notion / Curvenote / Overleaf 有啥不同"
- 目标：≥ 2/3 答出"它把想法和原型也当一等内容"或等价表述
- 若 < 2/3 → 文案再回头修（不在本 task；记录回 spec §10 后续）

### - [ ] Step 8.6: 若全部 gate 通过，可选 commit 一份 STATUS 更新

如果 Task 1-7 已全部 commit 通过，本 task 通常**无需新 commit**。

例外：若你在浏览器手测中发现 Design.md tokens 在 CSS 里有缺失（如 `--color-paper-2` 未定义），需要补 globals.css；这种情况 commit 一笔 fix：

```bash
git add apps/web/src/app/globals.css
git commit -m "P5(landing-v4 T8): globals — 补 --color-paper-2 token (TriadicMockup deps)"
```

可选 STATUS.md 更新（CLAUDE.md §4.2 要求 phase 推进 / commit landed 同步 STATUS）：

```bash
# 编辑 STATUS.md 顶部"最后更新"行 + §1 当前阶段 + §2 ADR 表
# 标注：landing v4 已 ship，ADR-0020 Wave D-4 UI 前置工作完成
```

---

## Self-Review

跑这个 checklist：

**1. Spec coverage** — spec §3 各小节都覆盖到 Task 几？

| spec § | task |
|---|---|
| §3.1 Hero 区域 | Task 1 |
| §3.2 Hero 右半 TriadicMockup | Task 3 |
| §3.3 能做什么 节（3 pillar + Attribution） | Task 2 |
| §3.4 看一眼 节（3 张 SVG） | Task 4 |
| §3.5 和别的工具有啥不同 节（5 行） | Task 5 |
| §3.6 装好之后长这样 节 | Task 6 |
| §3.7 底部 nav | 不动（已对齐） |
| §3.8 删除项（vol/issue eyebrow + 4 ASCII 微图 + 5 年锚点节副标 + 旧 specimens） | Task 1（eyebrow）+ Task 2（ASCII）+ Task 5（节副标）+ Task 4（specimens） |
| §5 工作量估计 | 全 8 task 累计 ~6h |
| §6 行话清零 grep | Task 8 |
| §7 §11 reject criteria | Task 8 |

✅ 全覆盖。

**2. Placeholder scan** — 任何 "TBD" / "TODO" / "类似 Task N"？

无。每个 Task 都给出完整 locale 字面值 + 完整代码 + 完整测试。SVG 3 张全 inline 在 plan 里（不是"待造"）。✅

**3. Type consistency** — 后面 task 用的字段名 / 函数名是否和前面定义匹配？

- `landing.heroMockup` 14 字段名在 Task 3 定义 + Task 3 TriadicMockup 消费 + Task 3 测试断言 → 一致 ✅
- `landing.pillars.thinking/prototyping/paper` 在 Task 2 定义 + Landing.tsx 消费 → 一致 ✅
- `landing.attribution.heading/desc` 在 Task 2 定义 + Landing.tsx 消费 → 一致 ✅
- `landing.specimens.{night,bridge,lineage}{Alt,Caption}` 在 Task 4 定义 + Landing.tsx + 测试一致 ✅

无 mismatch。

**4. Test-implementation 顺序** — TDD 各 task 内 step 顺序？

每个 task 内部都：(a) 改 locale → (b) 写/改测试 → (c) 改 Landing.tsx 消费 → (d) 跑测试 → (e) commit。i18n.test.ts shape parity 是 free gate。✅

**5. Phase tagging** — commit message 都用 `P5(landing-v4 T<N>):` 前缀 ✅

---

## Execution Handoff

Plan 已写完。两个执行选项：

**1. Subagent-Driven（推荐）** — fresh subagent per task，每 task 完后 review 再发下一个。慢但稳。

**2. Inline Execution** — 我在当前 session 直接跑 8 task，每完成一 task 给你看 commit + diff，遇 fail 立刻停。

哪个？
