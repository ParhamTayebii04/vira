/** api.js: tiny fetch wrapper (same-origin cookies carry the login session). */
window.API = (function () {
  'use strict';
  async function req(method, url, body) {
    const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .catch(() => { throw new Error(location.protocol === 'file:' ? 'صفحه را از روی فایل باز کرده‌اید؛ start.bat را اجرا کنید و http://localhost:8080 را باز کنید' : 'ارتباط با سرور برقرار نشد؛ مطمئن شوید start.bat در حال اجراست'); });
    let j = {}; try { j = await r.json(); } catch (e) { /* non-JSON */ }
    if (!r.ok) { const e = new Error(j.error || 'خطای سرور'); e.wait = j.wait; throw e; }
    return j;
  }
  return { get: u => req('GET', u), post: (u, b) => req('POST', u, b || {}) };
})();
