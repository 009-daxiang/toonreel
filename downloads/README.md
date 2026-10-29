# App packages (自有分发)

把构建好的安装包放进本目录，下载页（download.html）会自动探测并展示版本和大小：

- `toonreel.apk` — Android 安装包；带版本号更好：`toonreel-1.0.2.apk`
- `toonreel.ipa` — iOS 包（可选；普通网站签名分发受限，iOS 用户主推下载页上的“添加到主屏幕”PWA 安装）
- `toonreel-mac.zip` / `toonreel-mac.dmg` — macOS 包（本仓库已内置一个构建脚本：`tools/build_mac_app.sh`，跑一次自动生成）
- `toonreel-setup.exe` / `toonreel-win.zip` — Windows 包（预留；Windows 用户当前主推浏览器“安装 APP”即 PWA）

下载页通过 `GET /api/app/info`（server.js / server.py）读取文件信息；
纯静态托管时自动退回 HEAD 请求探测 `downloads/toonreel.apk`。

## 打一个最简 WebView 壳 APK（可选）

有 Android Studio 环境时，新建 Empty Views Activity 项目：

- `MainActivity` 里放一个 WebView，加载站点 URL（或离线壳 + 远程目录）
- `AndroidManifest.xml` 加 `<uses-permission android:name="android.permission.INTERNET"/>`
- 构建 release APK 后重命名为本目录约定文件名即可

需要系统化打包（推送、内购、Crash 上报）时再考虑接入 Capacitor / Tauri Mobile。
