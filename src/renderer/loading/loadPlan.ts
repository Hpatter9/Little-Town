// What the loading screen warms before the town is shown (the owner's ask: no code-drawn picture flashing up before
// the pack's own comes in). From the town as it was saved (its first snapshot) it lists the pictures the first view
// will draw, by look: the ground's tiles and scenery, the buildings and the ring wall about the camp, and the
// townsfolk's layers. The nearest come first; what lies past the first screen, or past the budget, is warmed after the
// town is shown, a few at a time (a late town's long tail). Pure: which picture stands for what is the renderer's to
// say (`LookTables`, loading/stripLoad.ts), so the tests can hand it tables of their own.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { depthOf } from '../../shared/sim/buildings';
import { CELL } from '../../shared/sim/land';

export type Look = 'ground' | 'buildings' | 'wall' | 'people';

/** What the plan needs of the town (a Snapshot has all of it). */
export interface PlanTown {
  camp: { x: number; y: number };
  theme: string;
  biome: string;
  era: string;
  calendar: { season: string };
  nomad?: { settled?: boolean } | null;
  buildings: { id: number; def: string; tile: number; row: number; ring?: number; turned?: boolean }[];
  people: { id: number; x: number; y: number }[];
}

/** The pictures standing for each thing, as the renderer draws them. */
export interface LookTables<P = PlanTown['people'][number]> {
  /** The ground's tiles, its scenery and props, the roads: for a land, a season and an age. */
  ground(biome: string, season: string, era: string): readonly string[];
  /** A building's pack pictures in a look (a ring wall's every join). */
  building(def: string, style: string): readonly string[];
  /** A townsperson's layers as they stand now. */
  person(p: P): readonly string[];
}

export interface PlanItem {
  look: Look;
  url: string;
  /** How far from the camp's middle (px): the nearest are warmed first. */
  far: number;
}

/** How far from the camp the first view reaches (px), each way: a phone upright at the default zoom sees about this
 *  much of the town, sideways a little more across. */
export const FIRST_REACH = 26 * CELL;
/** The most pictures warmed before the town is shown (the rest come in after, unseen in the corners first). */
export const FIRST_BUDGET = 160;

/** The buildings' look: the town's people, or a nomad tribe's caravan city once settled (as main.ts draws it). */
export const styleOf = (t: Pick<PlanTown, 'theme' | 'nomad'>): string => (t.theme === 'nomads' && t.nomad?.settled ? 'nomads_city' : t.theme);

/** The pictures to warm, nearest first, split into the first view's set (`first`) and the rest (`later`). A picture
 *  wanted twice is listed once, where it is first wanted. */
export function loadPlan<P extends PlanTown['people'][number]>(
  town: Omit<PlanTown, 'people'> & { people: P[] },
  tables: LookTables<P>,
  reach = FIRST_REACH,
  budget = FIRST_BUDGET,
): { first: PlanItem[]; later: PlanItem[] } {
  const items: PlanItem[] = [];
  const { x: cx, y: cy } = town.camp;
  const style = styleOf(town);
  // (the ground is under everything: always first)
  for (const url of tables.ground(town.biome, town.calendar.season, town.era)) items.push({ look: 'ground', url, far: -1 });
  for (const b of town.buildings) {
    const def = BUILDING_BY_ID[b.def];
    const w = def ? (b.turned ? depthOf(def) : def.width) : 1;
    const h = def ? (b.turned ? def.width : depthOf(def)) : 1;
    const far = Math.max(Math.abs((b.tile + w / 2) * CELL - cx), Math.abs((b.row + h / 2) * CELL - cy));
    for (const url of tables.building(b.def, style)) items.push({ look: b.ring !== undefined ? 'wall' : 'buildings', url, far });
  }
  for (const p of town.people) {
    const far = Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy));
    for (const url of tables.person(p)) items.push({ look: 'people', url, far });
  }
  // (nearest first; the sort is stable, so a building's own pictures stay together)
  items.sort((a, b) => a.far - b.far);
  const seen = new Set<string>();
  const first: PlanItem[] = [];
  const later: PlanItem[] = [];
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    if (it.far <= reach && first.length < budget) first.push(it);
    else later.push(it);
  }
  return { first, later };
}

/** The plan's pictures by look (for the loading line, and the tests). */
export function byLook(items: readonly PlanItem[]): Record<Look, string[]> {
  const out: Record<Look, string[]> = { ground: [], buildings: [], wall: [], people: [] };
  for (const it of items) out[it.look].push(it.url);
  return out;
}
