// The God creature's second round (docs/notes/god-creature-2.md): its name, its pen, coming back from the dead, its
// spells (by nature and by watching), and its life among the townsfolk, the founder first.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BACK_HP, CREATURE_NAMES, CREATURE_SAGA, CREATURE_PEN, NUDGE, RESPAWN_HOURS } from '../src/shared/data/creature';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { NATURE_SPELLS, SPELLS_MOST } from '../src/shared/data/creatureSpells';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { SPELL_BY_ID } from '../src/shared/data/spells';
import { Rng } from '../src/shared/rng';
import type { Battle } from '../src/shared/sim/combat';
import { adoptCreature, creatureArrives, creatureView, creatureDies, creatureHourly, creatureMaxHp, creatureTick, deedWeight, doDeed, penOf, type CreatureState } from '../src/shared/sim/creature';
import { CREATURE_REF, creatureBattleOver, creatureFighter, joinAdventures, likeOf, nudgeLiking, watchBattle } from '../src/shared/sim/creatureFolk';
import { creatureKit, creatureWatches, learnByNature, learnSpell, miracleFor, watchInTown } from '../src/shared/sim/creatureSpells';
import { CREATURE_NAMING } from '../src/shared/sim/naming';
import { startRaid, updateRaid } from '../src/shared/sim/raids';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { beginSaga, sagasHourly } from '../src/shared/sim/sagas';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { campXY, makePerson, maxHp, type Expedition, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { creatureCard } from '../src/renderer/map/creatureCard';
import { plainGame, put, row } from './helpers';

function town(seed: string, people = 6): GameState {
  const s = plainGame(seed);
  s.tick = 30 * TICKS_PER_DAY;
  for (let i = 1; i < people; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name)));
  put(s, 'stockpile', campXY(s).x / 32 + 4, row(s), { store: { berries: 40, meat: 20, stone: 30 } });
  return s;
}
const pen = (s: GameState) => put(s, CREATURE_PEN, campXY(s).x / 32 - 9, row(s));
const beast = (seed: string, kind: CreatureState['kind'] = 'wolf', withPen = true) => {
  const s = town(seed);
  s.autopilot = true;
  if (withPen) pen(s);
  const c = adoptCreature(s, kind);
  return { s, c };
};
const hour = (s: GameState) => (s.tick = (Math.floor(s.tick / TICKS_PER_HOUR) + 1) * TICKS_PER_HOUR);
const founder = (s: GameState) => s.people.find((p) => p.id === s.mainId)!;

test('the town names it: three names that fit its kind or one typed, and every line about it uses the name', () => {
  const { s, c } = beast('c2-name', 'bear');
  const q = s.prompts.find((p) => p.kind === 'name' && p.naming?.kind === 'creature')!;
  assert.ok(q, 'a naming question is put');
  assert.equal(q.options.length, 4, 'three suggestions and keep');
  for (const n of q.options.slice(0, 3)) assert.ok(CREATURE_NAMES.bear.includes(n), `${n} fits a bear`);
  assert.match(q.options[3], new RegExp(c.name));
  answerPrompt(s, q.id, 1, new Rng(1));
  assert.equal(c.name, q.options[1], 'named as picked');
  assert.ok(c.history!.some((h) => h.text.includes(c.name)), 'remembered');
  // (renamed from its menu: the `name` command)
  const sim = new Sim(s);
  sim.command({ type: 'name', kind: 'creature', id: CREATURE_NAMING, name: 'Old Barnaby' });
  sim.step();
  assert.equal(c.name, 'Old Barnaby');
  const v = snapshot(s).creature!;
  assert.equal(v.name, 'Old Barnaby');
  assert.match(creatureCard(v).title, /Old Barnaby/);
  doDeed(s, c, 'haul', new Rng(2));
  assert.match(c.log.at(-1)!, /^Old Barnaby/, 'its deeds are told by name');
  // (a name a townsperson has is refused)
  sim.command({ type: 'name', kind: 'creature', id: CREATURE_NAMING, name: founder(s).name });
  sim.step();
  assert.equal(c.name, 'Old Barnaby');
});

test('the pen is open from the start, ordered by the player only, and the saga no longer waits for it; the beast sleeps there', () => {
  const d = BUILDING_BY_ID[CREATURE_PEN];
  assert.ok(d && !d.research, 'no research opens the pen: it is open from the start');
  const s = town('c2-pen');
  s.autopilot = true;
  hour(s);
  creatureArrives(s);
  assert.ok((s.sagas ?? []).some((r) => r.id === 'great_beast'), 'the saga begins with no pen');
  const sim = new Sim(s);
  for (let i = 0; i < 6; i++) sim.step();
  assert.ok(!s.buildings.some((b) => b.def === CREATURE_PEN), 'the town never lays out a pen itself');
  const p = pen(s);
  // (it lives at the pen, and lies down there)
  const c = adoptCreature(s, 'golem');
  assert.equal(penOf(s), p);
  doDeed(s, c, 'sleep', new Rng(1));
  const at = c.goal!;
  assert.ok(Math.hypot(at.x - (p.tile + 2) * 32, at.y - (p.row + 1.5) * 32) < 96, 'it sleeps in its pen');
  assert.equal(snapshot(s).creature!.pen, p.id);
});

