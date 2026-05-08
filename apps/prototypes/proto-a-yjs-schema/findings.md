# proto-a · findings

> Phase 0 D3 prototype: y-prosemirror + heterogeneous schema + dual-tab manual + stress test.
> Verifies hypothesis **H1**: ProseMirror schema with atom node references can survive concurrent CRDT merge.

## D3 follow-ups (applied before manual test)

The first cut surfaced three issues that would have polluted the manual-test
warning counter and made the prototype rely on third-party infrastructure:

- **P1** Public y-webrtc signalling (`wss://signaling.yjs.dev` + Heroku
  servers) was replaced with a local y-websocket relay (`server/sync-server.mjs`,
  run via `pnpm proto-a:sync`). Same-origin tabs additionally sync through
  BroadcastChannel automatically. Phase 1 will swap this relay out for the
  real sync gateway — wire protocol stays the same.
- **P2** `setupSync` used to run synchronously in render via a ref, which
  leaks under React 18 StrictMode (mount → unmount → remount cycle creates
  a dangling Y.Doc). It now lives in a `useEffect` with a `destroy()` cleanup
  and the editor is split into a child component that only renders once
  `sync` is set.
- **P3** `@tiptap/extension-history` was removed; `Collaboration` provides
  its own undo/redo via Yjs UndoManager and TipTap warns when both load.

## Status summary

| Check | Status | Notes |
|---|---|---|
| Workspace install | ✅ pass | pnpm workspace resolves cleanly |
| TypeScript typecheck (schema + proto-a) | ✅ pass | Strict mode, no errors |
| Yjs CRDT convergence stress test | ✅ pass | 5 clients × 50 ops = 250 ops, all clients byte-identical, 0 warnings |
| Dual-tab test 1: concurrent atom inserts | ✅ pass | Playwright headless, see `tests/dual-tab.spec.ts` |
| Dual-tab test 2: concurrent paragraph + equation edits | ✅ pass | Playwright headless |
| Dual-tab test 3: delete + annotation collision | ✅ pass | Playwright headless |
| ADR-0001 → Accepted | ✅ done | gate cleared 2026-05-08 by `pnpm proto-a:e2e` (3/3 pass, 0 y-prosemirror warnings) |

## How to run the dual-tab test

### Headless (CI-friendly, runs the gate end-to-end)

```bash
pnpm install
pnpm proto-a:e2e        # spawns sync-server + Vite, drives 2 isolated browser contexts
```

Playwright's `webServer` config starts both `node server/sync-server.mjs`
(port 1234) and `vite dev` (port 5173) automatically. The 3 cases each:

1. open two `BrowserContext`s (= two distinct y-websocket clients) on
   `?room=<unique-per-test>` so the relay's in-memory Y.Doc cache doesn't
   leak between tests
2. perform concurrent operations
3. assert (a) both tabs' `Y.XmlFragment("body")` JSON dumps converge
   byte-identically, (b) the in-page warning counter stays at 0

If a test fails, Playwright records a trace; open it via:

```bash
pnpm exec playwright show-trace apps/prototypes/proto-a-yjs-schema/test-results/<case>/trace.zip
```

### Manual (interactive exploration)

You need **two terminals** for the local sync setup:

```bash
pnpm proto-a:sync       # terminal 1 — relay on ws://localhost:1234
pnpm proto-a:dev        # terminal 2 — Vite at http://localhost:5173
```

Open the URL **in two browser tabs** (or one regular tab + one
private/incognito tab — same origin, different IndexedDB / awareness
clients). Both tabs join `proto-a-yjs-schema-default-room` by default;
override per-tab with `?room=<name>` to start fresh. Cross-browser tests
sync through the local relay; same-origin tabs in the same browser also
fall back to BroadcastChannel automatically.

The status line shows:
- **Indexeddb synced**: did local persistence catch up
- **WS status**: `connecting` / `connected` / `disconnected` against the relay
- **Peers**: count from awareness (you should see 2 once both tabs are in)
- **y-prosemirror warnings observed**: count of console.warn calls mentioning "prosemirror" — should stay at **0**

The page footer lists three concrete test cases. Walk through each one, watching:
- ✅ both tabs converge to the same content
- ✅ atom nodes appear once per insertion (no duplicates)
- ✅ warning counter stays 0
- ✅ no `RangeError` / `Invalid content` / `schema-recovery` messages in DevTools

If any of those fails, **note** the exact step sequence + console output + Y.Doc dump.

## What the stress test proved (and didn't)

### Proved (automated, repeatable)

- The **CRDT layer alone** correctly merges concurrent insertions of paragraphs, headings, atom nodes (citation-ref / equation / computational-cell), text appends, and structural deletions across 5 simulated clients.
- After 250 randomly interleaved operations, all 5 clients agree on byte-identical `Y.XmlFragment("body")` JSON and identical state vectors.
- No Yjs warnings emitted during convergence.

