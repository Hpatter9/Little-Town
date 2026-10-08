// Raids (DESIGN §10): a warning, a choice (sound the alarm, pay them off, recall expeditions), then raiders
// walk in from one end of the world. Beasts go for anyone they can see, then the food; rival scouts go for
// the food and run. Walls and gates stop them until broken. Defenders fight; everyone else shelters.

import { alliesFor, hostOver, rivalRaidOdds } from './factions';
import { SIEGE_WALL } from '../data/factions';
import { ally } from './classes';
import { victoryFeast } from './ceremonies';
import { woundFor, woundPerson } from './injuries';
import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES, enemyArmor, natureOf } from '../data/enemies';
import { eraReached, type Era } from '../data/eras';
import { HORSE_THEFT } from '../data/trade';
import { RAT_BITE_SICKNESS, WAR_RAID_BUDGET } from '../data/doom';
import { biomeOf, difficultyOf } from '../data/biomes';
import { CAPTAIN_PER_LEVEL } from '../data/operators';
import { operatorSkill } from './operators';
import { takePrisoners } from './prisoners';
import { tallyRaid } from './annals';
import { RUN_DOWN_PX, tryRunDown } from './raiderWounds';
import { before, credit, noteRoll, raidRecap, took as tookHarm, TOWERS } from './raidRecap';
import { answerGuild, guildDefeated, guildOptions, runWithThePack } from './monsters';
import { ITEM_BY_ID } from '../data/items';
import { MATERIALS, type Material, type Stock } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import {
  BRIBE_FOOD_PER_RAIDER,
  MELEE_RANGE,
  FINISH_OFF_CHANCE,
  RAID_BUDGET_BASE,
  RAID_BUDGET_PER_PERSON,
  RAID_MIGHT_PER_PERSON,
  RAID_MIGHT_FREE,
  RAID_MIGHT_MAX,
  RAID_MIGHT_PER_LEVEL,
  RAID_SEASONED_MAX,
  KILLING_BLOW,
  BOSS_KILLING_BLOW,
  FOUNDER_KILLING_BLOW,
  RAID_SIZE_PER_PEOPLE,
  RAID_SIZE_FREE,
  RAID_SIZE_CAP,
  RAID_BUDGET_FREE_PEOPLE,
  FLANK_MIN,
  FLANK_CHANCE,
  FLANK_PER_DAY,
  FLANK_MAX,
  RAID_BUDGET_PER_DAY,
  RAID_BUDGET_PER_WEALTH,
  RAID_INTERVAL_HOURS,
  RAID_INTERVAL_JITTER,
  RAID_INTERVAL_MIN,
  RAID_KIND_BY_ID,
  RAID_KINDS,
  RAID_MAX_HOURS,
  RAID_MAX_SIZE,
  RAID_BITE,
  RAID_FEROCITY,
  RAID_BITE_FROM,
  RAIDER_CARRY,
  LOOT_VALUE,
  RAIDER_FLEE,
  THROW_RANGE,
  WARNING_MINUTES,
  PATROL_WARNING_MINUTES,
  type RaidGoal,
  type RaidKind,
  MAGE_ACCURACY,
  MAGE_BURST_PX,
  MAGE_DAMAGE,
  MAGE_PER_LEVEL,
  MAGE_SPLASH,
} from '../data/raids';
import type { Rng } from '../rng';
import { buildingCentre, buildingDoor, defOf, depositNear, storages, totalStock } from './buildings';
import { CELL, type Pt } from './land';
import { seaTown } from './sea';
import { rallied, RALLY_DAMAGE } from './rally';
import { afterBlow, ammoOf, hitDamage, personFighter } from './combat';
import { gearEffects } from './crafting';
import { recallExpedition } from './expeditions';
import { classesInRaid, summonForRaid } from './classes';
import { bindTheDead, sicken } from './doom';
import { bossArrives, bossBlow, bossesInRaid, bossSlain } from './bosses';
import { BLOOD_FURY, BLOOD_LIFESTEAL, castsFire, fightsFromRange } from '../data/classes';
import { levelOf, shapeshifts } from '../data/levels';
import { flammable, setFire } from './fire';
import { heirOf, killPerson, knockDown, stabilize } from './health';
import { tireless, addStock, campXY, dist, ERA_MULTIPLIER, maxHp, meet, notify, personFx, poolSize, type Building, type GameState, type Person, type Raid, type Raider, markBlood, markDebris } from './state';
import { castleOn } from './castle';
import { walk, type Walker } from './walk';
import { TICK_HZ, TICKS_PER_HOUR, paceDay } from './time';
import { campEdge, gainSkill } from './townsfolk';
import { rulesOf } from '../data/origins';
import { fightRate, guardRate } from './origin';
import { fogAim, frenzyOf, heldBack, lordHp, rivalsInRaid, turretsDown, wardOf } from './rivals';
import { RIVAL_LEADER_COST } from '../data/rivals';
import { lurkersBeaten } from './lurkers';
import { caveBearBeaten } from './caveBear';
import { packRaidBeaten } from './pack';
import { sagaRaidOver } from './sagas';
import { calamityRaidOver } from './calamity';
import { fireAt, speedOf, tickBurns } from './defenses';
import { rustle } from './livestock';
import { circleWagons } from './nomads';
import { battlesOn, startBattle, stepBattle } from './battle';
import { startTactics, stepTactics, tacticsOn, tacticsOver } from './tactics';

/** Raiders start this far beyond the edge of the land. */
const OFF_MAP = 40;
/** The land's width in px. */
const worldW = (s: Pick<GameState, 'land'>) => s.land.w * CELL;
/** Where a raid's side of the land begins (beyond its edge, on the camp's row). */
const offMap = (s: GameState, side: -1 | 1, i = 0): Pt => ({ x: side < 0 ? -OFF_MAP - i * 24 : worldW(s) + OFF_MAP + i * 24, y: campXY(s).y });
/** Where a raid from the sea starts: in the deep water south of the camp, past what the town knows (battle.ts lays its
 *  trail from there), spread along the swell. */
export function offSea(s: GameState, i = 0): Pt {
  const m = s.land;
  const row = Math.min(m.h - 1, m.camp.y + Math.round(m.open) + SEA_OUT);
  return { x: (m.camp.x + 0.5) * CELL + ((i % 5) - 2) * 18, y: (row + 0.5) * CELL + Math.floor(i / 5) * 18 };
}
/** How many cells past the known land a raid from the sea starts. */
const SEA_OUT = 4;

/* ------------------------------------------------------------ scheduling */

export function scheduleNextRaid(s: GameState, rng: Rng): void {
  const days = paceDay(s.tick);
  const hours = Math.max(RAID_INTERVAL_MIN, RAID_INTERVAL_HOURS - days * 0.5) + rng.range(-RAID_INTERVAL_JITTER, RAID_INTERVAL_JITTER);
  // like everything else, the gaps between raids stretch with the era
  s.nextRaidTick = s.tick + Math.round(Math.max(RAID_INTERVAL_MIN, hours) * ERA_MULTIPLIER[s.era] * difficultyOf(s).raidGap * TICKS_PER_HOUR);
}