test('dead, it comes back at its pen after a while, weakened, keeping its name, learning and nature; no pen, it waits', () => {
  const { s, c } = beast('c2-back', 'ape');
  c.name = 'Mossback';
  c.size = 0.7;
  c.align = 55;
  c.weights.haul = 2;
  learnSpell(s, c, 'mend', 'its nature', 0.6);
  creatureDies(s, c, 'killed fighting the raiders');
  assert.ok(c.dead && snapshot(s).creature!.backIn === RESPAWN_HOURS);
  // (not yet)
  for (let i = 0; i < RESPAWN_HOURS - 1; i++) {
    hour(s);
    creatureTick(s);
  }
  assert.ok(c.dead, 'still dead before its time');
  hour(s);
  creatureTick(s);
  assert.ok(!c.dead, 'back');
  assert.equal(c.name, 'Mossback');
  assert.equal(c.align, 55);
  assert.equal(c.weights.haul, 2);
  assert.ok(c.spells?.mend, 'its spells kept');
  assert.ok(c.size < 0.7 && c.hp <= Math.ceil(creatureMaxHp(c) * BACK_HP), 'weakened');
  const p = penOf(s)!;
  assert.ok(Math.hypot(c.x - (p.tile + 2) * 32, c.y - (p.row + 1.5) * 32) < 96, 'at its pen');
  assert.equal(c.deaths, 1);
  assert.ok(snapshot(s).creature!.backAgo !== undefined);
  // (its pen gone, it waits until one is built again)
  creatureDies(s, c, 'starved');
  s.buildings = s.buildings.filter((b) => b.def !== CREATURE_PEN);
  for (let i = 0; i < RESPAWN_HOURS + 5; i++) {
    hour(s);
    creatureTick(s);
  }
  assert.ok(c.dead && c.penless, 'nowhere to come back to');
  assert.equal(snapshot(s).creature!.backIn, null);
  pen(s);
  hour(s);
  creatureTick(s);
  assert.ok(!c.dead, 'back once a pen is built again');
});

test('an old town with a creature and no pen keeps it, and its saga carries on; an old save loads', () => {
  const { s, c } = beast('c2-old', 'bull', false);
  // (an older save's beast: none of the new fields)
  for (const k of ['likes', 'history', 'spells', 'seen', 'fond', 'deaths'] as const) delete c[k];
  beginSaga(s, CREATURE_SAGA);
  const r = parseSave(serialize(s, 0));
  assert.ok(r.ok);
  const back = r.save.state;
  assert.ok(back.creature && !back.creature.dead, 'kept');
  for (let i = 0; i < 24; i++) {
    hour(back);
    creatureTick(back);
  }
  assert.ok(back.creature!.hp > 0);
  const v = snapshot(back).creature!;
  assert.equal(v.pen, null);
  assert.equal(v.likes.length, 4, 'its likings from its kind');
  for (let i = 0; i < 30; i++) {
    hour(back);
    sagasHourly(back);
  }
  assert.ok((back.sagas ?? []).some((x) => x.id === CREATURE_SAGA), 'its saga carries on');
});

test('its nature brings it miracles: a good beast heals and calls rain, a cruel one terror and fire', () => {
  const { s, c } = beast('c2-nature', 'bear');
  c.align = 45;
  learnByNature(s, c);
  assert.ok(c.spells?.mend && c.spells.healing_rain && !c.spells.holy_shield, 'good: mend and rain, not yet the shield');
  const e = beast('c2-cruel', 'wolf');
  e.c.align = -65;
  learnByNature(e.s, e.c);
  for (const n of NATURE_SPELLS.filter((x) => x.at < 0)) assert.ok(e.c.spells?.[n.id], `cruel: ${n.id}`);
  assert.ok(!e.c.spells?.mend);
  // (it works them in the town: a mend on the hurt founder first, and gets better at it)
  const f = founder(s);
  f.hp = Math.round(maxHp(f) * 0.3);
  const was = f.hp;
  const wish = miracleFor(s, c, false)!;
  assert.equal(wish.on, f, 'the founder first');
  const skill = c.spells!.mend.skill;
  doDeed(s, c, 'miracle', new Rng(3));
  assert.ok(f.hp > was && c.spells!.mend.skill > skill, 'healed, and better at it');
  assert.equal(s.creature!.doing, 'miracle');
  assert.ok(!miracleFor(s, c, false), 'not again so soon');
});

