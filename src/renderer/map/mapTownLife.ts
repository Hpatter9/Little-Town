// The town being itself, the parts that aren't anyone's own sprite (map/townLife.ts has the rules): a snowman by the
// doors of the homes with children all winter, melting on spring's first day; the snowballs flying between children
// at play in the snow; the coffin carried at the head of a funeral's procession (DawnLike's coffin); and a lookout on
// every tower, turning to watch the land, with a lantern by night. mapPeople.ts draws the townsfolk's own moments.
// Renderer only. On a slow phone (`calm`) only the snowmen and the coffin stay.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { Look } from '../../shared/data/people';
import { HK_CELL, HK_FEET, HK_FIGURE, hkLayers, hkWhoOfLook, type HkFacing } from '../art/hkFolk';
import { hkTexture } from '../art/hkTexture';
import { loadImage } from '../art/loadImage';
import coffinUrl from '../art/life/coffin.png';
import { glowTexture } from '../town/layer';
import { FLIGHT, snowballNow } from './townLife';

let coffinTex: Texture | null = null;
loadImage(coffinUrl)
  .then((im) => {
    coffinTex = Texture.from(im);
    coffinTex.source.scaleMode = 'nearest';
  })
  .catch(() => undefined);

/** A lookout is drawn this size against the townsfolk (the tower's picture is small for its height). */
const LOOKOUT_K = 0.8;
const ROW: HkFacing[] = ['down', 'left', 'down', 'right'];

interface Snowman {
  g: Graphics;
  key: string;
}
interface Lookout {
  s: Sprite;
  lamp: Sprite;
  keys: string[];
  x: number;
  y: number;
  id: number;
}

export class MapTownLife {
  private readonly snowmen = new Map<number, Snowman>();
  private readonly lookouts = new Map<number, Lookout>();
  private readonly balls = new Graphics();
  private readonly coffin = new Sprite();
  private pairs: { a: number; b: number; seed: number }[] = [];
  private head: { x: number; y: number; bearers: number[] } | null = null;
  calm = false;

  constructor(
    private readonly things: Container,
    over: Container,
    private readonly lights: Container,
    /** Where someone is drawn now (MapPeople.posOf). */
    private readonly posOf: (id: number) => { x: number; y: number } | null,
  ) {
    // (the snowballs fly over everything, drawn where they are: a Graphics among the things would be culled by its spot)
    over.addChild(this.balls);
    this.coffin.anchor.set(0.5, 1);
    this.coffin.visible = false;
    things.addChild(this.coffin);
  }

  /** The homes' snowmen: by each door (world px), and how much of each still stands (0 none: melted, or not winter). */
  syncSnowmen(homes: { id: number; door: { x: number; y: number } }[], left: number): void {
    const want = new Set(left > 0 ? homes.map((h) => h.id) : []);
    for (const [id, sm] of this.snowmen)
      if (!want.has(id)) {
        sm.g.destroy();
        this.snowmen.delete(id);
      }
    if (left <= 0) return;
    const stage = Math.ceil(left * 5); // (redrawn as it melts, a fifth at a time)
    for (const h of homes) {
      let sm = this.snowmen.get(h.id);
      if (!sm) {
        sm = { g: this.things.addChild(new Graphics()), key: '' };
        this.snowmen.set(h.id, sm);
      }
      const key = `${stage}`;
      // (beside the door, to one side or the other by the home's id)
      const x = Math.round(h.door.x + (h.id % 2 ? 22 : -22));
      const y = Math.round(h.door.y + 8);
      sm.g.position.set(x, y);
      sm.g.zIndex = y;
      if (sm.key !== key) {
        sm.key = key;
        drawSnowman(sm.g, stage / 5, h.id);
      }
    }
  }

  /** The snowball fights (pairs of children: townLife.ts `snowballPairs`). */
  syncSnowballs(pairs: [number, number][]): void {
    this.pairs = pairs.map(([a, b]) => ({ a, b, seed: a * 31 + b }));
  }

  /** A funeral's procession under way: where its head is and who carries the coffin (null: none). */
  syncProcession(head: { x: number; y: number } | null, bearers: number[]): void {
    this.head = head ? { ...head, bearers } : null;
  }

  /** The towers a lookout stands on: where their feet go (world px), and the look of the townsperson up there. */
  syncLookouts(towers: { id: number; x: number; y: number; look: Look }[]): void {
    const want = new Set(towers.map((t) => t.id));
    for (const [id, l] of this.lookouts)
      if (!want.has(id)) {
        l.s.destroy();
        l.lamp.destroy();
        this.lookouts.delete(id);
      }
    for (const t of towers) {
      let l = this.lookouts.get(t.id);
      if (!l) {
        const s = this.things.addChild(new Sprite());
        s.anchor.set(0.5, HK_FEET / HK_CELL);
        const lamp = this.lights.addChild(new Sprite(glowTexture()));
        lamp.anchor.set(0.5);
        lamp.tint = 0xffb860;
        lamp.width = lamp.height = 46;
        lamp.alpha = 0.7;
        l = { s, lamp, keys: [], x: 0, y: 0, id: t.id };
        this.lookouts.set(t.id, l);
      }
      l.keys = hkLayers(hkWhoOfLook(t.id, t.look, { cls: 'guardian' }), { fighting: false, activity: 'idle' });
      l.x = Math.round(t.x);
      l.y = Math.round(t.y);
    }
  }

