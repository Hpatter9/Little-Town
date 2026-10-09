// The rising powers: three enemy powers in every realm, beside the rival peoples and the bandits (data/factions.ts).
// They aren't peoples a town can be founded as; they're threats that grow as the town does. The Shogunate of the
// Eastern Mists (ronin, shinobi and yokai under a shogun), the Black Tide Corsairs (sea raiders under an admiral) and
// the Infernal Host (imps, satyrs, gorgons, minotaurs and demons out of the Pit under a demon prince). Each is met a
// few days in, starts out ill-disposed, grows its troops and its town toward what the town itself has (`riseTarget`),
// fields better troops as the town reaches each age (`stageOf`), and has a move of its own (sim/risingPowers.ts):
// the Shogunate sends shinobi in by night and challenges the town's best to duels, the Corsairs seize trade wagons
// and come from the sea at a shore town, and the Infernal Host opens rifts on the land and offers bargains in blood.
// Numbers are starting points for tuning.

import type { EnemyDef } from './enemies';
import type { Era } from './eras';
import type { ItemDef } from './items';
import { PACK_SHEETS, type PackSheetId } from './packSheets';
import type { RaidKind } from './raids';
import type { RivalSpell } from './rivals';

export type RisingId = 'shogunate' | 'corsairs' | 'infernal';
export const RISING_IDS: readonly RisingId[] = ['shogunate', 'corsairs', 'infernal'];
export const isRising = (id: string): id is RisingId => (RISING_IDS as readonly string[]).includes(id);

/** When each is met (paced days), in this order. */
export const RISE_MEET_DAYS: Readonly<Record<RisingId, number>> = { shogunate: 5, corsairs: 9, infernal: 13 };
/** They start out ill-disposed: this much below their temper's rest. */
export const RISING_HOSTILITY = -25;

/** Growth with the town: each morning a rising power's troops close `RISE_CATCH` of the way to `RISE_TROOPS_BASE`
 *  plus `RISE_TROOPS_PER_MIGHT` a point of the town's might (never less than the usual daily gain); its folk close
 *  the same share on `RISE_FOLK_PER_HEAD` a townsperson plus `RISE_FOLK_BASE`. Broken in the field, they come back. */
export const RISE_TROOPS_BASE = 14;
export const RISE_TROOPS_PER_MIGHT = 1.6;
export const RISE_CATCH = 0.2;
export const RISE_FOLK_BASE = 12;
export const RISE_FOLK_PER_HEAD = 2.5;

/** Their armies by the town's age: the stage is the town's era (Stone Age 0, Medieval 1, Industrial and on 2). */
const STAGE_ERA: readonly Era[] = ['neolithic', 'medieval', 'industrial'];
export function stageOf(era: Era): number {
  const order: Era[] = ['neolithic', 'medieval', 'industrial', 'modern', 'space'];
  return Math.min(STAGE_ERA.length - 1, Math.max(0, order.indexOf(era)));
}

export interface RisingDef {
  id: RisingId;
  name: string;
  /** Its lord (an enemy id) and the lord's spells (sim/rivals.ts casts them like a rival lord's). */
  lord: string;
  spells: RivalSpell[];
  /** What it is called at each stage, and a line for the Realm card. */
  stageNames: [string, string, string];
  line: string;
  /** Its raid kinds by stage (ordinary raids and hosts), and by sea at a shore town (the Corsairs). */
  raids: [string, string, string];
  seaRaids?: [string, string, string];
}

