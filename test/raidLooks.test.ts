import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEMS } from '../src/shared/data/items';
import { snapshot } from '../src/shared/sim/snapshot';
import { newGame } from '../src/shared/sim/state';
import { BOARD_FACING, STRIKE_TICKS, boardCreatureMoves, boardFacing, boardFolkAnim, type BoardMoment } from '../src/renderer/iso/boardRules';
import { BLOW_TICKS, HURT_TICKS, RUN_SPEED, play, wantedAnim, type FolkAnim, type FolkState } from '../src/renderer/iso/folkRules';
import { folkWho } from '../src/renderer/iso/folkWho';
import { FEET_UP, HEAD_UP, markAt, wearsMark } from '../src/renderer/iso/founderMark';

const still: BoardMoment = { moving: false, casting: false };
const ready = { downed: null, hp: 30, sinceHit: 99, sinceBlow: 99 };
const family = (f: string) => ITEMS.find((i) => i.family === f)?.family;

test('a townsperson on the raid board walks, strikes with their weapon, casts, flinches and falls in their own look', () => {
  assert.equal(boardFolkAnim(ready, still, undefined), 'idle', 'standing ready');
  assert.equal(boardFolkAnim(ready, { moving: true, casting: false }, family('sw')), 'walk', 'walking their move, not swinging');
  const struck = { ...ready, sinceBlow: 2 };
  assert.equal(boardFolkAnim(struck, still, family('sw')), 'attack_1h', '+sword');
  assert.equal(boardFolkAnim(struck, still, undefined), 'attack_1h', 'bare hands: a punch');
  assert.equal(boardFolkAnim(struck, still, family('bw')), 'attack_bow', '+bow');
  assert.equal(boardFolkAnim(struck, still, family('st')), 'cast_2h', '+staff');
  assert.equal(boardFolkAnim(struck, still, family('gs')), 'attack_2h', '+greatsword');
  assert.equal(boardFolkAnim(struck, { moving: false, casting: true }, family('sw')), 'cast_1h', 'a spell is cast, whatever they hold');
  assert.equal(boardFolkAnim(struck, { moving: false, casting: true }, family('st')), 'cast_2h', 'with a staff, two-handed');
  assert.equal(boardFolkAnim({ ...ready, sinceBlow: BLOW_TICKS }, still, family('sw')), 'idle', 'the blow is over');
  assert.equal(boardFolkAnim({ ...struck, sinceHit: HURT_TICKS - 1 }, still, family('sw')), 'hurt', 'hit beats striking');
  assert.equal(boardFolkAnim({ ...struck, downed: 3 as never }, { moving: true, casting: true }, family('sw')), 'death', 'down');
  assert.equal(boardFolkAnim({ ...ready, hp: 0 }, still, undefined), 'death');
});

test('a look without the weapon\'s move still strikes: a punch or a thrown spell, never standing idle', () => {
  // (the peoples' own casts: walk, idle, death, hurt and one attack)
  const punch = new Set<FolkAnim>(['walk', 'idle', 'death', 'hurt', 'attack_1h']);
  const caster = new Set<FolkAnim>(['walk', 'idle', 'death', 'cast_1h']);
  for (const want of ['attack_1h', 'attack_2h', 'attack_bow'] as FolkAnim[]) assert.equal(play(want, (a) => punch.has(a)).anim, 'attack_1h', want);
  assert.equal(play('cast_2h', (a) => punch.has(a)).anim, 'attack_1h');
  assert.equal(play('cast_1h', (a) => caster.has(a)).anim, 'cast_1h');
  assert.equal(play('cast_2h', (a) => caster.has(a)).anim, 'cast_1h');
  assert.equal(play('attack_2h', (a) => caster.has(a)).anim, 'cast_1h');
  assert.equal(play('hurt', (a) => caster.has(a)).anim, 'idle', 'no hurt drawn: they stand');
  assert.equal(play('death', (a) => caster.has(a)).anim, 'death');
});

test('the board faces a unit the way the sim turned it (its target or its step)', () => {
  assert.deepEqual([0, 1, 2, 3].map(boardFacing), ['south-east', 'south-west', 'north-west', 'north-east']);
  assert.equal(boardFacing(4), BOARD_FACING[0]);
  assert.equal(boardFacing(-1), BOARD_FACING[3]);
});

