// Powers: the spells and rituals of a town's origin (data/origins.ts). The town calls on them by itself, like
// everything else: each has its moment (a raid on, a field growing, someone hurt), a cost, and a wait before it can be
// called on again. Some strike at once; some last a while (buffs, read by origin.ts). What was cast, and when it's ready
// again, is shown on the Plan tab.

import { ENEMIES } from '../data/enemies';
import { originOf } from '../data/origins';
import { MATERIAL_NAMES, type Material, type Stock } from '../data/materials';
import { DESTINATIONS } from '../data/expeditions';
import type { Rng } from '../rng';
import { BUILDING_BY_ID } from '../data/buildings';
import { buildingCentre, buildingCentreX, depositNear, storages, totalStock } from './buildings';
import { ally } from './classes';
import { destinationUnlocked } from './expeditions';
import { cropOf } from './farming';
import { stabilize } from './health';
import { fullMoon } from './monsters';
import { shopOf, tavernOf } from './shop';
import { researchMods } from './research';
import { wardOf } from './rivals';
import { aimedFoes, bestAim, inBattle } from './battle';
import { townFull, addStock, campX, campXY, castSpellFx, makePerson, maxHp, notify, personFx, type GameState, type Person, type Raider, type SpellTarget } from './state';
import { WORLD_WIDTH } from '../constants';
import { calendar, TICK_HZ, TICKS_PER_HOUR } from './time';
import { housingCapacity, joinOrigin } from './townsfolk';

export interface PowerDef {
  id: string;
  name: string;
  description: string;
  /** Game hours before it can be called on again. */
  cooldown: number;
  /** What it uses up: the first of these the town can pay. */
  costs?: Stock[];
  /** A lasting effect (read by origin.ts), for this many game hours. */
  lasts?: number;
  /** Whether now's the moment (the town doesn't waste it). */
  when(s: GameState): boolean;
  /** What it does; returns what happened, for the log. */
  cast(s: GameState, rng: Rng): string;
}

/* ------------------------------------------------------------ helpers */

const raidOn = (s: GameState) => s.raid?.phase === 'active' && s.raid.raiders.some((r) => !r.ally && !r.down && !r.gone);
/** The raiders a spell can reach: where it's aimed on the battle map, else every one on the field (on the trail or in
 *  the town; not those still waiting to come on). */
const foes = (s: GameState): Raider[] => aimedFoes(s) ?? (s.raid?.phase === 'active' ? s.raid.raiders.filter((r) => !r.ally && !r.down && !r.gone && !(r.bt && !r.bt.out && r.bt.d < 0)) : []);
const home = (s: GameState) => s.people.filter((p) => p.away === null);
const founder = (s: GameState) => s.people.find((p) => p.id === s.mainId);
const hurt = (s: GameState) => home(s).filter((p) => p.hp < maxHp(p) * 0.7 || p.downed);
const night = (s: GameState) => {
  const h = calendar(s.tick).hour;
  return h >= 20 || h < 5;
};

/** Strike every raider still fighting; returns how many fell. */
function strike(s: GameState, dmg: number, fx: Raider['hitFx']): number {
  let fell = 0;
  const ward = wardOf(s); // (a rival lord's ward turns some of it)
  for (const r of foes(s)) {
    r.hp = Math.max(0, r.hp - Math.round(dmg * ward));
    r.lastHit = s.tick;
    r.hitFx = fx;
    if (r.hp === 0) {
      r.down = true;
      fell++;
    }
  }
  return fell;
}

/** Heal everyone at home by so much (and the downed are stabilised). */
function healAll(s: GameState, hp: number): number {
  let n = 0;
  for (const p of home(s)) {
    if (p.hp >= maxHp(p) && !p.downed) continue;
    if (p.downed) stabilize(p);
    p.hp = Math.min(maxHp(p), p.hp + hp);
    personFx(s, p.id, 'heal');
    n++;
  }
  return n;
}

const cheer = (s: GameState, n: number) => home(s).forEach((p) => (p.morale = Math.min(100, p.morale + n)));

