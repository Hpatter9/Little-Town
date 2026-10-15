// Every origin's seat (data/seats.ts), drawn from the map's angle like topDown.ts (a roof plane seen from above over
// a front wall on the footprint's bottom edge), each people's own shape growing grander with its five stages: the
// settlers' moot hall and council spire, the liches' bone altar and black ziggurat, the druids' standing stones and
// world tree, the werewolves' den and howling hall, the machines' core and overmind, the merfolk's tide pool and
// pearl palace, the nomads' yurt and palace, the fae's faerie ring and crystal court, the alchemists' stills and
// philosopher's tower, the knights' motte and citadel. The vampires' and dwarves' seats stand inside their halls, so
// theirs are the throne room's furnishings (`seatInterior`). `window.__seatArt` is for previews.
import { TILE } from '../../shared/constants';
import type { OriginId } from '../../shared/data/origins';
import { SEAT_ERAS } from '../../shared/data/seats';
import { mixHex as mix, paint, registerLamps, type Painter, type PixelArt, type Tone } from './pixelArt';
import { EAVE, frontWall, MATS, roofPlane, WINDOW, type G } from './topDown';

/** Lights of the seats' own: the dead's green fire, the machines' cyan, the fae's pink, the deep's teal, gold. */
const GREEN = '#7cff9a';
const CYAN = '#7ae8f0';
const PINK = '#f8b0ff';
const TEAL = '#5ad0c0';
const GOLD = '#ffd96e';
registerLamps(GREEN, CYAN, PINK, TEAL);

/** How far the picture rises above the footprint, by stage. */
const LIFT = [10, 18, 28, 40, 56] as const;

interface C {
  p: Painter;
  W: number;
  H: number;
  D: number;
  stage: number;
  g: G;
  seed: number;
}

const cache = new Map<string, PixelArt>();

/** The seat's picture, `w` by `d` cells, at a stage (1..5). Its bottom edge is the footprint's. */
export function seatArt(origin: OriginId, stage: number, w: number, d: number, tone: Tone, toneKey: string): PixelArt {
  const key = `${origin}|${stage}|${w}|${d}|${toneKey}`;
  let art = cache.get(key);
  if (art) return art;
  const W = w * TILE + EAVE * 2;
  const D = d * TILE;
  const H = D + LIFT[stage - 1];
  const era = SEAT_ERAS[stage - 1];
  const smoke: { x: number; y: number }[] = [];
  art = paint(W, H, tone, (p) => {
    const g: G = { p, smoke, defId: `seat_${origin}`, w, d, W, H, D, mats: MATS[era], era, shape: 'hall', seed: 17 + stage };
    const c: C = { p, W, H, D, stage, g, seed: stage * 31 };
    (PAINTERS[origin] ?? PAINTERS.settlers)(c);
  });
  art.smoke = smoke;
  cache.set(key, art);
  return art;
}

/** A hold's seat: the throne room's furnishings, stood on the hall's floor (`w` cells wide). */
export function seatInterior(origin: OriginId, stage: number, w: number, tone: Tone, toneKey: string): PixelArt {
  const key = `in|${origin}|${stage}|${w}|${toneKey}`;
  let art = cache.get(key);
  if (art) return art;
  const W = Math.max(60, (w - 1) * TILE);
  const H = Math.round((44 + stage * 3) * THRONE_K);
  art = paint(W, H, tone, (p) => (origin === 'dwarves' ? dwarfThrone : vampireThrone)(p, W, H, stage), 0);
  cache.set(key, art);
  return art;
}

/* ------------------------------------------------------------ pieces */

/** A pitched roof over a front wall: the hall most seats grow into. `wallH` the wall's height; `top` the ridge's y. */
function hall(c: C, wallH: number, top = 0, inset = 12): void {
  roofPlane(c.g, 0, c.W, top, c.H - wallH, inset, true);
  frontWall(c.g, EAVE, c.W - EAVE, c.H - wallH, c.H, true, true);
}

/** A flat-topped block seen from the map's angle: its top plane (lit at the back, shaded to the front edge), then its
 *  front face below with a door. */
function block(p: Painter, x0: number, x1: number, top: number, face: number, bottom: number, roof: [string, string], wall: [string, string], door = true): void {
  for (let y = top; y < face; y++) p.rect(x0, y, x1 - x0, 1, mix(roof[0], roof[1], (y - top) / Math.max(1, face - top)));
  p.frect(x0, top, x1 - x0, 1, mix(roof[0], '#ffffff', 0.3));
  p.frect(x0, face - 0.5, x1 - x0, 0.5, mix(roof[1], '#000000', 0.4));
  p.rect(x0, face, x1 - x0, bottom - face, wall[0]);
  p.frect(x1 - 1, face, 1, bottom - face, mix(wall[1], '#000000', 0.3));
  p.frect(x0, face, 0.5, bottom - face, mix(wall[0], '#ffffff', 0.2));
  p.rect(x0, bottom - 2, x1 - x0, 2, wall[1]);
  if (door && bottom - face >= 10) {
    const mid = Math.round((x0 + x1) / 2);
    p.rect(mid - 4, bottom - 11, 8, 11, mix(wall[1], '#000000', 0.5));
    p.rect(mid - 3, bottom - 10, 6, 10, mix(wall[1], '#000000', 0.7));
  }
}

/** A pole with a pennant streaming right. */
function banner(p: Painter, x: number, top: number, h: number, colour: string): void {
  p.rect(x, top, 1, h, '#5a3a22');
  p.px(x, top - 1, GOLD);
  for (let i = 0; i < 7; i++) p.frect(x + 1 + i, top + 1 + i * 0.2, 1, 4 - i * 0.4, i % 3 === 2 ? mix(colour, '#000000', 0.2) : colour);
}

/** A square tower front-on: the face with its lit top plane and merlons. */
function tower(p: Painter, cx: number, bottom: number, w: number, h: number, stone: [string, string], merlons = true, cap?: string): void {
  const x0 = Math.round(cx - w / 2);
  p.rect(x0, bottom - h, w, h, stone[0]);
  p.frect(x0 + w - 2, bottom - h, 2, h, mix(stone[1], '#000000', 0.2));
  p.frect(x0, bottom - h, 1, h, mix(stone[0], '#ffffff', 0.2));
  for (let y = bottom - h + 3; y < bottom; y += 4) p.frect(x0, y + 0.5, w, 0.5, mix(stone[1], '#000000', 0.2));
  const planeH = Math.max(3, Math.round(w * 0.3));
  p.rect(x0, bottom - h - planeH, w, planeH, mix(stone[0], '#ffffff', 0.12));
  p.frect(x0, bottom - h - 0.5, w, 0.5, mix(stone[1], '#000000', 0.3));
  if (cap) {
    // a conical roof
    const ch = Math.round(w * 0.7);
    for (let y = 0; y <= ch; y++) p.rect(Math.round(cx - ((w / 2 + 1) * y) / ch), bottom - h - planeH - ch + y, Math.max(1, Math.round(((w + 2) * y) / ch)), 1, mix(cap, '#000000', (y / ch) * 0.35));
    p.px(cx, bottom - h - planeH - ch - 1, GOLD);
  } else if (merlons) for (let x = x0; x < x0 + w; x += 4) p.rect(x, bottom - h - planeH - 3, 2, 3, stone[0]);
  // a slit window
  p.rect(cx, bottom - h + Math.round(h * 0.35), 1, 5, WINDOW);
}

