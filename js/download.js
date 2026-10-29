/* ============================================================
   ToonReel — download page logic (4 platforms)
   • detects the visitor's platform and lifts that card first
   • probes downloads/ for packaged apps (API first, HEAD fallback)
   • wires PWA one-tap install where the browser supports it
   • fills the QR code with the site URL
   ============================================================ */

const ua = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/.test(ua);
const isMacOS = /Macintosh/.test(ua) && !isIOS;
const isWindows = /Windows/.test(ua);

/* ---------- platform card ordering ---------- */
(function orderCards() {
  const cards = document.getElementById('dlCards');
  const order = isAndroid ? ['cardAndroid', 'cardIos', 'cardMac', 'cardWin']
    : isIOS ? ['cardIos', 'cardAndroid', 'cardMac', 'cardWin']
    : isMacOS ? ['cardMac', 'cardWin', 'cardAndroid', 'cardIos']
    : isWindows ? ['cardWin', 'cardMac', 'cardAndroid', 'cardIos']
    : null;
  if (!order) return;
  order.forEach(id => cards.appendChild(document.getElementById(id)));
})();

/* ---------- PWA one-tap install buttons ---------- */
function wirePwaButton(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const update = () => {
    if (window.PWA.installEvent) {
      btn.hidden = false;
      btn.textContent = t('install_pwa');
      btn.onclick = () => window.PWA.promptInstall();
    }
  };
  update();
  document.addEventListener('pwa:installable', update);
}

/* ---------- package probing ---------- */
function fmtSize(b) {
  return b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
}
function setDownload(btnId, labelId, url, size, version, labelKey) {
  const btn = document.getElementById(btnId);
  const label = document.getElementById(labelId);
  if (!btn || !label) return;
  btn.hidden = false;
  btn.href = url;
  const v = version ? ` · v${version}` : '';
  const s = size ? ` · ${fmtSize(size)}` : '';
  label.textContent = `${t(labelKey)}${v}${s}`;
}
function markMissing(btnId, noteId, noteKey) {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.hidden = false;
    btn.classList.add('disabled');
    btn.removeAttribute('href');
    btn.setAttribute('aria-disabled', 'true');
  }
  if (noteId && noteKey) {
    const note = document.getElementById(noteId);
    if (note) note.textContent = t(noteKey);
  }
}

async function probePackages() {
  let info = null;
  try {
    const r = await fetch('/api/app/info');
    info = await r.json();
  } catch { /* static hosting — fall back to HEAD probes */ }

  async function headOk(url) {
    try { const h = await fetch(url, { method: 'HEAD' }); return h.ok; } catch { return false; }
  }
  async function headSize(url) {
    try { return +(await fetch(url, { method: 'HEAD' })).headers.get('Content-Length') || 0; } catch { return 0; }
  }

  /* Android APK */
  if (info?.apk?.available) {
    setDownload('apkBtn', 'apkBtnLabel', info.apk.url, info.apk.size, info.apk.version, 'apk_download');
  } else if (await headOk('downloads/toonreel.apk')) {
    setDownload('apkBtn', 'apkBtnLabel', 'downloads/toonreel.apk', await headSize('downloads/toonreel.apk'), null, 'apk_download');
  } else {
    markMissing('apkBtn', 'apkNote', 'apk_missing');
  }

  /* Mac zip / dmg */
  const mac = info?.mac?.available ? info.mac
    : (await headOk('downloads/toonreel-mac.zip') ? { url: 'downloads/toonreel-mac.zip', size: await headSize('downloads/toonreel-mac.zip'), version: null } : null);
  if (mac) setDownload('macBtn', 'macBtnLabel', mac.url, mac.size, mac.version, 'dl_mac');
  else markMissing('macBtn', 'macNote', 'mac_missing');

  /* iOS IPA (optional extra under the PWA steps) */
  const ipa = info?.ipa?.available ? info.ipa
    : (await headOk('downloads/toonreel.ipa') ? { url: 'downloads/toonreel.ipa', size: await headSize('downloads/toonreel.ipa'), version: null } : null);
  if (ipa) setDownload('ipaBtn', 'ipaBtnLabel', ipa.url, ipa.size, ipa.version, 'dl_ipa');

  /* Windows exe (optional extra under the PWA install) */
  const exe = info?.win?.available ? info.win
    : (await headOk('downloads/toonreel-setup.exe') ? { url: 'downloads/toonreel-setup.exe', size: await headSize('downloads/toonreel-setup.exe'), version: null } : null);
  if (exe) setDownload('exeBtn', 'exeBtnLabel', exe.url, exe.size, exe.version, 'dl_win');
}

/* ---------- language ---------- */
initLang(() => {
  applyI18n();
  probePackages();
  ['pwaAndroid', 'pwaMac'].forEach(wirePwaButton);
});
probePackages();
['pwaAndroid', 'pwaMac'].forEach(wirePwaButton);

/* ---------- QR code ---------- */
(function fillQr() {
  const img = document.getElementById('qrImg');
  if (!img) return;
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&bgcolor=0a0a14&color=ffffff&data='
    + encodeURIComponent(location.origin + location.pathname.replace(/download\.html.*$/, ''));
  img.onerror = () => { img.style.display = 'none'; };
})();

/* ---------- toast ---------- */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => el.classList.remove('show'), 2400);
}
