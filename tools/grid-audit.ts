// The grid audit (docs/notes/grid-audit.md): how every piece a settler town draws on the isometric map sits against the
// cells it is given. Reads the PNGs themselves (tools/png.ts), finds each picture's own ground (iso/gridAudit.ts
// `measureBase`) and works out its fit on its footprint the way iso/isoView.ts draws it. Writes a table, the worst
// first. Run by hand: `node tools/grid-audit.mjs` (it writes docs/notes/grid-audit/measurements.md).
// It measures the drawing before the grid's rules (the pictures fitted to their footprints, as the audit found them);
// the rules themselves are checked by test/gridRules.test.ts.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { BUILDINGS } from '../src/shared/data/buildings';
import { depthOf, isUnlocked } from '../src/shared/sim/buildings';
import { CROPS } from '../src/shared/data/crops';
import { HERDS } from '../src/shared/data/livestock';
import { fitted, kitOf, pieceFor, roleOf, sharedPiece, ISO_ART, liesAlongY } from '../src/renderer/iso/isoKits';
import { gateFlip, wallPieceFor } from '../src/renderer/iso/isoTown';
import { fitOf, measureBase, pictureScale, type ArtBase, type Fit } from '../src/renderer/iso/gridAudit';
import { ISO_TH, ISO_TW } from '../src/renderer/iso/isoMath';
import { readPng } from './png';

const ART = 'src/renderer/art/iso';
const kit = kitOf('settlers');
const kitK = kit.scale * ISO_ART;
/** iso/isoView.ts: the land's scenery and props at these shares of the kit's size, a scenery picture anchored 0.9 down. */
const TREE_SHARE = 0.85;
const BUSH_SHARE = 0.7;
const LANDMARK_SHARE = 0.8;
const PROP_SHARE = 0.6;
const SCENERY_ANCHOR = 0.9;
/** map/mapPeople.ts: the PixelLab looks drawn at this. */
const FOLK_SCALE = 0.55;

