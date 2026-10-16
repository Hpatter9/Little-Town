import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { EVENTS } from '../src/shared/data/events';
import { EVENT_SCENE_IDS } from '../src/shared/data/eventSceneIds';
import manifest from '../src/renderer/art/backdrops.json';
import { EVENT_SCENES, eventByWords, sceneFor } from '../src/renderer/panel/eventScenes';
import { EVENT_PROPS, EVENT_SETS, propFile, setFile } from '../src/renderer/panel/eventProps';
import { CROWD_MAX, eventCast, SLOT } from '../src/renderer/panel/eventCast';
import { eventFamily } from '../src/renderer/panel/sceneScripts';

const ART = 'src/renderer/art/';

test('every choice event names a scene of its own, and it exists', () => {
  const missing = EVENTS.filter((e) => !e.scene).map((e) => e.id);
  assert.deepEqual(missing, [], `events with no scene: ${missing.join(', ')}`);
  for (const e of EVENTS) {
    const id = sceneFor({ kind: 'event', title: e.title, text: e.text, eventId: e.id });
    assert.equal(id, e.scene, e.id);
    assert.ok(EVENT_SCENES[id], `${e.id}: no scene ${id}`);
  }
});

test('an event put without its id is known by its words (two open at once), names and all', () => {
  const fill = (t: string) => t.replaceAll('{who}', 'Ann of the Fens').replaceAll('{founder}', 'Bo');
  for (const e of EVENTS) {
    const title = `${e.fateful ? '⚡ ' : ''}${fill(e.title)}`;
    const text = `${fill(e.text)} (20 coins)`;
    assert.equal(eventByWords(title, text)?.scene, e.scene, e.id);
    assert.equal(sceneFor({ kind: 'event', title, text }), e.scene, e.id);
  }
});

test('the questions that are not choice events find a scene by their kind, and the fallback always lands on one', () => {
  const kinds = ['council', 'trial', 'revolt', 'envoy', 'refugees', 'village', 'dragon', 'enemy', 'secret', 'saga', 'road', 'debrief', 'watch', 'ways'];
  for (const kind of kinds) assert.ok(EVENT_SCENES[sceneFor({ kind, title: 'Something', text: 'happens.' })], kind);
  assert.equal(sceneFor({ kind: 'council', title: 'The council votes on a tax', text: '', about: 'vote' }), 'council');
  assert.equal(sceneFor({ kind: 'trial', title: 'The trial of Ann', text: '' }), 'trial');
  assert.equal(sceneFor({ kind: 'village', title: 'A parting', text: '', about: 'parting' }), 'leaving');
  assert.equal(sceneFor({ kind: 'debrief', title: 'The chronicle of Year 1', text: '' }), 'study');
  // (an unknown event id, or none, falls back to the guess from the words)
  assert.equal(sceneFor({ kind: 'saga', title: 'A plague ship', text: 'Fever aboard.', eventId: 'no_such_event' }), 'plague');
  assert.equal(eventFamily('saga', 'Nothing much', 'at all'), 'generic');
});

test('every scene has a script, its props are in the table and their pictures are present', () => {
  for (const id of EVENT_SCENE_IDS) assert.ok(EVENT_SCENES[id], `no script for ${id}`);
  for (const [id, art] of Object.entries(EVENT_PROPS)) {
    assert.ok(existsSync(ART + propFile(id)), `${id}: no ${propFile(id)}`);
    assert.ok(art.w > 0 && art.h > 0 && art.frames >= 1, id);
  }
  for (const set of EVENT_SETS) assert.ok(existsSync(ART + setFile(set)), set);
  const backs = manifest as Record<string, unknown>;
  for (const [id, sc] of Object.entries(EVENT_SCENES)) {
    for (const p of sc.props ?? []) assert.ok(EVENT_PROPS[p.id], `${id}: no prop ${p.id}`);
    if (sc.back.startsWith('set:')) assert.ok((EVENT_SETS as readonly string[]).includes(sc.back.slice(4)), `${id}: no set ${sc.back}`);
    else assert.ok(backs[sc.back], `${id}: no backdrop ${sc.back}`);
    // (the cast's places: an actor stands in one of the named places, never in the crowd's)
    for (const a of sc.actors) if (typeof a.who === 'number') assert.ok(a.who >= 0 && a.who < SLOT.crowd, `${id}: actor ${a.who}`);
    for (const c of sc.crowd ?? []) assert.equal(c.from, SLOT.crowd, id);
    if (sc.speaker !== undefined) assert.ok(sc.actors[sc.speaker], `${id}: no speaker ${sc.speaker}`);
  }
});

test('the scenes the owner named show what they are about', () => {
  const props = (id: keyof typeof EVENT_SCENES) => new Set((EVENT_SCENES[id].props ?? []).map((p) => p.id));
  assert.equal(EVENT_SCENES.council.back, 'set:hall');
  assert.ok(props('council').has('long_table') && (EVENT_SCENES.council.crowd?.[0].n ?? 0) >= 6 && EVENT_SCENES.council.speaker !== undefined);
  assert.ok(props('gate').has('gate'));
  assert.ok(props('plague').has('sickbed'));
  assert.ok(props('fire').has('fire') && props('fire').has('house') && props('fire').has('bucket'));
  assert.ok(props('trial').has('throne') && (EVENT_SCENES.trial.crowd?.length ?? 0) > 0);
  assert.ok(props('caravan').has('wagon') && props('caravan').has('cask'));
  assert.ok(props('harvest').has('haystack') && props('harvest').has('handcart'));
  assert.ok(props('funeral').has('coffin') && EVENT_SCENES.funeral.fx.some((f) => f.kind === 'rain'));
  assert.ok(props('feast').has('long_table') && props('feast').has('bread'));
  assert.ok(props('envoy').has('banner_red'));
  assert.ok(props('birth').has('cot'));
  assert.ok(props('famine').has('bowl'));
  assert.ok(props('raid_warning').has('fence') && EVENT_SCENES.raid_warning.fx.some((f) => f.kind === 'smoke'));
});

test('the crowd is picked from the event, the same every time, with nobody twice', () => {
  const people = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, grown: i % 5 !== 0 }));
  const a = eventCast(42, people, 7, 1);
  const b = eventCast(42, [...people], 7, 1);
  assert.deepEqual(a, b);
  const c = eventCast(43, people, 7, 1);
  assert.notDeepEqual(a.crowd, c.crowd);
  assert.equal(a.lead, 7);
  assert.equal(a.founder, 1);
  assert.equal(a.elders.length, 3);
  assert.equal(a.crowd.length, CROWD_MAX);
  const all = [a.lead, a.founder, ...a.elders, ...a.crowd];
  assert.equal(new Set(all).size, all.length, 'someone is in the scene twice');
  // (grown-ups at the table, never a child)
  for (const e of a.elders) assert.ok(people.find((p) => p.id === e)!.grown);
  // nobody named: one of the town stands in the middle of it, never the founder twice
  const none = eventCast(42, people, null, 1);
  assert.ok(none.lead !== null && none.lead !== 1 && people.find((p) => p.id === none.lead)!.grown);
  assert.ok(!none.elders.includes(none.lead!) && !none.crowd.includes(none.lead!));
  // a lone founder: they lead, and nobody else is invented
  const lone = eventCast(5, [{ id: 1, grown: true }], null, 1);
  assert.equal(lone.lead, 1);
  assert.deepEqual(lone.crowd, []);
  assert.deepEqual(lone.elders, []);
});
