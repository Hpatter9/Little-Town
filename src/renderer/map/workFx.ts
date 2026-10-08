// Every workshop shows its work (the owner's ask: the town alive with its trades): while someone is at work there
// (`snapshot.workingAt`) a forge throws sparks from its door and glows, a kitchen, brewery or still breathes steam from
// its roof, a sawmill or carver drifts sawdust, a loom or dyer's lets coloured threads float up, a glassworks or kiln
// shimmers with embers, a study's desk glints, and the late works' machines spit blue sparks. Particles in the map's
// `over` (and a glow in its lights layer for the hot ones), only in view, none on a slow phone (`calm`).

import { Container, Sprite, Texture } from 'pixi.js';
import { CELL } from '../../shared/sim/land';
import { footprint } from '../../shared/sim/buildings';
import type { Building } from '../../shared/sim/state';
import { glowTexture } from '../town/layer';

import { workLook, type WorkLook } from './workLooks';

/** Particles a second from one building at work, by look; and the most alive at once. */
const RATE: Record<WorkLook, number> = { dust: 3, sparks: 9, embers: 4, steam: 2.2, bubbles: 2.5, sawdust: 5, threads: 2, arcs: 3, glints: 1.5 };
const MOST = 160;
const THREAD_TINTS = [0xe05050, 0x5080e0, 0xe0c040, 0x60c060, 0xc070d0, 0xf0f0f0];

interface Mote {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  look: WorkLook;
  phase: number;
}

export class WorkFx {
  private readonly layer = new Container();
  private readonly glowLayer = new Container();
  private readonly motes: Mote[] = [];
  private busy: { id: number; look: WorkLook; x: number; door: number; roof: number; w: number }[] = [];
  private readonly due = new Map<number, number>();
  private readonly glows = new Map<number, Sprite>();
  private t = 0;

  constructor(over: Container, lights: Container) {
    over.addChild(this.layer);
    lights.addChild(this.glowLayer);
  }

  /** The buildings at work now (per snapshot). */
  sync(buildings: Building[], workingAt: number[]): void {
    const on = new Set(workingAt);
    this.busy = [];
    for (const b of buildings) {
      if (!on.has(b.id) || b.status !== 'done' || b.room) continue;
      const look = workLook(b.def);
      if (!look) continue;
      const f = footprint(b);
      this.busy.push({ id: b.id, look, x: (f.x + f.w / 2) * CELL, door: (f.y + f.h) * CELL - 8, roof: f.y * CELL - 6, w: f.w * CELL });
    }
    for (const [id, g] of this.glows)
      if (!this.busy.some((q) => q.id === id && (q.look === 'sparks' || q.look === 'embers'))) {
        g.destroy();
        this.glows.delete(id);
      }
  }

  /** Builders at work on a site (per snapshot): each hammer blow throws up dust and chips of what's built with. */
  syncBuilders(list: { id: number; x: number; y: number; dir: number }[]): void {
    this.builders = list;
  }
  private builders: { id: number; x: number; y: number; dir: number }[] = [];