/** Stock units plus 5 per finished building: what makes a town worth raiding. */
export function wealth(s: GameState): number {
  return poolSize(totalStock(s)) + 5 * s.buildings.filter((b) => b.status === 'done').length;
}

/** The town size (the player's choice) below which raids grow more slowly with the days. */
export const RAID_SMALL_TOWN = 20;

/** A raid's bite (RAID_BITE, RAID_FEROCITY), once the town is RAID_BITE_FROM grown-ups strong. */
export const biteOf = (s: GameState, bite: number) => (s.people.filter((p) => p.bornTick == null).length >= RAID_BITE_FROM ? bite : 1);

export function raidBudget(s: GameState): number {
  const day = Math.floor(paceDay(s.tick));
  const war = s.doom?.kind === 'war' && s.doom.phase === 'active' ? WAR_RAID_BUDGET : 1;
  // (and with how many it has to get past)
  const people = Math.max(0, s.people.filter((p) => p.away === null && p.type !== 'child').length - RAID_BUDGET_FREE_PEOPLE);
  // (a town kept small by the player's choice draws raids that grow more slowly: they come for what it's worth)
  const small = s.popTarget === undefined ? 1 : Math.min(1, s.popTarget / RAID_SMALL_TOWN);
  return Math.round((RAID_BUDGET_BASE + day * RAID_BUDGET_PER_DAY * small + Math.floor(wealth(s) * RAID_BUDGET_PER_WEALTH) + people * RAID_BUDGET_PER_PERSON) * war * difficultyOf(s).raidStrength * biteOf(s, RAID_BITE));
}

/** The building giving the longest raid warning, if any. */
function lookoutOf(s: GameState): Building | undefined {
  return s.buildings.filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.warningMinutes).sort((a, b) => BUILDING_BY_ID[b.def].warningMinutes! - BUILDING_BY_ID[a.def].warningMinutes!)[0];
}

/** The kinds of raid that can come in this era on this day. */
export const raidKindsFor = (era: Era, day: number) => RAID_KINDS.filter((k) => day >= k.fromDay && eraReached(era, k.era) && (!k.untilEra || eraReached(k.untilEra, era)));

/** A Shield Generator stands: no fires from raiders or meteors. */
export const shielded = (s: GameState) => s.buildings.some((b) => b.def === 'shield_generator' && b.status === 'done');

/** Start a raid if one is due. */
export function maybeStartRaid(s: GameState, rng: Rng): void {
  if (s.raid || s.tick < s.nextRaidTick) return;
  const day = Math.floor(paceDay(s.tick));
  // while the machines have risen, every raid is theirs
  const uprising = s.doom?.kind === 'rogue_ai' && s.doom.phase === 'active';
  const outbreak = s.doom?.kind === 'outbreak' && s.doom.phase === 'active';
  const freeze = s.doom?.kind === 'deep_freeze' && s.doom.phase === 'active';
  const rats = s.doom?.kind === 'rat_plague' && s.doom.phase === 'active';
  // (the land's own beasts come only in their own lands)
  const kinds = uprising ? [RAID_KIND_BY_ID.drones] : outbreak ? [RAID_KIND_BY_ID.zombies] : freeze ? [RAID_KIND_BY_ID.frost] : rats ? [RAID_KIND_BY_ID.rats] : raidKindsFor(s.era, day).filter((k) => (!k.biomes || k.biomes.includes(s.biome ?? 'forest')) && (!k.fromSea || seaTown(s)));
  // (the land, and who founded the town, make some raiders likelier, and some never come)
  const odds = biomeOf(s).raids ?? {};
  const own = rulesOf(s).raids ?? {};
  // (a rival never comes to a town founded its own way)
  const weights = Object.fromEntries(kinds.map((k) => [k.id, k.origin === (s.origin ?? 'settlers') ? 0 : k.weight * (odds[k.id] ?? 1) * (own[k.id] ?? 1) * rivalRaidOdds(s, k.id)]));
  const any = Object.values(weights).some((w) => w > 0);
  const kind = RAID_KIND_BY_ID[rng.weighted(any ? weights : Object.fromEntries(kinds.map((k) => [k.id, k.origin === (s.origin ?? 'settlers') ? 0 : k.weight])))];
  const raid = startRaid(s, kind, raidBudget(s), rng);
  // now and then the era's boss leads a raid of people (not beasts or the dead)
  const bosses = ERA_BOSS[s.era];
  if (bosses && day >= BOSS_RAID_FROM_DAY && kind.steals !== undefined && !kind.leader && rng.chance(BOSS_RAID_CHANCE)) {
    const boss = rng.pick(bosses);
    const first = raid.raiders[0];
    raid.raiders.push({ ...first, id: s.nextId++, kind: boss, hp: ENEMIES[boss].hp, maxHp: ENEMIES[boss].hp, goal: 'harm', x: first.x + raid.side * 30, carrying: {} });
    notify(s, `${ENEMIES[boss].name} leads them!`, true);
  }
  // and now and then the Behemoth drives a raid of beasts before it
  if (BEAST_RAIDS.includes(kind.id) && day >= BEHEMOTH_FROM_DAY && rng.chance(BEHEMOTH_CHANCE)) {
    const first = raid.raiders[0];
    const hp = Math.round(ENEMIES.behemoth.hp * (0.6 + day * 0.03));
    raid.raiders.push({ ...first, id: s.nextId++, kind: 'behemoth', hp, maxHp: hp, goal: 'harm', x: first.x + raid.side * 40, carrying: {} });
    notify(s, 'Something huge comes behind them...', true);
  }
  scheduleNextRaid(s, rng);
}

/** Each era's boss (who rules a legendary destination) and how often it leads a raid itself. */
const ERA_BOSS: Partial<Record<Era, string[]>> = { medieval: ['black_knight', 'dragon'], industrial: ['iron_baron', 'iron_colossus'], modern: ['warlord', 'war_machine'], space: ['pirate_king', 'star_mech'] };
const BOSS_RAID_CHANCE = 0.12;
const BOSS_RAID_FROM_DAY = 10;
/** The beast raids the Behemoth may drive, from which day, and how often. */
const BEAST_RAIDS = ['wolves', 'boars', 'lions', 'wild_dogs', 'crocodiles'];
const BEHEMOTH_FROM_DAY = 8;
const BEHEMOTH_CHANCE = 0.1;

/** Gather a raid at the edge of the land, with a warning; or, given `inside` (a point), one that's already in the middle
 *  of the town, fighting (lurkers.ts). */
