// A sped-up replay of the time away (the owner's ask): back on the phone, before the morning report card, a few
// seconds of the town fast-forwarded over what happened while away: buildings going up, the days and nights turning,
// the seasons changing, captioned with the day count ("Day 12 → Day 13"), skippable with a tap.
//
// The sim isn't run twice: while the catch-up runs (gameLoop.ts `sampler`), a light frame of the town is kept every
// game hour (`REPLAY_EVERY`): the clock, the weather and the buildings (`frameOf`), the rest left out; at the end
// `ReplayRecorder.finish` says whether there's a replay worth showing (`replayWanted`: at least `REPLAY_LEAST_HOURS`
// game hours passed, and no raid at the gate or choice event holding the town), and the strip plays the frames back
// through the map renderer (renderer/replay/replayPlayer.ts). Pure: the tests reach all of it.

import type { Snapshot } from './sim/snapshot';
import { TICKS_PER_HOUR } from './sim/time';

/** A frame each game hour. */
export const REPLAY_EVERY = TICKS_PER_HOUR;
/** No replay for an absence shorter than this many game hours (a nap isn't worth a show). */
export const REPLAY_LEAST_HOURS = 3;
/** At most this many frames (an absence passes at most a game day, sim/offline.ts: 25 at a frame an hour). */
export const REPLAY_MOST_FRAMES = 30;
/** How long the replay plays (ms): `REPLAY_MS_PER_HOUR` a game hour, between the shortest and the longest. */
export const REPLAY_SHORTEST_MS = 5000;
export const REPLAY_LONGEST_MS = 8000;
export const REPLAY_MS_PER_HOUR = 320;

/** What a frame keeps of the town: enough to draw it from above, the clock and the weather. */
export type ReplayFrame = Pick<Snapshot, 'tick' | 'calendar' | 'weather' | 'buildings' | 'villageBuildings' | 'castle' | 'era'> & {
  /** How many lived in the town. */
  people: number;
};
export interface Replay {
  frames: ReplayFrame[];
}

/** A snapshot's frame (its buildings are already the snapshot's own copies). */
export function frameOf(s: Snapshot): ReplayFrame {
  return { tick: s.tick, calendar: s.calendar, weather: s.weather, buildings: s.buildings, villageBuildings: s.villageBuildings, castle: s.castle, era: s.era, people: s.people.length };
}

/** What's holding the town as the catch-up ends: then there's no show (the gate prompt or the question comes first). */
export interface ReplayHold {
  raidAtGate: boolean;
  eventHeld: boolean;
  gameOver: boolean;
}

/** The game hours between the first frame and the last. */
export function hoursOf(frames: readonly Pick<ReplayFrame, 'tick'>[]): number {
  return frames.length < 2 ? 0 : (frames[frames.length - 1].tick - frames[0].tick) / TICKS_PER_HOUR;
}

/** Whether frames like these make a replay: long enough, and nothing holding the town. */
export function replayWanted(frames: readonly Pick<ReplayFrame, 'tick'>[], hold: ReplayHold): boolean {
  return !hold.raidAtGate && !hold.eventHeld && !hold.gameOver && hoursOf(frames) >= REPLAY_LEAST_HOURS;
}

/** At most `most` frames, evenly spread, the first and the last always kept. */
export function thin<T>(frames: readonly T[], most = REPLAY_MOST_FRAMES): T[] {
  if (frames.length <= most) return [...frames];
  const out: T[] = [];
  for (let i = 0; i < most; i++) out.push(frames[Math.round((i * (frames.length - 1)) / (most - 1))]);
  return out;
}

/** How long a replay of `hours` game hours plays (ms). */
export function replayLength(hours: number): number {
  return Math.round(Math.max(REPLAY_SHORTEST_MS, Math.min(REPLAY_LONGEST_MS, hours * REPLAY_MS_PER_HOUR)));
}

