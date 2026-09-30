// Each origin builds its own way (see theme.ts for the rest of its look). Homes and walls are drawn anew for every
// origin (a lich town lives in crypts behind bone palisades, a druid grove in living trees behind hedges, a machine
// colony in pods behind plated barriers); everything else keeps its shape but is dressed in the origin's things
// (skulls and candles, vines, bats and red banners, claw marks, antennae and rivets, runes, nets and shells,
// pennants, mushrooms, flasks, heraldry).

import type { ThemeId } from '../../shared/sim/snapshot';
import type { Painter } from './pixelArt';
import { cityHome, nomadArt } from './nomadArt';

type Draw = (p: Painter, w: number, h: number) => void;
type Style = Exclude<ThemeId, 'town'>;

/** Homes by size: lean-to, tent, cottage, row houses (and their heights). */
const HOMES = ['lean_to', 'hide_tent', 'cottage', 'rowhouse'] as const;
const HOME_H = [46, 58, 62, 80];
/** Which of those sizes a home is drawn as (a longhouse as a cottage, wider). */
const homeSize = (defId: string) => (defId === 'longhouse' ? 2 : HOMES.indexOf(defId as (typeof HOMES)[number]));
/** Walls and gates by strength: palisade, then stone. */
const WALLS = ['palisade_wall', 'stone_wall'] as const;
const GATES = ['palisade_gate', 'stone_gate'] as const;
const WALL_H = [62, 70];
const GATE_H = [66, 76];
/** Headroom above every dressed building, for what's put on its roof. */
export const DECO_HEAD = 10;

/* ------------------------------------------------------------ small shapes */

/** A pitched roof from x0..x1 at base up to a peak (light left, dark right). */
function roof(p: Painter, x0: number, x1: number, base: number, peak: number, light: string, dark: string, bands = 4): void {
  const mid = (x0 + x1) / 2;
  for (let y = peak; y <= base; y++) {
    const half = (((y - peak) / Math.max(1, base - peak)) * (x1 - x0)) / 2;
    p.rect(mid - half, y, half, 1, light);
    p.rect(mid, y, half, 1, dark);
    if (bands && (y - peak) % bands === 0) p.rect(mid - half, y, half * 2, 1, dark);
  }
}

/** A dome (top half of an ellipse), lit on the left. */
function dome(p: Painter, cx: number, base: number, rx: number, ry: number, light: string, dark: string): void {
  for (let dy = 0; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    p.rect(cx - half, base - dy, half, 1, light);
    p.rect(cx, base - dy, half, 1, dark);
  }
}

/** A round-topped (or pointed) doorway or window. */
function arch(p: Painter, x: number, y: number, w: number, h: number, color: string, pointed = false): void {
  p.rect(x, y + w / 2, w, h - w / 2, color);
  for (let i = 0; i < w / 2; i++) {
    const inset = pointed ? w / 2 - i - 1 : Math.round(w / 2 - Math.sqrt((w / 2) ** 2 - (w / 2 - i - 0.5) ** 2));
    p.rect(x + inset, y + i, w - inset * 2, 1, color);
  }
}

function skull(p: Painter, x: number, y: number): void {
  p.rect(x, y, 5, 4, '#e8e0c8');
  p.rect(x + 1, y + 4, 3, 1, '#e8e0c8');
  p.px(x + 1, y + 1, '#1a1418');
  p.px(x + 3, y + 1, '#1a1418');
  p.px(x + 2, y + 3, '#8a8070');
}

function bone(p: Painter, x: number, y: number, len: number, flat = false): void {
  const c = '#e0d8c0';
  if (flat) {
    p.rect(x, y, len, 1, c);
    p.rect(x - 1, y - 1, 2, 3, c);
    p.rect(x + len - 1, y - 1, 2, 3, c);
  } else {
    p.rect(x, y, 1, len, c);
    p.rect(x - 1, y - 1, 3, 2, c);
    p.rect(x - 1, y + len - 1, 3, 2, c);
  }
}

function candle(p: Painter, x: number, y: number): void {
  p.rect(x, y, 2, 4, '#e8e0c8');
  p.px(x, y - 2, '#f0c040');
  p.px(x + 1, y - 1, '#f08030');
}

function vine(p: Painter, x: number, y0: number, y1: number, seed: number): void {
  for (let y = y0; y < y1; y++) {
    const dx = Math.round(Math.sin((y + seed) / 3) * 1.5);
    p.px(x + dx, y, '#2e5a28');
    if ((y + seed) % 4 === 0) p.rect(x + dx - 1, y, 3, 2, (y + seed) % 8 ? '#4a8a3a' : '#6aaa48');
  }
}

function bat(p: Painter, x: number, y: number): void {
  p.rect(x + 2, y + 1, 2, 2, '#1a1020');
  p.rect(x, y, 2, 2, '#2a1a30');
  p.rect(x + 4, y, 2, 2, '#2a1a30');
  p.px(x - 1, y - 1, '#2a1a30');
  p.px(x + 6, y - 1, '#2a1a30');
}

function banner(p: Painter, x: number, top: number, len: number, field: string, charge: string): void {
  p.rect(x, top - 4, 1, len + 6, '#4a3a2a'); // pole
  p.px(x, top - 5, '#e8c040');
  p.rect(x + 1, top - 3, 6, len, field);
  p.rect(x + 1, top - 3 + len, 2, 2, field); // swallowtail
  p.rect(x + 5, top - 3 + len, 2, 2, field);
  p.rect(x + 3, top, 2, 3, charge);
}

function pennant(p: Painter, x: number, top: number, color: string): void {
  p.rect(x, top - 8, 1, 10, '#6a4a2a');
  for (let i = 0; i < 4; i++) p.rect(x + 1, top - 8 + i, 6 - i * 1.5, 1, color);
  for (let i = 0; i < 3; i++) p.rect(x + 1, top - 4 + i, 4 - i * 1.5, 1, color);
}

function mushroom(p: Painter, x: number, y: number, cap: string, big = false): void {
  const r = big ? 4 : 3;
  p.rect(x - 1, y - r - 1, 2, r + 1, '#e8e0d0');
  dome(p, x, y - r - 1, r, r - 1, cap, cap);
  p.px(x - 1, y - r - 2, '#fff8f0');
  if (big) p.px(x + 2, y - r - 1, '#fff8f0');
}

