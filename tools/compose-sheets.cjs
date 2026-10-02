// Builds the game's creature sheets from the Craftpix packs in ../chronos-assets (a dev tool, run by hand:
// `node tools/compose-sheets.cjs`; it needs Playwright's Chromium). Each pack gives one PNG strip per animation (or,
// for the big painted bosses, one PNG per frame); this lays a creature's walk, attack, idle, hurt and dying frames
// out as rows of one small sheet, each frame cropped to the creature (centred on its body, its feet on the bottom
// edge), and writes the sheets to src/renderer/art/creatures/packs/ with their layout in packs.json.

const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const ASSETS = process.env.ASSETS || path.join(__dirname, '../../chronos-assets');
const OUT = path.join(__dirname, '../src/renderer/art/creatures/packs');
const A = 'assets/';

// rows: walk, attack, idle, hurt, dead. A strip is a file of square frames (its height); a sequence is a folder of
// frames (`seq`, taking every `every`th, scaled by `scale`).
const strip = (id, dir, rows, extra = {}) => ({ id, dir, rows, ...extra });
const std = (id, dir, attack = 'Attack_1', walk = 'Walk', dead = 'Dead') => strip(id, dir, { walk, attack, idle: 'Idle', hurt: 'Hurt', dead });
const WOLF = A + 'craftpix-net-248468-free-werewolf-sprite-sheets-pixel-art/';
const GORGON = A + 'craftpix-net-280097-free-gorgon-pixel-art-character-sprite-sheets/';
const MINO = A + 'craftpix-net-170637-free-minotaur-sprite-sheet-pixel-art-pack/';
const SATYR = A + 'craftpix-net-131479-free-satyr-sprite-sheet-pixel-art-pack/';
const FOREST = A + 'craftpix-net-413641-free-forest-bosses-pixel-art-sprite-sheet-pack/';
const SAMURAI = A + 'craftpix-net-123681-free-samurai-pixel-art-sprite-sheets/';
const NINJA = A + 'craftpix-net-407836-free-ninja-sprite-sheets-pixel-art/';
const WIZARD = A + 'craftpix-net-529677-free-wizard-sprite-sheets-pixel-art/';
const ROBOT = A + 'craftpix-net-434566-free-robot-pixel-art-sprite-sheets/';
const YOKAI = A + 'craftpix-net-605776-free-yokai-pixel-art-character-sprites/';
const TINY = A + 'craftpix-net-622999-free-pixel-art-tiny-hero-sprites/';
const TD = A + 'craftpix-net-221601-free-enemy-pixel-pack-for-top-down-defense/';
const KNIGHT = 'craftpix-net-803217-free-knight-character-sprites-pixel-art/';
const SKELETON = 'craftpix-net-957123-free-skeleton-pixel-art-sprite-sheets/';
const BOSSES = A + 'craftpix-net-643385-free-fantasy-rpg-top-down-boss-creatures-pack/';
const PIRATES = A + 'craftpix-net-856364-free-fantasy-rpg-pirate-boss-character-pack/';
const tiny = (id, dir, name) => strip(id, TINY + dir, { walk: `${name}_Walk_6`, attack: `${name}_Attack1_4`, idle: `${name}_Idle_4`, hurt: `${name}_Hurt_4`, dead: `${name}_Death_8` });
const td = (id, dir, run = 'S_Run') => strip(id, TD + dir, { walk: run, attack: 'S_Attack', idle: run, dead: 'S_Death' }, { facesLeft: true });
const seq = (id, dir) => ({
  id,
  dir: dir + '/PNG/PNG Sequences',
  seq: { walk: 'Left - Walking', attack: 'Left - Attacking', idle: 'Left - Idle', hurt: 'Left - Hurt', dead: 'Dying' },
  every: { walk: 2, attack: 1, idle: 2, hurt: 2, dead: 1 },
  scale: 0.2,
  facesLeft: true,
});

