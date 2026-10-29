# ToonReel 🎬 — AI Micro Drama Streaming Site (SEA-ready)

面向东南亚市场的 AI 漫剧（AI-animated micro drama）流媒体网站演示版。
纯静态实现（HTML/CSS/JS，零依赖、零构建），可直接部署到 GitHub Pages / Netlify / Vercel / Cloudflare Pages。

> ⚠️ 当前为 **Demo 版**：视频用的是公开示例片源，海报是程序生成的 SVG 占位图，金币解锁为本地演示逻辑（localStorage）。

## APP 分发（免应用商店，四平台）

**下载页 `/download.html`**（顶栏 Get the App 按钮入口，移动端另有底部安装横幅），按访问者平台自动排序卡片：

| 平台 | 当前提供的安装方式 | 原生包位（放入 `downloads/` 自动出现在页面） |
|---|---|---|
| **Mac** | ✅ **真安装包**：`tools/build_mac_app.sh` 一键构建 WKWebView 壳 APP（universal 二进制，指向线上站点） | `toonreel-mac.zip` / `.dmg`（已内置） |
| **Windows** | ✅ PWA 一键安装（Chrome/Edge 地址栏"安装"，独立窗口运行） | `toonreel-setup.exe` / `toonreel-win.zip` |
| **Android** | ✅ PWA 安装 + APK 直装位 | `toonreel.apk`（可带版本号） |
| **iPhone/iPad** | ✅ PWA 三步引导（Safari → 分享 → 添加到主屏幕） | `toonreel.ipa`（可选） |

所有包位通过 `GET /api/app/info` 自动探测，显示**版本号 + 文件大小**；纯静态托管自动退回 HEAD 探测。没放原生包时按钮置灰并提示"打包中，可先使用网页版"。

站点本身是完整 PWA（manifest + Service Worker 离线壳 + 自动生成 APP 图标 `tools/gen_icons.py`），任何平台都能"安装"。

## 管理后台（上传漫剧）

打开 **`/admin.html`** 即可管理所有漫剧：新增 / 编辑 / 删除、配置每集视频、选海报风格或填海报 URL、设置分类/集数/评分/热度，**保存 → Publish** 发布上线。

两种运行模式（后台会自动探测并显示在顶栏）：

| 模式 | 视频上传 | 发布 | 适用 |
|---|---|---|---|
| **API 模式**（跑着 server.js 或 server.py） | 表单里直接上传文件 → 存到 `/uploads` | 一键发布，**立即生效** | 正式运营（VPS / 云主机） |
| **静态模式**（仅 GitHub Pages 等静态托管） | 填视频 URL（CDN / 对象存储） | 下载 `catalog.json` → 放进 `data/` → 重新部署 | 免运维起步 |

站点所有页面启动时会自动加载 `data/catalog.json`（不存在则显示内置 demo 剧）。

### 启动后端（二选一，均为零依赖）

```bash
python3 server.py        # 或: node server.js
# → http://localhost:3000   admin 显示 "API connected"
```

## 商业模式：免费观看 + 广告位（已预留）

全站**所有剧集免费**，无金币/付费解锁。变现走广告，接口层在 **`js/ads.js`**：

```js
const AD_CONFIG = {
  provider: 'demo',   // 'none'（不显示）| 'demo'（演示广告）| 接入后填网络名
  preroll:  { enabled: true, skipAfter: 3, slotId: 'toonreel-preroll' },
  banners:  { enabled: true, home: 'toonreel-home-banner', watch: 'toonreel-watch-banner' }
};
```

- **片头广告**：每集播放前展示，可跳过（demo 为 3 秒占位广告）；接入点 `showPreroll(onDone)`
- **Banner 位**：首页（分类网格下方）与播放页（剧集列表下方）各一个；接入点 `fillBanner()`
- **接入真实广告网络**（Google AdSense / AdMob / AppLovin / Unity Ads）：把 `provider` 改为网络名，实现 `showPreroll()` 与 `adBannerHtml()` 里标注 TODO 的两个函数即可，站点其余部分无需改动

后端 `/api/payments/*` 端点仍保留在 server.js / server.py 中（未来做混合变现时可复用）。

## 多语言（8 种）