  render(now: number): void {
    // the lookouts: a look round every few seconds
    for (const l of this.lookouts.values()) {
      const facing = ROW[Math.floor((now / 3200 + l.id * 0.7) % ROW.length)];
      const tex = this.calm ? null : hkTexture(l.keys, 0, { down: 0, left: 1, right: 2, up: 3 }[facing]);
      l.s.visible = !!tex;
      if (tex) {
        l.s.texture = tex;
        const k = (48 / HK_FIGURE) * LOOKOUT_K;
        l.s.scale.set(k);
        l.s.position.set(l.x, l.y);
        l.s.zIndex = l.y + 40; // (in front of the tower they stand on)
      }
      l.lamp.visible = !this.calm;
      l.lamp.position.set(l.x, l.y - 18);
    }
    // the coffin, on the bearers' shoulders (between them, else at the procession's head)
    const h = this.head;
    this.coffin.visible = !!h && !!coffinTex;
    if (h && coffinTex) {
      const ps = h.bearers.map((id) => this.posOf(id)).filter((p): p is { x: number; y: number } => !!p);
      const at = ps.length ? { x: ps.reduce((n, p) => n + p.x, 0) / ps.length, y: ps.reduce((n, p) => n + p.y, 0) / ps.length } : h;
      this.coffin.texture = coffinTex;
      this.coffin.scale.set(1.5);
      this.coffin.position.set(Math.round(at.x), Math.round(at.y - 30 + Math.sin(now / 260) * 1));
      this.coffin.zIndex = at.y + 0.5;
    }
    // the snowballs in the air, and the burst of snow where one lands
    const g = this.balls.clear();
    if (this.calm) return;
    for (const p of this.pairs) {
      const ball = snowballNow(now, p.seed);
      const a = this.posOf(p.a);
      const b = this.posOf(p.b);
      if (!ball || !a || !b) continue;
      const [from, to] = ball.from === 0 ? [a, b] : [b, a];
      const t = ball.along;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y - 26 + (to.y - from.y) * t - Math.sin(t * Math.PI) * 20;
      if (t < 0.93) g.circle(x, y, 1.8).fill({ color: 0xffffff }).circle(x - 0.5, y - 0.5, 0.8).fill({ color: 0xffffff, alpha: 1 });
      else for (let i = 0; i < 5; i++) g.circle(to.x + Math.cos(i * 1.3) * (2 + (t - 0.93) * 120), to.y - 28 + Math.sin(i * 1.3) * 3, 1).fill({ color: 0xf4f8ff, alpha: 1 - (t - 0.93) / 0.07 });
    }
    void FLIGHT;
  }
}

/** A snowman: three balls of snow (a little blue in the shade), coal eyes and buttons, a carrot nose, twig arms and a
 *  battered hat by the home's id; `left` of it still standing, the rest slumped into a puddle of slush. */
function drawSnowman(g: Graphics, left: number, id: number): void {
  g.clear();
  g.ellipse(0, 0, 9 + (1 - left) * 4, 3).fill({ color: 0xc8d4e4, alpha: 0.7 }); // (its slush)
  if (left <= 0) return;
  const r = [6, 4.6, 3.4].map((v) => v * (0.55 + 0.45 * left));
  let y = -r[0];
  const ys: number[] = [];
  for (const rad of r) {
    g.circle(0, y, rad).fill(0xf4f8ff);
    g.circle(rad * 0.25, y + rad * 0.25, rad * 0.8).fill({ color: 0xd8e2f0, alpha: 0.6 });
    g.circle(-rad * 0.3, y - rad * 0.3, rad * 0.45).fill({ color: 0xffffff, alpha: 0.9 });
    ys.push(y);
    y -= rad * 1.7;
  }
  if (left < 0.4) return; // (only the bottom ball left)
  const hy = ys[2];
  // coal eyes and buttons, a carrot nose
  g.rect(-1.6, hy - 1.2, 1, 1).fill(0x1a1612).rect(0.8, hy - 1.2, 1, 1).fill(0x1a1612);
  g.poly([0, hy, 3.4, hy + 0.6, 0, hy + 1.2]).fill(0xe87a20);
  for (let i = 0; i < 2; i++) g.rect(-0.5, ys[1] - 1.5 + i * 2.4, 1, 1).fill(0x1a1612);
  // twig arms
  g.moveTo(-r[1], ys[1]).lineTo(-r[1] - 5, ys[1] - 3).lineTo(-r[1] - 7, ys[1] - 2).stroke({ color: 0x5a3e24, width: 0.8 });
  g.moveTo(r[1], ys[1]).lineTo(r[1] + 5, ys[1] - 4).moveTo(r[1] + 3, ys[1] - 2.6).lineTo(r[1] + 4, ys[1] - 5).stroke({ color: 0x5a3e24, width: 0.8 });
  // a hat or a scarf, by the home
  if (id % 2) g.rect(-3, hy - r[2] - 1, 6, 1.2).fill(0x2a2420).rect(-2, hy - r[2] - 4, 4, 3).fill(0x2a2420);
  else g.rect(-r[2], hy + r[2] * 0.6, r[2] * 2, 1.4).fill(0xc83838).rect(r[2] - 1.5, hy + r[2] * 0.6, 1.4, 3.4).fill(0xc83838);
}
