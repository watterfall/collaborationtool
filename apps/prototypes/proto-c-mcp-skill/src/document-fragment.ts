// Hardcoded input document fragment for the proto-c demo.
// Contains:
//   - one DOI that exists in the mock fixture (10.1145/3531146.3533104)
//   - one DOI that's mistyped (real one is 10.48550/arXiv.2310.06770;
//     the user's text has 10.48550/arXiv.2310.O6770 — letter O instead of zero)
//   - one DOI that the mock simply doesn't know about (10.9999/unknown.2024)

import { v7 as uuidv7 } from 'uuid';
import type { InputPassage } from './types';

export function buildDemoPassage(): InputPassage {
  return {
    documentId: 'doc:demo-' + uuidv7().slice(0, 8),
    blockId: 'blk:passage-' + uuidv7().slice(0, 8),
    prose: [
      '我们的设计参考了 (Bommasani et al., 2022, DOI 10.1145/3531146.3533104)',
      '关于 foundation models 的风险与机会讨论；',
      '协作 CRDT 实践参考 Yjs 的论文 (Nicolaescu, 2023, DOI 10.48550/arXiv.2310.O6770)；',
      '另请参阅 Open Science 综述 (Anonymous, 2025, DOI 10.9999/unknown.2024).',
    ].join(' '),
    flaggedDoiCandidates: [
      '10.1145/3531146.3533104',
      '10.48550/arXiv.2310.O6770',
      '10.9999/unknown.2024',
    ],
  };
}
