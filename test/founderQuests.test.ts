// Leading a trip yourself, the steward, and the founder's story (sim/founderQuests.ts, sim/steward.ts, sim/story.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postHunt } from '../src/shared/sim/hunts';
import { killPerson } from '../src/shared/sim/health';
import { crossroads } from '../src/shared/sim/muster';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { leadQuest, waitingOnFounder } from '../src/shared/sim/founderQuests';
import { beginSaga, sagaDestinations, sagaTripHome } from '../src/shared/sim/sagas';
import { Sim } from '../src/shared/sim/sim';
import { stewardOf } from '../src/shared/sim/steward';
import { storyRaid, storyShop, storyView, writeChapter } from '../src/shared/sim/story';
import { maxHp, type Expedition, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame } from './helpers';

function town(seed: string, n = 6): GameState {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < n; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, ambition: 'farmer', partner: null, guard: false };
    p.x += (i + 1) * 4;
    s.people.push(p);
  }
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
  }
  s.coins = 500;
  return s;
}

function ledTrip(seed: string): GameState {
  const s = town(seed);
  const h = postHunt(s, new Rng(3))!;
  const r = leadQuest(s, 'hunt', h.id);
  assert.ok(r.ok, r.reason ?? '');
  return s;
}

test('Lead it yourself: the party sets out with the founder at its head, and the hunt is taken up', () => {
  const s = ledTrip('fq-lead');
  const e = s.expeditions[0];
  assert.equal(e.leader, s.mainId);
  assert.ok(e.members.includes(s.mainId));
  assert.equal(s.muster, undefined);
  assert.ok(s.hunts![0].accepted !== undefined, 'the clock runs');
});

test("a road question on the founder's trip waits for them: no timer, no default, and the game is held", () => {
  const s = ledTrip('fq-pause');
  const e = s.expeditions[0];
  const members = e.members.map((id) => s.people.find((p) => p.id === id)!);
  assert.ok(crossroads(s, e, members, new Rng(5)));
  const p = s.prompts.find((q) => q.kind === 'road')!;
  assert.ok(p.waits && p.expiresTick === Number.MAX_SAFE_INTEGER);
  assert.ok(waitingOnFounder(s));
  const sim = new Sim(s);
  const tick = s.tick;
  for (let i = 0; i < 3 * TICKS_PER_HOUR; i++) sim.step();
  assert.equal(s.tick, tick, 'the game is held');
  assert.ok(s.prompts.includes(p), 'and nothing answered it for them');
  sim.command({ type: 'answerPrompt', prompt: p.id, option: 0 });
  sim.step();
  sim.step();
  assert.ok(s.tick > tick, 'answered, the game goes on');
  assert.ok(!waitingOnFounder(s));
});

test("another party's road question keeps its timer", () => {
  const s = ledTrip('fq-other');
  const e = s.expeditions[0];
  e.members = e.members.filter((id) => id !== s.mainId); // (the founder is not along)
  const members = e.members.map((id) => s.people.find((p) => p.id === id)!);
  assert.ok(crossroads(s, e, members, new Rng(5)));
  const p = s.prompts.find((q) => q.kind === 'road')!;
  assert.ok(!p.waits && p.expiresTick < Number.MAX_SAFE_INTEGER);
  assert.ok(!waitingOnFounder(s));
});

test('a question whose trip is gone does not hold the game', () => {
  const s = ledTrip('fq-orphan');
  const e = s.expeditions[0];
  crossroads(s, e, e.members.map((id) => s.people.find((p) => p.id === id)!), new Rng(5));
  s.expeditions = [];
  assert.ok(!waitingOnFounder(s));
});

test('the steward: the heir minds the town while the founder is away, and a card says what changed on their return', () => {
  const s = town('fq-steward');
  s.autopilot = true;
  const f = s.people[0];
  const heir = s.people[2];
  s.heirId = heir.id;
  assert.equal(stewardOf(s)?.id, heir.id);
  const sim = new Sim(s);
  f.away = 1;
  s.tick = 10 * TICKS_PER_HOUR - 1;
  sim.step();
  assert.equal(s.gone?.steward, heir.id);
  const coins = s.coins!;
  s.coins = coins + 40;
  s.tick += 30 * TICKS_PER_HOUR;
  f.away = null;
  sim.step();
  assert.equal(s.gone, undefined);
  const card = s.prompts.find((p) => p.title === 'While you were gone')!;
  assert.ok(card);
  assert.match(card.story!, new RegExp(`${heir.name} minded the town`));
  assert.match(card.story!, /gained 40 coins/);
});

