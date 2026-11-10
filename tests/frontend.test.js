const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

function playerHarness({ fullscreen = true, rejectFullscreen = false } = {}) {
  const events = [], calls = [], diagnostics = [];
  class Element extends EventTarget {
    constructor(id) {
      super(); this.id = id; this.style = {}; this.attributes = {}; this.paused = true;
      this.checked = id === 'autoNext'; this.children = []; this.inert = false;
      const classes = new Set();
      this.classList = { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
        contains: name => classes.has(name) };
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    load() {}
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
    play() { calls.push('play'); this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); }
    focus() { document.activeElement = this; }
    matches() { return ['autoNext', 'playBtn', 'exitFsBtn'].includes(this.id); }
    closest(selector) { return selector === '#tapToPlay' && this.id === 'tapToPlay' ? this : null; }
    setPointerCapture() {}
  }
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const document = new Element('document');
  document.getElementById = element;
  document.body = element('body');
  document.body.children = [element('player'), element('outside')];
  element('player').parentElement = document.body;
  document.activeElement = element('inlinePlayBtn');
  document.exitFullscreen = async () => { document.fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); };
  if (fullscreen) element('player').requestFullscreen = async () => {
    calls.push('fullscreen');
    if (rejectFullscreen) throw new Error('Fullscreen denied');
    document.fullscreenElement = element('player');
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  const context = vm.createContext({
    URLSearchParams, location: { search: '' }, document,
    console: Object.fromEntries(['info', 'error', 'debug'].map(level => [level, (...args) => diagnostics.push([level, ...args])])),
    window: { CATALOG_READY: { then() {} } }, t: key => key,
    showPreroll: done => done(), posterFor: () => '', videoUrlFor: (show, ep) => `ep${ep}.mp4`,
    YTAnalytics: { track: (event, data) => events.push({ event, ...data }) }
  });
  vm.runInContext(source('js/watch.js'), context);
  const run = code => vm.runInContext(code, context);
  run(`show = {id: 'test', episodes: 6}; currentEp = 1;
    updateUrl = renderEpisodes = () => {}; hudText = () => ''; loadEp(false);`);
  const emit = (target, type, props = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.entries(props).forEach(([key, value]) => Object.defineProperty(event, key, { value }));
    target.dispatchEvent(event); return event;
  };
  const swipe = (dy, { dx = 0, target = element('tapZone'), cancel = false } = {}) => {
    emit(element('player'), 'pointerdown', { target, isPrimary: true, button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    if (cancel) emit(element('player'), 'pointercancel');
    emit(element('player'), 'pointerup', { target, pointerId: 1, clientX: dx, clientY: dy });
  };
  return { run, element, events, calls, diagnostics, document, swipe, emit };
}

test('episode completion advances once after repeated manual and automatic changes', async () => {
  const h = playerHarness();
  h.run('selectEp(3); selectEp(2);');
  for (const expected of [3, 4, 5, 6, 6]) {
    h.emit(h.element('video'), 'ended');
    await Promise.resolve();
    assert.equal(h.run('currentEp'), expected);
  }
  assert.deepEqual(h.events.filter(e => e.event === 'complete').map(e => e.ep), [2, 3, 4, 5, 6]);
  assert.equal(h.element('nextEp').disabled, true);
});

test('autoplay is checked initially; disabling it stops at the current episode, manual navigation still works', () => {
  assert.match(source('watch.html'), /id="autoNext"[^>]*checked/);
  const h = playerHarness();
  h.element('autoNext').checked = false;
  h.emit(h.element('video'), 'ended');
  assert.equal(h.run('currentEp'), 1);
  h.emit(h.element('nextEp'), 'click');
  assert.equal(h.run('currentEp'), 2);
  h.run('selectEp(0); selectEp(7);');
  assert.equal(h.run('currentEp'), 2);
  h.emit(h.element('video'), 'ended');
  assert.equal(h.run('currentEp'), 2);
});

test('play requests container fullscreen during the click and icons track real media state', async () => {
  const h = playerHarness();
  h.emit(h.element('inlinePlayBtn'), 'click');
  await Promise.resolve();
  assert.deepEqual(h.calls, ['fullscreen', 'play']);
  assert.equal(h.document.fullscreenElement, h.element('player'));
  assert.equal(h.element('outside').inert, true);
  for (const id of ['playIcon', 'inlinePlayIcon', 'discIcon']) assert.equal(h.element(id).attributes.d, h.run('PAUSE_PATH'));
  h.emit(h.element('playBtn'), 'click');
  assert.equal(h.element('video').paused, true);
  assert.equal(h.element('inlinePlayIcon').attributes.d, h.run('PLAY_PATH'));
  h.emit(h.element('exitFsBtn'), 'click');
  assert.equal(h.element('outside').inert, false);
  assert.equal(h.document.activeElement, h.element('inlinePlayBtn'));
});

test('viewport fullscreen supports WebViews and Escape restores the page', () => {
  const h = playerHarness({ fullscreen: false });
  h.emit(h.element('tapToPlay'), 'click');
  assert.equal(h.element('player').classList.contains('is-fullscreen'), true);
  h.emit(h.document, 'keydown', { key: 'Escape', target: h.element('exitFsBtn') });
  assert.equal(h.run('isFullscreen()'), false);
  assert.equal(h.element('body').classList.contains('player-fullscreen'), false);
});

test('fullscreen and media errors are visible and logged with episode context', async () => {
  const h = playerHarness({ rejectFullscreen: true });
  h.emit(h.element('tapToPlay'), 'click');
  await new Promise(setImmediate);
  assert.equal(h.element('playerError').hidden, false);
  assert.equal(h.element('playerError').textContent, 'fullscreen_failed');
  assert.equal(h.run('isFullscreen()'), false);
  h.element('video').error = { code: 4 };
  h.emit(h.element('video'), 'error');
  assert.equal(h.element('playerError').textContent, 'play_failed');
  assert.equal(h.diagnostics.filter(row => row[0] === 'error').length, 2);
  assert.equal(h.diagnostics[0][2].episode, 1);
});

test('only deliberate fullscreen surface swipes switch episodes, and swipe clicks are suppressed', () => {
  const h = playerHarness({ fullscreen: false });
  h.swipe(-120);
  assert.equal(h.run('currentEp'), 1);
  h.run('enterFullscreen()');
  h.swipe(-120);
  assert.equal(h.run('currentEp'), 2);
  h.swipe(-20); h.swipe(-100, { dx: 110 }); h.swipe(-120, { target: h.element('progress') }); h.swipe(-120, { cancel: true });
  assert.equal(h.run('currentEp'), 2);
  const click = h.emit(h.element('player'), 'click', { target: h.element('tapZone') });
  assert.equal(click.defaultPrevented, true);
  h.swipe(120); h.swipe(120);
  assert.equal(h.run('currentEp'), 1);
});

test('wheel navigation is fullscreen-only and debounced; checkbox keys keep native behavior', () => {
  const h = playerHarness({ fullscreen: false });
  const wheel = () => h.emit(h.element('player'), 'wheel', { target: h.element('tapZone'), deltaY: 100, deltaX: 0, deltaMode: 0 });
  assert.equal(wheel().defaultPrevented, false);
  h.run('enterFullscreen()');
  wheel(); wheel(); wheel();
  assert.equal(h.run('currentEp'), 2);
  h.emit(h.document, 'keydown', { target: h.element('autoNext'), key: 'ArrowDown' });
  assert.equal(h.run('currentEp'), 2);
  h.emit(h.document, 'keydown', { target: h.element('tapZone'), key: 'ArrowDown' });
  assert.equal(h.run('currentEp'), 3);
});

test('PWA installs existing assets and includes every public page script and style', async () => {
  const handlers = {}, cached = [], deleted = [];
  let skipped = false;
  const context = vm.createContext({ URL, location: { origin: 'https://example.test' },
    self: { addEventListener: (name, fn) => handlers[name] = fn,
      skipWaiting: () => { skipped = true; }, clients: { claim() {} } },
    caches: { open: async () => ({ addAll: async files => {
      for (const file of files) { assert.ok(fs.statSync(path.join(root, file)).isFile(), file); cached.push(file); }
    } }), keys: async () => ['toonreel-v8', 'toonreel-v9', 'another-app'],
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
  assert.deepEqual(deleted, ['toonreel-v8']);
  for (const pathname of ['/api/health', '/api/stats', '/uploads/episode.mp4', '/toonreel/uploads/episode.mp4']) {
    handlers.fetch({ request: { method: 'GET', url: 'https://example.test' + pathname },
      respondWith: () => assert.fail(`Must not cache ${pathname}`) });
  }
});
