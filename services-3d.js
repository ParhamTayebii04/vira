/** services-3d.js: tilt cards, interactive CSS-3D elevator model (drag to rotate), service pre-selection. */
(function () {
  'use strict';
  /* ---- tilt cards (mouse devices only) ---- */
  if (matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.svc-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }
  /* ---- "book this service": pick it in the wizard and scroll there ---- */
  document.querySelectorAll('.svc-btn').forEach(b => b.addEventListener('click', () => {
    const cards = document.querySelectorAll('.s-card'), c = cards[+b.dataset.svc];
    if (c) c.click();
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));

  /* ---- 3D elevator model ---- */
  const stage = document.getElementById('stage'); if (!stage) return;
  function box(w, h, d, cls, part) { // a cuboid made of 6 CSS-3D faces
    const el = document.createElement('div'); el.className = 'box ' + cls; if (part) el.dataset.part = part;
    el.style.cssText = `width:${w}px;height:${h}px;left:${-w / 2}px;top:${-h / 2}px`;
    const faces = [[w, h, `translateZ(${d / 2}px)`], [w, h, `rotateY(180deg) translateZ(${d / 2}px)`], [d, h, `rotateY(90deg) translateZ(${w / 2}px)`], [d, h, `rotateY(-90deg) translateZ(${w / 2}px)`], [w, d, `rotateX(90deg) translateZ(${h / 2}px)`], [w, d, `rotateX(-90deg) translateZ(${h / 2}px)`]];
    faces.forEach(([fw, fh, t]) => { const f = document.createElement('i'); f.className = 'f'; f.style.cssText = `width:${fw}px;height:${fh}px;left:${(w - fw) / 2}px;top:${(h - fh) / 2}px;transform:${t}`; el.appendChild(f); });
    return el;
  }
  const at = (el, x, y, z, anim) => { const w = document.createElement('div'); w.className = 'pos' + (anim ? ' ' + anim : ''); w.style.transform = `translate3d(${x}px,${y}px,${z}px)`; w.appendChild(el); return w; };
  const wrap = (el, anim, x, z) => { const w = document.createElement('div'); w.className = 'pos ' + anim; w.style.left = x + 'px'; w.style.setProperty('--z', z + 'px'); w.appendChild(el); return w; };

  stage.appendChild(at(box(150, 320, 150, 'shaft', 'shaft'), 0, 0, 0));
  stage.appendChild(at(box(176, 46, 176, 'machine', 'motor'), 0, -183, 0));
  stage.appendChild(at(box(40, 28, 40, 'machine', 'motor'), 30, -222, 0));
  [-52, 52].forEach(x => stage.appendChild(at(box(5, 300, 5, 'rail', 'rails'), x, 0, 0)));
  const cab = document.createElement('div'); cab.className = 'pos lift'; cab.appendChild(box(84, 100, 84, 'cabin', 'cabin')); stage.appendChild(cab);
  const cw = document.createElement('div'); cw.className = 'pos lift rev'; cw.style.left = '0'; cw.appendChild(at(box(60, 90, 18, 'cw', 'cw'), 0, 0, -60)); stage.appendChild(cw);
  [-115, -5, 105].forEach(y => { const d = document.createElement('div'); d.className = 'doorp'; d.dataset.part = 'doors'; d.style.transform = `translate3d(-35px,${y - 50}px,77px)`; stage.appendChild(d); });

  let rx = -14, ry = 28, drag = null, idle = true;
  const scene = document.getElementById('scene');
  const apply = () => { stage.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`; };
  scene.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ry, rx }; idle = false; scene.setPointerCapture(e.pointerId); scene.classList.add('grab'); });
  scene.addEventListener('pointermove', e => { if (!drag) return; ry = drag.ry + (e.clientX - drag.x) * .5; rx = Math.max(-60, Math.min(20, drag.rx - (e.clientY - drag.y) * .3)); apply(); });
  const end = () => { drag = null; scene.classList.remove('grab'); setTimeout(() => { if (!drag) idle = true; }, 2500); };
  scene.addEventListener('pointerup', end); scene.addEventListener('pointercancel', end);
  (function spin() { if (idle && !matchMedia('(prefers-reduced-motion:reduce)').matches) { ry += .25; apply(); } requestAnimationFrame(spin); })();
  apply();

  const INFO = {
    shaft: ['چاه آسانسور', 'فضای عمودی که کابین و وزنه تعادل در آن حرکت می‌کنند. ابعاد و استحکام آن تعیین‌کننده ظرفیت و ایمنی آسانسور است.'],
    motor: ['موتور و پولی', 'قلب سیستم حرکتی. با درایو VVVF شتاب‌گیری و توقف نرم می‌شود و مصرف برق کمتری دارد.'],
    cabin: ['کابین', 'فضای سوار شدن مسافران. روی قاب مخصوص نصب می‌شود و سیستم ایمنی (پاراشوت) آن را در شرایط اضطراری نگه می‌دارد.'],
    cw: ['وزنه تعادل', 'وزنی تقریباً برابر کابین به‌علاوه بخشی از بار نامی که در جهت مخالف کابین حرکت می‌کند و بار موتور را کم می‌کند.'],
    rails: ['ریل‌های راهنما', 'مسیر حرکت کابین و وزنه را مشخص می‌کنند و از نوسان و لرزش جلوگیری می‌کنند. روغن‌کاری و تنظیم آن‌ها بخشی از سرویس دوره‌ای است.'],
    doors: ['درب‌های طبقه', 'تا رسیدن کابین به طبقه قفل می‌مانند و کابین تا بسته شدن کامل درب‌ها حرکت نمی‌کند.']
  };
  const tabs = document.getElementById('anTabs'), txt = document.getElementById('anText');
  Object.keys(INFO).forEach(k => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'an-tab'; b.textContent = INFO[k][0]; b.dataset.k = k;
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.an-tab').forEach(x => x.classList.toggle('active', x === b));
      stage.querySelectorAll('[data-part]').forEach(el => el.classList.toggle('hl', el.dataset.part === k));
      txt.innerHTML = '<h3></h3><p></p>'; txt.firstChild.textContent = INFO[k][0]; txt.lastChild.textContent = INFO[k][1];
    });
    tabs.appendChild(b);
  });
  tabs.firstChild.click();
})();
