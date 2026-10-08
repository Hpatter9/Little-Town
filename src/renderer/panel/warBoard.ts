// The battle for a province on the War tab (sim/conquest/battles.ts), drawn at the screen's own resolution: the
// land's textured ground with a beaten track to the gate, the attackers' camp at the west edge, the fort's wall down
// the wall line (the Village pack's palisade or the dungeon pack's stonework, breached as it falls) with the
// settlement's houses behind it (or a lair's cave), the land's trees and rocks about the field, and every squad as
// its hero's figure (a townsperson as the map dresses them; a power's captain; the lair's master) with its health,
// its troop count and its formation's pips, the latest harm as numbers over the struck. A tapped squad opens its
// formation card: the hero and every troop as figures in their three rows.

import { BOARD_H, BOARD_W, ROW_OF, SQUAD_SLOTS, TROOP_BY_ID, WALL_X } from '../../shared/data/troops';
import type { WorldCell } from '../../shared/data/conquest';
import type { BattleView, SquadView } from '../../shared/sim/conquest/warView';
import type { PersonView } from '../../shared/sim/snapshot';
import { hkWhoOf } from '../art/hkFolk';
import { drawBeast, drawCampfire, drawCaptain, drawCobble, drawPack, drawProp, drawSprite, drawStone, drawTroop, drawWho, LAIR_MASTER, STONE_GATE, STONE_WALL, type Facing, type WarPropSet } from '../art/warSprites';
import { askGroundDetail, drawProps, hashAt, LAND_LOOK, noise, paintDetail, paintGround, placeProps, propsReady } from '../art/warTerrain';
import { devicePixels, label, originOf } from './warMap';

type BattleSquad = BattleView['squads'][number];

/* ------------------------------------------------------------ the field, painted once a battle */

interface Field {
  key: string;
  canvas: HTMLCanvasElement;
}
let field: Field | null = null;