export function startRaid(s: GameState, kind: RaidKind, budget: number, rng: Rng, inside?: Pt, host?: { most: number; siege: number; leader: string; host: string }): Raid {
  const side: -1 | 1 = rng.chance(0.5) ? -1 : 1;
  const raiders: Raider[] = [];
  const costs = Object.entries(kind.enemies);
  const cheapest = Math.min(...costs.map(([, c]) => c));
  // (a rival's lord always leads its army: it takes its share of the budget)
  const leader = host?.leader ?? kind.leader;
  let left = leader ? Math.max(0, budget - RIVAL_LEADER_COST) : budget;
  const grown = s.people.filter((p) => p.away === null && p.type !== 'child').length;
  // (a war host comes as big as it was mustered: sim/factions.ts)
  const most = host ? host.most - host.siege : Math.min(RAID_SIZE_CAP, RAID_MAX_SIZE + Math.max(0, Math.floor((grown - RAID_SIZE_FREE) / RAID_SIZE_PER_PEOPLE)));
  while (raiders.length < most && (left >= cheapest || raiders.length === 0)) {
    const affordable = costs.filter(([, c]) => c <= left);
    const [id, cost] = affordable.length ? rng.pick(affordable) : costs.find(([, c]) => c === cheapest)!;
    left -= cost;
    const d = ENEMIES[id];
    raiders.push({
      id: s.nextId++,
      kind: id,
      ...(kind.fromSea ? offSea(s, raiders.length) : offMap(s, side, raiders.length)),
      dir: side < 0 ? 1 : -1,
      hp: d.hp,
      maxHp: d.hp,
      cooldown: rng.int(1, Math.round(d.interval * TICK_HZ)),
      down: false,
      fleeing: false,
      gone: false,
      carrying: {},
      lastAction: -999,
      lastHit: -999,
      // (only kinds with several goals draw one, so older raids replay the same)
      goal: kind.goals ? rng.weighted(kind.goals as Record<RaidGoal, number>) : kind.goal,
    });
  }
  // (a host's siege engines come behind the troops, to break the walls)
  for (let i = 0; i < (host?.siege ?? 0); i++) {
    const last = raiders[raiders.length - 1];
    const d = ENEMIES.siege_engine;
    raiders.push({ ...last, id: s.nextId++, kind: 'siege_engine', hp: d.hp, maxHp: d.hp, goal: 'harm', x: last.x + (side < 0 ? -24 : 24), carrying: {} });
  }
  if (leader) {
    const hp = lordHp(s, leader);
    const last = raiders[raiders.length - 1];
    raiders.push({ ...last, id: s.nextId++, kind: leader, hp, maxHp: hp, goal: 'harm', x: last.x + (side < 0 ? -30 : 30), carrying: {} });
  }
  // a big town draws hardened raiders: tougher, and harder hitting
  const might = Math.min(RAID_MIGHT_MAX, 1 + Math.max(0, grown - RAID_MIGHT_FREE) * RAID_MIGHT_PER_PERSON) * seasonedMight(s);
  if (might > 1)
    for (const rd of raiders) {
      rd.might = might;
      rd.hp = rd.maxHp = Math.round(rd.maxHp * might);
    }
  // a big enough raid of people may split: some come round to the other end of the town
  const day = paceDay(s.tick);
  let flank = 0;
  if (inside === undefined && !kind.fromSea && (kind.steals !== undefined || !!host) && raiders.length >= FLANK_MIN && rng.chance(Math.min(FLANK_MAX, FLANK_CHANCE + day * FLANK_PER_DAY))) {
    const other = -side as -1 | 1;
    const party = raiders.filter((rd) => !ENEMIES[rd.kind].kit).slice(-Math.floor(raiders.length / 3));
    party.forEach((rd, i) => {
      rd.side = other;
      rd.dir = other < 0 ? 1 : -1;
      rd.x = offMap(s, other, i).x;
    });
    flank = party.length;
  }
  // (a lich founder may command most of the dead)
  if (kind.id === 'zombies') bindTheDead(s, raiders);
  // (and a werewolf founder's own kind run with them)
  if (kind.id === 'wolves') runWithThePack(s, raiders);
  const lookout = lookoutOf(s);
  // guards on patrol spot them a little sooner still
  const patrol = s.people.some((p) => p.task?.type === 'patrol') ? PATROL_WARNING_MINUTES : 0;
  const warn = Math.round((((lookout ? BUILDING_BY_ID[lookout.def].warningMinutes! : WARNING_MINUTES) + patrol) / 60) * TICKS_PER_HOUR);
  const raid: Raid = { id: s.nextId++, kind: kind.id, side, phase: 'warning', arrivesTick: s.tick + warn, leavesTick: s.tick + warn + RAID_MAX_HOURS * TICKS_PER_HOUR, raiders, prompt: null };
  if (host) raid.host = host.host;
  // the town's allies send some of their own (to a host always, now and then to any raid: sim/factions.ts)
  if (inside === undefined) alliesFor(s, raid, rng, (k) => ally(s, k, townEdgeX(s, side), side < 0 ? -1 : 1));
  if (inside !== undefined) {
    raiders.forEach((rd, i) => {
      rd.x = inside.x + (i - (raiders.length - 1) / 2) * 14;
      rd.y = inside.y;
      rd.dir = i % 2 ? 1 : -1;
    });
    raid.phase = 'active';
    noteRoll(s, raid);
    raid.arrivesTick = s.tick;
    raid.leavesTick = s.tick + RAID_MAX_HOURS * TICKS_PER_HOUR;
    s.raid = raid;
    return raid;
  }

  const options = ['Sound the alarm'];
  if (kind.bribable) options.push(`Pay them off (${bribeCost(raid)} food)`);
  if (s.expeditions.length) options.push('Recall expeditions');
  const where = side < 0 ? 'west' : 'east';
  const prompt = {
    id: s.nextId++,
    kind: 'raid' as const,
    expedition: null,
    title: `${kind.name} spotted!`,
    text: `${raiders.length - flank} ${raiders.length - flank === 1 ? 'raider is' : 'raiders are'} coming from the ${where}${flank ? `, and ${flank} more from the ${side < 0 ? 'east' : 'west'}` : ''}${lookout ? ` (seen from the ${BUILDING_BY_ID[lookout.def].name.toLowerCase()})` : ''}.`,
    options,
    defaultOption: 0,
    expiresTick: raid.arrivesTick,
  };
  s.prompts.push(prompt);
  raid.prompt = prompt.id;
  s.raid = raid;
  // (a wandering tribe draws its wagons up across the camp)
  circleWagons(s);
  notify(s, `${kind.name} ${kind.plural ? 'are' : 'is'} coming from the ${where}${flank ? ', and round the other side' : ''}!`);
  return raid;
}

const bribeCost = (r: Raid) => r.raiders.length * BRIBE_FOOD_PER_RAIDER;

