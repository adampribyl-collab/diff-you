/**
 * Zmenšeniny fotek pro web (spouští se i automaticky před `npm run build`).
 *
 *   npm run images
 *
 * Projde obsah webu (src/content/*.json), najde fotky nahrané redakcí v /photos a uloží je
 * do public/img/ jako <název>-<šířka>.webp a <název>-<šířka>.jpg (velikosti v scripts/images.mjs).
 * Nezměněné fotky přeskočí (scripts/.images-manifest.json).
 */
import { mkdir, access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SIZES, imagesFromContent } from './images.mjs';
import { loadContent } from './content-plugin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'img');
const MANIFEST = path.join(ROOT, 'scripts', '.images-manifest.json');

const exists = (p) => access(p).then(() => true, () => false);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const manifest = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
  const report = { done: [], unchanged: [], warnings: [] };

  for (const img of imagesFromContent(loadContent())) {
    const size = SIZES[img.size];
    const src = path.join(ROOT, String(img.foto).replace(/^\/+/, ''));
    if (!(await exists(src))) {
      const msg = `${img.name}: fotka ${img.foto} v repozitáři chybí`;
      if (img.required) throw new Error(msg);
      report.warnings.push(`${msg}, na webu se nezobrazí`);
      continue;
    }

    const hash = createHash('sha1').update(await readFile(src)).update(JSON.stringify(size)).digest('hex');
    const outputsExist = (await Promise.all(size.widths.map((w) => exists(path.join(OUT_DIR, `${img.name}-${w}.webp`))))).every(Boolean);
    if (manifest[img.name] === hash && outputsExist) {
      report.unchanged.push(img.name);
      continue;
    }

    const { width: srcWidth = 0 } = await sharp(src).metadata();
    const maxWidth = Math.max(...size.widths);
    if (srcWidth < maxWidth) {
      report.warnings.push(`${img.name}: fotka má ${srcWidth} px, největší varianta ${maxWidth} px se zvětší`);
    }
    for (const w of size.widths) {
      const pipeline = () => {
        const p = sharp(src).rotate();
        if (!size.ratio) return p.resize({ width: w });
        const h = Math.round((w * size.ratio[1]) / size.ratio[0]);
        return p.resize(w, h, { fit: 'cover', position: 'centre' });
      };
      await Promise.all([
        pipeline().webp({ quality: 80, effort: 5 }).toFile(path.join(OUT_DIR, `${img.name}-${w}.webp`)),
        pipeline().jpeg({ quality: 82, mozjpeg: true, progressive: true }).toFile(path.join(OUT_DIR, `${img.name}-${w}.jpg`)),
      ]);
    }
    manifest[img.name] = hash;
    report.done.push(img.name);
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Fotky zpracovány (${report.done.length}): ${report.done.join(', ') || '–'}`);
  if (report.unchanged.length) console.log(`Fotky beze změny (${report.unchanged.length}): ${report.unchanged.join(', ')}`);
  report.warnings.forEach((w) => console.warn(`Pozor – ${w}`));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
