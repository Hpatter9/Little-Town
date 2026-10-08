// Looking through a portal (sim/portals.ts `portalView`, the `watchPortal` command): the realm beyond, its painted
// backdrop filling the screen and darkened, its sites laid along a winding way across it (the cave and dungeon packs'
// gates, ruins, statues and crystals), the ones explored lit in the realm's colour, the next one pulsing, the heart at
// the far end. A bar at the top names it and takes the player back; a window below tells its rule, how far the town
// has come, how stirred it is, who is there now, and what came of the latest trips. Drawn on a 2D canvas of its own in
// a full-screen element (no Pixi); the strip's other cards stand aside while it shows (`body.portal-on`).

import { BACKDROPS, type BackdropId } from '../../shared/data/backdrops';
import type { Command } from '../../shared/sim/commands';
import type { PortalView } from '../../shared/sim/portals';
import { loadImage } from '../art/loadImage';
import circleUrl from '../art/deep/circle.png';
import crystal1Url from '../art/deep/crystal1.png';
import crystal3Url from '../art/deep/crystal3.png';
import gatesUrl from '../art/deep/gates.png';
import ruin1Url from '../art/deep/ruin1.png';
import ruin2Url from '../art/deep/ruin2.png';
import statueUrl from '../art/deep/statue.png';
import totemUrl from '../art/deep/totem.png';
import demonUrl from '../art/deep/demon_skull.png';
import mushroomUrl from '../art/deep/mushroom_big2.png';

const BW = 576;
const BH = 324;
/** The sites' pictures, by realm (the heart's last). */
const SITE_ART: Record<string, string[]> = {
  fae: [mushroomUrl, crystal1Url, statueUrl, mushroomUrl, crystal3Url, statueUrl, ruin1Url],
  underworld: [gatesUrl, demonUrl, statueUrl, circleUrl, ruin2Url, demonUrl, totemUrl],
  elemental: [crystal3Url, crystal1Url, gatesUrl, crystal3Url, circleUrl, crystal1Url, ruin2Url],
};

