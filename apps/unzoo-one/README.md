# Unzoo One 桌面客户端

Unzoo One 是它自己后台服务（Core）的一个客户端；终端是另一个。任务、定时、
智能体会话和收件箱都在后台服务里，窗口关了照样跑。

- 外壳：Tauri 2（`src-tauri/`）。启动时确保后台服务在跑（没有就以 `--headless`
  启动 `unterm-core`），把地址和令牌通过 `core_connection` 命令交给页面。
- 界面：仓库根目录 `app/` 的控制台，静态构建（`npm run build:static` → `dist/client`）
  打包进客户端。
- 终端：侧栏"打开终端"启动安装目录里的 `unterm.exe`，它连到同一个后台服务。

## 开发

```powershell
# 后台服务和终端（unterm/ 工作区）
cd unterm; cargo build -p unterm-core -p unterm-app; cd ..
# 界面
npm run build:static
# 客户端（开发时会在 unterm/target 里找后台服务和终端）
cd apps/unzoo-one/src-tauri; cargo run
```

`UNTERM_STATE_DIR` 指向一个空目录即可在隔离环境里试，不碰本机已有的数据。

## 安装包

```powershell
powershell -File apps\unzoo-one\build-installer.ps1
```

依次构建后台服务与终端（release）、界面，把运行时文件放进 `src-tauri/payload`，
再由 Tauri 打出 MSI（`src-tauri/target/release/bundle/msi`）。安装目录是平铺的：
`Unzoo One.exe`、`unterm-core.exe`、`unterm.exe`、`unterm-cli.exe` 和终端的辅助文件，
各自都在同一目录里找彼此。

### 签名

不签名的安装包，Windows SmartScreen 会拦一道“已保护你的电脑”。发布用的包要用代码签名证书签：

```powershell
# 证书在系统证书库里（EV 证书的 USB 令牌、或云 HSM 的 KSP 通常是这样）
$env:UNZOO_SIGN_THUMBPRINT = "<证书 SHA-1 指纹>"
# 或者是 .pfx 文件
$env:UNZOO_SIGN_PFX = "C:\path\to\codesign.pfx"; $env:UNZOO_SIGN_PFX_PASSWORD = "..."
# 可选：时间戳服务器，默认 http://timestamp.digicert.com
$env:UNZOO_SIGN_TIMESTAMP = "http://timestamp.digicert.com"

powershell -File apps\unzoo-one\build-installer.ps1 -RequireSignature
```

- `sign.ps1` 用 Windows SDK 的 `signtool`（SHA-256，带 RFC 3161 时间戳，证书过期后签名仍有效）。
- 先签放进安装包的运行时文件（`unterm*.exe`、DLL）；客户端本身和两个 MSI 由 Tauri 用同一个脚本签
  （`bundle.windows.signCommand`，构建时临时加上）。已经带有效签名的文件（微软的 `OpenConsole.exe`、
  `conpty.dll`）原样保留。
- 没配证书时照样能打包，脚本开头会说明这是未签名的包；`-RequireSignature` 下没证书直接失败，
  打完还会检查两个 MSI 确实带了签名。
- 买证书：面向欧美用户建议 EV 代码签名证书，SmartScreen 立即信任；普通（OV）证书要积累下载量后
  才不再提示。

## 开机后台运行

设置 › 运行偏好的“登录系统后在后台运行”：打开后，登录系统时以 `--background` 启动客户端，
它只把后台服务拉起来、不开窗口，随即退出。重启电脑后定时任务不用等人打开 Unzoo One。

| 系统 | 写在哪里 |
|---|---|
| Windows | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` 的 `Unzoo One` |
| macOS | `~/Library/LaunchAgents/ai.unzoo.one.background.plist`（RunAtLoad） |
| Linux | `$XDG_CONFIG_HOME/autostart/ai.unzoo.one.desktop`（默认 `~/.config`） |

都只属于当前用户，不需要管理员权限，也都会出现在系统自己的“登录项 / 启动应用”列表里。
macOS 和 Linux 的安装包还没有做（`build-installer.ps1` 只打 Windows MSI），这部分代码先就位。
