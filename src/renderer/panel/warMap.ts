// The conquest's world map on the War tab, drawn at the screen's own resolution: the lands' textured ground (the
// sea by its depth with foam at the shore, the mountains in relief), the lands' trees, bushes and rocks from the
// props atlases, each province's settlement as the pack's buildings by its tier (a tent camp for the nomads, a
// carved gate for the dwarves), its landmark (a lair's cave, a shrine, a mine, ruins, a signpost, a jetty), the
// realms' holdings as a tint with a coloured band along their borders, flags on the held settlements, garrisons,
// and the armies as figures under their banners. The terrain and the holdings are painted once each and kept
// (art/warTerrain.ts); the marks are drawn on every redraw.

import { CELL_CODES, type WorldCell } from '../../shared/data/conquest';
import { FACTION_BY_ID } from '../../shared/data/factions';
import { ownerAt, type ArmyView, type ProvinceView, type WarView } from '../../shared/sim/conquest/warView';
import type { PersonView } from '../../shared/sim/snapshot';
import { hkWhoOf } from '../art/hkFolk';
import { drawCaptain, drawProp, drawSprite, drawWho, REALM_COLOURS, type SpriteId, type WarPropSet } from '../art/warSprites';
import { askGroundDetail, drawProps, hashAt, LAND_LOOK, paintDetail, paintGround, placeProps, propsReady } from '../art/warTerrain';

const CODES = '0123456789ab';
export const realmColour = (w: WarView, id: string | null) => (id === null ? null : REALM_COLOURS[Math.max(0, w.realms.findIndex((r) => r.id === id)) % REALM_COLOURS.length]);

/** The land of a cell of the world. */
export const landAt = (w: WarView, cx: number, cy: number): WorldCell | null => (cx < 0 || cy < 0 || cx >= w.side || cy >= w.side ? null : (CELL_CODES[CODES.indexOf(w.cells[cy * w.side + cx])] ?? 'water'));

/* ------------------------------------------------------------ the terrain, painted once */

interface Terrain {
  cells: string;
  cell: number;
  ready: string;
  canvas: HTMLCanvasElement;
}
let terrain: Terrain | null = null;
let depths: { cells: string; d: Uint8Array } | null = null;

/** Each water cell's distance from land in cells (1 beside it, up to 6). */
function depthMap(w: WarView): Uint8Array {
  if (depths && depths.cells === w.cells) return depths.d;
  const n = w.side * w.side;
  const d = new Uint8Array(n).fill(255);
  const queue: number[] = [];
  for (let i = 0; i < n; i++)
    if (CODES.indexOf(w.cells[i]) !== 0) {
      d[i] = 0;
      queue.push(i);
    }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % w.side;
    const y = (i - x) / w.side;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w.side || ny >= w.side) continue;
      const j = ny * w.side + nx;
      if (d[j] !== 255) continue;
      d[j] = Math.min(6, d[i] + 1);
      queue.push(j);
    }
  }
  for (let i = 0; i < n; i++) if (d[i] === 255) d[i] = 6;
  depths = { cells: w.cells, d };
  return d;
}

/** The sets the world's lands draw props from. */
function setsOf(w: WarView): Set<WarPropSet> {
  const sets = new Set<WarPropSet>();
  for (const p of w.provinces) for (const pr of LAND_LOOK[p.land as WorldCell]?.props ?? []) sets.add(pr.set);
  sets.add('cave');
  return sets;
}

/** The world's ground and its wild things, `cell` px a cell; cached until the pack's sheets arrive or the scale changes. */
export function worldTerrain(w: WarView): HTMLCanvasElement {
  const cell = terrainCell(w);
  const ready = `${askGroundDetail() ? 1 : 0}${propsReady(setsOf(w)) ? 1 : 0}`;
  if (terrain && terrain.cells === w.cells && terrain.cell === cell && terrain.ready === ready) return terrain.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = w.side * cell;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const seed = hashSeed(w.cells.slice(0, 64)) + w.side;
  const d = depthMap(w);
  const land = (cx: number, cy: number) => landAt(w, cx, cy);
  paintGround(g, { w: canvas.width, h: canvas.height, cell, landAt: land, depthAt: (cx, cy) => d[cy * w.side + cx] || 1, seed, block: cell >= 12 ? 2 : 1, relief: 0.5, grain: 0.8 });
  paintDetail(g, { cols: w.side, rows: w.side, cell, seed, landAt: land });
  // the wild things, clear of every settlement
  const centres = w.provinces.map((p) => [p.x, p.y]);
  const keep = (cx: number, cy: number) => centres.some(([px, py]) => Math.abs(px - cx) <= 1 && Math.abs(py - cy) <= 1);
  drawProps(g, placeProps({ cols: w.side, rows: w.side, cell, seed, landAt: land, keep, scale: 1 }));
  terrain = { cells: w.cells, cell, ready, canvas };
  return canvas;
}
/** The cell size (device px) the map is drawn at: fitted to the panel's width at the screen's resolution. */
export function terrainCell(w: WarView): number {
  const width = Math.max(280, (document.getElementById('body')?.clientWidth ?? 360) - 28);
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  return Math.max(3, Math.floor((width * dpr) / w.side));
}
export const devicePixels = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

