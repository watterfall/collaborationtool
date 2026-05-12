# Spike-1 Runtime Acceptance Playbook — User-Executable

> Phase 6 W2 — 4 runtime gates 留给 release owner（jili）手动执行。Spike-1 (`98e3f30` merge) 代码侧全 PASS；本文档把 4 个 DEFERRED runtime 项工程化为可执行步骤。

最后更新：2026-05-12（Phase 6 W2）。

---

## 0. 这是什么 / 给谁看

Spike-1 代码侧（apps/desktop/ Tauri shell + apps/web/ desktop-bridge + local-ollama + InlineAgentMenu）全 PASS。但 5 验收 spec §8 中 4 项需要 **真实运行环境**：

| Gate | DEFERRED 原因 |
|---|---|
| G1 3 平台 binary via GH Actions | workflow_dispatch 需 repo owner trigger |
| G2 套远端 web URL smoke | 需 live Postgres + better-auth |
| G3 .paper 文件关联 + deep-link 真触发 | 需 release build install 到 OS |
| G4 macOS notarize + Win sign | 需 Apple Developer + Microsoft cert procurement |

本 playbook = "**给 release owner 一份顺序清单**"。每 gate 列：prereqs → 命令 → 期望输出 → 失败模式 → 回滚。

**当前 user 决策点**：哪些 gate 现在跑 / 哪些推 Phase 6 W3-W4 / 哪些跳到 W11-W12 closeout。

---

## G1 — 3 平台 binary via GitHub Actions desktop-release pipeline

### Prereqs

1. **当前分支已 merge to main**：✅ Spike-1 已合 `98e3f30`
2. **GitHub Actions 已启用**：检查 https://github.com/<org>/collaborationtool/actions/workflows/desktop-release.yml
3. **Repo secrets 已配**（**G1 不需 signing secrets** —— dev profile 即可）：
   - 无 —— dev unsigned build 不需 secrets
4. **Workflow YAML 已 commit**：✅ `.github/workflows/desktop-release.yml`（Spike-1 task 10）

### Trigger

```bash
gh workflow run desktop-release.yml -f dry_run=true
# OR via GitHub Web UI:
#   Actions → desktop-release → Run workflow → branch: main → "Run workflow"
```

### 期望输出

CI matrix build 3 jobs（macOS / Windows / Linux）all green：

| 平台 | 产出 artifact |
|---|---|
| macOS (arm64 + x64) | `.dmg` (unsigned) + `.app.tar.gz` |
| Windows | `.msi` (unsigned) + `.exe` portable |
| Linux | `.deb` + `.AppImage` |

**Spike-1 G1 接受**：matrix build 3/3 success，binary 可下载到本地（不要求 signed）。

### 失败模式

| 症状 | 诊断 | 回滚 |
|---|---|---|
| macOS build fail "xcrun: error" | macOS runner SDK 缺失 | check runners 配置：`macos-15` actions/runner-images 必须 latest |
| Windows build fail "wix candle.exe not found" | WiX toolset 缺失 | install via `choco install wix -y` step in workflow |
| Linux build fail "javascriptcoregtk-4.1 not found" | apt deps 缺 | add `apt install libjavascriptcoregtk-4.1-dev libsoup-3.0-dev` |
| Rust 编译 timeout > 60 min | cold cache | enable `actions/cache@v4` for `~/.cargo` + `src-tauri/target` |
| pnpm install 慢 / fail | npm registry 网络 | retry / 切换镜像 (NPM_CONFIG_REGISTRY env) |

### 验收 + 落档

下载 3 平台 binary → 本地执行（`./Collaboration\ Tool.app` / `installer.msi` / `./Collaboration\ Tool.AppImage`）→ webview 显示登录页（dev URL=localhost:3000，本机无 Next.js dev 时显示"Server unavailable"页—— 接受，因为这是 G1 不是 G2）。

落档：编辑 `docs/superpowers/reports/2026-05-11-spike-1-report.md` G1 行 `DEFERRED → PASS` + run-id 链接 + 实测时间。

