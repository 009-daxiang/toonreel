/* ============================================================
   ToonReel — watch page logic
   ============================================================ */

const params = new URLSearchParams(location.search);
let show, currentEp; /* resolved in boot(), after the catalog loads */

const player = document.getElementById('player');
const autoNext = document.getElementById('autoNext');
const playerError = document.getElementById('playerError');
const inlinePlayBtn = document.getElementById('inlinePlayBtn');
const inlinePlayIcon = document.getElementById('inlinePlayIcon');
const prevBtn = document.getElementById('prevBtn');
const exitFsBtn = document.getElementById('exitFsBtn');
const video = document.getElementById('video');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const muteBtn = document.getElementById('muteBtn');
const muteIcon = document.getElementById('muteIcon');
const muteWave = document.getElementById('muteWave');
const progress = document.getElementById('progress');
const tCur = document.getElementById('tCur');
const tDur = document.getElementById('tDur');
const nextBtn = document.getElementById('nextBtn');
const fsBtn = document.getElementById('fsBtn');
const tapZone = document.getElementById('tapZone');
const discIcon = document.getElementById('discIcon');
const epList = document.getElementById('epList');

const PLAY_PATH = 'M8 5l12 7-12 7z';
const PAUSE_PATH = 'M7 5h4v14H7zM13 5h4v14h-4z';

/* ---------- page info ---------- */
function renderInfo() {
  document.title = `${show.title} — YT688`;
  const sb = document.getElementById('shareBtn');
  if (sb) { sb.dataset.shareTitle = show.title; sb.dataset.shareId = show.id; }
  document.getElementById('badges').innerHTML = `
    <span class="pill">${t('ai_original')}</span>
    ${show.badge ? `<span class="pill ghost">${badgeLabel(show.badge)}</span>` : ''}
    <span class="pill ghost">${show.status === 'Completed' ? t('status_completed') : t('status_ongoing')}</span>`;
  document.getElementById('showTitle').textContent = show.title;
  document.getElementById('showTagline').textContent = show.tagline;
  document.getElementById('showStats').innerHTML = `
    <span><b>⭐ ${show.rating.toFixed(1)}</b> ${t('rating')}</span>
    <span>${show.episodes} ${t('eps_total')}</span>
    <span>${trGenres(show)}</span>
    <span>${show.year}</span>`;
  document.getElementById('showDesc').textContent = show.desc;
  document.getElementById('epCount').textContent = `· ${show.episodes} ${t('eps_total')}`;
  document.getElementById('freeHint').textContent = t('free_with_ads');
  updateFavBtns();
  updateControlLabels();
}

function updateFavBtns() {
  const fav = isFav(show.id);
  document.getElementById('favBtn').innerHTML = heartIcon(fav);
  document.getElementById('favBtn').classList.toggle('on', fav);
  document.getElementById('favBtn').style.color = fav ? '#fb5c8d' : '#fff';
  const infoFav = document.getElementById('infoFav');
  infoFav.innerHTML = `${heartIcon(fav)}&nbsp;${fav ? t('in_list') : t('add_list')}`;
}

document.getElementById('favBtn').addEventListener('click', () => {
  showToast(toggleFav(show.id) ? t('added_list') : t('removed_list'));
  updateFavBtns();
});
document.getElementById('infoFav').addEventListener('click', () => {
  showToast(toggleFav(show.id) ? t('added_list') : t('removed_list'));
  updateFavBtns();
});
/* share button handled by js/share.js (multi-channel modal) */

/* ---------- episode list ---------- */
function renderEpisodes() {
  epList.innerHTML = '';
  for (let ep = 1; ep <= show.episodes; ep++) {
    const btn = document.createElement('button');
    btn.className = 'ep-item' + (ep === currentEp ? ' current' : '');
    btn.dataset.ep = ep;
    btn.innerHTML = `
      <span class="num">${ep}</span>
      <span class="et">
        <span class="name">${ep === currentEp ? '▶ ' : ''}${epTitle(show, ep)}</span>
        <span class="sub">${ep === 1 ? t('ep_free') : '&nbsp;'}</span>
      </span>`;
    btn.addEventListener('click', () => selectEp(ep));
    epList.appendChild(btn);
  }
}

