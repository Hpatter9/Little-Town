import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { CUTSCENES, type Cutscene } from '../src/shared/data/cutscenes';
import { HELD, PROPS, type HeldDef, type PropDef } from '../src/shared/data/sceneProps';
import { actorsAt, lineStart, propsAt, type Cursor } from '../src/renderer/cutscene/sceneClock';

const ART = 'src/renderer/art/';
const at = (shot: number, shotT = 0, beat = 0): Cursor => ({ shot, beat, t: 0, shotT });

test('every prop and held thing a script names is in the tables, and every sprite they name is there to load', () => {
  const artMap = readFileSync('src/renderer/cutscene/propArt.ts', 'utf8');
  const files = [...Object.values(PROPS as Record<string, PropDef>).flatMap((d) => [d.art, d.out, ...(d.dressing ?? []).map((x) => x[0])]), ...Object.values(HELD as Record<string, HeldDef>).map((d) => d.art)];
  for (const f of files) {
    if (!f) continue;
    assert.ok(existsSync(ART + f), `${f} is missing`);
    assert.ok(artMap.includes(`'${f}'`), `${f} is not in cutscene/propArt.ts`);
  }
  for (const [k, d] of Object.entries(PROPS as Record<string, PropDef>)) assert.ok(d.art || d.weather, `${k}: neither a sprite nor the air`);
  for (const [k, d] of Object.entries(HELD as Record<string, HeldDef>)) assert.ok(d.art || d.stick, `${k}: nothing to draw`);
  let named = 0;
  for (const c of Object.values(CUTSCENES)) {
    const all = [...(c.props ?? []), ...c.shots.flatMap((s) => s.props ?? [])];
    const ids = new Set(all.map((p) => p.id));
    for (const p of all) {
      assert.ok(p.kind in PROPS, `${c.id}: no prop kind ${p.kind}`);
      named++;
    }
    for (const m of Object.values(c.cast)) if (m.hold) assert.ok(m.hold in HELD, `${c.id}: no held ${m.hold}`);
    for (const s of c.shots) {
      for (const a of s.acts ?? []) {
        if ('prop' in a) assert.ok(ids.has(a.prop), `${c.id}: no prop ${a.prop} to act on`);
        if ('hold' in a && a.hold !== null) assert.ok(a.hold in HELD, `${c.id}: no held ${a.hold}`);
        if (a.line !== undefined) assert.ok(a.line < (s.lines?.length ?? 0), `${c.id}: an act waits for a line the shot hasn't got`);
      }
      for (const fx of s.fx ?? []) if (fx.includes(':')) assert.ok(ids.has(fx.split(':')[1]), `${c.id}: ${fx}`);
    }
  }
  // (every scene is dressed)
  for (const c of Object.values(CUTSCENES)) assert.ok([...(c.props ?? []), ...c.shots.flatMap((s) => s.props ?? [])].length > 0, `${c.id} has no props`);
  assert.ok(named > 100, `${named} props placed`);
});

test('the warren burns, and the wit leans the marshmallow into it on the joke', () => {
  const c = CUTSCENES.nest_cleared;
  const first = propsAt(c, at(0));
  assert.equal(first.warren.lit, true);
  assert.equal(first.duchess.kind, 'duchess');
  // (the stick is in hand from the start, and goes into the fire only once the third line is spoken)
  assert.equal(actorsAt(c, at(1)).wit.hold, 'marshmallow_stick');
  const third = lineStart(c.shots[1], 2);
  assert.equal(actorsAt(c, at(1, third - 0.1, 1)).wit.pose, 'idle');
  assert.equal(actorsAt(c, at(1, third + 0.1, 2)).wit.pose, 'reach');
  // (she walks up to the fire as the first line is spoken)
  assert.ok(actorsAt(c, at(1, third, 2)).wit.x > 140);
});

test('props keep to their place: the scene\'s own stay, a shot\'s go when the scene cuts away; fire lights, goes out and burns out', () => {
  const c: Cutscene = {
    id: 'probe',
    title: 'Probe',
    cast: { a: { role: 'hero', x: 100, facing: 'right' } },
    props: [{ id: 'rain', kind: 'rain', x: 0 }],
    shots: [
      { look: 'meadows_1', cam: {}, props: [{ id: 'fire', kind: 'campfire', x: 120 }, { id: 'hay', kind: 'hay', x: 160 }, { id: 'goat', kind: 'duchess', x: 40 }], lines: [{ who: 'a', text: 'One.' }, { who: 'a', text: 'Two.' }] },
      { cam: {}, fx: ['ignite:hay', 'douse:fire'], acts: [{ prop: 'goat', move: 80 }, { prop: 'goat', do: 'startle', line: 1 }, { who: 'a', hold: 'torch' }], lines: [{ who: 'a', text: 'Three.' }, { who: 'a', text: 'Four.' }] },
      { cam: {}, acts: [{ prop: 'hay', do: 'break' }, { prop: 'goat', do: 'break' }], hold: 2 },
      { look: 'town', cam: {}, hold: 2 },
    ],
  };
  const s0 = propsAt(c, at(0));
  assert.equal(s0.fire.lit, true, 'a campfire is lit of itself');
  assert.equal(s0.hay.lit, false);
  const s1 = propsAt(c, at(1, 0.5));
  assert.equal(s1.hay.lit, true);
  assert.equal(s1.fire.lit, false);
  assert.equal(s1.fire.out, true, 'doused, it shows cold');
  assert.ok(s1.hay.since < 1);
  assert.equal(s1.goat.startled, false, 'not until its line');
  assert.ok(s1.goat.x > 40 && s1.goat.moving);
  const later = propsAt(c, at(1, lineStart(c.shots[1], 1) + 0.2, 1));
  assert.equal(later.goat.startled, true);
  assert.ok(later.goat.sinceStartled < 1);
  assert.equal(actorsAt(c, at(2)).a.hold, 'torch', 'what is held stays in hand');
  const s2 = propsAt(c, at(2, 1));
  assert.equal(s2.hay.lit, false, 'a thing burning burns out');
  assert.equal(s2.hay.out, true);
  assert.equal(s2.goat.broken, true, 'anything else is knocked over');
  assert.equal(s2.goat.x, 80);
  const s3 = propsAt(c, at(3));
  assert.deepEqual(Object.keys(s3), ['rain'], 'a cut to another place leaves the props behind, but not the weather');
});
