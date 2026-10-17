// The loading screen's sums (mobile/loading.ts), kept pure for the tests. The bar is never a fake: it is the files
// loaded over the files wanted (the page's own scripts, the town from the save, then the pictures the first view
// draws), and the screen leaves as soon as the first set is in, but not before it can be read. If loading stalls, a
// "Tap to enter" is offered, so a missing picture can never keep the player out.

/** A count of files: how many are wanted, how many have arrived (or failed: settled either way). */
export interface LoadCount {
  wanted: number;
  done: number;
}

/** The least time the screen stays up (ms), long enough to read the logo; the town is never held back longer. */
export const MIN_SHOW_MS = 600;
/** How long without a file arriving before "Tap to enter" is offered (ms). */
export const STALL_MS = 8000;
/** How long the screen takes to fade into the town (ms). */
export const FADE_MS = 450;

/** The share loaded, 0..1: every file wanted, over every one in. Nothing wanted yet is nothing loaded. */
export function loadShare(parts: readonly LoadCount[]): number {
  let wanted = 0;
  let done = 0;
  for (const p of parts) {
    wanted += Math.max(0, p.wanted);
    done += Math.max(0, Math.min(p.done, p.wanted));
  }
  return wanted > 0 ? done / wanted : 0;
}

/** Where the screen is: still loading, ready to leave (the first set is in and it has been up long enough), or
 *  stalled (nothing has arrived for a while: the player may tap through). */
export function loadStage(o: { shownAt: number; now: number; ready: boolean; movedAt: number }): 'loading' | 'reveal' | 'stalled' {
  if (o.ready) return o.now - o.shownAt >= MIN_SHOW_MS ? 'reveal' : 'loading';
  return o.now - Math.max(o.shownAt, o.movedAt) >= STALL_MS ? 'stalled' : 'loading';
}

/** What is loading, said in the game's voice, by what is on its way. */
export type LoadStep = 'page' | 'town' | 'strip' | 'ground' | 'buildings' | 'wall' | 'people' | 'done';
const LINES: Record<LoadStep, string[]> = {
  page: ['Unrolling the map', 'Winding the town clock'],
  town: ['Reading the annals', 'Counting the goats'],
  strip: ['Sweeping the square', 'Airing the beds'],
  ground: ['Laying the fields', 'Treading the paths'],
  buildings: ['Lighting the lamps', 'Stoking the hearths'],
  wall: ['Raising the walls', 'Setting the gate'],
  people: ['Waking the townsfolk', 'Counting the goats'],
  done: ['Opening the gates'],
};
/** The line for a step; `n` turns between its lines (a slow step reads a second one). */
export const loadLine = (step: LoadStep, n = 0): string => {
  const l = LINES[step];
  return `${l[Math.abs(Math.floor(n)) % l.length]}…`;
};

/** How many of a scene's `lights` are lit at a share loaded (the town waking up as the bar fills): none at the start,
 *  all of them once everything is in. */
export const lightsLit = (share: number, lights: number): number => Math.max(0, Math.min(lights, Math.floor(share * lights + 1e-9)));

/** Duchess's gag on the loading screen (mobile/loading.ts), by how many times the game has been loaded, so it isn't the
 *  same every time: ambling across the screen as the bar fills, stopping to chew, or wandering back and forth. */
export type DuchessGag = 'amble' | 'chew' | 'wander';
const GAGS: readonly DuchessGag[] = ['amble', 'chew', 'wander'];
export const duchessGag = (loads: number): DuchessGag => GAGS[((Math.floor(loads) % GAGS.length) + GAGS.length) % GAGS.length];
