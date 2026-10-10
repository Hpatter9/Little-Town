import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACTION_BY_ID, HOST_MOST } from '../src/shared/data/factions';
import { ENEMIES } from '../src/shared/data/enemies';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { assaultWaves, defOf, envoy, envoyTick, leviesFor, factionsDaily, launchHost, musterHost, realm, realmCommand, rivalRaidOdds, hostOver } from '../src/shared/sim/factions';
import { siegeBlow, startBattle } from '../src/shared/sim/battle';
import { ROUTES } from '../src/shared/data/scenes';
import { MAP_SPOTS } from '../src/shared/data/worldMap';
import { campXY } from '../src/shared/sim/state';
import { startBattle as startFight, stepBattle as stepFight } from '../src/shared/sim/combat';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { plainGame, put } from './helpers';
import { sendExpedition, updateExpeditions } from '../src/shared/sim/expeditions';

// The realm (sim/factions.ts): powers met by envoys, treaties won by goodwill, war hosts with days of warning, and
// assaults fought as one long fight in waves.

test('the realm: four powers, never the town\'s own people, the bandits always among them, the same every time', () => {
  const s = plainGame('realm1');
  const fs = realm(s).filter((f) => !defOf(f).rising);
  assert.equal(fs.length, 4);
  assert.equal(realm(s).length, 7, 'and the three rising powers');
  assert.ok(fs.some((f) => f.id === 'brotherhood'));
  assert.ok(!fs.some((f) => defOf(f).origin === (s.origin ?? 'settlers')));
  assert.deepEqual(realm(plainGame('realm1')).filter((f) => !defOf(f).rising).map((f) => f.id), fs.map((f) => f.id));
  assert.ok(fs.every((f) => !f.known && f.stance === 'neutral'));
});

test('a power is met by its envoy, and how it is received sets its goodwill', () => {
  const s = plainGame('realm2');
  s.coins = 100;
  s.tick = 3 * TICKS_PER_DAY * 2.5; // (paced days)
  factionsDaily(s, new Rng(1));
  const f = realm(s).find((x) => x.known)!;
  assert.ok(f, 'one is met');
  const p = s.prompts.find((q) => q.kind === 'envoy')!;
  assert.equal(p.envoy!.about, 'greet');
  const was = f.attitude;
  answerPrompt(s, p.id, 0, new Rng(2));
  assert.ok(f.attitude > was, 'feasted, they think better of the town');
  assert.ok(s.coins! < 100, 'the gifts cost coins');
});

test('treaties need goodwill; peace, trade, then an alliance; breaking one costs trust everywhere', () => {
  const s = plainGame('realm3');
  for (const f of realm(s)) f.known = true;
  const [f, other] = realm(s);
  f.attitude = -40;
  assert.ok(!realmCommand(s, f.id, 'peace', new Rng(1)).ok, 'refused while they bear a grudge');
  f.attitude = 50;
  assert.ok(realmCommand(s, f.id, 'peace', new Rng(1)).ok);
  assert.ok(realmCommand(s, f.id, 'trade', new Rng(1)).ok);
  assert.ok(realmCommand(s, f.id, 'alliance', new Rng(1)).ok);
  assert.equal(f.stance, 'alliance');
  assert.equal(rivalRaidOdds(s, defOf(f).raid), 0, 'an ally never raids');
  const trust = other.attitude;
  realmCommand(s, f.id, 'war', new Rng(1));
  assert.equal(f.stance, 'war');
  assert.ok(other.attitude < trust, 'an oathbreaker is trusted less');
});

test('a power much weaker than the town kneels to a demand, and pays tribute each day', () => {
  const s = plainGame('realm4');
  for (const f of realm(s)) f.known = true;
  const f = realm(s)[0];
  f.troops = 0;
  assert.ok(realmCommand(s, f.id, 'demand', new Rng(1)).ok);
  assert.equal(f.stance, 'vassal');
  s.coins = 0;
  factionsDaily(s, new Rng(3));
  assert.ok((s.coins ?? 0) > 0, 'tribute paid');
});

