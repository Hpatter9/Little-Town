// Titles earned by what a townsperson did (the owner's ask: titles that take longer, come in many kinds, and say how
// someone really is). Each rule reads the facts of a person's record (`TitleFacts`, gathered by sim/titles.ts: the
// tallies counted on `Person.tally`, the deeds, the body, the nature) and, when it holds, gives its title and a line
// saying how it was earned, kept on the person (`Person.titleWhy`). The ladders of deeds (data/deeds.ts) and the
// origin titles (sim/annals.ts) stay; these are in addition. Pure data: nothing here touches the game state.
import type { BodyPart } from './injuries';
import type { DeedKind } from './deeds';

/** What the rules may read about a person. */
export interface TitleFacts {
  /** Counted as it happens (`tally` in sim/deeds.ts): "slain:wolf", "wounds", "wed", "crime:theft" ... */
  tally: Readonly<Record<string, number>>;
  deeds: Readonly<Partial<Record<DeedKind, number>>>;
  felled: number;
  trips: number;
  level: number;
  coins: number;
  nature: string;
  traits: readonly string[];
  /** The people of the town (settlers, knights, lich ...). */
  origin: string;
  lost: readonly BodyPart[];
  fitted: Readonly<Partial<Record<BodyPart, string>>>;
  scars: number;
  keptVow: boolean;
}

export type TitleMood = 'good' | 'bad' | 'odd';

export interface TitleRule {
  title: string;
  mood: TitleMood;
  when: (f: TitleFacts) => boolean;
  /** How it was earned, in a sentence ("Felled 12 wolves in raids."). */
  why: (f: TitleFacts) => string;
}

/** The most of these titles one person holds (the deed ladders and the origin titles don't count). */
export const TITLE_MOST = 8;

/** How much of a thing it takes. Each is a count of the deed, so the rarer titles are simply the larger numbers. */
export const TITLE_AT = {
  /** Foes of a kind felled in raids, for the first title of that kind and the second. */
  kind: [12, 40],
  /** All raiders felled (the Slayer, the Reaper). */
  slayer: [60, 150],
  /** Wounds taken, for "the Unlucky" and "the Battered". */
  wounds: [15, 40],
  /** Times struck down. */
  downed: [5, 12],
  /** Marriages, for "the Twice-Wed" and "the Thrice-Wed". */
  wed: [2, 3],
  /** Fields reaped by their hand. */
  reaped: [40, 120, 300],
  /** Crimes they were caught at, of one kind and of any. */
  crime: 2,
  crimes: 4,
  /** Breakdowns of one kind. */
  breaks: 3,
  /** Trips away. */
  trips: [25, 60],
  /** Coins held, for "the Rich". */
  rich: 400,
  /** Feasts or rites attended, for the jolly and the pious. */
  gathered: 15,
  /** Vows kept, for the knights. */
  vows: [3, 8],
  /** Returned from the dead. */
  risen: [2, 5],
  /** The level someone must reach before the unflattering titles are judged (the young are forgiven). */
  lived: 8,
} as const;

const n = (f: TitleFacts, key: string) => f.tally[key] ?? 0;
/** Foes felled whose kind matches. */
const slain = (f: TitleFacts, re: RegExp) => {
  let t = 0;
  for (const k in f.tally) if (k.startsWith('slain:') && re.test(k.slice(6))) t += f.tally[k];
  return t;
};
const sum = (f: TitleFacts, prefix: string) => {
  let t = 0;
  for (const k in f.tally) if (k.startsWith(prefix)) t += f.tally[k];
  return t;
};
const times = (c: number) => (c === 1 ? 'once' : c === 2 ? 'twice' : `${c} times`);

