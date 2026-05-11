# E2EE + App + 云端辅助 决策分析

> 起因：2026-05-11 用户提出"项目应该有 app，实现端到端协作（加密），云端辅助"。
> 这份文档不下结论，目的是把复合命题拆到可独立决策的轴，列 trade-off + ADR 影响 + 必须先答的 unknown。

---

## 0. 问题陈述（解读）

用户原话裹了**三件互相打架**的事：

- **"有 app"** —— 想要客户端安装包形态？
- **"端到端协作加密"** —— server 看不见明文？
- **"云端辅助"** —— 云只做 relay/storage/auth？

这三件不是同一根轴上的。需要先拆。

---

## 1. 三轴拆解（彼此正交）

```
轴 A：分发形态 ── 用户怎么打开产品？
轴 B：信任模型 ── server 能看见什么？
轴 C：AI 位置  ── plugin/skill/agent loop 在哪个进程跑？
```

**轴 A 是产品决策**（影响安装 / 离线 / 桌面集成），与加密**没必然关系**。
**轴 B 是密码学决策**（影响 schema / sync wire / search），与 app 形态**没必然关系**。
**轴 C 是架构决策**（影响 ADR-0008 / 0013），是 B 的**最大约束**：E2EE 下 server 看不见明文，server-side agent 就跑不了。

混在一起讨论是 PM-级常见错误。

---

## 2. 现状基线（每轴的 default，按 2026-05-11 STATUS）

| 轴 | 现状 | 来源 |
|---|---|---|
| A 分发形态 | **web only**（Next.js 15，本地 `pnpm web:dev` 起 → 浏览器） | apps/web |
| B 信任模型 | **server-trusted**：PG 存 Yjs binary snapshot（明文）+ sync-gateway 看得见 Y.Doc update + 服务端写 provenance | ADR-0001 §5.A/§5.D, ADR-0004 |
| C AI 位置 | **server-side**：agent-worker 是独立 Node 进程，从 pgboss queue 抽 job → `invokeAgentViaPlugin()` → ModelProvider 4 adapter → 写 `agent_job_event` | ADR-0008, `apps/agent-worker/src/index.ts` |

**已有"半客户端"基础设施**：
- `ai-runtime/src/providers/ollama.ts`、`custom-http.ts` 表示本地 / 自托管 LLM 路径**已经支持** —— 因此把 agent 搬到客户端在 model 层**没拦路虎**。
- 真正的拦路虎是：plugin sandbox（ADR-0012 bwrap 当前 Linux-only）、MCP 客户端（当前在 agent-worker 进程加载）、quota enforcer（PG counter，需要 server）、coordinator multi-agent loop（pgboss 调度，需要 server）。

---

## 3. 每轴的路径选项 + cost 量级

### 轴 A：分发形态

| 路径 | 实现量 | 现状阻力 | 用户感知 |
|---|---|---|---|
| **A1. 纯 web**（现状） | 0 | 0 | 浏览器 tab，关 tab 就丢 |
| **A2. Tauri 包一层** | 0.5-1 周 | 几乎无（web 不改） | 桌面 icon、系统托盘、本地通知。仍连远端 server。 |
| **A3. Tauri + 本地存储**（offline-first） | 4-8 周 | 要 `doc-store` 抽象先落地（Phase 4 W7.1，**未做**）+ 本地 IndexedDB / sqlite adapter | 离线编辑、本地 search。仍可同步云。 |
| **A4. 真 native（macOS/Windows）** | 6 月+ | 重写 editor 渲染层 / 字体 / CJK 排版 | 苹果体感，但维护成本大爆 |
| **A5. 移动端 reader** | 3-6 周 | TipTap mobile 排版 + PDF render-typst 客户端 | 看论文 / 简评论。不是编辑器主战场 |

**关键认识**：A1 → A2 几乎免费（Tauri 把 web 套壳），**先做 A2 不应被任何讨论卡住**。A3 才是真正动 ADR 的方向。

### 轴 B：信任模型

| 路径 | 含义 | 与现状的冲突 |
|---|---|---|
| **B1. server-trusted**（现状） | server 看明文，做 snapshot/index/search/export | 0 |
| **B2. 全局 E2EE** | server 只存密文 blob，所有 read path 客户端解密 | **极大**：snapshot-worker 失效 / 服务端 search 失效 / 服务端 export 失效 / agent-worker 看不见明文 / provenance 写入要客户端签名 / 邀请 / capability check 要客户端 key exchange |
| **B3. per-document 加密 compartment** | 用户选某些文档开"私密模式"，对私密文档 server 看不见，公开文档照旧 | **中**：编辑器要分 mode；agent 在私密文档退化为客户端 inline；search 退化 |
| **B4. ZeroKnowledge metadata + 明文内容** | 题录 / 评论 加密，正文不加密 | **小**：意义也小（没解决核心隐私诉求） |
| **B5. 客户端可选签名 + server 明文**（trust-but-verify） | server 看明文但客户端可独立验证未被篡改（Merkle log + per-user key 签 commit） | **小-中**：与第一性原理 #11 provenance 一等吻合；不是真 E2EE 但解决"数据完整性 / 历史不可改" |

