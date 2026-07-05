import {
  fromHex,
  toHex,
  verify,
  type Ed25519PublicKey,
  type Ed25519Signature,
} from '@collaborationtool/identity';

import { canonicalBytes, contentHashHex } from './canonical-payload';
import type { EntityKind, SignedJws } from './_shared';

export type PublicProvenanceVerificationMode =
  | 'public-replayable'
  | 'server-summary-only';

export type PublicProvenanceBundleVerificationStatus =
  | 'verified'
  | 'server-summary-only'
  | 'unavailable'
  | 'invalid';

export type PublicProvenanceResponseVerificationStatus =
  | 'verified'
  | 'partially-verified'
  | 'server-summary-only'
  | 'unavailable'
  | 'invalid';

export interface PublicProvenanceMerkleBundle {
  id: string;
  prevEntryId: string | null;
  entrySeq: string;
  entityKind: string;
  entityId: string;
  contentHashHex: string;
  signedJws: SignedJws;
  signerPrincipalId: string;
  appendedAt: string;
}

export interface PublicProvenanceSignerBundle {
  principalId: string;
  ed25519PublicKey: string | null;
  publicKeyFingerprint: string | null;
}

export interface PublicProvenanceVerificationBundle {
  summary?: { status?: string } | null;
  verificationMode: PublicProvenanceVerificationMode;
  canonicalContent: unknown | null;
  signedPayloadJws: SignedJws | null;
  merkleEntry: PublicProvenanceMerkleBundle | null;
  signer: PublicProvenanceSignerBundle | null;
  redactedFields: string[];
}

export interface PublicProvenanceReviewRecord {
  id: string;
  reviewerOrcidId: string;
  verdict: string;
  provenance: PublicProvenanceVerificationBundle;
}

export interface PublicProvenanceApiResponse {
  kind: Exclude<EntityKind, 'open_peer_review'>;
  id: string;
  verifier?: {
    packageName?: string;
    command?: string;
    publicReplayableKinds?: string[];
    serverSummaryOnlyKinds?: string[];
  };
  record: PublicProvenanceVerificationBundle;
  reviews: PublicProvenanceReviewRecord[];
  generatedAt?: string;
}

export interface PublicProvenanceBundleVerificationResult {
  status: PublicProvenanceBundleVerificationStatus;
  independentlyVerified: boolean;
  failures: string[];
  computedContentHashHex: string | null;
  merkleLogEntryId: string | null;
  entityKind: string | null;
  entityId: string | null;
}

export interface PublicProvenanceResponseVerificationResult {
  status: PublicProvenanceResponseVerificationStatus;
  independentlyVerified: boolean;
  failures: string[];
  record: PublicProvenanceBundleVerificationResult;
  reviews: Array<{
    id: string;
    provenance: PublicProvenanceBundleVerificationResult;
  }>;
}

export function verifyPublicProvenanceResponse(
  response: PublicProvenanceApiResponse,
): PublicProvenanceResponseVerificationResult {
  const expectedRecordId =
    response.kind === 'share_snapshot' ? undefined : response.id;
  const record = verifyPublicProvenanceBundle(response.record, {
    expectedEntityKind: response.kind,
    expectedEntityId: expectedRecordId,
  });
  const reviews = response.reviews.map((review) => ({
    id: review.id,
    provenance: verifyPublicProvenanceBundle(review.provenance, {
      expectedEntityKind: 'open_peer_review',
      expectedEntityId: review.id,
    }),
  }));
  const all = [record, ...reviews.map((review) => review.provenance)];
  const failures = [
    ...record.failures.map((failure) => `record: ${failure}`),
    ...reviews.flatMap((review) =>
      review.provenance.failures.map(
        (failure) => `review ${review.id}: ${failure}`,
      ),
    ),
  ];

  return {
    status: summarizeResponseStatus(all),
    independentlyVerified: all.every((result) => result.independentlyVerified),
    failures,
    record,
    reviews,
  };
}

export function verifyPublicProvenanceBundle(
  bundle: PublicProvenanceVerificationBundle,
  expected?: {
    expectedEntityKind?: EntityKind;
    expectedEntityId?: string;
  },
): PublicProvenanceBundleVerificationResult {
  if (bundle.verificationMode === 'server-summary-only') {
    return verifyServerSummaryOnlyBundle(bundle, expected);
  }
  return verifyReplayableBundle(bundle, expected);
}

export function verifyOpenContentSignature(args: {
  signedJws: SignedJws;
  payload: unknown;
  publicKey: Ed25519PublicKey;
}): boolean {
  const signature = parseEd25519Signature(args.signedJws);
  if (!signature) return false;
  return verify(signature, canonicalBytes(args.payload), args.publicKey);
}

export function parseEd25519PublicKey(value: unknown): Ed25519PublicKey | null {
  const normalized = normalizeEd25519PublicKeyText(value);
  if (!normalized) return null;
  const hex = normalized.slice('ed25519:'.length);
  const bytes = fromHex(hex);
  return bytes.length === 32 ? (bytes as Ed25519PublicKey) : null;
}

export function normalizeEd25519PublicKeyText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const hex = raw.toLowerCase().startsWith('ed25519:')
    ? raw.slice('ed25519:'.length)
    : raw;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return `ed25519:${toHex(fromHex(hex))}`;
}

