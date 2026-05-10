// Phase 2.5 phase-2-plan-stub §8.4 §4: real `myst` (mystmd CLI)
// subprocess wrapper for import-latex.
//
// `myst export tex --to mdast` (or similar) takes a .tex entry and
// emits a mystmd AST (JSON). We use it to convert legacy LaTeX into
// the same AST shape that Phase 1 D12 already renders. The PM mapper
// (W6 stub in src/index.ts) consumes the AST.
//
// Graceful fallback: when `myst` is not on PATH, throw
// LatexImportError(reason='binary-missing'). Callers fall back to the
// W6 inline stub parser or surface the error.

import { spawn } from 'node:child_process';

import { LatexImportError } from './index';

export interface MystExportOptions {
  /** myst executable; default 'myst'. */
  binary?: string;
  /** Path to .tex entry. */
  entryPath: string;
  /** mystmd subcommand args; default ['export', 'tex', '--to', 'mdast']. */
  args?: string[];
  /** Subprocess timeout (ms); default 60s (LaTeX projects can be large). */
  timeoutMs?: number;
}

export interface MystExportResult {
  /** Parsed JSON AST from stdout. mystmd shapes vary by version; we
   * keep it as `unknown` and let the AST-mapper validate. */
  ast: unknown;
  stderr: string;
  durationMs: number;
}

export async function runMystExport(
  options: MystExportOptions,
): Promise<MystExportResult> {
  const binary = options.binary ?? 'myst';
  const timeoutMs = options.timeoutMs ?? 60_000;
  const args = options.args ?? [
    'export',
    'tex',
    '--to',
    'mdast',
    options.entryPath,
  ];
  const startedAt = Date.now();

  return await new Promise<MystExportResult>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(
        new LatexImportError(
          'binary-missing',
          `myst spawn failed: ${(err as Error).message}`,
        ),
      );
      return;
    }
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        new LatexImportError(
          'timeout',
          `myst export exceeded ${timeoutMs}ms`,
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
      const reason = err.code === 'ENOENT' ? 'binary-missing' : 'io';
      reject(
        new LatexImportError(
          reason,
          `myst process error: ${err.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new LatexImportError(
            'parse-error',
            `myst export exited ${code}: ${stderr.slice(0, 500)}`,
          ),
        );
        return;
      }
      try {
        const ast: unknown = JSON.parse(stdout || 'null');
        resolve({ ast, stderr, durationMs: Date.now() - startedAt });
      } catch (err) {
        reject(
          new LatexImportError(
            'parse-error',
            `myst export output is not JSON: ${(err as Error).message}`,
          ),
        );
      }
    });
  });
}

/** Probe whether `myst` is callable. Returns the version string (or
 * `'unknown'` if --version doesn't print one) or null if missing. */
export async function probeMystBinary(binary = 'myst'): Promise<string | null> {
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
      if (code === 0) {
        resolve(stdout.trim() || 'unknown');
      } else {
        resolve(null);
      }
    });
  });
}
