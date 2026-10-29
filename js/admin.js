/* ============================================================
   ToonReel Admin — drama manager
   Edits live on a draft catalog. Publishing either:
     • API mode   (server.js running): POST /api/catalog → the
       site picks it up immediately (data/catalog.json)
     • Static mode: downloads catalog.json — commit it to
       data/catalog.json and redeploy.
   ============================================================ */

const DRAFT_KEY = 'toonreel:admin_catalog';
const GENRE_PRESETS = ['Romance', 'Fantasy', 'Cultivation', 'Action', 'Sci-Fi',
  'Drama', 'Vampire', 'Revenge', 'Adventure', 'Slice of Life', 'Comedy'];

let API_MODE = false;
let draft = null; /* { shows: [...] } — unsaved changes */

/* ---------- admin auth ---------- */
const STATIC_ADMIN_HASH = '2e71d6b961774453434a862bb9db36005c10ad1e6a7f50b39e2f014ca56bf4c2'; /* sha256('admin:toonreel2026') */
let authToken = sessionStorage.getItem('toonreel:admin_token') || null;

function authHeaders(extra = {}) {
  return authToken ? { ...extra, Authorization: 'Bearer ' + authToken } : extra;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function tryLogin(user, pass) {
  if (API_MODE) {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass })
    });
    if (!r.ok) return false;
    authToken = (await r.json()).token;
    sessionStorage.setItem('toonreel:admin_token', authToken);
    return true;
  }
  /* static mode: browser-side gate (basic protection only) */
  const hash = await sha256Hex(`${user}:${pass}`);
  if (hash === STATIC_ADMIN_HASH) {
    sessionStorage.setItem('toonreel:admin_gate', 'open');
    return true;
  }
  return false;
}

function showLogin(modeText) {
  document.getElementById('loginMode').textContent = modeText;
  document.getElementById('loginBack').classList.add('open');
  document.getElementById('loginError').hidden = true;
}

function hideLogin() {
  document.getElementById('loginBack').classList.remove('open');
}

function wireLogin() {
  const doLogin = async () => {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    err.hidden = true;
    if (!user || !pass) { err.textContent = 'Enter username and password'; err.hidden = false; return; }
    const ok = await tryLogin(user, pass);
    if (ok) {
      hideLogin();
      refresh();
      showToast('Welcome back, ' + user);
    } else {
      err.textContent = 'Wrong username or password';
      err.hidden = false;
    }
  };
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

function handleAuthFail() {
  authToken = null;
  sessionStorage.removeItem('toonreel:admin_token');
  showLogin(API_MODE ? 'API mode — sign in to manage the catalog' : 'Static mode — enter the admin password');
}

/* ---------- draft helpers ---------- */
function currentCatalog() { return { shows: JSON.parse(JSON.stringify(SHOWS)) }; }
function loadDraft() {
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { draft = null; }
  return draft;
}
function saveDraft() { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }
function workingShows() { return (draft || currentCatalog()).shows; }

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'show';
}
function uniqueId(title, excludeIdx) {
  let id = slugify(title), n = 2;
  const ids = workingShows().map((s, i) => (i === excludeIdx ? null : s.id));
  while (ids.includes(id)) id = slugify(title) + '-' + (n++);
  return id;
}

/* ---------- API detection + login gate ---------- */
(async () => {
  try {
    const r = await fetch('/api/health');
    API_MODE = (await r.json()).api === true;
  } catch { API_MODE = false; }
  const b = document.getElementById('apiBadge');
  b.textContent = API_MODE ? '● API connected — instant publishing' : '○ Static mode — publish downloads catalog.json';
  b.classList.add(API_MODE ? 'on' : 'off');

  wireLogin();
  if (API_MODE) {
    /* API mode requires a real session; probe it with a harmless authorized call */
    let ok = false;
    if (authToken) {
      try {
        const r = await fetch('/api/catalog', { headers: authHeaders() });
        if (r.status === 401) { handleAuthFail(); }
        else ok = true;
      } catch { handleAuthFail(); }
    } else handleAuthFail();
    if (!ok && document.getElementById('loginBack').classList.contains('open') === false) handleAuthFail();
  } else {
    showLogin('Static mode — enter the admin password');
    if (sessionStorage.getItem('toonreel:admin_gate') === 'open') {
      hideLogin();
      refresh();
    }
  }
})();

