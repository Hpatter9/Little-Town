// What a dungeon's floor (sim/delveFloors.ts) is drawn with, tile by tile, from DawnLike's 16px tiles cut into
// art/floors/tiles.png by tools/compose-floor-art.py: each look's walls laid by the pieces their neighbours make
// (art/autotile.ts) wherever solid rock meets open ground (deeper rock is left black), its floor and rough floor, the
// red rug laid by its neighbours, water, deep water, chasms and lava with their lip where the ground above isn't the
// same, doors, stairs, and the props. A secret door is drawn as wall until the party has found it. Pure: no Pixi, no
// DOM (the preview tool and the tests import it); floorMap.ts draws what it says.

import { maskOf, pieceOf } from '../art/autotile';
import { FLOOR_ROCK, floorCell, floorLook, type FloorLook } from '../../shared/sim/delveFloors';
import type { HandMap } from '../../shared/sim/handMaps';
import index from '../art/floors/tiles.json';

export const TILE_COLS: number = index.cols;
const TILES: Record<string, number> = index.tiles;
/** A tile's cell in the sheet (-1: none). */
export const tileIndex = (name: string): number => TILES[name] ?? -1;
/** Whether a tile has a second frame. */
export const animated = (name: string): boolean => `${name}@1` in TILES;

/** A tile to lay: its name in the sheet, and its cell. */
export interface Laid {
  name: string;
  u: number;
  v: number;
}

const LIQUIDS: Record<string, string> = { '~': 'water', W: 'deep', P: 'chasm', L: 'lava' };
const OUTDOORS: Record<string, string> = { g: 'grass', d: 'dirt', s: 'sand', n: 'snow' };

/** The ground and walls of a floor (`found`: the secret doors found, by cell). */
export function groundTiles(m: HandMap, found: ReadonlySet<number> = new Set()): Laid[] {
  const look: FloorLook = floorLook(m);
  const at = (u: number, v: number) => floorCell(m, u, v);
  const solid = (u: number, v: number) => {
    const c = at(u, v);
    return c === FLOOR_ROCK || c === '#' || (c === 'S' && !found.has(v * m.w + u));
  };
  const wall = (u: number, v: number) => {
    if (!solid(u, v)) return false;
    for (let dv = -1; dv <= 1; dv++) for (let du = -1; du <= 1; du++) if ((du || dv) && u + du >= 0 && v + dv >= 0 && u + du < m.w && v + dv < m.h && !solid(u + du, v + dv)) return true;
    return false;
  };
  const out: Laid[] = [];
  for (let v = 0; v < m.h; v++) {
    for (let u = 0; u < m.w; u++) {
      const c = at(u, v);
      if (solid(u, v)) {
        if (wall(u, v)) out.push({ name: `wall:${look}:${pieceOf(maskOf((du, dv) => wall(u + du, v + dv)))}`, u, v });
        continue;
      }
      const liquid = LIQUIDS[c];
      if (liquid) {
        out.push({ name: at(u, v - 1) === c ? liquid : `${liquid}_edge`, u, v });
        continue;
      }
      if (c === 'c') {
        const rug = (du: number, dv: number) => at(u + du, v + dv) === 'c';
        const x = !rug(-1, 0) && rug(1, 0) ? 0 : rug(-1, 0) && !rug(1, 0) ? 2 : 1;
        const y = !rug(0, -1) && rug(0, 1) ? 0 : rug(0, -1) && !rug(0, 1) ? 2 : 1;
        out.push({ name: `floor:${look}`, u, v }, { name: `rug:${x}${y}`, u, v });
        continue;
      }
      if (c === 'i') out.push({ name: 'ice', u, v });
      else if (OUTDOORS[c]) out.push({ name: c === 'g' && (((u * 73856093) ^ (v * 19349663)) >>> 0) % 17 === 0 ? 'grass_dark' : OUTDOORS[c], u, v });
      else if (c === '=') {
        // (a bridge over whatever it crosses: the liquid beside it)
        const under = [at(u - 1, v), at(u + 1, v), at(u, v - 1), at(u, v + 1)].find((x) => LIQUIDS[x]);
        if (under) out.push({ name: LIQUIDS[under], u, v });
        out.push({ name: 'bridge', u, v });
      } else out.push({ name: c === ',' || c === 'S' ? `rough:${look}` : `floor:${look}`, u, v });
      if (c === '+') out.push({ name: look === 'vault' ? 'door_iron' : look === 'crypt' || look === 'temple' ? 'door_stone' : 'door', u, v });
      else if (c === '<') out.push({ name: 'stairs', u, v });
      else if (c === 'S') out.push({ name: 'rubble', u, v });
    }
  }
  return out;
}

/** The props of a floor (a pillar is the look's own wall post). */
export function propTiles(m: HandMap): Laid[] {
  const look = floorLook(m);
  const out: Laid[] = [];
  for (const t of m.things) {
    if (t[2] !== 'Prop') continue;
    const name = t[3] === 'pillar' ? `wall:${look}:post` : String(t[3]);
    if (tileIndex(name) >= 0) out.push({ name, u: t[0], v: t[1] });
  }
  return out;
}
