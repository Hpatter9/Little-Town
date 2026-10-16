import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_BY_ID } from '../src/shared/data/events';
import { FATEFUL_EVENTS, FATEFUL_GAP_DAYS, FATEFUL_WEIGHT, FATE_LATER_DAYS } from '../src/shared/data/fatefulEvents';
import { Rng } from '../src/shared/rng';
import { answerEvent, maybeEvent, startEvent } from '../src/shared/sim/events';
import { destinationUnlocked, updateExpeditions } from '../src/shared/sim/expeditions';
import { ODDS_WORDS, homeShare, oddsFor, oddsWordFor, stakeCard } from '../src/shared/sim/stakes';
import { musterView, raiseParty, sendMuster, setMuster } from '../src/shared/sim/muster';
import { boardDestinations, dangerOf } from '../src/shared/sim/parties';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { fatesView } from '../src/shared/sim/fates';
import { maxHp, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

// The stakes: the odds in words on the stake card (honest to the computed chance), the result that leads with who came
// home, and the fateful choices (rarer, resolved on their own stream, remembered with what came of them).

function town(seed: string, n: number): GameState {
  const s = plainGame(seed);
  for (let i = 0; i < n; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, ambition: 'farmer', partner: null, guard: false };
    p.x += (i + 1) * 4;
    s.people.push(p);
  }
  for (const p of s.people) {
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
  }
  s.people[1].ambition = 'adventurer';
  s.coins = 500;
  return s;
}
const dangerous = (s: GameState) => boardDestinations(s).find((d) => destinationUnlocked(s, d) && dangerOf(d) > 0 && d.type !== 'delve')!;

test('the odds in words match the band of the computed chance, at every ratio', () => {
  let last = -1;
  let lastShare = -1;
  for (let r = 0; r <= 5; r += 0.01) {
    const share = homeShare(r);
    assert.ok(share >= lastShare, 'a stronger party never has worse odds');
    lastShare = share;
    const w = oddsWordFor(share);
    // the word is only said where the chance is in its band
    const band = ODDS_WORDS.findIndex((x) => x.word === w.word);
    assert.ok(share >= ODDS_WORDS[band].at, `${w.word} said at ${share}`);
    if (band > 0) assert.ok(share < ODDS_WORDS[band - 1].at, `${w.word} said above its band at ${share}`);
    // and a stronger party's word is never graver
    const rank = ODDS_WORDS.length - band;
    assert.ok(rank >= last, 'the words only get kinder as the party gets stronger');
    last = rank;
  }
  assert.equal(oddsWordFor(0.5).word, 'Half may not come home', 'about half home reads as such');
  assert.equal(oddsWordFor(0.85).word, 'Likely to return');
  assert.ok(homeShare(5) > 0.99 && homeShare(0) < 0.15);
});

test('a real party reads kinder against a lesser place; a bold trip reads worse than a careful one', () => {
  const s = town('stakes-odds', 6);
  const d = dangerous(s);
  const party = s.people.slice(0, 4);
  const careful = oddsFor(d, party, 'safe');
  const bold = oddsFor(d, party, 'risky');
  assert.ok(bold.share <= careful.share, 'bold counts the danger higher');
  const weak = oddsFor(d, party.slice(0, 1), 'safe');
  assert.ok(weak.share <= careful.share, 'one person is no better than four');
  const strong = party.map((p) => ({ ...p, hp: p.hp, maxHpBonus: 0 }));
  for (const p of strong) p.skills.melee.level = 60;
  assert.ok(oddsFor(d, strong as typeof party, 'safe').share >= careful.share, 'a seasoned party reads better');
  assert.equal(oddsFor({ ...d, encounters: { ...d.encounters, arrival: 0, ambush: 0 }, type: 'gather' }, party, 'safe').word, 'Nothing to fear but the road', 'a place with nothing to fight');
});

