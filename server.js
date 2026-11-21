/**
 * server.js: Vira site server (Node >= 18, zero dependencies): static files + accounts API.
 * Run: node server.js -> http://localhost:8080. Settings live in config.json (SMTP for real emails).
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), smtp = require('./smtp');

/* ===================== CONFIG / STORAGE ===================== */
const PORT = process.env.PORT || 8080, ROOT = __dirname, DATA = path.join(ROOT, 'data'), DB_FILE = path.join(DATA, 'db.json');
let cfg = { ownerEmail: '', ipLimit: 2, trustProxy: false, devShowCode: false, smtp: {} };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(process.env.VIRA_CONFIG || path.join(ROOT, 'config.json'), 'utf8')) }; } catch (e) { console.log('config.json not found or invalid; using defaults'); }
fs.mkdirSync(DATA, { recursive: true });
let db = { users: [], sessions: {}, challenges: {} };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch (e) { /* first run */ }
const save = () => { fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); };
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };

/* ===================== HELPERS ===================== */
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
const checkPw = (pw, st) => { const [s, h] = st.split(':'); return crypto.timingSafeEqual(Buffer.from(h, 'hex'), crypto.scryptSync(pw, s, 64)); };
const send = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const fail = (res, code, msg, extra) => send(res, code, { error: msg, ...extra });
const readJSON = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) { no(new Error('big')); req.destroy(); } }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { no(e); } }); });
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(a => a[0]));
const ipOf = req => cfg.trustProxy ? (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress) : req.socket.remoteAddress;
const isLocal = ip => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
const profile = u => ({ username: u.username, email: u.email, phone: u.phone, created: u.created });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, USERNAME = /^[A-Za-z0-9_.]{3,20}$/, PHONE = /^09\d{9}$/;
const pwError = p => (typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)) ? null : 'رمز عبور حداقل ۸ کاراکتر و شامل حرف و عدد باشد';
const findUser = (field, v) => db.users.find(u => u[field].toLowerCase() === String(v).toLowerCase());

/** Email delivery: 'sent' via SMTP (config.json), or 'dev' = printed in this terminal when SMTP is not configured. Throws if SMTP fails. */
const smtpReady = () => !!(cfg.smtp && cfg.smtp.user && cfg.smtp.pass);
async function mail(to, subject, text) {
  if (!smtpReady()) { console.log(`\n[MAIL -> ${to}] ${subject}\n${text}\n`); return 'dev'; }
  await smtp.send(cfg.smtp, to, subject, text); console.log(`[MAIL sent] "${subject}" -> ${to}`); return 'sent';
}

/* ===================== SESSIONS ===================== */
function startSession(req, res, userId) {
  const t = crypto.randomBytes(32).toString('hex'), age = 30 * 86400;
  db.sessions[sha(t)] = { userId, exp: Date.now() + age * 1000 }; save();
  res.setHeader('Set-Cookie', `vsid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}` + (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''));
}
function userOf(req) {
  const t = cookies(req).vsid, s = t && db.sessions[sha(t)];
  return s && s.exp > Date.now() ? db.users.find(u => u.id === s.userId) || null : null;
}
const dropSessions = id => { for (const k in db.sessions) if (db.sessions[k].userId === id) delete db.sessions[k]; };

/* ===================== VERIFICATION CODES ===================== */
const COOLDOWN = 120000;
async function issue(kind, email, payload) {
  const key = kind + ':' + email, c = db.challenges[key], now = Date.now();
  if (c && now - c.sent < COOLDOWN) return { wait: Math.ceil((COOLDOWN - (now - c.sent)) / 1000) };
  const code = String(crypto.randomInt(100000, 1000000));
  db.challenges[key] = { h: sha(code + key), exp: now + 600000, sent: now, tries: 0, payload, token: null }; save();
  try {
    const how = await mail(email, 'کد تأیید ویرا', `کد تأیید شما: ${code}\nاین کد تا ۱۰ دقیقه معتبر است. اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.`);
    return { ok: true, cooldown: COOLDOWN / 1000, dev: how === 'dev', devCode: cfg.devShowCode ? code : undefined };
  } catch (e) {
    console.log('[MAIL FAILED]', email, e.message); delete db.challenges[key]; save();
    return { mailError: true };
  }
}
function check(kind, email, code) { // returns a one-time token after a correct code (max 5 tries)
  const key = kind + ':' + email, c = db.challenges[key], now = Date.now();
  if (!c || c.exp < now || c.tries >= 5) return null;
  c.tries++;
  if (c.h !== sha(String(code).trim() + key)) { save(); return null; }
  c.token = crypto.randomBytes(24).toString('hex'); c.exp = now + 900000; save();
  return c.token;
}
const claim = (kind, email, token) => { const c = db.challenges[kind + ':' + email]; return c && c.token && c.token === token && c.exp > Date.now() ? c : null; };
const fails = {};
const MAIL_ERR = 'ارسال ایمیل ناموفق بود؛ چند دقیقه بعد دوباره تلاش کنید';

