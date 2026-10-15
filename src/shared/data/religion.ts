// Religion and the gods made real (the DLC): on top of the four gods of data/gods.ts, each townsperson follows one of
// them (or none, or a rival cult), the town's priests keep the rites, each god keeps a feast day a season and acts in
// its own nature, omens come before the worst of a god's wrath, and now and then a miracle. The numbers below are
// what sim/religion.ts runs on.

import type { BuildingDef } from './buildings';
import type { Domain } from './gods';
import type { NatureId } from './natures';
import type { OriginId } from './origins';

/** What someone believes: one of the four gods, none at all, or the rival cult. */
export type Creed = Domain | 'none' | 'cult';

/** Natures that keep faith hard, drift from it, and may turn to a cult. */
export const ZEALOUS: readonly NatureId[] = ['pious', 'stern', 'proud'];
export const DOUBTING: readonly NatureId[] = ['curious', 'greedy', 'grumpy', 'restless'];
export const HERETICAL: readonly NatureId[] = ['dreamy', 'gloomy', 'restless', 'curious'];

/** How zealous each nature starts (0 to 100), before the day-by-day drift. */
export const ZEAL_START: Record<NatureId, number> = {
  pious: 70, stern: 50, proud: 45, kind: 45, shy: 40, cheerful: 40, jolly: 35, bold: 35, dreamy: 35, gloomy: 30, grumpy: 25, restless: 25, curious: 20, greedy: 15,
};
/** The share of each nature that follows no god at all when they come. */
export const NONE_SHARE: Partial<Record<NatureId, number>> = { curious: 0.35, greedy: 0.35, grumpy: 0.25, restless: 0.25, gloomy: 0.2 };

/** Zeal at or over this is a zealot (only the zealous natures); under this, faith may lapse. */
export const ZEALOT_AT = 80;
export const LAPSE_UNDER = 15;
/** Each dawn: a follower's zeal drifts this much toward their nature's start; a rite day lifts it, a wrath of their
 *  own god cuts it. */
export const ZEAL_DRIFT = 1;
export const ZEAL_RITE = 6;
export const ZEAL_WRATH = 15;
export const ZEAL_MIRACLE = 20;
/** A day's chance that a doubting soul low in zeal lapses, and that someone without a god finds one (the pious
 *  friend's pull, the more so after a miracle). */
export const LAPSE_CHANCE = 0.08;
export const CONVERT_CHANCE = 0.05;
export const MIRACLE_CONVERTS = 0.4;
/** After a god's wrath, a share of its own followers turns to the best pleased god (a schism). */
export const SCHISM_SHARE = 0.3;

/** Each follower adds this to their god's favour a day (times zeal / 50); a god nobody in town follows loses this. */
export const FOLLOWER_FAVOUR = 0.45;
export const UNFOLLOWED = 5;
/** What every god asks of the town a day, so much a head (at most so much): a big town's gods want more than a shrine
 *  and the morning's offering, so the gods it neglects (few followers, no feast kept) sour. */
export const DEMAND_PER_HEAD = 0.6;
export const DEMAND_MOST = 16;

/** The priests: whoever holds a place of worship (data/operators.ts). At dawn they pray at it for this long, adding
 *  this (and this a Social level) to the least pleased god. */
export const PRIEST_HOURS = 2;
export const PRIEST_RITE = 2;
export const PRIEST_PER_LEVEL = 0.15;
/** A priest's blessing before a raid: the defenders fight this much better (more with the war god pleased). */
export const RAID_BLESSING = 1.08;
export const RAID_BLESSING_PLEASED = 1.15;
/** A priest's blessing on a party setting out: lifted spirits for the road. */
export const ROAD_BLESSING = 6;
export const ROAD_BLESSING_HOURS = 48;
/** A funeral the priest says the words at: the grieving's grief eased this much more, the hearth god pleased. */
export const FUNERAL_RITES_EASE = 0.7;
export const FUNERAL_RITES_FAVOUR = 4;

/** Each god's feast day: this day of every season (1-based), in the order of `DOMAINS`. Kept (a place of worship and a
 *  priest at home), the god is pleased and the town lifted; let pass, the god is slighted. */