export function parseEd25519Signature(value: unknown): Ed25519Signature | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (/^[0-9a-fA-F]{128}$/.test(raw)) {
    const bytes = fromHex(raw);
    return bytes.length === 64 ? (bytes as Ed25519Signature) : null;
  }

  const bytes = decodeBase64Url(raw);
  return bytes?.length === 64 ? (bytes as Ed25519Signature) : null;
}

function verifyReplayableBundle(
  bundle: PublicProvenanceVerificationBundle,
  expected: {
    expectedEntityKind?: EntityKind;
    expectedEntityId?: string;
  } = {},
): PublicProvenanceBundleVerificationResult {
  const failures = baseBundleFailures(bundle, expected);
  const canonicalContent = bundle.canonicalContent;
  if (canonicalContent === null) failures.push('missing canonicalContent');
  if (!bundle.signedPayloadJws) failures.push('missing signedPayloadJws');
  if (!bundle.signer?.ed25519PublicKey) failures.push('missing signer public key');

  const computedContentHashHex =
    canonicalContent === null ? null : contentHashHex(canonicalContent);
  if (
    computedContentHashHex &&
    bundle.merkleEntry &&
    bundle.merkleEntry.contentHashHex !== computedContentHashHex
  ) {
    failures.push('content hash mismatch');
  }

  if (
    bundle.merkleEntry &&
    bundle.signedPayloadJws &&
    bundle.merkleEntry.signedJws !== bundle.signedPayloadJws
  ) {
    failures.push('signed payload does not match Merkle entry');
  }

  if (
    bundle.merkleEntry &&
    bundle.signer &&
    bundle.merkleEntry.signerPrincipalId !== bundle.signer.principalId
  ) {
    failures.push('signer principal does not match Merkle entry');
  }

  const publicKey = parseEd25519PublicKey(bundle.signer?.ed25519PublicKey);
  if (bundle.signer?.ed25519PublicKey && !publicKey) {
    failures.push('invalid signer public key');
  }

  if (canonicalContent !== null && bundle.signedPayloadJws && publicKey) {
    const signatureOk = verifyOpenContentSignature({
      signedJws: bundle.signedPayloadJws,
      payload: canonicalContent,
      publicKey,
    });
    if (!signatureOk) failures.push('signature verification failed');
  }

  if (
    failures.length === 0 &&
    bundle.summary?.status &&
    bundle.summary.status !== 'verified'
  ) {
    failures.push(`server summary status is ${bundle.summary.status}`);
  }

  return {
    status: failures.length === 0 ? 'verified' : 'invalid',
    independentlyVerified: failures.length === 0,
    failures,
    computedContentHashHex,
    merkleLogEntryId: bundle.merkleEntry?.id ?? null,
    entityKind: bundle.merkleEntry?.entityKind ?? null,
    entityId: bundle.merkleEntry?.entityId ?? null,
  };
}

function verifyServerSummaryOnlyBundle(
  bundle: PublicProvenanceVerificationBundle,
  expected: {
    expectedEntityKind?: EntityKind;
    expectedEntityId?: string;
  } = {},
): PublicProvenanceBundleVerificationResult {
  const failures = baseBundleFailures(bundle, expected);
  if (bundle.canonicalContent !== null) {
    failures.push('server-summary-only bundle exposes canonicalContent');
  }
  if (!Array.isArray(bundle.redactedFields) || bundle.redactedFields.length === 0) {
    failures.push('server-summary-only bundle must declare redacted fields');
  }

  const unavailable =
    bundle.summary?.status === 'unavailable' &&
    !bundle.merkleEntry &&
    !bundle.signedPayloadJws;

  return {
    status:
      failures.length > 0
        ? 'invalid'
        : unavailable
          ? 'unavailable'
          : 'server-summary-only',
    independentlyVerified: false,
    failures,
    computedContentHashHex: null,
    merkleLogEntryId: bundle.merkleEntry?.id ?? null,
    entityKind: bundle.merkleEntry?.entityKind ?? null,
    entityId: bundle.merkleEntry?.entityId ?? null,
  };
}

function baseBundleFailures(
  bundle: PublicProvenanceVerificationBundle,
  expected: {
    expectedEntityKind?: EntityKind;
    expectedEntityId?: string;
  },
): string[] {
  const failures: string[] = [];
  if (!bundle.merkleEntry) {
    failures.push('missing Merkle entry');
  } else {
    if (!/^[0-9a-f]{64}$/.test(bundle.merkleEntry.contentHashHex)) {
      failures.push('Merkle content hash is not lowercase sha-256 hex');
    }
    if (
      expected.expectedEntityKind &&
      bundle.merkleEntry.entityKind !== expected.expectedEntityKind
    ) {
      failures.push(
        `Merkle entity kind ${bundle.merkleEntry.entityKind} does not match ${expected.expectedEntityKind}`,
      );
    }
    if (
      expected.expectedEntityId &&
      bundle.merkleEntry.entityId !== expected.expectedEntityId
    ) {
      failures.push(
        `Merkle entity id ${bundle.merkleEntry.entityId} does not match ${expected.expectedEntityId}`,
      );
    }
  }
  return failures;
}

function summarizeResponseStatus(
  results: PublicProvenanceBundleVerificationResult[],
): PublicProvenanceResponseVerificationStatus {
  if (results.some((result) => result.status === 'invalid')) return 'invalid';
  if (results.some((result) => result.status === 'unavailable')) {
    return 'unavailable';
  }
  if (results.every((result) => result.status === 'verified')) {
    return 'verified';
  }
  if (results.some((result) => result.status === 'verified')) {
    return 'partially-verified';
  }
  return 'server-summary-only';
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