/** The ground of a battle: the land, a track to the gate, the ground of the settlement east of the wall. */
export function boardGround(b: BattleView, cell: number, lair: boolean): HTMLCanvasElement {
  const land = (LAND_LOOK[b.land as WorldCell] ? b.land : 'forest') as WorldCell;
  const sets = new Set<WarPropSet>(LAND_LOOK[land].props.map((p) => p.set));
  sets.add('places');
  const key = `${b.id}|${cell}|${land}|${askGroundDetail() ? 1 : 0}${propsReady(sets) ? 1 : 0}|${lair ? 1 : 0}|${b.tier}`;
  if (field && field.key === key) return field.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = BOARD_W * cell;
  canvas.height = BOARD_H * cell;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const seed = 7000 + b.id * 13;
  const at = () => land;
  paintGround(g, { w: canvas.width, h: canvas.height, cell, landAt: at, seed, block: cell >= 60 ? 2 : 1 });
  // the track to the gate: packed earth wandering along the middle rows, its edges ragged, two ruts down it
  const trackTone = land === 'tundra' ? 'rgba(170, 150, 120, 0.4)' : land === 'desert' || land === 'steppe' ? 'rgba(150, 120, 80, 0.3)' : 'rgba(140, 108, 70, 0.42)';
  const rutTone = land === 'tundra' ? 'rgba(120, 104, 80, 0.3)' : 'rgba(90, 66, 40, 0.3)';
  const mid = (BOARD_H / 2) * cell;
  const gateX = WALL_X * cell;
  const trackAt = (x: number) => mid + (noise(seed + 61, x, 0, cell * 4) - 0.5) * cell * 1.4 * Math.min(1, (gateX - x) / (cell * 2.5)) + (noise(seed + 65, x, 3, cell * 1.2) - 0.5) * cell * 0.3;
  for (let x = 0; x < gateX + cell * 0.5; x += 2) {
    const c = trackAt(x);
    const half = cell * 0.36 + (noise(seed + 62, x, 7, cell * 0.8) - 0.5) * cell * 0.3;
    g.fillStyle = trackTone;
    g.fillRect(x, Math.round(c - half), 2, Math.round(half * 2));
    g.fillStyle = rutTone;
    g.fillRect(x, Math.round(c - cell * 0.14), 2, Math.max(1, Math.round(cell * 0.03)));
    g.fillRect(x, Math.round(c + cell * 0.11), 2, Math.max(1, Math.round(cell * 0.03)));
  }
  // east of the wall: a settlement's trodden ground and cobbles, or a lair's bare rock
  if (lair) {
    g.fillStyle = 'rgba(70, 60, 60, 0.42)';
    g.fillRect(gateX, 0, canvas.width - gateX, canvas.height);
  } else if (b.tier >= 0) {
    g.fillStyle = 'rgba(150, 120, 85, 0.35)';
    for (let y = 0; y < canvas.height; y += 2) {
      const edge = gateX + (noise(seed + 66, 0, y, cell * 1.3) - 0.5) * cell * 0.8;
      g.fillRect(Math.round(edge), y, canvas.width - Math.round(edge), 2);
    }
    g.globalAlpha = 0.55;
    for (let r = 0; r < BOARD_H; r++) for (let c = WALL_X; c < BOARD_W; c++) if (hashAt(seed + 63, c, r) < 0.55) drawCobble(g, Math.floor(hashAt(seed + 64, c, r) * 4), c * cell, r * cell, cell);
    g.globalAlpha = 1;
  }
  paintDetail(g, { cols: BOARD_W, rows: BOARD_H, cell, seed, landAt: (cx) => (cx >= WALL_X ? null : land) });
  // a faint grid, so the pieces' places read
  g.strokeStyle = 'rgba(0, 0, 0, 0.13)';
  g.lineWidth = Math.max(1, cell * 0.02);
  for (let x = 0; x <= BOARD_W; x++) {
    g.beginPath();
    g.moveTo(x * cell + 0.5, 0);
    g.lineTo(x * cell + 0.5, canvas.height);
    g.stroke();
  }
  for (let y = 0; y <= BOARD_H; y++) {
    g.beginPath();
    g.moveTo(0, y * cell + 0.5);
    g.lineTo(canvas.width, y * cell + 0.5);
    g.stroke();
  }
  // the wild things about the field: never on the track, in the camp or the settlement
  const keep = (cx: number, cy: number) => cy === 3 || cy === 4 || cx === 0 || cx >= WALL_X - 1;
  drawProps(g, placeProps({ cols: BOARD_W, rows: BOARD_H, cell, seed, landAt: at, keep, scale: 0.62, densityMult: 0.6 }));
  // the attackers' camp
  drawProp(g, 'places', 11, cell * 0.62, cell * 1.4, cell * 0.8);
  drawProp(g, 'places', 13, cell * 0.62, cell * 7.7, cell * 0.8);
  drawCampfire(g, cell * 0.5, cell * 5.7, cell * 0.6);
  // the lair's den, or the settlement behind the wall
  if (lair) {
    drawProp(g, 'places', 1, cell * 10.8, cell * 5.0, cell * 1.8);
    drawProp(g, 'places', 3, cell * 9.9, cell * 6.8, cell * 0.7);
    drawProp(g, 'places', 5, cell * 10.3, cell * 2.1, cell * 0.5);
    drawProp(g, 'places', 6, cell * 11.2, cell * 1.6, cell * 0.6);
  } else {
    const t = b.tier;
    if (t >= 3) drawSprite(g, t >= 4 ? 'castle' : 'keep', cell * 10.8, cell * 4.9, cell * 2.2);
    drawSprite(g, 'house', cell * 11.2, cell * 1.9, cell * 1.3);
    if (t >= 1) drawSprite(g, 'longhouse', cell * 11.1, cell * 7.5, cell * 1.4);
    if (t >= 2) drawSprite(g, 'gable', cell * 10.0, cell * 1.6, cell * 1.6);
    if (t >= 2 && t < 3) drawSprite(g, 'house', cell * 10.5, cell * 6.5, cell * 1.2);
    if (b.fort >= 1) drawSprite(g, 'watchtower', cell * 9.9, cell * 7.7, cell * 1.5);
  }
  field = { key, canvas };
  return canvas;
}