/* ===================== API ===================== */
async function api(req, res, url) {
  const m = req.method, p = url.pathname, ip = ipOf(req), user = userOf(req);
  if (m === 'GET' && (p === '/api/me' || p === '/api/profile')) return send(res, 200, { user: user ? profile(user) : null });
  if (m !== 'POST') return fail(res, 404, 'یافت نشد');
  const b = await readJSON(req), email = String(b.email || '').trim().toLowerCase();

  if (p === '/api/logout') { const t = cookies(req).vsid; if (t) { delete db.sessions[sha(t)]; save(); } res.setHeader('Set-Cookie', 'vsid=; HttpOnly; Path=/; Max-Age=0'); return send(res, 200, { ok: true }); }

  if (p === '/api/login') {
    const k = ip + String(b.username).toLowerCase(), f = fails[k] || { n: 0, t: 0 };
    if (f.n >= 5 && Date.now() - f.t < 6e5) return fail(res, 429, 'تلاش بیش از حد؛ ۱۰ دقیقه بعد دوباره امتحان کنید');
    const u = findUser('username', b.username || '');
    if (!u || !checkPw(String(b.password || ''), u.pw)) { fails[k] = { n: f.n + 1, t: Date.now() }; return fail(res, 401, 'نام کاربری یا رمز عبور اشتباه است'); }
    delete fails[k]; startSession(req, res, u.id); return send(res, 200, { user: profile(u) });
  }

  /* ---- registration: 1) details -> code, 2) verify, 3) password ---- */
  if (p === '/api/register/start') {
    const username = String(b.username || '').trim(), phone = String(b.phone || '').trim();
    if (!EMAIL.test(email)) return fail(res, 400, 'ایمیل معتبر نیست');
    if (!USERNAME.test(username)) return fail(res, 400, 'نام کاربری ۳ تا ۲۰ کاراکتر و فقط شامل حروف انگلیسی، عدد، _ و . باشد');
    if (!PHONE.test(phone)) return fail(res, 400, 'شماره موبایل معتبر نیست (09xxxxxxxxx)');
    if (findUser('email', email)) return fail(res, 409, 'این ایمیل قبلاً ثبت‌نام کرده است؛ وارد شوید');
    if (findUser('username', username)) return fail(res, 409, 'این نام کاربری قبلاً گرفته شده است');
    if (!isLocal(ip) && db.users.filter(u => u.ip === ip).length >= cfg.ipLimit) return fail(res, 403, `از این شبکه (IP) حداکثر ${cfg.ipLimit} حساب قابل ثبت‌نام است`);
    const r = await issue('reg', email, { username, phone });
    if (r.mailError) return fail(res, 502, MAIL_ERR);
    return r.wait ? fail(res, 429, `کد قبلاً ارسال شده؛ ${r.wait} ثانیه دیگر می‌توانید دوباره درخواست دهید`, { wait: r.wait }) : send(res, 200, r);
  }
  if (p === '/api/register/verify') { const t = check('reg', email, b.code); return t ? send(res, 200, { token: t }) : fail(res, 400, 'کد اشتباه یا منقضی است'); }
  if (p === '/api/register/complete') {
    const c = claim('reg', email, b.token); if (!c) return fail(res, 400, 'مرحله تأیید منقضی شده است؛ دوباره شروع کنید');
    if (b.password !== b.confirm) return fail(res, 400, 'تکرار رمز عبور مطابقت ندارد');
    const e = pwError(b.password); if (e) return fail(res, 400, e);
    if (findUser('email', email) || findUser('username', c.payload.username)) return fail(res, 409, 'این ایمیل یا نام کاربری قبلاً ثبت شده است');
    if (!isLocal(ip) && db.users.filter(u => u.ip === ip).length >= cfg.ipLimit) return fail(res, 403, `از این شبکه (IP) حداکثر ${cfg.ipLimit} حساب قابل ثبت‌نام است`);
    const u = { id: crypto.randomUUID(), email, username: c.payload.username, phone: c.payload.phone, pw: hashPw(b.password), ip, created: Date.now() };
    db.users.push(u); delete db.challenges['reg:' + email]; save(); startSession(req, res, u.id);
    if (cfg.ownerEmail) mail(cfg.ownerEmail, 'ثبت‌نام جدید در سایت ویرا', `یک کاربر جدید ثبت‌نام کرد:\nنام کاربری: ${u.username}\nایمیل: ${u.email}\nموبایل: ${u.phone}\nIP: ${ip}\nزمان: ${new Date().toLocaleString('fa-IR')}`).catch(e => console.log('[OWNER MAIL FAILED]', e.message));
    return send(res, 200, { user: profile(u) });
  }

  /* ---- forgot password / username (same code flow, different proof) ---- */
  const kind = b.kind === 'fuser' ? 'fuser' : 'fpass';
  if (p === '/api/forgot/start') {
    const u = findUser('email', email);
    const proven = u && (kind === 'fpass' ? String(b.username || '').toLowerCase() === u.username.toLowerCase() : checkPw(String(b.password || ''), u.pw));
    if (!proven) return send(res, 200, { ok: true, cooldown: COOLDOWN / 1000 }); // same answer: never reveal which details exist
    const r = await issue(kind, email, {});
    if (r.mailError) return fail(res, 502, MAIL_ERR);
    return r.wait ? fail(res, 429, `کد قبلاً ارسال شده؛ ${r.wait} ثانیه دیگر می‌توانید دوباره درخواست دهید`, { wait: r.wait }) : send(res, 200, r);
  }
  if (p === '/api/forgot/verify') { const t = check(kind, email, b.code); return t ? send(res, 200, { token: t }) : fail(res, 400, 'کد اشتباه یا منقضی است'); }
  if (p === '/api/forgot/complete') {
    if (!claim(kind, email, b.token)) return fail(res, 400, 'مرحله تأیید منقضی شده است؛ دوباره شروع کنید');
    const u = findUser('email', email); if (!u) return fail(res, 400, 'حساب یافت نشد');
    if (kind === 'fuser') {
      const nu = String(b.newUsername || '').trim();
      if (!USERNAME.test(nu)) return fail(res, 400, 'نام کاربری ۳ تا ۲۰ کاراکتر و فقط شامل حروف انگلیسی، عدد، _ و . باشد');
      const other = findUser('username', nu); if (other && other.id !== u.id) return fail(res, 409, 'این نام کاربری قبلاً گرفته شده است');
      if (b.changePassword) { if (b.newPassword !== b.confirm) return fail(res, 400, 'تکرار رمز عبور مطابقت ندارد'); const e = pwError(b.newPassword); if (e) return fail(res, 400, e); u.pw = hashPw(b.newPassword); }
      u.username = nu;
    } else {
      if (b.newPassword !== b.confirm) return fail(res, 400, 'تکرار رمز عبور مطابقت ندارد');
      const e = pwError(b.newPassword); if (e) return fail(res, 400, e); u.pw = hashPw(b.newPassword);
    }
    delete db.challenges[kind + ':' + email]; dropSessions(u.id); save(); startSession(req, res, u.id);
    return send(res, 200, { user: profile(u) });
  }
  return fail(res, 404, 'یافت نشد');
}

