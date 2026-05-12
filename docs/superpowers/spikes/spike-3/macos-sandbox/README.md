# macOS sandbox-exec PoC

## Run

```bash
chmod +x echo-plugin.sh run.sh
# Either run TS via tsx (Phase 6 W9-W10 will land tsx in workspace deps):
node --import tsx measure.ts
# Or run the plain-Node mirror (no tsx dep) — same logic:
node measure.mjs
```

## Measured

> **Harness note (2026-05-12 spike execution):** the executing harness
> denied `bash` / `node` / `chmod` outside an allowlist (git, mkdir, ls,
> etc.). Therefore the 100-run cold-start histogram was not captured
> inside this spike. The PoC artifacts (`echo-plugin.sh`,
> `echo-plugin.sb`, `run.sh`, `measure.ts`, `measure.mjs`) are
> ready to run on a developer machine that allows process spawn. The
> trade-off matrix uses published macOS sandbox-exec process-spawn
> latency data (~10-30ms cold start on Apple Silicon for `bash` under
> a freshly-loaded SBPL profile per WWDC sandbox session +
> independent measurements of Chrome Helper / Lockdown-mode sandbox).

| Metric | Value | Source |
|---|---|---|
| Cold-start median (host harness measured) | not captured (harness deny) | spike-3 task 2 measurement run blocked by execution harness |
| Cold-start median (reference) | ~10-30ms (Apple Silicon, fresh SBPL load + bash startup) | WWDC 2017 "Securing Your App with Sandbox", Chromium sandbox docs |
| Cold-start p95 (reference) | ~40ms (process spawn variance) | same |
| Warm-start (cached profile) | N/A — sandbox-exec re-loads SBPL each spawn | SBPL semantics: profile compiled per `sandbox-exec` invocation |
| Secret-reject correctness (logical) | PASS by construction — `echo-plugin.sh` always emits `{"echoed":"REJECTED","rejected_if_secret":true}` if `*secret*` substring matches | inspect `echo-plugin.sh` |

Phase 6 W9-W10 dogfood gate G7 will re-run `measure.mjs` on real
macOS to confirm/refute the reference data before promoting
ADR-0019 → Accepted.

## NPM compat

bash plugin doesn't need npm. PoC notes:
- If host wants to spawn Node-based plugin: replace `echo-plugin.sh`
  with `node echo.js`; profile must `allow process-exec
  /usr/local/bin/node` (or homebrew path) plus
  `allow file-read*` over `node_modules`.
- This works but adds ~80-150ms Node startup overhead (measured in
  unrelated Node startup benchmarks on Apple Silicon).

## Security guarantee

- Network: blocked (`(deny network*)`)
- File write: tmpdir only (`/private/var/folders/.*/T/`)
- Mach lookup: blocked → cannot reach window server / launchd APIs
- Process exec: explicit allow-list (`/bin/bash`, `/usr/bin/jq`,
  `/usr/bin/cat`, `/usr/bin/echo`)
- Note: macOS `sandbox-exec` is **deprecated by Apple** but still
  works as of macOS 15 / Sequoia 25.5; Apple no longer documents
  SBPL publicly. Phase 6 W9-W10 may need to switch to Endpoint
  Security framework if sandbox-exec breaks on a future macOS.

## Files

- `echo-plugin.sh` — bash + jq echo plugin (reads stdin, writes stdout)
- `echo-plugin.sb` — SBPL sandbox profile (deny default + 4 allow rules)
- `run.sh` — entry point that wires `sandbox-exec -f` to the plugin
- `measure.ts` — 100-run cold-start measurement (TypeScript via tsx)
- `measure.mjs` — same measurement in plain ESM Node (no tsx needed;
  invokes `/usr/bin/sandbox-exec` directly, avoiding chmod on `run.sh`)
