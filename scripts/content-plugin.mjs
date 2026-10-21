/**
 * Vite plugin: vloží obsah ze src/content/*.json do index.html (šablona Handlebars).
 * Obsah upravuje redakce (/admin/), výsledné HTML je statické – rychlé a čitelné pro Google.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import sharp from 'sharp';
import { SIZES, imageName } from './images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_DIR = path.join(ROOT, 'src', 'content');

export function loadContent() {
  const data = {};
  for (const file of readdirSync(CONTENT_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      data[path.basename(file, '.json')] = JSON.parse(readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
    } catch (err) {
      throw new Error(`Obsah src/content/${file} není platný JSON: ${err.message}`);
    }
  }
  return data;
}

const hbs = Handlebars.create();
const esc = hbs.escapeExpression;
const safe = (html) => new hbs.SafeString(html);

const DEFAULT_ACCENT = '#E2B49A';
const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z';

/** Rozměry zdrojové fotky (kvůli width/height v HTML, aby stránka při načítání neposkakovala). */
async function photoSize(foto) {
  const file = path.join(ROOT, String(foto || '').replace(/^\/+/, ''));
  if (!foto || !existsSync(file)) return null;
  const { width, height } = await sharp(file).metadata();
  return { width, height };
}

/** <picture> s WebP a JPG – názvy a šířky jako vyrábí scripts/build-images.mjs */
function picture(name, { size, sizes, alt, width, height, className, eager }) {
  const { widths } = SIZES[size];
  const largest = widths[widths.length - 1];
  const set = (ext) => widths.map((w) => `/img/${name}-${w}.${ext} ${w}w`).join(', ');
  const loading = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  return `<picture${className ? ` class="${className}"` : ''}>
          <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}" />
          <img src="/img/${name}-${largest}.jpg" srcset="${set('jpg')}" sizes="${sizes}" width="${width}" height="${height}" alt="${esc(alt)}" ${loading} decoding="async" />
        </picture>`;
}

/** Velké logo v úvodu: tečka v názvu (DIFF.YOU) se nahradí kulatou tečkou v barvě akcentu. */
function heroTitle(name) {
  const text = String(name || '');
  const dot = text.indexOf('.');
  if (dot < 1 || dot === text.length - 1) return `<span>${esc(text)}</span>`;
  return `<span>${esc(text.slice(0, dot))}</span><span class="hero-title__dot" aria-hidden="true"></span><span>${esc(text.slice(dot + 1))}</span>`;
}

function stars(count) {
  const n = Math.max(0, Math.min(5, Math.round(Number(String(count).replace(',', '.')) || 0)));
  return Array.from({ length: 5 }, (_, i) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"${i < n ? '' : ' class="is-off"'}><path d="${STAR_PATH}" fill="currentColor"></path></svg>`,
  ).join('');
}

function normalizeUrl(url) {
  let u = String(url || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//.test(u)) u = `https://${u}`;
  return u;
}

/** Strukturovaná data pro Google (JSON-LD). */
function jsonLd(c, webUrl) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NailSalon',
    name: c.studio.nazev,
    description: c.seo.popis,
    url: `${webUrl}/`,
    image: `${webUrl}/img/hero-1400.jpg`,
    sameAs: [c.studio.instagram].filter(Boolean),
    potentialAction: c.studio.rezervace ? { '@type': 'ReserveAction', target: c.studio.rezervace } : undefined,
  };
  // „<“ escapované, aby text z redakce nemohl ukončit <script>
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

async function buildContext(c) {
  const webUrl = normalizeUrl(c.studio.web);
  const accent = /^#[0-9a-f]{6}$/i.test(c.studio.barva || '') ? c.studio.barva : DEFAULT_ACCENT;
  const hero = (await photoSize(c.hero.foto)) || { width: 1376, height: 768 };
  const heroWidth = SIZES.hero.widths[SIZES.hero.widths.length - 1];

  const certifikatyPolozky = [];
  for (const p of c.certifikaty.polozky || []) {
    const name = imageName(p.sken, 'cert');
    const size = name && (await photoSize(p.sken));
    certifikatyPolozky.push({
      ...p,
      popisek: [p.skola, p.rok].filter(Boolean).join(', '),
      obrazek: size
        ? safe(picture(name, { size: 'cert', sizes: '(min-width: 1440px) 300px, (min-width: 960px) 22vw, (min-width: 520px) 45vw, 90vw', alt: `Certifikát: ${p.nazev}`, width: 800, height: Math.round((800 * size.height) / size.width) }))
        : null,
    });
  }

  return {
    ...c,
    rok: new Date().getFullYear(),
    webUrl,
    barva: accent,
    heroTitle: safe(heroTitle(c.studio.nazev)),
    heroPicture: safe(
      picture('hero', {
        size: 'hero',
        sizes: '100vw',
        alt: c.hero.popisFoto || '',
        width: heroWidth,
        height: Math.round((heroWidth * hero.height) / hero.width),
        className: 'hero-bg',
        eager: true,
      }),
    ),
    galerieFotky: (c.galerie.fotky || [])
      .map((f) => ({ ...f, name: imageName(f.foto, 'galerie') }))
      .filter((f) => f.name && existsSync(path.join(ROOT, f.foto.replace(/^\/+/, ''))))
      .map((f) => ({
        obrazek: safe(picture(f.name, { size: 'galerie', sizes: '(min-width: 1440px) 432px, 31vw', alt: f.popis || '', width: 800, height: 800 })),
      })),
    hodnoceniHvezdy: safe(stars(c.reference.hodnoceni)),
    recenze: (c.reference.recenze || []).map((r) => ({
      ...r,
      hvezdy: r.hvezdy ?? 5,
      hvezdyHtml: safe(stars(r.hvezdy ?? 5)),
      inicialy: [...String(r.jmeno || '').trim()][0]?.toUpperCase() || '',
    })),
    certifikatyPolozky,
    jsonLd: safe(jsonLd(c, webUrl)),
  };
}

/** /admin/ → redakce (jinak by Vite vrátil hlavní stránku); na běžném hostingu to platí samo. */
function adminIndex(req, res, next) {
  if (/^\/admin\/?(\?.*)?$/.test(req.url)) req.url = '/admin/index.html';
  next();
}

export function contentPlugin() {
  return {
    name: 'diff-you-content',
    transformIndexHtml: {
      // před Vite, aby se cesty /img/… v generovaném HTML zpracovaly stejně jako ručně psané
      order: 'pre',
      async handler(html) {
        return hbs.compile(html)(await buildContext(loadContent()));
      },
    },
    configureServer(server) {
      // změna textu v src/content → obnovit stránku v prohlížeči
      server.watcher.on('change', (file) => {
        if (file.startsWith(CONTENT_DIR)) server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use(adminIndex);
    },
    configurePreviewServer(server) {
      server.middlewares.use(adminIndex);
    },
    // robots.txt a sitemap.xml s adresou webu z redakce (Studio a odkazy → Adresa webu)
    generateBundle() {
      const c = loadContent();
      const webUrl = normalizeUrl(c.studio.web);
      const hidden = c.seo.skrytProVyhledavace;
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: hidden
          ? 'User-agent: *\nDisallow: /\n'
          : `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${webUrl}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${webUrl}/</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>\n</urlset>\n`,
      });
    },
  };
}