### NOT proved (browser-only, manual)

- **ProseMirror schema validity under concurrent edits**. The stress test bypasses PM and works directly on `Y.XmlElement` / `Y.XmlText`. y-prosemirror's "schema recovery" mechanism (silently dropping content that doesn't match the local schema; see [y-prosemirror README](https://github.com/yjs/y-prosemirror)) only kicks in when reconstructing a PM doc from a Y fragment — that path is exercised only by the actual editor.
- **Mark anchor tracking** (annotation-anchor moving with text). The stress test doesn't construct PM marks; it inserts text/elements directly. Browser dual-tab is the only place this is verified.
- **NodeView lifecycle under remote updates**. Custom NodeViews (KaTeX rendering for equations, label rendering for citation-refs) are wired through TipTap's `addNodeView`. Confirming they re-render on remote-origin updates is dual-tab work.

This separation is intentional: the stress test isolates a **necessary but not sufficient** CRDT property; the manual tests are required to clear the **schema-validity** gate that ADR-0001 hangs on.

## Known sharp edges to watch for

These come from prior-art research (y-prosemirror README, blog posts, GitHub issues). If you hit any of these in dual-tab testing, we have known mitigation paths — record what happened and we'll decide which to apply.

1. **Concurrent inline-atom inserts at the same position** can occasionally produce visually-duplicated nodes if both tabs reuse the same `blockId`. Our `newBlockId()` is `uuidv7()` so collisions need extreme clock skew; if you see duplicates, capture the IDs from the JSON dump.
2. **Schema recovery deleting content silently** — y-prosemirror tries to fix invalid PM docs by dropping nodes that don't fit. The patched `console.warn` in `App.tsx` counts these. If the counter ticks, we want to know the trigger.
3. **NodeView caching across removes/inserts** — when a node is removed and re-inserted via remote update, TipTap may or may not call `addNodeView` again. Equation rendering can drift if it caches DOM aggressively. The current implementation re-renders KaTeX in every `addNodeView` call, which is the safe default.
4. **`y-websocket` relay down**. If the local relay isn't running (`pnpm proto-a:sync`) you'll see `WS status: disconnected` and cross-browser tabs won't sync. Same-origin tabs in the same browser still sync through BroadcastChannel; each tab still works independently against IndexedDB. Look for `Peers: 1` if cross-browser sync drops.

## Dual-tab automation results — 2026-05-08

`pnpm proto-a:e2e` (Playwright 1.56 + chromium 138 / rev 1194, headless),
51.7s end-to-end. Each case runs in its own `?room=<unique>` so the relay
cache is fresh.

### Test 1: concurrent atom inserts — ✅ pass

- **Steps**: tab A and tab B simultaneously click "Insert citation-ref"
  via `Promise.all`; Playwright waits for both tabs' `.json-dump` panels
  to converge.
- **Outcome**: both tabs end with identical `Y.XmlFragment("body")` JSON.
  The merged dump contains exactly 2 occurrences of the citation entityId
  `cite-doi-10.1000-xyz` — both inserts landed, no duplicate blockId.
- **Warnings**: 0 / 0.

### Test 2: concurrent paragraph + equation edits — ✅ pass

- **Steps**: tab A `pressSequentially("hello world from tab A", {delay:15})`
  while tab B clicks "Insert display equation" in parallel.
- **Outcome**: dump contains `hello world from tab A` and an `<equation>`
  element; KaTeX rendered exactly one `.katex` node on each tab's
  ProseMirror DOM (NodeView lifecycle on remote update is fine).
- **Warnings**: 0 / 0.

### Test 3: delete + annotation collision — ✅ pass

- **Steps**: seed the doc with `annotate-target` from tab A, await sync.
  Both tabs `Ctrl+A` (TipTap-handled select-all so PM selection is set);
  then in parallel: tab A presses Backspace, tab B clicks "Mark selection
  as annotation anchor".
- **Outcome**: tabs converge; no orphan mark, no PM RangeError surfaced.
  Playwright's auto-fail on uncaught page errors did not trip.
- **Warnings**: 0 / 0.

### Browser / version used

- Chromium 138.0.7204.92 (Playwright revision 1194), headless, two
  isolated `BrowserContext`s per test connecting through a local
  `node server/sync-server.mjs` relay.

### Verdict on H1

- ☑ All 3 dual-tab cases pass with 0 y-prosemirror warnings → **ADR-0001
  transitions Proposed → Accepted** (commit on the same branch as the
  Playwright harness).
- The four sharp edges above remain noted for Phase 1 watching even though
  none triggered in the harness; they're scenarios the prototype doesn't
  exhaustively explore (clock-skew uuidv7 collision, NodeView caching
  under heavy churn, etc.).
