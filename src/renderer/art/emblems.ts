// Class emblems (data/emblems.ts): a heater shield in the base calling's colours with a glyph from the item sheets on
// it, its stage told by the device and the rim (a plain field for a base calling; a chevron at the first road, a bend
// at the second, a bordure at the third; a golden field with rays for an ascended form). Drawn on a canvas, so the
// event box, the People page and the news can all use it; the glyph lands when its sheet has loaded.

import { CROWN, emblemOf, GEM, type Glyph, type GlyphSheet } from '../../shared/data/emblems';
import { iconSheet } from './icons';
import { loadImage } from './loadImage';

const images = new Map<GlyphSheet, Promise<HTMLImageElement>>();
const sheetImage = (sheet: GlyphSheet) => {
  let p = images.get(sheet);
  if (!p) {
    p = loadImage(iconSheet(sheet).url);
    images.set(sheet, p);
  }
  return p;
};

/** The shield's outline on a unit square (0..1), with its point at the bottom. */
function shield(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = w * 0.1;
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h * 0.52);
  g.bezierCurveTo(x + w, y + h * 0.8, x + w * 0.72, y + h * 0.93, x + w / 2, y + h);
  g.bezierCurveTo(x + w * 0.28, y + h * 0.93, x, y + h * 0.8, x, y + h * 0.52);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/** Draw a node's emblem on `c` (a square canvas), `size` CSS px; the glyph is painted in when its sheet arrives. */