---

## G2 — 套远端 web URL 跑通登录 / 编辑 / 同步

### Prereqs

1. **G1 已 PASS**（要 native binary 套远端 URL）
2. **远端 web app 已部署**：可达 URL（如 `https://collab.example.com`）
3. **远端 Postgres** + **远端 sync-gateway** 都已 live
4. **better-auth ORCID OAuth env 已配**（ADR-0015 Phase 4 W8 ORCID redirect URI）

### 修改本机 config + 重新 build

`apps/desktop/src-tauri/tauri.conf.json` 改 build.devUrl + frontendDist：

```jsonc
"build": {
  "beforeDevCommand": "...",  // 不变
  "devUrl": "https://collab.example.com",  // 改这里
  "frontendDist": "https://collab.example.com"  // 改这里（远端 standalone）
}
```

或保留 dev URL 改为 release build profile：`pnpm desktop:build --target aarch64-apple-darwin` 产 prod binary，prod binary 默认套 prod URL（per Tauri 2.x 约定）。

### Trigger

```bash
# 本机重新 build prod binary
pnpm desktop:build

# 跑产物
open apps/desktop/src-tauri/target/release/bundle/macos/Collaboration\ Tool.app  # macOS
# 或对应 Windows / Linux 路径
```

### 期望输出

1. webview 显示远端登录页
2. 点 "ORCID 登录" → 浏览器内 OAuth 跳转 → 回跳到 collabtool://oauth-callback → desktop deep-link 接管 → webview 显示登录成功
3. 进入编辑器 → 创建一个 doc → 输入文字 → 第二个 client（另一台机器/浏览器 tab）打开同 doc → 实时同步可见
4. 关 desktop wifi 30 min → 编辑 → 重连 → sync 完成（spec §9 G9）

### 失败模式

| 症状 | 诊断 |
|---|---|
| ORCID OAuth 跳转后 collabtool:// 不打开 | deep-link `bundle.fileAssociations` `.paper` 配置或 plugins.deep-link.schemes 没 reload；macOS 走 `lsregister -kill -r -domain local -domain system -domain user` |
| sync-gateway WS 连不上 | CORS / Origin header 检查；远端 sync-gateway 必须 allow `tauri://localhost` origin |
| Postgres 连接被 reject | better-auth env DB_URL 拼写；用 PG `pg_stat_activity` 查实际连接 |

### 验收 + 落档

成功完整跑通登录 + 编辑 + 同步 + 离线 30 min round-trip = G2 PASS。

落档：spike-1 report G2 行 `DEFERRED → PASS` + 实测注意事项。

---

## G3 — 系统集成（.paper 文件关联 + deep-link + 系统托盘 + 通知）

### Prereqs

1. **G1 已 PASS**（need release-profile binary 安装到 OS）
2. **macOS / Windows / Linux 各一台机器**（或 VM）

### Per-OS 安装 + 触发

#### macOS

```bash
# install
open Collaboration\ Tool.dmg
# drag to /Applications

# trigger fileAssociations
touch ~/test.paper
echo "# test paper" > ~/test.paper
open ~/test.paper
# expect: Collaboration Tool 启动 + webview 加载 test.paper
```

```bash
# trigger deep-link
open "collabtool://test-deeplink?param=value"
# expect: Collaboration Tool 启动 / 切前台 + webview 收到 deep-link event
```

#### Windows

```powershell
# install
Start-Process .\Collaboration-Tool-Setup.msi

# trigger fileAssociations
New-Item -Path "$env:USERPROFILE\test.paper" -ItemType File
Set-Content "$env:USERPROFILE\test.paper" "# test paper"
Invoke-Item "$env:USERPROFILE\test.paper"
```

#### Linux

```bash
sudo dpkg -i Collaboration-Tool.deb
# OR
chmod +x Collaboration-Tool.AppImage && ./Collaboration-Tool.AppImage

xdg-mime default Collaboration\ Tool.desktop application/x-paper
echo "# test paper" > ~/test.paper
xdg-open ~/test.paper
```

