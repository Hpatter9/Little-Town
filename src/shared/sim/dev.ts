// Developer mode (the owner's ask: "a developer mode button in the settings. When on, it allows me to instantly kill,
// build, research, harvest, and other things like this... to play through quickly to see what bugs I run into"). The
// phone's ☰ menu turns it on for the device (`littletown.dev`), and the page sends `devMode` to the town: `s.dev` on,
// and `s.devSave` for good (a town once played this way is a dev save). Each order (sim/devOrders.ts) comes as a `dev`
// command, refused while `s.dev` is off (sim/sim.ts), and changes the town only through the same calls the town uses
// itself: a building finished as a builder finishes it, a death through `killPerson`, a raid through `startRaid`. Its
// draws come from its own side stream, so a dev order never shifts the town's own.

import { Rng, hashSeed } from '../rng';
import { BUILDING_BY_ID } from '../data/buildings';
import { CREATURE_SAGA, CREATURE_TOPIC } from '../data/creature';
import { CROPS, SOIL } from '../data/crops';
import { EVENT_BY_ID } from '../data/events';
import { LEVEL_SHARE_FIGHT, MAX_LEVEL, levelOf, xpToLevel } from '../data/levels';
import { RAID_KIND_BY_ID } from '../data/raids';
import { depositNear, overgrownCells, storages } from './buildings';
import { digRoom, holdOf } from './castle';
import { gainLevelXp } from './classes';
import { startDisaster } from './disasters';
import { onBuilt } from './era';
import { startEvent } from './events';
import { cropOf, isField } from './farming';
import { updateFog } from './fog';
import { founderOf } from './founder';
import { killPerson, knockDown } from './health';
import { clearCell, learnTopic } from './people';
import { raidBudget, raidKindsFor, startRaid } from './raids';
import { raidOn, skipRaid } from './raidSkip';
import { chooseOffer, keepOffer } from './researchOffer';
import { finishRing } from './ringWall';
import { beginSaga } from './sagas';
import { layAll } from './streets';
import { campXY, maxHp, notify, type Building, type GameState, type Person } from './state';
import { paceDay, TICKS_PER_HOUR } from './time';
import type { Material } from '../data/materials';
import type { DevOrder } from './devOrders';

/** What a dev death is put down to (the annals, the news). */
export const DEV_CAUSE = 'by the developer’s hand';
/** What one fill puts in: food, wood and stone each. */
const FILL_MATERIALS: readonly Material[] = ['grain', 'wood', 'stone'];

/** Developer mode on or off for this town (never in ironman: no cheats there). */
export function setDevMode(s: GameState, on: boolean): void {
  if (on && s.ironman) return notify(s, 'Developer mode is not for an ironman town.');
  if (!!s.dev === on) return;
  if (on) {
    s.dev = true;
    s.devSave = true;
    notify(s, 'Developer mode is on: this town is a dev save from now on.');
  } else {
    s.dev = false;
    delete s.devBuild;
    delete s.devSkipTo;
    notify(s, 'Developer mode is off.');
  }
}

/** A side stream for a dev order's draws (not the town's own: CLAUDE.md). */
const devRng = (s: GameState, what: string) => new Rng(hashSeed(`${s.seed}:dev:${what}:${s.tick}`));

/** Carry out one order (the caller has checked `s.dev`). */
export function applyDev(s: GameState, o: DevOrder): void {
  switch (o.op) {
    case 'finishBuilds': {
      const n = finishBuilds(s);
      return notify(s, n ? `Developer: ${n} building${n === 1 ? '' : 's'} finished.` : 'Developer: nothing is being built.');
    }
    case 'finishBuilding': {
      const b = s.buildings.find((q) => q.id === o.id);
      if (b?.status === 'blueprint') finishBuilds(s, b);
      return;
    }
    case 'instantBuild':
      if (o.on) s.devBuild = true;
      else delete s.devBuild;
      if (o.on) finishBuilds(s);
      return notify(s, `Developer: orders ${o.on ? 'are built at once' : 'are built by hand again'}.`);
    case 'finishResearch':
      return finishResearch(s);
    case 'harvest': {
      const n = harvestAll(s);
      return notify(s, n ? `Developer: ${n} field${n === 1 ? '' : 's'} reaped.` : 'Developer: no field has a crop in.');
    }
    case 'fill':
      return fill(s, o.amount);
    case 'kill':
      return o.target === 'person' ? killOne(s, o.id) : o.target === 'raider' ? killRaider(s, o.id) : killRoamer(s, o.id);
    case 'killRaiders': {
      const n = killRaiders(s);
      return notify(s, n ? `Developer: ${n} raider${n === 1 ? '' : 's'} struck down.` : 'Developer: no raiders to strike down.');
    }
    case 'down': {
      const p = s.people.find((q) => q.id === o.id);
      if (p && !p.downed && p.away === null) knockDown(s, p);
      return;
    }
    case 'winFight': {
      const n = killRaiders(s) + winBattles(s);
      return notify(s, n ? 'Developer: the fight is won.' : 'Developer: no fight is on.');
    }
    case 'heal': {
      const who = o.id === null ? s.people : s.people.filter((p) => p.id === o.id);
      for (const p of who) heal(p);
      return notify(s, o.id === null ? 'Developer: everyone is mended.' : `Developer: ${who[0]?.name ?? 'nobody'} is mended.`);
    }
    case 'skip':
      s.devSkipTo = s.tick + o.hours * TICKS_PER_HOUR;
      return notify(s, `Developer: running on ${o.hours} hour${o.hours === 1 ? '' : 's'}…`);
    case 'stopSkip':
      delete s.devSkipTo;
      return;
    case 'raid':
      return raidNow(s, o.kind);
    case 'event': {
      const def = EVENT_BY_ID[o.id];
      if (!def) return notify(s, `Developer: no event "${o.id}".`);
      if (s.event && s.prompts.some((p) => p.id === s.event!.prompt)) return notify(s, 'Developer: an event is waiting already: answer it first.');
      return startEvent(s, def, devRng(s, 'event'));
    }
    case 'levelUp': {
      const p = o.id === null ? founderOf(s) : s.people.find((q) => q.id === o.id);
      if (!p) return;
      const from = levelOf(p);
      levelUp(p, o.levels);
      return notify(s, `Developer: ${p.name} goes from level ${from} to ${levelOf(p)}.`);
    }
    case 'creatureSaga':
      return creatureSaga(s);
    case 'disaster':
      if (s.disaster) return notify(s, 'Developer: a disaster is under way already.');
      startDisaster(s, o.kind);
      return;
    case 'reveal':
      s.explored = '1'.repeat(s.land.w * s.land.h);
      updateFog(s);
      return notify(s, 'Developer: the whole land is seen.');
  }
}