const KINDS: { re: RegExp; noun: string; titles: [string, string]; mood?: TitleMood }[] = [
  { re: /^(wolf|wolf_alpha|wild_dog|zombie_hound|the_alpha)$/, noun: 'wolves and hounds', titles: ['Wolfbane', 'Packbreaker'] },
  { re: /^(bandit|bandit_archer|bandit_chief|gangster|raider|rival_spear|rival_slinger|space_pirate|pirate_king)$/, noun: 'bandits and brigands', titles: ['Bandit-Breaker', 'Scourge of Brigands'] },
  { re: /^(zombie|zombie_brute|zombie_bear|mummy|flying_skull|wraith|grave_ghost|spirit|abomination|lich_lord|vampire_bat|thrall|countess)$/, noun: 'the walking dead', titles: ['Gravewarden', 'Bane of the Dead'] },
  { re: /^(boar|cave_bear|lion|lioness|crocodile|behemoth|frost_yeti)$/, noun: 'great beasts', titles: ['Beastslayer', 'Hunter of Horrors'] },
  { re: /^(rat|plague_rat|rat_king|slime|acid_slime|shroom_folk|mimic)$/, noun: 'vermin and slimes', titles: ['Ratcatcher', 'Verminbane'] },
  { re: /^(dragon|drake|fire_elemental)$/, noun: 'dragonkind', titles: ['Drakeslayer', 'Dragonbane'] },
  { re: /^(ogre|iron_colossus|stone_golem|coral_golem|ice_golem|treant)$/, noun: 'giants and golems', titles: ['Giantfeller', 'Titanbreaker'] },
  { re: /^(slug_bot|war_bot|combat_drone|rogue_ai|scout_drone|iron_sentry|overmind|war_machine|star_mech|trooper)$/, noun: 'machines', titles: ['Rustbreaker', 'Ironsunderer'] },
  { re: /^(hedge_wizard|ice_mage|frost_archmage|mad_alchemist|homunculus|possessed_tome|archdruid|wisp|crystal_fiend|night_shade)$/, noun: 'sorcerers and spirits', titles: ['Spellbreaker', 'Bane of Sorcery'] },
  { re: /^(black_knight|order_knight|order_crossbow|soldier|commander|warlord|orc_warlord|orc_grunt|orc_archer|orc_brute|thane|hold_warrior|hold_crossbow|rifleman|horse_rider|horse_archer|the_khan)$/, noun: 'soldiers and warbands', titles: ['Warbreaker', 'Bane of Armies'] },
];

const rules: TitleRule[] = [];
const add = (title: string, mood: TitleMood, when: TitleRule['when'], why: TitleRule['why']) => rules.push({ title, mood, when, why });

// --- fighting
for (const k of KINDS) {
  add(k.titles[0], k.mood ?? 'good', (f) => slain(f, k.re) >= TITLE_AT.kind[0], (f) => `Felled ${slain(f, k.re)} of ${k.noun} in raids.`);
  add(k.titles[1], k.mood ?? 'good', (f) => slain(f, k.re) >= TITLE_AT.kind[1], (f) => `Felled ${slain(f, k.re)} of ${k.noun}: more than any should.`);
}
add('the Slayer', 'good', (f) => f.felled >= TITLE_AT.slayer[0], (f) => `Struck the last blow on ${f.felled} raiders.`);
add('the Reaper', 'good', (f) => f.felled >= TITLE_AT.slayer[1], (f) => `Struck the last blow on ${f.felled} raiders.`);
add('Ironhand', 'good', (f) => Object.entries(f.fitted).some(([part, item]) => /^hand_|^arm_/.test(part) && !!item), (f) => `Lost a hand and took an iron one in its place${f.felled ? `, and fought on: ${f.felled} raiders felled` : ''}.`);
add('the One-Eyed', 'odd', (f) => f.lost.filter((p) => p === 'eye_l' || p === 'eye_r').length === 1, () => 'Lost an eye to a blow.');
add('the Blind', 'odd', (f) => f.lost.filter((p) => p === 'eye_l' || p === 'eye_r').length === 2, () => 'Lost both eyes.');
add('Peg-Leg', 'odd', (f) => f.lost.some((p) => p === 'leg_l' || p === 'leg_r'), () => 'Lost a leg to a blow.');
add('the Armless', 'odd', (f) => f.lost.some((p) => p === 'arm_l' || p === 'arm_r') && !Object.keys(f.fitted).some((p) => p.startsWith('arm_')), () => 'Lost an arm and has none to replace it.');
add('the Scarred', 'odd', (f) => f.scars >= 4, (f) => `Carries ${f.scars} lasting scars.`);
add('the Unlucky', 'bad', (f) => n(f, 'wounds') >= TITLE_AT.wounds[0], (f) => `Wounded ${f.tally.wounds} times, and still it keeps coming.`);
add('the Battered', 'bad', (f) => n(f, 'wounds') >= TITLE_AT.wounds[1], (f) => `Wounded ${f.tally.wounds} times: hardly a part left unbruised.`);
add('Nine Lives', 'odd', (f) => n(f, 'downed') >= TITLE_AT.downed[0], (f) => `Struck down ${times(f.tally.downed)} and got up again.`);
add('Death-Dodger', 'odd', (f) => n(f, 'downed') >= TITLE_AT.downed[1], (f) => `Struck down ${times(f.tally.downed)}, and death has stopped trying.`);