/** A new townsperson, raised or built or charmed, at the camp. */
function newcomer(s: GameState, rng: Rng, type: string, how: string): Person {
  const p = makePerson(rng, s.nextId++, type, campXY(s), s.people.map((q) => q.name));
  s.people.push(p);
  joinOrigin(s, p, rng);
  notify(s, `${p.name} ${how}`, true);
  return p;
}

const give = (s: GameState, stock: Stock) => depositNear(s, campX(s), stock);
const list = (st: Stock) =>
  (Object.entries(st) as [Material, number][])
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`)
    .join(', ');

/* ------------------------------------------------------------ every power */

export const POWERS: Record<string, PowerDef> = {
  // Lich
  raise_dead: {
    id: 'raise_dead',
    name: 'Raise Dead',
    description: 'Bone and a word of command: a new townsperson rises, one of the dead.',
    cooldown: 12,
    costs: [{ bone: 6 }],
    when: (s) => !townFull(s),
    cast: (s, rng) => newcomer(s, rng, rng.pick(['gatherer', 'crafter', 'hunter', 'wanderer']), 'rises from the grave, ready to work.').name + ' was raised.',
  },
  bone_ward: {
    id: 'bone_ward',
    name: 'Bone Ward',
    description: 'Walls mend themselves, and a ward of bone turns blows aside for a while.',
    cooldown: 24,
    costs: [{ bone: 4 }],
    lasts: 3,
    when: (s) => raidOn(s) || s.buildings.some((b) => b.status === 'done' && b.hp !== undefined && b.hp < (BUILDING_BY_ID[b.def].hp ?? 0)),
    cast: (s) => {
      for (const b of s.buildings) if (b.status === 'done' && b.hp !== undefined) b.hp = BUILDING_BY_ID[b.def].hp ?? b.hp;
      return 'The walls knit, and a ward of bone rises.';
    },
  },
  drain_life: {
    id: 'drain_life',
    name: 'Drain Life',
    description: 'In a raid: the raiders wither, and their life flows into the town.',
    cooldown: 8,
    when: raidOn,
    cast: (s) => {
      const fell = strike(s, 25, 'blood');
      healAll(s, 15);
      return `Life drained from the raiders${fell ? `: ${fell} fell` : ''}.`;
    },
  },
  // Druid
  call_rain: {
    id: 'call_rain',
    name: 'Call Rain',
    description: 'Rain on the fields: crops grow half again as fast for half a day, even in a drought.',
    cooldown: 48,
    costs: [{ herbs: 3 }],
    lasts: 12,
    when: (s) => s.buildings.some((b) => b.crop?.stage === 'growing'),
    cast: () => 'Rain falls on the fields.',
  },
  entangle: {
    id: 'entangle',
    name: 'Entangle',
    description: 'In a raid: roots and vines hold the raiders fast, and two walking mushrooms wake to fight.',
    cooldown: 8,
    when: raidOn,
    cast: (s) => {
      for (const r of foes(s)) r.cooldown += 15 * TICK_HZ;
      // and the grove's walking mushrooms wake to fight for it
      const f = founder(s);
      const x = f?.x ?? campX(s);
      for (let i = 0; i < 2; i++) s.raid!.raiders.push(ally(s, 'shroom_folk', x + (i ? 16 : -16), f?.dir ?? 1, f?.y));
      return `Roots burst up and hold ${foes(s).length} raiders fast, and the mushrooms walk.`;
    },
  },
  bloom: {
    id: 'bloom',
    name: 'Bloom',
    description: 'The fields leap up: every growing crop is brought on a good way.',
    cooldown: 36,
    costs: [{ herbs: 2 }],
    when: (s) => s.buildings.some((b) => b.crop?.stage === 'growing'),
    cast: (s) => {
      let n = 0;
      for (const b of s.buildings) {
        if (b.crop?.stage !== 'growing') continue;
        const c = cropOf(b);
        c.growth = Math.min(0.999, c.growth + 0.4);
        n++;
      }
      return `${n} field${n === 1 ? '' : 's'} burst into growth.`;
    },
  },
  // Vampire
  mesmerize: {
    id: 'mesmerize',
    name: 'Mesmerise',
    description: 'In a raid: a gaze, and two raiders turn to fight for the town.',
    cooldown: 10,
    when: (s) => foes(s).some((r) => !ENEMIES[r.kind].boss),
    cast: (s) => {
      const turned = foes(s)
        .filter((r) => !ENEMIES[r.kind].boss)
        .slice(0, 2);
      for (const r of turned) {
        r.ally = true;
        r.conjuredAt = s.tick;
      }
      return `${turned.length} raider${turned.length === 1 ? '' : 's'} fell under the lord's gaze.`;
    },
  },
  blood_feast: {
    id: 'blood_feast',
    name: 'Blood Feast',
    description: 'The lord feeds on a willing thrall: healed and sated, and the court basks in it.',
    cooldown: 24,
    when: (s) => home(s).some((p) => p.id !== s.mainId && !p.monster && p.hp > 30),
    cast: (s) => {
      const lord = founder(s);
      const thrall = home(s)
        .filter((p) => p.id !== s.mainId && !p.monster)
        .sort((a, b) => b.hp - a.hp)[0];
      if (lord) {
        lord.hp = maxHp(lord);
        lord.lastFed = s.tick;
      }
      if (thrall) thrall.hp = Math.max(1, thrall.hp - 8);
      cheer(s, 5);
      return `The lord fed on ${thrall?.name ?? 'a thrall'}, and the court is content.`;
    },
  },
  night_terror: {
    id: 'night_terror',
    name: 'Night Terror',
    description: 'In a raid at night: terror takes the raiders, and they run.',
    cooldown: 12,
    when: (s) => raidOn(s) && night(s),
    cast: (s) => {
      let n = 0;
      for (const r of foes(s)) {
        if (ENEMIES[r.kind].boss) continue;
        r.fleeing = true;
        n++;
      }
      return `${n} raiders fled in terror into the night.`;
    },
  },
  // Werewolf
  howl: {
    id: 'howl',
    name: 'Howl',
    description: 'In a raid: the pack answers, and three wolves fight for the town.',
    cooldown: 10,
    when: raidOn,
    cast: (s) => {
      const f = founder(s);
      const x = f?.x ?? campX(s);
      for (let i = 0; i < 3; i++) s.raid!.raiders.push(ally(s, 'wolf', x + (i - 1) * 20, f?.dir ?? 1, f?.y));
      return 'The founder howled, and the pack came running.';
    },
  },
  pack_hunt: {
    id: 'pack_hunt',
    name: 'Pack Hunt',
    description: 'The pack runs down game in the hills: meat and hides.',
    cooldown: 20,
    when: () => true,
    cast: (s) => {
      const got: Stock = { meat: 10, hide: 3 };
      give(s, got);
      return `The pack brought home ${list(got)}.`;
    },
  },
  moon_frenzy: {
    id: 'moon_frenzy',
    name: 'Moon Frenzy',
    description: 'Under a full moon (or in a raid): everyone works and fights with a wild strength for a while.',
    cooldown: 36,
    lasts: 8,
    when: (s) => fullMoon(s) || raidOn(s),
    cast: () => 'The moon frenzy takes the town.',
  },
  // Machine Colony
  assemble: {
    id: 'assemble',
    name: 'Assemble',
    description: 'A new unit is built: from ship salvage while it lasts, then from iron, or stone and wood.',
    cooldown: 12,
    costs: [{ alloys: 2, circuits: 1 }, { iron: 4, stone: 10 }, { stone: 18, wood: 10 }],
    when: (s) => !townFull(s),
    cast: (s, rng) => newcomer(s, rng, rng.pick(['gatherer', 'crafter', 'hunter', 'wanderer']), 'comes online.').name + ' was assembled.',
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    description: 'Every unit runs half again as fast for six hours.',
    cooldown: 48,
    lasts: 6,
    when: (s) => s.buildings.some((b) => b.status === 'blueprint') || s.research.queue.length > 0,
    cast: () => 'Every unit is overclocked.',
  },
  repair_swarm: {
    id: 'repair_swarm',
    name: 'Repair Swarm',
    description: 'Tiny machines mend every damaged unit.',
    cooldown: 16,
    costs: [{ stone: 4 }],
    when: (s) => hurt(s).length > 0,
    cast: (s) => `The swarm repaired ${healAll(s, 999)} units.`,
  },
  // Dwarves
  deep_delve: {
    id: 'deep_delve',
    name: 'Deep Delve',
    description: 'A day in the deeps brings up stone, flint and clay (and ore, once the town knows iron).',
    cooldown: 24,
    when: () => true,
    cast: (s) => {
      const got: Stock = { stone: 20, flint: 6, clay: 6, ...(s.era !== 'neolithic' ? { iron_ore: 4 } : {}) };
      give(s, got);
      return `The delvers came up with ${list(got)}.`;
    },
  },
  forge_blessing: {
    id: 'forge_blessing',
    name: 'Forge Blessing',
    description: 'For half a day, everything made comes out two grades finer.',
    cooldown: 48,
    lasts: 12,
    when: (s) => s.crafting.length > 0,
    cast: () => 'The forge is blessed.',
  },
  stone_skin: {
    id: 'stone_skin',
    name: 'Stone Skin',
    description: 'In a raid: skin like granite; blows land softer.',
    cooldown: 12,
    lasts: 3,
    when: raidOn,
    cast: () => 'Skin turns to stone.',
  },
  // Merfolk
  tide_call: {
    id: 'tide_call',
    name: 'Tide Call',
    description: 'The tide brings in a catch of fish.',
    cooldown: 18,
    when: () => true,
    cast: (s) => {
      const got: Stock = { meat: 12 };
      give(s, got);
      return 'The tide brought in a catch of fish.';
    },
  },
  whirlpool: {
    id: 'whirlpool',
    name: 'Whirlpool',
    description: 'In a raid: the water rises and drags at the raiders.',
    cooldown: 10,
    when: raidOn,
    cast: (s) => {
      const fell = strike(s, 20, 'shock');
      return `A whirlpool dragged at the raiders${fell ? `: ${fell} went under` : ''}.`;
    },
  },
  sea_fog: {
    id: 'sea_fog',
    name: 'Sea Fog',
    description: 'Raiders on the way: a fog rolls in, and they lose hours finding the town.',
    cooldown: 24,
    when: (s) => s.raid?.phase === 'warning',
    cast: (s) => {
      s.raid!.arrivesTick += 2 * TICKS_PER_HOUR;
      return 'A sea fog rolled in: the raiders are lost in it.';
    },
  },
  // Nomads
  trade_road: {
    id: 'trade_road',
    name: 'Trade Road',
    description: 'Word goes down the road: for half a day, travellers come three times as often.',
    cooldown: 48,
    lasts: 12,
    when: (s) => !!shopOf(s) || !!tavernOf(s),
    cast: () => 'Word went down the trade road.',
  },
  swift_riders: {
    id: 'swift_riders',
    name: 'Swift Riders',
    description: 'Riders speed every party on its way.',
    cooldown: 24,
    when: (s) => s.expeditions.some((e) => e.phase !== 'work' && !e.battle),
    cast: (s) => {
      for (const e of s.expeditions) {
        if (e.phase === 'work' || e.battle) continue;
        const len = e.phase === 'out' ? e.outTicks : e.backTicks;
        e.elapsed = Math.min(len - 1, e.elapsed + Math.round(len * 0.4));
      }
      return 'Riders sped the parties on their way.';
    },
  },
  scouting: {
    id: 'scouting',
    name: 'Scouting Party',
    description: 'Scouts ride out and learn a place the town has never been.',
    cooldown: 72,
    when: (s) => DESTINATIONS.some((d) => destinationUnlocked(s, d) && !s.scouted.includes(d.id)),
    cast: (s) => {
      const d = DESTINATIONS.find((q) => destinationUnlocked(s, q) && !s.scouted.includes(q.id))!;
      s.scouted.push(d.id);
      return `Scouts came back knowing the ${d.name}.`;
    },
  },
  // Fae
  glamour: {
    id: 'glamour',
    name: 'Glamour',
    description: 'For eight hours, strangers are charmed into spending twice as much.',
    cooldown: 36,
    lasts: 8,
    when: (s) => !!shopOf(s) || !!tavernOf(s),
    cast: () => 'A glamour settles over the town.',
  },
  changeling: {
    id: 'changeling',
    name: 'Changeling',
    description: 'A charmed traveller forgets the road, and stays.',
    cooldown: 60,
    when: (s) => (s.travellers ?? []).some((t) => t.phase === 'shopping') && housingCapacity(s) > s.people.length && !townFull(s),
    cast: (s, rng) => {
      const t = (s.travellers ?? []).find((q) => q.phase === 'shopping')!;
      s.travellers = (s.travellers ?? []).filter((q) => q !== t);
      const p = newcomer(s, rng, 'wanderer', 'forgot the road, and stays in the glade.');
      p.name = t.name.split(' ')[0];
      p.look = { ...t.look };
      return `${t.name} was charmed into staying.`;
    },
  },
  faerie_ring: {
    id: 'faerie_ring',
    name: 'Faerie Ring',
    description: 'A night dancing in the ring: everyone is healed, and in high spirits.',
    cooldown: 24,
    when: (s) => hurt(s).length > 0 || home(s).some((p) => p.morale < 40),
    cast: (s) => {
      healAll(s, 20);
      cheer(s, 8);
      return 'The town danced in the faerie ring.';
    },
  },
  // Alchemists
  transmute: {
    id: 'transmute',
    name: 'Transmute',
    description: 'Base stone into something better: coins (once there\'s a shop), or flint and clay.',
    cooldown: 24,
    costs: [{ stone: 15 }],
    when: () => true,
    cast: (s) => {
      if (shopOf(s)) {
        s.coins = (s.coins ?? 0) + 20;
        return 'Stone into gold: 20 coins.';
      }
      const got: Stock = { flint: 6, clay: 6 };
      give(s, got);
      return `Stone into ${list(got)}.`;
    },
  },
  elixir: {
    id: 'elixir',
    name: 'Elixir',
    description: 'A draught for everyone: wounds close, sickness passes, spirits lift.',
    cooldown: 24,
    costs: [{ herbs: 4 }],
    when: (s) => hurt(s).length > 0 || home(s).some((p) => p.sick),
    cast: (s) => {
      healAll(s, 25);
      for (const p of home(s)) p.sick = null;
      cheer(s, 5);
      return 'The elixir went round.';
    },
  },
  volatile_flask: {
    id: 'volatile_flask',
    name: 'Volatile Flask',
    description: 'In a raid: a flask thrown among the raiders.',
    cooldown: 8,
    when: raidOn,
    cast: (s) => {
      const target = foes(s)[0];
      if (target) (s.impacts ??= []).push({ tick: s.tick, x: target.x });
      const fell = strike(s, 30, 'fire');
      return `The flask burst among the raiders${fell ? `: ${fell} fell` : ''}.`;
    },
  },
  // Knights
  rally: {
    id: 'rally',
    name: 'Rally',
    description: 'In a raid: a war cry, and everyone fights harder for a while.',
    cooldown: 10,
    lasts: 2,
    when: raidOn,
    cast: (s) => {
      cheer(s, 5);
      return 'The order rallied to the banner.';
    },
  },
  shield_wall: {
    id: 'shield_wall',
    name: 'Shield Wall',
    description: 'In a raid: shields locked, and blows land softer.',
    cooldown: 12,
    lasts: 2,
    when: raidOn,
    cast: () => 'Shields locked into a wall.',
  },
  oath: {
    id: 'oath',
    name: 'Oath of Mending',
    description: 'The oath is spoken over the fallen: the downed are saved, the hurt healed.',
    cooldown: 24,
    when: (s) => hurt(s).length > 0,
    cast: (s) => `The oath was spoken over ${healAll(s, 20)} of the order.`,
  },
};

