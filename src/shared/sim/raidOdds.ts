// The odds weighed, mercy or slaughter (the owner's ask: "the order that hunts the undead attacks towns with a group of
// 4 against the 20 townsfolk and get wiped"). A band of people that arrives to find the town far stronger than itself
// (its might under `ODDS_TURN` of the town's) doesn't attack: it turns back, and the next comes bigger (`gatherRaid`).
// The town is asked what to do with it, and with any band that breaks and runs: let them go (mercy: their people's
// standing rises, the town's alignment turns good) or hunt them down (slaughter: they are run down for the experience
// and the loot, standing falls, alignment turns evil, and a survivor carries a grudge that brings a bigger raid later).
// With the autopilot and no answer the town follows its leader's nature and what it has done before. Everything here
// runs with the autopilot on, and draws no number from the town's stream (the side stream 'odds').
// Skipping a battle (sim/raidSkip.ts) needs nothing of its own: the raid prompt's "Skip the battle" sets `Raid.skipIt`.

import { BUILDING_BY_ID } from '../data/buildings';
import { MATERIALS, type Material } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import { ENEMIES, natureOf as foeNature } from '../data/enemies';
import { natureOf } from '../data/natures';
import { RAID_KIND_BY_ID, ODDS_ASK_HOURS, GUILD_MERCY, ODDS_FAIR, ODDS_GATHER_CAP, ODDS_GATHER_MAX, ODDS_GATHER_STEP, ODDS_TOWER_HP, ODDS_TURN, ODDS_WALL_RATE, ODDS_WALL_SHARE, MERCY_MIN_RAIDERS, MERCY_STANDING, SLAUGHTER_STANDING, HUNT_CHANCE, HUNT_XP, GRUDGE_BIGGER, GRUDGE_CHANCE, GRUDGE_DAYS, LOOT_VALUE, ODDS_PROBE_CHANCE, ODDS_TOLL_CHANCE, PROBE_CATCH, PROBE_CATCH_GUARD, PROBE_CATCH_TOWER, PROBE_HOUR, PROBE_PARTY, PROBE_TAKE, TOLL_AFFORD, TOLL_COINS_SHARE, TOLL_FOOD_SHARE, TOLL_MIN_COINS, TOLL_MIN_FOOD } from '../data/raids';
import { Rng, hashSeed } from '../rng';
import { factionOf, hostOver, standWith } from './factions';
import { alignPush } from './alignment';
import { personFighter } from './combat';
import { addStock, dist, maxHp, notify, type GameState, type Raid, type Raider } from './state';
import { credit, raidRecap } from './raidRecap';
import { raidSkipOver } from './raidSkip';
import { tallyRaid } from './annals';
import { watchMeetsProbe } from './nightWatch';
import { gainSkill } from './townsfolk';
import { storages } from './buildings';
import { flammable, setFire } from './fire';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR, TICK_HZ } from './time';

/** The side stream for this system: nothing here draws from the town's own. */
const sideRng = (s: GameState, salt: string | number) => new Rng(hashSeed(`${s.seed}:odds:${s.tick}:${salt}`));
const bookOf = (s: GameState) => (s.raidOdds ??= {});
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ------------------------------------------------------------ the weighing */

/** A fighter's worth: the square root of health times damage a second (so a fighter twice as tough, or twice as
 *  deadly, is about 1.4 as much). */
const worth = (hp: number, dps: number) => Math.sqrt(Math.max(0, hp) * Math.max(0, dps));

/** One raider's worth, with its might (health and blows) counted. */
function raiderWorth(rd: Raider): number {
  const d = ENEMIES[rd.kind];
  if (!d) return 0;
  const might = rd.might ?? 1;
  return worth(rd.hp, (((d.damage[0] + d.damage[1]) / 2) * d.accuracy * might) / d.interval);
}

