/* ============================================================
   ToonReel — ad slot interface layer
   ------------------------------------------------------------
   The site is free-to-watch, monetized through ads. This file
   is the single integration point: preroll before episodes and
   banner slots on pages.

   AD_CONFIG.provider selects the behavior:
     'none'  → no ads render at all (slots stay empty)
     'demo'  → simulated preroll (3s, skippable) + placeholder
               banner boxes, so the placement is visible in dev
     real networks ('adsense' | 'applovin' | 'unity' | …) →
               implement the two TODOs marked below

   Going live checklist:
     1. set provider + slot ids from your ad network dashboard
     2. implement loadPreroll() (video/interstitial before an
        episode; call onDone() when it finishes)
     3. implement fillBanner() (render a banner into the slot div)
   ============================================================ */

const AD_CONFIG = {
  /* CURRENT MODE: all videos free, no ads shown.
     When monetization starts, switch provider to 'demo' (preview the
     placements) or to a real network id ('adsense' | 'applovin' | 'unity')
     and implement the two TODOs below — nothing else changes. */
  provider: 'none',      /* 'none' | 'demo' | 'adsense' | 'applovin' | 'unity' */
  preroll: { enabled: true, skipAfter: 3, slotId: 'toonreel-preroll' },
  banners: { enabled: true, home: 'toonreel-home-banner', watch: 'toonreel-watch-banner' }
};

/* ---------- preroll ---------- */

/* Play an ad before an episode, then continue via onDone().
   Provider-agnostic: the demo renders a fake ad inline; a real
   SDK would render its own video/interstitial instead. */
function showPreroll(onDone) {
  if (!AD_CONFIG.preroll.enabled || AD_CONFIG.provider === 'none') { onDone(); return; }
  if (AD_CONFIG.provider === 'demo') { demoPreroll(onDone); return; }

  /* TODO (real network), e.g. for IMA/HBX style video ads:
     adNetwork.requestAd({ slot: AD_CONFIG.preroll.slotId })
       .then(ad => ad.playIn(document.getElementById('player')))
       .then(() => onDone())
       .catch(() => onDone());   // never block playback on ad errors */
  onDone();
}

function demoPreroll(onDone) {
  const player = document.getElementById('player');
  if (!player) { onDone(); return; }
  const total = AD_CONFIG.preroll.skipAfter;
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

  const skipBtn = layer.querySelector('.ad-skip');
  let left = total;
  const close = () => { layer.remove(); clearInterval(timer); onDone(); };
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) { close(); return; }
    if (total - left >= 1) { skipBtn.disabled = false; skipBtn.textContent = t('ad_skip_now'); }
    else skipBtn.textContent = t('ad_skip_in', { n: left });
  }, 1000);
  skipBtn.addEventListener('click', () => { if (!skipBtn.disabled) close(); });
}

/* ---------- banner slots ---------- */

/* Render a banner into a slot container. Returns the HTML string
   for demo mode; a real network replaces this with its own fill. */
function adBannerHtml(slotId) {
  if (!AD_CONFIG.banners.enabled || AD_CONFIG.provider === 'none') return '';
  if (AD_CONFIG.provider === 'demo') {
    return `
      <div class="ad-banner-slot" data-slot="${slotId}">
        <span class="ad-tag">${t('ad_label')}</span>
        <span class="ad-banner-note">${t('ad_demo_note')}</span>
      </div>`;
  }
  /* TODO (real network): return your banner markup for slotId */
  return '';
}

function fillBanner(id, slotId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = adBannerHtml(slotId);
}
