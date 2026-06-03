// Design system component contract tests (Design.md §5).
//
// These run under `node --test` (no jsdom, no @testing-library — see
// tests/landing.test.ts for repo convention). We pin behavior via two
// channels:
//
//   1. Module shape — barrel + each component file exports the named
//      function + matching default export.
//   2. Element contract — call the component as a function and walk
//      the returned React element tree, asserting className / data-* /
//      aria-* / children. This sidesteps the DOM but still catches
//      regressions in token-driven className composition.
//   3. Token discipline — grep the source files for hardcoded hex /
//      forbidden Tailwind utilities (Design.md §11).
//
// Components are pure (no Server Component primitives), so synchronous
// invocation is safe.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  Button,
  MonoDisc,
  StatusPill,
  ProvenanceCard,
  CitationPopover,
  BlockHoverRail,
  MarginaliaEntry,
  HairlineRule,
  Icon,
  LineGlyph,
  ProductFrame,
} from '../src/components/design';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const designDir = path.resolve(__dirname, '../src/components/design');

// ---------------------------------------------------------------------------
// Element-tree walker — react element trees are plain objects; we
// recurse children flattening fragments + arrays so we can assert on
// nested props without a renderer.

type ReactElementLike = {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
};

function isElement(x: unknown): x is ReactElementLike {
  return (
    typeof x === 'object' &&
    x !== null &&
    '$$typeof' in (x as object) &&
    'props' in (x as object)
  );
}

function flattenChildren(children: unknown): unknown[] {
  if (children === null || children === undefined || children === false)
    return [];
  if (Array.isArray(children)) return children.flatMap(flattenChildren);
  return [children];
}

// Walk an element tree. When we hit a function-typed element (a custom
// component), call it with its own props so we descend into the rendered
// tree — our components are all pure functions of props with no hooks
// state, which keeps this safe for test-time inspection.
function findAll(
  root: unknown,
  predicate: (el: ReactElementLike) => boolean,
  depth = 0,
): ReactElementLike[] {
  const matches: ReactElementLike[] = [];
  const walk = (node: unknown, d: number) => {
    if (d > 50) return; // cycle guard
    if (!isElement(node)) return;
    if (predicate(node)) matches.push(node);
    if (typeof node.type === 'function') {
      try {
        const rendered = (node.type as (p: unknown) => unknown)(node.props);
        walk(rendered, d + 1);
      } catch {
        // Component invocation failed — fall back to children walk.
      }
    }
    for (const child of flattenChildren(node.props.children)) walk(child, d + 1);
  };
  walk(root, depth);
  return matches;
}

function classNameOf(el: ReactElementLike): string {
  return typeof el.props.className === 'string' ? el.props.className : '';
}

// Strict-mode index-access bypass — `noUncheckedIndexedAccess` returns
// `T | undefined` for arr[i]; we asserted length above so this is safe.
function nth<T>(arr: T[], i: number): T {
  const x = arr[i];
  if (x === undefined) throw new Error(`expected element at index ${i}`);
  return x;
}

// ---------------------------------------------------------------------------
// 5.1 Button

describe('design/Button', () => {
  it('renders 3 variants with the right primary class', () => {
    const primary = Button({ variant: 'primary', children: 'Go' });
    const ghost = Button({ variant: 'ghost', children: 'Maybe' });
    const link = Button({ variant: 'link', children: 'Link' });
    assert.match(classNameOf(primary as ReactElementLike), /\bbtn-primary\b/);
    assert.match(classNameOf(ghost as ReactElementLike), /\bbtn-ghost\b/);
    assert.match(classNameOf(link as ReactElementLike), /\bbtn-link\b/);
  });

  it('renders 3 sizes with the right size class', () => {
    const sm = Button({ size: 'sm', children: 'sm' });
    const md = Button({ size: 'md', children: 'md' });
    const lg = Button({ size: 'lg', children: 'lg' });
    assert.match(classNameOf(sm as ReactElementLike), /\bbtn-size-sm\b/);
    assert.match(classNameOf(md as ReactElementLike), /\bbtn-size-md\b/);
    assert.match(classNameOf(lg as ReactElementLike), /\bbtn-size-lg\b/);
  });

  it('disabled adds is-disabled class + aria-disabled on anchor', () => {
    const btn = Button({ disabled: true, children: 'X' }) as ReactElementLike;
    assert.match(classNameOf(btn), /\bis-disabled\b/);
    assert.equal(btn.props.disabled, true);

    const link = Button({
      as: 'a',
      href: '/x',
      disabled: true,
      children: 'L',
    }) as ReactElementLike;
    assert.equal(link.type, 'a');
    assert.equal(link.props['aria-disabled'], true);
  });

  it('bilingual aria-label joins with middle dot', () => {
    const btn = Button({
      ariaLabel: '保存',
      ariaLabelEn: 'Save',
      children: '保存',
    }) as ReactElementLike;
    assert.equal(btn.props['aria-label'], '保存 · Save');
  });
});

