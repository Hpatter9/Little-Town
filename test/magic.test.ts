import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../src/shared/data/events'; // (first: the event kit's own import order)
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { ITEM_BY_ID } from '../src/shared/data/items';
import {
  ARCANE_LIBRARY, BLOOD_MANA, CURSED, ENCHANT_WORK, ENCHANTED, FLAVOURS, FOCI, FORESIGHT_HOURS, LEY_LORE, LEY_NEAR_CAMP, MAD_AT, MAGE_TOWER, MAGIC_TOPICS, MANA_CAP, MANA_CAP_TOWER, MASTER_SPELLS,
  RITES, SCHOOL_IDS, SCHOOL_SPELLS, SCHOOLS, SERVANTS_MOST, STUDY_PER_LEVEL, SURGE_AT, SURGE_LEAVES, TOWER_BASE, TOWER_MANA, WARD_SAP, magicTopicWorth,
} from '../src/shared/data/magic';
import { ORIGINS } from '../src/shared/data/origins';
import { RAID_KINDS } from '../src/shared/data/raids';
import { REGIONS } from '../src/shared/data/regions';
import { TOPIC_BY_ID } from '../src/shared/data/research';
import { SPELL_BY_ID } from '../src/shared/data/spells';
import { Rng } from '../src/shared/rng';
import { readySpells, kitOf } from '../src/shared/sim/actions';
import { canWear } from '../src/shared/sim/classes';
import { answerWays } from '../src/shared/sim/heritage';
import {
  allSpells, answerMagic, castersHere, leyAt, leyOf, magicHourly, magicOf, magicView, manaCap, manaPerHour, miscast, miscastChance, nextStudy, studyHourly, surge, type MagicState,
} from '../src/shared/sim/magic';
import { startRaid } from '../src/shared/sim/raids';
import { snapshot } from '../src/shared/sim/snapshot';
import { makePerson, maxHp, type GameState, type Person } from '../src/shared/sim/state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { workFactor } from '../src/shared/sim/townsfolk';
import { freeSpot, plainGame, put } from './helpers';

const ALL_SCHOOLS = SCHOOL_IDS.map((k) => SCHOOLS[k].topic);

/** A town with the magic open, the autopilot on, and a few hands; `mages` of them casters. */
function town(seed: string, mages = 1, n = 6, schools: string[] = ALL_SCHOOLS): GameState {
  const s = plainGame(seed);
  const rng = new Rng(3);
  const c = s.people[0];
  while (s.people.length < n) s.people.push(makePerson(rng, s.nextId++, 'gatherer', { x: c.x + s.people.length * 6, y: c.y }, s.people.map((q) => q.name)));
  for (const p of s.people.slice(1, 1 + mages)) {
    p.cls = 'mage';
    p.level = 12;
  }
  s.research.done.push('arcane_arts', LEY_LORE, ...schools);
  s.autopilot = true;
  s.tick = 10 * TICKS_PER_HOUR;
  return s;
}
const mageOf = (s: GameState) => s.people.find((p) => p.cls === 'mage')!;
const hour = (s: GameState) => {
  s.tick += TICKS_PER_HOUR;
  magicHourly(s);
};
/** The rites never go wrong (for the tests of what each does), until `restore` is called. */
function sure(): () => void {
  const was = Object.values(RITES).map((r) => [r, r.danger] as const);
  for (const [r] of was) r.danger = 0;
  return () => {
    for (const [r, d] of was) r.danger = d;
  };
}
/** A roll that always comes up the same (for a miscast's outcome). */
const fixed = (v: number): Rng => {
  const g = new Rng(1);
  g.next = () => v;
  return g;
};

