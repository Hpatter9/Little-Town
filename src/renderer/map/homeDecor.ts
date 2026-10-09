// What a home's front says about its folk (the owner's ask): a rich owner's home has flower boxes under its windows
// (the Fields pack's box with its flowers in it), a painted door (DawnLike's planked door, in a colour by the house)
// and a garden by the door (flowers, a tuft, a potted plant from the dungeon clutter); the homes of the poor gather
// clutter (crates, pots, a bucket, a log); and in a plague a sick household's door is marked with a red cross (the
// 5000 Pixel Effects pack's blood cross, stopped on its third frame). Drawn among the things, before the fronts.

import { Container, Sprite, Texture } from 'pixi.js';
import type { Building } from '../../shared/sim/state';
import type { PersonView } from '../../shared/sim/snapshot';
import { loadImage } from '../art/loadImage';
import { pixelFxFrame } from '../art/effects';
import boxUrl from '../art/packs/f_box1.png';
import flower1 from '../art/fields/flower1.png';
import flower3 from '../art/fields/flower3.png';
import flower5 from '../art/fields/flower5.png';
import flower9 from '../art/fields/flower9.png';
import tuftUrl from '../art/fields/tuft2.png';
import plantsUrl from '../art/clutter/plants.png';
import doorUrl from '../art/village/dl_door.png';
import crateUrl from '../art/clutter/crate_small.png';
import potsUrl from '../art/clutter/pots1.png';
import jarUrl from '../art/clutter/jar.png';
import bucketUrl from '../art/packs/v_bucket.png';
import logUrl from '../art/packs/f_log1.png';
import { homeWealth, markedDoors, type Wealth } from './moodRules';
import type { Front } from './mapView';

const URLS = { box: boxUrl, f1: flower1, f3: flower3, f5: flower5, f9: flower9, tuft: tuftUrl, plants: plantsUrl, door: doorUrl, crate: crateUrl, pots: potsUrl, jar: jarUrl, bucket: bucketUrl, log: logUrl };
type Key = keyof typeof URLS;
/** The painted doors' colours, by the house. */
const PAINT = [0xc83a30, 0x2e5ec0, 0x2f8a46, 0xe0b030, 0x7a3ab0, 0x1f8a8a];
const FLOWERS: Key[] = ['f1', 'f3', 'f5', 'f9'];
/** The door's place on the pack's home pictures (share of the width from the left, and how far up from the foot, as a
 *  share of the width too); the top-down painter's door is at the middle of the foot. Homes whose picture shows no
 *  door get none. */
const DOOR_AT: Record<string, [number, number] | null> = { lean_to: [0.59, 0.01], hide_tent: [0.59, 0.01], longhouse: [0.5, 0.07], cottage: null, row_houses: null, apartments: null };
/** The plague's cross: its frame, and its size on the door (px). */
const CROSS_FRAME = 2;
const CROSS_PX = 18;

export class HomeDecor {
  private tex: Partial<Record<Key, Texture>> = {};
  private loaded = false;
  private readonly items = new Map<number, Container>();
  private key = '';

  constructor(private readonly layer: Container) {
    Promise.all((Object.keys(URLS) as Key[]).map((k) => loadImage(URLS[k]).then((im) => [k, im] as const)))
      .then((all) => {
        for (const [k, im] of all) {
          const t = Texture.from(im);
          t.source.scaleMode = 'nearest';
          this.tex[k] = t;
        }
        this.loaded = true;
        this.key = '';
      })
      .catch(() => undefined);
  }

