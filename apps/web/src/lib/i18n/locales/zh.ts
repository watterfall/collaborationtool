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
    architecture: {
      heading: '装好之后长这样',
      sub: '桌面端为主：你的内容、你的 AI 都在你电脑上。要协作时再通过你自己的服务器同步。',
      caption:
        '内容和 AI 都跑在你的桌面端。需要和合作者同步时，过你自己的服务器中转一次。不需要协作的项目，连服务器都可以不要。',
      ascii: [
        '   你的桌面 (主)              你的服务器（可选）            协作者桌面',
        '   ┌────────────┐  WebSocket  ┌──────────────┐  WebSocket  ┌────────────┐',
        '   │  编辑器    │ ─────────── │  协作中转    │ ─────────── │  编辑器    │',
        '   │  想法 +    │             │  + 备份      │             │  想法 +    │',
        '   │  原型 +    │             │              │             │  原型 +    │',
        '   │  论文      │             │              │             │  论文      │',
        '   │  本地 AI   │             │              │             │  本地 AI   │',
        '   └────────────┘             └──────────────┘             └────────────┘',
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
