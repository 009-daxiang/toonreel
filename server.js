#!/usr/bin/env node
/* ============================================================
   ToonReel — optional zero-dependency backend
   ------------------------------------------------------------
   Provides what GitHub Pages cannot:
     • POST /api/upload      multipart video upload → /uploads
     • POST /api/catalog     publish catalog → data/catalog.json
     • POST /api/payments/checkout   payment entry point
     • POST /api/payments/webhook    payment provider callback
     • GET  /api/health      capability probe used by admin.html
   Everything else is served statically (index/watch/admin).

   Run:   node server.js   (PORT env optional, default 3000)
   Then open http://localhost:3000 — admin.html shows
   "API connected" and uploads/publishing become instant.

   Going live with Stripe:
     1. npm i stripe   2. STRIPE_SECRET_KEY=sk_... node server.js
     3. implement the marked TODO in handleCheckout/handleWebhook
        (create a Checkout Session; credit coins on webhook)
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.jsonl');

// Admin credentials for the management panel.
// Override with env vars:  ADMIN_USER=xx ADMIN_PASS=yy node server.js
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'toonreel2026';
const SESSION_TOKENS = new Set(); // in-memory; restart invalidates sessions

for (const d of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(d, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t', '.ico': 'image/x-icon'
};

/* ---------------- helpers ---------------- */

function send(res, code, body, type = 'application/json') {
  const buf = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(buf);
}

function readBody(req, limit = 512 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* Minimal multipart/form-data parser: returns { fields, files:[{name, filename, data}] } */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) throw new Error('no boundary');
  const boundary = '--' + (m[1] || m[2]);
  const bBound = Buffer.from(boundary);
  const parts = [];
  let start = buf.indexOf(bBound);
  while (start !== -1) {
    const next = buf.indexOf(bBound, start + bBound.length);
    if (next === -1) break;
    parts.push(buf.subarray(start + bBound.length + 2, next - 2)); /* skip \r\n */
    start = next;
  }
  const fields = {}, files = [];
  for (const part of parts) {
    const headEnd = part.indexOf('\r\n\r\n');
    if (headEnd === -1) continue;
    const head = part.subarray(0, headEnd).toString();
    const body = part.subarray(headEnd + 4);
    const nameM = /name="([^"]*)"/i.exec(head);
    const fileM = /filename="([^"]*)"/i.exec(head);
    if (!nameM) continue;
    if (fileM) {
      files.push({ name: nameM[1], filename: fileM[1] || 'file.bin', data: body,
        type: /content-type:\s*([^\r\n]+)/i.exec(head)?.[1]?.trim() || 'application/octet-stream' });
    } else {
      fields[nameM[1]] = body.toString();
    }
  }
  return { fields, files };
}

/* ---------------- viewer accounts & analytics ---------------- */

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}

function visitorId(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
  return crypto.createHash('sha256').update(ip + '|' + new Date().toISOString().slice(0, 10)).digest('hex').slice(0, 16);
}

function trackEvent(req, event, extra) {
  const rec = { t: Date.now(), date: new Date().toISOString().slice(0, 10),
    v: visitorId(req), e: event, lang: req.headers['x-lang'] || '' };
  if (extra) Object.assign(rec, extra);
  fs.appendFileSync(ANALYTICS_FILE, JSON.stringify(rec) + '\n');
}

async function handleRegister(req, res) {
  let data = {};
  try { data = JSON.parse((await readBody(req, 16 * 1024)).toString()); } catch { return send(res, 400, { error: 'invalid json' }); }
  const email = (data.email || '').trim().toLowerCase();
  const password = data.password || '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'invalid email' });
  if (password.length < 6) return send(res, 400, { error: 'password too short (min 6)' });
  const users = loadUsers();
  if (users[email]) return send(res, 409, { error: 'email already registered' });
  const salt = crypto.randomBytes(8).toString('hex');
  users[email] = { salt, hash: crypto.createHash('sha256').update(salt + password).digest('hex'),
    created: new Date().toISOString().slice(0, 10), visitor: data.visitor || '' };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 1));
  trackEvent(req, 'register', { email });
  send(res, 200, { ok: true, email });
}

async function handleUserLogin(req, res) {
  let data = {};
  try { data = JSON.parse((await readBody(req, 16 * 1024)).toString()); } catch { return send(res, 400, { error: 'invalid json' }); }
  const email = (data.email || '').trim().toLowerCase();
  const u = loadUsers()[email];
  if (!u || u.hash !== crypto.createHash('sha256').update(u.salt + (data.password || '')).digest('hex')) {
    return send(res, 401, { error: 'wrong email or password' });
  }
  send(res, 200, { ok: true, email });
}