// ---------------------------------------------------------------------------
// 5.2 MonoDisc

describe('design/MonoDisc', () => {
  it('three kinds map to the right data-kind attribute', () => {
    const a = MonoDisc({ kind: 'agent', monogram: 'A' }) as ReactElementLike;
    const h = MonoDisc({ kind: 'human', monogram: 'YW' }) as ReactElementLike;
    const c = MonoDisc({
      kind: 'community',
      monogram: 'C',
    }) as ReactElementLike;
    assert.equal(a.props['data-kind'], 'agent');
    assert.equal(h.props['data-kind'], 'human');
    assert.equal(c.props['data-kind'], 'community');
    for (const el of [a, h, c]) {
      assert.match(classNameOf(el), /\bmono-disc\b/);
    }
  });

  it('monogram is uppercased + truncated to 2 chars', () => {
    const el = MonoDisc({
      kind: 'agent',
      monogram: 'abcd',
    }) as ReactElementLike;
    assert.equal(el.props.children, 'AB');
  });

  it('aria-label includes both zh and en kind label', () => {
    const el = MonoDisc({
      kind: 'agent',
      monogram: 'AI',
      actorName: 'Claude',
    }) as ReactElementLike;
    const aria = String(el.props['aria-label'] ?? '');
    assert.match(aria, /Claude/);
    assert.match(aria, /AI 协作者/);
    assert.match(aria, /AI agent/);
  });
});

// ---------------------------------------------------------------------------
// 5.3 StatusPill

describe('design/StatusPill', () => {
  it('three statuses set data-state correctly', () => {
    const p = StatusPill({ status: 'proposed' }) as ReactElementLike;
    const a = StatusPill({ status: 'applied' }) as ReactElementLike;
    const b = StatusPill({ status: 'blocked' }) as ReactElementLike;
    assert.equal(p.props['data-state'], 'proposed');
    assert.equal(a.props['data-state'], 'applied');
    assert.equal(b.props['data-state'], 'blocked');
    for (const el of [p, a, b]) {
      assert.match(classNameOf(el), /\bpill\b/);
    }
  });

  it('renders bilingual label by default (zh · en)', () => {
    const el = StatusPill({ status: 'proposed' }) as ReactElementLike;
    const zhSpan = findAll(el, (n) => n.props.lang === 'zh');
    const enSpan = findAll(el, (n) => n.props.lang === 'en');
    assert.equal(zhSpan.length, 1);
    assert.equal(enSpan.length, 1);
    assert.equal(nth(zhSpan, 0).props.children, '已提议');
    assert.equal(nth(enSpan, 0).props.children, 'Proposed');
  });

  it('custom labels override defaults', () => {
    const el = StatusPill({
      status: 'applied',
      label: '上线',
      labelEn: 'Live',
    }) as ReactElementLike;
    const zhSpan = findAll(el, (n) => n.props.lang === 'zh');
    const enSpan = findAll(el, (n) => n.props.lang === 'en');
    assert.equal(nth(zhSpan, 0).props.children, '上线');
    assert.equal(nth(enSpan, 0).props.children, 'Live');
  });
});

// ---------------------------------------------------------------------------
// 5.4 ProvenanceCard

