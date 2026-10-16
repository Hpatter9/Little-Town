import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from '../src/shared/sim/commands';
import { FAVOURITES_MOST, favouriteRefusal, isFavourite, nameDays } from '../src/shared/sim/favourites';
import { buildObituary, obituaryLines, topicOfCause } from '../src/shared/sim/obituary';
import { closeCall, isShaken, raidCloseCalls, SHAKEN_HOURS } from '../src/shared/sim/closeCalls';
import { awayBefore, awaySummary } from '../src/shared/sim/awaySummary';
import { killPerson, knockDown } from '../src/shared/sim/health';
import { diaryOf, nearlyMine } from '../src/shared/sim/diary';
import { journalView, snapshot } from '../src/shared/sim/snapshot';
import { Sim } from '../src/shared/sim/sim';
import { makePerson, maxHp, type GameState } from '../src/shared/sim/state';
import { TICKS_PER_HOUR } from '../src/shared/sim/time';
import { Rng } from '../src/shared/rng';
import { campPx, plainGame } from './helpers';

function town(seed: string, more = 5): GameState {
  const s = plainGame(seed);
  s.nextRaidTick = Number.MAX_SAFE_INTEGER;
  s.nextDoomTick = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < more; i++) s.people.push(makePerson(new Rng(i + 1), s.nextId++, 'hunter', { x: campPx(s).x + i * 20, y: campPx(s).y }, s.people.map((p) => p.name)));
  return s;
}

test('favourites: pinned by command, three at most, unpinned, and only the living', () => {
  const s = town('fav-limits');
  const sim = new Sim(s);
  const ids = s.people.map((p) => p.id);
  assert.ok(parseCommand({ type: 'favourite', id: ids[1], on: true }));
  assert.equal(parseCommand({ type: 'favourite', id: 'x', on: true }), null);
  assert.equal(parseCommand({ type: 'favourite', id: ids[1] }), null);
  for (const id of ids.slice(0, FAVOURITES_MOST + 1)) sim.command({ type: 'favourite', id, on: true });
  sim.command({ type: 'favourite', id: ids[0], on: true }); // (twice: no double)
  sim.command({ type: 'favourite', id: 99999, on: true }); // (nobody)
  sim.step();
  assert.deepEqual(s.favourites, ids.slice(0, FAVOURITES_MOST), 'three at most, in the order pinned');
  assert.equal(favouriteRefusal(s, ids[4], true), `${FAVOURITES_MOST} at most`);
  sim.command({ type: 'favourite', id: ids[1], on: false });
  sim.command({ type: 'favourite', id: ids[4], on: true });
  sim.step();
  assert.deepEqual(s.favourites, [ids[0], ids[2], ids[4]]);
  assert.deepEqual(snapshot(s).favourites, s.favourites, 'the renderer sees them');
  assert.equal(nameDays(s).length, 3, 'a name-day each, for the calendar');
});

test("a favourite's death frees the slot and keeps them for their last card", () => {
  const s = town('fav-death');
  const p = s.people[2];
  s.favourites = [p.id];
  killPerson(s, p, 'at the hands of the wolves');
  assert.equal(isFavourite(s, p.id), false);
  assert.equal(s.favourites, undefined, 'no favourites left: the field goes');
  assert.deepEqual(s.favouritesGone, [p.id]);
});

test('older saves: no favourites, and nothing breaks', () => {
  const s = town('fav-old');
  delete s.favourites;
  assert.deepEqual(snapshot(s).favourites, []);
  assert.equal(nameDays(s).length, 0);
});

test('the obituary: their age, their own line, who they leave, what they were known for, their look', () => {
  const s = town('obit');
  const [, dad, mum, kid] = s.people;
  dad.partner = mum.id;
  mum.partner = dad.id;
  kid.parents = [dad.id, mum.id];
  dad.felled = 3;
  dad.deeds = { built: 7, healed: 1 };
  const o = buildObituary(s, dad, 'at the hands of the bandits', 1);
  assert.equal(o.age > 0, true);
  assert.ok(o.line.length > 0);
  assert.deepEqual(o.leaves, [`their partner ${mum.name}`, `a child, ${kid.name}`]);
  assert.ok(o.known.includes('raising 7 buildings'), o.known.join('; '));
  assert.ok(o.known.some((k) => k === 'felling 3 raiders'));
  assert.deepEqual(o.look, dad.look);
  // (the same every time: a side stream of the seed and their id, nothing drawn from the town's)
  const before = s.rngState;
  assert.deepEqual(buildObituary(s, dad, 'at the hands of the bandits', 1), o);
  assert.equal(s.rngState, before);
  assert.equal(topicOfCause('of old age, full of days'), 'old');
  assert.equal(topicOfCause('of hunger'), 'hungry');
  // kept with the fallen when they die
  killPerson(s, dad, 'at the hands of the bandits');
  const f = s.fallen!.at(-1)!;
  assert.deepEqual(f.obit?.leaves, o.leaves);
  const lines = obituaryLines(f);
  assert.ok(lines[0].startsWith(`${dad.name}`) && lines[0].includes('at the hands of the bandits'), lines[0]);
  assert.ok(lines.some((l) => l.startsWith('“')));
  assert.ok(lines.some((l) => l.startsWith('They leave behind')));
  // (an older save's fallen, with no obituary, still gets a line)
  assert.equal(obituaryLines({ ...f, obit: undefined }).length, 1);
});

