import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepDone, tutorialFinished, tutorialFounded, tutorialPending, TUTORIAL_STEPS, type TutorialFacts } from '../src/renderer/mobile/tutorialSteps';

const none: TutorialFacts = { opened: [], moved: false, clearing: false };
const at = (id: string) => TUTORIAL_STEPS.findIndex((s) => s.id === id);
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test('each step counts as done by its own thing', () => {
  assert.equal(stepDone(at('look'), none), false);
  assert.equal(stepDone(at('look'), { ...none, moved: true }), true);
  assert.equal(stepDone(at('founder'), { ...none, opened: ['build'] }), false);
  assert.equal(stepDone(at('founder'), { ...none, opened: ['founder'] }), true);
  assert.equal(stepDone(at('build'), { ...none, opened: ['build'] }), true);
  assert.equal(stepDone(at('research'), { ...none, opened: ['research'] }), true);
  assert.equal(stepDone(at('clear'), { ...none, clearing: true }), true);
});

test('steps with no thing to do wait for Next', () => {
  for (const id of ['fog', 'popups']) assert.equal(stepDone(at(id), { opened: ['build', 'founder'], moved: true, clearing: true }), false);
});

test('six to eight steps, each with words', () => {
  assert.ok(TUTORIAL_STEPS.length >= 6 && TUTORIAL_STEPS.length <= 8);
  for (const s of TUTORIAL_STEPS) assert.ok(s.title && s.text);
});

test('a new town waits for the tutorial once; done or skipped, never again', () => {
  const st = memory();
  assert.equal(tutorialPending(st), false); // (a loaded save is never shown it)
  tutorialFounded(st);
  assert.equal(tutorialPending(st), true);
  tutorialFinished(st);
  assert.equal(tutorialPending(st), false);
  tutorialFounded(st); // (the next new town)
  assert.equal(tutorialPending(st), false);
});
