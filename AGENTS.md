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