/* ------------------------------------------------------------ calling on them */

/** The first of a power's costs the town can pay, or null (a power with no cost is free). */
function payable(s: GameState, p: PowerDef): Stock | null {
  if (!p.costs) return {};
  const stock = totalStock(s);
  return p.costs.find((c) => (Object.entries(c) as [Material, number][]).every(([m, n]) => (stock[m] ?? 0) >= n)) ?? null;
}

function pay(s: GameState, cost: Stock): void {
  for (const [m, n] of Object.entries(cost) as [Material, number][]) {
    let left = n;
    for (const b of storages(s)) {
      const k = Math.min(left, b.store[m] ?? 0);
      if (k <= 0) continue;
      addStock(b.store, m, -k);
      left -= k;
    }
  }
}

/** What each power is seen to touch, for its look (see renderer/town/spellsView.ts), and how long the look lasts. */
type Touch = 'foes' | 'home' | 'hurt' | 'defenders' | 'fields' | 'newest' | 'walls' | 'venue' | 'caster';
const TOUCH: Record<string, [Touch, number]> = {
  raise_dead: ['newest', 2.5], bone_ward: ['defenders', 3], drain_life: ['foes', 2],
  call_rain: ['fields', 5], entangle: ['foes', 4], bloom: ['fields', 2.5],
  mesmerize: ['foes', 3], blood_feast: ['home', 2], night_terror: ['foes', 3],
  howl: ['caster', 2], pack_hunt: ['caster', 2], moon_frenzy: ['home', 3],
  assemble: ['newest', 2.5], overclock: ['home', 3], repair_swarm: ['hurt', 2.5],
  deep_delve: ['caster', 2], forge_blessing: ['caster', 2.5], stone_skin: ['defenders', 3],
  tide_call: ['caster', 3], whirlpool: ['foes', 3], sea_fog: ['caster', 5],
  trade_road: ['venue', 2.5], swift_riders: ['caster', 2], scouting: ['caster', 2],
  glamour: ['venue', 3], changeling: ['newest', 2.5], faerie_ring: ['home', 3],
  transmute: ['caster', 2.5], elixir: ['hurt', 2.5], volatile_flask: ['foes', 2],
  rally: ['defenders', 2.5], shield_wall: ['defenders', 3], oath: ['hurt', 2.5],
};

