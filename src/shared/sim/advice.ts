// Town notes: a handful of one-time notes for a new town, each given only when it matters. The town runs itself now,
// so these explain what it's doing and what's left to the player (its direction, and expeditions), rather than
// telling them what to click. They go in as notices, so they show as toasts and stay in the Journal.

import { notify, type GameState } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

type Tip = { id: string; when: (s: GameState) => boolean; text: string };

const TIPS: Tip[] = [
  {
    id: 'hands-off',
    when: (s) => s.tick >= TICKS_PER_HOUR / 4,
    text: 'The town runs itself: it chooses what to research, gathers what it needs, and builds as it grows. Set its direction under Plan, and send parties out from Expeditions.',
  },
  {
    id: 'expedition',
    when: (s) => s.research.queue.length === 0 && s.research.done.length >= 12 && s.era === 'neolithic',
    text: "Town note: the town has learned all it can for now. The next era needs the totem from the Bear Cave: send a party for it from Expeditions, or before long the Cave Bear will come down for it itself.",
  },
  {
    id: 'winter',
    when: (s) => calendar(s.tick).season === 'autumn' && s.buildings.some((b) => b.crop),
    text: 'Town note: autumn is here, and winter follows in three days. Nothing grows in winter, so the town lives on what it has put by.',
  },
  {
    id: 'wounded',
    when: (s) => s.people.some((p) => p.downed?.bleedUntil != null),
    text: "Town note: someone downed bleeds out in about 2 hours unless they're tended. Medicine, poultices and a Healer's Hut all help.",
  },
];

/** Every few game minutes: give any note that's due (once each). */
export function updateAdvice(s: GameState): void {
  if (s.tick % 60 !== 0) return;
  const given = (s.advice ??= []);
  for (const t of TIPS) {
    if (given.includes(t.id) || !t.when(s)) continue;
    given.push(t.id);
    notify(s, t.text, true);
  }
}