/** Every tick while dev mode builds at once: whatever was ordered is finished. */
export function devTick(s: GameState): void {
  if (!s.dev) {
    if (s.devSkipTo !== undefined) delete s.devSkipTo;
    return;
  }
  if (s.devSkipTo !== undefined && (s.tick >= s.devSkipTo || s.gameOver)) {
    delete s.devSkipTo;
    notify(s, 'Developer: the run is over.');
  }
  // (a raid met in a fast-forward is fought by the town itself, to its recap: sim/raidSkip.ts)
  if (s.devSkipTo !== undefined && raidOn(s) && !s.raidSkip) skipRaid(s);
  if (s.devBuild && s.buildings.some((b) => b.status === 'blueprint')) finishBuilds(s);
}

/** Finish every blueprint (or the one given) as a builder would: the ground under it cleared, a hold's room dug, its
 *  health set, and what a finished building sets off (sim/era.ts `onBuilt`). The ring wall goes up as one, and the
 *  planned streets are laid. Returns how many were finished. */
export function finishBuilds(s: GameState, only?: Building): number {
  let n = 0;
  if (!only && s.ring && !s.ring.done) n += finishRing(s, s.ring);
  for (const b of [...s.buildings]) {
    if (b.status !== 'blueprint' || (only && b !== only)) continue;
    for (const i of overgrownCells(s, b)) clearCell(s, i);
    delete b.overgrown;
    delete b.planned;
    if (b.room && holdOf(s) === 'mountain') digRoom(s, b, 1);
    const def = BUILDING_BY_ID[b.def];
    b.progress = 1;
    b.status = 'done';
    b.builtAt = s.tick;
    b.delivered = {};
    if (def?.hp) b.hp = def.hp;
    n++;
    onBuilt(s, b);
  }
  if (!only) layAll(s);
  return n;
}

/** The topic being studied learned now; with none, the first on offer is taken and learned. A new offer follows. */
function finishResearch(s: GameState): void {
  const r = s.research;
  if (!r.queue.length && r.offer?.length) chooseOffer(s, r.offer[0]);
  const id = r.queue[0];
  if (!id) return notify(s, 'Developer: nothing to study.');
  learnTopic(s, id);
  keepOffer(s);
}

/** Every field with a crop in reaped now, its yield into the stores (as a farmer's harvest, with the soil's tiring). */
function harvestAll(s: GameState): number {
  let n = 0;
  const at = campXY(s);
  for (const b of s.buildings) {
    if (!isField(b)) continue;
    const c = cropOf(b);
    if (c.stage === 'fallow') continue;
    const def = CROPS[b.def];
    const soil = def.indoor ? 1 : (c.soil ?? SOIL.start);
    store(s, { [def.material]: Math.max(1, Math.round(def.yield * soil)) }, at);
    c.work = 0;
    c.growth = 0;
    if (def.establishHours) {
      c.bearing = true;
      c.stage = 'growing';
    } else {
      c.stage = 'fallow';
      c.reaped = s.tick;
      if (!def.indoor) c.soil = Math.max(SOIL.min, soil - SOIL.drain);
    }
    n++;
  }
  return n;
}

