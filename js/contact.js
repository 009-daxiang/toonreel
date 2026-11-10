/* ============================================================
   Contact guard — anti-scraping business contacts
   ------------------------------------------------------------
   Handles NEVER appear as plain text: they are stored as char
   codes, decoded only on click, and rendered as an SVG image
   (so neither the HTML source nor the DOM text nodes contain
   the account string). Copy uses the clipboard API.

   Usage in HTML:
     <span class="biz-slot" data-biz-slot="tg"></span>   big card
     <span class="biz-mini" data-biz-slot="line"></span>  inline
   ============================================================ */

(function () {
  /* char-code storage: [W,Y,T,6,8,8] / [d,a,x,i,a,n,g,0,0,0,8] */
  const _D = {
    tg:   [87, 89, 84, 54, 56, 56],
    line: [100, 97, 120, 105, 97, 110, 103, 48, 48, 48, 56]
  };
  const dec = k => _D[k].map(c => String.fromCharCode(c)).join('');

  function accountImg(text) {
    const w = text.length * 14 + 30, h = 36;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`
      + `<rect width="100%" height="100%" rx="9" fill="#141428"/>`
      + `<text x="50%" y="24" text-anchor="middle" font-family="Menlo,Consolas,monospace" `
      + `font-size="17" font-weight="bold" fill="#c4b5fd">${text}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function copy(text, btn) {
    const done = () => {
      const old = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = old; }, 1200);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }

  function reveal(slot) {
    const kind = slot.dataset.bizSlot;
    const id = dec(kind);
    const mini = slot.classList.contains('biz-mini');
    const img = `<img class="biz-img${mini ? ' mini' : ''}" src="${accountImg(id)}" alt="contact" />`;
    const copyBtn = `<button class="biz-copy-inline" data-biz-copy="${id}" aria-label="copy">⧉</button>`;
    if (kind === 'tg') {
      const open = `<a class="biz-open" href="https://t.me/${id}" target="_blank" rel="noopener" aria-label="open">↗</a>`;
      slot.innerHTML = mini
        ? `<span class="biz-inline">${img}${copyBtn}${open}</span>`
        : img + copyBtn + open;
    } else {
      slot.innerHTML = mini
        ? `<span class="biz-inline">${img}${copyBtn}</span>`
        : img + copyBtn;
    }
    slot.querySelector('[data-biz-copy]').addEventListener('click', (e) => {
      e.stopPropagation();
      copy(e.currentTarget.dataset.bizCopy, e.currentTarget);
    });
    slot.removeAttribute('data-biz-slot'); /* revealed once */
  }

  function mount() {
    document.querySelectorAll('[data-biz-slot]').forEach(slot => {
      if (slot.dataset.mounted) return;
      slot.dataset.mounted = '1';
      const mini = slot.classList.contains('biz-mini');
      const btn = document.createElement('button');
      btn.className = mini ? 'biz-mini-btn' : 'biz-reveal';
      btn.innerHTML = `<span aria-hidden="true">👁</span> <span>${t('biz_show')}</span>`;
      btn.addEventListener('click', () => reveal(slot));
      slot.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  function remount() {
    document.querySelectorAll('[data-mounted]').forEach(el => el.removeAttribute('data-mounted'));
    document.querySelectorAll('.biz-reveal, .biz-mini-btn').forEach(el => el.remove());
    mount();
  }
  window.BizContact = { mount, remount };
})();