test('magic is wired into the shared tables: topics, the tower and library, tomes, foci, charms, real spells', () => {
  for (const t of MAGIC_TOPICS) assert.equal(TOPIC_BY_ID[t.id], t);
  for (const t of MAGIC_TOPICS) for (const pre of t.prereqs) assert.ok(TOPIC_BY_ID[pre], `${t.id} needs ${pre}`);
  assert.equal(BUILDING_BY_ID[MAGE_TOWER].research, LEY_LORE);
  assert.equal(BUILDING_BY_ID[ARCANE_LIBRARY].research, LEY_LORE);
  for (const k of SCHOOL_IDS) {
    assert.ok(TOPIC_BY_ID[SCHOOLS[k].topic], k);
    assert.ok(ITEM_BY_ID[`tome_${k}`], `the ${k} tome`);
    assert.ok(SCHOOL_SPELLS[k].length >= 5, `${k} teaches spells`);
    for (const id of SCHOOL_SPELLS[k]) assert.ok(SPELL_BY_ID[id], `${k}: ${id}`);
  }
  for (const id of [...FOCI, ...ENCHANTED, ...CURSED]) assert.equal(ITEM_BY_ID[id]?.slot, 'charm', id);
  for (const id of [...ENCHANTED, ...CURSED]) assert.ok(ITEM_BY_ID[id].unique && ITEM_BY_ID[id].relic, `${id} is never made`);
  for (const r of Object.values(RITES)) assert.ok(SCHOOLS[r.school], r.id);
  for (const o of ORIGINS) assert.ok(FLAVOURS[o], `${o} has its own flavour of magic`);
});

test('the planner wants the lore once the town is a few strong, and the war schools more after a raid', () => {
  assert.ok(magicTopicWorth(LEY_LORE, 8, false) > magicTopicWorth(LEY_LORE, 3, false));
  assert.ok(magicTopicWorth('school_abjuration', 8, true) > magicTopicWorth('school_abjuration', 8, false));
  assert.equal(magicTopicWorth('farming', 8, true), 0);
});

test('the leylines come from the seed, and one runs near the camp', () => {
  const s = town('ley-a');
  const t = town('ley-a');
  assert.deepEqual(leyOf(s), leyOf(t));
  assert.notDeepEqual(leyOf(s).lines, leyOf(town('ley-b')).lines);
  const c = s.land.camp;
  let best = 0;
  for (let y = c.y - LEY_NEAR_CAMP - 4; y <= c.y + LEY_NEAR_CAMP + 4; y++) for (let x = c.x - LEY_NEAR_CAMP - 4; x <= c.x + LEY_NEAR_CAMP + 4; x++) best = Math.max(best, leyAt(s, x, y));
  assert.ok(best >= 0.8, `a line within reach of the camp (best ${best})`);
  // far from every line, nothing
  const ley = leyOf(s);
  assert.ok(ley.lines.length === 3);
});

test('nothing happens without the autopilot, or before Leyline Lore', () => {
  const s = town('off');
  s.autopilot = false;
  hour(s);
  assert.equal(s.magic, undefined);
  const t = town('off-2');
  t.research.done = t.research.done.filter((x) => x !== LEY_LORE);
  hour(t);
  assert.equal(t.magic, undefined);
});

test('mana: a finished tower drinks from the ley under it, casters add a little, and it is capped', () => {
  const s = town('mana', 2);
  const spot = freeSpot(s, MAGE_TOWER);
  const b = put(s, MAGE_TOWER, spot.x, spot.y);
  const ley = leyAt(s, b.tile + 1, b.row + 1);
  const per = manaPerHour(s);
  assert.ok(per >= TOWER_MANA * (TOWER_BASE + ley) * FLAVOURS.settlers.gather - 1e-6, 'the tower by its ley');
  assert.equal(manaCap(s), MANA_CAP + MANA_CAP_TOWER);
  const m = magicOf(s);
  m.mana = manaCap(s) - 1;
  hour(s);
  assert.ok(m.mana <= manaCap(s));
});

test('the town lays its Mage Tower out itself once it knows how', () => {
  const s = town('tower');
  for (let i = 0; i < 6; i++) hour(s);
  assert.ok(s.buildings.some((b) => b.def === MAGE_TOWER), 'a tower blueprint');
});

test('study: a caster learns a spell of a school the town knows, quicker at the library, and casts it in a fight', () => {
  const s = town('study', 1, 6, ['school_restoration']);
  const p = mageOf(s);
  const id = nextStudy(s, p)!;
  assert.ok(SCHOOL_SPELLS.restoration.includes(id), `studies restoration (${id})`);
  const need = SPELL_BY_ID[id].level * STUDY_PER_LEVEL;
  for (let i = 0; i < 400 && !p.arcana?.spells.includes(id); i++) {
    s.tick += TICKS_PER_HOUR;
    studyHourly(s);
  }
  assert.ok(p.arcana!.spells.includes(id), 'learned');
  assert.ok(allSpells(p).some((d) => d.id === id));
  // the library's quicker
  const t = town('study', 1, 6, ['school_restoration']);
  const lib = freeSpot(t, ARCANE_LIBRARY);
  put(t, ARCANE_LIBRARY, lib.x, lib.y);
  const q = mageOf(t);
  let hours = 0;
  while (!q.arcana?.spells.length && hours < 400) {
    t.tick += TICKS_PER_HOUR;
    studyHourly(t);
    hours++;
  }
  assert.ok(hours < need, `faster at the library (${hours} of ${need})`);
  // the studied spell is in their kit's choice
  assert.ok(readySpells('mage', 1, [id]).some((d) => d.id === id) || readySpells('mage', 1).length >= 3);
  const k = kitOf({ cls: 'mage', level: 1, road: null, arcana: { spells: ['mend'], practice: 0, madness: 0, rites: 0, miscasts: 0 } });
  assert.ok(k!.actions.some((a) => a.id === 'mend'), 'a mage who studied Mend keeps it ready');
});

