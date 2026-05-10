# Claude Design — UI Brief（直接复制粘贴到 Claude Design）

> 把下面 *整段* 粘贴到 Claude Design 的初始 prompt。它带上了项目第一性原理、视觉锚点、要避开的反模式、以及 9 个待设计 surface 的清单。生成后再追加单 surface 的细化 prompt 即可。

---

## ＋ 粘贴起点 ＋

I'm designing the UI for an **AI-native research paper collaboration platform**. This is **not** another Overleaf clone or Notion-for-academics — please read the constraints below carefully before sketching anything; the visual direction is the most opinionated part of the project.

### 1. What the product actually is

A platform where researchers (PhD students, faculty, independent scholars) write and review papers **together with humans, AI agents, and the broader community on equal footing**. The document is not a text flow — it's a **heterogeneous content graph**: paragraphs, equations, figures, citations, executable code cells, dataset references, annotation threads, AI agent revision trails, community contribution branches — every node is first-class. Every change has **provenance**: who/what wrote it, what prompt produced it, what tools were called. Local-first; Markdown/MyST/Typst is the source-of-truth, not a private format.

The platform is **bilingual at the bone**: 简体中文 and English are co-equal first-class citizens, in UI chrome, in document body, and in typography. CJK + Latin must never feel like one was bolted on.

### 2. Visual direction — what we want, what we forbid

**Aim for**: editorial / publication / magazine aesthetic.
Reference points: **Stripe Press, The Pudding, Distill.pub, Are.na, Working Not Working, Readwise, Craft, Linear (the chrome only — not the saturated purple), iA Writer**. Think *journal layout* + *engineered software craftsmanship* + *typographic restraint*.

**Forbid (these will get rejected on sight)**:
- Inter font everywhere + a saturated tech-blue (`#3B82F6`/`#2563EB`) accent + 8–12px-rounded cards on a `bg-zinc-50` page. This is the dead generic-SaaS aesthetic and we are explicitly not that.
- Chatbot-style "AI sidebar" with a 💬 bubble — AI is a **collaborator that takes turns** in the document, not a side-panel assistant.
- A generic Material/Bootstrap data table for the document list.
- Emojis used as iconography. Use real glyph icons (Phosphor Duotone, Lucide stroked, or commission custom).
- Rainbow status pills. Status comes from typographic rhythm + a single muted accent, not 6 saturated colors.

**Typography rules (non-negotiable)**:
- Body / running prose: **serif** for both CJK and Latin. Latin: a transitional or modern serif (Tiempos, Source Serif 4, Newsreader, GT Sectra, Charter). CJK: *Source Han Serif SC* (思源宋体) primary, with `Songti SC` / `Noto Serif CJK SC` fallbacks. Heights and stems must visually align — when a paragraph mixes 中文 and English the baselines should look like one paragraph, not two pasted together.
- UI chrome / nav / labels: a humanist sans (GT America, Söhne, Inter Display *only if you must*, Untitled Sans). CJK pair: *Source Han Sans SC* (思源黑体).
- Mono for code / computational cells: JetBrains Mono, IBM Plex Mono, or Berkeley Mono.
- CJK punctuation must be **half-width-compressed where appropriate** (the `cjk-spacing.ts` module already implements this — design must respect the resulting metrics). Smart-quote rules differ per language (`smart-quote-by-lang.ts`); never substitute straight `"` for `「」` in Chinese.
- Numerals in body text: oldstyle (`fdnum 1`) — they should *sit on the line* with x-height, not stand tall like a SaaS dashboard.

**Color**:
- Background: an off-white / warm paper tone (think `#FBFAF7` / `#F7F5EF`), **not** pure white, **not** `bg-zinc-50`.
- Ink: a warm near-black (`#1A1714` or `#13110E`), not `#000`.
- Single restrained accent. Pick one of: a desaturated ink-blue (`#1F3A5F`), oxblood (`#7B2D26`), or moss (`#3F5B3A`). Use it for links + 1-2 primary actions only.
- Status / provenance signals (AI vs human vs community) live in a **muted cool / muted warm / muted earth** triad — never the standard green-amber-red.

