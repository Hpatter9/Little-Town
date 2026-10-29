// One summary card for each trip and each raid (sim/summaries.ts): the founder's chapter, the firsts and the news from
// home are told on the trip's debrief or the raid's recap, not as cards of their own, and nothing is told twice.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { Rng } from '../src/shared/rng';
import { updateExpeditions } from '../src/shared/sim/expeditions';
import { leadQuest } from '../src/shared/sim/founderQuests';
import { killPerson } from '../src/shared/sim/health';
import { postHunt } from '../src/shared/sim/hunts';
import { holdOf } from '../src/shared/sim/popups';
import { startRaid } from '../src/shared/sim/raids';
import { fightOnScreen } from '../src/shared/sim/raidWait';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { stewardTick } from '../src/shared/sim/steward';
import { makePerson, maxHp, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
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

/** The cards a player is shown as plain news (no choice to make): the debriefs. */
const newsCards = (s: GameState) => s.prompts.filter((p) => p.kind === 'debrief');

test("a trip the founder led comes home to one summary: who, the toll, the haul, the first it earned, the story and the news from home", () => {
  const s = town('sum-trip');
  s.autopilot = true;
  const h = postHunt(s, new Rng(3))!;
  assert.ok(leadQuest(s, 'hunt', h.id).ok);
  const e = s.expeditions[0];
  const lostOne = s.people.find((p) => e.members.includes(p.id) && p.id !== s.mainId)!;
  assert.ok(lostOne, 'someone besides the founder went');
  const rng = new Rng(5);
  for (let t = 0; t < 400 * TICKS_PER_HOUR && s.expeditions.length; t++) {
    s.tick++;
    stewardTick(s);
    updateExpeditions(s, rng);
    if (t === 20) {
      killPerson(s, lostOne, 'on the road');
      s.coins! += 40; // (news for the founder when they are home)
    }
    for (const p of [...s.prompts]) if (p.kind !== 'debrief') answerPrompt(s, p.id, p.defaultOption, rng);
    for (const p of s.people) if (!p.downed) p.needs = { food: 1, rest: 1 };
  }
  assert.equal(s.expeditions.length, 0, 'the party is home');
  s.tick++;
  stewardTick(s); // (the founder home: the steward's news)
  const cards = newsCards(s);
  assert.equal(cards.length, 1, `one card, not ${cards.map((c) => c.title).join(' / ')}`);
  const card = cards[0];
  const d = card.debrief!;
  assert.equal(d.trip, e.id, "the summary names its trip (the page's haul chest stands aside for it)");
  assert.ok(d.lost.some((l) => l.name === lostOne.name), 'who died');
  assert.match(d.chapter ?? '', /story: A quest (won|lost)$/, "the founder's chapter is named on it");
  assert.equal(s.story?.chapters.at(-1)?.kind, 'quest', 'and still written in the Story');
  assert.ok(d.firsts?.some((f) => f.title === 'The first death'), 'the first it earned is a line on it');
  assert.ok(s.milestones!.find((m) => m.id === 'death')!.folded, 'so the first has no card of its own');
  assert.ok(snapshot(s).annals.milestones!.find((m) => m.id === 'death')!.folded, 'and the page is told so');
  assert.ok(s.journal.some((l) => /The first death/.test(l.text)), 'the first is still in the news');
  assert.ok(d.home?.some((l) => /gained 40 coins/.test(l)), 'the news from home joined it');
  assert.ok(!s.prompts.some((p) => p.title === 'While you were gone'), 'no card of its own for that either');
  // nothing told twice: each line of the haul once, the trip's place in one card
  const said = `${card.title} ${card.story}`;
  for (const w of d.haul) assert.equal(said.split(w).length - 1, 1, `"${w}" told once`);
  if (d.loot) assert.equal(Object.keys(d.loot).length, d.haul.length, 'the haul by kind, for its icons, matches the words');
});

test("a trip the founder wasn't on is told on its own card too, with no chapter", () => {
  const s = town('sum-trip-other');
  s.autopilot = true;
  const h = postHunt(s, new Rng(3))!;
  assert.ok(leadQuest(s, 'hunt', h.id).ok);
  const e = s.expeditions[0];
  e.members = e.members.filter((id) => id !== s.mainId);
  delete e.start!.names[s.mainId];
  e.leader = e.members[0];
  s.people.find((p) => p.id === s.mainId)!.away = null;
  const rng = new Rng(5);
  for (let t = 0; t < 400 * TICKS_PER_HOUR && s.expeditions.length; t++) {
    s.tick++;
    updateExpeditions(s, rng);
    for (const p of [...s.prompts]) if (p.kind !== 'debrief') answerPrompt(s, p.id, p.defaultOption, rng);
    for (const p of s.people) if (!p.downed) p.needs = { food: 1, rest: 1 };
  }
  const cards = newsCards(s);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].debrief?.chapter, undefined);
});

