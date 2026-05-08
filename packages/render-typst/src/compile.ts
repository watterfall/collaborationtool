// Wrapper around the `typst` CLI subprocess. Phase 1 D12 ships the
// invocation skeleton; the actual binary install is operational
// concern (apps/web's docker image / dev README).
//
// Phase 1.5 will evaluate typst.ts (WASM) for in-browser preview, but
// that bundle is too large for Phase 1 (proto-b §3.1 noted >5 MB which
// is fine in browser but adds dev install friction).

import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface TypstCompileOptions {
  /** Path to the typst binary. Default: 'typst' on PATH. */
  typstBin?: string;
  /** Per-call timeout in ms. Default 60s — proto-b had <1s for 1-page docs. */
  timeoutMs?: number;
  /** Input format Typst accepts; Phase 1 default 'typst'. */
  inputFormat?: 'typst';
  /** Output format. Phase 1 only PDF; SVG / PNG paths land Phase 2. */
  outputFormat?: 'pdf';
  /** Additional flags passed to `typst compile`. */
  extraArgs?: readonly string[];
}

export interface TypstCompileResult {
  pdfBytes: Uint8Array;
  /** Wall clock duration in ms. */
  durationMs: number;
  /** Anything typst wrote to stderr (warnings / non-fatal info). */
  stderr: string;
}

export class TypstCompileError extends Error {
  override name = 'TypstCompileError';
  constructor(
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(`typst compile failed (exit=${exitCode}): ${stderr.slice(0, 500)}`);
  }
}

/**
 * Compile a `.typ` source string to PDF using the local `typst` binary.
 *
 * Implementation: writes the source to a tmpdir, runs
 *   typst compile <input>.typ <output>.pdf
 * reads the PDF back, deletes the tmpdir.
 */
export async function compileTypstToPdf(
  source: string,
  options: TypstCompileOptions = {},
): Promise<TypstCompileResult> {
  const bin = options.typstBin ?? 'typst';
  const timeoutMs = options.timeoutMs ?? 60_000;

  const dir = await mkdtemp(join(tmpdir(), 'collab-typst-'));
  const inputPath = join(dir, 'source.typ');
  const outputPath = join(dir, 'output.pdf');

  try {
    await writeFile(inputPath, source, 'utf8');

    const start = Date.now();
    const stderr = await runTypst(bin, ['compile', inputPath, outputPath, ...(options.extraArgs ?? [])], timeoutMs);
    const durationMs = Date.now() - start;
    const pdfBytes = new Uint8Array(await readFile(outputPath));
    return { pdfBytes, durationMs, stderr };
  } finally {
    // Best-effort cleanup. If rm fails (e.g. permission), let it slide.
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function runTypst(
  bin: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timeout: NodeJS.Timeout | null = null;
    let killed = false;

    timeout = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeoutMs);

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    proc.on('close', (exitCode) => {
      if (timeout) clearTimeout(timeout);
      if (killed) {
        reject(new TypstCompileError(null, `timeout after ${timeoutMs}ms`));
        return;
      }
      if (exitCode !== 0) {
        reject(new TypstCompileError(exitCode, stderr));
        return;
      }
      // typst compile is silent on success; expose stderr for warnings.
      void stdout;
      resolve(stderr);
    });
  });
}
