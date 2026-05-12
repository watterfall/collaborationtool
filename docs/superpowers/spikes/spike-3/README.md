# Spike-3: Cross-Platform Plugin Runtime Selection

3 PoCs to evaluate cross-platform plugin sandbox:

| Option | Where | Stage |
|---|---|---|
| macOS sandbox-exec | `macos-sandbox/` | required on macOS host |
| Windows AppContainer | `win-appcontainer/` | required (or stub + decision criteria) |
| WASM Extism | `wasm-extism/` | required on any host |
| Linux bwrap (baseline) | `plan0/adr/0012-plugin-sandbox.md` | already shipped; pull metrics from Phase 4 W1 |

See `echo-plugin-spec.md` for the shared contract every PoC implements,
`trade-off-matrix.md` for the 4-dim comparison, and `decision.md` for the
final recommendation feeding ADR-0019 draft.