const measured = new Map<string, { base: ArtBase; w: number; h: number } | null>();
function measure(path: string): { base: ArtBase; w: number; h: number } | null {
  if (measured.has(path)) return measured.get(path)!;
  let got: { base: ArtBase; w: number; h: number } | null = null;
  try {
    const png = readPng(path);
    const base = measureBase((x, y) => png.alpha[y * png.w + x], png.w, png.h);
    if (base) got = { base, w: png.w, h: png.h };
  } catch {}
  measured.set(path, got);
  return got;
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
const r0 = (n: number) => String(Math.round(n));

/** How bad a fit is: px off the ground and off the front corner (a half-cell counts 1), cells too many or too few,
 *  and how far it spills past its diamond. */
const badness = (f: Fit): number =>
  Math.abs(f.lift) / (ISO_TH / 2) + Math.abs(f.shiftX) / (ISO_TW / 2) + Math.abs(f.artW - f.footW) + Math.abs(f.artH - f.footH) + Math.max(0, f.spread - 1) * 4 + Math.max(0, 0.6 - f.spread) * 4;

/* ------------------------------------------------------------ buildings */

interface Row {
  what: string;
  piece: string;
  note: string;
  fit: Fit;
  k: number;
  bad: number;
}
const rows: Row[] = [];
// (every building a settlers' town can have, all research done: the build menu's and the ring wall's)
const settlerDefs = BUILDINGS.filter((d) => !d.never && isUnlocked({ unlockAll: true, done: [], origin: 'settlers', relief: true }, d) && (!d.seat || d.origin === 'settlers'));
for (const d of settlerDefs) {
  const role = roleOf(d.id);
  const foot = { w: d.width, h: depthOf(d) };
  if ('field' in role) continue;
  let piece = pieceFor(kit, d.id);
  let flip = false;
  const ids = [...kit.pieces.keys()];
  if (role.role === 'gate') {
    piece = wallPieceFor(ids, 'gate', d.id) ?? piece;
    flip = gateFlip(foot) !== liesAlongY('settlers', piece);
  } else if (role.role === 'wall_run') {
    // (a lone stretch along x: the run piece, mirrored where it was drawn lying along y)
    piece = wallPieceFor(ids, 'run', d.id) ?? piece;
    flip = liesAlongY('settlers', piece);
  }
  const shared = sharedPiece('settlers', piece);
  if (shared?.along_y) flip = foot.w > foot.h;
  const path = shared ? `${ART}/buildings/${piece}.png` : `${ART}/kits/settlers/${piece}.png`;
  const m = measure(path);
  if (!m) continue;
  const texH = m.h - (shared?.soil ?? 0);
  // (a shared piece's soil cut off: the plinth measured on the picture as drawn)
  const base = shared?.soil ? { ...m.base, y1: Math.min(m.base.y1, texH - 1), front: { x: m.base.front.x, y: Math.min(m.base.front.y, texH - 1) } } : m.base;
  const span = ((foot.w + foot.h) * ISO_TW) / 2;
  const k = pictureScale(fitted(d.id) || !!shared, kitK, span, m.w);
  const fit = fitOf(base, m.w, texH, k, flip, foot);
  const notes: string[] = [];
  if (!shared && piece === 'cottage' && role.role !== 'cottage') notes.push(`no ${role.role} piece: a cottage stands in`);
  if (k < kitK * 0.75 && !shared) notes.push(`shrunk to ${Math.round((k / kitK) * 100)}% of the kit`);
  rows.push({ what: `${d.id} (${foot.w}x${foot.h})`, piece: shared ? `shared/${piece}` : piece, note: notes.join('; '), fit, k, bad: badness(fit) });
}
rows.sort((a, b) => b.bad - a.bad);

/* ------------------------------------------------------------ the land's scenery, props, landmarks */

interface Loose {
  what: string;
  /** Px its foot stands above its spot (+ floats, - sinks). */
  lift: number;
  /** Its width in cells, and its height in cell heights. */
  wide: number;
  tall: number;
  snap: string;
}
const loose: Loose[] = [];
const looseOf = (what: string, path: string, k: number, anchorY: number, snap: string) => {
  const m = measure(path);
  if (!m) return;
  // (its foot: its plinth's top face if it has one wider than a trunk, else its lowest row)
  const groundY = m.base.front.y - (m.base.right.x - m.base.left.x > 12 ? m.base.slab : 0);
  loose.push({ what, lift: (m.h * anchorY - (groundY + 1)) * k, wide: ((m.base.x1 - m.base.x0 + 1) * k) / ISO_TW, tall: ((m.base.y1 - m.base.y0 + 1) * k) / ISO_TH, snap });
};
for (const id of kit.pieces.keys()) {
  if (/tree/.test(id)) looseOf(`settlers/${id} (tree)`, `${ART}/kits/settlers/${id}.png`, kitK * TREE_SHARE, SCENERY_ANCHOR, 'a random spot in the middle 40% of its cell');
  else if (/bush/.test(id)) looseOf(`settlers/${id} (bush)`, `${ART}/kits/settlers/${id}.png`, kitK * BUSH_SHARE, SCENERY_ANCHOR, 'a random spot in the middle 40% of its cell');
  else if (/rocks/.test(id)) looseOf(`settlers/${id} (rock)`, `${ART}/kits/settlers/${id}.png`, kitK * TREE_SHARE, SCENERY_ANCHOR, 'a random spot in the middle 40% of its cell');
  else if (/barrels|crates|woodpile|lamp_post|cart|hay/.test(id)) looseOf(`settlers/${id} (prop)`, `${ART}/kits/settlers/${id}.png`, kitK * PROP_SHARE, 1, '0.45 cells past the footprint, 0.25..0.75 along a face');
}
const wild = JSON.parse(readFileSync(`${ART}/kits/wild/index.json`, 'utf8')) as { id: string }[];
for (const p of wild) looseOf(`wild/${p.id} (landmark)`, `${ART}/kits/wild/${p.id}.png`, kitK * LANDMARK_SHARE, SCENERY_ANCHOR, "the cell's middle");

/* ------------------------------------------------------------ the townsfolk */

const folk: { look: string; feet: number; tall: number }[] = [];
for (const look of ['man_base', 'woman_leather', 'dwarf_plate', 'child_boy']) {
  const dir = `${ART}/folk/settlers/${look}`;
  try {
    const ix = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')) as { frame: [number, number] };
    const png = readPng(`${dir}/rotations.png`);
    const [fw, fh] = ix.frame;
    // (the south-facing frame, the first)
    const base = measureBase((x, y) => png.alpha[y * png.w + x], fw, fh)!;
    folk.push({ look, feet: (fh - 1 - base.y1) * FOLK_SCALE, tall: ((base.y1 - base.y0 + 1) * FOLK_SCALE) / ISO_TH });
  } catch {}
}

/* ------------------------------------------------------------ the table */

const out: string[] = [];
out.push('# Grid audit: measurements', '');
out.push('Written by `node tools/grid-audit.mjs` (tools/grid-audit.ts), the settlers\' kit as the iso view draws it today. ' +
  `A cell is ${ISO_TW}x${ISO_TH} px; the kit is drawn at ${r1(kitK * 100)}% (its \`scale\` ${kit.scale} times \`ISO_ART\` ${ISO_ART}).`, '');
out.push('## Buildings, worst first', '');
out.push('- **foot**: the footprint (cells along x by along y). **art**: the cells the picture\'s own plinth covers as drawn.');
out.push('- **lift**: px the picture\'s ground stands above the footprint\'s (+ floats, - sinks). **shift**: px its front corner stands right of the footprint\'s.');
out.push('- **spread**: the picture\'s width over the footprint\'s diamond\'s. **rows**: how many cell heights it rises behind its back corner.', '');
out.push('| building | piece | foot | art | lift | shift | spread | rows | scale | note |', '|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows)
  out.push(`| ${r.what} | ${r.piece} | ${r.fit.footW}x${r.fit.footH} | ${r1(r.fit.artW)}x${r1(r.fit.artH)} | ${r0(r.fit.lift)} | ${r0(r.fit.shiftX)} | ${r1(r.fit.spread)} | ${r1(r.fit.rows)} | ${r1(r.k * 100)}% | ${r.note} |`);
out.push('', '## Fields and pens', '');
const fieldDefs = settlerDefs.filter((d) => CROPS[d.id] || HERDS[d.id]);
out.push(`${fieldDefs.length} kinds (${fieldDefs.map((d) => `${d.id} ${d.width}x${depthOf(d)}`).join(', ')}): drawn as the kit's field tile, one to a cell, so on the grid exactly; a pen is drawn as a field too (no fence, no beasts' ground).`, '');
out.push('## Scenery, props and landmarks', '');
out.push('| piece | lift (px) | wide (cells) | tall (cell heights) | where it stands |', '|---|---|---|---|---|');
for (const l of loose.sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))) out.push(`| ${l.what} | ${r0(l.lift)} | ${r1(l.wide)} | ${r1(l.tall)} | ${l.snap} |`);
out.push('', '## Townsfolk', '');
out.push('| look | feet above the spot (px) | tall (cell heights) |', '|---|---|---|');
for (const f of folk) out.push(`| ${f.look} | ${r0(f.feet)} | ${r1(f.tall)} |`);
out.push('');
mkdirSync('docs/notes/grid-audit', { recursive: true });
// (every building's footprint, for tools/grid-recut.py: it bakes the shared pieces to the size their footprint asks)
mkdirSync('out', { recursive: true });
writeFileSync('out/grid-defs.json', JSON.stringify(Object.fromEntries(BUILDINGS.map((d) => [d.id, [d.width, depthOf(d)]]))));
writeFileSync('docs/notes/grid-audit/measurements.md', out.join('\n'));
console.log(`wrote docs/notes/grid-audit/measurements.md (${rows.length} buildings, ${loose.length} loose pieces)`);
