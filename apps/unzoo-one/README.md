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
