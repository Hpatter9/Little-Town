// The phone buzzes softly at the big moments (the owner's ask): the raid horn, a thunderclap, an earthquake, a dragon's
// roar and a building coming down, each its own short pattern. Pure but for the setting: the strip says what happened
// (`BUZZ`, `buzzesBetween`), the phone page does the buzzing through the bridge (mobileBridge.ts `vibrate`: never while
// the page is hidden, no oftener than `BUZZ_GAP_MS`, and only with the ☰ menu's "Vibration: on", kept in
// `littletown.vibrate`, on by default; its own toggle, not the sound's).

export type Buzz = 'horn' | 'thunder' | 'quake' | 'roar' | 'collapse';

/** Each moment's pattern (navigator.vibrate's: ms on, ms off, ms on...): short and soft, under a second. */
export const BUZZ: Readonly<Record<Buzz, readonly number[]>> = {
  // two blasts, the second longer, as the horn blows
  horn: [160, 120, 320],
  // the crack, then the roll
  thunder: [40, 50, 140],
  // the ground rolling under you
  quake: [90, 40, 130, 40, 180, 60, 120],
  // a long falling roar
  roar: [260, 60, 140, 60, 70],
  // the crash and the walls going
  collapse: [60, 40, 200],
};
/** The least time between two buzzes (ms): a storm's strikes or a quake's falls aren't a phone rattling on a table. */
export const BUZZ_GAP_MS = 1500;
export const VIBRATE_KEY = 'littletown.vibrate';

/** A cue's buzz, if it has one (ambience.ts's cues). */
export function buzzOfCue(cue: string): Buzz | null {
  switch (cue) {
    case 'horn':
      return 'horn';
    case 'thunder':
      return 'thunder';
    case 'rumble':
      return 'quake';
    case 'roar':
      return 'roar';
    case 'collapse':
      return 'collapse';
    default:
      return null;
  }
}

/** Whether a buzz may go now, after the last at `last` (ms). */
export function mayBuzz(last: number, now: number): boolean {
  return now - last >= BUZZ_GAP_MS;
}

/** The setting as stored: on unless it says off. */
export function vibrateOn(stored: string | null | undefined): boolean {
  return stored !== '0';
}
export function readVibrate(): boolean {
  try {
    return vibrateOn(localStorage.getItem(VIBRATE_KEY));
  } catch {
    return true;
  }
}
export function saveVibrate(on: boolean): void {
  try {
    localStorage.setItem(VIBRATE_KEY, on ? '1' : '0');
  } catch {}
}

/** The parts of a snapshot the buzzes read (the tests build them by hand). */
export interface BuzzTown {
  buildings: { id: number; def: string; status: string; tile: number; row: number; fire?: number; ring?: number }[];
  disaster: { kind: string } | null;
  raid: { phase: string } | null;
  bossShake?: number | null;
}

/** A finished building gone since the last snapshot that came down rather than being taken down: it burned, or fell in
 *  a tornado or an earthquake, or in a raid (a wall or gate broken). A building upgraded keeps its id, and one pulled
 *  down to make room (or the old ring's pieces, or a nomad's tent struck) goes in quiet times, so those don't count. */
export function collapsesBetween(prev: BuzzTown, next: BuzzTown): BuzzTown['buildings'] {
  const now = new Set(next.buildings.map((b) => b.id));
  const shaken = (t: BuzzTown) => t.disaster?.kind === 'quake' || t.disaster?.kind === 'tornado';
  const violent = shaken(prev) || shaken(next) || prev.raid?.phase === 'active' || next.raid?.phase === 'active';
  return prev.buildings.filter((b) => b.status === 'done' && !now.has(b.id) && ((b.fire ?? 0) >= 0.5 || violent));
}

/** The buzzes a snapshot brings: the horn as a raid comes on, the ground as a quake begins or shakes again, a building
 *  coming down. (The thunder and the dragon's roar come from the map's own moments: main.ts.) */
export function buzzesBetween(prev: BuzzTown | null, next: BuzzTown): Buzz[] {
  if (!prev) return [];
  const out: Buzz[] = [];
  if (next.raid?.phase === 'active' && prev.raid?.phase !== 'active') out.push('horn');
  const quake = next.disaster?.kind === 'quake';
  if (quake && (prev.disaster?.kind !== 'quake' || (next.bossShake != null && next.bossShake !== prev.bossShake))) out.push('quake');
  if (collapsesBetween(prev, next).length) out.push('collapse');
  return out;
}
