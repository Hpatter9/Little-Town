// The town's boats, painted (no pack has a whole working boat; the Seabed pack's two ships are wrecks, and stand for
// wrecks). Side-on, the bow to the right, the waterline at the picture's foot: a dugout log, a longboat with its
// striped square sail and shields, a carrack with two masts and a high stern, a paddle steamer with its funnel, a
// motor launch with its wheelhouse, a hydrofoil up on its foils. Drawn small for the map (moored by the boatyard)
// and long for the watched voyage (the party stands on her deck): `boatArt(kind, length)`.

import type { BoatKind } from '../../shared/data/boats';
import { mixHex as mix, noTone, paint, type Painter, type PixelArt } from './pixelArt';

interface Look {
  hull: [string, string];
  trim: string;
  /** The hull's depth and the deck's height above the water, as shares of the length. */
  depth: number;
}
const LOOKS: Record<BoatKind, Look> = {
  dugout: { hull: ['#8a5a32', '#5a3a1e'], trim: '#a8784a', depth: 0.16 },
  longboat: { hull: ['#9a6a3a', '#5e3e22'], trim: '#c8a060', depth: 0.17 },
  carrack: { hull: ['#7a4e2a', '#4a2e18'], trim: '#c8a050', depth: 0.2 },
  steamer: { hull: ['#3a3e46', '#22252c'], trim: '#a83a2a', depth: 0.18 },
  motor_launch: { hull: ['#e8e4dc', '#9a9890'], trim: '#2a5a8a', depth: 0.15 },
  hydrofoil: { hull: ['#c8d4dc', '#6a7a86'], trim: '#2ab0c0', depth: 0.12 },
};

const cache = new Map<string, PixelArt>();

/** A boat `length` px long, side-on, the bow to the right, the waterline at the foot. */
export function boatArt(kind: BoatKind, length: number): PixelArt {
  const key = `${kind}|${length}`;
  let art = cache.get(key);
  if (art) return art;
  const look = LOOKS[kind];
  const L = Math.max(16, Math.round(length));
  const hullH = Math.max(4, Math.round(L * look.depth));
  // (room above for masts, sails and funnels, and below for a hydrofoil's struts)
  const above = kind === 'carrack' ? Math.round(L * 0.75) : kind === 'longboat' ? Math.round(L * 0.6) : kind === 'steamer' ? Math.round(L * 0.42) : kind === 'dugout' ? Math.round(L * 0.12) : Math.round(L * 0.3);
  const below = kind === 'hydrofoil' ? Math.round(L * 0.1) : 0;
  const W = L + 4;
  const H = above + hullH + below;
  art = paint(W, H, noTone, (p) => {
    const deckY = above;
    const waterY = above + hullH;
    hull(p, look, 2, deckY, L, hullH, kind);
    switch (kind) {
      case 'dugout':
        paddle(p, Math.round(L * 0.3), deckY, hullH);
        break;
      case 'longboat':
        mastAndSquareSail(p, 2 + Math.round(L * 0.48), deckY, Math.round(L * 0.55), Math.round(L * 0.34), ['#e8e0cc', '#b83a2a']);
        for (let x = 2 + Math.round(L * 0.18); x < 2 + L * 0.8; x += Math.max(4, Math.round(L * 0.09))) shield(p, x, deckY + 1, Math.max(2, Math.round(L * 0.035)));
        prow(p, 2 + L - 2, deckY, Math.round(L * 0.1), look.trim);
        break;
      case 'carrack':
        castle(p, 2, deckY, Math.round(L * 0.24), Math.round(L * 0.1), look);
        mastAndSquareSail(p, 2 + Math.round(L * 0.58), deckY, Math.round(L * 0.7), Math.round(L * 0.3), ['#ece4cc', '#d8ccb0']);
        mastAndSquareSail(p, 2 + Math.round(L * 0.32), deckY - Math.round(L * 0.1), Math.round(L * 0.5), Math.round(L * 0.22), ['#ece4cc', '#d8ccb0']);
        flag(p, 2 + Math.round(L * 0.58), deckY - Math.round(L * 0.7), Math.round(L * 0.08), '#b83a2a');
        break;
      case 'steamer':
        cabin(p, 2 + Math.round(L * 0.25), deckY, Math.round(L * 0.45), Math.round(L * 0.1), '#e8e0d0', '#8a8478');
        funnel(p, 2 + Math.round(L * 0.48), deckY - Math.round(L * 0.1), Math.round(L * 0.07), Math.round(L * 0.3));
        wheel(p, 2 + Math.round(L * 0.5), waterY - Math.round(hullH * 0.45), Math.round(hullH * 0.9));
        break;
      case 'motor_launch':
        cabin(p, 2 + Math.round(L * 0.45), deckY, Math.round(L * 0.3), Math.round(L * 0.16), '#f0ece4', '#a8a49c', true);
        p.rect(2 + Math.round(L * 0.62), deckY - Math.round(L * 0.26), 1, Math.round(L * 0.1), '#6a6a6a'); // (the aerial)
        break;
      case 'hydrofoil':
        cabin(p, 2 + Math.round(L * 0.35), deckY, Math.round(L * 0.45), Math.round(L * 0.14), '#e8eef2', '#7a8a96', true);
        for (const fx of [0.25, 0.75]) {
          const x = 2 + Math.round(L * fx);
          p.rect(x, waterY, 2, below, '#6a7a86');
          p.rect(x - Math.round(L * 0.05), waterY + below - 2, Math.round(L * 0.1) + 2, 2, '#8a9aa6');
        }
        break;
    }
  });
  cache.set(key, art);
  return art;
}

