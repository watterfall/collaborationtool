import {
  buildMerkleEntry,
  canonicalBytes,
  type EntityKind,
  type PreparedMerkleEntry,
} from '@collaborationtool/open-content';
import {
  fromHex,
  sign,
  type Ed25519SecretKey,
} from '@collaborationtool/identity';

export const DEMO_OPEN_SIGNER_PRINCIPAL_ID =
  'user:00000000-0000-7000-8000-000000000001';
export const DEMO_REVIEWER_USER_ID = 'demo-reviewer-0001';
export const DEMO_REVIEWER_PRINCIPAL_ID =
  'user:00000000-0000-7000-8000-000000000002';

export const DEMO_OPEN_SIGNER_SECRET_HEX =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
export const DEMO_REVIEWER_SECRET_HEX =
  '1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100';

export const DEMO_OPEN_SIGNER_PUBLIC_KEY =
  'ed25519:03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8';
export const DEMO_REVIEWER_PUBLIC_KEY =
  'ed25519:712651f450ba05b63898b99ef5f7ba45632e8e2527f7f715cd671ec4024cc51e';

export const DEMO_OPEN_QUESTION_ID = 'demo-question';
export const DEMO_OPEN_REVIEW_ID = 'demo-review';
export const DEMO_OPEN_DATASET_ID = 'demo-dataset';
export const DEMO_SHARE_SNAPSHOT_ID = 'demo-snapshot-row';
export const DEMO_SHARE_SNAPSHOT_PERMALINK = 'demo-snapshot';

export const DEMO_OPEN_QUESTION_CONTENT = {
  questionMd:
    '# How can small labs publish reproducible negative results?\n\n' +
    'We need a workflow that connects a failed replication attempt, ' +
    'its dataset, peer response and later manuscript changes without ' +
    'making every contributor learn separate repository tools.',
  domainTags: ['reproducibility', 'open-science', 'negative-results'],
} as const;

export const DEMO_OPEN_REVIEW_CONTENT = {
  reviewerOrcidId: '0000-0002-1825-0097',
  targetKind: 'question',
  targetId: DEMO_OPEN_QUESTION_ID,
  verdict: 'refines',
  bodyMd:
    'Scope the demo around one audit trail: question, dataset, section ' +
    'snapshot and signed review should verify together from the public page.',
  evidenceRefs: [
    `open_dataset:${DEMO_OPEN_DATASET_ID}`,
    `share_snapshot:${DEMO_SHARE_SNAPSHOT_PERMALINK}`,
  ],
} as const;

export const DEMO_OPEN_DATASET_CONTENT = {
  title: 'Negative result replication packet',
  descriptionMd:
    'A tiny demo metadata packet for showing how a dataset, review and ' +
    'section snapshot stay linked through signed open-content provenance.',
  blobStorageRef: 'swh:1:cnt:demo-negative-result-replication-packet',
  sizeBytes: 2048,
  licenseSpdx: 'CC0-1.0',
  datasetDoi: '10.5281/zenodo.demo-negative-result',
} as const;

export const DEMO_SHARE_SNAPSHOT_CONTENT = {
  markdownContent:
    '# Negative result note\n\n' +
    'The replication attempt did not reproduce the reported effect. The ' +
    'open question, dataset and review remain linked so another lab can ' +
    'inspect the failure without asking for private context.',
  yjsBinaryBase64: base64Text('collaborationtool-demo-yjs-snapshot-v1'),
  kind: 'section',
  permalinkHash: DEMO_SHARE_SNAPSHOT_PERMALINK,
} as const;

export interface DemoOpenContentEntry {
  entityKind: EntityKind;
  entityId: string;
  merkleEntryId: string;
  payload: unknown;
  signedJws: string;
  signerPrincipalId: string;
  merkleEntry: PreparedMerkleEntry;
}

export interface DemoOpenContentChain {
  question: DemoOpenContentEntry;
  review: DemoOpenContentEntry;
  dataset: DemoOpenContentEntry;
  snapshot: DemoOpenContentEntry;
}

export function buildOpenContentDemoChain(
  prevEntryId: string | null,
): DemoOpenContentChain {
  const question = buildDemoEntry({
    entityKind: 'open_question',
    entityId: DEMO_OPEN_QUESTION_ID,
    merkleEntryId: 'merkle:demo-question',
    payload: DEMO_OPEN_QUESTION_CONTENT,
    signerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
    secretKeyHex: DEMO_OPEN_SIGNER_SECRET_HEX,
    prevEntryId,
  });
  const review = buildDemoEntry({
    entityKind: 'open_peer_review',
    entityId: DEMO_OPEN_REVIEW_ID,
    merkleEntryId: 'merkle:demo-review',
    payload: DEMO_OPEN_REVIEW_CONTENT,
    signerPrincipalId: DEMO_REVIEWER_PRINCIPAL_ID,
    secretKeyHex: DEMO_REVIEWER_SECRET_HEX,
    prevEntryId: question.merkleEntryId,
  });
  const dataset = buildDemoEntry({
    entityKind: 'open_dataset',
    entityId: DEMO_OPEN_DATASET_ID,
    merkleEntryId: 'merkle:demo-dataset',
    payload: DEMO_OPEN_DATASET_CONTENT,
    signerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
    secretKeyHex: DEMO_OPEN_SIGNER_SECRET_HEX,
    prevEntryId: review.merkleEntryId,
  });
  const snapshot = buildDemoEntry({
    entityKind: 'share_snapshot',
    entityId: DEMO_SHARE_SNAPSHOT_ID,
    merkleEntryId: 'merkle:demo-snapshot',
    payload: DEMO_SHARE_SNAPSHOT_CONTENT,
    signerPrincipalId: DEMO_OPEN_SIGNER_PRINCIPAL_ID,
    secretKeyHex: DEMO_OPEN_SIGNER_SECRET_HEX,
    prevEntryId: dataset.merkleEntryId,
  });
  return { question, review, dataset, snapshot };
}

export function buildDemoEntry(input: {
  entityKind: EntityKind;
  entityId: string;
  merkleEntryId: string;
  payload: unknown;
  signerPrincipalId: string;
  secretKeyHex: string;
  prevEntryId: string | null;
}): DemoOpenContentEntry {
  const signedJws = signPayload(input.payload, input.secretKeyHex);
  const merkleEntry = buildMerkleEntry({
    id: input.merkleEntryId,
    prevEntryId: input.prevEntryId,
    entityKind: input.entityKind,
    entityId: input.entityId,
    payload: input.payload,
    signedJws,
    signerPrincipalId: input.signerPrincipalId,
  });
  return {
    entityKind: input.entityKind,
    entityId: input.entityId,
    merkleEntryId: input.merkleEntryId,
    payload: input.payload,
    signedJws,
    signerPrincipalId: input.signerPrincipalId,
    merkleEntry,
  };
}

function signPayload(payload: unknown, secretKeyHex: string): string {
  const secretKey = fromHex(secretKeyHex) as Ed25519SecretKey;
  return base64UrlBytes(sign(canonicalBytes(payload), secretKey));
}

function base64UrlBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64Text(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}
