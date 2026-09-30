// Fixed-tick simulation. Rendering never drives it: callers feed in elapsed real time and the sim runs
// however many whole ticks that covers.

import { openGate } from './raidWait';
import { maybeEvent } from './events';
import { rally } from './rally';
import { Rng } from '../rng';
import { generateWorld, type World } from '../world';
import { demolish, discardStock, placeBlueprint, upgrade } from './buildings';
import type { Command } from './commands';
import { equip, hourlyItems, queueCraft, reduceCraft } from './crafting';
import { growCrops, tendFields } from './farming';
import { tendHerds } from './livestock';
import { updateFires } from './fire';
import { updateSocial } from './social';
import { checkDespair, checkLeavers, updateBreaks } from './breaks';
import { trade, updateTrade } from './trade';
import { assignOperators, cycleOperator } from './operators';
import { releasePrisoner, updatePrisoners } from './prisoners';
import { updateDoom } from './doom';
import { updateMonsters } from './monsters';
import { recallExpedition, sendExpedition, updateExpeditions , sendParty } from './expeditions';
import { checkBleeding, heal } from './health';
import { updateAdvice } from './advice';
import { train } from './classes';
import { turnPerson, turnTown } from './turning';
import { updateLaunch } from './era';
import { maybeStartRaid, startGuildRaid, updateRaid } from './raids';
import { answerPrompt, expirePrompts } from './roadEvents';
import { newTickContext, updatePerson, walkTo } from './people';
import { cancelResearch, queueResearch, researchNext } from './research';
import { autoPriorities, notify, type GameState } from './state';
import { TICK_MS, TICKS_PER_HOUR } from './time';
import { acceptVisitor, assignBeds, drillGuards, driftMorale, maybeArrive, rejectVisitor, updateVisitor } from './townsfolk';
import { forSale, runPlanner, shoppingList } from './planner';
import { chooseLich, watchLich } from './occult';
import { castHeld, castPowers, holdPower } from './powers';
import { lurkers } from './lurkers';
import { updateNomads } from './nomads';
import { rulesOf } from '../data/origins';
import { BUILDING_BY_ID } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import type { Material, Stock } from '../data/materials';

/** How often a druid town's forest grows back a tile. */
const REGROW_TICKS = TICKS_PER_HOUR * 2;
import { updateShop, type ShopTown } from './shop';
import { updateWages } from './wages';

/** How the town trades at its shop: the planner decides what's spare and what to buy. */
const SHOP_TOWN: ShopTown = { forSale, wants: shoppingList };

/** Most ticks one advance() call will run; the rest of a long gap is dropped (long gaps go through catchUp). */
export const MAX_TICKS_PER_ADVANCE = 600;

export class Sim {
  private readonly rng: Rng;
  /** Initial terrain, regenerated from the seed (the background never changes yet). */
  private readonly world: World;
  private pending: Command[] = [];
  private carryMs = 0;

  constructor(readonly state: GameState) {
    this.rng = new Rng(state.rngState);
    this.world = generateWorld(state.seed, state.biome);
  }

  /** Queue a command for the start of the next tick. */
  command(c: Command): void {
    this.pending.push(c);
  }

  /** Advance by `ms` of real time. Runs whole ticks and carries the remainder. Returns ticks stepped. */
  advance(ms: number, maxTicks = MAX_TICKS_PER_ADVANCE): number {
    this.carryMs += Math.max(0, ms);
    let n = 0;
    while (this.carryMs >= TICK_MS && n < maxTicks) {
      this.carryMs -= TICK_MS;
      this.step();
      n++;
    }
    if (n === maxTicks) this.carryMs = Math.min(this.carryMs, TICK_MS);
    return n;
  }

  /** One tick: apply queued commands, then (unless paused) run every system once, in a fixed order. */
  step(): void {
    const s = this.state;
    if (s.gameOver) {
      // the story is over; only a new game continues (but the report of how it ended can still be put away)
      for (const c of this.pending) if (c.type === 'dismissAway') this.apply(c);
      this.pending = [];
      return;
    }
    for (const c of this.pending) this.apply(c);
    this.pending = [];
    if (s.paused) return;

    s.tick++;
    const ctx = newTickContext();
    for (const p of s.people) {
      if (p.away !== null) continue;
      updatePerson(s, p, this.rng, ctx);
      heal(s, p);
      // the downed bleed out in town too, unless they're tended in time
      checkBleeding(s, p);
      if (s.gameOver) break;
    }
    updateExpeditions(s, this.rng);
    maybeStartRaid(s, this.rng);
    lurkers(s, this.rng);
    updateNomads(s, this.world.back);
    updateRaid(s, this.rng);
    updateFires(s, this.rng);
    expirePrompts(s, this.rng);
    if (s.gameOver) return;
    for (const p of s.people) driftMorale(s, p);
    assignBeds(s);
    hourlyItems(s, this.rng);
    growCrops(s);
    tendFields(s, this.rng);
    tendHerds(s);
    updateSocial(s, this.rng);
    checkDespair(s);
    assignOperators(s);
    updatePrisoners(s, this.rng);
    updateDoom(s, this.rng);
    updateLaunch(s);
    watchLich(s);
    this.regrow();
    castPowers(s, this.rng);
    if (s.gameOver) return;
    updateMonsters(s, this.rng, (target) => startGuildRaid(s, target, this.rng));
    updateBreaks(s, this.rng);
    checkLeavers(s);
    updateTrade(s, this.rng);
    updateShop(s, this.rng, SHOP_TOWN);
    updateWages(s);
    if (s.tick % TICKS_PER_HOUR === 0) for (const p of s.people) if (p.autoPriorities) p.priorities = autoPriorities(p.skills);
    drillGuards(s);
    updateAdvice(s);
    maybeArrive(s, this.rng);
    maybeEvent(s, this.rng);
    updateVisitor(s, walkTo);
    // the town decides for itself what to research, make, build and gather
    runPlanner(s, this.world.back);

    s.rngState = this.rng.state;
  }

