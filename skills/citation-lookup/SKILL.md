---
name: citation-lookup
description: |
  Verify and enrich academic citation references in a document. Given a passage
  containing citation markers (e.g. DOIs, author-year tags) that may be
  misspelled, incomplete, or missing metadata, look up the canonical record via
  CrossRef / Semantic Scholar / arXiv MCP servers, propose a corrected
  citation-ref atom node, and return the change as a Revision proposal (status
  = 'proposed', never auto-commit).

  Trigger when: the user selects a passage with potential citation issues, OR
  when an upstream agent flags `agent-flag` on a citation-ref. Do not run on
  passages without any citation markers.

  Output contract: a JSON object with shape
    {
      proposalRationale: string,   // ≤ 200 chars, what changed and why
      revisedFragments: Array<{
        originalText: string,
        replacementText: string,
        citationId: string,        // existing or newly created
        citationCslJson: object,   // CSL-JSON metadata
      }>,
      uncertainties: string[],     // any DOI we could NOT verify; user review
    }

allowed_mcp_servers:
  - crossref
  - crossref-mock
  - semantic-scholar
  - arxiv

required_capabilities:
  - block.read
  - block.propose
  - citation.read
  - citation.create
  - citation.update
  - citation.bind
  - agent.invoke:citation
---

# Citation Lookup Skill

This skill helps the Citation Agent verify and complete academic citation
references. The agent operates strictly in **propose mode** (per ADR-0002):
all changes must be reviewed by a human author before they become Contributions.

## Workflow

1. **Parse the passage**: extract DOI candidates, author-year markers, and any
   existing `citation-ref` atom nodes (with their `attrs.citationId`).
2. **Look up each candidate** against the allowed MCP servers in priority
   order: crossref → semantic-scholar → arxiv. Always retain the highest-quality
   metadata source.
3. **For each found record**, build a CSL-JSON object. If the existing
   citation in the document has different metadata, prefer the canonical
   record but flag the difference in `uncertainties`.
4. **For unfindable candidates**, leave a note in `uncertainties` —
   never invent a record.
5. **Emit a Revision proposal** with all corrected references in one batch.

## Constraints

- **NEVER commit directly** — always emit a Revision (status='proposed').
- **DO NOT change passage prose** unrelated to citation markers.
- **DO NOT widen scope** beyond the passages the user selected.
- Stay within `block.read` capability granted by the user; do not request
  cross-document context unless explicitly authorised.

## Provenance contract

The agent runtime must record, for each invocation:

- `agentContext.modelId`, `agentContext.promptHash`, `agentContext.inputSkillIds`
- `inputBlockIds`: the blocks the agent read (typically the user-selected passage)
- `toolCalls`: every MCP `lookup_doi` / `search_*` call, with `argumentsHash`,
  `resultSummary`, `succeeded`, `durationMs`
- The Revision created must reference this Provenance row as
  `revision.provenanceId`

This is non-optional: if the runtime cannot guarantee Provenance, the skill
must abort.