export const FEAST_DAYS: readonly number[] = [3, 5, 7, 9];
export const FEAST_KEPT = 16;
export const FEAST_MISSED = -12;
export const FEAST_FOOD = 1;
export const FEAST_MORALE = 4;

/** A god acting in its nature: so much favour a day for what it loves and hates in the town. */
export const NATURE_ACTS = {
  /** harvest: a full granary pleases it, every hungry mouth angers it */
  harvestFull: 1.5, harvestFullDays: 8, harvestStarving: -2,
  /** hearth: a happy town pleases it, a miserable one angers it; a hanging angers it greatly */
  hearthHappy: 1, hearthGlum: -2, hearthHanging: -10,
  /** war: a raid driven off pleases it, the town pillaged angers it */
  warWon: 6, warLost: -8,
  /** sky: a party out on the roads pleases it */
  skyTravel: 1,
} as const;
/** Each member of the rival cult costs every god this much favour a day. */
export const CULT_FAVOUR = 1.2;

/** A god this low sends an omen first (once in so many days), lower still may loose its greater wrath (with this
 *  chance at dawn), which spends this much of its anger. */
export const OMEN_AT = -25;
export const OMEN_GAP_DAYS = 3;
export const GREAT_WRATH_AT = -60;
export const GREAT_WRATH_CHANCE = 0.3;
/** A camp smaller than this is spared the greater wraths (the lesser ones of sim/faith.ts still come). */
export const GREAT_WRATH_PEOPLE = 5;
export const GREAT_WRATH_SPENDS = 45;
/** No two greater wraths, of any gods, within this many days of each other. */
export const WRATH_GAP_DAYS = 5;
/** The greater wraths: the share of food that rots, of the town that sickens, the strikes of the storm and the chance
 *  each kills whoever it finds out of doors. */
export const CURSED_ROTS = 0.35;
/** A cursed harvest spares this many days of food (it takes the plenty, not the last crust). */
export const CURSE_SPARES_DAYS = 4;
export const PLAGUE_SHARE = 0.25;
export const STORM_STRIKES = 3;
export const STORM_KILLS = 0.5;

/** Miracles: a god at least this pleased may work one (a hearth god spares the dying, a sky god turns a raid with a
 *  storm, a war god... ), never two within so many days; a harvest god breaks a famine from lower favour, out of
 *  pity. */
export const MIRACLE_AT = 70;
export const MIRACLE_GAP_DAYS = 10;
export const SPARE_CHANCE = 0.3;
export const STORM_CHANCE = 0.15;
export const STORM_SCATTERS = 0.5;
export const STORM_HURTS = 0.3;
export const FAMINE_AT = 25;
export const FAMINE_CHANCE = 0.5;
export const FAMINE_DAYS = 5;
/** What the town's deaths that no god may turn aside are: old age and the town's own justice. */
export const UNSPARED = /old age|hanged|executed|sacrificed|exiled/i;

/** The rival cult: it may rise once there are this many grown-ups, with this chance a day while none stands (more as
 *  the gods sour), and draws those low in spirits and faith. Zealots denounce its members to the council. */
export const CULT_PEOPLE = 7;
export const CULT_CHANCE = 0.025;
export const CULT_RECRUIT = 0.12;
export const DENOUNCE_CHANCE = 0.35;
/** The cult's dark rite (every so many days): it lifts its own, but it is cruel. */
export const CULT_RITE_DAYS = 5;
export const CULT_RITE_MORALE = 4;

/** A pilgrimage: once a temple stands, every so many days the priest leads the faithful to a holy place; home again,
 *  every god is pleased this much, the pilgrims' zeal lifted, and maybe a relic brought back. */
export const PILGRIM_EVERY_DAYS = 18;
export const PILGRIM_PEOPLE = 6;
export const PILGRIM_PARTY = 3;
export const PILGRIM_FAVOUR = 18;
export const PILGRIM_RELIC = 0.12;
export const PILGRIM_DEST = 'pilgrim:';