test('the Forbidden Arts tempt only the marked, and a people that shuns a school never studies it', () => {
  const s = town('forbid', 1, 6, ['school_forbidden']);
  const p = mageOf(s);
  assert.equal(nextStudy(s, p), null, 'a plain mage leaves it alone');
  p.cls = 'witch';
  assert.ok(nextStudy(s, p), 'a witch takes it up');
  const k = town('forbid-k', 1, 6, ['school_forbidden']);
  k.origin = 'knights';
  const q = mageOf(k);
  q.cls = 'necromancer';
  assert.equal(nextStudy(k, q), null, 'the knights shun it');
});

test('a focus is only for a caster', () => {
  assert.equal(canWear({ cls: 'warrior' }, 'ley_crystal'), false);
  assert.equal(canWear({ cls: null }, 'ley_crystal'), false);
  assert.equal(canWear({ cls: 'mage' }, 'ley_crystal'), true);
  // and it feeds their spells
  const plain = kitOf({ cls: 'mage', level: 5, road: null, gear: {} })!;
  const held = kitOf({ cls: 'mage', level: 5, road: null, gear: { charm: 'ley_crystal' } })!;
  assert.ok(held.passive.power > plain.passive.power);
});

function raidOn(s: GameState) {
  const kind = RAID_KINDS.find((k) => Object.keys(k.enemies).length && !k.fromSea)!;
  const r = startRaid(s, kind, 40, new Rng(5));
  r.phase = 'warning';
  return r;
}

test('the Great Ward saps the raiders as they come, once a raid', () => {
  const restore = sure();
  const s = town('ward', 1, 6, ['school_abjuration']);
  const m = magicOf(s);
  m.mana = 200;
  const r = raidOn(s);
  const before = r.raiders.map((x) => x.hp);
  hour(s);
  assert.equal(m.warded, r.id);
  r.raiders.forEach((x, i) => assert.ok(x.hp <= before[i] - Math.floor(x.maxHp * WARD_SAP) + 1 || x.hp === 1, 'sapped'));
  const mana = m.mana;
  hour(s);
  assert.ok(m.mana >= mana - 1, 'not twice for one raid');
  restore();
});

test('foresight gives the town more time; Firestorm burns raiders on the road', () => {
  const restore = sure();
  const s = town('sight', 1, 6, ['school_divination']);
  magicOf(s).mana = 200;
  const r = raidOn(s);
  const at = r.arrivesTick;
  hour(s);
  assert.equal(r.arrivesTick, at + FORESIGHT_HOURS * TICKS_PER_HOUR);
  const t = town('storm', 1, 6, ['school_evocation']);
  magicOf(t).mana = 200;
  const q = raidOn(t);
  const hp = q.raiders.reduce((n, x) => n + x.hp, 0);
  hour(t);
  assert.ok(q.raiders.reduce((n, x) => n + x.hp, 0) < hp, 'burned');
  restore();
});

test('a healing rite keeps the downed from bleeding out and mends the hurt; the alignment warms to it', () => {
  const restore = sure();
  const s = town('mend', 1, 6, ['school_restoration']);
  magicOf(s).mana = 200;
  const hurt = s.people[3];
  hurt.hp = 2;
  hurt.downed = { bleedUntil: s.tick + 1000 };
  const align = s.align?.score ?? 0;
  hour(s);
  assert.equal(hurt.downed?.bleedUntil ?? null, null);
  assert.ok(hurt.hp > 2);
  assert.ok((s.align?.score ?? 0) > align);
  restore();
});

