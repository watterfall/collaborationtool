# Desktop App Scope — 2026-05-11

> 用户决定：E2EE 现阶段不做 / desktop app 还是要做。
> 本文：把 desktop scope 收敛到 3 档可选 + 推荐 + 第一步。

---

## 1. 现状真相（grep 后确认）

| 维度 | 状态 |
|---|---|
| Next.js 渲染 | **SSR + Server Actions + RSC**（不是 SPA），`apps/web/src/app/{layout,page}.tsx` 用 server features |
| 后端 server-external 依赖 | `postgres` / `drizzle-orm` / `better-auth` / `@anthropic-ai/sdk` / `@modelcontextprotocol/sdk` / `@collaborationtool/ai-runtime` —— 客户端**跑不动** |
| `transpilePackages` | `editor-core` / `doc-store` —— 在 web bundle 内，desktop 套壳 OK |
| `packages/doc-store/` | ✅ 已落地（`a2c0ff0`），`DocumentHandle` / `Disposable` / `YjsDocumentHandle` / `DocStore` 抽象就位 —— **client-side adapter 有现成钩子** |
| Ollama 集成 | `packages/ai-runtime/src/providers/ollama.ts` 是 Node.js runtime，但 UI 可直接 `fetch('http://localhost:11434/api/chat')`，**不必走当前 provider** |
| pnpm scripts | `web:dev` (port 3000) / `web:build` / `web:start` —— 标准 Next.js，无 export mode |

**含义**：
- **Tauri 套远端 web** = 几乎零阻力（套现成 URL）
- **Tauri 内嵌完整后端**（Next + PG + sync-gateway + agent-worker）= 极大工程（PG → pglite-wasm or 远程 only；4 进程编排；自动迁移；安装包 ~200MB+）

---

## 2. 三档 scope（cost 差 ~30x，必须选）

### 档 A2.1 — Thin Tauri shell（推荐起点）

**内容**：
- Tauri 1.x or 2.x webview 套远端 `https://collaborationtool.<host>`
- 系统集成：托盘 icon / 系统通知 / 自动更新（Tauri updater）/ 文件关联 `.paper`（双击打开 → app route）
- **本地 AI**：UI 直接 `fetch('http://localhost:11434/api/chat')` 调用用户本地 ollama（不依赖后端 ModelProvider），inline edit / 补全用
- 全平台 binary：macOS arm64 / macOS x64 / Windows x64 / Linux deb+AppImage

**周期**：3-5 天
**新依赖**：Tauri CLI + Rust toolchain（dev 期，用户机器不需要）
**Phase 5 Wave A 冲突**：0（不动现 web code）
**ADR 影响**：ADR-0003 review log 加 distribution channel

**用户感知**：
- 桌面 icon 打开就用
- 离线状态：**全断**（Tauri webview 看到 net error 页）
- 本地 inline AI：✅（直连 ollama）
- 重型 agent (reviewer / researcher / coordinator)：仍走远端 server

### 档 A2.2 — Hybrid（thin shell + IndexedDB cache + read-only offline）

**= A2.1 +**
- IndexedDB 缓存"最近打开 N 篇文档"的 Y.Doc snapshot
- 离线时进入 **read-only mode**（可阅读，不可编辑）
- 主动同步：连网时自动 pull 最新 Y.Doc state
- 用 `packages/doc-store/` 的 `DocumentHandle` 抽象包一个 `IndexedDBBackend`

**周期**：A2.1 + 1-2 周
**Phase 5 Wave A 冲突**：0（doc-store 抽象已就位）
**ADR 影响**：ADR-0001 review log（加 client cache adapter）

**用户感知**：
- 飞机 / 弱网：能看，不能编辑
- 弱网：编辑时网络抖动不丢内容（cache 兜底）

### 档 A3 — 真 offline-first（带本地后端）