test('it learns by watching: a spell cast in its sight is counted, and learned more surely each time it is seen', () => {
  let learned = 0;
  let after = 0;
  for (let i = 0; i < 40; i++) {
    const { s, c } = beast(`c2-watch-${i}`, 'ape');
    s.tick += i * 7;
    if (creatureWatches(s, c, 'fire_bolt', 'Edda')) learned++;
    for (let k = 0; k < 6 && !c.spells?.fire_bolt; k++) {
      s.tick++;
      creatureWatches(s, c, 'fire_bolt', 'Edda');
    }
    if (c.spells?.fire_bolt) after++;
    assert.ok((c.seen?.fire_bolt ?? 0) >= 1, 'seen is counted');
  }
  assert.ok(learned < 20, `not at once, mostly (${learned} of 40)`);
  assert.ok(after > learned * 1.5 && after >= 20, `more surely the more it sees (${after} of 40)`);
  const { s, c } = beast('c2-watch-from', 'ape');
  for (let k = 0; k < 40 && !c.spells?.fire_bolt; k++) {
    s.tick++;
    creatureWatches(s, c, 'fire_bolt', 'Edda');
  }
  assert.equal(c.spells!.fire_bolt.from, 'watching Edda');
  assert.ok(c.history!.some((h) => /Fire Bolt/.test(h.text)), 'remembered');
  // (a mage practising nearby in the town is watched too)
  const t = beast('c2-watch-town', 'ape');
  const mage = t.s.people.find((p) => p.id !== t.s.mainId)!;
  mage.cls = 'mage';
  mage.level = 10;
  mage.x = t.c.x + 20;
  mage.y = t.c.y;
  for (let k = 0; k < 60; k++) {
    hour(t.s);
    watchInTown(t.s, t.c);
  }
  assert.ok(Object.keys(t.c.seen ?? {}).some((id) => SPELL_BY_ID[id]?.cls === 'mage'), 'it watched the mage practise');
  // (it knows only so many: a new one pushes out the least used)
  for (const id of ['spark', 'flash', 'quicken', 'ward', 'fire_bolt', 'frost_shard', 'flame_wave', 'ice_lance', 'smite']) learnSpell(t.s, t.c, id, 'watching', 0.2);
  assert.ok(Object.keys(t.c.spells!).length <= SPELLS_MOST);
});

test('it casts its spells in raids from a kit of its own, strong but weaker than a caster\'s', () => {
  const s = town('c2-raid', 5);
  s.autopilot = true;
  s.battles = true;
  s.battleStyle = 'tactics';
  s.tacticsAuto = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  s.raidOdds = { streak: 3 };
  for (const p of s.people) p.priorities.defend = 1;
  pen(s);
  const c = adoptCreature(s, 'wolf');
  c.size = 0.8;
  c.hp = creatureMaxHp(c);
  learnSpell(s, c, 'fireball', 'its nature', 0.5);
  const kit = creatureKit(c)!;
  const fb = kit.actions[0];
  assert.ok(fb.cooldown > SPELL_BY_ID.fireball.cooldown * 10, 'slower than a caster');
  const raw = SPELL_BY_ID.fireball.effects.find((x) => x.kind === 'damage')!;
  assert.ok((fb.effects.find((x) => x.kind === 'damage')!.power ?? 1) < (raw.power ?? 1), 'weaker than a caster');
  const r = startRaid(s, RAID_KIND_BY_ID.bandits, 200, new Rng(5));
  s.prompts = [];
  r.arrivesTick = s.tick;
  const rng = new Rng(11);
  for (let i = 0; i < 4000 && s.raid && !(c.spells!.fireball.uses > 0); i++) {
    s.tick++;
    updateRaid(s, rng);
  }
  assert.ok(c.spells!.fireball.uses > 0, 'it cast its fireball on the board');
});

