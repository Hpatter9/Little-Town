// Land, homes and rent (PLAN.md step 2; data/economy.ts). Buildings have an owner: a person, or the treasury when
// none is named. The treasury builds the public works and rents out the homes it built (a day's rent a bed, paid at
// dawn; arrears and a grudge when a renter can't pay). Once there's money, people with coins enough buy a plot and a
// home's materials from the town and have it built: the owner works on it for nothing and pays whoever else works
// on it by the hour (that's the hiring). Building needs skill: a site below its Construction level can't be worked
// (`buildSkill`), and a builder's pace climbs steeply with their level (`buildPower`).

import { BUILDING_BY_ID, BUILDINGS, type BuildingDef } from '../data/buildings';
import { eraOfResearch } from '../data/research';
import { PURSE_SCALE } from '../data/shop';
import { WORTH } from '../data/trade';
import type { Material } from '../data/materials';
import { BUILD_SKILL_BY_ERA, BUILD_SKILL_FREE_CELLS, BUILD_SKILL_PER_CELL, LAND_PRICE_PER_CELL, RENT_MORALE, RENT_PER_BED } from '../data/economy';
import { blueprintCount, buildSlots, defOf, depthOf, isUnlocked, placeBlueprint, unlockInfo, totalStock } from './buildings';
import { giveCoins, moneyTown } from './economy';
import { findSpot } from './planner';
import { earn, notify, remember, type Building, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** The Construction level a building needs of its builders. */
export function buildSkill(def: BuildingDef): number {
  const era = eraOfResearch(def.research);
  // (a big footprint asks a little more: beyond BUILD_SKILL_FREE_CELLS, BUILD_SKILL_PER_CELL a cell)
  return Math.round(BUILD_SKILL_BY_ERA[era] + Math.max(0, def.width * depthOf(def) - BUILD_SKILL_FREE_CELLS) * BUILD_SKILL_PER_CELL);
}
/** Whether a person may work a site: skilled enough, and (an owned site) its owner or someone the owner can pay. */
export function canWork(s: GameState, p: Person, site: Building): boolean {
  if (p.skills.construction.level < buildSkill(defOf(site))) return false;
  if (site.owner === undefined || site.owner === p.id) return true;
  const owner = s.people.find((q) => q.id === site.owner);
  return !!owner && (owner.coins ?? 0) >= 1;
}

export const ownerOf = (s: GameState, b: Building): Person | undefined => (b.owner === undefined ? undefined : s.people.find((p) => p.id === b.owner));
/** What a home's plot costs (its footprint), and a day's rent for a bed in it. */
export const landPrice = (s: GameState, def: BuildingDef) => Math.round(def.width * depthOf(def) * LAND_PRICE_PER_CELL * PURSE_SCALE[s.era]);
export const rentOf = (s: GameState) => Math.max(1, Math.round(RENT_PER_BED * PURSE_SCALE[s.era]));
/** What a building's materials cost to buy from the stores (their worth). */
export const materialsPrice = (def: BuildingDef) => Math.round((Object.entries(def.cost) as [Material, number][]).reduce((n, [m, k]) => n + (WORTH[m] ?? 0) * k, 0));

/** Once an hour: people buy plots and build homes; at dawn, rent. */
export function propertyHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !moneyTown(s)) return;
  if (calendar(s.tick).hour === 6) collectRent(s);
  planHomes(s);
}

/** The homes a person could build: housing they're skilled enough to work on (they'll help build it), unlocked, and
 *  whose plot and materials they can pay for, best first. */
function homesFor(s: GameState, p: Person): BuildingDef[] {
  const stock = totalStock(s);
  return BUILDINGS.filter(
    (d) =>
      !!d.housing &&
      !d.never &&
      isUnlocked(unlockInfo(s), d) &&
      landPrice(s, d) + materialsPrice(d) <= (p.coins ?? 0) &&
      (Object.entries(d.cost) as [Material, number][]).every(([m, k]) => (stock[m] ?? 0) >= k),
  ).sort((a, b) => b.housing! - a.housing!);
}

/** Someone with coins enough and no home of their own buys a plot and has a home built (one site a person; one new
 *  home an hour in all). */
export function planHomes(s: GameState): void {
  if (blueprintCount(s) >= buildSlots(s)) return;
  for (const p of s.people) {
    if (p.away !== null || p.bornTick != null || p.downed) continue;
    if (s.buildings.some((b) => b.owner === p.id && defOf(b).housing)) continue; // (they have, or are building, one)
    const def = homesFor(s, p)[0];
    if (!def) continue;
    const at = findSpot(s, def);
    if (!at || !placeBlueprint(s, def.id, at.x, at.y).ok) continue;
    const site = s.buildings[s.buildings.length - 1];
    site.owner = p.id;
    const price = landPrice(s, def) + materialsPrice(def);
    p.coins = (p.coins ?? 0) - price;
    s.coins = (s.coins ?? 0) + price;
    earn(s, 'rent', price);
    remember(s, p, `Bought a plot and the makings of a ${def.name} from the town (${price} coins)`);
    notify(s, `${p.name} bought a plot from the town and is having a ${def.name} built (${price} coins).`, true);
    return;
  }
}

/** Rent at dawn: everyone with a bed in a home that isn't theirs pays its owner (the treasury for the town's homes);
 *  short of it, the rent goes on their arrears and they grumble. */
export function collectRent(s: GameState): void {
  const rent = rentOf(s);
  for (const p of s.people) {
    if (p.bornTick != null || p.bed === null) continue;
    const home = s.buildings.find((b) => b.id === p.bed);
    if (!home || home.status !== 'done' || home.owner === p.id) continue;
    const landlord = ownerOf(s, home);
    if ((p.coins ?? 0) >= rent) {
      p.coins = (p.coins ?? 0) - rent;
      if (landlord) giveCoins(s, landlord, rent, `Rent from ${p.name} (${rent} coins)`);
      else {
        s.coins = (s.coins ?? 0) + rent;
        earn(s, 'rent', rent);
      }
      p.rentPaid = (p.rentPaid ?? 0) + rent;
    } else {
      p.debt = (p.debt ?? 0) + rent;
      p.morale = Math.max(0, p.morale + RENT_MORALE);
      remember(s, p, `Couldn't pay the rent (${rent} coins owed: ${p.debt} in all)`);
    }
  }
}

/** The buildings a person owns, by name. */
export const propertyOf = (s: GameState, p: Person): string[] => s.buildings.filter((b) => b.owner === p.id).map((b) => `${BUILDING_BY_ID[b.def]?.name ?? b.def}${b.status === 'blueprint' ? ' (building)' : ''}`);
