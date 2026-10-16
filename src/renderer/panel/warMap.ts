// The War tab's map of the realm, drawn as one island in the sea (warIsland.ts: the projection) at the screen's own
// resolution: the lands' textured ground (the sea by its depth with foam at the shore and the Seabed pack's weed and
// shells in the shallows, the mountains in relief), a sparse scatter of the lands' trees and rocks, the realms'
// holdings as a tint with a coloured band along their borders; over it the roads between neighbours, one mark a place
// (its holder's colour under the one pack building that stands for it, a seat's banner, a red ring on a place under
// attack), the hosts on the march as arrowheads, and the names, placed so none overlaps another. The terrain and the
// holdings are painted once each and kept; the marks are drawn on every redraw.

import { CELL_CODES, type WorldCell } from '../../shared/data/conquest';
import { FACTION_BY_ID } from '../../shared/data/factions';
import { ownerAt, type MarchView, type ProvinceView, type WarView } from '../../shared/sim/war/view';
import { drawProp, drawSprite, REALM_COLOURS, type SpriteId, type WarPropSet } from '../art/warSprites';
import { askGroundDetail, drawProps, hashAt, LAND_LOOK, paintDetail, paintGround, placeProps, propsReady } from '../art/warTerrain';
import { MARK, mapLabels, marchAt, placeKind, type PlaceKind } from './warIsland';

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
  sets.add('sea');
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
  drawProps(g, placeProps({ cols: w.side, rows: w.side, cell, seed, landAt: land, keep, scale: 1, densityMult: 0.5 }));
  // the bottom seen through the shallows: the Seabed pack's weed, shells and stones, faint under the water
  const sea = FRAMES_SEA();
  for (let cy = 0; cy < w.side; cy++)
    for (let cx = 0; cx < w.side; cx++) {
      if (land(cx, cy) !== 'water' || d[cy * w.side + cx] > 2 || hashAt(seed + 301, cx, cy) > 0.16) continue;
      const f = sea[Math.floor(hashAt(seed + 302, cx, cy) * sea.length)];
      drawProp(g, 'sea', f, (cx + 0.5) * cell, (cy + 0.9) * cell, cell * 0.9, 0.45);
    }
  terrain = { cells: w.cells, cell, ready, canvas };
  return canvas;
}
/** The Seabed pack's frames that lie on the bottom (its first two, the drowned statues, left out). */
const FRAMES_SEA = () => [2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 30, 31, 32];
/** The cell size (device px) the map is drawn at: fitted to the panel's width at the screen's resolution. */
export function terrainCell(w: WarView): number {
  // (fitted to the width, and on a phone turned sideways to the menu's own height too, so the whole island is in view
  // at once; upright it takes the width)
  const body = document.getElementById('body');
  // (less the sub-tabs' row, which stays at the top over it)
  const tabs = body?.querySelector('.menu-tabs')?.getBoundingClientRect().height ?? 0;
  const tall = (body && body.clientHeight > 0 ? body.clientHeight : window.innerHeight) - tabs;
  const width = Math.max(220, Math.min((body?.clientWidth ?? 360) - 28, tall - 16));
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
  /** The town's people's origin (its settlements' look), the province picked, the menus' font. */
  townOrigin: string;
  selected: number | null;
  font: string;
  /** Device px a CSS px (labels never under 11 CSS px), and the part of the map in view (px, after the pan). */
  dpr: number;
  view: { x: number; y: number; w: number; h: number };
}

/** The people a holder is of: the town's own, a power's, or null for free land. */
export function originOf(holder: string | null, townOrigin: string): string | null {
  if (holder === null) return null;
  if (holder === 'town') return townOrigin;
  return FACTION_BY_ID[holder]?.origin ?? 'brotherhood';
}

