import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { BIOMES } from '../src/shared/data/biomes';
import { RAID_BOARDS } from '../src/shared/data/raidBoards';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { boardsFor, GROUND_BY_CH, HAND_BOARD_SHARE, pickBoard, PROP_KINDS, type RaidBoardDef } from '../src/shared/sim/raidBoards';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { BOARD_H, BOARD_W, makeHandBoard, type TacTile, type Tactics } from '../src/shared/sim/tactics';
import { boardOk, canStep } from '../src/shared/sim/tacticsTerrain';
import { makePerson, type GameState, type Raid } from '../src/shared/sim/state';
import { boardsFromLdtk, boardsSource } from '../tools/ldtkBoards';
import { plainGame } from './helpers';

const LDTK = 'maps/raid-boards.ldtk';
const project = JSON.parse(readFileSync(LDTK, 'utf8'));

test('the committed board data is what the converter makes of the committed LDtk project (they never drift apart)', () => {
  assert.equal(boardsSource(boardsFromLdtk(project)), readFileSync('src/shared/data/raidBoards.ts', 'utf8'), 'run `node tools/ldtk-boards.mjs` after editing the boards');
});

test('the LDtk project is LDtk 1.5 JSON: its layers, its tileset found by a relative path, every entity on its level', () => {
  assert.equal(project.__header__.fileType, 'LDtk Project JSON');
  assert.match(project.jsonVersion, /^1\.5\./);
  for (const ts of project.defs.tilesets) {
    assert.ok(!ts.relPath.startsWith('/') && !/^[a-z]:/i.test(ts.relPath), 'a relative path');
    assert.ok(existsSync(`maps/${ts.relPath}`), ts.relPath);
  }
  const uids = new Set<number>();
  const all = [...project.defs.layers, ...project.defs.entities, ...project.defs.tilesets, ...project.defs.enums, ...project.defs.levelFields, ...project.defs.entities.flatMap((e: { fieldDefs: unknown[] }) => e.fieldDefs), ...project.levels];
  for (const d of all) {
    assert.ok(!uids.has(d.uid), `uid ${d.uid} once`);
    assert.ok(d.uid < project.nextUid, 'nextUid past every uid');
    uids.add(d.uid);
  }
  for (const lv of project.levels) {
    assert.deepEqual(
      lv.layerInstances.map((l: { __identifier: string }) => l.__identifier),
      project.defs.layers.map((l: { identifier: string }) => l.identifier),
    );
    for (const l of lv.layerInstances) {
      assert.equal(l.__cWid * l.__gridSize, lv.pxWid);
      assert.equal(l.__cHei * l.__gridSize, lv.pxHei);
      if (l.__type === 'IntGrid') assert.equal(l.intGridCsv.length, l.__cWid * l.__cHei);
      for (const e of l.entityInstances) {
        assert.deepEqual(e.px, [e.__grid[0] * l.__gridSize, e.__grid[1] * l.__gridSize]);
        assert.ok(e.__grid[0] >= 0 && e.__grid[1] >= 0 && e.__grid[0] < l.__cWid && e.__grid[1] < l.__cHei, `${lv.identifier} ${e.__identifier} on the level`);
      }
    }
  }
});

/** A town with a few fighters, its autopilot on (the hand-made boards are the town's own system). */
function town(seed: string, biome: string, n = 6): GameState {
  const s = plainGame(seed);
  s.biome = biome as GameState['biome'];
  s.autopilot = true;
  s.battles = true;
  s.battleStyle = 'tactics';
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.people[0].priorities.defend = 1;
  for (let i = 0; i < n - 1; i++) {
    const p = makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.priorities.defend = 1;
    p.skills.melee.level = 8;
    if (i % 2) p.skills.ranged.level = 12;
    s.people.push(p);
  }
  return s;
}

/** Whether someone may stand on a tile (tactics.ts `standable`). */
const stands = (t: TacTile | undefined, foe: boolean) => !!t && t.g !== 'mountain' && t.g !== 'water' && t.block !== 'rock' && t.block !== 'building' && !(foe && t.block === 'wall');
/** The tiles walked to from `from` (a raider or one of the town, jumping two, wading but never swimming). */
function walk(b: Pick<Tactics, 'w' | 'h' | 'tiles'>, from: [number, number], foe: boolean): Set<number> {
  const seen = new Set([from[1] * b.w + from[0]]);
  const queue = [...seen];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = (i % b.w) + du;
      const v = Math.floor(i / b.w) + dv;
      const j = v * b.w + u;
      if (u < 0 || v < 0 || u >= b.w || v >= b.h || seen.has(j) || !stands(b.tiles[j], foe) || canStep(b.tiles[i], b.tiles[j], 2) === null) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return seen;
}

