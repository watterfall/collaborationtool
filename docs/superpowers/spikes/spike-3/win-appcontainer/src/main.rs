// Spike-3 Windows AppContainer PoC.
// On non-Windows hosts this compiles to a stub binary that exits 1
// with a documented message. Real run is CI-only on a Windows runner.

#[cfg(not(windows))]
fn main() {
    eprintln!("This PoC only runs on Windows. See README.md.");
    std::process::exit(1);
}

#[cfg(windows)]
fn main() {
    use windows::core::*;
    // Imports placeholder — real impl in Phase 6 W9-W10 uses
    // Win32::Security::AppContainer::* to:
    //   1. CreateAppContainerProfile (or DeriveAppContainerSidFromAppContainerName)
    //   2. CreateProcess with extended startup info containing
    //      PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES → AppContainer SID +
    //      capability SIDs (e.g. internetClient if needed)
    //   3. Pipe stdin/stdout via CreatePipe + ProcessStartupInfo
    //   4. Read JSON response, validate {echoed, rejected_if_secret}
    // Reference: Microsoft Docs "Implement an AppContainer" + Chromium
    // sandbox/src/win/ AppContainer integration.
    let _ = w!("S-1-15-2-1-1-1-1-1-1-1-1"); // dummy AppContainer SID literal
    println!("AppContainer PoC stub — Phase 6 W9-W10 真实施");
}