const SPECS = [
  std('werewolf_black', WOLF + 'Black_Werewolf', 'Attack_1', 'walk'),
  std('werewolf_red', WOLF + 'Red_Werewolf'),
  std('werewolf_white', WOLF + 'White_Werewolf'),
  std('gorgon_1', GORGON + 'Gorgon_1'),
  std('gorgon_2', GORGON + 'Gorgon_2'),
  std('gorgon_3', GORGON + 'Gorgon_3'),
  std('minotaur_1', MINO + 'Minotaur_1', 'Attack'),
  std('minotaur_2', MINO + 'Minotaur_2', 'Attack'),
  std('minotaur_3', MINO + 'Minotaur_3', 'Attack'),
  std('satyr_1', SATYR + 'Satyr_1', 'Attack'),
  std('satyr_2', SATYR + 'Satyr_2', 'Attack'),
  std('satyr_3', SATYR + 'Satyr_3', 'Attack'),
  { ...std('forest_boss_1', FOREST + '1', 'Attack1', 'Walk', 'Death'), facesLeft: true },
  { ...std('forest_boss_2', FOREST + '2', 'Attack1', 'Walk', 'Death'), facesLeft: true },
  { ...std('forest_boss_3', FOREST + '3', 'Attack1', 'Walk', 'Death'), facesLeft: true },
  std('samurai', SAMURAI + 'Samurai'),
  std('samurai_archer', SAMURAI + 'Samurai_Archer', 'Shot'),
  std('samurai_commander', SAMURAI + 'Samurai_Commander'),
  std('kunoichi', NINJA + 'Kunoichi'),
  std('ninja_monk', NINJA + 'Ninja_Monk'),
  std('ninja_peasant', NINJA + 'Ninja_Peasant', 'Shot'),
  std('fire_wizard', WIZARD + 'Fire Wizard', 'Fireball'),
  std('lightning_mage', WIZARD + 'Lightning Mage', 'Light_ball'),
  std('wanderer_mage', WIZARD + 'Wanderer Magican', 'Magic_arrow'),
  std('robot_destroyer', ROBOT + 'Destroyer', 'Shot_1'),
  std('robot_infantry', ROBOT + 'Infantryman', 'Shot_2'),
  std('robot_swordsman', ROBOT + 'Swordsman', 'Attack_1', 'Idle'),
  std('karasu_tengu', YOKAI + 'Karasu_tengu'),
  std('kitsune', YOKAI + 'Kitsune'),
  std('yamabushi_tengu', YOKAI + 'Yamabushi_tengu'),
  std('knight_1', KNIGHT + 'Knight_1', 'Attack 1'),
  std('knight_2', KNIGHT + 'Knight_2', 'Attack 1'),
  std('knight_3', KNIGHT + 'Knight_3', 'Attack 1'),
  std('skeleton_archer', SKELETON + 'Skeleton_Archer', 'Shot_1'),
  std('skeleton_spearman', SKELETON + 'Skeleton_Spearman'),
  std('skeleton_warrior', SKELETON + 'Skeleton_Warrior'),
  tiny('imp_pink', '1 Pink_Monster', 'Pink_Monster'),
  tiny('imp_owlet', '2 Owlet_Monster', 'Owlet_Monster'),
  tiny('imp_dude', '3 Dude_Monster', 'Dude_Monster'),
  td('horde_1', '1'),
  td('horde_2', '2'),
  td('horde_3', '3', 'S_Fly'),
  seq('boar_king', BOSSES + 'Boar King'),
  seq('devil_leader', BOSSES + 'Devil Leader'),
  seq('shaman_king', BOSSES + 'Shaman King'),
  seq('pirate_leader', PIRATES + 'Pirate Leader'),
  seq('pirate_zombie', PIRATES + 'Pirate Zombie'),
  seq('squidman', PIRATES + 'Squidman'),
];