**= A2.2 +**
- IndexedDB → sqlite-wasm（pglite 或 sql.js）
- 编辑离线 = 写本地 OPLog，连网时 sync-gateway 协同 reconcile
- 本地完整 read/edit 路径（不依赖远端）
- 可选：本地 spawn agent-worker 跑客户端 long-horizon agent（依赖 ollama）

**周期**：A2.2 + **3-6 月**
**Phase 5 Wave A 冲突**：可能小冲突（sync-gateway 要客户端 pull 模式；当前是 WebSocket-only）
**ADR 影响**：ADR-0001 + 0004 + 0008 全部 **major revision**
**前置依赖**：
- doc-store IndexedDB/sqlite backend（W7.1 抽象 OK 但 backend 要新写）
- sync-gateway 加 HTTP pull endpoint（当前 WS-only）
- agent-worker client-side variant（如果想要离线 agent）

**用户感知**：
- 真离线编辑
- 本地完整 self-host（不依赖远端）
- 安装包 ~50-200MB（Tauri + bundled binaries）

---

## 3. 三档对比矩阵

| 维度 | A2.1 Thin | A2.2 Hybrid | A3 Offline-first |
|---|---|---|---|
| 周期 | **3-5 天** | 2-3 周 | **3-6 月** |
| ADR 影响 | review log ×1 | review log ×1 | major revision ×3 |
| Phase 5 Wave A 冲突 | 0 | 0 | 可能小冲突 |
| 离线 read | ✗ | ✓ | ✓ |
| 离线 edit | ✗ | ✗ | ✓ |
| 本地 inline AI | ✓ | ✓ | ✓ |
| 本地 long-horizon agent | ✗ | ✗ | ✓ (可选) |
| 自动更新 | ✓ | ✓ | ✓ |
| 安装包大小 | ~10 MB | ~15 MB | 50-200 MB |
| 真实痛点 dogfood 验证度 | "我要装机分发" | + "我要弱网兜底" | + "我要飞机上写论文" |

---

## 4. 推荐：**先 A2.1，看痛点再扩**

### 理由

1. **3-5 天的工程量**对比 3-6 月，**先做小的看用户反应**符合 CLAUDE.md §5.3 "没有 dogfood 痛点不上大件"
2. **A2.1 已经解决 80% 用户预期**："装得上的 app + 本地 AI" 这两个最常被提到的诉求 A2.1 全覆盖
3. **离线编辑（A3 唯一增量）需要真痛点信号**：当前没有 alpha tester 反馈"我要离线编辑"，improvement-plan §四已经把"跨设备同步 storage adapter"砍到 Phase 6+
4. **A2.1 → A2.2 → A3 是渐进**：先建 Tauri shell + ollama 集成，doc-store IndexedDB backend 后续扩，不会"返工"
5. **A3 的隐藏成本**：sync-gateway 改 HTTP pull / agent-worker 客户端化 / PG → pglite 全是 Phase 5 Wave A 之外的工作，需要专门预算

### 不推荐 A3 的具体理由

A3 真正的 driver 是 "数据所有权 + 离线 + 本地 AI"。其中：
- "本地 AI" → A2.1 直接调 ollama HTTP 解决，**不需要 A3**
- "离线" → 没有真用户痛点 ≥ 5 次（improvement-plan §四 把"跨设备"砍了）
- "数据所有权" → 用户在本对话主动放弃 E2EE 后，data ownership 的主要 driver 已弱化

**A3 复活条件**：alpha tester（Wave C C3 招募 4 位）反馈"我要离线编辑" ≥ 3 次。

---

## 5. A2.1 实施 sketch（5 天版）

