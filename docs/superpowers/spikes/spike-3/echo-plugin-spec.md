# Echo Plugin Spec (Spike-3 shared contract)

Every PoC implements this plugin and host. Differences in IPC channel
(stdin/stdout vs Extism func vs Win32 named pipe) are noted per PoC.

## Input

JSON object on stdin (or equivalent IPC frame):

```json
{ "message": "string, free-form, may contain 'secret'" }
```

## Output

JSON object on stdout:

```json
{
  "echoed": "string mirroring input.message",
  "rejected_if_secret": "boolean, true iff input.message contains 'secret'"
}
```

If input.message contains "secret" (case-sensitive substring), output's
`echoed` MUST be the literal string `"REJECTED"` and `rejected_if_secret`
MUST be true. This validates the sandbox enforces the policy boundary —
not just that it can run the plugin.

## Measurement

Each PoC reports:

1. **Cold-start latency** — time from "host requests spawn" to
   "plugin replies first byte". Median of 100 runs.
2. **Warm-start latency** — same metric after first invocation (if the
   runtime caches).
3. **NPM compat** — does loading a simple npm package (`lodash.escape`)
   work? Y/N + caveats.
4. **Security guarantee** — what the OS / WASM VM actually enforces
   (filesystem read/write blocked? network blocked? syscall whitelist?).
