import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ASK_HOURS, CREATURE_DEFS, CREATURE_PEN, CREATURE_KINDS, kindStats, CREATURE_SAGA, CREATURE_TOPIC, GROW_PACED_DAYS, TINT_GOOD, creatureTint } from '../src/shared/data/creature';
import { forgone } from '../src/shared/data/originResearch';
import { ORIGINS } from '../src/shared/data/origins';
import { DANGER_PACE } from '../src/shared/data/pace';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { Rng } from '../src/shared/rng';
import { adoptCreature, creatureAllies, creatureRaidOver, inRaid, chooseDeed, creatureArrives, creatureAttack, creatureHourly, creatureMaxHp, creatureTick, deedWeight, doDeed, moodOf, teachCreature, type CreatureState } from '../src/shared/sim/creature';
import { cropOf } from '../src/shared/sim/farming';
import { waitingOnFounder } from '../src/shared/sim/founderQuests';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { parseSave, serialize } from '../src/shared/sim/save';
import { isSagaDest, sagaTripHome, sagasHourly } from '../src/shared/sim/sagas';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campXY, makePerson, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';
import { totalStock } from '../src/shared/sim/buildings';
import { creatureCard, natureBar } from '../src/renderer/map/creatureCard';
import { ally } from '../src/shared/sim/classes';
import { ENEMIES } from '../src/shared/data/enemies';
import { creatureUnit } from '../src/shared/data/creature';
import type { Raid } from '../src/shared/sim/state';