function flask(p: Painter, x: number, y: number, liquid: string): void {
  p.rect(x + 1, y - 7, 2, 3, '#c8e0e8'); // neck
  p.rect(x, y - 4, 4, 4, '#c8e0e8');
  p.rect(x, y - 3, 4, 3, liquid);
  p.px(x + 1, y - 8, '#8a6a4a'); // cork
}

function shell(p: Painter, x: number, y: number): void {
  dome(p, x + 2, y, 3, 3, '#f0c8b0', '#d8a090');
  p.rect(x + 2, y - 2, 1, 3, '#c08070');
}

function net(p: Painter, x: number, y: number, w: number, h: number): void {
  for (let i = 0; i <= w; i += 3) p.rect(x + i, y, 1, h, '#a89878');
  for (let j = 0; j <= h; j += 3) p.rect(x, y + j, w, 1, '#a89878');
}

function rivets(p: Painter, x0: number, x1: number, y: number): void {
  for (let x = x0; x < x1; x += 5) p.px(x, y, '#d0d8e0');
}

function runes(p: Painter, x: number, y: number, n: number, color = '#e8b840'): void {
  for (let i = 0; i < n; i++) {
    const k = (i * 7) % 4;
    p.rect(x + i * 5, y, 1, 4, color);
    if (k === 0) p.rect(x + i * 5 + 1, y, 2, 1, color);
    if (k === 1) p.rect(x + i * 5 + 1, y + 2, 2, 1, color);
    if (k === 2) p.px(x + i * 5 + 1, y + 1, color);
    if (k === 3) p.rect(x + i * 5 - 1, y + 3, 3, 1, color);
  }
}

function shieldCrest(p: Painter, x: number, y: number, field: string, charge: string): void {
  p.rect(x, y, 7, 6, field);
  p.rect(x + 1, y + 6, 5, 1, field);
  p.rect(x + 2, y + 7, 3, 1, field);
  p.rect(x + 3, y + 1, 1, 5, charge);
  p.rect(x + 1, y + 3, 5, 1, charge);
}

function claw(p: Painter, x: number, y: number): void {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) p.px(x + i * 2 + Math.floor(j / 2), y + j, '#2a1a10');
}

function glowMotes(p: Painter, w: number, h: number, color: string, n: number, seed: number): void {
  for (let i = 0; i < n; i++) p.px((seed * 13 + i * 37) % (w - 4) + 2, h - 8 - ((seed * 7 + i * 23) % Math.max(8, h - 16)), color);
}

/* ------------------------------------------------------------ homes */

