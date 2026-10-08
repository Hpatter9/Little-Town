// The march's recap (the owner's ask: "a recap to show what happens on a march"). Every army keeps a log of the march
// under way (`Army.march`): where it set out from and for, each province reached, each battle given and how it went,
// what was taken, the troops lost and the foes felled, the heroes' fates. When the march ends (arrived, home, halted,
// beaten back or broken up) the log becomes a recap (`ConquestState.marches`, the latest first), is told in the
// Journal, and is put to the player as a report in the event box (a prompt of kind `debrief`).

import { eventPicture } from '../../data/eventScenes';
import { seaTown } from '../sea';
import { notify, type GameState, type Prompt } from '../state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from '../time';
import { weatherAt } from '../weather';
import type { Army, ConquestState } from './conquest';
import type { BattleRecap } from './battles';
import type { ConquestWorld } from './world';

/** Recaps kept, and how long the report waits in the event box. */
export const MARCHES_KEPT = 8;
export const MARCH_REPORT_HOURS = 8;

export interface MarchLog {
  from: number;
  to: number;
  began: number;
  lines: string[];
  taken: string[];
  fought: number;
  won: number;
  lost: number;
  felled: number;
  fates: BattleRecap['fates'];
}
export type MarchOutcome = 'arrived' | 'home' | 'halted' | 'beaten' | 'broken';
export interface MarchRecap {
  tick: number;
  army: string;
  from: string;
  to: string;
  days: number;
  outcome: MarchOutcome;
  taken: string[];
  fought: number;
  won: number;
  lost: number;
  felled: number;
  fates: BattleRecap['fates'];
  lines: string[];
}

export const marchesOf = (c: ConquestState): MarchRecap[] => (c.marches ??= []);

/** A march is ordered (or an army under way is ordered on elsewhere: the same march, a new end). */
export function beginMarch(s: GameState, w: ConquestWorld, a: Army, to: number): void {
  if (a.march) {
    if (a.march.to !== to) {
      a.march.lines.push(`Ordered on to ${w.provinces[to].name}.`);
      a.march.to = to;
    }
    return;
  }
  a.march = { from: a.at, to, began: s.tick, lines: [`Set out from ${w.provinces[a.at].name} for ${w.provinces[to].name}.`], taken: [], fought: 0, won: 0, lost: 0, felled: 0, fates: [] };
}

/** A line of the march's story. */
export function noteMarch(a: Army | undefined, line: string): void {
  if (a?.march) a.march.lines.push(line);
}

/** A battle given on the march, and how it went. */
export function noteBattle(a: Army | undefined, province: string, won: boolean, lost: number, felled: number, fates: BattleRecap['fates'], captured: boolean): void {
  const m = a?.march;
  if (!m) return;
  m.fought++;
  if (won) m.won++;
  m.lost += lost;
  m.felled += felled;
  for (const f of fates) if (f.fate !== 'fought') m.fates.push(f);
  if (won && captured) m.taken.push(province);
  m.lines.push(won ? `Won the battle for ${province}: ${felled} of the foe felled, ${lost} of ours lost.` : `Beaten before ${province}: ${lost} of ours lost, ${felled} of the foe felled.`);
}

const OUTCOME_WORD: Record<MarchOutcome, string> = { arrived: 'reaches its goal', home: 'is home', halted: 'halts', beaten: 'is beaten back', broken: 'breaks up' };

/** The march is over: its recap kept, told and put to the player. */
export function endMarch(s: GameState, c: ConquestState, w: ConquestWorld, a: Army, outcome: MarchOutcome): MarchRecap | null {
  const m = a.march;
  if (!m) return null;
  delete a.march;
  const days = Math.max(0, Math.round(((s.tick - m.began) / TICKS_PER_DAY) * 10) / 10);
  const r: MarchRecap = {
    tick: s.tick, army: a.name, from: w.provinces[m.from].name, to: w.provinces[m.to].name, days, outcome,
    taken: m.taken, fought: m.fought, won: m.won, lost: m.lost, felled: m.felled, fates: m.fates, lines: m.lines.slice(-14),
  };
  const list = marchesOf(c);
  list.unshift(r);
  list.length = Math.min(list.length, MARCHES_KEPT);
  const summary = marchSummary(r);
  notify(s, `${a.name} ${OUTCOME_WORD[outcome]}: ${summary}`, true);
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title: `The march of ${a.name}`,
    text: summary,
    story: [`${a.name} ${OUTCOME_WORD[outcome]} after ${days === 1 ? 'a day' : `${days} days`} afield.`, ...r.lines, summary].join('\n\n'),
    picture: eventPicture(`march:${a.id}:${s.tick}`, outcome === 'beaten' || outcome === 'broken' ? 'war battle defeat army' : 'war army march banners', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    options: ['Read the report'],
    defaultOption: 0,
    expiresTick: s.tick + MARCH_REPORT_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  return r;
}

/** One line for a march: battles, provinces taken, losses, fates. */
export function marchSummary(r: Pick<MarchRecap, 'fought' | 'won' | 'taken' | 'lost' | 'felled' | 'fates'>): string {
  const parts: string[] = [];
  parts.push(r.fought ? `${r.won} of ${r.fought} battle${r.fought === 1 ? '' : 's'} won` : 'no battle given');
  if (r.taken.length) parts.push(`${r.taken.length === 1 ? r.taken[0] : `${r.taken.length} provinces`} taken`);
  if (r.fought) parts.push(`${r.felled} of the foe felled, ${r.lost} troops lost`);
  const hurt = r.fates.filter((f) => f.fate !== 'routed').map((f) => `${f.name} ${f.fate}`);
  if (hurt.length) parts.push(hurt.join(', '));
  return `${parts.join('; ')}.`;
}