/** Put goods in the stores, nearest first; what doesn't fit goes in the first store anyway (dev mode's own excess). */
function store(s: GameState, stock: Partial<Record<Material, number>>, at = campXY(s)): boolean {
  const left = depositNear(s, at, stock);
  const first = storages(s)[0];
  if (!first) return false;
  for (const [m, k] of Object.entries(left) as [Material, number][]) if (k > 0) first.store[m] = (first.store[m] ?? 0) + k;
  return true;
}

function fill(s: GameState, amount: number): void {
  const ok = store(s, Object.fromEntries(FILL_MATERIALS.map((m) => [m, amount])));
  s.coins = (s.coins ?? 0) + amount;
  const f = founderOf(s);
  if (f) f.coins = (f.coins ?? 0) + amount;
  notify(s, `Developer: +${amount} coins${ok ? `, and ${amount} each of food, wood and stone` : ' (no store to put goods in)'}.`);
}

function killOne(s: GameState, id: number): void {
  const p = s.people.find((q) => q.id === id);
  if (p) killPerson(s, p, DEV_CAUSE);
}

const strike = (rd: { hp: number; down: boolean }) => {
  rd.hp = 0;
  rd.down = true;
};

function killRaider(s: GameState, id: number): void {
  const rd = s.raid?.raiders.find((q) => q.id === id && !q.ally && !q.down && !q.gone);
  if (rd) strike(rd);
}

/** Every raider of the raid under way (not the town's allies) struck down. */
function killRaiders(s: GameState): number {
  let n = 0;
  for (const rd of s.raid?.raiders ?? [])
    if (!rd.ally && !rd.down && !rd.gone) {
      strike(rd);
      n++;
    }
  return n;
}

/** A band on the land: in a fight with the townsfolk, that fight is won; else it is simply gone. */
function killRoamer(s: GameState, id: number): void {
  const r = s.roamers?.find((q) => q.id === id);
  if (!r) return;
  const k = r.fighting !== undefined ? s.skirmishes?.find((q) => q.id === r.fighting) : undefined;
  if (k?.e.battle && !k.e.battle.outcome) {
    for (const f of k.e.battle.fighters) if (f.side === 'enemy') strike(f);
  } else s.roamers = s.roamers!.filter((q) => q !== r);
}

/** The fights on screen away from the town (a party's, a skirmish on the land): every foe struck down, so the fight's
 *  own step calls it won. */
function winBattles(s: GameState): number {
  let n = 0;
  for (const e of [...s.expeditions, ...(s.skirmishes ?? []).map((k) => k.e)]) {
    if (!e.battle || e.battle.outcome) continue;
    for (const f of e.battle.fighters) if (f.side === 'enemy' && !f.down) strike(f);
    n++;
  }
  return n;
}

/** Whole again: health, bleeding, sickness and wounds, hunger and weariness (lost limbs stay lost). */
function heal(p: Person): void {
  p.hp = maxHp(p);
  p.downed = null;
  p.sick = null;
  delete p.wounds;
  p.starving = false;
  p.needs.food = 1;
  p.needs.rest = 1;
}

/** So many levels, as earned in a fight (the stat points and evolutions follow, as ever: sim/classes.ts). */
function levelUp(p: Person, levels: number): void {
  for (let i = 0; i < levels && levelOf(p) < MAX_LEVEL; i++) {
    const need = xpToLevel(levelOf(p)) - (p.lvXp ?? 0);
    gainLevelXp(p, 'melee', (need + 0.01) / LEVEL_SHARE_FIGHT);
  }
}

/** A raid sets out now: of the kind asked, or one the town might draw in its land and era. */
function raidNow(s: GameState, kindId: string | null): void {
  if (s.raid) return notify(s, 'Developer: a raid is under way already.');
  const rng = devRng(s, 'raid');
  let kind = kindId ? RAID_KIND_BY_ID[kindId] : undefined;
  if (kindId && !kind) return notify(s, `Developer: no raid "${kindId}".`);
  if (!kind) {
    const kinds = raidKindsFor(s.era, Math.floor(paceDay(s.tick))).filter((k) => k.weight > 0 && !k.fromSea && (!k.biomes || k.biomes.includes(s.biome ?? 'forest')) && k.origin !== (s.origin ?? 'settlers'));
    kind = kinds.length ? RAID_KIND_BY_ID[rng.weighted(Object.fromEntries(kinds.map((k) => [k.id, k.weight])))] : RAID_KIND_BY_ID.wolves;
  }
  startRaid(s, kind, raidBudget(s), rng);
}

/** The God creature's saga begun now, the study it follows learned first if it isn't. */
function creatureSaga(s: GameState): void {
  if (s.creature || (s.sagas ?? []).some((r) => r.id === CREATURE_SAGA) || (s.sagasDone ?? []).some((d) => d.id === CREATURE_SAGA)) return notify(s, 'Developer: the creature’s saga has begun already.');
  if (!s.research.done.includes(CREATURE_TOPIC)) learnTopic(s, CREATURE_TOPIC);
  if (!beginSaga(s, CREATURE_SAGA)) notify(s, 'Developer: the saga needs a cast the town does not have yet.');
}