/* ------------------------------------------------------------ the holdings, painted when they change */

interface Holders {
  key: string;
  canvas: HTMLCanvasElement;
}
let holders: Holders | null = null;
/** A tint over each realm's provinces and a band of its colour along their borders; thin lines between provinces. */
export function holdersLayer(w: WarView, cell: number, selected: number | null): HTMLCanvasElement {
  const key = `${w.cells.length}|${cell}|${w.provinces.map((p) => p.holder ?? '-').join(',')}|${selected}`;
  if (holders && holders.key === key) return holders.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = w.side * cell;
  const g = canvas.getContext('2d')!;
  const band = Math.max(2, Math.round(cell * 0.28));
  const own = (i: number) => ownerAt(w, i);
  const holderOf = (o: number) => (o < 0 ? null : w.provinces[o].holder);
  for (let y = 0; y < w.side; y++)
    for (let x = 0; x < w.side; x++) {
      const i = y * w.side + x;
      const o = own(i);
      if (o < 0) continue;
      const h = holderOf(o);
      const col = realmColour(w, h);
      if (col) {
        g.globalAlpha = h === w.realms[0].id ? 0.3 : 0.22;
        g.fillStyle = col;
        g.fillRect(x * cell, y * cell, cell, cell);
        g.globalAlpha = 1;
      }
      // the borders: a band of the holder's colour where its land ends; a thin line between provinces
      const edges: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of edges) {
        const nx = x + dx;
        const ny = y + dy;
        const no = nx < 0 || ny < 0 || nx >= w.side || ny >= w.side ? -1 : own(ny * w.side + nx);
        if (no === o) continue;
        const nh = holderOf(no);
        const chosen = o === selected;
        if (chosen) {
          g.fillStyle = '#ffffff';
          const t = Math.max(2, Math.round(cell * 0.18));
          if (dx) g.fillRect(dx > 0 ? (x + 1) * cell - t : x * cell, y * cell, t, cell);
          else g.fillRect(x * cell, dy > 0 ? (y + 1) * cell - t : y * cell, cell, t);
          continue;
        }
        if (col && nh !== h) {
          // a dark edge at the border, the realm's colour as a band inside it
          const edge = Math.max(1, Math.round(cell * 0.08));
          g.fillStyle = 'rgba(20, 16, 12, 0.6)';
          if (dx) g.fillRect(dx > 0 ? (x + 1) * cell - edge : x * cell, y * cell, edge, cell);
          else g.fillRect(x * cell, dy > 0 ? (y + 1) * cell - edge : y * cell, cell, edge);
          g.globalAlpha = 0.85;
          g.fillStyle = col;
          if (dx) g.fillRect(dx > 0 ? (x + 1) * cell - band - edge : x * cell + edge, y * cell, band, cell);
          else g.fillRect(x * cell, dy > 0 ? (y + 1) * cell - band - edge : y * cell + edge, cell, band);
          g.globalAlpha = 1;
        } else if (no >= 0) {
          g.fillStyle = 'rgba(20, 16, 12, 0.4)';
          const t = Math.max(1, Math.round(cell * 0.08));
          if (dx) g.fillRect(dx > 0 ? (x + 1) * cell - t : x * cell, y * cell, t, cell);
          else g.fillRect(x * cell, dy > 0 ? (y + 1) * cell - t : y * cell, cell, t);
        }
      }
    }
  holders = { key, canvas };
  return canvas;
}

/* ------------------------------------------------------------ the marks */

export interface MarkContext {
  /** The town's people (as the snapshot has them), its origin, and the picked army. */
  people: PersonView[];
  townOrigin: string;
  picked: number | null;
  selected: number | null;
  font: string;
}

/** The people a holder is of: the town's own, a power's, or null for free land. */
export function originOf(holder: string | null, townOrigin: string): string | null {
  if (holder === null) return null;
  if (holder === 'town') return townOrigin;
  return FACTION_BY_ID[holder]?.origin ?? 'brotherhood';
}

