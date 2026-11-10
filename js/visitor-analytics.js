/* GA4 works on GitHub Pages without the optional /api backend.
   One config command records the initial pageview. GA4 enhanced measurement
   owns history changes; do not also send manual page_view events. */
(function () {
  if (window.YTVisitorAnalytics) return;
  const config = window.YT_ANALYTICS_CONFIG;
  const state = { status: 'initializing', message: '' };
  let enabled = false;

  function status(value, message, level = 'info') {
    state.status = value;
    state.message = message;
    console[level]('[visitor-analytics]', { status: value, page: location.pathname, message });
  }

  function track(event, extra = {}) {
    if (!enabled) return;
    const names = { play: 'video_start', complete: 'video_complete', register: 'sign_up', login: 'login' };
    if (!Object.hasOwn(names, event)) return;
    // Only known content fields: never forward account details or referral IDs.
    const parameters = { send_to: config.measurementId };
    if (typeof extra.show === 'string') parameters.video_title = extra.show;
    if (Number.isInteger(extra.ep)) parameters.episode_number = extra.ep;
    window.gtag('event', names[event], parameters);
  }

  window.YTVisitorAnalytics = { state, track };
  if (!config || typeof config.measurementId !== 'string' || !Array.isArray(config.productionHosts)) {
    status('error', 'Missing or invalid analytics configuration.', 'error');
    return;
  }
  if (!config.measurementId) {
    status('unconfigured', 'No GA4 Measurement ID: visitor collection has not started.', 'warn');
    return;
  }
  if (!/^G-[A-Z0-9]+$/.test(config.measurementId)) {
    status('error', 'Invalid GA4 Measurement ID; expected G- followed by uppercase letters or digits.', 'error');
    return;
  }
  if (/\/admin\.html$/.test(location.pathname)) {
    status('excluded', 'Management pages are excluded from visitor collection.');
    return;
  }
  if (location.protocol !== 'https:' || !config.productionHosts.includes(location.hostname)) {
    status('excluded', 'Local previews and non-production hosts are excluded from visitor collection.');
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', config.measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });
  enabled = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.measurementId);
  script.onload = () => status('loaded', 'GA4 script loaded. Confirm received visits in the GA4 Realtime report.');
  script.onerror = () => {
    enabled = false;
    status('error', 'GA4 script failed to load; check the network or content blocker. Visits may not be recorded.', 'error');
  };
  status('loading', 'Loading GA4 visitor collection.');
  document.head.appendChild(script);
})();