/** The fort's wall down the wall line, whole or breached (the share of it standing), with its gate across the track. */
function drawWall(g: CanvasRenderingContext2D, b: BattleView, cell: number): void {
  if (!b.wallsMax) return;
  const x = WALL_X * cell;
  const share = b.walls / b.wallsMax;
  const standing = Math.round(share * BOARD_H);
  // the rows breached first are the middle ones (the gate's), then outward
  const order = [3, 4, 2, 5, 1, 6, 0, 7];
  const down = new Set(order.slice(0, BOARD_H - standing));
  const palisade = b.fort <= 1;
  for (let r = 0; r < BOARD_H; r++) {
    if (down.has(r)) {
      // rubble
      g.fillStyle = palisade ? 'rgba(90, 64, 40, 0.8)' : 'rgba(110, 108, 100, 0.85)';
      for (let i = 0; i < 4; i++) {
        const rx = x + (hashAt(b.id, r, i) - 0.5) * cell * 0.7;
        const ry = r * cell + (0.2 + hashAt(b.id + 1, r, i) * 0.6) * cell;
        g.beginPath();
        g.ellipse(rx, ry, cell * (0.08 + hashAt(b.id + 2, r, i) * 0.1), cell * 0.07, 0, 0, Math.PI * 2);
        g.fill();
      }
      continue;
    }
    if (r === 3 || r === 4) {
      if (r === 3) {
        if (!drawStone(g, STONE_GATE, x - cell * 0.6, r * cell + cell * 0.25, cell * 1.2, cell * 1.5)) {
          g.fillStyle = '#5a4a3a';
          g.fillRect(x - cell * 0.3, r * cell, cell * 0.6, cell * 2);
        }
      }
      continue;
    }
    if (palisade) {
      if (!drawSprite(g, r % 2 ? 'palisadeA' : 'palisadeB', x, (r + 1) * cell, cell * 1.05)) {
        g.fillStyle = '#7a5a36';
        g.fillRect(x - cell * 0.2, r * cell, cell * 0.4, cell);
      }
    } else if (!drawStone(g, STONE_WALL, x - cell * 0.5, r * cell - cell * 0.5, cell, cell * 1.5)) {
      g.fillStyle = '#8a8a82';
      g.fillRect(x - cell * 0.3, r * cell, cell * 0.6, cell);
    }
  }
}

/* ------------------------------------------------------------ the squads */

/** The figure that stands for a squad: a townsperson, a power's captain, the lair's master or its pack. */
function drawSquadFigure(g: CanvasRenderingContext2D, q: BattleSquad, b: BattleView, people: PersonView[], townOrigin: string, facing: Facing, cx: number, feetY: number, h: number): boolean {
  if (q.side === 'town') {
    const p = q.person === null ? null : people.find((x) => x.id === q.person);
    if (p) return drawWho(g, hkWhoOf(p), facing, cx, feetY, h);
    return drawCaptain(g, townOrigin, q.id, facing, cx, feetY, h);
  }
  if (b.holder === null) {
    // a lair: its master, and the pack
    return q.hero && /master/i.test(q.hero) ? drawPack(g, LAIR_MASTER, facing, cx, feetY, h * 1.15) : drawBeast(g, 'bear', q.id % 2, facing, cx, feetY, h * 0.9);
  }
  return drawCaptain(g, originOf(b.holder, townOrigin) ?? 'brotherhood', q.id, facing, cx, feetY, h);
}