test('the God creature on the board punches and uppercuts by turns, works a miracle for a spell, is hit and dies', () => {
  const calm = { down: false, sinceHit: 99, sinceAction: 99 };
  assert.deepEqual(boardCreatureMoves(calm, still, 0), ['idle']);
  assert.deepEqual(boardCreatureMoves(calm, { moving: true, casting: false }, 0), ['walk']);
  assert.deepEqual(boardCreatureMoves({ ...calm, sinceAction: 1 }, still, 0), ['punch']);
  assert.deepEqual(boardCreatureMoves({ ...calm, sinceAction: 1 }, still, 1), ['uppercut'], 'the next blow is the other');
  assert.deepEqual(boardCreatureMoves({ ...calm, sinceAction: 1 }, { moving: false, casting: true }, 0), ['miracle']);
  assert.deepEqual(boardCreatureMoves({ ...calm, sinceAction: STRIKE_TICKS }, still, 0), ['idle']);
  assert.deepEqual(boardCreatureMoves({ ...calm, sinceAction: 1, sinceHit: 1 }, still, 0), ['hit']);
  assert.deepEqual(boardCreatureMoves({ ...calm, down: true, sinceHit: 1 }, { moving: true, casting: false }, 0), ['death']);
});

test('a townsperson wears the same look, in the same colours, in the town and on the raid board', () => {
  for (const origin of ['settlers', 'dwarves', 'orcs', 'lich', 'vampire', 'knights']) {
    const s = newGame(`raid-looks-${origin}`, { origin: origin as never });
    const snap = snapshot(s);
    assert.ok(snap.people.length > 0);
    for (const p of snap.people) {
      // (as tactics/tacticsView.ts hands them to the board: placed on their tile, under arms)
      const onBoard = { ...p, x: 120, y: -40, dir: -1 as const, indoors: false, defending: true, activity: 'fight' as const, swimming: false };
      const town = folkWho(p);
      const board = folkWho(onBoard);
      assert.equal(board.path, town.path, `${origin}: ${p.name}'s look`);
      assert.equal(board.variant, town.variant, `${origin}: ${p.name}'s colours`);
      if (origin !== 'settlers' && origin !== 'dwarves') assert.ok(town.path.startsWith(`${origin}/`), `${origin} wear their own people's looks`);
    }
  }
});

test('on the map a defender runs to the foe between blows, and strikes in their armed look when they reach it', () => {
  const st = (o: Partial<FolkState> = {}): FolkState => ({ id: 3, activity: 'fight', sinceHit: 99, sinceBlow: 99, defending: true, downed: null, hp: 30, look: { gender: 'm', outfit: 'leather' }, gear: {}, ...o });
  assert.equal(wantedAnim(st(), 0, 'sw'), 'attack_1h', 'at the foe');
  assert.equal(wantedAnim(st(), 40, 'sw'), 'walk', 'closing in');
  assert.equal(wantedAnim(st(), RUN_SPEED, 'sw'), 'run');
  assert.equal(wantedAnim(st({ sinceBlow: 2 }), 40, 'sw'), 'attack_1h', 'a blow struck on the move still shows');
  assert.equal(wantedAnim(st({ sinceHit: 1 }), 40, 'sw'), 'hurt');
});

test('the founder wears the marker while in sight: a crown over the head, a ring at the feet', () => {
  const p = { id: 1, indoors: false, away: null as string | null };
  assert.ok(wearsMark(p, 1));
  assert.ok(!wearsMark(p, 2), 'only the founder');
  assert.ok(!wearsMark(p, null));
  assert.ok(!wearsMark({ ...p, indoors: true }, 1), 'indoors: hidden with them');
  assert.ok(!wearsMark({ ...p, away: 'the Barrow' }, 1), 'away on a trip');
  const at = markAt(100, 0.5, 0);
  assert.equal(at.ringY, 100 - FEET_UP * 0.5);
  assert.ok(at.crownY < 100 - HEAD_UP * 0.5 + 1 && at.crownY > 100 - HEAD_UP * 0.5 - 8, 'just over the head');
  assert.ok(markAt(100, 1, 0).crownY < at.crownY, 'a taller figure, a higher crown');
});
