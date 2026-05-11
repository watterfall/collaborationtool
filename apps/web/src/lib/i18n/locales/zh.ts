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
      triadic: '三层',
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
    differentiation: {
      heading: '5 年差异化锚点',
      sub: '不是又一个协作 SaaS —— claim 级 ORCID-签名评审 DAG 是别人没做的。',
      rows: [
        {
          competitor: 'Curvenote',
          theyDo: '团队协作的 Jupyter / MyST 编辑器；评审是 GitHub PR review 风格的 thread。',
          weDo: '评审挂在单条 claim 上，ORCID-签名独立可验证，不依赖本平台在线。',
        },
        {
          competitor: 'MyST',
          theyDo: '可扩展的 Markdown 方言 + 多目标渲染（HTML/JATS/PDF），单作者本地。',
          weDo: '继承 MyST 可扩展 markup，外加 Yjs CRDT 协作 + AI 协作者 + claim 一等知识对象。',
        },
        {
          competitor: 'Quarto',
          theyDo: '可重复发表（R/Python/Julia notebook → PDF/HTML/Book）。',
          weDo: '可重复 + 可协作 + 可评审 三合一；Quarto 的输出端我们都支持（Typst/JATS/MyST 共用 pre-pass）。',
        },
        {
          competitor: 'Notion',
          theyDo: '通用知识协作；段落树 + AI 侧边栏。',
          weDo: '论文一等公民：claim/evidence/citation 节点 + provenance 追溯，AI 是协作动作不是聊天侧边栏。',
        },
      ],
      footnote: '完整对比与 ADR-0016 dogfood gate 见 README 与 plan0/。',
    },
    specimens: {
      heading: '看真东西',
      sub: '三段示例 —— Typst PDF 排版、Agent dispatch 时间线、ORCID-签名评审 DAG。',
      typstAlt: 'Typst 编译的双语论文 PDF 样张（CJK 与拉丁字号 / 字距独立调）',
      typstCaption: 'Typst PDF 样张 · 双语排版同等精细',
      timelineAlt: 'AgentTimeline 父子任务树（coordinator → reviewer + researcher，含 cancel + quota 标识）',
      timelineCaption: 'AgentTimeline · 任意 step 可中途 cancel · 默认 50 invoke/天 quota',
      dagAlt: 'claim:c3 的 review DAG —— 1 ORCID 同意（moss）+ 1 ORCID 挑战带反例证据（ox）',
      dagCaption: 'Claim-on-Claim Review DAG · JWS 可独立验证',
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
  auth: {
    login: {
      eyebrow: '登录 · sign in',
      title: '继续编辑',
      titleEn: '· keep writing',
      orcidPrimary: '用 ORCID 登录 · Continue with ORCID',
      orcidDisabledHint:
        '管理员未配置 ORCID 凭据 · ORCID credentials not configured',
      emailToggle: '邮箱密码 · Email & password',
      emailLabel: '邮箱 · Email',
      passwordLabel: '密码 · Password',
      submit: '登录 · Sign in',
      switchPrompt: '没有账号？',
      switchLink: '注册 · Sign up',
      orDivider: '或 · or',
    },
    signup: {
      eyebrow: '注册 · sign up',
      title: '开始一篇论文',
      titleEn: '· start a paper',
      lede: '推荐用 ORCID · ORCID recommended for researchers',
      orcidPrimary: '用 ORCID 登录 · Continue with ORCID',
      orcidDisabledHint:
        '管理员未配置 ORCID 凭据 · ORCID credentials not configured',
      emailToggle: '邮箱密码 · Email & password',
      nameLabel: '姓名 · Name',
      emailLabel: '邮箱 · Email',
      passwordLabel: '密码 · Password (≥ 8)',
      submit: '注册 · Sign up',
      switchPrompt: '已有账号？',
      switchLink: '登录 · Sign in',
      orDivider: '或 · or',
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
      pluginsPage: {
        // header / sub
        title: '插件 · Plugins',
        sub: '已装第三方 plugin · capability prompt 流程（详见 ADR-0010 / ADR-0012）',
        // platform notice (W8.1) — non-Linux UI gate
        notice: {
          label: 'PLUGIN INSTALL · 平台限制',
          zh: 'plugin install 当前仅 Linux 主机支持',
          en: 'plugin install is Linux-host only',
          zhBody:
            'macOS / Windows 沙箱在 Phase 5 路线图。当前你能：(1) 浏览已安装 plugin 查看现状；(2) 切换到 Linux 主机或 Docker 容器试用；(3) 暂时不通过 UI 装。',
          enBody:
            'macOS / Windows sandbox descriptors land in the Phase 5 roadmap. For now you can: (1) browse installed plugins to inspect state, (2) switch to a Linux host or container, or (3) hold off on UI installs.',
        },
        // installed list
        installed: '已装 / Installed',
        emptyInstalled:
          '还没有用户安装的 plugin。内置 plugin 由 plugins/registry.json 管理（不显示在这里）。',
        statusEnabled: '启用',
        statusDisabled: '禁用',
        statusUninstalled: '已卸载',
        uninstall: '卸载',
        // input mode tabs (W8.3)
        tabUrl: '仓库 URL · Repository URL',
        tabPaste: '粘贴 JSON · Paste JSON',
        // URL form
        urlLabel: 'GitHub 仓库 URL · GitHub repo URL',
        urlHint:
          '仅 https://github.com/owner/repo · 自动尝试 plugin.json / plugin.yaml',
        urlPlaceholder: 'https://github.com/owner/plugin-repo',
        urlSubmit: '获取并预览',
        // paste form
        pasteLabel: 'manifest JSON',
        pasteHint:
          '粘贴 plugin manifest JSON。下一步会显示该 plugin 申请的 capability，由你勾选后再 install。',
        pasteSourceLabel:
          '源 URL（可选；https-only；不填走 origin=local-path）',
        pastePlaceholderSource: 'https://github.com/foo/bar-plugin',
        pasteSubmit: '预览',
        // provenance card
        promptLabel: 'PLUGIN INSTALL · capability request',
        promptIntro:
          '下面 {n} 条 capability 是 plugin 声明需要的。默认全部勾选；取消勾选 = 拒绝；不在 manifest 里的不能加。',
        promptSourceGit: 'git url',
        promptSourcePaste: 'paste',
        promptCoreTag: '核心',
        confirmInstall: '确认安装',
        cancel: '取消',
        // errors
        errorInvalidUrl: 'URL 无效',
        errorNotHttps: '只接受 https://',
        errorHostNotAllowed: 'host 不在白名单',
        errorNotRepoUrl: '不是 GitHub 仓库 URL（需 /owner/repo）',
        errorFetchFailed: '抓取失败',
        errorHttpError: 'HTTP 错误',
        errorTooLarge: 'manifest 超过 1 MB 上限',
        errorTimeout: '超时（8 s）',
        errorInvalidJson: 'manifest JSON 无效',
        errorInvalidManifest: 'manifest 不通过校验',
        errorReturn: '← 重新输入',
      },
    },
  },
  a11y: {
    skipToMain: '跳到主要内容',
    openMenu: '打开菜单',
    closeMenu: '关闭菜单',
  },
} as const;
