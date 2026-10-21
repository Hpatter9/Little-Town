// Disputes the founder judges (the founder as the player's character; data/disputes.ts has the numbers). Now and then
// (`disputesHourly`: a named chance a day, autopilot only, its own side stream) two townsfolk at odds come to the founder:
// a quarrel (side with one, or make them both make peace) or a theft one charges the other with (let it go, make it right,
// or the stocks). It is a question that holds the game (`Prompt.waits`) until it is answered. Each judgement moves the
// people's regard for the founder and for each other, their spirits, the standing of their blocs (sim/politics.ts) and
// the town's mood. Trials for crimes the town catches (`trial`, politics.ts) wait for the founder the same way.

import { BLOC_MOVE, DISPUTE_GAP_DAYS, DISPUTE_HOUR, DISPUTE_PEOPLE, DISPUTE_PER_DAY, MOOD, QUARREL_AT, REGARD, SIDE_MORALE, THEFT_COINS, THEFT_GUILTY } from '../data/disputes';
import { hashSeed, Rng } from '../rng';
import { adjust, isChild, opinion } from './social';
import { blocOf, politicsOf } from './politics';
import { founderOf } from './founder';
import { notify, type GameState, type Person, type Prompt } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const grownHome = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed && !isChild(p) && p.id !== s.mainId && !p.monster);

/** The town's mood moves for everyone at home. */
function mood(s: GameState, by: number): void {
  for (const p of s.people) if (p.away === null && !isChild(p)) p.morale = clamp(p.morale + by);
}
/** A person's bloc is pleased or put out. */
function bloc(s: GameState, p: Person, by: number): void {
  const b = blocOf(s, p);
  if (b) politicsOf(s).sat[b] = clamp(politicsOf(s).sat[b] + by);
}
/** How the founder stands with someone, and their spirits. */
function favour(s: GameState, f: Person, p: Person, regard: number, morale: number): void {
  adjust(s, f.id, p.id, regard);
  p.morale = clamp(p.morale + morale);
}

/** A dispute comes to the founder, now and then. */
export function disputesHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver || s.raid) return;
  if (calendar(s.tick).hour !== DISPUTE_HOUR) return;
  const f = founderOf(s);
  const folk = grownHome(s);
  if (!f || folk.length < DISPUTE_PEOPLE) return;
  if (s.prompts.some((q) => q.kind === 'dispute' || q.politics === 'trial')) return;
  if (s.disputes && s.tick - s.disputes.last < DISPUTE_GAP_DAYS * TICKS_PER_DAY) return;
  const rng = new Rng(hashSeed(`${s.seed}:disputes:${s.tick}`));
  if (!rng.chance(DISPUTE_PER_DAY)) return;
  // the worst-feeling pair in town (the lowest id first on a tie: nothing here draws from the town's stream)
  let pair: [Person, Person] | null = null;
  let worst = QUARREL_AT + 1;
  for (let i = 0; i < folk.length; i++) {
    for (let j = i + 1; j < folk.length; j++) {
      const o = Math.min(opinion(s, folk[i].id, folk[j].id), opinion(s, folk[j].id, folk[i].id));
      if (o < worst) {
        worst = o;
        pair = [folk[i], folk[j]];
      }
    }
  }
  if (!pair) return;
  const [a, b] = rng.chance(0.5) ? pair : [pair[1], pair[0]];
  s.disputes = { last: s.tick };
  const theft = rng.chance(0.5);
  const prompt: Prompt = theft
    ? {
        id: s.nextId++,
        kind: 'dispute',
        expedition: null,
        title: `${b.name} says ${a.name} stole`,
        text: `${b.name} says ${a.name} took coins from them. ${a.name} swears it was not so. Nobody saw it done. What will you rule?`,
        options: ['Lenient: let it go', 'Fair: make it right, and a warning', 'Harsh: the stocks'],
        defaultOption: 1,
        expiresTick: Number.MAX_SAFE_INTEGER,
        waits: true,
        who: a.id,
        dispute: { kind: 'theft', a: a.id, b: b.id, guilty: rng.chance(THEFT_GUILTY) },
      }
    : {
        id: s.nextId++,
        kind: 'dispute',
        expedition: null,
        title: `${a.name} and ${b.name} quarrel`,
        text: `${a.name} and ${b.name} have come to blows over an old grudge, and each wants the founder to say who is in the right.`,
        options: [`Side with ${a.name}`, `Side with ${b.name}`, 'Fair: make them both make peace'],
        defaultOption: 2,
        expiresTick: Number.MAX_SAFE_INTEGER,
        waits: true,
        who: a.id,
        dispute: { kind: 'quarrel', a: a.id, b: b.id },
      };
  s.prompts.push(prompt);
  notify(s, prompt.title, true);
}