/** A settlement's buildings by its tier and its holder's people: what stands at (cx, cy) in px, `cell` px a cell. */
function drawSettlement(g: CanvasRenderingContext2D, p: ProvinceView, origin: string | null, cx: number, cy: number, cell: number, lair: boolean): void {
  const feet = cy + cell * 0.45;
  type Piece = { id: SpriteId; x: number; feet: number; h: number };
  const pieces: Piece[] = [];
  if (lair) {
    // something dens here: the cave mouth, bones about it
    const fr = 1;
    drawProp(g, 'places', 3, cx - cell * 1.1, feet + cell * 0.3, cell * 0.8);
    drawProp(g, 'places', fr, cx, feet + cell * 0.1, cell * 1.6);
    drawProp(g, 'places', 5, cx + cell * 1.0, feet + cell * 0.25, cell * 0.55);
    return;
  }
  const t = p.tierN;
  if (origin === 'nomads') {
    if (t >= 3) pieces.push({ id: 'tent', x: cx, feet, h: cell * 2.64 });
    else if (t >= 1) pieces.push({ id: 'yurt', x: cx, feet, h: cell * 1.92 });
    else pieces.push({ id: 'tipi', x: cx, feet, h: cell * 2.04 });
    if (t >= 1) pieces.push({ id: 'tipi', x: cx - cell * 1.2, feet: feet + cell * 0.35, h: cell * 1.56 });
    if (t >= 2) pieces.push({ id: 'yurt', x: cx + cell * 1.25, feet: feet + cell * 0.4, h: cell * 1.32 });
    if (t >= 4) pieces.push({ id: 'tipi', x: cx + cell * 0.9, feet: feet - cell * 0.9, h: cell * 1.44 });
  } else if (origin === 'dwarves') {
    pieces.push({ id: 'caveGate', x: cx, feet, h: cell * (1.9 + t * 0.3) });
    if (t >= 1) pieces.push({ id: 'mine', x: cx - cell * 1.2, feet: feet + cell * 0.35, h: cell * 1.2 });
    if (t >= 3) pieces.push({ id: 'watchtower', x: cx + cell * 1.25, feet: feet + cell * 0.3, h: cell * 1.92 });
  } else {
    if (t >= 4) pieces.push({ id: 'castle', x: cx, feet, h: cell * 3.6 });
    else if (t >= 3) pieces.push({ id: 'keep', x: cx, feet, h: cell * 3.0 });
    else if (t >= 1) pieces.push({ id: 'longhouse', x: cx, feet, h: cell * 2.28 });
    else pieces.push({ id: 'house', x: cx, feet, h: cell * 2.04 });
    if (t >= 1) pieces.push({ id: 'house', x: cx - cell * 1.25, feet: feet + cell * 0.4, h: cell * 1.68 });
    if (t >= 2) pieces.push({ id: 'gable', x: cx + cell * 1.2, feet: feet + cell * 0.45, h: cell * 2.28 });
    if (t >= 3) pieces.push({ id: 'house', x: cx + cell * 1.0, feet: feet - cell * 1.0, h: cell * 1.56 });
    if (t >= 4) pieces.push({ id: 'watchtower', x: cx - cell * 1.1, feet: feet - cell * 0.9, h: cell * 2.04 });
  }
  pieces.sort((a, b) => a.feet - b.feet);
  for (const pc of pieces) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(pc.x, pc.feet - 1, pc.h * 0.32, pc.h * 0.09, 0, 0, Math.PI * 2);
    g.fill();
    if (!drawSprite(g, pc.id, pc.x, pc.feet, pc.h)) {
      g.fillStyle = '#6a4a30';
      g.fillRect(pc.x - pc.h * 0.25, pc.feet - pc.h * 0.6, pc.h * 0.5, pc.h * 0.6);
    }
  }
}
/** A province's landmark beside its settlement. */
function drawLandmark(g: CanvasRenderingContext2D, p: ProvinceView, cx: number, cy: number, cell: number): void {
  const x = cx + cell * 1.9;
  const feet = cy - cell * 0.7;
  switch (p.landmark) {
    case 'Shrine':
      drawSprite(g, 'altar', x, feet + cell * 0.3, cell * 1.1);
      break;
    case 'Mine':
      drawSprite(g, 'mine', x, feet + cell * 0.3, cell * 1.1);
      break;
    case 'Ruins':
      drawProp(g, 'places', 4, x, feet + cell * 0.4, cell * 1.4);
      break;
    case 'Crossroads':
      drawSprite(g, 'sign', x, feet + cell * 0.2, cell * 0.9);
      break;
    case 'Harbour': {
      // a jetty out into the water
      g.fillStyle = '#7a5a36';
      g.fillRect(Math.round(x - cell * 0.15), Math.round(feet - cell * 0.1), Math.max(2, cell * 0.3), Math.max(3, cell * 1.4));
      g.fillStyle = '#9a7a4e';
      for (let i = 0; i < 4; i++) g.fillRect(Math.round(x - cell * 0.15), Math.round(feet - cell * 0.1 + i * cell * 0.35), Math.max(2, cell * 0.3), Math.max(1, cell * 0.08));
      break;
    }
    default:
      break;
  }
}
/** A flag: a pole with a pennant in a colour, its foot at (x, y), `h` tall. */
export function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string, big = false): void {
  const pole = Math.max(1, h * 0.08);
  g.fillStyle = '#3a2a1a';
  g.fillRect(Math.round(x), Math.round(y - h), Math.max(1, Math.round(pole)), Math.round(h));
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = Math.max(0.6, h * 0.05);
  const fw = h * (big ? 0.7 : 0.55);
  const fh = h * (big ? 0.4 : 0.32);
  g.beginPath();
  g.moveTo(x + pole, y - h);
  g.lineTo(x + pole + fw, y - h + fh * 0.5);
  g.lineTo(x + pole, y - h + fh);
  g.closePath();
  g.fill();
  g.stroke();
}
/** A garrison's badge: a small shield in the holder's colour with the count. */
function drawGarrison(g: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string, n: number, font: string): void {
  g.fillStyle = '#1a1410';
  g.beginPath();
  g.moveTo(x - size * 0.5, y - size * 0.55);
  g.lineTo(x + size * 0.5, y - size * 0.55);
  g.lineTo(x + size * 0.5, y + size * 0.1);
  g.lineTo(x, y + size * 0.55);
  g.lineTo(x - size * 0.5, y + size * 0.1);
  g.closePath();
  g.fill();
  g.fillStyle = colour;
  g.beginPath();
  g.moveTo(x - size * 0.38, y - size * 0.42);
  g.lineTo(x + size * 0.38, y - size * 0.42);
  g.lineTo(x + size * 0.38, y + size * 0.05);
  g.lineTo(x, y + size * 0.4);
  g.lineTo(x - size * 0.38, y + size * 0.05);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  g.font = `bold ${Math.max(7, size * 0.7)}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), x, y - size * 0.05);
}
/** Text with a dark edge, so it reads on any ground. */
export function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, font: string, colour = '#fff', align: CanvasTextAlign = 'center'): void {
  g.font = `bold ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineWidth = Math.max(2, size * 0.28);
  g.strokeStyle = 'rgba(10, 8, 6, 0.85)';
  g.lineJoin = 'round';
  g.strokeText(text, x, y);
  g.fillStyle = colour;
  g.fillText(text, x, y);
}

