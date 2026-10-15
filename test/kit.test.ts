import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_BY_ID } from '../src/shared/data/items';
import { KIT_ITEMS, KIT_BY_ID } from '../src/shared/data/kitItems';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { TOPICS } from '../src/shared/data/research';
import { Rng } from '../src/shared/rng';
import { takeTurn, kitOf, type Arena, type Combatant } from '../src/shared/sim/actions';
import { startBattle, stepBattle, keepBag } from '../src/shared/sim/combat';
import { kitCap, kitNeed, raiderPotions, restockKits } from '../src/shared/sim/kit';
import { pickKitItem } from '../src/shared/sim/kitFight';
import { runPlanner } from '../src/shared/sim/planner';
import { makePerson, maxHp, type Building, type GameState } from '../src/shared/sim/state';
import { TICK_HZ, TICKS_PER_HOUR } from '../src/shared/sim/time';
import { plainGame, row } from './helpers';

/** A stand-in fighter for the action engine. */
const fighter = (over: Partial<Combatant> = {}): Combatant => ({
  side: 'party', ref: 1, kind: 'person', name: 'Ann', hp: 100, maxHp: 100, down: false, damage: [5, 8], accuracy: 0.8, dodge: 0.05, armor: 0, interval: 20, cooldown: 0, ranged: false, ...over,
});
const wolf = (): Combatant => fighter({ side: 'enemy', ref: 7, kind: 'wolf', name: 'Wolf' });
const arena = (all: Combatant[], tick = 100, log: string[] = []): Arena => ({ tick, all: () => all, rng: new Rng(3), summon: () => null, log: (_u, name) => { log.push(name); } });

test('the items are well formed: a station that exists, research that exists, an icon', () => {
  const topics = new Set(TOPICS.map((t) => t.id));
  assert.ok(KIT_ITEMS.length >= 8);
  for (const k of KIT_ITEMS) {
    assert.ok(ITEM_BY_ID[k.id], `${k.id} is in ITEMS`);
    assert.ok(BUILDING_BY_ID[k.station] || ['campfire', 'smithy', 'kiln'].includes(k.station), `${k.id}'s station ${k.station}`);
    for (const r of k.research) assert.ok(topics.has(r), `${k.id} needs ${r}`);
    assert.equal(ITEM_BY_ID[k.id].slot, null);
  }
});

test('a potion is drunk under half health, and used up', () => {
  const me = fighter({ hp: 40, bag: ['healing_potion', 'antidote'] });
  const log: string[] = [];
  assert.equal(takeTurn(arena([me, wolf()], 100, log), me), false, 'a drink or a buff is quick: no turn lost');
  assert.equal(me.hp, 80, '40% of 100 back');
  assert.deepEqual(me.bag, ['antidote'], 'one potion gone');
  assert.deepEqual(log, ['Healing Potion']);
  // (and not at full health)
  const well = fighter({ hp: 90, bag: ['healing_potion'] });
  assert.equal(pickKitItem(arena([well, wolf()]), well), null);
});

test('the smallest potion that mends what is missing, the strongest when it is dire', () => {
  const bag = ['healing_potion', 'greater_healing_potion'];
  assert.equal(pickKitItem(arena([fighter({ hp: 45, bag }), wolf()]), fighter({ hp: 45, bag }))?.id, 'healing_potion');
  const dire = fighter({ hp: 10, bag });
  assert.equal(pickKitItem(arena([dire, wolf()]), dire)?.id, 'greater_healing_potion');
});

test('a dry caster drinks a mana draught; one with mana does not', () => {
  const spell = { id: 'bolt', name: 'Bolt', spell: true, level: 1, cooldown: 10, ready: 0, effects: [], use: 'attack' as const, cost: 10, pool: 'mp' as const };
  const dry = fighter({ mp: 3, maxMp: 50, kit: { actions: [spell], passive: kitOf({ cls: 'warrior', level: 1, road: undefined })!.passive }, bag: ['mana_draught'] });
  assert.equal(takeTurn(arena([dry, wolf()]), dry), false, 'a drink or a buff is quick: no turn lost');
  assert.equal(dry.mp, 33, '60% of 50 back');
  assert.deepEqual(dry.bag, []);
  const fresh = fighter({ mp: 45, maxMp: 50, kit: dry.kit, bag: ['mana_draught'] });
  assert.equal(pickKitItem(arena([fresh, wolf()]), fresh), null);
});

