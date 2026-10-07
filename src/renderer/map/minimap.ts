// A minimap of the wide land (the owner's ask: a much larger map): a small square in the strip's corner with the
// land's ground in its colours, the fog beyond the known land, the buildings as light marks, the townsfolk as white
// dots, raiders red, the land's places gold, and the view as a frame. Tap it to look there. The ground is painted
// to a cell-sized canvas only when the land changes; the dots every few frames. DOM, no Pixi.

import { CELL, type LandMap } from '../../shared/sim/land';
import { visibility } from './groundArt';

const SIZE = 118;
const GROUND: Record<string, string> = {
  '.': '#5f8f46', f: '#2f5b2d', r: '#7b776f', m: '#4f6e4a', h: '#7a8a4a', w: '#3c74a8', F: '#8a6a3c', s: '#d2b878', M: '#5a5a62', H: '#2a2622', S: '#6fa6c8',
};
const WINTER: Record<string, string> = { '.': '#d9e2ea', f: '#4c6150', m: '#b8c4c6', h: '#c6ccd0', F: '#c8c6bf', s: '#e4e0d4' };

export interface MiniDots {
  people: { x: number; y: number }[];
  raiders: { x: number; y: number }[];
  places: { x: number; y: number; waiting: boolean }[];
  buildings: { x: number; y: number; w: number; h: number }[];
  /** The view, in world px. */
  view: { x: number; y: number; w: number; h: number };
}

export class Minimap {
  readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ground = document.createElement('canvas');
  private groundKey = '';
  private land: LandMap | null = null;
  private frame = 0;
  onLook: ((wx: number, wy: number) => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'minimap';
    this.root.setAttribute('data-hit', '');
    this.root.title = 'The land: tap to look there';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE * 2;
    this.canvas.style.width = this.canvas.style.height = `${SIZE}px`;
    this.root.appendChild(this.canvas);
    const look = (e: PointerEvent) => {
      const land = this.land;
      if (!land) return;
      const r = this.canvas.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      const fy = (e.clientY - r.top) / r.height;
      this.onLook?.(fx * land.w * CELL, fy * land.h * CELL);
      e.stopPropagation();
    };
    this.root.addEventListener('pointerdown', look);
    const hide = document.createElement('button');
    hide.className = 'mini-hide';
    hide.textContent = '×';
    hide.title = 'Hide the map';
    hide.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.shown = false;
    });
    this.root.appendChild(hide);
    this.tab = document.createElement('button');
    this.tab.id = 'minimap-tab';
    this.tab.className = 'tab';
    this.tab.setAttribute('data-hit', '');
    this.tab.textContent = 'Map';
    this.tab.title = 'Show the map of the land';
    this.tab.addEventListener('click', () => (this.shown = true));
    let on = true;
    try {
      on = localStorage.getItem('littletown.minimap') !== '0';
    } catch {
      /* (no storage) */
    }
    this.shown = on;
  }
  private readonly tab: HTMLButtonElement;
  /** Both go on the page. */
  mount(parent: HTMLElement): void {
    parent.append(this.root, this.tab);
  }

  get shown(): boolean {
    return !this.root.hidden;
  }
  set shown(v: boolean) {
    this.root.hidden = !v;
    this.tab.hidden = v;
    try {
      localStorage.setItem('littletown.minimap', v ? '1' : '0');
    } catch {
      /* (no storage) */
    }
  }

  /** The land as it is (painted again only when it changes). */
  setLand(land: LandMap, season: string): void {
    this.land = land;
    const key = `${land.version}|${land.open}|${season}|${land.w}x${land.h}`;
    if (key === this.groundKey) return;
    this.groundKey = key;
    const g = this.ground;
    g.width = land.w;
    g.height = land.h;
    const ctx = g.getContext('2d')!;
    const img = ctx.createImageData(land.w, land.h);
    const d = img.data;
    const winter = season === 'winter';
    for (let y = 0; y < land.h; y++)
      for (let x = 0; x < land.w; x++) {
        const i = y * land.w + x;
        const c = land.cells[i];
        const hex = (winter && WINTER[c]) || GROUND[c] || '#5f8f46';
        let r = parseInt(hex.slice(1, 3), 16);
        let gg = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        if (land.roads[i] === '#') {
          r = 0xb8;
          gg = 0xa4;
          b = 0x7c;
        }
        // (the fog: the known land bright, its edge dimmed, the rest dark)
        const vis = visibility(land, x, y);
        const k = vis === 2 ? 1 : vis === 1 ? 0.55 : 0.22;
        const o = i * 4;
        d[o] = r * k;
        d[o + 1] = gg * k;
        d[o + 2] = b * k;
        d[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }

  /** Each frame: the dots and the view (every third frame is plenty). */
  render(dots: MiniDots): void {
    const land = this.land;
    if (!land || this.root.hidden || this.frame++ % 3) return;
    const ctx = this.canvas.getContext('2d')!;
    const S = SIZE * 2;
    const kx = S / (land.w * CELL);
    const ky = S / (land.h * CELL);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.ground, 0, 0, S, S);
    ctx.fillStyle = '#e8dcc0';
    for (const b of dots.buildings) ctx.fillRect(Math.round(b.x * kx), Math.round(b.y * ky), Math.max(2, Math.round(b.w * kx)), Math.max(2, Math.round(b.h * ky)));
    for (const p of dots.places) {
      ctx.fillStyle = p.waiting ? '#ffb020' : '#c8b060';
      ctx.fillRect(Math.round(p.x * kx) - 2, Math.round(p.y * ky) - 2, 5, 5);
    }
    ctx.fillStyle = '#ffffff';
    for (const p of dots.people) ctx.fillRect(Math.round(p.x * kx) - 1, Math.round(p.y * ky) - 1, 3, 3);
    ctx.fillStyle = '#ff4040';
    for (const p of dots.raiders) ctx.fillRect(Math.round(p.x * kx) - 2, Math.round(p.y * ky) - 2, 4, 4);
    // the view's frame
    const v = dots.view;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(v.x * kx) + 1, Math.round(v.y * ky) + 1, Math.max(6, Math.round(v.w * kx)) - 2, Math.max(6, Math.round(v.h * ky)) - 2);
  }
}
