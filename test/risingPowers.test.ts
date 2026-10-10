import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { DANGER_PACE } from '../src/shared/data/pace';
import { ENEMIES } from '../src/shared/data/enemies';
import { FACTION_BY_ID } from '../src/shared/data/factions';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { RAID_KIND_BY_ID } from '../src/shared/data/raids';
import { RISE_MEET_DAYS, RISING, RISING_IDS } from '../src/shared/data/risingPowers';
import { Rng } from '../src/shared/rng';
import { factionsDaily, raidOf, realm, rivalRaidOdds } from '../src/shared/sim/factions';
import { answerPrompt } from '../src/shared/sim/roadEvents';
import { champion, risingHourly } from '../src/shared/sim/risingPowers';
import { makePerson, maxHp, type GameState } from '../src/shared/sim/state';
import { START_HOUR, TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame } from './helpers';

const at = (day: number, hour: number) => (day - 1) * TICKS_PER_DAY + ((hour - START_HOUR + 24) % 24) * TICKS_PER_HOUR;

function town(seed: string, n = 6): GameState {
  const s = plainGame(seed);
  s.autopilot = true;
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  const rng = new Rng(3);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'hunter', { x: c.x, y: c.y }, s.people.map((q) => q.name)));
  return s;
}

test('every realm has the three rising powers, with lords, armies for every age and trophies', () => {
  const s = town('rise-realm');
  const fs = realm(s);
  for (const id of RISING_IDS) {
    assert.ok(fs.some((f) => f.id === id), id);
    const d = RISING[id];
    assert.ok(ENEMIES[d.lord]?.boss, d.lord);
    assert.ok(ITEM_BY_ID[ENEMIES[d.lord].kit!.trophy!], `${d.lord}'s trophy`);
    for (const k of [...d.raids, ...(d.seaRaids ?? [])]) {
      assert.ok(RAID_KIND_BY_ID[k], k);
      for (const e of Object.keys(RAID_KIND_BY_ID[k].enemies)) assert.ok(ENEMIES[e], `${k}: ${e}`);
    }
    for (const sp of d.spells) if (sp.summons) assert.ok(ENEMIES[sp.summons], sp.summons);
    assert.equal(FACTION_BY_ID[id].rising, id);
  }
  // (an older town's realm gets them too)
  s.factions = fs.filter((f) => !FACTION_BY_ID[f.id].rising);
  assert.equal(realm(s).filter((f) => FACTION_BY_ID[f.id].rising).length, 3);
});

test('they are met on their own days, and their armies never come before', () => {
  const s = town('rise-meet');
  const f = realm(s).find((x) => x.id === 'shogunate')!;
  assert.equal(rivalRaidOdds(s, raidOf(s, f)), 0, 'not before they are met');
  for (const o of realm(s)) if (!FACTION_BY_ID[o.id].rising) o.known = true;
  s.tick = at(Math.ceil((RISE_MEET_DAYS.shogunate + 1) * DANGER_PACE), 9);
  s.prompts = [];
  factionsDaily(s, new Rng(1));
  assert.ok(f.known, 'met');
  assert.ok(rivalRaidOdds(s, raidOf(s, f)) > 0);
});

test('a rising power grows with the town, and its army with the age', () => {
  const s = town('rise-grow', 4);
  for (const o of realm(s)) o.known = true;
  const f = realm(s).find((x) => x.id === 'infernal')!;
  s.tick = at(20, 9);
  const small = (() => {
    const t = f.troops;
    for (let i = 0; i < 20; i++) factionsDaily(s, new Rng(i));
    return f.troops - t;
  })();
  assert.ok(f.troops > 14, 'grown');
  const before = f.troops;
  const c = s.people[0];
  const rng = new Rng(9);
  while (s.people.length < 30) {
    const p = makePerson(rng, s.nextId++, 'hunter', { x: c.x, y: c.y }, s.people.map((q) => q.name));
    s.people.push(p);
  }
  for (let i = 0; i < 20; i++) factionsDaily(s, new Rng(100 + i));
  assert.ok(f.troops > before + 10, `a bigger town, a bigger host (${before} → ${f.troops}; ${small})`);
  assert.equal(raidOf(s, f), 'infernal_0');
  s.era = 'medieval';
  assert.equal(raidOf(s, f), 'infernal_1');
  s.era = 'space';
  assert.equal(raidOf(s, f), 'infernal_2');
});

test('the Shogunate challenges the town\'s best to a duel; it is fought to an end', () => {
  const s = town('rise-duel');
  for (const o of realm(s)) o.known = true;
  const f = realm(s).find((x) => x.id === 'shogunate')!;
  f.stance = 'neutral';
  s.tick = at(12, 10);
  s.prompts = [];
  let q;
  for (let i = 0; i < 40 && !q; i++) {
    f.rise = { lastDuel: -1e12 };
    s.prompts = [];
    risingHourly(s);
    q = s.prompts.find((p) => p.envoy?.about === 'duel');
    s.tick += TICKS_PER_DAY;
  }
  assert.ok(q, 'a challenge');
  const best = champion(s)!;
  const people = s.people.length;
  answerPrompt(s, q!.id, 0, new Rng(1));
  const d = f.rise!.duels!;
  assert.equal(d.won + d.lost, 1);
  if (d.won) assert.ok(best.titles?.includes('Duellist'));
  else assert.ok(s.people.length < people || best.hp < maxHp(best), 'the loser fell');
});

test('the Infernal Host opens a rift at war, and things come out of it by night', () => {
  const s = town('rise-rift');
  for (const o of realm(s)) o.known = true;
  const f = realm(s).find((x) => x.id === 'infernal')!;
  f.stance = 'war';
  s.tick = at(12, 10);
  for (let i = 0; i < 40 && !f.rise?.rift; i++) {
    risingHourly(s);
    s.tick += TICKS_PER_DAY;
  }
  assert.ok(f.rise?.rift, 'a rift');
  assert.ok((s.roamers ?? []).some((r) => r.name === 'things from the rift'));
});

test('the Infernal pact takes a life and pays in gold; refused, it costs nothing but goodwill', () => {
  const s = town('rise-pact', 8);
  for (const o of realm(s)) o.known = true;
  const f = realm(s).find((x) => x.id === 'infernal')!;
  f.stance = 'neutral';
  s.tick = at(Math.ceil(9 * DANGER_PACE), 10);
  s.prompts = [];
  risingHourly(s);
  const q = s.prompts.find((p) => p.envoy?.about === 'pact')!;
  assert.ok(q, 'offered');
  assert.equal(q.defaultOption, 0, 'refused by default');
  const people = s.people.length;
  const coins = s.coins ?? 0;
  answerPrompt(s, q.id, 1, new Rng(1));
  assert.equal(s.people.length, people - 1);
  assert.ok((s.coins ?? 0) > coins);
  assert.ok(s.people.some((p) => p.id === s.mainId), 'never the founder');
});

test('a town run by hand sees none of it', () => {
  const s = plainGame('rise-plain');
  s.tick = at(20, 10);
  risingHourly(s);
  assert.equal(s.factions, undefined);
});