/** The Hunter's Guild comes for a monster: a raid of hunters, with the Guild's own demand. */
export function startGuildRaid(s: GameState, target: Person, rng: Rng): void {
  const raid = startRaid(s, RAID_KIND_BY_ID.hunters, 40 + Math.round((s.guild ?? 0) / 2), rng);
  const prompt = s.prompts.find((p) => p.id === raid.prompt)!;
  const { options, defaultOption } = guildOptions(target);
  prompt.title = "The Hunter's Guild is coming!";
  prompt.text = `Hunters are coming for ${target.name} the ${target.monster}. Give them up, try to hide them, or fight?`;
  prompt.options = options;
  prompt.defaultOption = defaultOption;
  s.guildTarget = target.id;
}

/** The player's (or the default) answer to the raid warning. */
export function answerRaidPrompt(s: GameState, label: string, rng: Rng): void {
  const r = s.raid;
  if (!r) return;
  r.prompt = null;
  if (r.kind === 'hunters') {
    if (answerGuild(s, label, rng)) {
      s.raid = null;
      s.guildTarget = null;
    }
    return;
  }
  if (label.startsWith('Pay')) {
    if (takeFood(s, bribeCost(r))) {
      notify(s, `You paid off the ${RAID_KIND_BY_ID[r.kind].name.toLowerCase()}. They turn back.`, true);
      s.raid = null;
      return;
    }
    notify(s, 'Not enough food to pay them off. Sound the alarm!');
  } else if (label.startsWith('Recall')) {
    for (const e of s.expeditions) recallExpedition(s, e.id);
    notify(s, 'Expeditions recalled. They are a long way off, though.');
  }
}

function takeFood(s: GameState, units: number): boolean {
  const foods = Object.keys(FOOD_VALUE) as Material[];
  const have = storages(s).reduce((n, b) => n + foods.reduce((k, m) => k + (b.store[m] ?? 0), 0), 0);
  if (have < units) return false;
  let left = units;
  for (const b of storages(s)) {
    for (const m of foods) {
      const n = Math.min(left, b.store[m] ?? 0);
      if (n > 0) {
        addStock(b.store, m, -n);
        left -= n;
      }
    }
  }
  return true;
}

/* ------------------------------------------------------------ the raid itself */

/** Anyone raiders can see and reach: in town, standing, and not hidden in a bed. */
function exposed(p: Person, raidKind?: string): boolean {
  if (p.away !== null || p.downed) return false;
  if (raidKind === 'zombies' && p.monster === 'undead') return false; // (the dead pass the undead by)
  if ((p.task?.type === 'shelter' || p.task?.type === 'sleep') && p.bed !== null && p.activity === 'sleep') return false;
  return true;
}

/** How far a raider has to go for something. */
const cost = (rd: Raider, at: Pt) => dist(rd, at);

/** Raiders are on the map (not waiting beyond the edge). */
export const raidActive = (s: GameState) => s.raid?.phase === 'active';

const walls = (s: GameState) => s.buildings.filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def].hp && (b.hp ?? 0) > 0);

/** The first standing wall across the straight way from `from` to `target` (within a cell of the line), if any. */
function wallBetween(s: GameState, from: Pt, target: Pt): Building | null {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  let best: Building | null = null;
  let bestT = Infinity;
  for (const w of walls(s)) {
    const c = buildingCentre(w);
    const t = ((c.x - from.x) * dx + (c.y - from.y) * dy) / len2;
    if (t <= 0 || t >= 1) continue;
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    if (Math.hypot(c.x - px, c.y - py) > (defOf(w).width * CELL) / 2 + CELL / 2) continue;
    if (t < bestT) {
      bestT = t;
      best = w;
    }
  }
  return best;
}

