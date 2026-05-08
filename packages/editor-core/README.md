# @collaborationtool/editor-core

Phase 1 D10 — production extraction of the proto-a editor surface.
Exports:

- **TipTap extensions** — 9 PM extensions covering the ADR-0001 §2.3.2
  block taxonomy (paragraph / heading / equation / inline-equation /
  citation-ref / dataset-ref / computational-cell / annotation-anchor /
  figure / footnote-ref).
- **`paperSchema()`** — headless ProseMirror Schema, used by tests +
  server-side renderers (`packages/render-myst`, `packages/render-typst`
  in D12).
- **`Editor` React component** — TipTap + `Collaboration` extension +
  sync-gateway transport, ready to drop into apps/web's
  `/editor/[docId]` route.
- **`buildCommitPayload` / `deserializeSteps`** — commit-boundary
  serializer for D14 approval flow. Round-trip verified: PM steps + Yjs
  update + state vector all preserve byte fidelity through PG bytea.
- **`SyncGatewayTransport`** — Y.Doc ↔ apps/sync-gateway WebSocket
  bridge over the D8 wire format. Handles writer / proposer / reader
  modes; routes proposer writes to draft frames; dedupes server-echoed
  drafts.

## Headless usage (server / tests)

```ts
import { paperSchema, buildCommitPayload } from '@collaborationtool/editor-core';

const schema = paperSchema();
// build a transaction, then:
const payload = buildCommitPayload({ steps, baseDoc, resultDoc });
// payload.pmStepsBinary / yjsUpdateBinary / baseStateVector → PG bytea
```

## Browser usage (apps/web)

```tsx
import { Editor } from '@collaborationtool/editor-core';

<Editor
  documentId={docId}
  gatewayUrl="ws://localhost:4321/ws"
  token={syncToken}            // from /api/sync-token
  onModeChange={(m) => setMode(m)}
/>
```

The web app's editor route does:

1. server-render: load the document row + ACL → confirm read access
2. client-render: `EditorClient` POSTs to `/api/sync-token` for a
   short-lived JWT
3. client-render: pass JWT to `<Editor>` which opens a WebSocket to the
   gateway

## Wire format

See `src/sync/wire.ts`. Constants are duplicated in
`apps/sync-gateway/src/doc-room.ts` (with a runtime test spanning both).
When adding a new frame kind, **edit both files in lockstep**.

## Testing

```bash
pnpm editor:test       # 21 tests: schema integrity / wire codec / commit round-trip
pnpm editor:typecheck
```

The Phase 0 proto-a Playwright E2E (`pnpm proto-a:e2e`) still runs
against the proto-a copy of the schema + the y-websocket relay — that's
intentional, the prototype is frozen as a regression baseline. D15 will
add an apps/web Playwright that exercises this package against the real
gateway.

## Phase 1 deferred (intentional)

- **MathLive input** — Phase 2; current path is plain LaTeX text in
  the equation/inline-equation `latex` attr.
- **Real revision row insert** — D14 wires the approval flow that calls
  `buildCommitPayload` + writes to PG.
- **Marimo / Pyodide cell execution** — Phase 1/2 just stores the
  `kernel` attr; D11+ adds the iframe.
- **Figure image upload** — D12 (or Phase 1.5).
- **Cross-reference handles** (figure labels, theorem numbers) — Phase 2.
