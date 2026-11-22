/* ============================================================
   YT688 — ad monetization layer
   ------------------------------------------------------------
   Site is free-to-watch. Two independent monetization slots,
   both OFF until you fill in real credentials:

   1. PREROLL (video ad before each episode)
      → set preroll.vastTagUrl to a VAST 2.0/3.0/4.0 tag.
        VAST tags are what most networks give you: Adsterra,
        BidMachine, Galaksion, or a direct-sold campaign.
      → a light VAST parser picks the video file and plays it
        in the player (skippable, auto-continues the episode).

   2. DISPLAY BANNERS (home + watch pages)
      → set banners.adsense.client + slot ids from AdSense.
        The AdSense loader script is injected automatically.
        (Other networks: override adBannerHtml() with their tag.)

   Developer preview: provider 'demo' shows placeholder ads.

   Revenue model (typical, entertainment/streaming traffic):
     display banners   ~$1–4 CPM (SEA), ~$4–10 (US/EU)
     video preroll     ~$3–15 CPM depending on geo + network
     → earnings = impressions / 1000 × CPM
   ============================================================ */

const SMARTLINK = 'https://asiafilm.org/4/2b66f01c239b08026b02194a784ae883'; /* Adsterra Smartlink — live */
const SMARTLINK_FREQ = 24 * 60 * 60 * 1000; /* one ad per visitor per 24h */

const AD_CONFIG = {
  /* developer preview only; 'none' = ads fully off */
  provider: 'none',

  preroll: {
    enabled: true,
    skipAfter: 5,                       /* seconds before Skip appears */
    vastTagUrl: 'https://funny-tooth.com/dLmlFnznd.GbN/v/ZoGuUA/SeQmS9NuDZvUol-klPxTsc-2uN/DykfzbMFTAchtANSzFYD0oOvTGM/yrM-Ql' /* HilltopAds VAST 3.0 — live */
  },

  banners: {
    enabled: true,
    adsense: {
      client: '',                       /* ← ca-pub-XXXXXXXXXXXXXXXX */
      slotHome: '',                     /* ← home banner slot id */
      slotWatch: ''                     /* ← watch page banner slot id */
    }
  }
};

/* SMARTLINK popup: retired — rewarded VAST unlock is the live ad format */

/* ============================================================
   PREROLL
   ============================================================ */

/* ---------- EPISODE UNLOCK: EP1-5 free; rewarded unlock batches of 10 ---------- */
const UNLOCK_FREE_EPS = 5;
const UNLOCK_BATCH = 10;
const FIRST_UNLOCK_KEY = 'toonreel:first_unlock';
const unlockKey = (id) => `toonreel:unlocked:${id}`;
function unlockedThrough(showId) {
  return parseInt(localStorage.getItem(unlockKey(showId)) || String(UNLOCK_FREE_EPS), 10);
}
function firstUnlockUsed() {
  return localStorage.getItem(FIRST_UNLOCK_KEY) === '1';
}
function markFirstUnlock() {
  localStorage.setItem(FIRST_UNLOCK_KEY, '1');
}
function grantUnlock(showId, throughEp) {
  localStorage.setItem(unlockKey(showId), String(Math.max(unlockedThrough(showId), throughEp)));
}
function episodeAccessible(showId, ep) {
  return ep <= UNLOCK_FREE_EPS || ep <= unlockedThrough(showId);
}
/* Gate: free/unlocked -> onPlay(); locked -> unlock card (first unlock ad-free) */
function episodeGate(showId, ep, onPlay) {
  if (episodeAccessible(showId, ep)) { onPlay(); return; }
  const player = document.getElementById('player');
  if (!player) { grantUnlock(showId, ep + UNLOCK_BATCH - 1); onPlay(); return; }
  /* 清理上一集遗留的播放器 UI：暂停视频、隐藏点播层，避免遮挡解锁卡片 */
  try { document.getElementById('video').pause(); } catch {}
  if (typeof hideTapToPlay === 'function') hideTapToPlay();
  const from = unlockedThrough(showId) + 1;
  const to = ep + UNLOCK_BATCH - 1;
  const firstFree = !firstUnlockUsed();
  const layer = document.createElement('div');
  layer.className = 'ad-layer ad-unlock';
  layer.innerHTML = `
    <div style="max-width:430px;margin:0 auto;text-align:center;background:#14142a;border:1px solid rgba(139,92,246,.35);border-radius:18px;padding:30px 24px;color:#e8e8f4;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif">
      <div style="font-size:11px;letter-spacing:2px;color:#8b5cf6;text-transform:uppercase">Free preview used</div>
      <h3 style="margin:10px 0 8px;font-size:20px">EP ${ep} is locked</h3>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#b9b9cf">EP1&ndash;5 are always free. Unlock the next 10 episodes with a short ad &mdash; no sign-up needed.</p>
      <button id="adUnlockBtn" style="width:100%;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(90deg,#8b5cf6,#e50914);color:#fff;font-size:16px;font-weight:700;cursor:pointer">${firstFree ? '&#9654; Unlock now &mdash; free' : '&#9654; Watch a short ad to unlock'}</button>
      <p style="margin:14px 0 0;font-size:12px;color:#8a8aa3">Unlocks EP ${from}&ndash;${to} &middot; No sign-up &middot; EP1&ndash;5 always free</p>
    </div>`;
  player.appendChild(layer);
  layer.querySelector('#adUnlockBtn').addEventListener('click', () => {
    const proceed = () => {
      grantUnlock(showId, to);
      markFirstUnlock();
      layer.remove();
      onPlay();
    };
    if (firstFree) { markFirstUnlock(); proceed(); return; }
    if (!AD_CONFIG.preroll.vastTagUrl) { proceed(); return; }
    vastPreroll(proceed);
  });
}

