// Builds the watched fights' painted backdrops from the Craftpix parallax background packs in ../chronos-assets (a dev
// tool, run by hand: `node tools/compose-backdrops.cjs`; it needs Playwright's Chromium). Each background's layers,
// far to near, are stacked one under another in a single image (scaled to 576x324 each), written to
// src/renderer/art/backdrops/ with their count in backdrops.json; the ids are listed for the simulation's scene data
// in src/shared/data/backdrops.ts. The fight screen tiles each layer across and scrolls the near ones faster.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const OUT = path.join(__dirname, '../src/renderer/art/backdrops');
const W = 576;
const H = 324;
const FORMAT = process.env.FORMAT || 'webp';

/** The numbered layers in a folder (1, 2, 3... or "Plan 1", "Plan-2"), far to near; the composites left out. */
function numbered(dir, reverse = false) {
  const files = fs.readdirSync(path.join(ASSETS, dir)).filter((f) => /^(plan[ -])?\d+\.png$/i.test(f));
  const n = (f) => +f.match(/\d+/)[0];
  files.sort((a, b) => n(a) - n(b));
  // (the packs that call their layers "Plan 1, Plan 2..." number them near to far)
  if (reverse || /^plan/i.test(files[0] ?? '')) files.reverse();
  return files.map((f) => path.join(dir, f));
}
const named = (dir, names) => names.map((n) => path.join(dir, n + '.png'));
const A = 'assets/';
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

// [id, layer files far to near]
const SPECS = [
  ...range(4).map((i) => [`nature_${i}`, numbered(`${A}craftpix-net-138963-free-nature-pixel-backgrounds-for-games/nature ${i}`)]),
  ...range(4).map((i) => [`meadows_${i}`, numbered(`${A}craftpix-net-514191-4-free-seamless-nature-pixel-backgrounds/nature ${i}`)]),
  ...range(5).map((i) => [`forest_${i}`, numbered(`${A}craftpix-net-154389-forest-and-trees-free-pixel-backgrounds/${i}`)]),
  ...range(5).map((i) => [`summer_${i}`, numbered(`${A}craftpix-net-256745-free-summer-pixel-art-backgrounds/PNG/summer${i === 5 ? '' : ' '}${i}`)]),
  ...range(4).map((i) => [`autumn_${i}`, numbered(`${A}craftpix-net-311636-free-autumn-pixel-backgrounds-for-game/PNG/background ${i}`)]),
  ...range(4).map((i) => [`peaks_${i}`, numbered(`${A}craftpix-net-313304-free-mountain-peak-pixel-art-backgrounds/PNG/background ${i}`)]),
  ...range(5).map((i) => [`mountains_${i}`, numbered(`${A}craftpix-net-773023-free-mountain-backgrounds-pixel-art/m${i}`)]),
  ...range(4).map((i) => [`snowfield_${i}`, numbered(`${A}craftpix-net-346185-free-winter-nature-pixel-game-backgrounds/${i}`)]),
  ...range(7).map((i) => [`winter_${i}`, numbered(`craftpix-net-882062-free-winter-backgrounds-pixel-art/winter ${i}`)]),
  ...range(4).map((i) => [`temple_${i}`, numbered(`${A}craftpix-net-323621-free-ancient-temple-pixel-game-backgrounds/PNG/background ${i}`)]),
  ...range(4).map((i) => [`crystal_${i}`, numbered(`${A}craftpix-net-433169-free-crystal-cave-pixel-art-backgrounds/PNG/background ${i}`)]),
  ...range(4).map((i) => [`oasis_${i}`, numbered(`${A}craftpix-net-546708-free-desert-oasis-pixel-art-background-pack/PNG/background ${i}`)]),
  ...range(4).map((i) => [`abandoned_${i}`, numbered(`${A}craftpix-net-597821-free-pixel-art-abandoned-places-background-collection/background ${i}`)]),
  ...range(4).map((i) => [`ruins_${i}`, numbered(`${A}craftpix-net-736662-free-city-ruin-backgrounds-pixel-art/background ${i}`)]),
  ...range(5).map((i) => [`ocean_${i}`, numbered(`${A}craftpix-net-724983-ocean-and-clouds-free-pixel-art-backgrounds/Ocean_${i}`)]),
  ...range(5).map((i) => [`city_${i}`, numbered(`${A}craftpix-net-322807-free-city-backgrounds-pixel-art/city ${i}`)]),
  ...range(4).map((i) => [`future_${i}`, numbered(`${A}craftpix-net-219100-free-futuristic-city-pixel-art-backgrounds/city ${i}`)]),
  ...range(4).map((i) => [`steampunk_${i}`, numbered(`craftpix-net-972811-free-steampunk-cityscape-pixel-backgrounds/background ${i}`)]),
  ...range(4).map((i) => [`underwater_${i}`, numbered(`craftpix-net-917640-free-underwater-world-pixel-art-backgrounds/background ${i}`)]),
  ...range(4).map((i) => [`moon_${i}`, numbered(`craftpix-net-942044-free-moon-pixel-game-backgrounds/${i} background`)]),
  ...range(4).map((i) => [`cloudscape_${i}`, numbered(`${A}craftpix-net-227064-free-seamless-pixel-art-cloudscape-for-game-projects/background ${i}`)]),
  ...range(4).map((i) => [`skies_${i}`, numbered(`${A}craftpix-net-245126-free-pixel-sky-with-parallax-clouds-for-2d-games/background ${i}`)]),
  ...range(5).map((i) => [`clouds_${i}`, numbered(`${A}craftpix-net-558275-free-sky-with-clouds-background-pixel-art-set/Clouds/Clouds ${i}`)]),
  ...range(4).map((i) => [`heights_${i}`, numbered(`craftpix-net-995711-free-pixel-art-cloud-and-sky-backgrounds/${i}. NEW CLOUDS`)]),
  ['industrial_day', numbered('2 Background/Day')],
  ['industrial_night', numbered('2 Background/Night')],
  ['wasteland_1', named(`${A}craftpix-901125-free-post-apocalyptic-pixel-art-game-backgrounds/PNG/Postapocalypce1/Bright`, ['clouds1', 'clouds2', 'ground&houses_bg', 'ground&houses2', 'ground&houses', 'fence', 'road'])],
  ['wasteland_2', named(`${A}craftpix-901125-free-post-apocalyptic-pixel-art-game-backgrounds/PNG/Postapocalypce2/Bright`, ['sky', 'bird1', 'houses&trees_bg', 'houses', 'car_trees_etc', 'fence', 'road'])],
  ['wasteland_3', named(`${A}craftpix-901125-free-post-apocalyptic-pixel-art-game-backgrounds/PNG/Postapocalypce3/Bright`, ['sky', 'moon', 'sand_back', 'sand&objects3', 'sand&objects2', 'sand&objects1', 'sand'])],
  ['battle_ruins', named(`${A}craftpix-net-776320-free-pixel-art-fantasy-2d-battlegrounds/PNG/Battleground1/Bright`, ['sky', 'hills&trees', 'ruins_bg', 'ruins2', 'ruins', 'statue', 'stones&grass'])],
  ['battle_hall', named(`${A}craftpix-net-776320-free-pixel-art-fantasy-2d-battlegrounds/PNG/Battleground2/Bright`, ['bg', 'mountaims', 'wall@windows', 'columns&falgs', 'candeliar', 'dragon', 'floor'])],
  ['battle_jungle', named(`${A}craftpix-net-776320-free-pixel-art-fantasy-2d-battlegrounds/PNG/Battleground3/Bright`, ['sky', 'jungle_bg', 'trees&bushes', 'tree_face', 'lianas', 'grasses', 'grass&road', 'fireflys'])],
  ['battle_graves', named(`${A}craftpix-net-776320-free-pixel-art-fantasy-2d-battlegrounds/PNG/Battleground4/Bright`, ['sky', 'back_trees', 'crypt', 'wall', 'graves', 'tree', 'bones', 'ground'])],
];