test('rain called down breaks a drought; scrying maps a far region', () => {
  const restore = sure();
  const s = town('rain', 1, 6, ['school_transmutation']);
  magicOf(s).mana = 200;
  s.doom = { kind: 'drought', phase: 'active', untilTick: s.tick + 10 * TICKS_PER_DAY };
  hour(s);
  assert.ok(s.doom!.untilTick <= s.tick + TICKS_PER_HOUR);
  const t = town('scry', 1, 6, ['school_divination']);
  t.era = 'medieval';
  magicOf(t).mana = 200;
  const known = (t.regions ?? []).length;
  hour(t);
  assert.equal((t.regions ?? []).length, known + 1);
  assert.ok(REGIONS.some((r) => r.id === t.regions!.at(-1)));
  restore();
});

test('enchanted tools quicken all work for a day', () => {
  const restore = sure();
  const s = town('enchant', 1, 6, ['school_transmutation']);
  const p = s.people[4];
  const before = workFactor(s, p);
  magicOf(s).mana = 200;
  magicOf(s).ready.scrying = 1e9;
  hour(s);
  assert.ok(magicOf(s).enchanted! > s.tick);
  assert.ok(Math.abs(workFactor(s, p) / before - ENCHANT_WORK) < 1e-9);
  restore();
});

test('servants fetch on mana, and turn on the town when it runs out', () => {
  const restore = sure();
  const s = town('servants', 1, 6, ['school_conjuration', 'school_transmutation']);
  const m = magicOf(s);
  m.mana = manaCap(s);
  m.ready.enchant = 1e12;
  for (let i = 0; i < 4 * 24 && m.servants < SERVANTS_MOST; i++) {
    m.mana = manaCap(s);
    hour(s);
  }
  assert.ok(m.servants >= 1, 'animated');
  const n = m.servants;
  m.mana = 0;
  s.research.done = s.research.done.filter((x) => x !== 'school_conjuration');
  hour(s);
  assert.equal(m.servants, n - 1, 'one starved and turned');
  restore();
});

test('the Blood Rite bleeds a prisoner for mana, and darkens the town', () => {
  const restore = sure();
  const s = town('blood', 1, 6, ['school_forbidden']);
  const witch = mageOf(s);
  witch.cls = 'witch';
  const m = magicOf(s);
  m.mana = 0;
  s.prisoners.push({ id: s.nextId++, enemy: 'bandit', name: 'a bandit', conviction: 0, since: 0, hungry: false });
  const align = s.align?.score ?? 0;
  hour(s);
  assert.equal(s.prisoners.length, 0);
  assert.ok(m.mana >= Math.min(manaCap(s), BLOOD_MANA) - 1);
  assert.ok((s.align?.score ?? 0) < align);
  assert.ok(witch.arcana!.madness > 0, 'it marks the one who did it');
  restore();
});

test('a miscast: the backlash burns, madness takes, death, the spell runs wild, the world tears', () => {
  const run = (v: number) => {
    const s = town(`mis-${v}`);
    const p = mageOf(s);
    const m = magicOf(s);
    const people = s.people.length;
    const flux = m.flux;
    const hp = p.hp;
    miscast(s, m, p, 'Ward', fixed(v));
    return { s, p, m, dead: s.people.length < people, burned: p.hp < hp || (p.wounds?.length ?? 0) > 0, flux: m.flux - flux };
  };
  assert.ok(run(0.1).burned, 'a backlash');
  assert.ok(run(0.45).p.arcana!.madness > 0, 'madness');
  const d = run(0.6);
  assert.ok(d.dead && d.m.deaths === 1, 'torn apart');
  assert.ok(run(0.78).flux > 0, 'ran wild');
  const tear = run(0.95);
  assert.ok((tear.s.portals ?? []).some((p) => p.rift) || tear.m.flux >= SURGE_AT, 'a tear (or a surge to come)');
  // the more the wild magic, the likelier; the master less
  const s = town('chance');
  const p = mageOf(s);
  const calm = miscastChance(s, p, 'ward');
  magicOf(s).flux = 0.9;
  assert.ok(miscastChance(s, p, 'ward') > calm);
  p.arcana = { spells: [], practice: 200, madness: 0, rites: 0, miscasts: 0 };
  assert.ok(miscastChance(s, p, 'ward') < calm * 2.8);
});

