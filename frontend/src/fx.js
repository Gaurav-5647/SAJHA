// SAJHA premium motion layer: purely visual, never touches app state.
// Scroll-reveal, pointer spotlight, 3D card tilt, magnetic buttons, scroll progress.
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const REVEAL = [
  '.page-heading', '.card', '.category-card', '.stat', '.notice', '.community-banner',
  '.table-wrap', '.empty', '.tabs', '.review', '.notification', '.ticket-row', '.booking'
].join(',');
const TILT = '.worker-card, .category-card, .stat';
const SPOT = '.category-card, .worker-card, .stat, .card, .community-banner, .btn';

export function initFx() {
  if (window.__sajhaFx) return;
  window.__sajhaFx = true;
  document.documentElement.classList.add('fx');

  // living 3D scene behind the glass UI
  const scene = document.createElement('div');
  scene.className = 'scene';
  scene.setAttribute('aria-hidden', 'true');
  const cube = (cls) => '<div class="cube ' + (cls || '') + '"><i></i><i></i><i></i><i></i><i></i><i></i></div>';
  scene.innerHTML =
    '<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="stars"></div><div class="floor"></div>' +
    '<div class="layer" style="--d:46;--s:.05;left:6%;top:15%">' + cube() + '</div>' +
    '<div class="layer" style="--d:-34;--s:.12;right:7%;top:20%"><div class="sph" style="width:150px;height:150px"></div></div>' +
    '<div class="layer hide-m" style="--d:30;--s:.18;left:9%;bottom:10%"><div class="ringx" style="width:190px;height:190px"></div></div>' +
    '<div class="layer" style="--d:-52;--s:.08;right:13%;bottom:15%">' + cube('gold').replace('class="cube', 'style="--s:62px" class="cube') + '</div>' +
    '<div class="layer hide-m" style="--d:24;--s:.25;left:46%;top:64%"><div class="sph violet" style="width:74px;height:74px;animation-delay:-3s"></div></div>' +
    '<div class="layer hide-m" style="--d:-20;--s:.15;left:3%;top:56%"><div class="sph gold" style="width:58px;height:58px;animation-delay:-5s"></div></div>' +
    '<div class="layer hide-m" style="--d:38;--s:.1;right:30%;top:7%"><div class="ringx teal" style="width:96px;height:96px"></div></div>';
  document.body.prepend(scene);
  const root = document.documentElement;
  if (!reduce) window.addEventListener('pointermove', (e) => {
    root.style.setProperty('--vx', ((e.clientX / innerWidth) - 0.5) * 2);
    root.style.setProperty('--vy', ((e.clientY / innerHeight) - 0.5) * 2);
  }, { passive: true });

  // scroll progress bar
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      root.style.setProperty('--sy', h.scrollTop);
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, h.scrollTop / max) : 0) + ')';
      document.body.classList.toggle('scrolled', h.scrollTop > 12);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // reveal on scroll
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }) : null;

  const seen = new WeakSet();
  const scan = (root) => {
    if (!root.querySelectorAll) return;
    const list = root.matches && root.matches(REVEAL) ? [root, ...root.querySelectorAll(REVEAL)] : root.querySelectorAll(REVEAL);
    list.forEach((el) => {
      if (seen.has(el) || el.closest('.overlay, .assistant, .dropdown, .autocomplete')) return;
      seen.add(el);
      if (reduce || !io) { el.classList.add('in'); return; }
      const sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty('--d', Math.min(sib, 8) * 70 + 'ms');
      el.classList.add('rv');
      io.observe(el);
    });
  };
  scan(document.body);
  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n)));
  }).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });

  if (!fine || reduce) return;

  // pointer spotlight + tilt (event delegation, cheap)
  let last = null;
  document.addEventListener('pointermove', (ev) => {
    const spot = ev.target.closest && ev.target.closest(SPOT);
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty('--mx', ev.clientX - r.left + 'px');
      spot.style.setProperty('--my', ev.clientY - r.top + 'px');
    }
    const t = ev.target.closest && ev.target.closest(TILT);
    if (last && last !== t) { last.style.removeProperty('--rx'); last.style.removeProperty('--ry'); last.style.removeProperty('--ox'); last.style.removeProperty('--oy'); }
    if (t) {
      const r = t.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width - 0.5;
      const py = (ev.clientY - r.top) / r.height - 0.5;
      t.style.setProperty('--ox', (px * 2).toFixed(2));
      t.style.setProperty('--oy', (py * 2).toFixed(2));
      t.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
      t.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
    }
    last = t || null;
    // global soft glow in the hero
    const hero = document.querySelector('.hero');
    if (hero) {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--hx', ev.clientX - r.left + 'px');
      hero.style.setProperty('--hy', ev.clientY - r.top + 'px');
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => {
    if (last) { last.style.removeProperty('--rx'); last.style.removeProperty('--ry'); last = null; }
  });

  // magnetic primary buttons
  document.addEventListener('pointermove', (ev) => {
    const b = ev.target.closest && ev.target.closest('.btn:not(.small):not(.secondary)');
    document.querySelectorAll('.btn.mag').forEach((x) => { if (x !== b) { x.classList.remove('mag'); x.style.removeProperty('--tx'); x.style.removeProperty('--ty'); } });
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.classList.add('mag');
    b.style.setProperty('--tx', ((ev.clientX - (r.left + r.width / 2)) * 0.12).toFixed(1) + 'px');
    b.style.setProperty('--ty', ((ev.clientY - (r.top + r.height / 2)) * 0.2).toFixed(1) + 'px');
  }, { passive: true });
}