async function handleTrack(req, res) {
  let data = {};
  try { data = JSON.parse((await readBody(req, 4 * 1024)).toString()); } catch { return send(res, 204, ''); }
  if (!['visit', 'play', 'complete'].includes(data.e)) return send(res, 400, { error: 'bad event' });
  const extra = {};
  for (const k of ['show', 'ep', 'page']) if (data[k] !== undefined) extra[k] = data[k];
  trackEvent(req, data.e, extra);
  send(res, 204, '');
}

async function handleStats(req, res) {
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
  const today = new Date().toISOString().slice(0, 10);
  const days = {}, plays = {};
  const visitors = new Set(), visitorsToday = new Set();
  let pvToday = 0, registers = 0;
  try {
    for (const line of fs.readFileSync(ANALYTICS_FILE, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch { continue; }
      const d = r.date || '';
      days[d] = (days[d] || 0) + 1;
      visitors.add(r.v);
      if (d === today) visitorsToday.add(r.v);
      if (r.e === 'visit' && d === today) pvToday++;
      if (r.e === 'play' && r.show) plays[r.show] = (plays[r.show] || 0) + 1;
      if (r.e === 'register') registers++;
    }
  } catch { /* no analytics yet */ }
  const trend = Object.keys(days).sort().slice(-7).map(d => ({ date: d, events: days[d] }));
  const top = Object.entries(plays).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([show, plays]) => ({ show, plays }));
  send(res, 200, {
    today: { visitors: visitorsToday.size, pageviews: pvToday },
    totals: { visitors: visitors.size, plays: Object.values(plays).reduce((a, b) => a + b, 0), registers },
    topShows: top, trend
  });
}

/* ---------------- admin auth ---------------- */

function handleLogin(req, res) {
  return readBody(req, 64 * 1024).then(body => {
    let data = {};
    try { data = JSON.parse(body.toString()); } catch {}
    if (data.user === ADMIN_USER && data.pass === ADMIN_PASS) {
      const token = crypto.randomBytes(24).toString('hex');
      SESSION_TOKENS.add(token);
      send(res, 200, { ok: true, token });
    } else {
      send(res, 401, { error: 'wrong username or password' });
    }
  });
}

function authorized(req) {
  const auth = req.headers.authorization || '';
  return SESSION_TOKENS.has(auth.replace('Bearer ', ''));
}

/* ---------------- API handlers ---------------- */

async function handleUpload(req, res) {
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized — log in at /admin.html' });
  if (parseInt(req.headers['content-length'] || 0) > 512 * 1024 * 1024) {
    return send(res, 413, { error: 'file too large (max 512MB)' });
  }
  const body = await readBody(req);
  const { files } = parseMultipart(body, req.headers['content-type']);
  const file = files.find(f => f.name === 'file') || files[0];
  if (!file) return send(res, 400, { error: 'no file' });
  const ext = path.extname(file.filename).toLowerCase() || '.mp4';
  if (!['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) {
    return send(res, 400, { error: `unsupported file type ${ext}` });
  }
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.data);
  send(res, 200, { ok: true, url: `/uploads/${name}` });
}

/* App package info for download.html. Naming conventions in /downloads:
     toonreel.apk | toonreel-<v>.apk        Android
     toonreel.ipa                            iOS (side-load builds)
     toonreel-mac.zip | toonreel-mac.dmg     macOS
     toonreel-setup.exe | toonreel-win.zip   Windows                        */
function appInfo() {
  const dir = path.join(ROOT, 'downloads');
  const out = { apk: null, ipa: null, mac: null, win: null };
  const pick = (re) => {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!re.test(f)) continue;
        const st = fs.statSync(path.join(dir, f));
        const vm = /-(\d+\.\d+(?:\.\d+)?)\.(?:apk|zip|dmg|exe)$/i.exec(f);
        return {
          available: true, file: f, url: '/downloads/' + encodeURIComponent(f),
          size: st.size, version: (vm && vm[1]) || null,
          updated: st.mtime.toISOString()
        };
      }
    } catch { /* downloads/ missing */ }
    return null;
  };
  out.apk = pick(/\.apk$/i);
  out.ipa = pick(/\.ipa$/i);
  out.mac = pick(/-mac\.(zip|dmg)$/i);
  out.win = pick(/(-setup\.exe|-win\.(exe|zip))$/i);
  return out;
}