### 期望输出（per OS）

- macOS：menubar tray icon 显示 + 右键菜单（中英双语，per Spike-1 task 7）
- Windows：systray icon + balloon notification on `.paper` open
- Linux：systray icon (need StatusNotifierItem support; some Wayland 缺) + libnotify notification

### 失败模式

| 症状 | OS | 修复 |
|---|---|---|
| `.paper` 关联未生效 | macOS | `lsregister -kill -r -domain local -domain system -domain user`; restart Finder |
| deep-link 不响应 | macOS | `Info.plist` CFBundleURLTypes 未注册；release build 缺；rebuild + reinstall |
| tray icon 不显示 | Linux Wayland | GNOME 缺 StatusNotifierItem extension；用 `gnome-extensions install AppIndicator` |
| Windows MSI install 报 "untrusted" | Windows | 期望 —— G4 解决（code signing） |

### 验收 + 落档

3 OS 各跑 fileAssociations + deep-link + tray + notification = G3 PASS。落档同 G1/G2。

---

## G4 — macOS notarize + Windows code signing

### G4-A: macOS notarization

#### Prereqs

1. **Apple Developer Program membership**（$99/yr）— 注册到 https://developer.apple.com
2. **Developer ID Application certificate**（Apple Developer Account → Certificates → Developer ID Application）
3. **App-specific password** for notarization（Apple ID → Sign-In and Security → App-Specific Passwords）

#### GH Actions secrets to add

```
APPLE_CERTIFICATE              # base64-encoded .p12
APPLE_CERTIFICATE_PASSWORD     # .p12 password
APPLE_ID                       # apple developer account email
APPLE_TEAM_ID                  # 10-char team ID from Apple Developer
APPLE_APP_SPECIFIC_PASSWORD    # app-specific password (xxxx-xxxx-xxxx-xxxx)
```

#### Workflow 修改

`.github/workflows/desktop-release.yml` macOS job add:

```yaml
- name: import Apple certificate
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    echo "$APPLE_CERTIFICATE" | base64 --decode > /tmp/cert.p12
    security create-keychain -p "" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "" build.keychain
    security import /tmp/cert.p12 -k build.keychain -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "" build.keychain

- name: tauri build --target aarch64-apple-darwin
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_SIGNING_IDENTITY: "Developer ID Application: <name> (<team_id>)"
  run: pnpm desktop:build --target aarch64-apple-darwin
```

Tauri 2.x **automates** notarize call if env vars set —— no extra step needed.

#### 期望输出

```
✔ signed Collaboration Tool.app
✔ submitted for notarization
✔ status: Accepted (~3-15 min)
✔ stapled ticket to Collaboration Tool.app
```

#### 失败模式

| 症状 | 修复 |
|---|---|
| "Developer ID Application" identity not found | 确认 cert 真 imported；check `security find-identity -v -p codesigning` |
| notarize "Invalid" with hardened-runtime missing | Tauri 2.x 默认 enable hardened；check `tauri.conf.json` `macOS.entitlements` |
| timeout > 30 min | Apple notarize backend 慢；retry workflow |

### G4-B: Windows code signing

#### Prereqs

1. **EV Code Signing certificate**（推荐，~$300-500/yr from Sectigo / DigiCert）
   - **alternative**：standard code signing cert（~$80/yr），SmartScreen 仍会警告"unknown publisher"直到累积 reputation
2. **签名时 HSM 或 USB token**（EV cert）—— **不能** export cert 到 CI 直接用；CI 需 Azure Key Vault / SignPath / DigiCert KeyLocker 等签名服务

#### GH Actions secrets to add (via SignPath as example)

```
SIGNPATH_TOKEN
SIGNPATH_ORG_ID
SIGNPATH_PROJECT_SLUG
SIGNPATH_SIGNING_POLICY_SLUG
```

