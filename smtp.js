/**
 * smtp.js: minimal zero-dependency SMTP client with AUTH LOGIN.
 *  - port 465 (default): implicit TLS (Gmail)
 *  - port 587 or "secure": false: STARTTLS (Brevo, SendGrid, Mailgun, most providers)
 * Gmail needs an "App Password" (Google account -> Security -> 2-Step Verification -> App passwords).
 */
'use strict';
const net = require('net'), tls = require('tls');

function reader(sock) { // turns the socket into an async "read next SMTP reply" function
  let buf = '', lines = [], queue = [], waiters = [], err = null;
  const pump = () => { while (waiters.length && (queue.length || err)) { const w = waiters.shift(); queue.length ? w.res(queue.shift()) : w.rej(err); } };
  sock.setTimeout(15000, () => sock.destroy(new Error('SMTP timeout')));
  sock.on('error', e => { err = e; pump(); });
  sock.on('close', () => { err = err || new Error('SMTP connection closed'); pump(); });
  sock.on('data', d => {
    buf += d.toString('utf8'); let m;
    while ((m = /^(\d{3})([ -])([^\r\n]*)\r?\n/.exec(buf))) {
      buf = buf.slice(m[0].length); lines.push(m[3]);
      if (m[2] === ' ') { queue.push({ code: +m[1], text: lines.join(' ') }); lines = []; }
    }
    pump();
  });
  return () => new Promise((res, rej) => { waiters.push({ res, rej }); pump(); });
}

async function send(cfg, to, subject, text) {
  const b64 = s => Buffer.from(s, 'utf8').toString('base64');
  const from = cfg.from || cfg.user, fromAddr = (/<([^>]+)>/.exec(from) || [0, from])[1], port = +cfg.port || 465;
  const implicit = !(cfg.secure === false || port === 587), strict = !cfg.allowSelfSigned;
  let sock = implicit ? tls.connect({ host: cfg.host, port, servername: cfg.host, rejectUnauthorized: strict }) : net.connect({ host: cfg.host, port });
  let read = reader(sock);
  const expect = async (code, what) => { const r = await read(); if (r.code !== code) throw new Error(`SMTP ${what}: ${r.code} ${r.text}`); return r; };
  const cmd = async (line, code, what) => { sock.write(line + '\r\n'); return expect(code, what); };
  // RFC 2047: a non-ASCII display name (e.g. Persian) must be encoded, otherwise some mail servers reject or garble it
  const fromHdr = /^(.*?)\s*<([^>]+)>$/.exec(from) && /[^\x00-\x7F]/.test(from) ? `=?UTF-8?B?${b64(/^(.*?)\s*</.exec(from)[1].replace(/^"|"$/g, ''))}?= <${fromAddr}>` : from;
  const msg = [`From: ${fromHdr}`, `To: ${to}`, `Subject: =?UTF-8?B?${b64(subject)}?=`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', b64(text).match(/.{1,76}/g).join('\r\n')].join('\r\n');
  try {
    await expect(220, 'greeting');
    await cmd('EHLO vira-site', 250, 'EHLO');
    if (!implicit) { // upgrade the plain connection to TLS
      await cmd('STARTTLS', 220, 'STARTTLS'); sock.removeAllListeners('data');
      sock = tls.connect({ socket: sock, servername: cfg.host, rejectUnauthorized: strict }); read = reader(sock);
      await cmd('EHLO vira-site', 250, 'EHLO');
    }
    await cmd('AUTH LOGIN', 334, 'AUTH'); await cmd(b64(cfg.user), 334, 'AUTH'); await cmd(b64(cfg.pass), 235, 'login failed (check username / app password)');
    await cmd(`MAIL FROM:<${fromAddr}>`, 250, 'MAIL FROM'); await cmd(`RCPT TO:<${to}>`, 250, 'RCPT TO'); await cmd('DATA', 354, 'DATA');
    await cmd(msg + '\r\n.', 250, 'message rejected');
    sock.write('QUIT\r\n');
  } finally { sock.destroy(); }
}
module.exports = { send };