/** The founder's judgement. */
export function answerDispute(s: GameState, prompt: Prompt, option: number): void {
  const d = prompt.dispute;
  const f = founderOf(s);
  const a = s.people.find((p) => p.id === d?.a);
  const b = s.people.find((p) => p.id === d?.b);
  if (!d || !f || !a || !b) return;
  if (d.kind === 'quarrel') {
    if (option === 2) {
      adjust(s, a.id, b.id, 25);
      for (const p of [a, b]) favour(s, f, p, 2, 1);
      bloc(s, a, 1);
      bloc(s, b, 1);
      mood(s, MOOD);
      return notify(s, `${f.name} tells ${a.name} and ${b.name} to make peace, and they shake on it, grudgingly.`, true);
    }
    const [win, lose] = option === 0 ? [a, b] : [b, a];
    favour(s, f, win, REGARD, SIDE_MORALE);
    favour(s, f, lose, -REGARD, -SIDE_MORALE);
    adjust(s, win.id, lose.id, -10); // (the one ruled against holds it against the other)
    bloc(s, win, BLOC_MOVE);
    bloc(s, lose, -BLOC_MOVE);
    mood(s, -MOOD);
    return notify(s, `${f.name} sides with ${win.name} against ${lose.name}. ${lose.name} does not take it well.`, true);
  }
  // a theft charged: a is accused, b accuses
  const guilty = !!d.guilty;
  const take = Math.min(a.coins ?? 0, THEFT_COINS[1]);
  if (option === 0) {
    // lenient: it is let go
    favour(s, f, a, REGARD / 2, guilty ? 3 : 4);
    favour(s, f, b, -REGARD / 2, -4);
    bloc(s, b, -BLOC_MOVE);
    if (guilty) bloc(s, a, 1);
    mood(s, guilty ? -MOOD : 0);
    return notify(s, `${f.name} lets the matter go. ${b.name} grumbles.`, true);
  }
  if (option === 1) {
    // fair: coins back if they were taken, and a warning
    if (guilty) {
      a.coins = (a.coins ?? 0) - take;
      b.coins = (b.coins ?? 0) + take;
    }
    favour(s, f, a, 0, guilty ? -3 : 0);
    favour(s, f, b, REGARD / 2, guilty ? 3 : -2);
    bloc(s, b, 1);
    mood(s, MOOD);
    return notify(s, guilty ? `${a.name} gives back ${take} coins and is warned.` : `${f.name} warns them both, and finds nothing proved.`, true);
  }
  // harsh: the stocks
  a.sore = { until: s.tick + 2 * TICKS_PER_DAY, value: -8, text: 'Put in the stocks' };
  favour(s, f, a, -REGARD, -8);
  favour(s, f, b, REGARD / 2, 3);
  const pol = politicsOf(s);
  if (guilty) {
    pol.sat.soldiers = clamp(pol.sat.soldiers + BLOC_MOVE);
    bloc(s, a, -BLOC_MOVE);
    mood(s, MOOD);
    return notify(s, `${a.name} spends a day in the stocks for the theft. The town nods.`, true);
  }
  pol.sat.devout = clamp(pol.sat.devout - BLOC_MOVE);
  pol.sat.commons = clamp(pol.sat.commons - BLOC_MOVE);
  bloc(s, a, -BLOC_MOVE);
  mood(s, -MOOD * 2);
  notify(s, `${a.name} is put in the stocks for a theft they did not do, and the town mutters.`, true);
}