| Day | 内容 | 输出 |
|---|---|---|
| D1 | Tauri 2.x scaffold + 套远端 web URL + dev 跑通 | `apps/desktop/` 新包 + `src-tauri/` |
| D2 | macOS / Windows / Linux build pipeline + GitHub Actions release | 3 平台 binary |
| D3 | 系统集成：托盘 icon + 通知 + `.paper` 文件关联 + deep-link `collabtool://doc/<id>` | Tauri commands |
| D4 | UI 加 "本地 AI" toggle：检测 localhost:11434 → 提示装 ollama / 启用 → inline edit 路由 | `apps/web/src/lib/local-ollama.ts` |
| D5 | 自动更新 (Tauri updater + signed manifest) + README 装机说明 + ADR-0003 review log | 0.1.0 release |

**包结构**：
```
apps/desktop/
  src-tauri/
    Cargo.toml
    tauri.conf.json   # 套 https://... or http://localhost:3000
    src/main.rs       # 托盘 / 文件关联 / updater
  package.json        # tauri-cli script
```

**注意点**：
- Tauri webview 走系统 webview（macOS WKWebView / Windows WebView2 / Linux WebKitGTK）—— 没 Electron 那么大
- macOS notarization + Windows code signing 是 release 必备（Apple Developer ID + Sectigo cert，~$200/y）
- 自动更新签名 key 管理（Tauri 内置 minisign）

---

## 6. 开放问题（用户拍板）

### Q1：哪档？
(a) **A2.1 Thin shell**（推荐，3-5 天）
(b) A2.2 Hybrid（2-3 周）
(c) A3 Offline-first（3-6 月）—— 不推荐除非有真痛点信号

### Q2：什么时机启动？
(a) **Phase 5 Wave A 跑完再启**（推荐，避免分心）—— Wave A 6 项硬验收信号未全打勾前不开新分支
(b) **Phase 5 Wave A 期间并行做** —— A2.1 不动 web code，理论可并行；但需要专门时段，不要边写 reviewer 边切 Tauri
(c) **Phase 5 Wave A 加一个 W6 desktop**—— 把它正式插进 Phase 5 wave A scope（要改 plan stub）

### Q3：分发渠道？
(a) **GitHub Releases**（推荐起点，零成本，dev-tester 友好）
(b) GitHub + 自家 download page
(c) Mac App Store / Microsoft Store（合规 + 抽成，Phase 6+ 再说）

### Q4：本地 AI inline 第一个 surface？
(a) **Inline edit suggester**（Phase 4 W6.1 AgentPanel inline 已就位，加 "use local ollama" toggle）—— 推荐
(b) Reviewer / researcher 客户端版（要重新设计 plugin host，**这是 A3 工作量**，不在 A2.1 scope）
(c) Citation auto-complete

---

## 7. 不做的事（明确写下来防 scope creep）

- ❌ E2EE / 加密文档（用户已 explicit 推后）
- ❌ 本地 PG / pglite-wasm（A3 scope）
- ❌ sync-gateway HTTP pull / 客户端 sync 模式（A3 scope）
- ❌ 客户端 agent-worker（A3 + ADR-0008 major revision）
- ❌ Plugin host 客户端化（A3 + ADR-0012 caveat 升级）
- ❌ 移动端（Tauri 2.0 支持 iOS / Android 但不在本 scope）
- ❌ 自家更新服务器（用 GitHub Releases 即可）

---

## 8. 我的诚实判断

**该做什么**：A2.1 Thin shell + 本地 ollama inline，**Phase 5 Wave A 跑完后启动**，5 天工程，0 ADR 冲突。这是 free win。

**最大的风险**：用户期待"app 还是要做"的真实含义是 "我要离线编辑 + self-host" → 那 A2.1 不满足。**这条要先对齐**。否则我交 A2.1 然后用户说"这不是我要的 app"。

**对齐策略**：在 Q1 之前，先问"你说 app 时，离线编辑算不算必备？"——这是 A2.1 / A3 的分水岭。

**最务实的下一步**：
1. 用户答 Q1-Q4
2. 如果 Q1 = A2.1：起 `claude/desktop-tauri-shell` 分支，按 §5 Day 1-5 推进
3. 如果 Q1 = A3：先建议 dogfood survey（不立即起，等真痛点 ≥ 3 次）
