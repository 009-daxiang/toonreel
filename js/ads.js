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

const AD_CONFIG = {
  /* developer preview only; 'none' = ads fully off */
  provider: 'none',

  preroll: {
    enabled: true,
    skipAfter: 5,                       /* seconds before Skip appears */
    vastTagUrl: ''                      /* ← paste VAST tag URL here to go live */
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

/* ============================================================
   PREROLL
   ============================================================ */

function showPreroll(onDone) {
  const cfg = AD_CONFIG.preroll;
  if (!cfg.enabled) { onDone(); return; }
  if (cfg.vastTagUrl) { vastPreroll(onDone); return; }
  if (AD_CONFIG.provider === 'demo') { demoPreroll(onDone); return; }
  onDone();
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
