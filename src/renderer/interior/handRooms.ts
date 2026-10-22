// Rooms furnished by hand (the owner's ask: hand-made maps of the game's special places, the buildings' insides last):
// the tavern's common room, the town hall, a shop, the smithy, the chapel, a cottage and a longhouse. Each is drawn in
// `maps/rooms.ldtk` (one level a room, a 16px cell a floor tile) and turned by `node tools/ldtk-maps.mjs` into
// `data/interiorRooms.ts`. When a building is looked into (interiorView.ts), a room drawn for it (by its building, `defs`,
// or by what kind of room it is, `kinds`; a home's with beds enough for everyone who sleeps there) is furnished as drawn;
// among several, the building's own id picks, so it's the same room each time. A building with none is furnished as it
// always was (interiorView.ts `layout`). Its `Spot`s are where the folk go: beds, the stations worked at, desks, seats
// and the hearth. Only the view reads it. Pure: no DOM (the tests import it).

import { INTERIOR_ROOMS } from '../../shared/data/interiorRooms';
import { hashSeed } from '../../shared/rng';
import { cellOf, fieldList, type HandMap, type MapKindSpec } from '../../shared/sim/handMaps';

/** What a room is (map/roomKinds.ts's kinds, and the view's own temple and barracks). */
export const ROOM_KINDS = ['hall', 'home', 'store', 'study', 'forge', 'healer', 'kitchen', 'treasury', 'mine', 'work', 'temple', 'barracks'] as const;
/** What a room is furnished with (interiorView.ts `FURNITURE` draws each); `_r` faces the other way. */
export const FURNITURE = [
  'bed', 'chair', 'chair_r', 'chair_up', 'round_table', 'table', 'long_table', 'throne', 'candle', 'candelabra', 'shelf', 'shelf_books', 'shelf_books2',
  'cabinet', 'desk', 'desk2', 'cross', 'pot', 'barrel', 'crate', 'crate_stack', 'crates_pair', 'crate_barrel', 'chest', 'chest_gold', 'rack', 'rack2',
  'shields', 'potions', 'plants', 'pots', 'jar', 'gold', 'book', 'stool', 'table_small', 'tall_shelf', 'rug_grey',
] as const;
export type Furniture = (typeof FURNITURE)[number];
/** Where the folk go. */
export const SPOT_KINDS = ['bed', 'station', 'desk', 'seat', 'hearth'] as const;
export type SpotKind = (typeof SPOT_KINDS)[number];
/** A fire: a furnace or a brazier. */
export const FIRE_KINDS = ['forge', 'brazier'] as const;
/** The floor: planks, flagstones, the red rug (laid by its neighbours). */
export const ROOM_FLOORS: readonly { ch: string; id: string }[] = [
  { ch: '.', id: 'planks' },
  { ch: 'o', id: 'stone' },
  { ch: 'r', id: 'rug' },
];

export const ROOM_SPEC: MapKindSpec = {
  project: 'maps/rooms.ldtk',
  out: 'src/shared/data/interiorRooms.ts',
  exportName: 'INTERIOR_ROOMS',
  what: 'The rooms furnished by hand (renderer/interior/handRooms.ts)',
  grids: [{ layer: 'Floor', values: ROOM_FLOORS, empty: '.' }],
  entities: [
    { layer: 'Things', entity: 'Furniture', fields: [{ id: 'kind', of: FURNITURE }] },
    { layer: 'Things', entity: 'Spot', fields: [{ id: 'kind', of: SPOT_KINDS }] },
    { layer: 'Things', entity: 'Fire', fields: [{ id: 'kind', of: FIRE_KINDS }] },
  ],
  levelFields: [
    { id: 'name', type: 'string' },
    { id: 'about', type: 'string', optional: true },
    { id: 'kinds', type: 'strings', of: ROOM_KINDS, optional: true },
    { id: 'defs', type: 'strings', optional: true },
  ],
};