function touched(s: GameState, touch: Touch): SpellTarget[] {
  const person = (p: Person): SpellTarget => ({ x: p.x, y: p.y, id: p.id });
  switch (touch) {
    case 'foes':
      return foes(s).filter((r) => r.x >= 0 && r.x <= WORLD_WIDTH).map((r) => ({ x: r.x, y: r.y, id: r.id, raider: true }));
    case 'home':
      return home(s).map(person);
    case 'hurt':
      return (hurt(s).length ? hurt(s) : home(s)).map(person);
    case 'defenders': {
      const d = home(s).filter((p) => p.task?.type === 'defend');
      return (d.length ? d : home(s)).map(person);
    }
    case 'fields':
      return s.buildings.filter((b) => b.crop?.stage === 'growing').map((b) => ({ x: buildingCentreX(b), y: buildingCentre(b).y }));
    case 'newest':
      return s.people.length ? [person(s.people[s.people.length - 1])] : [];
    case 'walls':
      return s.buildings.filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def].hp).map((b) => ({ x: buildingCentreX(b), y: buildingCentre(b).y }));
    case 'venue': {
      const v = shopOf(s) ?? tavernOf(s);
      return v ? [{ x: buildingCentreX(v), y: buildingCentre(v).y }] : [];
    }
    case 'caster':
      return [];
  }
}

