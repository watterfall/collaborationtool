# Spike report: Typst.ts WASM 浏览器编译可行性

**Status**: Phase 2.5 closeout report (desk-research only — no real bundle test in this session)
**Date**: 2026-05-09
**Author**: claude/review-project-goals-TpFuH
**Trigger**: phase-2-plan-stub §7.1 "Typst.ts WASM bundle ≤5 MB / 编译 ≤1s 10 页双语 / 与服务端 typst CLI 输出一致"

---

## 1. Why this spike

Phase 1 D12 chose server-side `typst` CLI for PDF compile. That works today but:
- Requires the `typst` binary on every host that wants compile output
- Round-trip to server adds 100-300ms even for a 5-block doc
- Air-gapped / offline editing can't compile

Typst maintains a WASM build (`@myriaddreamin/typst-ts`) that runs in browser. Phase 2 stub W2 line:
> bundle ≤5 MB / 编译 ≤1s 10 页双语 / 与服务端 typst CLI 输出一致 → 不通过则维持 Phase 1 D12 服务端 CLI；Phase 3 重测

The spike is "validate switchability, not commit to switch."

---

## 2. Findings (desk research)

| Question | Finding |
|---|---|
| Bundle size goal ≤5 MB | `@myriaddreamin/typst.ts` core wasm is ~3-4 MB compressed (per [GitHub releases](https://github.com/Myriad-Dreamin/typst.ts) snapshots circa 2024-2025). Default fonts add another 5-10 MB. With our bilingual zh-Hans + en CJK font subset, bundle realistic ≥ 8 MB. **Likely fails the 5 MB target unless we ship lazy-loaded font subsets.** |
| 10-page bilingual compile ≤1s | Typst.ts compile speed approximately matches CLI for short docs (<20 pages). For 10 pages with mixed CJK + English we'd expect 200-800ms in cold cache, 100-300ms warm. **Likely passes**, with the caveat that font-subset cold load adds 1-2 s on first compile. |
| Output parity with server CLI | Typst.ts wraps the same Rust core. Output should be byte-identical to CLI when font set + version match. Phase 2.5 must verify with a fixture suite. |
| API stability | Typst.ts is at major version 0.x (pre-1.0); breaking changes possible. Phase 2 ADR-0003 still flags `Typst 0.x → 1.0` as watch item. |
| Browser compatibility | Modern Chrome / Firefox / Safari since 2023 (WASM SIMD + threads). Older devices (Safari <16, IE) unsupported — acceptable since editor is desktop-only Phase 2. |

---

## 3. Decision

**Defer browser-side compilation to Phase 3 (or later).**

Reasons:
1. **Bundle budget conflict with bilingual fonts**: 5 MB target not achievable when CJK fonts must ship; lazy-load adds complexity (race conditions, fallback to server)
2. **Phase 2.5 has bigger fish**: real molab iframe, real reviewer agent, dogfood the editor — adding a WASM compile path before any user has compiled a real doc is premature
3. **Server CLI works today**: Phase 1 D12 path is fine for current scale; bundle size + compile speed only matter at >100 concurrent users which is Phase 4 territory
4. **Switch is reversible**: Typst.ts can be added in Phase 3 as a feature flag; all current code paths assume PM JSON → typst source string → bytes, which doesn't care whether the CLI or WASM does the byte conversion

**Re-evaluation triggers** (per ADR-0003 review log style):
- Typst.ts 1.0 release (API stability guaranteed)
- User-reported "I can't install typst on my OS" complaints reach 20% of dogfood users
- Air-gapped / offline-first becomes a Phase 4 priority
- A specific case where round-trip latency hurts (e.g. live preview with sub-100ms requirement)

---

## 4. Open questions (resolved at re-evaluation)

- Lazy font subset loading: which subset granularity (per-script? per-language?)
- Service worker caching: which cache lifetime?
- Font licensing: shipping CJK fonts in browser bundle has license implications (most free CJK fonts are OFL but server-side fetch is one allowed-redistribution path that browser-bundle isn't always)

---

## 5. Action items

- [x] Document spike findings (this file)
- [ ] Phase 3 W8 spatial canvas spike co-bundle: re-evaluate Typst.ts at the same time (canvas needs WASM-ish features anyway)
- [ ] Phase 4 (or trigger): bench real bundle on `myriaddreamin/typst.ts` v1.0+ when released
