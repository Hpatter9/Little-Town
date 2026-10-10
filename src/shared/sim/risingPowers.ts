// The rising powers' own moves (data/risingPowers.ts). Their growth, envoys, hosts and raids are the realm's
// (sim/factions.ts); this is what only they do. The Shogunate sends shinobi in by night when at war, and its
// champions challenge the town's best to duels; the Corsairs take trade wagons off the roads and skim a shore town's
// stores; the Infernal Host tears rifts in the land that loose its creatures by night, and offers pacts: a life for
// gold and fury. Every roll is the seed's own (never the town's stream), so towns without them run as before.

import { levelOf } from '../data/levels';
import { RAID_KIND_BY_ID } from '../data/raids';
import {
  DUEL_BASE, DUEL_DAILY, DUEL_GAP_DAYS, DUEL_KILLS, DUEL_LEAST, DUEL_MOST, DUEL_PER_DAY, DUEL_PER_STAGE, DUEL_REFUSED_GOODWILL, DUEL_REFUSED_MORALE, DUEL_SLOPE, DUEL_WON_GOODWILL, DUEL_WON_MORALE,
  NIGHT_RAID_DAILY, NIGHT_RAID_HOUR, NIGHT_RAID_SHARE, PACT_COINS, PACT_DAYS, PACT_FIGHT, PACT_GAP_DAYS, RIFT_BANDS, RIFT_CELLS, RIFT_DAILY, RIFT_DAYS, RIFT_FROM, RIFT_SPAWN, RIFT_UNTIL,
  RISING, SEIZE_DAILY, SKIM_MOST, SKIM_SHARE, stageOf, type RisingId,
} from '../data/risingPowers';
import { WORTH } from '../data/trade';
import { hashSeed, Rng } from '../rng';
import { buildingDoor } from './buildings';
import { takeFromStorage } from './expeditions';
import { defOf, envoy, factionOf, realm } from './factions';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { marketOf, seizeWagon } from './markets';
import { raidBudget, startRaid } from './raids';
import { spawnRoamerAt } from './roamers';
import { seaTown } from './sea';
import { isChild } from './social';
import { totalStock } from './buildings';
import { guardsOf } from './treasury';
import { CELL } from './land';
import { campXY, earn, maxHp, notify, setOutcome, type Faction, type GameState, type Person, type Prompt } from './state';
import { calendar, paceDay, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import type { Material } from '../data/materials';

/** What a rising power keeps of its own doings (on the Faction). */
export interface RiseState {
  /** A night raid set (tick). */
  night?: number;
  /** A rift open on the land, till when. */
  rift?: { x: number; y: number; until: number };
  lastDuel?: number;
  duels?: { won: number; lost: number; refused: number };
  lastPact?: number;
  pacts?: number;
  seized?: number;
}

const roll = (s: GameState, id: string, what: string) => new Rng(hashSeed(`${s.seed}:rising:${id}:${what}:${s.tick}`));
const riseOf = (f: Faction): RiseState => (f.rise ??= {});
const hostile = (f: Faction) => f.known && (f.stance === 'war' || f.stance === 'neutral');
const nameOf = (f: Faction) => defOf(f).name.replace(/^The /, 'the ');
const home = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p) && !p.downed);

/** Each hour (the autopilot on): a night raid due, a rift's creatures; at the morning's hour, the day's moves. */
export function risingHourly(s: GameState): void {
  if (s.autopilot === false || s.gameOver || s.tick % TICKS_PER_HOUR !== 0 || !s.factions) return;
  const hour = calendar(s.tick).hour;
  for (const f of realm(s)) {
    const id = defOf(f).rising;
    if (!id || f.stance === 'destroyed') continue;
    const r = riseOf(f);
    if (r.night !== undefined && s.tick >= r.night) nightRaid(s, f, r);
    if (r.rift) riftHour(s, f, r, hour);
    if (hour === 10 && f.known) daily(s, f, id, r);
  }
}

