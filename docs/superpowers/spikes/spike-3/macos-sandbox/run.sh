#!/bin/bash
# Spawn echo plugin under sandbox-exec. Host passes input on stdin.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec sandbox-exec -f "$DIR/echo-plugin.sb" "$DIR/echo-plugin.sh"
