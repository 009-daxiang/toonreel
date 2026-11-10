# 项目约定

- 当前线上部署为 GitHub Pages，自定义域名由 `CNAME` 指定为 `yt688.app`。保持纯静态 HTML/CSS/JavaScript 可用，无构建步骤，不依赖运行中的后端。
- `server.js` 和 `server.py` 是可选后端，GitHub Pages 不会执行它们。新增功能不得默认要求线上存在 `/api/*`。
- 剧目数据位于 `data/catalog.json`，视频和封面路径由现有数据定义。当前本地检出排除了 MP4；不要将本地缺少视频误判为线上文件缺失，也不要未经要求下载全部视频。
- 修改缓存中的脚本或样式时更新 `sw.js` 的缓存版本；新增页面依赖时同步维护 `SHELL`。预缓存资源必须存在，不缓存视频或后端 API 响应。
- 可选后端只允许提供明确列出的公开资源。用户数据、统计日志、仓库元数据和服务端源码不得通过静态路由暴露，符号链接也须遵守该限制。

## 本地验证

在项目根目录执行，无需安装依赖：

```sh
node --test tests/frontend.test.js
python3 tests/backend_static.py
```

前端测试需要支持 `node:test` 的 Node.js（建议 18+）。后端测试同时调用 Node.js 和 Python 3，使用临时目录，不修改真实用户数据。

纯静态页面预览：`python3 -m http.server 8765 --bind 127.0.0.1`。本地未下载的视频不能用于实际播放验证；完成检查后关闭预览进程。

## 播放器约定

- 初次打开剧集等待用户点击；点击播放请求整个播放器容器全屏，避免原生视频全屏屏蔽网页手势和控制栏。
- 全屏内上滑下一集、下滑上一集；进度条、按钮、复选框不参与切集手势。首末集不越界、不循环。
- “自动播放下一集”每次打开页面默认勾选；取消后本集结束停止，手动切集仍然可用。
- 无元素全屏 API 的浏览器/WebView 使用铺满窗口模式并提供退出按钮；有 API 但调用失败时显示并记录错误，不静默掩盖。
- 播放/暂停图标跟随媒体事件；播放完成处理器只能注册一次。异步片头回调须校验当前加载版本。

## 客户端下载现状

- `download.html`、`js/download.js` 和 `js/pwa.js` 提供安装入口；GitHub Pages 下依赖 PWA 和 `downloads/` 静态包，不依赖 `/api/app/info`。
- 当前仓库只有 `downloads/toonreel-mac.zip` 原生安装包。Mac 客户端是加载线上站点的 WKWebView 壳；Android/iOS/Windows 主要走网页安装引导，不能据此宣称已有 APK/IPA/EXE。
- `tools/build_mac_app.sh` 会生成并启动应用，常规网页测试不要执行它，也不要额外安装应用副本。