function daily(s: GameState, f: Faction, id: RisingId, r: RiseState): void {
  const g = roll(s, id, 'day');
  if (id === 'shogunate') {
    if (f.stance === 'war' && r.night === undefined && g.chance(NIGHT_RAID_DAILY)) {
      const hoursTo = (NIGHT_RAID_HOUR - calendar(s.tick).hour + 24) % 24 || 24;
      r.night = s.tick + hoursTo * TICKS_PER_HOUR;
    }
    if (hostile(f) && s.tick - (r.lastDuel ?? -1e12) >= DUEL_GAP_DAYS * TICKS_PER_DAY && g.chance(DUEL_DAILY) && champion(s)) {
      const q = envoy(s, f, 'duel');
      if (q) {
        r.lastDuel = s.tick;
        q.who = champion(s)!.id;
      }
    }
  } else if (id === 'corsairs') {
    if (hostile(f) && g.chance(SEIZE_DAILY)) corsairsStrike(s, f, r);
  } else if (id === 'infernal') {
    if (f.stance === 'war' && !r.rift && g.chance(RIFT_DAILY)) openRift(s, f, r, g);
    if (f.stance !== 'alliance' && f.stance !== 'vassal' && s.tick - (r.lastPact ?? -1e12) >= PACT_GAP_DAYS * TICKS_PER_DAY && paceDay(s.tick) >= 8 && home(s).length >= 4) {
      if (envoy(s, f, 'pact')) r.lastPact = s.tick;
    }
  }
}

/* ------------------------------------------------------------ the Shogunate */

function nightRaid(s: GameState, f: Faction, r: RiseState): void {
  if (s.raid) return; // (they wait for a quiet night)
  r.night = undefined;
  if (f.stance !== 'war') return;
  const g = roll(s, 'shogunate', 'night');
  const homes = s.buildings.filter((b) => b.status === 'done');
  const b = homes.length ? homes[g.int(0, homes.length - 1)] : null;
  const at = b ? buildingDoor(b) : campXY(s);
  startRaid(s, RAID_KIND_BY_ID.shinobi_night, Math.max(14, Math.round(raidBudget(s) * NIGHT_RAID_SHARE)), g, at);
  notify(s, `Shinobi of ${nameOf(f)} drop over the rooftops in the dark!`, true);
}

/** The town's best fighter at home (who would answer a duel). */
export function champion(s: GameState): Person | undefined {
  return home(s)
    .filter((p) => p.hp >= maxHp(p) * 0.7)
    .sort((a, b) => duelMight(b) - duelMight(a) || a.id - b.id)[0];
}
const duelMight = (p: Person) => levelOf(p) + p.skills.melee.level;
export function theirMight(s: GameState): number {
  return DUEL_BASE + paceDay(s.tick) * DUEL_PER_DAY + stageOf(s.era) * DUEL_PER_STAGE;
}
export function duelOdds(s: GameState, p: Person): number {
  return Math.max(DUEL_LEAST, Math.min(DUEL_MOST, 0.5 + (duelMight(p) - theirMight(s)) * DUEL_SLOPE));
}
const CHAMPIONS = ['Takeshi the Unbowed', 'Lady Hisame', 'Goro of the Nine Cuts', 'Akane Swiftblade', 'Old Master Tetsu', 'Ren of the Red Mist'];
export const championName = (s: GameState) => CHAMPIONS[hashSeed(`${s.seed}:champ:${Math.floor(s.tick / TICKS_PER_DAY)}`) % CHAMPIONS.length];

/* ------------------------------------------------------------ the Corsairs */

function corsairsStrike(s: GameState, f: Faction, r: RiseState): void {
  const mk = marketOf(s);
  const g = roll(s, 'corsairs', 'strike');
  const wagons = mk?.wagons ?? [];
  if (mk && wagons.length) {
    const w = wagons[g.int(0, wagons.length - 1)];
    const what = seizeWagon(s, mk, w, nameOf(f));
    r.seized = (r.seized ?? 0) + 1;
    notify(s, `Corsairs of ${nameOf(f)} took a trade wagon on the road${what ? `, with ${what}` : ''}!`, true);
    return;
  }
  // a shore town with no watch: they come ashore by night and skim the stores
  if (seaTown(s) && guardsOf(s).length === 0) {
    const stock = totalStock(s);
    const best = (Object.entries(stock) as [Material, number][]).filter(([m, n]) => n > 2 && WORTH[m]).sort((a, b) => b[1] * (WORTH[b[0]] ?? 1) - a[1] * (WORTH[a[0]] ?? 1))[0];
    if (!best) return;
    const n = takeFromStorage(s, best[0], Math.min(SKIM_MOST, Math.ceil(best[1] * SKIM_SHARE)));
    if (n > 0) notify(s, `Corsairs rowed in under the dark and made off with ${n} ${best[0].replace(/_/g, ' ')}. Nobody was on watch.`, true);
  }
}

