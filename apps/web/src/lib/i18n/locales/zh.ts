// 中文 (zh) 字典 — single source of truth for the LocaleDict shape.
// English mirror lives at ./en.ts. New keys should be added here first
// then added to en.ts; mismatched shapes fail the i18n type test.
//
// Style note: keep keys nested by surface area (common / landing /
// app.docs / app.editor / app.maintenance / app.settings / a11y).

export const zh = {
  common: {
    locale: {
      zh: '中',
      en: 'EN',
      switchToZh: '切换到中文',
      switchToEn: 'Switch to English',
    },
    theme: {
      light: '浅色',
      dark: '深色',
      toggleLabel: '切换主题',
      toggleToDark: '切换到深色模式',
      toggleToLight: '切换到浅色模式',
    },
    actions: {
      signIn: '登录',
      signUp: '注册',
      signOut: '登出',
      tryItNow: '开始试用',
      selfHostGuide: '自托管手册',
      learnMore: '了解更多',
      backToHome: '返回首页',
    },
    nav: {
      docs: '文档',
      maintenance: '维护',
      settings: '设置',
      newOrg: '新组织',
      brand: '协作论文平台',
    },
  },
  landing: {
    meta: {
      title: '协作论文平台 · 面向研究者的 AI-native 写作工作台',
      description:
        '本地优先的双语论文协作平台：编辑器 / AI 协作者 / 全程 Provenance，可自托管，支持中英文一等公民排版。',
    },
    hero: {
      eyebrow: '面向研究者的协作工作台',
      headline: '思考、写作、验证、发表 — 一体化的研究工作台',
      sub: '本地优先 · AI 是协作者不是侧边栏 · 中英双语都是一等公民。',
      ctaPrimary: '开始试用',
      ctaSecondary: '自托管手册',
    },
    pillars: {
      heading: '核心能力',
      sub: '四件事做到位，而非堆叠功能。',
      editor: {
        title: '编辑器：Markup-as-source，WYSIWYM 呈现',
        desc: '基于 ProseMirror + TipTap 的结构化编辑器；公式 < 50ms 渲染、键入 < 100ms 反馈；论文节点（图、表、引用、定理、Cell）从第 0 阶段就是头等公民，不是事后插件。',
        diagram: 'PM JSON  →  commit  →  MyST / Typst / JATS / DOCX / HTML',
      },
      ai: {
        title: 'AI 协作：协作动作，不是聊天框',
        desc: 'AI 走的是"插入引用 / 改一句话 / 找一篇 reference"这种具体动作；plugin 扩展、skill 库、MCP 服务三层可组合，BYO 模型；不绑定单一供应商。',
        diagram: 'plugin · skill · MCP server   →   coordinator   →   你的论文',
      },
      provenance: {
        title: 'Provenance：每一段文字都可追溯',
        desc: '每次 AI 介入都写入 actorPrincipalId / agentContext / promptHash / toolCalls，留作未来 review 与撤回的硬证据；不是 disclaimer，是数据结构。',
        diagram: 'actor · prompt · model · tools  ⇄  每个 commit 都签名',
      },
      bilingual: {
        title: '中英双语 · 排版同等精细',
        desc: 'CJK 与拉丁排版分开调（Source Han Serif / Songti / Noto），引号、断行、空格按 script 而非按文档判断；导出 HTML / Typst PDF / JATS / DOCX 共用同一套 typography pre-pass。',
        diagram: 'zh · en · 公式 · 代码  →  统一 pre-pass  →  4 种导出',
      },
    },
    architecture: {
      heading: '架构一图',
      sub: '本地优先的核心 + 三层扩展点 + 自托管。',
      caption:
        'Editor、Sync、Snapshot、Agent Worker 四件套部署在你自己的机器上；plugin / skill / MCP server 三层均为可组合的扩展点。',
      ascii: [
        '   你的浏览器                                   你的服务器',
        '   ┌────────────┐  Yjs CRDT   ┌────────────┐  pgboss   ┌──────────────┐',
        '   │  Editor    │ ─────────── │  Sync      │ ────────── │ Agent Worker │',
        '   │  PM + AI   │             │  Gateway   │            │ Plugin · MCP │',
        '   └────────────┘             └────────────┘            └──────────────┘',
        '          │                          │                          │',
        '          └──────────────  Postgres + WAL-G  ───────────────────┘',
      ],
    },
    nav: {
      heading: '相关链接',
      readme: 'README',
      adrIndex: 'ADR 索引',
      userGuide: '用户手册',
      license: '开源协议',
    },
    footer: {
      tagline: '本地优先 · 开源 · 可自托管。',
      built: '由研究者写给研究者。',
    },
  },
  app: {
    docs: {
      title: '文档',
      empty: '还没有文档。新建第一篇？',
      newButton: '新建文档',
    },
    editor: {
      title: '编辑器',
      saving: '保存中…',
      saved: '已保存',
      offline: '离线 — 本地保留',
    },
    maintenance: {
      title: '维护',
      sub: '知识库巡检发现 · 接受 / 已修复 / 误报后归档',
      empty: '暂无该状态的发现。',
      hintAfterScan: '若刚跑完 maintenance scan job 再刷新本页。',
    },
    settings: {
      title: '设置',
      models: '模型',
      plugins: '插件',
    },
  },
  a11y: {
    skipToMain: '跳到主要内容',
    openMenu: '打开菜单',
    closeMenu: '关闭菜单',
  },
} as const;