test('close calls: a medkit save is told, kept on the person and the town, and the Journal shows it', () => {
  const s = town('close-medkit');
  const p = s.people[1];
  s.items.medkit = 1;
  const id0 = s.nextId;
  knockDown(s, p);
  assert.equal(p.downed, null, 'the medkit got them up');
  assert.equal(s.nextId, id0 + 1, 'only the notice took an id: the close call takes none');
  assert.equal(p.closeCalls?.length, 1);
  assert.ok(s.closeCalls?.[0].text.startsWith(`${p.name} was struck down`));
  assert.ok(isShaken(s, p));
  s.tick += SHAKEN_HOURS * TICKS_PER_HOUR;
  assert.ok(!isShaken(s, p), 'shaken for a while only');
  const j = journalView(s);
  const at = j.findIndex((e) => e.close === p.id);
  assert.ok(at > 0, 'woven into the Journal');
  assert.ok(j[at - 1].text.includes('medkit'), 'just after the line it belongs with');
});

test('close calls: tending the bleeding is told with who saved them, and goes in their diary', () => {
  const s = town('close-tend', 2);
  const sim = new Sim(s);
  const [founder, nurse, hurt] = s.people;
  founder.x = 200;
  hurt.x = nurse.x + 4;
  s.items.bandage = 1;
  knockDown(s, hurt);
  for (let i = 0; i < 2 * TICKS_PER_HOUR && !hurt.closeCalls; i++) sim.step();
  const c = hurt.closeCalls?.[0];
  assert.ok(c, 'a close call was told');
  assert.match(c!.text, new RegExp(`^${hurt.name} nearly bled out; .+ stopped the bleeding\\.$`));
  assert.ok(diaryOf(s, hurt).some((l) => l.includes('I nearly bled out;') && l.includes('I could have died.')), diaryOf(s, hurt).join('\n'));
  assert.equal(nearlyMine("Bram's fever turned, and the plague let go.", 'Bram'), 'My fever turned, and the plague let go.');
});

test('close calls: a raid that left someone with a sliver of health is told in the recap', () => {
  const s = town('close-raid');
  const [, a, b] = s.people;
  a.hp = maxHp(a) * 0.1;
  b.hp = maxHp(b) * 0.9;
  const lines = raidCloseCalls(s, 0, [{ id: a.id, died: false, fell: false }, { id: b.id, died: false, fell: false }]);
  assert.deepEqual(lines, [`${a.name} nearly fell to the raiders, and came through with barely a breath left.`]);
  // (told once: a second count finds it told)
  assert.equal(raidCloseCalls(s, 0, [{ id: a.id, died: false, fell: false }]).length, 1);
  assert.equal(a.closeCalls?.length, 1);
});

test('the away card leads with the favourites, one line each, and does not tell them twice', () => {
  const s = town('fav-away');
  const [, a, b, c] = s.people;
  s.favourites = [a.id, b.id, c.id];
  const before = awayBefore(s);
  s.tick += 6000;
  killPerson(s, a, 'of the plague');
  closeCall(s, b, `${b.name} nearly bled out; Osric stopped the bleeding.`);
  const lines = awaySummary(s, before);
  assert.deepEqual(lines.slice(0, 3).map((l) => l.text.slice(0, 2)), ['♥ ', '♥ ', '♥ ']);
  assert.equal(lines[0].text, `♥ ${a.name} died of the plague.`);
  assert.ok(lines[1].text.includes('nearly bled out'));
  assert.ok(lines[2].text.startsWith(`♥ ${c.name} is well`));
  assert.equal(lines.filter((l) => l.text.includes(`${a.name} died`)).length, 1, 'their death told once');
  // (a favourite who is simply well is no reason for a card)
  const quiet = town('fav-quiet');
  quiet.favourites = [quiet.people[1].id];
  const b2 = awayBefore(quiet);
  quiet.tick += 600;
  assert.deepEqual(awaySummary(quiet, b2), []);
});

test('the news: a close call is gold, a death opens the obituary, a favourite gets a ♥ and their funeral can be watched', async () => {
  const { journalNotices, stakeNotices } = await import('../src/renderer/mobile/notices');
  const s = town('fav-news');
  const [, a, b] = s.people;
  s.favourites = [a.id];
  s.tick += 600;
  closeCall(s, b, `${b.name} nearly bled out; ${a.name} stopped the bleeding.`);
  killPerson(s, a, 'of the plague');
  s.journal.push({ id: s.nextId++, tick: s.tick, text: `One who loved them gathers by the fire to lay ${a.name} to rest.` });
  const snap = snapshot(s);
  const entries = journalView(s);
  const ns = stakeNotices(journalNotices(entries, snap), entries, snap);
  const close = ns.find((n) => n.title.includes('nearly bled out'))!;
  assert.equal(close.tone, 'gold');
  assert.ok(close.title.startsWith('♥ '), 'it names a favourite');
  const death = ns.find((n) => n.title.includes(`${a.name} has died`))!;
  assert.deepEqual(death.action, { label: 'Obituary', kind: 'obit', fallen: a.id });
  const funeral = ns.find((n) => n.title.includes('to lay'))!;
  assert.deepEqual(funeral.action, { label: 'Watch', kind: 'funeral', fallen: a.id });
});