test('every hand-made board is sound: its size, its lands, its ground, the wall and gate clear, two ways in or more', () => {
  assert.ok(RAID_BOARDS.length >= 8);
  for (const b of RAID_BOARDS) {
    const at = b.name;
    assert.ok((b.w === BOARD_W && b.h === BOARD_H) || (b.w === 21 && b.h === 17), `${at}: ${b.w}x${b.h}`);
    assert.ok(b.biomes.length > 0 && b.biomes.every((x) => (BIOMES as readonly string[]).includes(x)), `${at}: lands`);
    for (const k of [...b.raidKinds, ...b.notRaidKinds]) assert.ok(RAID_KIND_BY_ID[k], `${at}: raid kind ${k}`);
    assert.equal(b.ground.length, b.h);
    for (const r of b.ground) assert.ok(r.length === b.w && [...r].every((c) => GROUND_BY_CH[c]), `${at}: ${r}`);
    const along = b.w - 4;
    const mid = Math.floor(b.h / 2);
    for (const v of [mid - 1, mid]) assert.ok(!'^W~'.includes(b.ground[v][along]), `${at}: the gate stands on dry ground`);
    for (const [u, v, what] of b.things) {
      // (the town's spots may be on the rampart; cover and props would be cleared by the wall)
      if (what !== 'front' && what !== 'back') assert.ok(u !== along, `${at}: no cover or prop on the wall's line (${what} at ${u},${v})`);
      if ((PROP_KINDS as readonly string[]).includes(what)) assert.ok(u < along, `${at}: a prop on the town's side at ${u},${v}`);
    }
    assert.equal(new Set(b.things.map(([u, v]) => `${u},${v}`)).size, b.things.length, `${at}: one thing a tile`);
    const ways = new Set(b.things.filter(([, , w]) => w.startsWith('way')).map(([, , w]) => w));
    assert.ok(ways.size >= 2, `${at}: ${ways.size} ways in`);
    const front = b.things.filter(([, , w]) => w === 'front').length;
    const back = b.things.filter(([, , w]) => w === 'back').length;
    assert.ok(front >= 4 && back >= 4, `${at}: a front line (${front}) and a back line (${back})`);
  }
  // (every land has a board of its own)
  for (const biome of BIOMES) assert.ok(RAID_BOARDS.some((b) => b.biomes.includes(biome)), `a board for ${biome}`);
});

test('on every hand-made board laid over a town, nobody starts in water, on rock or a wall they may not stand on, and every spot reaches the fight', () => {
  for (const def of RAID_BOARDS)
    for (const side of [-1, 1] as const) {
      const s = town(`hand-${def.id}`, def.biomes[0]);
      const b = makeHandBoard(s, side, def);
      const at = `${def.name} (${side})`;
      const along = b.w - 4;
      assert.equal(b.board, def.name);
      assert.ok(boardOk(b, along), `${at}: the board is whole`);
      const gate = b.tiles.findIndex((t) => t.gate);
      assert.ok(gate >= 0, `${at}: a gate`);
      const lastCol = (seen: Set<number>) => [...seen].some((i) => i % b.w === b.w - 1);
      for (const [u, v] of b.entries!) {
        const tile = b.tiles[v * b.w + u];
        assert.ok(u <= 1, `${at}: a way in at the raiders' edge (${u},${v})`);
        assert.ok(stands(tile, true) && tile.g !== 'shallows', `${at}: a raider may start at ${u},${v} (${tile.g})`);
        assert.ok(lastCol(walk(b, [u, v], true)), `${at}: from ${u},${v} the raiders reach the town`);
      }
      for (const [u, v] of b.deploy!) {
        const tile = b.tiles[v * b.w + u];
        assert.ok(u >= Math.floor(b.w / 2), `${at}: the town's spot ${u},${v} is on its own half`);
        assert.ok(stands(tile, false) && tile.g !== 'shallows' && tile.bld === undefined, `${at}: one of the town may start at ${u},${v} (${tile.g}${tile.block ? ' ' + tile.block : ''})`);
        const seen = walk(b, [u, v], false);
        assert.ok(seen.has(gate) || [...seen].some((i) => b.tiles[i].gate), `${at}: from ${u},${v} the town reaches its gate`);
        assert.ok([...seen].some((i) => i % b.w <= 1), `${at}: from ${u},${v} the town reaches the raiders' edge`);
      }
    }
});

const raidOf = (_s: GameState, kind = 'bandits'): Raid => ({ kind, side: -1 }) as unknown as Raid;

