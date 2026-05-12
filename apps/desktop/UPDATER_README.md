# Updater Signing — Spike-1 PoC

Tauri 2 updater 用 minisign（Tauri 内置 CLI 包装）。

## 一次性生成 keypair

```bash
cd apps/desktop
pnpm tauri signer generate -w ~/.tauri/collabtool.key
# 提示输入 passphrase（保管好）
# 产出:
#   ~/.tauri/collabtool.key (private, **不要 commit**)
#   ~/.tauri/collabtool.key.pub (public, 复制到 tauri.conf.json updater.pubkey)
```

## CI 用

在 GitHub repo settings → Secrets：
- `TAURI_SIGNING_PRIVATE_KEY` = 私钥文件内容（cat 进去）
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = passphrase

## 本地 release build 用

```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/collabtool.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<your passphrase>'
pnpm desktop:build
```

## Spike-1 简化

Spike-1 仍然产出 release bundle，但 updater endpoint 暂未上线（不存在升级源）。
正式 updater endpoint 上线推到 Phase 6 W2。

## 占位字段（必须由 release owner 替换）

`apps/desktop/src-tauri/tauri.conf.json` plugins.updater：

- `endpoints[0]` 中 `<org>` 占位 → 替换为真实 GitHub org / repo
- `pubkey` 占位 → 替换为 `~/.tauri/collabtool.key.pub` 文件内容
