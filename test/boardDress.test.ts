import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { BIOMES } from '../src/shared/data/biomes';
import { DECOR_KINDS } from '../src/shared/sim/raidBoards';
import type { TacTile } from '../src/shared/sim/tactics';
import { ALONG_Y } from '../src/renderer/iso/isoKits';
import { DECOR_ART, FLORA, floraOf, generatedDecor, joinOf, runParts, type Join } from '../src/renderer/tactics/boardDress';

const J = (s: string): Join => ({ n: s.includes('n'), e: s.includes('e'), s: s.includes('s'), w: s.includes('w') });

test('a wall or fence piece lies along its run whichever way its picture was drawn', () => {
  // (a picture lying along u: a run along u as it is, along v mirrored)
  assert.deepEqual(runParts(J('ew'), 'u', 'u'), [{ flip: false }]);
  assert.deepEqual(runParts(J('w'), 'u', 'u'), [{ flip: false }]);
  assert.deepEqual(runParts(J('ns'), 'u', 'u'), [{ flip: true }]);
  assert.deepEqual(runParts(J('s'), 'u', 'u'), [{ flip: true }]);
  // (a fence drawn lying along v: the other way about)
  assert.deepEqual(runParts(J('ew'), 'u', 'v'), [{ flip: true }]);
  assert.deepEqual(runParts(J('ns'), 'u', 'v'), [{ flip: false }]);
  // (on its own, along the way it's told)
  assert.deepEqual(runParts(J(''), 'v', 'u'), [{ flip: true }]);
  assert.deepEqual(runParts(J(''), 'u', 'u'), [{ flip: false }]);
  assert.deepEqual(runParts(J(''), 'v', 'v'), [{ flip: false }]);
});

test('a corner or a tee is a half piece toward each neighbour, the half on that side of the picture', () => {
  // (a picture along u: its left half toward -u; mirrored along v, its left half lands toward -v)
  assert.deepEqual(runParts(J('ws'), 'u', 'u'), [{ flip: false, half: 'a' }, { flip: true, half: 'b' }]);
  assert.deepEqual(runParts(J('en'), 'u', 'u'), [{ flip: false, half: 'b' }, { flip: true, half: 'a' }]);
  // (a picture along v: its left half toward +v; mirrored along u, its left half lands toward +u)
  assert.deepEqual(runParts(J('es'), 'u', 'v'), [{ flip: true, half: 'a' }, { flip: false, half: 'a' }]);
  assert.deepEqual(runParts(J('wn'), 'u', 'v'), [{ flip: true, half: 'b' }, { flip: false, half: 'b' }]);
  assert.equal(runParts(J('wes'), 'u', 'u').length, 3);
});

test('joins are the same piece beside it, on the board', () => {
  const fence = new Set(['1,1', '2,1', '2,2']);
  const same = (u: number, v: number) => fence.has(`${u},${v}`);
  assert.deepEqual(joinOf(4, 4, 2, 1, same), { n: false, e: false, s: true, w: true });
  assert.deepEqual(joinOf(4, 4, 0, 0, () => true), { n: false, e: true, s: true, w: false });
});

test('every picture the board is dressed with is on disk: each land’s trees, bushes and rocks, the dressing, the pieces lying along y', () => {
  const has = (kp: string) => existsSync(`src/renderer/art/iso/kits/${kp}.png`);
  for (const b of BIOMES) {
    const f = FLORA[b];
    assert.ok(f.tree.length >= 2 && f.bush.length >= 1 && f.rock.length >= 1, b);
    for (const kp of [...f.tree, ...f.bush, ...f.rock]) assert.ok(has(kp), `${b}: ${kp}`);
  }
  for (const k of DECOR_KINDS) {
    const art = DECOR_ART[k];
    assert.ok(art.pieces.length || k === 'drift', k);
    for (const kp of art.pieces) assert.ok(has(kp), `${k}: ${kp}`);
  }
  for (const kp of ALONG_Y) assert.ok(has(kp), kp);
  // (in winter the green lands' trees are snowy, the desert's are its own)
  assert.ok(floraOf('forest', 'winter').tree.every((t) => t.startsWith('moonpack/')));
  assert.deepEqual(floraOf('desert', 'winter'), FLORA.desert);
});

test('a generated board is strewn with a little of the same: never on a road, a wall, cover or a trap; reeds by the water', () => {
  const tile = (g: TacTile['g'], extra: Partial<TacTile> = {}, x = 0): TacTile => ({ h: 1, g, lx: x, ly: x * 7, ...extra });
  let some = 0;
  let reeds = 0;
  for (let x = 0; x < 400; x++) {
    if (generatedDecor(tile('grass', {}, x), 'forest', false, false, 'summer')) some++;
    if (generatedDecor(tile('grass', {}, x), 'forest', true, false, 'summer') === 'reeds') reeds++;
    for (const extra of [{ road: true }, { wall: 'palisade_wall' }, { tree: true }, { bush: true }, { log: true }, { trap: 3 }, { block: 'rock' as const }])
      assert.equal(generatedDecor(tile('grass', extra, x), 'forest', true, true, 'summer'), undefined);
    assert.equal(generatedDecor(tile('water', {}, x), 'forest', true, true, 'summer'), undefined);
  }
  assert.ok(some > 30 && some < 140, `${some} of 400 open tiles dressed`);
  assert.ok(reeds > 120, `${reeds} of 400 by the water reeds`);
  assert.equal(generatedDecor(tile('grass', {}, 5), 'forest', false, false, 'summer'), generatedDecor(tile('grass', {}, 5), 'forest', false, false, 'summer'), 'the same every redraw');
});
