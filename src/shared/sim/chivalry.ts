// The knights' code (the origins made deeper, the fourth; numbers in data/chivalry.ts). In an Exiled Order town
// (`s.order`): grown-ups swear vows (`VOWS`) and keep or break them (`checkVows`, hourly), honour (the town's and the
// keeper's) rising and falling with them; the worthy are knighted (`dub`); every week a tournament (`tourney`); every
// few days the liege lord calls for fighters (`liegeCall`, a `ways` question); and once the Order's honour is high it
// rides out after the Holy Grail (`grail`), a stage at a time, the last found winning the game. Only in a knights' town,
// with the autopilot on.

import {
  BROKEN_HONOUR,
  BROKEN_MORALE,
  CODE_HOUR,
  GRAIL_HONOUR,
  GRAIL_HOURS,
  GRAIL_KILLS,
  GRAIL_ODDS_BASE,
  GRAIL_ODDS_MOST,
  GRAIL_ODDS_PER_LEVEL,
  GRAIL_STAGES,
  GRAIL_WAIT_DAYS,
  HONOUR_NAMES,
  KEPT_HONOUR,
  KEPT_LEVELS,
  KEPT_MORALE,
  KNIGHT_LEVEL,
  LIEGE_DAYS,
  LIEGE_FINE,
  LIEGE_HONOUR,
  LIEGE_HOURS,
  LIEGE_HURT,
  LIEGE_KILLS,
  LIEGE_PAY,
  LIEGE_REFUSED,
  LIEGE_SENT,
  POVERTY_MOST,
  SWEAR_CHANCE,
  TOURNEY_DAYS,
  TOURNEY_ENTRANTS,
  TOURNEY_HONOUR,
  TOURNEY_HOUR,
  TOURNEY_HURT,
  TOURNEY_PURSE,
  TOURNEY_TRAVELLERS,
  VISITOR_LEVEL,
  VOW_IDS,
  VOWS,
  type VowId,
} from '../data/chivalry';
import { ERAS } from '../data/eras';
import { hashSeed, Rng } from '../rng';
import { giveCoins } from './economy';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { isChild } from './social';
import { earn, maxHp, notify, type GameState, type Person, type Prompt } from './state';
import { askWays, tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { gainSkill } from './townsfolk';

export interface SwornVow {
  vow: VowId;
  since: number;
  felled: number;
}

export interface OrderState {
  honour: number;
  vows: Record<number, SwornVow>;
  kept: number;
  broken: number;
  knights: number[];
  lastTourney: number;
  lastLiege: number;
  liege?: { ids: number[]; until: number };
  grail: { stage: number; rider?: number; until?: number; wait: number };
  log: string[];
}

const LIEGE_AWAY = -4_000_001;
const GRAIL_AWAY = -4_000_002;

export const orderTown = (s: GameState) => s.origin === 'knights';

export function orderOf(s: GameState): OrderState | null {
  if (!orderTown(s)) return null;
  return (s.order ??= { honour: 10, vows: {}, kept: 0, broken: 0, knights: [], lastTourney: s.tick, lastLiege: s.tick, grail: { stage: 0, wait: 0 }, log: [] });
}

const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));
const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:order:${s.tick}:${salt}`));
export const honourName = (h: number) => HONOUR_NAMES.find(([at]) => h >= at)?.[1] ?? 'Doubted';
const home = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed && !isChild(p));
const fighters = (s: GameState) => home(s).sort((a, b) => b.skills.melee.level - a.skills.melee.level || a.id - b.id);

function log(s: GameState, o: OrderState, text: string): void {
  o.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (o.log.length > 12) o.log.length = 12;
}

/** Hourly from sim.ts. */
export function orderHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const o = orderOf(s);
  if (!o) return;
  checkVows(s, o);
  comeHome(s, o);
  const hour = calendar(s.tick).hour;
  if (hour === CODE_HOUR) {
    swear(s, o);
    for (const p of home(s)) dub(s, o, p);
    if (s.tick - o.lastLiege >= LIEGE_DAYS * TICKS_PER_DAY && !o.liege && !s.prompts.some((q) => q.ways?.system === 'order')) liegeCall(s, o);
    grail(s, o);
  }
  if (hour === TOURNEY_HOUR && s.tick - o.lastTourney >= TOURNEY_DAYS * TICKS_PER_DAY) tourney(s, o);
}

/* ------------------------------------------------------------ vows */

function swear(s: GameState, o: OrderState): void {
  const rng = roll(s, 'swear');
  for (const p of home(s)) {
    if (o.vows[p.id] || !rng.chance(SWEAR_CHANCE)) continue;
    const can = VOW_IDS.filter((v) => (v !== 'chastity' || p.partner == null) && (v !== 'vigil' || p.guard) && (v !== 'poverty' || !s.buildings.some((b) => b.owner === p.id)));
    if (!can.length) continue;
    const v = rng.pick(can);
    o.vows[p.id] = { vow: v, since: s.tick, felled: p.felled ?? 0 };
    log(s, o, `${p.name} swore ${VOWS[v].name}: ${VOWS[v].text}.`);
  }
}

/** Each hour: a vow broken, or one kept to its end. */
export function checkVows(s: GameState, o: OrderState): void {
  for (const [key, sv] of Object.entries(o.vows)) {
    const id = Number(key);
    const p = s.people.find((q) => q.id === id);
    if (!p) {
      delete o.vows[id];
      continue;
    }
    const v = VOWS[sv.vow];
    const ended = s.tick - sv.since >= v.days * TICKS_PER_DAY;
    // (one sworn to poverty gives what they earn past a handful to the Order; owning property breaks it)
    if (sv.vow === 'poverty' && (p.coins ?? 0) > POVERTY_MOST) {
      const gift = (p.coins ?? 0) - POVERTY_MOST;
      p.coins = POVERTY_MOST;
      s.coins = (s.coins ?? 0) + gift;
      earn(s, 'events', gift);
    }
    const broken =
      (sv.vow === 'poverty' && s.buildings.some((b) => b.owner === p.id)) ||
      (sv.vow === 'temperance' && (s.nightOut?.ids ?? []).includes(p.id) && p.activity === 'drink') ||
      (sv.vow === 'chastity' && p.partner != null) ||
      (sv.vow === 'vigil' && !p.guard) ||
      (sv.vow === 'valour' && ended && (p.felled ?? 0) <= sv.felled);
    if (broken) breakVow(s, o, p, sv);
    else if (ended || (sv.vow === 'valour' && (p.felled ?? 0) > sv.felled)) keepVow(s, o, p, sv);
  }
}

function keepVow(s: GameState, o: OrderState, p: Person, sv: SwornVow): void {
  delete o.vows[p.id];
  o.kept++;
  o.honour = clamp(o.honour + KEPT_HONOUR);
  for (let i = 0; i < KEPT_LEVELS; i++) gainSkill(p, 'melee', 200);
  (s.marks ??= []).push({ lever: 'morale', value: KEPT_MORALE / 2, until: s.tick + TICKS_PER_DAY, text: `${p.name} kept their vow` });
  p.keptVow = true;
  log(s, o, `${p.name} kept ${VOWS[sv.vow].name}. The Order's honour rises.`);
  notify(s, `${p.name} has kept ${VOWS[sv.vow].name}, and the Order honours them.`, true);
}

