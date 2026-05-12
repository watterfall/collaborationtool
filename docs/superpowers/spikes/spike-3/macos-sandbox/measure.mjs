// Spike-3 macOS sandbox-exec PoC — cold-start measurement (plain Node, no tsx).
// Spawns the sandboxed plugin 100 times, records median latency.
// Validates "secret" rejection invariant.

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const here = dirname(fileURLToPath(import.meta.url));
const sbProfile = join(here, 'echo-plugin.sb');
const pluginScript = join(here, 'echo-plugin.sh');

async function invoke(message) {
  const start = performance.now();
  // Invoke sandbox-exec directly to avoid needing chmod on run.sh
  const child = spawn(
    '/usr/bin/sandbox-exec',
    ['-f', sbProfile, '/bin/bash', pluginScript],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  child.stdin.write(JSON.stringify({ message }));
  child.stdin.end();
  const out = [];
  const err = [];
  child.stdout.on('data', (c) => out.push(c));
  child.stderr.on('data', (c) => err.push(c));
  const exit = await new Promise((res) => child.on('close', res));
  if (exit !== 0) {
    throw new Error(`exited ${exit}: ${Buffer.concat(err).toString('utf8')}`);
  }
  const ms = performance.now() - start;
  return { result: JSON.parse(Buffer.concat(out).toString('utf8')), ms };
}

async function main() {
  // Smoke
  const ok = await invoke('hello');
  console.log('echo:', JSON.stringify(ok.result));
  const bad = await invoke('contains secret here');
  if (bad.result.rejected_if_secret !== true) {
    throw new Error('FAIL: sandbox did not reject "secret" message');
  }
  console.log('reject path OK:', JSON.stringify(bad.result));

  // 100x cold start
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const r = await invoke(`message ${i}`);
    samples.push(r.ms);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const min = samples[0];
  const max = samples[samples.length - 1];
  console.log(`cold-start min:    ${min.toFixed(2)}ms`);
  console.log(`cold-start median: ${median.toFixed(2)}ms`);
  console.log(`cold-start p95:    ${p95.toFixed(2)}ms`);
  console.log(`cold-start max:    ${max.toFixed(2)}ms`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