**关键认识**：
- B2 全局 E2EE 在**有 server-side AI 的产品**里几乎都失败（Notion / Coda / Obsidian Sync 都是 B5 或 B1+ 选项性加密）。Cryptpad / SkiffNotes 是 B2 但**没有 AI 协作**这一核心 surface。
- B3 per-document 看似妥协但**复杂度高**：编辑器在两个 mode 之间切，capability 模型要双轨。
- B5 是被低估的中间方案：**用户的真痛点常常是"数据完整性 + 不被偷改 + 离开平台数据自有"，不是密码学意义的 E2EE**。

### 轴 C：AI 位置（B 的最大约束）

| 路径 | 含义 | 改动量 |
|---|---|---|
| **C1. server-side agent**（现状） | agent-worker 跑 plugin + MCP + ModelProvider | 0 |
| **C2. 客户端 inline AI**（轻 surface） | Inline edit、补齐、citation hint 在客户端调 Ollama / 用户自家 OpenAI key | 中：plugin host 已分 `kind=inline-edit-suggester` / `kind=tool-invoker`，把 inline 抽离 |
| **C3. 客户端 long-horizon agent**（重 surface） | coordinator multi-agent loop 跑客户端 | 极大：pgboss 调度 / quota enforcer / cancel API / timeline 都要重写为客户端 / P2P 信号 |
| **C4. 混合**：inline → 客户端，long-horizon → server | C2 + C1 共存 | 中-大 |

**关键认识**：C4 是 "B3 per-doc E2EE" 的天然搭档 —— 私密文档**强制走 C2**，公开文档可选 C1。但 ADR-0008 的整个 timeline / cancel / quota 都要重写客户端版本。

---

## 4. 路径组合的依赖矩阵

只列**可行**的组合：

| 组合 | 实现总量 | 适用人群 | 第一性原理对齐度 |
|---|---|---|---|
| **A2 + B1 + C1**（Tauri 套壳，其它不动） | 0.5-1 周 | 想要"装得上的 app"的所有用户 | #1 弱（数据仍在云）；#10 满足 |
| **A3 + B5 + C4**（offline-first + 完整性签名 + 混合 AI） | 6-10 月 | 重视数据所有权 + 离线 + 仍要 server AI | #1 强 / #11 强 / #10 强 |
| **A3 + B3 + C4**（offline-first + 私密 compartment + 混合 AI） | 8-12 月 | 处理敏感未发表论文 / 临床数据的研究者 | #1 强 / #11 强但分裂 |
| **A2/A3 + B2 + C2-only**（全 E2EE + 全客户端 AI） | 12 月+ | 隐私极客 / 小众 | #1 极强 / 但放弃 #11 long-horizon agent + #9 community surface |

**重点**：**没有 "A2 + B2 + C1" 这一行** —— 全 E2EE 与 server-side agent 物理上不兼容。

---

## 5. 关键 unknown（用户必须答，否则我无法推荐）

按答案影响顺序排：

1. **真实用户痛点是哪一个？**（这条不答其它都白讨论）
   - (a) 装机分发 / 桌面集成（→ A2 即可）
   - (b) 数据所有权 / 离开平台不丢数据（→ A3 + 导出强化）
   - (c) 离线工作（→ A3 + doc-store）
   - (d) 防 server 偷看 / 监管担忧（→ 才需要碰 B2/B3）
   - (e) 防数据被偷改 / provenance 不可伪造（→ B5 即可）

2. **目标用户的 AI 期待是？**
   - "我希望 AI 看我所有内容做长程任务"（→ C1，与 B2 互斥）
   - "我只用 inline 补全"（→ C2 即可，与 B2 兼容）
   - 这条决定 B 的上限。

3. **接受多少功能退化换隐私？**（让用户具体回答）
   - 接受**服务端 search 失效**吗？（搜全文要客户端 index）
   - 接受**服务端 export PDF 失效**吗？（导出走客户端 Typst）
   - 接受**reviewer agent 跑不了私密文档**吗？

4. **时间窗 + 团队规模**
   - 这是 Phase 5 内的事？还是 Phase 6+？
   - 1 个 owner + 偶尔 alpha tester 的现状能不能扛 6-12 月的重构？

5. **prior art 调研**：Cryptpad / Anytype / Standard Notes / Obsidian Sync / Notion / SkiffNotes / Logseq 各自走的是 B 轴哪格？（这条值得专门做一次 landscape 更新，避免重复发明）

---

## 6. 推荐的决策顺序

**Step 1**（5 分钟）：用户答 §5.1 真实痛点是 (a)-(e) 哪个。不答这条往下都浪费。