const home: Record<Style, (p: Painter, w: number, h: number, size: number) => void> = {
  // a crypt of dark stone: a steep slate roof, a door under an arch of ribs, a skull, a green-lit window
  lich: (p, w, h, size) => {
    const wallH = [20, 26, 30, 44][size];
    const x0 = 4;
    const x1 = w - 4;
    for (let y = h - wallH; y < h; y += 5) for (let x = x0 + ((y / 5) % 2 ? 0 : -3); x < x1; x += 7) p.rect(Math.max(x0, x + 1), y, Math.min(6, x1 - x - 1), 4, (x + y) % 3 ? '#4a4852' : '#5a5862');
    p.rect(x0, h - wallH, x1 - x0, 1, '#2a2830');
    roof(p, x0 - 3, x1 + 3, h - wallH, Math.max(2, h - wallH - [16, 22, 26, 30][size]), '#34303c', '#24202a');
    const doors = size >= 3 ? [w * 0.3, w * 0.7] : [w / 2];
    for (const dx of doors) {
      arch(p, dx - 5, h - 16, 10, 16, '#141018');
      for (let i = 0; i < 4; i++) bone(p, dx - 8 + i * 5, h - 18 - (i === 1 || i === 2 ? 2 : 0), 3, true); // ribs over it
      skull(p, dx - 2, h - wallH - 1 + (size >= 2 ? 2 : 0));
    }
    if (size >= 1) for (const wx of size >= 3 ? [10, w - 18] : [8]) {
      arch(p, wx, h - wallH + 4, 6, 8, '#1a1a20');
      p.rect(wx + 1, h - wallH + 8, 4, 3, '#7cf0a0');
    }
    candle(p, x0 + 1, h - 5);
    candle(p, x1 - 3, h - 5);
  },
  // a living tree: a thick trunk with a round door and a lit window, roots at its foot, a great crown of leaves
  druid: (p, w, h, size) => {
    const tw = [10, 14, 18, 22][size];
    const cx = w / 2;
    const crown = [14, 18, 20, 26][size];
    p.rect(cx - tw / 2, h - [28, 36, 40, 52][size], tw, h, '#6a4628');
    p.rect(cx - tw / 2, h - [28, 36, 40, 52][size], 2, h, '#8a6038');
    p.rect(cx + tw / 2 - 2, h - [28, 36, 40, 52][size], 2, h, '#4a3018');
    for (const r of [-1, 1]) for (let i = 0; i < 3; i++) p.rect(cx + r * (tw / 2 + i * 3), h - 3 + i, 4, 3 - i, '#5a3a20'); // roots
    arch(p, cx - 4, h - 13, 8, 13, '#2a1a0c');
    p.px(cx + 2, h - 6, '#e8c040');
    if (size >= 1) {
      p.disc(cx + tw / 2 - 5, h - 24, 2, '#f0d890');
      p.px(cx + tw / 2 - 5, h - 24, '#c8a050');
    }
    // the crown: overlapping clumps
    const top = Math.max(crown, h - [28, 36, 40, 52][size] - crown / 2);
    for (const [dx, dy, r] of [[-0.35, 0.2, 0.55], [0.35, 0.25, 0.5], [0, -0.15, 0.65], [-0.15, 0.35, 0.45], [0.2, -0.05, 0.5]] as const) {
      const rx = (w / 2 - 2) * r;
      p.ellipse(cx + dx * w * 0.8, top + dy * crown, rx, crown * r * 0.9, '#2e5a28');
      p.ellipse(cx + dx * w * 0.8 - 1, top + dy * crown - 1, rx - 2, crown * r * 0.9 - 2, '#3e7a34');
    }
    for (let i = 0; i < 8 + size * 4; i++) p.px(cx - w / 2 + 6 + ((i * 17) % (w - 12)), top - crown / 2 + ((i * 11) % crown), i % 3 ? '#6aaa48' : '#f2c6d8');
    if (size >= 2) for (let i = 0; i < 3; i++) p.disc(cx - w / 3 + i * (w / 3), top + crown * 0.6, 1, '#f0e080'); // lanterns
  },
  // a gothic house: tall and narrow, a spire with a finial, pointed windows glowing red; a tower beside it later
  vampire: (p, w, h, size) => {
    const bw = Math.round([w * 0.7, w * 0.6, w * 0.6, w * 0.55][size]);
    const x0 = size >= 3 ? 6 : (w - bw) / 2;
    const wallH = [26, 32, 34, 46][size];
    p.rect(x0, h - wallH, bw, wallH, '#4a3a4a');
    p.rect(x0, h - wallH, 2, wallH, '#5a4a5c');
    for (let y = h - wallH + 6; y < h; y += 6) p.rect(x0, y, bw, 1, '#3a2c3a');
    roof(p, x0 - 2, x0 + bw + 2, h - wallH, Math.max(6, h - wallH - [18, 22, 26, 28][size]), '#2e2232', '#1e1622', 0);
    const peakX = x0 + bw / 2;
    p.rect(peakX, Math.max(0, h - wallH - [18, 22, 26, 28][size] - 5), 1, 5, '#8a7a8a'); // finial
    p.rect(peakX - 1, Math.max(1, h - wallH - [18, 22, 26, 28][size] - 3), 3, 1, '#8a7a8a');
    arch(p, peakX - 4, h - 14, 8, 14, '#1a0e16', true);
    for (const wx of size >= 1 ? [x0 + 3, x0 + bw - 8] : [x0 + 3]) {
      arch(p, wx, h - wallH + 5, 5, 10, '#1a0e16', true);
      p.rect(wx + 1, h - wallH + 9, 3, 5, '#c83848');
    }
    if (size >= 3) {
      // a round tower with a steep cone
      const tx = x0 + bw + 4;
      const tw = w - tx - 4;
      p.rect(tx, h - 62, tw, 62, '#3e3040');
      p.rect(tx, h - 62, 2, 62, '#5a4a5c');
      roof(p, tx - 3, tx + tw + 3, h - 62, 2, '#2e2232', '#1e1622', 0);
      arch(p, tx + tw / 2 - 2, h - 50, 5, 9, '#c83848', true);
    }
    bat(p, x0 + bw - 2, Math.max(2, h - wallH - 14));
  },
  // a den: an earth mound grassed over, a dark mouth ringed with stakes, a pelt stretched to dry, bones
  werewolf: (p, w, h, size) => {
    const rx = w / 2 - 2;
    const ry = [30, 40, 44, 56][size];
    dome(p, w / 2, h, rx, ry, '#6a5438', '#4e3c28');
    for (let x = 4; x < w - 4; x++) {
      const t = (x - w / 2) / rx;
      const y = h - Math.round(ry * Math.sqrt(Math.max(0, 1 - t * t)));
      p.rect(x, y, 1, 2, x % 3 ? '#4a7a34' : '#5a8a3e'); // grass on the mound
      if (x % 5 === 0) p.px(x, y - 1, '#6a9a48');
    }
    const mw = [12, 16, 18, 22][size];
    dome(p, w / 2, h, mw / 2, mw * 0.8, '#1a120c', '#1a120c');
    for (let i = 0; i < 5; i++) {
      const x = w / 2 - mw / 2 - 2 + i * ((mw + 4) / 4);
      p.rect(x, h - mw * 0.8 - 2 + Math.abs(i - 2) * 2, 2, 6, '#c8b890'); // stakes like teeth
    }
    if (size >= 1) {
      // a pelt on a frame
      const fx = w - 18;
      p.rect(fx, h - 20, 1, 20, '#4a3020');
      p.rect(fx + 11, h - 20, 1, 20, '#4a3020');
      p.rect(fx, h - 20, 12, 1, '#4a3020');
      p.ellipse(fx + 6, h - 12, 5, 7, '#8a7a6a');
      p.ellipse(fx + 6, h - 12, 3, 5, '#a89888');
    }
    bone(p, 8, h - 3, 6, true);
    claw(p, w / 2 - rx * 0.55, h - ry * 0.55);
    if (size >= 2) skull(p, w / 2 - 2, h - mw * 0.8 - 9);
  },
  // a pod: a riveted capsule on legs, portholes lit blue, an antenna with a red light
  robot: (p, w, h, size) => {
    const bw = w - 8;
    const bh = [22, 30, 34, 50][size];
    const y0 = h - bh - 5;
    for (const lx of [8, w - 11]) p.rect(lx, h - 6, 3, 6, '#5a6470'); // legs
    p.rect(4, y0 + 6, bw, bh - 6, '#8a96a4');
    dome(p, w / 2, y0 + 6, bw / 2, Math.min(y0 + 4, 8 + size * 3), '#a8b4c0', '#7a8694');
    p.rect(4, y0 + 6, bw, 2, '#b8c4d0');
    p.rect(4, y0 + bh - 2, bw, 2, '#5a6470');
    rivets(p, 7, w - 6, y0 + 10);
    rivets(p, 7, w - 6, y0 + bh - 4);
    const ports = size >= 3 ? 4 : size + 1;
    for (let i = 0; i < ports; i++) {
      const px = 10 + (i * (bw - 16)) / Math.max(1, ports - 1 || 1) + (ports === 1 ? bw / 2 - 12 : 0);
      p.disc(px, y0 + bh / 2 + 2, 3, '#4a5460');
      p.disc(px, y0 + bh / 2 + 2, 2, '#80e0ff');
      p.px(px - 1, y0 + bh / 2 + 1, '#d0f8ff');
    }
    p.rect(w / 2 - 5, h - 16, 10, 11, '#3a4450'); // hatch
    p.rect(w / 2 - 5, h - 16, 10, 1, '#b8c4d0');
    p.px(w / 2 + 3, h - 11, '#40f080');
    const ax = w - 14;
    p.rect(ax, y0 - 6, 1, 10, '#5a6470');
    p.disc(ax, y0 - 7, 1, '#ff4040');
    if (size >= 2) p.rect(8, y0 + 1, 8, 3, '#304050'); // a solar panel
  },
  // a hall of dressed stone: a low heavy front, a great round arch with runes, a slate roof, a chimney
  dwarves: (p, w, h, size) => {
    const wallH = [20, 26, 30, 42][size];
    for (let y = h - wallH; y < h; y += 6) for (let x = (y / 6) % 2 ? 2 : -3; x < w - 2; x += 10) p.rect(Math.max(2, x + 1), y, Math.min(9, w - 3 - x), 5, (x + y) % 3 ? '#7a7068' : '#8a8078');
    p.rect(2, h - wallH - 3, w - 4, 3, '#5a524a');
    roof(p, 0, w, h - wallH - 3, h - wallH - [10, 14, 16, 20][size], '#4a5058', '#3a3e46', 3);
    const aw = [12, 14, 16, 18][size];
    arch(p, w / 2 - aw / 2 - 2, h - wallH + 2, aw + 4, wallH - 2, '#5a524a');
    arch(p, w / 2 - aw / 2, h - wallH + 4, aw, wallH - 4, '#2a2018');
    p.rect(w / 2 - 1, h - wallH + 8, 2, wallH - 8, '#4a3420'); // double door
    runes(p, w / 2 - aw / 2 - 1, h - wallH - 8, Math.max(2, Math.floor(aw / 5)));
    p.rect(w - 16, h - wallH - 16, 6, 10, '#6a625a');
    if (size >= 1) for (const wx of [6, w - 12]) {
      p.rect(wx, h - wallH + 6, 6, 6, '#2a2018');
      p.rect(wx + 1, h - wallH + 7, 4, 4, '#f0a040');
    }
  },
  // a stilt hut over the water: reed thatch, sea-green boards, a ladder, nets and shells
  merfolk: (p, w, h, size) => {
    const lift = [8, 10, 10, 12][size];
    const wallH = [14, 18, 22, 34][size];
    for (let x = 6; x < w - 4; x += Math.max(8, (w - 12) / 3)) p.rect(x, h - lift, 2, lift, '#5a4a3a'); // stilts
    p.rect(3, h - lift - 2, w - 6, 2, '#6a5a44'); // deck
    p.rect(6, h - lift - wallH - 2, w - 12, wallH, '#4a8a84');
    for (let x = 8; x < w - 6; x += 4) p.rect(x, h - lift - wallH - 2, 1, wallH, '#3a706a');
    roof(p, 0, w, h - lift - wallH - 2, Math.max(2, h - lift - wallH - [14, 18, 20, 22][size]), '#b8a060', '#8a7840', 3);
    p.rect(w / 2 - 4, h - lift - 14, 8, 12, '#1a2a2a');
    for (let y = h - lift; y < h; y += 3) p.rect(w / 2 - 3, y, 6, 1, '#6a5a44'); // ladder
    net(p, 8, h - lift - wallH + 2, 9, 9);
    shell(p, w - 14, h - lift - wallH + 2);
    if (size >= 1) shell(p, w - 20, h - lift - wallH + 5);
    if (size >= 2) {
      p.rect(w - 10, h - lift - 12, 1, 8, '#6a5a44');
      p.ellipse(w - 10, h - lift - 4, 2, 3, '#8ab0c0'); // a fish hung to dry
    }
  },
  // a yurt: a felt dome banded in colour, a painted door, the smoke ring at the crown, a pennant
  nomads: (p, w, h, size) => {
    const rx = w / 2 - 3;
    const wallH = [10, 14, 16, 22][size];
    const ry = [18, 24, 26, 34][size];
    p.rect(3, h - wallH, w - 6, wallH, '#d8c8a8');
    p.rect(3, h - wallH, 2, wallH, '#e8dcc0');
    dome(p, w / 2, h - wallH, rx, ry, '#e0d0b0', '#c0ae8c');
    p.rect(3, h - wallH - 2, w - 6, 3, '#b83a2a'); // the band
    for (let x = 5; x < w - 5; x += 4) p.px(x, h - wallH - 1, '#e8c040');
    p.rect(3, h - 5, w - 6, 1, '#3a5a9a');
    p.rect(w / 2 - 4, h - Math.min(14, wallH + 4), 8, Math.min(14, wallH + 4), '#c85030'); // door
    p.rect(w / 2 - 3, h - Math.min(12, wallH + 2), 6, 1, '#e8c040');
    p.rect(w / 2 - 3, h - wallH - ry - 1, 6, 2, '#6a4a2a'); // crown ring
    pennant(p, w / 2 + 1, h - wallH - ry - 1, '#3a6ac8');
    if (size >= 2) for (let i = 0; i < 3; i++) p.rect(8 + i * 6, h - wallH - ry * 0.55 + i, 3, 1, '#b83a2a');
  },
  // a mushroom house: a great spotted cap on a pale stem, a round door, a lit window, glowing motes
  fae: (p, w, h, size) => {
    const stemW = [12, 16, 18, 24][size];
    const stemH = [18, 24, 26, 36][size];
    const cx = w / 2;
    p.rect(cx - stemW / 2, h - stemH, stemW, stemH, '#e8e0d0');
    p.rect(cx - stemW / 2, h - stemH, 2, stemH, '#f8f0e8');
    p.rect(cx + stemW / 2 - 2, h - stemH, 2, stemH, '#c8c0b0');
    arch(p, cx - 3, h - 11, 7, 11, '#6a3a5a');
    p.px(cx + 2, h - 5, '#f0c040');
    if (size >= 1) {
      p.disc(cx + stemW / 2 - 4, h - stemH + 7, 2, '#f8e8a0');
    }
    const cap = size % 2 ? '#8a4ac8' : '#c83a3a';
    const capDark = size % 2 ? '#6a2aa0' : '#982828';
    const capR = w / 2 - 1;
    const capH = [16, 22, 24, 30][size];
    dome(p, cx, h - stemH + 2, capR, capH, cap, capDark);
    p.rect(cx - capR, h - stemH + 1, capR * 2, 2, '#f0e0d0'); // the gills' edge
    for (let i = 0; i < 4 + size * 2; i++) {
      const sx = cx - capR + 5 + ((i * 19) % Math.max(6, capR * 2 - 10));
      const t = (sx - cx) / capR;
      const sy = h - stemH + 2 - Math.round(capH * Math.sqrt(Math.max(0, 1 - t * t)) * (0.35 + ((i * 7) % 5) / 10));
      p.disc(sx, sy, i % 3 ? 1 : 2, '#fff4ec');
    }
    mushroom(p, 5, h, '#e8a0c8');
    mushroom(p, w - 5, h, '#a0c8e8');
    glowMotes(p, w, h, '#f8f0a0', 3 + size, size + 3);
  },
  // an alchemist's tower: round stone, a verdigris cone, a window bubbling green, pipes and a smoking chimney
  alchemists: (p, w, h, size) => {
    const tw = Math.round([w * 0.5, w * 0.45, w * 0.45, w * 0.4][size]);
    const tx = Math.round(w * 0.12);
    const th = [30, 40, 44, 62][size];
    p.rect(tx, h - th, tw, th, '#7a7070');
    p.rect(tx, h - th, 2, th, '#9a9090');
    p.rect(tx + tw - 2, h - th, 2, th, '#5a5050');
    for (let y = h - th + 5; y < h; y += 5) p.rect(tx, y, tw, 1, '#6a6060');
    roof(p, tx - 3, tx + tw + 3, h - th, Math.max(2, h - th - [14, 16, 18, 20][size]), '#4a9a80', '#2a7a60', 0);
    arch(p, tx + tw / 2 - 3, h - 12, 7, 12, '#2a2020');
    arch(p, tx + tw / 2 - 3, h - th + 6, 6, 8, '#2a2a20');
    p.rect(tx + tw / 2 - 2, h - th + 10, 4, 3, '#80f060'); // bubbling
    p.px(tx + tw / 2, h - th + 8, '#c0ff90');
    // a lean-to lab with a chimney and pipes
    const lx = tx + tw;
    const lw = w - lx - 2;
    if (lw > 6) {
      p.rect(lx, h - 16, lw, 16, '#8a6a4a');
      roof(p, lx - 1, lx + lw + 1, h - 16, h - 22, '#6a5a4a', '#4a3a2a', 0);
      flask(p, lx + 2, h - 2, '#80f060');
      if (lw > 12) flask(p, lx + 8, h - 2, '#e060c0');
    }
    p.rect(tx + tw - 5, h - th - 10, 4, 10, '#5a5050');
    p.disc(tx + tw - 3, h - th - 13, 2, '#a0e090'); // green smoke
    p.disc(tx + tw - 1, h - th - 17, 1.5, '#c0f0b0');
    p.rect(tx - 3, h - th / 2, 3, 2, '#b08040'); // a copper pipe
    p.rect(tx - 3, h - th / 2, 2, th / 2, '#b08040');
  },
  // a keep: square stone with battlements, arrow slits, a banded door, a banner with the Order's arms
  knights: (p, w, h, size) => {
    const kw = [w - 10, w - 14, w - 16, w * 0.6][size];
    const kx = (w - kw) / 2 - (size >= 3 ? w * 0.12 : 0);
    const kh = [24, 32, 36, 60][size];
    for (let y = h - kh; y < h; y += 5) for (let x = kx + ((y / 5) % 2 ? 0 : -4); x < kx + kw; x += 8) p.rect(Math.max(kx, x + 1), y, Math.min(7, kx + kw - x - 1), 4, (x + y) % 3 ? '#8a8a90' : '#9a9aa2');
    for (let x = kx; x < kx + kw; x += 6) p.rect(x, h - kh - 4, 4, 4, '#8a8a90'); // battlements
    arch(p, kx + kw / 2 - 5, h - 16, 10, 16, '#4a3420');
    for (let y = h - 12; y < h; y += 4) p.rect(kx + kw / 2 - 5, y, 10, 1, '#2a2a30');
    for (const sx of [kx + 4, kx + kw - 6]) p.rect(sx, h - kh + 6, 2, 7, '#1a1a20'); // arrow slits
    shieldCrest(p, kx + kw / 2 - 3, h - kh + 4, '#3050a0', '#e8c040');
    banner(p, kx + kw - 3, h - kh - 12, 10, '#3050a0', '#e8c040');
    if (size >= 3) {
      // a hall beside the keep
      const hx = kx + kw;
      const hw = w - hx - 2;
      p.rect(hx, h - 30, hw, 30, '#a09a8a');
      roof(p, hx - 2, hx + hw + 2, h - 30, h - 44, '#8a3a30', '#6a2a24');
      for (let x = hx + 4; x < hx + hw - 4; x += 8) arch(p, x, h - 24, 5, 9, '#2a2a30');
    }
  },
};

