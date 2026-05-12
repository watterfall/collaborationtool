// Spike-3 Extism PoC — single-invocation smoke run.
import createPlugin from '@extism/extism';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const wasm = join(here, '..', 'echo_plugin.wasm');

async function main() {
  const plugin = await createPlugin(wasm, { useWasi: false, allowedHosts: [] });
  const ok = await plugin.call('echo', JSON.stringify({ message: 'hello' }));
  if (!ok) throw new Error('empty response');
  console.log('echo:', ok.text());

  const bad = await plugin.call('echo', JSON.stringify({ message: 'this is secret' }));
  if (!bad) throw new Error('empty response');
  const parsed = JSON.parse(bad.text());
  if (parsed.rejected_if_secret !== true) throw new Error('FAIL: secret not rejected');
  console.log('reject path OK:', bad.text());

  await plugin.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