/** The one building that stands for a place: by its holder's people and its tier (a lair's cave on free ground). */
function placeSprite(g: CanvasRenderingContext2D, p: ProvinceView, kind: PlaceKind, origin: string | null, x: number, feet: number, h: number): void {
  if (kind === 'free' && p.landmark === 'Lair') {
    drawProp(g, 'places', 1, x, feet, h * 1.1);
    return;
  }
  const big = kind === 'town' || kind === 'seat';
  const id: SpriteId = origin === 'nomads' ? (big ? 'tent' : 'yurt') : origin === 'dwarves' ? (big ? 'caveGate' : 'mine') : big ? (p.tierN >= 4 ? 'castle' : 'keep') : p.tierN >= 2 ? 'gable' : p.tierN >= 1 ? 'longhouse' : 'house';
  if (!drawSprite(g, id, x, feet, h, kind === 'free' ? 0.85 : 1)) {
    g.fillStyle = '#6a4a30';
    g.fillRect(x - h * 0.25, feet - h * 0.6, h * 0.5, h * 0.6);
  }
}
/** A flag: a pole with a pennant in a colour, its foot at (x, y), `h` tall. */
export function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, h: number, colour: string): void {
  const pole = Math.max(1, h * 0.08);
  g.fillStyle = '#3a2a1a';
  g.fillRect(Math.round(x), Math.round(y - h), Math.max(1, Math.round(pole)), Math.round(h));
  g.fillStyle = colour;
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = Math.max(0.6, h * 0.05);
  g.beginPath();
  g.moveTo(x + pole, y - h);
  g.lineTo(x + pole + h * 0.62, y - h + h * 0.18);
  g.lineTo(x + pole, y - h + h * 0.36);
  g.closePath();
  g.fill();
  g.stroke();
}
/** A garrison's badge: a small shield in the holder's colour with the count. */
function drawGarrison(g: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string, n: number, font: string): void {
  const shield = (k: number) => {
    g.beginPath();
    g.moveTo(x - size * k, y - size * k * 1.1);
    g.lineTo(x + size * k, y - size * k * 1.1);
    g.lineTo(x + size * k, y + size * k * 0.2);
    g.lineTo(x, y + size * k * 1.1);
    g.lineTo(x - size * k, y + size * k * 0.2);
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#1a1410';
  shield(0.5);
  g.fillStyle = colour;
  shield(0.38);
  label(g, String(n), x, y - size * 0.05, Math.max(7, size * 0.62), font);
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

/** The colour a march is drawn in: the town's war party gold, a power's host its banner's. */
export const marchColour = (w: WarView, ra: MarchView) => (ra.kind === 'town' ? '#ffd24a' : realmColour(w, ra.realm) ?? '#e04040');

/** Everything over the terrain and the holdings: the roads, the hosts on the march, one mark a place (its holder's
 *  colour under the one building that stands for it, a seat's banner, a ring on a place under attack), the labels. */
export function drawMarks(g: CanvasRenderingContext2D, w: WarView, cell: number, ctx: MarkContext): void {
  const u = ctx.dpr;
  const at = (p: ProvinceView) => [(p.x + 0.5) * cell, (p.y + 0.5) * cell] as const;
  // ---- the roads between neighbours (a sea lane dotted where the way crosses water)
  g.lineCap = 'round';
  for (const p of w.provinces)
    for (const q of p.neighbours) {
      if (q < p.id) continue;
      const [ax, ay] = at(p);
      const [bx, by] = at(w.provinces[q]);
      const sea = landAt(w, Math.floor((p.x + w.provinces[q].x + 1) / 2), Math.floor((p.y + w.provinces[q].y + 1) / 2)) === 'water';
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      if (sea) {
        g.setLineDash([2 * u, 3 * u]);
        g.strokeStyle = 'rgba(235, 245, 250, 0.75)';
        g.lineWidth = 1.2 * u;
        g.stroke();
      } else {
        g.setLineDash([]);
        g.strokeStyle = 'rgba(40, 28, 18, 0.45)';
        g.lineWidth = 2.6 * u;
        g.stroke();
        g.strokeStyle = 'rgba(236, 218, 172, 0.8)';
        g.lineWidth = 1.1 * u;
        g.stroke();
      }
    }
  g.setLineDash([]);
  // ---- the hosts' ways: a dashed line in the host's colour to where it marches (a harvest raid dotted)
  for (const ra of w.rivalArmies) {
    const [fx, fy] = at(w.provinces[ra.from]);
    const [tx, ty] = at(w.provinces[ra.to]);
    g.strokeStyle = marchColour(w, ra);
    g.lineWidth = 1.6 * u;
    g.setLineDash(ra.kind === 'harvest' ? [1.5 * u, 3 * u] : [5 * u, 3 * u]);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(tx, ty);
    g.stroke();
  }
  g.setLineDash([]);
  // ---- the places, back to front
  const attacked = new Set(w.rivalArmies.map((a) => a.to));
  for (const p of [...w.provinces].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const [x, y] = at(p);
    const kind = placeKind(w, p);
    const m = MARK[kind];
    const r = m.r * u;
    const col = realmColour(w, p.holder);
    if (attacked.has(p.id)) {
      // under attack: a red ring, plain to see
      g.strokeStyle = '#ff4a3a';
      g.lineWidth = 2 * u;
      g.beginPath();
      g.arc(x, y, r + 4 * u, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = col ?? 'rgba(30, 24, 18, 0.55)';
    g.strokeStyle = kind === 'town' ? '#ffd24a' : col ? 'rgba(20, 14, 10, 0.85)' : 'rgba(240, 230, 200, 0.7)';
    g.lineWidth = (kind === 'town' ? 2 : 1) * u;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (p.id === ctx.selected) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5 * u;
      g.beginPath();
      g.ellipse(x, y, r + 2.5 * u, (r + 2.5 * u) * 0.62, 0, 0, Math.PI * 2);
      g.stroke();
    }
    placeSprite(g, p, kind, originOf(p.holder, ctx.townOrigin), x, y + r * 0.3, m.h * u);
    if ((kind === 'town' || kind === 'seat') && col) drawFlag(g, x + m.h * u * 0.32, y - m.h * u * 0.55, 10 * u, col);
    if (p.garrison) drawGarrison(g, x - r - 5 * u, y - 2 * u, 9 * u, col ?? '#888', p.garrison, ctx.font);
  }
  // ---- the hosts: an arrowhead in the host's colour, pointing the way it marches
  for (const ra of w.rivalArmies) {
    const { x, y, a } = marchAt(w, ra, cell);
    const s = (ra.kind === 'border' ? 5 : 6) * u;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(s * 1.2, 0);
    g.lineTo(-s * 0.8, s * 0.85);
    g.lineTo(-s * 0.35, 0);
    g.lineTo(-s * 0.8, -s * 0.85);
    g.closePath();
    g.fillStyle = marchColour(w, ra);
    g.strokeStyle = 'rgba(15, 10, 8, 0.9)';
    g.lineWidth = 1.2 * u;
    g.fill();
    g.stroke();
    g.restore();
  }
  // ---- the labels, none over another
  const measure = (text: string, size: number) => {
    g.font = `bold ${size}px ${ctx.font}`;
    return g.measureText(text).width;
  };
  for (const b of mapLabels(w, cell, ctx, measure)) {
    const army = b.id.startsWith('a');
    const p = army ? null : w.provinces[Number(b.id.slice(1))];
    const colour = army ? '#ffe9b0' : p!.id === ctx.selected ? '#ffffff' : p!.id === w.home ? '#ffe28a' : p!.holder ? '#f4e8c8' : '#d6d0c0';
    label(g, b.text, b.x + b.w / 2, b.y + b.h / 2, b.size, ctx.font, colour);
  }
}
