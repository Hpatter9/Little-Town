// The Moon Pack's road (the owner's design): a werewolf town is a pack, and its standing is its renown. Renown comes of
// full-moon hunts, beast raids beaten, lairs cleared on the land and rival packs broken. Three rival packs hold the
// hills: they raid at the full moon, and a war party the player picks can break one (its survivors join, its lair
// becomes a hunting ground). Once every pack is broken and the Great Beast has fallen in a full-moon hunt, the land is
// the pack's and the game is won: the Great Hunt. The sim is sim/pack.ts.
import type { Destination } from './expeditions';
import type { EnemyDef } from './enemies';
import type { RaidKind } from './raids';
import { PACK_SHEETS, type PackSheetId } from './packSheets';

export interface RivalPackDef {
  id: string;
  /** "the Ash Pack". */
  name: string;
  /** Its alpha's name and enemy id. */
  alpha: string;
  alphaId: string;
  /** Its lair, and where it lies. */
  lair: string;
  where: string;
  /** Who runs with it (a war party meets these, and its alpha). */
  foes: Record<string, number>;
  /** 1 to 3: how hard it is, how far its lair, how big its raids. */
  strength: 1 | 2 | 3;
}

export const RIVAL_PACKS: readonly RivalPackDef[] = [
  { id: 'ash', name: 'the Ash Pack', alpha: 'Grimfang', alphaId: 'ash_alpha', lair: 'the Ash Hollow', where: 'the burnt hills to the west', foes: { black_werewolf: 2, wolf: 3 }, strength: 1 },
  { id: 'redfang', name: 'the Red Fang', alpha: 'Scarmaw', alphaId: 'redfang_alpha', lair: 'Bloodthorn Ridge', where: 'the ridges to the east', foes: { blood_werewolf: 3, wolf_alpha: 1, wolf: 2 }, strength: 2 },
  { id: 'winter', name: 'the Winter Wolves', alpha: 'Hoarfrost', alphaId: 'winter_alpha', lair: 'the Frost Cairn', where: 'the high snows to the north', foes: { silver_werewolf: 3, blood_werewolf: 1, wolf_alpha: 2 }, strength: 3 },
];
export const RIVAL_PACK_BY_ID: Readonly<Record<string, RivalPackDef>> = Object.fromEntries(RIVAL_PACKS.map((p) => [p.id, p]));

/** The Great Beast the hunt is for, once the pack's name is known. */
export const GREAT_BEAST = 'great_beast';

const sprite = (sheet: PackSheetId, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });

/** The rival alphas and the Great Beast (merged into ENEMIES). */
export const PACK_BOSSES: Record<string, EnemyDef> = {
  ash_alpha: { id: 'ash_alpha', name: 'Grimfang, Alpha of the Ash Pack', hp: 260, damage: [11, 17], accuracy: 0.76, dodge: 0.18, interval: 1.0, ranged: false, boss: true, loot: { hide: 3, meat: 2 }, sprite: sprite('werewolf_black', 64), look: { bright: 0.85 } },
  redfang_alpha: { id: 'redfang_alpha', name: 'Scarmaw, Alpha of the Red Fang', hp: 340, damage: [13, 20], accuracy: 0.78, dodge: 0.18, interval: 1.0, ranged: false, boss: true, loot: { hide: 4, meat: 3 }, sprite: sprite('werewolf_red', 66), look: { bright: 1.1 } },
  winter_alpha: { id: 'winter_alpha', name: 'Hoarfrost, Alpha of the Winter Wolves', hp: 440, damage: [15, 23], accuracy: 0.8, dodge: 0.2, interval: 1.0, ranged: false, boss: true, loot: { hide: 5, meat: 3 }, sprite: sprite('werewolf_white', 68), look: { bright: 1.2 } },
  great_beast: {
    id: GREAT_BEAST,
    name: 'The Pale Behemoth',
    hp: 900,
    damage: [18, 28],
    accuracy: 0.74,
    dodge: 0.02,
    interval: 1.8,
    ranged: false,
    boss: true,
    loot: { hide: 12, meat: 16, bone: 10 },
    sprite: { sheet: 'behemoth', block: 0, scale: 0.95 },
    look: { grey: true, bright: 1.45 },
    nature: 'beast',
    armor: 0.15,
  },
};

