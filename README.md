# DIFF.YOU – web

Web studia DIFF.YOU (manikúra a modeláž nehtů). Statická stránka sestavená přes Vite, obsah se upravuje v redakci (Sveltia CMS).

```
redakce /admin/ ──uloží──▶ GitHub (src/content/*.json, photos/) ──▶ GitHub Actions: build ──▶ GitHub Pages
```

- Web: https://adampribyl-collab.github.io/diff-you/
- Redakce: https://adampribyl-collab.github.io/diff-you/admin/

## Redakce (úprava obsahu)

Na webu otevřete `/admin/` a zvolte **Přihlásit se přes GitHub**. Přihlášení běží přes sdílenou službu pro všechny weby
(Cloudflare Worker `sveltia-cms-auth`, GitHub OAuth App „Redakce webů“), tady se nic nenastavuje.

Do redakce se dostane každý, kdo má GitHub účet s právem zápisu do tohoto repozitáře:
vlastník, nebo pozvaný spolupracovník (repozitář → Settings → Collaborators → Add people, role **Write**).

V redakci je jedna sekce **Obsah webu** s částmi stránky v pořadí, jak jdou na webu za sebou:

| Část | Co se v ní mění |
| --- | --- |
| Studio a odkazy | název, barva akcentu, odkaz na rezervace (Notino), Instagram, adresa webu |
| Vzkaz nahoře | pruh s citátem a podpisem autorky (dá se skrýt) |
| Menu | názvy položek menu a tlačítko |
| Úvod | text pod logem, tlačítka, fotka a poloha třpytu |
| Ceník | služby, délka návštěvy a ceny |
| Galerie | fotky (oříznou se na čtverec) |
| Reference | průměrné hodnocení a recenze |
| Certifikáty | kurzy a skeny certifikátů |
| Opravy a storno | ceny oprav a storno podmínky |
| Rezervace | text a tlačítko v sekci s lamelami |
| Patička | text vpravo vedle roku |
| Google a sdílení | titulek, popis, skrytí webu před vyhledávači |

Po uložení se web za 1–3 minuty sám aktualizuje (průběh je vidět v záložce **Actions** na GitHubu).

### Třpyt v úvodu

Na úvodní fotce pulzuje hvězda s prachem v místě, kde se fréza dotýká nehtu. Při výměně fotky nastavte
v **Úvod → Třpyt na fotce** nový bod v procentech fotky (X zleva doprava, Y shora dolů), nebo třpyt vypněte.
Stačí odhad (50 / 50 je střed fotky). Po uložení se podívejte na web a bod případně doladěte.

## Spuštění

Potřebujete Node.js 20 nebo novější.

```bash
npm install
npm run dev        # vývojový server → http://localhost:5173, redakce na http://localhost:5173/admin/
npm run build      # fotky + produkční build do složky dist/
npm run preview    # náhled hotového buildu → http://localhost:4173
```

Na lokálním serveru nabízí redakce i **Pracovat s lokálním repozitářem**: změny pak ukládá rovnou do souborů
v této složce, bez GitHubu.

## Automatické nasazení (GitHub Actions)

`.github/workflows/deploy.yml` se spustí po každé změně ve větvi `main`, tedy i po uložení v redakci.
Web sestaví a nasadí na GitHub Pages (Settings → Pages → Source: **GitHub Actions**).

Volitelně umí web nahrát i na vlastní hosting přes FTP. Stačí v Settings → Secrets and variables → Actions
vytvořit secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` a případně `FTP_DIR` (složka končící lomítkem).
Při vlastní doméně změňte v redakci **Studio a odkazy → Adresa webu**.

## Fotky

Fotky nahrává redakce do složky `photos/`. Skript `npm run images` (spouští se i v `npm run build`)
z nich vyrobí zmenšené verze WebP a JPG do `public/img/`:

| Fotka | Velikosti | Úprava |
| --- | --- | --- |
| úvodní fotka | 800, 1400 px | bez ořezu, do sekce se ořízne až v prohlížeči (motiv vpravo) |
| galerie | 400, 800 px | čtverec, ořez na střed |
| sken certifikátu | 400, 800 px | bez ořezu |

Nezměněné fotky skript přeskočí (`scripts/.images-manifest.json`).

## Vzhled

- **Akustický panel** (Certifikáty, Rezervace): svislé béžové lamely na černé plsti, `src/styles/panel.css`.
  Struktura dřeva a plsti je SVG přímo v CSS.
- **Patička jako podlaha**: dlažba v perspektivě a kytka u stěny se stíny, `src/styles/floor.css`,
  obrázky `src/assets/tiles.jpg` a `src/assets/plant.png`.
- **Třpyt**: `src/js/sparkle.js` a `src/styles/sparkle.css`.
- **Písma** Bodoni Moda a Josefin Sans jsou uložená na webu (`src/assets/fonts/`), nic se nenačítá z Google Fonts.

Zdroje, ze kterých dlažba, kytka a lamely vznikly (původní export návrhu, fotky, generátory), jsou
v soukromém repozitáři `diff-you-web`.

## Co je potřeba doplnit (v redakci)

- Vzkaz nahoře: skutečné jméno autorky místo `[Jméno autorky]`
- Certifikáty: názvy kurzů, školitele, roky a skeny
- Galerie: text slibuje, že se nové příspěvky z Instagramu objeví samy – fotky se ale přidávají ručně v redakci,
  text je dobré upravit
- Studio a odkazy → Adresa webu, až bude mít web vlastní doménu

## Struktura

```
index.html                   šablona stránky (Handlebars) – texty doplní scripts/content-plugin.mjs
src/content/*.json           obsah webu – upravuje redakce
src/main.js                  vstupní bod (styly + třpyt)
src/styles/                  styly
src/js/sparkle.js            třpyt a prach v úvodu
src/assets/                  písma, dlažba, kytka
photos/                      zdrojové fotky (nahrává redakce)
public/admin/                redakce (Sveltia CMS) a její nastavení config.yml
scripts/build-images.mjs     zmenšeniny fotek
scripts/content-plugin.mjs   vložení obsahu do HTML, robots.txt a sitemap.xml
.github/workflows/deploy.yml sestavení a nasazení
```
