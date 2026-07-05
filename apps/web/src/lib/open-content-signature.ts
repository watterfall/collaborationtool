import {
  fromHex,
  toHex,
  verify,
  type Ed25519PublicKey,
  type Ed25519Signature,
} from '@collaborationtool/identity';
import { canonicalBytes } from '@collaborationtool/open-content';

export interface OpenContentSignatureVerifierOptions {
  scope: string;
  publicKey: unknown;
  allowDevFallback?: boolean;
}

export function buildOpenContentSignatureVerifier(
  options: OpenContentSignatureVerifierOptions,
): (signedJws: string, payload: unknown) => boolean {
  const publicKey = parseEd25519PublicKey(options.publicKey);
  if (publicKey) {
    return (signedJws, payload) => verifyOpenContentSignature({
      signedJws,
      payload,
      publicKey,
    });
  }

  if (hasProvidedText(options.publicKey)) {
    return () => false;
  }

  return () => {
    if (!options.allowDevFallback) return false;
    console.warn(
      `[${options.scope}] signature verifier in dev fallback — submit signaturePublicKey for strict Ed25519 verification`,
    );
    return true;
  };
}

export function verifyOpenContentSignature(args: {
  signedJws: string;
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
  const bytes = fromHex(normalized.slice('ed25519:'.length));
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

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64');
  } catch {
    return null;
  }
}

function hasProvidedText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
