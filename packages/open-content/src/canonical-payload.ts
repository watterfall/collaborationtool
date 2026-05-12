// Canonical JSON serialiser for entity payloads (ADR-0018 §2.4).
//
// Both client (publish flow) and server (verify flow) MUST produce
// byte-identical canonical bytes for the same logical entity, otherwise
// signature verify will fail. We implement RFC 8785 JSON Canonicalization
// Scheme (JCS) — recursive sorted-key stringify with deterministic
// number / string / array handling.
//
// Why our own (vs an npm package): keeps `@collaborationtool/open-content`
// dependency-light; we control the canonical contract for our schema.
// If we ever need full RFC 8785 strictness (e.g. unicode normalization)
// we can swap in `canonicalize` npm.

import { sha256 } from '@noble/hashes/sha2.js';

import type { ContentHash, ContentHashHex } from './_shared';

/**
 * Canonicalise a JSON-serialisable value:
 *   - Object keys sorted alphabetically (recursively)
 *   - Arrays preserve order (significant per JSON / JCS)
 *   - Numbers stringified via Number.toString (no `1.0` vs `1` ambiguity)
 *   - Strings double-quoted, control chars escaped
 *   - Boolean / null literal
 *   - undefined / function values throw — caller must omit them
 */
export function canonicaliseJson(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) {
    throw new Error('canonicaliseJson: undefined is not JSON-serialisable');
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`canonicaliseJson: non-finite number ${value}`);
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicaliseJson).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) continue; // skip undefined fields, don't fail
      parts.push(JSON.stringify(k) + ':' + canonicaliseJson(v));
    }
    return '{' + parts.join(',') + '}';
  }
  throw new Error(`canonicaliseJson: unsupported type ${typeof value}`);
}

/** Canonical UTF-8 bytes of a JSON value (what gets signed). */
export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicaliseJson(value));
}

/** sha-256 of canonical bytes — used as content_hash in PG. */
export function contentHash(value: unknown): ContentHash {
  return sha256(canonicalBytes(value));
}

/** Hex-encoded variant of contentHash — convenient for logs / API. */
export function contentHashHex(value: unknown): ContentHashHex {
  const bytes = contentHash(value);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