export const RISING: Readonly<Record<RisingId, RisingDef>> = {
  shogunate: {
    id: 'shogunate',
    name: 'The Shogunate',
    lord: 'shogun_raizen',
    stageNames: ['a warlord\'s band', 'a daimyo\'s domain', 'the Shogunate of the Eastern Mists'],
    line: 'Ronin and shinobi under a shogun who means to rule every valley. They prize a duel above a war, and send their shadows in by night.',
    raids: ['shogun_0', 'shogun_1', 'shogun_2'],
    spells: [
      { id: 'shogun_banner', name: 'Banner of the Shogun', kind: 'frenzy', every: 20, power: 10, text: 'The shogun\'s banner goes up: his ronin charge as one!' },
      { id: 'smoke_bombs', name: 'Smoke Bombs', kind: 'fog', every: 24, power: 12, text: 'Smoke bombs burst across the town: the defenders can barely see!' },
      { id: 'shadow_clan', name: 'Shadow Clan', kind: 'summon', every: 30, power: 2, summons: 'kunoichi', text: 'Shinobi drop from the rooftops at the shogun\'s signal!' },
    ],
  },
  corsairs: {
    id: 'corsairs',
    name: 'The Black Tide Corsairs',
    lord: 'admiral_vask',
    stageNames: ['a pirate crew', 'a corsair fleet', 'the Black Tide'],
    line: 'Sea raiders who own the coasts and the roads beside them. They seize what travels and come up out of the sea at a shore town.',
    raids: ['corsairs_0', 'corsairs_1', 'corsairs_2'],
    seaRaids: ['corsairs_sea_0', 'corsairs_sea_1', 'corsairs_sea_2'],
    spells: [
      { id: 'broadside', name: 'Broadside', kind: 'storm', every: 12, power: 10, burns: true, text: 'A broadside of grapeshot rakes the town!' },
      { id: 'press_gang', name: 'Press Gang', kind: 'summon', every: 28, power: 2, summons: 'sea_reaver', text: 'Admiral Vask whistles up another boatload of reavers!' },
      { id: 'pillage', name: 'Pillage', kind: 'plunder', every: 30, power: 0.12, text: 'Corsairs break off to loot the treasury!' },
    ],
  },
  infernal: {
    id: 'infernal',
    name: 'The Infernal Host',
    lord: 'malphas',
    stageNames: ['a coven of imps', 'a legion of the Pit', 'the Infernal Host'],
    line: 'Things out of the Pit and the beasts that serve them, under a demon prince. They tear rifts in the land and offer bargains no one should take.',
    raids: ['infernal_0', 'infernal_1', 'infernal_2'],
    spells: [
      { id: 'hellfire', name: 'Hellfire', kind: 'storm', every: 12, power: 11, burns: true, text: 'Hellfire falls on the town!' },
      { id: 'soul_drain', name: 'Soul Drain', kind: 'drain', every: 14, power: 15, text: 'Malphas drinks the souls of the living!' },
      { id: 'open_the_pit', name: 'Open the Pit', kind: 'summon', every: 30, power: 3, summons: 'red_imp', text: 'The ground splits: imps pour out of the Pit!' },
      { id: 'despair', name: 'Despair', kind: 'dread', every: 40, power: 7, text: 'A whisper in every ear: it is hopeless. Spirits sink.' },
    ],
  },
};

/** The rising power behind a raid kind, if any. */
export function risingOfRaid(kind: string): RisingDef | undefined {
  return Object.values(RISING).find((r) => r.raids.includes(kind) || r.seaRaids?.includes(kind));
}
export const risingOfLeader = (enemy: string): RisingDef | undefined => Object.values(RISING).find((r) => r.lord === enemy);

/** Their raid kinds, each gated to its stage's ages (so only the stage's army comes). Weight is low: they come more
 *  at war (data/factions.ts `rivalRaidOdds`), never before they're met. */
const ages: readonly [Era, Era | undefined][] = [['neolithic', 'neolithic'], ['medieval', 'medieval'], ['industrial', undefined]];
function staged(id: string, name: string, armies: Record<string, number>[], o: Partial<RaidKind>): RaidKind[] {
  return armies.map((enemies, i) => ({ id: `${id}_${i}`, name, goal: 'harm', enemies, fromDay: 5, era: ages[i][0], untilEra: ages[i][1], weight: 0.6, speed: 58, bribable: true, plural: false, ...o }) as RaidKind);
}
export const RISING_RAIDS: readonly RaidKind[] = [
  ...staged('shogun', 'The Shogunate', [{ ashigaru: 8, dart_ninja: 11 }, { ronin: 16, ronin_archer: 13, kunoichi: 14, shadow_monk: 15, ashigaru: 8 }, { ronin: 16, ronin_archer: 13, kunoichi: 14, karasu_tengu: 19, yamabushi_tengu: 24 }], { goals: { harm: 3, kidnap: 1, burn: 1 } }),
  ...staged('corsairs', 'The Black Tide Corsairs', [{ corsair_deckhand: 8, drowned_sailor: 12 }, { corsair_deckhand: 8, sea_reaver: 14, drowned_sailor: 12 }, { sea_reaver: 14, corsair_gunner: 16, squid_spawn: 13 }], { goal: 'steal', goals: { steal: 4, kidnap: 1, harm: 1 }, steals: 'valuables', speed: 60 }),
  ...staged('corsairs_sea', 'The Black Tide Corsairs', [{ corsair_deckhand: 8, drowned_sailor: 12 }, { corsair_deckhand: 8, sea_reaver: 14, drowned_sailor: 12 }, { sea_reaver: 14, corsair_gunner: 16, squid_spawn: 13 }], { goal: 'steal', goals: { steal: 4, kidnap: 1, harm: 1 }, steals: 'valuables', speed: 60, fromSea: true }),
  ...staged('infernal', 'The Infernal Host', [{ red_imp: 5, satyr: 12 }, { red_imp: 5, satyr_shaman: 16, gorgon: 16, minotaur: 24 }, { red_imp: 5, brute_demon: 22, gorgon_matriarch: 21, minotaur_brute: 30, ring_demon: 34 }], { goals: { harm: 3, burn: 2, kidnap: 1 }, bribable: false, speed: 52 }),
  // (the shinobi who slip in by night: started inside the town by sim/risingPowers.ts, never rolled)
  { id: 'shinobi_night', name: 'Shinobi in the night', goal: 'kidnap', goals: { kidnap: 2, steal: 3, burn: 1 }, steals: 'valuables', enemies: { kunoichi: 14, dart_ninja: 11 }, fromDay: 9999, weight: 0, speed: 75, bribable: false, plural: true },
];

