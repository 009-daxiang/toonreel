/* ============================================================
   ToonReel — home page logic (hash-routed views + i18n)
   ============================================================ */

/* ---------- view router ---------- */
const VIEWS = ['home', 'rank', 'genres', 'mylist'];

function currentView() {
  const h = location.hash.replace(/^#\/?/, '');
  return VIEWS.includes(h) ? h : 'home';
}

function route() {
  const v = currentView();
  document.querySelectorAll('.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
  document.querySelectorAll('[data-view]').forEach(a =>
    a.classList.toggle('active', a.dataset.view === v));
  window.scrollTo(0, 0);
  if (v === 'home') buildContinue();
  if (v === 'rank') renderRank();
  if (v === 'genres') buildBrowse();
  if (v === 'mylist') renderMyList();
}
window.addEventListener('hashchange', route);

/* ---------- hero carousel ---------- */
const HERO_IDS = ['lycan-queen', 'sword-immortal', 'contract-bride', 'villainess'];
let heroIdx = 0;
let heroTimer;
let heroList = [];

/* Featured shows: pinned demo ids when available, otherwise the most popular */
function heroShows() {
  const pinned = HERO_IDS.map(showById).filter(Boolean);
  if (pinned.length >= 3) return pinned.slice(0, 4);
  const rest = [...SHOWS].sort((a, b) => b.popularity - a.popularity)
    .filter(s => !pinned.includes(s));
  return [...pinned, ...rest].slice(0, 4);
}

function buildHero() {
  const heroSlides = document.getElementById('heroSlides');
  const heroDots = document.getElementById('heroDots');
  heroList = heroShows();
  if (!heroList.length) return;
  heroSlides.innerHTML = heroList.map((s, i) => {
    return `
      <div class="hero-slide ${i === heroIdx ? 'on' : ''}" data-i="${i}">
        <div class="hero-bg" style="background-image:url('${posterFor(s)}')"></div>
        <div class="hero-inner">
          <div class="hero-text">
            <div class="badge-line">
              <span class="pill">${t('ai_original')}</span>
              <span class="pill ghost">${trGenres(s)}</span>
              <span class="pill ghost">⭐ ${s.rating.toFixed(1)}</span>
            </div>
            <h1>${s.title}</h1>
            <p class="tagline">${s.tagline}</p>
            <p class="desc">${s.desc}</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="watch.html?id=${s.id}&ep=1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg>
                ${t('watch_now')}
              </a>
              <a class="btn btn-ghost" href="watch.html?id=${s.id}&ep=1">${t('more_info')}</a>
            </div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <img src="${posterFor(s)}" alt="" loading="lazy" />
          </div>
        </div>
      </div>`;
  }).join('');

  heroDots.innerHTML = heroList.map((_, i) =>
    `<button data-i="${i}" class="${i === heroIdx % heroList.length ? 'on' : ''}" role="tab" aria-label="Slide ${i + 1}"></button>`
  ).join('');
  heroDots.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => setHero(+b.dataset.i)));
  if (heroIdx >= heroList.length) heroIdx = 0;
  startHeroLoop();
}

function setHero(i) {
  heroIdx = i;
  document.querySelectorAll('#heroSlides .hero-slide').forEach(s =>
    s.classList.toggle('on', +s.dataset.i === i));
  document.querySelectorAll('#heroDots button').forEach(b =>
    b.classList.toggle('on', +b.dataset.i === i));
  startHeroLoop();
}
function startHeroLoop() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => setHero((heroIdx + 1) % heroList.length), 6500);
}

/* ---------- cards ---------- */
function fillRail(el, shows, opts = {}) {
  el.innerHTML = shows.map((s, i) =>
    cardHtml(s, opts.rank ? { ...opts, rank: i + 1 } : opts)
  ).join('');
}

function buildRails() {
  const byRating = [...SHOWS].sort((a, b) => b.rating - a.rating);
  const top10 = [...SHOWS].sort((a, b) => b.popularity - a.popularity).slice(0, 10);
  const fresh = SHOWS.filter(s => s.badge === 'NEW' || s.year === 2026).slice(0, 8);
  const done = SHOWS.filter(s => s.status === 'Completed');
  fillRail(document.getElementById('topRail'), top10, { rank: true });
  fillRail(document.getElementById('trendingRail'), byRating.slice(0, 8));
  fillRail(document.getElementById('newRail'), fresh);
  fillRail(document.getElementById('completedRail'), done);
}

function buildContinue() {
  const sec = document.getElementById('continueSection');
  const rail = document.getElementById('continueRail');
  const prog = getProgress();
  const entries = Object.entries(prog)
    .map(([id, v]) => [showById(id), v])
    .filter(([s]) => s)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, 10);
  if (!entries.length) { sec.hidden = true; return; }
  sec.hidden = false;
  fillRail(rail, entries.map(e => e[0]), { continue: true });
}

/* ---------- genres view ---------- */
let activeGenre = 'All';