**Layout**:
- 12-column on desktop is fine, but **the document editor wants asymmetric columns** (think a journal: ~70 ch main column, a wider-than-usual margin on one side for annotations / provenance / AI suggestions). Marginalia is a first-class layout citizen, *not* a popover.
- Density: closer to *editorial* than *productivity-app*. Generous line-height (1.6–1.7 for body), comfortable margins, but information-rich (don't pad everything to 80% whitespace).
- Hairline rules (1px or 0.5px) over filled boxes. Borders > shadows. If you reach for a shadow, ask first whether a rule does the job.

### 3. The AI-collaborator pattern (most distinctive surface — get this right)

When an AI agent is "working in" the document, it should not appear as a popup or side-chat. Show it as **another author taking turns**:
- A revision trail in the margin: "Citation Agent · 2 min ago · linking 3 claims to CrossRef" — strikethroughs / additions inline, attributed.
- Agents have visible **identity** (name + small monogram, not a robot emoji), a quota indicator (X / Y tool calls left), and a one-click "interrupt" affordance.
- "Propose" vs "Apply" are visually distinct — proposed edits are dashed-underlined and dimmed until accepted.
- Provenance is one click away on any paragraph: who/what authored it, what prompt, what tools.

### 4. Surfaces to design (in priority order)

1. **Landing (`/`)** — pre-login. Editorial hero with bilingual headline; show the *document-as-graph* idea visually (a small typographic sample with 1 marginalia, 1 citation, 1 annotation thread); single primary CTA.
2. **Login + Signup (`/login`, `/signup`)** — minimal, editorial form. ORCID is a first-class second option (the platform integrates with ORCID iD).
3. **Documents list (`/docs`)** — the user's papers. Not a table. Closer to **a personal index page in a journal**: title (大字), authors, last edit, language tag (中/EN/双语), agent activity hint. Filter / search top-right but understated.
4. **New document (`/docs/new`)** — a focused full-page form: title, primary language (中文 / English / 双语 mono / 双语 mirror), template (blank / arXiv preprint / journal-XXX / thesis-chapter).
5. **Editor (`/editor/[docId]`)** — the centerpiece. Three zones:
   - Main column: the prose itself (serif, oldstyle figures, real CJK punctuation).
   - Marginalia rail: provenance, AI revisions, citation popovers, annotation threads — *flowing alongside*, not stacked at the bottom.
   - Top chrome: title + collaborators (humans + agents avatars + connection state) + export + a single "AI" verb-menu (Cite this · Review · Extract sources · …) — *not* a chat bubble.
   - Block-level affordances on hover: "lock", "propose change", "comment", "see history".
6. **Maintenance scan (`/maintenance`)** — issues found by background agents (broken citations, unsupported claims, dead links). A **review queue**, not a dashboard. Each item has provenance + accept/dismiss/snooze.
7. **Settings (`/settings`)** — index page; sub-pages exist: `/settings/models` (BYO model API keys — OpenAI / Anthropic / OpenRouter / local), `/settings/plugins` (install agent plugins from the plugin registry). Settings should feel like configuring a **studio**, not a SaaS billing page.
8. **New organization (`/orgs/new`)** — a simple form, but visually consistent with the rest.
9. **Invite acceptance (`/invite/[id]`)** — a single decision page: "Demo User invited admin@local.test to *Demo Document* as paper-reviewer. Accept?" Show the document title in serif large, the role in muted accent.

### 5. Components / system to ship

Please return:
- A **type ramp** with display / H1 / H2 / H3 / body-zh / body-en / caption / mono variants (size + leading + tracking + weight, both CJK and Latin specimens shown).
- A **color token table** (background-paper, ink, ink-muted, accent, accent-muted, agent-tone, human-tone, community-tone, hairline).
- 3 **status-pill variants** (proposed / applied / blocked) using the muted triad — not bright.
- 1 **provenance card** (inline mini-component showing actor + prompt-hash + tool-calls).
- 1 **citation popover** (CrossRef-shaped: title, authors, journal-volume-pages-year, DOI link, "bind to claim X" button).
- 1 **agent identity chip** (monogram + name + quota dot + interrupt button).
- The **editor block hover-rail** affordances.
- Light theme is primary. Dark theme is required but designed second — and it must be an *ink-on-warm-deep-background* (think `#13110E` background, `#E8E2D5` ink), **not** the default Tailwind slate.

### 6. Interaction notes

- Latency targets: keystroke < 100ms; equation render < 50ms; PDF export < 5s on a typical paper. Design must not introduce animations that feel slower than the underlying system.
- All transitions ≤ 180ms. No "bouncy" easings. Linear or `cubic-bezier(0.2, 0, 0, 1)`.
- Hover states are **typographic** (underline appears, weight shifts 50, accent ink) before they're chromatic.
- Focus rings: a 2px hairline accent ring with 2px offset — never the browser-default blue glow.

### 7. What I'd like back

- Mockups in Figma-style frames for all 9 surfaces above (desktop primary at 1440×900, also a 768 tablet pass for the editor).
- The component / token system from §5.
- A **bilingual specimen page** showing your typography pair handling 中英混排 in the document body — this is where most "AI-generated UI" falls apart and I will judge the whole submission on it.
- One "moment of delight" — pick *one* small interaction (e.g., the citation bind, the agent-takes-turn micro-animation, the provenance reveal) and design it carefully. One thing done well > five things rough.

### 8. Things that will get the work rejected

- Tailwind defaults visible (rounded-lg cards, bg-blue-500, ring-blue-500/50, text-zinc-50 on dark, gradient buttons).
- Any emoji in chrome/nav (a 📄 next to "Docs" → no).
- Chatbot drawer for AI.
- Same font (e.g. Inter) used for both UI and body prose.
- A document-list table.
- Status colors in the standard green/amber/red.
- CJK and Latin in the same paragraph at visibly different heights / weights.

— end of brief —

## ＋ 粘贴终点 ＋

---

## 单 surface 细化 prompt 模版（设计完总览后用）

> "Now go deeper on the **Editor** surface. Show: (a) the marginalia rail with 3 different content types stacked (provenance card, AI proposed edit, annotation thread), (b) what happens visually when an agent is mid-action (turn indicator), (c) the block hover rail at rest and on hover. Hold the typography + color rules from the brief."

> "Now the **Documents list** at zero state (no docs yet) and at populated state (8 docs, 2 with active agent activity, 1 bilingual). The empty state must not be a sad cloud illustration."

> "Now the **dark theme pass** of the editor — same composition, ink-on-warm-deep-background, not slate. Show how the muted-triad status colors translate."

---

## 项目背景速查（需要时发给 Claude Design）

- 仓库：pnpm workspace。`apps/web` (Next.js 15 + better-auth)、`apps/sync-gateway`、`packages/editor-core` (TipTap)、`packages/typography` (CJK 排版).
- Phase: 当前 Phase 4，已落 plugin install / BYO model / subdocument backend.
- 关键 ADR：ADR-0001 schema、ADR-0002 capability/role bundle、ADR-0008 long-horizon agent、ADR-0010 plugin/skill 边界、ADR-0014 subdocument、ADR-0015 ORCID-signed peer review.
- 已在用：better-auth 邮箱密码 + ORCID OAuth (env 可选)、CrossRef MCP (mock fixture + real)、y-sweet 自托管 Yjs.
