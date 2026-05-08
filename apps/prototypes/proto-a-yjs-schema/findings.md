# proto-a · findings

> Phase 0 D3 prototype: y-prosemirror + heterogeneous schema + dual-tab manual + stress test.
> Verifies hypothesis **H1**: ProseMirror schema with atom node references can survive concurrent CRDT merge.

## Status summary

| Check | Status | Notes |
|---|---|---|
| Workspace install | ✅ pass | 153 packages, 5.9s |
| TypeScript typecheck (schema + proto-a) | ✅ pass | Strict mode, no errors |
| Yjs CRDT convergence stress test | ✅ pass | 5 clients × 50 ops = 250 ops, all clients byte-identical, 0 warnings |
| Manual single-tab smoke (browser load + atom inserts) | ✅ pass | citation-ref / inline-eq / footnote-ref / computational-cell render correctly; status line shows `y-prosemirror warnings observed: 0` |
| Manual dual-tab test 1: concurrent atom inserts | ⏸ blocked | requires cross-tab sync — see Issues observed §1.1 |
| Manual dual-tab test 2: concurrent paragraph + equation edits | ⏸ blocked | same — public webrtc signalling unreachable in user network |
| Manual dual-tab test 3: delete + annotation collision | ⏸ blocked | same |
| ADR-0001 → Accepted | 🔶 partially evidenced | schema-recovery part proven 0-warning in single-tab; cross-tab tests blocked on sync issue |

## How to run the manual tests

```bash
# from repo root
pnpm install            # if not done already
pnpm proto-a:dev        # starts Vite dev server, default http://localhost:5173
```

Open the URL **in two browser tabs** (or one regular tab + one private/incognito tab — same origin, different IndexedDB / awareness clients). Both tabs join the same y-webrtc room (`proto-a-yjs-schema-default-room`) via the public Yjs signalling servers.

The status line shows:
- **Indexeddb synced**: did local persistence catch up
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
4. **`y-webrtc` signalling failure**. If the public signalling servers in `setup-sync.ts` are unreachable, peers won't discover each other. Each tab still works independently against IndexedDB, just no cross-tab sync. Look for `Peers: 1` after both tabs are open.

## Manual test result template

After running, fill in below and commit this file again.

### 2026-05-08 dual-tab manual test (partial)

**Single-tab smoke**: ✅ pass
- editor loads, all 9 atom NodeView types insert and render
- Y.Doc body fragment live dump shows correct atom-node serialisation (blockId / citationId / latex / cellId / kernel attrs)
- status line: `Indexeddb synced: yes · Peers (incl. self): 1 · y-prosemirror warnings observed: 0`
- **most important evidence: warnings counter stays 0 across multiple atom inserts and edits — y-prosemirror schema recovery did not fire on the heterogeneous schema**

**Cross-tab tests 1 / 2 / 3**: ⏸ blocked
- Browser console showed repeated `WebSocket connection to 'wss://signaling.yjs.dev/' failed` (and the two heroku fallbacks). Public y-webrtc signalling is unreachable in the user's network.
- `Peers (incl. self): 1` — second tab cannot discover the first via webrtc.
- Also observed dev-only StrictMode warning `A Yjs Doc connected to room "..." already exists!` and a TipTap warning about `extension-history` conflict.
- **All four issues are recorded in `plan0/next-session-tasks.md` §1**; they will be fixed in the next session before re-running the dual-tab cases.

### Browser / version used
- Chrome (recent, with Grammarly + KaTeX-related extensions)
- macOS

### Final verdict on H1 (interim)

- ✅ **Single-tab schema recovery part of H1: validated** — 0 warnings across the heterogeneous PM schema with atom nodes and inline marks under live editing
- ⏸ Cross-tab concurrent merge: **pending** — blocked on sync wiring (next-session-tasks.md §1.1)
- → ADR-0001 stays at **Proposed**; cannot transition to Accepted until cross-tab tests are unblocked and run.

## Issues observed during dual-tab manual test (2026-05-08)

These are recorded here verbatim and indexed in `plan0/next-session-tasks.md` §1 for the next session to pick up. **Not fixed in this session per user direction.**

1. **`[P1]` Public y-webrtc signalling unreachable** → cross-tab sync impossible. Need a **local y-websocket server** wired into `setup-sync.ts` (matches Phase 1 ADR-0003 §2.3 y-sweet path).
2. **`[P1]` React StrictMode dev double-render** triggers `A Yjs Doc connected to room "..." already exists!` from y-webrtc's module-level rooms map. Move `setupSync` into `useEffect` with `bundle.destroy()` cleanup.
3. **`[P2]` TipTap warning**: `@tiptap/extension-collaboration comes with its own history support and is not compatible with @tiptap/extension-history`. Remove `History` from `extensions/all.ts`.
4. **`[P3]` `computationalCell.sourceCode` literal `\n` in Y.Xml attr serialisation** (cosmetic; rendering OK because `textContent` doesn't process escapes). Consider migrating ComputationalCell from atom to PM-content node in Phase 1.

The ChromeExtension-related errors (`Could not establish connection. Receiving end does not exist`) come from user's installed extensions (Grammarly etc.) and are not application bugs.
