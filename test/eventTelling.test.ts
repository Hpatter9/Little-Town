import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACKDROPS } from '../src/shared/data/backdrops';
import { EVENTS, EVENT_BY_ID } from '../src/shared/data/events';
import { EVENT_MORE } from '../src/shared/data/eventMore';
import { PICTURE_OF, eventPicture, themeOf, type SceneNow } from '../src/shared/data/eventScenes';
import { Rng } from '../src/shared/rng';
import { startEvent } from '../src/shared/sim/events';
import { plainGame } from './helpers';

test('every event has a passage of its own, and every passage an event', () => {
  assert.deepEqual(EVENTS.filter((e) => !EVENT_MORE[e.id]).map((e) => e.id), []);
  assert.deepEqual(Object.keys(EVENT_MORE).filter((id) => !EVENT_BY_ID[id]), []);
  const seen = new Set<string>();
  for (const t of Object.values(EVENT_MORE)) {
    assert.ok(!seen.has(t), `a passage told twice: ${t}`);
    seen.add(t);
  }
});

test('every event has a picture that suits it, looked over by hand where its words mislead', () => {
  assert.deepEqual(Object.keys(PICTURE_OF).filter((id) => !EVENT_BY_ID[id]), []);
  assert.deepEqual(EVENTS.filter((e) => !themeOf(e.id, `${e.title} ${e.text}`)).map((e) => e.id), []);
  const now: SceneNow = { hour: 12, season: 'summer', weather: 'clear', biome: 'forest', era: 'medieval', sea: false };
  for (const e of EVENTS) for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) assert.ok(eventPicture(e.id, `${e.title} ${e.text}`, { ...now, season }) in BACKDROPS);
  // a few by eye: a market in a medieval town is no neon city, a field no iceberg, a grave no saloon
  const pic = (id: string, over: Partial<SceneNow> = {}) => eventPicture(id, `${EVENT_BY_ID[id].title} ${EVENT_BY_ID[id].text}`, { ...now, ...over });
  assert.ok(!/city|future/.test(pic('market_fair')));
  assert.match(pic('market_fair', { era: 'modern' }), /city/);
  assert.match(pic('bumper_crop'), /summer|nature_4|autumn/);
  assert.match(pic('dead_walk'), /graves|abandoned_3|moon_3/);
  assert.match(pic('great_fire'), /skies_4|wasteland_1/);
  assert.match(pic('o_mer_pearl'), /underwater/);
  assert.match(pic('bear'), /forest|abandoned_3/);
});

test('an event is told in full: the scene set, its text, its passage, its picture and who is in it', () => {
  const s = plainGame('telling');
  startEvent(s, EVENT_BY_ID.bear, new Rng(1));
  const p = s.prompts.find((q) => q.kind === 'event')!;
  assert.ok(p.story && p.story.includes(EVENT_BY_ID.bear.text) && p.story.includes(EVENT_MORE.bear));
  assert.ok(p.story.length > EVENT_BY_ID.bear.text.length + EVENT_MORE.bear.length);
  assert.ok(p.picture && p.picture in BACKDROPS);
});
