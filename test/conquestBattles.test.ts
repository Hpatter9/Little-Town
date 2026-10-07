import assert from 'node:assert/strict';
import { test } from 'node:test';
import { piece } from '../src/shared/data/quality';
import { BEAT_TICKS, SQUAD_SLOTS } from '../src/shared/data/troops';
import { legTicks, marchArmy, raiseArmy } from '../src/shared/sim/conquest/armies';
import { battleOfArmy, captivesOf, ransom } from '../src/shared/sim/conquest/battles';
import { worldOf } from '../src/shared/sim/conquest/conquest';
import { formSquad, heroStrength } from '../src/shared/sim/conquest/squads';
import { warView } from '../src/shared/sim/conquest/warView';
import { realm } from '../src/shared/sim/factions';
import { Sim } from '../src/shared/sim/sim';
import { plainGame } from './helpers';

const veteran = (s: ReturnType<typeof plainGame>, id: number, name: string) => {
  const base = s.people[0];
  const v = { ...structuredClone(base), id, name, level: 60, road: 'titan', cls: 'warrior', attrPts: undefined, gear: { weapon: 'iron_sword', body: 'steel_cuirass' }, gearQ: { weapon: piece(7, 5), body: piece(7, 5) } };
  for (const k of Object.keys(v.skills) as (keyof typeof v.skills)[]) v.skills[k] = { level: 40, xp: 0 };
  s.people.push(v as typeof base);
  return v as typeof base;
};
/** March an army at a province held against it and play the battle out. */
function fight(s: ReturnType<typeof plainGame>, armyId: number, province: number) {
  const w = worldOf(s)!;
  const c = s.conquest!;
  const a = c.armies!.find((x) => x.id === armyId)!;
  const r = marchArmy(s, armyId, province);
  assert.ok(r.ok, r.reason ?? '');
  const sim = new Sim(s);
  for (let i = 0; i < 40 * legTicks(w, a.at, province) && !battleOfArmy(c, armyId); i++) sim.step();
  const b = battleOfArmy(c, armyId);
  assert.ok(b, 'a battle began');
  for (let i = 0; i < 400 * BEAT_TICKS && !b!.done; i++) sim.step();
  assert.ok(b!.done, 'the battle ended');
  return { b: b!, sim };
}

test('a veteran\'s army storms a rival province: a battle on the board, won, the province taken', () => {
  const s = plainGame('storm');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const vet = veteran(s, 90, 'Vetra');
  assert.ok(heroStrength(vet) > 30);
  c.troops.spearmen = 9;
  const q = formSquad(s, vet.id).squad!;
  for (let i = 0; i < SQUAD_SLOTS; i++) q.slots[i] = 'spearmen';
  c.troops.spearmen = 0;
  const a = raiseArmy(s, q.id).army!;
  // a rival's province one march from home (the rivals spread meanwhile, so the way must be one leg)
  const home = w.realms[0].capital;
  const rival = w.realms[1];
  const target = w.provinces[home].neighbours.find((n) => c.holder[n] === null && w.provinces[n].landmark !== 'lair')!;
  c.holder[target] = rival.id;
  const { b } = fight(s, a.id, target);
  assert.equal(b.done, 'won', b.events.map((e) => e.text).join(' | '));
  assert.equal(c.holder[target], 'town');
  assert.ok(b.events.some((e) => e.kind === 'clash'));
  assert.ok(c.lastBattle?.won);
  assert.ok(c.lastBattle!.felled > 0);
  assert.equal(vet.away, -a.id, 'still with the army');
  // the view carries the board a while after
  const v = warView(s)!;
  assert.ok(v.battle && v.battle.done === 'won');
  assert.ok(v.recap?.won);
});

test('a green squad is beaten: the army falls back, the hero wounded, captured or killed; a captive can be ransomed', () => {
  const s = plainGame('beaten');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const hero = s.people[0];
  hero.level = 1;
  c.troops.militia = 2;
  const q = formSquad(s, hero.id).squad!;
  q.slots[0] = 'militia';
  const a = raiseArmy(s, q.id).army!;
  const rival = w.realms[1];
  const home = w.realms[0].capital;
  const target = w.provinces[home].neighbours.find((n) => c.holder[n] === null && w.provinces[n].landmark !== 'lair')!;
  c.holder[target] = rival.id;
  w.provinces[target].tier = 4;
  w.provinces[target].fort = 3;
  const { b } = fight(s, a.id, target);
  assert.equal(b.done, 'lost', b.events.map((e) => e.text).join(' | '));
  assert.notEqual(c.holder[target], 'town');
  assert.ok(c.lastBattle && !c.lastBattle.won);
  const mine = b.squads.find((x) => x.side === 'town')!;
  assert.ok(mine.out === 'fallen' || mine.out === 'routed');
  const stillHere = s.people.find((p) => p.id === hero.id);
  const cap = captivesOf(c).find((x) => x.hero === hero.id);
  if (!stillHere) assert.equal(mine.out, 'fallen', 'killed only when struck down');
  else if (cap) {
    assert.ok(stillHere.away! < -1000, 'held away');
    c.chest = cap.ransom;
    assert.ok(ransom(s, hero.id).ok);
    assert.equal(stillHere.away, null);
    assert.equal(captivesOf(c).length, 0);
  } else assert.ok(a.at !== target, 'fell back');
  // the founder is the founder: gentler odds are data, the fate still one of the three
  assert.ok(c.lastBattle!.fates.every((f) => ['fought', 'wounded', 'captured', 'killed', 'routed'].includes(f.fate)));
});

test('a lair must be cleared: beasts hold it, and a win clears it', () => {
  const s = plainGame('lair');
  const c = s.conquest!;
  const w = worldOf(s)!;
  const lair = w.provinces.find((p) => p.landmark === 'lair' && c.holder[p.id] === null);
  if (!lair) return; // (this seed has none)
  const vet = veteran(s, 91, 'Ulf');
  const q = formSquad(s, vet.id).squad!;
  c.troops.shieldbearers = 0;
  c.troops.militia = 9;
  for (let i = 0; i < 6; i++) q.slots[i] = 'militia';
  c.troops.militia = 3;
  const a = raiseArmy(s, q.id).army!;
  for (const f of realm(s)) f.troops = 0;
  for (let i = 0; i < c.holder.length; i++) if (c.holder[i] !== null && c.holder[i] !== 'town') c.holder[i] = null;
  const { b } = fight(s, a.id, lair.id);
  assert.ok(b.squads.some((x) => x.side === 'foe' && x.troops.some((t) => t?.troop === 'lair_beasts')));
  if (b.done === 'won') {
    assert.equal(c.holder[lair.id], 'town');
    assert.ok(c.cleared?.includes(lair.id));
  }
});
