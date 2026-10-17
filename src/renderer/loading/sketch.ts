// The town as the loading screen paints it behind the logo (mobile/loading.ts): the player's own map from the save,
// cut to the ground about the camp, each building's footprint and what sort of thing it is (a house, a hall, a tent, a
// field, a piece of the wall, the fire), and the order its lights come on in as the files arrive: the nearest the
// camp first, out to the edge. A town of a fire and a tent or two is still being founded: the founding scene instead.
// Pure, and small enough to post from page to page.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { depthOf } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';

export type SketchKind = 'house' | 'hall' | 'tent' | 'field' | 'wall' | 'fire';

export interface TownSketch {
  /** The cut of the land shown (cells), its ground (land.ts's codes) and roads ('#'), row by row. */
  x: number;
  y: number;
  w: number;
  h: number;
  ground: string;
  roads: string;
  /** Each building in the cut (cells, from the cut's corner), in the order their lights come on. */
  buildings: { x: number; y: number; w: number; h: number; kind: SketchKind; id: number }[];
  /** The town's people (a look's palette), and its season. */
  theme: string;
  season: string;
  /** Still being founded: the founding scene, not the map. */
  founding: boolean;
}

/** What the sketch needs of a town (a Snapshot has all of it). */
export interface SketchTown {
  camp: { x: number; y: number };
  theme: string;
  calendar: { season: string };
  land: { w: number; h: number; cells: string; roads: string };
  buildings: { id: number; def: string; tile: number; row: number; ring?: number; turned?: boolean; status: string; crop?: unknown; room?: boolean }[];
}

/** The cut reaches at least this far each way from the camp (cells), and at most this far. */
const LEAST_REACH = 14;
const MOST_REACH = 44;
/** A town with fewer finished buildings than this (beside the fire) is still being founded. */
const FOUNDED_AT = 3;

const kindOf = (b: SketchTown['buildings'][number]): SketchKind => {
  const def = BUILDING_BY_ID[b.def];
  if (b.ring !== undefined || (def?.hp && def.width <= 2 && !def.housing)) return 'wall';
  if (b.crop !== undefined || /field|orchard|pen|paddock|garden/.test(b.def)) return 'field';
  if (b.def === 'campfire' || /fire|brazier/.test(b.def)) return 'fire';
  if (/tent|lean_to|yurt|hut/.test(b.def)) return 'tent';
  if (def?.seat || (def && def.width >= 5)) return 'hall';
  return 'house';
};

export function townSketch(t: SketchTown, aspect = 393 / 852): TownSketch {
  const cx = Math.floor(t.camp.x / CELL);
  const cy = Math.floor(t.camp.y / CELL);
  const standing = t.buildings.filter((b) => !b.room);
  const founding = standing.filter((b) => b.status === 'done' && kindOf(b) !== 'fire').length < FOUNDED_AT;
  // (reach as far as the town does, in the screen's shape: a wide cut for a phone on its side)
  let reach = LEAST_REACH;
  for (const b of standing) reach = Math.max(reach, Math.abs(b.tile - cx) + 3, Math.abs(b.row - cy) + 3);
  reach = Math.min(MOST_REACH, reach);
  const wide = aspect >= 1;
  const rw = wide ? Math.round(reach * Math.min(2.2, aspect)) : reach;
  const rh = wide ? reach : Math.round(reach / Math.max(0.45, aspect));
  const x = Math.max(0, Math.min(t.land.w - 1, cx - rw));
  const y = Math.max(0, Math.min(t.land.h - 1, cy - rh));
  const w = Math.max(1, Math.min(t.land.w - x, rw * 2));
  const h = Math.max(1, Math.min(t.land.h - y, rh * 2));
  let ground = '';
  let roads = '';
  for (let r = y; r < y + h; r++) {
    ground += t.land.cells.slice(r * t.land.w + x, r * t.land.w + x + w);
    roads += t.land.roads.slice(r * t.land.w + x, r * t.land.w + x + w);
  }
  const buildings = standing
    .map((b) => {
      const def = BUILDING_BY_ID[b.def];
      const bw = def ? (b.turned ? depthOf(def) : def.width) : 1;
      const bh = def ? (b.turned ? def.width : depthOf(def)) : 1;
      return { x: b.tile - x, y: b.row - y, w: bw, h: bh, kind: kindOf(b), id: b.id, far: Math.hypot(b.tile + bw / 2 - cx, b.row + bh / 2 - cy) };
    })
    .filter((b) => b.x + b.w > 0 && b.y + b.h > 0 && b.x < w && b.y < h)
    .sort((a, b) => a.far - b.far)
    .map(({ far: _far, ...b }) => b);
  return { x, y, w, h, ground, roads, buildings, theme: t.theme, season: t.calendar.season, founding };
}