const images = new Map<string, HTMLImageElement | null>();
function image(url: string, then: () => void): HTMLImageElement | null {
  if (!images.has(url)) {
    images.set(url, null);
    void loadImage(url).then(
      (im) => {
        images.set(url, im);
        then();
      },
      () => images.delete(url),
    );
  }
  return images.get(url) ?? null;
}
const backdrops = new Map<string, HTMLCanvasElement | null>();
function backdrop(id: string, then: () => void): HTMLCanvasElement | null {
  if (!backdrops.has(id)) {
    backdrops.set(id, null);
    const layers = BACKDROPS[id as BackdropId] ?? 1;
    void loadImage(`backdrops/${id}.webp`).then(
      (im) => {
        const c = document.createElement('canvas');
        c.width = BW;
        c.height = BH;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = false;
        for (let i = 0; i < layers; i++) g.drawImage(im, 0, i * BH, BW, BH, 0, 0, BW, BH);
        backdrops.set(id, c);
        then();
      },
      () => backdrops.delete(id),
    );
  }
  return backdrops.get(id) ?? null;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export class PortalScene {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly title: HTMLElement;
  private readonly info: HTMLElement;
  private view: PortalView | null = null;
  private last = '';
  private frame = 0;

  constructor(private readonly send: (c: Command) => void) {
    this.el = document.createElement('div');
    this.el.id = 'portal-view';
    this.el.innerHTML = '<canvas></canvas><div class="pv-top"><div class="pv-title"></div><button class="pv-close" title="Back to the town">✕</button></div><div class="pv-info"></div>';
    this.el.hidden = true;
    document.body.append(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.title = this.el.querySelector('.pv-title')!;
    this.info = this.el.querySelector('.pv-info')!;
    this.el.querySelector('.pv-close')!.addEventListener('click', () => this.send({ type: 'watchPortal', realm: null }));
  }

  get shown(): boolean {
    return !!this.view;
  }

  update(v: PortalView | null): void {
    const was = !!this.view;
    this.view = v;
    this.el.hidden = !v;
    document.body.classList.toggle('portal-on', !!v);
    if (!v) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      return;
    }
    if (!was) this.loop();
    const key = `${v.realm}|${v.explored}|${Math.round(v.stir * 20)}|${v.away.join(',')}|${v.log.join('|')}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = `${v.name}${v.rift ? ' · through the rift' : ''}`;
    this.title.style.color = hex(v.glow);
    this.info.innerHTML = '';
    const row = (label: string, text: string, cls = 'pv-row') => {
      const d = document.createElement('div');
      d.className = cls;
      if (label) {
        const b = document.createElement('b');
        b.textContent = label;
        d.append(b);
      }
      d.append(document.createTextNode(text));
      this.info.append(d);
    };
    row('', v.rule, 'pv-rule');
    row('Explored ', v.calm ? `all ${v.sites}: its heart is broken, and it lies quiet` : `${v.explored} of ${v.sites}${v.next ? `; next, ${v.next}` : ''}`);
    row('There now ', v.away.length ? v.away.join(', ') : 'nobody; the parties choose it for themselves');
    if (!v.calm) {
      const stir = v.stir < 0.34 ? 'Quiet, for now' : v.stir < 0.67 ? 'Something has noticed the town' : 'Something is coming through';
      const bar = document.createElement('div');
      bar.className = 'pv-stir';
      bar.innerHTML = `<span>${stir}</span><i style="width:${Math.round(v.stir * 100)}%"></i>`;
      this.info.append(bar);
    }
    for (const f of v.log.slice(-3).reverse()) row('', f, 'pv-log');
  }

  private fontFamily = '';
  /** The page's body font (a canvas can't read the CSS variable itself). */
  private font(): string {
    if (!this.fontFamily) this.fontFamily = getComputedStyle(this.info).fontFamily || 'sans-serif';
    return this.fontFamily;
  }

  private loop(): void {
    const tick = () => {
      if (!this.view) return;
      this.draw(performance.now() / 1000);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private draw(t: number): void {
    const v = this.view!;
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(c.clientWidth * dpr);
    const H = Math.round(c.clientHeight * dpr);
    if (!W || !H) return;
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#08060c';
    g.fillRect(0, 0, W, H);
    const redraw = () => undefined;
    const bd = backdrop(v.backdrop, redraw);
    if (bd) {
      // (cover the screen, a slow drift across it)
      const k = Math.max(W / BW, H / BH) * 1.06;
      const dw = BW * k;
      const dh = BH * k;
      g.drawImage(bd, (W - dw) / 2 + Math.sin(t * 0.07) * (dw - W) * 0.4, (H - dh) / 2, dw, dh);
    }
    g.fillStyle = 'rgba(6,4,14,0.45)';
    g.fillRect(0, 0, W, H);
    // the map's room: below the top bar, above the window (upright) or left of it (sideways)
    const sideways = W > H;
    const top = 56 * dpr;
    const room = sideways ? { x: 0, y: top, w: W - 270 * dpr, h: H - top } : { x: 0, y: top, w: W, h: H - top - 225 * dpr };
    const size = Math.min((sideways ? room.w : room.h) / 6.2, (sideways ? room.h : room.w) / 2.8, 110 * dpr);
    // (the way runs across the screen held sideways, and down it upright; the sites swing either side of it)
    const pad = size * 0.75;
    const box = { x: room.x + pad, y: room.y + pad * 0.8, w: room.w - pad * 2, h: room.h - pad * 1.9 };
    const at = (s: { x: number; y: number }) =>
      sideways ? { x: box.x + ((s.x - 0.1) / 0.8) * box.w, y: box.y + s.y * box.h } : { x: box.x + s.y * box.w, y: box.y + ((s.x - 0.1) / 0.8) * box.h };
    const glow = hex(v.glow);
    // the way between the sites
    g.lineWidth = 4 * dpr;
    g.setLineDash([8 * dpr, 8 * dpr]);
    for (let i = 1; i < v.map.length; i++) {
      const a = at(v.map[i - 1]);
      const b = at(v.map[i]);
      g.strokeStyle = v.map[i].explored ? glow : 'rgba(230,220,255,0.35)';
      g.beginPath();
      g.moveTo(a.x, a.y);
      const bend = (i % 2 ? -1 : 1) * 30 * dpr;
      g.quadraticCurveTo((a.x + b.x) / 2 + (sideways ? 0 : bend), (a.y + b.y) / 2 + (sideways ? bend : 0), b.x, b.y);
      g.stroke();
    }
    g.setLineDash([]);
    const art = SITE_ART[v.realm] ?? SITE_ART.fae;
    v.map.forEach((s, i) => {
      const p = at(s);
      const big = s.heart ? 1.35 : 1;
      const r = (size * big) / 2;
      if (s.explored || s.next) {
        const pulse = s.next ? 0.55 + 0.45 * Math.sin(t * 3) : 0.8;
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.5);
        grad.addColorStop(0, `${glow}${Math.round(pulse * 160).toString(16).padStart(2, '0')}`);
        grad.addColorStop(1, `${glow}00`);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(p.x, p.y, r * 1.5, 0, Math.PI * 2);
        g.fill();
      }
      const im = image(art[i % art.length], redraw);
      if (im) {
        g.globalAlpha = s.explored || s.next ? 1 : 0.45;
        g.filter = s.explored || s.next ? 'none' : 'grayscale(0.8) brightness(0.6)';
        const k = (r * 2) / Math.max(im.width, im.height);
        g.drawImage(im, p.x - (im.width * k) / 2, p.y - (im.height * k) / 2, im.width * k, im.height * k);
        g.filter = 'none';
        g.globalAlpha = 1;
      }
      g.font = `${s.next || s.heart ? 700 : 500} ${13 * dpr}px ${this.font()}`;
      g.textAlign = 'center';
      g.lineWidth = 3 * dpr;
      g.strokeStyle = '#000';
      const label = s.explored ? `✓ ${s.name}` : s.name;
      g.strokeText(label, p.x, p.y + r + 14 * dpr);
      g.fillStyle = s.explored ? glow : s.next ? '#fff' : '#b8b0c8';
      g.fillText(label, p.x, p.y + r + 14 * dpr);
    });
  }
}
