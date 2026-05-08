// Citation is global, not per-document. Same paper can be cited by many docs.
// `citation-ref` block in Y.Doc("body") only stores attrs.citationId; metadata
// is fetched from Postgres (cached client-side in IndexedDB).

import type { CitationId, IsoDateTime, LanguageTag, PrincipalId } from './_shared';

export type CitationKind =
  | 'literature'   // paper / book / chapter, CSL-JSON
  | 'dataset'      // DOI / Zenodo / Dryad / HuggingFace
  | 'software'     // Zenodo software / Software Heritage
  | 'document'     // another document on this platform
  | 'web';         // URL with archive.org snapshot recommended

export interface CitationExternalIds {
  crossref?: string;
  arxiv?: string;
  semanticScholar?: string;
  pubmed?: string;
  openalex?: string;
  cnki?: string;
  zenodo?: string;
  orcid?: string[];
}

export interface Citation {
  id: CitationId;                           // [PG]
  kind: CitationKind;                       // [PG]
  cslJson: Record<string, unknown>;         // [PG] primary metadata in CSL-JSON
  doi?: string;                             // [PG] indexed
  url?: string;                             // [PG]
  archivedAt?: IsoDateTime;                 // [PG] archive.org snapshot time
  language?: LanguageTag;                   // [PG]
  externalIds: CitationExternalIds;         // [PG]
  createdBy: PrincipalId;                   // [PG]
  createdAt: IsoDateTime;                   // [PG]
}