export function updateRaid(s: GameState, rng: Rng): void {
  const r = s.raid;
  if (!r) return;
  const kind = RAID_KIND_BY_ID[r.kind];
  if (r.phase === 'warning') {
    if (s.tick < r.arrivesTick) return;
    r.phase = 'active';
    noteRoll(s, r);
    notify(s, `The ${theName(kind.name)} ${kind.plural ? 'are' : 'is'} here!`);
    summonForRaid(s, r);
    for (const kind of new Set(r.raiders.filter((q) => ENEMIES[q.kind].kit && !q.ally).map((q) => q.kind))) bossArrives(s, kind);
    // (they come down the trail on the battle map first: battle.ts)
    if (battlesOn(s)) (tacticsOn(s) ? startTactics(s, r) : startBattle(s, r));
  }
  classesInRaid(s, r);
  bossesInRaid(s, r);
  rivalsInRaid(s, r, rng);
  const stepFor = kind.speed / TICK_HZ;
  fireDefenses(s, rng);
  tickBurns(s, r.raiders, (rd, dmg) => hurtInTown(s, rd, dmg));
  // the battle on the trail; the raiders still in it are its business (those through it come on into the town)
  const battling = r.tactics ? stepTactics(s, r, rng) : stepBattle(s, r, rng);
  // (whoever fell since last tick leaves blood where it lies, if it's the kind that bleeds)
  for (const rd of r.raiders)
    if (rd.down && !rd.bled) {
      rd.bled = true;
      const nature = natureOf(rd.kind);
      if ((nature === 'person' || nature === 'beast') && rd.x >= 0 && rd.x <= worldW(s)) markBlood(s, rd.x, rd.y, rd.dir < 0 ? 1 : -1);
      if (!rd.ally && rd.x >= 0 && rd.x <= worldW(s)) markDebris(s, rd.x, rd.y, nature, rd.id);
    }

  for (const rd of r.raiders) {
    if (rd.down && rd.captive) release(s, rd); // cut down while carrying someone off: they're dropped
    if (rd.down || rd.gone) continue;
    const step = stepFor * speedOf(rd, s.tick); // (slowed by a trap, it limps)
    if (rd.bt && !rd.bt.out) continue;
    if (rd.ally) {
      if (battling) continue; // (the town's allies are on the battle map)
      allyAct(s, r, rd, rng, step);
      continue;
    }
    const def = ENEMIES[rd.kind];
    const goal = rd.goal ?? kind.goal;
    if (rd.routed && !rd.fleeing) rd.fleeing = true; // (turned about by a glamour)
    rd.cooldown--;
    // (an epic boss never runs from a fight: only time drives it off)
    const coward = !ENEMIES[rd.kind].kit && rd.hp < rd.maxHp * RAIDER_FLEE[goal];
    if (!rd.fleeing && (coward || s.tick >= r.leavesTick || poolSize(rd.carrying) >= RAIDER_CARRY)) rd.fleeing = true;
    const edge = offMap(s, rd.side ?? r.side); // (each back the way it came)
    if (rd.fleeing) {
      // (a lame runner may be run down by a defender close by: sim/raiderWounds.ts)
      if (rd.lame && tryRunDown(s, rd, s.people.find((p) => p.away === null && !p.downed && p.task?.type === 'defend' && dist(p, rd) <= RUN_DOWN_PX))) continue;
      if (moveToward(s, rd, { x: edge.x, y: rd.y }, step * (rd.captive ? 0.8 : 1.2))) {
        rd.gone = true;
        if (rd.captive) carriedOff(s, rd, kind.name);
      }
      continue;
    }
    const reach = def.ranged ? THROW_RANGE : MELEE_RANGE;
    // 0. A kidnapper picks up whoever they've struck down (never the main character) and runs.
    if (goal === 'kidnap') {
      const fallen = s.people.filter((p) => p.downed && p.away === null && p.id !== s.mainId).sort((a, b) => cost(rd, a) - cost(rd, b))[0];
      if (fallen && dist(fallen, rd) <= MELEE_RANGE) {
        grab(s, rd, fallen);
        continue;
      }
      if (fallen && !s.people.some((p) => exposed(p, kind.id) && dist(p, rd) <= reach)) {
        moveToward(s, rd, fallen, step); // go and pick them up (unless someone's in the way)
        continue;
      }
    }
    // 1. Anyone in reach gets attacked.
    const near = s.people.filter((p) => exposed(p, kind.id) && dist(p, rd) <= reach).sort((a, b) => dist(a, rd) - dist(b, rd))[0];
    if (near) {
      rd.dir = near.x >= rd.x ? 1 : -1;
      if (rd.cooldown <= 0) attackPerson(s, rd, near, rng);
      continue;
    }
    // 1b. With nobody standing in reach, a killer finishes off someone lying at its feet (never the founder).
    // (the Hunter's Guild only finishes off monsters: the ordinary folk they leave lying)
    const fallen = goal === 'harm' ? s.people.find((p) => p.downed && p.away === null && p.id !== s.mainId && p.activity !== 'sleep' && dist(p, rd) <= MELEE_RANGE && (kind.id !== 'hunters' || !!p.monster)) : undefined;
    if (fallen && rd.cooldown <= 0) {
      rd.cooldown = Math.round(def.interval * TICK_HZ);
      rd.lastAction = s.tick;
      if (rng.chance(FINISH_OFF_CHANCE)) killPerson(s, fallen, `at the hands of the ${def.name.replace(/^The /, '')}`);
      continue;
    }
    // 2. Head for the goal: people (beasts, kidnappers), a building to burn, or the stores.
    let target: { x: number; y: number; store?: Building; burn?: Building } | null = null;
    if (goal === 'harm' || goal === 'kidnap') {
      const prey = s.people.filter((p) => exposed(p, kind.id) && (goal === 'harm' || p.id !== s.mainId)).sort((a, b) => cost(rd, a) - cost(rd, b))[0];
      if (prey) target = { x: prey.x, y: prey.y };
    }
    // (a shield generator keeps every fire-starter out)
    if (!target && goal === 'burn' && (rd.fires ?? 0) < ARSON_LIMIT && !shielded(s)) {
      const b = s.buildings.filter((q) => q.status === 'done' && q.fire === undefined && !defOf(q).hp && flammable(q)).sort((a, c) => cost(rd, buildingDoor(a)) - cost(rd, buildingDoor(c)))[0];
      if (b) target = { ...buildingDoor(b), burn: b };
    }
    if (!target) {
      const score = kind.steals === 'valuables' ? valueScore : foodScore;
      const st = storages(s)
        .filter((b) => poolSize(b.store) > 0)
        .sort((a, b) => score(b) - score(a) || cost(rd, buildingDoor(a)) - cost(rd, buildingDoor(b)))[0];
      if (st) target = { ...buildingDoor(st), store: st };
    }
    if (!target) {
      rd.fleeing = true; // nothing here for them
      continue;
    }
    // 3. A wall in the way gets broken down first.
    const wall = wallBetween(s, rd, target);
    if (wall) {
      const c = buildingCentre(wall);
      const d = dist(rd, c);
      const stand = (defOf(wall).width * CELL) / 2 + 6;
      const at = d > 0 ? { x: c.x + ((rd.x - c.x) / d) * stand, y: c.y + ((rd.y - c.y) / d) * stand } : rd;
      if (dist(rd, at) > step) moveToward(s, rd, at, step);
      else if (rd.cooldown <= 0) attackWall(s, rd, wall, rng);
      continue;
    }
    if (dist(target, rd) > step) {
      moveToward(s, rd, target, step);
      continue;
    }
    if (target.burn) {
      if (rd.cooldown > 0) continue;
      rd.cooldown = Math.round(def.interval * TICK_HZ * 3); // it takes a moment to get a fire going
      rd.lastAction = s.tick;
      if (setFire(s, target.burn)) rd.fires = (rd.fires ?? 0) + 1;
      if ((rd.fires ?? 0) >= ARSON_LIMIT) rd.fleeing = true;
      continue;
    }
    if (target.store) steal(rd, target.store, kind.steals ?? 'food');
  }

  if (r.raiders.every((rd) => rd.down || rd.gone || rd.ally)) endRaid(s, rng);
}

/** Fires one arsonist sets before running. */
const ARSON_LIMIT = 2;

const foodScore = (b: Building) => (Object.keys(FOOD_VALUE) as Material[]).reduce((n, m) => n + (b.store[m] ?? 0), 0);
const valueScore = (b: Building) => MATERIALS.reduce((n, m) => n + (b.store[m] ?? 0) * (LOOT_VALUE[m] ?? 1), 0);

/** A kidnapper takes someone: out of the town, stabilized (they want them alive), and away they go. */
function grab(s: GameState, rd: Raider, p: Person): void {
  s.people = s.people.filter((q) => q !== p);
  stabilize(p);
  p.task = null;
  p.carrying = {};
  rd.captive = p;
  rd.fleeing = true;
  notify(s, `${p.name} is being carried off!`, true);
}

/** Drop a captive where the kidnapper fell; the town takes them back. */
function release(s: GameState, rd: Raider): void {
  const p = rd.captive!;
  rd.captive = null;
  p.x = Math.max(0, Math.min(worldW(s), rd.x));
  p.y = rd.y;
  p.away = null;
  s.people.push(p);
  notify(s, `${p.name} was saved from the kidnapper.`, true);
}

/** The kidnapper got away: the captive is held at the bandits' camp until a party clears it. */
function carriedOff(s: GameState, rd: Raider, by: string): void {
  const p = rd.captive!;
  rd.captive = null;
  s.captives.push(p);
  notify(s, `${p.name} was carried off by the ${by.toLowerCase()}. Clear the Bandit Camp to bring them home.`, true);
}

/** Straight at a point (raiders don't keep to the paths). True once there. */
function moveToward(s: GameState, rd: Raider, to: Pt, step: number): boolean {
  // (in a castle or a hold they keep to its walls like anyone: in by the gate, room to room by the doorways)
  if (castleOn(s)) return walk(s, rd as Raider & Walker, to, step, undefined, s.tick);
  const dx = to.x - rd.x;
  const dy = to.y - rd.y;
  const d = Math.hypot(dx, dy);
  if (Math.abs(dx) > 0.5) rd.dir = dx > 0 ? 1 : -1;
  if (d <= step) {
    rd.x = to.x;
    rd.y = to.y;
    return true;
  }
  rd.x += (dx / d) * step;
  rd.y += (dy / d) * step;
  return false;
}