  /** The homes' fronts dressed for their folk's means (`packed`: whether a building's picture is the pack's), and the
   *  sick households' doors marked while a plague is on. */
  sync(list: Building[], people: PersonView[], fronts: Map<number, Front>, plague: boolean, packed: (def: string) => boolean): void {
    if (!this.loaded) return;
    const purses = people.map((p) => ({ id: p.id, coins: p.coins, debt: p.debt, bedId: p.bedId, child: p.growsUpIn !== null }));
    const marked = plague ? markedDoors(people) : new Set<number>();
    const cross = plague ? pixelFxFrame('blood-cross', CROSS_FRAME) : null;
    const looks: [Building, Wealth, boolean][] = [];
    for (const b of list) {
      const w = homeWealth(b, purses);
      const m = marked.has(b.id) && !!cross;
      if ((w !== 'plain' || m) && fronts.has(b.id)) looks.push([b, w, m]);
    }
    const key = looks.map(([b, w, m]) => `${b.id}:${w}:${m ? 1 : 0}:${Math.round(fronts.get(b.id)!.cx)},${Math.round(fronts.get(b.id)!.bottom)}`).join(';');
    if (key === this.key) return;
    this.key = key;
    for (const c of this.items.values()) c.destroy({ children: true });
    this.items.clear();
    for (const [b, w, m] of looks) {
      const f = fronts.get(b.id)!;
      // (it stands at the home's foot and draws from there: the culling goes by where a thing stands)
      const c = this.layer.addChild(new Container());
      c.position.set(Math.round(f.cx), Math.round(f.bottom));
      c.zIndex = f.bottom + 0.3;
      const put = (k: Key, x: number, y: number, scale = 1, tint?: number, anchorY = 1) => {
        const t = this.tex[k];
        if (!t) return null;
        const sp = c.addChild(new Sprite(t));
        sp.anchor.set(0.5, anchorY);
        sp.scale.set(scale);
        sp.position.set(Math.round(x - c.x), Math.round(y - c.y));
        if (tint !== undefined) sp.tint = tint;
        return sp;
      };
      const h = (n: number) => ((b.id * 2654435761 + n * 40503) >>> 0) % 1000;
      const door = packed(b.def) ? DOOR_AT[b.def] : [0.5, 0];
      if (w === 'rich') {
        // a flower box under each window, its flowers standing up out of it
        for (const [i, win] of f.windows.entries()) {
          const box = put('box', win.x, win.y + 5, 0.7, undefined, 0);
          box?.scale.set(0.75, 0.42);
          for (const dx of [-3, 0, 3]) put(FLOWERS[h(i * 3 + dx + 3) % 4], win.x + dx, win.y + 8, 1);
        }
        // a painted door, in a colour of the house's own
        if (door) put('door', f.cx - f.w / 2 + door[0] * f.w, f.bottom - 1 - door[1] * f.w, 0.58, PAINT[h(9) % PAINT.length]);
        // a garden by the house: a bed of flowers with tufts among them, and potted plants by the door
        const side = h(3) % 2 ? 1 : -1;
        const gx = f.cx + side * (f.w / 2 + 8);
        for (let i = 0; i < 8; i++) put(FLOWERS[h(20 + i) % 4], gx + ((h(30 + i) % 19) - 9), f.bottom - 2 + (h(40 + i) % 12), 1.2);
        put('tuft', gx - 7, f.bottom + 8, 1.2);
        put('tuft', gx + 8, f.bottom + 1, 1.2);
        put('plants', f.cx - side * (f.w / 4), f.bottom + 7, 0.6);
      } else if (w === 'poor') {
        // what the poor can't put away: crates, pots, a jar, a bucket, an old log, heaped by the front corners
        const heap: Key[] = ['crate', 'pots', 'jar', 'bucket', 'log'];
        const n = 3 + (h(1) % 3);
        for (let i = 0; i < n; i++) {
          const k = heap[h(50 + i) % heap.length];
          const side = i % 2 ? 1 : -1;
          put(k, f.cx + side * (f.w / 2 - 2 - (h(60 + i) % 8) - Math.floor(i / 2) * 9), f.bottom + 4 + (h(70 + i) % 6), k === 'log' ? 0.55 : 0.8);
        }
      }
      if (m && cross) {
        // the plague's mark, a red cross on the door
        const at = door ?? [0.5, 0];
        const sp = c.addChild(new Sprite(cross));
        sp.anchor.set(0.5);
        sp.width = sp.height = CROSS_PX;
        sp.position.set(Math.round(f.cx - f.w / 2 + at[0] * f.w - c.x), Math.round(f.bottom - 7 - at[1] * f.w - c.y));
      }
      this.items.set(b.id, c);
    }
  }
}
