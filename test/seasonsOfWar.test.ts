// The seasons of war with the realm (sim/war/): the powers' wars by the season, the borders moving on the War tab's
// map, a power falling and a rising one taking its place, the town called to arms and its council's answers, the
// campaign fought and its spoils, deserters, sieges and the occupation, the war dead remembered.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONQUEST } from '../src/shared/data/conquest';
import { FACTION_BY_ID } from '../src/shared/data/factions';
import { DEED_TITLES } from '../src/shared/data/deeds';
import { CAMPAIGN_COIN, MEMORIAL_AT, SIEGES_TO_FALL, TALKED_DOWN } from '../src/shared/data/war';
import { PANELS } from '../src/shared/ipc';
import { Rng } from '../src/shared/rng';
import { parseCommand } from '../src/shared/sim/commands';
import { holdings } from '../src/shared/sim/conquest/conquest';
import { assaultTargets, envoy, hostOver, launchHost, musterHost, realm, rivalRaidOdds, townMight as townMightOf } from '../src/shared/sim/factions';
import { killPerson } from '../src/shared/sim/health';
import { deedsOf } from '../src/shared/sim/memorials';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { parseSave, serialize } from '../src/shared/sim/save';
import { Sim } from '../src/shared/sim/sim';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, maxHp, newGame, type Faction, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { campaignDest, campaignOver, callTown, campaignsHourly, campaignWaves, campaignLevies, townCampaign } from '../src/shared/sim/war/campaigns';
import { adviseCall, adviseDemand, adviseYield, councilDaily, demandCoins } from '../src/shared/sim/war/council';
import { claimSeat, strikeTarget, takeProvince, warMap } from '../src/shared/sim/war/map';
import { warFallen } from '../src/shared/sim/war/memory';
import { hostMustered, hostOdds, occupationDaily, siegeHourly } from '../src/shared/sim/war/siege';
import { desertersHourly, planStrikes, strikeOver, strikeWaits } from '../src/shared/sim/war/strikes';
import { warOf, warSeason } from '../src/shared/sim/war/state';
import { warHourly } from '../src/shared/sim/war/war';
import { plainGame } from './helpers';

const day = (n: number) => n * TICKS_PER_DAY + 2 * TICKS_PER_HOUR;
/** A town of fighters fit to march (plainGame's founder never goes). */
function withFolk(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = makePerson(new Rng(900 + i), s.nextId++, 'hunter', s.people[0], s.people.map((q) => q.name));
    p.hp = maxHp(p);
    p.needs = { food: 1, rest: 1 };
    s.people.push(p);
  }
}
/** Two powers on the map, met. */
function pair(s: GameState): [Faction, Faction] {
  const { c } = warMap(s)!;
  const fs = realm(s);
  const a = fs.find((f) => f.id === c.realmIds[1])!;
  const b = fs.find((f) => f.id === c.realmIds[2])!;
  for (const f of fs) f.known = true;
  return [a, b];
}

test('the War tab is back, to watch: the old conquest\'s armies and commands are gone', () => {
  assert.equal(CONQUEST.on, true);
  assert.ok(PANELS.some((p) => p.id === 'war'), 'a War tab');
  const v = snapshot(newGame('war-tab')).war;
  assert.ok(v && v.provinces.length > 0, 'the map of provinces');
  assert.ok(v.season.line.length > 0 && v.council !== undefined && v.news !== undefined);
  assert.equal(parseCommand({ type: 'conquest', op: 'train', troop: 'militia', n: 1 }), null, 'no troops trained by hand');
});

