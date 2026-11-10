#!/usr/bin/env python3
"""Generate per-drama landing pages (SEO), sitemap.xml and robots.txt
from data/catalog.json. Run after every catalog change; output goes to
drama/ and the repo root. Static hosting friendly (GitHub Pages)."""
import json
import os
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://yt688.app"
catalog_path = os.path.join(os.path.dirname(ROOT), "data", "catalog.json")
drama_dir = os.path.join(os.path.dirname(ROOT), "drama")
os.makedirs(drama_dir, exist_ok=True)

catalog = json.load(open(catalog_path, encoding="utf-8"))
shows = catalog["shows"]

PAGE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title} — 全集免费观看 | YT688 短剧</title>
  <meta name="description" content="{desc}" />
  <meta property="og:title" content="{title} — YT688 短剧" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:type" content="video.tv_show" />
  <meta property="og:image" content="{poster}" />
  <meta property="og:url" content="{page_url}" />
  <link rel="canonical" href="{page_url}" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%238b5cf6'/%3E%3Cpath d='M38 28 L74 50 L38 72 Z' fill='white'/%3E%3C/svg%3E" />
  <link rel="stylesheet" href="css/style.css" />
  <style>
    .lp-main {{ max-width: 900px; margin: 0 auto; padding: 40px 24px 90px; }}
    .lp-head {{ display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-start; }}
    .lp-poster {{ width: 210px; border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.5); }}
    .lp-info h1 {{ font-size: 1.9rem; font-weight: 850; margin-bottom: 10px; }}
    .lp-info .meta {{ color: #9a9ab0; font-size: .9rem; margin-bottom: 14px; }}
    .lp-info .desc {{ color: #c9c9dd; line-height: 1.8; margin-bottom: 20px; }}
    .lp-cta {{ display: flex; gap: 12px; flex-wrap: wrap; }}
    .lp-eps {{ margin-top: 36px; }}
    .lp-eps h2 {{ font-size: 1.2rem; font-weight: 800; margin-bottom: 14px; }}
    .lp-eps .grid-eps {{ display: flex; flex-wrap: wrap; gap: 8px; }}
    .lp-eps a {{ padding: 9px 14px; border-radius: 10px; background: #17172a;
      border: 1px solid rgba(255,255,255,.08); color: #d8d8ea; font-size: .85rem;
      text-decoration: none; }}
    .lp-eps a:hover {{ border-color: #8b5cf6; color: #fff; }}
    .lp-back {{ display: inline-block; margin-bottom: 22px; color: #9a9ab0; text-decoration: none; font-size: .88rem; }}
    .lp-back:hover {{ color: #fff; }}
    .lp-note {{ margin-top: 26px; padding: 14px 18px; border-radius: 12px;
      background: rgba(139,92,246,.1); color: #c4b5fd; font-size: .85rem; }}
  </style>
  <script src="../js/analytics-config.js" defer></script>
  <script src="../js/visitor-analytics.js" defer></script>
</head>
<body>
  <header class="nav">
    <a class="logo" href="index.html"><span class="mark">▶</span>
      <span class="wordmark">YT<span class="grad">688</span></span></a>
    <div class="nav-spacer"></div>
    <a class="btn btn-ghost sm-btn" href="download.html">下载 APP</a>
  </header>
  <main class="lp-main">
    <a class="lp-back" href="index.html">← 返回全部短剧</a>
    <div class="lp-head">
      <img class="lp-poster" src="{poster}" alt="{title} 封面" />
      <div class="lp-info">
        <h1>{title}</h1>
        <div class="meta">{genres} · {episodes} 集 · {status} · ⭐ {rating}</div>
        <div class="desc">{desc}</div>
        <div class="lp-cta">
          <a class="btn btn-primary" href="{watch_url}">▶ 免费观看全集</a>
          <a class="btn btn-ghost" href="download.html">📱 下载 APP</a>
        </div>
      </div>
    </div>
    <div class="lp-eps">
      <h2>剧集列表（{episodes} 集，全部免费）</h2>
      <div class="grid-eps">{ep_links}</div>
      <p class="lp-note">💡 每集免费观看，无需注册。手机观看体验更佳——
        <a href="download.html" style="color:#c4b5fd">下载 YT688 APP</a>。</p>
    </div>
  </main>
</body>
</html>
"""

ep_links_html = ""
for s in shows:
    links = "\n".join(
        f'        <a href="watch.html?id={s["id"]}&ep={n}">第 {n} 集</a>'
        for n in range(1, s["episodes"] + 1))
    page_url = f"{SITE}/drama/{s['id']}.html"
    poster = s.get("poster") or ""
    if poster.startswith("/"):
        poster = SITE + poster
    desc = (s.get("desc") or f"{s['title']}——{s['episodes']} 集免费短剧，YT688 每日更新。")[:300]
    html_out = PAGE.format(
        title=s["title"], desc=desc, poster=poster, page_url=page_url,
        genres=" · ".join(s.get("genres", ["短剧"])), episodes=s["episodes"],
        status=s.get("status", "Completed"), rating=s.get("rating", 9.0),
        watch_url=f"watch.html?id={s['id']}&ep=1", ep_links=links)
    out = os.path.join(drama_dir, f"{s['id']}.html")
    changed = (not os.path.exists(out)) or open(out, encoding="utf-8").read() != html_out
    open(out, "w", encoding="utf-8").write(html_out)
    print(("new " if changed else "same ") + out)

# sitemap
pages = [f"{SITE}/", f"{SITE}/download.html", f"{SITE}/privacy.html"]
pages += [f"{SITE}/drama/{s['id']}.html" for s in shows]
sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(f"  <url><loc>{u}</loc></url>" for u in pages)
           + "\n</urlset>\n")
open(os.path.join(os.path.dirname(ROOT), "sitemap.xml"), "w", encoding="utf-8").write(sitemap)
open(os.path.join(os.path.dirname(ROOT), "robots.txt"), "w").write(
    "User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /uploads/\n"
    f"Sitemap: {SITE}/sitemap.xml\n")
print(f"sitemap.xml: {len(pages)} urls | robots.txt written")