window.CATALOG_READY.then(() => {
  loadDraft();
  /* list renders only after the gate opens — login success calls refresh() */
});

/* ---------- list ---------- */
function refresh() {
  const shows = workingShows();
  document.getElementById('showCount').textContent = `· ${shows.length}`;
  document.getElementById('draftBanner').hidden = !draft;

  document.getElementById('adminList').innerHTML = shows.map((s, i) => `
    <div class="admin-row" data-i="${i}">
      <img src="${posterFor(s)}" alt="" />
      <div class="admin-row-info">
        <div class="admin-row-title">${s.title}</div>
        <div class="admin-row-sub">${s.genres.join(' · ')} · ${s.episodes} eps · ${s.status}
          ${Array.isArray(s.videos) && s.videos.filter(Boolean).length ? ` · 🎬 ${s.videos.filter(Boolean).length} video(s)` : ' · ⚠️ demo videos'}</div>
      </div>
      <button class="btn btn-ghost sm-btn" data-edit="${i}">Edit</button>
      <button class="btn btn-ghost sm-btn danger" data-del="${i}">Delete</button>
    </div>`).join('');
}

document.getElementById('addBtn').addEventListener('click', () => openEditor(-1));

document.getElementById('adminList').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (edit) openEditor(+edit.dataset.edit);
  if (del) {
    const i = +del.dataset.del;
    if (!confirm(`Delete “${workingShows()[i].title}” from the catalog?`)) return;
    ensureDraft().shows.splice(i, 1);
    saveDraft(); refresh();
    showToast('Deleted (not published yet)');
  }
});

function ensureDraft() { return draft || (draft = currentCatalog()); }

document.getElementById('discardDraft').addEventListener('click', () => {
  if (!confirm('Discard all unpublished changes?')) return;
  localStorage.removeItem(DRAFT_KEY);
  draft = null;
  refresh();
  showToast('Draft discarded');
});

