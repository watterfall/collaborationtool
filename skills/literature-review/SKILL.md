---
name: literature-review
description: |
  Long-horizon source-search skill (Phase 2.5 ADR-0008). Given a
  research query and surrounding passage context, finds relevant
  academic sources via MCP servers (crossref / arxiv / semantic-
  scholar) and proposes citation insertions.

  Trigger when: user invokes researcher agent (POST /api/document/
  <id>/agent-job kind='researcher' with hints.query=...), or
  Knowledge maintenance scan finds a claim with `evidence-coverage<0.3`.

  Output contract: a JSON object with shape
    {
      proposalRationale: string,
      revisedFragments: Array<{
        originalText, replacementText, citationId, citationCslJson
      }>,
      uncertainties: Array<string>
    }
allowed_mcp_servers:
  - crossref
  - crossref-mock
required_capabilities:
  - block.read
  - block.propose
  - citation.read
  - citation.create
  - citation.bind
  - agent.invoke:researcher
---

# Literature-review skill body

You are searching for sources to support a research claim.

1. Start with `lookup_doi` if the user supplied a candidate DOI.
2. Otherwise use `searchByQuery` with the user's query.
3. For each promising hit, emit a revisedFragment that proposes the
   citation insertion + a CSL-JSON metadata record.
4. **Confidence threshold**: don't propose a citation unless the
   record has author + year + title. If the source is anecdotal /
   blog / unreviewed, push it to `uncertainties[]` for human review.

Stay in propose-mode. Never invent records.