function selectEp(ep) {
  if (ep === currentEp || ep < 1 || ep > show.episodes) return;
  currentEp = ep;
  loadEp(true);
}

function updateUrl() {
  history.replaceState(null, '', `watch.html?id=${show.id}&ep=${currentEp}`);
}

/* ---------- player ---------- */
function hudText() {
  const label = t('ep_label', { n: currentEp });
  const name = epTitle(show, currentEp);
  return name === t('ep_n', { n: currentEp }) ? label : `${label} · ${name}`;
}

let loadVersion = 0;
let trackedPlay = false;
let playerErrorKey = null;
function loadEp(autoplay) {
  const version = ++loadVersion;
  trackedPlay = false;
  playerError.hidden = true;
  playerErrorKey = null;
  video.pause();
  setPlayingUI(false);
  updateUrl();
  document.getElementById('hudEpNum').textContent = hudText();
  renderEpisodes();
  highlightNavBtns();
  showPreroll(() => {
    if (version !== loadVersion) return;
    video.poster = posterFor(show);
    video.src = videoUrlFor(show, currentEp);
    video.load();
    progress.value = 0;
    tCur.textContent = tDur.textContent = '0:00';
    if (autoplay) playVideo();
    else showTapToPlay();
  });
}

function reportPlayerError(key, error) {
  playerErrorKey = key;
  console.error('[Player]', { show: show?.id, episode: currentEp, src: video.currentSrc || video.src, error }, error?.name, error?.message || error?.code);
  playerError.textContent = t(key);
  playerError.hidden = false;
}

function playVideo() {
  const version = loadVersion;
  return video.play().catch(error => {
    if (version !== loadVersion || error.name === 'AbortError') {
      console.debug('[Player] Playback interrupted', { version, currentVersion: loadVersion, error });
      return;
    }
    showTapToPlay();
    reportPlayerError(error.name === 'NotAllowedError' ? 'tap_play' : 'play_failed', error);
  });
}

/* Register once: changing episodes must not accumulate completion handlers. */
video.addEventListener('ended', () => {
  YTAnalytics.track('complete', { show: show.id, ep: currentEp });
  if (autoNext.checked && currentEp < show.episodes) goNext();
});

function highlightNavBtns() {
  document.getElementById('prevEp').disabled = currentEp <= 1;
  document.getElementById('nextEp').disabled = currentEp >= show.episodes;
  nextBtn.disabled = currentEp >= show.episodes;
  prevBtn.disabled = currentEp <= 1;
}

document.getElementById('prevEp').addEventListener('click', goPrev);
prevBtn.addEventListener('click', goPrev);
document.getElementById('nextEp').addEventListener('click', goNext);
nextBtn.addEventListener('click', goNext);
function goNext() { if (show && currentEp < show.episodes) selectEp(currentEp + 1); }
function goPrev() { if (show && currentEp > 1) selectEp(currentEp - 1); }