test('a war host: warned days ahead, up to sixty strong with siege engines and the lord, in many waves; allies come', () => {
  const s = plainGame('realm5');
  s.battles = true;
  s.era = 'medieval';
  for (const f of realm(s)) f.known = true;
  const [foe, friend] = realm(s);
  foe.stance = 'war';
  foe.troops = 140;
  friend.stance = 'alliance';
  musterHost(s, foe);
  assert.ok(foe.host && foe.host.at - s.tick >= 24 * TICKS_PER_HOUR, 'a day or more of warning');
  assert.equal(foe.host!.size, HOST_MOST);
  const r = launchHost(s, foe, new Rng(4))!;
  assert.ok(r, 'the host comes');
  assert.equal(r.host, foe.id);
  const foes = r.raiders.filter((rd) => !rd.ally);
  assert.ok(foes.length >= HOST_MOST - 2 && foes.length <= HOST_MOST + 1, `about sixty: ${foes.length}`);
  assert.ok(foes.some((rd) => rd.kind === 'siege_engine'), 'siege engines');
  assert.ok(foes.some((rd) => rd.kind === defOf(foe).lord), 'the lord leads');
  assert.ok(r.raiders.some((rd) => rd.ally), 'the ally sends troops');
  r.phase = 'active';
  startBattle(s, r);
  assert.ok(r.battle!.waves > 4, `many waves: ${r.battle!.waves}`);
  // broken: the lord down
  for (const rd of foes) rd.down = rd.kind === defOf(foe).lord || rd.id % 3 === 0;
  hostOver(s, r);
  assert.equal(foe.beaten, 1);
  assert.ok(foe.troops < 140);
});

test('an assault is one fight: the next wave comes on as the last falls, the lord last', () => {
  const s = plainGame('realm6');
  for (const f of realm(s)) f.known = true;
  const f = realm(s)[0];
  f.troops = 40;
  const waves = assaultWaves(s, f.id, new Rng(5));
  assert.ok(waves.length >= 3);
  assert.ok(Object.keys(waves[waves.length - 1]).includes(defOf(f).lord), 'the lord in the last wave');
  for (const p of s.people) {
    p.level = 60;
    p.hp = 9999;
  }
  const b = startFight(s.people, {}, waves[0], new Rng(6));
  b.waves = waves.slice(1);
  b.wave = 1;
  // make the foes paper so the waves turn over quickly
  const soften = () => b.fighters.forEach((x) => x.side === 'enemy' && (x.hp = Math.min(x.hp, 1)));
  let seen = 1;
  for (let i = 0; i < 20000 && !b.outcome; i++) {
    soften();
    for (const x of b.fighters) if (x.side === 'party') x.hp = x.maxHp;
    stepFight(b, new Rng(i), { retreatAt: 0, mainId: null });
    seen = Math.max(seen, b.wave ?? 1);
  }
  assert.equal(b.outcome, 'won');
  assert.equal(seen, waves.length, 'every wave came on');
  assert.ok(ENEMIES[defOf(f).lord]);
  assert.ok(FACTION_BY_ID[f.id]);
});

test('storming a stronghold end to end: the whole town marches, fights its waves, and the conquered are asked about', () => {
  const s = plainGame('realm7');
  for (let i = 0; i < 7; i++) {
    const p = { ...JSON.parse(JSON.stringify(s.people[0])), id: s.nextId++, name: `P${i}`, partner: null, guard: false };
    s.people.push(p);
  }
  for (const p of s.people) {
    p.level = 40;
    p.hp = 9999;
    p.needs = { food: 1, rest: 1 };
  }
  for (const f of realm(s)) f.known = true;
  const f = realm(s)[0];
  f.stance = 'war';
  f.troops = 20;
  const dest = `assault:${f.id}`;
  const r = sendExpedition(s, dest, s.people.map((p) => p.id), {}, 'bold');
  assert.ok(r.ok, r.reason ?? "");
  const e = s.expeditions[0];
  assert.ok(e.assault && e.assault.total >= 3, 'its waves are planned');
  let waves = 0;
  for (let i = 0; i < 40 * TICKS_PER_HOUR && s.expeditions.length; i++) {
    for (const p of s.people) p.hp = Math.max(p.hp, 9999);
    if (e.battle) for (const x of e.battle.fighters) if (x.side === 'enemy') x.hp = Math.min(x.hp, 2);
    updateExpeditions(s, new Rng(i));
    waves = Math.max(waves, e.battle?.wave ?? 0);
    if (!e.assault && waves) break;
  }
  assert.ok(waves >= 3, `the waves came on: ${waves}`);
  assert.ok(s.prompts.some((p) => p.kind === 'envoy' && p.envoy?.about === 'conquered'), 'asked what becomes of them');
  const p = s.prompts.find((q) => q.envoy?.about === 'conquered')!;
  answerPrompt(s, p.id, 1, new Rng(1));
  assert.equal(f.stance, 'destroyed', 'razed');
});

