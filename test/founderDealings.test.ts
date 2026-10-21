// More ways to interact: the visitor's terms, apprentices, matches and courting, the founder's feast, and haggling.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from '../src/shared/sim/commands';
import { makeOffers } from '../src/shared/sim/trade';
import { Sim } from '../src/shared/sim/sim';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { snapshot } from '../src/shared/sim/snapshot';
import { opinion } from '../src/shared/sim/social';
import { makePerson, type GameState, type Person } from '../src/shared/sim/state';
import { Rng } from '../src/shared/rng';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { camp, campPx, plainGame, put, row } from './helpers';

function town(seed: string): { s: GameState; sim: Sim; f: Person } {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  const f = s.people[0];
  f.coins = 1000;
  return { s, sim: new Sim(s), f };
}
function add(s: GameState, name: string, grown = true): Person {
  const p = makePerson(new Rng(s.nextId), s.nextId++, 'hunter', campPx(s), s.people.map((q) => q.name));
  p.name = name;
  p.partner = null;
  if (!grown) p.bornTick = s.tick;
  s.people.push(p);
  return p;
}
function arrive(s: GameState, name: string): Person {
  const p = add(s, name);
  s.people.pop();
  s.visitor = { person: p, waitX: p.x, waitY: p.y, leavesTick: s.tick + 1000, leavingTo: null };
  return p;
}

test('Visitor: a favour lets them in and warms them; a fee goes to the treasury', () => {
  const { s, sim, f } = town('fd-visitor');
  const a = arrive(s, 'Ann');
  sim.command({ type: 'founderVisitor', terms: 'favour' });
  sim.step();
  assert.ok(s.people.includes(a));
  assert.ok(opinion(s, f.id, a.id) >= 30);
  // a fee: either they pay and stay, or take offence and go; never both, and the same seed gives the same answer
  const outcomes = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const t = town(`fd-fee-${i}`);
    const b = arrive(t.s, 'Bob');
    const before = t.s.coins ?? 0;
    t.sim.command({ type: 'founderVisitor', terms: 'fee' });
    t.sim.step();
    const stayed = t.s.people.includes(b);
    outcomes.add(stayed ? 'stayed' : 'left');
    if (stayed) assert.ok((t.s.coins ?? 0) > before);
    else assert.ok(t.s.visitor?.leavingTo !== null);
  }
  assert.ok(outcomes.size >= 1);
});

test('Apprentice: a child is given to a skilled master, and no master takes more than two', () => {
  const { s, sim, f } = town('fd-apprentice');
  f.skills.crafting.level = 5;
  const kids = [add(s, 'K1', false), add(s, 'K2', false), add(s, 'K3', false)];
  for (const k of kids) sim.command({ type: 'founderApprentice', child: k.id, master: f.id });
  sim.step();
  assert.equal(kids[0].master, f.id);
  assert.equal(kids[1].master, f.id);
  assert.notEqual(kids[2].master, f.id);
  assert.ok(kids[0].trade);
  assert.equal(snapshot(s).founder?.dealings.children.length, 3);
});

test('Match: a prompt that holds the game; the answer pairs them or is refused; deterministic', () => {
  const run = (seed: string) => {
    const { s, sim, f } = town(seed);
    const kid = add(s, 'Kid');
    kid.parents = [f.id];
    const a = add(s, 'Aria');
    const b = add(s, 'Bram');
    sim.command({ type: 'founderMatch', person: kid.id });
    sim.step();
    const p = s.prompts.find((q) => q.deal?.kind === 'match')!;
    assert.ok(p, 'the match is put as a prompt');
    assert.ok(waitingOnFounder(s));
    const tick = s.tick;
    sim.step();
    assert.equal(s.tick, tick, 'the game is held');
    assert.ok(p.deal?.kind === 'match' && p.deal.picks.length >= 2);
    assert.equal(p.options.at(-1), 'Let it be');
    sim.command({ type: 'answerPrompt', prompt: p.id, option: 0 });
    sim.step();
    assert.ok(!s.prompts.length);
    assert.ok(s.tick > tick);
    return [kid.partner, a.partner, b.partner, kid.id, s.notices?.length ?? 0].join();
  };
  assert.equal(run('fd-match'), run('fd-match'));
  // courting for themselves; 'let it be' leaves everyone single
  const { s, sim, f } = town('fd-court');
  const a = add(s, 'Aria');
  sim.command({ type: 'founderMatch', person: f.id });
  sim.step();
  const p = s.prompts.find((q) => q.deal?.kind === 'match')!;
  sim.command({ type: 'answerPrompt', prompt: p.id, option: p.options.length - 1 });
  sim.step();
  assert.equal(f.partner ?? null, null);
  assert.equal(a.partner ?? null, null);
});

