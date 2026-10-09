// Stockpiles that match the stores (the owner's ask): a finished stockpile's ground is heaped with what it holds, the
// heaps growing and shrinking with the store (map/workSeen.ts `stockPiles`, `layPiles`): logs (the Fields and Village
// packs' logs and log bundles) for wood and lumber, the Fields pack's stones for stone and ore, the Glassblower pack's
// sacks for food, the Village pack's barrels for milk and oil, and crates for the rest. The stockpile's own picture is
// hidden once the heaps are drawn (MapView `artHidden`).

import { Container, Sprite, type Texture } from 'pixi.js';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { footprint } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';
import type { Building } from '../../shared/sim/state';
import { choresTex, type ChoresArt } from '../art/choresArt';
import { layPiles, slotGrid, stockPiles, type PileKind } from './workSeen';

/** The pictures of each kind of heap, one picked by the slot, and their scale. */
const LOOKS: Record<PileKind, [ChoresArt, number][]> = {
  logs: [['logs', 0.62], ['logpile', 0.7], ['log1', 0.45], ['log3', 0.36]],
  stone: [['rubble3', 1], ['rubble1', 1], ['rubble4', 1]],
  sacks: [['sacks', 0.36]],
  barrels: [['barrel', 0.6]],
  crates: [['box1', 0.7], ['crate', 0.6], ['box3', 0.62]],
};

export class MapStockpile {
  private readonly drawn = new Map<number, { key: string; sprites: Sprite[] }>();

  constructor(
    private readonly things: Container,
    private readonly hide: Set<number>,
  ) {
    choresTex(() => {
      for (const d of this.drawn.values()) d.key = '';
    });
  }

  /** The stockpiles as they stand now (per snapshot): their heaps laid again when what they hold changes. */
  sync(buildings: Building[]): void {
    const tex = choresTex();
    const ready = !!tex.sacks;
    const seen = new Set<number>();
    for (const b of buildings) {
      if (b.def !== 'stockpile' || b.status !== 'done' || !ready) continue;
      seen.add(b.id);
      const f = footprint(b);
      const grid = slotGrid(f.w, f.h);
      const counts = stockPiles(b.store ?? {}, BUILDING_BY_ID[b.def]?.storage ?? 100, grid.length);
      const key = `${f.x},${f.y},${f.w},${f.h}|${Object.values(counts).join(',')}`;
      let d = this.drawn.get(b.id);
      if (d && d.key === key) continue;
      if (d) for (const s of d.sprites) s.destroy();
      d = { key, sprites: [] };
      this.drawn.set(b.id, d);
      this.hide.add(b.id);
      const ox = f.x * CELL;
      const oy = f.y * CELL;
      layPiles(counts, grid).forEach((slot, n) => {
        const looks = LOOKS[slot.kind];
        const [name, k] = looks[(b.id + n * 7 + Math.round(slot.x)) % looks.length];
        const t: Texture | undefined = tex[name];
        if (!t) return;
        const s = this.things.addChild(new Sprite(t));
        s.anchor.set(0.5, 0.9);
        s.scale.set(k * ((n + b.id) % 3 === 0 ? -1 : 1), k);
        const x = ox + slot.x + (((n * 5 + b.id) % 5) - 2);
        const y = oy + slot.y + 6;
        s.position.set(Math.round(x), Math.round(y));
        s.zIndex = y;
        d!.sprites.push(s);
      });
    }
    for (const [id, d] of this.drawn)
      if (!seen.has(id)) {
        for (const s of d.sprites) s.destroy();
        this.drawn.delete(id);
        this.hide.delete(id);
      }
  }
}