test('the seasons of war: march in spring and summer, the harvest raids in autumn, winter quarters', () => {
  const s = plainGame('war-seasons');
  s.tick = day(1);
  assert.equal(warSeason(s), 'march');
  s.tick = day(12);
  assert.equal(warSeason(s), 'march');
  s.tick = day(22);
  assert.equal(warSeason(s), 'harvest');
  s.tick = day(33);
  assert.equal(warSeason(s), 'hold');
  // the hosts against the town by the season (only with the town running itself)
  const f = realm(s)[0];
  s.autopilot = true;
  s.tick = day(3);
  assert.equal(hostOdds(s, f), 1, 'a young town\'s first spring as before');
  s.tick = day(42);
  assert.ok(hostOdds(s, f) > 1, 'the hosts march in spring');
  s.tick = day(22);
  assert.ok(hostOdds(s, f) > 0 && hostOdds(s, f) < 1);
  s.tick = day(33);
  assert.equal(hostOdds(s, f), 0, 'no host in winter');
  s.autopilot = false;
  assert.equal(hostOdds(s, f), 1, 'with the autopilot off, as before');
  // and the rivals' ordinary raids lean to the autumn
  f.known = true;
  f.stance = 'neutral';
  s.autopilot = true;
  s.tick = day(22);
  const autumn = rivalRaidOdds(s, FACTION_BY_ID[f.id].raid);
  s.tick = day(33);
  const winter = rivalRaidOdds(s, FACTION_BY_ID[f.id].raid);
  assert.ok(autumn > winter, `${autumn} > ${winter}`);
});

test('a war\'s strike in spring takes a province; in autumn it burns the harvest; in winter the hosts hold', () => {
  const s = plainGame('war-strike');
  const [a, b] = pair(s);
  a.troops = 60;
  b.troops = 30;
  s.feuds = [{ a: a.id, b: b.id, since: 0 }];
  s.tick = day(2);
  const ms = planStrikes(s, realm(s), 12);
  assert.equal(ms.length, 1, 'one strike');
  const camp = warOf(s).campaigns.find((c) => c.id === ms[0].camp)!;
  assert.ok(!camp.harvest && camp.province !== null, 'aimed at a province');
  const { c } = warMap(s)!;
  assert.equal(c.holder[camp.province!], camp.against);
  assert.equal(planStrikes(s, realm(s), 12).length, 0, 'not again so soon');
  assert.equal(strikeWaits(s, ms[0]), null, 'nobody waited on: it rolls');
  strikeOver(s, ms[0], true);
  assert.equal(c.holder[camp.province!], camp.by, 'the province changed hands');
  assert.equal(camp.done, 'won');
  // autumn: a harvest raid, no province
  s.tick = day(22);
  const hs = planStrikes(s, realm(s), 12);
  assert.equal(hs.length, 1);
  const harvest = warOf(s).campaigns.find((x) => x.id === hs[0].camp)!;
  assert.ok(harvest.harvest && harvest.province === null);
  // winter: none
  s.tick = day(34);
  assert.equal(planStrikes(s, realm(s), 12).length, 0);
});

test('a power whose last province falls is no more, and a rising power takes up its seat', () => {
  const s = plainGame('war-fall');
  const [a, b] = pair(s);
  const { c, w } = warMap(s)!;
  // b keeps only its capital
  const cap = w.realms.find((r) => r.id === b.id)!.capital;
  for (let i = 0; i < c.holder.length; i++) if (c.holder[i] === b.id && i !== cap) c.holder[i] = a.id;
  assert.equal(strikeTarget(s, a.id, b.id), cap, 'the capital when it is all that is left');
  const rising = realm(s).find((f) => FACTION_BY_ID[f.id].rising)!;
  rising.known = true;
  // (no free land for it: it waits for a fall)
  for (let i = 0; i < c.holder.length; i++) if (c.holder[i] === null) c.holder[i] = a.id;
  assert.equal(claimSeat(s, rising), false);
  takeProvince(s, a.id, cap);
  assert.equal(b.stance, 'destroyed');
  assert.equal(b.troops, 0);
  assert.ok(warOf(s).fallen?.some((x) => x.id === b.id && x.by === a.id));
  assert.equal(c.holder[cap], rising.id, 'the rising power rises in its place');
  assert.ok(warOf(s).news.some((n) => /ruins/.test(n.text)));
});

