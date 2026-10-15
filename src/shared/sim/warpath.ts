// The orcs' warpath (the Orc Warband's own way; numbers in data/warpath.ts). In an orc town (`s.horde`): the horde's
// fury rises each morning, faster the longer it goes without a fight, and boils over into brawls; it is spent on war.
// When it runs high the warchief calls a war raid (`callRaid`, a `ways` question: a power of the realm, the roads, or
// hold back), and the war party goes out (`Person.away` = `RAID_AWAY`) and comes home (`raidHome`) with plunder,
// captives put to work as thralls (`thralls`), glory and names for the bloodiest (`glory`), or with its dead. At full
// fury the Waaagh! is called (`waaagh`). The Great Waaagh, every power sacked, wins the game. Only in an orc town, with
// the autopilot on; the rolls are the seed's own.

import { FACTION_BY_ID } from '../data/factions';
import { RAID_KIND_BY_ID } from '../data/raids';
import {
  ASK_HOURS,
  BRAWL_AT,
  BRAWL_CHANCE,
  BRAWL_HURT,
  CALL_AT,
  CAPTIVES,
  FURY_DAILY,
  FURY_DEFENDED,
  FURY_IDLE,
  FURY_NAMES,
  FURY_SPENT,
  FURY_START,
  FURY_WON,
  GLORY_NAMES,
  GLORY_PER_FELL,
  GLORY_RAID_LOST,
  GLORY_RAID_WON,
  GOODS_PER_RAIDER,
  HORDE_HOUR,
  ODDS_BASE,
  ODDS_LEAST,
  ODDS_MOST,
  ODDS_PER_MIGHT,
  PLUNDER_PER_RAIDER,
  RAID_GAP_DAYS,
  RAID_HOURS,
  RAID_HURT,
  RAID_KILLS_LOST,
  RAID_KILLS_WON,
  RAID_LEAST,
  RAID_MOST,
  RAID_PEOPLE,
  RAID_SHARE,
  RAIDED_GOODWILL,
  RESTLESS_DAYS,
  RESTLESS_MORALE,
  ROAD_DAYS,
  ROAD_ODDS,
  ROAD_TRAVELLERS,
  THRALL_WORK,
  TROOPS_LOST,
  WAAAGH_AFTER,
  WAAAGH_BONUS,
  WAAAGH_BUILD,
  WAAAGH_DAYS,
  WAAAGH_FIGHT,
  WAAAGH_MOST,
  WAR_AT,
  WIN_WAAAGHS,
} from '../data/warpath';
import type { Material } from '../data/materials';
import { levelOf } from '../data/levels';
import { hashSeed, Rng } from '../rng';
import { depositNear } from './buildings';
import { giveCoins } from './economy';
import { declareWar, realm } from './factions';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { adjust, isChild } from './social';
import { campXY, earn, maxHp, notify, type Faction, type GameState, type Person, type Prompt } from './state';
import { askWays, tellStory } from './telling';
import { queueScene } from './cutscenes';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';

/** Where the war party is while it's out (`Person.away`). */
export const RAID_AWAY = -4_000_101;

export interface WarParty {
  ids: number[];
  /** A power's id, or 'roads'. */
  target: string;
  until: number;
  waaagh: boolean;
}

export interface HordeState {
  fury: number;
  /** The last fight the horde had (a raid at home, a war raid): restlessness counts from it. */
  lastFight: number;
  lastRaid: number;
  glory: Record<number, number>;
  /** Raiders each had felled when last counted (glory comes from the ones since). */
  felled: Record<number, number>;
  out?: WarParty;
  raids: number;
  won: number;
  /** The powers sacked (a war raid won on them). */
  sacked: string[];
  waaagh?: { until: number };
  waaaghs: number;
  /** The last raid recap counted (a raid on the town beaten feeds the fury). */
  recap?: number;
  log: string[];
}

export const hordeTown = (s: GameState) => s.origin === 'orcs';