/* ------------------------------------------------------------ the Infernal Host */

function openRift(s: GameState, f: Faction, r: RiseState, g: Rng): void {
  const c = campXY(s);
  for (let i = 0; i < 12; i++) {
    const a = g.next() * Math.PI * 2;
    const at = { x: Math.round(c.x + Math.cos(a) * RIFT_CELLS * CELL), y: Math.round(c.y + Math.sin(a) * RIFT_CELLS * CELL) };
    // (a test spawn: the ground there must be walkable)
    const test = spawnRoamerAt(s, RIFT_BANDS[stageOf(s.era)], at, at, { name: 'things from the rift' }, 4);
    if (!test) continue;
    r.rift = { x: at.x, y: at.y, until: s.tick + RIFT_DAYS * TICKS_PER_DAY };
    notify(s, `The land splits open ${dirWord(at.x - c.x, at.y - c.y)} of the town: a rift of ${nameOf(f)}, glowing like a forge. Things are climbing out.`, true);
    return;
  }
}
const dirWord = (dx: number, dy: number) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : dy < 0 ? 'north' : 'south');

function riftHour(s: GameState, f: Faction, r: RiseState, hour: number): void {
  const rift = r.rift!;
  if (s.tick >= rift.until || f.stance !== 'war') {
    r.rift = undefined;
    notify(s, `The rift of ${nameOf(f)} closes, hissing, and the ground knits over it.`);
    return;
  }
  const night = hour >= RIFT_FROM || hour < RIFT_UNTIL;
  if (night && roll(s, 'infernal', 'rift').chance(RIFT_SPAWN)) spawnRoamerAt(s, RIFT_BANDS[stageOf(s.era)], rift, rift, { name: 'things from the rift' }, 6);
}

/* ------------------------------------------------------------ the envoys of their own */

export function pactCoins(s: GameState): number {
  return PACT_COINS * (1 + stageOf(s.era));
}

/** The words of a duel's challenge or a pact's offer (sim/factions.ts envoyText asks). */
export function risingEnvoyText(s: GameState, f: Faction, about: string): { title: string; text: string; options: string[]; def: number } | null {
  if (about === 'duel') {
    const p = champion(s);
    const odds = p ? duelOdds(s, p) : 0;
    return {
      title: `A challenge from ${defOf(f).name}`,
      text: `${championName(s)}, a champion of ${nameOf(f)}, stands at the gate with two swords and a bow. They challenge the town's best to single combat${p ? `: that is ${p.name}` : ''}. Win, and ${nameOf(f)} will think the better of the town; refuse, and the whole valley hears of it. (By the look of them, ${p?.name ?? 'our best'} has ${odds >= 0.6 ? 'the better of it' : odds >= 0.4 ? 'an even chance' : 'the worse of it'}.)`,
      options: [`${p?.name ?? 'Our best'} takes up the challenge`, 'Refuse the duel'],
      def: odds >= 0.4 ? 0 : 1,
    };
  }
  if (about === 'pact') {
    return {
      title: `Malphas offers a pact`,
      text: `A smell of hot iron, and a figure in the smoke by the fire: a herald of ${nameOf(f)}. "My prince is generous. ${pactCoins(s)} coins, and a fury in your fighters' arms for days. The price? One life. Not yours. One of theirs. You needn't even choose." It smiles with too many teeth.`,
      options: ['Refuse it', `Accept: a life for ${pactCoins(s)} coins and fury`],
      def: 0,
    };
  }
  return null;
}

