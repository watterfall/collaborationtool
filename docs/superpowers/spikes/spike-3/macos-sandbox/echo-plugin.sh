#!/bin/bash
# Echo plugin reference impl. Reads JSON from stdin, writes JSON to stdout.
# Used by all PoCs; in macOS PoC runs under sandbox-exec.

set -euo pipefail
input=$(cat)
message=$(echo "$input" | jq -r '.message')
if [[ "$message" == *secret* ]]; then
  echo '{"echoed":"REJECTED","rejected_if_secret":true}'
else
  echo "{\"echoed\":$(echo "$input" | jq '.message'),\"rejected_if_secret\":false}"
fi
