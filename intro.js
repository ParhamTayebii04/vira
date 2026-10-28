/**
 * Elevator intro: G → 1 → 2 → VIRA, then the doors open and reveal the site.
 * Runs once per session (sessionStorage). The gate class `intro-active` is set
 * by an inline <head> script so the site never flashes before the overlay.
 */
(function () {
  var root = document.documentElement;
  var box = document.getElementById('lift-intro');
  if (!box || !root.classList.contains('intro-active')) return;

  var floor = document.getElementById('liftFloor');
  var skip = document.getElementById('liftSkip');
  var timers = [];
  var done = false;

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  // Swap the displayed floor and replay the "tick" micro-animation
  function show(txt) {
    floor.textContent = txt;
    floor.classList.remove('tick');
    void floor.offsetWidth; // force reflow to restart the animation
    floor.classList.add('tick');
  }

  // Open the doors, reveal the page, then clean up the overlay
  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    box.classList.remove('moving');
    box.classList.add('open');
    root.classList.add('intro-open');
    try { sessionStorage.setItem('viraIntro', '1'); } catch (e) { /* storage blocked */ }
    later(function () {
      root.classList.remove('intro-active', 'intro-open');
      box.remove();
    }, 2300);
  }

  // Timeline (ms): travelling floors, then arrival at "VIRA"
  box.classList.add('moving');
  show('G');
  later(function () { show('1'); }, 900);
  later(function () { show('2'); }, 1800);
  later(function () {
    show('VIRA');
    box.classList.remove('moving');
    box.classList.add('arrived');
  }, 2700);
  later(finish, 3500);

  skip.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
  box.addEventListener('click', finish);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') finish(); });
})();