function breakVow(s: GameState, o: OrderState, p: Person, sv: SwornVow): void {
  delete o.vows[p.id];
  o.broken++;
  o.honour = clamp(o.honour + BROKEN_HONOUR);
  p.sore = { until: s.tick + TICKS_PER_DAY, value: BROKEN_MORALE, text: `Broke ${VOWS[sv.vow].name}` };
  log(s, o, `${p.name} broke ${VOWS[sv.vow].name}. Shame on the Order.`);
  notify(s, `${p.name} has broken ${VOWS[sv.vow].name}. The Order is shamed.`, true);
}

/** The worthy knighted: melee enough, and a vow kept. */
export function dub(s: GameState, o: OrderState, p: Person): boolean {
  if (o.knights.includes(p.id) || !p.keptVow || p.skills.melee.level < KNIGHT_LEVEL) return false;
  o.knights.push(p.id);
  (p.titles ??= []).push('Knight of the Order');
  o.honour = clamp(o.honour + 3);
  (s.marks ??= []).push({ lever: 'morale', value: 6, until: s.tick + TICKS_PER_DAY, text: `${p.name} was knighted` });
  log(s, o, `${p.name} knelt and rose a Knight of the Order.`);
  tellStory(s, `Arise, ${p.name}`, `Before the whole town, with the old sword of the Order, ${p.name} was dubbed a knight. They have kept their vow and proved their arm; the Order is one stronger, and everyone who watched stood a little straighter for it.`, 'knight castle hall ceremony', { who: p.id });
  return true;
}

/* ------------------------------------------------------------ tournaments */