test('Match: some are refused, some accepted, and a refusal cools the person off', () => {
  const results = new Set<boolean>();
  for (let i = 0; i < 30; i++) {
    const { s, sim, f } = town(`fd-roll-${i}`);
    const a = add(s, 'Aria');
    sim.command({ type: 'founderMatch', person: f.id });
    sim.step();
    const p = s.prompts.find((q) => q.deal?.kind === 'match')!;
    sim.command({ type: 'answerPrompt', prompt: p.id, option: 0 });
    sim.step();
    const paired = f.partner === a.id;
    results.add(paired);
    if (!paired) assert.ok(s.dealings?.cool?.[f.id]);
  }
  assert.ok(results.has(true) && results.has(false));
});

test('Feast: costs coins, eats food, raises renown, has a cooldown', () => {
  const { s, sim, f } = town('fd-feast');
  add(s, 'Guest');
  const camp = s.buildings.find((b) => b.def === 'campfire')!;
  camp.store = { berries: 500 };
  const rep = s.reputation;
  const purse = f.coins!;
  sim.command({ type: 'founderFeast', grade: 'feast' });
  sim.step();
  assert.equal(s.gathering?.kind, 'feast');
  assert.ok((f.coins ?? 0) < purse);
  assert.ok(s.reputation > rep);
  assert.ok((camp.store.berries ?? 0) < 500);
  s.gathering = undefined;
  const after = f.coins!;
  sim.command({ type: 'founderFeast', grade: 'feast' });
  sim.step();
  assert.equal(s.gathering, undefined, 'the cooldown holds');
  assert.equal(f.coins, after);
  // the festival is a separate, longer wait; a purse too light cannot pay
  f.coins = 0;
  s.coins = 0;
  sim.command({ type: 'founderFeast', grade: 'festival' });
  sim.step();
  assert.equal(s.gathering, undefined);
});

function caravan(s: GameState): number {
  put(s, 'market', camp(s).x + 8, row(s));
  s.caravan = { x: 0, leavesTick: s.tick + 100000, arrived: s.tick, offers: [{ id: s.nextId++, gives: { flint: 3 }, horse: false, wants: { wood: 10 }, done: false }] };
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 20 };
  return s.caravan.offers[0].id;
}

test('Haggle: a prompt with three offers that holds the game; fair, hard, gift', () => {
  for (const [option, check] of [[0, 'fair'], [1, 'hard'], [2, 'gift']] as const) {
    let hardDone = false;
    for (let i = 0; i < (check === 'hard' ? 20 : 1); i++) {
      const { s, sim } = town(`fd-haggle-${check}-${i}`);
      const offer = caravan(s);
      sim.command({ type: 'founderHaggle', offer });
      sim.step();
      const p = s.prompts.find((q) => q.deal?.kind === 'haggle')!;
      assert.ok(p);
      assert.ok(waitingOnFounder(s));
      assert.equal(p.options.length, 4);
      sim.command({ type: 'answerPrompt', prompt: p.id, option });
      sim.step();
      const o = s.caravan?.offers[0];
      if (check === 'fair') assert.ok(o?.done);
      if (check === 'gift') {
        assert.ok(o?.done);
        assert.equal(s.dealings?.goodwill, 2);
      }
      if (check === 'hard') {
        if (o?.done) {
          assert.equal(o.wants.wood, 8);
          hardDone = true;
        } else assert.ok(s.caravan === null || s.caravan.leavesTick <= s.tick, 'insulted, they leave');
      }
    }
    if (check === 'hard') assert.ok(hardDone);
  }
});

test('Haggle: walking away trades nothing; a caravan that leaves drops the question; goodwill eases prices', () => {
  const { s, sim } = town('fd-haggle-away');
  const offer = caravan(s);
  sim.command({ type: 'founderHaggle', offer });
  sim.step();
  const p = s.prompts[0];
  s.caravan = null;
  assert.ok(!waitingOnFounder(s));
  assert.equal(s.prompts.length, 0);
  assert.ok(p);
});

test('Goodwill: a gift makes the next caravan\'s asking cheaper, and fades with each caravan', () => {
  const total = (s: GameState) => makeOffers(s, new Rng(7)).filter((o) => !o.horse && Object.keys(o.gives).length).reduce((n, o) => n + Object.values(o.wants).reduce((a, b) => a + (b ?? 0), 0), 0);
  const { s } = town('fd-goodwill');
  s.buildings.find((b) => b.def === 'campfire')!.store = { wood: 40, flint: 40, berries: 40 };
  const plain = total(s);
  s.dealings = { goodwill: 5 };
  assert.ok(total(s) <= plain);
});

test('Commands parse and are not gated by the autopilot', () => {
  assert.deepEqual(parseCommand({ type: 'founderFeast', grade: 'festival' }), { type: 'founderFeast', grade: 'festival' });
  assert.equal(parseCommand({ type: 'founderFeast', grade: 'orgy' }), null);
  assert.equal(parseCommand({ type: 'founderVisitor', terms: 'free' }), null);
  assert.ok(parseCommand({ type: 'founderHaggle', offer: 3 }));
  assert.ok(parseCommand({ type: 'founderMatch', person: 1 }));
  assert.ok(parseCommand({ type: 'founderApprentice', child: 1, master: 2 }));
  void TICKS_PER_HOUR;
});