/** Cults that might rise, by the people's kind of town (any town: the first list). */
export const CULT_NAMES: readonly string[] = ['the Hollow Star', 'the Pale Eye', 'the Drowned Bell', 'the Seventh Door', 'the Ash Choir', 'the Weeping Moon'];
export const ORIGIN_CULT: Partial<Record<OriginId, string>> = {
  robot: 'the Null Process', vampire: 'the Dawnseekers', lich: 'the Living Flame', knights: 'the Black Grail', orcs: 'the Quiet Fist', fae: 'the Iron Truth',
};
/** The holy place the pilgrims walk to, by the people. */
export const HOLY_PLACES: Partial<Record<OriginId, string>> = {
  settlers: 'the Stones of the First Altar', knights: 'the Shrine of the Grail', druid: 'the Oldest Oak', dwarves: 'the Root of the Mountain', merfolk: 'the Drowned Temple',
  vampire: 'the Red Crypt', lich: 'the Well of Souls', nomads: 'the Sky Cairn', fae: 'the Ring of Twilight', orcs: 'the Skull Mound', robot: 'the First Server', alchemists: 'the Philosophers\' Spring', werewolf: 'the Moon Rock',
};

/** The omens a god sends before the worst. */
export const OMENS: Record<Domain, readonly string[]> = {
  harvest: ['the milk sours in the pail', 'crows settle on every furrow', 'the grain sprouts black in the store'],
  hearth: ['every hearth smokes and will not draw', 'a child cries out a name nobody knows', 'the bread will not rise'],
  war: ['blood weeps from the whetstone', 'the dogs howl at the gate all night', 'a sword cracks on its own rack'],
  sky: ['the wind howls with no cloud in sight', 'birds fall silent at noon', 'a red ring stands round the moon'],
};

/** Each people's way with a cruel rite and a merciful one: the words, and which. */
export const BLOOD_RITES: readonly OriginId[] = ['vampire', 'orcs', 'lich'];

/** An idol the town raises to a god that worked a miracle (raised overnight: never in the building book), and the
 *  cult's altar (set up in secret, pulled down when the cult is gone). */
export const GOD_IDOL = 'god_idol';
export const CULT_ALTAR = 'cult_altar';
export const IDOLS_MOST = 4;
export const RELIGION_BUILDINGS: BuildingDef[] = [
  { id: GOD_IDOL, name: 'Idol', layer: 'fore', width: 1, cost: { wood: 6 }, buildSeconds: 1, purpose: 'Carved in thanks for a miracle: every god looks kindly on it, and the faithful pray before it.', never: true, morale: [1, 'The idol of a miracle'] },
  { id: CULT_ALTAR, name: 'Cult Altar', layer: 'fore', width: 1, cost: { stone: 4 }, buildSeconds: 1, purpose: 'Set up in secret by the rival cult: its dark rites are held here, and the gods hate it.', never: true },
];
/** An idol's worship: added to its god's favour a day. */
export const IDOL_FAVOUR = 2;

/** What a diary says of someone's faith, by where they stand: {god} is their god's name. */
export const FAITH_LINES: Record<'zealot' | 'devout' | 'follower' | 'doubter' | 'none' | 'cult' | 'wrath' | 'miracle', readonly string[]> = {
  zealot: ['I prayed to {god} at dawn and again at dusk. The others are not nearly careful enough.', 'There are those in this town who do not fear {god} as they should. I see them.', '{god} watches. I will not fail them.'],
  devout: ['I said my prayers to {god}.', 'I left a crust for {god} at the shrine.', 'I thanked {god} for the day.'],
  follower: ['I remembered {god}, now and then.', 'I touched the shrine on my way past, for {god}.'],
  doubter: ['I am not sure {god} hears any of us.', 'The priest says {god} is pleased. I wonder how anyone knows.'],
  none: ['The others prayed. I didn\'t.', 'All this praying. I trust my own hands.'],
  cult: ['We met again by the altar after dark. The old gods are nothing to what we have found.', 'The others would not understand. Not yet.'],
  wrath: ['{god} is angry with us. I can feel it.', 'What have we done, that {god} turns on us?'],
  miracle: ['I saw it with my own eyes: {god} is real.', 'After what {god} did, how can anyone doubt?'],
};