/* Lightweight VAST client: fetch tag → resolve Wrapper (1 hop) →
   play first Linear MediaFile. Any failure silently skips the ad
   so episodes always play. */
async function vastPreroll(onDone) {
  const player = document.getElementById('player');
  if (!player) { onDone(); return; }
  let mediaUrl = null;
  try {
    mediaUrl = await resolveVastMediaFile(AD_CONFIG.preroll.vastTagUrl);
  } catch { onDone(); return; }
  if (!mediaUrl) { onDone(); return; }

  const layer = document.createElement('div');
  layer.className = 'ad-layer ad-video';
  layer.innerHTML = `
    <span class="ad-tag">${t('ad_label')}</span>
    <video class="ad-video-el" src="${mediaUrl}" autoplay playsinline></video>
    <button class="ad-skip" disabled>${t('ad_skip_in', { n: AD_CONFIG.preroll.skipAfter })}</button>`;
  player.appendChild(layer);

  const ad = layer.querySelector('.ad-video-el');
  const skip = layer.querySelector('.ad-skip');
  let left = AD_CONFIG.preroll.skipAfter;
  const done = () => { layer.remove(); onDone(); };
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) { skip.disabled = false; skip.textContent = t('ad_skip_now'); }
    else skip.textContent = t('ad_skip_in', { n: left });
  }, 1000);

  ad.addEventListener('ended', () => { clearInterval(timer); done(); });
  skip.addEventListener('click', () => { if (!skip.disabled) { clearInterval(timer); done(); } });
  ad.play().catch(() => { ad.muted = true; ad.play().catch(() => { clearInterval(timer); done(); }); });
}

async function resolveVastMediaFile(tagUrl, depth = 0) {
  const doc = new DOMParser().parseFromString(
    await (await fetch(tagUrl, { cache: 'no-store' })).text(), 'application/xml');
  if (depth < 2) {
    const wrapper = doc.querySelector('Wrapper VASTAdTagURI');
    if (wrapper) return resolveVastMediaFile(wrapper.textContent.trim(), depth + 1);
  }
  const files = [...doc.querySelectorAll('Linear MediaFile')];
  const best = files.find(f => (f.getAttribute('type') || '').includes('mp4'))
           || files.find(f => (f.getAttribute('delivery') || 'progressive') === 'progressive')
           || files[0];
  return best ? best.textContent.trim() : null;
}

/* demo preroll (placeholder creative, skippable) */
function demoPreroll(onDone) {
  const player = document.getElementById('player');
  if (!player) { onDone(); return; }
  const total = 3;
  const layer = document.createElement('div');
  layer.className = 'ad-layer';
  layer.innerHTML = `
    <span class="ad-tag">${t('ad_label')}</span>
    <div class="ad-creative">
      <div class="ad-brand">Your Ad Here</div>
      <div class="ad-sub">${t('ad_demo_note')}</div>
    </div>
    <button class="ad-skip" disabled>${t('ad_skip_in', { n: total })}</button>`;
  player.appendChild(layer);
  const skip = layer.querySelector('.ad-skip');
  let left = total;
  const close = () => { layer.remove(); clearInterval(timer); onDone(); };
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) { close(); return; }
    if (total - left >= 1) { skip.disabled = false; skip.textContent = t('ad_skip_now'); }
    else skip.textContent = t('ad_skip_in', { n: left });
  }, 1000);
  skip.addEventListener('click', () => { if (!skip.disabled) close(); });
}

/* ============================================================
   DISPLAY BANNERS
   ============================================================ */

let adsenseLoaded = false;
function loadAdsense(client) {
  if (adsenseLoaded) return;
  adsenseLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

function adBannerHtml(slotId) {
  const a = AD_CONFIG.banners;
  if (!a.enabled) return '';
  if (a.adsense.client && a.adsense[slotId]) {
    loadAdsense(a.adsense.client);
    return `<ins class="adsbygoogle ad-adsense" style="display:block"
      data-ad-client="${a.adsense.client}" data-ad-slot="${a.adsense[slotId]}"
      data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    /* the (adsbygoogle = window.adsbygoogle || []).push({}) is issued
       by fillBanner() after the <ins> is in the DOM */
  }
  if (AD_CONFIG.provider === 'demo') {
    return `
      <div class="ad-banner-slot" data-slot="${slotId}">
        <span class="ad-tag">${t('ad_label')}</span>
        <span class="ad-banner-note">${t('ad_demo_note')}</span>
      </div>`;
  }
  /* TODO (other networks): return your banner tag for slotId here */
  return '';
}

function fillBanner(id, slotId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = adBannerHtml(slotId);
  /* adsbygoogle push needs to run after the <ins> is in the DOM */
  try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
}