/* The media events are the source of truth for both sets of icons. */
function labelControl(element, key) {
  element.setAttribute('aria-label', t(key));
  element.title = t(key);
}
function updateControlLabels() {
  [playBtn, inlinePlayBtn].forEach(btn => labelControl(btn, video.paused ? 'player_play' : 'player_pause'));
  [prevBtn, document.getElementById('prevEp')].forEach(btn => labelControl(btn, 'prev_ep'));
  [nextBtn, document.getElementById('nextEp')].forEach(btn => labelControl(btn, 'next_ep'));
  labelControl(fsBtn, isFullscreen() ? 'exit_fullscreen' : 'enter_fullscreen');
  labelControl(exitFsBtn, 'exit_fullscreen');
}
function setPlayingUI(playing) {
  [playIcon, inlinePlayIcon, discIcon].forEach(icon => icon.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH));
  player.classList.toggle('playing-pause', !playing);
  updateControlLabels();
}
function togglePlay() {
  if (!show) return;
  if (video.paused) {
    enterFullscreen(); // Call synchronously within the user gesture.
    playVideo();
  } else {
    video.pause();
  }
}
playBtn.addEventListener('click', togglePlay);
inlinePlayBtn.addEventListener('click', togglePlay);
tapZone.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);
video.addEventListener('play', () => {
  setPlayingUI(true);
  hideTapToPlay();
  if (playerErrorKey !== 'fullscreen_failed') playerError.hidden = true;
  if (!trackedPlay) {
    trackedPlay = true;
    YTAnalytics.track('play', { show: show.id, ep: currentEp });
  }
});
video.addEventListener('pause', () => setPlayingUI(false));
video.addEventListener('error', () => {
  showTapToPlay();
  reportPlayerError('play_failed', video.error);
});

/* mute */
muteBtn.addEventListener('click', () => {
  video.muted = !video.muted;
  muteWave.style.display = video.muted ? 'none' : '';
  muteIcon.style.opacity = video.muted ? '.55' : '1';
});

