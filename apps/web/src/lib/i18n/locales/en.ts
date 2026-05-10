// English (en) dictionary — must mirror the shape of zh.ts.
// The i18n type test (tests/i18n.test.ts) walks both trees and fails
// on missing or extra keys, so don't ship a partial fallback like
// "Coming soon" — translate everything.

import type { LocaleDict } from '../types';

export const en: LocaleDict = {
  common: {
    locale: {
      zh: '中',
      en: 'EN',
      switchToZh: '切换到中文',
      switchToEn: 'Switch to English',
    },
    theme: {
      light: 'Light',
      dark: 'Dark',
      toggleLabel: 'Toggle theme',
      toggleToDark: 'Switch to dark mode',
      toggleToLight: 'Switch to light mode',
    },
    actions: {
      signIn: 'Sign in',
      signUp: 'Sign up',
      signOut: 'Sign out',
      tryItNow: 'Get started',
      selfHostGuide: 'Self-host guide',
      learnMore: 'Learn more',
      backToHome: 'Back to home',
    },
    nav: {
      docs: 'Docs',
      maintenance: 'Maintenance',
      settings: 'Settings',
      newOrg: 'New org',
      brand: 'Collaboration Tool',
    },
  },
  landing: {
    meta: {
      title: 'Collaboration Tool · An AI-native research writing workbench',
      description:
        'A local-first, bilingual writing platform for research papers: structured editor, AI as collaborator, end-to-end provenance, self-hostable, with first-class CJK and Latin typography.',
    },
    hero: {
      eyebrow: 'A workbench for researchers',
      headline:
        'Think, write, verify, publish — one workbench for the whole loop.',
      sub: 'Local-first. AI is a collaborator, not a chat sidebar. Chinese and English are both first-class.',
      ctaPrimary: 'Get started',
      ctaSecondary: 'Self-host guide',
    },
    pillars: {
      heading: 'Core capabilities',
      sub: 'Four things done well, instead of stacking features.',
      editor: {
        title: 'Editor: markup-as-source, WYSIWYM rendered',
        desc: 'A structured editor on ProseMirror + TipTap; equations render in <50ms, keystrokes feel <100ms; paper nodes (figure, table, citation, theorem, cell) are first-class from day one — never bolted on later.',
        diagram: 'PM JSON  →  commit  →  MyST / Typst / JATS / DOCX / HTML',
      },
      ai: {
        title: 'AI as collaborator: actions, not a chat sidebar',
        desc: 'AI works through concrete actions — insert a citation, rewrite a sentence, find a reference. Three composable layers (plugins · skills · MCP servers) plus bring-your-own model means no single-vendor lock-in.',
        diagram: 'plugin · skill · MCP server  →  coordinator  →  your paper',
      },
      provenance: {
        title: 'Provenance: every paragraph is traceable',
        desc: 'Each AI intervention records actorPrincipalId, agentContext, promptHash and toolCalls — hard evidence for review and rollback. Not a disclaimer, a data structure.',
        diagram: 'actor · prompt · model · tools  ⇄  every commit signed',
      },
      bilingual: {
        title: 'Bilingual: equally serious typography on both sides',
        desc: 'CJK and Latin tuned separately (Source Han Serif / Songti / Noto). Quotes, breaking and spacing decided per script — not per document. HTML, Typst PDF, JATS and DOCX share one typography pre-pass.',
        diagram: 'zh · en · math · code  →  one pre-pass  →  4 export formats',
      },
    },
    architecture: {
      heading: 'Architecture at a glance',
      sub: 'A local-first core, three layers of extension points, self-hostable.',
      caption:
        'Editor, sync gateway, snapshot worker and agent worker all run on your own host. Plugins, skills and MCP servers are the three composable extension layers.',
      ascii: [
        '   Your browser                                  Your server',
        '   ┌────────────┐  Yjs CRDT   ┌────────────┐  pgboss   ┌──────────────┐',
        '   │  Editor    │ ─────────── │  Sync      │ ────────── │ Agent Worker │',
        '   │  PM + AI   │             │  Gateway   │            │ Plugin · MCP │',
        '   └────────────┘             └────────────┘            └──────────────┘',
        '          │                          │                          │',
        '          └──────────────  Postgres + WAL-G  ───────────────────┘',
      ],
    },
    nav: {
      heading: 'More',
      readme: 'README',
      adrIndex: 'ADR index',
      userGuide: 'User guide',
      license: 'License',
    },
    footer: {
      tagline: 'Local-first · open source · self-hostable.',
      built: 'Built by researchers, for researchers.',
    },
  },
  app: {
    docs: {
      title: 'Docs',
      empty: 'No docs yet. Start your first one?',
      newButton: 'New doc',
    },
    editor: {
      title: 'Editor',
      saving: 'Saving…',
      saved: 'Saved',
      offline: 'Offline — kept locally',
    },
    maintenance: {
      title: 'Maintenance',
      sub: 'Vault findings · accept / mark resolved / dismiss as false positive',
      empty: 'No findings in this status.',
      hintAfterScan:
        'If you just ran a maintenance scan job, refresh this page.',
    },
    settings: {
      title: 'Settings',
      models: 'Models',
      plugins: 'Plugins',
    },
  },
  a11y: {
    skipToMain: 'Skip to main content',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
};