/** A round drum tower with a conical roof. */
function drum(p: Painter, cx: number, bottom: number, rx: number, h: number, stone: [string, string], cap: string): void {
  const ry = Math.round(rx * 0.45);
  for (let x = Math.round(cx - rx); x < cx + rx; x++) {
    const t = (x - (cx - rx)) / (2 * rx);
    p.rect(x, bottom - h, 1, h, mix(mix(stone[0], '#ffffff', 0.15), stone[1], Math.abs(t - 0.3) * 1.5));
  }
  p.ellipse(cx, bottom, rx, ry, mix(stone[1], '#000000', 0.25));
  p.ellipse(cx, bottom - h, rx, ry, mix(stone[0], '#ffffff', 0.1));
  const ch = Math.round(rx * 1.6);
  for (let y = 0; y <= ch; y++) p.ellipse(cx, bottom - h - ch + y, Math.max(0.5, (rx * y) / ch), Math.max(0.5, (ry * y) / ch), mix(cap, '#000000', (y / ch) * 0.4));
  p.px(cx, bottom - h - ch - 1, GOLD);
  p.rect(cx, bottom - h + Math.round(h * 0.4), 1, 4, WINDOW);
}

/** A dome: shaded rings with a highlight. */
function dome(p: Painter, cx: number, cy: number, rx: number, ry: number, colour: string): void {
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    p.ellipse(cx - t * rx * 0.25, cy - t * ry * 0.3, rx * (1 - t * 0.85), ry * (1 - t * 0.85), mix(mix(colour, '#000000', 0.35), mix(colour, '#ffffff', 0.4), t));
  }
}

/** A tree's canopy: a dark mass with lighter clumps on it. */
function canopy(p: Painter, cx: number, cy: number, r: number, dark: string, light: string, seed: number): void {
  p.ellipse(cx, cy, r, r * 0.8, dark);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + seed;
    const d = r * 0.45;
    p.ellipse(cx + Math.cos(a) * d - r * 0.1, cy + Math.sin(a) * d * 0.8 - r * 0.1, r * 0.45, r * 0.36, i % 2 ? light : mix(light, dark, 0.4));
  }
  p.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.3, r * 0.22, mix(light, '#ffffff', 0.2));
}

/** A standing stone. */
function menhir(p: Painter, x: number, bottom: number, w: number, h: number): void {
  p.rect(x, bottom - h, w, h, '#7d7e7a');
  p.frect(x, bottom - h, 1, h, '#9b9c98');
  p.frect(x + w - 1, bottom - h, 1, h, '#5c5d5a');
  p.rect(x + 1, bottom - h - 1, w - 2, 1, '#9b9c98');
  p.frect(x + 1, bottom - 3, 2, 2, '#5a7a3a');
}

/** A toadstool: a red cap with white spots on a pale stalk. */
function toadstool(p: Painter, cx: number, bottom: number, r: number): void {
  p.rect(cx - Math.round(r / 3), bottom - r, Math.round(r / 1.5) || 1, r, '#e8dcc0');
  p.ellipse(cx, bottom - r, r, r * 0.6, '#c0392b');
  p.ellipse(cx - r * 0.2, bottom - r - r * 0.15, r * 0.6, r * 0.3, '#e0503a');
  p.frect(cx - r * 0.4, bottom - r - 1, 1.5, 1.5, '#fff5e0');
  p.frect(cx + r * 0.3, bottom - r + 1, 1.5, 1.5, '#fff5e0');
}

/** A crystal: a tall shard, lit on its left face. */
function crystal(p: Painter, cx: number, bottom: number, w: number, h: number, colour: string): void {
  for (let y = 0; y < h; y++) {
    const half = Math.max(0.5, (w / 2) * Math.min(1, (y / h) * 1.6));
    p.frect(cx - half, bottom - h + y, half, 1, mix(colour, '#ffffff', 0.35));
    p.frect(cx, bottom - h + y, half, 1, mix(colour, '#000000', 0.25));
  }
  p.frect(cx - 0.5, bottom - h, 1, 2, '#ffffff');
}

/** A flame (a lamp colour, so it glows at night). */
function flame(p: Painter, cx: number, bottom: number, h: number, colour: string): void {
  p.frect(cx - 1, bottom - h * 0.6, 2, h * 0.6, colour);
  p.frect(cx - 0.5, bottom - h, 1, h * 0.5, mix(colour, '#ffffff', 0.4));
  p.frect(cx - 2, bottom - h * 0.35, 4, h * 0.35, colour);
}

/* ------------------------------------------------------------ the twelve */

