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
      triadic: 'Triadic',
      brand: 'Inquiry Studio · 探索工作室',
    },
  },
  landing: {
    meta: {
      title: 'Inquiry Studio · 探索工作室 — a studio for the creative process of science',
      description:
        "Not a paper-writing tool. A scientist's creative workbench. Ideas, prototypes, papers — all in one place. The 3am metaphor, the dinner argument, the sketch you never used — these are science too. Desktop-first, data on your machine, open-source and self-hostable.",
    },
    hero: {
      eyebrow: 'Inquiry Studio · 探索工作室 · desktop-first',
      headline: "A studio for the creative\nprocess of science.\nIdeas, prototypes, papers — all here.",
      sub: "Not a paper-writing tool. A scientist's creative workbench.",
      tagline: 'Desktop-first · data stays on your machine · open-source · self-hostable',
      ctaPrimary: 'Enter the studio',
      ctaSecondary: 'How to self-host',
    },
    manifesto: {
      body: 'The most creative part of science happens outside the paper.',
    },
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
      footerHint: 'Every step of the creative process is recorded independently: which idea became which prototype, which prototype became which paragraph of the paper.',
    },
    pillars: {
      heading: "What's in the studio",
      sub: 'Three workspaces. Each has its own content types, collaboration patterns and archive.',
      thinking: {
        title: 'The thinking space',
        desc: "The 3am connection, the dinner argument, the \"huh, what if this method from math applies to biology?\" — all first-class. Words, hand sketches, a contradiction you noticed, a counter-example. Half-baked is allowed.",
      },
      prototyping: {
        title: 'The prototyping space',
        desc: "Turn an idea into something. A toy model, a translation from \"I feel these are connected\" to \"three measurable parameters\", a design sketch that's not paper-grade but gets your idea across. Done here, you're not at a paper yet — but you can show colleagues.",
      },
      paper: {
        title: 'The paper space',
        desc: 'Where the creative process lands as a paper — write, run experiments, go through review, export to PDF / Word / JATS. We do this as well as anyone. One stage of the studio; but the most creative part of science happens before it.',
      },
    },
    attribution: {
      heading: 'Every idea has a name',
      desc: 'No more "first author et al." Every idea, every metaphor, every contradiction is tracked to who proposed it, with timestamps. Each contribution is independently citable. Authorship is no longer a ranking game.',
    },
    differentiation: {
      heading: "How it's different",
      sub: 'Other tools handle the paper. We handle the entire creative process of science — ideas, prototypes, papers, all in the studio.',
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
    reformRadar: {
      heading: 'What research systems are changing',
      sub: 'The signal is clear: the next research collaboration system is not just a faster manuscript editor. Evidence, reproducibility, review, AI work and contribution need to be tracked, checked and credited.',
      rows: [
        {
          signal: 'Open science is becoming monitored practice',
          pressure:
            'UNESCO and the EU are pushing measurable open science: data, code, methods and outputs should be findable, reusable and assessable.',
          response:
            'The studio treats claims, evidence, sources, reviews and contributions as traceable objects, not just text inside a final paper.',
        },
        {
          signal: 'Reproducibility is becoming infrastructure',
          pressure:
            'NIH is elevating replication and reproducibility agency-wide. Failed paths, raw data and protocol details need to enter the scientific record.',
          response:
            'Authors bind evidence, code, data and methods while writing; maintenance scans later flag unsupported, outdated or contradicted work.',
        },
        {
          signal: 'Peer review is overloaded',
          pressure:
            'Review invitations are harder to fill, a small pool carries too much unpaid labor, and quality and speed are both under pressure.',
          response:
            'Review becomes claim-level, with ORCID-signed verdicts and contribution records so review can be credited as research labor.',
        },
        {
          signal: 'AI is entering science, but it must be auditable',
          pressure:
            'Generative AI is spreading across disciplines, while hallucination, opacity, privacy and uncertainty can amplify reproducibility risk.',
          response:
            'AI is a permissioned collaborator: model, provider, prompt, tool calls and approval chains are written into provenance.',
        },
      ],
      footnote:
        'Research baseline: plan0/research/2026-06-03-research-collaboration-systems.md.',
    },
    specimens: {
      heading: 'Take a look',
      sub: 'A thinking sketch, a prototype table, a map of the creative process.',
      nightAlt: 'A page in the thinking space — a contradiction noticed, a metaphor draft, an open question',
      nightCaption: 'A page in the thinking space: a contradiction noticed, a metaphor in draft, a question that may or may not lead anywhere. Half-baked is allowed.',
      bridgeAlt: 'A table in the prototyping space — a hypothesis with three measurable parameters and risks',
      bridgeCaption: 'A table in the prototyping space: one hypothesis, three measurable parameters, two risks, one line on "what this would overturn if true". Not a paper — but enough to show.',
      lineageAlt: 'Lineage graph of the creative process — idea → prototype → paper',
      lineageCaption: "A map across layers: which 3am idea ended up in which paragraph? Which prototypes were never used? Each edge is labelled with how the transformation happened.",
    },
    architecture: {
      heading: 'After self-hosting',
      sub: 'Desktop-first: your content and your AI live on your machine. When collaborating, you sync through your own server.',
      caption:
        "Content and AI run on your desktop. To sync with collaborators, route through your own server. For solo projects, you don't need the server at all.",
      ascii: [
        '   Your desktop (main)        Your server (optional)        Collaborator desktop',
        '   ┌────────────┐  WebSocket  ┌──────────────┐  WebSocket  ┌────────────┐',
        '   │  Editor    │ ─────────── │  Sync relay  │ ─────────── │  Editor    │',
        '   │  ideas +   │             │  + backups   │             │  ideas +   │',
        '   │  prototypes│             │              │             │  prototypes│',
        '   │  + papers  │             │              │             │  + papers  │',
        '   │  local AI  │             │              │             │  local AI  │',
        '   └────────────┘             └──────────────┘             └────────────┘',
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
  auth: {
    login: {
      eyebrow: '登录 · sign in',
      title: 'Keep writing',
      titleEn: '· 继续编辑',
      orcidPrimary: 'Continue with ORCID · 用 ORCID 登录',
      orcidDisabledHint:
        'ORCID credentials not configured · 管理员未配置 ORCID 凭据',
      emailToggle: 'Email & password · 邮箱密码',
      emailLabel: 'Email · 邮箱',
      passwordLabel: 'Password · 密码',
      submit: 'Sign in · 登录',
      switchPrompt: 'No account?',
      switchLink: 'Sign up · 注册',
      orDivider: 'or · 或',
    },
    signup: {
      eyebrow: '注册 · sign up',
      title: 'Start a paper',
      titleEn: '· 开始一篇论文',
      lede: 'ORCID recommended for researchers · 推荐用 ORCID',
      orcidPrimary: 'Continue with ORCID · 用 ORCID 登录',
      orcidDisabledHint:
        'ORCID credentials not configured · 管理员未配置 ORCID 凭据',
      emailToggle: 'Email & password · 邮箱密码',
      nameLabel: 'Name · 姓名',
      emailLabel: 'Email · 邮箱',
      passwordLabel: 'Password · 密码 (≥ 8)',
      submit: 'Sign up · 注册',
      switchPrompt: 'Already have an account?',
      switchLink: 'Sign in · 登录',
      orDivider: 'or · 或',
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
      pluginsPage: {
        title: 'Plugins · 插件',
        sub: 'Installed third-party plugins · capability prompt flow (see ADR-0010 / ADR-0012)',
        notice: {
          label: 'PLUGIN INSTALL · Platform-gated',
          zh: 'plugin install 当前仅 Linux 主机支持',
          en: 'plugin install is Linux-host only',
          zhBody:
            'macOS / Windows 沙箱在 Phase 5 路线图。当前你能：(1) 浏览已安装 plugin 查看现状；(2) 切换到 Linux 主机或 Docker 容器试用；(3) 暂时不通过 UI 装。',
          enBody:
            'macOS / Windows sandbox descriptors land in the Phase 5 roadmap. For now you can: (1) browse installed plugins to inspect state, (2) switch to a Linux host or container, or (3) hold off on UI installs.',
        },
        installed: 'Installed · 已装',
        emptyInstalled:
          'No user-installed plugins yet. Built-in plugins are managed via plugins/registry.json (not shown here).',
        statusEnabled: 'enabled',
        statusDisabled: 'disabled',
        statusUninstalled: 'uninstalled',
        uninstall: 'Uninstall',
        tabUrl: 'Repository URL · 仓库 URL',
        tabPaste: 'Paste JSON · 粘贴 JSON',
        urlLabel: 'GitHub repo URL · GitHub 仓库 URL',
        urlHint:
          'https://github.com/owner/repo only · tries plugin.json / plugin.yaml in order',
        urlPlaceholder: 'https://github.com/owner/plugin-repo',
        urlSubmit: 'Fetch and preview',
        pasteLabel: 'manifest JSON',
        pasteHint:
          'Paste a plugin manifest JSON. The next step shows the capabilities this plugin asks for; you choose which to grant before install.',
        pasteSourceLabel:
          'Source URL (optional; https-only; empty → origin=local-path)',
        pastePlaceholderSource: 'https://github.com/foo/bar-plugin',
        pasteSubmit: 'Preview',
        promptLabel: 'PLUGIN INSTALL · capability request',
        promptIntro:
          '{n} capabilities below are declared by the plugin. All are pre-checked by default; uncheck = deny; you cannot add capabilities not in the manifest.',
        promptSourceGit: 'git url',
        promptSourcePaste: 'paste',
        promptCoreTag: 'core',
        confirmInstall: 'Confirm install',
        cancel: 'Cancel',
        errorInvalidUrl: 'URL is not valid',
        errorNotHttps: 'Only https:// is accepted',
        errorHostNotAllowed: 'Host is not on the allow-list',
        errorNotRepoUrl: 'Not a GitHub repo URL (need /owner/repo)',
        errorFetchFailed: 'Fetch failed',
        errorHttpError: 'HTTP error',
        errorTooLarge: 'manifest exceeds 1 MB limit',
        errorTimeout: 'Timed out (8s)',
        errorInvalidJson: 'manifest JSON invalid',
        errorInvalidManifest: 'manifest fails validation',
        errorReturn: '← Try again',
      },
    },
  },
  a11y: {
    skipToMain: 'Skip to main content',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
  },
};