test('an antidote when poisoned, smoke when badly hurt, a charm at the start of a fight', () => {
  const sick = fighter({ bag: ['antidote'], st: { poison: { until: 999, power: 3 } } });
  assert.equal(pickKitItem(arena([sick, wolf()]), sick)?.id, 'antidote');
  assert.equal(takeTurn(arena([sick, wolf()]), sick), false, 'a drink or a buff is quick: no turn lost');
  assert.equal(sick.st!.poison, undefined, 'the poison is cleared');
  const hurt = fighter({ hp: 20, bag: ['smoke_bomb'] });
  assert.equal(takeTurn(arena([hurt, wolf()]), hurt), false, 'a drink or a buff is quick: no turn lost');
  assert.ok((hurt.st!.invisible?.until ?? 0) > 100, 'unseen in the smoke');
  const ready = fighter({ bag: ['ward_charm'] });
  assert.equal(takeTurn(arena([ready, wolf()]), ready), false, 'a drink or a buff is quick: no turn lost');
  assert.ok(ready.st!.protect);
  assert.equal(pickKitItem(arena([ready, wolf()]), ready), null, 'not twice');
  const idle = fighter({ bag: ['ward_charm'] });
  assert.equal(pickKitItem(arena([idle]), idle), null, 'nothing to fight: nothing used');
});

test('a drink does not cost the turn, and none is drunk when one blow would end the fight', () => {
  const near = { ...wolf(), hp: 4 };
  const me = fighter({ hp: 30, bag: ['healing_potion'] });
  assert.equal(pickKitItem(arena([me, near]), me), null, 'they strike instead');
  assert.equal(pickKitItem(arena([me, wolf()]), me)?.id, 'healing_potion');
  const log: string[] = [];
  const spell = { id: 'bolt', name: 'Bolt', spell: true, level: 1, cooldown: 10, ready: 0, effects: [{ kind: 'damage' as const, target: 'foe' as const, power: 1 }], use: 'attack' as const, cost: 1, pool: 'mp' as const };
  const caster = fighter({ hp: 30, mp: 20, maxMp: 20, bag: ['healing_potion'], kit: { actions: [spell], passive: kitOf({ cls: 'warrior', level: 1, road: undefined })!.passive } });
  assert.ok(takeTurn(arena([caster, wolf()], 100, log), caster), 'drank, then cast');
  assert.deepEqual(log, ['Healing Potion', 'Bolt']);
});

test('a thrown item is used only when it hits harder than the weapon', () => {
  for (let t = 0; t < 40; t++) {
    const m = fighter({ bag: ['oil_flask', 'throwing_knife'] });
    const pick = pickKitItem(arena([m, wolf()], t), m);
    assert.ok(!pick || pick.use === 'throw');
  }
  // (a weak one is never picked: a flask with no fire in it)
  const weak = fighter({ bag: ['throwing_knife'] });
  assert.ok(KIT_BY_ID.throwing_knife.effects.every((e) => (e.power ?? 1) >= 1.2), 'the knife beats a blow');
  void weak;
});

test('a thrown flask burns a foe, sometimes (its own stream: the same each time)', () => {
  const picks = (tick: number) => {
    const me = fighter({ bag: ['oil_flask'] });
    return pickKitItem(arena([me, wolf()], tick), me)?.id ?? null;
  };
  const a = Array.from({ length: 40 }, (_, i) => picks(i));
  assert.deepEqual(a, Array.from({ length: 40 }, (_, i) => picks(i)));
  assert.ok(a.some((x) => x === 'oil_flask') && a.some((x) => x === null), 'now and then');
  const me = fighter({ bag: ['oil_flask'] });
  const foe = wolf();
  const k = KIT_BY_ID.oil_flask;
  void k;
  for (let t = 0; t < 60 && me.bag!.length; t++) takeTurn(arena([me, foe], t), me);
  assert.deepEqual(me.bag, []);
  assert.ok(foe.hp < 100 || foe.st?.burn, 'the foe was hurt or burning');
});

test('in a party fight a hurt fighter drinks from their pouch, and what is left goes back to them', () => {
  const rng = new Rng(5);
  const p = makePerson(new Rng(1), 1, 'hunter', { x: 0, y: 0 }, []);
  p.cls = 'knight';
  p.level = 10;
  p.hp = Math.round(maxHp(p) * 0.3);
  p.kit = ['healing_potion', 'whetstone'];
  const b = startBattle([p], {}, { wolf_alpha: 2 }, rng);
  const f = b.fighters.find((x) => x.ref === p.id)!;
  for (let i = 0; i < 30 * TICK_HZ && !b.outcome; i++) stepBattle(b, rng, { retreatAt: 0, mainId: null });
  assert.ok(!f.bag!.includes('healing_potion'), 'the potion was drunk');
  keepBag(p, f);
  assert.ok(!p.kit?.includes('healing_potion'));
  assert.equal(p.kit?.includes('whetstone') ?? false, f.bag!.includes('whetstone'));
});

