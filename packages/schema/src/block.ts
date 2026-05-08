// Block is a node in the ProseMirror tree inside Y.Doc("body").
// Its primary representation is the PM node; the TS interface here is
// the conceptual shape. Cross-document queries go through `block_metadata`
// in Postgres, populated at commit boundary.

import type { BlockId, ContributionId, DocumentId, IsoDateTime } from './_shared';

export type BlockType =
  | 'paragraph' | 'heading' | 'list' | 'list-item' | 'blockquote'
  | 'equation'              // display 公式（atom block）
  | 'inline-equation'       // 行内公式（atom inline）
  | 'citation-ref'          // → Citation（atom inline）
  | 'dataset-ref'           // → Citation kind=dataset（atom inline）
  | 'computational-cell'    // → ComputationalCell（atom block）
  | 'figure'                // 容器：image + caption
  | 'figure-caption'
  | 'footnote-ref'          // atom inline，指向 footnote 内容
  | 'annotation-anchor'     // inline mark，CRDT 跟随文本
  | 'theorem' | 'proof'     // 学术结构
  | 'code-block';

export interface BlockShape {
  blockId: BlockId;          // [Y] PM node attrs.blockId; uuidv7 with client-id prefix
  type: BlockType;           // [Y] PM nodeType
  // type-specific attrs live in PM node attrs; not modelled in TS.
}

export interface BlockMetadata {
  blockId: BlockId;                          // [PG] PK
  documentId: DocumentId;                    // [PG]
  type: BlockType;                           // [PG]
  firstSeenContributionId: ContributionId;   // [PG] when did this block first appear
  lastSeenAt: IsoDateTime;                   // [PG] most recent commit it was still present in
  removedAt?: IsoDateTime;                   // [PG] when it disappeared from body
}