/** The hull: deeper amidships, curving up to the bow and stern, planked, a lit gunwale. */
function hull(p: Painter, look: Look, x0: number, deckY: number, L: number, h: number, kind: BoatKind): void {
  const [light, dark] = look.hull;
  for (let i = 0; i < L; i++) {
    const t = i / (L - 1);
    // (the keel line rises to each end: more sharply at the bow)
    const rise = t > 0.75 ? ((t - 0.75) / 0.25) ** 2 : t < 0.15 ? ((0.15 - t) / 0.15) ** 2 * 0.6 : 0;
    const top = deckY - (kind === 'longboat' || kind === 'carrack' ? Math.round(rise * h * 0.6) : 0);
    const bottom = deckY + Math.round(h * (1 - rise * 0.85));
    for (let y = top; y < bottom; y++) {
      const u = (y - top) / Math.max(1, bottom - top);
      p.frect(x0 + i, y, 1, 1, mix(light, dark, 0.15 + u * 0.6));
    }
    p.frect(x0 + i, top, 1, 1, look.trim);
    if (kind !== 'motor_launch' && kind !== 'hydrofoil' && kind !== 'steamer') for (let y = top + 3; y < bottom - 1; y += 3) p.frect(x0 + i, y, 1, 0.5, mix(dark, '#000000', 0.2));
  }
  // the waterline's shadow and a foam lick at the bow
  p.frect(x0 + 2, deckY + h - 1, L - 4, 1, mix(dark, '#000000', 0.35));
  if (kind === 'steamer' || kind === 'motor_launch' || kind === 'hydrofoil') p.frect(x0 + 2, deckY + Math.round(h * 0.45), L - 6, 1, look.trim);
}

function paddle(p: Painter, x: number, deckY: number, h: number): void {
  p.fline(x, deckY - 3, x + 5, deckY + h + 1, '#6a4428');
  p.rect(x + 4, deckY + h - 1, 2, 3, '#8a5a32');
}

function mastAndSquareSail(p: Painter, x: number, deckY: number, height: number, width: number, colours: [string, string]): void {
  p.rect(x, deckY - height, 2, height, '#4a3018');
  const top = deckY - height + 3;
  const h = Math.round(height * 0.62);
  p.rect(x - Math.round(width / 2) - 1, top - 1, width + 4, 2, '#4a3018'); // (the yard)
  for (let y = 0; y < h; y++) {
    // (bellied out a little in the middle)
    const belly = Math.round(Math.sin((y / h) * Math.PI) * 2);
    const stripe = Math.floor((y / h) * 5) % 2 === 1;
    p.frect(x - Math.round(width / 2) + 1, top + 1 + y, width + belly, 1, stripe ? colours[1] : colours[0]);
  }
  p.frect(x - Math.round(width / 2) + 1, top + h, width, 1, mix(colours[0], '#000000', 0.25));
}

function shield(p: Painter, x: number, y: number, r: number): void {
  p.disc(x, y, r, '#b8a060');
  p.disc(x, y, Math.max(1, r - 1), x % 2 ? '#b83a2a' : '#2a5a8a');
  p.px(x, y, '#d8c890');
}

function prow(p: Painter, x: number, deckY: number, size: number, colour: string): void {
  for (let i = 0; i < size; i++) p.frect(x + Math.round(Math.sin((i / size) * 1.4) * 2), deckY - i, 2, 1, colour);
  p.disc(x + 3, deckY - size, 2, colour);
}

function castle(p: Painter, x: number, deckY: number, w: number, h: number, look: Look): void {
  p.rect(x + 1, deckY - h, w, h, look.hull[0]);
  p.rect(x + 1, deckY - h, w, 1, look.trim);
  for (let wx = x + 3; wx < x + w - 2; wx += 4) p.rect(wx, deckY - h + 2, 2, 2, '#f0d890');
}

function flag(p: Painter, x: number, y: number, size: number, colour: string): void {
  p.rect(x, y - 2, 1, 3, '#4a3018');
  for (let i = 0; i < size; i++) p.frect(x + 1 + i, y - 2 + Math.round(Math.sin(i * 0.8)), 1, 3, colour);
}

function cabin(p: Painter, x: number, deckY: number, w: number, h: number, light: string, dark: string, glass = false): void {
  p.rect(x, deckY - h, w, h, light);
  p.rect(x, deckY - h, w, 1, mix(light, '#ffffff', 0.4));
  p.rect(x + w - 1, deckY - h, 1, h, dark);
  const ww = glass ? Math.max(3, Math.round(w * 0.22)) : 2;
  for (let wx = x + 2; wx < x + w - ww; wx += ww + 2) p.rect(wx, deckY - h + 2, ww, Math.max(2, Math.round(h * 0.4)), glass ? '#2a3a4a' : '#f0d890');
}

function funnel(p: Painter, x: number, deckY: number, w: number, h: number): void {
  p.rect(x, deckY - h, w, h, '#222428');
  p.rect(x, deckY - h + Math.round(h * 0.25), w, Math.max(2, Math.round(h * 0.15)), '#a83a2a');
  p.rect(x, deckY - h, w, 1, '#4a4c52');
}

function wheel(p: Painter, cx: number, cy: number, r: number): void {
  p.disc(cx, cy, r, '#5a3a22');
  p.disc(cx, cy, Math.max(1, r - 2), '#2a2a2e');
  for (let a = 0; a < 8; a++) p.fline(cx, cy, cx + Math.cos((a * Math.PI) / 4) * (r - 1), cy + Math.sin((a * Math.PI) / 4) * (r - 1), '#8a5a32');
}

/** How long a boat is drawn on the map (px), by kind: the canoe a cell, the carrack and steamer a cell and a half. */
export const MAP_LENGTH: Record<BoatKind, number> = { dugout: 30, longboat: 40, carrack: 50, steamer: 50, motor_launch: 40, hydrofoil: 44 };
