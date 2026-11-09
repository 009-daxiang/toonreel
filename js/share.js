/* ============================================================
   YT688 — share & referral center
   ------------------------------------------------------------
   • Share modal: one-tap sharing to WhatsApp / Telegram /
     Facebook / X + copy link. Uses native share sheet when
     available (mobile).
   • Referral links: every shared link carries ?ref=<visitorId>.
     New visitors land with the ref stored, and it is attached
     to their registration so the admin dashboard can count
     invited sign-ups.
   ============================================================ */

(function () {
  /* ---------- visitor id (referral code) ---------- */
  function visitorId() {
    let v = localStorage.getItem('toonreel:vid');
    if (!v) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('toonreel:vid', v);
    }
    return v;
  }

  function siteUrl(path = '') {
    return location.origin + location.pathname.replace(/[^/]*$/, '') + path
      + (path.includes('?') ? '&' : '?') + 'ref=' + visitorId();
  }

  function currentLang() {
    return typeof currentLang !== 'undefined' ? currentLang : 'en';
  }

  function shareText(showTitle) {
    const msg = typeof t === 'function' ? t('share_msg') : 'Watch free AI micro dramas on';
    return `${showTitle ? showTitle + ' — ' : ''}${msg} YT688`;
  }

  /* ---------- channels ---------- */
  function channels(url, text) {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(text);
    return [
      { id: 'wa', icon: '💬', label: 'WhatsApp', url: `https://wa.me/?text=${t}%20${u}` },
      { id: 'tg', icon: '✈️', label: 'Telegram', url: `https://t.me/share/url?url=${u}&text=${t}` },
      { id: 'fb', icon: '📘', label: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
      { id: 'x', icon: '𝕏', label: 'X', url: `https://twitter.com/intent/tweet?url=${u}&text=${t}` }
    ];
  }

  /* ---------- share modal ---------- */
  /* openShare({ title: '剧名', showId: 'id' }) — omit both to share the site */
  function openShare(opts) {
    opts = opts || {};
    const path = opts.showId ? `watch.html?id=${opts.showId}&ep=1` : '';
    const url = siteUrl(path);
    const text = shareText(opts.title);
    let back = document.getElementById('shareModal');
    if (!back) {
      back = document.createElement('div');
      back.id = 'shareModal';
      back.className = 'modal-back';
      document.body.appendChild(back);
    }
    back.innerHTML = `
      <div class="modal share">
        <div class="m-icon">🎁</div>
        <h3 data-i18n="share_h">Share with friends</h3>
        <p class="m-desc" data-i18n="share_sub">Send the link — they watch free, you look like a hero.</p>
        <div class="share-link">
          <input readonly value="${url.replace(/"/g, '&quot;')}" onclick="this.select()" />
          <button class="btn btn-primary" id="shareCopy" data-i18n="share_copy">Copy link</button>
        </div>
        <div class="share-channels">
          ${channels(url, text).map(c =>
            `<a class="share-ch" data-ch="${c.id}" href="${c.url}" target="_blank" rel="noopener">
               <span class="sc-icon">${c.icon}</span><span>${c.label}</span></a>`).join('')}
        </div>
        ${navigator.share ? `<button class="btn btn-primary" id="shareNative" style="justify-content:center">
          📲 <span data-i18n="share_native">More ways to share</span></button>` : ''}
        <button class="btn btn-text" id="shareClose" style="justify-content:center" data-i18n="maybe_later">Maybe later</button>
        <p class="demo-note"><span data-i18n="referral_h">Your invite link</span> · ref:${visitorId()}</p>
      </div>`;
    back.classList.add('open');

    back.querySelector('#shareCopy').addEventListener('click', (e) => {
      navigator.clipboard.writeText(url).then(() => {
        e.target.textContent = '✓';
        setTimeout(() => { e.target.textContent = t('share_copy'); }, 1200);
      });
    });
    const native = back.querySelector('#shareNative');
    if (native) native.addEventListener('click', () => {
      navigator.share({ title: 'YT688', text, url }).catch(() => {});
    });
    window.YTShare.lastShared = opts;
    back.querySelector('#shareClose').addEventListener('click', () => back.classList.remove('open'));
    back.addEventListener('click', e => { if (e.target === back) back.classList.remove('open'); });
  }

  /* ---------- referral capture ---------- */
  function captureRef() {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) localStorage.setItem('toonreel:ref', ref);
  }
  captureRef();

  function getRef() { return localStorage.getItem('toonreel:ref') || ''; }

  /* expose registration referral to the account modal (analytics.js) */
  window.YTShare = { openShare, visitorId, getRef };

  /* patch: attach ref to register payloads sent by analytics.js */
  const _origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      if (typeof input === 'string' && input === '/api/register' && init && init.body) {
        const b = JSON.parse(init.body);
        if (!b.ref) { b.ref = getRef(); init.body = JSON.stringify(b); }
      }
    } catch {}
    return _origFetch.apply(this, arguments);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wireShareButtons();
      captureRef();
    });
  } else {
    wireShareButtons();
    captureRef();
  }

  function wireShareButtons() {
    document.querySelectorAll('[data-share]').forEach(btn => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', () => {
        openShare({
          title: btn.dataset.shareTitle || '',
          showId: btn.dataset.shareId || ''
        });
      });
    });
  }

  window.YTShare.refresh = wireShareButtons;
})();