export function paintEmblem(c: HTMLCanvasElement, nodeId: string, size: number): void {
  const e = emblemOf(nodeId);
  if (!e) return;
  const k = Math.max(2, Math.round((window.devicePixelRatio || 1) * 2));
  c.width = size * k;
  c.height = size * k;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const g = c.getContext('2d')!;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.imageSmoothingEnabled = false;
  const S = size;
  const pad = S * 0.08;
  const w = S - pad * 2;
  const h = S - pad * 1.6;
  const ascended = e.stage >= 4;
  const gold = ascended ? '#ffd97a' : e.stage >= 3 ? '#e8c060' : e.stage >= 1 ? '#b8924a' : '#6b5a3c';
  // the glow of the great ones
  if (ascended) {
    g.save();
    g.shadowColor = 'rgba(255, 220, 120, 0.9)';
    g.shadowBlur = S * 0.18;
    shield(g, pad, pad * 0.8, w, h);
    g.fillStyle = gold;
    g.fill();
    g.restore();
  }
  // the field
  shield(g, pad, pad * 0.8, w, h);
  const grad = g.createLinearGradient(pad, pad, pad + w, pad + h);
  grad.addColorStop(0, ascended ? '#f1d27a' : e.colours.fill);
  grad.addColorStop(1, ascended ? '#9a7120' : e.colours.dark);
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.clip();
  // the device by stage
  g.fillStyle = ascended ? 'rgba(255, 255, 255, 0.22)' : e.colours.light;
  g.globalAlpha = ascended ? 1 : 0.55;
  if (e.stage === 1) {
    // a chevron
    g.beginPath();
    g.moveTo(pad, pad + h * 0.62);
    g.lineTo(pad + w / 2, pad + h * 0.3);
    g.lineTo(pad + w, pad + h * 0.62);
    g.lineTo(pad + w, pad + h * 0.76);
    g.lineTo(pad + w / 2, pad + h * 0.44);
    g.lineTo(pad, pad + h * 0.76);
    g.closePath();
    g.fill();
  } else if (e.stage === 2) {
    // a bend
    g.beginPath();
    g.moveTo(pad, pad + h * 0.08);
    g.lineTo(pad + w * 0.22, pad - h * 0.05);
    g.lineTo(pad + w * 1.05, pad + h * 0.7);
    g.lineTo(pad + w * 0.85, pad + h * 0.85);
    g.closePath();
    g.fill();
  } else if (e.stage === 3) {
    // a bordure
    g.globalAlpha = 0.7;
    g.lineWidth = S * 0.05;
    g.strokeStyle = e.colours.light;
    shield(g, pad + S * 0.09, pad * 0.8 + S * 0.09, w - S * 0.18, h - S * 0.2);
    g.stroke();
  } else if (ascended) {
    // rays from the glyph
    g.globalAlpha = 0.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(S / 2, S * 0.46);
      g.lineTo(S / 2 + Math.cos(a) * S, S * 0.46 + Math.sin(a) * S);
      g.lineTo(S / 2 + Math.cos(a + 0.14) * S, S * 0.46 + Math.sin(a + 0.14) * S);
      g.closePath();
      g.fill();
    }
  }
  // a light along the top left
  g.globalAlpha = 0.25;
  const sheen = g.createLinearGradient(pad, pad, pad + w * 0.6, pad + h * 0.6);
  sheen.addColorStop(0, '#ffffff');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(pad, pad, w, h);
  g.restore();
  // the rim
  g.globalAlpha = 1;
  shield(g, pad, pad * 0.8, w, h);
  g.lineWidth = S * 0.055;
  g.strokeStyle = '#1a1208';
  g.stroke();
  g.lineWidth = S * 0.03;
  g.strokeStyle = gold;
  g.stroke();
  // pips for the stage, along the top
  if (e.stage > 0 && !ascended) {
    g.fillStyle = gold;
    const n = e.stage;
    for (let i = 0; i < n; i++) {
      const x = S / 2 + (i - (n - 1) / 2) * S * 0.14;
      const y = pad * 0.8 + S * 0.09;
      g.beginPath();
      g.moveTo(x, y - S * 0.035);
      g.lineTo(x + S * 0.035, y);
      g.lineTo(x, y + S * 0.035);
      g.lineTo(x - S * 0.035, y);
      g.closePath();
      g.fill();
    }
  }
  // the devices, when their sheets have come: the crossed pair behind, the main device over it, the charges
  const parts: { g: Glyph; x: number; y: number; size: number; flip?: boolean; alpha?: number; shadow?: boolean }[] = [];
  const cx = S / 2;
  const cy = S * 0.47;
  if (e.behind) {
    const bs = S * 0.7;
    parts.push({ g: e.behind, x: cx, y: cy, size: bs, alpha: 0.95, shadow: true }, { g: e.behind, x: cx, y: cy, size: bs, flip: true, alpha: 0.95, shadow: true });
  }
  if (e.main) parts.push({ g: e.main, x: cx, y: e.behind ? cy + S * 0.02 : cy, size: e.behind ? S * 0.46 : S * 0.56, shadow: true });
  if (e.charge) parts.push({ g: e.charge, x: S * 0.76, y: S * 0.66, size: S * 0.3, shadow: true });
  if (e.gem) parts.push({ g: GEM, x: S * 0.25, y: S * 0.66, size: S * 0.26, shadow: true });
  if (e.crown) parts.push({ g: CROWN, x: cx, y: S * 0.17, size: S * 0.34, shadow: true });
  const sheets = [...new Set(parts.map((q) => q.g[0]))];
  void Promise.all(sheets.map((sh) => sheetImage(sh).then((im) => [sh, im] as const))).then((loaded) => {
    const by = new Map<GlyphSheet, HTMLImageElement>(loaded);
    g.save();
    g.imageSmoothingEnabled = false;
    for (const q of parts) {
      const im = by.get(q.g[0]);
      if (!im) continue;
      const info = iconSheet(q.g[0]);
      const sx = (q.g[1] % info.cols) * info.cell;
      const sy = Math.floor(q.g[1] / info.cols) * info.cell;
      const draw = (dx: number, dy: number) => {
        g.save();
        g.translate(q.x + dx, q.y + dy);
        if (q.flip) g.scale(-1, 1);
        g.drawImage(im, sx, sy, info.cell, info.cell, -q.size / 2, -q.size / 2, q.size, q.size);
        g.restore();
      };
      if (q.shadow) {
        g.globalAlpha = 0.5;
        g.filter = 'brightness(0)';
        draw(S * 0.025, S * 0.035);
        g.filter = 'none';
      }
      g.globalAlpha = q.alpha ?? 1;
      draw(0, 0);
    }
    g.restore();
  });
}

/** A new canvas with the emblem on it. */
export function emblemCanvas(nodeId: string, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'class-emblem';
  paintEmblem(c, nodeId, size);
  return c;
}