/** Who calls on the town's powers: the founder, when at home; else the camp. */
function casterOf(s: GameState): SpellTarget {
  const f = founder(s);
  return f && f.away === null ? { x: f.x, y: f.y, id: f.id } : { x: campX(s), y: campXY(s).y };
}

/** The town calls on its powers when the moment's right: once a second in a raid, else once a game hour. */
export function castPowers(s: GameState, rng: Rng): void {
  const all = originOf(s).powers;
  if (!all.length || s.gameOver) return;
  if (!(s.raid?.phase === 'active' ? s.tick % TICK_HZ === 0 : s.tick % TICKS_PER_HOUR === 0)) return;
  for (const id of all) {
    // (the one the player holds back is theirs to cast: castHeld)
    if (id === s.heldPower) continue;
    const p = POWERS[id];
    if (!p || (s.powers?.[id] ?? 0) > s.tick || !p.when(s)) continue;
    // on the battle map a spell that strikes raiders is aimed: by the player in their own battle, else by the town,
    // where they're most bunched
    if (inBattle(s) && TOUCH[id]?.[0] === 'foes') {
      const b = s.raid!.battle!;
      const at = b.auto ? bestAim(s) : null;
      if (at) castAt(s, id, rng, at);
      continue;
    }
    castPower(s, id, rng);
  }
}

