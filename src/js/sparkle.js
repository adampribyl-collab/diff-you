/**
 * Třpyt v úvodní sekci: pulzující hvězda v místě, kde se fréza dotýká nehtu,
 * a jemný prach, který z něj odlétá a dosedá dolů.
 *
 * Bod dotyku se nastavuje v redakci (Úvod → Třpyt) v procentech šířky a výšky fotky
 * a přichází v atributech data-spark-x / data-spark-y na <header class="hero-photo">.
 * Fotka se do sekce ořezává jako object-fit: cover s object-position 66 % 50 % (src/styles/main.css),
 * stejný přepočet dělá i tenhle skript.
 */
const POS_X = 0.66, POS_Y = 0.5;
const PERIOD = 2200;      // délka jednoho pulzu hvězdy v ms (stejná jako u animací v sparkle.css)
const FLARE_AT = 0.10;    // kdy v pulzu hvězda nejvíc zazáří – v tu chvíli vyletí obláček prachu
const RATE = 8;           // průběžný prach, zrnek za sekundu
const MAX_DUST = 260;
const FADE = 1.2;         // jak dlouho (s) usazené zrnko mizí

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Teplé odstíny prachu, každý jako měkká tečka předkreslená do malého canvasu.
const PALETTE = [[255, 240, 222], [246, 212, 178], [226, 180, 154], [255, 226, 190]];
const sprites = PALETTE.map(([r, g, b]) => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.35, `rgba(${r},${g},${b},.55)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grd;
  x.fillRect(0, 0, 32, 32);
  return c;
});

const randn = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;  // ≈ normální rozdělení, σ ≈ 1
const heroes = new Set();
const byEl = new WeakMap();

const ro = 'ResizeObserver' in window ? new ResizeObserver((es) => {
  for (const e of es) { const h = byEl.get(e.target); if (h) layout(h); }
}) : null;
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
  for (const e of es) { const h = byEl.get(e.target); if (h) h.visible = e.isIntersecting; }
  kick();
}) : null;

function attach(el) {
  const img = el.querySelector('.hero-bg img');
  const imgW = Number(img?.getAttribute('width')) || 1376;
  const imgH = Number(img?.getAttribute('height')) || 768;
  const fx = document.createElement('div');
  fx.className = 'dy-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = '<canvas></canvas><div class="dy-spark"><i class="dy-glow"></i><i class="dy-ray"></i><i class="dy-ray dy-ray-x"></i><i class="dy-core"></i></div>';
  el.querySelector('.hero-shade').after(fx);
  const canvas = fx.firstChild;
  const spark = fx.lastChild;
  // Sladí fázi CSS pulzu s hodinami requestAnimationFrame, aby prach vyletěl přesně se zábleskem.
  if (spark.getAnimations) for (const an of spark.getAnimations({ subtree: true })) an.startTime = 0;
  const h = {
    el, fx, canvas, spark, ctx: canvas.getContext('2d'), dust: [], acc: 0, lastPhase: 0, visible: !io, ok: false,
    imgW, imgH,
    hitX: (Number(el.dataset.sparkX) / 100) * imgW,
    hitY: (Number(el.dataset.sparkY) / 100) * imgH,
    // fyzika prachu je naladěná na fotku širokou 1376 px – u jinak velké fotky se přepočítá
    unit: imgW / 1376,
  };
  byEl.set(el, h);
  heroes.add(h);
  layout(h);
  if (ro) ro.observe(el);
  if (io) io.observe(el);
  kick();
}

// Přepočítá bod dotyku z fotky do souřadnic sekce podle object-fit: cover.
function layout(h) {
  const w = h.el.clientWidth, hh = h.el.clientHeight;
  h.ok = w > 0 && hh > 0;
  if (!h.ok) return;
  const s = Math.max(w / h.imgW, hh / h.imgH);
  h.s = s * h.unit;
  h.w = w;
  h.h = hh;
  h.x = (w - h.imgW * s) * POS_X + h.hitX * s;
  h.y = (hh - h.imgH * s) * POS_Y + h.hitY * s;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  h.canvas.width = Math.round(w * dpr);
  h.canvas.height = Math.round(hh * dpr);
  h.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  h.spark.style.transform = `translate(${h.x}px, ${h.y}px)`;
  h.spark.style.fontSize = `${40 * h.s}px`;
}

// Polohy a rychlosti zrnek jsou v pixelech fotky (1376 px široké), relativně k bodu dotyku.
function spawn(h, burst) {
  if (h.dust.length >= MAX_DUST) return;
  const a = -Math.PI / 2 - 0.35 + randn() * 0.75;   // vějíř nahoru, víc doleva od frézy
  const v = (burst ? 70 : 35) + Math.random() ** 2 * (burst ? 200 : 130);
  h.dust.push({
    x: randn() * 2, y: randn() * 1.5,
    vx: Math.cos(a) * v, vy: Math.sin(a) * v,
    r: 0.45 + Math.random() ** 3 * 1.5,
    k: 1.6 + Math.random() * 1.2,          // odpor vzduchu – větší zrnka padají rychleji
    floor: 40 + Math.random() * 240,       // jak hluboko pod bodem dotyku zrnko dosedne
    c: (Math.random() * PALETTE.length) | 0,
    a: 0.35 + Math.random() * 0.55,
    tw: Math.random() < 0.2 ? 6 + Math.random() * 10 : 0,  // některá zrnka se ve světle třpytí
    ph: Math.random() * 6.283,
    age: 0, rest: -1, stay: 1 + Math.random() * 2.2,
  });
}

function step(h, dt, t) {
  const phase = (t % PERIOD) / PERIOD;
  if (h.lastPhase < FLARE_AT && phase >= FLARE_AT) {
    for (let n = 6 + Math.random() * 6; n > 0; n--) spawn(h, true);
  }
  h.lastPhase = phase;
  h.acc += dt * RATE;
  for (; h.acc >= 1; h.acc--) spawn(h, false);

  const sq = Math.sqrt(dt);
  const ts = t / 1000;
  const wind = 9 * Math.sin(ts * 0.35) + 5 * Math.sin(ts * 0.9 + 1.3);  // pomalý proud vzduchu, zrnka se v něm pohupují
  const left = -h.x / h.s - 20, right = (h.w - h.x) / h.s + 20;
  h.dust = h.dust.filter((p) => {
    p.age += dt;
    if (p.rest < 0) {
      p.vx += randn() * 14 * sq;          // jemné víření vzduchu
      p.vy += 42 * dt;                    // gravitace
      const d = Math.exp(-p.k * dt);
      p.vx = wind + (p.vx - wind) * d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y >= p.floor && p.vy > 0) { p.y = p.floor; p.rest = 0; }
    } else {
      p.rest += dt;
    }
    return p.rest < p.stay + FADE && p.age < 30 && p.x > left && p.x < right;
  });
}

function draw(h) {
  const ctx = h.ctx;
  ctx.clearRect(0, 0, h.w, h.h);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of h.dust) {
    let a = p.a * Math.min(1, p.age / 0.25);
    if (p.rest > p.stay) a *= Math.max(0, 1 - (p.rest - p.stay) / FADE);
    if (p.tw) a *= 0.55 + 0.45 * Math.sin(p.age * p.tw + p.ph);
    if (a < 0.01) continue;
    const R = p.r * h.s * 2.2;
    ctx.globalAlpha = a;
    ctx.drawImage(sprites[p.c], h.x + p.x * h.s - R, h.y + p.y * h.s - R, R * 2, R * 2);
  }
  ctx.globalAlpha = 1;
}

let raf = 0, last = 0;
function frame(t) {
  raf = 0;
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
  last = t;
  let running = false;
  for (const h of heroes) {
    if (!h.visible || !h.ok) continue;
    running = true;
    step(h, dt, t);
    draw(h);
  }
  if (running) raf = requestAnimationFrame(frame);
  else last = 0;
}
function kick() {
  if (!raf && !reduced) raf = requestAnimationFrame(frame);
}

for (const el of document.querySelectorAll('.hero-photo[data-spark-x][data-spark-y]')) attach(el);
