// The town's boats (sim/boats.ts). The boats at home are moored in the water by the harbour or boatyard: side by side
// along the mooring, bobbing on the swell, sails furled, a ring of ripples round each waterline. A boat away with a
// party is drawn sailing a slow lane out in the open water past the mooring, sail set and a wake behind her, turning
// at each end (cosmetic only: it reads the snapshot's fleet and never changes the game). Drawn among the map's things
// (sorted by their feet) with the painted boats of art/boatArt.ts.

import { Container, Graphics, Sprite } from 'pixi.js';
import { CELL, groundAt, wet, type LandMap } from '../../shared/sim/land';
import type { Snapshot } from '../../shared/sim/snapshot';
import { boatArt, MAP_LENGTH } from '../art/boatArt';

interface Moored {
  sprite: Sprite;
  wake: Graphics;
  x: number;
  y: number;
  n: number;
}

/** A boat out sailing: where she is along the lane (0 to 1, and which way), drawn with her wake. */
interface Sailing {
  sprite: Sprite;
  wake: Graphics;
  n: number;
  length: number;
}

/** A sailing lane in open water: its two ends in px. */
interface Lane {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/** Seconds for a boat to sail the lane one way, and the most cells out past the mooring a lane runs. */
const LEG = 22;
const LANE_CELLS = 12;
const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class MapBoats {
  private readonly boats = new Map<number, Moored>();
  private readonly sailing = new Map<number, Sailing>();
  private lane: Lane | null = null;
  private laneCache: Lane | null = null;
  private laneFor = '';

  constructor(private readonly layer: Container) {}

  /** Match the moored boats to the fleet at home, and the sailing boats to the fleet away. */
  update(fleet: Snapshot['fleet'], mooring: Snapshot['mooring'], land?: LandMap): void {
    const home = mooring ? fleet.filter((b) => b.away === null) : [];
    const seen = new Set<number>();
    home.forEach((b, i) => {
      seen.add(b.id);
      let m = this.boats.get(b.id);
      const art = boatArt(b.kind, MAP_LENGTH[b.kind], true);
      if (!m) {
        const wake = this.layer.addChild(new Graphics());
        const sprite = this.layer.addChild(new Sprite(art.texture));
        sprite.anchor.set(0.5, 0.92);
        m = { sprite, wake, x: 0, y: 0, n: b.id };
        this.boats.set(b.id, m);
      }
      m.sprite.texture = art.texture;
      // (side by side down the mooring, a little apart)
      m.x = (mooring!.x + 0.5) * CELL + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 14;
      m.y = (mooring!.y + 0.75) * CELL + i * 6;
      // (the ring of ripples round her waterline)
      const half = MAP_LENGTH[b.kind] / 2;
      m.wake.clear().ellipse(0, 0, half + 3, 4).stroke({ width: 1, color: 0xe8f6f4, alpha: 0.55 });
    });
    for (const [id, m] of this.boats) {
      if (seen.has(id)) continue;
      m.sprite.destroy();
      m.wake.destroy();
      this.boats.delete(id);
    }

    // the boats away: out on the lane in open water
    const lane = mooring && land ? this.laneAt(land, mooring) : null;
    const out = lane ? fleet.filter((b) => b.away !== null) : [];
    const seenOut = new Set<number>();
    for (const b of out) {
      seenOut.add(b.id);
      const length = MAP_LENGTH[b.kind];
      let s = this.sailing.get(b.id);
      const art = boatArt(b.kind, length);
      if (!s) {
        const wake = this.layer.addChild(new Graphics());
        const sprite = this.layer.addChild(new Sprite(art.texture));
        sprite.anchor.set(0.5, 0.92);
        s = { sprite, wake, n: b.id, length };
        this.sailing.set(b.id, s);
      }
      s.sprite.texture = art.texture;
      s.length = length;
      // (a wake trailing astern: a few lines fanning out behind the stern; drawn facing right, flipped with her)
      const half = length / 2;
      s.wake.clear()
        .moveTo(-half, 0).lineTo(-half - 18, -3)
        .moveTo(-half, 0).lineTo(-half - 22, 0)
        .moveTo(-half, 0).lineTo(-half - 18, 3)
        .stroke({ width: 1, color: 0xe8f6f4, alpha: 0.6 });
    }
    for (const [id, s] of this.sailing) {
      if (seenOut.has(id)) continue;
      s.sprite.destroy();
      s.wake.destroy();
      this.sailing.delete(id);
    }
    this.lane = lane;
  }

  /** The lane past the mooring: the way the water runs longest from it, kept until the mooring moves. Null where there
   *  is too little open water. */
  private laneAt(land: LandMap, mooring: { x: number; y: number }): Lane | null {
    const key = `${mooring.x},${mooring.y},${land.w}`;
    if (key === this.laneFor) return this.laneCache;
    this.laneFor = key;
    let best = 0;
    let dir = DIRS[0];
    for (const d of DIRS) {
      let n = 0;
      while (n < LANE_CELLS && inside(land, mooring.x + d[0] * (n + 1), mooring.y + d[1] * (n + 1)) && wet(groundAt(land, mooring.x + d[0] * (n + 1), mooring.y + d[1] * (n + 1)))) n++;
      if (n > best) {
        best = n;
        dir = d;
      }
    }
    if (best < 5) return this.rememberLane(null);
    const at = (k: number) => ({ x: (mooring.x + 0.5 + dir[0] * k) * CELL, y: (mooring.y + 0.75 + dir[1] * k) * CELL });
    const a = at(3);
    const b = at(best - 0.5);
    return this.rememberLane({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
  }
  private rememberLane(l: Lane | null): Lane | null {
    this.laneCache = l;
    return l;
  }

  /** Bob them on the swell, and sail the boats that are away along their lane. */
  render(now: number): void {
    for (const m of this.boats.values()) {
      const bob = Math.sin(now / 700 + m.n) * 1.2;
      m.sprite.position.set(Math.round(m.x), Math.round(m.y + bob));
      m.sprite.rotation = Math.sin(now / 1100 + m.n * 2) * 0.03;
      m.wake.position.set(Math.round(m.x), Math.round(m.y));
      m.wake.alpha = 0.6 + Math.sin(now / 500 + m.n) * 0.3;
      m.sprite.zIndex = m.y;
      m.wake.zIndex = m.y - 1;
    }
    const lane = this.lane;
    if (!lane) return;
    for (const s of this.sailing.values()) {
      // (back and forth along the lane, each boat at her own place in the round, easing at each turn)
      const round = (now / 1000 / LEG + s.n * 0.37) % 2;
      const forth = round < 1;
      const t = forth ? round : 2 - round;
      const e = 0.5 - Math.cos(t * Math.PI) / 2;
      const x = lane.ax + (lane.bx - lane.ax) * e + Math.sin(s.n) * 6;
      const y = lane.ay + (lane.by - lane.ay) * e + (s.n % 3) * 7;
      const bob = Math.sin(now / 600 + s.n) * 1.4;
      // (the bow points the way she sails; the art faces right)
      const sx = (forth ? lane.bx - lane.ax : lane.ax - lane.bx) >= 0 ? 1 : -1;
      s.sprite.scale.x = sx;
      s.sprite.position.set(Math.round(x), Math.round(y + bob));
      s.sprite.rotation = Math.sin(now / 900 + s.n) * 0.04;
      s.wake.scale.x = sx;
      s.wake.position.set(Math.round(x), Math.round(y));
      s.wake.alpha = 0.5 + Math.sin(now / 400 + s.n) * 0.25;
      s.sprite.zIndex = y;
      s.wake.zIndex = y - 1;
    }
  }
}

const inside = (m: LandMap, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h;