function steal(rd: Raider, st: Building, what: 'food' | 'valuables'): void {
  const foods = Object.keys(FOOD_VALUE) as Material[];
  const order = what === 'valuables' ? [...MATERIALS].sort((a, b) => (LOOT_VALUE[b] ?? 1) - (LOOT_VALUE[a] ?? 1)) : [...foods, ...MATERIALS.filter((m) => !foods.includes(m))];
  for (const m of order) {
    const n = Math.min(st.store[m] ?? 0, RAIDER_CARRY - poolSize(rd.carrying));
    if (n > 0) {
      addStock(st.store, m, -n);
      addStock(rd.carrying, m, n);
    }
  }
  rd.fleeing = true;
}

/** A raider strikes someone. `area`: who a boss's sweep can reach (the battle map picks them; in town, by distance). */
export function attackPerson(s: GameState, rd: Raider, p: Person, rng: Rng, area?: Person[]): void {
  // (the harm taken, for the raid's recap: everyone a boss's sweep reached too)
  const hit = area ?? s.people.filter((q) => exposed(q));
  const was = new Map([p, ...hit].map((q) => [q, q.hp]));
  strikePerson(s, rd, p, rng, area);
  for (const [q, hp] of was) tookHarm(s, q, hp);
}

function strikePerson(s: GameState, rd: Raider, p: Person, rng: Rng, area?: Person[]): void {
  const def = ENEMIES[rd.kind];
  rd.cooldown = Math.round(def.interval * TICK_HZ);
  rd.lastAction = s.tick;
  const dodge = 0.05 + p.skills.melee.level * 0.01;
  if (rng.next() >= def.accuracy - dodge) return;
  const blow = (q: Person) => {
    const g = gearEffects(q);
    return hitDamage({ damage: def.damage, ammo: 0, ammoBonus: 0, ammoUsed: 0, beastDamage: 0 }, { kind: 'person', armor: Math.min(0.6, g.armor), block: g.block, tough: q.traits.includes('tough') }, rng);
  };
  // an epic boss rages, and now and then sweeps everyone near it
  const mult = def.kit ? bossBlow(s, rd, area ?? s.people.filter((q) => exposed(q)), blow, !!area) : 1;
  if (!mult) return;
  // (a rival lord's frenzy: harder, and sooner again)
  const frenzy = frenzyOf(s);
  if (frenzy > 1) rd.cooldown = Math.round(rd.cooldown / frenzy);
  const dmg = Math.round(blow(p) * mult * frenzy * guardRate(s) * (rd.might ?? 1) * biteOf(s, RAID_FEROCITY));
  p.hp = Math.max(0, p.hp - dmg);
  if (dmg > 0) {
    woundPerson(s, p, dmg, (sev) => woundFor(rd.kind, sev, rng), rng); // (a wound where it landed: sim/injuries.ts)
    p.lastHit = s.tick;
    p.hitFrom = rd.x < p.x ? -1 : 1;
  } else p.lastBlock = s.tick; // (turned on a shield or armour: the guarding pose)
  if (dmg > 0 && (rd.kind === 'ice_mage' || rd.kind === 'frost_archmage')) personFx(s, p.id, 'frost'); // (a burst of ice)
  // a plague rat's bite can carry the sickness
  if (dmg > 0 && (rd.kind === 'plague_rat' || rd.kind === 'rat_king') && !tireless(p) && !p.sick && rng.chance(RAT_BITE_SICKNESS)) sicken(s, p, rng);
  if (p.hp === 0) {
    // (a killing blow: no lying wounded waiting to be tended)
    // (the founder only when someone could take the town on: a lone founder's camp isn't ended by one blow)
    // (a kidnapper wants them alive)
    const odds = rd.goal === 'kidnap' ? 0 : p.id === s.mainId ? (heirOf(s, p) ? FOUNDER_KILLING_BLOW : 0) : def.kit || def.boss ? BOSS_KILLING_BLOW : KILLING_BLOW;
    if (rng.chance(odds)) {
      const by = /^the /i.test(def.name) ? def.name : `${/^[aeiou]/i.test(def.name) ? 'an' : 'a'} ${def.name.toLowerCase()}`;
      killPerson(s, p, `at the hands of ${by}`);
      return;
    }
    knockDown(s, p);
    notify(s, `${p.name} was struck down!`);
  }
}

function attackWall(s: GameState, rd: Raider, wall: Building, rng: Rng): void {
  const def = ENEMIES[rd.kind];
  rd.cooldown = Math.round(def.interval * TICK_HZ);
  rd.lastAction = s.tick;
  wall.hp = Math.max(0, (wall.hp ?? 0) - rng.int(def.damage[0], def.damage[1]) * (rd.kind === 'siege_engine' ? SIEGE_WALL : 1));
  if (wall.hp === 0) {
    s.buildings = s.buildings.filter((b) => b !== wall);
    notify(s, `The raiders broke through the ${defOf(wall).name.toLowerCase()}!`, true);
  }
}

/** An ally (summoned, raised or tamed) goes for the nearest raider still fighting the town. */
function allyAct(s: GameState, r: Raid, rd: Raider, rng: Rng, step: number): void {
  const def = ENEMIES[rd.kind];
  const foe = r.raiders.filter((o) => !o.ally && !o.down && !o.gone && o.x >= 0 && o.x <= worldW(s)).sort((a, b) => dist(a, rd) - dist(b, rd))[0];
  if (!foe) return;
  rd.dir = foe.x >= rd.x ? 1 : -1;
  const reach = def.ranged ? THROW_RANGE : MELEE_RANGE;
  if (dist(foe, rd) > reach) {
    moveToward(s, rd, foe, step);
    return;
  }
  if (--rd.cooldown > 0) return;
  rd.cooldown = Math.round(def.interval * TICK_HZ);
  if (rng.next() >= def.accuracy - ENEMIES[foe.kind].dodge) return;
  foe.hp = Math.max(0, foe.hp - Math.round(rng.int(def.damage[0], def.damage[1]) * wardOf(s)));
  if (foe.hp === 0) foe.down = true;
}