function buildBrowse() {
  const chips = document.getElementById('genreChips');
  chips.innerHTML = GENRES.map(g =>
    `<button class="chip ${g === activeGenre ? 'on' : ''}" data-genre="${g}" role="tab">${g === 'All' ? t('f_all') : trGenre(g)}</button>`
  ).join('');
  chips.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => {
      activeGenre = c.dataset.genre;
      chips.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c));
      applyFilter();
    }));

  const grid = document.getElementById('showGrid');
  grid.innerHTML = SHOWS.map(s => cardHtml(s)).join('');
  applyFilter();
}

function applyFilter() {
  let visible = 0;
  document.querySelectorAll('#showGrid .card').forEach(card => {
    const s = showById(card.dataset.id);
    const match = activeGenre === 'All' || s.genres.includes(activeGenre);
    card.classList.toggle('show', match);
    if (match) visible++;
  });
  document.getElementById('emptyGridNote').classList.toggle('show', visible === 0);
}

document.querySelectorAll('[data-genre-link]').forEach(a =>
  a.addEventListener('click', () => {
    activeGenre = a.dataset.genreLink;
  })
);

/* ---------- ranking view ---------- */
let rankTab = 'popular';

function renderRank() {
  const tabs = document.getElementById('rankTabs');
  tabs.innerHTML = [
    ['popular', t('tab_popular')],
    ['rating', t('tab_rating')],
    ['new', t('tab_new')]
  ].map(([k, label]) =>
    `<button class="chip ${k === rankTab ? 'on' : ''}" data-rtab="${k}" role="tab">${label}</button>`
  ).join('');
  tabs.querySelectorAll('.chip').forEach(c =>
    c.addEventListener('click', () => { rankTab = c.dataset.rtab; renderRank(); }));

  let shows;
  if (rankTab === 'popular') shows = [...SHOWS].sort((a, b) => b.popularity - a.popularity);
  else if (rankTab === 'rating') shows = [...SHOWS].sort((a, b) => b.rating - a.rating);
  else shows = [...SHOWS].filter(s => s.year === 2026).sort((a, b) => b.popularity - a.popularity);

  document.getElementById('rankList').innerHTML = shows.map((s, i) => `
    <a class="rank-row" href="watch.html?id=${s.id}&ep=1">
      <span class="rank-no ${i < 3 ? 'top' : ''}">${i + 1}</span>
      <img src="${posterFor(s)}" alt="" loading="lazy" />
      <span class="rank-info">
        <span class="rank-title">${s.title}</span>
        <span class="rank-genres">${trGenres(s)} · ${s.episodes} ${t('eps_total')}</span>
        <span class="rank-meta">
          <span class="stars">★ ${s.rating.toFixed(1)}</span>
          <span>👁 ${formatViews(s.popularity)} ${t('views')}</span>
          <span class="pill ghost sm">${s.status === 'Completed' ? t('status_completed') : t('status_ongoing')}</span>
        </span>
      </span>
      ${s.badge ? `<span class="card-badge plain rank-badge">${s.badge}</span>` : ''}
      <span class="play-mini" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg>
      </span>
    </a>`).join('');
}

/* ---------- my list view ---------- */
function renderMyList() {
  const favs = getFavs().map(showById).filter(Boolean);
  const grid = document.getElementById('myGrid');
  grid.innerHTML = favs.map(s => cardHtml(s)).join('');
  grid.querySelectorAll('.card').forEach(c => c.classList.add('show'));
  document.getElementById('emptyMyNote').classList.toggle('show', !favs.length);
}

/* ---------- search ---------- */
const searchInput = document.getElementById('searchInput');
const searchDrop = document.getElementById('searchDrop');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { searchDrop.classList.remove('open'); return; }
  const hits = SHOWS.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.genres.some(g => trGenre(g).toLowerCase().includes(q)) ||
    s.tagline.toLowerCase().includes(q)
  ).slice(0, 6);
  searchDrop.innerHTML = hits.length
    ? hits.map(s => `
        <a href="watch.html?id=${s.id}&ep=1">
          <img src="${posterFor(s)}" alt="" />
          <span><span class="st">${s.title}</span><br/><span class="sg">${trGenres(s)} · ${s.episodes} ${t('eps_total')}</span></span>
        </a>`).join('')
    : `<div class="none">${t('no_results', { q: searchInput.value.replace(/</g, '&lt;') })}</div>`;
  searchDrop.classList.add('open');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) searchDrop.classList.remove('open');
});

/* ---------- banner ad slot ---------- */
fillBanner('adSlotHome', AD_CONFIG.banners.home);

/* ---------- rerender everything on language change ---------- */
function rerenderAll() {
  buildHero();
  buildRails();
  buildBrowse();
  fillBanner('adSlotHome', AD_CONFIG.banners.home);
  route();
  /* drop a stale smart banner so the next page load shows the new language */
  document.querySelector('.app-banner')?.remove();
  localStorage.removeItem('toonreel:banner');
}

/* ---------- init ---------- */
async function boot() {
  initLang(rerenderAll);
  buildHero();
  buildRails();
  buildBrowse();
  fillBanner('adSlotHome', AD_CONFIG.banners.home);
  route();
}

/* Wait for an admin-published catalog (if any), then render */
window.CATALOG_READY.then(boot);
