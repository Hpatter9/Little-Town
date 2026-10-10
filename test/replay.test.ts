import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoursOf, lightBetween, REPLAY_EVERY, REPLAY_LEAST_HOURS, REPLAY_LONGEST_MS, REPLAY_MOST_FRAMES, REPLAY_SHORTEST_MS, replayAt, replayClock, replayLength, ReplayRecorder, replayTally, replayTitle, replayWanted, thin, type Replay, type ReplayFrame } from '../src/shared/replay';
import { GameLoop } from '../src/shared/gameLoop';
import { serialize } from '../src/shared/sim/save';
import { calendar, TICK_MS, TICKS_PER_HOUR } from '../src/shared/sim/time';
import type { Snapshot } from '../src/shared/sim/snapshot';
import { plainGame } from './helpers';

const free = { raidAtGate: false, eventHeld: false, gameOver: false };
const frame = (tick: number, extra: Partial<ReplayFrame> = {}): ReplayFrame =>
  ({ tick, calendar: calendar(tick), weather: { kind: 'clear' }, buildings: [], villageBuildings: [], castle: null, era: 'stone', people: 3, ...extra }) as unknown as ReplayFrame;

test('a replay only for an absence of a few game hours or more, and none while a raid or a question holds the town', () => {
  const hours = (h: number) => [frame(0), frame(h * TICKS_PER_HOUR)];
  assert.equal(replayWanted(hours(REPLAY_LEAST_HOURS - 1), free), false);
  assert.equal(replayWanted(hours(REPLAY_LEAST_HOURS), free), true);
  assert.equal(replayWanted(hours(12), { ...free, raidAtGate: true }), false);
  assert.equal(replayWanted(hours(12), { ...free, eventHeld: true }), false);
  assert.equal(replayWanted(hours(12), { ...free, gameOver: true }), false);
  assert.equal(hoursOf(hours(7)), 7);
});

test('a few seconds long, the frames thinned evenly, the hours passing evenly', () => {
  assert.equal(replayLength(1), REPLAY_SHORTEST_MS);
  assert.equal(replayLength(240), REPLAY_LONGEST_MS);
  assert.ok(replayLength(24) >= 5000 && replayLength(24) <= 8000);
  const many = Array.from({ length: 100 }, (_, i) => i);
  const few = thin(many);
  assert.equal(few.length, REPLAY_MOST_FRAMES);
  assert.equal(few[0], 0);
  assert.equal(few.at(-1), 99);
  const frames = [frame(0), frame(600), frame(1200), frame(1800)];
  assert.deepEqual(replayAt(frames, 0, 3000), { i: 0, f: 0, done: false });
  const mid = replayAt(frames, 1500, 3000);
  assert.equal(mid.i, 1);
  assert.ok(Math.abs(mid.f - 0.5) < 1e-9);
  assert.equal(replayAt(frames, 3000, 3000).done, true);
  assert.equal(replayAt(frames, 3000, 3000).i, 2, 'the last span, at its end');
});

test('the light turns smoothly between frames, past midnight too', () => {
  const night = frame(0);
  const a = { calendar: { ...night.calendar, hour: 23, minute: 0, daylight: 0 } };
  const b = { calendar: { ...night.calendar, hour: 1, minute: 0, daylight: 0.2 } };
  const l = lightBetween(a, b, 0.5);
  assert.equal(l.hour, 0);
  assert.ok(Math.abs(l.daylight - 0.1) < 1e-9);
});

test('captioned with the day count, the clock and what was raised', () => {
  const day = 24 * TICKS_PER_HOUR;
  const a = frame(0, { buildings: [{ id: 1, status: 'done' }, { id: 2, status: 'blueprint' }] as never, people: 4 });
  const b = frame(day, { buildings: [{ id: 1, status: 'done' }, { id: 2, status: 'done' }, { id: 3, status: 'done' }, { id: 9, status: 'done', ring: 1 }] as never, people: 6 });
  assert.equal(replayTitle(a, b), `Day ${a.calendar.day} → Day ${b.calendar.day}`);
  assert.match(replayTitle(a, frame(5 * TICKS_PER_HOUR)), /^Day \d+, \d\d:00 → \d\d:00$/);
  assert.equal(replayTally(a, b), '2 buildings raised · +2 townsfolk');
  assert.equal(replayTally(a, a), '');
  assert.match(replayClock(frame(0, { weather: { kind: 'rain' } as never }), 14.6), /^Day \d+ · 14:00 · (Spring|Summer|Autumn|Winter) · Rain$/);
});

/** Runs a catch-up of `awayMs` to its end, a slice at a time, as the loop's own timer would. */
function catchUpFully(loop: GameLoop, awayMs: number): void {
  loop.catchUp(awayMs);
  const slice = (loop as unknown as { catchUpSlice(): void }).catchUpSlice.bind(loop);
  for (let i = 0; i < 10_000 && loop.catchingUp; i++) slice();
}

test('the catch-up keeps a frame each game hour without changing what happens, and the recorder makes the replay', () => {
  const awayMs = 6 * 60_000; // (six minutes away: six game hours, all in play time)
  const plain = new GameLoop(plainGame('replay-1'), () => {});
  plain.snapshot(); // (as the first frame is: a snapshot settles a founder's age the first time it's asked, ageing.ts)
  catchUpFully(plain, awayMs);

  const loop = new GameLoop(plainGame('replay-1'), () => {});
  const rec = new ReplayRecorder();
  const ticks: number[] = [];
  let made: Replay | null = null;
  loop.sampler = {
    every: REPLAY_EVERY,
    take: (snap: Snapshot, done: boolean) => {
      if (!done) {
        ticks.push(snap.tick);
        rec.add(snap);
      } else made = rec.finish(snap, free);
    },
  };
  catchUpFully(loop, awayMs);
  // (the sampled run is the same town as the plain one)
  assert.equal(serialize(loop.state, 0), serialize(plain.state, 0));
  assert.equal(loop.state.tick, Math.floor(awayMs / TICK_MS));
  assert.ok(ticks.length >= 6, `${ticks.length} frames`);
  for (let i = 1; i < ticks.length; i++) assert.equal(ticks[i] - ticks[i - 1], REPLAY_EVERY, 'a frame each game hour');
  const r = made as Replay | null;
  assert.ok(r, 'six hours: worth a replay');
  assert.equal(r!.frames.at(-1)!.tick, loop.state.tick, 'ending on the town as it is');
  assert.ok(r!.frames.every((f) => Array.isArray(f.buildings) && typeof f.calendar.daylight === 'number'));
});

test('a short catch-up makes no replay', () => {
  const loop = new GameLoop(plainGame('replay-2'), () => {});
  const rec = new ReplayRecorder();
  let made: Replay | null | undefined;
  loop.sampler = { every: REPLAY_EVERY, take: (snap, done) => (done ? (made = rec.finish(snap, free)) : rec.add(snap)) };
  catchUpFully(loop, 90_000);
  assert.equal(made, null);
});