export function tourney(s: GameState, o: OrderState): { name: string; won: boolean }[] {
  o.lastTourney = s.tick;
  const rng = roll(s, 'tourney');
  const entrants = fighters(s).slice(0, TOURNEY_ENTRANTS);
  if (!entrants.length) return [];
  const visitor = VISITOR_LEVEL + Math.floor(calendar(s.tick).day / 4);
  const results = entrants.map((p) => {
    const odds = Math.max(0.1, Math.min(0.9, 0.5 + (p.skills.melee.level - visitor) * 0.06));
    const won = rng.chance(odds);
    if (won) {
      giveCoins(s, p, TOURNEY_PURSE);
      o.honour = clamp(o.honour + TOURNEY_HONOUR);
      gainSkill(p, 'melee', 60);
    } else if (rng.chance(TOURNEY_HURT)) minorWound(s, p, Math.round(maxHp(p) * 0.2), rng);
    return { name: p.name, won };
  });
  (s.marks ??= []).push({ lever: 'travellers', value: TOURNEY_TRAVELLERS, until: s.tick + TICKS_PER_DAY, text: 'The tournament draws crowds' });
  const wins = results.filter((r) => r.won);
  log(s, o, `The tournament: ${wins.length ? `${wins.map((r) => r.name).join(', ')} unhorsed their challengers` : 'every one of ours was unhorsed'}.`);
  tellStory(
    s,
    'The Tournament',
    `Pennants on every pole, and visiting knights from three valleys. ${results.map((r) => (r.won ? `${r.name} broke their lance clean and unhorsed their challenger.` : `${r.name} was knocked into the dust.`)).join(' ')} ${wins.length ? `The purse is ${wins.length * TOURNEY_PURSE} coins, and the Order's name rings a little louder.` : 'A hard day for the Order.'} The crowds stayed to spend.`,
    'knight tournament joust castle',
    { quiet: true },
  );
  notify(s, `The tournament is held: ${wins.length} of ${results.length} of ours won their bouts.`);
  return results;
}

/* ------------------------------------------------------------ the liege */

export function liegeCall(s: GameState, o: OrderState): Prompt {
  o.lastLiege = s.tick;
  const able = fighters(s).filter((p) => p.id !== s.mainId);
  const story = `A herald in the liege's colours rides in: the liege calls on the Order for ${LIEGE_SENT} of its fighters, to ride in the liege's service for a day or so. ${LIEGE_PAY} coins each when they come home, and the Order's honour. Refuse, and the liege will want ${LIEGE_FINE} coins instead, and remember it.`;
  return askWays(s, { system: 'order', about: 'liege' }, 'The Liege\'s Call', story, 'knight castle herald war', ['Send them', 'Refuse the liege'], able.length >= LIEGE_SENT + 1 ? 0 : 1, 12);
}

export function answerOrder(s: GameState, prompt: Prompt, option: number): void {
  const o = orderOf(s);
  if (!o || prompt.ways?.about !== 'liege') return;
  const able = fighters(s).filter((p) => p.id !== s.mainId).slice(0, LIEGE_SENT);
  if (option === 0 && able.length) {
    for (const p of able) {
      p.away = LIEGE_AWAY;
      p.task = null;
    }
    o.liege = { ids: able.map((p) => p.id), until: s.tick + LIEGE_HOURS * TICKS_PER_HOUR };
    log(s, o, `${able.map((p) => p.name).join(' and ')} rode out in the liege's service.`);
    notify(s, `${able.map((p) => p.name).join(' and ')} ride out in the liege's service.`, true);
    return;
  }
  o.honour = clamp(o.honour + LIEGE_REFUSED);
  const fine = Math.min(s.coins ?? 0, LIEGE_FINE);
  s.coins = (s.coins ?? 0) - fine;
  earn(s, 'realm', -fine);
  log(s, o, `Refused the liege's call: ${fine} coins and the Order's honour paid for it.`);
  notify(s, `The liege's call was refused. The herald takes ${fine} coins, and the Order's name is the poorer.`, true);
}

function comeHome(s: GameState, o: OrderState): void {
  const rng = roll(s, 'home');
  if (o.liege && s.tick >= o.liege.until) {
    const back: string[] = [];
    for (const id of o.liege.ids) {
      const p = s.people.find((q) => q.id === id);
      if (!p || p.away !== LIEGE_AWAY) continue;
      p.away = null;
      if (rng.chance(LIEGE_KILLS)) {
        killPerson(s, p, 'fell in the liege\'s service');
        continue;
      }
      if (rng.chance(LIEGE_HURT)) minorWound(s, p, Math.round(maxHp(p) * 0.3), rng);
      giveCoins(s, p, LIEGE_PAY);
      back.push(p.name);
    }
    o.liege = undefined;
    o.honour = clamp(o.honour + LIEGE_HONOUR);
    log(s, o, `${back.length ? back.join(' and ') : 'Nobody'} came home from the liege's service.`);
    notify(s, `${back.length ? back.join(' and ') : 'Nobody'} came home from the liege's service, with pay and honour.`, true);
  }
  const g = o.grail;
  if (g.rider !== undefined && g.until !== undefined && s.tick >= g.until) grailHome(s, o, rng);
}

/* ------------------------------------------------------------ the Grail */