describe('design/ProvenanceCard', () => {
  const baseProps = {
    kind: 'agent inline edit',
    paragraphIndex: 12,
    actorMonogram: 'CL',
    actorName: 'Claude',
    actorKind: 'agent' as const,
    time: '2026-05-10T09:30:00.000Z',
  };

  it('renders 3-section layout with two .rule-thick separators', () => {
    const el = ProvenanceCard(baseProps) as ReactElementLike;
    const rules = findAll(
      el,
      (n) => typeof n.props.className === 'string' && /rule-thick/.test(classNameOf(n)),
    );
    assert.equal(rules.length, 2, 'must have exactly two thick rules');
    const cap = findAll(el, (n) => /label-cap/.test(classNameOf(n)));
    assert.ok(cap.length >= 1, 'must include a label-cap section header');
    const capText = String(nth(cap, 0).props.children);
    assert.match(capText, /PROVENANCE/);
    assert.match(capText, /¶ 12/);
    assert.match(capText, /agent inline edit/);
  });

  it('renders MonoDisc with actorKind', () => {
    const el = ProvenanceCard(baseProps) as ReactElementLike;
    // MonoDisc returns a span with className mono-disc — find it.
    const discs = findAll(el, (n) =>
      classNameOf(n).split(/\s+/).includes('mono-disc'),
    );
    assert.equal(discs.length, 1);
    assert.equal(nth(discs, 0).props['data-kind'], 'agent');
  });

  it('skips optional fields when not provided', () => {
    const el = ProvenanceCard(baseProps) as ReactElementLike;
    const intent = findAll(el, (n) =>
      /provenance-card-intent/.test(classNameOf(n)),
    );
    const prompt = findAll(el, (n) =>
      /provenance-card-prompt/.test(classNameOf(n)),
    );
    assert.equal(intent.length, 0);
    assert.equal(prompt.length, 0);
  });

  it('renders all optional fields when provided', () => {
    const el = ProvenanceCard({
      ...baseProps,
      commitIntent: 'tighten claim',
      prompt: 'Rewrite with concrete example',
      toolCalls: [
        { name: 'crossref.lookup', ms: 240 },
        { name: 'editor.apply', ms: 18 },
      ],
      hash: 'sha256:abc',
      model: 'claude-3-5-sonnet',
      cost: '$0.0034',
    }) as ReactElementLike;
    const tools = findAll(el, (n) =>
      /provenance-card-tools/.test(classNameOf(n)),
    );
    assert.equal(tools.length, 1);
    const toolItems = flattenChildren(nth(tools, 0).props.children).filter(
      isElement,
    );
    assert.equal(toolItems.length, 2);
    const meta = findAll(el, (n) =>
      /provenance-card-meta/.test(classNameOf(n)),
    );
    assert.equal(meta.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 5.5 CitationPopover

describe('design/CitationPopover', () => {
  const baseProps = {
    authors: 'Higgs P.',
    title: 'Broken symmetries and the masses of gauge bosons',
    journal: 'Phys. Lett. B',
    volume: '12',
    issue: '2',
    pages: '132–133',
    year: 1964,
    doi: '10.1103/PhysRev.145.1156',
    onBindToClaim: () => {},
    onOpen: () => {},
  };

  it('renders APA fields in detail line', () => {
    const el = CitationPopover(baseProps) as ReactElementLike;
    const detail = findAll(el, (n) =>
      /citation-popover-detail/.test(classNameOf(n)),
    );
    assert.equal(detail.length, 1);
    const text = JSON.stringify(nth(detail, 0).props.children);
    assert.match(text, /Phys\. Lett\. B/);
    assert.match(text, /12\(2\)/);
    assert.match(text, /pp\.132–133/);
    assert.match(text, /1964/);
  });

  it('renders DOI as mono code with doi.org link', () => {
    const el = CitationPopover(baseProps) as ReactElementLike;
    const doiLinks = findAll(
      el,
      (n) =>
        n.type === 'a' &&
        typeof n.props.href === 'string' &&
        (n.props.href as string).startsWith('https://doi.org/'),
    );
    assert.equal(doiLinks.length, 1);
    assert.equal(
      nth(doiLinks, 0).props.href,
      'https://doi.org/10.1103/PhysRev.145.1156',
    );
    assert.equal(nth(doiLinks, 0).props.rel, 'noopener noreferrer');
  });

  it('Bind + Open buttons fire the right callbacks with paragraph anchor', () => {
    let bindCount = 0;
    let openCount = 0;
    const el = CitationPopover({
      ...baseProps,
      paragraphAnchor: '¶ 7',
      onBindToClaim: () => bindCount++,
      onOpen: () => openCount++,
    }) as ReactElementLike;
    const buttons = findAll(
      el,
      (n) => typeof n.type === 'function' && (n.type as { name?: string }).name === 'Button',
    );
    assert.equal(buttons.length, 2);
    // Click each onClick handler.
    (nth(buttons, 0).props.onClick as () => void)();
    (nth(buttons, 1).props.onClick as () => void)();
    assert.equal(bindCount, 1);
    assert.equal(openCount, 1);
    // Bind label includes the paragraph anchor.
    assert.equal(nth(buttons, 0).props.children, 'Bind to claim · ¶ 7');
  });
});

// ---------------------------------------------------------------------------
// 5.6 BlockHoverRail

describe('design/BlockHoverRail', () => {
  const stub = () => {};
  const baseProps = {
    blockId: 'p_42',
    onLock: stub,
    onPropose: stub,
    onCite: stub,
    onHistory: stub,
  };

  it('renders 4 rail buttons with the right glyph data attribute', () => {
    const el = BlockHoverRail(baseProps) as ReactElementLike;
    const buttons = findAll(el, (n) => n.type === 'button');
    assert.equal(buttons.length, 4);
    const glyphs = buttons.map((b) => b.props['data-glyph']);
    assert.deepEqual(glyphs, ['lock', 'propose', 'cite', 'history']);
  });

  it('each button has bilingual aria-label', () => {
    const el = BlockHoverRail(baseProps) as ReactElementLike;
    const buttons = findAll(el, (n) => n.type === 'button');
    const labels = buttons.map((b) => String(b.props['aria-label']));
    for (const lab of labels) {
      assert.match(lab, / · /);
    }
    assert.match(nth(labels, 0), /锁定段落/);
    assert.match(nth(labels, 0), /Lock paragraph/);
  });

  it('alwaysVisible toggles the visibility class', () => {
    const hidden = BlockHoverRail(baseProps) as ReactElementLike;
    const visible = BlockHoverRail({
      ...baseProps,
      alwaysVisible: true,
    }) as ReactElementLike;
    assert.doesNotMatch(classNameOf(hidden), /block-hover-rail-visible/);
    assert.match(classNameOf(visible), /block-hover-rail-visible/);
  });

  it('clicking each glyph fires its own callback with blockId', () => {
    let lockId = '';
    let proposeId = '';
    let citeId = '';
    let historyId = '';
    const el = BlockHoverRail({
      ...baseProps,
      onLock: (id) => (lockId = id),
      onPropose: (id) => (proposeId = id),
      onCite: (id) => (citeId = id),
      onHistory: (id) => (historyId = id),
    }) as ReactElementLike;
    const buttons = findAll(el, (n) => n.type === 'button');
    for (const b of buttons) (b.props.onClick as () => void)();
    assert.equal(lockId, 'p_42');
    assert.equal(proposeId, 'p_42');
    assert.equal(citeId, 'p_42');
    assert.equal(historyId, 'p_42');
  });
});

// ---------------------------------------------------------------------------
// 5.7 MarginaliaEntry

describe('design/MarginaliaEntry', () => {
  const baseProps = {
    accent: 'agent' as const,
    actorMonogram: 'CL',
    actorName: 'Claude',
    actorNameEn: 'Claude',
    time: '2026-05-10T08:00:00.000Z',
    body: 'tightened the claim',
  };

  it('three accents map to data-kind on the aside', () => {
    const a = MarginaliaEntry({ ...baseProps, accent: 'agent' }) as ReactElementLike;
    const h = MarginaliaEntry({ ...baseProps, accent: 'human' }) as ReactElementLike;
    const c = MarginaliaEntry({
      ...baseProps,
      accent: 'community',
    }) as ReactElementLike;
    assert.equal(a.props['data-kind'], 'agent');
    assert.equal(h.props['data-kind'], 'human');
    assert.equal(c.props['data-kind'], 'community');
    for (const el of [a, h, c]) {
      assert.match(classNameOf(el), /\bmargin-entry\b/);
    }
  });

  it('renders body wrapped in <em>', () => {
    const el = MarginaliaEntry(baseProps) as ReactElementLike;
    const ems = findAll(el, (n) => n.type === 'em');
    assert.equal(ems.length, 1);
    assert.equal(nth(ems, 0).props.children, 'tightened the claim');
  });

  it('omits footer when no pill or meta provided', () => {
    const el = MarginaliaEntry(baseProps) as ReactElementLike;
    const foot = findAll(el, (n) => n.type === 'footer');
    assert.equal(foot.length, 0);
  });

  it('renders pill + meta when both provided', () => {
    const el = MarginaliaEntry({
      ...baseProps,
      pillStatus: 'proposed',
      pillLabel: '提议',
      pillLabelEn: 'Proposed',
      meta: 'crossref · 240ms',
    }) as ReactElementLike;
    const foot = findAll(el, (n) => n.type === 'footer');
    assert.equal(foot.length, 1);
    const pill = findAll(el, (n) =>
      classNameOf(n).split(/\s+/).includes('pill'),
    );
    assert.equal(pill.length, 1);
    assert.equal(nth(pill, 0).props['data-state'], 'proposed');
    const meta = findAll(el, (n) =>
      /margin-entry-meta/.test(classNameOf(n)),
    );
    assert.equal(meta.length, 1);
    assert.equal(nth(meta, 0).props.children, 'crossref · 240ms');
  });
});

// ---------------------------------------------------------------------------
// 5.8 HairlineRule

describe('design/HairlineRule', () => {
  it('thin → .rule, thick → .rule-thick', () => {
    const thin = HairlineRule({}) as ReactElementLike;
    const thick = HairlineRule({ weight: 'thick' }) as ReactElementLike;
    assert.equal(thin.type, 'hr');
    assert.match(classNameOf(thin), /\brule\b/);
    assert.doesNotMatch(classNameOf(thin), /\brule-thick\b/);
    assert.match(classNameOf(thick), /\brule-thick\b/);
  });

  it('dashed adds rule-dashed / rule-thick-dashed', () => {
    const td = HairlineRule({ dashed: true }) as ReactElementLike;
    const tkd = HairlineRule({
      weight: 'thick',
      dashed: true,
    }) as ReactElementLike;
    assert.match(classNameOf(td), /\brule-dashed\b/);
    assert.match(classNameOf(tkd), /\brule-thick-dashed\b/);
  });

  it('default is aria-hidden, custom ariaLabel reverses that', () => {
    const def = HairlineRule({}) as ReactElementLike;
    const lab = HairlineRule({ ariaLabel: 'section break' }) as ReactElementLike;
    assert.equal(def.props['aria-hidden'], true);
    assert.equal(lab.props['aria-hidden'], undefined);
    assert.equal(lab.props['aria-label'], 'section break');
  });
});

// ---------------------------------------------------------------------------
// v2 §5.10 Icon

describe('design/Icon', () => {
  it('renders an svg with line-art grammar (currentColor, no fill, round caps)', () => {
    const el = Icon({ name: 'idea' }) as ReactElementLike;
    assert.equal(el.type, 'svg');
    assert.equal(el.props['stroke'], 'currentColor');
    assert.equal(el.props['fill'], 'none');
    assert.equal(el.props['strokeWidth'], 1.4);
    assert.equal(el.props['strokeLinecap'], 'round');
    assert.equal(el.props['data-icon'], 'idea');
  });

  it('default is aria-hidden; ariaLabel makes it an img role', () => {
    const dec = Icon({ name: 'paper' }) as ReactElementLike;
    const lab = Icon({ name: 'paper', ariaLabel: '论文 · paper' }) as ReactElementLike;
    assert.equal(dec.props['aria-hidden'], true);
    assert.equal(lab.props['aria-hidden'], undefined);
    assert.equal(lab.props['role'], 'img');
    assert.equal(lab.props['aria-label'], '论文 · paper');
  });

  it('size maps to px (sm 16 / md 20 / lg 24)', () => {
    assert.equal((Icon({ name: 'plus', size: 'sm' }) as ReactElementLike).props['width'], 16);
    assert.equal((Icon({ name: 'plus', size: 'lg' }) as ReactElementLike).props['width'], 24);
  });
});

// ---------------------------------------------------------------------------
// v2 §5.11 LineGlyph

describe('design/LineGlyph', () => {
  it('wraps children in a line-art svg', () => {
    const el = LineGlyph({
      width: 120,
      height: 40,
      viewBox: '0 0 120 40',
      children: null,
    }) as ReactElementLike;
    assert.equal(el.type, 'svg');
    assert.equal(el.props['stroke'], 'currentColor');
    assert.equal(el.props['fill'], 'none');
    assert.equal(classNameOf(el).includes('line-glyph'), true);
  });
});

// ---------------------------------------------------------------------------
// v2 §5.9 ProductFrame

describe('design/ProductFrame', () => {
  it('renders a figure with a raised mat + bilingual caption', () => {
    const el = ProductFrame({
      src: '/screens/x.png',
      alt: 'demo',
      width: 1000,
      height: 600,
      caption: '复现准备度实时打分',
      captionEn: 'Reproducibility, scored live',
    }) as ReactElementLike;
    assert.equal(el.type, 'figure');
    const mats = findAll(el, (n) => /surface-raised/.test(classNameOf(n)));
    assert.equal(mats.length >= 1, true);
    const capZh = findAll(el, (n) => /product-frame-cap-zh/.test(classNameOf(n)));
    assert.equal(nth(capZh, 0).props.children, '复现准备度实时打分');
  });

  it('renders an in-layout provenance tick with the actor kind', () => {
    const el = ProductFrame({
      src: '/screens/x.png',
      alt: 'demo',
      width: 1000,
      height: 600,
      provenanceLabel: 'AI · agent',
      provenanceKind: 'agent',
    }) as ReactElementLike;
    const ticks = findAll(
      el,
      (n) => /product-frame-tick\b/.test(classNameOf(n)) && n.props['data-kind'] === 'agent',
    );
    assert.equal(ticks.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Module shape — barrel exports the named components.

describe('design/index — barrel export shape', () => {
  it('exports all components as functions', async () => {
    const mod = await import('../src/components/design');
    for (const name of [
      'Button',
      'MonoDisc',
      'StatusPill',
      'ProvenanceCard',
      'CitationPopover',
      'BlockHoverRail',
      'MarginaliaEntry',
      'HairlineRule',
      'Icon',
      'LineGlyph',
      'ProductFrame',
    ]) {
      assert.equal(
        typeof (mod as Record<string, unknown>)[name],
        'function',
        `barrel must export ${name}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Token discipline — components use globals.css token classes only,
// no hardcoded hex / forbidden Tailwind utilities (Design.md §11).

describe('design/* — token discipline (Design.md §11)', () => {
  const files = [
    'Button.tsx',
    'MonoDisc.tsx',
    'StatusPill.tsx',
    'ProvenanceCard.tsx',
    'CitationPopover.tsx',
    'BlockHoverRail.tsx',
    'MarginaliaEntry.tsx',
    'HairlineRule.tsx',
    'Icon.tsx',
    'LineGlyph.tsx',
    'ProductFrame.tsx',
  ];

  // Hardcoded hex is the loudest violation. Hairline-rule SVG uses
  // currentColor only — no literal palette.
  it('no hardcoded hex colors in any component', () => {
    for (const f of files) {
      const src = readFileSync(path.join(designDir, f), 'utf8');
      const hits = src.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
      assert.equal(
        hits.length,
        0,
        `${f} contains hardcoded hex: ${hits.join(', ')}`,
      );
    }
  });

  it('no banned Tailwind palette utilities', () => {
    const banned =
      /\b(bg-blue-(?:500|600|700)|bg-zinc-(?:50|100|200)|rounded-(?:lg|xl|2xl|full)|shadow-[a-z])/;
    for (const f of files) {
      const src = readFileSync(path.join(designDir, f), 'utf8');
      assert.doesNotMatch(
        src,
        banned,
        `${f} uses banned Tailwind utility (Design.md §11)`,
      );
    }
  });

  it('no chatbot-blue / saas-zinc literals', () => {
    const literals = /#3B82F6|#2563EB|#0EA5E9|#fafafa|#0F172A/i;
    for (const f of files) {
      const src = readFileSync(path.join(designDir, f), 'utf8');
      assert.doesNotMatch(src, literals, `${f} has chatbot-blue literal`);
    }
  });
});
