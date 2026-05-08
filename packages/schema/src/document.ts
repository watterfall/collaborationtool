// Document is the root academic artifact (paper / report / chapter).
// Body content lives in Y.Doc (XmlFragment "body"); only metadata is in PG.

import type { DocumentId, IsoDateTime, LanguageTag, PrincipalId } from './_shared';

export interface Document {
  id: DocumentId;                                        // [PG]
  ownerPrincipalId: PrincipalId;                         // [PG]
  primaryLanguage: LanguageTag;                          // [PG] 排版基准语言（BCP 47）
  bilingualMode: 'mono' | 'parallel' | 'mixed';          // [PG]
  templateId?: string;                                   // [PG] journal template id
  title: string;                                         // [Y]  body 第一个 heading 的镜像缓存
  slug: string;                                          // [PG]
  createdAt: IsoDateTime;                                // [PG]
  updatedAt: IsoDateTime;                                // [PG] updated by commit boundary
  deletedAt?: IsoDateTime;                               // [PG] soft delete
}

// Postgres `document` row also carries:
//   yjs_state_vector_snapshot bytea  -- [Y+PG] periodic state vector
//   yjs_doc_binary           bytea  -- [Y+PG] full Y.Doc binary backup (disaster / fork base)
//   last_snapshot_at         timestamptz
// These are not represented as TS fields on Document because they're
// infrastructure-level, not domain-level.