const PAINTERS: Record<OriginId, (c: C) => void> = {
  settlers(c) {
    const { p, W, H, D, stage } = c;
    if (stage === 1) {
      // a meeting stone on trodden ground, a ring of small stones to sit on, a fire before it
      p.ellipse(W / 2, H - D / 2, D * 0.75, D * 0.4, '#8f7a56');
      for (let a = 0.3; a < Math.PI - 0.2; a += 0.45) p.rect(Math.round(W / 2 + Math.cos(a) * D * 0.55), Math.round(H - D / 2 + Math.sin(a) * D * 0.28), 4, 3, '#8d8c84');
      menhir(p, W / 2 - 5, H - D / 2 - 6, 10, 30);
      flame(p, W / 2, H - 10, 8, '#ffb347');
      p.ellipse(W / 2, H - 9, 5, 2.5, '#5c5d5a');
      return;
    }
    hall(c, stage >= 4 ? 40 : 32, stage >= 3 ? 6 : 0);
    const mid = W / 2;
    if (stage >= 3) {
      // a clock in the gable and a cupola on the ridge
      p.disc(mid, H - 32 - 8, 5, '#e8dcc0');
      p.fline(mid, H - 40, mid, H - 43, '#3b2616');
      p.fline(mid, H - 40, mid + 2.5, H - 40, '#3b2616');
      p.rect(mid - 4, 0, 8, 8, c.g.mats.wall[0]);
      p.rect(mid - 5, 0, 10, 2, c.g.mats.roof[1]);
      p.px(mid, -1, GOLD);
    }
    if (stage >= 4) for (const x of [EAVE + 8, W - EAVE - 9]) banner(p, x, H - 40 - 14, 16, '#c0392b');
    if (stage === 5) {
      // the council spire: a tower of glass rising through the roof, a light at its tip
      const sw = 22;
      for (let y = 2; y < H - 40; y++) p.rect(mid - sw / 2, y, sw, 1, mix('#9ac0f0', '#2e4a78', ((y / (H - 40)) * 0.6) % 0.3 + 0.2));
      for (let y = 6; y < H - 40; y += 6) p.frect(mid - sw / 2, y, sw, 0.5, '#5a7aa8');
      p.frect(mid - sw / 2, 2, 1, H - 42, '#d8e8ff');
      p.rect(mid - sw / 2 - 1, 0, sw + 2, 2, '#5a7aa8');
      p.px(mid, -1, CYAN);
    }
  },

  lich(c) {
    const { p, W, H, D, stage } = c;
    const mid = W / 2;
    const bone = ['#e8e0d0', '#b8b0a0'] as [string, string];
    const black = ['#2a262e', '#17151a'] as [string, string];
    // the ground of the dead: ash, with bones strewn
    p.ellipse(mid, H - D / 2, D * 0.8, D * 0.42, '#3a3842');
    for (let i = 0; i < 6 + stage * 2; i++) p.rect(Math.round(mid - D * 0.7 + ((i * 37) % Math.round(D * 1.4))), Math.round(H - D / 2 - D * 0.3 + ((i * 53) % Math.round(D * 0.6))), 3, 1, bone[0]);
    if (stage === 1) {
      // an altar of stacked bone, a green flame on it
      p.rect(mid - 14, H - 24, 28, 14, black[0]);
      for (let y = H - 23; y < H - 11; y += 3) for (let x = mid - 13 + ((y % 2) * 2); x < mid + 13; x += 5) p.rect(x, y, 3, 2, bone[0]);
      flame(p, mid, H - 24, 12, GREEN);
      return;
    }
    // tiers of black stone, one more an era: the ziggurat
    const tiers = Math.min(4, stage);
    const base = Math.round(W * 0.42);
    const tierH = 13;
    for (let t = 0; t < tiers; t++) {
      const half = Math.round(base * (1 - t / (tiers + 0.6)));
      const bottom = H - 2 - t * tierH;
      block(p, mid - half, mid + half, bottom - tierH - 7, bottom - tierH, bottom, ['#4a4452', '#2a262e'], black, t === 0);
      // skulls set in the face
      for (let x = mid - half + 4; x < mid + half - 3; x += 7) {
        p.rect(x, bottom - tierH + 3, 3, 3, bone[1]);
        p.px(x, bottom - tierH + 4, GREEN);
      }
    }
    const top = H - 2 - tiers * tierH - 7;
    if (stage === 2) {
      // the ossuary's slit windows glow green
      for (const x of [mid - 12, mid + 10]) p.rect(x, H - 12, 2, 5, GREEN);
    }
    if (stage >= 3) flame(p, mid, top + 1, 18 + stage * 3, GREEN);
    if (stage >= 4) {
      // the spire: bone and iron, rising from the crown
      const sh = 16 + stage * 5;
      p.rect(mid - 3, top - sh, 6, sh, bone[1]);
      p.frect(mid - 3, top - sh, 1, sh, bone[0]);
      for (let y = top - sh + 3; y < top; y += 5) p.frect(mid - 4, y, 8, 0.5, '#3a3a3a');
      p.rect(mid - 1, top - sh - 6, 2, 6, bone[0]);
      p.px(mid, top - sh - 7, GREEN);
    }
    if (stage === 5) {
      // the throne of unlife before the pillar of fire
      p.rect(mid - 6, H - 20, 12, 18, black[1]);
      p.rect(mid - 4, H - 26, 8, 6, bone[0]);
      p.rect(mid - 7, H - 24, 2, 10, bone[1]);
      p.rect(mid + 5, H - 24, 2, 10, bone[1]);
      for (const x of [mid - 30, mid + 29]) flame(p, x, H - 6, 10, GREEN);
    }
  },

  druid(c) {
    const { p, W, H, D, stage, seed } = c;
    const mid = W / 2;
    const ground = H - D / 2;
    // a ring of standing stones, always
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const x = Math.round(mid + Math.cos(a) * D * 0.72);
      const y = Math.round(ground + Math.sin(a) * D * 0.36 + 6);
      if (Math.sin(a) < 0) menhir(p, x - 3, y, 6, 14);
    }
    if (stage === 1) {
      // a sapling in the middle
      p.rect(mid, ground - 8, 1, 10, '#5a3a22');
      canopy(p, mid, ground - 12, 7, '#2e5a2a', '#5a8a3a', seed);
    } else if (stage === 2) {
      // young trees round the stones, charms hung between
      for (let i = 0; i < 5; i++) {
        const x = Math.round(mid - D * 0.5 + i * D * 0.25);
        p.rect(x, ground - 14, 2, 16, '#5a3a22');
        canopy(p, x + 1, ground - 20, 11, '#2e5a2a', '#5a8a3a', seed + i);
      }
      for (let i = 0; i < 6; i++) p.px(Math.round(mid - 20 + i * 8), ground - 4 + (i % 2) * 2, i % 2 ? '#e0c060' : '#c0392b');
    } else {
      // the great oak: a vast trunk with a hollow door, roots over the ground, a canopy over everything
      const trunkW = 14 + stage * 5;
      const trunkH = 24 + stage * 8;
      p.rect(mid - trunkW / 2, H - trunkH - 4, trunkW, trunkH, '#5a3a22');
      for (let x = mid - trunkW / 2 + 2; x < mid + trunkW / 2; x += 4) p.frect(x, H - trunkH - 4, 0.5, trunkH, '#3b2616');
      p.frect(mid - trunkW / 2, H - trunkH - 4, 2, trunkH, '#7a5a3a');
      for (const dx of [-1, 1]) for (let i = 0; i < 3; i++) p.fline(mid + (dx * trunkW) / 2, H - 10 + i * 2, mid + dx * (trunkW / 2 + 10 + i * 6), H - 2, '#4a2e1a');
      p.rect(mid - 4, H - 16, 8, 12, '#2a1a0e');
      p.ellipse(mid, H - 16, 4, 3, '#2a1a0e');
      if (stage >= 4) p.rect(mid - 1, H - 11, 2, 3, WINDOW);
      const r = Math.round(W * (stage === 3 ? 0.36 : stage === 4 ? 0.44 : 0.5));
      canopy(p, mid, H - trunkH - 4 - r * 0.5, r, '#2e5a2a', '#5a8a3a', seed);
      if (stage >= 4) for (let i = 0; i < 8 + stage * 2; i++) p.fpx(mid - r * 0.8 + ((i * 29) % Math.round(r * 1.6)), H - trunkH - 4 - r * 0.5 - r * 0.5 + ((i * 17) % Math.round(r * 0.9)), i % 2 ? GOLD : GREEN);
      if (stage === 5) {
        // a second crown above, lost in cloud
        canopy(p, mid + 4, 14, r * 0.7, '#3a6a3a', '#7aa84a', seed + 3);
        p.ellipse(mid - r * 0.4, 10, r * 0.3, 4, 'rgba(255,255,255,0.35)');
      }
    }
  },

  vampire(c) {
    // (the vampires' seat stands in the castle's hall: this is only its picture for cards)
    vampireThrone(c.p, c.W, c.H, c.stage);
  },

  werewolf(c) {
    const { p, W, H, D, stage } = c;
    const mid = W / 2;
    if (stage === 1) {
      // a mound of earth and hides over the den, bones at the mouth
      p.ellipse(mid, H - D / 2 + 4, D * 0.6, D * 0.38, '#5a4630');
      p.ellipse(mid - 4, H - D / 2, D * 0.5, D * 0.3, '#7a6040');
      for (let i = 0; i < 5; i++) p.ellipse(mid - 20 + i * 11, H - D / 2 - 6 + (i % 2) * 5, 6, 3, i % 2 ? '#8a6a48' : '#6a4a30');
      p.ellipse(mid, H - 10, 9, 6, '#2a1a0e');
      for (let i = 0; i < 4; i++) p.rect(mid - 16 + i * 9, H - 5 + (i % 2), 4, 1, '#e8e0d0');
      return;
    }
    // a lodge of logs: the wall in courses of logs, a steep roof of bark and hide
    const wallH = 24 + stage * 3;
    c.g.mats = { ...c.g.mats, roof: ['#8a6a48', '#4a2e1a'], cover: 'thatch' };
    roofPlane(c.g, 0, W, 0, H - wallH, 10, true);
    const x0 = EAVE;
    const x1 = W - EAVE;
    p.rect(x0, H - wallH, x1 - x0, wallH, '#7a5a3a');
    for (let y = H - wallH; y < H; y += 4) {
      p.frect(x0, y, x1 - x0, 1, '#9a7a52');
      p.frect(x0, y + 3, x1 - x0, 1, '#4a2e1a');
    }
    for (let x = x0; x < x1; x += 20) p.rect(x, H - wallH, 2, wallH, '#5a3a22');
    p.rect(mid - 6, H - 14, 12, 14, '#2a1a0e');
    for (const x of [x0 + 8, x1 - 13]) p.rect(x, H - wallH + 6, 5, 5, WINDOW);
    // antlers on the gable, a wolf skull over the door from the third stage
    for (const s of [-1, 1]) {
      p.fline(mid + s * 3, H - wallH - 2, mid + s * 10, H - wallH - 9, '#e8e0d0');
      p.fline(mid + s * 6, H - wallH - 5, mid + s * 8, H - wallH - 11, '#e8e0d0');
    }
    if (stage >= 3) {
      p.rect(mid - 4, H - 20, 8, 5, '#e8e0d0');
      p.rect(mid - 3, H - 16, 6, 3, '#d8d0c0');
      p.px(mid - 2, H - 19, '#2a1a0e');
      p.px(mid + 1, H - 19, '#2a1a0e');
      // hides and skulls along the eaves
      for (let x = x0 + 14; x < x1 - 12; x += 14) p.rect(x, H - wallH + 1, 4, 3, x % 28 ? '#e8e0d0' : '#8a6a48');
    }
    if (stage >= 4) {
      // the moon totem before the hall
      const tx = x0 + 10;
      p.rect(tx, H - 36, 5, 34, '#5a3a22');
      for (let y = H - 32; y < H - 4; y += 7) {
        p.rect(tx - 1, y, 7, 3, y % 14 ? '#c0392b' : '#e8e0d0');
        p.px(tx + 1, y + 1, '#2a1a0e');
        p.px(tx + 3, y + 1, '#2a1a0e');
      }
      p.disc(tx + 2, H - 40, 5, '#d8dce8');
      p.disc(tx + 4, H - 41, 4, c.g.mats.roof[1]);
    }
    if (stage === 5) {
      // the silver moon over the ridge, bone along it
      p.disc(mid, 8, 8, '#d8dce8');
      p.disc(mid + 3, 7, 7, mix(c.g.mats.roof[0], '#000000', 0.1));
      p.disc(mid, 8, 8, 'rgba(216,220,232,0.5)');
      for (let x = 8; x < W - 8; x += 6) p.rect(x, 0, 3, 2, '#e8e0d0');
    }
  },

  robot(c) {
    const { p, W, H, D, stage } = c;
    const mid = W / 2;
    const steel = ['#8a96a4', '#5a6470'] as [string, string];
    // the pad of plates, always
    p.rect(EAVE, H - D, W - 2 * EAVE, D, steel[1]);
    for (let y = H - D; y < H; y += 12) for (let x = EAVE; x < W - EAVE; x += 16) p.rect(x + 1, y + 1, 14, 10, mix(steel[0], steel[1], ((x + y) % 32) / 64));
    if (stage === 1) {
      p.disc(mid, H - D / 2, 12, '#3a4450');
      p.disc(mid, H - D / 2, 8, CYAN);
      p.disc(mid, H - D / 2, 3, '#ffffff');
      return;
    }
    if (stage === 2) {
      // consoles round the core, cables between
      p.disc(mid, H - D / 2, 10, '#3a4450');
      p.disc(mid, H - D / 2, 6, CYAN);
      for (const [dx, dy] of [[-40, -10], [40, -10], [-30, 20], [30, 20]]) {
        p.rect(mid + dx - 8, H - D / 2 + dy - 6, 16, 10, steel[0]);
        p.rect(mid + dx - 6, H - D / 2 + dy - 5, 12, 4, '#1e2a30');
        p.px(mid + dx - 4, H - D / 2 + dy - 3, CYAN);
        p.px(mid + dx + 2, H - D / 2 + dy - 3, '#ff4040');
        p.fline(mid + dx, H - D / 2 + dy + 4, mid, H - D / 2 + 8, '#2a2a30');
      }
      return;
    }
    // the tower: a block of racks, taller each stage, lights blinking on every face
    const bw = Math.round(W * (stage === 3 ? 0.4 : stage === 4 ? 0.7 : 0.8));
    const bh = stage === 3 ? H - 14 : stage === 4 ? H - 30 : H - 44;
    block(p, mid - bw / 2, mid + bw / 2, H - 8 - bh, H - 8 - bh + Math.round(bw * 0.18), H - 8, steel, steel, false);
    for (let y = H - 8 - bh + Math.round(bw * 0.18) + 3; y < H - 12; y += 5)
      for (let x = mid - bw / 2 + 3; x < mid + bw / 2 - 2; x += 6) p.px(x, y, (x * 7 + y * 3) % 5 === 0 ? '#ff4040' : (x + y) % 3 ? '#1e2a30' : CYAN);
    if (stage >= 4) {
      // fans and vents on the top plane
      for (let i = 0; i < 3; i++) p.ellipse(mid - bw / 3 + (i * bw) / 3, H - 8 - bh + Math.round(bw * 0.09), 6, 3, '#1e2a30');
      for (let i = 0; i < 3; i++) p.ellipse(mid - bw / 3 + (i * bw) / 3, H - 8 - bh + Math.round(bw * 0.09), 4, 2, '#3a4450');
    }
    if (stage === 5) {
      // the overmind's dome of light
      dome(p, mid, H - 8 - bh - 4, bw * 0.3, bw * 0.14, '#3a6a7a');
      p.ellipse(mid, H - 8 - bh - 6, bw * 0.12, bw * 0.05, CYAN);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) p.fpx(mid + Math.cos(a) * bw * 0.26, H - 8 - bh - 4 + Math.sin(a) * bw * 0.12, CYAN);
    } else {
      p.rect(mid - 1, H - 8 - bh - 12, 2, 12, steel[0]);
      p.px(mid, H - 8 - bh - 13, '#ff4040');
    }
  },

  dwarves(c) {
    dwarfThrone(c.p, c.W, c.H, c.stage);
  },

  merfolk(c) {
    const { p, W, H, D, stage } = c;
    const mid = W / 2;
    const water = ['#2a6a9a', '#5aa0c8'] as [string, string];
    // rocks and a pool, always: the tide comes in here
    p.ellipse(mid, H - D / 2 + 4, D * 0.8, D * 0.42, '#7d7e7a');
    p.ellipse(mid - 3, H - D / 2, D * 0.74, D * 0.36, water[0]);
    p.ellipse(mid - 10, H - D / 2 - 4, D * 0.4, D * 0.16, water[1]);
    for (let i = 0; i < 5; i++) p.ellipse(mid - D * 0.6 + i * D * 0.3, H - D / 2 + D * 0.32 - (i % 2) * 4, 4, 2.5, i % 2 ? '#f0d8c8' : '#e8c0a0');
    if (stage === 1) {
      p.ellipse(mid + 20, H - D / 2 - 8, 6, 4, '#c0392b');
      p.ellipse(mid - 24, H - D / 2 + 6, 5, 3, '#e0c060');
      return;
    }
    if (stage === 2) {
      // the shell hall: one great scallop roofing a low wall of stones
      const r = Math.round(W * 0.3);
      p.rect(mid - r, H - 22, 2 * r, 20, '#8d8c84');
      p.rect(mid - 5, H - 14, 10, 12, '#2a3a4a');
      for (let t = 6; t >= 1; t--) p.ellipse(mid, H - 22, (r * 1.1 * t) / 6, (r * 0.8 * t) / 6, t % 2 ? '#f8d8c8' : '#f0c0a8');
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        p.fline(mid, H - 22, mid + Math.cos(a) * r * 1.1, H - 22 + Math.sin(a) * r * 0.8, '#d89880');
      }
      p.ellipse(mid - r * 0.3, H - 22 - r * 0.4, r * 0.2, r * 0.1, '#fff0e8');
      return;
    }
    // the coral court: pillars of red and gold coral round the pool, and from the fourth stage a dome of pearl over
    for (let i = 0; i < 6; i++) {
      const x = Math.round(mid - D * 0.66 + i * D * 0.265);
      const h = 18 + ((i * 7) % 10) + stage * 3;
      const col = i % 2 ? '#d85a3a' : '#e0a040';
      p.rect(x - 2, H - D / 2 + 8 - h, 4, h, col);
      p.fline(x - 1, H - D / 2 + 8 - h + 4, x - 6, H - D / 2 + 8 - h - 4, col);
      p.fline(x + 1, H - D / 2 + 8 - h + 8, x + 6, H - D / 2 + 8 - h, col);
      p.frect(x - 2, H - D / 2 + 8 - h, 1, h, mix(col, '#ffffff', 0.3));
    }
    if (stage >= 4) {
      const rx = Math.round(W * 0.28);
      dome(p, mid, H - D / 2 - 10, rx, rx * 0.5, '#e8e0f0');
      p.ellipse(mid - rx * 0.3, H - D / 2 - 10 - rx * 0.2, rx * 0.2, rx * 0.08, '#ffffff');
      p.ellipse(mid, H - D / 2 - 10 + rx * 0.5 - 4, rx * 0.95, 5, '#8d8c84');
      p.rect(mid - 5, H - D / 2 - 10 + rx * 0.5 - 12, 10, 10, '#2a3a4a');
    }
    if (stage === 5) {
      for (let i = 0; i < 10; i++) p.fpx(mid - D * 0.6 + ((i * 41) % Math.round(D * 1.2)), H - D / 2 - 20 + ((i * 23) % 30), TEAL);
      p.ellipse(mid, H - D / 2 - 10 - W * 0.14, 6, 3, TEAL);
    }
  },

  nomads(c) {
    const { p, W, H, stage } = c;
    const mid = W / 2;
    if (stage <= 2) {
      // a round tent: the felt roof seen from above, its wall below, painted stripes on the great yurt
      const rx = Math.round(W * (stage === 1 ? 0.3 : 0.4));
      const ry = Math.round(rx * 0.55);
      const wallH = 12 + stage * 4;
      const cy = H - wallH - 2;
      for (let x = Math.round(mid - rx); x < mid + rx; x++) p.rect(x, cy, 1, wallH, mix('#e8dcc0', '#9a7a52', Math.abs((x - mid) / rx) * 0.8));
      if (stage === 2) for (let y = cy + 3; y < cy + wallH; y += 5) p.frect(mid - rx, y, 2 * rx, 1, '#c0392b');
      p.ellipse(mid, cy + wallH, rx, ry * 0.5, '#9a7a52');
      p.rect(mid - 4, H - 2 - 12, 8, 12, '#4a2e1a');
      for (let t = 0; t < 8; t++) p.ellipse(mid, cy - (t * ry) / 8, (rx * (8 - t)) / 8, (ry * (8 - t)) / 8, t % 2 ? '#e8dcc0' : '#d8c8a8');
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) p.fline(mid, cy - ry, mid + Math.cos(a) * rx, cy + Math.sin(a) * ry * 0.98, '#b89a58');
      banner(p, mid, cy - ry - 16, 16, '#c0392b');
      return;
    }
    if (stage === 3) {
      // the khan's pavilion: a square silk roof swooping to four posts, banners at every corner
      const x0 = EAVE + 6;
      const x1 = W - EAVE - 6;
      const top = 14;
      const eave = H - 30;
      for (let y = top; y < eave; y++) {
        const t = (y - top) / (eave - top);
        const ins = Math.round((1 - t) * (1 - t) * (x1 - x0) * 0.38);
        p.rect(x0 + ins, y, x1 - x0 - 2 * ins, 1, Math.floor(y / 4) % 2 ? '#c0392b' : '#e8c040');
      }
      p.frect(x0, eave - 0.5, x1 - x0, 1, '#7a2a1a');
      for (const x of [x0 + 2, x1 - 4]) p.rect(x, eave, 2, 28, '#5a3a22');
      p.rect(x0 + 4, eave + 10, x1 - x0 - 8, 16, 'rgba(90,58,34,0.35)');
      p.rect(mid - 10, H - 12, 20, 10, '#7a2a1a');
      for (const x of [x0, x1 - 1]) banner(p, x, top - 6, 20, '#e8c040');
      banner(p, mid, 0, 16, '#c0392b');
      return;
    }
    // the caravan palace: adobe walls with a crenellated top, tiled doorway, blue domes on the horde's palace
    const x0 = EAVE;
    const x1 = W - EAVE;
    const adobe = ['#d8b890', '#a8865a'] as [string, string];
    block(p, x0, x1, 18, 34, H, adobe, adobe);
    for (let x = x0; x < x1; x += 8) p.rect(x, 14, 4, 4, adobe[0]);
    // the tiled arch
    p.rect(mid - 9, H - 20, 18, 20, '#2a5a9a');
    p.ellipse(mid, H - 20, 9, 6, '#2a5a9a');
    p.rect(mid - 6, H - 17, 12, 17, '#4a2e1a');
    p.ellipse(mid, H - 17, 6, 4, '#4a2e1a');
    for (let x = x0 + 10; x < x1 - 8; x += 18) if (Math.abs(x - mid) > 14) p.rect(x, H - 26, 5, 7, WINDOW);
    if (stage === 5) {
      for (const [x, r] of [[mid, 18], [x0 + 22, 11], [x1 - 22, 11]] as const) {
        dome(p, x, 18, r, r * 0.6, '#2e6ab8');
        p.rect(x, 18 - r * 0.6 - 5, 1, 5, GOLD);
        p.px(x, 18 - r * 0.6 - 6, GOLD);
      }
    } else for (const x of [x0 + 6, x1 - 8]) banner(p, x, 2, 14, '#e8c040');
  },

  fae(c) {
    const { p, W, H, D, stage, seed } = c;
    const mid = W / 2;
    // a mound that glows, ringed with toadstools
    p.ellipse(mid, H - D / 2 + 6, D * 0.7, D * 0.36, '#3f6a2a');
    p.ellipse(mid - 4, H - D / 2 + 2, D * 0.6, D * 0.28, '#5a8a3a');
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4 + seed * 0.01;
      const x = Math.round(mid + Math.cos(a) * D * 0.66);
      const y = Math.round(H - D / 2 + 6 + Math.sin(a) * D * 0.34);
      toadstool(p, x, y, stage === 1 ? 4 : 6 + (i % 3) * 2);
    }
    for (let i = 0; i < 5 + stage * 2; i++) p.fpx(mid - D * 0.5 + ((i * 31) % Math.round(D)), H - D / 2 - 10 + ((i * 19) % 24), i % 2 ? PINK : GOLD);
    if (stage === 1) return;
    if (stage === 2) {
      // one toadstool grown into a hall, a door in its stalk
      p.rect(mid - 10, H - 30, 20, 28, '#e8dcc0');
      p.frect(mid - 10, H - 30, 2, 28, '#fff5e0');
      p.frect(mid + 8, H - 30, 2, 28, '#c8b8a0');
      p.rect(mid - 4, H - 12, 8, 10, '#4a2e1a');
      p.ellipse(mid, H - 30, 30, 16, '#c0392b');
      p.ellipse(mid - 6, H - 34, 18, 8, '#e0503a');
      for (let i = 0; i < 7; i++) p.ellipse(mid - 22 + ((i * 37) % 44), H - 36 + ((i * 13) % 12), 2.5, 1.5, '#fff5e0');
      return;
    }
    if (stage === 3) {
      // a pavilion half there: pastel silk over slender posts, wisps about it
      const x0 = EAVE + 10;
      const x1 = W - EAVE - 10;
      for (let y = 10; y < H - 26; y++) {
        const t = (y - 10) / (H - 36);
        const ins = Math.round((1 - t) * (1 - t) * (x1 - x0) * 0.4);
        p.rect(x0 + ins, y, x1 - x0 - 2 * ins, 1, `rgba(${Math.floor(y / 3) % 2 ? '248,176,255' : '200,230,255'},0.75)`);
      }
      for (const x of [x0 + 2, x1 - 3]) p.rect(x, H - 26, 1, 24, '#e8e0f0');
      for (let i = 0; i < 6; i++) p.fpx(x0 + ((i * 47) % (x1 - x0)), 4 + ((i * 29) % 30), PINK);
      return;
    }
    // the crystal bower: shards of rose and violet grown through vines; the court of seasons a palace of them
    const cols = stage === 4 ? ['#e090e0', '#b070d0', '#f0b0f0'] : ['#f0a0b0', '#a0e0a0', '#f0d080', '#a0c8f0'];
    const count = stage === 4 ? 5 : 7;
    for (let i = 0; i < count; i++) {
      const x = Math.round(mid - W * 0.3 + (i * W * 0.6) / (count - 1));
      const h = 24 + ((i * 17) % 14) + (i === Math.floor(count / 2) ? 22 + stage * 4 : 0);
      crystal(p, x, H - 14 - (i % 2) * 6, 10 + (i % 3) * 3, h, cols[i % cols.length]);
    }
    for (let i = 0; i < 4; i++) p.fline(mid - W * 0.3 + i * 20, H - 12, mid - W * 0.3 + i * 20 + 14, H - 30 - i * 4, '#3f6a2a');
    p.rect(mid - 5, H - 14, 10, 12, '#4a2e4a');
    if (stage === 5) for (let i = 0; i < 12; i++) p.fpx(mid - W * 0.35 + ((i * 53) % Math.round(W * 0.7)), 6 + ((i * 37) % (H - 30)), i % 2 ? PINK : GOLD);
  },

  alchemists(c) {
    const { p, W, H, stage } = c;
    const mid = W / 2;
    const copper = '#b87333';
    const brass = '#c8a03a';
    if (stage === 1) {
      // a hut of stills: a little house with a copper pot on the roof and flasks at the door
      hall(c, 22, 6, 8);
      p.rect(mid + 14, 2, 8, 10, copper);
      p.ellipse(mid + 18, 2, 5, 3, mix(copper, '#ffffff', 0.2));
      c.g.smoke.push({ x: mid + 18, y: 0 });
      p.rect(EAVE + 6, H - 8, 4, 6, '#5ad0c0');
      p.rect(EAVE + 12, H - 10, 4, 8, '#e0c060');
      return;
    }
    if (stage === 2) {
      // the alembic tower: a drum hung with glass globes and copper pipes
      drum(p, mid, H - 4, Math.round(W * 0.22), H - 40, ['#8d8c84', '#5c5d5a'], copper);
      for (const [dx, dy, col] of [[-26, -30, '#5ad0c0'], [26, -36, '#e0c060'], [-24, -50, '#c0392b'], [26, -56, '#80e0ff']] as const) {
        p.fline(mid, H + dy + 6, mid + dx, H + dy, copper);
        p.disc(mid + dx, H + dy, 5, col);
        p.disc(mid + dx - 1.5, H + dy - 1.5, 1.5, '#ffffff');
      }
      return;
    }
    // the athanor hall: a hall built round the furnace, its glow in every window; brass domes and lightning jars later
    hall(c, 34, stage === 3 ? 8 : 4);
    p.rect(mid - 7, H - 34 - 10, 14, 12, '#7d7e7a');
    p.rect(mid - 5, H - 34 - 8, 10, 6, '#ffb347');
    c.g.smoke.push({ x: mid, y: H - 46 });
    if (stage >= 4) {
      for (const x of [EAVE + 18, W - EAVE - 18]) {
        dome(p, x, 12, 12, 7, brass);
        p.rect(x, 2, 1, 4, brass);
      }
      for (const x of [EAVE + 4, W - EAVE - 8]) {
        p.rect(x, H - 16, 5, 12, '#80e0ff');
        p.rect(x + 1, H - 18, 3, 2, brass);
        p.fline(x + 1, H - 14, x + 3, H - 8, '#ffffff');
      }
    }
    if (stage === 5) {
      // the tower and the stone at its top, glowing gold
      p.rect(mid - 8, 10, 16, H - 34 - 12, '#8d8c84');
      p.frect(mid - 8, 10, 1, H - 46, '#9b9c98');
      p.rect(mid - 9, 8, 18, 3, brass);
      p.disc(mid, 4, 4, GOLD);
      p.disc(mid - 1, 3, 1.5, '#ffffff');
      for (let y = 18; y < H - 36; y += 10) p.rect(mid - 1, y, 2, 4, WINDOW);
    }
  },

  knights(c) {
    const { p, W, H, D, stage } = c;
    void D;
    const mid = W / 2;
    const stone = ['#8d8c84', '#5c5d5a'] as [string, string];
    const red = '#c0392b';
    if (stage === 1) {
      // the motte: a timber tower on a mound ringed by a palisade
      p.ellipse(mid, H - D / 2 + 4, D * 0.7, D * 0.38, '#5a8a3a');
      p.ellipse(mid - 4, H - D / 2, D * 0.5, D * 0.26, '#7aa84a');
      for (let a = 0.15; a < Math.PI; a += 0.22) p.rect(Math.round(mid + Math.cos(a) * D * 0.68), Math.round(H - D / 2 + 4 + Math.sin(a) * D * 0.36) - 6, 2, 7, '#7a5a3a');
      tower(p, mid, H - D / 2 + 2, 20, 26, ['#9a7a52', '#5a3a22'], true);
      banner(p, mid, H - D / 2 - 40, 14, red);
      return;
    }
    // the keep: a square stone tower, taller each stage, turrets at its corners from the third
    const kw = Math.round(W * (stage === 2 ? 0.34 : stage === 3 ? 0.42 : 0.5));
    const kh = 30 + stage * 9;
    const bottom = H - 6;
    // a curtain wall round the ward from the fourth stage
    if (stage >= 4) {
      block(p, EAVE, W - EAVE, H - D - 2, H - D + 6, H - D + 16, stone, stone, false);
      for (let x = EAVE; x < W - EAVE; x += 6) p.rect(x, H - D - 5, 3, 3, stone[0]);
      p.rect(mid - 7, H - D + 4, 14, 12, mix(stone[1], '#000000', 0.5));
      p.rect(mid - 5, H - D + 6, 10, 10, '#3a2616');
      for (let i = 0; i < 4; i++) p.rect(mid - 5 + i * 3, H - D + 6, 1, 10, '#1a1a1a');
    }
    tower(p, mid, bottom, kw, kh, stone, true);
    p.rect(mid - 5, bottom - 12, 10, 12, '#3a2616');
    for (const x of [mid - kw / 4, mid + kw / 4]) p.rect(Math.round(x) - 1, bottom - kh + 12, 3, 6, WINDOW);
    if (stage >= 3) {
      for (const dx of [-1, 1]) drum(p, mid + (dx * kw) / 2, bottom, 7, kh + 6, stone, stage === 5 ? '#2e4a78' : stone[1]);
    }
    if (stage >= 4) {
      // shields along the walls
      const cols = [red, '#2e4a78', '#e8c040', '#3f6a2a'];
      for (let i = 0; i < 4; i++) {
        const x = mid - kw / 2 + 6 + (i * (kw - 12)) / 3;
        p.rect(Math.round(x) - 2, bottom - kh + 24, 5, 6, cols[i]);
        p.frect(Math.round(x) - 2, bottom - kh + 24, 5, 0.5, '#ffffff');
      }
    }
    banner(p, mid, bottom - kh - Math.round(kw * 0.3) - 18, 18, red);
    if (stage === 5) for (const dx of [-1, 1]) banner(p, mid + (dx * kw) / 2, bottom - kh - 6 - 11 - 12, 12, '#e8c040');
  },  orcs(c) {
    const { p, W, H, D, stage } = c;
    const mid = W / 2;
    const red = '#8a1a14';
    const bone = '#e8e0c8';
    // a skull, front-on
    const skull = (x: number, y: number, s = 1) => {
      p.ellipse(x, y, 2.4 * s, 2 * s, bone);
      p.rect(Math.round(x - 1.5 * s), Math.round(y + 1.5 * s), Math.max(1, Math.round(3 * s)), Math.max(1, Math.round(1.5 * s)), bone);
      p.frect(x - 1.3 * s, y - 0.3 * s, 0.9 * s, 0.9 * s, '#1a1410');
      p.frect(x + 0.4 * s, y - 0.3 * s, 0.9 * s, 0.9 * s, '#1a1410');
    };
    // a pole hung with skulls
    const pole = (x: number, bottom: number, h: number, skulls: number) => {
      p.rect(x, bottom - h, 2, h, '#4a3220');
      p.frect(x, bottom - h, 0.5, h, '#6a4a2e');
      for (let i = 0; i < skulls; i++) skull(x + 1, bottom - h + 3 + i * 6);
    };
    // trodden ground and a fire pit before it all
    p.ellipse(mid, H - D / 2, D * 0.75, D * 0.4, '#6a5a3e');
    if (stage === 1) {
      pole(mid - 1, H - D / 2, 34, 3);
      for (const dx of [-14, 14]) pole(mid + dx, H - D / 2 + 3, 20, 1);
      p.ellipse(mid, H - 7, 6, 2.5, '#3a3430');
      flame(p, mid, H - 7, 9, '#ff9030');
      return;
    }
    const hide: [string, string] = ['#8a6a44', '#5a3e26'];
    const logs: [string, string] = ['#6a4a2e', '#3e2a18'];
    const iron: [string, string] = ['#6a6a70', '#3a3a40'];
    const bottom = H - 6;
    const hw = Math.round(W * [0, 0, 0.5, 0.66, 0.7, 0.62][stage]);
    const top = H - D - [0, 0, 8, 10, 14, 22][stage];
    if (stage <= 3) {
      // a hut of hide over poles (then a long log hall), tusks over the door
      block(p, mid - hw / 2, mid + hw / 2, top, bottom - 18 - stage * 2, bottom, hide, stage === 3 ? logs : hide);
      for (let x = mid - hw / 2 + 3; x < mid + hw / 2 - 2; x += 5) p.frect(x, top + 1, 0.5, bottom - 20 - stage * 2 - top, '#3e2a18');
      for (const s of [-1, 1]) for (let k = 0; k < 7; k++) p.px(Math.round(mid + s * (6 - k * 0.6)), bottom - 12 - k, bone);
      skull(mid, top - 3, 1.3);
    } else {
      // the iron hall: riveted plates over logs, then the throne of skulls on a hill of iron and bone
      block(p, mid - hw / 2, mid + hw / 2, top, bottom - 26, bottom, iron, stage === 5 ? iron : logs);
      for (let x = mid - hw / 2 + 2; x < mid + hw / 2; x += 6) for (let y = bottom - 24; y < bottom - 3; y += 6) p.px(x, y, '#9a9aa2');
      if (stage === 5) {
        // a heap of skulls on the roof, the throne at its top
        for (let row = 0; row < 4; row++) for (let k = 0; k <= 5 - row; k++) skull(mid - (5 - row) * 2.6 + k * 5.2, top - 2 - row * 4, 0.9);
        p.rect(mid - 5, top - 30, 10, 14, '#3a2a1a');
        p.rect(mid - 7, top - 34, 14, 4, red);
        skull(mid, top - 36, 1.5);
      } else skull(mid, top - 3, 1.5);
    }
    for (const dx of [-1, 1]) pole(Math.round(mid + dx * (hw / 2 + 5)), bottom, 26 + stage * 3, stage >= 3 ? 3 : 2);
    banner(p, Math.round(mid + hw / 2 - 4), top - 18, 16, red);
    p.ellipse(mid - hw / 2 - 2, H - 4, 5, 2, '#3a3430');
    flame(p, mid - hw / 2 - 2, H - 4, 8, '#ff9030');
  },

};