  /** A druid town's cleared forest grows back: now and then, a tree comes up on a clear tile that was forest once,
   *  away from any building. */
  private regrow(): void {
    const s = this.state;
    if (!rulesOf(s).regrow || s.tick % REGROW_TICKS !== 0) return;
    const covered = (i: number) =>
      s.buildings.some((b) => {
        const d = BUILDING_BY_ID[b.def];
        return d.layer !== 'back' && i >= b.tile - 1 && i <= b.tile + d.width;
      });
    const spots = s.tiles.map((_, i) => i).filter((i) => s.tiles[i].terrain === 'clear' && this.world.mid[i] === 'forest' && !covered(i));
    if (!spots.length) return;
    const i = this.rng.pick(spots);
    const pool: Stock = {};
    for (const [m, [lo, hi]] of Object.entries(TERRAIN.forest.pool) as [Material, [number, number]][]) {
      const n = this.rng.int(lo, hi);
      if (n > 0) pool[m] = n;
    }
    s.tiles[i] = { terrain: 'forest', pool, designated: false };
    s.tileRev++;
  }

  private apply(c: Command): void {
    const s = this.state;
    switch (c.type) {
      case 'placeBuilding':
        placeBlueprint(s, this.world.back, c.def, c.tile);
        break;
      case 'demolish':
        demolish(s, c.building);
        break;
      case 'turnPerson': {
        const r = turnPerson(s, c.person, c.kind);
        if (!r.ok) notify(s, `Can't: ${r.reason}.`);
        break;
      }
      case 'turnTown':
        turnTown(s, c.kind);
        break;
      case 'trainClass': {
        const r = train(s, c.person, c.cls);
        if (!r.ok) notify(s, `Can't train: ${r.reason}.`);
        break;
      }
      case 'upgrade': {
        const r = upgrade(s, this.world.back, c.building);
        if (!r.ok) notify(s, `Can't upgrade: ${r.reason}.`);
        break;
      }
      case 'discardStock':
        discardStock(s, c.building, c.material);
        break;
      case 'queueCraft':
        queueCraft(s, c.item);
        break;
      case 'reduceCraft':
        reduceCraft(s, c.order, c.all);
        break;
      case 'equip': {
        const p = s.people.find((q) => q.id === c.person);
        if (p && p.away === null) equip(s, p, c.slot, c.item);
        break;
      }
      case 'queueResearch':
        queueResearch(s.research, c.topic, s.cheats.unlockAll ? 'space' : s.era, s.origin);
        break;
      case 'cancelResearch':
        cancelResearch(s.research, c.topic);
        break;
      case 'researchNext':
        researchNext(s.research, c.topic);
        break;
      case 'sendExpedition':
        sendExpedition(s, c.dest, c.members, c.roles, c.stance, c.horses, c.truck === true);
        break;
      case 'sendParty': {
        const r = sendParty(s, c.dest, c.stakes);
        if (!r.ok) notify(s, `Can't send a party: ${r.reason}.`);
        break;
      }
      case 'trade':
        trade(s, c.offer, this.rng);
        break;
      case 'cycleOperator':
        cycleOperator(s, c.building);
        break;
      case 'releasePrisoner':
        releasePrisoner(s, c.prisoner);
        break;
      case 'setOrder': {
        const p = s.people.find((q) => q.id === c.person);
        if (p?.monster) p.order = c.order;
        break;
      }
      case 'rally':
        rally(s, c.person);
        break;
      case 'follow':
        s.hero = c.person !== null && s.people.some((p) => p.id === c.person) ? c.person : undefined;
        break;
      case 'holdPower':
        holdPower(s, c.power);
        break;
      case 'castHeld':
        if (!castHeld(s, this.rng)) notify(s, "Can't cast it yet.");
        break;
      case 'answerPrompt':
        answerPrompt(s, c.prompt, c.option, this.rng);
        break;
      case 'recallExpedition':
        recallExpedition(s, c.expedition);
        break;
      case 'acceptVisitor':
        acceptVisitor(s);
        break;
      case 'rejectVisitor':
        rejectVisitor(s);
        break;
      case 'setPriority': {
        const p = s.people.find((q) => q.id === c.person);
        if (!p || p.bornTick != null) break; // children don't work
        p.priorities[c.job] = c.priority;
        p.autoPriorities = false;
        break;
      }
      case 'setAutoPriorities': {
        const p = s.people.find((q) => q.id === c.person);
        if (!p || p.bornTick != null) break;
        p.autoPriorities = c.on;
        if (c.on) p.priorities = autoPriorities(p.skills);
        break;
      }
      case 'dismissAway':
        s.unreadAway = null;
        break;
      case 'cheatUnlockAll':
        if (!s.ironman) s.cheats.unlockAll = c.on; // (no cheating in ironman)
        break;
      case 'setPaused':
        s.paused = c.paused;
        if (!c.paused) openGate(s); // (raiders held at the gate come on when the town runs again)
        break;
      case 'becomeLich':
        chooseLich(s);
        break;
      case 'setDirection':
        s.direction = c.direction;
        s.plan = undefined; // (it decides afresh)
        break;
      case 'toggleGather': {
        const t = s.tiles[c.tile];
        if (!t || t.terrain === 'clear') return;
        t.designated = !t.designated;
        s.tileRev++;
        break;
      }
    }
  }
}
