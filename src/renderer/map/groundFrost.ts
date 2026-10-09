// More weather on the ground (the owner's ask): hoar frost whitening the grass on cold mornings, glinting till the sun
// thaws it; dew sparkling on the grass at dawn; hail in a cold storm, the stones bouncing where they land and lying a
// moment before they melt; and snow drifted against the walls and the buildings' feet through the winter, deeper as
// it goes on. When each comes is in critterRules.ts (frostOn, dewOn, hailing, driftDepth). Renderer only, over the
// ground (MapView's `under`); none of it on a slow phone.

import { Container, Sprite, Texture } from 'pixi.js';
import { footprint } from '../../shared/sim/buildings';
import { CELL, groundAt, type LandMap } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { glowTexture } from '../town/layer';
import { dewOn, driftDepth, frostOn, hailing, HAIL_MOST } from './critterRules';
import { visibility } from './groundArt';

const GRASSY = new Set(['grass', 'fertile', 'hill', 'marsh']);
const FROST_MOST = 60;
const GLINTS_MOST = 46;
const DRIFTS_MOST = 60;
/** What never has snow heaped against it: the plots, the campfire, traps. */
const NO_DRIFT = (def: string) => def === 'campfire' || /field|plot|garden|orchard|pen|coop|sty|fold|pasture|trap|patch/.test(def);

const hash = (x: number, y: number, k: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + k * 37.7) * 43758.5453;
  return v - Math.floor(v);
};

/** A glint: a little four-pointed sparkle (made once, white, tinted where it's used). */
let glintTex: Texture | null = null;
function glint(): Texture {
  if (glintTex) return glintTex;
  const c = document.createElement('canvas');
  c.width = c.height = 5;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(2, 0, 1, 5);
  g.fillRect(0, 2, 5, 1);
  g.fillStyle = '#fff';
  g.fillRect(2, 2, 1, 1);
  glintTex = Texture.from(c);
  glintTex.source.scaleMode = 'nearest';
  return glintTex;
}
/** A hailstone: a round white pellet with a grey shade. */
let hailTex: Texture | null = null;
function hailstone(): Texture {
  if (hailTex) return hailTex;
  const c = document.createElement('canvas');
  c.width = c.height = 3;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f8ff';
  g.fillRect(0, 1, 3, 1);
  g.fillRect(1, 0, 1, 3);
  g.fillStyle = '#b8c4d4';
  g.fillRect(2, 2, 1, 1);
  hailTex = Texture.from(c);
  hailTex.source.scaleMode = 'nearest';
  return hailTex;
}

interface Patch {
  s: Sprite;
  at: number;
  phase: number;
}
interface Stone {
  s: Sprite;
  sh: Sprite;
  x: number;
  y: number;
  h: number;
  vh: number;
  vx: number;
  bounces: number;
  lie: number;
}

export class GroundFrost {
  private readonly layer = new Container();
  private readonly frost: Patch[] = [];
  private readonly glints: Patch[] = [];
  private readonly drifts: Patch[] = [];
  private readonly stones: Stone[] = [];
  private viewKey = '';
  private driftKey = '';
  private t = 0;
  /** Per snapshot (main.ts): the season and its day, the hour and daylight, the weather and whether the land is cold. */
  season = 'summer';
  dayOfSeason = 1;
  day = 1;
  hour = 12;
  daylight = 1;
  weather = 'clear';
  cold = false;
  buildings: Building[] = [];

  constructor(under: Container) {
    under.addChild(this.layer);
  }