/** What the raid's attackers are worth together (the town's own allies among them don't count). */
export const raidPower = (r: Raid) => r.raiders.filter((rd) => !rd.ally && !rd.down && !rd.gone).reduce((t, rd) => t + raiderWorth(rd), 0);

/** The town's fighters, walls, engines and allies, in the same measure. Walls and engines each add at most
 *  `ODDS_WALL_SHARE` of the fighters' worth: they help, but nobody wins by them alone. */
export function townPower(s: GameState, r?: Raid): number {
  let fighters = 0;
  for (const p of s.people) {
    if (p.type === 'child' || p.downed || p.away !== null) continue;
    const f = personFighter(p, 'fighter', 'front', 1);
    fighters += worth(maxHp(p), (((f.damage[0] + f.damage[1]) / 2) * f.accuracy) / (Math.max(1, f.interval) / TICK_HZ));
  }
  let walls = 0;
  let engines = 0;
  for (const b of s.buildings) {
    if (b.status !== 'done') continue;
    const d = BUILDING_BY_ID[b.def];
    if (!d) continue;
    if (d.defense) engines += worth(ODDS_TOWER_HP, (((d.defense.damage[0] + d.defense.damage[1]) / 2) * d.defense.accuracy * (1 + (d.defense.splash ? 0.3 : 0) + (d.defense.chain ? 0.3 : 0))) / d.defense.interval);
    else if (d.hp && /wall|gate|grate/.test(d.id)) walls += Math.sqrt(d.hp) * ODDS_WALL_RATE;
  }
  const allies = (r?.raiders ?? []).filter((rd) => rd.ally && !rd.down && !rd.gone).reduce((t, rd) => t + raiderWorth(rd), 0);
  return fighters + Math.min(walls, fighters * ODDS_WALL_SHARE) + Math.min(engines, fighters * ODDS_WALL_SHARE) + allies;
}

/** The raid's might against the town's (under 1: the town is the stronger). */
export const oddsOf = (s: GameState, r: Raid) => raidPower(r) / Math.max(1, townPower(s, r));

/** Bands that weigh the odds: people (and the dead and machines a rival people drive), not wild beasts or the Great
 *  Enemy's own. */
function weighs(r: Raid): boolean {
  if (r.enemy || r.saga || r.calamity) return false;
  const foes = r.raiders.filter((rd) => !rd.ally);
  if (!foes.length) return false;
  const kind = RAID_KIND_BY_ID[r.kind];
  return !!r.host || !!kind?.origin || foes.filter((rd) => foeNature(rd.kind) === 'person').length * 2 >= foes.length;
}

/** The next band comes bigger for each one that turned back: tougher, and more of them. */
export const gatherOf = (s: GameState) => 1 + ODDS_GATHER_STEP * (s.raidOdds?.extra ?? 0);

/** Make a raid just started as big as the bands before it that turned back would have made it (raids.ts, the hosts, the
 *  pirates). `count` false: tougher only (a host comes as many as were mustered). */
export function gatherRaid(s: GameState, r: Raid, count = true): void {
  const g = gatherOf(s);
  if (g <= 1 || s.autopilot === false || !weighs(r)) return;
  const foes = r.raiders.filter((rd) => !rd.ally && !ENEMIES[rd.kind]?.kit);
  for (const rd of r.raiders)
    if (!rd.ally) {
      rd.might = (rd.might ?? 1) * g;
      rd.hp = rd.maxHp = Math.round(rd.maxHp * g);
    }
  if (!count || !foes.length) return;
  const more = Math.round(foes.length * (g - 1));
  for (let i = 0; i < more; i++) {
    const m = foes[i % foes.length];
    r.raiders.push({ ...m, id: s.nextId++, x: m.x + r.side * 14 * (1 + Math.floor(i / foes.length)), carrying: {} });
  }
}

/* ------------------------------------------------------------ the questions */