test('a rising power met raises its banners over free land far from the town', () => {
  const s = plainGame('war-seat');
  const { c } = warMap(s)!;
  const rising = realm(s).find((f) => FACTION_BY_ID[f.id].rising)!;
  rising.known = true;
  assert.equal(holdings(c, rising.id).length, 0);
  assert.ok(claimSeat(s, rising));
  assert.ok(holdings(c, rising.id).length >= 1);
});

test('a friend at war calls the town to arms; marching, the campaign opens and the council raises the party', () => {
  const s = plainGame('war-call');
  s.autopilot = true;
  withFolk(s, 8);
  const [ally, foe] = pair(s);
  ally.stance = 'alliance';
  ally.attitude = 60;
  foe.stance = 'war';
  foe.attitude = -60;
  foe.troops = 30;
  ally.troops = 60;
  s.feuds = [{ a: ally.id, b: foe.id, since: 0 }];
  s.tick = day(2);
  const w = warOf(s);
  const camp = { id: w.nextId++, by: ally.id, against: foe.id, harvest: false, province: strikeTarget(s, ally.id, foe.id), troops: 24, start: s.tick };
  w.campaigns.push(camp);
  assert.ok(callTown(s, camp), 'the call');
  const p = s.prompts.find((q) => q.kind === 'envoy' && q.envoy?.about === 'campaign')!;
  assert.ok(p, 'an envoy asks');
  assert.equal(p.envoy!.camp, camp.id);
  assert.equal(p.recommended, 0, 'the council would march: sworn allies, a foe at war with the town');
  assert.equal(p.defaultOption, 0);
  assert.ok(p.why && /march/.test(p.why));
  // the strike waits on the answer
  const march = { kind: 'feud' as const, from: ally.id, to: foe.id, start: s.tick, end: s.tick, size: 24, camp: camp.id };
  assert.equal(strikeWaits(s, march), 'wait');
  answerPrompt(s, p.id, 0, new Rng(1));
  const dest = campaignDest(camp.id);
  const party = s.expeditions.find((e) => e.dest === dest);
  assert.ok(party, 'the council sent a party');
  assert.ok(!party!.members.includes(s.mainId), 'never the founder');
  assert.ok(party!.members.length <= Math.floor(s.people.length / 2), 'half the town kept home');
  assert.equal(strikeWaits(s, march), 'wait', 'the ally waits for the party');
  assert.ok(w.joined! >= 1);
  // the fight: the foe's troops in waves, the captain last; the ally's own host beside the party
  const waves = campaignWaves(s, `campaign:${camp.id}`, new Rng(2));
  assert.ok(waves.length >= 3);
  assert.ok(campaignLevies(s, `campaign:${camp.id}`, new Rng(3)).length >= 5);
  // won: the spoils, the veterans, the recap, and the ally's strike carried
  const before = s.coins ?? 0;
  campaignOver(s, `campaign:${camp.id}`, true, {});
  assert.ok((s.coins ?? 0) > before, 'spoils for the treasury');
  const vet = s.people.find((q) => party!.members.includes(q.id))!;
  assert.equal(vet.deeds?.campaigns, 1);
  assert.equal(DEED_TITLES.campaigns.steps[0][1], 'the Veteran');
  assert.ok(w.recap?.won && /Victory/.test(w.recap.title));
  assert.equal(strikeWaits(s, march), true, 'the town\'s fight settled the strike');
  strikeOver(s, march, true);
  assert.equal(warMap(s)!.c.holder[camp.province!], ally.id);
});