/* ------------------------------------------------------------ walls and gates */

const wall: Record<Style, (p: Painter, w: number, h: number, strong: boolean, gate: boolean) => void> = {
  lich: (p, w, h, strong, gate) => {
    if (strong) {
      for (let y = 10; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : -4; x < w; x += 8) p.rect(x + 1, y, 7, 5, (x + y) % 3 ? '#44424c' : '#54525c');
      for (let x = 0; x < w; x += 10) p.rect(x, 2, 6, 8, '#44424c');
      for (let x = 3; x < w - 5; x += 16) skull(p, x, 22);
    } else {
      for (let x = 2; x < w - 2; x += 5) {
        bone(p, x + 1, 10, h - 12);
        if (x % 10 === 2) skull(p, x - 1, 2);
      }
      bone(p, 0, 24, w, true);
      bone(p, 0, h - 16, w, true);
    }
    if (gate) {
      arch(p, w / 2 - 9, h - 36, 18, 36, '#1a1418');
      for (let x = w / 2 - 7; x < w / 2 + 7; x += 4) p.rect(x, h - 30, 1, 30, '#8a8070'); // a portcullis of bone
      skull(p, w / 2 - 2, h - 42);
    }
  },
  druid: (p, w, h, strong, gate) => {
    if (strong) {
      for (let y = 10; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : -4; x < w; x += 8) p.rect(x + 1, y, 7, 5, (x + y) % 3 ? '#6b6763' : '#8b8680');
      for (let x = 2; x < w; x += 5) vine(p, x, 6, h - (x % 3) * 8, x);
    } else {
      for (let x = 0; x < w; x += 3) {
        const top = 8 + ((x * 7) % 5);
        p.rect(x, top, 3, h - top, (x / 3) % 2 ? '#2e5a28' : '#3a6a30');
        p.px(x + 1, top - 1, '#4a8a3a');
        if ((x * 5) % 11 === 0) p.px(x + 1, top + 10, '#f2c6d8'); // flowers
        if ((x * 3) % 7 === 0) p.px(x, top + 20, '#c8e080'); // thorns
      }
    }
    if (gate) {
      arch(p, w / 2 - 9, h - 38, 18, 38, '#1a2a14');
      for (let i = 0; i < 18; i++) p.px(w / 2 - 9 + ((i * 7) % 18), h - 38 + ((i * 5) % 10), '#6aaa48');
    }
  },
  vampire: (p, w, h, strong, gate) => {
    p.rect(0, h - (strong ? 22 : 14), w, strong ? 22 : 14, '#3e3040');
    p.rect(0, h - (strong ? 22 : 14), w, 1, '#5a4a5c');
    if (strong) {
      for (let x = 2; x < w - 6; x += 10) arch(p, x, 14, 7, h - 40, '#2a1e2e', true);
      p.rect(0, 10, w, 4, '#3e3040');
    }
    for (let x = 1; x < w; x += 4) {
      p.rect(x, 8, 1, h - 20, '#1a121e'); // iron railings
      p.rect(x - 1, 6, 3, 2, '#1a121e');
      p.px(x, 4, '#1a121e');
    }
    p.rect(0, 16, w, 1, '#1a121e');
    if (gate) {
      p.rect(w / 2 - 10, h - 44, 20, 44, '#1a121e');
      for (let x = w / 2 - 8; x < w / 2 + 8; x += 3) p.rect(x, h - 42, 1, 40, '#3e3040');
      bat(p, w / 2 - 3, h - 52);
      p.disc(w / 2, h - 30, 3, '#c83848');
    }
  },
  werewolf: (p, w, h, strong, gate) => {
    for (let x = 1; x < w - 1; x += 6) {
      p.rect(x, 8, 5, h - 8, strong ? '#5a5048' : '#5a3a22');
      p.rect(x, 8, 1, h - 8, strong ? '#7a7068' : '#77502f');
      for (let i = 0; i < 3; i++) p.rect(x + i, 8 - (3 - i) * 2, 5 - i * 2, 2, '#c8b890'); // bone-tipped
    }
    p.rect(0, 22, w, 3, '#3b2616');
    for (let x = 4; x < w - 10; x += 14) {
      p.ellipse(x + 4, 34, 4, 6, '#8a7a6a'); // pelts hung on it
      p.ellipse(x + 4, 34, 2, 4, '#a89888');
    }
    claw(p, w - 10, h - 20);
    if (gate) {
      dome(p, w / 2, h, 10, 30, '#1a120c', '#1a120c');
      skull(p, w / 2 - 2, h - 36);
    }
  },
  robot: (p, w, h, strong, gate) => {
    const top = strong ? 4 : 10;
    p.rect(0, top, w, h - top, strong ? '#6a7684' : '#8a96a4');
    p.rect(0, top, w, 2, '#b8c4d0');
    for (let x = 0; x < w; x += 8) p.rect(x, top, 1, h - top, '#5a6470');
    rivets(p, 3, w, top + 5);
    rivets(p, 3, w, h - 6);
    for (let x = 0; x < w; x += 6) p.rect(x, h - 12, 3, 4, '#e8c040'); // hazard stripes
    for (let x = 3; x < w; x += 6) p.rect(x, h - 12, 3, 4, '#2a2a30');
    if (strong) for (let y = top + 10; y < h - 16; y += 8) p.rect(2, y, w - 4, 1, '#80e0ff');
    if (gate) {
      p.rect(w / 2 - 9, h - 40, 18, 40, '#3a4450');
      p.rect(w / 2, h - 40, 1, 40, '#80e0ff');
      p.disc(w / 2 + 5, h - 24, 1, '#40f080');
    }
  },
  dwarves: (p, w, h, strong, gate) => {
    for (let y = 8; y < h; y += (strong ? 6 : 7)) for (let x = (y / 6) % 2 ? 0 : -5; x < w; x += strong ? 10 : 7) p.rect(x + 1, y, (strong ? 9 : 6), (strong ? 5 : 6), (x + y) % 3 ? '#7a7068' : '#8a8078');
    for (let x = 0; x < w; x += 10) p.rect(x, 0, 7, 8, '#6a625a');
    runes(p, 3, h / 2, Math.floor((w - 6) / 5));
    if (gate) {
      arch(p, w / 2 - 11, h - 42, 22, 42, '#5a524a');
      arch(p, w / 2 - 9, h - 40, 18, 40, '#3a2818');
      for (let y = h - 30; y < h; y += 8) p.rect(w / 2 - 9, y, 18, 2, '#8a8a90');
    }
  },
  merfolk: (p, w, h, strong, gate) => {
    for (let x = 1; x < w - 1; x += 5) {
      const top = 6 + ((x * 3) % 7);
      p.rect(x, top, 4, h - top, (x / 5) % 3 ? '#8a7a64' : '#a08a70'); // driftwood
      if (strong && (x * 7) % 3 === 0) p.rect(x, top - 4, 3, 5, '#e88a7a'); // coral tips
    }
    net(p, 2, 18, w - 4, 16);
    for (let x = 4; x < w - 4; x += 9) shell(p, x, 42);
    if (gate) {
      p.rect(w / 2 - 9, h - 36, 18, 36, '#1a3a3a');
      net(p, w / 2 - 8, h - 34, 16, 30);
    }
  },
  nomads: (p, w, h, strong, gate) => {
    for (const x of [1, w - 4, w / 2 - 1]) p.rect(x, 4, 3, h - 4, '#6a4a2a');
    const colors = ['#b83a2a', '#3a6ac8', '#e8c040'];
    for (let y = 10; y < h - 4; y += 10) {
      p.rect(3, y, w - 6, 9, strong ? '#c8b894' : '#d8c8a8'); // hide screens
      for (let x = 5; x < w - 6; x += 6) p.rect(x, y + 4, 3, 1, colors[((x + y) / 6) % 3 | 0]);
    }
    pennant(p, 2, 6, '#b83a2a');
    if (gate) {
      p.rect(w / 2 - 9, h - 34, 18, 34, '#3a2a1c');
      p.rect(w / 2 - 9, h - 34, 18, 3, '#b83a2a');
    }
  },
  fae: (p, w, h, strong, gate) => {
    for (let x = 0; x < w; x += 2) {
      const top = 6 + Math.round(Math.abs(Math.sin(x / 3)) * 8);
      p.rect(x, top, 2, h - top, (x / 2) % 2 ? '#3a2a3a' : '#4a3048');
      if ((x * 7) % 5 === 0) p.px(x, top + 6, '#a0e080'); // thorns
    }
    for (let i = 0; i < 6; i++) p.disc(3 + ((i * 17) % (w - 6)), 12 + ((i * 13) % (h - 24)), 1, i % 2 ? '#f0a0e0' : '#a0e0f0');
    if (strong) glowMotes(p, w, h, '#f8f0a0', 6, 4);
    mushroom(p, 4, h, '#c83a3a', true);
    if (gate) {
      arch(p, w / 2 - 9, h - 38, 18, 38, '#1a0e1a');
      glowMotes(p, w, h, '#f8f0a0', 4, 9);
    }
  },
  alchemists: (p, w, h, strong, gate) => {
    for (let y = 8; y < h; y += 4) for (let x = (y / 4) % 2 ? -3 : 0; x < w; x += 7) p.rect(Math.max(0, x + 1), y + 1, 6, 3, (x + y) % 4 ? '#8a6a5a' : '#a47a64');
    p.rect(0, 6, w, 3, '#5a4a4a');
    p.rect(2, 16, w - 4, 2, '#b08040'); // a copper pipe along it
    for (let x = 6; x < w; x += 12) p.rect(x, 12, 3, 6, '#b08040');
    if (strong) for (let x = 4; x < w - 4; x += 12) flask(p, x, 6, x % 24 ? '#80f060' : '#e060c0');
    p.disc(w - 5, 2, 2, '#a0e090');
    if (gate) {
      p.rect(w / 2 - 9, h - 38, 18, 38, '#3a2a20');
      p.rect(w / 2 - 9, h - 38, 18, 2, '#b08040');
      p.disc(w / 2, h - 22, 2, '#80f060');
    }
  },
  knights: (p, w, h, strong, gate) => {
    if (strong) {
      for (let y = 10; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : -4; x < w; x += 8) p.rect(x + 1, y, 7, 5, (x + y) % 3 ? '#8a8a90' : '#9a9aa2');
      for (let x = 0; x < w; x += 10) p.rect(x, 2, 6, 8, '#8a8a90');
    } else {
      for (let x = 1; x < w - 1; x += 6) {
        p.rect(x, 6, 6, h - 6, '#5a3a22');
        p.rect(x, 6, 1, h - 6, '#77502f');
        for (let i = 0; i < 3; i++) p.rect(x + i, 6 - (3 - i) * 2, 6 - i * 2, 2, '#77502f');
      }
      p.rect(0, 20, w, 3, '#3b2616');
    }
    for (let x = 3; x < w - 7; x += 14) shieldCrest(p, x, 28, x % 28 === 3 ? '#3050a0' : '#a03030', '#e8c040');
    if (gate) {
      arch(p, w / 2 - 10, h - 42, 20, 42, '#4a3420');
      for (let y = h - 32; y < h; y += 8) p.rect(w / 2 - 10, y, 20, 2, '#2a2a30');
      banner(p, w / 2, h - 60, 10, '#3050a0', '#e8c040');
    }
  },
};

