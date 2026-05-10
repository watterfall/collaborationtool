// Phase 2.5 ADR + phase-2-plan-stub §8.4 §3: real `typst query`
// subprocess wrapper for import-typst.
//
// `typst query` accepts a selector + a .typ entry path and prints
// JSON results to stdout. We use it to enumerate the document's
// outline (headings) and figure references; full AST extraction
// requires `typst inspect` (Phase 3) or in-process WASM (Phase 4).
//
// Graceful fallback: when `typst` is not on PATH (no version of CI
// image / no local install), we throw TypstImportError(reason='binary-
// missing'). Callers (apps/web import route + Auto-Fix loop) decide
// whether to fall back to the in-process stub parser (commit 6 of
// Phase 2 W6) or surface the error to the user.

import { spawn } from 'node:child_process';

import { TypstImportError } from './index';

export interface TypstQueryOptions {
  /** typst executable; default 'typst'. */
  binary?: string;
  /** Selector: e.g. 'heading' or '<label>' (typst 0.10+ syntax). */
  selector: string;
  /** Absolute path to the .typ entry file. */
  entryPath: string;
  /** Subprocess timeout (ms); default 10s. */
  timeoutMs?: number;
  /** Optional --root override; default = entry's parent dir. */
  rootDir?: string;
}

export interface TypstQueryResult {
  /** JSON output from typst query (an array of records). */
  records: unknown[];
  /** Subprocess stderr (warnings + non-fatal hints). */
  stderr: string;
  durationMs: number;
}

/**
 * Run `typst query <entry> --field=value <selector>` and parse stdout
 * as JSON. Throws TypstImportError on:
 *   - binary-missing: ENOENT / spawn failed
 *   - parse-error: typst exited non-zero
 *   - timeout: exceeded timeoutMs
 */
export async function runTypstQuery(
  options: TypstQueryOptions,
): Promise<TypstQueryResult> {
  const binary = options.binary ?? 'typst';
  const timeoutMs = options.timeoutMs ?? 10_000;
  const startedAt = Date.now();

  const args = [
    'query',
    '--field=value',
    '--format=json',
    options.entryPath,
    options.selector,
  ];
  if (options.rootDir) {
    args.unshift('--root', options.rootDir);
  }

  return await new Promise<TypstQueryResult>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(
        new TypstImportError(
          'binary-missing',
          `typst spawn failed: ${(err as Error).message}`,
        ),
      );
      return;
    }

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        new TypstImportError(
          'timeout',
          `typst query exceeded ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);

    child.stdout?.on('data', (b: Buffer) => {
      stdout += b.toString('utf8');
    });
    child.stderr?.on('data', (b: Buffer) => {
      stderr += b.toString('utf8');
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      // ENOENT = binary missing; everything else = io
      const reason = err.code === 'ENOENT' ? 'binary-missing' : 'io';
      reject(
        new TypstImportError(
          reason,
          `typst process error: ${err.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new TypstImportError(
            'parse-error',
            `typst query exited ${code}: ${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      let records: unknown[];
      try {
        const parsed: unknown = JSON.parse(stdout || '[]');
        records = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err) {
        reject(
          new TypstImportError(
            'parse-error',
            `typst query output is not JSON: ${(err as Error).message}`,
          ),
        );
        return;
      }
      resolve({
        records,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

/** Probe whether `typst` is callable on the current host. Returns
 * the version string when found, null otherwise. */
export async function probeTypstBinary(
  binary = 'typst',
): Promise<string | null> {
  return await new Promise<string | null>((resolve) => {
    const child = spawn(binary, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout?.on('data', (b: Buffer) => {
      stdout += b.toString('utf8');
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code === 0 && stdout.length > 0) {
        resolve(stdout.trim().split('\n')[0] ?? null);
      } else {
        resolve(null);
      }
    });
  });
}
