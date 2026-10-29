// A steward for the founder (step 4 of playing the founder). While the founder is away on a trip, the heir (or else the
// best grown-up at home) minds the town for them, and the town carries on as normal. When the founder is home again a
// short "While you were gone" card lists what changed: buildings finished, deaths, raids and the treasury (on the trip's
// own card while that is still to be read: sim/summaries.ts).

import { BUILDING_BY_ID } from '../data/buildings';
import { DEBRIEF_HOURS } from '../data/muster';
import { founderOf } from './founder';
import { heirOf } from './health';
import { isChild } from './social';
import { founderTripCard } from './summaries';
import { notify, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** What stood when the founder left, to say what changed when they come back. */
export interface Gone {
  who: number;
  since: number;
  steward: number | null;
  built: number[];
  fallen: number[];
  coins: number;
  raids: string[];
}

/** Who minds the town: the heir if they are home, else the grown-up at home the town thinks most of. */
export function stewardOf(s: GameState): Person | undefined {
  const f = founderOf(s);
  if (!f) return undefined;
  const home = (p: Person) => p.id !== f.id && p.away === null && !p.downed && !isChild(p) && !p.monster;
  const heir = heirOf(s, f);
  if (heir && home(heir)) return heir;
  return s.people.filter(home).sort((a, b) => b.skills.social.level * 3 + b.skills.research.level - (a.skills.social.level * 3 + a.skills.research.level) || a.id - b.id)[0];
}

/** A raid is over while the founder is away. */
export function goneRaid(s: GameState, name: string): void {
  s.gone?.raids.push(name);
}

/** Every tick: the founder leaves (a steward is named) or comes home (the card). */
export function stewardTick(s: GameState): void {
  if (s.autopilot === false) return;
  const f = founderOf(s);
  const g = s.gone;
  if (g && (!f || f.id !== g.who)) {
    s.gone = undefined; // (the founder died away: the succession tells that)
    return;
  }
  if (!f) return;
  if (!g) {
    if (f.away === null) return;
    const steward = stewardOf(s);
    s.gone = {
      who: f.id,
      since: s.tick,
      steward: steward?.id ?? null,
      built: s.buildings.filter((b) => b.status === 'done').map((b) => b.id),
      fallen: (s.fallen ?? []).map((q) => q.id),
      coins: s.coins ?? 0,
      raids: [],
    };
    if (steward) notify(s, `${steward.name} minds the town while ${f.name} is away.`);
    return;
  }
  if (f.away !== null) return;
  s.gone = undefined;
  homeAgain(s, f, g);
}

const listOf = (names: string[]) => {
  const count = new Map<string, number>();
  for (const n of names) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count].map(([n, c]) => (c > 1 ? `${c} ${n}s` : `a ${n}`)).join(', ');
};

function homeAgain(s: GameState, f: Person, g: Gone): void {
  if (s.tick - g.since < TICKS_PER_HOUR) return;
  const days = Math.round((s.tick - g.since) / TICKS_PER_DAY);
  const hours = Math.max(1, Math.round((s.tick - g.since) / TICKS_PER_HOUR));
  const steward = g.steward !== null ? s.people.find((p) => p.id === g.steward) : undefined;
  // (a trip of an afternoon is told in hours: a three-hour trip was "home after a day")
  const long = days >= 1 ? (days === 1 ? 'a day' : `${days} days`) : hours === 1 ? 'an hour' : `${hours} hours`;
  const lines = [`${f.name} is home after ${long}.${steward ? ` ${steward.name} minded the town.` : ''}`];
  const built = s.buildings.filter((b) => b.status === 'done' && !g.built.includes(b.id)).map((b) => BUILDING_BY_ID[b.def]?.name ?? b.def);
  if (built.length) lines.push(`Finished while you were gone: ${listOf(built)}.`);
  const dead = (s.fallen ?? []).filter((q) => !g.fallen.includes(q.id));
  if (dead.length) lines.push(`Died: ${dead.map((q) => `${q.name} (${q.cause})`).join('; ')}.`);
  if (g.raids.length) lines.push(`Raids: ${g.raids.length === 1 ? g.raids[0] : `${g.raids.length}, the last by the ${g.raids[g.raids.length - 1]}`}.`);
  const coins = (s.coins ?? 0) - g.coins;
  if (coins !== 0) lines.push(`The treasury ${coins > 0 ? 'gained' : 'lost'} ${Math.abs(coins)} coins.`);
  // (nothing changed: a line in the news, not one more card after the trip's own)
  if (lines.length === 1) return notify(s, `${lines[0]} Nothing much changed.`);
  // (the founder's trip card still waits: the news joins it, one card not two: sim/summaries.ts)
  const trip = founderTripCard(s);
  if (trip?.debrief) {
    trip.debrief.home = [...(steward ? [`${steward.name} minded the town.`] : []), ...lines.slice(1)];
    trip.story = `${trip.story ?? trip.text} ${lines.join(' ')}`;
    s.nextId++; // (the id its own card took, kept so a town plays out as it did)
    return notify(s, lines.join(' '));
  }
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title: 'While you were gone',
    text: lines[0],
    story: lines.join(' '),
    who: f.id,
    options: ['Back to it'],
    defaultOption: 0,
    expiresTick: s.tick + DEBRIEF_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
}
