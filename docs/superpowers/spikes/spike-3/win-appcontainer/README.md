# Windows AppContainer PoC

## Status: STUB

Real implementation requires a Windows host. Spike-3 accepts the stub
because the **selection decision** can be made from known trade-offs:

| Aspect | Known from Microsoft docs |
|---|---|
| Security model | Mandatory Integrity Level (Low / AppContainer) + capability SIDs |
| Cold-start | ~5-15ms (process creation + SID lookup; benchmarks from Microsoft Docs "Implement an AppContainer" + Chromium sandbox docs) |
| Filesystem isolation | Per-AppContainer profile dir (`%LOCALAPPDATA%\Packages\<sid>\`); no parent fs access without capability |
| Network | Requires `internetClient` capability SID; blocked by default |
| NPM compat | Node.exe can run inside AppContainer with `lpacAppExperience` profile; ~ same overhead as macOS sandbox-exec; documented in microsoft/node-pal samples |
| Tooling friction | Need to build .exe + capability manifest; not as ergonomic as macOS .sb profile |
| Official support | First-class — Microsoft uses AppContainer for UWP, Edge sandbox, Defender Application Guard |

## Decision input

This PoC's known properties + Microsoft docs are sufficient for the
Spike-3 selection decision (see `../decision.md`). Real implementation
on a Windows runner is deferred to Phase 6 W9-W10.

## Run on Windows (manual, CI-only)

```powershell
cargo build --release
.\target\release\win-appcontainer-poc.exe
```

On non-Windows hosts:

```bash
cargo run --release   # exits 1 with "This PoC only runs on Windows" message
```

## Files

- `Cargo.toml` — Rust crate skeleton with `windows` 0.58 crate (gated `cfg(windows)`)
- `src/main.rs` — Stub `main()` with no-op on non-Windows + comment
  trail referencing the Phase 6 W9-W10 real-impl plan
  (`CreateAppContainerProfile` / `CreateProcess` with capability SIDs
  / `CreatePipe` stdin-stdout)
