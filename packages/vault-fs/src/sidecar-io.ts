// Sidecar IO for .vault/yjs/*.bin files.
// On-disk format (Spike-2):
//   [4 bytes magic: 'VFSB']  ascii 0x56 0x46 0x53 0x42
//   [4 bytes version: 0x00000001 LE]
//   [N bytes: Y.encodeStateAsUpdate output]
//
// Atomic write strategy: write to <path>.tmp, then rename.
// Phase 6 W3-W4 may add CRC32 trailer + per-doc snapshot generation.

import { readFile, rename, writeFile, unlink } from 'node:fs/promises';

const MAGIC = new Uint8Array([0x56, 0x46, 0x53, 0x42]); // 'VFSB'
const VERSION = 1;
const HEADER_LEN = 8;

export class SidecarCorruptError extends Error {
  constructor(public readonly path: string, public readonly reason: string) {
    super(`sidecar corrupt at ${path}: ${reason}`);
    this.name = 'SidecarCorruptError';
  }
}

function encodeHeader(): Uint8Array {
  const buf = new Uint8Array(HEADER_LEN);
  buf.set(MAGIC, 0);
  // version LE
  buf[4] = VERSION & 0xff;
  buf[5] = (VERSION >> 8) & 0xff;
  buf[6] = (VERSION >> 16) & 0xff;
  buf[7] = (VERSION >> 24) & 0xff;
  return buf;
}

function checkHeader(buf: Uint8Array, path: string): void {
  if (buf.length < HEADER_LEN) {
    throw new SidecarCorruptError(path, 'truncated header');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (buf[i] !== MAGIC[i]) {
      throw new SidecarCorruptError(path, 'bad magic');
    }
  }
}

export async function readSidecar(path: string): Promise<Uint8Array | null> {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
  const view = new Uint8Array(buf);
  checkHeader(view, path);
  return view.slice(HEADER_LEN);
}

export async function writeSidecar(path: string, bytes: Uint8Array): Promise<void> {
  const header = encodeHeader();
  const out = new Uint8Array(header.length + bytes.length);
  out.set(header, 0);
  out.set(bytes, header.length);
  const tmp = `${path}.tmp`;
  try {
    await writeFile(tmp, out);
    await rename(tmp, path);
  } catch (err) {
    // best-effort cleanup; ignore if .tmp doesn't exist
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
