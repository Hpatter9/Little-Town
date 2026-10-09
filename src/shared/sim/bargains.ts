// The Fae Court's bargains (the origins made deeper, the second; numbers and bargains in data/bargains.ts). In a fae
// town the Court comes at moonrise every few nights with a bargain (`offerBargain`: a `ways` prompt, the town's own
// choice the default): a boon now (events' effects), a price due some days later (`s.court.debts`). The Court always
// collects (`collect`): a price the town can't pay (no coins, no child, nobody to take) is forfeit, taken another way
// and dearer. Refused, the Court sulks and may play a trick (`PRANKS`). Cold iron in the stores hurts the fair folk
// (`coldIron`); a pleased Court holds revels under the full moon (`revel`). Only in a fae town, with the autopilot on.

import {
  ANSWER_HOURS,
  BARGAIN_BY_ID,
  BARGAINS,
  COURT_DRIFT,
  COURT_HOUR,
  COURT_MOODS,
  FORFEIT_FAVOUR,
  IRON_FAVOUR,
  IRON_HARM,
  IRON_MORALE,
  OFFER_DAYS,
  PAID_FAVOUR,
  PRANK_CHANCE,
  PRANKS,
  REFUSED_FAVOUR,
  REVEL_AT,
  REVEL_MORALE,
  REVEL_TRAVELLERS,
  STRUCK_FAVOUR,
  type FaePrice,
} from '../data/bargains';
import type { EventEffect } from '../data/eventKit';
import { SKILL_NAMES } from '../data/skills';
import { hashSeed, Rng } from '../rng';
import { totalStock } from './buildings';
import { apply } from './events';
import { fullMoon } from './monsters';
import { isChild } from './social';
import { notify, type GameState, type Person, type Prompt } from './state';
import { askWays, tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds } from './townsfolk';

export interface FaeDebt {
  bargain: string;
  due: number;
  /** Who the boon touched (the price may fall on them). */
  who?: number;
}

export interface CourtState {
  favour: number;
  next: number;
  debts: FaeDebt[];
  struck: number;
  refused: number;
  taken: string[];
  log: string[];
}

export const courtTown = (s: GameState) => s.origin === 'fae';

export function courtOf(s: GameState): CourtState | null {
  if (!courtTown(s)) return null;
  return (s.court ??= { favour: 10, next: s.tick + OFFER_DAYS[0] * TICKS_PER_DAY, debts: [], struck: 0, refused: 0, taken: [], log: [] });
}

