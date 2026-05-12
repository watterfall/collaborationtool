# Spike-3 Decision — Plugin Runtime Selection

## Conclusion

**Hybrid:** WASM Extism as **primary cross-platform path** + macOS
sandbox-exec / Windows AppContainer / Linux bwrap as **per-OS native
fallback** for plugins that need npm.

Rationale:

1. **WASM Extism gives true cross-platform** — same .wasm runs on
   Linux / macOS / Win / iOS / Android. Plugin marketplace ergonomics
   aligned with client-first pivot (`docs/superpowers/specs/2026-05-11-client-first-pivot-design.md`).
2. **Native fallback handles npm-heavy plugins** — Spike-2 / Spike-3
   confirmed Componentize-JS / QuickJS bridge is not plug-and-play in
   2026-05 (ComponentizeJS still beta; QuickJS embed is ~3-5MB per
   plugin). For plugins that ship Node + npm bundle, native sandbox
   is shorter path.
3. **Decision granularity = per-plugin manifest** — plugin manifest
   declares `runtime: 'wasm' | 'native'`; install UI shows trust
   prompt matching runtime's security guarantees.
4. **Linux bwrap remains the proven baseline** — ADR-0012 already
   Accepted with caveat; Spike-3 doesn't invalidate it; on Linux the
   `native` runtime path == bwrap.

## Trade-off matrix actuals (per task 5)

| Runtime | Cold-start (reference) | Warm-start | NPM | Cross-platform | Impl cost W9-W10 |
|---|---|---|---|---|---|
| Linux bwrap | ~3-8ms (ADR-0012) | n/a | ✅ | ✗ | already shipped |
| macOS sandbox-exec | ~10-30ms (WWDC 2017) | n/a | ✅ via node binary | ✗ | 2-3 weeks |
| Win AppContainer | ~5-15ms (MS docs) | n/a | ✅ via lpacAppExperience | ✗ | 3-4 weeks |
| WASM Extism | ~1-3ms (extism.org) | ~5-50µs | ⚠️ via Componentize-JS (beta) | ✅ | 4-6 weeks |

(Host harness blocked actual measurement on this spike machine —
trade-off-matrix.md "Cold-start host harness measured" row records
"blocked" for macOS / WASM; Phase 6 W9-W10 G7 will fill real numbers.)

## Rejected alternatives

- **WASM-only**: rejected — npm friction too high for Phase 6 plugin
  marketplace ergonomics (ComponentizeJS still beta as of 2026-05;
  QuickJS-in-WASM adds 3-5MB per plugin). Re-evaluate when
  Componentize-JS GA.
- **Native-only**: rejected — Apple's sandbox-exec deprecation +
  Windows AppContainer's poor ergonomics make per-OS engineering
  treadmill too costly long-term. Each OS major version risks
  breakage; we'd ship 3 sandbox layers and maintain forever.
- **Server-side ssh tunnel + Linux bwrap from desktop**: rejected as
  default — desktop must work offline (spec §3 desktop priority); ssh
  fallback only meaningful as emergency path for private-project
  agents when client lacks runtime. Re-considered as a backup channel
  for plugins that need full Linux ecosystem, not the primary model.

## Open questions for ADR-0019 drafting

- **Q1: per-plugin runtime declaration** — manifest field name
  `runtime`, values `wasm` / `native:linux` / `native:macos` /
  `native:windows` / `native:any`. Final naming: see ADR-0019 §2.
- **Q2: WASM build pipeline** — Extism PDK Rust path locked for
  Phase 6 W9-W10 manual-write Rust glue. JS-side pipeline blocked on
  Componentize-JS GA (target Phase 7 evaluation).
- **Q3: warm-start caching** — Extism caches at module-instance
  level; native re-spawns each invocation. Should host cache native
  plugin process? **Decision: NO** — plugin is invoke-and-die; warm
  cache adds attack surface (state bleed across invocations / SID
  reuse). Reconsider if cold-start > 50ms becomes UX issue per
  Design.md §1.7 latency budget.

## Phase 6 W9-W10 工作清单

- `packages/plugin-runtime-wasm/` — WASM host based on Extism + Wasmtime
- `packages/plugin-runtime-native/` — per-OS native spawn wrappers
  (Linux reuse ADR-0012 bwrap; macOS = sandbox-exec SBPL; Win =
  AppContainer)
- Plugin manifest schema 扩展 `runtime` field（Q1 决议落定）
- ADR-0019 promote Proposed → Accepted（dogfood gate G7：3 OS 同一
  plugin install + sandbox spawn 成功 + secret-reject 测通）
- 实测数据替换 trade-off-matrix.md reference 列；本 decision.md
  Trade-off actuals 表对应行更新

## Failure mode 评估

Spike-3 plan §"Failure mode" 描述：三选项都不满足"跨平台 + npm 兼容 +
沙箱可信" → 回退到 "plugin 暂时只 Linux" + desktop 走
ssh-into-server-sandbox 兜底。

**实测结果：未命中。** Hybrid model 满足全部三项：

- 跨平台 → WASM Extism 路径覆盖
- npm 兼容 → native 路径覆盖（任何 OS）
- 沙箱可信 → 4 选项各有可审计 capability 模型

→ 继续推进 ADR-0019 起草。