/** What the town does without being told: mercy or the hunt (0 or 1), by its leader's nature and what it has done. */
function lean(s: GameState): 0 | 1 {
  const leader = s.people.find((p) => p.id === s.mainId);
  const gentle = ['kind', 'cheerful', 'jolly', 'pious', 'dreamy', 'shy'];
  const hard = ['stern', 'grumpy', 'bold', 'proud', 'greedy', 'gloomy'];
  const n = leader ? natureOf(leader).id : 'curious';
  const b = bookOf(s);
  const score = (gentle.includes(n) ? 1 : hard.includes(n) ? -1 : 0) + ((b.spared ?? 0) - (b.hunted ?? 0)) * 0.5 + (b.align ?? 0) * 0.1;
  return score >= 0 ? 0 : 1;
}

function ask(s: GameState, title: string, text: string): number {
  const prompt = { id: s.nextId++, kind: 'raid' as const, expedition: null, title, text, options: ['Let them go', 'Hunt them down'], defaultOption: lean(s), expiresTick: s.tick + ODDS_ASK_HOURS * TICKS_PER_HOUR };
  s.prompts.push(prompt);
  return prompt.id;
}

const named = (r: Raid) => {
  const n = RAID_KIND_BY_ID[r.kind]?.name ?? 'raiders';
  return /^the /i.test(n) ? n : `the ${n.toLowerCase()}`;
};

/** What an outmatched band does besides turning back, by its kind and leader (a side-stream roll): 'toll' demands a share
 *  of the town's coin or food to leave it be, 'probe' sends a few in at night to steal or burn one thing. Never a host
 *  (an army), the Guild's hunters, or a band that is not of people. */
export function outmatchedPlan(s: GameState, r: Raid): 'turn' | 'toll' | 'probe' {
  const kind = RAID_KIND_BY_ID[r.kind];
  if (!kind || r.host || r.kind === 'hunters') return 'turn';
  const raids = !!kind.goals && ('steal' in kind.goals || 'burn' in kind.goals) || kind.goal === 'steal' || kind.goal === 'burn';
  const toll = ODDS_TOLL_CHANCE * (kind.bribable ? 2 : 0.5) * (kind.leader ? 1.5 : 1);
  const probe = ODDS_PROBE_CHANCE * (raids ? 2 : 0.4) * (kind.leader ? 0.7 : 1);
  const u = sideRng(s, 'plan').next();
  return u < toll ? 'toll' : u < toll + probe ? 'probe' : 'turn';
}

const foodHeld = (s: GameState) => storages(s).reduce((n, b) => n + (Object.keys(FOOD_VALUE) as Material[]).reduce((k, m) => k + (b.store[m] ?? 0), 0), 0);

/** The toll a band would ask: coins from a purse that can bear it, else food, else none. */
function tollFor(s: GameState): { coins: number; food: number } | null {
  const coins = s.coins ?? 0;
  if (coins >= TOLL_MIN_COINS * 2) return { coins: Math.max(TOLL_MIN_COINS, Math.round(coins * TOLL_COINS_SHARE)), food: 0 };
  const food = foodHeld(s);
  const ask = Math.max(TOLL_MIN_FOOD, Math.round(food * TOLL_FOOD_SHARE));
  return food >= ask * 2 ? { coins: 0, food: ask } : null;
}

const tollWords = (t: { coins: number; food: number }) => (t.coins ? `${t.coins} coins` : `${t.food} measures of food`);

/** The band demands a toll at the edge of the town: a question, whose default follows the leader's nature and the
 *  treasury (as the mercy question's does). False if the town has nothing to ask for. */
