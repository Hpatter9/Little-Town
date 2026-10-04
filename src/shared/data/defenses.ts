// Tower defence, deeper (the owner's request): traps and engines for every era, and one piece of each origin's own.
// A piece is a building with `defense` (data/buildings.ts): what it hits and how often, and its quirks (sim/defenses.ts
// applies them in the town and on the battle map): `splash` hurts everyone within so many px of the one struck (half
// as hard), `slow` takes that share of a raider's speed for SLOW_SECONDS, `burn` goes on hurting for BURN_SECONDS,
// `chain` leaps to that many more raiders near the first, `night` multiplies the blow after dark, `rout` is the chance
// the one struck loses heart and runs. Traps (layer `fore`, a short range) bite where the trail crosses them; towers
// cover the trail from where they stand.
import type { BuildingDef } from './buildings';
import type { OriginId } from './origins';

/** How long a slow holds and a burn goes on (seconds), and a burning raider's share of the blow each second. */
export const SLOW_SECONDS = 4;
export const BURN_SECONDS = 4;
/** A splash's victims beside the one struck take this share. */
export const SPLASH_SHARE = 0.5;
/** A chained bolt's later targets take this share, each less than the last. */
export const CHAIN_SHARE = 0.7;
/** How far (px) a chained bolt leaps, and a trap's bite reaches on the trail. */
export const CHAIN_REACH = 64;

type D = BuildingDef['defense'] & object;
const piece = (id: string, name: string, layer: 'fore' | 'mid', cost: BuildingDef['cost'], seconds: number, purpose: string, research: string | undefined, defense: D, more: Partial<BuildingDef> = {}): BuildingDef => ({
  id,
  name,
  layer,
  width: 1,
  cost,
  buildSeconds: seconds,
  purpose,
  ...(research ? { research } : {}),
  defense,
  ...more,
});

/** The eras' engines and traps. */
export const DEFENSE_BUILDINGS: BuildingDef[] = [
  // the Stone Age: Trapmaking
  piece('pit_trap', 'Pit Trap', 'fore', { wood: 8, fiber: 4 }, 50, 'A covered pit on the way in: raiders who fall in are hurt and slowed.', 'trapmaking', { damage: [4, 8], range: 16, interval: 4, accuracy: 0.85, slow: 0.5 }),
  // the Medieval age: Fortification and Siege Engines
  piece('caltrops', 'Caltrops', 'fore', { iron: 4 }, 40, 'Iron spikes strewn across the way: every raider crossing them limps.', 'fortification', { damage: [2, 5], range: 16, interval: 2, accuracy: 0.9, slow: 0.4 }),
  piece('boiling_oil', 'Boiling Oil', 'mid', { stone: 12, iron: 4, wood: 8 }, 160, 'A cauldron on a frame by the way in: oil poured on those below burns a knot of them.', 'fortification', { damage: [8, 14], range: 70, interval: 8, accuracy: 0.8, splash: 40, burn: 3 }),
  piece('ballista', 'Ballista', 'mid', { lumber: 16, iron: 8, fiber: 6 }, 220, 'A great crossbow on a mount: its bolt goes through one raider and on into the next.', 'siege_engines', { damage: [18, 28], range: 220, interval: 4, accuracy: 0.75, chain: 1 }),
  piece('catapult', 'Catapult', 'mid', { lumber: 20, iron: 6, stone: 10 }, 260, 'Hurls stones far down the trail: slow to wind, and everyone where the stone lands feels it.', 'siege_engines', { damage: [14, 22], range: 260, interval: 6, accuracy: 0.6, splash: 48 }),
  // the Industrial age: Firearms
  piece('cannon', 'Cannon', 'mid', { steel: 14, lumber: 10, coal: 8 }, 300, 'Grapeshot down the trail: slow to load, and it tears through a crowd.', 'firearms', { damage: [20, 30], range: 240, interval: 5, accuracy: 0.65, splash: 56 }),
  piece('land_mine', 'Land Mine', 'fore', { steel: 4, coal: 6 }, 90, 'Buried where the raiders walk: one great blast, then a long while to lay another.', 'firearms', { damage: [40, 60], range: 16, interval: 60, accuracy: 0.9, splash: 40 }),
  // the Modern age: Rifles
  piece('flame_turret', 'Flame Turret', 'fore', { steel: 10, electronics: 2, fuel: 6 }, 200, 'A jet of burning fuel: short reach, and those it touches keep burning.', 'rifles', { damage: [8, 12], range: 110, interval: 2, accuracy: 0.8, splash: 36, burn: 6 }),
  piece('mortar_pit', 'Mortar Pit', 'fore', { concrete: 10, steel: 8, electronics: 2 }, 240, 'Shells lobbed far down the trail: slow, wide, and heavy.', 'rifles', { damage: [24, 36], range: 300, interval: 6, accuracy: 0.55, splash: 70 }),
  // the Space age: Energy Weapons
  piece('tesla_coil', 'Tesla Coil', 'mid', { alloys: 8, circuits: 4, power_cells: 6 }, 280, 'Lightning that leaps from raider to raider.', 'energy_weapons', { damage: [18, 26], range: 160, interval: 2, accuracy: 0.9, chain: 3 }),
];

