// The dungeons' floors drawn by hand (the owner's ask: hand-made maps of the game's special places, made like the raid
// boards). A floor is drawn in `maps/delve-floors.ldtk` (one level a floor) and turned by `node tools/ldtk-maps.mjs`
// into `data/delveFloors.ts`. It lays out a delve (sim/delves.ts) as a place: its rooms are `Room` things numbered in
// the order the party goes through them (step 0 the way in, the last the boss's lair), each of a room kind, so the
// floor's rooms are the delve's rooms; corridors, doors, secret doors, water, chasms, lava and bridges lie between,
// dressed with props. When a party sets off for a dungeon whose kind a floor is drawn for, and the floor has about as
// many rooms as the dungeon, it's picked from a side stream ('delveFloor', by the town's seed and the trip, so neither
// the town's stream nor the delve's own dice are drawn on) `HAND_FLOOR_SHARE` of the time; otherwise the rooms are
// rolled as they always were, and the map the watcher sees is laid out from them (`generatedFloor`).
// The rules don't read the floor beyond its rooms' kinds: it is where the watched party is seen to go.

import { DELVE_FLOORS } from '../data/delveFloors';
import type { DungeonDef, DungeonType, RoomKind } from '../data/dungeons';
import { hashSeed, Rng } from '../rng';
import { cellOf, fieldList, fieldStr, gridPath, type HandMap, type MapKindSpec } from './handMaps';
import type { Expedition, GameState } from './state';

/** How often a delve that has a hand-made floor to fit it goes down one (the rest are rolled room by room). */
export const HAND_FLOOR_SHARE = 0.75;
/** A floor fits a dungeon whose rooms (with the boss's) are within this many of its own. */
export const FLOOR_ROOM_SLACK = 2;

/** The grounds of a floor: the char the data file writes, the LDtk value's identifier, and whether it's walked. An
 *  empty cell is solid rock (drawn as wall where it meets open ground). */
export const FLOOR_GROUNDS: readonly { ch: string; id: string; walk: boolean }[] = [
  { ch: '.', id: 'floor', walk: true },
  { ch: ',', id: 'rough', walk: true },
  { ch: 'c', id: 'carpet', walk: true },
  { ch: '~', id: 'water', walk: true },
  { ch: 'W', id: 'deep', walk: false },
  { ch: 'P', id: 'chasm', walk: false },
  { ch: 'L', id: 'lava', walk: false },
  { ch: '=', id: 'bridge', walk: true },
  { ch: '+', id: 'door', walk: true },
  { ch: 'S', id: 'secret', walk: true },
  { ch: 'i', id: 'ice', walk: true },
  { ch: '<', id: 'stairs', walk: true },
  { ch: '#', id: 'wall', walk: false },
  // (out of doors: the story places, sim/storyPlaces.ts)
  { ch: 'g', id: 'grass', walk: true },
  { ch: 'd', id: 'dirt', walk: true },
  { ch: 's', id: 'sand', walk: true },
  { ch: 'n', id: 'snow', walk: true },
];
export const FLOOR_ROCK = ' ';
const WALK = new Set(FLOOR_GROUNDS.filter((g) => g.walk).map((g) => g.ch));

/** How a floor looks (its walls and floors from DawnLike: renderer/delve/floorArt.ts); the dungeon kinds it suits. */
export const FLOOR_LOOKS = ['crypt', 'cave', 'mine', 'temple', 'ice', 'forge', 'tower', 'fey', 'vault', 'wreck', 'castle', 'ruin', 'camp', 'grove'] as const;
export type FloorLook = (typeof FLOOR_LOOKS)[number];
/** The look a dungeon's floor is drawn in when it's laid out from its rolled rooms. */
export const LOOK_OF_TYPE: Readonly<Record<DungeonType, FloorLook>> = {
  crypt: 'crypt', warren: 'cave', mine: 'mine', fey: 'fey', temple: 'temple', tower: 'tower', nest: 'cave', wreck: 'wreck', ice: 'ice', forge: 'forge', vault: 'vault', den: 'forge',
};
export const DUNGEON_TYPES: readonly DungeonType[] = ['crypt', 'warren', 'mine', 'fey', 'temple', 'tower', 'nest', 'wreck', 'ice', 'forge', 'vault', 'den'];

/** A room's kind on the floor: the way in, or one of the delve's (a rival party is met wherever the delve says). */
export const FLOOR_ROOM_KINDS = ['entry', 'fight', 'trap', 'treasure', 'shrine', 'puzzle', 'camp', 'fork', 'boss'] as const;
export type FloorRoomKind = (typeof FLOOR_ROOM_KINDS)[number];