  render(dt: number, view: { x: number; y: number; w: number; h: number }, calm: boolean, wind: number): void {
    this.t += dt;
    if (calm) {
      while (this.motes.length) this.motes.pop()!.s.destroy();
      return;
    }
    const pad = 80;
    for (const q of this.busy) {
      const inView = q.x > view.x - pad && q.x < view.x + view.w + pad && q.door > view.y - pad && q.roof < view.y + view.h + pad;
      // a forge's or kiln's door glows, pulsing with the bellows
      if (q.look === 'sparks' || q.look === 'embers') {
        let g = this.glows.get(q.id);
        if (!g) {
          g = this.glowLayer.addChild(new Sprite(glowTexture()));
          g.anchor.set(0.5);
          g.tint = q.look === 'sparks' ? 0xff8a30 : 0xff6020;
          this.glows.set(q.id, g);
        }
        g.visible = inView;
        g.width = g.height = 46 + 10 * Math.sin(this.t * 5 + q.id);
        g.alpha = 0.55 + 0.25 * Math.sin(this.t * 3.3 + q.id * 2);
        g.position.set(q.x, q.door - 4);
      }
      if (!inView) continue;
      let due = (this.due.get(q.id) ?? Math.random()) + RATE[q.look] * dt;
      // (sparks fly in bursts, as the hammer falls)
      const hammer = q.look === 'sparks' ? Math.max(0, Math.sin(this.t * 4.2 + q.id)) ** 6 * 4 : 1;
      due += q.look === 'sparks' ? RATE.sparks * dt * (hammer - 1) : 0;
      while (due >= 1 && this.motes.length < MOST) {
        due -= 1;
        this.spawn(q);
      }
      this.due.set(q.id, Math.min(due, 3));
    }
    for (const b of this.builders) {
      if (b.x < view.x - pad || b.x > view.x + view.w + pad || b.y < view.y - pad || b.y > view.y + view.h + pad) continue;
      const key = -1 - b.id;
      let due = (this.due.get(key) ?? Math.random()) + RATE.dust * dt;
      while (due >= 1 && this.motes.length < MOST) {
        due -= 1;
        this.spawn({ look: 'dust', x: b.x + b.dir * 12, door: b.y - 6, roof: b.y - 30, w: 16 });
      }
      this.due.set(key, Math.min(due, 3));
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += dt;
      if (m.age >= m.life) {
        m.s.destroy();
        this.motes.splice(i, 1);
        continue;
      }
      const k = m.age / m.life;
      switch (m.look) {
        case 'sparks':
        case 'arcs':
          m.vy += 90 * dt;
          m.s.alpha = 1 - k;
          break;
        case 'embers':
          m.vx += Math.sin(m.age * 5 + m.phase) * 6 * dt + wind * 4 * dt;
          m.s.alpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
          break;
        case 'steam':
          m.vx = wind * 10 + Math.sin(m.age * 1.6 + m.phase) * 4;
          m.s.scale.set(1 + k * 2.4);
          m.s.alpha = 0.42 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
          break;
        case 'bubbles':
          m.vx = Math.sin(m.age * 4 + m.phase) * 6;
          m.s.alpha = 0.8 * (1 - k);
          break;
        case 'dust':
          m.vy += m.phase > 4 ? 120 * dt : -4 * dt;
          m.vx *= 1 - dt * 2;
          if (m.phase <= 4) m.s.scale.set(1 + k * 1.5);
          m.s.alpha = (m.phase > 4 ? 1 : 0.5) * (1 - k);
          break;
        case 'sawdust':
          m.vy += 12 * dt;
          m.vx = wind * 6 + Math.sin(m.age * 3 + m.phase) * 5;
          m.s.alpha = 1 - k;
          break;
        case 'threads':
          m.vx = Math.sin(m.age * 2 + m.phase) * 8 + wind * 4;
          m.s.rotation = Math.sin(m.age * 3 + m.phase) * 0.8;
          m.s.alpha = 1 - k;
          break;
        case 'glints':
          m.s.alpha = Math.sin(k * Math.PI);
          m.s.scale.set(0.6 + Math.sin(k * Math.PI) * 0.8);
          break;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.s.position.set(m.x, m.y);
    }
  }

  private spawn(q: { look: WorkLook; x: number; door: number; roof: number; w: number }): void {
    const s = this.layer.addChild(new Sprite(q.look === 'steam' || q.look === 'dust' ? glowTexture() : Texture.WHITE));
    s.anchor.set(0.5);
    const r = Math.random;
    const m: Mote = { s, x: q.x, y: q.door, vx: 0, vy: 0, age: 0, life: 1, look: q.look, phase: r() * 6 };
    switch (q.look) {
      case 'sparks':
        m.x += (r() - 0.5) * 10;
        m.vx = (r() - 0.5) * 70;
        m.vy = -40 - r() * 60;
        m.life = 0.35 + r() * 0.4;
        s.width = s.height = r() < 0.3 ? 2 : 1;
        s.tint = r() < 0.5 ? 0xffe070 : 0xff9a30;
        break;
      case 'arcs':
        m.x += (r() - 0.5) * q.w * 0.5;
        m.y = q.roof + 10 + r() * 20;
        m.vx = (r() - 0.5) * 50;
        m.vy = -20 - r() * 30;
        m.life = 0.25 + r() * 0.3;
        s.width = s.height = 1.5;
        s.tint = r() < 0.5 ? 0x80d8ff : 0xffffff;
        break;
      case 'embers':
        m.x += (r() - 0.5) * q.w * 0.4;
        m.y = q.roof + 6;
        m.vy = -14 - r() * 16;
        m.life = 1.5 + r() * 1.5;
        s.width = s.height = 1.5;
        s.tint = r() < 0.6 ? 0xff8030 : 0xffd060;
        break;
      case 'steam':
        m.x += (r() - 0.3) * q.w * 0.3;
        m.y = q.roof;
        m.vy = -10 - r() * 8;
        m.life = 2.5 + r() * 1.5;
        s.width = s.height = 10;
        s.tint = 0xf4f4f8;
        break;
      case 'bubbles':
        m.x += (r() - 0.5) * q.w * 0.4;
        m.y = q.roof + 8;
        m.vy = -12 - r() * 10;
        m.life = 1.4 + r();
        s.width = s.height = 2;
        s.tint = [0x80ff90, 0xc080ff, 0x80d0ff][Math.floor(r() * 3)];
        break;
      case 'dust':
        // (mostly a soft puff; now and then a chip flung off: phase over 4)
        m.x += (r() - 0.5) * 8;
        m.vx = (r() - 0.5) * 30;
        m.vy = m.phase > 4 ? -40 - r() * 30 : -6 - r() * 6;
        m.life = m.phase > 4 ? 0.5 : 0.9 + r() * 0.5;
        s.width = s.height = m.phase > 4 ? 3 : 8;
        s.tint = m.phase > 4 ? 0x8a6a48 : 0xd8c8a8;
        break;
      case 'sawdust':
        m.x += (r() - 0.5) * 18;
        m.y = q.door - 4 - r() * 8;
        m.vy = -8 - r() * 10;
        m.life = 1 + r() * 0.8;
        s.width = s.height = 1;
        s.tint = r() < 0.5 ? 0xd8b070 : 0xb08850;
        break;
      case 'threads':
        m.x += (r() - 0.5) * q.w * 0.5;
        m.y = q.door - 10;
        m.vy = -8 - r() * 6;
        m.life = 2 + r();
        s.width = 4;
        s.height = 1;
        s.tint = THREAD_TINTS[Math.floor(r() * THREAD_TINTS.length)];
        break;
      case 'glints':
        m.x += (r() - 0.5) * q.w * 0.6;
        m.y = q.door - 10 - r() * 26;
        m.vy = -4;
        m.life = 0.9 + r() * 0.6;
        s.width = s.height = 2;
        s.tint = 0xfff0a0;
        break;
    }
    s.position.set(m.x, m.y);
    this.motes.push(m);
  }
}