const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));
const roll = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:court:${s.tick}:${salt}`));
export const courtMood = (f: number) => COURT_MOODS.find(([at]) => f >= at)?.[1] ?? 'The Court is cool';

function log(s: GameState, c: CourtState, text: string): void {
  c.log.unshift(`Day ${calendar(s.tick).day}: ${text}`);
  if (c.log.length > 10) c.log.length = 10;
}

/** Hourly from sim.ts. */
export function courtHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  const c = courtOf(s);
  if (!c) return;
  for (const d of [...c.debts]) if (s.tick >= d.due) collect(s, c, d);
  if (calendar(s.tick).hour !== COURT_HOUR) return;
  c.favour = clamp(c.favour - Math.sign(c.favour) * Math.min(COURT_DRIFT, Math.abs(c.favour)));
  coldIron(s, c);
  if (fullMoon(s) && c.favour >= REVEL_AT) revel(s, c);
  if (s.tick >= c.next && !s.prompts.some((p) => p.ways?.system === 'court')) offerBargain(s, c);
}

/** Cold iron in the stores: the fair folk feel it. */
export function coldIron(s: GameState, c: CourtState): number {
  const st = totalStock(s);
  const iron = (st.iron ?? 0) + (st.steel ?? 0) + (st.iron_ore ?? 0);
  if (iron <= IRON_HARM) return iron;
  (s.marks ??= []).push({ lever: 'morale', value: IRON_MORALE, until: s.tick + TICKS_PER_DAY, text: 'Cold iron in the stores' });
  c.favour = clamp(c.favour + IRON_FAVOUR);
  return iron;
}

function revel(s: GameState, c: CourtState): void {
  const until = s.tick + TICKS_PER_DAY;
  (s.marks ??= []).push({ lever: 'morale', value: REVEL_MORALE, until, text: 'The revels under the full moon' }, { lever: 'travellers', value: REVEL_TRAVELLERS, until, text: 'The revels draw travellers' });
  log(s, c, 'The Court held its revels under the full moon, and the whole town danced.');
  notify(s, 'The fair folk hold their revels under the full moon: music in every glade, and travellers drawn to it.', true);
}

/** The Court comes with a bargain. */
export function offerBargain(s: GameState, c: CourtState, id?: string): Prompt | null {
  const rng = roll(s, 'offer');
  c.next = s.tick + rng.int(OFFER_DAYS[0], OFFER_DAYS[1]) * TICKS_PER_DAY;
  const pool = BARGAINS.filter((b) => (b.id !== 'firstborn' || s.people.some(isChild)) && !c.debts.some((d) => d.bargain === b.id));
  const b = id ? BARGAIN_BY_ID[id] : rng.pick(pool);
  if (!b) return null;
  const story = `${b.offer}\n\nThe boon: ${b.boonText}. The price, in ${b.due} day${b.due > 1 ? 's' : ''}: ${b.priceText}.${c.favour < 0 ? ' The Court is not fond of the town just now; its smile does not reach its eyes.' : ''}`;
  return askWays(s, { system: 'court', about: b.id }, b.title, story, 'fae glade faerie moon', [`Strike the bargain`, `Refuse it`], b.wise ? 0 : 1, ANSWER_HOURS);
}

/** The town's answer. */
export function answerBargain(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  const c = courtOf(s);
  const b = prompt.ways && BARGAIN_BY_ID[prompt.ways.about];
  if (!c || !b) return;
  if (option === 0) {
    const out: string[] = [];
    apply(s, b.boon, rng, undefined, out);
    c.debts.push({ bargain: b.id, due: s.tick + b.due * TICKS_PER_DAY });
    c.struck++;
    c.favour = clamp(c.favour + STRUCK_FAVOUR);
    log(s, c, `Struck ${b.title}: ${b.boonText}. The price falls due in ${b.due} days.`);
    notify(s, `The bargain is struck: ${b.boonText}. The fair folk will come for ${b.priceText} in ${b.due} days.`, true);
    return;
  }
  c.refused++;
  c.favour = clamp(c.favour + REFUSED_FAVOUR);
  log(s, c, `Refused ${b.title}.`);
  if (rng.chance(PRANK_CHANCE * (c.favour < 0 ? 1.5 : 1))) {
    const p = rng.pick(PRANKS);
    apply(s, p.effects, rng, undefined);
    log(s, c, `The Court sulked: ${p.text}`);
    notify(s, `The fair folk took the refusal badly. ${p.text}`, true);
  } else notify(s, 'The fair folk went away into the dark without a word. They will remember.');
}

/** A price falls due. */
function collect(s: GameState, c: CourtState, d: FaeDebt): void {
  c.debts.splice(c.debts.indexOf(d), 1);
  const b = BARGAIN_BY_ID[d.bargain];
  if (!b) return;
  const rng = roll(s, `collect:${b.id}`);
  const paid = payPrice(s, c, b.price, rng);
  if (paid) {
    c.favour = clamp(c.favour + PAID_FAVOUR);
    log(s, c, `The Court took its price for ${b.title}: ${b.priceText}.`);
    tellStory(s, `The price of ${b.title}`, `The fair folk came back, as they always do, to collect: ${b.priceText}. ${paid}`, 'fae glade faerie night');
  } else {
    // can't be paid: taken another way, dearer
    c.favour = clamp(c.favour + FORFEIT_FAVOUR);
    const someone = s.people.filter((p) => p.id !== s.mainId && p.away === null);
    const p = someone.length ? rng.pick(someone) : null;
    if (p) takeAway(s, c, p);
    log(s, c, `${b.title}: the price could not be paid, so the Court took ${p ? p.name : 'its due in anger'}.`);
    tellStory(s, `The price of ${b.title}`, `The fair folk came to collect ${b.priceText}, and it could not be paid. A bargain is a bargain: they took ${b.forfeit} instead${p ? `. ${p.name} walked into the trees after them and did not look back` : ''}.`, 'fae dark night forest');
  }
}

/** Pay a bargain's price; a line of what happened, or null when it can't be paid. */
function payPrice(s: GameState, c: CourtState, price: FaePrice[], rng: Rng): string | null {
  const lines: string[] = [];
  const effects: EventEffect[] = [];
  for (const e of price) {
    if ('youth' in e) {
      const p = e.on === 'founder' ? s.people.find((q) => q.id === s.mainId) : rng.pick(s.people.filter((q) => !isChild(q)));
      if (!p) return null;
      p.grownAt = (p.grownAt ?? s.tick) - e.youth * TICKS_PER_DAY;
      lines.push(`${p.name} woke greyer at the temples, a year older in a night.`);
    } else if ('taken' in e) {
      const pool = e.taken === 'child' ? s.people.filter(isChild) : s.people.filter((q) => q.id !== s.mainId && q.away === null);
      if (!pool.length) return null;
      const p = rng.pick(pool);
      takeAway(s, c, p);
      lines.push(`${p.name} went with them, singing, and was not seen again.`);
    } else if ('forget' in e) {
      const best = [...s.people].sort((a, q) => q.skills[e.forget].level - a.skills[e.forget].level)[0];
      if (!best || best.skills[e.forget].level < 1) return null;
      best.skills[e.forget].level = Math.max(0, best.skills[e.forget].level - e.levels);
      lines.push(`${best.name} woke and could not remember how their own tools worked: ${SKILL_NAMES[e.forget]} lost.`);
    } else {
      if ('take' in e && e.take === 'coins' && (s.coins ?? 0) <= 0) return null;
      effects.push(e);
    }
  }
  const out: string[] = [];
  if (effects.length) apply(s, effects, rng, undefined, out);
  if (out.length) lines.push(`(${out.join(', ')})`);
  return lines.join(' ') || 'It was taken, and the Court went away content.';
}

function takeAway(s: GameState, c: CourtState, p: Person): void {
  s.people = s.people.filter((q) => q !== p);
  assignBeds(s);
  c.taken.push(p.name);
  notify(s, `${p.name} has been taken by the fair folk.`, true);
}

export interface CourtView {
  favour: number;
  mood: string;
  revels: boolean;
  iron: number;
  ironHurts: boolean;
  debts: { title: string; price: string; days: number }[];
  nextDays: number;
  struck: number;
  refused: number;
  taken: string[];
  log: string[];
}

export function courtView(s: GameState): CourtView | null {
  const c = s.court;
  if (!c || !courtTown(s)) return null;
  const st = totalStock(s);
  const iron = (st.iron ?? 0) + (st.steel ?? 0) + (st.iron_ore ?? 0);
  return {
    favour: c.favour,
    mood: courtMood(c.favour),
    revels: c.favour >= REVEL_AT,
    iron,
    ironHurts: iron > IRON_HARM,
    debts: c.debts.map((d) => ({ title: BARGAIN_BY_ID[d.bargain]?.title ?? d.bargain, price: BARGAIN_BY_ID[d.bargain]?.priceText ?? '', days: Math.max(0, Math.ceil((d.due - s.tick) / TICKS_PER_DAY)) })),
    nextDays: Math.max(0, Math.ceil((c.next - s.tick) / TICKS_PER_DAY)),
    struck: c.struck,
    refused: c.refused,
    taken: c.taken,
    log: c.log,
  };
}