/** What a floor is dressed with. Low ones (`FLOOR_LOW`) are walked over; the rest stand in the way. */
export const FLOOR_PROPS = [
  'torch', 'brazier', 'candles', 'chest', 'gold', 'coffin', 'bones', 'skull', 'statue', 'altar', 'barrel', 'crate', 'table', 'chair', 'shelf', 'web',
  'banner', 'pillar', 'crystal', 'mushroom', 'rock', 'grave', 'cage', 'throne', 'spikes', 'darts', 'plate', 'lever', 'bed', 'campfire', 'roots',
  'portcullis', 'rubble', 'lantern', 'blood_altar', 'tree', 'pine', 'deadtree', 'snowpine', 'bush', 'flowers', 'peak',
] as const;
export type FloorProp = (typeof FLOOR_PROPS)[number];
export const FLOOR_LOW: ReadonlySet<FloorProp> = new Set<FloorProp>(['candles', 'gold', 'bones', 'skull', 'web', 'spikes', 'darts', 'plate', 'roots', 'rubble', 'mushroom', 'portcullis', 'flowers']);

export const FLOOR_SPEC: MapKindSpec = {
  project: 'maps/delve-floors.ldtk',
  out: 'src/shared/data/delveFloors.ts',
  exportName: 'DELVE_FLOORS',
  what: 'The dungeons\' hand-made floors (sim/delveFloors.ts)',
  grids: [{ layer: 'Ground', values: FLOOR_GROUNDS.map(({ ch, id }) => ({ ch, id })), empty: FLOOR_ROCK }],
  entities: [
    { layer: 'Things', entity: 'Room', fields: [{ id: 'kind', of: FLOOR_ROOM_KINDS }, { id: 'step', of: 'int' }] },
    { layer: 'Things', entity: 'Prop', fields: [{ id: 'kind', of: FLOOR_PROPS }] },
  ],
  levelFields: [
    { id: 'name', type: 'string' },
    { id: 'about', type: 'string', optional: true },
    { id: 'look', type: 'string', of: FLOOR_LOOKS },
    { id: 'types', type: 'strings', of: DUNGEON_TYPES },
  ],
};

export interface FloorRoom {
  kind: FloorRoomKind;
  step: number;
  u: number;
  v: number;
}

/** A floor's rooms in the order they're gone through (the way in first). */
export function floorRooms(m: HandMap): FloorRoom[] {
  return m.things
    .filter((t) => t[2] === 'Room')
    .map((t) => ({ u: t[0], v: t[1], kind: t[3] as FloorRoomKind, step: Number(t[4]) }))
    .sort((a, b) => a.step - b.step);
}

/** The delve's rooms a floor makes (its rooms after the way in). */
export const floorKinds = (m: HandMap): RoomKind[] => floorRooms(m).slice(1).map((r) => r.kind as RoomKind);

export const floorLook = (m: HandMap): FloorLook => (fieldStr(m, 'look') || 'crypt') as FloorLook;
export const floorName = (m: HandMap): string => fieldStr(m, 'name') || m.id.replace(/_/g, ' ');

/** The floors drawn for a dungeon with this many rooms to go through (the boss's among them). */
export function floorsFor(d: DungeonDef, count: number): HandMap[] {
  return DELVE_FLOORS.filter((m) => fieldList(m, 'types').includes(d.type) && Math.abs(floorKinds(m).length - count) <= FLOOR_ROOM_SLACK);
}

/** For previews only (the `__delveFloor(id)` console hook): every delve goes down this floor if it's drawn for the
 *  dungeon's kind ('rolled': never a hand-made one). Never set in play. */
export const floorPreview: { id?: string } = {};

/** The hand-made floor a delve goes down, or null to roll its rooms (`HAND_FLOOR_SHARE` of the delves that have one to
 *  fit; the 'delveFloor' side stream's, by the town's seed and the trip). Never for a town with the autopilot off. */
export function pickFloor(s: GameState, e: Expedition, d: DungeonDef, count: number): HandMap | null {
  if (floorPreview.id === 'rolled') return null;
  const shown = floorPreview.id ? DELVE_FLOORS.find((m) => m.id === floorPreview.id && fieldList(m, 'types').includes(d.type)) : undefined;
  if (shown) return shown;
  if (!s.autopilot) return null;
  const fit = floorsFor(d, count);
  if (!fit.length) return null;
  const rng = new Rng(hashSeed(`${s.seed}:delveFloor:${e.id}`));
  if (rng.next() >= HAND_FLOOR_SHARE) return null;
  return fit[rng.int(0, fit.length - 1)];
}

export const floorById = (id: string | undefined): HandMap | undefined => (id ? DELVE_FLOORS.find((m) => m.id === id) : undefined);

/** A floor's ground at a cell (rock off the map). */
export const floorCell = (m: HandMap, u: number, v: number): string => cellOf(m, 'Ground', u, v, FLOOR_ROCK);
/** The props standing in the way, by cell. */
function blockers(m: HandMap): Set<number> {
  const out = new Set<number>();
  for (const t of m.things) if (t[2] === 'Prop' && !FLOOR_LOW.has(t[3] as FloorProp)) out.add(t[1] * m.w + t[0]);
  return out;
}
/** Whether a cell is walked (open ground, nothing standing in the way). */
export function floorWalks(m: HandMap, u: number, v: number, blocked = blockers(m)): boolean {
  return WALK.has(floorCell(m, u, v)) && !blocked.has(v * m.w + u);
}

