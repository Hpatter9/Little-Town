// Crafting (DESIGN §15): a queue of orders worked by anyone with the Craft job. The crafter fetches the
// materials from storage, carries them to the item's station and makes it there. Items land in the town
// inventory and are handed out as gear automatically; food and ammo go into storage as materials.

import { launch } from './boats';
import { payFromTreasury } from './economy';
import { BUILDING_BY_ID } from '../data/buildings';
import {
  BANDAGE_HP,
  CRAFT_QUEUE_SLOTS,
  ITEM_BY_ID,
  MAX_ORDER,
  POULTICE_HP,
  SLOTS,
  SNARE_BREAK,
  SNARE_CATCH,
  STATIONS,
  type ItemDef,
  type ItemEffects,
  type Slot,
} from '../data/items';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import type { WorkAnim } from '../data/terrain';
import type { Rng } from '../rng';
import { earlier, type Era } from '../data/eras';
import { eraOfResearch } from '../data/research';
import { COMMON, MAX_QUALITY, piece, pieceLabel, plusMult, qualityMult, rollPlus, rollQuality, typicalQuality } from '../data/quality';
import { PIECE_RATE, PURSE_SCALE, saleValue } from '../data/shop';
import { FOOD_VALUE } from '../data/people';
import { buildingCentreX, depositNear } from './buildings';
import { stabilize } from './health';
import { treatSickness } from './doom';
import { modifiers } from './research';
import { addStock, campX, ERA_MULTIPLIER, maxHp, notify, type Building, type CraftOrder, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';
import { qualityBonus } from './origin';
import { canWear } from './classes';

/* ------------------------------------------------------------ what can be made, and where */

export function itemUnlocked(s: GameState, def: ItemDef): boolean {
  return s.cheats.unlockAll || def.research.every((r) => s.research.done.includes(r));
}

/** The finished building an item is made at, if the town has one. */
export function stationFor(s: GameState, def: ItemDef): Building | undefined {
  return s.buildings.find((b) => b.def === def.station && b.status === 'done');
}

export const stationName = (def: ItemDef) => BUILDING_BY_ID[def.station]?.name ?? def.station;

/** Materials an order still needs brought to the station for the piece being made. */
export function craftNeeded(o: CraftOrder): Stock {
  const out: Stock = {};
  for (const [m, n] of Object.entries(ITEM_BY_ID[o.item].cost) as [Material, number][]) {
    const need = n - (o.delivered[m] ?? 0);
    if (need > 0) out[m] = need;
  }
  return out;
}

/** Item ingredients missing from the inventory (only matters until work on the piece starts). */
export function missingItems(s: GameState, o: CraftOrder): string[] {
  if (o.itemsTaken) return [];
  return Object.entries(ITEM_BY_ID[o.item].items ?? {})
    .filter(([id, n]) => (s.items[id] ?? 0) < n)
    .map(([id]) => ITEM_BY_ID[id].name);
}

/** Orders a crafting station can hold at once. */
export const PER_STATION = 3;
/** Craft orders allowed at once: `PER_STATION` for every station standing (research adds more; never fewer than the
 *  campfire's few). */
export const craftSlots = (s: Pick<GameState, 'research' | 'buildings'>) => Math.max(CRAFT_QUEUE_SLOTS, PER_STATION * s.buildings.filter((b) => b.status === 'done' && (STATIONS as readonly string[]).includes(b.def)).length) + modifiers(s.research).queueSlots;
/** Orders a station of this kind can take: `PER_STATION` for each standing (one's worth before any stands). */
export const stationSlots = (s: Pick<GameState, 'buildings'>, station: string) => PER_STATION * Math.max(1, s.buildings.filter((b) => b.status === 'done' && b.def === station).length);
/** Orders queued at a station. */
export const stationQueued = (s: Pick<GameState, 'crafting'>, station: string) => s.crafting.filter((o) => ITEM_BY_ID[o.item]?.station === station).length;

export interface QueueCheck {
  ok: boolean;
  reason?: string;
}

export function canQueueCraft(s: GameState, itemId: string): QueueCheck {
  const def = ITEM_BY_ID[itemId];
  if (!def) return { ok: false, reason: 'Unknown item' };
  if (!itemUnlocked(s, def)) return { ok: false, reason: 'Not researched yet' };
  const same = s.crafting.find((o) => o.item === itemId && o.count < MAX_ORDER);
  if (!same && s.crafting.length >= craftSlots(s)) return { ok: false, reason: 'Craft queue is full' };
  if (!same && stationQueued(s, def.station) >= stationSlots(s, def.station)) return { ok: false, reason: `${stationName(def)} has its ${PER_STATION} orders` };
  return { ok: true };
}

/** Add one to the order for this item (or start a new order). */
export function queueCraft(s: GameState, itemId: string): QueueCheck {
  const check = canQueueCraft(s, itemId);
  if (!check.ok) return check;
  const same = s.crafting.find((o) => o.item === itemId && o.count < MAX_ORDER);
  if (same) same.count++;
  else s.crafting.push({ id: s.nextId++, item: itemId, count: 1, delivered: {}, itemsTaken: false, progress: 0, made: 0 });
  return { ok: true };
}

/** Make one fewer; at zero the order goes, and anything already brought for it goes back to storage. */
export function reduceCraft(s: GameState, orderId: number, all = false): void {
  const o = s.crafting.find((q) => q.id === orderId);
  if (!o) return;
  o.count = all ? 0 : o.count - 1;
  if (o.count > 0) return;
  s.crafting = s.crafting.filter((q) => q !== o);
  const def = ITEM_BY_ID[o.item];
  const at = stationFor(s, def);
  depositNear(s, at ? buildingCentreX(at) : campX(s), o.delivered);
  if (o.itemsTaken) for (const [id, n] of Object.entries(def.items ?? {})) addItems(s, id, n);
}

export function addItems(s: GameState, id: string, n: number, quality = COMMON): void {
  const q = n > 0 ? qualitiesOf(s, id) : null;
  const v = (s.items[id] ?? 0) + n;
  if (v > 0) s.items[id] = v;
  else delete s.items[id];
  if (q) {
    for (let k = 0; k < n; k++) q.push(quality);
    (s.itemQ ??= {})[id] = q.sort((a, b) => b - a);
  }
}

/** The quality of each piece of an item in the inventory, best first. It's kept in step with the count here: pieces
 *  used up without a word about quality (a snare breaking, say) take the poorest with them, and pieces from before
 *  quality existed are Common. */
export function qualitiesOf(s: GameState, id: string): number[] {
  const n = s.items[id] ?? 0;
  const all = (s.itemQ ??= {});
  const q = (all[id] ?? []).slice().sort((a, b) => b - a);
  while (q.length > n) q.pop();
  while (q.length < n) q.push(COMMON);
  if (q.length) all[id] = q;
  else delete all[id];
  return q;
}

/** Take one piece of an item out of the inventory, the best or the poorest. Its quality, or null if there's none. */
export function takeItem(s: GameState, id: string, which: 'best' | 'worst' = 'best'): number | null {
  const q = qualitiesOf(s, id);
  if (!q.length) return null;
  const got = which === 'best' ? q.shift()! : q.pop()!;
  s.itemQ![id] = q;
  if (!q.length) delete s.itemQ![id];
  const v = (s.items[id] ?? 0) - 1;
  if (v > 0) s.items[id] = v;
  else delete s.items[id];
  return got;
}

/** Take item ingredients for the next piece out of the inventory. Returns false if some are missing. */
export function takeItemInputs(s: GameState, o: CraftOrder): boolean {
  if (o.itemsTaken) return true;
  if (missingItems(s, o).length) return false;
  for (const [id, n] of Object.entries(ITEM_BY_ID[o.item].items ?? {})) addItems(s, id, -n);
  o.itemsTaken = true;
  return true;
}

/** One piece is done: into the inventory (or storage, for materials); the order moves on. */
export function finishPiece(s: GameState, o: CraftOrder, p: Person, rng?: Rng): void {
  const def = ITEM_BY_ID[o.item];
  if (def.boat) launch(s, def.boat); // (a boat joins the fleet: sim/boats.ts)
  else if (def.makes) {
    const at = stationFor(s, def);
    const left = depositNear(s, at ? buildingCentreX(at) : p.x, def.makes);
    for (const m of MATERIALS) if (left[m]) addStock(p.carrying, m, left[m]!); // no room: they hold it
  } else {
    // (how well it's made depends on who made it)
    const level = p.skills.crafting.level;
    // (and on the town: dwarves make finer things, druids coarser, and a forge blessing helps)
    const grade = Math.max(0, Math.min(MAX_QUALITY, (rng ? rollQuality(rng, level) : Math.round(typicalQuality(level))) + Math.round(qualityBonus(s))));
    // (and arms and armour may come out +1 to +5 on top: rarer the higher)
    const plus = rng && ARMS.has(def.slot!) ? rollPlus(rng, level) : 0;
    const q = piece(grade, plus);
    addItems(s, def.id, 1, q);
    if (grade >= 5 || plus >= 3) notify(s, `${p.name} made a ${pieceLabel(def.name, q)}!`, true);
    payCrafter(s, def, q, p);
  }
  o.delivered = {};
  o.itemsTaken = false;
  o.progress = 0;
  o.count--;
  o.made++;
  if (o.count <= 0) {
    s.crafting = s.crafting.filter((q) => q !== o);
    notify(s, `Crafted: ${o.made > 1 ? `${o.made} × ` : ''}${def.name}`);
  }
  if (def.slot) equipAll(s);
}

/** Once the town has money, it pays for what it has made to sell: a furnishing outright (it's bought for the shop or
 *  tavern), a piece rate for gear, wares and fare. As far as its purse goes. */
function payCrafter(s: GameState, def: ItemDef, q: number, p: Person): void {
  if (!moneyTown(s) || !(def.furnish || def.ware || def.fare || def.slot)) return;
  const worth = saleValue(def, q) * (def.fare ? PURSE_SCALE[s.era] : 1);
  const what = pieceLabel(def.name, q);
  const pay = payFromTreasury(s, p, Math.round(def.furnish ? worth : worth * PIECE_RATE), 'crafters', `Was paid for a ${what}`);
  if (pay <= 0) return;
  if (def.furnish) notify(s, `The town bought a ${what} from ${p.name} for ${pay} coins.`);
}

/* ------------------------------------------------------------ gear */

/** Combined effects of everything someone wears. */
export function gearEffects(p: Person): Required<Pick<ItemEffects, 'damage' | 'beastDamage' | 'accuracy' | 'armor' | 'block' | 'carry' | 'morale' | 'dodge' | 'power'>> & { ranged: boolean; slow: number } {
  const e = { damage: 0, beastDamage: 0, accuracy: 0, armor: 0, block: 0, carry: 0, morale: 0, dodge: 0, power: 0, ranged: false, slow: 1 };
  for (const [slot, id] of Object.entries(p.gear) as [Slot, string][]) {
    const fx = ITEM_BY_ID[id]?.effects;
    if (!fx) continue;
    // (a finer piece does more; arms and armour more again for each +)
    const k = qualityMult(p.gearQ?.[slot]) * plusMult(p.gearQ?.[slot]);
    // a knife only helps in a fight when there's no real weapon
    if (fx.damage && !(ITEM_BY_ID[id].slot === 'tool' && p.gear.weapon)) e.damage += fx.damage * k;
    e.beastDamage += (fx.beastDamage ?? 0) * k;
    e.accuracy += (fx.accuracy ?? 0) * k;
    e.armor += (fx.armor ?? 0) * k;
    e.block += (fx.block ?? 0) * k;
    e.carry += Math.round((fx.carry ?? 0) * k);
    e.morale += (fx.morale ?? 0) * k;
    e.dodge += (fx.dodge ?? 0) * k;
    e.power += (fx.power ?? 0) * k;
    // (plate and a tower shield slow the arm: the weapon's own pace is the weapon's business)
    if (slot !== 'weapon' && fx.speed) e.slow *= fx.speed;
    if (fx.ranged) e.ranged = true;
  }
  // (however fine the armour, some blows still land)
  e.armor = Math.min(ARMOR_CAP, e.armor);
  e.block = Math.min(BLOCK_CAP, e.block);
  e.dodge = Math.min(DODGE_CAP, e.dodge);
  return e;
}

/** Work speed from the tool in hand for a kind of gathering, or for building. */
export function toolSpeed(p: Person, work: WorkAnim | 'construct'): number {
  const fx = p.gear.tool ? ITEM_BY_ID[p.gear.tool]?.effects : undefined;
  if (!fx) return 1;
  return finer(work === 'construct' ? (fx.construct ?? 1) : (fx.gather?.[work] ?? 1), p.gearQ?.tool);
}

/** Swap to the best spare tool for the work at hand (the one in hand goes back to the inventory). */
export function pickTool(s: GameState, p: Person, work: WorkAnim | 'construct'): void {
  if (moneyTown(s)) return; // (the tools in store are the shop's, for sale)
  let best = p.gear.tool;
  let bestSpeed = toolSpeed(p, work);
  for (const [id, n] of Object.entries(s.items)) {
    const def = ITEM_BY_ID[id];
    if (!n || def?.slot !== 'tool') continue;
    const speed = finer(work === 'construct' ? (def.effects.construct ?? 1) : (def.effects.gather?.[work] ?? 1), qualitiesOf(s, id)[0]);
    if (speed > bestSpeed) {
      best = id;
      bestSpeed = speed;
    }
  }
  if (best && best !== p.gear.tool) equip(s, p, 'tool', best);
}

/** A tool's speed-up, made finer by its quality. */
const finer = (speed: number, q: number | undefined) => 1 + (speed - 1) * qualityMult(q);
/** However fine the gear, some blows still land. */
const ARMOR_CAP = 0.8;
const BLOCK_CAP = 0.6;
const DODGE_CAP = 0.3;

/** How much an item is worth in its slot, to hand out the best first (times its quality's worth). */
export const gearScore = (def: ItemDef, q: number | undefined) => score(def) * qualityMult(q) * (ARMS.has(def.slot!) ? plusMult(q) : 1);
/** The slots whose pieces can be made +1 to +5. */
export const ARMS: ReadonlySet<Slot> = new Set<Slot>(['weapon', 'offhand', 'head', 'body']);
const scoreQ = gearScore;

/** Once the town has a shop (and so money), townsfolk buy their gear with their wages (see wages.ts) instead of
 *  having it handed out from the common store. */
const moneyTown = (s: GameState) => s.buildings.some((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.floor?.venue === 'shop');
function score(def: ItemDef): number {
  const e = def.effects;
  const gather = Object.values(e.gather ?? {}).reduce((a, b) => a + (b - 1), 0);
  return (e.damage ?? 0) + (e.beastDamage ?? 0) * 0.5 + (e.accuracy ?? 0) * 20 + (e.armor ?? 0) * 30 + (e.block ?? 0) * 30 + (e.dodge ?? 0) * 30 + (e.power ?? 0) * 10 + (e.carry ?? 0) + (e.morale ?? 0) + gather * 10 + ((e.construct ?? 1) - 1) * 10;
}

/** Put an item from the inventory on someone, returning what they wore to the inventory. */
export function equip(s: GameState, p: Person, slot: Slot, itemId: string | null): void {
  if (itemId !== null && ((s.items[itemId] ?? 0) <= 0 || ITEM_BY_ID[itemId]?.slot !== slot)) return;
  const old = p.gear[slot];
  if (old) addItems(s, old, 1, p.gearQ?.[slot] ?? COMMON);
  if (itemId === null) {
    delete p.gear[slot];
    if (p.gearQ) delete p.gearQ[slot];
  } else {
    // (the best of them)
    const q = takeItem(s, itemId, 'best') ?? COMMON;
    p.gear[slot] = itemId;
    (p.gearQ ??= {})[slot] = q;
  }
}

/**
 * Hand out spare gear: fighting gear to the best fighters first (the main character leading ties), tools
 * and the rest to whoever has nothing in that slot. Better spare items replace worse ones.
 */
export function equipAll(s: GameState): void {
  // (in a town with coin they buy their own gear; only its treasures, the relics and uniques, are still handed out)
  const treasuresOnly = moneyTown(s);
  const fightSkill = (p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level) + (p.id === s.mainId ? 0.5 : 0) + (p.priorities.defend ? 3 : 0);
  for (const slot of SLOTS) {
    const combat = slot === 'weapon' || slot === 'offhand' || slot === 'head' || slot === 'body';
    const people = s.people.filter((p) => p.away === null).sort((a, b) => (combat ? fightSkill(b) - fightSkill(a) : a.id - b.id));
    for (const p of people) {
      // (only what their class lets them wear or wield)
      const spare = Object.entries(s.items)
        .filter(([id, n]) => n > 0 && ITEM_BY_ID[id]?.slot === slot && (!treasuresOnly || ITEM_BY_ID[id].relic) && canWear(p, id))
        .map(([id]) => ({ def: ITEM_BY_ID[id], q: qualitiesOf(s, id)[0] }))
        .sort((a, b) => scoreQ(b.def, b.q) - scoreQ(a.def, a.q))[0]?.def;
      if (!spare) continue;
      const worn = p.gear[slot] ? ITEM_BY_ID[p.gear[slot]!] : undefined;
      // a torch and a shield share a hand: fighters keep the shield
      if (worn && scoreQ(spare, qualitiesOf(s, spare.id)[0]) <= scoreQ(worn, p.gearQ?.[slot])) continue;
      equip(s, p, slot, spare.id);
    }
  }
}

/* ------------------------------------------------------------ inventory items at work */

/** Whether someone without a bed has a bedroll (bedless people get them in id order). */
export function hasBedroll(s: GameState, p: Person): boolean {
  if (p.bed !== null) return false;
  const bedless = s.people.filter((q) => q.bed === null && q.away === null);
  return bedless.indexOf(p) < (s.items.bedroll ?? 0) && bedless.includes(p);
}

/** Once an hour: snares may catch something, and poultices go to anyone badly hurt. */
export function hourlyItems(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const snares = s.items.snare ?? 0;
  let caught = 0;
  for (let i = 0; i < snares; i++) {
    if (!rng.chance(SNARE_CATCH)) continue;
    caught++;
    if (rng.chance(SNARE_BREAK)) {
      addItems(s, 'snare', -1);
      notify(s, 'A snare broke.');
    }
  }
  if (caught) depositNear(s, campX(s), { meat: caught });

  const hurt = s.people
    .filter((p) => p.away === null && (p.downed || p.hp < maxHp(p) * 0.5))
    .sort((a, b) => Number(!!b.downed?.bleedUntil) - Number(!!a.downed?.bleedUntil) || a.hp - b.hp);
  // the sick get a dressing too: it shortens the sickness (once each)
  for (const p of s.people) {
    if (!p.sick || p.sick.treated || p.away !== null) continue;
    const use = (s.items.bandage ?? 0) > 0 ? 'bandage' : (s.items.poultice ?? 0) > 0 ? 'poultice' : null;
    if (!use) break;
    if (treatSickness(s, p)) {
      addItems(s, use, -1);
      notify(s, `${p.name} was tended with a ${use} and is getting better.`);
    }
  }
  for (const p of hurt) {
    // bandages first (they're better), then poultices
    const use = (s.items.bandage ?? 0) > 0 ? 'bandage' : (s.items.poultice ?? 0) > 0 ? 'poultice' : null;
    if (!use) break;
    addItems(s, use, -1);
    stabilize(p);
    p.hp = Math.min(maxHp(p), p.hp + (use === 'bandage' ? BANDAGE_HP : POULTICE_HP));
    notify(s, `${p.name}'s wounds were dressed with a ${use}.`);
  }
}

/** Seconds of work for one of an item in this era: stretched by the item's own era (a spear is no harder to make
 *  in the Medieval era), except food (people eat on the same clock in every era). */
export function craftSeconds(def: ItemDef, era: Era): number {
  const food = Object.keys(def.makes ?? {}).some((m) => FOOD_VALUE[m as Material] || m === 'flour');
  return def.seconds * (food ? 1 : ERA_MULTIPLIER[earlier(era, eraOfResearch(def.research))]);
}