/* ------------------------------------------------------------ the throne rooms */

/** A hold's throne room is drawn at this scale (the pieces below are laid out for a 100px-wide room). */
const THRONE_K = 1.7;
/** A painter whose coordinates are scaled by `k` (whole-pixel rects become fine ones). */
function scaled(p: Painter, k: number): Painter {
  const q = Object.create(p) as Painter;
  q.rect = (x, y, w, h, c) => p.frect(x * k, y * k, w * k, h * k, c);
  q.frect = (x, y, w, h, c) => p.frect(x * k, y * k, w * k, h * k, c);
  q.px = (x, y, c) => p.frect(x * k, y * k, k, k, c);
  q.fpx = (x, y, c) => p.frect(x * k, y * k, k, k, c);
  q.fline = (x0, y0, x1, y1, c) => p.fline(x0 * k, y0 * k, x1 * k, y1 * k, c);
  q.ellipse = (cx, cy, rx, ry, c) => p.ellipse(cx * k, cy * k, rx * k, ry * k, c);
  q.disc = (cx, cy, r, c) => p.disc(cx * k, cy * k, r * k, c);
  return q;
}

/** The vampires' throne: a dais and a high black throne, crimson hangings, candelabra; richer by the stage. */
function vampireThrone(p0: Painter, W0: number, H0: number, stage: number): void {
  const p = scaled(p0, THRONE_K);
  const W = W0 / THRONE_K;
  const H = H0 / THRONE_K;
  const mid = W / 2;
  // the carpet and dais
  p.rect(mid - 16, H - 12, 32, 12, '#5a1020');
  const steps = Math.min(3, stage);
  for (let i = 0; i < steps; i++) p.rect(mid - 22 + i * 4, H - 12 - (i + 1) * 4, 44 - i * 8, 4, i % 2 ? '#4a4048' : '#5a505a');
  const top = H - 12 - steps * 4;
  // the throne
  p.rect(mid - 7, top - 22, 14, 22, '#17151a');
  p.rect(mid - 5, top - 20, 10, 14, '#2a262e');
  p.rect(mid - 5, top - 8, 10, 5, '#8a1424');
  p.rect(mid - 9, top - 18, 2, 14, '#17151a');
  p.rect(mid + 7, top - 18, 2, 14, '#17151a');
  if (stage >= 2) {
    p.rect(mid - 7, top - 26, 14, 4, stage >= 4 ? '#d8b050' : '#2a262e');
    p.px(mid, top - 27, '#d8b050');
  }
  // hangings either side
  for (const x of [mid - 26, mid + 20]) {
    p.rect(x, top - 30, 6, 30 + 4, '#7a1a2a');
    p.frect(x, top - 30, 6, 1, '#d8b050');
    p.frect(x + 2, top - 26, 2, 24, '#a02838');
  }
  // candelabra, more each stage
  for (let i = 0; i < Math.min(4, stage + 1); i++) {
    const x = mid + (i % 2 ? 1 : -1) * (34 + Math.floor(i / 2) * 14);
    p.rect(x, H - 24, 1, 22, '#3a3a3a');
    p.rect(x - 3, H - 24, 7, 1, '#3a3a3a');
    for (const dx of [-3, 0, 3]) {
      p.rect(x + dx, H - 27, 1, 3, '#e8e0d0');
      p.px(x + dx, H - 28, '#ffd87a');
    }
  }
  if (stage >= 3) {
    // a coffin of black wood on the dais's side
    p.rect(mid - 44, H - 14, 20, 10, '#17151a');
    p.rect(mid - 42, H - 16, 16, 3, '#2a262e');
    p.frect(mid - 44, H - 14, 20, 0.5, '#5a1020');
  }
  if (stage >= 4) {
    // columns in gold leaf
    for (const x of [mid - 54, mid + 50]) {
      p.rect(x, top - 34, 4, 34 + 8, '#4a4048');
      p.frect(x, top - 34, 1, 42, '#d8b050');
      p.rect(x - 1, top - 36, 6, 2, '#d8b050');
    }
  }
  if (stage === 5) {
    // a chandelier over all, the floor red as blood
    p.rect(mid - 40, H - 4, 80, 4, '#6a1020');
    p.rect(mid - 12, 2, 24, 2, '#d8b050');
    for (let x = mid - 12; x <= mid + 12; x += 6) p.px(x, 1, '#ffd87a');
    p.rect(mid, 4, 1, 6, '#3a3a3a');
  }
}