/* ------------------------------------------------------------ dressing for everything else */

/** The first opaque row in a column (the building's roofline), or -1. */
function topAt(p: Painter, x: number): number {
  const col = p.ctx.getImageData(Math.round(x), 0, 1, p.height).data;
  for (let y = 0; y < p.height; y++) if (col[y * 4 + 3] > 40) return y;
  return -1;
}

const dress: Record<Style, (p: Painter, w: number, h: number, peak: number, seed: number) => void> = {
  lich: (p, w, h, peak) => {
    skull(p, w / 2 - 2, peak - 6);
    candle(p, 3, h - 5);
    candle(p, w - 5, h - 5);
    bone(p, 6, h - 2, 6, true);
    p.rect(w - 14, h - 4, 6, 4, '#4a4852'); // a headstone
    p.rect(w - 13, h - 6, 4, 2, '#4a4852');
  },
  druid: (p, w, h, peak, seed) => {
    vine(p, 2, peak + 4, h, seed);
    vine(p, w - 3, peak + 8, h, seed + 5);
    for (let i = 0; i < 5; i++) p.rect(w / 2 - 8 + i * 4, peak - 1 + (i % 2), 3, 2, '#4a8a3a'); // moss on the roof
    p.disc(w / 2, peak - 2, 1, '#f2c6d8');
  },
  vampire: (p, w, h, peak) => {
    bat(p, w / 2 + 6, Math.max(2, peak - 6));
    bat(p, w / 2 - 12, Math.max(2, peak - 3));
    banner(p, 3, Math.max(8, peak + 6), 10, '#8a1a2a', '#1a0e16');
    p.disc(w - 5, h - 3, 2, '#c83848'); // a red lamp
  },
  werewolf: (p, w, h, peak) => {
    claw(p, 6, h - 16);
    claw(p, w - 12, h - 20);
    skull(p, w / 2 - 2, peak - 6);
    p.ellipse(w - 6, h - 6, 3, 5, '#8a7a6a');
  },
  robot: (p, w, h, peak) => {
    p.rect(w / 2, peak - 8, 1, 8, '#5a6470');
    p.disc(w / 2, peak - 9, 1, '#ff4040');
    rivets(p, 3, w - 3, h - 3);
    p.rect(0, h - 10, 3, 10, '#5a6470'); // a cable box
    p.rect(1, h - 8, 1, 1, '#40f080');
    p.rect(w - 3, h - 14, 1, 14, '#2a2a30'); // a cable
  },
  dwarves: (p, w, h, peak) => {
    for (let x = 0; x < w; x += 8) p.rect(x, h - 4, 7, 4, (x / 8) % 2 ? '#7a7068' : '#8a8078'); // a stone footing
    runes(p, 4, h - 12, 2);
    runes(p, w - 12, h - 12, 2);
    p.rect(w / 2 - 1, peak - 4, 3, 4, '#e8b840');
  },
  merfolk: (p, w, h, peak) => {
    net(p, 2, h - 18, 10, 10);
    shell(p, w - 10, h - 1);
    shell(p, w / 2 - 2, peak + 3);
    p.rect(w - 5, h - 16, 1, 8, '#6a5a44');
    p.ellipse(w - 5, h - 7, 2, 3, '#8ab0c0');
  },
  nomads: (p, w, h, peak) => {
    pennant(p, w / 2, peak, '#b83a2a');
    p.rect(3, h - 3, 14, 3, '#b83a2a'); // a rug laid out
    for (let x = 4; x < 16; x += 3) p.px(x, h - 2, '#e8c040');
    p.ellipse(w - 8, h - 4, 4, 4, '#8a6a3a'); // a pot
  },
  fae: (p, w, h, peak, seed) => {
    mushroom(p, 4, h, '#c83a3a', true);
    mushroom(p, 10, h, '#e8a0c8');
    mushroom(p, w - 6, h, '#8a4ac8', true);
    glowMotes(p, w, Math.max(20, h), '#f8f0a0', 5, seed);
    p.disc(w / 2, peak - 2, 1, '#f0a0e0');
  },
  alchemists: (p, w, h, peak) => {
    flask(p, 3, h, '#80f060');
    flask(p, 8, h, '#e060c0');
    flask(p, w - 8, h, '#60a0f0');
    p.disc(w / 2 + 3, peak - 4, 2, '#a0e090'); // green smoke
    p.disc(w / 2 + 5, peak - 8, 1.5, '#c0f0b0');
  },
  knights: (p, w, h, peak) => {
    banner(p, w - 8, Math.max(8, peak + 2), 10, '#3050a0', '#e8c040');
    shieldCrest(p, 3, h - 16, '#a03030', '#e8c040');
  },
};