/** An army on the map: its general under its banner (the town's a figure of the town, a power's a captain of its people). */
function drawArmy(g: CanvasRenderingContext2D, x: number, y: number, cell: number, colour: string, figure: () => boolean, picked: boolean, font: string, n?: number): void {
  const h = cell * 1.6;
  if (picked) {
    g.strokeStyle = '#fff';
    g.lineWidth = Math.max(1.5, cell * 0.12);
    g.beginPath();
    g.ellipse(x, y, cell * 0.9, cell * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(x, y, cell * 0.55, cell * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  if (!figure()) {
    g.fillStyle = colour;
    g.beginPath();
    g.arc(x, y - h * 0.35, h * 0.28, 0, Math.PI * 2);
    g.fill();
  }
  drawFlag(g, x + cell * 0.5, y + cell * 0.05, h * 1.1, colour, true);
  if (n !== undefined) label(g, String(n), x + cell * 0.95, y - h * 0.9, Math.max(8, cell * 0.75), font);
}

/** Everything that moves or changes over the terrain and holdings. */
export function drawMarks(g: CanvasRenderingContext2D, w: WarView, cell: number, ctx: MarkContext): void {
  const px = (p: ProvinceView) => [(p.x + 0.5) * cell, (p.y + 0.5) * cell] as const;
  const smallFont = Math.max(8, cell * 0.9);
  // the settlements and landmarks, back to front
  const byY = [...w.provinces].sort((a, b) => a.y - b.y);
  for (const p of byY) {
    const [x, y] = px(p);
    const lair = p.landmark === 'Lair' && p.holder === null;
    drawLandmark(g, p, x, y, cell);
    drawSettlement(g, p, originOf(p.holder, ctx.townOrigin), x, y, cell, lair);
    const col = realmColour(w, p.holder);
    if (col) drawFlag(g, x + cell * 1.1, y + cell * 0.5, cell * (p.capitalOf ? 2.0 : 1.3), col, !!p.capitalOf);
    if (p.garrison) drawGarrison(g, x - cell * 1.3, y - cell * 0.2, cell * 0.95, col ?? '#888', p.garrison, ctx.font);
    if (p.bare) {
      g.fillStyle = '#ff5a3a';
      g.beginPath();
      g.arc(x - cell * 1.1, y - cell * 1.1, Math.max(2, cell * 0.22), 0, Math.PI * 2);
      g.fill();
    }
  }
  // the rival realms' armies on the march
  for (const ra of w.rivalArmies) {
    const [fx, fy] = px(w.provinces[ra.from]);
    const [tx, ty] = px(w.provinces[ra.to]);
    const col = realmColour(w, ra.realm) ?? '#f00';
    g.strokeStyle = col;
    g.lineWidth = Math.max(1, cell * 0.12);
    g.setLineDash([cell * 0.4, cell * 0.4]);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(tx, ty);
    g.stroke();
    g.setLineDash([]);
    const origin = originOf(ra.realm, ctx.townOrigin) ?? 'brotherhood';
    drawArmy(g, (fx + tx) / 2, (fy + ty) / 2, cell, col, () => drawCaptain(g, origin, 0, tx < fx ? 'left' : 'right', (fx + tx) / 2, (fy + ty) / 2, cell * 1.6), false, ctx.font, ra.strength);
  }
  // the town's armies, with their way
  for (const a of w.armies) {
    const from = w.provinces[a.at];
    const to = a.going === null ? null : w.provinces[a.going];
    let [x, y] = px(from);
    if (to) {
      const [tx, ty] = px(to);
      g.strokeStyle = '#fff';
      g.lineWidth = Math.max(1, cell * 0.12);
      g.setLineDash([cell * 0.4, cell * 0.4]);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(tx, ty);
      for (const q of a.path) {
        const [qx, qy] = px(w.provinces[q]);
        g.lineTo(qx, qy);
      }
      g.stroke();
      g.setLineDash([]);
      x = (x + tx) / 2;
      y = (y + ty) / 2;
    } else {
      x -= cell * 1.2;
      y += cell * 0.9;
    }
    const general = heroOf(w, a, ctx.people);
    const facing = to && to.x < from.x ? 'left' : 'right';
    drawArmy(g, x, y, cell, '#ffd24a', () => (general ? drawWho(g, hkWhoOf(general), facing, x, y, cell * 1.6) : drawCaptain(g, ctx.townOrigin, 0, facing, x, y, cell * 1.6)), a.id === ctx.picked, ctx.font);
  }
  // names: the capitals', the selected province's
  for (const p of w.provinces) {
    if (!p.capitalOf && p.id !== ctx.selected) continue;
    const [x, y] = px(p);
    label(g, p.name, x, y + cell * 1.9, p.id === ctx.selected ? smallFont * 1.15 : smallFont, ctx.font, p.id === ctx.selected ? '#fff' : '#f4e8c8');
  }
}
/** The general of an army: the townsperson leading its general's squad. */
export function heroOf(w: WarView, a: ArmyView, people: PersonView[]): PersonView | null {
  const q = w.squads.find((s) => s.id === a.general);
  return q ? people.find((p) => p.id === q.hero) ?? null : null;
}
/** A small compass rose in a corner. */
export function drawCompass(g: CanvasRenderingContext2D, x: number, y: number, r: number, font: string): void {
  g.save();
  g.globalAlpha = 0.85;
  g.fillStyle = 'rgba(20,16,12,0.5)';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#f4e8c8';
  g.lineWidth = Math.max(1, r * 0.08);
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#f4e8c8';
  g.beginPath();
  g.moveTo(x, y - r * 0.75);
  g.lineTo(x + r * 0.2, y);
  g.lineTo(x, y + r * 0.75);
  g.lineTo(x - r * 0.2, y);
  g.closePath();
  g.fill();
  g.fillStyle = '#d04a4a';
  g.beginPath();
  g.moveTo(x, y - r * 0.75);
  g.lineTo(x + r * 0.2, y);
  g.lineTo(x - r * 0.2, y);
  g.closePath();
  g.fill();
  label(g, 'N', x, y - r * 1.25, r * 0.6, font);
  g.restore();
}
export { hashAt };