export function hordeOf(s: GameState): HordeState | null {
  if (!hordeTown(s)) return null;
  return (s.horde ??= { fury: FURY_START, lastFight: s.tick, lastRaid: s.tick, glory: {}, felled: {}, raids: 0, won: 0, sacked: [], waaaghs: 0, log: [] });
}

const clampFury = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:horde:${s.tick}:${salt}`));
export const furyName = (f: number) => FURY_NAMES.find(([at]) => f >= at)?.[1] ?? 'Sated';
const home = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed && !isChild(p));
/** The fit to raid, the fiercest first. */
const fighters = (s: GameState) => home(s).filter((p) => p.hp >= maxHp(p) * 0.6).sort((a, b) => might(b) - might(a) || a.id - b.id);
/** One orc's might: their level and their arm. */
const might = (p: Person) => levelOf(p) * 2 + p.skills.melee.level;
const nameOf = (f: Faction | undefined) => (f ? FACTION_BY_ID[f.id]?.name ?? f.id : 'the roads');

function log(s: GameState, h: HordeState, text: string): void {
  h.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (h.log.length > 12) h.log.length = 12;
}

/** The powers the horde may raid: known, standing, and not its ally or vassal. */
export function raidTargets(s: GameState): Faction[] {
  return realm(s).filter((f) => f.known && f.stance !== 'destroyed' && f.stance !== 'alliance' && f.stance !== 'vassal');
}

/** Hourly from sim.ts. */
export function hordeHourly(s: GameState): void {
  if (s.autopilot === false || s.gameOver || s.tick % TICKS_PER_HOUR !== 0) return;
  const h = hordeOf(s);
  if (!h) return;
  countGlory(s, h);
  defended(s, h);
  if (h.out && s.tick >= h.out.until) raidHome(s, h);
  if (h.waaagh && s.tick >= h.waaagh.until) {
    h.waaagh = undefined;
    h.fury = clampFury(Math.min(h.fury, WAAAGH_AFTER));
    log(s, h, 'The Waaagh! blew itself out. The horde sleeps it off.');
    notify(s, 'The Waaagh! is over. The horde is sated, for now.', true);
  }
  if (calendar(s.tick).hour !== HORDE_HOUR) return;
  morning(s, h);
}

/** The morning: fury rises, the bored brawl, the thralls work, a raid is called, the Waaagh! comes. */
function morning(s: GameState, h: HordeState): void {
  const rng = roll(s, 'morning');
  const idle = s.tick - h.lastFight >= RESTLESS_DAYS * TICKS_PER_DAY;
  if (!h.out && !h.waaagh) h.fury = clampFury(h.fury + FURY_DAILY + (idle ? FURY_IDLE : 0));
  thralls(s, h);
  if (h.fury >= BRAWL_AT && !h.waaagh) brawl(s, h, rng);
  if (h.fury >= 100 && !h.waaagh && !h.out) {
    waaagh(s, h);
    return;
  }
  const asked = s.prompts.some((q) => q.ways?.system === 'horde');
  if (!h.out && !asked && h.fury >= CALL_AT && s.tick - h.lastRaid >= RAID_GAP_DAYS * TICKS_PER_DAY && home(s).length >= RAID_PEOPLE) callRaid(s, h);
  checkWin(s, h);
}

/* ------------------------------------------------------------ glory */

/** Glory for every raider felled since the last count, and the names it brings. */
function countGlory(s: GameState, h: HordeState): void {
  for (const p of s.people) {
    const now = p.felled ?? 0;
    const before = h.felled[p.id] ?? now;
    h.felled[p.id] = now;
    if (now > before) addGlory(s, h, p, (now - before) * GLORY_PER_FELL);
  }
}

export function addGlory(s: GameState, h: HordeState, p: Person, n: number): void {
  const was = h.glory[p.id] ?? 0;
  const now = was + n;
  h.glory[p.id] = now;
  for (const [at, names] of GLORY_NAMES) {
    if (was >= at || now < at) continue;
    const name = names[p.id % names.length];
    (p.titles ??= []).push(name);
    log(s, h, `${p.name} has earned a name: ${p.name} ${name}.`);
    notify(s, `${p.name} has earned a name in blood: ${p.name} ${name}!`, true);
  }
}

/** A raid on the town beaten feeds the fury, and counts as a fight. */
function defended(s: GameState, h: HordeState): void {
  const r = s.raidRecap;
  if (!r || r.tick === h.recap) return;
  h.recap = r.tick;
  h.lastFight = s.tick;
  if (r.outcome !== 'pillaged') h.fury = clampFury(h.fury + FURY_DEFENDED);
}

/* ------------------------------------------------------------ the bored horde */

function brawl(s: GameState, h: HordeState, rng: Rng): void {
  (s.marks ??= []).push({ lever: 'morale', value: RESTLESS_MORALE, until: s.tick + TICKS_PER_DAY, text: 'The horde is restless' });
  const pool = home(s).filter((p) => p.hp > maxHp(p) * 0.5);
  if (pool.length < 2 || !rng.chance(BRAWL_CHANCE)) return;
  const a = rng.pick(pool);
  const b = rng.pick(pool.filter((p) => p !== a));
  const loser = might(a) + rng.int(0, 6) >= might(b) + rng.int(0, 6) ? b : a;
  const winner = loser === a ? b : a;
  minorWound(s, loser, Math.round(maxHp(loser) * BRAWL_HURT), rng);
  adjust(s, a.id, b.id, -12);
  addGlory(s, h, winner, 1);
  log(s, h, `${winner.name} and ${loser.name} came to blows over nothing; ${loser.name} got the worst of it.`);
  notify(s, `The horde is restless: ${winner.name} knocked ${loser.name} down in a brawl. They need a war.`, true);
}

/* ------------------------------------------------------------ thralls */

/** Every prisoner of the horde is a thrall: each morning, wood and stone into the stores. */
function thralls(s: GameState, h: HordeState): void {
  const n = s.prisoners.length;
  if (!n) return;
  const got: Partial<Record<Material, number>> = {};
  for (const [m, k] of Object.entries(THRALL_WORK) as [Material, number][]) got[m] = k * n;
  depositNear(s, campXY(s), got);
  if (calendar(s.tick).day % 3 === 0) log(s, h, `The ${n === 1 ? 'thrall' : `${n} thralls`} hauled ${Object.entries(got).map(([m, k]) => `${k} ${m}`).join(' and ')}.`);
}

/* ------------------------------------------------------------ war raids */

/** The war party's size: a share of the fit, never the warchief unless the horde is small. */
function partyFor(s: GameState, most: number): Person[] {
  const fit = fighters(s);
  const pick = fit.filter((p) => p.id !== s.mainId || fit.length <= RAID_LEAST + 1);
  const n = Math.max(RAID_LEAST, Math.min(most, Math.round(home(s).length * RAID_SHARE)));
  return pick.slice(0, Math.min(n, Math.max(0, home(s).length - 1)));
}

/** The power the warchief points at: the weakest standing one not sacked yet, else the weakest. */
export function bestTarget(s: GameState, h: HordeState): Faction | undefined {
  const all = raidTargets(s).sort((a, b) => a.troops - b.troops || a.id.localeCompare(b.id));
  return all.find((f) => !h.sacked.includes(f.id)) ?? all[0];
}

export function callRaid(s: GameState, h: HordeState): Prompt | null {
  const party = partyFor(s, RAID_MOST);
  if (party.length < RAID_LEAST) return null;
  const f = bestTarget(s, h);
  const names = party.map((p) => p.name).join(', ');
  const story = `The war drums are beating before dawn. ${names} stand at the gate in their war paint, and the whole camp is shouting for blood. ${f ? `The warchief points the axe toward ${nameOf(f)}: their land is close and their walls are weak, they say, and nobody has sacked them yet.` : 'There is no power near enough to raid, but the roads are full of fat merchants.'} Hold the horde back, and the fury will only grow.`;
  const options = f ? [`Raid ${nameOf(f)}`, 'Raid the roads', 'Hold the horde back'] : ['Raid the roads', 'Hold the horde back'];
  return askWays(s, { system: 'horde', about: f ? `raid:${f.id}` : 'raid:roads' }, 'The War Drums', story, 'orc war drums raid camp fire', options, 0, ASK_HOURS);
}

export function answerHorde(s: GameState, prompt: Prompt, option: number): void {
  const h = hordeOf(s);
  const about = prompt.ways?.about ?? '';
  if (!h || !about.startsWith('raid:')) return;
  const target = about.slice(5);
  const opts = target === 'roads' ? ['roads', null] : [target, 'roads', null];
  const pick = opts[option] ?? null;
  if (pick === null) {
    h.fury = clampFury(h.fury + 10);
    for (const p of home(s)) p.sore = { until: s.tick + TICKS_PER_DAY, value: -6, text: 'Held back from the war' };
    log(s, h, 'The warchief held the horde back. It did not like it.');
    notify(s, 'The horde was held back from the war. It grumbles, and its fury grows.', true);
    return;
  }
  sendRaid(s, h, pick, false);
}

/** Send the war party out (or the whole Waaagh!). Returns whether anyone went. */
export function sendRaid(s: GameState, h: HordeState, target: string, waaagh: boolean): boolean {
  const party = partyFor(s, waaagh ? WAAAGH_MOST : RAID_MOST);
  if (party.length < (waaagh ? 1 : RAID_LEAST)) return false;
  for (const p of party) {
    p.away = RAID_AWAY;
    p.task = null;
  }
  h.out = { ids: party.map((p) => p.id), target, until: s.tick + RAID_HOURS * TICKS_PER_HOUR, waaagh };
  h.lastRaid = s.tick;
  h.lastFight = s.tick;
  h.fury = clampFury(h.fury - (waaagh ? 0 : FURY_SPENT));
  h.raids++;
  const f = target === 'roads' ? undefined : realm(s).find((x) => x.id === target);
  log(s, h, `${party.map((p) => p.name).join(', ')} went raiding: ${nameOf(f)}.`);
  notify(s, `The war party marches out for ${nameOf(f)}: ${party.map((p) => p.name).join(', ')}.`, true);
  return true;
}

/** The war party's odds: their might against the power's (or the roads'). */
export function raidOdds(s: GameState, party: Person[], target: string, waaagh: boolean): number {
  const bonus = waaagh ? WAAAGH_BONUS : 0;
  if (target === 'roads') return Math.min(ODDS_MOST, ROAD_ODDS + bonus);
  const f = realm(s).find((x) => x.id === target);
  const theirs = (f?.troops ?? 20) * 1.3;
  const ours = party.reduce((n, p) => n + might(p), 0);
  return Math.max(ODDS_LEAST, Math.min(ODDS_MOST, ODDS_BASE + (ours - theirs) * ODDS_PER_MIGHT + bonus));
}

function raidHome(s: GameState, h: HordeState): void {
  const out = h.out!;
  h.out = undefined;
  const rng = roll(s, 'home');
  const party = out.ids.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p && p.away === RAID_AWAY);
  for (const p of party) p.away = null;
  if (!party.length) return;
  const roads = out.target === 'roads';
  const f = roads ? undefined : realm(s).find((x) => x.id === out.target);
  const won = rng.chance(raidOdds(s, party, out.target, out.waaagh));
  const dead: string[] = [];
  for (const p of party) {
    if (rng.chance(won ? RAID_KILLS_WON : RAID_KILLS_LOST)) {
      dead.push(p.name);
      killPerson(s, p, roads ? 'fell raiding the roads' : `fell raiding ${nameOf(f)}`);
      continue;
    }
    if (rng.chance(RAID_HURT * (won ? 1 : 1.6))) minorWound(s, p, Math.round(maxHp(p) * 0.3), rng);
    addGlory(s, h, p, won ? GLORY_RAID_WON : GLORY_RAID_LOST);
    gainSkill(p, 'melee', won ? 120 : 50);
  }
  const alive = party.filter((p) => !dead.includes(p.name));
  const lines: string[] = [];
  if (won) {
    h.won++;
    h.fury = clampFury(h.fury + FURY_WON);
    const coins = Math.round(PLUNDER_PER_RAIDER * party.length * (roads ? 0.5 : 1));
    // (the plunder: half shared out among the raiders, half to the warchief's hoard)
    const share = Math.floor(coins / 2 / Math.max(1, alive.length));
    for (const p of alive) giveCoins(s, p, share);
    s.coins = (s.coins ?? 0) + coins - share * alive.length;
    earn(s, 'events', coins - share * alive.length);
    lines.push(`They came home loaded: ${coins} coins of plunder`);
    if (f) {
      const goods = (FACTION_BY_ID[f.id]?.goods ?? 'wood') as Material;
      depositNear(s, campXY(s), { [goods]: GOODS_PER_RAIDER * party.length });
      lines.push(`${GOODS_PER_RAIDER * party.length} ${goods}`);
      const n = rng.int(CAPTIVES[0], CAPTIVES[1]);
      const enemy = Object.keys(RAID_KIND_BY_ID[FACTION_BY_ID[f.id]?.raid ?? '']?.enemies ?? { bandit: 1 })[0] ?? 'bandit';
      for (let i = 0; i < n; i++) s.prisoners.push({ id: s.nextId++, enemy, name: `a captive of ${nameOf(f)}`, conviction: 0, since: s.tick, hungry: false });
      lines.push(`and ${n === 1 ? 'a captive' : `${n} captives`} dragged home in chains to work as thralls`);
      f.troops = Math.max(0, f.troops - TROOPS_LOST);
      f.attitude = Math.max(-100, f.attitude + RAIDED_GOODWILL);
      if (!h.sacked.includes(f.id)) h.sacked.push(f.id);
      if (f.attitude <= WAR_AT && f.stance !== 'war') declareWar(s, f, false);
    } else (s.marks ??= []).push({ lever: 'travellers', value: ROAD_TRAVELLERS, until: s.tick + ROAD_DAYS * TICKS_PER_DAY, text: 'Word of the orcs on the roads' });
  } else lines.push(roads ? 'The caravans had guards, and the horde came home with nothing but bruises' : `${nameOf(f)} were waiting for them, and the horde was thrown back`);
  if (dead.length) lines.push(`${dead.join(' and ')} did not come back`);
  const story = `${won ? 'The war party is home, and the camp roars to meet it.' : 'The war party limps home.'} ${lines.join('; ')}. ${won ? 'The fury burns hotter for it.' : 'The horde will want blood for this.'}`;
  log(s, h, `${roads ? 'The roads' : nameOf(f)}: ${won ? 'raided and plundered' : 'the raid was beaten off'}${dead.length ? `; ${dead.length} fell` : ''}.`);
  tellStory(s, won ? `Plunder from ${nameOf(f)}` : `Beaten at ${nameOf(f)}`, story, won ? 'orc raid plunder fire victory' : 'orc defeat wounded retreat', { who: alive[0]?.id });
  checkWin(s, h);
}

/* ------------------------------------------------------------ the Waaagh! */

export function waaagh(s: GameState, h: HordeState): void {
  h.waaagh = { until: s.tick + WAAAGH_DAYS * TICKS_PER_DAY };
  h.waaaghs++;
  const until = h.waaagh.until;
  (s.marks ??= []).push({ lever: 'fight', value: WAAAGH_FIGHT, until, text: 'WAAAGH!' }, { lever: 'build', value: WAAAGH_BUILD, until, text: 'WAAAGH!' }, { lever: 'morale', value: 8, until, text: 'The Waaagh! is called' });
  const f = bestTarget(s, h);
  sendRaid(s, h, f?.id ?? 'roads', true);
  log(s, h, `The Waaagh! was called (the ${h.waaaghs === 1 ? 'first' : `${h.waaaghs}th`}).`);
  const told = tellStory(
    s,
    'WAAAGH!',
    `The fury has boiled over. It starts as one voice at the fire and becomes every voice in the camp: WAAAGH! The drums do not stop all night. For days the horde is something else, a great green tide, and every orc fit to carry an axe marches out ${f ? `on ${nameOf(f)}` : 'onto the roads'}. Those left behind work like three and fight like ten.`,
    'orc war horde drums fire battle',
  );
  // (the first Waaagh! is a cutscene to watch; its telling waits on it: sim/cutscenes.ts)
  if (h.waaaghs === 1) {
    s.prompts = s.prompts.filter((q) => q !== told);
    queueScene(s, 'waaagh', { fallback: told });
  }
}

/* ------------------------------------------------------------ the Great Waaagh */

export function checkWin(s: GameState, h: HordeState): boolean {
  if (s.gameOver || h.waaaghs < WIN_WAAAGHS) return false;
  const all = realm(s);
  if (!all.length || !all.every((f) => h.sacked.includes(f.id) || f.stance === 'destroyed')) return false;
  s.gameOver = { tick: s.tick, won: true, text: 'The Great Waaagh! Every power of the realm has burned under the horde, and their lords kneel or lie in the ash. The green tide covers the land from end to end, and the songs of it will be roared at every fire for a thousand years.' };
  return true;
}

/* ------------------------------------------------------------ the view */

export interface HordeView {
  fury: number;
  name: string;
  waaagh: number | null;
  waaaghs: number;
  out: { names: string[]; target: string; hours: number } | null;
  raids: number;
  won: number;
  thralls: number;
  glory: { name: string; glory: number; title: string | null }[];
  powers: { name: string; sacked: boolean }[];
  winWaaaghs: number;
  log: string[];
}

export function hordeView(s: GameState): HordeView | null {
  const h = s.horde;
  if (!h || !hordeTown(s)) return null;
  const nm = (id: number) => s.people.find((p) => p.id === id)?.name;
  return {
    fury: h.fury,
    name: furyName(h.fury),
    waaagh: h.waaagh ? Math.max(0, Math.ceil((h.waaagh.until - s.tick) / TICKS_PER_HOUR)) : null,
    waaaghs: h.waaaghs,
    out: h.out ? { names: h.out.ids.map(nm).filter((x): x is string => !!x), target: h.out.target === 'roads' ? 'the roads' : nameOf(realm(s).find((f) => f.id === h.out!.target)), hours: Math.max(0, Math.ceil((h.out.until - s.tick) / TICKS_PER_HOUR)) } : null,
    raids: h.raids,
    won: h.won,
    thralls: s.prisoners.length,
    glory: Object.entries(h.glory)
      .map(([id, g]) => ({ p: s.people.find((q) => q.id === Number(id)), g }))
      .filter((x): x is { p: Person; g: number } => !!x.p)
      .sort((a, b) => b.g - a.g)
      .slice(0, 6)
      .map(({ p, g }) => ({ name: p.name, glory: g, title: GLORY_NAMES.filter(([at]) => g >= at).map(([, n]) => n[p.id % n.length]).pop() ?? null })),
    powers: realm(s).map((f) => ({ name: nameOf(f), sacked: h.sacked.includes(f.id) || f.stance === 'destroyed' })),
    winWaaaghs: WIN_WAAAGHS,
    log: h.log,
  };
}
