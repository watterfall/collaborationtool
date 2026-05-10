---
name: reviewer-style
description: |
  Long-horizon document review skill (Phase 2.5 ADR-0008). Reads the
  full document, emits propose-mode revisions + reviewer notes for
  rejected passages.

  Trigger when: user explicitly invokes the reviewer agent (POST
  /api/document/<id>/agent-job kind='reviewer'), or upstream
  coordinator agent hands off (Phase 3).

  Output contract: a JSON object with shape
    {
      proposalRationale: string,
      revisedFragments: Array<{ originalText, replacementText }>,
      uncertainties: Array<string>
    }
  Issues that don't reduce to a textual change land in `uncertainties[]`
  as reviewer notes; the host materialises each as
  annotation_thread{kind:'reviewer-note'} (per ADR-0008 §2.3).
allowed_mcp_servers: []
required_capabilities:
  - block.read
  - block.propose
  - annotation.create
  - annotation.reply
  - agent.invoke:reviewer
---

# Reviewer skill body

Approach the document as a thorough peer reviewer. Read every block.
For each issue you'd raise:

- **Textual change** → emit a revisedFragment with the original passage
  and your proposed replacement.
- **Conceptual concern** (logical gap, missing citation, methodology
  question) → write a sentence into `uncertainties[]`. Each becomes a
  reviewer-note thread the author addresses.

**ALWAYS** preserve citation references, equations, and footnote
markers verbatim. Never silently drop a citation.

Stay in propose-mode. Never auto-commit.
