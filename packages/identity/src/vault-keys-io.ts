// Vault keys I/O — read / write identity material to
// `<vaultRoot>/.vault/keys/{identity.json, ed25519.pub, orcid.link.json}`.
//
// Layout per spec §3:
//   .vault/keys/
//     identity.json     EncryptedKeypair JSON
//     ed25519.pub       plaintext "ed25519:<hex>"
//     orcid.link.json   OrcidLink JSON (after ORCID OAuth flow)
//
// Atomic-write semantics: writes go to <path>.tmp then rename, same as
// vault-fs sidecar-io. Read returns null when file absent (cold start
// case — caller decides whether to generateKeypair() and prompt user).

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  CorruptKeyfileError,
  KEYPAIR_FILE,
  ORCID_LINK_FILE,
  PUBLIC_KEY_FILE,
  VAULT_KEYS_DIR,
  type EncryptedKeypair,
  type OrcidLink,
} from './_shared';

/** Build the absolute keys-dir path under a vault root. */
export function keysDir(vaultRoot: string): string {
  return join(vaultRoot, VAULT_KEYS_DIR);
}

async function writeAtomic(path: string, content: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  try {
    await writeFile(tmp, content);
    await rename(tmp, path);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

async function readJsonOrNull<T>(path: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new CorruptKeyfileError(path, `invalid JSON: ${(err as Error).message}`);
  }
}

// ---------- EncryptedKeypair ----------

export async function writeEncryptedKeypair(
  vaultRoot: string,
  enc: EncryptedKeypair,
): Promise<void> {
  const keypairPath = join(keysDir(vaultRoot), KEYPAIR_FILE);
  const pubKeyPath = join(keysDir(vaultRoot), PUBLIC_KEY_FILE);
  await writeAtomic(keypairPath, JSON.stringify(enc, null, 2));
  // Public key file is plain text so user can `cat` it for sharing.
  await writeAtomic(pubKeyPath, `${enc.publicKey}\n`);
}

export async function readEncryptedKeypair(
  vaultRoot: string,
): Promise<EncryptedKeypair | null> {
  const path = join(keysDir(vaultRoot), KEYPAIR_FILE);
  const enc = await readJsonOrNull<EncryptedKeypair>(path);
  if (!enc) return null;
  if (enc.version !== 1) {
    throw new CorruptKeyfileError(path, `unsupported version ${enc.version}`);
  }
  return enc;
}

// ---------- OrcidLink ----------

export async function writeOrcidLink(
  vaultRoot: string,
  link: OrcidLink,
): Promise<void> {
  const path = join(keysDir(vaultRoot), ORCID_LINK_FILE);
  await writeAtomic(path, JSON.stringify(link, null, 2));
}

export async function readOrcidLink(
  vaultRoot: string,
): Promise<OrcidLink | null> {
  const path = join(keysDir(vaultRoot), ORCID_LINK_FILE);
  return readJsonOrNull<OrcidLink>(path);
}
