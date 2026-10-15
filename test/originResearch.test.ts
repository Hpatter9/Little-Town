import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forgone, laneName, ORIGIN_RESEARCH, studyPace, topicName } from '../src/shared/data/originResearch';
import { ORIGINS } from '../src/shared/data/origins';
import { BRANCH_NAMES, TOPIC_BY_ID, TOPICS } from '../src/shared/data/research';
import { canQueue, prereqsMet } from '../src/shared/sim/research';

const shared = TOPICS.filter((t) => !t.origin);

test("every people's own names, lanes, paces and left-out topics refer to real shared topics and lanes", () => {
  for (const [origin, o] of Object.entries(ORIGIN_RESEARCH)) {
    for (const id of Object.keys(o.names ?? {})) assert.ok(TOPIC_BY_ID[id] && !TOPIC_BY_ID[id].origin, `${origin}: no shared topic ${id}`);
    for (const id of o.forgone ?? []) assert.ok(TOPIC_BY_ID[id] && !TOPIC_BY_ID[id].origin, `${origin}: no shared topic ${id} to forgo`);
    for (const b of Object.keys(o.lanes ?? {})) assert.ok(b in BRANCH_NAMES, `${origin}: no lane ${b}`);
    for (const [b, p] of Object.entries(o.pace ?? {})) {
      assert.ok(b in BRANCH_NAMES, `${origin}: no lane ${b}`);
      assert.ok(p! >= 0.5 && p! <= 1.5, `${origin}: ${b} paced ${p}`);
    }
    // (no two of a people's topics go by one name)
    const names = shared.map((t) => topicName(t.id, origin as never));
    const twice = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(twice, [], `${origin}: names used twice`);
  }
});

test('every people but the settlers has its own names for the tree and its lanes, and studies at its own pace', () => {
  for (const origin of ORIGINS) {
    if (origin === 'settlers') {
      assert.equal(topicName('herbalism', origin), 'Herbalism');
      assert.equal(studyPace('herbalism', origin), 1);
      continue;
    }
    const o = ORIGIN_RESEARCH[origin]!;
    assert.ok(Object.keys(o.names ?? {}).length >= 30, `${origin}: few names of its own`);
    assert.equal(Object.keys(o.lanes ?? {}).length, 8, `${origin}: a name for every lane`);
    assert.ok(Object.values(o.pace ?? {}).some((p) => p! < 1) && Object.values(o.pace ?? {}).some((p) => p! > 1), `${origin}: quick at some things, slow at others`);
  }
  assert.equal(topicName('herbalism', 'robot'), 'Lubricants');
  assert.equal(laneName('occult', 'lich'), 'Necromancy');
  assert.ok(studyPace('lichcraft', 'lich') < 1 && studyPace('early_agriculture', 'lich') > 1);
  // (the heritage lines keep their own pace)
  assert.equal(studyPace(TOPICS.find((t) => t.origin === 'lich')!.id, 'lich'), 1);
});

test("the dead and the machines never study raising children or bettering crops, and what comes after stands open", () => {
  const r = { done: [] as string[], queue: [] as string[], progress: {} };
  for (const origin of ['lich', 'robot'] as const) {
    assert.ok(forgone('family_life', origin) && forgone('crop_rotation', origin));
    assert.equal(canQueue(r, 'family_life', 'medieval', origin).ok, false);
    assert.equal(prereqsMet(r, 'crop_rotation', 'medieval', origin).ok, false);
  }
  assert.ok(prereqsMet(r, 'family_life', 'neolithic', 'settlers').ok, 'the living still raise children');
  // (a topic whose prerequisite is left out can be studied once the rest are met: none of the forgone holds a door shut)
  for (const origin of ['lich', 'robot'] as const)
    for (const t of shared) {
      if (forgone(t.id, origin) || t.hidden || t.requiresCount) continue;
      const done = shared.filter((q) => q.id !== t.id && !forgone(q.id, origin)).map((q) => q.id);
      assert.ok(prereqsMet({ done, queue: [], progress: {} }, t.id, 'space', origin).ok, `${origin}: ${t.id} shut`);
    }
});