/** Traps and turrets: each hits the nearest raider in its range when it's ready. */
function fireDefenses(s: GameState, rng: Rng): void {
  if (turretsDown(s)) return; // (an EMP)
  for (const b of s.buildings) {
    const d = b.status === 'done' ? BUILDING_BY_ID[b.def]?.defense : undefined;
    if (!d || (b.readyTick ?? 0) > s.tick) continue;
    const at = buildingCentre(b);
    const target = s.raid!.raiders.filter((rd) => !rd.down && !rd.gone && !rd.ally && !(s.raid!.tactics && rd.bt && !rd.bt.out) && dist(rd, at) <= d.range).sort((a, c) => dist(a, at) - dist(c, at))[0];
    if (!target) continue;
    b.readyTick = s.tick + Math.round(d.interval * TICK_HZ);
    const was = before(s.raid!.raiders);
    const volley = fireAt(s, rng, d, target, (rd, px) => s.raid!.raiders.filter((q) => q !== rd && dist(q, rd) <= px), (rd, dmg) => hurtInTown(s, rd, dmg));
    credit(s, TOWERS, was);
    for (const { rd } of volley.struck) rd.hitFx = b.def === 'laser_turret' || b.def === 'tesla_coil' ? 'shock' : null;
  }
}

/** A blow on a raider in the town. */
function hurtInTown(s: GameState, rd: Raider, dmg: number): void {
  if (rd.down || rd.gone) return;
  rd.hp = Math.max(0, rd.hp - Math.round(dmg));
  rd.lastHit = s.tick;
  if (rd.hp === 0) rd.down = true;
}

/** A defender's attack on the nearest raider in reach (called from the defend task). `mult`: a battle's chosen ground
 *  (battle.ts) makes each blow count for more; `near`: who a mage's fire bursts over (in town, those beside the one hit). */
export function defenderAttack(s: GameState, p: Person, rd: Raider, rng: Rng, bonus = 0, mult = 1, near?: Raider[]): void {
  // (what the blow did, for the raid's recap)
  const was = before(s.raid?.raiders ?? [rd]);
  strikeRaider(s, p, rd, rng, bonus, mult, near);
  credit(s, p.id, was);
}

function strikeRaider(s: GameState, p: Person, rd: Raider, rng: Rng, bonus: number, mult: number, near?: Raider[]): void {
  // (held by a rival lord's hex, they lose the moment)
  if (heldBack(s, p, rng)) return;
  p.lastBlow = s.tick;
  if (castsFire(p.cls)) return mageFire(s, p, rd, rng, mult, near ?? (s.raid?.raiders ?? []).filter((o) => o !== rd && !o.ally && !o.down && !o.gone && dist(o, rd) <= MAGE_BURST_PX));
  // a shooter at home takes a stone or arrow from storage for each shot, while there are any
  const kind = ammoOf(p);
  const store = kind ? storages(s).find((b) => (b.store[kind] ?? 0) > 0) : undefined;
  const f = personFighter(p, 'fighter', 'front', store ? 1 : 0);
  if (store) addStock(store.store, kind!, -1);
  const dodge = ENEMIES[rd.kind].dodge;
  gainSkill(p, f.ranged ? 'ranged' : 'melee', 6);
  const captain = operatorSkill(s, 'watchtower') * CAPTAIN_PER_LEVEL; // a guard captain drills the defenders
  if (rng.next() >= f.accuracy + captain - fogAim(s) - dodge) return;
  let dmg = Math.round((hitDamage(f, { kind: rd.kind, armor: enemyArmor(rd.kind), block: 0, tough: false }, rng) + bonus) * fightRate(s) * wardOf(s) * (rallied(s, p) ? RALLY_DAMAGE : 1) * mult);
  // a Blood Knight hits harder when hurt, and heals from what they deal
  if (p.cls === 'blood_knight') {
    if (p.hp < maxHp(p) / 2) dmg = Math.round(dmg * BLOOD_FURY);
    p.hp = Math.min(maxHp(p), p.hp + Math.round(dmg * BLOOD_LIFESTEAL));
  }
  if (f.quirks?.drain) p.hp = Math.min(maxHp(p), p.hp + Math.round(Math.min(dmg, rd.hp) * f.quirks.drain)); // (a unique that drinks life)
  rd.hp = Math.max(0, rd.hp - dmg);
  rd.lastHit = s.tick;
  // (a stunning weapon may cost the raider its next blow; a cleaving one carries into one beside it)
  const beside = near ?? (s.raid?.raiders ?? []).filter((o) => o !== rd && !o.ally && !o.down && !o.gone && dist(o, rd) <= CLEAVE_PX);
  const pace = { cooldown: rd.cooldown, interval: Math.round(ENEMIES[rd.kind].interval * TICK_HZ) };
  const cleft = afterBlow(f.quirks, dmg, pace, beside, rng);
  rd.cooldown = pace.cooldown;
  if (cleft) (cleft as Raider).lastHit = s.tick;
  // (a Blood Knight's blow bursts with blood; a gunshot with fire, a laser with lightning)
  rd.hitFx = p.cls === 'blood_knight' ? 'blood' : store && kind === 'power_cells' ? 'lightning' : store && (kind === 'shot' || kind === 'cartridges') ? 'fire' : null;
  if (rd.hp === 0) rd.down = true;
}

/** How near (px) a raider must be to the one struck for a cleaving blow to carry into it. */
const CLEAVE_PX = 20;

/** A mage's fire bolt: it strikes the one aimed at (study makes it hotter; armour and dodging don't help) and bursts
 *  over those beside it for half. */
function mageFire(s: GameState, p: Person, rd: Raider, rng: Rng, mult: number, near: Raider[]): void {
  gainSkill(p, 'research', 6);
  if (rng.next() >= MAGE_ACCURACY - fogAim(s)) return;
  const dmg = (rng.int(MAGE_DAMAGE[0], MAGE_DAMAGE[1]) + p.skills.research.level * MAGE_PER_LEVEL) * fightRate(s) * wardOf(s) * (rallied(s, p) ? RALLY_DAMAGE : 1) * mult;
  for (const [o, k] of [[rd, 1] as const, ...near.map((o) => [o, MAGE_SPLASH] as const)]) {
    o.hp = Math.max(0, o.hp - Math.round(dmg * k));
    o.lastHit = s.tick;
    o.hitFx = 'fire';
    if (o.hp === 0) o.down = true;
  }
}

/** How far a defender can strike from: thrown stones for the better throwers (and a mage's fire), fists and clubs otherwise. */
export function defenderReach(p: Person): number {
  // (every calling that fights from afar, the casters and healers with the archers, keeps off the trail and shoots)
  if (shapeshifts(p)) return MELEE_RANGE; // (a bear holds the trail)
  if (fightsFromRange(p.cls)) return THROW_RANGE;
  const sling = !!p.gear.weapon && !!ITEM_BY_ID[p.gear.weapon]?.effects.ranged;
  return sling || p.skills.ranged.level > p.skills.melee.level + 2 ? THROW_RANGE : MELEE_RANGE;
}

/** The raider a defender should go after: the nearest one in the town (those still on the battle's trail are the
 *  battle's: battle.ts). */