/** What each thing is worth to the pack's name. */
export const PACK_RENOWN = { hunt: 1, beastRaid: 2, lair: 3, pack: 6, beast: 10 } as const;
/** Renown at which the Great Beast shows itself to the hunt. */
export const GREAT_BEAST_RENOWN = 10;
/** Each broken pack's lair, a hunting ground: what it brings in every dawn. */
export const GROUNDS_YIELD = { meat: 4, hide: 2 } as const;
/** Renown's edge in a fight: this much more per point, up to the cap. */
export const RENOWN_FIGHT = 0.015;
export const RENOWN_FIGHT_MAX = 0.3;
/** Challenges to the Alpha: days between, the level edge a challenger needs, the chance one is made. */
export const CHALLENGE_GAP_DAYS = 6;
export const CHALLENGE_LEVEL_EDGE = 3;
export const CHALLENGE_CHANCE = 0.6;
/** A rival pack raids at the full moon this often (and never before this day). */
export const PACK_RAID_CHANCE = 0.5;
export const PACK_RAID_FROM_DAY = 3;
/** The hunt leaves at this hour of a full-moon night; this share of the pack stays to guard the den. */
export const HUNT_HOUR = 22;
export const HUNT_KEEP_HOME = 0.34;
/** The hunt runs with more than a party: this many at most. */
export const HUNT_PARTY = 8;

/** The full-moon hunt and the rival packs' lairs are destinations of their own (sim/pack.ts resolves them). */
export const HUNT_DEST = 'moon_hunt';
export const packDestId = (id: string) => `pack:${id}`;
export const isPackDest = (dest: string) => dest.startsWith('pack:');
export const packIdOf = (dest: string) => dest.slice(5);

/** The hunt: a night's run after game, and the Great Beast when the pack's name has reached it. */
export function huntDestination(beastDue: boolean): Destination {
  const groups: { enemies: Record<string, number>; weight: number }[] = [
    { enemies: { wolf: 3, boar: 2 }, weight: 3 },
    { enemies: { wolf_alpha: 1, wolf: 3 }, weight: 2 },
    { enemies: { boar: 4 }, weight: 2 },
  ];
  if (beastDue) groups.push({ enemies: { [GREAT_BEAST]: 1, wolf: 2 }, weight: 12 });
  return {
    id: HUNT_DEST,
    name: 'Full-Moon Hunt',
    type: 'hunt',
    outSeconds: 50,
    workSeconds: 80,
    secondsPerUnit: 5,
    loot: { meat: 8, hide: 4, bone: 2 },
    threats: beastDue ? 'The Great Beast is abroad tonight' : 'Whatever runs in the hills',
    encounters: { arrival: 0.9, ambush: 0.15, groups },
    recommendedParty: 8,
    scenery: 'woods',
    description: 'The pack runs under the full moon and brings down what it finds.',
  };
}

/** A rival pack's lair: a war party breaks the pack there, or doesn't come back. */
export function packDestination(def: RivalPackDef): Destination {
  return {
    id: packDestId(def.id),
    name: `${def.lair[0].toUpperCase()}${def.lair.slice(1)}`,
    type: 'clear',
    outSeconds: 160 + def.strength * 80,
    workSeconds: 30,
    secondsPerUnit: 8,
    loot: { hide: 4, meat: 4, bone: 2 },
    threats: `${def.name[0].toUpperCase()}${def.name.slice(1)}, and ${def.alpha} their alpha`,
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { ...def.foes, [def.alphaId]: 1 }, weight: 1 }] },
    recommendedParty: 5,
    scenery: 'cave',
    description: `The den of ${def.name}, in ${def.where}. Break them and their hills are the pack's hunting ground.`,
  };
}

/** The rival packs' raids (merged into RAID_KINDS; never rolled, only sent by sim/pack.ts at the full moon). */
export const PACK_RAIDS: RaidKind[] = RIVAL_PACKS.map((p) => ({
  id: `pack_${p.id}`,
  name: `${p.name[0].toUpperCase()}${p.name.slice(1)}`,
  goal: 'harm',
  goals: { harm: 4, kidnap: 1 },
  enemies: Object.fromEntries(Object.keys(p.foes).map((k) => [k, k === 'wolf' ? 8 : k === 'wolf_alpha' ? 18 : 16 + p.strength * 2])),
  fromDay: 0,
  weight: 0,
  speed: 52,
  bribable: false,
  plural: true,
  leader: p.alphaId,
}));
