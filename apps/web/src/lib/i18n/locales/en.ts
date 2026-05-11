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
    differentiation: {
      heading: 'A 5-year anchor',
      sub: 'Not another collaboration SaaS — claim-level ORCID-signed review DAGs are the thing nobody else does.',
      rows: [
        {
          competitor: 'Curvenote',
          theyDo: 'Team-mode Jupyter / MyST editor; reviews are GitHub-PR-style threads.',
          weDo: 'Reviews attach to individual claims; ORCID-signed JWS verifies independently of this platform.',
        },
        {
          competitor: 'MyST',
          theyDo: 'Extensible Markdown dialect + multi-target rendering (HTML/JATS/PDF), single-author local.',
          weDo: 'Inherits the MyST markup; adds Yjs CRDT collaboration, AI collaborators, and first-class claim/evidence objects.',
        },
        {
          competitor: 'Quarto',
          theyDo: 'Reproducible publishing (R/Python/Julia notebook → PDF/HTML/Book).',
          weDo: 'Reproducible + collaborative + reviewable in one pipeline; covers every Quarto output (Typst/JATS/MyST share a pre-pass).',
        },
        {
          competitor: 'Notion',
          theyDo: 'Generic knowledge collab; paragraph tree + AI sidebar.',
          weDo: 'Paper as a first-class citizen: claim/evidence/citation nodes + provenance trail. AI works through actions, not a chat sidebar.',
        },
      ],
      footnote: 'See README + plan0/ for the full comparison and the ADR-0016 dogfood gate.',
    },
    specimens: {
      heading: 'See the actual thing',
      sub: 'Three specimens — Typst-compiled PDF typography, AgentTimeline dispatch tree, ORCID-signed review DAG.',
      typstAlt: 'Typst-compiled bilingual paper PDF (CJK + Latin sized and tracked independently)',
      typstCaption: 'Typst PDF specimen · bilingual typography tuned per script',
      timelineAlt: 'AgentTimeline parent-child tree (coordinator → reviewer + researcher, with cancel + quota badges)',
      timelineCaption: 'AgentTimeline · any step is cancellable mid-flight · default 50-invoke/day quota',
      dagAlt: 'Review DAG for claim:c3 — one ORCID endorse (moss) + one ORCID challenge with counter-evidence (ox)',
      dagCaption: 'Claim-on-Claim Review DAG · JWS independently verifiable',
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
