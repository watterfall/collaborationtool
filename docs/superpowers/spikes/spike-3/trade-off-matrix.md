# Spike-3 Trade-off Matrix

> 4 选项 × 多维度比较。Linux bwrap baseline 数据来自 Phase 4 W1 ADR-0012
> 落地测试（不重复 PoC）。macOS / WASM "host harness measured" 列 = 本次
> spike harness 拒绝 process spawn → "blocked"；"reference data" 列 =
> 已发布数据来源。Phase 6 W9-W10 dogfood gate G7 跑 measure.mjs /
> host/measure.ts 取实测，promote ADR-0019 → Accepted 前更新本表。

| 维度 | Linux bwrap | macOS sandbox-exec | Windows AppContainer | WASM Extism |
|---|---|---|---|---|
| **平台覆盖** | Linux only | macOS only (DEPRECATED by Apple) | Windows only | Linux + macOS + Win + iOS + Android |
| **Cold-start (median, reference)** | ~3-8ms (ADR-0012 measured Phase 4 W1) | ~10-30ms (WWDC 2017 sandbox session + Chromium sandbox docs) | ~5-15ms (Microsoft Docs + Chromium sandbox docs) | ~1-3ms (extism.org benchmarks 2025 + Wasmtime 33.x release notes) |
| **Cold-start (host harness measured)** | n/a (already shipped) | blocked (harness deny `bash` / `node` spawn) | blocked (non-Windows host) | blocked (harness deny `cargo` / `node` spawn) |
| **Warm-start (median, reference)** | N/A (fresh fork每次) | N/A | N/A | ~5-50µs (extism Discord #benchmarks Q1 2026) |
| **NPM ecosystem** | ✅ native Node 完全可用（ADR-0012 W1 dogfood） | ✅ allow node binary 即可（+80-150ms Node startup） | ✅ 同 macOS pattern（lpacAppExperience 跑 node.exe） | ⚠️ 需 Componentize-JS / QuickJS bridge — neither plug-and-play in 2026-05 |
| **Security model** | bwrap unshare + seccomp + capabilities | SBPL deny default + allow-list | AppContainer SID + capability SIDs (internetClient etc.) | WASM linear memory + explicit host imports + allowedHosts allow-list |
| **Implementation cost (人周, Phase 6 W9-W10)** | ✅ 已落（Phase 4 W1） | 2-3 周 | 3-4 周 | 4-6 周（含 Componentize-JS pipeline 评估） |
| **Apple/MS 官方支持** | / | ❌ DEPRECATED（仍 work as of macOS 15 / Sequoia 25.5） | ✅ first-class（UWP / Edge sandbox / Defender） | ⚠️ 第三方（Extism org / Wasmtime upstream / bytecode-alliance） |
| **跨平台一致性** | low（only Linux） | low | low | ✅ same .wasm 全平台跑 |
| **Plugin author 学习曲线** | bash / yaml 即可 | SBPL DSL，少有人会 | manifest XML，无人会 | Rust → wasm，门槛高（Componentize-JS GA 后降到 TS / JS 水平） |
| **运行时大小 / dependency** | bwrap binary ~500KB（OS pkg） | 0（OS built-in） | 0（OS built-in） | Extism runtime ~5-10MB / Wasmtime ~15MB（embed in client） |
| **Capability model 可审计性** | ✅ unshare + seccomp policy 文本 | ✅ SBPL profile 文本 | ⚠️ manifest XML + 运行期 SID merge — 较复杂 | ✅ allowedHosts / allowedPaths 1:1 manifest 字段 |
| **CRDT / IO 通道** | stdio + socketpair | stdio (sandbox-exec preserves stdin/stdout/stderr) | named pipe / stdio via CreatePipe | host-callback functions (Extism exports + host funcs) |

## 选项总结

- **Linux bwrap** = production-proven baseline（不需要 spike）
- **macOS sandbox-exec** = works but Apple deprecation 风险；medium impl cost
- **Windows AppContainer** = first-class MS 支持；medium-high impl cost
- **WASM Extism** = cross-platform + 快 warm-start + 可审计；但 npm 友好度待 Componentize-JS GA