/** The usual building materials (thatch, plaster, brick, timber, lit windows), and what each origin builds with
 *  instead: [thatch, thatch dark, plaster, plaster light, brick, brick dark, brick light, timber, timber light,
 *  timber dark, window]. */
const MATERIALS = ['#b89a58', '#8a7040', '#d8c8a8', '#e8dcc0', '#a4543a', '#6a3424', '#bc6a48', '#5a3a22', '#77502f', '#3b2616', '#f0d890'];
const SWAP: Record<Style, string[]> = {
  lich: ['#34303c', '#24202a', '#6a6872', '#7a7882', '#4a4852', '#2a2830', '#5a5862', '#3a3440', '#4a4450', '#1e1a22', '#7cf0a0'],
  druid: ['#4a7a34', '#2e5a28', '#c8b890', '#d8c8a0', '#7a6a48', '#4a3a28', '#8a7a58', '#6a4628', '#8a6038', '#4a3018', '#f0e080'],
  vampire: ['#2e2232', '#1e1622', '#5a4a5c', '#6a5a6c', '#4a3a4a', '#2a1e2e', '#5e4a5e', '#2a1e22', '#3e2e32', '#140c10', '#c83848'],
  werewolf: ['#6a5438', '#4e3c28', '#a89878', '#b8a888', '#6a5a48', '#3e3228', '#7a6a58', '#4a3220', '#6a4a30', '#2a1a10', '#e0a050'],
  robot: ['#8a96a4', '#5a6470', '#b8c4d0', '#c8d4e0', '#6a7684', '#3a4450', '#7a8694', '#4a5460', '#6a7480', '#2a3038', '#80e0ff'],
  dwarves: ['#4a5058', '#3a3e46', '#8a8078', '#9a9088', '#7a7068', '#4a4440', '#8a8078', '#4a3a2a', '#5a4a3a', '#2a2018', '#f0a040'],
  merfolk: ['#b8a060', '#8a7840', '#4a8a84', '#5a9a94', '#3a706a', '#2a5450', '#4a807a', '#8a7a64', '#a08a70', '#5a4a3a', '#a0f0e0'],
  nomads: ['#c8b894', '#a89470', '#e0d0b0', '#ecdcc0', '#b83a2a', '#7a2a1e', '#c85030', '#6a4a2a', '#8a6a3a', '#3a2a1a', '#f0c060'],
  fae: ['#8a4ac8', '#6a2aa0', '#e8e0d0', '#f8f0e8', '#c83a3a', '#982828', '#e05a5a', '#6a5a8a', '#8a7aaa', '#3a2a4a', '#f8f0a0'],
  alchemists: ['#4a9a80', '#2a7a60', '#9a9090', '#aaa0a0', '#8a6a5a', '#5a4040', '#a47a64', '#6a5a4a', '#8a6a4a', '#3a2a20', '#80f060'],
  knights: ['#8a3a30', '#6a2a24', '#a09a8a', '#b0aa9a', '#8a8a90', '#5a5a64', '#9a9aa2', '#4a3420', '#6a4a2a', '#2a1e14', '#f0d890'],
};

