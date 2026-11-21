/**
 * auth-page.js: register (email+username+phone -> emailed code -> password), login,
 * forgot username / forgot password (email + proof -> emailed code -> new value).
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const faD = s => String(s).replace(/\d/g, c => '۰۱۲۳۴۵۶۷۸۹'[c]);
  const toEn = s => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
  const next = (() => { const n = new URLSearchParams(location.search).get('next'); return /^[a-z-]+\.html$/.test(n || '') ? n : 'profile.html'; })();
  let ctx = null, timer = null; // ctx: { mode: 'reg'|'fpass'|'fuser', email, start: {url, body}, token }

  const msg = (t, ok) => { $('auMsg').textContent = t || ''; $('auMsg').className = 'cf-msg ' + (ok ? 'ok' : 'err'); };
  function go(id) { document.querySelectorAll('.wstep').forEach(s => s.classList.toggle('active', s.id === id)); msg(''); }
  async function run(btn, fn) { // disables the button while a request is running
    btn.classList.add('loading'); btn.disabled = true;
    try { await fn(); } catch (e) { msg('⚠️ ' + e.message); } finally { btn.classList.remove('loading'); btn.disabled = false; }
  }
  const finish = u => { Auth.user = u; location.href = next; };

  /* ---------- code step (shared by register / forgot flows) ---------- */
  function countdown(sec) {
    clearInterval(timer); $('bResend').hidden = true; $('cdWrap').hidden = false;
    const tick = () => {
      if (sec <= 0) { clearInterval(timer); $('cdWrap').hidden = true; $('bResend').hidden = false; return; }
      $('cdTimer').textContent = faD(String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0')); sec--;
    };
    tick(); timer = setInterval(tick, 1000);
  }
  function showCode(r) {
    $('cEmail').textContent = ctx.email; $('cCode').value = ''; go('s-code'); countdown(r.cooldown || 120);
    if (r.devCode) msg('حالت آزمایشی: کد شما ' + r.devCode, true); // only when devShowCode is enabled in config.json
    else if (r.dev) msg('حالت آزمایشی: ایمیل هنوز روی سرور تنظیم نشده و کد در پنجره سیاه سرور چاپ شد.', true);
    $('cCode').focus();
  }
  async function sendCode() { const r = await API.post(ctx.start.url, ctx.start.body); showCode(r); }

  $('bVerify').addEventListener('click', e => run(e.currentTarget, async () => {
    const code = toEn($('cCode').value); if (!/^\d{6}$/.test(code)) throw new Error('کد ۶ رقمی را وارد کنید');
    const r = await API.post(ctx.mode === 'reg' ? '/api/register/verify' : '/api/forgot/verify', { email: ctx.email, code, kind: ctx.mode });
    ctx.token = r.token; clearInterval(timer);
    if (ctx.mode === 'fuser') go('s-newuser'); else { $('pTitle').textContent = ctx.mode === 'reg' ? 'رمز عبور خود را انتخاب کنید' : 'رمز عبور جدید'; go('s-pass'); }
  }));
  $('bResend').addEventListener('click', e => run(e.currentTarget, async () => {
    try { await sendCode(); msg('کد جدید ارسال شد', true); } catch (er) { if (er.wait) countdown(er.wait); throw er; }
  }));
  $('bCodeBack').addEventListener('click', () => { clearInterval(timer); go(ctx && ctx.mode === 'reg' ? 's-reg' : 's-login'); });

  /* ---------- login ---------- */
  $('bLogin').addEventListener('click', e => run(e.currentTarget, async () => {
    const r = await API.post('/api/login', { username: $('lUser').value.trim(), password: $('lPass').value }); finish(r.user);
  }));

  /* ---------- register ---------- */
  $('bReg').addEventListener('click', e => run(e.currentTarget, async () => {
    const email = $('rEmail').value.trim().toLowerCase(), username = $('rUser').value.trim(), phone = toEn($('rPhone').value);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('ایمیل معتبر نیست');
    if (!/^[A-Za-z0-9_.]{3,20}$/.test(username)) throw new Error('نام کاربری ۳ تا ۲۰ کاراکتر و فقط شامل حروف انگلیسی، عدد، _ و . باشد');
    if (!/^09\d{9}$/.test(phone)) throw new Error('شماره موبایل معتبر نیست (09xxxxxxxxx)');
    ctx = { mode: 'reg', email, start: { url: '/api/register/start', body: { email, username, phone } } };
    try { await sendCode(); } catch (er) { if (er.wait) { showCode({ cooldown: er.wait }); msg('کد قبلاً ارسال شده است؛ آن را وارد کنید', true); return; } throw er; }
  }));

  /* ---------- password step ---------- */
  const strength = p => { let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++; return s; };
  [['pNew', 'pBar'], ['uNew', 'uBar']].forEach(([i, b]) => $(i).addEventListener('input', () => { $(b).style.width = strength($(i).value) * 25 + '%'; $(b).dataset.s = strength($(i).value); }));
  $('bPass').addEventListener('click', e => run(e.currentTarget, async () => {
    const password = $('pNew').value, confirm = $('pNew2').value;
    if (password !== confirm) throw new Error('تکرار رمز عبور مطابقت ندارد');
    const r = ctx.mode === 'reg'
      ? await API.post('/api/register/complete', { email: ctx.email, token: ctx.token, password, confirm })
      : await API.post('/api/forgot/complete', { kind: 'fpass', email: ctx.email, token: ctx.token, newPassword: password, confirm });
    finish(r.user);
  }));

  /* ---------- forgot: choose what was forgotten ---------- */
  $('bForgotPass').addEventListener('click', () => go('s-fpass'));
  $('bForgotUser').addEventListener('click', () => go('s-fuser'));
  $('bFP').addEventListener('click', e => run(e.currentTarget, async () => {
    const email = $('fpEmail').value.trim().toLowerCase(), username = $('fpUser').value.trim();
    if (!email || !username) throw new Error('ایمیل و نام کاربری را وارد کنید');
    ctx = { mode: 'fpass', email, start: { url: '/api/forgot/start', body: { kind: 'fpass', email, username } } }; await sendCode();
    msg('اگر اطلاعات درست باشد، کد به ایمیل شما ارسال می‌شود', true);
  }));
  $('bFU').addEventListener('click', e => run(e.currentTarget, async () => {
    const email = $('fuEmail').value.trim().toLowerCase(), password = $('fuPass').value;
    if (!email || !password) throw new Error('ایمیل و رمز عبور را وارد کنید');
    ctx = { mode: 'fuser', email, start: { url: '/api/forgot/start', body: { kind: 'fuser', email, password } } }; await sendCode();
    msg('اگر اطلاعات درست باشد، کد به ایمیل شما ارسال می‌شود', true);
  }));

  /* ---------- new username (+ optional new password) ---------- */
  let changePw = false;
  document.querySelectorAll('[data-chpw]').forEach(b => b.addEventListener('click', () => {
    changePw = b.dataset.chpw === '1'; document.querySelectorAll('[data-chpw]').forEach(x => x.classList.toggle('selected', x === b)); $('uPw').hidden = !changePw;
  }));
  $('bUser').addEventListener('click', e => run(e.currentTarget, async () => {
    const r = await API.post('/api/forgot/complete', { kind: 'fuser', email: ctx.email, token: ctx.token, newUsername: $('uName').value.trim(), changePassword: changePw, newPassword: $('uNew').value, confirm: $('uNew2').value });
    finish(r.user);
  }));

  /* ---------- navigation links ---------- */
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  Auth.ready.then(() => { if (Auth.user) location.replace(next); });
  if (new URLSearchParams(location.search).get('tab') === 'reg') go('s-reg');
})();
