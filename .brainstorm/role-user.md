# 用户视角 dogfood 评审 · 用户 A（跨学科博士生）+ 用户 B（PI）

> 基于 STATUS Phase 4 W4 实际可跑通的能力（不是 ADR 写了什么）。
> 重点扫了 specimen-bilingual.md / EditorPage / AgentPanel / RevisionInbox /
> ShareDialog / maintenance / settings/{plugins,models}。

---

## 1. 真正打动研究者的能力（A/B 都会停下来看的）

| 能力 | 场景 | 仓库证据 |
|---|---|---|
| **Provenance 是一等数据** | B 让助理用 AI 改稿后能回看"哪段是 AI 改、用什么 prompt、调了什么 MCP 工具"。Curvenote / Overleaf 都没有 | `AgentPanel.tsx:204-213` toolCalls 列出 + USER_GUIDE §3.1 promptHash/toolCalls[] |
| **Capability + Role bundle 替代 share-link 黑盒** | B 给评审者发邀请只能给 reject/modify、不能 accept；commenter 看不到他人 proposal | `editor/[docId]/page.tsx:86-89` capability 门控 RevisionInbox；`ShareDialog.tsx:17-21` 三档 role |
| **Claim/Evidence 一等节点 + Maintenance scan** | A 写综述时常忘"这句结论引了哪篇" → 列表自动给"unsupported-claim / broken-citation"。Zotero+Obsidian 拼不出 | `(app)/maintenance/page.tsx` 6 类 finding label + STATUS d6 |
| **AI 走 propose 不走 inline-rewrite** | A 不用怕 AI 偷偷改稿；reviewer 看到的全是 pending revision 而非 dirty diff | `RevisionInbox.tsx` + USER_GUIDE §3.6 三档动作矩阵 |
| **CJK pre-pass + 双语样张实测** | A 中英混排公式不再有"中文标点紧贴 LaTeX"问题 | `specimen-bilingual.md` + `packages/typography` |
| **7 格式导出含 ai-context-pack** | B 把整篇打包给外部 reviewer 灌 LLM 不用复制粘贴 | USER_GUIDE §4 表 |
| **本地优先 + self-host 一键** | B 实验室拒云 SaaS；docker compose + WAL-G 满足 | `SELF_HOST.md` §6 walg overlay |

A 切过来的最强动机是 **Provenance + Claim/Evidence + 中文排版**；B 是 **self-host + capability 模型 + maintenance dashboard 的可审计性**。

---

## 2. 30 分钟 dogfood 摩擦点（按用户旅程）

| 步骤 | 摩擦 | 严重度 |
|---|---|---|
| 注册 → /docs | 列表页是空的；ORCID 按钮只在配了 env 时亮，否则点了 PROVIDER_CONFIG_NOT_FOUND——A 会以为是 bug | 中 |
| 创建文档 | 填完跳到 /editor/[docId]，**没有任何模板/示例正文** —— specimen 在 /demo/ 但创建流程不引用。A "我从哪粘贴 abstract？" | **高** |
| 写第一段中英混排 | TipTap 9 ext 已就位，但**没有 slash 命令面板可见入口**（USER_GUIDE 2.3 提"按 /"，AgentPanel/Editor 里都看不到对应 trigger UI hint）。A 找公式按钮要翻文档 | **高** |
| 引用工作流（DOI 输入到插入） | **必须先打开折叠的"AI 协作"面板，把段落手动粘进 textarea，再粘 DOI**——这就是 Overleaf-clone 反模式：A 已经选中了段落，为什么还要复制？ `AgentPanel.tsx:46` `passage` 不接 selection / `blockId='blk-cursor'` 是写死字符串 | **高** P0 |
| AI 协作真是协作者？ | RevisionInbox 是个"待办列表"，不是"协作动作"——它是侧边栏。和原则 #3 冲突。Inline-editor mock 模式只前缀 `[FORMAL]`，A 试一次就走 | **高** |
| 离线 / 重连 | USER_GUIDE 2.2 写"IndexedDB 离线"但没暴露状态指示器；B 在飞机上断网会问"我刚才打的字保住了没" | 中 |
| 多人邀请 | ShareDialog 真好（邮件 webhook + console fallback），但 **MAIL_WEBHOOK_URL 没配时 acceptUrl 直接打到 server stderr，普通用户够不着** —— B 的助理装完就卡这里 | **高** |
| 接受 / 拒绝 | RevisionDiff 有红绿 diff 但 modify 路径要重写整段 textarea —— B 想"只调一个词"会觉得笨重 | 中 |
| 导出 | ExportDrawer 折叠在最底，PDF 503 hint 把 typst CLI 写成 prereq —— A 不可能为试用装 typst | **高** |
| Plugin / BYO 模型 settings | `/settings/plugins` 让用户**粘 manifest JSON 到 URL 参数里**（`searchParams.manifest`，不到 1KB 注释）—— 反 Curvenote-modern 的 P0 信号 | **高** P0 |
| BYO 模型 | settings/models 表单只能存 `api_key_env_var` 名字 —— A 在 macOS 桌面用看到"我得去改 .env"会直接退 | **高** P0 |