/** A room's spots of a kind (cells). */
export const spotsOf = (m: HandMap, kind: SpotKind): [number, number][] => m.things.filter((t) => t[2] === 'Spot' && t[3] === kind).map((t) => [t[0], t[1]]);

/** The rooms drawn for a building: its own (by its id) if any, else its kind's; a home's with a bed for each sleeper. */
export function roomsFor(def: string, kind: string, beds: number): HandMap[] {
  const own = INTERIOR_ROOMS.filter((m) => fieldList(m, 'defs').includes(def));
  const fit = own.length ? own : INTERIOR_ROOMS.filter((m) => fieldList(m, 'kinds').includes(kind));
  return fit.filter((m) => spotsOf(m, 'bed').length >= beds || kind !== 'home');
}

/** For previews only (the strip's `__room(id)` console hook): every building looked into is this room. Never set in
 *  play. */
export const roomPreview: { id?: string } = {};

/** The room a building is furnished as (null: furnished as it always was): among several, picked by its id. */
export function handRoomFor(def: string, kind: string, beds: number, building: number): HandMap | null {
  if (roomPreview.id) return INTERIOR_ROOMS.find((m) => m.id === roomPreview.id) ?? null;
  const fit = roomsFor(def, kind, beds);
  if (!fit.length) return null;
  // (the smallest room that holds them all first, so a cottage isn't a hall: among the same, the building's own pick)
  const least = Math.min(...fit.map((m) => m.w * m.h));
  const small = fit.filter((m) => m.w * m.h <= least * 1.3);
  return small[hashSeed(`room:${building}`) % small.length];
}

export const roomFloor = (m: HandMap, u: number, v: number): string => cellOf(m, 'Floor', u, v, '.');

/** The room an inn's or a shop's own window is drawn from (the venue windows in panel/shopPanel.ts): the Common Room for
 *  the inns, the Shop for every shop. Null if the map isn't there. */
export const venueRoom = (venue: 'shop' | 'tavern'): HandMap | null => INTERIOR_ROOMS.find((m) => m.id === (venue === 'tavern' ? 'Tavern' : 'Shop')) ?? null;

/** Where a venue's people stand in its room (cells, their feet): the keeper at the first place behind the counter,
 *  customers at the counter in front of it, a browser or a guest about the open floor (a tavern's seats and hearth
 *  as well), and the door they come and go by, below the room's middle. */
export interface VenueSpots {
  keeper: { x: number; y: number };
  counter: { x: number; y: number }[];
  browse: { x: number; y: number }[];
  door: { x: number; y: number };
}
const WIDE: Readonly<Record<string, number>> = { long_table: 3 };
export function venueSpots(m: HandMap): VenueSpots {
  const stations = spotsOf(m, 'station');
  const base = stations[0] ?? [Math.floor(m.w / 2), 1];
  const behind = Math.max(...stations.map((s) => s[1]), base[1]);
  // (cells with something standing on them)
  const taken = new Set<string>();
  for (const t of m.things)
    if (t[2] === 'Furniture' && t[3] !== 'rug_grey') for (let k = 0; k < (WIDE[t[3]] ?? 1); k++) taken.add(`${t[0] + k},${t[1]}`);
  const at = (u: number, v: number) => ({ x: u + 0.5, y: v + 0.9 });
  const browse: { x: number; y: number }[] = [];
  // (the places to sit and the hearth first, then the open floor in front of the counter)
  for (const kind of ['seat', 'hearth'] as const) for (const [u, v] of spotsOf(m, kind)) browse.push(at(u, v));
  for (let v = behind + 2; v < m.h; v++) for (let u = 0; u < m.w; u++) if (!taken.has(`${u},${v}`)) browse.push(at(u, v));
  // (the counter's front: the row under the one the keepers' places are behind)
  const counter = (stations.length ? stations : [base]).slice(0, 2).map(([u]) => at(u, behind + 2));
  return { keeper: at(base[0], base[1]), counter: counter.length > 1 ? counter : [counter[0], at(base[0] + 1, behind + 2)], browse, door: { x: m.w / 2, y: m.h - 0.1 } };
}