/* ---------- publish ---------- */
document.getElementById('publishBtn').addEventListener('click', async () => {
  const cat = draft || currentCatalog();
  if (API_MODE) {
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(cat)
      });
      if (res.status === 401) { handleAuthFail(); return; }
      if (!res.ok) throw new Error(await res.text());
      localStorage.removeItem(DRAFT_KEY);
      draft = null;
      refresh();
      showToast('🚀 Published — the site is live now');
    } catch (err) {
      showToast('Publish failed: ' + err.message);
    }
  } else {
    const blob = new Blob([JSON.stringify(cat, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalog.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('catalog.json downloaded — put it in data/ and redeploy');
  }
});

/* ---------- editor ---------- */
const editorBack = document.getElementById('editorBack');
const editorModal = document.getElementById('editorModal');
let editingIdx = -1; /* -1 = new */

function openEditor(idx) {
  editingIdx = idx;
  const s = idx >= 0 ? JSON.parse(JSON.stringify(workingShows()[idx])) : blankShow();
  editorModal.innerHTML = editorHtml(s);
  editorBack.classList.add('open');
  wireEditor(s);
}

function blankShow() {
  return {
    id: '', title: '', tagline: '', desc: '', genres: [],
    episodes: 12, status: 'Ongoing', badge: 'NEW', year: new Date().getFullYear(),
    rating: 9.0, popularity: 0,
    poster: '', colors: ['#7b2ff7', '#22d3ee'], motif: 'moon', accent: '#ffd166',
    videos: [], epTitles: []
  };
}

function editorHtml(s) {
  const genreChips = [...new Set([...GENRE_PRESETS, ...s.genres])].map(g =>
    `<button type="button" class="chip ${s.genres.includes(g) ? 'on' : ''}" data-genre="${g}">${g}</button>`).join('');
  const motifKeys = typeof MOTIFS === 'object' ? Object.keys(MOTIFS) : ['moon', 'star'];
  const motifOpts = motifKeys.map(m =>
    `<option value="${m}" ${s.motif === m ? 'selected' : ''}>${m}</option>`).join('');
  const videoRows = Array.from({ length: s.episodes }, (_, i) => `
    <div class="vid-row">
      <span class="vid-ep">EP ${i + 1}</span>
      <input type="url" class="vid-url" data-ep="${i + 1}" placeholder="https://cdn.example.com/ep${i + 1}.mp4 or /uploads/ep${i + 1}.mp4"
             value="${(s.videos || [])[i] || ''}" />
      <button type="button" class="btn btn-ghost sm-btn vid-upload" data-ep="${i + 1}" ${API_MODE ? '' : 'disabled title="Upload needs server.js"'}>Upload</button>
    </div>`).join('');
  return `
    <h3>${editingIdx >= 0 ? 'Edit Drama' : 'Add Drama'}</h3>
    <div class="form-grid">
      <label class="span2">Title *
        <input id="fTitle" type="text" value="${escAttr(s.title)}" placeholder="e.g. The Lycan Queen's Return" /></label>
      <label class="span2">Tagline
        <input id="fTagline" type="text" value="${escAttr(s.tagline)}" /></label>
      <label class="span2">Description
        <textarea id="fDesc" rows="3">${escHtml(s.desc)}</textarea></label>
      <div class="span2">Genres
        <div class="chips form-chips" id="fGenres">${genreChips}</div>
        <input id="fGenreNew" type="text" placeholder="Add custom genre + Enter" /></div>
      <label>Episodes *
        <input id="fEpisodes" type="number" min="1" max="200" value="${s.episodes}" /></label>
      <label>Status
        <select id="fStatus">
          <option ${s.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
          <option ${s.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select></label>
      <label>Badge
        <input id="fBadge" type="text" value="${escAttr(s.badge || '')}" placeholder="NEW / HOT / TOP 10" /></label>
      <label>Year
        <input id="fYear" type="number" value="${s.year}" /></label>
      <label>Rating (0–10)
        <input id="fRating" type="number" step="0.1" min="0" max="10" value="${s.rating}" /></label>
      <label>Popularity (views)
        <input id="fPop" type="number" min="0" value="${s.popularity || 0}" /></label>

      <div class="span2 poster-box">
        <div class="poster-preview"><img id="posterImg" src="${posterFor(s)}" alt="poster" /></div>
        <div class="poster-fields">
          <label>Poster image URL <span class="hint">(leave empty to auto-generate art)</span>
            <input id="fPoster" type="url" value="${escAttr(s.poster || '')}" placeholder="https://…/poster.jpg" /></label>
          <label>Cover style
            <select id="fMotif">${motifOpts}</select></label>
          <div class="color-row">
            <label>Color A <input id="fC1" type="color" value="${s.colors?.[0] || '#7b2ff7'}" /></label>
            <label>Color B <input id="fC2" type="color" value="${s.colors?.[1] || '#22d3ee'}" /></label>
            <label>Accent <input id="fAccent" type="color" value="${s.accent || '#ffd166'}" /></label>
          </div>
        </div>
      </div>

      <div class="span2">
        <div class="vid-head">Episode videos <span class="hint">(${API_MODE ? 'Upload → stored in /uploads' : 'paste URLs, or run server.js to enable uploads'})</span></div>
        <div class="vid-list" id="vidList">${videoRows}</div>
      </div>

      <label class="span2">Episode titles <span class="hint">(one per line, optional — fallback “Episode n”)</span>
        <textarea id="fEpTitles" rows="3">${escHtml((s.epTitles || []).join('\n'))}</textarea></label>
    </div>
    <div class="editor-actions">
      <button class="btn btn-primary" id="fSave">Save to draft</button>
      <button class="btn btn-text" id="fCancel">Cancel</button>
    </div>`;
}

function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

function wireEditor(s) {
  const $ = id => document.getElementById(id);

  /* genres */
  editorModal.querySelector('#fGenres').addEventListener('click', e => {
    const chip = e.target.closest('[data-genre]');
    if (!chip) return;
    const g = chip.dataset.genre;
    const i = s.genres.indexOf(g);
    if (i >= 0) s.genres.splice(i, 1); else s.genres.push(g);
    chip.classList.toggle('on', i < 0);
  });
  $('fGenreNew').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const g = e.target.value.trim();
    if (!g || s.genres.includes(g)) return;
    s.genres.push(g);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip on'; b.dataset.genre = g; b.textContent = g;
    $('fGenres').appendChild(b);
    e.target.value = '';
  });

  /* poster live preview */
  const updatePreview = () => {
    s.poster = $('fPoster').value.trim();
    s.motif = $('fMotif').value;
    s.colors = [$('fC1').value, $('fC2').value];
    s.accent = $('fAccent').value;
    $('posterImg').src = s.poster || posterSvg({ ...s, id: s.id || 'preview' });
  };
  ['fPoster', 'fMotif', 'fC1', 'fC2', 'fAccent'].forEach(id =>
    $(id).addEventListener('input', updatePreview));

  /* video upload (API mode) */
  editorModal.querySelector('#vidList').addEventListener('click', (e) => {
    const btn = e.target.closest('.vid-upload');
    if (!btn || btn.disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      btn.textContent = 'Uploading…';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd, headers: authHeaders() });
        if (res.status === 401) { handleAuthFail(); btn.textContent = 'Upload'; return; }
        const out = await res.json();
        if (out.url) {
          editorModal.querySelector(`.vid-url[data-ep="${btn.dataset.ep}"]`).value = out.url;
          btn.textContent = 'Upload';
          showToast(`EP ${btn.dataset.ep} uploaded`);
        } else throw new Error(out.error || 'failed');
      } catch (err) {
        btn.textContent = 'Upload';
        showToast('Upload failed: ' + err.message);
      }
    };
    input.click();
  });

  $('fCancel').addEventListener('click', () => editorBack.classList.remove('open'));
  editorBack.addEventListener('click', e => { if (e.target === editorBack) editorBack.classList.remove('open'); });

  $('fSave').addEventListener('click', () => {
    const title = $('fTitle').value.trim();
    if (!title) { showToast('Title is required'); return; }
    const episodes = Math.max(1, parseInt($('fEpisodes').value, 10) || 1);
    const epTitles = $('fEpTitles').value.split('\n').map(x => x.trim()).filter(Boolean);
    const videos = Array.from({ length: episodes }, (_, i) =>
      (editorModal.querySelector(`.vid-url[data-ep="${i + 1}"]`)?.value || '').trim());

    const show = {
      ...s,
      id: s.id || uniqueId(title, editingIdx),
      title, tagline: $('fTagline').value.trim(), desc: $('fDesc').value.trim(),
      episodes, status: $('fStatus').value, badge: $('fBadge').value.trim().toUpperCase(),
      year: parseInt($('fYear').value, 10) || new Date().getFullYear(),
      rating: Math.min(10, Math.max(0, parseFloat($('fRating').value) || 0)),
      popularity: Math.max(0, parseInt($('fPop').value, 10) || 0),
      videos, epTitles
    };

    const shows = ensureDraft().shows;
    if (editingIdx >= 0) shows[editingIdx] = show; else shows.unshift(show);
    saveDraft(); refresh();
    editorBack.classList.remove('open');
    showToast('Saved to draft — press Publish to go live');
  });
}

/* ---------- toast (store.js not loaded here) ---------- */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(() => el.classList.remove('show'), 2600);
}