站内右上角地球按钮可随时切换，选择保存在 localStorage；首次访问按浏览器语言自动匹配（中文浏览器自动区分简繁：zh-CN→简体，zh-TW/HK→繁体）：

English · 简体中文 · 繁體中文 · Bahasa Indonesia · ไทย · Tiếng Việt · Bahasa Melayu · Filipino

界面框架文案 + 分类名全部本地化（剧集标题/简介暂为英文原稿，正式上线时由内容侧提供本地化）。
字典在 `js/i18n.js`，页面静态文案用 `data-i18n`，动态字符串走 `t(key, vars)`。

## 页面布局（参考 ReelShort / DramaBox 等主流短剧平台）

| 视图 | 说明 |
|---|---|
| Home `#/` | Hero 轮播、继续观看、Top 10 Today（带排名角标）、Trending / 新作 / 完结横滑栏 |
| Ranking `#/rank` | 排行榜：Most Popular / Highest Rated / New 三个榜单，金色前三名 |
| Genres `#/genres` | 分类筛选 + 剧集网格 |
| My List `#/mylist` | 收藏列表（空状态提示） |
| watch.html | 9:16 竖屏播放器、静音自动连播、剧集列表（前 3 集免费）、金币解锁弹窗、收藏、分享 |
| admin.html | 内容后台：漫剧增删改、视频上传、发布 |

移动端为底部 Tab 栏导航（Home / Ranking / Genres / My List），语言切换按钮在顶栏。

| 文件 | 说明 |
|---|---|
| `index.html` / `watch.html` / `admin.html` / `download.html` | 前台两页 + 后台 + App 下载页 |
| `js/data.js` | 内容目录：内置 12 部 demo 剧；自动加载后台发布的 `data/catalog.json` |
| `js/i18n.js` | 六语言字典 + 切换引擎 + 语言菜单 |
| `js/ads.js` | 广告位接口层：片头广告 + banner 位、AD_CONFIG 配置 |
| `js/store.js` | 本地状态：金币余额、收藏、观看进度、已解锁集数（localStorage） |
| `js/app.js` / `js/watch.js` / `js/admin.js` | 首页 / 播放页 / 后台逻辑 |
| `server.js` / `server.py` | 可选零依赖后端（功能等价，选其一）：静态托管 + 上传 + 发布 + 支付端点 stub + APK 探测 |
| `manifest.webmanifest` / `sw.js` / `assets/icons/` / `tools/gen_icons.py` | PWA：应用清单、离线缓存、APP 图标及生成脚本 |
| `downloads/` | APK/IPA 安装包放置处（见其中 README） |

## 本地预览

```bash
cd toonreel
python3 server.py            # 推荐（带后台 API）
# 或 python3 -m http.server 8080   （纯静态，后台走导出模式）
# 打开 http://localhost:3000
```

## 部署

**静态托管（GitHub Pages / Netlify / Vercel）**：整个目录推上去即可。后台用静态模式（填视频 URL → 导出 catalog.json → 提交到 `data/`）。

**自有服务器 / 云主机**：`node server.js` 或 `python3 server.py`（建议配 nginx 反代 + HTTPS）。上传即发布，支付端点就绪。

## 换成真实内容

1. **视频**：后台逐集上传，或批量传到 CDN 后在后台填 URL（`SHOWS[].videos` 数组，索引 0 = 第 1 集）；
2. **海报**：后台填图片 URL，或用内置风格生成器（图案 motif + 双色 + 强调色实时预览）；
3. **加剧 / 改集数**：后台表单操作，`SHOWS` 数组结构见 `data.js` 顶部注释（含 `epTitles` 可选字段）；
4. **付费参数**：免费集数 `FREE_EPISODES` 与单集价格 `UNLOCK_PRICE` 在 `data.js` 顶部；充值套餐在 `js/payments.js` 的 `PAYMENT_CONFIG.packages`。

## 建议的后续迭代

- [ ] 接入真实视频与海报素材；剧集标题/简介的多语言化
- [ ] 接入真实广告网络（js/ads.js 两个 TODO）+ 广告收益统计
- [ ] 后台加登录鉴权（当前 admin 无密码，上线前必须加）
- [ ] TikTok 式上下滑动切换剧集（移动端）
- [ ] 每部剧独立落地页 + 多语言 sitemap + OG 分享卡（SEO/社媒引流）
