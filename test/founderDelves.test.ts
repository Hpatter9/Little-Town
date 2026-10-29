// The founder leads delves (sim/founderDelves.ts; docs/notes/founder-delves.md): into any dungeon on the board, with no
// strength bar, the danger shown first; the founder's choices down in the dark hold the game; the founder can die.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DUNGEON_BY_ID } from '../src/shared/data/dungeons';
import { DESTINATION_BY_ID } from '../src/shared/data/expeditions';
import { bossesOf, delveRisk, founderPartyFor, knownDungeons, raiseFounderParty } from '../src/shared/sim/founderDelves';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { checkBleeding, knockDown } from '../src/shared/sim/health';
import { musterView, sendMuster } from '../src/shared/sim/muster';
import { dares } from '../src/shared/sim/parties';
import { Sim } from '../src/shared/sim/sim';
import { warningFor } from '../src/shared/sim/stakes';
import { addStock, maxHp, type Expedition, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { campPx, plainGame } from './helpers';
import { makePerson } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { snapshot } from '../src/shared/sim/snapshot';

const WARREN = 'gremlin_warren';

/** A young town of the founder and three others, the Northern Crags mapped (the Gremlin Warren on the board). */
function town(seed: string): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.regions = ['northern_crags'];
  for (let i = s.people.length; i < 4; i++) s.people.push(makePerson(new Rng(i + 7), s.nextId++, 'hunter', { x: campPx(s).x + i * 30, y: campPx(s).y }, s.people.map((p) => p.name)));
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { ...p.needs, food: 1, rest: 1 };
    p.ambition = 'farmer';
    p.partner = null;
    p.parents = [];
  }
  s.heirId = undefined;
  const fire = s.buildings.find((b) => b.def === 'campfire')!;
  addStock(fire.store, 'wood', 40);
  addStock(fire.store, 'dried_meat', 60);
  return s;
}
const founder = (s: GameState) => s.people.find((p) => p.id === s.mainId)!;
const party = (s: GameState, e: Expedition): Person[] => e.members.map((id) => s.people.find((p) => p.id === id)!);

test('the founder leads a delve into a known dungeon with no strength bar', () => {
  const s = town('fd-lead');
  assert.ok(knownDungeons(s).includes(WARREN), 'the Warren is on the board');
  const d = DESTINATION_BY_ID[WARREN];
  const going = founderPartyFor(s, WARREN);
  assert.ok(!dares(founder(s), going, d), "the town's own parties wouldn't dare it");
  const r = raiseFounderParty(s, WARREN);
  assert.ok(r.ok, r.reason ?? '');
  assert.equal(s.muster!.leader, s.mainId, 'the founder leads');
  assert.equal(s.muster!.members[0], s.mainId);
  const sent = sendMuster(s);
  assert.ok(sent.ok, sent.reason ?? '');
  const e = s.expeditions[0];
  assert.equal(e.dest, WARREN);
  assert.equal(e.leader, s.mainId);
  assert.ok(e.ordered && e.delve, 'a commanded delve: it ends in the summary card');
});

test("the danger is shown: the likeliest and the worst at the bottom against the party, and the founder's heir", () => {
  const s = town('fd-risk');
  const bosses = bossesOf(WARREN);
  assert.equal(bosses.length, DUNGEON_BY_ID[WARREN].bosses.length);
  assert.ok(bosses.every((b, i) => i === 0 || b.power >= bosses[i - 1].power), 'mildest first');
  const r = delveRisk(s, WARREN, [founder(s)])!;
  assert.equal(r.worst.name, bosses.at(-1)!.name);
  assert.equal(r.likely.name, bosses[1].name);
  assert.equal(r.tone, 'deadly', 'the founder alone against the Warren');
  assert.match(r.line, /Your party \d+ against/);
  assert.match(r.heirLine!, /no heir.*town ends/);
  assert.match(warningFor(s, [founder(s)], founder(s))!, /no heir, and if they fall the town ends/);
  // (with an heir named, the line names them)
  s.heirId = s.people[1].id;
  assert.match(delveRisk(s, WARREN, [founder(s)])!.heirLine!, new RegExp(`${s.people[1].name} takes up the town`));
  // (and the muster sheet and the founder's card carry it)
  raiseFounderParty(s, WARREN);
  assert.equal(musterView(s, () => null)!.risk?.dest, WARREN);
  assert.ok(snapshot(s).founder!.delves.some((x) => x.dest === WARREN));
});