---

## 3. 被低估的小心思（README 没讲，用户会感动）

- **mock runner 默认 fallback** —— 没 ANTHROPIC_API_KEY 也能跑通 e2e。A 试用门槛瞬间归零（USER_GUIDE §3.1）
- **email backend 双轨**（webhook + stderr 兜底）—— self-host 实验室可以不接邮件服务先跑（`ShareDialog.tsx:60-68` 显示 backend）
- **api_key_env_var 字段只存 env 名不存密文** —— B 的安全官会点头（STATUS d7）
- **commit serializer 21 round-trip 测试** —— A 不会丢字（proto-a 的 schema-recovery silent-drop 已经预防）
- **SourceHan + Noto fallback chain 写进 token** —— 中文不会变成豆腐块（`packages/typography/font-tokens.ts`）
- **better-auth org → Principal kind=org bridge** —— B 的 lab GitHub org 直接对得上
- **WAL-G overlay 真有 quarterly restore drill 文档** —— B 的 IT 不再阻拦

---

## 4. 会被吐槽的点（A 发推 / B 让助理别买）

1. **"AI 是协作者"是营销话术** —— AgentPanel 仍是侧边栏，passage 字段写 `blk-cursor` 字符串占位；和 Curvenote 的 chat 没本质差。原则 #3 fail。
2. **"local-first" 但 plugin 装载靠把 JSON 粘 URL** —— B 会觉得这是 hobby project。Phase 4 W1 dogfood gate（bwrap）还没过。
3. **"中英双语等权"但 UI 文案 50% 是 `分享 / Share` 这种 slash 拼接** —— 看着像没决定用哪种语言；A 是双语用户也会嫌乱。
4. **PDF 导出依赖 typst CLI 在服务器** —— 任何 demo 站都要装；MathJax/KaTeX HTML 是默认才合理。
5. **maintenance scan 跑要手 enqueue pgboss job** —— USER_GUIDE 5.3 说"跑 worker 即可"，但其实要往队列扔 `{documentId, generators}`。B 的助理会卡。
6. **创建文档没模板** —— 双语 specimen 在 `/demo/` 是测试 fixture，不是 onboarding 资产。A 第一篇就要白纸开搞。

---

## 5. 加 3 个 feature 让 A/B 留下（优先级）

### P0 · 编辑器内 inline AI（"agent as verb"）
干掉 `AgentPanel` 折叠面板。让 A **选中段落右键 → 弹 floating menu → "核引用 / 改写 / 找证据"**，passage 自动从 selection 取，blockId 自动从 PM doc node id 取。RevisionInbox 仍存在做 audit log，但触发点在文中，不在底部。落地原则 #3。

### P1 · "新建文档"自带 specimen 模板
创建流程提供 3 模板：空白 / 双语论文（specimen-bilingual） / 文献综述（claim+evidence 预填）。A 30 秒看到带公式 + 引用 + figure 的文档跑起来，瞬间 wow。Curvenote 给不了的差异化在"知识对象层模板"。

### P2 · Citation 工作流：DOI 一键
A 粘 DOI 到段落 → 自动核（CrossRef MCP 已就位）→ inline 插入 `citation-ref` 节点。不要让用户去 AgentPanel 的 DOI textarea 折腾。这个流程本身已经有 mcp-crossref + ai-runtime + propose-fragment——只缺"右键菜单 / `@` 触发器"前端动作。

剩下的（subdocument / 章节 fork / open peer review / 跨设备）都是好的，但 A/B 在 30 分钟内卡死前根本走不到。先把"编辑 1 段中英文 + 加 1 个引用 + 接受 1 个 AI 提议"做成丝滑动作，其他 ADR 的承诺才有兑现机会。