/** Cast a power at a point on the battle map (the player's aim, or the town's). Returns whether it was cast. */
export function castAt(s: GameState, id: string, rng: Rng, at: [number, number]): boolean {
  const b = s.raid?.battle;
  if (!b || !originOf(s).powers.includes(id) || (s.powers?.[id] ?? 0) > s.tick) return false;
  b.aim = at;
  const ok = castPower(s, id, rng);
  b.aim = undefined;
  if (ok) (b.casts ??= []).push({ at, power: id, tick: s.tick });
  return ok;
}

/** Cast one of the town's powers now, if it can be paid for. Returns whether it was cast. */
function castPower(s: GameState, id: string, rng: Rng): boolean {
  const p = POWERS[id];
  const cost = p && payable(s, p);
  if (!cost) return false;
  pay(s, cost);
  // (what it's aimed at is taken before it strikes: the fallen are still on the field; newcomers after)
  const [touch, secs] = TOUCH[id] ?? ['caster', 2];
  const aimed = touch === 'newest' ? [] : touched(s, touch);
  const text = p.cast(s, rng);
  castSpellFx(s, `town:${id}`, casterOf(s), touch === 'newest' ? touched(s, touch) : aimed, secs);
  const lore = researchMods(s.research); // (heritage research brings powers back sooner, and makes them last)
  (s.powers ??= {})[id] = s.tick + Math.round(p.cooldown * lore.powerRecharge * TICKS_PER_HOUR);
  if (p.lasts) (s.buffs ??= {})[id] = s.tick + Math.round(p.lasts * lore.powerLasts * TICKS_PER_HOUR);
  const log = (s.powerLog ??= []);
  log.push({ tick: s.tick, text: `${p.name}: ${text}` });
  if (log.length > 10) log.splice(0, log.length - 10);
  notify(s, `${p.name}! ${text}`);
  return true;
}