test('the board is picked from a side stream: the same town and tick the same board, mostly a hand-made one where one fits', () => {
  const s = town('hand-pick', 'forest');
  const r = raidOf(s);
  const fit = boardsFor(s, r, BOARD_W, BOARD_H);
  assert.ok(fit.length >= 2, 'forest has several boards');
  const draw = s.rngState;
  let hand = 0;
  const seen = new Set<string>();
  for (let k = 0; k < 400; k++) {
    s.tick = 1000 + k * 37;
    const a = pickBoard(s, r, BOARD_W, BOARD_H);
    assert.equal(pickBoard(s, r, BOARD_W, BOARD_H), a, 'the same pick again');
    if (a) {
      hand++;
      seen.add(a.id);
      assert.ok(a.biomes.includes('forest'));
    }
  }
  assert.equal(s.rngState, draw, "the town's own stream is never drawn on");
  assert.ok(Math.abs(hand / 400 - HAND_BOARD_SHARE) < 0.08, `${hand} of 400 on a hand-made board`);
  assert.equal(seen.size, fit.length, 'every board that fits comes up');
});

test('with no board to fit, the land’s own board: a big raid, a chase, a raid from the sea, a kind a board refuses, the autopilot off', () => {
  const s = town('hand-none', 'swamp');
  assert.ok(boardsFor(s, raidOf(s), BOARD_W, BOARD_H).length > 0);
  assert.equal(boardsFor(s, raidOf(s), 21, 17).length, 0, 'no big boards yet');
  assert.equal(boardsFor(s, { ...raidOf(s), chase: true } as Raid, BOARD_W, BOARD_H).length, 0, 'a chase');
  const sea = Object.values(RAID_KIND_BY_ID).find((k) => k.fromSea)!;
  assert.equal(boardsFor(s, raidOf(s, sea.id), BOARD_W, BOARD_H).length, 0, 'a raid from the sea');
  assert.ok(!boardsFor(s, raidOf(s, 'mechanized'), BOARD_W, BOARD_H).some((b) => b.id === 'Fenwalk'), 'the fen refuses machines');
  s.autopilot = false;
  assert.equal(boardsFor(s, raidOf(s), BOARD_W, BOARD_H).length, 0, 'the autopilot off');
});

/** A raid started and stepped until its board is laid. */
function raidOn(s: GameState) {
  s.raidOdds = { streak: 3 }; // (they come whatever the odds: sim/raidOdds.ts)
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 40, new Rng(3));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const rng = new Rng(9);
  updateRaid(s, rng);
  return { r, rng, t: r.tactics as Tactics };
}

test('a raid on a hand-made board: the town on its front and back lines, the raiders on its ways in, and it plays out to an end', () => {
  // (a tick whose pick is a hand-made board)
  let s: GameState | null = null;
  let def: RaidBoardDef | null = null;
  for (let k = 0; k < 50 && !def; k++) {
    s = town('hand-raid', 'forest', 7);
    s.tick = 5000 + k * 101;
    def = pickBoard(s, raidOf(s), BOARD_W, BOARD_H);
  }
  assert.ok(s && def);
  const { r, rng, t } = raidOn(s);
  assert.ok(t, 'the board is laid');
  assert.equal(t.board, def.name);
  const spots = new Set(t.deploy!.map(([u, v]) => `${u},${v}`));
  const ways = new Set(t.entries!.map(([u, v]) => `${u},${v}`));
  const folk = t.units.filter((u) => u.key[0] === 'p');
  assert.ok(folk.length >= 5 && folk.every((u) => spots.has(`${u.u},${u.v}`)), 'the town stands on the board’s spots');
  const foes = t.units.filter((u) => u.foe);
  assert.ok(foes.length > 0 && foes.every((u) => ways.has(`${u.u},${u.v}`)), 'the raiders come on at the ways in');
  assert.ok(new Set(foes.map((u) => t.entries!.find(([a, b]) => a === u.u && b === u.v)![2])).size >= Math.min(2, foes.length), 'by more than one way');
  for (let i = 0; i < 30000 && s.raid && r.tactics!.phase !== 'done'; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.ok(!s.raid || r.tactics!.phase === 'done', 'it ends');
  assert.ok(r.tactics!.turns > 5);
});

test('a raid with the autopilot off, or a saved board from before the hand-made ones, is fought on the land’s own board', () => {
  const s = town('hand-old', 'forest');
  s.autopilot = false;
  const { r, rng, t } = raidOn(s);
  assert.equal(t.board, undefined);
  assert.equal(t.deploy, undefined);
  // (a board saved mid-raid without the new fields plays on)
  const saved = JSON.parse(JSON.stringify(t));
  delete saved.board;
  delete saved.deploy;
  delete saved.entries;
  r.tactics = saved;
  for (let i = 0; i < 300 && s.raid; i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.ok(r.tactics!.turns > 0);
});