/** The founder's delve, sent and walked to the dungeon's door. */
function atTheDoor(seed: string): { sim: Sim; s: GameState; e: Expedition } {
  const s = town(seed);
  const sim = new Sim(s);
  assert.ok(raiseFounderParty(s, WARREN).ok);
  assert.ok(sendMuster(s).ok);
  const e = s.expeditions[0];
  // (straight to the dungeon: the road's questions aren't these tests')
  e.phase = 'work';
  e.elapsed = 0;
  for (const p of party(s, e)) p.hp = maxHp(p);
  return { sim, s, e };
}

test("at the boss's door the founder chooses, and the game waits; turning back leaves the boss be", () => {
  const { sim, s, e } = atTheDoor('fd-boss');
  const v = e.delve!;
  v.at = v.rooms.length - 2;
  v.ticks = 1e9;
  v.torches = 5;
  sim.step();
  const p = s.prompts.find((q) => q.road === 'delve_boss');
  assert.ok(p, 'asked at the last door');
  assert.ok(p!.waits && p!.expiresTick === Number.MAX_SAFE_INTEGER, 'no timer, no default');
  assert.ok(waitingOnFounder(s));
  const tick = s.tick;
  for (let i = 0; i < 2 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(s.tick, tick, 'the game is held');
  sim.command({ type: 'answerPrompt', prompt: p!.id, option: 1 });
  sim.step();
  sim.step();
  assert.ok(s.tick > tick, 'answered, the game goes on');
  assert.equal(e.phase, 'back', 'they turn for home');
  assert.ok(!v.bossFought && !v.cleared, 'the boss is left be');
});

test('at a fork the founder picks the way', () => {
  const { sim, s, e } = atTheDoor('fd-fork');
  const v = e.delve!;
  v.rooms = ['fight', 'fork', 'shrine', 'camp', 'boss'];
  v.at = 0;
  v.ticks = 1e9;
  v.torches = 5;
  sim.step();
  const p = s.prompts.find((q) => q.road === 'delve_fork');
  assert.ok(p && p.waits, 'asked at the fork, and it waits');
  sim.command({ type: 'answerPrompt', prompt: p!.id, option: 0 });
  sim.step();
  assert.ok(v.deeper, 'the darker way');
  assert.equal(v.rooms[2], 'treasure');
});

test('the founder can die down there, and with no heir the town ends', () => {
  const { s, e } = atTheDoor('fd-death');
  const f = founder(s);
  assert.notEqual(f.away, null);
  knockDown(s, f);
  assert.ok(f.downed?.bleedUntil != null, 'away from town, the founder bleeds like anyone');
  s.tick = f.downed!.bleedUntil!;
  checkBleeding(s, f);
  assert.ok(!s.people.includes(f), 'dead of their wounds');
  assert.ok(s.gameOver, 'no heir: the game is over');
  assert.ok(!e.members.includes(f.id));
});

test("with the autopilot off a delve's forks are the stakes' as before (no question)", () => {
  const { sim, s, e } = atTheDoor('fd-off');
  s.autopilot = false;
  const v = e.delve!;
  v.rooms = ['fight', 'fork', 'shrine', 'camp', 'boss'];
  v.at = 0;
  v.ticks = 1e9;
  v.torches = 5;
  sim.step();
  assert.ok(!s.prompts.some((q) => q.road === 'delve_fork'));
  assert.equal(v.at, 1);
});
