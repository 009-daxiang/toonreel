const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

test('episode completion advances once after repeated manual and automatic changes', async () => {
  class Element extends EventTarget {
    constructor() { super(); this.style = {}; this.classList = { add() {}, remove() {} }; }
    load() {}
    play() { return Promise.resolve(); }
  }
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const events = [];
  const context = vm.createContext({
    URLSearchParams, location: { search: '' }, document: { getElementById: element, addEventListener() {} },
    player: element('player'), window: { CATALOG_READY: { then() {} } },
    showPreroll: done => done(), posterFor: () => '', videoUrlFor: (show, ep) => `ep${ep}.mp4`,
    YTAnalytics: { track: (event, data) => events.push({ event, ...data }) }
  });
  vm.runInContext(source('js/watch.js'), context);
  vm.runInContext(`show = {id: 'test', episodes: 6}; currentEp = 1;
    updateUrl = renderEpisodes = highlightNavBtns = () => {}; hudText = () => '';
    loadEp(false); selectEp(3); selectEp(2);`, context);
  await Promise.resolve();
  for (const expected of [3, 4, 5, 6, 6]) {
    element('video').dispatchEvent(new Event('ended'));
    await Promise.resolve();
    assert.equal(vm.runInContext('currentEp', context), expected);
  }
  assert.deepEqual(events.filter(e => e.event === 'complete').map(e => e.ep), [2, 3, 4, 5, 6]);
});

test('PWA installs existing assets and includes every public page script and style', async () => {
  const handlers = {}, cached = [], deleted = [];
  let skipped = false;
  const context = vm.createContext({ URL, location: { origin: 'https://example.test' },
    self: { addEventListener: (name, fn) => handlers[name] = fn,
      skipWaiting: () => { skipped = true; }, clients: { claim() {} } },
    caches: { open: async () => ({ addAll: async files => {
      for (const file of files) { assert.ok(fs.statSync(path.join(root, file)).isFile(), file); cached.push(file); }
    } }), keys: async () => ['toonreel-v7', 'toonreel-v8', 'another-app'],
      delete: async key => deleted.push(key) }
  });
  vm.runInContext(source('sw.js'), context);
  let pending;
  handlers.install({ waitUntil: promise => pending = promise });
  await pending;
  assert.ok(skipped);
  for (const page of cached.filter(f => f.endsWith('.html'))) {
    for (const match of source(page).matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)) {
      assert.ok(cached.includes(match[1]), `${page} needs ${match[1]}`);
    }
  }
  assert.ok(cached.includes('data/catalog.json'));
  handlers.activate({ waitUntil: promise => pending = promise });
  await pending;
  assert.deepEqual(deleted, ['toonreel-v7']);
  for (const pathname of ['/api/health', '/api/stats', '/uploads/episode.mp4', '/toonreel/uploads/episode.mp4']) {
    handlers.fetch({ request: { method: 'GET', url: 'https://example.test' + pathname },
      respondWith: () => assert.fail(`Must not cache ${pathname}`) });
  }
});
