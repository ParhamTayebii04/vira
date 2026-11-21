/** contact.js: validation, anti-spam (honeypot + cooldown) and email delivery for the contact form. */
(function () {
  'use strict';
  var f = document.getElementById('contactForm'); if (!f) return;
  var msg = document.getElementById('cfMsg'), btn = document.getElementById('cfSubmit'), counter = document.getElementById('cfCount');
  var show = function (t, ok) { msg.textContent = t; msg.className = 'cf-msg ' + (ok ? 'ok' : 'err'); };

  f.message.addEventListener('input', function () { counter.textContent = faDigits(f.message.value.length) + ' / ۱۰۰۰'; });

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = f.name.value.trim(), phone = toEn(f.phone.value.trim()), email = f.email.value.trim(), text = f.message.value.trim();
    if (name.length < 3) return show('نام و نام‌خانوادگی را وارد کنید', false);
    if (!phone && !email) return show('برای پاسخ‌گویی، موبایل یا ایمیل را وارد کنید', false);
    if (phone && !/^09\d{9}$/.test(phone)) return show('شماره موبایل معتبر نیست (09xxxxxxxxx)', false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('ایمیل معتبر نیست', false);
    if (text.length < 10) return show('پیام را کمی کامل‌تر بنویسید', false);
    if (f._honey.value) return done();                                   // bot: pretend success, send nothing
    var last = 0; try { last = +localStorage.getItem('vira_mail_ts') || 0; } catch (x) { /* storage blocked */ }
    if (Date.now() - last < 30000) return show('لطفاً چند ثانیه صبر کنید و دوباره ارسال کنید', false);

    btn.classList.add('loading'); show('', true);
    var fields = { 'نام': name, 'موبایل': phone || '—', 'موضوع': f.topic.value, 'پیام': text };
    if (email) fields.email = email; // FormSubmit uses "email" as the reply-to address
    sendMail('پیام جدید از سایت ویرا آسانسور | ' + f.topic.value, fields).then(function () {
      try { localStorage.setItem('vira_mail_ts', String(Date.now())); } catch (x) { /* ignore */ }
      done();
    }).catch(function (er) { show(er.message, false); }).then(function () { btn.classList.remove('loading'); });
  });

  function done() {
    f.innerHTML = '<div class="cf-done"><div class="check">✓</div><h3>پیام شما ارسال شد</h3><p>کارشناسان ویرا در اولین فرصت با شما تماس می‌گیرند.</p><button type="button" class="btn-ghost2" id="cfAgain">ارسال پیام جدید</button></div>';
    document.getElementById('cfAgain').onclick = function () { location.reload(); };
  }
})();
