/* ============================================================
   ToonReel — watch page logic
   ============================================================ */

const params = new URLSearchParams(location.search);
let show, currentEp; /* resolved in boot(), after the catalog loads */

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
const centerFlash = document.getElementById('centerFlash');
const disc = document.getElementById('disc');
const discIcon = document.getElementById('discIcon');
const epList = document.getElementById('epList');

const PLAY_PATH = 'M8 5l12 7-12 7z';
const PAUSE_PATH = 'M7 5h4v14H7zM13 5h4v14h-4z';

/* ---------- page info ---------- */
function renderInfo() {
  document.title = `${show.title} — ToonReel`;
  document.getElementById('badges').innerHTML = `
    <span class="pill">${t('ai_original')}</span>
    ${show.badge ? `<span class="pill ghost">${show.badge}</span>` : ''}
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
document.getElementById('shareBtn').addEventListener('click', async () => {
  const url = location.href.split('?')[0] + `?id=${show.id}&ep=${currentEp}`;
  try {
    if (navigator.share) await navigator.share({ title: show.title, url });
    else { await navigator.clipboard.writeText(url); showToast(t('link_copied')); }
  } catch { /* user cancelled */ }
});

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
  if (ep === currentEp) return;
  currentEp = ep;
  loadEp(true);
}

function updateUrl() {
  history.replaceState(null, '', `watch.html?id=${show.id}&ep=${currentEp}`);
}

/* ---------- player ---------- */
function loadEp(autoplay) {
  updateUrl();
  document.getElementById('hudEpNum').textContent =
    `${t('ep_label', { n: currentEp })} · ${epTitle(show, currentEp)}`;
  renderEpisodes();
  highlightNavBtns();
  /* ad-supported: a preroll may play before the episode starts */
  showPreroll(() => {
    video.poster = posterFor(show); /* show art while the clip buffers */
    video.src = videoUrlFor(show, currentEp);
    video.load();
    if (autoplay) video.play().catch(() => {});
  });
}

function highlightNavBtns() {
  document.getElementById('prevEp').disabled = currentEp <= 1;
  document.getElementById('nextEp').disabled = currentEp >= show.episodes;
  nextBtn.disabled = currentEp >= show.episodes;
}

document.getElementById('prevEp').addEventListener('click', () => {
  if (currentEp > 1) { currentEp--; loadEp(true); }
});
document.getElementById('nextEp').addEventListener('click', goNext);
nextBtn.addEventListener('click', goNext);
function goNext() {
  if (currentEp < show.episodes) {
    currentEp += 1;
    loadEp(true);
  }
}

/* play / pause */
function setPlayingUI(playing) {
  playIcon.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
  discIcon.setAttribute('d', playing ? PAUSE_PATH : PLAY_PATH);
}
function togglePlay() {
  if (video.paused) {
    video.play().catch(() => {});
    flash(PAUSE_PATH);
  } else {
    video.pause();
    flash(PLAY_PATH);
  }
}
function flash(path) {
  discIcon.setAttribute('d', path);
  centerFlash.classList.add('show');
  clearTimeout(flash._tm);
  flash._tm = setTimeout(() => centerFlash.classList.remove('show'), 550);
}
playBtn.addEventListener('click', togglePlay);
tapZone.addEventListener('click', togglePlay);
video.addEventListener('play', () => setPlayingUI(true));
video.addEventListener('pause', () => setPlayingUI(false));
video.addEventListener('click', togglePlay);

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

/* auto-next when an episode ends */
video.addEventListener('ended', () => {
  if (currentEp < show.episodes) goNext();
});

/* fullscreen */
fsBtn.addEventListener('click', () => {
  const p = document.getElementById('player');
  if (document.fullscreenElement) document.exitFullscreen();
  else p.requestFullscreen?.().catch(() => {});
});

/* keyboard shortcuts */
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight' && video.duration) video.currentTime += 5;
  else if (e.key === 'ArrowLeft') video.currentTime -= 5;
  else if (e.key.toLowerCase() === 'n') goNext();
});

/* ---------- init ---------- */
async function boot() {
  show = showById(params.get('id')) || SHOWS[0];
  currentEp = Math.min(Math.max(parseInt(params.get('ep'), 10) || 1, 1), show.episodes);
  /* muted autoplay (short-drama style); users can unmute in the HUD */
  video.muted = true;
  muteWave.style.display = 'none';
  muteIcon.style.opacity = '.55';
  initLang(() => {
    renderInfo();
    renderEpisodes();
    document.getElementById('hudEpNum').textContent =
      `${t('ep_label', { n: currentEp })} · ${epTitle(show, currentEp)}`;
  });
  fillBanner('adSlotWatch', AD_CONFIG.banners.watch);
  renderInfo();
  loadEp(true);
}

/* Wait for an admin-published catalog (if any), then render */
window.CATALOG_READY.then(boot);
