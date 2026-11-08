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
  const win = document.querySelector('.window');
  function open(id, push = true) {
    if (!panels[id]) id = 'merhaba';
    const before = win.getBoundingClientRect();
    root.dataset.tab = id;
    tabs.forEach((t) => {
      const on = t.getAttribute('aria-controls') === id;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      panels[t.getAttribute('aria-controls')].hidden = !on;
      if (on) { const bar = t.parentElement; if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: t.offsetLeft - bar.offsetLeft - 16, behavior: 'smooth' }); }
    });
    panels[id].scrollTop = 0;
    // the character glides between the centred home layout and the side layout
    const after = win.getBoundingClientRect();
    if (!reduce && !stacked.matches && before.width && Math.abs(before.left - after.left) > 2) {
      win.animate([
        { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / after.width})`, transformOrigin: 'top left' },
        { transform: 'none', transformOrigin: 'top left' },
      ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    if (id === 'merhaba') document.querySelectorAll('.side [data-count]').forEach(countUp);
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
  // Cursor-following character. The head lives on a ring of poses around the
  // centre and follows the cursor's angle continuously; short spokes connect the
  // ring to the straight-ahead pose.
  const canvas = document.getElementById('dev');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pill = document.getElementById('moodPill');
  const SIZE = 512, COLS = 4, SPOKE_N = 13, RING_N = 10;
  const SECTORS = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur']; // 0°, 45°, … clockwise (y down)
  const LABELS = { c: 'SELAM 👋', l: '← ORAYA BAKIYORUM', r: 'ORAYA BAKIYORUM →', u: 'YUKARIDA NE VAR?', ul: '↖ ORADA MI?', ur: 'ORADA MI? ↗', d: 'AŞAĞIDA NE VAR?', dl: '↙ HMM', dr: 'HMM ↘' };

  // Each clip is one image sheet; decode it and touch the GPU up front so the first play doesn't hitch.
  function sheet(name, n) {
    const cl = { img: new Image(), n, ok: false };
    cl.img.src = `assets/avatar/loop/${name}.jpg`;
    cl.img.decode().catch(() => {}).then(() => {
      if (!cl.img.naturalWidth) return;
      cl.ok = true;
      ctx.drawImage(cl.img, 0, 0, SIZE, SIZE, 0, 0, W, H);
      draw();
    });
    return cl;
  }
  const spokes = SECTORS.map((p) => sheet(`s-${p}`, SPOKE_N));
  const rings = SECTORS.map((_, i) => sheet(`ring-${i}`, RING_N));

  // r: 0 = straight ahead, 1 = on the ring. a: angle in sector units, a whole number while on a spoke.
  const st = { r: 0, a: 0, v: 0 };
  let wantRing = false, wantA = 0, last = 0;
  const wrap = (d) => ((d + 4) % 8 + 8) % 8 - 4;

  function paint(cl, k) {
    const i = Math.min(Math.floor(k), cl.n - 1), f = k - i;
    ctx.drawImage(cl.img, (i % COLS) * SIZE, Math.floor(i / COLS) * SIZE, SIZE, SIZE, 0, 0, W, H);
    if (f > 0.01 && i < cl.n - 1) {
      ctx.globalAlpha = f; // blend toward the next frame
      ctx.drawImage(cl.img, ((i + 1) % COLS) * SIZE, Math.floor((i + 1) / COLS) * SIZE, SIZE, SIZE, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
  function draw() {
    if (st.r < 1) {
      const cl = st.r === 0 ? spokes.find((c) => c.ok) : spokes[((st.a % 8) + 8) % 8];
      if (cl && cl.ok) paint(cl, st.r * (cl.n - 1));
      return;
    }
    const a = ((st.a % 8) + 8) % 8, i = Math.floor(a) % 8, cl = rings[i];
    if (cl.ok) paint(cl, (a - i) * (cl.n - 1));
    else if (spokes[Math.round(a) % 8].ok) paint(spokes[Math.round(a) % 8], SPOKE_N - 1);
  }

  const SPOKE_MS = 360;
  // advance by elapsed time; returns true while the head still has somewhere to go
  function update(dt) {
    const d = wrap(wantA - st.a);
    const viaCentre = !wantRing || Math.abs(d) > 2.6;   // too far round the ring: pass through the middle
    let radial = 0; // -1 inward, +1 outward
    if (st.r >= 1 && !viaCentre) {
      // on the ring: glide after the cursor
      const step = d * (1 - Math.exp(-dt / 95));
      const cap = 0.0075 * dt;
      st.a += Math.max(-cap, Math.min(cap, step));
      st.v = 0;
      if (Math.abs(wrap(wantA - st.a)) < 0.002) { st.a = wantA; return false; }
      return true;
    }
    if (viaCentre) {
      if (st.r >= 1 && Math.abs(st.a - Math.round(st.a)) > 1e-3) {
        // slide to the nearest spoke first
        const n = Math.round(st.a), cap = 0.0075 * dt;
        st.a += Math.max(-cap, Math.min(cap, n - st.a));
        if (Math.abs(n - st.a) <= 1e-3) st.a = n;
        return true;
      }
      if (st.r >= 1) st.a = Math.round(st.a);
      if (st.r <= 0) {
        st.v = 0;
        if (!wantRing) return false;
        st.a = Math.round(wantA);            // leave the middle along the spoke nearest the cursor
        radial = 1;
      } else radial = -1;
    } else {
      if (st.r <= 0) st.a = Math.round(wantA);
      radial = 1;
    }
    const spoke = spokes[((st.a % 8) + 8) % 8];
    if (!spoke.ok) return true;              // still downloading
    const rem = radial > 0 ? 1 - st.r : st.r;
    const want = radial * Math.max(1 / 1400, Math.min(1 / SPOKE_MS, (rem + 0.02) * 0.012));
    st.v += (want - st.v) * Math.min(1, dt / 70);
    st.r = Math.max(0, Math.min(1, st.r + (Math.sign(st.v) === radial ? st.v : radial / 1400) * dt));
    return true;
  }

  let running = false;
  function loop(t) {
    const moving = update(Math.min(50, t - last));
    last = t;
    draw();
    if (moving) requestAnimationFrame(loop); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame((t) => { last = t - 16; loop(t); }); } }

  function look(ring, a, label) {
    const name = !ring ? 'c' : SECTORS[((Math.round(a) % 8) + 8) % 8];
    const text = label || LABELS[name];
    if (pill.textContent !== text) pill.textContent = text;
    wantRing = ring;
    if (ring) wantA = a;
    if (reduce) { st.r = ring ? 1 : 0; st.a = ring ? Math.round(a) : st.a; wantA = st.a; draw(); return; }
    kick();
  }

  let settle;
  function aim(x, y) {
    const r = canvas.getBoundingClientRect();
    const dx = x - (r.left + r.width * 0.5);
    const dy = y - (r.top + r.height * 0.3); // face sits in the upper third
    const near = r.width * (wantRing ? 0.1 : 0.14); // wider to leave the centre than to return
    if (Math.hypot(dx, dy) < near) { clearTimeout(settle); return look(false, 0); }
    const raw = Math.atan2(dy, dx) / (Math.PI / 4);
    // linger a little on the eight clean poses, keep moving in between
    look(true, raw - 0.7 * Math.sin(2 * Math.PI * raw) / (2 * Math.PI));
    // when the cursor rests, settle on the nearest clean pose
    clearTimeout(settle);
    settle = setTimeout(() => { if (wantRing) look(true, Math.round(wantA)); }, 160);
  }
  addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
  addEventListener('touchstart', (e) => { const t = e.touches[0]; aim(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; aim(t.clientX, t.clientY); }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => look(false, 0, 'BURADAYIM'));

  draw();
})();