/** Draw the whole board into a canvas `cell` device px a cell; returns the squads' hit boxes (in cells). */
export function paintBoard(g: CanvasRenderingContext2D, b: BattleView, o: { cell: number; people: PersonView[]; townOrigin: string; font: string; picked: number | null }): { id: number; x: number; y: number }[] {
  const { cell, font } = o;
  const lair = b.holder === null;
  g.drawImage(boardGround(b, cell, lair), 0, 0);
  drawWall(g, b, cell);
  const latest = b.events.slice(-4);
  const struck = new Set(latest.filter((e) => e.kind === 'clash' && b.tick - e.tick < 25).flatMap((e) => [e.to, e.from]));
  const squads = [...b.squads].sort((a, c) => a.y - c.y);
  const hits: { id: number; x: number; y: number }[] = [];
  for (const q of squads) {
    const x = (q.x + 0.5) * cell;
    const feet = (q.y + 0.86) * cell;
    const colour = q.side === 'town' ? '#ffd24a' : '#d04a4a';
    hits.push({ id: q.id, x: q.x, y: q.y });
    g.save();
    if (q.out) g.globalAlpha = 0.45;
    // the ground ring in the side's colour, lit for whose beat it is and for the picked squad
    const mine = q.side === b.side && !q.out;
    g.strokeStyle = o.picked === q.id ? '#ffffff' : colour;
    g.lineWidth = Math.max(1, cell * (o.picked === q.id ? 0.07 : mine ? 0.05 : 0.035));
    g.beginPath();
    g.ellipse(x, feet - cell * 0.03, cell * 0.36, cell * 0.16, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.ellipse(x, feet - cell * 0.03, cell * 0.3, cell * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    // a flash under the struck
    if (struck.has(q.id) && !q.out) {
      g.fillStyle = 'rgba(255, 240, 200, 0.35)';
      g.beginPath();
      g.ellipse(x, feet - cell * 0.3, cell * 0.42, cell * 0.42, 0, 0, Math.PI * 2);
      g.fill();
    }
    const facing: Facing = q.side === 'town' ? 'right' : 'left';
    if (!drawSquadFigure(g, q, b, o.people, o.townOrigin, facing, x, feet - cell * 0.02, cell * 0.9)) {
      g.fillStyle = colour;
      g.fillRect(x - cell * 0.2, feet - cell * 0.7, cell * 0.4, cell * 0.65);
    }
    if (q.out) {
      g.globalAlpha = 1;
      g.strokeStyle = q.out === 'fallen' ? '#ff6a4a' : '#eee';
      g.lineWidth = Math.max(1.5, cell * 0.05);
      g.beginPath();
      g.moveTo(x - cell * 0.22, feet - cell * 0.62);
      g.lineTo(x + cell * 0.22, feet - cell * 0.18);
      g.moveTo(x + cell * 0.22, feet - cell * 0.62);
      g.lineTo(x - cell * 0.22, feet - cell * 0.18);
      g.stroke();
    } else {
      // the hero's health over the head
      const bw = cell * 0.7;
      const by = q.y * cell + cell * 0.06;
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(x - bw / 2, by, bw, cell * 0.08);
      g.fillStyle = q.heroShare > 0.5 ? '#3fd05a' : q.heroShare > 0.25 ? '#e0b040' : '#e05040';
      g.fillRect(x - bw / 2, by, bw * q.heroShare, cell * 0.08);
      // the formation's pips at the foot, and the count
      const pip = Math.max(2, cell * 0.07);
      for (let i = 0; i < SQUAD_SLOTS; i++) {
        const t = q.troops[i];
        const px = x - cell * 0.46 + (i % 3) * (pip + 1.5);
        const py = feet + cell * 0.04 - Math.floor(i / 3) * (pip + 1.5) - pip;
        g.fillStyle = t ? (t.share > 0.5 ? '#1a1a1a' : '#7a2a2a') : 'rgba(0,0,0,0.18)';
        g.fillRect(px, py, pip, pip);
      }
      const n = q.troops.filter((t) => t).length;
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.beginPath();
      g.arc(x + cell * 0.36, feet - cell * 0.02, cell * 0.14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `bold ${Math.max(7, cell * 0.2)}px ${font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), x + cell * 0.36, feet - cell * 0.01);
    }
    g.restore();
  }
  // the latest blows as numbers rising over the struck
  for (const e of latest) {
    if (e.kind !== 'clash' || e.to === null) continue;
    const age = Math.min(1, (b.tick - e.tick) / 30);
    const to = b.squads.find((q) => q.id === e.to);
    const from = b.squads.find((q) => q.id === e.from);
    if (to && e.harm) label(g, `-${e.harm}`, (to.x + 0.5) * cell, (to.y + 0.1) * cell - age * cell * 0.6, Math.max(9, cell * 0.3), font, '#fff');
    if (from && e.back) label(g, `-${e.back}`, (from.x + 0.5) * cell, (from.y + 0.1) * cell - age * cell * 0.5, Math.max(8, cell * 0.24), font, '#ffb080');
  }
  // the end
  if (b.done) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, BOARD_H * cell * 0.38, BOARD_W * cell, BOARD_H * cell * 0.24);
    label(g, b.done === 'won' ? `Victory at ${b.province}!` : `Beaten before ${b.province}`, (BOARD_W * cell) / 2, (BOARD_H * cell) / 2, Math.max(14, cell * 0.6), font, b.done === 'won' ? '#ffd24a' : '#ff8a6a');
  }
  return hits;
}

/* ------------------------------------------------------------ the formation card */

/** A squad's formation as figures: the hero at the left, the three rows of troops (the front row nearest) at the
 *  right, each troop's health under it. Works from a battle's squad or a barracks' (no health then). */
export function paintFormation(g: CanvasRenderingContext2D, o: { w: number; h: number; land: string; slots: ({ troop: string; share: number } | null)[]; hero: () => boolean; side: 'town' | 'foe'; font: string; heroName: string; heroShare: number | null; seed: number }): void {
  const { w, h } = o;
  const land = (LAND_LOOK[o.land as WorldCell] ? o.land : 'forest') as WorldCell;
  const cell = Math.round(h / 3);
  paintGround(g, { w, h, cell, landAt: () => land, seed: o.seed, block: 1 });
  paintDetail(g, { cols: Math.ceil(w / cell), rows: 3, cell, seed: o.seed, landAt: () => land });
  // a darker strip under the formation
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, h * 0.82, w, h * 0.18);
  const facing: Facing = 'down';
  // the hero
  const hx = w * 0.15;
  const hFeet = h * 0.86;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(hx, hFeet, h * 0.14, h * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  if (!o.hero()) {
    g.fillStyle = o.side === 'town' ? '#ffd24a' : '#d04a4a';
    g.fillRect(hx - h * 0.1, hFeet - h * 0.5, h * 0.2, h * 0.5);
  }
  label(g, o.heroName, hx, h * 0.95, Math.max(9, h * 0.085), o.font);
  if (o.heroShare !== null) {
    const bw = h * 0.36;
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(hx - bw / 2, h * 0.3, bw, h * 0.04);
    g.fillStyle = o.heroShare > 0.5 ? '#3fd05a' : o.heroShare > 0.25 ? '#e0b040' : '#e05040';
    g.fillRect(hx - bw / 2, h * 0.3, bw * o.heroShare, h * 0.04);
  }
  // the rows: back at the top, front at the foot
  const x0 = w * 0.38;
  const colW = (w - x0) / 3;
  const rowFeet = [h * 0.9, h * 0.68, h * 0.46]; // (front, middle, back)
  const fig = h * 0.3;
  for (let row = 2; row >= 0; row--)
    for (let i = 0; i < SQUAD_SLOTS; i++) {
      if (ROW_OF(i) !== row) continue;
      const col = i % 3;
      const x = x0 + colW * (col + 0.5);
      const feet = rowFeet[row];
      const t = o.slots[i];
      // the place
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x, feet, fig * 0.42, fig * 0.17, 0, 0, Math.PI * 2);
      g.stroke();
      if (!t) continue;
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath();
      g.ellipse(x, feet, fig * 0.36, fig * 0.14, 0, 0, Math.PI * 2);
      g.fill();
      if (!drawTroop(g, t.troop, i, facing, x, feet, fig)) {
        g.fillStyle = '#888';
        g.fillRect(x - fig * 0.18, feet - fig * 0.8, fig * 0.36, fig * 0.8);
      }
      if (t.share < 1) {
        const bw = fig * 0.7;
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(x - bw / 2, feet + fig * 0.1, bw, fig * 0.07);
        g.fillStyle = t.share > 0.5 ? '#3fd05a' : t.share > 0.25 ? '#e0b040' : '#e05040';
        g.fillRect(x - bw / 2, feet + fig * 0.1, bw * t.share, fig * 0.07);
      }
    }
}

/** Which troops a squad holds, told: "3 spearmen, 2 archers (1 hurt)". */
export function troopsLine(slots: ({ troop: string; share: number } | null)[]): string {
  const counts = new Map<string, { n: number; hurt: number }>();
  for (const t of slots) {
    if (!t) continue;
    const c = counts.get(t.troop) ?? { n: 0, hurt: 0 };
    c.n++;
    if (t.share < 0.6) c.hurt++;
    counts.set(t.troop, c);
  }
  if (!counts.size) return 'No troops';
  return [...counts.entries()].map(([id, c]) => `${c.n} ${(TROOP_BY_ID[id]?.name ?? id.replace(/_/g, ' ')).toLowerCase()}${c.hurt ? ` (${c.hurt} hurt)` : ''}`).join(', ');
}

/** The slots of a barracks squad as the formation card takes them. */
export const slotsOf = (q: SquadView) => q.slots.map((t) => (t ? { troop: t, share: 1 } : null));

export { devicePixels };
