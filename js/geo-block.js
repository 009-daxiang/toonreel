/* ============================================================
   YT688 — region block (mainland China)
   ------------------------------------------------------------
   Two layers:
   1. Offline timezone check (instant, blocks ~all mainland
      visitors: Asia/Shanghai & Asia/Urumqi only — HK/MO/TW
      and all overseas timezones are NOT blocked)
   2. Best-effort geo-IP confirm via free APIs (4s timeout,
      failure = allow)

   Staff bypass: append ?open=1 once per browser session.
   ============================================================ */

(function () {
  if (new URLSearchParams(location.search).has('open')) {
    try { sessionStorage.setItem('yt688:region-ok', '1'); } catch (e) {}
  }
  try {
    if (sessionStorage.getItem('yt688:region-ok') === '1') return;
  } catch (e) {}

  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (TZ === 'Asia/Shanghai' || TZ === 'Asia/Urumqi') return block();

  /* geo-IP confirm (covers VPN-less visitors with non-CN device timezone) */
  const probes = ['https://ipwho.is/', 'https://ipapi.co/json/'];
  let i = 0;
  (function probe() {
    if (i >= probes.length) return; /* both failed → allow */
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 4000);
    fetch(probes[i], { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        clearTimeout(tm);
        const cc = (d.country_code || d.country || '').toUpperCase();
        if (cc === 'CN') return block();
        i += 1;
        probe();
      })
      .catch(() => { clearTimeout(tm); i += 1; probe(); });
  })();

  function block() {
    document.documentElement.innerHTML =
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Not available in your region</title><style>' +
      'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
      'background:#0a0a14;color:#e8e8f0;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}' +
      '.c{max-width:520px;text-align:center;padding:40px 28px}' +
      '.logo{font-size:26px;font-weight:900;letter-spacing:1px;margin-bottom:34px}' +
      '.logo b{color:#a78bfa}.logo i{background:linear-gradient(135deg,#8b5cf6,#22d3ee);' +
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-style:normal}' +
      'h1{font-size:20px;font-weight:700;margin:0 0 14px;line-height:1.6}' +
      '.en{font-size:13px;color:#8a8aa0;line-height:1.7;margin-top:18px}' +
      '</style></head><body><div class="c">' +
      '<div class="logo"><b>YT</b><i>688</i></div>' +
      '<h1>该网站在您所在的地区不可用</h1>' +
      '<div class="en">This website is not available in your region.<br>' +
      'We apologise for the inconvenience.</div>' +
      '</div></body>';
    document.documentElement.style.background = '#0a0a14';
    throw new Error('region-blocked'); /* stop all other scripts */
  }
})();