#### Workflow

`.github/workflows/desktop-release.yml` Windows job add SignPath signing step（详 SignPath docs；不在 plugin scope inline 完整 YAML）。

#### 期望输出

```
✔ signed Collaboration-Tool-Setup.msi (Authenticode)
✔ MS SmartScreen verified publisher: <company name>
```

#### 失败模式

| 症状 | 修复 |
|---|---|
| `signtool error: SignerSign() failed (-2147024891 / Access is denied)` | HSM permissions 配置 / SignPath policy slug wrong |
| SmartScreen 仍警告 | Standard cert + 累积 reputation 需 1-3 个月 + N 个安装；考虑升 EV cert |
| Tauri 2.x 不识别 SignPath integration | 用 post-build step 手动 sign，per Tauri docs "Custom Sign Command" |

#### 替代：Spike-1 阶段接受 self-signed / unsigned

如果 cert procurement 推迟，**G4 接受 unsigned binary**（per spike-1 report "Spike-1 接受 dev profile"）—— user 自己 install 时 OS 会警告但仍可绕过。Phase 7+ 升 production 前必须解决。

---

## 4 Gate 串行 vs 并行决策

| 路径 | 时间估算 | 风险 |
|---|---|---|
| **A**（推荐）串行：G1 → G2 → G3 → G4 | 1-3 周（含 cert procurement waiting） | 低；问题逐个解决 |
| B 并行 G1+G2，G3+G4 推后 | 1 周 + 2 周 | 中；G2 依赖 G1 |
| C 全部推 Phase 7+ closeout | 0 immediate effort | 高；Spike-1 deferred 没有 close-loop |
| D 仅 G1 + G3，G2/G4 推后 | 3-5 天 | 中；binary build + 系统集成验证 OK，云协作 + signing 推 |

---

## 5. 落档 protocol

每跑通一个 gate：

1. 编辑 `docs/superpowers/reports/2026-05-11-spike-1-report.md` 对应行 `DEFERRED → PASS`
2. 加 run-id link / 实测注意事项 / 实测时间
3. 若失败：mark `DEFERRED → FAIL`，加诊断 + planned fix（issue link / PR / Phase 6 W3-W4 task）
4. STATUS.md 顶 "最后更新" 行追加 gate status

4 gate 全 PASS 时：
- ADR-0017 §6 review log 追加 "Phase 6 W2 runtime gates G1-G4 全 PASS" entry
- ADR-0017 Status: Proposed → **Accepted with caveat**（其余 dogfood gate G5-G10 仍 Phase 6 W6-W11 继续）
- spike-1 report 最末追"4 gate runtime acceptance summary"

---

## 6. 联系人 / 谁可以触发

| Gate | 谁能触发 | 备注 |
|---|---|---|
| G1 | release owner / maintainer（GH Actions write 权限） | 不需 cert |
| G2 | 同 G1 + 有 prod web URL 访问权 | 需 ORCID dev account |
| G3 | 任何机器 owner（各 OS 各一台） | binary install 即可 |
| G4 | release owner + cert holder（同一人通常） | Apple Developer + EV cert procurement |

---

## 7. References

- `.github/workflows/desktop-release.yml`（Spike-1 task 10 落地）
- `apps/desktop/UPDATER_README.md`（Spike-1 task 9，minisign keypair 生成步骤）
- `docs/superpowers/specs/2026-05-11-client-first-pivot-design.md` §8 Spike-1 验收 + §9 Phase 6 dogfood gates
- `docs/superpowers/reports/2026-05-11-spike-1-report.md`
- ADR-0017 §3 "Bad / Trade-offs" "桌面分发负担"段
- Tauri 2.x signing docs: https://v2.tauri.app/distribute/sign/
- Apple notarize: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- SignPath: https://signpath.io/
- Microsoft SmartScreen Smart App Control: https://learn.microsoft.com/en-us/windows/security/threat-protection/windows-defender-smartscreen/
