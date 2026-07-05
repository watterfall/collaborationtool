# Research Collaboration Systems Baseline, 2026-06-03

> Working baseline for the long-term objective: make research collaboration and exploration substantially easier for scientists. This is not a market memo; it is a product map that should keep shaping the website and core product.

## External Evidence

### 1. Open science is moving from policy slogans to monitored practice

UNESCO's 2025 open science monitoring work reports persistent implementation problems: fragmented data, weak institutional coordination, low awareness, and research assessment systems that can block open science adoption. The same process emphasizes monitoring that is inclusive, actionable, locally fit, and grounded in transparency and reproducibility.

Product implication: the platform should not only let users write papers; it should make openness observable inside day-to-day work. Claim, evidence, source, data, code, reviewer action, and AI intervention need durable identifiers and visible status.

Sources:
- https://www.unesco.org/en/articles/step-towards-global-open-science-monitoring
- https://research-and-innovation.ec.europa.eu/strategy/strategy-research-and-innovation/our-digital-future/open-science_en

### 2. Reproducibility has become infrastructure work

NIH announced an agency-wide initiative to treat replication and reproducibility studies as foundational. Its stated focus includes data sharing and standardization, public availability of findings, independent replication, incentives, and infrastructure for embedding reproducibility into biomedical research. Nature Communications' 2025 reproducibility Q&A frames science as a "show-me" enterprise: transparent evidence, raw data, code, methods, and failed paths are needed so others can interrogate and build on claims.

Product implication: the editor should make reproducibility a normal authoring workflow. Every claim should have a machine-readable evidence state, source links, data/code/protocol attachments, and maintenance findings when evidence becomes broken, outdated, unsupported, duplicated, or contradicted.

Sources:
- https://www.nih.gov/replicationandreproducibility
- https://www.nature.com/articles/s41467-024-54614-2

### 3. Peer review is strained and needs attribution, triage, and transparency

A 2003-2024 editorial-data study of Biological Invasions found reviewer acceptance dropping while decline rates rose. It names reviewer fatigue, inequitable workload, insufficient incentives, and uneven global participation; it recommends structural reform, training, equitable invitations, compensation, and formal recognition. JAMA's 2025 article on AI in peer review notes long-standing problems: inefficiency, delay, bias, inconsistency, and failure to block low-quality or fraudulent work.

Product implication: review should become smaller-grained and credit-bearing. Instead of treating review as one opaque report, the product should support claim-level review, reviewer contribution records, ORCID-signed verdicts, transparent review files where appropriate, and AI assistance that is auditable rather than a hidden shortcut.

Sources:
- https://link.springer.com/article/10.1007/s10530-025-03679-1
- https://jamanetwork.com/journals/jama/fullarticle/2838453

### 4. AI can accelerate science, but scientific AI needs provenance and uncertainty

The 2025 NSF workshop report on generative AI in science describes wide adoption across disciplines but highlights core gaps: hallucination, brittleness on out-of-distribution cases, explainability, uncertainty quantification, reasoning limits, scarcity of AI-ready scientific datasets, and the need for interdisciplinary training.

Product implication: AI must be a permissioned collaborator with a provenance record, not a side-panel oracle. The system should log model/provider/prompt/tool calls, keep human approval chains, allow local/private models, and surface uncertainty or verification tasks as first-class work items.

Source:
- https://www.nature.com/articles/s44387-025-00018-6

### 5. Persistent identifiers and FAIR metadata are becoming the connective layer

The European Commission's open science page emphasizes FAIR management of publications, data, and other outputs, along with EOSC, research assessment reform, and open science skills. NIH's metadata and PID plan, ORCID/ROR guidance, and national PID roadmaps point in the same direction: people, organizations, outputs, projects, grants, data, and instruments need persistent, machine-readable links.

Product implication: collaboration artifacts should be built around identifiers, not loose text. Existing ORCID support should extend into contribution and review objects; future roadmap items should include ROR, DOI/DataCite, RAiD/project IDs, and stable IDs for claims, evidence objects, and bridge artifacts.

Sources:
- https://grants.nih.gov/grants/guide/notice-files/NOT-OD-25-050.html
- https://info.orcid.org/documentation/integration-guide/orcid-and-persistent-identifiers/
- https://www.oecd.org/en/publications/access-to-public-research-data-toolkit_a12e8998-en/ireland-s-national-persistent-identifier-strategy-and-roadmap_a6cb5844-en.html

## Problem Map

