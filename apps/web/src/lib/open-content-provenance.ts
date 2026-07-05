import { contentHashHex } from '@collaborationtool/open-content';

import {
  normalizeEd25519PublicKeyText,
  parseEd25519PublicKey,
  verifyOpenContentSignature,
} from '@/lib/open-content-signature';

export type OpenContentProvenanceStatus =
  | 'verified'
  | 'unsigned'
  | 'missing-merkle-entry'
  | 'log-mismatch'
  | 'hash-mismatch'
  | 'missing-public-key'
  | 'invalid-public-key'
  | 'invalid-signature'
  | 'unavailable';

export interface OpenContentProvenanceSummary {
  status: OpenContentProvenanceStatus;
  contentHashHex: string | null;
  merkleLogEntryId: string;
  signerPrincipalId: string | null;
  signatureAlgorithm: 'Ed25519' | null;
  publicKeyFingerprint: string | null;
}

export interface OpenContentProvenanceInput {
  kind: string;
  entityId: string;
  content: unknown;
  signedPayloadJws: string;
  merkleLogEntryId: string;
  merkleEntry: {
    id: string;
    entityKind: string;
    entityId: string;
    contentHash: Uint8Array;
    signedJws: string;
    signerPrincipalId: string;
  } | null;
  signerPublicKey: unknown;
}

export function assessOpenContentProvenance(
  input: OpenContentProvenanceInput,
): OpenContentProvenanceSummary {
  const signedPayloadJws = input.signedPayloadJws.trim();
  const base = {
    contentHashHex: null,
    merkleLogEntryId: input.merkleLogEntryId,
    signerPrincipalId: input.merkleEntry?.signerPrincipalId ?? null,
    signatureAlgorithm: null,
    publicKeyFingerprint: fingerprintEd25519PublicKey(input.signerPublicKey),
  } satisfies Omit<OpenContentProvenanceSummary, 'status'>;

  if (!signedPayloadJws) return { ...base, status: 'unsigned' };
  if (!input.merkleEntry) {
    return { ...base, status: 'missing-merkle-entry' };
  }

  const storedHashHex = bytesToHex(input.merkleEntry.contentHash);
  const withHash = {
    ...base,
    contentHashHex: storedHashHex,
    signerPrincipalId: input.merkleEntry.signerPrincipalId,
  };

  if (
    input.merkleEntry.id !== input.merkleLogEntryId ||
    input.merkleEntry.entityKind !== input.kind ||
    input.merkleEntry.entityId !== input.entityId ||
    input.merkleEntry.signedJws !== signedPayloadJws
  ) {
    return { ...withHash, status: 'log-mismatch' };
  }

  if (storedHashHex !== contentHashHex(input.content)) {
    return { ...withHash, status: 'hash-mismatch' };
  }

  if (
    typeof input.signerPublicKey !== 'string' ||
    input.signerPublicKey.trim().length === 0
  ) {
    return { ...withHash, status: 'missing-public-key' };
  }

  const publicKey = parseEd25519PublicKey(input.signerPublicKey);
  if (!publicKey) {
    return { ...withHash, status: 'invalid-public-key' };
  }

  const signatureOk = verifyOpenContentSignature({
    signedJws: signedPayloadJws,
    payload: input.content,
    publicKey,
  });
  return {
    ...withHash,
    status: signatureOk ? 'verified' : 'invalid-signature',
    signatureAlgorithm: 'Ed25519',
  };
}

export function fingerprintEd25519PublicKey(value: unknown): string | null {
  const normalized = normalizeEd25519PublicKeyText(value);
  if (!normalized) return null;
  const hex = normalized.slice('ed25519:'.length);
  return `ed25519:${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
