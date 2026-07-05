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
      `[${options.scope}] dev fallback: no Ed25519 public key on file — signature NOT verified. ` +
        `Submit signaturePublicKey (or register principal.ed25519_public_key) for strict verification. ` +
        `未登记 Ed25519 公钥，签名未经验证（dev fallback）；` +
        `请提交 signaturePublicKey 或登记 principal.ed25519_public_key 以启用严格验证。`,
    );
    return true;
  };
}

/**
 * Dev-only escape hatch for local clients that have not yet uploaded a
 * public key. OFF by default — outside production a publish whose
 * signature cannot be verified is now rejected (缺 key 即拒), so the
 * Merkle log never gains an entry whose signature was silently skipped.
 * Set `OPEN_CONTENT_DEV_SIGNATURE_FALLBACK=1` to re-enable the skip while
 * a local client catches up; it stays hard-off in production regardless.
 */
export function allowOpenContentDevSignatureFallback(): boolean {
  return (
    process.env['NODE_ENV'] !== 'production' &&
    process.env['OPEN_CONTENT_DEV_SIGNATURE_FALLBACK'] === '1'
  );
}

/**
 * Bilingual, human-readable detail for the signature-related publish
 * reject reasons. Returned alongside the stable `error` slug so the API
 * contract stays machine-parseable while humans get 中英 context. Returns
 * null for reasons that are not signature-related (route omits `detail`).
 */
export function signatureRejectDetail(reason: string): string | null {
  switch (reason) {
    case 'signature-verify-failed':
      return (
        'Signature could not be verified against the signer’s Ed25519 public key ' +
        '(missing registered key, key mismatch, or tampered content). ' +
        '无法用签名者的 Ed25519 公钥验证签名' +
        '（公钥未登记、公钥不匹配或内容被篡改）。'
      );
    case 'signature-verify-threw':
      return (
        'Signature verification threw before completing. ' +
        '签名验证过程中抛出异常，未能完成验证。'
      );
    default:
      return null;
  }
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
