// The story places drawn by hand (the owner's ask: hand-made maps of the game's special places): a dragon's lair, a
// ruined keep, a rival lord's castle, a haunted barrow, a bandit camp, a shrine in the woods. Each is drawn in
// `maps/story-places.ldtk` (one level a place, in the dungeon floors' format: sim/delveFloors.ts) and turned by
// `node tools/ldtk-maps.mjs` into `data/storyPlaces.ts`. A trip whose destination is one of them (the dragon's lair on
// the Expedition Board, a saga's trip to a camp, a barrow or a keep, a robbed cart's robbers, the old town's barrow...)
// is seen going through it on the watch screen: its rooms are the spots the party makes for, one after another, while
// it's there. Which place a trip goes to is matched by its destination (`dests`: ids, or the start of one), the words
// in its name (`words`), or the kind of place on the land it is (`kinds`, data/places.ts); among several, the
// 'storyPlace' side stream (by the town's seed and the trip) picks, so it's the same each time and nothing else is
// drawn on. Only the watch screen reads it: no rule changes, nothing saved.

import { STORY_PLACES } from '../data/storyPlaces';
import { isPlaceDest, placeIdOf, type PlaceKind } from '../data/places';
import { hashSeed, Rng } from '../rng';
import { FLOOR_LOOKS, FLOOR_SPEC } from './delveFloors';
import { fieldList, type HandMap, type MapKindSpec } from './handMaps';
import type { GameState } from './state';

export const PLACE_KINDS: readonly PlaceKind[] = ['vein', 'cave', 'cart', 'beast', 'ruin', 'bones', 'reef', 'nest'];

export const STORY_SPEC: MapKindSpec = {
  project: 'maps/story-places.ldtk',
  out: 'src/shared/data/storyPlaces.ts',
  exportName: 'STORY_PLACES',
  what: 'The story places drawn by hand (sim/storyPlaces.ts)',
  grids: FLOOR_SPEC.grids,
  entities: FLOOR_SPEC.entities,
  levelFields: [
    { id: 'name', type: 'string' },
    { id: 'about', type: 'string', optional: true },
    { id: 'look', type: 'string', of: FLOOR_LOOKS },
    { id: 'dests', type: 'strings', optional: true },
    { id: 'words', type: 'strings', optional: true },
    { id: 'kinds', type: 'strings', of: PLACE_KINDS, optional: true },
  ],
};

/** The looks seen in daylight (the rest are underground: lit by the party's torches). */
const OPEN_LOOKS: ReadonlySet<string> = new Set(['castle', 'ruin', 'camp', 'grove']);
export const openAir = (m: HandMap): boolean => OPEN_LOOKS.has(String(m.fields.look));

/** The places a trip to this destination (its id, its name, the kind of place on the land it is) may be seen at. */
export function placesFor(dest: string, name: string, kind?: PlaceKind): HandMap[] {
  const lower = name.toLowerCase();
  return STORY_PLACES.filter(
    (m) =>
      fieldList(m, 'dests').some((d) => dest === d || (d.endsWith(':') && dest.startsWith(d))) ||
      fieldList(m, 'words').some((w) => new RegExp(`\\b${w.toLowerCase()}`).test(lower)) ||
      (!!kind && fieldList(m, 'kinds').includes(kind)),
  );
}

/** For previews only (the `__storyPlace(id)` console hook): every trip is seen at this place. Never set in play. */
export const storyPreview: { id?: string } = {};

/** The place a trip is seen going through (null: none drawn for it, the watch screen as before). */
export function storyPlaceOf(s: GameState, trip: { id: number; dest: string }, name: string): HandMap | null {
  if (storyPreview.id) return storyPlaceById(storyPreview.id) ?? null;
  const kind = isPlaceDest(trip.dest) ? s.places?.find((p) => p.id === placeIdOf(trip.dest))?.kind : undefined;
  const fit = placesFor(trip.dest, name, kind);
  if (!fit.length) return null;
  if (fit.length === 1) return fit[0];
  return fit[new Rng(hashSeed(`${s.seed}:storyPlace:${trip.id}`)).int(0, fit.length - 1)];
}

export const storyPlaceById = (id: string | undefined): HandMap | undefined => (id ? STORY_PLACES.find((m) => m.id === id) : undefined);
