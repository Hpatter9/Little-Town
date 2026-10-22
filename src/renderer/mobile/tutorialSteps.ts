// The first-town tutorial (the owner's ask): a short guided start for a NEW town, each step pointing at the real
// control on screen. This is the pure part (no DOM): the steps, when each counts as done, and what is kept in the
// browser's storage. The page's part, the cards, is `tutorial.ts`. It builds on the first hour's tips (`tips.ts`):
// while it runs the tips' notices wait.

export type TutorialTarget = 'map' | 'founder' | 'tab:build' | 'tab:research' | 'stores' | 'clear' | 'none';

/** What the player has done since the step began (the page gathers it). */
export interface TutorialFacts {
  /** The menus opened since the step began. */
  opened: readonly string[];
  /** The map was moved or zoomed. */
  moved: boolean;
  /** The Clear land button is on. */
  clearing: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  /** What the card points at. */
  target: TutorialTarget;
  /** Done by the thing itself; a step without one is done only by Next. */
  done?: (f: TutorialFacts) => boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'look', title: 'Look around', text: 'Drag with one finger to slide the map. Pinch with two to zoom in and out. Give it a try.', target: 'map', done: (f) => f.moved },
  { id: 'founder', title: 'This is you', text: 'The ♛ button opens your founder: where they go, their work, their purse, their gear and their heir. The townsfolk live their own lives, but you steer the founder.', target: 'founder', done: (f) => f.opened.includes('founder') },
  { id: 'build', title: 'You order every building', text: 'Open Town to build. Every home, wall, field and street is yours to order; the town picks the spot, and tells you what it thinks it needs next.', target: 'tab:build', done: (f) => f.opened.includes('build') },
  { id: 'research', title: 'Pick what to learn', text: 'Open Studies. Three topics are offered at a time: pick one and the town sets to work on it. Leave it, and the town picks for you.', target: 'tab:research', done: (f) => f.opened.includes('research') },
  { id: 'stores', title: 'Coins and materials', text: 'Up here are the town’s coins and main materials. Tap them to see the whole store.', target: 'stores', done: (f) => f.opened.includes('build') },
  { id: 'clear', title: 'Clear the land', text: 'The pickaxe clears trees and rock. Turn it on, then drag over what you want gone: the townsfolk clear it first. Tap it again to stop.', target: 'clear', done: (f) => f.clearing },
  { id: 'fog', title: 'The unknown', text: 'Only what the town has seen shows. Send people out, or build outward, and more of the land comes into view.', target: 'none' },
  { id: 'popups', title: 'Pop-ups and choices', text: 'The town waits while a pop-up is open. The ✕ in its corner closes it. A choice you close waits behind the ❓ button, and settles itself in time if you leave it.', target: 'none' },
];

/** Whether the step at `i` counts as done by what the player has done. */
export const stepDone = (i: number, f: TutorialFacts): boolean => !!TUTORIAL_STEPS[i]?.done?.(f);

/* -------------------------------------------------------------- kept in storage */

const KEY = 'littletown.tutorial';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const safe = <T>(f: () => T, otherwise: T): T => {
  try {
    return f();
  } catch {
    return otherwise;
  }
};

/** A new town was founded: the tutorial is waiting for it, unless it has been done or skipped already. */
export function tutorialFounded(st: Store): void {
  safe(() => {
    if (st.getItem(KEY) !== 'done') st.setItem(KEY, 'pending');
  }, undefined);
}
/** Whether a founded town is waiting to be shown the tutorial. */
export const tutorialPending = (st: Store): boolean => safe(() => st.getItem(KEY) === 'pending', false);
/** Done or skipped: it isn't shown again (a replay from Settings still can be). */
export function tutorialFinished(st: Store): void {
  safe(() => st.setItem(KEY, 'done'), undefined);
}

/** Whether the tutorial's cards are up now: the tips' notices wait for it. */
let active = false;
export const tutorialActive = () => active;
export const setTutorialActive = (on: boolean) => {
  active = on;
};
