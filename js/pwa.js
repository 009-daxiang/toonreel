/* ============================================================
   ToonReel — shared PWA glue
   • registers the service worker
   • captures the browser install prompt (beforeinstallprompt)
   • shows a dismissible smart banner on phone browsers
   ============================================================ */

(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  window.PWA = {
    installEvent: null,
    async promptInstall() {
      const ev = this.installEvent;
      if (!ev) { location.href = 'download.html'; return; }
      ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === 'accepted') hideBanner();
    }
  };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.PWA.installEvent = e;
    document.dispatchEvent(new CustomEvent('pwa:installable'));
  });
  window.addEventListener('appinstalled', hideBanner);

  function isStandalone() {
    return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  /* ---------- smart banner ---------- */
  function showBanner() {
    if (isStandalone()) return;
    if (localStorage.getItem('toonreel:banner') === 'dismissed') return;
    if (location.pathname.endsWith('download.html')) return;

    const el = document.createElement('div');
    el.className = 'app-banner';
    el.innerHTML = `
      <img src="assets/icons/icon-192.png" alt="" />
      <div class="ab-text">
        <b>${t('getapp')}</b>
        <span>${t('banner_sub')}</span>
      </div>
      <button class="ab-install">${t('install_pwa')}</button>
      <button class="ab-close" aria-label="Close">✕</button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    el.querySelector('.ab-close').addEventListener('click', () => {
      localStorage.setItem('toonreel:banner', 'dismissed');
      hideBanner();
    });
    el.querySelector('.ab-install').addEventListener('click', () => {
      localStorage.setItem('toonreel:banner', 'dismissed');
      window.PWA.promptInstall();
    });
  }
  function hideBanner() {
    document.querySelector('.app-banner')?.classList.remove('show');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(showBanner, 2500));
  } else {
    setTimeout(showBanner, 2500);
  }
})();
