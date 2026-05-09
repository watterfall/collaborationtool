# templates/myst

Local mirror of mystmd export templates so we don't depend on
`api.mystmd.org` at export time. proto-b §3.2 documented the remote
registry as a fragile dependency (HTTP 403 in our sandbox at D4).

## Phase 1 D12 status

Phase 1's `packages/render-myst` ships its own minimal HTML / JATS /
Markdown emitters, so the mystmd templates are not yet consumed by the
runtime. This directory holds:

- `default/` — the Phase 1 export style baseline (CSS for HTML output)

When Phase 1.5 swaps to mystmd's official transformers, the layout in
each subfolder will mirror what `mystmd build --tex --template <path>`
expects:

```
templates/myst/<format>/<name>/
  template.tex            # or template.html / template.docx etc.
  myst.yml                # template metadata
  README.md               # per-template provenance
```

For Phase 1, callers select the template via `?template=default` on the
`/api/export/<docId>/<format>` endpoint; the route resolver looks up
this directory.
