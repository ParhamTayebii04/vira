/** auth.js: session state + the login/profile link in the header (all pages). */
(function () {
  'use strict';
  const Auth = { user: null };
  window.Auth = Auth;
  Auth.ready = API.get('/api/me').then(r => { Auth.user = r.user; }).catch(() => {});
  Auth.logout = async () => { try { await API.post('/api/logout'); } finally { location.href = 'index.html'; } };
  document.addEventListener('DOMContentLoaded', () => Auth.ready.then(() => {
    const slot = document.getElementById('authSlot'); if (!slot) return;
    const a = document.createElement('a'); a.className = 'auth-link';
    if (Auth.user) { a.href = 'profile.html'; a.textContent = '👤 ' + Auth.user.username; } else { a.href = 'auth.html'; a.textContent = 'ورود / ثبت‌نام'; }
    slot.appendChild(a);
  }));
})();