/* ===================== SELF-HOSTED FONT ===================== */
// Downloads Vazirmatn (free, OFL) once into fonts/ so the site never depends on Google Fonts (often blocked in Iran).
const FONT_FILE = path.join(ROOT, 'fonts', 'Vazirmatn-Variable.woff2');
const FONT_URLS = (process.env.FONT_URLS ? process.env.FONT_URLS.split(',') : [
  'https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/fonts/webfonts/Vazirmatn%5Bwght%5D.woff2',
  'https://unpkg.com/vazirmatn@33.0.3/fonts/webfonts/Vazirmatn%5Bwght%5D.woff2',
  'https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/webfonts/Vazirmatn%5Bwght%5D.woff2']);
async function ensureFont() {
  if (fs.existsSync(FONT_FILE)) return;
  for (const u of FONT_URLS) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (!r.ok) continue;
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length < 20000 || b.slice(0, 4).toString() !== 'wOF2') continue; // must be a real woff2 file
      fs.mkdirSync(path.dirname(FONT_FILE), { recursive: true }); fs.writeFileSync(FONT_FILE, b); console.log('Font installed: fonts/Vazirmatn-Variable.woff2'); return;
    } catch (e) { /* try the next mirror */ }
  }
  console.log('Could not download the Vazirmatn font automatically. Download "Vazirmatn[wght].woff2" from github.com/rastikerdar/vazirmatn and save it as fonts/Vazirmatn-Variable.woff2');
}

/* ===================== SERVER ===================== */
http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel), ext = path.extname(file).toLowerCase();
    const blocked = !file.startsWith(ROOT) || /^\/(data|node_modules)\b/.test(rel) || ['server.js', 'smtp.js'].includes(path.basename(file)) || !MIME[ext];
    if (blocked || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[ext] + (/html|css|javascript/.test(MIME[ext]) ? '; charset=utf-8' : '') });
    fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) fail(res, 500, 'خطای سرور'); }
}).listen(PORT, () => { console.log('Vira site: http://localhost:' + PORT); console.log(smtpReady() ? 'Email: SMTP configured' : 'Email: NOT configured (codes are printed in this window). See config.json'); ensureFont(); });
