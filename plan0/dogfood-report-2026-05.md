# Phase 4 W9 dogfood gate report — 2026-05

> 5 道 dogfood gate 状态汇总。`improvement-plan-2026-05.md` §一 W9 落实。

最后更新：2026-05-11 · 分支 `claude/phase4-closeout`

---

## 总览

| Gate | 来源 ADR | sandbox 可跑 | external 依赖 | 当前状态 |
|---|---|---|---|---|
| **G1 bwrap 真启动** | ADR-0012 W1 | argv builder 契约 + capability deny | Linux host CI runner（ubuntu-latest）+ `apt-get install bubblewrap` | ⚪ CI workflow 就绪；等 GitHub Actions runner 真跑 |
| **G2 4 endpoint round-trip** | ADR-0013 W2 | provider source 契约 + 4-tier resolver + Anthropic SDK 隔离 | 4 个 API key（Anthropic / OpenAI / Ollama base URL / custom-http endpoint）经 GitHub Secrets | ⚪ secrets 未配；matrix entry 自动 skip。contract 段 PASS |
| **G3 端到端真 multi-agent goal** | ADR-0008 W3 | coordinator dispatch shape + agent-worker 终止事件 + provenance approvalChain | 真 ANTHROPIC_API_KEY + crossref MCP（已 docker-compose） | ⚪ shape PASS；real LLM gated on `DOGFOOD_REAL_LLM=1` + secret |
| **G4 pgboss + 6 finding fixture + dashboard** | ADR-0011 §7 | 6 fixture seed + scanForFindings 真跑 + `/maintenance` 路由探测 | (none) — PG via docker-compose service container | ✅ 全 sandbox 可跑（本次 commit 落地） |
| **G5 50 客户端 stress + cross-doc reference** | ADR-0014 §5 W5-W6 | cross-ref-sync.ts 模块 + 12 单元测试（Y.Map ↔ PG 镜像）；proto-a stress 5-25 client | sync-gateway 多 subdoc 路由（W5/W6 dogfood gate） | ⚠️ 部分 PASS（5-25 client + dual-write owner 落地）；50 client 待 W5/W6 promote |

图例：✅ 全 PASS · ⚠️ 部分 PASS · ⚪ 待 external 依赖（CI workflow 就绪）

---

## G1 — bwrap 真启动（ADR-0012 W1）

**PASS criteria**
1. `packages/ai-runtime/src/plugins/install.ts` 的 `buildLinuxBwrapArgs` 输出含全部 ADR-0012 §2.1 namespace flag。
2. `bwrap --version` 在 ubuntu-latest 上 exit 0 + 含 `bubblewrap` 版本字符串。
3. capability deny gate：未列在 manifest 中的 capability 被 install pre-check 拒绝。

**sandbox 跑结果**（本次 commit）
- `tests/e2e/specs/dogfood-bwrap.spec.ts` 3 测：
  - `#1 install.ts 契约` ✅（macOS/Linux 都能跑）
  - `#2 bwrap --version`：⚪ 当前 host = darwin 25.4.0；test.skip
  - `#3 capability deny`：✅
- CI workflow `dogfood-bwrap.yml` 就绪（apt-get + Playwright + `pnpm e2e:dogfood:bwrap`）。

**external 阻塞**
- 等 GitHub Actions ubuntu-latest runner 跑通才能 promote ADR-0012 → Accepted。

**推 Phase 5 / dogfood timeline**
- 一旦 CI 第一次在 push 上跑过 G1，把结果贴回 ADR-0012 §6 review log。

---

## G2 — 4 endpoint round-trip（ADR-0013 W2）

**PASS criteria**
1. 4 个 provider 源文件各自 export 契约 factory。
2. Phase 4 W7.2 invariant：`providers/{ollama,openai-compat,custom-http}.ts` 不 import `@anthropic-ai/sdk`。
3. `resolver.ts` 含 4-tier 优先级名（document-override / user-pref / manifest / env-default）。
4. 真 round-trip 在 `DOGFOOD_PROVIDER_MATRIX` 配 secret 时执行；否则 skip。