test('it goes with the founder\'s party, fights in its fights and watches its casters; another party only if it likes adventure', () => {
  const { s, c } = beast('c2-trip', 'wolf');
  c.size = 0.6;
  c.hp = creatureMaxHp(c);
  const f = founder(s);
  const e = { id: s.nextId++, dest: 'forest', members: [f.id], phase: 'out', elapsed: 0, recalled: false } as unknown as Expedition;
  s.expeditions.push(e);
  c.likes = { play: 0, work: 0, adventure: -0.2, magic: 0 };
  hour(s);
  assert.ok(joinAdventures(s, c), 'the founder\'s, even with no great taste for it');
  assert.equal(c.away?.founder, true);
  assert.ok(creatureView(s)!.away);
  // (in its fights, with its spells, and it watches the party's casters)
  learnSpell(s, c, 'terror', 'its nature', 0.4);
  const fighter = creatureFighter(s, e)!;
  assert.ok(fighter && fighter.side === 'party' && fighter.kit?.actions.length === 1);
  const b = { fighters: [fighter], tick: 5, outcome: 'won', boss: false, acts: [{ tick: 5, side: 'party', ref: f.id, name: 'Smite', targets: [], meta: { spell: true, ult: false, cost: 0, pool: 'mp' } }] } as unknown as Battle;
  watchBattle(s, e, b);
  assert.equal(c.seen?.smite, 1, 'it saw the founder cast');
  fighter.hp = 10;
  creatureBattleOver(s, e, b);
  assert.equal(c.hp, 10, 'it keeps the fight\'s wounds');
  assert.equal(b.fighters[0].ref, CREATURE_REF);
  // (home with the party)
  s.expeditions = [];
  creatureTick(s);
  assert.ok(!c.away, 'home');
  // (someone else's party: only once it likes adventure)
  const o = beast('c2-trip-other', 'golem');
  o.c.size = 0.6;
  o.c.hp = creatureMaxHp(o.c);
  o.c.likes = { play: 0, work: 0, adventure: 0, magic: 0 };
  const other = o.s.people.find((p) => p.id !== o.s.mainId)!;
  let went = 0;
  for (let i = 0; i < 10; i++) {
    o.s.expeditions = [{ id: o.s.nextId++, dest: 'forest', members: [other.id], phase: 'out', elapsed: 0, recalled: false } as unknown as Expedition];
    hour(o.s);
    if (joinAdventures(o.s, o.c)) went++;
    o.c.away = undefined;
  }
  assert.equal(went, 0, 'not one for adventure: it stays');
  o.c.likes.adventure = 0.8;
  for (let i = 0; i < 10; i++) {
    o.s.expeditions = [{ id: o.s.nextId++, dest: 'forest', members: [other.id], phase: 'out', elapsed: 0, recalled: false } as unknown as Expedition];
    hour(o.s);
    if (joinAdventures(o.s, o.c)) went++;
    o.c.away = undefined;
  }
  assert.ok(went > 0, 'it loves adventure: it goes');
});

test('it puts the founder first: at their side, their building, their wounds; and plays with the townsfolk', () => {
  const { s, c } = beast('c2-founder', 'ape');
  const f = founder(s);
  const base = deedWeight(c, 'follow');
  assert.ok(deedWeight(c, 'follow', s, f.id) > base, 'the founder pulls it');
  assert.ok(deedWeight(c, 'build', s, f.id) > deedWeight(c, 'build', s), 'their work first');
  // (over many hours it is often at the founder's side, and fonder of them than of anyone)
  let follows = 0;
  let plays = 0;
  for (let i = 0; i < 200; i++) {
    hour(s);
    c.hunger = c.rest = 90;
    c.until = s.tick;
    c.doing = 'wander';
    creatureHourly(s, c);
    const did = c.doing as string;
    if (did === 'follow') follows++;
    if (did === 'play') plays++;
  }
  assert.ok(follows > 20, `often with the founder (${follows} of 200)`);
  assert.ok(plays > 5, `and at play (${plays})`);
  const fond = Object.entries(c.fond ?? {}).sort((a, b) => b[1] - a[1]);
  assert.equal(Number(fond[0][0]), f.id, 'the founder is its favourite');
  assert.equal(snapshot(s).creature!.friends[0], f.name);
  // (walking at their side)
  c.doing = 'follow';
  c.until = s.tick + TICKS_PER_HOUR;
  s.tick++;
  creatureTick(s);
  assert.ok(Math.hypot(c.goal!.x - f.x, c.goal!.y - f.y) < 64);
});

test('the player nudges a liking gently, once in a while; it drifts with what it does', () => {
  const { s, c } = beast('c2-nudge', 'bull');
  const was = likeOf(c, 'play');
  assert.equal(nudgeLiking(s, 'play', true), null);
  assert.ok(likeOf(c, 'play') > was && likeOf(c, 'play') <= was + NUDGE + 1e-9, 'a nudge, not an order');
  assert.ok(nudgeLiking(s, 'play', true), 'not again at once');
  s.tick += 3 * TICKS_PER_HOUR;
  const sim = new Sim(s);
  sim.command({ type: 'creatureNudge', liking: 'adventure', up: false });
  sim.step();
  assert.ok(likeOf(c, 'adventure') < 0.2);
  const v = snapshot(s).creature!;
  assert.ok(!v.nudgeReady && v.likes.find((l) => l.id === 'adventure'));
});
