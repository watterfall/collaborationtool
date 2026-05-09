---
name: inline-editor
description: |
  Rewrite a single passage according to a user-supplied instruction
  ("make this more formal", "tighten this paragraph", "translate the
  English sentence into Chinese while keeping the citations"). Operates
  in strict propose-mode (per ADR-0002 role 4): the rewrite becomes a
  Revision the document author can accept, modify, or reject.

  Trigger when: the user selects a passage in the editor and types a
  rewrite instruction in the inline editor agent panel. Do NOT run on
  passages without a user instruction.

  Output contract: a JSON object with shape
    {
      proposalRationale: string,     // ≤ 200 chars, what changed and why
      revisedFragments: Array<{
        originalText: string,        // exact match against passage prose
        replacementText: string,     // the rewritten text
      }>,
      uncertainties: string[],       // any aspect the agent had to guess
    }

allowed_mcp_servers: []

required_capabilities:
  - block.read
  - block.propose
  - agent.invoke:editor
---

# Inline Editor Skill

This skill helps the Inline Editor Agent rewrite a passage with the
user's intent in mind, while preserving all structural elements
(citations, equations, footnote markers, annotation anchors).

## Workflow

1. **Read the passage** carefully. Preserve every existing citation
   reference, equation, footnote marker, and annotation anchor verbatim.
2. **Apply the user instruction**: e.g. "more formal", "tighter",
   "rewrite as a single sentence", "translate to zh-Hans". Stay within
   the original paragraph boundaries.
3. **Check that all citations / equations are still present** in the
   replacement text. If you would have to drop a citation to satisfy
   the user instruction, surface that as a entry in `uncertainties`
   instead of dropping silently.
4. **Emit a single revisedFragments entry** for the whole passage
   (Phase 1 simplification). Phase 1.5 may split into multiple sentence-
   level fragments when the instruction is sentence-scoped.

## Constraints

- **NEVER commit directly** — always emit a Revision (status='proposed').
- **NEVER call MCP tools** — Phase 1 inline editor is LLM-only.
- **DO NOT change citations or equations** semantically — they must
  appear identically in `replacementText` as they did in `originalText`.
- **DO NOT widen scope** beyond the passage the user selected.

## Provenance contract

The agent runtime records, for each invocation:

- `agentContext.modelId`, `agentContext.promptHash`,
  `agentContext.inputSkillIds = ['inline-editor']`
- `inputBlockIds`: the single block being rewritten
- `toolCalls`: empty array (Phase 1 inline editor is tool-less)
- The Revision created references this Provenance row as
  `revision.provenanceId`

## Phase 1 → Phase 2 follow-ups

- Sentence-level fragments — split rewrite per sentence so the author
  can accept/reject at sentence granularity in the diff UI
- Bilingual rewrites (English ↔ Chinese) with explicit script awareness
  (defer to packages/typography for terminal language tagging)
- "Suggest 3 alternatives" mode that emits multiple proposal candidates
  in a single invocation