/** The dwarves' throne: cut from the rock, an anvil before it, the hoard heaped higher each stage. */
function dwarfThrone(p0: Painter, W0: number, H0: number, stage: number): void {
  const p = scaled(p0, THRONE_K);
  const W = W0 / THRONE_K;
  const H = H0 / THRONE_K;
  const mid = W / 2;
  const steps = Math.min(3, stage);
  for (let i = 0; i < steps; i++) p.rect(mid - 24 + i * 4, H - 10 - (i + 1) * 4, 48 - i * 8, 4, i % 2 ? '#5a5664' : '#6a6674');
  const top = H - 10 - steps * 4;
  // the throne of stone (gilded from the fourth stage)
  const seat = stage >= 4 ? '#c8a03a' : '#7d7e7a';
  p.rect(mid - 8, top - 22, 16, 22, mix(seat, '#000000', 0.3));
  p.rect(mid - 6, top - 20, 12, 13, seat);
  p.rect(mid - 6, top - 7, 12, 4, '#8a1424');
  p.rect(mid - 10, top - 16, 2, 12, mix(seat, '#000000', 0.2));
  p.rect(mid + 8, top - 16, 2, 12, mix(seat, '#000000', 0.2));
  if (stage >= 2) {
    // runes on the back, an anvil before the dais
    for (let y = top - 18; y < top - 9; y += 3) p.frect(mid - 4, y, 8, 0.5, stage >= 4 ? '#fff0c0' : GOLD);
    p.rect(mid + 20, H - 10, 10, 4, '#3a3a3a');
    p.rect(mid + 22, H - 14, 8, 4, '#5a5a5a');
    p.rect(mid + 18, H - 15, 12, 2, '#6a6a6a');
  }
  // the hearth (the first hall's heart), braziers after
  if (stage === 1) {
    p.ellipse(mid - 30, H - 8, 9, 5, '#3a3642');
    p.ellipse(mid - 30, H - 9, 6, 3, '#ffb347');
    p.ellipse(mid - 31, H - 11, 3, 2, '#ffd87a');
  } else {
    for (const x of [mid - 30, mid + 34]) {
      p.rect(x - 3, H - 8, 7, 6, '#3a3a3a');
      p.rect(x - 2, H - 11, 5, 3, '#ffb347');
      p.px(x, H - 12, '#ffd87a');
    }
  }
  // the hoard: gold heaped higher each stage, gems on it
  const heaps = Math.max(0, stage - 2);
  for (let i = 0; i < heaps * 2; i++) {
    const x = mid + (i % 2 ? 1 : -1) * (36 + Math.floor(i / 2) * 12);
    const r = 5 + stage;
    p.ellipse(x, H - 6, r, r * 0.5, '#c8a03a');
    p.ellipse(x - 1, H - 7, r * 0.6, r * 0.3, '#f0d070');
    p.px(x + 2, H - 8, i % 2 ? '#5ad0c0' : '#e0506a');
  }
  if (stage >= 3) {
    // pillars of the deep, their capitals gilded
    for (const x of [mid - 50, mid + 46]) {
      p.rect(x, top - 30, 5, 38, '#5a5664');
      p.frect(x, top - 30, 1, 38, '#8a8694');
      p.rect(x - 1, top - 32, 7, 2, stage >= 4 ? '#c8a03a' : '#8a8694');
    }
  }
  if (stage === 5) {
    // the mountain king's crown over the throne, gems set in the dais
    p.rect(mid - 5, top - 28, 10, 4, '#c8a03a');
    for (const dx of [-4, 0, 4]) p.px(mid + dx, top - 29, '#c8a03a');
    p.px(mid, top - 26, '#e0506a');
    for (let x = mid - 20; x <= mid + 20; x += 8) p.px(x, H - 12, x % 16 ? '#5ad0c0' : '#e0506a');
  }
}

(window as unknown as { __seatArt?: typeof seatArt }).__seatArt = seatArt;
(window as unknown as { __seatInterior?: typeof seatInterior }).__seatInterior = seatInterior;
