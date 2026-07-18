#!/usr/bin/env bash
# doc-store `.yDoc` escape-hatch gate — Wave A3.3（把 types.ts 里描述的
# 手动 grep 变成可运行的强制门）。
#
# DocumentHandle.yDoc 是刻意保留的 escape hatch（y-prosemirror /
# y-websocket / y-sweet 三个第三方 binding 需要裸 Y.Doc）。业务代码必须
# 走抽象 API（getText / getMap / getXmlFragment / transact / observe /
# encode* / applyUpdate）。本门确保**不新增** `.yDoc` 直穿点。
#
# 允许清单（与 types.ts 文档一致 + Wave A1 vault 绑定）：
#   - doc-store/src         抽象实现自身
#   - sync/setup            editor-core IndexedDB/WebSocket/ySyncPlugin binding
#   - sync-gateway/.../y-sweet   y-sweet HTTP provider
#   - vault/binding, VaultEditor 桌面 vault 绑定（用裸 YDoc，非 handle escape hatch）
#   - vault-fs/src/drift-detector  DetectDriftInput.yDoc 是 vault-fs 自有字段
#   - tests / 注释          测试与文档说明
#
# 命中即非零退出。

set -euo pipefail
cd "$(dirname "$0")/.."

hits=$(grep -rn '\.yDoc\b' apps packages --include='*.ts' --include='*.tsx' \
  | grep -v -E '(doc-store/src|sync/setup|sync-gateway/src/backends/y-sweet|vault/binding|VaultEditor|vault-fs/src/drift-detector)' \
  | grep -v -E '(/tests/|\.test\.ts)' \
  | grep -vE '^\s*[^:]+:[0-9]+:\s*//' \
  | grep -vE ':[0-9]+:.*(//|\*).*\.yDoc' \
  || true)

if [ -n "$hits" ]; then
  echo "✖ doc-store .yDoc gate FAILED — new escape-hatch call site(s):"
  echo "$hits"
  echo
  echo "业务代码请走 DocumentHandle 抽象 API；确需裸 Y.Doc 时先在 types.ts"
  echo "允许清单登记并说明 off-ramp 条件。"
  exit 1
fi

echo "✓ doc-store .yDoc gate PASSED — no new escape-hatch call sites."