/** Swap the usual materials for the origin's (exact colours only: everything else is left alone). */
function reclad(p: Painter, st: Style): void {
  const img = p.ctx.getImageData(0, 0, p.width, p.height);
  const d = img.data;
  const rgb = (hex: string) => parseInt(hex.slice(1), 16);
  const map = new Map(MATERIALS.map((m, i) => [rgb(p.toned(m)), rgb(p.toned(SWAP[st][i]))]));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const to = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (to === undefined) continue;
    d[i] = to >> 16;
    d[i + 1] = (to >> 8) & 255;
    d[i + 2] = to & 255;
  }
  p.ctx.putImageData(img, 0, 0);
}

/** How to draw a building in an origin's style: its own art (homes, walls, gates), or the usual art dressed in the
 *  origin's things. Null for buildings the style leaves as they are (fields, the campfire). */
export function styled(style: string, defId: string): { h?: number; draw?: Draw; dress?: (p: Painter, w: number, h: number) => void } | null {
  // (the Nomad Caravan: its tents while it wanders, its adobe once it settles into a caravan city: nomadArt.ts)
  const city = style === 'nomads_city';
  if (city) style = 'nomads';
  if (style === 'nomads') {
    const own = nomadArt(defId, city);
    if (own) return own;
    const hi = homeSize(defId);
    if (city && hi >= 0) return { h: HOME_H[hi], draw: (p, w, h) => cityHome(p, w, h, hi) };
  }
  if (style === 'town' || !(style in home)) return null;
  const st = style as Style;
  const hi = homeSize(defId);
  if (hi >= 0) return { h: HOME_H[hi], draw: (p, w, h) => home[st](p, w, h, hi) };
  const wi = WALLS.indexOf(defId as (typeof WALLS)[number]);
  if (wi >= 0) return { h: WALL_H[wi], draw: (p, w, h) => wall[st](p, w, h, wi === 1, false) };
  const gi = GATES.indexOf(defId as (typeof GATES)[number]);
  if (gi >= 0) return { h: GATE_H[gi], draw: (p, w, h) => wall[st](p, w, h, gi === 1, true) };
  if (UNDRESSED.has(defId)) return null;
  return {
    dress: (p, w, h) => {
      reclad(p, st);
      const peak = topAt(p, w / 2);
      dress[st](p, w, h, peak < 0 ? h - 10 : peak, defId.length);
    },
  };
}

/** Left as they are: fields and gardens (the crop is the look), the campfire, traps, and what's too small to dress. */
const UNDRESSED = new Set(['campfire', 'garden_plot', 'herb_garden', 'spike_trap', 'graveyard', 'well', 'drying_rack', 'tanning_rack', 'stockpile', 'palisade_wall', 'stone_wall', 'brick_wall', 'concrete_wall', 'force_wall']);