test('a call left unanswered by a growing town is refused; coin is sent in place of fighters by a rich trading one', () => {
  const s = plainGame('war-refuse');
  s.autopilot = true;
  withFolk(s, 8);
  const [ally, foe] = pair(s);
  ally.stance = 'trade';
  ally.attitude = 40;
  foe.stance = 'peace';
  s.direction = 'growth';
  assert.equal(adviseCall(s, ally, foe).option, 2, 'growth keeps out of a war that is not the town\'s');
  s.direction = 'trade';
  s.coins = CAMPAIGN_COIN * 3;
  assert.equal(adviseCall(s, ally, foe).option, 1, 'trade sends coin');
  // the knights march only in a just cause; the warband always
  s.direction = 'defense';
  s.origin = 'knights';
  foe.temper = 'honourable';
  foe.attitude = 10;
  assert.notEqual(adviseCall(s, ally, foe).option, 0, 'no just cause, the Order stays home');
  foe.stance = 'war';
  assert.equal(adviseCall(s, ally, foe).option, 0, 'a foe at war with the town: a just war');
  s.origin = 'orcs';
  foe.stance = 'neutral';
  assert.equal(adviseCall(s, ally, foe).option, 0, 'the warband never turns down a fight');
  // too few to march
  s.people = s.people.slice(0, 1);
  assert.notEqual(adviseCall(s, ally, foe).option, 0);
});

test('the council answers demands: the proud refuse, the weak and peaceful pay, Knowledge talks the sum down', () => {
  const s = plainGame('war-demand');
  s.autopilot = true;
  const f = realm(s)[0];
  f.troops = 80;
  s.coins = 500;
  s.direction = 'growth';
  assert.equal(adviseDemand(s, f, 50).option, 0, 'much the stronger: pay');
  s.origin = 'dwarves';
  assert.equal(adviseDemand(s, f, 50).option, 0, 'even the proud bow to a power many times the town');
  f.troops = townMightOf(s) * 1.6;
  assert.equal(adviseDemand(s, f, 50).option, 1, 'the hold pays nobody it can stand against');
  s.origin = 'settlers';
  assert.equal(adviseDemand(s, f, 50).option, 0, 'where a peaceful town would pay');
  f.troops = 80;
  s.direction = 'knowledge';
  assert.equal(demandCoins(s, 100), Math.round(100 * TALKED_DOWN));
  // the envoy's question carries the council's answer
  s.origin = 'settlers';
  f.known = true;
  const p = envoy(s, f, 'demand')!;
  assert.equal(p.envoy!.coins, demandCoins(s, Math.round(30 + f.troops)));
  assert.equal(p.recommended, p.defaultOption);
  assert.ok(p.why);
});

test('a far stronger power\'s spring host may come as a siege: it asks the town to yield; yielded, the town is occupied, taxed, and rises', () => {
  const s = plainGame('war-siege');
  s.autopilot = true;
  withFolk(s, 3);
  const f = realm(s)[0];
  f.known = true;
  f.stance = 'war';
  f.troops = 140;
  f.lastHost = 0;
  let kind: string | null = null;
  for (let h = 0; h < 200 && kind !== 'siege'; h++) {
    s.tick = day(2) + h * TICKS_PER_HOUR;
    f.host = { at: s.tick + 36 * TICKS_PER_HOUR, size: 40 };
    kind = hostMustered(s, f);
  }
  assert.equal(kind, 'siege');
  assert.ok(f.host!.siege && f.host!.size > 40, 'bigger');
  siegeHourly(s);
  const p = s.prompts.find((q) => q.envoy?.about === 'yield')!;
  assert.ok(p, 'the demand to yield');
  assert.equal(adviseYield(s, f, f.host!.size).option, 1, 'hopeless: the council would yield');
  s.coins = 200;
  answerPrompt(s, p.id, 1, new Rng(1));
  const w = warOf(s);
  assert.ok(w.occupation && w.occupation.by === f.id, 'occupied');
  assert.equal(f.host, undefined, 'no battle');
  assert.equal(hostOdds(s, f), 0, 'no hosts from the occupier');
  occupationDaily(s);
  assert.ok(w.occupation!.taxed > 0 && (s.coins ?? 0) < 200, 'the tax');
  assert.ok(w.occupation!.resistance > 0, 'the resistance grows');
  // the rising: the garrison fought in the streets
  w.occupation!.resistance = 100;
  occupationDaily(s);
  assert.ok(s.raid && w.occupation!.rising, 'the town rises');
  assert.equal(s.raid!.host, f.id);
  assert.equal(s.raid!.phase, 'active', 'inside the town');
  // the garrison broken: liberation
  for (const rd of s.raid!.raiders) rd.down = true;
  hostOver(s, s.raid!);
  assert.equal(w.occupation, undefined, 'the town is free');
  assert.equal(f.stance, 'war');
  assert.ok(s.feastDue && /liberation/.test(s.feastDue.text));
});