// --- farming, crafts, building, healing, learning (the ladders in data/deeds.ts say the rest)
add('Green-Fingered', 'good', (f) => n(f, 'reaped') >= TITLE_AT.reaped[0], (f) => `Brought in ${f.tally.reaped} harvests with their own hands.`);
add('the Harvester', 'good', (f) => n(f, 'reaped') >= TITLE_AT.reaped[1], (f) => `Brought in ${f.tally.reaped} harvests.`);
add('Lord of the Furrow', 'good', (f) => n(f, 'reaped') >= TITLE_AT.reaped[2], (f) => `Brought in ${f.tally.reaped} harvests: the fields know their step.`);
add('Sharp-Eyed', 'good', (f) => (f.deeds.watched ?? 0) >= 10 && (f.deeds.bouts ?? 0) >= 2, () => 'Caught sneaks on the night watch and won bouts in the arena.');
add('Jack of All Trades', 'good', (f) => (f.deeds.built ?? 0) >= 10 && (f.deeds.crafted ?? 0) >= 25 && (f.deeds.healed ?? 0) >= 5 && (f.deeds.studied ?? 0) >= 5, () => 'Built, crafted, healed and studied, all in good measure.');
add('the Bookworm', 'good', (f) => (f.deeds.studied ?? 0) >= 15 && (f.deeds.built ?? 0) < 5 && (f.deeds.crafted ?? 0) < 10, (f) => `Learned ${f.deeds.studied} topics and built almost nothing.`);
add('Hammer and Tongs', 'good', (f) => (f.deeds.crafted ?? 0) >= 50 && (f.deeds.built ?? 0) >= 25, () => 'Made and raised, forge and scaffold alike.');
add('Wound-Binder', 'good', (f) => (f.deeds.healed ?? 0) >= 15 && f.felled === 0, (f) => `Tended ${f.deeds.healed} lives and never struck a raider.`);

// --- exploring, leadership
add('Far-Walker', 'good', (f) => f.trips >= TITLE_AT.trips[0], (f) => `Went out on ${f.trips} trips beyond the walls.`);
add('the Wayfarer', 'good', (f) => f.trips >= TITLE_AT.trips[1], (f) => `Went out on ${f.trips} trips: more road than home.`);
add('the Stay-at-Home', 'odd', (f) => f.level >= TITLE_AT.lived && f.trips === 0 && f.felled === 0, () => 'Has never left the town or lifted a hand in a raid.');

// --- love and family
add('the Twice-Wed', 'odd', (f) => n(f, 'wed') >= TITLE_AT.wed[0], () => 'Married twice.');
add('the Thrice-Wed', 'odd', (f) => n(f, 'wed') >= TITLE_AT.wed[1], () => 'Married three times.');
add('the Widowed', 'odd', (f) => n(f, 'widowed') >= 1, () => 'Buried a husband or wife.');