/** A town with fighters and its founder, the autopilot on, its raid's battle on the board. */
function fighting(seed: string) {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.battles = true;
  s.battleStyle = 'tactics';
  for (let i = 0; i < 4; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', s.people[0], s.people.map((p) => p.name)));
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 30, new Rng(1));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const sim = new Sim(s);
  for (let i = 0; i < 20 && !fightOnScreen(s); i++) {
    // (the raid's own question, with the autopilot on: they falter, or ask a toll; the town fights)
    for (const p of [...s.prompts]) {
      const fight = p.options.findIndex((o) => /hunt|refuse|fight|stand/i.test(o));
      if (p.kind === 'raid') sim.command({ type: 'answerPrompt', prompt: p.id, option: fight >= 0 ? fight : p.defaultOption });
    }
    sim.step();
  }
  assert.ok(s.raid?.tactics, 'the board is up');
  return { s, sim };
}

/** Fight the raid out: the founder kept on their feet (a downed founder has no chapter). */
function fightOut(s: GameState, sim: Sim, midway?: () => void) {
  const f = s.people.find((p) => p.id === s.mainId)!;
  for (let i = 0; i < 200_000 && s.raid; i++) {
    if (i === 30) midway?.();
    f.hp = maxHp(f);
    f.downed = null;
    sim.step(holdOf(s));
  }
  assert.equal(s.raid, null, 'the raid ended');
}

test('a raid won is one recap: the story chapter and the first on it, no card of their own', () => {
  const { s, sim } = fighting('sum-raid');
  fightOut(s, sim);
  const c = s.raidRecap!;
  assert.ok(c, 'the recap');
  assert.equal(c.chapter, `${s.people.find((p) => p.id === s.mainId)!.name}'s story: A raid survived`);
  assert.equal(s.story?.chapters.at(-1)?.kind, 'raid', 'still written in the Story');
  assert.ok(c.firsts?.some((f) => /first raid/.test(f.title)), 'the first raid is a line on the recap');
  assert.ok(s.milestones!.some((m) => /^raid/.test(m.id) && m.folded), 'with no card of its own');
  assert.ok(!s.prompts.some((p) => p.kind === 'debrief' && /story/.test(p.title)), 'no story card');
});

test('a raid with a death: the toll on the recap, the first death folded into it', () => {
  const { s, sim } = fighting('sum-raid-death');
  let dead = '';
  fightOut(s, sim, () => {
    const p = s.people.find((q) => q.id !== s.mainId && !!s.raid?.roll?.some((x) => x.id === q.id))!;
    dead = p.name;
    killPerson(s, p, 'in the raid');
  });
  const c = s.raidRecap!;
  assert.ok(c.rows.some((r) => r.name === dead && r.died), 'the dead are on the recap');
  const titles = (c.firsts ?? []).map((f) => f.title);
  assert.ok(titles.includes('The first death'), titles.join(', '));
  assert.equal(new Set(titles).size, titles.length, 'each first once');
  assert.ok(s.milestones!.filter((m) => m.folded).length >= 2);
  assert.ok(!s.prompts.some((p) => p.kind === 'debrief'), 'no other news card');
});

test('the town with the autopilot off is as before: no chapter, no firsts', () => {
  const s = town('sum-off');
  const h = postHunt(s, new Rng(3))!;
  assert.ok(leadQuest(s, 'hunt', h.id).ok);
  const rng = new Rng(5);
  for (let t = 0; t < 400 * TICKS_PER_HOUR && s.expeditions.length; t++) {
    s.tick++;
    updateExpeditions(s, rng);
    for (const p of [...s.prompts]) if (p.kind !== 'debrief') answerPrompt(s, p.id, p.defaultOption, rng);
    for (const p of s.people) if (!p.downed) p.needs = { food: 1, rest: 1 };
  }
  const d = newsCards(s)[0]?.debrief;
  assert.ok(d);
  assert.equal(d.chapter, undefined);
  assert.equal(d.firsts, undefined);
});