function askToll(s: GameState, r: Raid): boolean {
  const toll = tollFor(s);
  if (!toll) return false;
  r.toll = toll;
  const purse = toll.coins ? (s.coins ?? 0) : foodHeld(s);
  const worth = toll.coins || toll.food;
  const pay = lean(s) === 0 && purse >= worth * TOLL_AFFORD ? 0 : 1;
  const prompt = { id: s.nextId++, kind: 'raid' as const, expedition: null, title: `${cap(named(r))} demand a toll`, text: `${cap(named(r))} see the walls and those behind them, and will not fight. They will leave the town alone, they say, for ${tollWords(toll)}. Pay the toll, or refuse it?`, options: ['Pay the toll', 'Refuse the toll'], defaultOption: pay, expiresTick: s.tick + ODDS_ASK_HOURS * TICKS_PER_HOUR };
  s.prompts.push(prompt);
  r.parley = prompt.id;
  notify(s, `${cap(named(r))} hold at the edge of the town and demand ${tollWords(toll)} to leave it be.`, true);
  return true;
}

/** The toll is paid: they take it and go, and the next band is no bigger for it. */
function payToll(s: GameState, r: Raid): void {
  const toll = r.toll!;
  if (toll.coins) s.coins = Math.max(0, (s.coins ?? 0) - toll.coins);
  else {
    let left = toll.food;
    for (const b of storages(s))
      for (const m of Object.keys(FOOD_VALUE) as Material[]) {
        const n = Math.min(left, b.store[m] ?? 0);
        if (n > 0) {
          addStock(b.store, m, -n);
          left -= n;
        }
      }
  }
  const b = bookOf(s);
  b.tolls = (b.tolls ?? 0) + 1;
  b.extra = b.streak = 0;
  s.raid = null;
  raidSkipOver(s);
  r.turned = true;
  const foes = r.raiders.filter((rd) => !rd.ally);
  const recap = raidRecap(s, r, RAID_KIND_BY_ID[r.kind]?.name ?? 'Raiders', { outcome: 'driven', boss: null, killed: 0, came: foes.length, prisoners: 0, stolen: {}, spoils: {} });
  recap.mercy = 'toll';
  recap.story = [`${cap(named(r))} demanded a toll of ${tollWords(toll)} to leave the town alone.`, 'You paid it, and they went.'];
  s.raidRecap = recap;
  notify(s, `You paid ${cap(named(r))} ${tollWords(toll)}, and they went.`, true);
  tallyRaid(s, 'driven');
}

/** The raid has reached the edge of the town (raids.ts): 'go' on in, or 'wait' for the town's answer (the raiders hold
 *  at the edge). Run every tick from when the warning is up until it says 'go'. */
export function weighArrival(s: GameState, r: Raid): 'go' | 'wait' {
  if (r.weighed) return 'go';
  if (r.parley !== undefined) return 'wait';
  if (s.autopilot === false || !weighs(r)) return 'go'; // (beasts and the rest come as they are)
  if ((s.raidOdds?.streak ?? 0) >= ODDS_GATHER_MAX || oddsOf(s, r) >= ODDS_TURN) {
    if (s.raidOdds) s.raidOdds.extra = s.raidOdds.streak = 0;
    return 'go';
  }
  // outmatched: by its kind and leader the band may demand a toll or look for a weak spot instead of only turning back
  const plan = outmatchedPlan(s, r);
  if (plan === 'toll' && askToll(s, r)) return 'wait';
  if (plan === 'probe') {
    turnBack(s, r, 'probe');
    return 'wait';
  }
  // outmatched: they hold at the edge, and the town says what becomes of them
  r.parley = ask(s, `${cap(named(r))} falters`, `${cap(named(r))} see the walls and those behind them, and know they are outmatched. They are turning back. Let them go, or hunt them down?`);
  notify(s, `${cap(named(r))} have seen what stands against them and are turning back.`, true);
  return 'wait';
}

/** The town has the better of the raid and its raiders have broken: ask what to do with those running. Every tick of an
 *  active raid, once the battle on the trail (if any) is over. */