// --- crime and misfortune (unflattering: from what they were caught at, and from their bad habits)
add('Sticky-Fingers', 'bad', (f) => n(f, 'crime:theft') >= TITLE_AT.crime, (f) => `Caught thieving ${times(f.tally['crime:theft'])}.`);
add('the Cutpurse', 'bad', (f) => n(f, 'crime:theft') >= TITLE_AT.crime * 2, (f) => `Caught thieving ${times(f.tally['crime:theft'])}.`);
add('Knuckles', 'bad', (f) => n(f, 'crime:assault') >= TITLE_AT.crime, (f) => `Caught beating folk in the dark ${times(f.tally['crime:assault'])}.`);
add('the Vandal', 'bad', (f) => n(f, 'crime:vandalism') >= TITLE_AT.crime, (f) => `Caught smashing up the town ${times(f.tally['crime:vandalism'])}.`);
add('Bloodhands', 'bad', (f) => n(f, 'crime:murder') >= 1, () => 'Caught after a murder.');
add('the Jailbird', 'bad', (f) => sum(f, 'crime:') >= TITLE_AT.crimes, (f) => `Brought to trial ${times(sum(f, 'crime:'))}.`);
add('the Pardoned', 'odd', (f) => n(f, 'pardoned') >= 2, (f) => `Let off ${times(f.tally.pardoned)} by the town.`);
add('the Sulker', 'bad', (f) => n(f, 'break:sulk') >= TITLE_AT.breaks, (f) => `Sulked ${times(f.tally['break:sulk'])} when morale gave out.`);
add('the Sot', 'bad', (f) => n(f, 'break:binge') >= TITLE_AT.breaks, (f) => `Drank themselves senseless ${times(f.tally['break:binge'])}.`);
add('the Hothead', 'bad', (f) => n(f, 'break:brawl') >= TITLE_AT.breaks, (f) => `Started ${times(f.tally['break:brawl'])} brawls with a rival.`);
add('the Runaway', 'bad', (f) => n(f, 'break:wander') >= 2, (f) => `Walked off ${times(f.tally['break:wander'])} and had to be fetched.`);
add('the Rich', 'good', (f) => f.coins >= TITLE_AT.rich, (f) => `Holds ${f.coins} coins of their own.`);
add('the Coward', 'bad', (f) => f.traits.includes('coward') && f.level >= TITLE_AT.lived && f.felled === 0 && n(f, 'downed') >= 2, () => 'Faint of heart, never struck a raider and fell in every fight.');
add('the Idler', 'bad', (f) => f.traits.includes('lazy') && f.level >= TITLE_AT.lived && (f.deeds.built ?? 0) + (f.deeds.crafted ?? 0) < 5, () => 'A lazy streak, and next to nothing built or made to show for it.');
add('the Glutton', 'bad', (f) => f.traits.includes('glutton') && n(f, 'break:binge') >= 1, () => 'Cannot be kept from the pot, and has binged on it.');
add('the Hermit', 'odd', (f) => f.traits.includes('loner') && f.level >= TITLE_AT.lived, () => 'Keeps to themselves and always has.');
add('the Grudging', 'bad', (f) => f.nature === 'grumpy' && n(f, 'break:brawl') + n(f, 'crime:assault') >= 2, () => 'A grumpy soul whose temper has landed them in fights.');
add('the Miser', 'bad', (f) => f.nature === 'greedy' && sum(f, 'crime:') >= 1, () => 'Greedy by nature, and caught out by it.');
add('the Dreamer', 'odd', (f) => f.nature === 'dreamy' && (f.deeds.studied ?? 0) >= 8, () => 'Head in the clouds, and learned a great deal there.');
add('the Faithful', 'good', (f) => f.nature === 'pious' && n(f, 'gathered:rite') >= TITLE_AT.gathered, (f) => `Knelt at ${f.tally['gathered:rite']} rites at the temple.`);
add('the Merry', 'good', (f) => f.nature === 'jolly' && n(f, 'gathered:feast') >= TITLE_AT.gathered, (f) => `Never missed a feast: ${f.tally['gathered:feast']} in all.`);
add('the Bold', 'good', (f) => f.nature === 'bold' && f.felled >= 15, (f) => `Bold by nature, and ${f.felled} raiders felled to prove it.`);
add('the Gentle', 'good', (f) => f.nature === 'kind' && (f.deeds.healed ?? 0) >= 8, (f) => `Kind by nature, and tended ${f.deeds.healed} lives.`);

// --- each people's own flavour
const only = (origin: string, title: string, mood: TitleMood, when: TitleRule['when'], why: TitleRule['why']) =>
  add(title, mood, (f) => f.origin === origin && when(f), why);
