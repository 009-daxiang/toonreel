const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function analytics({ id = 'G-TEST123', url = 'https://yt688.app/', configMissing = false } = {}) {
  const scripts = [], logs = [];
  const window = {};
  if (!configMissing) window.YT_ANALYTICS_CONFIG = { measurementId: id, productionHosts: ['yt688.app', 'www.yt688.app'] };
  const context = vm.createContext({ window, location: new URL(url),
    document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } },
    console: Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...data) => logs.push({ level, data })]))
  });
  const run = () => vm.runInContext(source('js/visitor-analytics.js'), context);
  run();
  const commands = () => Array.from(window.dataLayer || [], item => Array.from(item));
  return { window, scripts, logs, run, commands, state: window.YTVisitorAnalytics.state };
}

test('production starts one GA4 pageview configuration, without advertising features', () => {
  const h = analytics();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST123');
  assert.equal(h.scripts[0].async, true);
  assert.equal(h.commands().filter(c => c[0] === 'config').length, 1);
  assert.equal(h.commands().filter(c => c[0] === 'event').length, 0);
  const config = h.commands().find(c => c[0] === 'config')[2];
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.notEqual(config.send_page_view, false);
  h.run();
  assert.equal(h.scripts.length, 1, 'including the loader twice must not double-count');
  h.scripts[0].onload();
  assert.equal(h.state.status, 'loaded');
  assert.match(h.state.message, /Confirm received visits/);
});

test('unconfigured and invalid configuration produce diagnostics, never zero/fake visits', () => {
  for (const options of [{ id: '' }, { id: 'G-BAD"<script>' }, { configMissing: true }]) {
    const h = analytics(options);
    assert.equal(h.scripts.length, 0);
    assert.equal(h.commands().length, 0);
    assert.ok(['unconfigured', 'error'].includes(h.state.status));
    assert.ok(h.logs.some(log => ['warn', 'error'].includes(log.level)));
  }
});

test('admin, preview and unrelated hosts never send traffic to the production property', () => {
  for (const url of ['https://yt688.app/admin.html', 'https://yt688.app/site/admin.html',
    'http://127.0.0.1:8765/', 'http://localhost:8765/', 'https://preview.example/', 'http://yt688.app/']) {
    const h = analytics({ url });
    h.window.YTVisitorAnalytics.track('play', { show: 'u01', ep: 1 });
    assert.equal(h.state.status, 'excluded', url);
    assert.equal(h.scripts.length, 0, url);
    assert.equal(h.commands().length, 0, url);
  }
});

test('playback is forwarded without account/referral data, and visits are not duplicated', () => {
  const h = analytics();
  const extra = { show: 'u01', ep: 3, email: 'private@example.test', password: 'private', ref: 'private' };
  h.window.YTVisitorAnalytics.track('play', extra);
  h.window.YTVisitorAnalytics.track('complete', extra);
  h.window.YTVisitorAnalytics.track('visit', { page: '/' });
  const events = h.commands().filter(c => c[0] === 'event');
  assert.deepEqual(events.map(c => c[1]), ['video_start', 'video_complete']);
  assert.equal(events[0][2].episode_number, 3);
  assert.equal(events[0][2].video_title, 'u01');
  assert.equal(events[0][2].send_to, 'G-TEST123');
  assert.doesNotMatch(JSON.stringify(events), /private|password|email|ref/);
});

test('blocked GA4 script reports a real error and stops queuing playback', () => {
  const h = analytics();
  h.scripts[0].onerror();
  assert.equal(h.state.status, 'error');
  assert.ok(h.logs.some(log => log.level === 'error'));
  h.window.YTVisitorAnalytics.track('play', { show: 'u01', ep: 1 });
  assert.equal(h.commands().filter(c => c[0] === 'event').length, 0);
});

test('static hosting still forwards player events to GA4 when the optional backend is absent', async () => {
  const events = [], requests = [];
  let boot;
  const window = { YTVisitorAnalytics: { track: (...args) => events.push(args) } };
  vm.runInNewContext(source('js/analytics.js'), { window,
    document: { readyState: 'loading', addEventListener: (event, fn) => boot = fn, querySelectorAll: () => [] },
    localStorage: { getItem: () => null },
    fetch: async url => { requests.push(url); return { json: async () => { throw new Error('404 HTML'); } }; }
  });
  await boot();
  window.YTAnalytics.track('play', { show: 'u01', ep: 2 });
  assert.deepEqual(requests, ['/api/health']);
  assert.equal(events[0][0], 'play');
  assert.equal(events[0][1].ep, 2);
});

test('every public HTML page loads existing GA4 files in order, including generated landing pages', () => {
  const pages = ['index.html', 'watch.html', 'download.html', 'privacy.html',
    ...fs.readdirSync(path.join(root, 'drama')).filter(f => f.endsWith('.html')).map(f => 'drama/' + f)];
  for (const page of pages) {
    const html = source(page);
    const scripts = [...html.matchAll(/<script src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1]);
    for (const file of ['analytics-config.js', 'visitor-analytics.js']) {
      const matches = scripts.filter(s => s.endsWith('/' + file));
      assert.equal(matches.length, 1, page + ': ' + file);
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(page), matches[0])), page + ': relative path');
    }
    assert.ok(html.indexOf('analytics-config.js') < html.indexOf('visitor-analytics.js'));
  }
  assert.match(source('tools/gen_landing.py'), /src="\.\.\/js\/visitor-analytics\.js"/);
  assert.doesNotMatch(source('admin.html'), /src="js\/visitor-analytics\.js"/);
});
