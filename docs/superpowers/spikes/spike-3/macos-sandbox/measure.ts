// Spike-3 macOS sandbox-exec PoC — cold-start measurement.
// Spawns the sandboxed plugin 100 times, records median latency.
// Validates "secret" rejection invariant.

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const here = fileURLToPath(new URL('.', import.meta.url));
const runScript = join(here, 'run.sh');

async function invoke(message: string): Promise<{ result: unknown; ms: number }> {
  const start = performance.now();
  const child = spawn('bash', [runScript], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.write(JSON.stringify({ message }));
  child.stdin.end();
  const chunks: Buffer[] = [];
  child.stdout.on('data', (c) => chunks.push(c));
  const exit: number = await new Promise((res) => child.on('close', res));
  if (exit !== 0) throw new Error(`exited ${exit}`);
  const ms = performance.now() - start;
  return { result: JSON.parse(Buffer.concat(chunks).toString('utf8')), ms };
}

async function main() {
  // Smoke
  const ok = await invoke('hello');
  console.log('echo:', ok.result);
  const bad = await invoke('contains secret here');
  if ((bad.result as { rejected_if_secret: boolean }).rejected_if_secret !== true) {
    throw new Error('FAIL: sandbox did not reject "secret" message');
  }
  console.log('reject path OK');

  // 100x cold start
  const samples: number[] = [];
  for (let i = 0; i < 100; i++) {
    const r = await invoke(`message ${i}`);
    samples.push(r.ms);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)]!;
  const p95 = samples[Math.floor(samples.length * 0.95)]!;
  console.log(`cold-start median: ${median.toFixed(2)}ms`);
  console.log(`cold-start p95:    ${p95.toFixed(2)}ms`);
}
main().catch((e) => { console.error(e); process.exit(1); });
