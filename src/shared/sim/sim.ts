// Fixed-tick simulation. Rendering never drives it: callers feed in elapsed real time and the sim runs
// however many whole ticks that covers.

import { openGate } from './raidWait';
import { maybeEvent } from './events';
import { rally } from './rally';
import { battleGo, placeFighter, setAutoBattle, setBattleSpeed } from './battle';
import { castAt } from './powers';
import { Rng } from '../rng';
import { demolish, discardStock, placeBlueprint, townRadius, upgrade } from './buildings';
import { cellAt, groundAt, isMarked, setGround, setMarked, type Pt, decayWear } from './land';
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
import { destinationOf, recallExpedition, rolesFor, sendDelve, sendExpedition, updateExpeditions, sendParty } from './expeditions';
import { packHourly } from './pack';
import { ageingHourly } from './ageing';
import { replenishSea } from './sea';
import { bloodHourly } from './vampires';
import { RAID_KIND_BY_ID } from '../data/raids';
import { checkBleeding, heal } from './health';
import { updateAdvice } from './advice';
import { classesHourly } from './classes';
import { questsHourly } from './quests';
import { delvesHourly } from './delves';
import { placesHourly } from './places';
import { turnPerson, turnTown } from './turning';
import { updateLaunch } from './era';
import { maybeStartRaid, startGuildRaid, startRaid, updateRaid } from './raids';
import { answerPrompt, expirePrompts } from './roadEvents';
import { newTickContext, updatePerson, walkTo } from './people';
import type { Person } from './state';
import { cancelResearch, queueResearch, researchNext } from './research';
import { autoPriorities, campCell, notify, type GameState } from './state';
import { TICK_MS, TICKS_PER_HOUR } from './time';
import { acceptVisitor, assignBeds, drillGuards, driftMorale, keepKin, maybeArrive, rejectVisitor, updateVisitor } from './townsfolk';
import { forSale, runPlanner, shoppingList } from './planner';
import { chooseLich, watchLich } from './occult';
import { castHeld, castPowers, holdPower } from './powers';
import { lurkers } from './lurkers';
import { caveBear } from './caveBear';
import { updateNomads } from './nomads';
import { rulesOf } from '../data/origins';
import { BUILDING_BY_ID } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import type { Material, Stock } from '../data/materials';

/** How often a druid town's forest grows back a tile. */
const REGROW_TICKS = TICKS_PER_HOUR * 2;
import { updateShop, type ShopTown } from './shop';
import { updateWages } from './wages';
import { propertyHourly } from './property';
import { treasuryHourly } from './treasury';
import { ambitionHourly } from './ambition';
import { ceremoniesHourly } from './ceremonies';
import { partiesHourly, postBounty, setVeto, withdrawBounty } from './parties';

/** How the town trades at its shop: the planner decides what's spare and what to buy. */
const SHOP_TOWN: ShopTown = { forSale, wants: shoppingList };

/** Most ticks one advance() call will run; the rest of a long gap is dropped (long gaps go through catchUp). */
export const MAX_TICKS_PER_ADVANCE = 600;

export class Sim {
  private readonly rng: Rng;
  private pending: Command[] = [];
  private carryMs = 0;

  constructor(readonly state: GameState) {
    this.rng = new Rng(state.rngState);
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
    caveBear(s, this.rng);
    updateNomads(s);
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
    propertyHourly(s);
    treasuryHourly(s, this.rng);
    ambitionHourly(s);
    partiesHourly(s);
    ceremoniesHourly(s);
    if (s.tick % TICKS_PER_HOUR === 0) for (const p of s.people) if (p.autoPriorities) p.priorities = autoPriorities(p.skills);
    if (s.tick % TICKS_PER_HOUR === 0) classesHourly(s);
    if (s.tick % TICKS_PER_HOUR === 0) decayWear(s.land); // (footpaths grass over where nobody walks)
    questsHourly(s);
    delvesHourly(s);
    placesHourly(s, this.rng);
    ageingHourly(s, this.rng);
    replenishSea(s, this.rng);
    bloodHourly(s);
    if (s.tick % TICKS_PER_HOUR === 0) keepKin(s);
    packHourly(
      s,
      this.rng,
      (dest, members) => {
        const d = destinationOf(s, dest);
        const r = sendExpedition(s, dest, members, rolesFor(members.map((id) => s.people.find((p) => p.id === id)!), d), 'bold');
        return r.ok ? s.expeditions[s.expeditions.length - 1] : null;
      },
      (kind, budget) => startRaid(s, RAID_KIND_BY_ID[kind], budget, this.rng),
    );
    drillGuards(s);
    updateAdvice(s);
    maybeArrive(s, this.rng);
    maybeEvent(s, this.rng);
    updateVisitor(s, (p: Person, to: Pt) => walkTo(s, p, to));
    // the town decides for itself what to research, make, build and gather
    runPlanner(s);

    s.rngState = this.rng.state;
  }