const sprite = (sheet: PackSheetId, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });
const PERSON = 46;

/** Their own foes and lords (merged into ENEMIES). */
export const RISING_ENEMIES: Record<string, EnemyDef> = {
  ashigaru: { id: 'ashigaru', name: 'Ashigaru', hp: 30, damage: [3, 6], accuracy: 0.66, dodge: 0.1, interval: 1.2, ranged: false, loot: { wood: 1, cloth: 1 }, sprite: sprite('ninja_peasant', PERSON - 2) },
  corsair_deckhand: { id: 'corsair_deckhand', name: 'Corsair Deckhand', hp: 32, damage: [3, 7], accuracy: 0.66, dodge: 0.14, interval: 1.0, ranged: false, loot: { cloth: 1, fish: 1 }, sprite: sprite('pirate_leader', PERSON - 6), look: { hue: 200 } },
  corsair_gunner: { id: 'corsair_gunner', name: 'Corsair Gunner', hp: 70, damage: [12, 18], accuracy: 0.74, dodge: 0.1, interval: 1.6, ranged: true, loot: { shot: 4, cloth: 1 }, sprite: sprite('pirate_leader', PERSON), look: { hue: 60 } },
  shogun_raizen: {
    id: 'shogun_raizen', name: 'Shogun Raizen of the Mists', hp: 420, damage: [15, 23], accuracy: 0.84, dodge: 0.2, interval: 1.2, ranged: false, boss: true, loot: { iron: 6, cloth: 6 }, sprite: sprite('samurai_commander', 72), armor: 0.2, look: { hue: 300, bright: 0.9 },
    kit: { roar: 'A conch sounds through the mist. Shogun Raizen lowers his war fan: "Bow, and be spared."', enrage: 'Raizen draws his second blade: the mist turns red about him!', area: { every: 3, targets: 2, name: 'cuts in a single flashing arc', fx: 'beam' }, summon: { kind: 'ronin', count: 2, text: 'His sworn ronin step out of the mist!' }, trophy: 'raizen_daisho' },
  },
  admiral_vask: {
    id: 'admiral_vask', name: 'Admiral Vask the Red', hp: 380, damage: [14, 22], accuracy: 0.8, dodge: 0.16, interval: 1.2, ranged: true, boss: true, loot: { iron: 4, cloth: 4, shot: 12, pearls: 2 }, sprite: sprite('pirate_leader', 76), look: { hue: 330 },
    kit: { roar: 'Admiral Vask kicks in the door of the town with a boot of red leather. "I\'ll have the lot, and a song besides."', enrage: 'Vask empties both pistols and draws a cutlass in each hand!', area: { every: 3, targets: 3, name: 'fires a volley', fx: 'shell' }, summon: { kind: 'sea_reaver', count: 2, text: 'Reavers swarm up from the boats!' }, trophy: 'vask_cutlass' },
  },
  malphas: {
    id: 'malphas', name: 'Malphas, Prince of the Pit', hp: 480, damage: [17, 26], accuracy: 0.78, dodge: 0.08, interval: 1.4, ranged: false, boss: true, loot: { coal: 8, rare_minerals: 2, bone: 4 }, sprite: sprite('hk_demon_lord', 96), nature: 'beast', look: { hue: 20 },
    kit: { roar: 'The air splits like a seam. Malphas steps through, horns first. "You built all this for me? How thoughtful."', enrage: 'Malphas spreads his wings and the ground around him boils!', area: { every: 3, targets: 3, name: 'breathes hellfire', burns: true, fx: 'fire' }, summon: { kind: 'red_imp', count: 3, text: 'Imps tumble out of the Pit, cackling!' }, trophy: 'malphas_horn' },
  },
};