const ROWS = ['walk', 'attack', 'idle', 'hurt', 'dead'];
const only = process.argv.slice(2);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifestPath = path.join(OUT, '../packs.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  for (const spec of SPECS) {
    if (only.length && !only.includes(spec.id)) continue;
    // the frames of each row, as images and rectangles
    const rows = {};
    for (const r of ROWS) {
      if (spec.seq) {
        const dir = path.join(ASSETS, spec.dir, spec.seq[r]);
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().filter((_, i) => i % (spec.every[r] ?? 1) === 0);
        rows[r] = files.map((f) => ({ src: 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64') }));
      } else {
        const name = spec.rows[r];
        if (!name) continue;
        const file = path.join(ASSETS, spec.dir, name + '.png');
        if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
        rows[r] = { strip: 'data:image/png;base64,' + fs.readFileSync(file).toString('base64') };
      }
    }
    const out = await page.evaluate(
      async ({ rows, scale, ROWS }) => {
        const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
        // every frame drawn on its own canvas (scaled for the painted bosses)
        const frames = {};
        for (const r of ROWS) {
          const row = rows[r];
          if (!row) continue;
          const list = [];
          if (row.strip) {
            const im = await load(row.strip);
            const n = Math.max(1, Math.round(im.width / im.height));
            const fw = im.width / n;
            for (let i = 0; i < n; i++) {
              const c = document.createElement('canvas');
              c.width = fw;
              c.height = im.height;
              c.getContext('2d').drawImage(im, i * fw, 0, fw, im.height, 0, 0, fw, im.height);
              list.push(c);
            }
          } else {
            for (const f of row) {
              const im = await load(f.src);
              const c = document.createElement('canvas');
              c.width = Math.round(im.width * scale);
              c.height = Math.round(im.height * scale);
              const g = c.getContext('2d');
              g.imageSmoothingQuality = 'high';
              g.drawImage(im, 0, 0, c.width, c.height);
              list.push(c);
            }
          }
          frames[r] = list;
        }
        // where the creature is: the union of its frames' opaque pixels, and its body's middle (the idle frame's
        // weight) so it stays centred as it swings and falls
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        const W = frames.idle[0].width;
        const H = frames.idle[0].height;
        for (const r of Object.keys(frames))
          for (const c of frames[r]) {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let y = 0; y < c.height; y++)
              for (let x = 0; x < c.width; x++)
                if (d[(y * c.width + x) * 4 + 3] > 24) {
                  if (x < x0) x0 = x;
                  if (x > x1) x1 = x;
                  if (y < y0) y0 = y;
                  if (y > y1) y1 = y;
                }
          }
        const idle = frames.idle[0];
        const d = idle.getContext('2d').getImageData(0, 0, idle.width, idle.height).data;
        let sum = 0, mass = 0, top = 1e9, foot = -1;
        for (let y = 0; y < idle.height; y++)
          for (let x = 0; x < idle.width; x++) {
            const a = d[(y * idle.width + x) * 4 + 3];
            if (a > 24) {
              sum += x * a;
              mass += a;
              if (y < top) top = y;
              if (y > foot) foot = y;
            }
          }
        const cx = Math.round(sum / Math.max(1, mass));
        const half = Math.max(cx - x0, x1 - cx) + 1;
        const fw = half * 2;
        const fh = y1 - y0 + 2;
        const perRow = Math.max(...Object.values(frames).map((l) => l.length));
        const order = ROWS.filter((r) => frames[r]);
        const sheet = document.createElement('canvas');
        sheet.width = fw * perRow;
        sheet.height = fh * order.length;
        const g = sheet.getContext('2d');
        order.forEach((r, ri) => frames[r].forEach((c, i) => g.drawImage(c, cx - half, y0, fw, fh, i * fw, ri * fh, fw, fh)));
        const counts = Object.fromEntries(order.map((r) => [r, frames[r].length]));
        return { png: sheet.toDataURL('image/png'), w: fw, h: fh, perRow, rows: order, counts, figure: foot - top + 1, width: W, height: H };
      },
      { rows, scale: spec.scale ?? 1, ROWS },
    );
    fs.writeFileSync(path.join(OUT, spec.id + '.png'), Buffer.from(out.png.split(',')[1], 'base64'));
    manifest[spec.id] = { w: out.w, h: out.h, perRow: out.perRow, rows: out.rows, counts: out.counts, figure: out.figure, facesRight: !spec.facesLeft };
    console.log(spec.id, `${out.w}x${out.h}`, 'frames', JSON.stringify(out.counts), 'figure', out.figure);
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
  // the renderer's imports, and the sheet names the simulation's enemies can use
  const ids = Object.keys(manifest).sort();
  const ts = [
    '// Generated by tools/compose-sheets.cjs from the Craftpix packs (see CREDITS.md): do not edit by hand.',
    '',
    "// (the sheets are files beside the page, copied there by build.mjs and build-web.mjs, not inlined into the script)",
    "import manifest from './packs.json';",
    '',
    'export const packUrl = (id: string) => `packs/${id}.png`;',
    'export const PACK_LAYOUT = manifest as Record<string, { w: number; h: number; perRow: number; rows: string[]; counts: Record<string, number>; figure: number; facesRight: boolean }>;',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, '../packs.ts'), ts);
  const shared = [
    '// Generated by tools/compose-sheets.cjs: the creature sheets built from the Craftpix packs (renderer/art/creatures/packs/),',
    "// and each one's figure height in pixels (for picking a drawing scale). Do not edit by hand.",
    '',
    'export const PACK_SHEETS = {',
    ...ids.map((id) => `  ${id}: ${manifest[id].figure},`),
    '} as const;',
    'export type PackSheetId = keyof typeof PACK_SHEETS;',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, '../src/shared/data/packSheets.ts'), shared);
  await browser.close();
})();