**sandbox 跑结果**
- `tests/e2e/specs/dogfood-providers.spec.ts` 4 测：1-3 ✅（filesystem 契约）；4 ⚪ skip（无 secret）。
- ai-runtime 包 W7.2 已交付 plugin contract migration（5 plugin 全走 `provider: ModelProvider`）。
- mock provider invoke 测试覆盖在 `packages/ai-runtime/tests/`。

**external 阻塞**
- ANTHROPIC_API_KEY / OPENAI_API_KEY / OLLAMA_BASE_URL / CUSTOM_HTTP_ENDPOINT 4 个 GitHub Secret 未配。
- matrix `dogfood-providers.yml` 已写好 secrets 引用；只需 repo owner 注入 secret 即跑通。

**推 Phase 5 / dogfood timeline**
- Phase 5 Wave A1（quota enforcer）落地时一并 dogfood 真 round-trip + 把 ADR-0013 → Accepted。

---

## G3 — 端到端真 multi-agent goal（ADR-0008 W3）

**PASS criteria**
1. coordinator plugin 源含 inline-editor / citation / reviewer 3 个 sub-agent 引用。
2. agent-worker `[final]` 终止事件 + parentJobId 链路落地。
3. provenance writer 含 `approvalChain` + `agentContext` 字段。
4. 真 LLM round-trip：`DOGFOOD_REAL_LLM=1` + ANTHROPIC_API_KEY 时执行；否则 skip。

**sandbox 跑结果**
- `tests/e2e/specs/dogfood-multi-agent.spec.ts` 4 测：1-3 ✅（filesystem 契约）；4 ⚪ skip。
- W7.4 provenance batch 7 测全 PASS（覆盖 mock LLM 多 agent dispatch）。

**external 阻塞**
- 真 LLM 调度需要 ANTHROPIC_API_KEY + crossref-mock docker service。
- `dogfood-multi-agent.yml` workflow 含 PG service container；只缺 secret。

**推 Phase 5 / dogfood timeline**
- Phase 5 Wave A4（AgentTimeline）需要真 multi-agent run 喂数据；G3 真 round-trip 与 A4 dogfood 合并。

---

## G4 — pgboss + 6 finding fixture + dashboard（ADR-0011 §7）✅

**PASS criteria**
1. `pnpm db:seed:maintenance` 落 6 fixture（每类 1 个）幂等。
2. PG 行查询确认 6 fixture 真在表里（claim/source/citation/evidence 关联完整）。
3. `/maintenance` 路由活着（200/302/401/403）。
4. agent-worker maintenance-scan 26 单元测试全 PASS（已存在）。

**sandbox 跑结果**
- 新 `infra/drizzle/seeds/maintenance-fixtures.ts`：6 fixture seeder + makeFixtureDoiResolver helper。
- 新 `pnpm db:seed:maintenance` script（root + drizzle）。
- 新 `tests/e2e/specs/dogfood-maintenance.spec.ts` 3 测（spec 内 `if (!DATABASE_URL) skip`，CI 拉 PG service container 后真跑）。
- agent-worker `tests/maintenance-scan.test.ts` 已 26 测 PASS（W4 闭环）。

**external 阻塞**
- 无。CI workflow `dogfood-maintenance.yml` 自带 PG service container；本地 `pnpm db:up` 后即可跑通。

**status**
- ✅ G4 是 5 道 gate 中**唯一全 sandbox PASS** 的；Phase 4 closeout STATUS 直接列成 done。

---

## G5 — 50 客户端 stress + cross-doc reference（ADR-0014 W5/W6）⚠️