export function askMercy(s: GameState, r: Raid, battling: boolean): void {
  if (battling || r.mercy || r.mercyAsk !== undefined || r.parley !== undefined || s.autopilot === false || r.phase !== 'active' || !weighs(r)) return;
  const foes = r.raiders.filter((rd) => !rd.ally);
  const alive = foes.filter((rd) => !rd.down && !rd.gone);
  if (foes.length < MERCY_MIN_RAIDERS || !alive.length || !alive.every((rd) => rd.fleeing) || !foes.some((rd) => rd.down)) return;
  r.mercyAsk = ask(s, 'They break!', `${cap(named(r))} have broken and are running, ${alive.length} of ${foes.length}. Let them go, or hunt them down?`);
}

/** Fleeing raiders wait, cornered, while the town decides. */
export const heldForMercy = (r: Raid) => r.mercyAsk !== undefined && !r.mercy;

/** The town's answer ("Let them go" / "Hunt them down"). True if the label was one of these. */
export function answerOdds(s: GameState, label: string): boolean {
  const r = s.raid;
  if (r?.toll && r.parley !== undefined && (label === 'Pay the toll' || label === 'Refuse the toll')) {
    r.parley = undefined;
    const t = r.toll;
    r.toll = undefined;
    const paid = label === 'Pay the toll' && (t.coins ? (s.coins ?? 0) >= t.coins : foodHeld(s) >= t.food);
    if (paid) {
      r.toll = t;
      payToll(s, r);
    } else {
      notify(s, `You refuse ${named(r)}'s toll.`, true);
      turnBack(s, r);
    }
    return true;
  }
  if (!r || (label !== 'Let them go' && label !== 'Hunt them down')) return false;
  const arrival = r.parley !== undefined;
  if (!arrival && r.mercyAsk === undefined) return false;
  const b = bookOf(s);
  r.parley = undefined;
  if (label === 'Let them go') {
    r.mercy = 'spared';
    b.spared = (b.spared ?? 0) + 1;
    standWith(s, r, MERCY_STANDING);
    if (r.kind === 'hunters') s.guild = Math.max(0, (s.guild ?? 0) - GUILD_MERCY);
    alignHook(s, 'good', 1);
    if (arrival) turnBack(s, r);
    else notify(s, 'You let the survivors go.', true);
  } else {
    r.mercy = 'hunted';
    b.hunted = (b.hunted ?? 0) + 1;
    standWith(s, r, SLAUGHTER_STANDING);
    if (r.kind === 'hunters') s.guild = Math.min(100, (s.guild ?? 0) + GUILD_MERCY);
    alignHook(s, 'evil', 1);
    if (arrival) {
      // (they are not let go: they fight, and run down when they break)
      r.weighed = true;
      b.extra = b.streak = 0;
      notify(s, `${cap(named(r))} are cut off, and will have to fight.`, true);
    } else notify(s, 'The town runs the survivors down!', true);
  }
  return true;
}

/** The good or evil of a choice: the town's alignment bar moves (sim/alignment.ts, `ODDS_ALIGN` a choice), and the book
 *  keeps its own tally, which steers the default answer when nobody picks. */
function alignHook(s: GameState, side: 'good' | 'evil', n: number): void {
  const b = bookOf(s);
  b.align = (b.align ?? 0) + (side === 'good' ? n : -n);
  alignPush(s, (side === 'good' ? n : -n) * ODDS_ALIGN, side === 'good' ? 'Raiders let go' : 'Raiders hunted down');
}

/** How far the alignment bar moves for sparing or hunting a beaten band. */
const ODDS_ALIGN = 3;

