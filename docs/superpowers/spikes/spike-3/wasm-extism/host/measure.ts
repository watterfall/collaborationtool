// Spike-3 Extism PoC — cold + warm start measurement.
import createPlugin from '@extism/extism';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

const here = fileURLToPath(new URL('.', import.meta.url));
const wasm = join(here, '..', 'echo_plugin.wasm');

async function newPlugin() {
  return createPlugin(wasm, { useWasi: false, allowedHosts: [] });
}

async function invoke(plugin: Awaited<ReturnType<typeof newPlugin>>, message: string) {
  const r = await plugin.call('echo', JSON.stringify({ message }));
  if (!r) throw new Error('empty response');
  return JSON.parse(r.text());
}

async function main() {
  // Smoke
  const p = await newPlugin();
  const ok = await invoke(p, 'hello');
  console.log('echo:', ok);
  const bad = await invoke(p, 'contains secret here');
  if (bad.rejected_if_secret !== true) throw new Error('FAIL: secret reject');
  await p.close();

  // 100 cold-start (fresh plugin each)
  const coldSamples: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    const pp = await newPlugin();
    await invoke(pp, `cold ${i}`);
    coldSamples.push(performance.now() - t0);
    await pp.close();
  }
  coldSamples.sort((a, b) => a - b);
  console.log(`cold-start median: ${coldSamples[50]!.toFixed(2)}ms`);
  console.log(`cold-start p95:    ${coldSamples[Math.floor(coldSamples.length * 0.95)]!.toFixed(2)}ms`);

  // 1000 warm-start (single plugin reuse)
  const warm = await newPlugin();
  const warmSamples: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    await invoke(warm, `warm ${i}`);
    warmSamples.push(performance.now() - t0);
  }
  warmSamples.sort((a, b) => a - b);
  console.log(`warm-start median: ${warmSamples[500]!.toFixed(3)}ms`);
  console.log(`warm-start p95:    ${warmSamples[Math.floor(warmSamples.length * 0.95)]!.toFixed(3)}ms`);
  await warm.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
