(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme toggle
  const isDark = () => root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // Tabs: one screen, panels swap in place
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = Object.fromEntries(tabs.map((t) => [t.getAttribute('aria-controls'), document.getElementById(t.getAttribute('aria-controls'))]));
  function open(id, push = true) {
    if (!panels[id]) id = 'merhaba';
    tabs.forEach((t) => {
      const on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      panels[t.getAttribute('aria-controls')].hidden = !on;
      if (on) { const bar = t.parentElement; if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: t.offsetLeft - bar.offsetLeft - 16, behavior: 'smooth' }); }
    });
    panels[id].scrollTop = 0;
    if (id === 'merhaba') panels[id].querySelectorAll('[data-count]').forEach(countUp);
    if (push) history.replaceState(null, '', id === 'merhaba' ? location.pathname : '#' + id);
    // stacked (phone) layout: bring the new panel up under the sticky bar
    if (push && stacked.matches && id !== 'merhaba') {
      const y = panels[id].getBoundingClientRect().top + scrollY - document.querySelector('.nav').offsetHeight - 8;
      if (Math.abs(scrollY - y) > 40) scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  const stacked = matchMedia('(max-width: 900px), (max-height: 560px)');
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => open(t.getAttribute('aria-controls')));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const n = tabs[(i + d + tabs.length) % tabs.length];
      n.focus(); open(n.getAttribute('aria-controls'));
    });
  });
  document.querySelectorAll('[data-go], [data-tab]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault(); open(b.dataset.go || b.dataset.tab);
  }));
  addEventListener('hashchange', () => open(location.hash.slice(1), false));

  function countUp(el) {
    const end = +el.dataset.count;
    if (reduce) { el.textContent = end; return; }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1100);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  open(location.hash.slice(1) || 'merhaba', false);

  // ---------------------------------------------------------------------------
  // Cursor-following character.
  // Left/right are real video frames (the turn is played forward and rewound
  // frame by frame); up/down poses dissolve in from the centre frame.
  const canvas = document.getElementById('dev');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pill = document.getElementById('moodPill');
  const N = 22;
  const load = (src) => { const im = new Image(); im.decoding = 'async'; im.src = src; return im; };
  const seq = Array.from({ length: N }, (_, i) => load(`assets/avatar/seq/${String(i).padStart(2, '0')}.jpg`));
  const stills = Object.fromEntries(['u', 'ul', 'ur', 'd', 'dl', 'dr'].map((p) => [p, load(`assets/avatar/${p}.jpg`)]));
  const ready = (im) => im && im.complete && im.naturalWidth > 0;

  const SECTORS = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur']; // 0°, 45°, … clockwise (y down)
  const LABELS = { c: 'SELAM 👋', l: '← ORAYA BAKIYORUM', r: 'ORAYA BAKIYORUM →', u: 'YUKARIDA NE VAR?', ul: '↖ ORADA MI?', ur: 'ORADA MI? ↗', d: 'AŞAĞIDA NE VAR?', dl: '↙ HMM', dr: 'HMM ↘' };

  // state: side = 'r' | 'l' (which way the video is turned), idx = frame in the turn,
  // still = pose name being faded over the centre frame, mix = its opacity 0..1
  const st = { side: 'r', idx: 0, still: null, mix: 0 };
  let target = 'c';
  let idleTimer;

  function frame(i, side) {
    const im = seq[i];
    if (!ready(im)) return false;
    if (side === 'l') { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, W, H); ctx.restore(); }
    else ctx.drawImage(im, 0, 0, W, H);
    return true;
  }
  function draw() {
    if (!frame(st.idx, st.side)) return;
    if (st.still && st.mix > 0 && ready(stills[st.still])) {
      ctx.globalAlpha = st.mix;
      ctx.drawImage(stills[st.still], 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // one animation step; returns true while something is still moving
  function step() {
    const side = target === 'l' || target === 'r' ? target : null;
    const still = side || target === 'c' ? null : target;
    // 1) fade out a still that is no longer wanted
    if (st.still && st.still !== still) {
      st.mix = Math.max(0, st.mix - 0.16);
      if (st.mix === 0) st.still = null;
      return true;
    }
    // 2) want a still: rewind the turn first, then fade it in
    if (still) {
      if (st.idx > 0) { st.idx = Math.max(0, st.idx - 2); return true; }
      st.still = still;
      if (st.mix < 1) { st.mix = Math.min(1, st.mix + 0.12); return true; }
      return false;
    }
    // 3) want a side: rewind if facing the other way, otherwise play forward
    if (side) {
      if (st.side !== side) {
        if (st.idx > 0) { st.idx--; return true; }
        st.side = side;
      }
      if (st.idx < N - 1) { st.idx++; return true; }
      return false;
    }
    // 4) centre: rewind
    if (st.idx > 0) { st.idx--; return true; }
    return false;
  }

  let running = false, last = 0;
  function loop(t) {
    if (t - last >= 33) { // ~30 fps, the video's own pace
      last = t;
      const moving = step();
      draw();
      if (!moving) { running = false; return; }
    }
    requestAnimationFrame(loop);
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  function setTarget(p) {
    if (pill.textContent !== LABELS[p]) pill.textContent = LABELS[p];
    if (p === target) return;
    target = p;
    if (reduce) { // jump straight to the end pose
      st.still = null; st.mix = 0; st.idx = 0;
      if (p === 'l' || p === 'r') { st.side = p; st.idx = N - 1; }
      else if (p !== 'c') { st.still = p; st.mix = 1; }
      draw(); return;
    }
    kick();
  }

  function aim(x, y) {
    const r = canvas.getBoundingClientRect();
    const dx = x - (r.left + r.width * 0.5);
    const dy = y - (r.top + r.height * 0.3); // face sits in the upper third
    let p = 'c';
    if (Math.hypot(dx, dy) > r.width * 0.14) {
      p = SECTORS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
    }
    setTarget(p);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { setTarget('c'); pill.textContent = 'BURADAYIM'; }, 2600);
  }
  addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
  addEventListener('touchstart', (e) => { const t = e.touches[0]; aim(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; aim(t.clientX, t.clientY); }, { passive: true });

  seq[0].addEventListener('load', draw);
  if (ready(seq[0])) draw();
})();