  render(dt: number, view: { x: number; y: number; w: number; h: number }, land: LandMap | null, calm: boolean): void {
    this.layer.visible = !calm && !!land;
    if (calm || !land) return;
    this.t += dt;
    const sky = { season: this.season, weather: this.weather, daylight: this.daylight, hour: this.hour, dayOfSeason: this.dayOfSeason, cold: this.cold };
    const frost = frostOn(sky);
    const dew = dewOn(sky);
    const cellOk = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < land.w && cy < land.h && visibility(land, cx, cy) === 2;
    // the frost's patches and the glints are laid on the grassy cells in view (again when the view moves a good way)
    const key = `${Math.round(view.x / 160)},${Math.round(view.y / 160)},${Math.round(view.w / 160)}`;
    if (key !== this.viewKey) {
      this.viewKey = key;
      for (const p of [...this.frost, ...this.glints]) p.s.destroy();
      this.frost.length = 0;
      this.glints.length = 0;
      const x0 = Math.floor(view.x / CELL) - 1, x1 = Math.ceil((view.x + view.w) / CELL) + 1;
      const y0 = Math.floor(view.y / CELL) - 1, y1 = Math.ceil((view.y + view.h) / CELL) + 1;
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          if (!cellOk(cx, cy) || !GRASSY.has(groundAt(land, cx, cy))) continue;
          if (hash(cx, cy, 21) < 0.5 && this.frost.length < FROST_MOST) {
            // (a pale rime: soft white-blue over the blades)
            const s = this.layer.addChild(new Sprite(glowTexture()));
            s.anchor.set(0.5);
            s.tint = 0xe6f2ff;
            s.position.set((cx + hash(cx, cy, 22)) * CELL, (cy + hash(cx, cy, 23)) * CELL);
            s.width = 46 + hash(cx, cy, 24) * 40;
            s.height = s.width * 0.55;
            this.frost.push({ s, at: hash(cx, cy, 25) * 0.4, phase: 0 });
          }
          for (let k = 0; k < 2 && this.glints.length < GLINTS_MOST; k++) {
            if (hash(cx, cy, 30 + k) > 0.3) continue;
            const s = this.layer.addChild(new Sprite(glint()));
            s.anchor.set(0.5);
            s.position.set(Math.round((cx + hash(cx, cy, 32 + k)) * CELL), Math.round((cy + hash(cx, cy, 34 + k)) * CELL));
            this.glints.push({ s, at: hash(cx, cy, 36 + k) * 0.5, phase: hash(cx, cy, 38 + k) * 6.3 });
          }
        }
    }
    for (const p of this.frost) {
      p.s.visible = frost > p.at;
      p.s.alpha = Math.min(0.7, (frost - p.at) * 1.4);
    }
    // (frost glints icy-white; dew in the low sun a little warmer; each twinkles on its own beat)
    const shine = Math.max(frost, dew);
    for (const g of this.glints) {
      const on = shine > g.at;
      g.s.visible = on;
      if (!on) continue;
      const tw = Math.max(0, Math.sin(this.t * 2.3 + g.phase) * Math.sin(this.t * 0.9 + g.phase * 2));
      g.s.tint = frost > 0 ? 0xeaf6ff : 0xfff6dc;
      g.s.alpha = Math.min(1, (shine - g.at) * 2) * tw;
      g.s.scale.set(0.6 + tw * 0.6);
    }
    // snow drifted against the walls and the buildings' feet (laid again when the buildings or the view change)
    const depth = driftDepth(this.season, this.dayOfSeason, this.weather, this.cold);
    const dkey = depth > 0 ? `${key}|${this.buildings.map((b) => (b.status === 'done' ? `${b.id}:${b.tile},${b.row}` : '')).join(';')}` : '';
    if (dkey !== this.driftKey) {
      this.driftKey = dkey;
      for (const d of this.drifts) d.s.destroy();
      this.drifts.length = 0;
      if (depth > 0)
        for (const b of this.buildings) {
          if (this.drifts.length >= DRIFTS_MOST) break;
          if (b.status !== 'done' || b.room || NO_DRIFT(b.def)) continue;
          const f = footprint(b);
          const x = f.x * CELL;
          const y = (f.y + f.h) * CELL;
          if (x + f.w * CELL < view.x - 40 || x > view.x + view.w + 40 || y < view.y - 40 || y > view.y + view.h + 80) continue;
          // (heaped along the foot, deeper at the west corner the wind drives it into, and up the west side)
          const foot = this.layer.addChild(new Sprite(glowTexture()));
          foot.anchor.set(0.5);
          foot.tint = 0xffffff;
          foot.position.set(x + f.w * CELL * 0.42, y + 1);
          foot.width = f.w * CELL * 1.05;
          this.drifts.push({ s: foot, at: 0, phase: 14 });
          const corner = this.layer.addChild(new Sprite(glowTexture()));
          corner.anchor.set(0.5);
          corner.tint = 0xf6faff;
          corner.position.set(x + 4, y - Math.min(f.h * CELL * 0.3, 14));
          corner.width = 26;
          this.drifts.push({ s: corner, at: 0.3, phase: Math.min(f.h * CELL * 0.8, 40) });
        }
    }
    for (const d of this.drifts) {
      d.s.visible = depth > d.at;
      d.s.height = d.phase * (0.5 + depth * 0.6);
      d.s.alpha = Math.min(0.92, 0.5 + depth * 0.45);
    }
    // hail: the stones come down fast, bounce twice smaller each time, and lie white a moment
    const hail = hailing(this.weather, this.season, this.cold, this.day, this.hour);
    if (hail)
      for (let n = 0; n < 4 && this.stones.length < HAIL_MOST; n++) {
        const x = view.x + Math.random() * view.w;
        const y = view.y + Math.random() * view.h;
        const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
        if (!cellOk(cx, cy)) continue;
        const g = groundAt(land, cx, cy);
        if (g === 'water' || g === 'shallows' || g === 'mountain') continue;
        const s = this.layer.addChild(new Sprite(hailstone()));
        s.anchor.set(0.5, 1);
        const sh = this.layer.addChild(new Sprite(glowTexture()));
        sh.anchor.set(0.5);
        sh.tint = 0x000000;
        sh.width = 4;
        sh.height = 2;
        this.stones.push({ s, sh, x, y, h: 60 + Math.random() * 60, vh: 260, vx: 18 + Math.random() * 10, bounces: 0, lie: 1.5 + Math.random() * 2 });
      }
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const st = this.stones[i];
      if (st.bounces < 3) {
        st.vh += 600 * dt;
        st.h -= st.vh * dt;
        st.x += st.vx * dt;
        if (st.h <= 0) {
          st.h = 0;
          st.bounces++;
          st.vh = st.bounces < 3 ? -90 / st.bounces : 0;
          st.vx *= 0.4;
        }
      } else st.lie -= dt;
      if (st.lie <= 0) {
        st.s.destroy();
        st.sh.destroy();
        this.stones.splice(i, 1);
        continue;
      }
      st.s.position.set(Math.round(st.x), Math.round(st.y - st.h));
      st.s.alpha = Math.min(1, st.lie);
      st.sh.position.set(Math.round(st.x), Math.round(st.y));
      st.sh.alpha = 0.25 * Math.max(0, 1 - st.h / 60) * Math.min(1, st.lie);
    }
  }
}