/** The town's answer to a duel or a pact. Returns what came of it (or null if this isn't one of theirs). */
export function answerRisingEnvoy(s: GameState, prompt: Prompt, option: number): string | null {
  const e = prompt.envoy;
  const f = e && factionOf(s, e.faction);
  if (!e || !f || (e.about !== 'duel' && e.about !== 'pact')) return null;
  const r = riseOf(f);
  const d = (r.duels ??= { won: 0, lost: 0, refused: 0 });
  let said = '';
  if (e.about === 'duel') {
    const p = (prompt.who !== undefined && s.people.find((q) => q.id === prompt.who && q.away === null && !q.downed)) || champion(s);
    if (option !== 0 || !p) {
      d.refused++;
      f.attitude = Math.max(-100, f.attitude + DUEL_REFUSED_GOODWILL);
      (s.marks ??= []).push({ lever: 'morale', value: DUEL_REFUSED_MORALE, until: s.tick + TICKS_PER_DAY, text: 'We refused the duel' });
      said = `The challenge was refused. ${championName(s)} laughed, bowed, and rode away to tell the valley.`;
    } else {
      const g = roll(s, 'shogunate', `duel:${p.id}`);
      if (g.chance(duelOdds(s, p))) {
        d.won++;
        f.attitude = Math.min(100, f.attitude + DUEL_WON_GOODWILL);
        (s.marks ??= []).push({ lever: 'morale', value: DUEL_WON_MORALE, until: s.tick + 2 * TICKS_PER_DAY, text: `${p.name} won the duel` });
        if (!(p.titles ?? []).includes('Duellist')) (p.titles ??= []).push('Duellist');
        p.skills.melee.xp += 40;
        said = `${p.name} and ${championName(s)} circled in the square while the whole town watched. One cut, two, and ${championName(s)} was down on one knee, yielding. ${nameOf(f)} think the better of the town.`;
      } else {
        d.lost++;
        f.attitude = Math.min(100, f.attitude + 3);
        if (g.chance(DUEL_KILLS)) {
          said = `${p.name} met ${championName(s)} in the square. It was over in a breath: ${p.name} fell, and did not rise.`;
          notify(s, said, true);
          killPerson(s, p, `in a duel with ${championName(s)} of ${nameOf(f)}`);
        } else {
          p.hp = Math.max(1, Math.round(maxHp(p) * 0.15));
          minorWound(s, p, Math.round(maxHp(p) * 0.4), g);
          said = `${p.name} met ${championName(s)} in the square and was cut down, badly hurt. ${championName(s)} spared them with a bow.`;
        }
      }
    }
  } else {
    if (option !== 1) {
      f.attitude = Math.max(-100, f.attitude - 10);
      said = `The herald was refused. It laughed, and the smoke it stood in went out like a candle.`;
    } else {
      const g = roll(s, 'infernal', 'pact');
      const pool = home(s).filter((p) => p.id !== s.mainId);
      const victim = pool.length ? pool[g.int(0, pool.length - 1)] : undefined;
      if (!victim) said = 'The herald looked about the town and found no one it wanted. The pact came to nothing.';
      else {
        r.pacts = (r.pacts ?? 0) + 1;
        const coins = pactCoins(s);
        s.coins = (s.coins ?? 0) + coins;
        earn(s, 'realm', coins);
        (s.marks ??= []).push({ lever: 'fight', value: PACT_FIGHT, until: s.tick + PACT_DAYS * TICKS_PER_DAY, text: 'The pact\'s fury' }, { lever: 'morale', value: -6, until: s.tick + PACT_DAYS * TICKS_PER_DAY, text: 'A pact with the Pit' });
        f.attitude = Math.min(100, f.attitude + 10);
        said = `The pact is sealed. By morning ${victim.name} was gone from their bed, and there was a scorch on the floor the shape of a door. ${coins} coins lay in the treasury, warm to the touch.`;
        notify(s, said, true);
        killPerson(s, victim, 'taken by the Pit, as the pact asked');
      }
    }
  }
  if (said) setOutcome(s, prompt.title, prompt.options[option] ?? null, said);
  return said;
}

/** What the Realm card says of a rising power: its stage and its doings. */
export function riseLine(s: GameState, f: Faction): { stage: string; line: string; deeds: string[] } | null {
  const id = defOf(f).rising;
  if (!id) return null;
  const def = RISING[id];
  const r = f.rise ?? {};
  const deeds: string[] = [];
  if (r.duels && r.duels.won + r.duels.lost + r.duels.refused) deeds.push(`Duels: ${r.duels.won} won, ${r.duels.lost} lost, ${r.duels.refused} refused`);
  if (r.seized) deeds.push(`Wagons taken: ${r.seized}`);
  if (r.pacts) deeds.push(`Pacts sealed: ${r.pacts}`);
  if (r.rift) deeds.push(`A rift is open on the land (${Math.max(0, Math.round((r.rift.until - s.tick) / TICKS_PER_HOUR))} hours left)`);
  if (r.night !== undefined) deeds.push('Shinobi are watching the town');
  return { stage: def.stageNames[stageOf(s.era)], line: def.line, deeds };
}
