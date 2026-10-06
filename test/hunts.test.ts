import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPONENTS, FORGE, FORGED_ARMOUR, FORGED_IDS, HUNT_DAYS, HUNT_PURSE, MOST_HUNTS, QUARRIES, QUARRY_BY_ID } from '../src/shared/data/hunts';
import { FORGED_UNIQUES } from '../src/shared/data/uniques';
import { ENEMIES } from '../src/shared/data/enemies';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { Rng } from '../src/shared/rng';
import { huntHome, huntsHourly, planForge, postHunt, starsFor, huntDestinations } from '../src/shared/sim/hunts';
import { canQueueCraft, finishPiece } from '../src/shared/sim/crafting';
import { depositNear, totalStock } from '../src/shared/sim/buildings';
import { destinationOf, destinationUnlocked } from '../src/shared/sim/expeditions';
import { boardDestinations } from '../src/shared/sim/parties';
import { makePerson, campXY, type Expedition, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, put, row } from './helpers';

function guildTown(seed: string, people = 6): GameState {
  const s = plainGame(seed);
  s.tick = 4 * TICKS_PER_DAY;
  for (let i = 1; i < people; i++) s.people.push(makePerson(new Rng(s.nextId), s.nextId++, 'wanderer', campXY(s), s.people.map((q) => q.name)));
  s.research.done.push('monster_lore', 'iron_working');
  put(s, 'monster_guild', 4, row(s));
  put(s, 'stockpile', 10, row(s));
  return s;
}

test('the guild: quarries of one to five stars, every part dropped by some hunt and wanted by the forge', () => {
  assert.ok(BUILDING_BY_ID.monster_guild && ITEM_BY_ID.fangreaver);
  for (const stars of [1, 2, 3, 4, 5]) assert.ok(QUARRIES.some((q) => q.stars === stars), `${stars} stars`);
  for (const q of QUARRIES) for (const f of Object.keys(q.foes)) assert.ok(ENEMIES[f], `${q.id}: ${f}`);
  const dropped = new Set(QUARRIES.flatMap((q) => Object.keys(q.parts)));
  const wanted = new Set(FORGED_IDS.flatMap((id) => Object.keys(ITEM_BY_ID[id].cost)));
  for (const c of COMPONENTS) {
    assert.ok(dropped.has(c), `${c} is dropped`);
    assert.ok(wanted.has(c), `${c} is forged into something`);
  }
  assert.deepEqual([...FORGED_UNIQUES].sort(), Object.keys(FORGE).sort(), 'every forged weapon has its makings');
  for (const id of FORGED_IDS) {
    const d = ITEM_BY_ID[id];
    assert.ok(d.unique && d.relic && d.station === 'monster_guild' && d.seconds > 0, id);
  }
  assert.ok(FORGED_ARMOUR.length >= 4);
  // (the purse grows with the stars)
  for (let k = 2; k <= 5; k++) assert.ok(HUNT_PURSE[k] > HUNT_PURSE[k - 1]);
});

test('hunts are posted now and then while the guild stands, up to the town; they lapse', () => {
  const s = guildTown('hunts-post');
  assert.ok(starsFor(s) >= 2);
  const small = plainGame('hunts-small');
  assert.equal(starsFor(small), 1);
  for (let h = 0; h < 24 * 8; h++) {
    s.tick += TICKS_PER_HOUR;
    huntsHourly(s);
    assert.ok((s.hunts?.length ?? 0) <= MOST_HUNTS);
    for (const x of s.hunts ?? []) assert.ok(x.until - x.posted === HUNT_DAYS * TICKS_PER_DAY);
  }
  assert.ok(s.journal.some((j) => /posts a hunt/.test(j.text)), 'hunts posted');
  for (const x of s.hunts ?? []) assert.ok(s.tick < x.until, 'lapsed hunts come down');
  for (const q of s.hunts ?? []) assert.ok(QUARRY_BY_ID[q.quarry].stars <= starsFor(s));
});

test('a hunt won: the guild pays the party, and the parts come home', () => {
  const s = guildTown('hunts-win');
  const h = postHunt(s, new Rng(1), 'boar_king')!;
  const d = huntDestinations(s)[0];
  assert.ok(boardDestinations(s).some((x) => x.id === d.id), 'on the Expedition Board');
  assert.ok(destinationUnlocked(s, destinationOf(s, d.id)!));
  assert.ok(d.name.includes('★★★'));
  const hunter = s.people[1];
  const before = hunter.coins ?? 0;
  huntHome(s, { dest: d.id, cleared: false, recalled: false, members: [hunter.id] } as unknown as Expedition, [hunter]);
  assert.ok(s.hunts!.includes(h), 'beaten: it is still out there');
  huntHome(s, { dest: d.id, cleared: true, recalled: false, members: [hunter.id] } as unknown as Expedition, [hunter]);
  assert.equal(s.hunts!.length, 0);
  assert.equal(hunter.coins, before + HUNT_PURSE[3]);
  assert.equal(totalStock(s).great_horn, 2);
  assert.equal(totalStock(s).thick_pelt, 2);
});

test('the guild forges a unique from the parts, once only', () => {
  const s = guildTown('hunts-forge');
  s.autopilot = true;
  planForge(s);
  assert.equal(s.crafting.length, 0, 'nothing to forge with');
  depositNear(s, campXY(s), { ...ITEM_BY_ID.fangreaver.cost });
  planForge(s);
  const o = s.crafting.find((x) => x.item === 'fangreaver');
  assert.ok(o, 'the order is set');
  assert.equal(canQueueCraft(s, 'fangreaver').ok, false, 'one at a time, and only one');
  finishPiece(s, o!, s.people[0], new Rng(3));
  assert.ok(s.uniques!.includes('fangreaver'));
  assert.equal(canQueueCraft(s, 'fangreaver').ok, false, 'there is only one');
  depositNear(s, campXY(s), { ...ITEM_BY_ID.fangreaver.cost });
  planForge(s);
  assert.ok(!s.crafting.some((x) => x.item === 'fangreaver'));
});

test('a hunt always comes to a fight: a careful party, a scout among them, still meets the quarry', async () => {
  const { sendExpedition, updateExpeditions } = await import('../src/shared/sim/expeditions');
  for (let seed = 0; seed < 12; seed++) {
    const s = guildTown(`hunt-fight-${seed}`);
    const h = postHunt(s, new Rng(seed + 1), 'boar_king')!;
    const [a, b] = s.people.slice(1, 3);
    const r = sendExpedition(s, `mhunt:${h.id}`, [a.id, b.id], { [a.id]: 'scout' }, 'cautious');
    assert.ok(r.ok, String(r.reason ?? ""));
    const e = s.expeditions.at(-1)!;
    e.stakes = 'safe';
    e.rolled.outEvent = true; // (no road event: its question would wait for the player)
    const rng = new Rng(seed * 7 + 3);
    let fought = false;
    for (let t = 0; t < 2 * TICKS_PER_DAY && s.expeditions.includes(e); t++) {
      s.tick++;
      updateExpeditions(s, rng);
      if (e.battle) fought = true;
      if (fought) break;
    }
    assert.ok(fought, `seed ${seed}: the hunters met the quarry (${e.phase}, ${s.journal.slice(-6).map((j) => j.text).join(' | ')})`);
  }
});