/** Each origin's own piece: theirs alone, from the Medieval age. */
const own = (origin: OriginId, id: string, name: string, layer: 'fore' | 'mid', cost: BuildingDef['cost'], seconds: number, purpose: string, defense: D): BuildingDef =>
  piece(id, name, layer, cost, seconds, purpose, undefined, defense, { origin, era: 'medieval' });

export const ORIGIN_DEFENSES: BuildingDef[] = [
  own('settlers', 'militia_post', 'Militia Post', 'mid', { lumber: 10, stone: 8, hide: 4 }, 150, 'A roofed stand where the militia keep their bows: steady fire at whatever comes.', { damage: [7, 11], range: 160, interval: 2.2, accuracy: 0.72 }),
  own('lich', 'bone_spire', 'Bone Spire', 'mid', { bone: 20, stone: 8 }, 180, 'A spire of fused bone that flings shards: each passes through one raider into the next.', { damage: [9, 14], range: 170, interval: 2.4, accuracy: 0.72, chain: 1 }),
  own('druid', 'bramble_snare', 'Bramble Snare', 'fore', { wood: 6, herbs: 4, fiber: 4 }, 60, 'Living brambles across the way that grip whoever treads in them.', { damage: [3, 6], range: 16, interval: 3, accuracy: 0.9, slow: 0.7 }),
  own('vampire', 'gargoyle_perch', 'Gargoyle Perch', 'mid', { stone: 20, iron: 4 }, 200, 'A gargoyle that wakes at dusk: by night it strikes twice as hard.', { damage: [8, 14], range: 160, interval: 2.2, accuracy: 0.72, night: 2 }),
  own('werewolf', 'wolf_trap', 'Wolf Trap', 'fore', { iron: 6, wood: 4 }, 70, 'Iron jaws under the leaves: whoever steps in them is held fast and bleeds.', { damage: [10, 16], range: 16, interval: 8, accuracy: 0.85, slow: 1 }),
  own('robot', 'sentry_bot', 'Sentry Bot', 'mid', { alloys: 6, circuits: 3, iron: 6 }, 160, 'A squat machine that never sleeps and never stops shooting.', { damage: [6, 9], range: 160, interval: 0.8, accuracy: 0.75 }),
  own('dwarves', 'rune_bolt_thrower', 'Rune Bolt Thrower', 'mid', { stone: 16, iron: 12, lumber: 8 }, 220, 'A bolt thrower cut with runes: slow, and nothing it hits stays standing.', { damage: [20, 30], range: 210, interval: 3.5, accuracy: 0.8 }),
  own('merfolk', 'tide_pool_trap', 'Tide Pool Trap', 'fore', { stone: 8, fiber: 6 }, 70, 'A pool that floods the way at a tug of the rope: everyone near it is swept off their feet.', { damage: [4, 8], range: 16, interval: 5, accuracy: 0.85, splash: 40, slow: 0.6 }),
  own('nomads', 'arrow_wagon', 'Arrow Wagon', 'mid', { wood: 14, hide: 6, fiber: 6 }, 140, 'A wagon loaded with bows and arrows that goes where the camp goes.', { damage: [7, 12], range: 170, interval: 1.8, accuracy: 0.7 }),
  own('fae', 'glamour_ring', 'Glamour Ring', 'fore', { herbs: 8, fiber: 4 }, 60, 'A ring of toadstools that turns raiders about: some who cross it lose heart and run.', { damage: [0, 2], range: 16, interval: 6, accuracy: 1, rout: 0.35 }),
  own('alchemists', 'acid_sprayer', 'Acid Sprayer', 'mid', { iron: 8, glass: 4, herbs: 6 }, 170, 'A pump of acid that sprays a knot of raiders and eats at them after.', { damage: [6, 10], range: 120, interval: 2.5, accuracy: 0.8, splash: 36, burn: 4 }),
  own('knights', 'crossbow_bastion', 'Crossbow Bastion', 'mid', { stone: 20, iron: 8, lumber: 8 }, 220, 'A squat stone bastion of crossbowmen: long shots that punch through mail.', { damage: [14, 20], range: 200, interval: 2.8, accuracy: 0.8 }),
];

export const DEFENSE_IDS = new Set([...DEFENSE_BUILDINGS, ...ORIGIN_DEFENSES].map((d) => d.id));