const only = process.argv.slice(2);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, '../backdrops.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  for (const [id, files] of SPECS) {
    if (only.length && !only.includes(id)) continue;
    if (!files.length) throw new Error(`${id}: no layers`);
    const srcs = files.map((f) => {
      const p = path.join(ASSETS, f);
      if (!fs.existsSync(p)) throw new Error(`${id}: missing ${p}`);
      return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
    });
    const url = await page.evaluate(
      async ({ srcs, W, H, FORMAT, Q }) => {
        const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H * srcs.length;
        const g = c.getContext('2d');
        for (let i = 0; i < srcs.length; i++) {
          const im = await load(srcs[i]);
          g.imageSmoothingEnabled = im.width > W; // (the 1920 packs are scaled down smoothly; the pixel ones kept sharp)
          g.drawImage(im, 0, i * H, W, H);
        }
        return c.toDataURL(FORMAT === 'webp' ? 'image/webp' : 'image/png', Q);
      },
      { srcs, W, H, FORMAT, Q: +(process.env.QUALITY || 0.86) },
    );
    const ext = FORMAT === 'webp' ? 'webp' : 'png';
    fs.writeFileSync(path.join(OUT, `${id}.${ext}`), Buffer.from(url.split(',')[1], 'base64'));
    manifest[id] = { layers: files.length, ext };
    console.log(id, files.length, 'layers');
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  const ids = Object.keys(manifest).sort();
  fs.writeFileSync(
    path.join(__dirname, '../src/shared/data/backdrops.ts'),
    [
      '// Generated by tools/compose-backdrops.cjs: the painted backdrops built from the Craftpix parallax packs',
      '// (renderer/art/backdrops/), and how many layers each has. Do not edit by hand.',
      '',
      'export const BACKDROPS = {',
      ...ids.map((id) => `  ${id}: ${manifest[id].layers},`),
      '} as const;',
      'export type BackdropId = keyof typeof BACKDROPS;',
      '',
    ].join('\n'),
  );
  await browser.close();
})();