| Research-system problem | Current user pain | Product response |
|---|---|---|
| Ideas vanish before becoming papers | Scientists lose half-formed questions, contradictions, failed attempts, and credit | Night / Bridge / Day artifact model; contribution graph; citable idea lineage |
| Evidence is hard to inspect | Claims, datasets, code, methods, and citations are scattered | Claim/evidence nodes; evidence maps; source extraction; CrossRef/MCP; maintenance scans |
| Reproducibility is extra labor | Authors must retrofit data/code/protocol transparency late | Authoring-time reproducibility checklist and claim-level evidence state |
| Peer review is overloaded | Reviewers face broad, unpaid, high-context reports with weak recognition | Claim-level review; ORCID-signed verdicts; reviewer contribution records |
| AI work is unverifiable | Model outputs enter manuscripts without traceable context | Agent provenance writer; approval chain; model/provider/prompt/tool logging |
| Collaboration systems are cloud-captive | Labs need privacy, local control, and self-hosting | Desktop-first, local-first CRDT, self-hostable sync gateway, local AI by default |
| Research assessment rewards the wrong unit | First-author papers hide real intellectual contribution | Contribution graph and citable micro-contributions across idea/prototype/paper layers |

## Immediate Product Priorities

1. Make the landing page communicate the reform map: current pain -> trend -> platform mechanism.
2. Promote claim/evidence/review/provenance as one connected workflow, not separate features.
3. Add a reproducibility readiness surface inside documents: unsupported claims, missing data/code, missing protocol, AI-unverified blocks, stale sources.
4. Strengthen reviewer workflow around small-grained verdicts, recognition, and ORCID signing.
5. Extend persistent identifier support beyond ORCID toward DOI/DataCite/ROR/RAiD-style relationships.
6. Keep local-first and self-hosting central: privacy is not a deployment detail for researchers; it is a collaboration requirement.

## This Turn's Implementation Slice

This turn updates the public website to expose the research-system diagnosis and product response in one bilingual section. It keeps the existing editorial landing style and avoids introducing a separate marketing aesthetic.

## Continuation Slice: Public Provenance Verification

The next implementation step moves from "signed records exist" to "public records can be inspected." This follows the same external evidence: open science monitoring needs observable practice, reproducibility needs inspectable artifacts, and PID infrastructure only helps when identity, output and contribution metadata are visible at the point of use.

Implemented product response:

1. Add a server-side provenance assessment layer for open questions, datasets and snapshots.
2. Verify that entity rows agree with their Merkle log entry, content hash and Ed25519 signature.
3. Extend the same verification path to public peer-review responses, so review labor is not only visible but independently checkable.
4. Read hidden payload fields only inside the verification helper, preserving the public detail loader boundary that avoids exposing dataset storage refs or snapshot binaries.
5. Show compact public provenance status: integrity, algorithm, content hash, Merkle entry, signer principal and public-key fingerprint.
6. Add a public machine-readable provenance endpoint for record + review summaries, giving external auditors a stable JSON surface instead of forcing them to scrape HTML.
7. Make open questions and peer reviews publicly replayable by returning canonical content, signed payload, Merkle entry and signer public key; keep datasets and snapshots server-verified only when their canonical payload includes hidden storage/archive fields, and declare those redactions explicitly.
8. Add a shared offline verifier and package script so external researchers can verify public replayable bundles from a downloaded file or provenance URL without trusting the website renderer.
9. Surface the verifier at the point of use: public record sidebars now expose the JSON packet, download affordance, replay mode and verifier command; provenance JSON embeds package and replay/redaction metadata so the packet remains understandable outside the website.

Updated evidence checked this continuation:

- UNESCO open science monitoring: persistent challenges include fragmented data, limited institutional coordination and low awareness; monitoring is now about measuring practical progress, not only policy alignment.
- NIH replication and reproducibility initiative: replication, data sharing, standardization, independent replication and incentives are being treated as infrastructure for scientific rigor.
- EOSC / European open science direction: FAIR data, interoperable services, assessment reform and open science skills remain explicit infrastructure priorities.
- ORCID / ROR / PID guidance: researcher identity, organizations, outputs, reviews, datasets and funding need persistent, machine-readable links.

Sources:

- https://www.unesco.org/en/articles/step-towards-global-open-science-monitoring
- https://www.nih.gov/replicationandreproducibility
- https://digital-strategy.ec.europa.eu/en/policies/open-science-cloud
- https://info.orcid.org/documentation/integration-best-practices/
- https://ror.readme.io/docs/orcid