/** The lords' trophies (merged into ITEMS: relics, never made or sold). */
export const RISING_TROPHIES: ItemDef[] = [
  { id: 'raizen_daisho', name: "Raizen's Daisho", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { range: 1.2, damage: 17, crit: 0.12, speed: 0.1, morale: 3 }, description: 'The shogun\'s paired blades, long and short. Quick, and deadly in a steady hand.', icon: { sheet: 'MedWep', x: 3, y: 0 } },
  { id: 'vask_cutlass', name: "Vask's Red Cutlass", slot: 'weapon', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { range: 1.2, damage: 15, crit: 0.1, lifesteal: 0.08, morale: 3 }, description: 'A cutlass with a hilt of red coral. It drinks a little of every wound it opens.', icon: { sheet: 'MedWep', x: 1, y: 0 } },
  { id: 'malphas_horn', name: "Malphas's Horn", slot: 'charm', station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects: { power: 0.3, damage: 3, morale: -2 }, description: 'A demon\'s horn, still warm. Its bearer\'s spells burn hotter, and their dreams are worse.', icon: { sheet: 'Magic', x: 6, y: 1 } },
];

/* ------------------------------------------------------------ their own moves (sim/risingPowers.ts) */

/** The Shogunate's shinobi: at war, on `NIGHT_RAID_DAILY` of mornings a night raid is set for `NIGHT_RAID_HOUR`,
 *  begun inside the town (a building's door), `NIGHT_RAID_SHARE` of a raid's budget. */
export const NIGHT_RAID_DAILY = 0.3;
export const NIGHT_RAID_HOUR = 2;
export const NIGHT_RAID_SHARE = 0.6;
/** The Shogunate's duels: not at peace, every `DUEL_GAP_DAYS` at least, on `DUEL_DAILY` of mornings, a champion
 *  challenges the town's best fighter. The champion's might is `DUEL_BASE` plus `DUEL_PER_DAY` a paced day plus
 *  `DUEL_PER_STAGE` a stage; the town's is the fighter's (level, melee). The odds: `0.5 + (ours - theirs) * DUEL_SLOPE`,
 *  held to `DUEL_LEAST`..`DUEL_MOST`. Lost, the fighter falls (`DUEL_KILLS` dead, else badly hurt). */
export const DUEL_GAP_DAYS = 6;
export const DUEL_DAILY = 0.35;
export const DUEL_BASE = 8;
export const DUEL_PER_DAY = 0.9;
export const DUEL_PER_STAGE = 6;
export const DUEL_SLOPE = 0.03;
export const DUEL_LEAST = 0.15;
export const DUEL_MOST = 0.85;
export const DUEL_KILLS = 0.5;
export const DUEL_WON_GOODWILL = 15;
export const DUEL_WON_MORALE = 6;
export const DUEL_REFUSED_GOODWILL = -15;
export const DUEL_REFUSED_MORALE = -4;

/** The Corsairs: not at peace, on `SEIZE_DAILY` of mornings they take a trade wagon on the road (its goods and
 *  purse), else skim the stores of a shore town with no watch (`SKIM_SHARE` of its dearest good, up to `SKIM_MOST`). */
export const SEIZE_DAILY = 0.35;
export const SKIM_SHARE = 0.25;
export const SKIM_MOST = 12;

/** The Infernal Host: at war, on `RIFT_DAILY` of mornings with none open, a rift opens `RIFT_CELLS` out from the
 *  town for `RIFT_DAYS`, and each night hour (`RIFT_FROM`..`RIFT_UNTIL`) on `RIFT_SPAWN` a band of the stage's
 *  creatures comes out of it to prowl. Not allied, every `PACT_GAP_DAYS` it offers a pact: a life for coins
 *  (`PACT_COINS`, more each stage) and a fighting mark (`PACT_FIGHT` for `PACT_DAYS`). */
export const RIFT_DAILY = 0.35;
export const RIFT_CELLS = 18;
export const RIFT_DAYS = 3;
export const RIFT_FROM = 21;
export const RIFT_UNTIL = 4;
export const RIFT_SPAWN = 0.25;
export const PACT_GAP_DAYS = 7;
export const PACT_COINS = 120;
export const PACT_FIGHT = 1.25;
export const PACT_DAYS = 4;
/** The creatures of a rift by stage. */
export const RIFT_BANDS: readonly Record<string, number>[] = [{ red_imp: 3 }, { red_imp: 2, satyr: 1, gorgon: 1 }, { brute_demon: 1, red_imp: 2, gorgon_matriarch: 1 }];