/** The raiders turn about and go home: the raid ends with a recap saying so, and the next comes bigger. */
function turnBack(s: GameState, r: Raid, how: 'turn' | 'probe' = 'turn'): void {
  // (they gather until they would make a fair fight: the next comes that much bigger and tougher)
  const b = bookOf(s);
  const total = Math.min(ODDS_GATHER_CAP, gatherOf(s) * Math.sqrt(ODDS_FAIR / Math.max(0.05, oddsOf(s, r))));
  b.extra = Math.max(b.extra ?? 0, (total - 1) / ODDS_GATHER_STEP);
  b.streak = (b.streak ?? 0) + 1;
  s.raid = null;
  raidSkipOver(s);
  r.turned = true;
  if (r.kind === 'hunters') s.guildTarget = null; // (the Guild comes again, with more)
  b.turned = (b.turned ?? 0) + 1;
  const foes = r.raiders.filter((rd) => !rd.ally);
  const recap = raidRecap(s, r, RAID_KIND_BY_ID[r.kind]?.name ?? 'Raiders', { outcome: 'driven', boss: null, killed: 0, came: foes.length, prisoners: 0, stolen: {}, spoils: {} });
  recap.mercy = how === 'probe' ? 'probe' : 'turned';
  recap.story = [`${cap(named(r))} turned back at the sight of your walls.`, how === 'probe' ? 'A few hung back in the dark, looking for a weak spot.' : 'You let them go.'];
  s.raidRecap = recap;
  notify(s, `${cap(named(r))} turned back at the sight of your walls. They will be back, and more of them.`, true);
  if (how === 'probe') planProbe(s, r);
  if (r.host) hostOver(s, r);
  tallyRaid(s, 'driven');
}

/* ------------------------------------------------------------ the hunt */

/** A fleeing raider is run down, if the town has said to hunt them. True if it was this tick. */
export function huntDown(s: GameState, r: Raid, rd: Raider): boolean {
  if (r.mercy !== 'hunted' || rd.down || rd.gone || rd.ally) return false;
  if (sideRng(s, rd.id).next() >= HUNT_CHANCE) return false;
  const hunter = s.people.filter((p) => p.type !== 'child' && !p.downed && p.away === null).sort((a, b) => dist(a, rd) - dist(b, rd) || a.id - b.id)[0];
  if (!hunter) return false;
  const was: [Raider, number, boolean][] = [[rd, rd.hp, rd.down]];
  rd.hp = 0;
  rd.down = true;
  rd.runDown = true;
  rd.lastHit = s.tick;
  credit(s, hunter.id, was);
  hunter.lastBlow = s.tick;
  gainSkill(hunter, 'melee', HUNT_XP);
  return true;
}

/** The raid is over (raids.ts endRaid): what the town chose is told in its recap, and a hunted band's survivors may
 *  carry a grudge. */
export function oddsOver(s: GameState, r: Raid): void {
  const recap = s.raidRecap;
  if (!r.mercy || !recap) return;
  recap.mercy = r.mercy;
  recap.story.push(r.mercy === 'spared' ? 'You let the survivors go.' : 'You hunted them down.');
  if (r.mercy !== 'hunted') return;
  const fled = r.raiders.some((rd) => !rd.ally && rd.gone && !rd.down);
  const rng = sideRng(s, 'grudge');
  if (r.host) {
    // (a war host: the power itself bears the grudge, and its next host comes bigger)
    const f = factionOf(s, r.host);
    if (f && (fled || rng.chance(GRUDGE_CHANCE))) {
      f.grudge = true;
      recap.story.push('One got away, and will remember: the next host will come bigger.');
    }
    return;
  }
  if (fled || rng.chance(GRUDGE_CHANCE)) {
    bookOf(s).grudge = { kind: r.kind, at: s.tick + rng.int(GRUDGE_DAYS[0], GRUDGE_DAYS[1]) * TICKS_PER_DAY };
    recap.story.push('One got away, and will remember.');
  }
}

/** A grudge ripe to be settled: the kind of the next raid, which comes bigger (raids.ts maybeStartRaid). */
export function ripeGrudge(s: GameState): string | null {
  const g = s.raidOdds?.grudge;
  if (!g || s.tick < g.at || !RAID_KIND_BY_ID[g.kind]) return null;
  const b = bookOf(s);
  b.grudge = undefined;
  b.extra = (b.extra ?? 0) + (GRUDGE_BIGGER - 1) / ODDS_GATHER_STEP;
  notify(s, 'A survivor of the band you hunted has come back, and not alone!', true);
  return g.kind;
}

/* ------------------------------------------------------------ the probe */