**Step 2**（如果 痛点 = a/b/c）：
- 立即起 **ADR-0017 Desktop shell via Tauri**，做 A2，0.5-1 周。
- 这不冲突任何现存 ADR，improvement-plan §四 砍推清单**没有覆盖到这条**，是 free win。
- 同时把 §四 推到 Phase 6+ 的 **"跨设备 storage adapter"** 复活条件部分前置 → 起 A3 ADR stub（不立即做，等 doc-store W7.1 落地）。

**Step 3**（如果 痛点 = d/e）：
- 先做 **B5 完整性签名**（轻量，与 ADR-0011 claim-evidence 天然契合，1-2 周可 POC）。
- B2 全 E2EE **不在 Phase 5 议程**，因为：
  - new ADR moratorium（improvement-plan §四）：ADR-0012/0013/0014 dogfood gate 没跑完之前不起新 ADR。
  - 第一性原理 #10："分布式系统和数据模型上先简单后扩展经常是骗局" —— E2EE 反向同理，未验证痛点不动 schema。
  - 现 server-side agent-worker / coordinator / pgboss 是 6 个月工作量，不能为未验证需求推翻。

**Step 4**：每个候选 ADR 跑 9 项 dogfood gate（improvement-plan §五）—— "**有没有 ≥3 个真实用户在因为 X 而离开**？"

---

## 7. ADR 影响速查

| ADR | 现状 Status | A2 影响 | A3 影响 | B2 全 E2EE 影响 | B5 完整性签名影响 |
|---|---|---|---|---|---|
| 0001 data-model + CRDT | Accepted | 无 | review log: 加 client storage adapter | **超大 revision**：snapshot 不再是 server truth | review log: commit 加签名字段 |
| 0002 permission | Accepted | 无 | 无 | **超大**：capability check 改客户端 | 无 |
| 0003 tech-stack | Accepted | review log: 加 Tauri | 加 IndexedDB/sqlite adapter | 加 libsodium | 加 ed25519 |
| 0004 deploy + security | Accepted | review log: 加 distribution channel | 同左 | **重写** | 小 |
| 0006 MCP registry | Accepted | 无 | 无 | **大**：MCP 客户端搬客户端 | 无 |
| 0008 agent runtime | Accepted (caveat) | 无 | 无 | **超大**：跑客户端 coord | 无 |
| 0010 plugin API | Accepted | 无 | 无 | 中 | 无 |
| 0011 claim-evidence | Proposed | 无 | 无 | 大 | **天然契合**，可直接拓展 |
| 0012 plugin sandbox | Accepted (caveat) | 无 | 无 | 中（plugin 在客户端要 sandbox） | 无 |
| 0013 ModelProvider | Accepted | 无 | 无 | 中（key 留客户端） | 无 |
| 0014 subdocument | Proposed | 无 | 无 | 大 | 中 |

---

## 8. 我的判断（合伙人视角，可否决）

1. **轴 A 几乎不用讨论**：A2 Tauri 套壳是 0.5-1 周 free win，没有任何 ADR 冲突，improvement-plan §四 砍推清单**根本没碰过它**。如果用户痛点是"装得上的 app"，直接做。

2. **"端到端协作加密"是个被误用的术语**：用户**真正想要**的 99% 概率不是 Cryptpad 那种 server-zero-knowledge，而是这两个里某一个：
   - **数据所有权 / 离开平台数据不被锁**（B5 + A3 + 强化导出能解决，不需要 E2EE）
   - **AI 行为透明 + provenance 不可篡改**（B5 + ADR-0011 拓展可解决，不需要 E2EE）

3. **真 E2EE（B2）不应在 Phase 5 出现**：
   - 触发 §5.1 / §5.3 红线（"不要先简单后扩展在数据模型上" 反向同理；过度工程）
   - 触发 new ADR moratorium（improvement-plan §四）
   - 替换或省去什么？**没说清** —— 替换了"服务端 search / export / long-horizon agent"全部，这些**正是 Phase 4 W6-W10 + Phase 5 W1-W2 的核心 dogfood gate** 在堵的能力。

4. **"云端辅助"这个表述方向是对的**：服务端**应该**退到 relay + storage + auth + coordinator 调度，**不应该**做 search index / inline AI suggester 等 surface。这条与现状不冲突，是 Phase 6+ 的自然演化方向。

---

## 9. 必须问用户的下一个问题

> **"你的真实用户（或你自己 dogfood）在什么场景下因为现状感到痛？**
> - "我不能离线写作"（→ A3）
> - "我换台机器就要重新登录" （→ A2/A3 + sync improve）
> - "我害怕 server 偷看我的草稿"（→ 才碰 B2/B3，且需要真实威胁模型）
> - "我审稿的草稿被对手看到"（→ B3 per-doc）
> - "我希望我引的每一句都不可伪造"（→ B5）
> - "其它（请描述）"

不答这条往下走是 chocolate-covered broccoli —— 上密码学这种 hard tech 包装一个未验证的痛点。