/** Where in the frames a replay `ms` in stands: the frame (`i`) and how far toward the next (`f`, 0..1), by game time,
 *  so the hours pass evenly however the frames fell. `done` once it has played through. */
export function replayAt(frames: readonly Pick<ReplayFrame, 'tick'>[], ms: number, length: number): { i: number; f: number; done: boolean } {
  if (frames.length < 2) return { i: 0, f: 0, done: true };
  const share = Math.max(0, Math.min(1, ms / Math.max(1, length)));
  const t0 = frames[0].tick;
  const tick = t0 + share * (frames[frames.length - 1].tick - t0);
  let i = 0;
  while (i < frames.length - 2 && frames[i + 1].tick <= tick) i++;
  const span = frames[i + 1].tick - frames[i].tick;
  return { i, f: span > 0 ? Math.max(0, Math.min(1, (tick - frames[i].tick) / span)) : 0, done: ms >= length };
}

/** The light and the hour between two frames: the daylight eased across, the hour going on past midnight. */
export function lightBetween(a: Pick<ReplayFrame, 'calendar'>, b: Pick<ReplayFrame, 'calendar'>, f: number): { daylight: number; hour: number } {
  const ha = a.calendar.hour + a.calendar.minute / 60;
  let hb = b.calendar.hour + b.calendar.minute / 60;
  if (hb < ha) hb += 24;
  return { daylight: a.calendar.daylight + (b.calendar.daylight - a.calendar.daylight) * f, hour: (ha + (hb - ha) * f) % 24 };
}

const clock = (c: ReplayFrame['calendar']) => `${String(c.hour).padStart(2, '0')}:00`;
const SEASON: Readonly<Record<string, string>> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

/** The replay's title: "Day 12 → Day 13", or within one day "Day 12, 06:00 → 15:00". */
export function replayTitle(first: ReplayFrame, last: ReplayFrame): string {
  const a = first.calendar;
  const b = last.calendar;
  return a.day === b.day ? `Day ${a.day}, ${clock(a)} → ${clock(b)}` : `Day ${a.day} → Day ${b.day}`;
}
/** The running line under it: the day, the hour and the season (and the weather when it's foul). */
export function replayClock(at: ReplayFrame, hour: number): string {
  const c = at.calendar;
  const h = `${String(Math.floor(hour)).padStart(2, '0')}:00`;
  const foul: Readonly<Record<string, string>> = { rain: ' · Rain', storm: ' · Storm', snow: ' · Snow', fog: ' · Fog' };
  return `Day ${c.day} · ${h} · ${SEASON[c.season] ?? c.season}${foul[at.weather.kind] ?? ''}`;
}
/** What the time away raised: the buildings finished, the townsfolk now. */
export function replayTally(first: ReplayFrame, last: ReplayFrame): string {
  const before = new Set(first.buildings.filter((b) => b.status === 'done').map((b) => b.id));
  const built = last.buildings.filter((b) => b.status === 'done' && !before.has(b.id) && !b.ring).length;
  const folk = last.people - first.people;
  const parts: string[] = [];
  if (built) parts.push(`${built} building${built === 1 ? '' : 's'} raised`);
  if (folk) parts.push(`${folk > 0 ? '+' : '−'}${Math.abs(folk)} townsfolk`);
  return parts.join(' · ');
}

/** Keeps the frames as the catch-up runs, and says at the end whether they make a replay. */
export class ReplayRecorder {
  private frames: ReplayFrame[] = [];

  /** A frame of the town, part way through. */
  add(s: Snapshot): void {
    if (this.frames.length && s.tick <= this.frames[this.frames.length - 1].tick) return;
    this.frames.push(frameOf(s));
  }

  /** The catch-up done: the last frame, and what's holding the town. The frames are dropped either way. */
  finish(last: Snapshot, hold: ReplayHold): Replay | null {
    this.add(last);
    const frames = this.frames;
    this.frames = [];
    return replayWanted(frames, hold) ? { frames: thin(frames) } : null;
  }
}
