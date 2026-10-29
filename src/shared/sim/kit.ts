// A townsperson's pouch of battle items (the owner's ask: "carry battle items in their own inventory too and use them
// in battle: potions, or special items to help with the fight"). The items are in data/kitItems.ts and crafted like any
// other. Here: how many a person can carry, how the town hands them out (hourly, with the autopilot: its fighters and
// guards first, a caster's draughts to casters), what the planner orders for them, how a fighter uses one in a fight
// (`useKitItem`, called from actions.ts `takeTurn`, so every fight, the party's, the raid map's and the tactics board,
// uses them alike), and the potions a fallen raider leaves. Its randomness is a side stream of its own.

import { KIT_BY_ID } from '../data/kitItems';
import { ITEM_BY_ID } from '../data/items';
import { CLASS_DEFS } from '../data/classes';
import { levelOf } from '../data/levels';
import { natureOf } from '../data/enemies';
import { hashSeed, Rng } from '../rng';
import { HEAL_BELOW, RAIDER_POTION } from './kitFight';
import { addItems } from './crafting';
import { isChild } from './social';
import { notify, type GameState, type Person, type Raider } from './state';
import { TICKS_PER_HOUR } from './time';

/** Pouch room: two to start, one more for each fifteen levels, one for a pack on the back; never more than `KIT_MOST`. */
export const KIT_BASE = 2;
export const KIT_MOST = 6;
export const kitCap = (p: Person): number => Math.min(KIT_MOST, KIT_BASE + Math.floor(levelOf(p) / 15) + (p.gear.pack ? 1 : 0));

const MEND = ['greater_healing_potion', 'healing_potion'];
/** What each person would carry, in the order the town hands it out, and no more than this many of each. */
const WISHES: [string, number][] = [
  ['healing_potion', 1], ['greater_healing_potion', 1], ['antidote', 1], ['combat_stim', 1], ['ward_charm', 1], ['smoke_bomb', 1], ['whetstone', 1], ['oil_flask', 1], ['throwing_knife', 2], ['healing_potion', 2],
];
const CASTER_WISHES: [string, number][] = [['mana_draught', 2], ['healing_potion', 1], ['antidote', 1], ['ward_charm', 1], ['smoke_bomb', 1], ['greater_healing_potion', 1]];

const casts = (p: Person) => !!p.cls && ['caster', 'healer', 'support'].includes(CLASS_DEFS[p.cls].role);
const wishes = (p: Person) => (casts(p) ? CASTER_WISHES : WISHES);
/** Who carries a pouch: a grown-up with a calling (the ones who fight and cast). */
const armed = (p: Person) => !isChild(p) && !!p.cls;
const count = (p: Person, id: string) => (p.kit ?? []).filter((x) => x === id).length;

/** Who is handed items first: those set on defending, then the main character, then those with the most fighting skill. */
function order(s: GameState): Person[] {
  const skill = (p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level) + (p.id === s.mainId ? 0.5 : 0) + (p.priorities.defend ? 3 : 0) + (casts(p) ? 1 : 0);
  return s.people.filter((p) => p.away === null && armed(p) && !p.downed).sort((a, b) => skill(b) - skill(a) || a.id - b.id);
}

/** The battle item a person would carry next and the stores (or the shop's shelves) hold, or null: none wanted, or the
 *  pouch is full. `stocked` says what is on offer (the stores' items by default). */
export function kitWant(s: GameState, p: Person, stocked: (id: string) => boolean = (id) => (s.items[id] ?? 0) > 0): string | null {
  if ((p.kit?.length ?? 0) >= kitCap(p)) return null;
  const want = wishes(p).find(([id, n]) => stocked(id) && (MEND.includes(id) ? MEND.reduce((k, m) => k + count(p, m), 0) : count(p, id)) < n);
  return want ? want[0] : null;
}

/** Whether a person carries a pouch at all (a grown-up with a calling). */
export const carriesKit = armed;

/** Once an hour, with the autopilot: the stores' battle items go into the pouches, those first in line served first, one
 *  round at a time (so the best-placed don't take everything). Hands out only what the stores hold. */
export function restockKits(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  if (!Object.keys(s.items).some((id) => KIT_BY_ID[id])) return;
  const people = order(s);
  for (let round = 0; round < 3; round++) {
    let gave = false;
    for (const p of people) {
      if ((p.kit?.length ?? 0) >= kitCap(p)) continue;
      const want = kitWant(s, p);
      if (!want) continue;
      (p.kit ??= []).push(want);
      addItems(s, want, -1);
      gave = true;
    }
    if (!gave) break;
  }
}

/** How much the town wants more of a battle item made (0: it has enough, in the stores and in the pouches). */
export function kitNeed(s: GameState, id: string): number {
  const def = KIT_BY_ID[id];
  if (!def) return 0;
  const folk = s.people.filter((p) => !isChild(p) && armed(p));
  if (!folk.length) return 0;
  const wanted = folk.filter((p) => wishes(p).some(([w]) => w === id)).length;
  const have = (s.items[id] ?? 0) + folk.reduce((n, p) => n + count(p, id), 0);
  if (have >= wanted + 1) return 0;
  // (what keeps them standing first, then what turns a fight)
  return { heal: 10, mana: 8, cure: 6, escape: 5, buff: 4, throw: 3 }[def.use] + def.rank * 0.1;
}

/** What a raider of the people kinds carries in its pouch: a healing potion now and then, settled once (the kit side
 *  stream `kit:<raider>`, so it is the same whenever it is first asked) and kept on the raider (`Raider.kit`). */
export function raiderPouch(s: GameState, rd: Raider): string[] {
  if (rd.kit) return rd.kit;
  rd.kit = [];
  if (rd.ally || natureOf(rd.kind) !== 'person') return rd.kit;
  const rng = new Rng(hashSeed(`${s.seed}:kit:raider:${rd.id}`));
  if (rng.chance(RAIDER_POTION)) rd.kit.push(rng.chance(0.2) ? 'greater_healing_potion' : 'healing_potion');
  return rd.kit;
}

/** A raider that carries a potion drinks it when it is under half health (once; the rest of its turn is its own). Returns
 *  how much it mended, or 0. The fights' raiders call this at the start of their turn (battle.ts, tactics.ts). */
export function raiderDrinks(s: GameState, rd: Raider): number {
  if (rd.down || rd.ally || rd.hp >= rd.maxHp * HEAL_BELOW) return 0;
  const pouch = raiderPouch(s, rd);
  if (!pouch.length) return 0;
  const k = KIT_BY_ID[pouch[0]];
  pouch.shift();
  if (!k?.amount) return 0;
  const n = Math.min(rd.maxHp - rd.hp, Math.round(rd.maxHp * k.amount));
  rd.hp += n;
  return n;
}

/** Potions found on the fallen of a raid (raiders of the people kinds): the ones they had not drunk, into the stores.
 *  Returns what was found. */
export function raiderPotions(s: GameState, fallen: readonly Raider[]): string[] {
  const found: string[] = [];
  for (const rd of fallen) {
    for (const id of raiderPouch(s, rd)) {
      addItems(s, id, 1);
      found.push(ITEM_BY_ID[id]?.name ?? id);
    }
    rd.kit = [];
  }
  if (found.length) notify(s, `A fallen raider's pouch held ${found.length === 1 ? `a ${found[0].toLowerCase()}` : `${found.length} potions`}.`);
  return found;
}
