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

  // Nav border on scroll
  const nav = document.querySelector('.nav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });

  // Scroll reveal + count-up
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (i % 3) * 70 + 'ms';
    io.observe(el);
  });
  function countUp(el) {
    const end = +el.dataset.count;
    if (reduce) { el.textContent = end; return; }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Mouse-following character: swap between pose frames
  const avatar = document.getElementById('dev');
  const frames = Object.fromEntries([...avatar.querySelectorAll('img')].map((im) => [im.dataset.pose, im]));
  const pill = document.getElementById('moodPill');
  const SECTORS = ['r', 'dr', 'c', 'dl', 'l', 'ul', 'u', 'ur']; // 0°, 45°, … clockwise (y down)
  const LABELS = { c: 'SELAM 👋', l: '← ORAYA BAKIYORUM', r: 'ORAYA BAKIYORUM →', u: 'YUKARIDA NE VAR?', ul: '↖ ORADA MI?', ur: 'ORADA MI? ↗', dl: '↙ HMM', dr: 'HMM ↘' };

  let pose = 'c';
  let lastMove = 0;
  let idleTimer;
  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };

  function show(next, label) {
    if (next !== pose) {
      // keep the old frame fully visible underneath while the new one fades in on top
      const prev = frames[pose];
      Object.values(frames).forEach((f) => f.classList.remove('prev'));
      prev.classList.replace('on', 'prev');
      frames[next].classList.add('on');
      pose = next;
    }
    if (pill.textContent !== label) pill.textContent = label;
  }

  function aim(clientX, clientY) {
    const r = avatar.getBoundingClientRect();
    const dx = clientX - (r.left + r.width * 0.5);
    const dy = clientY - (r.top + r.height * 0.32); // face sits in the upper third
    const dist = Math.hypot(dx, dy);
    const faceR = r.width * 0.16;
    let next = 'c';
    if (dist > faceR) {
      const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
      next = SECTORS[sector];
    }
    show(next, LABELS[next]);
    target.x = Math.max(-1, Math.min(1, dx / (innerWidth * 0.5)));
    target.y = Math.max(-1, Math.min(1, dy / (innerHeight * 0.5)));
    lastMove = performance.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { show('c', 'BURADAYIM'); target.x = target.y = 0; }, 2400);
  }
  addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
  addEventListener('touchstart', (e) => { const t = e.touches[0]; aim(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; aim(t.clientX, t.clientY); }, { passive: true });

  // Subtle parallax so the frame swap feels like motion
  if (!reduce) {
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      avatar.style.transform = `scale(1.04) translate(${cur.x * -6}px, ${cur.y * -4}px)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
