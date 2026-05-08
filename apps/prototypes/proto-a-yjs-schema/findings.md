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
| Workspace install | ✅ pass | 153 packages, 5.9s |
| TypeScript typecheck (schema + proto-a) | ✅ pass | Strict mode, no errors |
| Yjs CRDT convergence stress test | ✅ pass | 5 clients × 50 ops = 250 ops, all clients byte-identical, 0 warnings |
| Manual dual-tab test 1: concurrent atom inserts | ⬜ pending | run in browser |
| Manual dual-tab test 2: concurrent paragraph + equation edits | ⬜ pending | run in browser |
| Manual dual-tab test 3: delete + annotation collision | ⬜ pending | run in browser |
| ADR-0001 → Accepted | ⬜ blocked | gated on the 3 manual tests passing without warnings |

## How to run the manual tests

You need **two terminals** for the local sync setup (D3 follow-up P1 — public
webrtc signalling was dropped):

```bash
# from repo root
pnpm install            # if not done already

# terminal 1 — local y-websocket relay (no persistence, just a relay)
pnpm proto-a:sync       # listens on ws://localhost:1234

# terminal 2 — Vite dev server
pnpm proto-a:dev        # default http://localhost:5173
```

Open the URL **in two browser tabs** (or one regular tab + one private/incognito tab — same origin, different IndexedDB / awareness clients). Both tabs join the same room (`proto-a-yjs-schema-default-room`); for cross-browser tests they sync through the local `ws://localhost:1234` relay, and same-origin tabs in the same browser also fall back to BroadcastChannel automatically.

The status line shows:
- **Indexeddb synced**: did local persistence catch up
- **WS status**: `connecting` / `connected` / `disconnected` against the relay
- **Peers**: count from awareness (you should see 2 once both tabs are in)
- **y-prosemirror warnings observed**: count of console.warn calls mentioning "prosemirror" — should stay at **0**

The page footer lists three concrete test cases with expected outcomes. Walk through each one, watching:
- ✅ both tabs converge to the same content
- ✅ atom nodes (citation-ref / equation / dataset-ref / etc.) appear once per insertion (no duplicates from concurrent inserts)
- ✅ the **y-prosemirror warnings observed** counter stays 0
- ✅ no `RangeError` / `Invalid content` / `schema-recovery` messages in the DevTools console

If any of those fails, **note**:
- the exact step sequence (tab 1 did X, tab 2 did Y, in that order with N ms delay)
- the console output (full message + stack)
- the resulting `Y.Doc body fragment` JSON dump shown on the page

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

## Manual test result template

After running, fill in below and commit this file again.

### Test 1: concurrent atom inserts

- **Steps**: …
- **Outcome**: pass / fail
- **Notes**: …

### Test 2: concurrent paragraph + equation edits

- **Steps**: …
- **Outcome**: pass / fail
- **Notes**: …

### Test 3: delete + annotation collision

- **Steps**: …
- **Outcome**: pass / fail
- **Notes**: …

### Browser / version used

- …

### Final verdict on H1

- ☐ All 3 manual tests pass with 0 warnings → ADR-0001 transitions Proposed → **Accepted**
- ☐ Some test exposed a y-prosemirror edge case → record below; decide on workaround vs. ADR amendment
- ☐ Showstopper bug → consider fallback editor (BlockNote / Slate-Yjs) per ADR-0001 §4 `Neutral / Need watching`
