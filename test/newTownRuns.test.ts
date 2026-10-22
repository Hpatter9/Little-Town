import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGINS } from '../src/shared/data/origins';
import { shown, type ShownNode } from '../src/renderer/mobile/popupHold';
import { blocksTown, holdOf } from '../src/shared/sim/popups';
import { Sim } from '../src/shared/sim/sim';
import { newGame } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';

// The owner's report: "The town isn't doing anything and it doesn't seem like time is passing. I just started a new one."
// (docs/notes/new-town-stuck.md)

for (const origin of ORIGINS) {
  test(`a new ${origin} town runs: its clock moves and its people set to work in the first hours`, () => {
    const s = newGame(`fresh-${origin}`, { origin });
    assert.notEqual(s.autopilot, false, 'the town runs itself');
    assert.equal(holdOf(s), null, 'nothing holds a town just founded');
    const sim = new Sim(s);
    const busy = new Set<string>();
    let asked = 0;
    for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) {
      // (a player reads each card that comes up, the founding story an hour in among them, and answers it)
      const q = s.prompts.find(blocksTown);
      if (q && holdOf(s) === 'popup') {
        asked++;
        sim.command({ type: 'answerPrompt', prompt: q.id, option: q.defaultOption });
      }
      sim.step(holdOf(s));
      for (const p of s.people) if (p.task && p.task.type !== 'idle' && p.task.type !== 'wander') busy.add(p.task.type);
    }
    assert.ok(s.tick >= 3 * TICKS_PER_HOUR - asked * 2, `the clock moved (${s.tick}, ${asked} cards answered)`);
    assert.ok(busy.size > 0, 'someone did some work');
  });
}

/** A made-up page node: `display` is its own style, as `getComputedStyle` gives it (blind to its parents). */
const node = (hidden: boolean, parent: (ShownNode & { display: string }) | null = null, display = 'block') => ({ hidden, parentElement: parent, display });
const displayOf = (n: { display: string }) => n.display;

test('a card inside a hidden box is not up (the tutorial veil held every new town)', () => {
  const root = node(true);
  const veil = node(false, root);
  assert.equal(shown(veil, displayOf), false, 'its hidden root hides it');
  root.hidden = false;
  assert.equal(shown(veil, displayOf), true);
  root.display = 'none';
  assert.equal(shown(veil, displayOf), false, 'a root with display: none hides it too');
  assert.equal(shown(node(true, null), displayOf), false);
});