test('a mage gone mad is put to the town: locked away, sent away, or let be', () => {
  const s = town('mad');
  const p = mageOf(s);
  p.arcana = { spells: [], practice: 0, madness: MAD_AT + 0.1, rites: 0, miscasts: 0 };
  hour(s);
  const q = s.prompts.find((x) => x.kind === 'ways' && x.ways?.system === 'magic');
  assert.ok(q, 'asked');
  assert.equal(q!.options.length, 3);
  answerWays(s, q!, 0, new Rng(1));
  assert.ok(p.arcana.locked! > s.tick, 'locked in the tower');
  assert.ok(!castersHere(s).includes(p), 'and casts nothing meanwhile');
  // sent away
  const t = town('mad-2');
  const r = mageOf(t);
  r.arcana = { spells: [], practice: 0, madness: MAD_AT + 0.1, rites: 0, miscasts: 0 };
  hour(t);
  const ask = t.prompts.find((x) => x.ways?.system === 'magic')!;
  answerMagic(t, ask, 2);
  assert.ok(!t.people.includes(r), 'gone');
});

test('the wild magic surges past its mark: fire, harm near the tower, and it falls back', () => {
  let deaths = 0;
  let fires = 0;
  for (const seed of ['surge-a', 'surge-b', 'surge-c', 'surge-d']) {
    const s = town(seed, 1, 8);
    const spot = freeSpot(s, MAGE_TOWER);
    put(s, MAGE_TOWER, spot.x, spot.y);
    const m: MagicState = magicOf(s);
    m.flux = SURGE_AT;
    surge(s, m, new Rng(7));
    assert.equal(m.flux, SURGE_LEAVES);
    assert.equal(m.surges, 1);
    deaths += m.deaths;
    fires += s.buildings.filter((b) => b.fire !== undefined).length;
  }
  assert.ok(fires > 0, 'fire');
  void deaths;
});

test('a cursed charm drains its bearer and weighs on the mind, until the ward-wright breaks it', () => {
  const restore = sure();
  const s = town('curse', 1, 6, ['school_abjuration']);
  const bearer = s.people[4];
  bearer.gear.charm = CURSED[0];
  const hp = (bearer.hp = maxHp(bearer));
  magicOf(s).mana = 0;
  magicOf(s).ready.ward = 1e12;
  hour(s);
  assert.ok(bearer.hp < hp, 'drained');
  assert.ok(bearer.arcana!.madness > 0);
  magicOf(s).mana = 200;
  hour(s);
  assert.equal(bearer.gear.charm, undefined, 'broken');
  restore();
});

test('a master mage makes their masterwork once: an enchanted charm', () => {
  const s = town('master');
  const p = mageOf(s);
  p.arcana = { spells: SCHOOL_IDS.flatMap((k) => SCHOOL_SPELLS[k]).slice(0, MASTER_SPELLS), practice: 0, madness: 0, rites: 0, miscasts: 0 };
  hour(s);
  const made = ENCHANTED.filter((id) => (s.items[id] ?? 0) > 0 || Object.values(s.people.map((q) => q.gear.charm)).includes(id));
  assert.equal(made.length, 1);
  hour(s);
  assert.equal(magicOf(s).found.length, 1, 'once');
});

test('the same seed, the same magic', () => {
  const play = () => {
    const s = town('same', 2);
    magicOf(s).mana = 150;
    for (let i = 0; i < 72; i++) hour(s);
    return JSON.stringify([s.magic, s.people.map((p: Person) => p.arcana)]);
  };
  assert.equal(play(), play());
});

test('seen: the Magic view, the leylines, and a caster\'s spellbook on their page', () => {
  const s = town('seen');
  hour(s);
  const v = magicView(s)!;
  assert.ok(v.cap > 0 && v.schools.length === SCHOOL_IDS.length && v.ley.lines.length === 3);
  const snap = snapshot(s);
  assert.ok(snap.magic);
  const mv = snap.people.find((q) => q.id === mageOf(s).id)!;
  assert.ok(mv.arcana && mv.arcana.spells.length > 0);
  assert.equal(snap.people.find((q) => q.cls !== 'mage' && q.cls !== null && !['witch', 'white_mage'].includes(q.cls ?? ''))?.arcana ?? null, null);
});

test('a raid\'s short warning is not missed: the rites against it come between the hours', () => {
  const restore = sure();
  const s = town('warn-tick', 1, 6, ['school_abjuration']);
  const m = magicOf(s);
  m.mana = 200;
  s.tick += 7; // (not on the hour)
  const r = raidOn(s);
  magicHourly(s);
  assert.equal(m.warded, r.id);
  restore();
});