test('a short trip with nothing changed is told in hours, in the news, not on one more card', () => {
  const s = town('fq-steward-short');
  s.autopilot = true;
  const f = s.people[0];
  const sim = new Sim(s);
  f.away = 1;
  s.tick = 10 * TICKS_PER_HOUR - 1;
  sim.step();
  s.tick += 3 * TICKS_PER_HOUR;
  f.away = null;
  sim.step();
  assert.ok(!s.prompts.some((p) => p.title === 'While you were gone'), 'no card');
  assert.ok(s.journal.some((l) => /home after 3 hours\..*Nothing much changed/.test(l.text)), s.journal.map((l) => l.text).slice(-4).join(' | '));
});

test('with no named heir the best grown-up at home stands in', () => {
  const s = town('fq-steward2');
  s.people[3].skills.social.level = 20;
  assert.equal(stewardOf(s)?.id, s.people[3].id);
});

test('a raid survived is told in sentences that start with a capital, the town unnamed', () => {
  const s = town('fq-story-raid');
  s.autopilot = true;
  s.townName = undefined;
  storyRaid(s, 'wolf pack', 'All 3 were killed.');
  const lines = s.story!.chapters.at(-1)!.lines;
  for (const l of lines) assert.match(l, /^[A-Z]/, l);
});

test('chapters: the founding, a shop bought, and the old story closing for the heir on a death', () => {
  const s = town('fq-story');
  s.autopilot = true;
  const sim = new Sim(s);
  s.tick = TICKS_PER_HOUR - 1;
  sim.step();
  assert.equal(s.story?.chapters[0].kind, 'founding');
  assert.ok(s.story!.chapters[0].lines.length >= 2 && s.story!.chapters[0].lines.length <= 4);
  assert.ok(s.prompts.some((p) => p.title.includes('The founding')), 'told in the event box too');
  storyShop(s, 'Inn', 50);
  assert.equal(s.story!.chapters.at(-1)!.kind, 'shop');
  const f = s.people[0];
  const heir = s.people[1];
  s.heirId = heir.id;
  killPerson(s, f, 'of a fever');
  const books = storyView(s);
  assert.equal(books.length, 2, 'both stories are kept');
  assert.equal(books[0].who, heir.id);
  assert.ok(!books[0].closed);
  assert.ok(books[1].closed);
  assert.equal(books[1].chapters[0].kind, 'death');
});

test('a family death, a marriage and a child make chapters', () => {
  const s = town('fq-family');
  s.autopilot = true;
  const sim = new Sim(s);
  const f = s.people[0];
  s.tick = TICKS_PER_HOUR - 1;
  sim.step();
  const mate = s.people[1];
  f.partner = mate.id;
  mate.partner = f.id;
  const kid = s.people[2];
  kid.parents = [f.id, mate.id];
  s.tick += TICKS_PER_HOUR - 1;
  sim.step();
  const kinds = s.story!.chapters.map((c) => c.kind);
  assert.ok(kinds.includes('marriage') && kinds.includes('child'));
  s.tick += TICKS_PER_HOUR - 1;
  killPerson(s, mate, 'of a fever');
  sim.step();
  assert.ok(s.story!.chapters.some((c) => c.kind === 'family' && c.lines[0].includes('of a fever')));
});

test('no heir: the final chapter closes the book', () => {
  const s = town('fq-end', 0);
  s.autopilot = true;
  const f = s.people[0];
  writeChapter(s, 'founding', 'The founding', ['Begun.', 'Hopeful.']);
  killPerson(s, f, 'of hunger');
  assert.ok(s.gameOver);
  assert.equal(s.story!.chapters.at(-1)!.kind, 'death');
  assert.ok(storyView(s)[0].closed);
});

test('the founder is the saga hero when they went on the trip', () => {
  const s = town('fq-saga');
  s.tick = 5 * TICKS_PER_DAY;
  beginSaga(s, 'burnt_cart');
  const q = s.prompts.find((x) => x.kind === 'saga')!;
  answerPrompt(s, q.id, q.options.findIndex((o) => /go after them/.test(o)), new Rng(1));
  const dest = sagaDestinations(s)[0];
  const other = s.people[2];
  sagaTripHome(s, { dest: dest.id, cleared: true, recalled: false, leader: other.id, members: [other.id, s.mainId] } as unknown as Expedition);
  assert.equal(s.sagas![0].hero, s.mainId, 'the founder, though another led');
});
