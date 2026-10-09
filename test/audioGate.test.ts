import { test } from 'node:test';
import assert from 'node:assert/strict';

test('no sound while the game is in the background: contexts suspended, tracks paused, and both back on return', async () => {
  // (a page that can be hidden: the gate listens to it when it loads)
  const on: Record<string, (() => void)[]> = {};
  const listen = (k: string, f: () => void) => (on[k] ??= []).push(f);
  const doc = { hidden: false, addEventListener: listen };
  Object.assign(globalThis, { document: doc, window: { addEventListener: listen } });
  const gate = await import('../src/renderer/audioGate');
  const fire = (k: string) => on[k]?.forEach((f) => f());

  const ctx = { state: 'running', suspend: async () => void (ctx.state = 'suspended'), resume: async () => void (ctx.state = 'running') };
  const track = { paused: false, pause: () => void (track.paused = true), play: async () => void (track.paused = false) };
  gate.gateContext(ctx as unknown as AudioContext);
  gate.gateTrack(track as unknown as HTMLMediaElement);
  let backs = 0;
  gate.onBack(() => backs++);

  doc.hidden = true;
  fire('visibilitychange');
  await Promise.resolve();
  assert.equal(ctx.state, 'suspended', 'the music and sounds stop');
  assert.ok(track.paused, 'the recorded track pauses');
  // (a timer that would start the next piece can't wake it while away)
  gate.wake(ctx as unknown as AudioContext);
  await Promise.resolve();
  assert.equal(ctx.state, 'suspended');
  assert.ok(gate.pageAway());

  doc.hidden = false;
  fire('visibilitychange');
  await Promise.resolve();
  assert.equal(ctx.state, 'running', 'back in sight, the sound carries on');
  assert.ok(!track.paused);
  assert.equal(backs, 1);
});