/** The way the party walks from one room to the next (cells, both ends included); null if there's none. */
export function floorPath(m: HandMap, from: FloorRoom, to: FloorRoom): [number, number][] | null {
  const blocked = blockers(m);
  return gridPath(m.w, m.h, (u, v) => floorWalks(m, u, v, blocked), [from.u, from.v], [to.u, to.v]);
}

/* ------------------------------------------------------------ the floor laid out from rolled rooms */

/** The props a room of each kind is dressed with when its floor is laid out (the first stands at its middle). */
const ROOM_DRESS: Readonly<Record<FloorRoomKind, FloorProp[]>> = {
  entry: ['torch'],
  fight: ['bones', 'barrel'],
  trap: ['spikes', 'darts'],
  treasure: ['chest', 'gold'],
  shrine: ['altar', 'candles'],
  puzzle: ['lever', 'statue'],
  camp: ['campfire', 'bed'],
  fork: ['torch', 'rubble'],
  boss: ['bones', 'skull', 'brazier'],
};

/** A floor for a delve whose rooms were rolled (and for one begun before floors were drawn): its rooms in a winding
 *  chain of chambers joined by corridors, each dressed for what it is, from the delve's own seed, so it's the same
 *  each time it's drawn. Pure; the renderer draws it as it draws a hand-made one. */
export function generatedFloor(kinds: readonly string[], seed: number, look: FloorLook): HandMap {
  const rng = new Rng(seed >>> 0);
  const all: FloorRoomKind[] = ['entry', ...(kinds.map((k) => (k === 'rival' ? 'fight' : k)) as FloorRoomKind[])];
  const cols = 4;
  const SW = 8;
  const SH = 7;
  const slots = Math.ceil(all.length / cols);
  const w = cols * SW + 1;
  const h = slots * SH + 1;
  const g: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => FLOOR_ROCK));
  const things: HandMap['things'] = [];
  const centres: [number, number][] = [];
  all.forEach((kind, i) => {
    const row = Math.floor(i / cols);
    const col = row % 2 ? cols - 1 - (i % cols) : i % cols;
    const big = kind === 'boss' ? 1 : 0;
    const rw = rng.int(3, 4) + big * 2;
    const rh = rng.int(3, 4) + big;
    const x0 = col * SW + 1 + rng.int(0, SW - 1 - rw);
    const y0 = row * SH + 1 + rng.int(0, SH - 1 - rh);
    for (let v = y0; v < y0 + rh; v++) for (let u = x0; u < x0 + rw; u++) g[v][u] = kind === 'shrine' || kind === 'boss' ? 'c' : '.';
    const cu = x0 + Math.floor(rw / 2);
    const cv = y0 + Math.floor(rh / 2);
    centres.push([cu, cv]);
    things.push([cu, cv, 'Room', kind, i]);
    const dress = ROOM_DRESS[kind];
    // (the first of its dressing by the wall at its back, the rest in its corners)
    const spots: [number, number][] = [[x0, y0], [x0 + rw - 1, y0], [x0, y0 + rh - 1], [x0 + rw - 1, y0 + rh - 1]];
    dress.forEach((p, j) => {
      const [u, v] = spots[(j + rng.int(0, 3)) % 4];
      if (!things.some((t) => t[0] === u && t[1] === v)) things.push([u, v, 'Prop', p]);
    });
    if (kind === 'entry') g[y0][cu] = '<';
  });
  // the corridors: from each room to the next, along then down (or down then along)
  for (let i = 1; i < centres.length; i++) {
    const [au, av] = centres[i - 1];
    const [bu, bv] = centres[i];
    const first = rng.chance(0.5);
    const lay = (u: number, v: number) => {
      if (g[v][u] === FLOOR_ROCK) g[v][u] = ',';
    };
    if (first) {
      for (let u = Math.min(au, bu); u <= Math.max(au, bu); u++) lay(u, av);
      for (let v = Math.min(av, bv); v <= Math.max(av, bv); v++) lay(bu, v);
    } else {
      for (let v = Math.min(av, bv); v <= Math.max(av, bv); v++) lay(au, v);
      for (let u = Math.min(au, bu); u <= Math.max(au, bu); u++) lay(u, bv);
    }
  }
  // (nothing left standing on the way from a room to the next)
  const rows = g.map((r) => r.join(''));
  const onWay = new Set<number>();
  for (let i = 1; i < centres.length; i++) {
    const way = gridPath(w, h, (u, v) => WALK.has(rows[v][u]), centres[i - 1], centres[i]);
    for (const [u, v] of way ?? []) onWay.add(v * w + u);
  }
  const kept = things.filter((t) => t[2] !== 'Prop' || FLOOR_LOW.has(t[3] as FloorProp) || !onWay.has(t[1] * w + t[0]));
  kept.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return { id: 'rolled', w, h, fields: { name: '', look, types: [] }, grids: { Ground: rows }, things: kept };
}
