// Titles that say how someone is (data/titles.ts): earned from what a townsperson actually did, and each keeps a line
// on how it was earned (`Person.titleWhy`). Deterministic and rolls no dice: the same record always earns the same
// titles. They run only with the autopilot on, like the other town systems.
import { TITLE_MOST, TITLE_RULES, type TitleFacts } from '../data/titles';
import { levelOf } from '../data/levels';
import type { GameState, Person } from './state';
import { notify } from './state';
import { isChild } from './social';
import { natureOf } from '../data/natures';

/** What the rules read about this person. */
export function titleFacts(s: GameState, p: Person): TitleFacts {
  return {
    tally: p.tally ?? {},
    deeds: p.deeds ?? {},
    felled: p.felled ?? 0,
    trips: p.trips ?? 0,
    level: levelOf(p),
    coins: p.coins ?? 0,
    nature: natureOf(p).id,
    traits: p.traits,
    origin: s.origin ?? 'settlers',
    lost: (p.lasting ?? []).filter((l) => l.kind === 'lost').map((l) => l.part),
    fitted: p.fitted ?? {},
    scars: (p.lasting ?? []).filter((l) => l.kind === 'scar').length,
    keptVow: !!p.keptVow,
  };
}

/** The titles their record has earned so far that they don't yet hold, with how each was earned. */
export function earnedTitles(s: GameState, p: Person): { title: string; why: string }[] {
  const f = titleFacts(s, p);
  const have = new Set(p.titles ?? []);
  return TITLE_RULES.filter((r) => !have.has(r.title) && r.when(f)).map((r) => ({ title: r.title, why: r.why(f) }));
}

/** Hourly: give anyone their record has earned a new title, with the news. Not for children, and no one holds more
 *  than `TITLE_MOST` of these (the ladders of deeds and the origin titles don't count against it). */
export function awardCharacterTitles(s: GameState): void {
  if (s.autopilot === false) return;
  for (const p of s.people) {
    if (isChild(p)) continue;
    const held = (p.titleWhy ? Object.keys(p.titleWhy) : []).length;
    let room = TITLE_MOST - held;
    for (const { title, why } of earnedTitles(s, p)) {
      if (room <= 0) break;
      room--;
      (p.titles ??= []).push(title);
      (p.titleWhy ??= {})[title] = why;
      notify(s, `${p.name} is now called ${p.name} ${title}. ${why}`, true);
    }
  }
}
