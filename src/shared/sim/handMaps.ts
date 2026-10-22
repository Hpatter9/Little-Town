// Hand-made maps of the game's special places (the owner's ask, after the hand-made raid boards: the dungeons' floors,
// the story places, the scenarios' starting valleys and the buildings' rooms, made the same way). Each kind is drawn
// in its own LDtk project under maps/ and turned by `node tools/ldtk-maps.mjs` (tools/ldtkMaps.ts) into a data file
// under data/, which is all the game reads: nothing parses LDtk at runtime. A kind says what it reads (`MapKindSpec`):
// its IntGrid layers, each value's identifier written as one char a cell, and its entities, each written as
// `[u, v, entity, ...its fields]`; the level's own fields come through as they are. The raid boards (sim/raidBoards.ts)
// keep their own shape. Pure: no Pixi, no DOM.

/** An IntGrid layer: the char each value's identifier is written as, and the char of a cell left empty. */
export interface GridSpec {
  layer: string;
  values: readonly { id: string; ch: string }[];
  empty: string;
}

/** An entity: the layer it's on, and the fields written after its place (in this order), each from these choices
 *  (an enum's values) or a number (`'int'`). */
export interface EntitySpec {
  layer: string;
  entity: string;
  fields: readonly { id: string; of: readonly string[] | 'int' }[];
}

/** A level field: a string, a number, or a list of strings (from these choices when given). */
export interface LevelFieldSpec {
  id: string;
  type: 'string' | 'int' | 'strings';
  of?: readonly string[];
  /** May be left empty. */
  optional?: boolean;
}

export interface MapKindSpec {
  /** The LDtk project (maps/...), the data file it becomes (src/shared/data/...), and what that file exports. */
  project: string;
  out: string;
  exportName: string;
  grids: readonly GridSpec[];
  entities: readonly EntitySpec[];
  levelFields: readonly LevelFieldSpec[];
  /** What the data file says it is, in its header. */
  what: string;
}

/** A thing on a map: its cell, its entity, then its fields in the spec's order. */
export type HandThing = [number, number, string, ...(string | number)[]];

/** One hand-made map, as the data file has it. */
export interface HandMap {
  /** The LDtk level's identifier. */
  id: string;
  w: number;
  h: number;
  fields: Record<string, string | number | string[]>;
  /** Each IntGrid layer as rows of chars. */
  grids: Record<string, string[]>;
  /** In reading order. */
  things: HandThing[];
}

/** A map's field as a string ('' when missing). */
export const fieldStr = (m: HandMap, id: string): string => {
  const v = m.fields[id];
  return typeof v === 'string' ? v : '';
};
/** A map's field as a list of strings. */
export const fieldList = (m: HandMap, id: string): string[] => {
  const v = m.fields[id];
  return Array.isArray(v) ? v : [];
};

/** The char at a cell of one of a map's grids (`out` off the map). */
export function cellOf(m: HandMap, layer: string, u: number, v: number, out = ' '): string {
  if (u < 0 || v < 0 || u >= m.w || v >= m.h) return out;
  return m.grids[layer]?.[v]?.[u] ?? out;
}

/** The shortest way between two cells by the four sides, through cells `open(u, v)` says can be walked (the ends are
 *  walked whatever they hold); null when there is none. Cells from `from` to `to`, both included. */
export function gridPath(w: number, h: number, open: (u: number, v: number) => boolean, from: [number, number], to: [number, number]): [number, number][] | null {
  const start = from[1] * w + from[0];
  const goal = to[1] * w + to[0];
  const prev = new Int32Array(w * h).fill(-1);
  prev[start] = start;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (c === goal) break;
    const u = c % w;
    const v = (c - u) / w;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nu = u + du;
      const nv = v + dv;
      if (nu < 0 || nv < 0 || nu >= w || nv >= h) continue;
      const n = nv * w + nu;
      if (prev[n] >= 0 || (n !== goal && !open(nu, nv))) continue;
      prev[n] = c;
      queue.push(n);
    }
  }
  if (prev[goal] < 0) return null;
  const out: [number, number][] = [];
  for (let c = goal; ; c = prev[c]) {
    out.push([c % w, Math.floor(c / w)]);
    if (c === start) break;
  }
  return out.reverse();
}