/** A few of the band stay behind to slip in at the next 2 in the morning: a goal of theirs (burn if their kind burns, else
 *  steal), and how many. Resolved by `oddsHourly`. */
function planProbe(s: GameState, r: Raid): void {
  const kind = RAID_KIND_BY_ID[r.kind];
  const rng = sideRng(s, 'probe-plan');
  const burns = kind.goal === 'burn' || (!!kind.goals && 'burn' in kind.goals && (!('steal' in kind.goals) || (kind.goals.burn ?? 0) >= (kind.goals.steal ?? 0)));
  let at = s.tick - (s.tick % TICKS_PER_HOUR) + TICKS_PER_HOUR;
  while (calendar(at - (s.fightTicks ?? 0)).hour !== PROBE_HOUR) at += TICKS_PER_HOUR;
  const b = bookOf(s);
  b.probes = (b.probes ?? 0) + 1;
  b.probe = { kind: r.kind, at, goal: burns ? 'burn' : 'steal', n: rng.int(PROBE_PARTY[0], PROBE_PARTY[1]) };
}

/** Each hour: a probe waiting for its night goes in. The watch (guards and watchtowers) may catch it; if not it steals the
 *  best of the stores, or sets one fire, and goes. Autopilot only. */
export function oddsHourly(s: GameState): void {
  const probe = s.raidOdds?.probe;
  if (!probe || s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0 || s.tick < probe.at || s.raid) return;
  const b = bookOf(s);
  b.probe = undefined;
  // (a watchman at the way in may spot them, and they meet the watch there: sim/nightWatch.ts)
  if (watchMeetsProbe(s, probe.kind, probe.n)) return;
  const who = (RAID_KIND_BY_ID[probe.kind]?.name ?? 'raiders').toLowerCase();
  const guards = s.people.filter((p) => p.guard && !p.downed && p.away === null).length;
  const towers = s.buildings.filter((q) => q.status === 'done' && (q.def === 'watchtower' || q.def === 'lookout')).length;
  const catchP = Math.min(0.85, Math.max(0.15, PROBE_CATCH + PROBE_CATCH_GUARD * guards + PROBE_CATCH_TOWER * towers));
  const rng = sideRng(s, 'probe');
  if (rng.next() < catchP) {
    b.caught = (b.caught ?? 0) + 1;
    notify(s, `In the night the watch caught ${probe.n} of the ${who} creeping in, and drove them off with nothing.`, true);
    return;
  }
  if (probe.goal === 'burn') {
    const target = s.buildings.filter((q) => q.status === 'done' && q.fire === undefined && !BUILDING_BY_ID[q.def]?.hp && flammable(q)).sort((x, y) => x.id - y.id)[0];
    if (target && setFire(s, target)) {
      notify(s, `A few of the ${who} slipped in by night and set the ${BUILDING_BY_ID[target.def].name.toLowerCase()} alight, then were gone.`, true);
      return;
    }
  }
  // (stealing: the best thing in the stores, as much as they can carry)
  const worth = (m: Material) => LOOT_VALUE[m] ?? 1;
  let best: Material | null = null;
  let held = 0;
  for (const m of MATERIALS) {
    const n = storages(s).reduce((k, st) => k + (st.store[m] ?? 0), 0);
    if (n > 0 && (!best || worth(m) > worth(best))) {
      best = m;
      held = n;
    }
  }
  if (!best) {
    notify(s, `A few of the ${who} slipped in by night, found nothing worth taking, and were gone.`, true);
    return;
  }
  let take = Math.min(held, PROBE_TAKE * probe.n);
  const got = take;
  for (const st of storages(s)) {
    const n = Math.min(take, st.store[best] ?? 0);
    if (n > 0) {
      addStock(st.store, best, -n);
      take -= n;
    }
  }
  notify(s, `A few of the ${who} slipped in by night and made off with ${got} ${best.replace(/_/g, ' ')}.`, true);
}
