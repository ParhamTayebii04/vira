/**
 * mailer.js: sends form data to the owner's inbox through FormSubmit (no server code needed).
 * First use: submit one test message, then click the activation link FormSubmit emails to the address below.
 */
(function () {
  'use strict';
  var TO = 'Parham.Tayebii1116@gmail.com'; // after activation you may replace this with the private alias FormSubmit gives you (hides the address from visitors)
  window.sendMail = function (subject, fields) {
    if (location.protocol === 'file:') return Promise.reject(new Error('صفحه را از روی فایل باز کرده‌اید؛ start.bat را اجرا کنید و سایت را از http://localhost:8080 باز کنید'));
    var body = Object.assign({ _subject: subject, _template: 'table', _captcha: 'false' }, fields);
    return fetch('https://formsubmit.co/ajax/' + TO, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body)
    }).catch(function () { throw new Error('ارتباط با سرور ایمیل برقرار نشد؛ اینترنت را بررسی کنید'); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.success === 'false' || j.success === false) {
            throw new Error(/activat/i.test(j.message || '') ? 'ایمیل دریافت‌کننده هنوز فعال نشده است؛ ایمیل تأیید ارسال‌شده را باز کنید' : (j.message || 'ارسال ناموفق بود؛ دوباره تلاش کنید'));
          }
          return j;
        });
      });
  };
})();
