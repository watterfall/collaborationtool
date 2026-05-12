# @collaborationtool/desktop

> Phase 5 Wave B Spike-1 — Tauri 2.x desktop shell for Collaboration Tool.

## 目的（Spike-1）

验证 Tauri 2 套 Next.js web + 系统集成 + 本地 ollama inline AI 5-7 天交付 3 平台 binary 是否可行。
**不实现** client-first 反转 / vault-fs / sandbox（那些是 Spike-2 / 3 + Phase 6）。

## 本地起步

### 前置

- Rust toolchain（`cargo --version` ≥ 1.75）
- macOS / Linux / Windows host
- Ollama（可选，用于 inline AI 本地推理）：
  - macOS: `brew install ollama && ollama serve && ollama pull llama3.2`
  - Linux: `curl -fsSL https://ollama.com/install.sh | sh`

### 跑 dev

```bash
# Terminal 1
pnpm web:dev      # Next.js on :3000

# Terminal 2
pnpm desktop:dev  # Tauri webview pointing to :3000
```

### Build release（本地）

```bash
pnpm desktop:build
# 产出位置：apps/desktop/src-tauri/target/release/bundle/
```

### Build release（CI）

push tag `desktop-v0.1.0` 触发 `.github/workflows/desktop-release.yml`，4 平台 build 上传到 GitHub Release。

## Spike-1 验收清单

参考 `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §8。

## 已知 Spike-1 局限

- Icon 是 8×8 placeholder（Phase 6 W1 替换为品牌资源）
- Updater endpoint 是占位（Phase 6 W2 上线真 release endpoint）
- macOS notarization / Windows code signing 未配（Phase 6 W2 配 cert）
- `.paper` 文件关联 release build 后验证（dev 不触发）
- `tauri-plugin-shell::open` deprecation warning（Phase 6 W1 换 `tauri-plugin-opener`）
- `frontendDist` 暂指 `../dist` 占位（gitignored），dev 用 devUrl；release build
  需切到 `apps/web/.next/standalone`（Phase 6 W1 调）