/** Hold a power back for the player to cast themselves (null: the town casts them all). */
export function holdPower(s: GameState, id: string | null): void {
  if (id !== null && !originOf(s).powers.includes(id)) return;
  s.heldPower = id ?? undefined;
}

/** The player casts the power they held back, when it's ready (whenever they like: a raid is what it's for). */
export function castHeld(s: GameState, rng: Rng): boolean {
  const id = s.heldPower;
  if (!id || (s.powers?.[id] ?? 0) > s.tick) return false;
  return castPower(s, id, rng);
}

/** For the Plan tab: each of the origin's powers, when it's ready, and whether it's in effect. */
export function powersView(s: GameState): { id: string; name: string; description: string; readyHours: number; activeHours: number; held: boolean; affordable: boolean }[] {
  return originOf(s).powers.map((id) => {
    const p = POWERS[id];
    return {
      id,
      held: s.heldPower === id,
      affordable: !!payable(s, p),
      name: p.name,
      description: p.description + (p.costs ? ` (${p.costs.map(list).join(', or ')})` : ''),
      readyHours: Math.max(0, ((s.powers?.[id] ?? 0) - s.tick) / TICKS_PER_HOUR),
      activeHours: Math.max(0, ((s.buffs?.[id] ?? 0) - s.tick) / TICKS_PER_HOUR),
    };
  });
}

/** The origin's powers that strike raiders (aimed on the battle map), and when each is ready (real seconds). */
export function aimableSpells(s: GameState): { id: string; name: string; readyIn: number; affordable: boolean }[] {
  return originOf(s)
    .powers.filter((id) => TOUCH[id]?.[0] === 'foes' && POWERS[id])
    .map((id) => ({ id, name: POWERS[id].name, readyIn: Math.max(0, ((s.powers?.[id] ?? 0) - s.tick) / TICK_HZ), affordable: !!payable(s, POWERS[id]) }));
}