function town(seed: string, people = 6): GameState {
  const s = plainGame(seed);
  s.tick = 30 * TICKS_PER_DAY;
  for (let i = 1; i < people; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name)));
  put(s, 'stockpile', campXY(s).x / 32 + 4, row(s), { store: { berries: 40, meat: 20, stone: 30 } });
  return s;
}
const beast = (seed: string, kind: CreatureState['kind'] = 'ape') => {
  const s = town(seed);
  const c = adoptCreature(s, kind);
  return { s, c };
};
const hour = (s: GameState) => (s.tick = (Math.floor(s.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR);

test('God Creatures is a second-age topic every people studies', () => {
  const t = TOPIC_BY_ID[CREATURE_TOPIC];
  assert.ok(t, 'the topic exists');
  assert.equal(t.era, 'medieval');
  assert.ok(!t.origin, 'no one people its own');
  for (const o of ORIGINS) assert.ok(!forgone(CREATURE_TOPIC, o), `${o} studies it`);
});

test('the saga begins with its quest, and its pick holds the game for the five kinds', () => {
  const s = town('beast-saga');
  s.autopilot = true;
  put(s, CREATURE_PEN, campXY(s).x / 32 - 8, row(s));
  hour(s);
  creatureArrives(s);
  assert.equal(s.sagas?.[0]?.id, CREATURE_SAGA, 'the saga begins');
  creatureArrives(s);
  assert.equal(s.sagas!.length, 1, 'and only once');
  // (the quest: the founder goes, and the party clears the hollow)
  const call = s.prompts.find((p) => p.kind === 'saga')!;
  answerPrompt(s, call.id, 0, new Rng(1));
  const trip = s.expeditions.find((e) => isSagaDest(e.dest))!;
  s.expeditions = s.expeditions.filter((e) => e !== trip);
  for (const p of s.people) if (trip.members.includes(p.id)) p.away = null;
  trip.cleared = true;
  sagaTripHome(s, trip);
  const q = s.prompts.find((p) => p.kind === 'saga')!;
  assert.ok(q, 'the pick is asked');
  assert.equal(q.options.length, 5);
  assert.ok(q.beasts && snapshot(s).prompts.find((p) => p.id === q.id)?.beasts, 'shown as the lineup of the five');
  CREATURE_KINDS.forEach((k, i) => assert.match(q.options[i], new RegExp(CREATURE_DEFS[k].name), 'the options in the kinds\' order'));
  for (const k of CREATURE_KINDS) {
    const d = CREATURE_DEFS[k];
    assert.ok(d.title && d.flavour.length >= 2 && d.goodAt && d.needsMost, `${k} has its card`);
    for (const b of kindStats(k)) assert.ok(b.value > 0 && b.value <= 1, `${k} ${b.label}`);
  }
  assert.equal(kindStats('ape')[0].value, 1, 'the ape learns fastest');
  assert.ok(q.waits && q.expiresTick === Number.MAX_SAFE_INTEGER, 'it waits for the player');
  assert.ok(waitingOnFounder(s), 'the game is held');
  const bear = q.options.findIndex((o) => /Bear/.test(o));
  answerPrompt(s, q.id, bear, new Rng(1));
  assert.equal(s.creature?.kind, 'bear', 'the picked kind is the town\'s');
  // (its first night, then the game goes on)
  const night = s.prompts.find((p) => p.kind === 'saga')!;
  assert.match(night.text, /first night/);
  answerPrompt(s, night.id, 0, new Rng(1));
  assert.ok(!waitingOnFounder(s), 'the game goes on');
  assert.ok(!s.prompts.some((p) => p.kind === 'saga'));
  // (the saga goes on to its first deed, and on to its end when the beast is grown)
  for (let i = 0; i < 60 && !s.prompts.some((p) => p.kind === 'saga'); i++) {
    hour(s);
    sagasHourly(s);
  }
  const first = s.prompts.find((p) => p.kind === 'saga')!;
  assert.ok(first && /deer/.test(first.text), 'its first deed is asked about');
  answerPrompt(s, first.id, 1, new Rng(1));
  assert.ok((s.creature!.weights.hunt ?? 0) > 0 && (s.creature!.weights.eat_crops ?? 0) < 0, 'the answer teaches it');
  // (another saga can still begin beside it)
  assert.ok((s.sagas ?? []).every((r) => r.id === CREATURE_SAGA));
});

test('praise makes a deed likelier and scolding less likely; the ape learns fastest; unanswered counts as neither', () => {
  const { s, c } = beast('beast-learn', 'ape');
  const before = deedWeight(c, 'steal');
  doDeed(s, c, 'steal', new Rng(1));
  assert.equal(c.ask?.deed, 'steal', 'a notable deed is asked about');
  const align = c.align;
  assert.ok(teachCreature(s, true));
  assert.ok(deedWeight(c, 'steal') > before, 'praised: likelier');
  assert.equal(c.align, align, 'praise does not move its nature');
  assert.equal(c.praised.steal, 1);
  assert.ok(!teachCreature(s, true), 'nothing left to answer');
  doDeed(s, c, 'steal', new Rng(2));
  teachCreature(s, false);
  doDeed(s, c, 'steal', new Rng(3));
  teachCreature(s, false);
  assert.ok(deedWeight(c, 'steal') < before, 'scolded twice: less likely than at first');
  // (the golem is slow to learn)
  const g = beast('beast-learn2', 'golem');
  doDeed(g.s, g.c, 'haul', new Rng(1));
  teachCreature(g.s, true);
  const a = beast('beast-learn3', 'ape');
  doDeed(a.s, a.c, 'haul', new Rng(1));
  teachCreature(a.s, true);
  assert.ok(a.c.weights.haul! > g.c.weights.haul!, 'the ape learns faster');
  // (left unanswered, the card lapses and nothing is learned)
  doDeed(a.s, a.c, 'play', new Rng(1));
  for (let i = 0; i <= ASK_HOURS; i++) {
    hour(a.s);
    creatureTick(a.s);
  }
  assert.equal(a.c.ask, undefined, 'the card lapsed');
  assert.equal(a.c.weights.play, undefined, 'neither praised nor scolded');
});

test('its nature moves with its deeds, and its tint follows: warm and bright when good, dark and red when cruel', () => {
  assert.equal(creatureTint(0), 0xffffff, 'untinted in the middle');
  assert.equal(creatureTint(100), TINT_GOOD);
  const lum = (t: number) => ((t >> 16) & 255) + ((t >> 8) & 255) + (t & 255);
  const warmth = (t: number) => ((t >> 16) & 255) - (t & 255);
  for (let a = -100; a < 0; a += 10) assert.ok(lum(creatureTint(a)) < lum(creatureTint(a + 10)), 'lighter as it turns from evil');
  for (let a = 0; a < 100; a += 10) assert.ok(warmth(creatureTint(a)) < warmth(creatureTint(a + 10)), 'warmer as it turns good');
  const evil = creatureTint(-100);
  assert.ok(((evil >> 16) & 255) > (evil & 255) && lum(evil) < 300, 'red-black');
  const { s, c } = beast('beast-align');
  for (let i = 0; i < 10; i++) doDeed(s, c, 'heal', new Rng(i));
  assert.ok(c.align >= 30, `healing made it good (${c.align})`);
  const good = snapshot(s).creature!;
  assert.ok(good.tint !== 0xffffff && ((good.tint >> 16) & 255) >= (good.tint & 255), 'tinted warm');
  for (let i = 0; i < 25; i++) doDeed(s, c, 'scare', new Rng(i));
  assert.ok(c.align < 0, `cruelty made it cruel (${c.align})`);
  assert.ok(lum(snapshot(s).creature!.tint) < lum(good.tint), 'darker for it');
});

test('it grows from young to huge over the paced days, slower when hungry, stronger as it grows', () => {
  const { s, c } = beast('beast-grow', 'bull');
  const small = { hp: creatureMaxHp(c), atk: creatureAttack(c), size: c.size };
  const hours = Math.ceil(GROW_PACED_DAYS * DANGER_PACE * 24 * 0.25);
  for (let i = 0; i < hours; i++) {
    hour(s);
    c.hunger = c.rest = c.play = 90;
    creatureHourly(s, c);
  }
  assert.ok(c.size > small.size + 0.2, `grew (${c.size})`);
  assert.ok(creatureMaxHp(c) > small.hp && creatureAttack(c) > small.atk, 'bigger is stronger');
  assert.ok(snapshot(s).creature!.scale > 1.2, 'drawn larger');
  const h = beast('beast-grow2', 'bull');
  for (let i = 0; i < hours; i++) {
    hour(h.s);
    h.c.hunger = 5;
    h.c.rest = h.c.play = 90;
    h.c.hp = 999;
    creatureHourly(h.s, h.c);
  }
  assert.ok(h.c.size < c.size, 'a hungry beast grows slower');
  assert.ok(c.size <= 1);
});

test('needs run down and drive its mood; starved it dies; fed and rested by the player it mends', () => {
  const { s, c } = beast('beast-needs', 'wolf');
  s.autopilot = true;
  const was = c.hunger;
  hour(s);
  creatureTick(s);
  assert.ok(c.hunger < was, 'hunger runs down');
  assert.equal(moodOf({ fear: 60, anger: 80, play: 10, hunger: 50 }), 'afraid');
  assert.equal(moodOf({ fear: 0, anger: 60, play: 10, hunger: 50 }), 'angry');
  assert.equal(moodOf({ fear: 0, anger: 0, play: 10, hunger: 50 }), 'lonely');
  assert.equal(moodOf({ fear: 0, anger: 0, play: 45, hunger: 50 }), 'bored');
  assert.equal(moodOf({ fear: 0, anger: 0, play: 90, hunger: 50 }), 'happy');
  // (neglected, it angers, and angry it turns to misdeeds)
  c.hunger = 5;
  c.rest = 5;
  c.play = 5;
  for (let i = 0; i < 6; i++) {
    hour(s);
    c.hunger = c.rest = c.play = 5;
    creatureHourly(s, c);
  }
  assert.equal(moodOf(c), 'angry', 'neglect angers it');
  // (the player feeds it and sends it to rest)
  const sim = new Sim(s);
  const food = totalStock(s).berries ?? 0;
  sim.command({ type: 'creature', op: 'feed' });
  sim.command({ type: 'creature', op: 'rest' });
  sim.step();
  assert.ok(c.hunger > 5 && (totalStock(s).berries ?? 0) < food, 'fed from the stores');
  assert.equal(c.doing, 'sleep');
  // (starved, it dies)
  const d = beast('beast-starve', 'wolf');
  d.s.autopilot = true;
  for (let i = 0; i < 24 * 20 && !d.c.dead; i++) {
    hour(d.s);
    d.c.hunger = 0;
    creatureHourly(d.s, d.c);
  }
  assert.equal(d.c.dead?.cause, 'starved');
  assert.equal(snapshot(d.s).creature!.dead, 'starved');
});

test('an angry beast does more harm than a happy one, and a good one more good', () => {
  const count = (mood: 'happy' | 'angry', align: number) => {
    let bad = 0;
    const { s, c } = beast(`beast-pick-${mood}`, 'bull');
    for (let i = 0; i < 300; i++) {
      c.anger = mood === 'angry' ? 80 : 0;
      c.play = 90;
      c.align = align;
      const d = chooseDeed(s, c, new Rng(i + 1));
      if (['eat_crops', 'steal', 'scare', 'eat_villager'].includes(d)) bad++;
    }
    return bad;
  };
  assert.ok(count('angry', 0) > count('happy', 0) * 2, 'anger turns it to misdeeds');
  assert.ok(count('happy', -80) > count('happy', 80), 'a cruel nature too');
});

test('it works for the town: hauling, building, the fields, the hunt; each kind best at its own', () => {
  const { s, c } = beast('beast-work', 'bull');
  const wood = totalStock(s).wood ?? 0;
  doDeed(s, c, 'haul', new Rng(1));
  assert.ok((totalStock(s).wood ?? 0) > wood, 'it hauls wood in');
  const meat = totalStock(s).meat ?? 0;
  doDeed(s, c, 'hunt', new Rng(1));
  assert.ok((totalStock(s).meat ?? 0) > meat, 'it brings home meat');
  // (a building under way, its makings brought: the golem raises it faster than the ape)
  const raise = (kind: CreatureState['kind']) => {
    const b = beast(`beast-build-${kind}`, kind);
    const site = put(b.s, 'cottage', campXY(b.s).x / 32 - 8, row(b.s), { status: 'blueprint', progress: 0 });
    site.delivered = { ...((): Record<string, number> => ({ wood: 999, stone: 999, hide: 999, fiber: 999, clay: 999 }))() };
    doDeed(b.s, b.c, 'build', new Rng(1));
    return site.progress;
  };
  assert.ok(raise('golem') > raise('ape') && raise('ape') > 0, 'the golem builds best');
  const f = beast('beast-farm', 'bull');
  const field = put(f.s, 'garden_plot', campXY(f.s).x / 32 + 10, row(f.s));
  cropOf(field).stage = 'growing';
  doDeed(f.s, f.c, 'farm', new Rng(1));
  assert.ok(cropOf(field).growth > 0, 'it helps the crops along');
  doDeed(f.s, f.c, 'eat_crops', new Rng(1));
  assert.equal(cropOf(field).growth, 0, 'or eats them');
  assert.ok((f.c.done.farm ?? 0) >= 1 && (c.done.haul ?? 0) > 0, 'the work is counted');
});

test('every kind is picked and drawn; an old save without a creature loads and runs, and one with it keeps it', () => {
  for (const k of CREATURE_KINDS) {
    const { s } = beast(`beast-kind-${k}`, k);
    const v = snapshot(s).creature!;
    assert.equal(v.kind, k);
    assert.ok(v.name && v.kindName && v.maxHp > 0);
  }
  const old = plainGame('beast-old');
  delete old.creature;
  const r = parseSave(serialize(old, 0));
  assert.ok(r.ok);
  const sim = new Sim(r.save.state);
  sim.state.autopilot = true;
  for (let i = 0; i < TICKS_PER_HOUR * 2; i++) sim.step();
  assert.equal(snapshot(sim.state).creature, null);
  const { s } = beast('beast-save', 'golem');
  const back = parseSave(serialize(s, 0));
  assert.ok(back.ok);
  assert.equal(back.save.state.creature?.kind, 'golem');
});

const fakeRaid = (s: GameState): Raid => ({ id: s.nextId++, kind: 'wolves', side: 1, phase: 'active', arrivesTick: 0, leavesTick: 0, raiders: [], prompt: null }) as unknown as Raid;

test('in a raid it fights as a big unit of the town\'s side, as strong as it is grown; hurt badly, it stays home', () => {
  for (const k of CREATURE_KINDS) {
    const e = ENEMIES[creatureUnit(k)];
    assert.ok(e && !e.boss && 'sheet' in e.sprite, `${k} has a board unit`);
  }
  const { s, c } = beast('beast-raid', 'bear');
  s.autopilot = true;
  c.size = 0.8;
  c.hp = creatureMaxHp(c);
  const raid = fakeRaid(s);
  s.raid = raid;
  assert.ok(creatureAllies(s, raid, (k) => ally(s, k, 0, 1)));
  const u = raid.raiders[0];
  assert.ok(u.ally && u.creature && u.kind === creatureUnit('bear'));
  assert.equal(u.maxHp, creatureMaxHp(c));
  assert.ok((u.might ?? 0) > 0.8, 'grown: strong');
  assert.ok(inRaid(s) && snapshot(s).creature!.fighting, 'drawn in the raid, not on its own');
  // (it comes home with the health the fight left it, and the fight is a deed asked about)
  u.hp = Math.round(u.maxHp / 2);
  const align = c.align;
  creatureRaidOver(s, raid);
  assert.equal(c.hp, u.hp);
  assert.ok(c.align > align && c.ask?.deed === 'fight');
  // (beaten down: dead, or home badly hurt and afraid)
  let died = 0;
  for (let i = 0; i < 40; i++) {
    const b = beast(`beast-raid-${i % 4}`, 'wolf');
    b.s.autopilot = true;
    b.s.tick += i * TICKS_PER_HOUR;
    const r = fakeRaid(b.s);
    creatureAllies(b.s, r, (k) => ally(b.s, k, 0, 1));
    r.raiders[0].down = true;
    r.raiders[0].hp = 0;
    creatureRaidOver(b.s, r);
    if (b.c.dead) died++;
    else assert.ok(b.c.hp > 0 && b.c.hp < creatureMaxHp(b.c) / 2 && b.c.fear >= 40);
  }
  assert.ok(died > 0 && died < 20, `it can die in a raid, but rarely (${died} of 40)`);
  // (too hurt to fight)
  const h = beast('beast-raid-hurt', 'golem');
  h.s.autopilot = true;
  h.c.hp = 1;
  assert.ok(!creatureAllies(h.s, fakeRaid(h.s), (k) => ally(h.s, k, 0, 1)));
});

test('its card tells its nature on a bar from evil to good, its needs, and what it has learned', () => {
  assert.equal(natureBar(-100), `Evil ◆${'▬'.repeat(10)} Good`);
  assert.equal(natureBar(100), `Evil ${'▬'.repeat(10)}◆ Good`);
  const { s, c } = beast('beast-card', 'golem');
  c.weights = { build: 1, steal: -1 };
  doDeed(s, c, 'build', new Rng(1));
  const card = creatureCard(snapshot(s).creature!);
  assert.match(card.title, /the Golem$/);
  assert.ok(card.lines.some((l) => /Learned to like: building/.test(l)) && card.lines.some((l) => /shun: raiding the stores/.test(l)));
  assert.ok(card.lines.some((l) => /Praise or scold it\?/.test(l)));
});
