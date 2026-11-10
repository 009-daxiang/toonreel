/* ============================================================
   YT688 — analytics + viewer accounts
   ------------------------------------------------------------
   • Tracking: visit / play / complete events are reported to
     /api/track (only when the optional backend is present —
     static hosting silently skips it).
   • Accounts: email sign-up / login modal, opened by tapping
     the avatar. Guest mode always works without an account.
   ============================================================ */

(function () {
  /* ---------- analytics ---------- */
  const TRACK = { api: null };
  const _queue = []; /* events fired before the API probe finished */

  function send(event, extra) {
    const body = JSON.stringify({ e: event, ...extra, lang: currentLang });
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  }

  function track(event, extra) {
    window.YTVisitorAnalytics?.track(event, extra);
    if (TRACK.api === false) return;             /* no backend — skip */
    if (TRACK.api !== true) { _queue.push([event, extra]); return; } /* probe pending — queue */
    send(event, extra);
  }

  async function detectApi() {
    try {
      const r = await fetch('/api/health');
      TRACK.api = (await r.json()).api === true;
    } catch { TRACK.api = false; }
    if (TRACK.api) {
      send('visit', { page: location.pathname });
      while (_queue.length) { const [e, x] = _queue.shift(); send(e, x); }
    }
  }

  window.YTAnalytics = { track };

  /* ---------- viewer account modal ---------- */

  function getUser() { try { return JSON.parse(localStorage.getItem('toonreel:user') || 'null'); } catch { return null; } }
  function setUser(u) {
    if (u) localStorage.setItem('toonreel:user', JSON.stringify(u));
    else localStorage.removeItem('toonreel:user');
    paintAvatar();
  }

  function modalHtml() {
    return `
    <div class="modal">
      <div class="m-icon">👤</div>
      <h3 data-i18n="auth_login">Log in</h3>
      <div class="auth-tabs">
        <button class="auth-tab on" data-tab="register" data-i18n="auth_register">Sign up</button>
        <button class="auth-tab" data-tab="login" data-i18n="auth_login">Log in</button>
      </div>
      <input id="accEmail" type="email" placeholder="you@mail.com" data-i18n-ph="auth_email" autocomplete="email" />
      <input id="accPass" type="password" placeholder="••••••" data-i18n-ph="auth_pass" autocomplete="current-password" />
      <p class="login-error" id="accError" hidden></p>
      <button class="btn btn-primary" id="accGo" style="justify-content:center" data-i18n="auth_register">Sign up</button>
      <button class="btn btn-text" id="accGuest" style="justify-content:center" data-i18n="auth_go">Continue as guest</button>
    </div>`;
  }

  function openAccountModal() {
    if (getUser()) { /* logged in: confirm logout */
      if (confirm(`${t('auth_welcome')}: ${getUser().email}\n\n${t('auth_logout')}?`)) {
        setUser(null);
        showToast(t('auth_logout'));
      }
      return;
    }
    let back = document.getElementById('accountModal');
    if (!back) {
      back = document.createElement('div');
      back.id = 'accountModal';
      back.className = 'modal-back';
      document.body.appendChild(back);
    }
    let mode = 'register';
    back.innerHTML = modalHtml();
    back.classList.add('open');
    back.querySelector('#accGuest').addEventListener('click', () => back.classList.remove('open'));
    back.addEventListener('click', e => { if (e.target === back) back.classList.remove('open'); });
    back.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.tab;
        back.querySelectorAll('.auth-tab').forEach(x => x.classList.toggle('on', x === tab));
        back.querySelector('#accGo').textContent = t(mode === 'login' ? 'auth_login' : 'auth_register');
      });
    });
    back.querySelector('#accGo').addEventListener('click', async () => {
      const email = back.querySelector('#accEmail').value.trim();
      const password = back.querySelector('#accPass').value;
      const err = back.querySelector('#accError');
      err.hidden = true;
      if (!email || password.length < 6) { err.textContent = t('auth_pass'); err.hidden = false; return; }
      const path = mode === 'login' ? '/api/user/login' : '/api/register';
      try {
        const r = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, visitor: 'local' })
        });
        const d = await r.json();
        if (!r.ok) {
          err.textContent = d.error === 'email already registered' ? t('auth_exists')
            : d.error === 'wrong email or password' ? t('auth_bad') : (d.error || 'error');
          err.hidden = false;
          return;
        }
        setUser({ email });
        track(mode === 'login' ? 'login' : 'register');
        back.classList.remove('open');
        showToast(`${t('auth_welcome')}, ${email}`);
      } catch { err.textContent = 'network error'; err.hidden = false; }
    });
  }

  function paintAvatar() {
    const u = getUser();
    const letter = u ? u.email[0].toUpperCase() : 'G';
    document.querySelectorAll('.avatar').forEach(a => {
      a.textContent = letter;
      a.title = u ? u.email : 'Guest';
    });
  }

  function wireAvatar() {
    document.querySelectorAll('.avatar').forEach(a => {
      a.style.cursor = 'pointer';
      a.addEventListener('click', openAccountModal);
    });
  }

  async function bootAccount() {
    paintAvatar();
    wireAvatar();
    await detectApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAccount);
  } else {
    bootAccount();
  }
})();