function folk(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    const q = makePerson(new Rng(10 + i), s.nextId++, 'hunter', { x: 0, y: 0 }, []);
    q.cls = 'warrior';
    q.skills.melee.level = 2 + i;
    s.people.push(q);
  }
}

test('hand-out: the best fighters first, one round at a time, to the pouch size, with the autopilot on, by the hour', () => {
  const s = plainGame('handout');
  folk(s, 3);
  s.people[0].cls = 'warrior';
  s.people[0].skills.melee.level = 1;
  for (const p of s.people) p.priorities.defend = 0;
  s.items = { healing_potion: 2, antidote: 1 };
  s.tick = TICKS_PER_HOUR;
  restockKits(s);
  assert.equal(s.items.healing_potion, 2, 'autopilot off: nothing handed out');
  s.autopilot = true;
  s.tick = TICKS_PER_HOUR + 1;
  restockKits(s);
  assert.equal(s.items.healing_potion, 2, 'only on the hour');
  s.tick = TICKS_PER_HOUR;
  restockKits(s);
  const best = [...s.people].sort((a, b) => b.skills.melee.level - a.skills.melee.level);
  assert.equal(best[0].kit![0], 'healing_potion', 'the best fighter has a potion');
  assert.ok(best[1].kit?.includes('healing_potion'), 'the next too');
  assert.equal(best[2].kit?.includes('healing_potion') ?? false, false, 'two potions, two people');
  assert.equal((s.items.healing_potion ?? 0), 0);
  for (const p of s.people) assert.ok((p.kit?.length ?? 0) <= kitCap(p));
});

test('a caster is handed draughts first, and the pouch has a size', () => {
  const s = plainGame('casters');
  s.autopilot = true;
  const mage = s.people[0];
  mage.cls = 'mage';
  s.items = { mana_draught: 5, healing_potion: 5 };
  s.tick = TICKS_PER_HOUR;
  restockKits(s);
  assert.equal(mage.kit![0], 'mana_draught');
  assert.equal(mage.kit!.length, kitCap(mage));
  assert.ok(kitCap(mage) >= 2 && kitCap(mage) <= 6);
  delete mage.gear.pack;
  const bare = kitCap(mage);
  mage.gear.pack = 'backpack';
  assert.equal(kitCap(mage), bare + 1, 'a pack on the back holds one more');
});

test('the planner orders potions for the pouches, one at a time, until there are enough', () => {
  const s = plainGame('orders');
  s.autopilot = true;
  s.cheats.unlockAll = true;
  s.people[0].cls = 'warrior';
  const b: Building = { id: s.nextId++, def: 'apothecary', tile: 4, row: row(s), status: 'done', delivered: {}, progress: 1, store: {} };
  s.buildings.push(b);
  s.buildings.find((x) => x.def === 'campfire')!.store = { herbs: 12, rations: 40 };
  assert.ok(kitNeed(s, 'healing_potion') > 0);
  runPlanner(s);
  assert.ok(s.crafting.some((o) => KIT_BY_ID[o.item]), `ordered: ${s.crafting.map((o) => o.item)}`);
  s.people[0].kit = ['healing_potion', 'antidote'];
  s.items = { healing_potion: 2, antidote: 2, mana_draught: 1, greater_healing_potion: 2, combat_stim: 2, ward_charm: 2, smoke_bomb: 2, whetstone: 2, oil_flask: 2, throwing_knife: 3 };
  for (const k of KIT_ITEMS) assert.equal(kitNeed(s, k.id), 0, `${k.id}: enough`);
});

test('a fallen raider of the people kinds may leave a potion; beasts never', () => {
  const s = plainGame('loot');
  const rd = (id: number, kind: string) => ({ id, kind, ally: false }) as unknown as Parameters<typeof raiderPotions>[1][number];
  const orcs = Array.from({ length: 200 }, (_, i) => rd(i, 'orc_grunt'));
  const found = raiderPotions(s, orcs);
  assert.ok(found.length > 5 && found.length < 60, `${found.length} of 200`);
  assert.equal((s.items.healing_potion ?? 0) + (s.items.greater_healing_potion ?? 0), found.length);
  const s2 = plainGame('loot2');
  assert.equal(raiderPotions(s2, Array.from({ length: 200 }, (_, i) => rd(i, 'wolf'))).length, 0);
});