test('the stake card: who goes, what they seek, what the town risks, how long; a warning for the founder, a favourite or the leader; no draws', () => {
  const s = town('stakes-card', 6);
  const d = dangerous(s);
  assert.ok(raiseParty(s, d.id).ok);
  const rng = s.rngState;
  const view = musterView(s, () => null)!;
  const again = musterView(s, () => null)!;
  assert.equal(s.rngState, rng, 'reading the card draws nothing');
  assert.deepEqual(view.stake, again.stake, 'the same card twice');
  assert.ok(view.stake.word && ODDS_WORDS.some((w) => w.word === view.stake.word));
  assert.ok(view.stake.seeks.length >= 1, 'something sought');
  assert.ok(view.stake.risks[0].includes(s.people.find((p) => p.id === view.leader)!.name), 'the people at stake are named');
  assert.ok(view.stake.risks.some((l) => /food packed/.test(l)));
  assert.ok(view.stake.seconds > 0);
  // the leader is always named in the one warning, a favourite before the leader, the founder before both
  const m = s.muster!;
  m.members = m.members.filter((id) => id !== s.mainId);
  const leader = s.people.find((p) => p.id === m.leader)!;
  assert.match(stakeCard(s, m, d).warning!, new RegExp(`${leader.name} leads them`));
  s.favourites = [m.members.at(-1)!];
  const fav = s.people.find((p) => p.id === m.members.at(-1))!;
  assert.match(stakeCard(s, m, d).warning!, new RegExp(`${fav.name}.*favourite`));
  m.members.push(s.mainId);
  assert.match(stakeCard(s, m, d).warning!, /founded the town/);
});

test('home from a commanded trip: the result leads with who came back and who did not, then the haul; the gate is marked for the camera', () => {
  const s = town('stakes-home', 6);
  const d = dangerous(s);
  raiseParty(s, d.id);
  setMuster(s, { rations: 'plenty', stakes: 'safe' });
  assert.ok(sendMuster(s).ok);
  const e = s.expeditions[0];
  const rng = new Rng(3);
  for (let t = 0; t < 400 * TICKS_PER_HOUR && s.expeditions.length; t++) {
    s.tick++;
    updateExpeditions(s, rng);
    for (const p of [...s.prompts]) if (p.kind !== 'debrief') answerPrompt(s, p.id, p.defaultOption, rng);
    for (const p of s.people) p.needs = { food: 1, rest: 1 };
  }
  const r = s.prompts.find((p) => p.kind === 'debrief');
  assert.ok(r?.debrief, 'a result with its parts');
  assert.equal(r!.debrief!.back.length + r!.debrief!.lost.length, Object.keys(e.start!.names).length, 'everyone who set out is accounted for');
  assert.ok(Array.isArray(r!.debrief!.haul));
  assert.ok(s.homecoming && s.homecoming.expedition === e.id, 'the camera has the gate to go to');
});

test('the fateful rate: a long gap between them, honoured by every fateful event, and a lower weight than before', () => {
  assert.ok(FATEFUL_GAP_DAYS >= 8, 'at least eight days between fateful events');
  assert.ok(FATEFUL_WEIGHT <= 4);
  const s = plainGame('stakes-rate');
  s.tick = 40 * TICKS_PER_DAY;
  const open = FATEFUL_EVENTS.filter((e) => e.when!(s));
  assert.ok(open.length >= 3, 'some are open long after the start');
  s.lastFateful = s.tick - (FATEFUL_GAP_DAYS * TICKS_PER_DAY - 1);
  assert.equal(FATEFUL_EVENTS.filter((e) => e.when!(s)).length, 0, 'none a tick short of the gap');
  s.lastFateful = s.tick - FATEFUL_GAP_DAYS * TICKS_PER_DAY;
  assert.ok(FATEFUL_EVENTS.some((e) => e.when!(s)), 'open again at the gap');
});