test('a siege lost is a sack and an occupation; a second is the end of the town', () => {
  const s = plainGame('war-sacked');
  s.autopilot = true;
  withFolk(s, 9);
  const f = realm(s)[0];
  f.known = true;
  f.stance = 'war';
  f.troops = 140;
  const lose = () => {
    warOf(s).siege = { by: f.id, asked: true };
    f.host = { at: s.tick, size: 30, siege: true };
    const r = launchHost(s, f, new Rng(5))!;
    s.raid = null;
    hostOver(s, r); // (none of them fell)
  };
  lose();
  const w = warOf(s);
  assert.equal(w.sieges?.lost, 1);
  assert.ok(w.occupation, 'occupied after the sack');
  assert.ok(!s.gameOver);
  w.occupation = undefined;
  for (let k = 1; k < SIEGES_TO_FALL; k++) lose();
  const over = (s as GameState).gameOver;
  assert.ok(over && !over.won, 'the second siege lost ends it');
});

test('deserters from a beaten host come for the town: a small band of their people, no lord', () => {
  const s = plainGame('war-deserters');
  s.autopilot = true;
  const f = realm(s).find((x) => x.id === 'brotherhood')!;
  f.known = true;
  warOf(s).deserters = [{ from: f.id, at: s.tick, n: 4 }];
  desertersHourly(s);
  assert.ok(s.raid, 'they come');
  assert.equal(s.raid!.raiders.filter((r) => !r.ally).length, 4);
  assert.ok(!s.raid!.raiders.some((r) => r.kind === FACTION_BY_ID[f.id].lord), 'no lord at their head');
});

test('the war dead: a widow, orphans, and a memorial once the war has taken enough', () => {
  const s = plainGame('war-dead');
  s.autopilot = true;
  withFolk(s, 6);
  const f = realm(s)[0];
  f.known = true;
  f.stance = 'war';
  f.host = { at: s.tick, size: 10 };
  launchHost(s, f, new Rng(7));
  assert.equal(s.raid?.host, f.id);
  const [a, b, kid] = s.people.slice(1, 4);
  a.partner = b.id;
  b.partner = a.id;
  kid.bornTick = s.tick;
  kid.parents = [a.id, b.id];
  killPerson(s, a, 'cut down at the walls');
  while (warOf(s).dead.length < MEMORIAL_AT) killPerson(s, s.people.find((q) => q.id !== s.mainId && q !== b && q !== kid)!, 'cut down at the walls');
  const w = warOf(s);
  assert.ok(w.dead.length >= MEMORIAL_AT);
  assert.equal(b.warLoss?.as, 'widow');
  assert.equal(kid.warLoss?.as, 'orphan');
  const memorial = (s.honoured ?? []).find((h) => h.memorial);
  assert.ok(memorial, 'a memorial to the war\'s fallen');
  assert.ok(memorial!.memorial!.includes(a.name));
  assert.ok(deedsOf(memorial!).some((l) => l.includes(a.name)));
  assert.ok(w.memorials?.length === 1);
  // with the autopilot off nothing is recorded
  const t = plainGame('war-dead-off');
  warFallen(t, t.people[0]);
  assert.equal(t.war, undefined);
});