test('a siege engine on the trail batters the gate it reaches, and brings it down', () => {
  const s = plainGame('realm-siege');
  s.battles = true;
  s.era = 'medieval';
  for (const f of realm(s)) f.known = true;
  const foe = realm(s)[0];
  foe.stance = 'war';
  foe.troops = 60;
  musterHost(s, foe);
  const r = launchHost(s, foe, new Rng(4))!;
  r.phase = 'active';
  startBattle(s, r);
  const b = r.battle!;
  const end = b.map.paths[0][b.map.paths[0].length - 1];
  const gate = put(s, 'palisade_wall', end[0], end[1], { hp: 150 });
  const engine = r.raiders.find((rd) => rd.kind === 'siege_engine')!;
  assert.ok(engine);
  const rng = new Rng(9);
  let blows = 0;
  while (s.buildings.includes(gate) && blows < 50) {
    assert.ok(siegeBlow(s, b, engine, [end[0], end[1]], end, rng), 'it strikes the gate');
    blows++;
  }
  assert.ok(!s.buildings.includes(gate), `the gate falls (${blows} blows)`);
  assert.ok(!siegeBlow(s, b, engine, [end[0] + 40, end[1]], end, rng), 'nothing within reach out in the fog');
});

test('allies and vassals send levies to an assault', () => {
  const s = plainGame('realm-levy');
  for (const f of realm(s)) f.known = true;
  const [foe, friend, sworn] = realm(s);
  foe.stance = 'war';
  friend.stance = 'alliance';
  sworn.stance = 'vassal';
  sworn.troops = 40;
  const levies = leviesFor(s, foe.id, new Rng(2));
  assert.ok(levies.some((l) => l.from === friend.id), 'the ally marches');
  assert.ok(levies.some((l) => l.from === sworn.id), 'the vassal sends its levy');
  assert.ok(!levies.some((l) => l.from === foe.id), 'never the foe');
});

test('an envoy rides in to the fire, waits while asked, and rides off when answered; an easy demand is paid unanswered', () => {
  const s = plainGame('realm-envoy');
  for (const f of realm(s)) f.known = true;
  const f = realm(s)[0];
  s.coins = 10000;
  const p = envoy(s, f, 'demand')!;
  assert.equal(p.defaultOption, 0, 'the treasury can pay: pay it');
  assert.ok(s.envoyRider, 'a rider sets out');
  const start = { x: s.envoyRider!.x, y: s.envoyRider!.y };
  for (let i = 0; i < 3000; i++) envoyTick(s);
  const camp = campXY(s);
  assert.ok(Math.abs(s.envoyRider!.x - camp.x) < 60 && Math.abs(s.envoyRider!.x - start.x) > 60, 'waiting by the fire');
  answerPrompt(s, p.id, 0, new Rng(3));
  for (let i = 0; i < 5000 && s.envoyRider; i++) envoyTick(s);
  assert.ok(!s.envoyRider, 'gone home');
  s.coins = 0;
  s.prompts = [];
  const q = envoy(s, f, 'demand')!;
  assert.notEqual(q.defaultOption, 0, 'an empty treasury refuses');
});

test('every stronghold and dungeon assault has its own scenes and a spot on the world map', () => {
  for (const f of Object.values(FACTION_BY_ID)) {
    assert.deepEqual(ROUTES[`assault:${f.id}`], [f.road, f.inside], f.id);
    assert.ok(MAP_SPOTS[`assault:${f.id}`], `${f.id} on the map`);
  }
});

test('the powers\' towns grow on the world map: quicker at peace with the town, slower at war, gone when razed', async () => {
  const { growTowns } = await import('../src/shared/sim/factions');
  const { townTier } = await import('../src/shared/data/factions');
  const { newGame } = await import('../src/shared/sim/state');
  const s = newGame('realm-towns');
  const fs = realm(s);
  assert.ok(fs.every((f) => (f.folk ?? 0) > 0), 'each power has a town');
  const [a, b, c] = fs;
  a.folk = b.folk = c.folk = 40;
  a.stance = 'alliance';
  b.stance = 'war';
  c.stance = 'destroyed';
  for (let d = 0; d < 10; d++) growTowns(fs);
  assert.ok(a.folk! > b.folk! && b.folk! > 40, `allied ${a.folk}, at war ${b.folk}`);
  assert.equal(c.folk, 0);
  assert.equal(townTier(5).name, 'camp');
  assert.equal(townTier(a.folk!).tier >= townTier(40).tier, true);
});