test('a fateful choice is remembered, resolved on its own stream, and its consequence line lands later', () => {
  const s = town('stakes-fate', 8);
  s.nextEventTick = Number.MAX_SAFE_INTEGER;
  s.tick = 30 * TICKS_PER_DAY;
  const probe = new Rng(11);
  startEvent(s, EVENT_BY_ID.stranger_at_the_gate, probe);
  const mark = probe.state;
  answerEvent(s, 0, probe);
  assert.equal(probe.state, mark, 'answering it draws nothing from the town stream');
  assert.equal(s.fates?.length, 1);
  const f = s.fates![0];
  assert.equal(f.event, 'stranger_at_the_gate');
  assert.equal(f.day, 31);
  assert.ok(/stranger/.test(f.title) && f.choice && f.result, 'the day, the title, the answer and what came of it at once');
  assert.equal(f.later, undefined, 'the consequence has not landed');
  assert.equal(f.pending, true, 'and is said to be coming');
  assert.ok(s.heirId !== undefined && s.people.some((p) => p.id === s.heirId), 'the stranger is named heir');
  // the days go by: the consequences land one by one, each adding its line
  const end = s.tick + FATE_LATER_DAYS * TICKS_PER_DAY;
  const rng = new Rng(2);
  while (s.eventLater?.length && s.tick < end) {
    s.tick = Math.max(s.tick + 1, Math.ceil(Math.min(...s.eventLater.map((l) => l.tick)) / TICKS_PER_HOUR) * TICKS_PER_HOUR);
    maybeEvent(s, rng);
    s.nextEventTick = Number.MAX_SAFE_INTEGER;
  }
  assert.ok(f.later && /hunted the stranger|signet/.test(f.later), `a consequence line: ${f.later}`);
  assert.equal(f.pending, undefined, 'nothing more is coming once both have landed');
  assert.equal(fatesView(s)[0].event, 'stranger_at_the_gate');
  // the same answer on the same seed and tick comes out the same (the stream is the seed's own)
});

test('a fateful choice on the same seed and tick comes out the same every time', () => {
  const run = () => {
    const s = town('stakes-same', 8);
    s.tick = 20 * TICKS_PER_DAY;
    startEvent(s, EVENT_BY_ID.warlords_oath, new Rng(1));
    answerEvent(s, 2, new Rng(99));
    return JSON.stringify([s.fates, s.nextRaidTick, s.reputation]);
  };
  assert.equal(run(), run());
});

test('the bargain costs a life later, the shrine moves the gods, and each fateful event has a consequence', () => {
  const s = town('stakes-bargain', 8);
  s.tick = 20 * TICKS_PER_DAY;
  const rng = new Rng(4);
  startEvent(s, EVENT_BY_ID.hollow_tithe, rng);
  const who = s.event!.who!;
  const folk = s.people.length;
  answerEvent(s, 0, rng); // (strike the bargain)
  assert.equal(s.people.length, folk, 'nobody dies yet');
  const end = s.tick + FATE_LATER_DAYS * TICKS_PER_DAY;
  while (s.eventLater?.length && s.tick < end) {
    s.tick = Math.max(s.tick + 1, Math.ceil(Math.min(...s.eventLater.map((l) => l.tick)) / TICKS_PER_HOUR) * TICKS_PER_HOUR);
    maybeEvent(s, rng);
    s.nextEventTick = Number.MAX_SAFE_INTEGER;
  }
  assert.ok(s.people.length < folk, 'the price was paid in a life');
  assert.ok(!s.people.some((p) => p.id === who) || s.people.length < folk);
  assert.match(s.fates![0].later!, /price/);
  const t = town('stakes-shrine', 8);
  const r2 = new Rng(5);
  startEvent(t, EVENT_BY_ID.shrine_in_the_wood, r2);
  answerEvent(t, 1, r2); // (to war)
  assert.equal(t.faith!.favour.war, 10 + 40);
  assert.equal(t.faith!.favour.harvest, 10 - 10);
  for (const id of ['stranger_at_the_gate', 'hollow_tithe', 'shrine_in_the_wood', 'warlords_oath', 'the_deep_well']) {
    const def = EVENT_BY_ID[id];
    assert.ok(def.fateful && def.remember, id);
    assert.ok(def.options.every((o) => o.effects.some((e) => 'later' in e)) || id === 'the_deep_well' || id === 'stranger_at_the_gate', `${id}: every answer has a consequence to come`);
  }
});
