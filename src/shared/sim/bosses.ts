// Epic bosses (see enemies.ts kits): the roar that shakes the town, raging below half health, calling for
// help, sweeping attacks that hit several defenders (and can set buildings alight), and the unique trophy
// each drops. The town celebrates a boss slain.

import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { ITEM_BY_ID } from '../data/items';
import { bossLoot } from '../data/uniques';
import { hashSeed, mixSeed, Rng } from '../rng';
import { buildingCentreX } from './buildings';
import { BOSS_RAGE } from './combat';
import { setFire } from './fire';
import { knockDown } from './health';
import { addItems } from './crafting';
import { earn, notify, type GameState, type Person, type Raid, type Raider } from './state';
import { TICK_HZ, TICKS_PER_HOUR } from './time';

/** How long the town is shaken by a boss's roar, and cheered by its death (game hours), and by how much. */
export const DREAD_HOURS = 6;
export const DREAD_MORALE = -6;
export const TRIUMPH_HOURS = 36;
export const TRIUMPH_MORALE = 10;
/** A sweeping attack reaches this far (px) in town. */
const AREA_REACH = 90;

export const kitOf = (kind: string) => ENEMIES[kind]?.kit;

/** A boss has come: it roars, and the town is shaken. */
export function bossArrives(s: GameState, kind: string): void {
  const kit = kitOf(kind);
  if (!kit) return;
  notify(s, kit.roar, true);
  s.dreadUntil = s.tick + DREAD_HOURS * TICKS_PER_HOUR;
  s.bossShake = s.tick;
}

/** Every tick of a raid, for each boss in it: rage and call for help below half health; drop the trophy on death. */
export function bossesInRaid(s: GameState, r: Raid): void {
  for (const rd of r.raiders) {
    if (rd.ally || !ENEMIES[rd.kind]?.boss) continue;
    if (rd.down) {
      if (!rd.trophyGiven) {
        rd.trophyGiven = true;
        bossSlain(s, rd.kind);
      }
      continue;
    }
    const kit = kitOf(rd.kind);
    if (!kit) continue;
    if (rd.hp >= rd.maxHp / 2) continue;
    if (!rd.enraged) {
      rd.enraged = true;
      notify(s, kit.enrage, true);
      s.bossShake = s.tick;
    }
    if (kit.summon && !rd.summoned) {
      rd.summoned = true;
      const d = ENEMIES[kit.summon.kind];
      for (let i = 0; i < kit.summon.count; i++) {
        r.raiders.push({ id: s.nextId++, kind: kit.summon.kind, x: rd.x - rd.dir * (20 + i * 16), dir: rd.dir, hp: d.hp, maxHp: d.hp, cooldown: 10, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm' });
      }
      notify(s, kit.summon.text, true);
    }
  }
}

/** A boss's blow in town. Raging bosses hit harder; every few blows, a sweeping attack hits everyone near
 *  (and fire-breathers set the nearest building alight). Returns the damage multiplier for the main blow. */
export function bossBlow(s: GameState, rd: Raider, targets: Person[], hit: (p: Person) => number, near = false): number {
  const kit = kitOf(rd.kind);
  if (!kit) return 1;
  const rage = rd.enraged ? BOSS_RAGE : 1;
  if (!kit.area) return rage;
  rd.bossAttacks = (rd.bossAttacks ?? 0) + 1;
  if (rd.bossAttacks % kit.area.every !== 0) return rage;
  // (`near`: the targets are already those in reach)
  const hitNow = (near ? targets : targets.filter((p) => Math.abs(p.x - rd.x) <= AREA_REACH)).slice(0, kit.area.targets);
  for (const p of hitNow) {
    p.hp = Math.max(0, p.hp - Math.round(hit(p) * rage));
    if (p.hp === 0 && !p.downed) knockDown(s, p);
  }
  if (kit.area.burns) {
    const b = s.buildings.filter((q) => q.status === 'done' && q.fire === undefined && !BUILDING_BY_ID[q.def].hp).sort((a, c) => Math.abs(buildingCentreX(a) - rd.x) - Math.abs(buildingCentreX(c) - rd.x))[0];
    if (b && Math.abs(buildingCentreX(b) - rd.x) < AREA_REACH * 2) setFire(s, b, true);
  }
  notify(s, `${ENEMIES[rd.kind].name} ${kit.area.name}!`);
  rd.lastArea = s.tick;
  s.bossShake = s.tick;
  rd.cooldown += Math.round(TICK_HZ * 0.5); // (a big attack takes a moment to recover from)
  return 0; // (the sweep is the blow)
}

/** A slain boss's loot table (data/uniques.ts): its purse, and a chance at one of its uniques no one has yet (each is
 *  one of a kind: once found it never drops again). The roll is the town's own, from its seed, the hour and the boss. */
export function dropLoot(s: GameState, kind: string): string | null {
  const def = ENEMIES[kind];
  if (!def?.boss) return null;
  const table = bossLoot(kind, def.hp);
  const rng = new Rng(mixSeed(hashSeed(s.seed), s.tick, [...kind].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)));
  const coins = rng.int(table.coins[0], table.coins[1]);
  s.coins = (s.coins ?? 0) + coins;
  earn(s, 'events', coins);
  const left = table.uniques.filter((u) => !(s.uniques ?? []).includes(u));
  if (!left.length || !rng.chance(table.chance)) return null;
  const id = left[rng.int(0, left.length - 1)];
  (s.uniques ??= []).push(id);
  addItems(s, id, 1);
  notify(s, `${def.name} dropped ${ITEM_BY_ID[id].name}, a unique ${ITEM_BY_ID[id].family ? 'weapon' : 'treasure'}! There is no other like it.`, true);
  return id;
}

/** A boss is dead: the trophy is the town's, and everyone takes heart. */
export function bossSlain(s: GameState, kind: string): void {
  dropLoot(s, kind);
  const kit = kitOf(kind);
  if (!kit) return;
  s.items[kit.trophy] = (s.items[kit.trophy] ?? 0) + 1;
  s.triumph = { until: s.tick + TRIUMPH_HOURS * TICKS_PER_HOUR, name: ENEMIES[kind].name };
  s.dreadUntil = 0;
  notify(s, `${ENEMIES[kind].name} is slain! The town takes ${ITEM_BY_ID[kit.trophy]?.name ?? 'a trophy'} as a trophy.`, true);
  // with the Archmage dead, the Deep Freeze breaks (at the next hour's check)
  if (kind === 'frost_archmage' && s.doom?.kind === 'deep_freeze' && s.doom.phase === 'active') s.doom.untilTick = s.tick;
  // and with the Rat King dead, the rats scatter
  if (kind === 'rat_king' && s.doom?.kind === 'rat_plague' && s.doom.phase === 'active') s.doom.untilTick = s.tick;
}