test('the council by the direction: Growth buys peace, Knowledge brokers it, the wicked break their word in winter', () => {
  const s = plainGame('war-council');
  s.autopilot = true;
  const [a, b] = pair(s);
  s.direction = 'growth';
  s.coins = 500;
  a.stance = 'war';
  a.attitude = -40;
  s.tick = day(3);
  councilDaily(s);
  assert.ok((s.coins ?? 0) < 500, 'gifts sent');
  a.attitude = 0;
  councilDaily(s);
  assert.equal(a.stance, 'peace', 'peace bought');
  // Knowledge brokers peace between two friends at war, in winter
  s.direction = 'knowledge';
  a.stance = b.stance = 'trade';
  a.attitude = b.attitude = 20;
  s.feuds = [{ a: a.id, b: b.id, since: 0 }];
  for (let d = 30; d < 40 && s.feuds.length; d++) {
    s.tick = day(d);
    councilDaily(s);
  }
  assert.equal(s.feuds.length, 0, 'brokered');
  // the wicked and strong turn on a weak, rich neighbour in winter
  s.direction = 'defense';
  s.align = { score: -60, log: [] };
  withFolk(s, 12);
  b.stance = 'peace';
  b.troops = 2;
  b.folk = 120;
  for (let d = 30; d < 40 && (b.stance as string) !== 'war'; d++) {
    s.tick = day(d);
    councilDaily(s);
  }
  assert.equal(b.stance, 'war', 'the treaty torn up');
  assert.ok(s.align.score < -60, 'and the town the more wicked for it');
});

test('the town\'s own war party: opened at once, and won, the province is the town\'s', () => {
  const s = plainGame('war-own');
  s.autopilot = true;
  withFolk(s, 8);
  const [foe] = pair(s);
  foe.stance = 'war';
  s.tick = day(3);
  const camp = townCampaign(s, foe, false)!;
  assert.ok(camp && camp.province !== null);
  assert.ok(assaultTargets(s, () => false).includes(campaignDest(camp.id)) || s.expeditions.some((e) => e.dest === campaignDest(camp.id)));
  campaignOver(s, `campaign:${camp.id}`, true, {});
  assert.equal(warMap(s)!.c.holder[camp.province!], 'town');
  // a party never sent in time is called off
  const late = townCampaign(s, foe, true)!;
  s.expeditions = s.expeditions.filter((e) => e.dest !== campaignDest(late.id));
  late.call!.party = undefined;
  s.tick = late.call!.until + 1;
  campaignsHourly(s);
  assert.equal(late.done, 'lost');
});

test('the seasons of war run themselves with the autopilot, the same every time, and keep through a save', () => {
  const run = () => {
    const s = newGame('war-run', { origin: 'orcs' });
    const sim = new Sim(s);
    for (let i = 0; i < 6 * TICKS_PER_DAY; i++) sim.step();
    return s;
  };
  const a = run();
  const b = run();
  assert.equal(JSON.stringify(a.war), JSON.stringify(b.war), 'deterministic');
  assert.deepEqual(a.conquest!.holder, b.conquest!.holder);
  const back = parseSave(serialize(a, 0));
  assert.ok(back.ok);
  if (back.ok) assert.deepEqual(back.save.state.war, a.war);
  // with the autopilot off, nothing
  const off = plainGame('war-off');
  for (let h = 0; h < 48; h++) {
    off.tick += TICKS_PER_HOUR;
    warHourly(off);
  }
  assert.equal(off.war, undefined);
  // an older save with neither the world nor the war: both are made when wanted
  const old = plainGame('war-old');
  old.conquest = undefined;
  old.autopilot = true;
  old.tick = day(1) - (day(1) % TICKS_PER_HOUR);
  warHourly(old);
  const made = (old as GameState).conquest;
  assert.ok(made && made.holder.length > 0);
  void musterHost;
});
