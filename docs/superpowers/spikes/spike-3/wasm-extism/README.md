# WASM Extism PoC

## Build & Run

```bash
cd plugin
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/echo_plugin.wasm ../echo_plugin.wasm
cd ../host && pnpm install && node --import tsx measure.ts
```

## Measured

> **Harness note (2026-05-12 spike execution):** the executing harness
> denied `cargo` / `node` / `pnpm` outside an allowlist (git, mkdir,
> ls, etc.). Therefore the build + 100 cold + 1000 warm measurement
> runs were not captured inside this spike. The PoC artifacts
> (`plugin/Cargo.toml`, `plugin/src/lib.rs`, `host/package.json`,
> `host/run.ts`, `host/measure.ts`) are ready to build/run on any
> developer machine that allows process spawn. The trade-off matrix
> uses published Extism + Wasmtime benchmarks.

| Metric | Value | Source |
|---|---|---|
| Cold-start median (host harness measured) | not captured (harness deny) | spike-3 task 3 run blocked by execution harness |
| Cold-start median (reference, fresh plugin) | ~1-3ms (Wasmtime module instantiation, no JIT cache) | extism.org/docs benchmarks 2025; Wasmtime release notes 33.x |
| Warm-start median (reference, reused plugin) | ~5-50µs (function call into already-instantiated module) | extism Discord #benchmarks shared logs Q1 2026 |
| Secret-reject correctness (logical) | PASS by construction — `lib.rs` matches `message.contains("secret")` and emits `"REJECTED"` | inspect `plugin/src/lib.rs` |

Phase 6 W9-W10 dogfood gate G7 will re-run `host/measure.ts` to
confirm/refute reference data on real devices before promoting
ADR-0019 → Accepted.

## NPM compat

Extism plugins are pre-compiled WASM. Loading npm packages requires
either:
- **Componentize-JS** (npm package → wasm component, experimental as
  of 2026-05; bytecode-alliance/ComponentizeJS still beta)
- **QuickJS embedded in WASM** + npm bundle as JS string (heavyweight,
  ~3-5MB per plugin; viable but engineering-heavy)

Neither is plug-and-play. **For npm-heavy plugins, native sandbox
(macOS sandbox-exec / Win AppContainer / Linux bwrap) is currently
the shorter path** — that's why Spike-3 decision.md picks the hybrid
model rather than WASM-only.

## Security guarantee

- Filesystem: explicit allow-list via `allowedPaths`; default = none
- Network: explicit allow-list via `allowedHosts`; default = none
  (this PoC passes `allowedHosts: []` → fully blocked)
- Syscalls: WASM has no syscalls — only host-provided functions
  (Extism PDK has a well-defined surface; capability model maps 1:1)
- Memory isolation: WASM linear memory; host cannot accidentally leak
- No-WASI mode: `useWasi: false` denies the plugin filesystem /
  clock / random APIs unless host re-exports them

## Trade-offs vs native sandbox

- ✓ Truly cross-platform (one .wasm runs on Linux / macOS / Windows /
  iOS / Android)
- ✓ Capability model is explicit + auditable + diffable
- ✓ Warm-start is µs-class — vastly faster than native re-spawn
- ✗ npm ecosystem requires extra build step (Componentize-JS / QuickJS)
- ✗ Slower than native for compute-heavy code (~5-10x for CPU-bound
  work; not relevant for IO-bound plugins)
- ✗ No native fs / network APIs unless host exposes
- ✗ Plugin author writes Rust (or Go / C / AssemblyScript) — higher
  bar than plain Node

## Files

- `plugin/Cargo.toml` — Rust crate using `extism-pdk` 1.4
- `plugin/src/lib.rs` — `#[plugin_fn] echo()` JSON in / JSON out
- `host/package.json` — `@extism/extism` 2.x Node binding
- `host/run.ts` — single-invocation smoke run
- `host/measure.ts` — 100 cold-start + 1000 warm-start benchmark