only('knights', 'Truesworn', 'good', (f) => n(f, 'vows') >= TITLE_AT.vows[0], (f) => `Kept ${f.tally.vows} vows of the Order.`);
only('knights', 'Paragon of Vows', 'good', (f) => n(f, 'vows') >= TITLE_AT.vows[1], (f) => `Kept ${f.tally.vows} vows of the Order.`);
only('knights', 'Oathbreaker', 'bad', (f) => n(f, 'vowsBroken') >= 1, (f) => `Broke a sworn vow${f.tally.vowsBroken > 1 ? ` (${f.tally.vowsBroken} times)` : ''}, and the Order knows it.`);
only('lich', 'the Returned', 'odd', (f) => n(f, 'risen') >= TITLE_AT.risen[0], (f) => `Rose from the dead ${times(f.tally.risen)}.`);
only('lich', 'Grave-Walker', 'odd', (f) => n(f, 'risen') >= TITLE_AT.risen[1], (f) => `Rose from the dead ${times(f.tally.risen)}: the grave has given up.`);
only('vampire', 'Bloodletter', 'good', (f) => f.felled >= 25, (f) => `Drew the blood of ${f.felled} raiders.`);
only('vampire', 'Night-Stalker', 'bad', (f) => sum(f, 'crime:') >= 1, () => 'Hunted a victim in the dark, and was caught at it.');
only('vampire', 'the Pale', 'odd', (f) => n(f, 'downed') >= 3, (f) => `Struck down ${times(f.tally.downed)} and wakes at dusk.`);
only('druid', 'Greenwarden', 'good', (f) => n(f, 'reaped') >= 30, (f) => `Tended ${f.tally.reaped} harvests of the grove's fields.`);
only('druid', 'Beast-Whisperer', 'good', (f) => (f.deeds.beasts ?? 0) >= 6, (f) => `Raised ${f.deeds.beasts} beasts as friends.`);
only('fae', 'Trickster', 'bad', (f) => sum(f, 'crime:') >= 1, () => 'Played a trick on the town that the law did not find funny.');
only('fae', 'Glamour-Spun', 'odd', (f) => f.lost.length >= 1 || f.scars >= 2, () => 'Scarred by the world, and wearing it with a glamour.');
only('alchemists', 'Transmuter', 'good', (f) => (f.deeds.crafted ?? 0) >= 60, (f) => `Made ${f.deeds.crafted} pieces at the stations.`);
only('alchemists', 'Burnt-Sleeves', 'bad', (f) => n(f, 'wounds') >= 8, () => 'More than one experiment went wrong.');
only('robot', 'Prime Unit', 'good', (f) => (f.deeds.built ?? 0) >= 40, (f) => `Raised ${f.deeds.built} buildings without a day's rest.`);
only('robot', 'Faulty Unit', 'bad', (f) => n(f, 'wounds') >= 10 || f.lost.length >= 2, () => 'Worn and patched until little of the original is left.');
only('dwarves', 'Stonewright', 'good', (f) => (f.deeds.built ?? 0) >= 30, (f) => `Raised ${f.deeds.built} buildings out of the rock.`);
only('dwarves', 'Ironbeard', 'good', (f) => f.lost.length >= 1 && f.felled >= 15, () => 'Lost a limb in the fighting and stood to it all the same.');
only('merfolk', 'Tide-Walker', 'good', (f) => f.trips >= 30, (f) => `Went out on ${f.trips} trips on the tides.`);
only('nomads', 'Far-Rider', 'good', (f) => f.trips >= 40, (f) => `Went out on ${f.trips} trips: the road is home.`);
only('werewolf', 'Moon-Scarred', 'odd', (f) => f.scars >= 3 || n(f, 'downed') >= 3, () => 'The moon has worn them down.');
only('werewolf', 'Fang-and-Claw', 'good', (f) => f.felled >= 30, (f) => `Tore down ${f.felled} raiders.`);
only('orcs', 'Skull-Taker', 'good', (f) => f.felled >= 40, (f) => `Took the skulls of ${f.felled} raiders.`);
only('orcs', 'Warlord\'s Bane', 'good', (f) => (f.deeds.bosses ?? 0) >= 2, (f) => `Brought down ${f.deeds.bosses} bosses.`);
only('settlers', 'Homesteader', 'good', (f) => n(f, 'reaped') >= 80 && (f.deeds.built ?? 0) >= 10, () => 'Ploughed the fields and raised the walls of the frontier.');

export const TITLE_RULES: readonly TitleRule[] = rules;
export const TITLE_RULE_BY_TITLE: Readonly<Record<string, TitleRule>> = Object.fromEntries(rules.map((r) => [r.title, r]));