async function handleCatalog(req, res) {
  if (!authorized(req)) return send(res, 401, { error: 'unauthorized — log in at /admin.html' });
  const body = await readBody(req, 16 * 1024 * 1024);
  let cat;
  try { cat = JSON.parse(body.toString()); } catch { return send(res, 400, { error: 'invalid json' }); }
  if (!cat || !Array.isArray(cat.shows) || !cat.shows.length) {
    return send(res, 400, { error: 'catalog.shows must be a non-empty array' });
  }
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(cat, null, 2));
  send(res, 200, { ok: true, shows: cat.shows.length });
}

async function handleCheckout(req, res) {
  const body = await readBody(req);
  let data = {};
  try { data = JSON.parse(body.toString()); } catch {}
  const { packageId, provider } = data;

  /* ---- STRIPE (go-live): --------------------------------------
     const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
     const session = await stripe.checkout.sessions.create({
       mode: 'payment',
       line_items: [{ price: PRICE_IDS[packageId], quantity: 1 }],
       success_url: SITE_URL + '/watch.html?paid=1',
       cancel_url: SITE_URL,
       metadata: { packageId }
     });
     return send(res, 200, { url: session.url });
     Price IDs are created once in the Stripe dashboard and mapped
     from PAYMENT_CONFIG.packages. -------------------------------- */

  console.log(`[payments] checkout requested: package=${packageId} provider=${provider || 'n/a'}`);
  send(res, 200, {
    error: 'Payment provider not configured yet. Set provider="demo" on the frontend, or implement /api/payments/checkout (see server.js comments).'
  });
}

async function handleWebhook(req, res) {
  const raw = await readBody(req, 4 * 1024 * 1024);
  /* ---- STRIPE (go-live): verify signature, then credit coins:
     const sig = req.headers['stripe-signature'];
     const event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
     if (event.type === 'checkout.session.completed') {
       const pkg = PACKAGE_BY_ID[event.data.object.metadata.packageId];
       await creditCoins(event.data.object.customer_details.email, pkg.coins);
     } ---------------------------------------------------------- */
  console.log('[payments] webhook received:', raw.toString().slice(0, 300));
  send(res, 200, { received: true });
}

/* ---------------- static files ---------------- */

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) return send(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, '404 Not Found', 'text/plain');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    /* allow range requests so <video> can seek into local files */
    const range = req.headers.range;
    if (range && type.startsWith('video/')) {
      const stat = fs.statSync(file);
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m[1] ? parseInt(m[1]) : 0;
      const end = m[2] ? parseInt(m[2]) : stat.size - 1;
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes'
      });
      return res.end(data.subarray(start, end + 1));
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

/* ---------------- server ---------------- */

const server = http.createServer(async (req, res) => {
  const url = req.url;
  try {
    if (url === '/api/health') return send(res, 200, { ok: true, api: true, uploads: true, auth: true });
    if (url === '/api/login' && req.method === 'POST') return await handleLogin(req, res);
    if (url === '/api/register' && req.method === 'POST') return await handleRegister(req, res);
    if (url === '/api/user/login' && req.method === 'POST') return await handleUserLogin(req, res);
    if (url === '/api/track' && req.method === 'POST') return await handleTrack(req, res);
    if (url === '/api/stats' && req.method === 'GET') return await handleStats(req, res);
    if (url === '/api/app/info') return send(res, 200, appInfo());
    if (url === '/api/upload' && req.method === 'POST') return await handleUpload(req, res);
    if (url === '/api/catalog' && req.method === 'POST') return await handleCatalog(req, res);
    if (url === '/api/catalog' && req.method === 'GET') {
      const cat = fs.existsSync(CATALOG_FILE) ? fs.readFileSync(CATALOG_FILE) : { shows: [] };
      return send(res, 200, JSON.parse(cat));
    }
    if (url === '/api/payments/checkout' && req.method === 'POST') return await handleCheckout(req, res);
    if (url === '/api/payments/webhook' && req.method === 'POST') return await handleWebhook(req, res);
    if (url.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
    serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message || 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`\n  ToonReel server → http://localhost:${PORT}`);
  console.log('  Admin:        http://localhost:' + PORT + '/admin.html  (API mode: instant publish & uploads)');
  console.log('  Payment stub: POST /api/payments/checkout   (implement for Stripe/Paddle — see comments)\n');
});