**PASS criteria — sandbox tier（本次落地）**
1. `apps/snapshot-worker/src/cross-ref-sync.ts` 模块 export 文档约定的 API（`startCrossRefSync` / `reconcile` / `isValidCrossRefEntry` / `CrossRefEntry`）。
2. `apps/snapshot-worker/__tests__/cross-ref-sync.test.ts` 12 测全 PASS：
   - 4 测 isValidCrossRefEntry（well-formed / 缺 refKind / 空 refTargetId / cross-subdoc）
   - 5 测 reconcile（fresh insert / update / cross-subdoc / delete stale / 过滤 malformed）
   - 2 测 startCrossRefSync.observe → mirror（live add / dispose 后停止）
   - 1 测 cross-subdocument round-trip
3. proto-a stress harness（5 client × 50 ops）保留在 workspace。

**PASS criteria — full tier（deferred）**
- 50 client × 50 ops over 真 sync-gateway with multi-subdoc routing。
- Subdocument-level ACL deny path（capability_resource_type=subdocument 已落 schema；但路由层 W5/W6 dogfood gate 才算 promote）。

**ADR-0014 §5 dual-write 决策落地（本次 commit）**
- crossRefs Y.Map 主，PG `crossref_index` 后台同步。
- **owner = `apps/snapshot-worker`**（cross-ref-sync.ts 实施 Y.Map.observe → PG 增量；reconcile() 提供 startup 一致性收敛）。
- 一致性窗口：snapshot tick 周期（默认 5s）。
- maintenance scan broken-citation 跨 subdoc 检查文档明确这一 false-negative 窗口。

**external 阻塞**
- sync-gateway 多 subdoc 路由（Phase 4 W5/W6 dogfood gate）尚未启动；50 client 真跑等这块。

**推 Phase 5 / dogfood timeline**
- Phase 5 Wave A4 + B（claim-on-claim review）需要 cross-doc reference 真 sync；G5 full tier 与 W5/W6 dogfood 合并 promote ADR-0014 → Accepted。

---

## 本次 W9 commit 范围

新增文件：
- `.github/workflows/dogfood-{bwrap,providers,multi-agent,maintenance,stress}.yml` × 5
- `tests/e2e/specs/dogfood-{bwrap,providers,multi-agent,maintenance,stress}.spec.ts` × 5
- `infra/drizzle/seeds/maintenance-fixtures.ts`
- `apps/snapshot-worker/src/cross-ref-sync.ts`
- `apps/snapshot-worker/tests/cross-ref-sync.test.ts`
- `plan0/dogfood-report-2026-05.md`（本文件）

修改：
- `package.json` ＋ `db:seed:maintenance` ＋ 5 `e2e:dogfood:*` script
- `infra/drizzle/package.json` ＋ `seed:maintenance` script
- `apps/snapshot-worker/src/index.ts` ＋ cross-ref-sync re-export

---

## ADR review log 草稿（Phase 4 W9 promote 候选）

> 不在本 commit 改 ADR 文件；以下条目作为 W10 ADR promote 时的 review log 内容。

- **ADR-0008 §122**：W9 G3 multi-agent shape gate 落地（mock LLM PASS；real LLM 等 secret）。Phase 5 Wave A1 quota enforcer + A4 AgentTimeline 上线后促成最终 promote。
- **ADR-0011 §7**：W9 G4 maintenance dogfood gate ✅ — 6 finding fixture seed + dashboard 路由探测均落地；ADR 状态可由 Accepted 维持（已 Accepted）。
- **ADR-0012 §6**：W9 G1 bwrap CI workflow 就绪；real spawn 等 ubuntu-latest 第一跑。Status: Proposed（不变），promote 触发 = G1 CI 一次绿。
- **ADR-0013 §3**：W9 G2 contract gate ✅；real round-trip 等 4 secret。Phase 5 Wave A1 dogfood 时合并 promote。
- **ADR-0014 §5**：dual-write 决策落地——owner 锁定 `apps/snapshot-worker`，cross-ref-sync.ts + 12 测交付。50 client tier 推 W5/W6。Status: Proposed（不变），promote 触发 = W5/W6 sync-gateway 多 subdoc 路由 + 50 client 真跑。