  /** A druid town's cleared forest grows back: now and then, a tree comes up on a grass cell beyond the town's
   *  edge, in the open land, away from any building and road. */
  private regrow(): void {
    const s = this.state;
    if (!rulesOf(s).regrow || s.tick % REGROW_TICKS !== 0) return;
    const m = s.land;
    const camp = campCell(s);
    const near = townRadius(s) + 2;
    const spots: number[] = [];
    for (let y = Math.max(0, camp.y - m.open); y <= Math.min(m.h - 1, camp.y + m.open); y++)
      for (let x = Math.max(0, camp.x - m.open); x <= Math.min(m.w - 1, camp.x + m.open); x++) {
        const d = Math.hypot(x - camp.x, y - camp.y);
        if (d <= near || d > m.open || groundAt(m, x, y) !== 'grass' || m.roads[y * m.w + x] === '#') continue;
        if (s.buildings.some((b) => Math.abs(b.tile - x) <= BUILDING_BY_ID[b.def].width && Math.abs(b.row - y) <= 3)) continue;
        spots.push(y * m.w + x);
      }
    if (!spots.length) return;
    const i = this.rng.pick(spots);
    const pool: Stock = {};
    for (const [mat, [lo, hi]] of Object.entries(TERRAIN.forest.pool) as [Material, [number, number]][]) {
      const n = this.rng.int(lo, hi);
      if (n > 0) pool[mat] = n;
    }
    const c = cellAt(m, i);
    setGround(m, c.x, c.y, 'forest');
    m.pools[i] = pool;
  }

  private apply(c: Command): void {
    const s = this.state;
    switch (c.type) {
      case 'placeBuilding':
        placeBlueprint(s, c.def, c.x, c.y);
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
      case 'upgrade': {
        const r = upgrade(s, c.building);
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
      case 'sendDelve': {
        const r = sendDelve(s, c.dest, c.members, c.stakes);
        if (!r.ok) notify(s, `Can't send the delvers: ${r.reason}.`);
        break;
      }
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
      case 'battlePlace':
        placeFighter(s, c.person, c.spot);
        break;
      case 'battleGo':
        battleGo(s);
        break;
      case 'battleAuto':
        setAutoBattle(s, c.on);
        break;
      case 'battleSpeed':
        setBattleSpeed(s, c.speed);
        break;
      case 'battleCast':
        castAt(s, c.power, this.rng, [c.x, c.y]);
        break;
      case 'watch':
        s.watching = c.expedition !== null && s.expeditions.some((e) => e.id === c.expedition) ? c.expedition : undefined;
        break;
      case 'watchMine':
        s.watchingMine = c.place !== null && (s.places ?? []).some((p) => p.id === c.place && p.mine) ? c.place : undefined;
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
      case 'veto':
        setVeto(s, c.dest, c.on);
        break;
      case 'bounty':
        if (c.post) {
          const r = postBounty(s, c.dest);
          if (!r.ok) notify(s, `Can't post a bounty: ${r.reason}.`);
        } else withdrawBounty(s, c.dest);
        break;
      case 'setTax':
        s.tax = c.rate;
        break;
      case 'setTownSize':
        if (c.size === null) delete s.popTarget;
        else s.popTarget = c.size;
        break;
      case 'toggleGather': {
        if (!s.land.pools[c.cell]) return;
        setMarked(s.land, c.cell, !isMarked(s.land, c.cell));
        break;
      }
    }
  }
}
