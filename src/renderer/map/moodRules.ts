// The town's moods as they show on the map, as pure rules (tested): whose home looks well-to-do and whose gathers
// clutter (map/homeDecor.ts), who is coughing, which doors are marked in a plague, and the smoke over a fire
// (map/smokeColumns.ts). The drawing is in those modules.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import type { Building } from '../../shared/sim/state';

/** An owner this rich has a well-kept home; homes whose folk are all this poor (or in debt) gather clutter. */
export const RICH_COINS = 150;
export const POOR_COINS = 12;

export type Wealth = 'rich' | 'poor' | 'plain';

/** Who's who, as much as the rules need: their coins (null before the town has money), debt and bed. */
export interface Purse {
  id: number;
  coins: number | null;
  debt: number;
  bedId: number | null;
  child: boolean;
}

/** How a finished home shows its folk's means: its owner's purse well filled, flower boxes, a painted door and a
 *  garden; everyone under its roof poor or in debt (its owner too, or the treasury's), clutter heaped by the door;
 *  else plain. Plain in a town with no money yet. */
export function homeWealth(b: Building, people: readonly Purse[]): Wealth {
  const def = BUILDING_BY_ID[b.def];
  if (b.status !== 'done' || b.room || !def?.housing) return 'plain';
  const owner = b.owner != null ? people.find((p) => p.id === b.owner) : undefined;
  if (owner && owner.coins !== null && owner.coins >= RICH_COINS) return 'rich';
  const folk = people.filter((p) => p.bedId === b.id && !p.child);
  if (!folk.length || folk.some((p) => p.coins === null)) return 'plain';
  const poor = (p: Purse) => (p.coins ?? 0) < POOR_COINS || p.debt > 0;
  if (owner && !poor(owner)) return 'plain';
  return folk.every(poor) ? 'poor' : 'plain';
}

/** A cough every so long (ms) for a while, each on their own clock by their id; quicker in a plague. */
export const COUGH_EVERY = 9000;
export const COUGH_EVERY_PLAGUE = 5500;
export const COUGH_FOR = 1100;

/** Whether someone sick is coughing now (`now` in ms). */
export function coughing(id: number, now: number, plague: boolean): boolean {
  const every = plague ? COUGH_EVERY_PLAGUE : COUGH_EVERY;
  return (now + id * 2711) % every < COUGH_FOR;
}

/** The homes whose doors are marked in a plague: wherever someone sick sleeps (by the building's id). */
export function markedDoors(people: readonly { sick: boolean; bedId: number | null; away?: string | null }[]): Set<number> {
  const out = new Set<number>();
  for (const p of people) if (p.sick && p.bedId !== null && !p.away) out.add(p.bedId);
  return out;
}

/** The burning buildings a smoke column rises from: alight now. */
export function burning(buildings: readonly Building[]): Building[] {
  return buildings.filter((b) => b.fire !== undefined && b.status === 'done');
}

/** How high a smoke column climbs (px) and how many puffs make it a second; thinner on a slow phone. */
export const SMOKE_HIGH = 320;
export function smokeRate(calm: boolean): number {
  return calm ? 1.6 : 6;
}
