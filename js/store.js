/* ============================================================
   ToonReel — local state (favorites, watch progress)
   All persisted in localStorage. Server-side accounts come later.
   ============================================================ */

const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem('toonreel:' + k);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem('toonreel:' + k, JSON.stringify(v)); } catch {}
  }
};

function getFavs() { return store.get('favs', []); }
function isFav(id) { return getFavs().includes(id); }
function toggleFav(id) {
  const favs = getFavs();
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1); else favs.push(id);
  store.set('favs', favs);
  return i < 0;
}

function getProgress() { return store.get('progress', {}); } /* { showId: { ep, pct, ts } } */
function saveProgress(showId, ep, pct) {
  const p = getProgress();
  p[showId] = { ep, pct, ts: Date.now() };
  store.set('progress', p);
}
function clearProgress(showId) {
  const p = getProgress();
  delete p[showId];
  store.set('progress', p);
}

/* ---------- shared UI helpers ---------- */

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => t.classList.remove('show'), 2200);
}

function showById(id) { return SHOWS.find(s => s.id === id); }

function starIcon() {
  return '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>';
}
function heartIcon(filled) {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20.5C4.5 15 3 10.5 5.5 7.4 7.6 4.8 11 5.3 12 8c1-2.7 4.4-3.2 6.5-.6 2.5 3.1 1 7.6-6.5 13.1z"/></svg>`;
}
function lockIcon() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
}

/* Build a standard vertical card for a show */
function cardHtml(show, { continue: cont, rank } = {}) {
  const fav = isFav(show.id);
  if (cont) {
    const prog = getProgress()[show.id];
    return `
      <a class="card continue show" href="watch.html?id=${show.id}&ep=${prog.ep}">
        <div class="poster">
          <img src="${posterFor(show)}" alt="${show.title}" loading="lazy" />
          <span class="ep-chip">${t('ep_label', { n: prog.ep })}</span>
          <div class="resume-bar"><i style="width:${Math.round(prog.pct * 100)}%"></i></div>
        </div>
        <div class="meta"><div class="t">${show.title}</div></div>
      </a>`;
  }
  return `
    <div class="card show ${rank ? 'has-rank' : ''}" data-id="${show.id}">
      <a href="watch.html?id=${show.id}&ep=1" aria-label="Watch ${show.title}">
        <div class="poster">
          <img src="${posterFor(show)}" alt="${show.title}" loading="lazy" />
          ${show.badge ? `<span class="card-badge">${show.badge}</span>` : ''}
          <span class="ep-chip">${show.episodes} ${t('eps_short')}</span>
          <div class="play-ov"><span class="circle">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#12121f"><path d="M8 5l12 7-12 7z"/></svg>
          </span></div>
          ${rank ? `<span class="rank-num ${rank <= 3 ? 'top' : ''}">${rank}</span>` : ''}
        </div>
      </a>
      <button class="fav ${fav ? 'on' : ''}" data-fav="${show.id}" aria-label="Toggle favorite">${heartIcon(fav)}</button>
      <div class="meta">
        <div class="t">${show.title}</div>
        <div class="g">${trGenres(show)}</div>
        <div class="stars">${starIcon()} ${show.rating.toFixed(1)}</div>
      </div>
    </div>`;
}

/* Event delegation for favorite buttons (works with dynamically added cards) */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-fav]');
  if (!btn) return;
  const id = btn.dataset.fav;
  const now = toggleFav(id);
  btn.classList.toggle('on', now);
  btn.innerHTML = heartIcon(now);
  showToast(now ? t('added_list') : t('removed_list'));
  /* refresh My List view if we are on it */
  if (typeof currentView === 'function' && currentView() === 'mylist') renderMyList?.();
});