/* progress + time */
function fmt(s) {
  if (!isFinite(s)) return '0:00';
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
let scrubbing = false;
video.addEventListener('timeupdate', () => {
  if (!scrubbing && video.duration) {
    progress.value = Math.round((video.currentTime / video.duration) * 1000);
    saveProgress(show.id, currentEp, video.currentTime / video.duration);
  }
  tCur.textContent = fmt(video.currentTime);
});
video.addEventListener('durationchange', () => { tDur.textContent = fmt(video.duration); });
progress.addEventListener('input', () => {
  scrubbing = true;
  if (video.duration) video.currentTime = (progress.value / 1000) * video.duration;
});
progress.addEventListener('change', () => { scrubbing = false; });

/* Fullscreen the container so custom controls and swipe gestures remain available.
   WebViews without the element Fullscreen API use an explicit viewport mode. */
let viewportFullscreen = false;
let fullscreenPending = false;
let focusBeforeFullscreen = null;
let inertOutside = [];
function isFullscreen() {
  return document.fullscreenElement === player || viewportFullscreen;
}
function syncFullscreen() {
  const active = isFullscreen();
  if (active && playerErrorKey === 'fullscreen_failed') playerError.hidden = true;
  player.classList.toggle('is-fullscreen', active);
  document.body.classList.toggle('player-fullscreen', active);
  exitFsBtn.hidden = !active;
  if (active && !inertOutside.length) {
    let child = player;
    while (child.parentElement && child !== document.body) {
      for (const sibling of child.parentElement.children) {
        if (sibling !== child) { inertOutside.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      child = child.parentElement;
    }
    exitFsBtn.focus({ preventScroll: true });
  } else if (!active) {
    inertOutside.forEach(([element, inert]) => { element.inert = inert; });
    inertOutside = [];
    focusBeforeFullscreen?.focus({ preventScroll: true });
  }
  updateControlLabels();
}
async function enterFullscreen() {
  if (isFullscreen() || fullscreenPending) return;
  focusBeforeFullscreen = document.activeElement;
  if (!player.requestFullscreen || document.fullscreenEnabled === false) {
    console.info('[Player] Element fullscreen unavailable; using viewport mode');
    viewportFullscreen = true;
    syncFullscreen();
    return;
  }
  fullscreenPending = true;
  try { await player.requestFullscreen(); }
  catch (error) { reportPlayerError('fullscreen_failed', error); }
  finally { fullscreenPending = false; }
}
async function exitFullscreen() {
  if (viewportFullscreen) {
    viewportFullscreen = false;
    syncFullscreen();
  } else if (document.fullscreenElement === player) {
    try { await document.exitFullscreen(); }
    catch (error) { reportPlayerError('fullscreen_failed', error); }
  }
}
fsBtn.addEventListener('click', () => isFullscreen() ? exitFullscreen() : enterFullscreen());
exitFsBtn.addEventListener('click', exitFullscreen);
document.addEventListener('fullscreenchange', syncFullscreen);

/* Ignore editable controls and let native button/checkbox keyboard actions work. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && viewportFullscreen) { e.preventDefault(); exitFullscreen(); return; }
  if (e.target.matches('input, textarea, select, button, a, [contenteditable="true"]')) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight' && video.duration) video.currentTime += 5;
  else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5);
  else if (e.key === 'ArrowUp' && isFullscreen()) { e.preventDefault(); goPrev(); }
  else if (e.key === 'ArrowDown' && isFullscreen()) { e.preventDefault(); goNext(); }
  else if (e.key.toLowerCase() === 'n') goNext();
});

/* One gesture switches at most one episode; controls never count as swipes. */
let gesture = null;
let suppressClickUntil = 0;
function isGestureSurface(target) {
  return target === video || target === tapZone || target === player || !!target.closest('#tapToPlay');
}
player.addEventListener('pointerdown', e => {
  if (!e.isPrimary) { gesture = null; return; }
  if (!isFullscreen() || !isGestureSurface(e.target) || e.button !== 0) return;
  gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, time: Date.now() };
  e.target.setPointerCapture(e.pointerId);
});
player.addEventListener('pointerup', e => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const { x, y, time } = gesture;
  gesture = null;
  const dx = e.clientX - x, dy = e.clientY - y;
  if (Math.hypot(dx, dy) > 12) suppressClickUntil = Date.now() + 400;
  if (!isFullscreen() || Date.now() - time > 1000 || Math.abs(dy) < 70 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
  if (dy < 0) goNext(); else goPrev();
});
player.addEventListener('pointercancel', () => { gesture = null; });
player.addEventListener('click', e => {
  if (Date.now() < suppressClickUntil && isGestureSurface(e.target)) { e.preventDefault(); e.stopPropagation(); }
}, true);
let wheelDelta = 0, lastWheel = 0, wheelLockedUntil = 0;
player.addEventListener('wheel', e => {
  if (!isFullscreen() || !isGestureSurface(e.target) || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.preventDefault();
  const now = Date.now();
  if (now < wheelLockedUntil) { lastWheel = now; return; }
  if (now - lastWheel > 180 || Math.sign(e.deltaY) !== Math.sign(wheelDelta)) wheelDelta = 0;
  lastWheel = now;
  wheelDelta += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? player.clientHeight : 1);
  if (Math.abs(wheelDelta) >= 80) {
    if (wheelDelta > 0) goNext(); else goPrev();
    wheelDelta = 0;
    wheelLockedUntil = now + 650;
  }
}, { passive: false });

const tapToPlayBtn = document.getElementById('tapToPlay');
function showTapToPlay() { tapToPlayBtn.hidden = false; }
function hideTapToPlay() { tapToPlayBtn.hidden = true; }
tapToPlayBtn.addEventListener('click', () => {
  video.muted = false;
  muteWave.style.display = '';
  muteIcon.style.opacity = '1';
  enterFullscreen();
  playVideo();
});

/* ---------- init ---------- */
async function boot() {
  show = showById(params.get('id')) || SHOWS[0];
  currentEp = Math.min(Math.max(parseInt(params.get('ep'), 10) || 1, 1), show.episodes);
  /* Start on a user click so fullscreen and audible playback share activation. */
  video.muted = false;
  initLang(() => {
    renderInfo();
    renderEpisodes();
    document.getElementById('hudEpNum').textContent = hudText();
    if (window.BizContact) BizContact.remount();
  });
  fillBanner('adSlotWatch', AD_CONFIG.banners.watch);
  renderInfo();
  loadEp(false);
}

/* Wait for an admin-published catalog (if any), then render */
window.CATALOG_READY.then(boot);