export const grailOdds = (p: Person) => Math.min(GRAIL_ODDS_MOST, GRAIL_ODDS_BASE + p.skills.melee.level * GRAIL_ODDS_PER_LEVEL);

/** At high honour the Order's best rides out after the Grail, a stage at a time. */
export function grail(s: GameState, o: OrderState): boolean {
  const g = o.grail;
  if (g.rider !== undefined || g.stage >= GRAIL_STAGES.length || o.honour < GRAIL_HONOUR || s.tick < g.wait) return false;
  if (ERAS.indexOf(s.era) < ERAS.indexOf('medieval')) return false;
  const p = fighters(s).find((q) => q.id !== s.mainId || home(s).length === 1);
  if (!p || home(s).length < 2) return false;
  p.away = GRAIL_AWAY;
  p.task = null;
  g.rider = p.id;
  g.until = s.tick + GRAIL_HOURS * TICKS_PER_HOUR;
  log(s, o, `${p.name} rode out alone, after the Grail: to ${GRAIL_STAGES[g.stage].name}.`);
  notify(s, `${p.name} rides out on the Grail quest, to ${GRAIL_STAGES[g.stage].name}.`, true);
  return true;
}

function grailHome(s: GameState, o: OrderState, rng: Rng): void {
  const g = o.grail;
  const p = s.people.find((q) => q.id === g.rider);
  const stage = GRAIL_STAGES[g.stage];
  g.rider = undefined;
  g.until = undefined;
  if (!p || p.away !== GRAIL_AWAY) return;
  p.away = null;
  if (rng.chance(grailOdds(p))) {
    g.stage++;
    o.honour = clamp(o.honour + 5);
    log(s, o, `${p.name} came back from ${stage.name}: the quest goes on.`);
    tellStory(s, `The Grail: ${stage.name}`, stage.won.replace('{knight}', p.name), 'knight holy chapel light', { who: p.id });
    if (g.stage >= GRAIL_STAGES.length && !s.gameOver) s.gameOver = { tick: s.tick, won: true, text: `${p.name} brought the Holy Grail home to the Order. The exiles have found what every knight sought, and their names will be sung as long as there are songs.` };
    return;
  }
  g.wait = s.tick + GRAIL_WAIT_DAYS * TICKS_PER_DAY;
  if (rng.chance(GRAIL_KILLS)) {
    killPerson(s, p, `was lost on the Grail quest, at ${stage.name}`);
    log(s, o, `${p.name} was lost at ${stage.name}.`);
    tellStory(s, `The Grail: ${stage.name}`, `${stage.lost.replace('{knight}', p.name)} They did not live to tell more of it.`, 'knight dark chapel grave');
    return;
  }
  minorWound(s, p, Math.round(maxHp(p) * 0.35), rng);
  log(s, o, `${p.name} came back from ${stage.name} hurt, and empty-handed.`);
  tellStory(s, `The Grail: ${stage.name}`, stage.lost.replace('{knight}', p.name), 'knight chapel mist', { who: p.id });
}

export interface OrderView {
  honour: number;
  name: string;
  vows: { who: string; vow: string; text: string; days: number }[];
  kept: number;
  broken: number;
  knights: string[];
  tourneyDays: number;
  liege: { names: string[]; hours: number } | null;
  grail: { stage: number; of: number; next: string | null; rider: string | null; needs: number };
  log: string[];
}

export function orderView(s: GameState): OrderView | null {
  const o = s.order;
  if (!o || !orderTown(s)) return null;
  const nm = (id: number) => s.people.find((p) => p.id === id)?.name;
  return {
    honour: o.honour,
    name: honourName(o.honour),
    vows: Object.entries(o.vows).map(([id, v]) => ({ who: nm(Number(id)) ?? '?', vow: VOWS[v.vow].name, text: VOWS[v.vow].text, days: Math.max(0, Math.ceil((v.since + VOWS[v.vow].days * TICKS_PER_DAY - s.tick) / TICKS_PER_DAY)) })),
    kept: o.kept,
    broken: o.broken,
    knights: o.knights.map(nm).filter((x): x is string => !!x),
    tourneyDays: Math.max(0, Math.ceil((o.lastTourney + TOURNEY_DAYS * TICKS_PER_DAY - s.tick) / TICKS_PER_DAY)),
    liege: o.liege ? { names: o.liege.ids.map(nm).filter((x): x is string => !!x), hours: Math.max(0, Math.ceil((o.liege.until - s.tick) / TICKS_PER_HOUR)) } : null,
    grail: { stage: o.grail.stage, of: GRAIL_STAGES.length, next: GRAIL_STAGES[o.grail.stage]?.name ?? null, rider: o.grail.rider !== undefined ? nm(o.grail.rider) ?? null : null, needs: GRAIL_HONOUR },
    log: o.log,
  };
}