export function nearestRaider(s: GameState, at: Pt): Raider | null {
  const r = s.raid;
  if (!r || r.phase !== 'active') return null;
  let best: Raider | null = null;
  for (const rd of r.raiders) {
    if (rd.down || rd.gone || rd.ally || rd.x < 0 || rd.x > worldW(s) || (rd.bt && !rd.bt.out)) continue;
    if (!best || dist(rd, at) < dist(best, at)) best = rd;
  }
  return best;
}

/** How far past its outermost building the town's edge lies. */
export const TOWN_MARGIN = CELL;

/** The town's edge on one side: just past its outermost building (walls and gates included; not the fields
 *  behind), or the edge of the camp's cleared ground if it has none yet. Defenders hold the town here: they gather at
 *  it before a raid, and never go out past it after the raiders (they meet them as they come in, or shoot from it). */
export function townEdgeX(s: GameState, side: -1 | 1): number {
  let edge: number | null = null;
  for (const b of s.buildings) {
    const def = BUILDING_BY_ID[b.def];
    if (!def || def.layer === 'back') continue;
    const x = side < 0 ? b.tile * CELL : (b.tile + def.width) * CELL;
    edge = edge === null ? x : side < 0 ? Math.min(edge, x) : Math.max(edge, x);
  }
  return edge === null ? campEdge(s, side).x : edge + side * TOWN_MARGIN;
}

/** Where defenders gather before the raiders show up: the town's edge on the side they're coming from, on the
 *  camp's row (the way the raiders come). */
export const rallyPoint = (s: GameState): Pt => ({ x: townEdgeX(s, s.raid?.side ?? 1), y: campXY(s).y });

/** A raid's name to follow "the" (a name of its own, like The Cave Bear, keeps its capitals and loses its "The"). */
const theName = (name: string) => (/^the /i.test(name) ? name.slice(4) : name.toLowerCase());

function endRaid(s: GameState, rng: Rng): void {
  const r = s.raid!;
  s.raid = null;
  if (r.tactics) tacticsOver(s, r); // (the board stays up a moment for the last word: sim/tactics.ts)
  const kind = RAID_KIND_BY_ID[r.kind];
  meet(s, r.raiders.filter((rd) => !rd.ally).map((rd) => rd.kind)); // (the Bestiary)
  if (r.kind === 'hunters') guildDefeated(s);
  // (a boss struck down as the raid ended, on the battle map, hasn't had its loot yet: bossesInRaid looks before the battle)
  for (const rd of r.raiders)
    if (!rd.ally && rd.down && ENEMIES[rd.kind]?.boss && !rd.trophyGiven) {
      rd.trophyGiven = true;
      bossSlain(s, rd.kind);
    }
  lurkersBeaten(s, r);
  caveBearBeaten(s, r);
  packRaidBeaten(s, r, rng);
  sagaRaidOver(s, r);
  hostOver(s, r);
  calamityRaidOver(s, r);
  // thieves who got away may have led off a horse, too
  if (s.horses.length && r.raiders.some((rd) => rd.gone && poolSize(rd.carrying) > 0) && rng.chance(HORSE_THEFT)) {
    const h = s.horses.splice(rng.int(0, s.horses.length - 1), 1)[0];
    notify(s, `The raiders stole ${h.name} from the stable.`, true);
  }
  // (and drove off some of the livestock, or carried it off in their jaws)
  if (r.raiders.some((rd) => rd.gone && !rd.ally)) rustle(s, rng);
  const stolen: Stock = {};
  const spoils: Stock = {};
  let killed = 0;
  // (the town's own summoned and tamed allies aren't counted, or taken prisoner; raiders a necromancer raised
  // were killed first: they count, and leave their loot)
  const foes = r.raiders.filter((rd) => !rd.ally || rd.raiseChecked);
  const enemies = r.raiders.filter((rd) => !rd.ally);
  for (const rd of foes) {
    if (rd.down || rd.ally) {
      killed++;
      depositNear(s, { x: Math.max(0, Math.min(worldW(s), rd.x)), y: rd.y }, { ...ENEMIES[rd.kind].loot });
      if (!rd.ally || rd.raiseChecked) for (const [m, n] of Object.entries(ENEMIES[rd.kind].loot)) if (n) addStock(spoils, m as Material, n);
    } else for (const m of MATERIALS) if (rd.carrying[m]) addStock(stolen, m, rd.carrying[m]!);
  }
  // the fallen: an infirmary takes them all in; otherwise the town has to tend them where they lie (see
  // people.ts), and not everyone makes it. Then some fallen raiders are taken alive.
  // (a Healer's Hut only slows the bleeding; it takes a real infirmary to bring everyone in)
  const infirmary = s.buildings.some((b) => b.status === 'done' && (BUILDING_BY_ID[b.def]?.healing ?? 1) >= 2);
  const bleeding = s.people.filter((p) => p.downed?.bleedUntil != null && p.away === null);
  if (infirmary) bleeding.forEach(stabilize);
  else if (bleeding.length) notify(s, `${bleeding.map((p) => p.name).join(', ')} ${bleeding.length === 1 ? 'is' : 'are'} bleeding out! Someone must tend them (Medicine helps; a bandage or poultice always works).`, true);
  const prisoners = takePrisoners(s, enemies, rng);
  const took = MATERIALS.filter((m) => stolen[m]).map((m) => `${stolen[m]} ${m}`);
  const outcome =
    killed && killed === foes.length
      ? killed === 1
        ? 'The raider was killed.'
        : `All ${killed} were killed.`
      : killed
        ? `${killed} killed, the rest fled.`
        : took.length
          ? 'They got away.'
          : 'They were driven off.';
  notify(s, `Raid by the ${theName(kind.name)} is over. ${outcome}${took.length ? ` They took ${took.join(', ')}.` : ''}`, true);
  // the recap card (sim/raidRecap.ts)
  const boss = r.raiders.find((rd) => !rd.ally && ENEMIES[rd.kind]?.boss);
  s.raidRecap = raidRecap(s, r, kind.name, {
    outcome: took.length ? 'pillaged' : killed === foes.length ? 'victory' : 'driven',
    boss: boss ? ENEMIES[boss.kind].name : null,
    bossDown: !!boss?.down,
    fromSea: !!kind.fromSea,
    killed,
    came: foes.length,
    prisoners,
    stolen,
    spoils,
  });
  tallyRaid(s, s.raidRecap.outcome); // (the year's chronicle: sim/annals.ts)
  if (killed && !took.length) victoryFeast(s); // (driven off with nothing: the town feasts it, sim/ceremonies.ts)
}

/** Raiders come as seasoned as the town: its grown-ups' average level makes them tougher and harder hitting. */
export function seasonedMight(s: GameState): number {
  const adults = s.people.filter((p) => p.type !== 'child');
  if (!adults.length) return 1;
  const avg = adults.reduce((t, p) => t + levelOf(p), 0) / adults.length;
  return Math.min(RAID_SEASONED_MAX, 1 + (avg - 1) * RAID_MIGHT_PER_LEVEL);
}
