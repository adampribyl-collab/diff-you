/**
 * Obrázky webu – sdílí je scripts/build-images.mjs (vyrábí zmenšeniny) i scripts/content-plugin.mjs (vkládá je do HTML).
 *
 * Fotky nahrává redakce do /photos a cestu uloží do src/content/*.json.
 * Zmenšeniny se ukládají do public/img/<název>-<šířka>.webp a .jpg.
 */

export const SIZES = {
  // úvodní fotka: bez ořezu, do sekce se ořezává až v prohlížeči (object-fit: cover)
  hero: { widths: [800, 1400] },
  // galerie: čtverec, ořez na střed
  galerie: { widths: [400, 800], square: true },
  // sken certifikátu: bez ořezu, v rámečku A4 se zobrazí celý
  cert: { widths: [400, 800] },
};

/** Název obrázku podle nahraného souboru, např. "/photos/Moje Fotka.webp" → "galerie-moje-fotka". */
export function imageName(foto, prefix) {
  const base = String(foto || '')
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '');
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${prefix}-${slug}` : null;
}

/** Všechny obrázky, které web potřebuje, podle aktuálního obsahu. */
export function imagesFromContent(c) {
  const list = [{ name: 'hero', foto: c.hero.foto, size: 'hero', required: true }];
  for (const f of c.galerie.fotky || []) {
    const name = imageName(f.foto, 'galerie');
    if (name) list.push({ name, foto: f.foto, size: 'galerie' });
  }
  for (const p of c.certifikaty.polozky || []) {
    const name = imageName(p.sken, 'cert');
    if (name) list.push({ name, foto: p.sken, size: 'cert' });
  }
  // stejná fotka u více položek = jeden obrázek
  return list.filter((img, i, all) => all.findIndex((o) => o.name === img.name) === i);
}
