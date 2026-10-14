// Guilds and squads (sim/guilds.ts): when the town finds it lacks someone to fill a role (its defence, its healing,
// its scouting and hunting, its crafting, its trade, its learning, or an elite squad for the worst fights), a
// townsperson founds a guild for it or the council votes one in. The town names it, in its own people's way.

import type { BlocId } from './politics';
import type { OriginId } from './origins';
import type { Skill } from './skills';

export const GUILD_ROLES = ['wardens', 'menders', 'rangers', 'crafters', 'merchants', 'scholars', 'elite'] as const;
export type GuildRole = (typeof GUILD_ROLES)[number];

export interface GuildRoleDef {
  /** What the role is, for the menu ("the town's defence"). */
  role: string;
  /** The skills that fit someone for it (the best of them counts). */
  skills: Skill[];
  /** The least level of those to join. */
  least: number;
  /** The bloc that favours it in a council vote (data/politics.ts). */
  bloc: BlocId;
  /** What the guild does for the town, for the menu. */
  perk: string;
  /** The nouns its name is made from. */
  nouns: string[];
  /** Words of the telling (for the picture). */
  words: string;
}

export const GUILD_ROLE_DEFS: Record<GuildRole, GuildRoleDef> = {
  wardens: { role: "the town's defence", skills: ['melee', 'ranged'], least: 3, bloc: 'soldiers', perk: 'Its members strike 15% harder when raiders come.', nouns: ['Wardens', 'Shields', 'Watch', 'Wall', 'Guard'], words: 'guards wall watch soldiers town' },
  menders: { role: "the town's healing", skills: ['medicine'], least: 3, bloc: 'devout', perk: 'The hurt mend a quarter faster while it stands.', nouns: ['Menders', 'Hands', 'Salves', 'Lamp', 'Healers'], words: 'healer herbs infirmary candle' },
  rangers: { role: 'scouting and hunting', skills: ['ranged', 'gathering', 'animals'], least: 3, bloc: 'commons', perk: 'Its members range the land each day and bring home meat and hide.', nouns: ['Rangers', 'Pathfinders', 'Trackers', 'Hounds', 'Stalkers'], words: 'forest hunters trail wilds' },
  crafters: { role: "the town's making", skills: ['crafting', 'construction'], least: 4, bloc: 'guilds', perk: 'Its members work their crafts a fifth faster.', nouns: ['Hammers', 'Makers', 'Anvil', 'Hands', 'Craft'], words: 'forge workshop smith anvil' },
  merchants: { role: "the town's trade", skills: ['social'], least: 4, bloc: 'guilds', perk: 'Its dues and dealings bring the treasury coins each day.', nouns: ['Company', 'Purse', 'Coin', 'Traders', 'Ledger'], words: 'market merchants coins trade' },
  scholars: { role: "the town's learning", skills: ['research'], least: 4, bloc: 'devout', perk: 'Its members study a fifth faster.', nouns: ['Lanterns', 'Scribes', 'Quills', 'Seekers', 'Circle'], words: 'library books study scholars' },
  elite: { role: 'an elite squad for the worst fights', skills: ['melee', 'ranged'], least: 6, bloc: 'soldiers', perk: 'Its handful strike 30% harder when raiders come, and go first.', nouns: ['Knives', 'Blades', 'Hand', 'Fangs', 'Company'], words: 'night soldiers war blades' },
};

/** Each people's words for its guilds' names (the elite squads' are darker). */
export const ORIGIN_WORDS: Record<OriginId, { plain: string[]; elite: string[] }> = {
  settlers: { plain: ['Oak', 'Hearth', 'Green', 'Stout', 'Honest'], elite: ['Black', 'Silent', 'Grey', 'Night'] },
  lich: { plain: ['Bone', 'Grave', 'Pale', 'Hollow', 'Ashen'], elite: ['Deathless', 'Black', 'Sepulchral', 'Silent'] },
  druid: { plain: ['Thorn', 'Root', 'Moss', 'Rowan', 'Green'], elite: ['Briar', 'Wolfsbane', 'Shadowleaf', 'Grey'] },
  vampire: { plain: ['Crimson', 'Velvet', 'Dusk', 'Sable', 'Rose'], elite: ['Bloodless', 'Black', 'Midnight', 'Thirsting'] },
  werewolf: { plain: ['Moon', 'Howling', 'Silver', 'Pack', 'Wild'], elite: ['Red', 'Black', 'Hunting', 'Bloodmoon'] },
  robot: { plain: ['Brass', 'Copper', 'Steady', 'Logic', 'Iron'], elite: ['Null', 'Black', 'Zero', 'Silent'] },
  dwarves: { plain: ['Stone', 'Iron', 'Deep', 'Granite', 'Forge'], elite: ['Black', 'Grudge', 'Hammerfall', 'Deep'] },
  merfolk: { plain: ['Tide', 'Coral', 'Pearl', 'Shell', 'Kelp'], elite: ['Abyssal', 'Black', 'Undertow', 'Deep'] },
  nomads: { plain: ['Sand', 'Wind', 'Saddle', 'Far', 'Dune'], elite: ['Black', 'Scorpion', 'Silent', 'Red'] },
  fae: { plain: ['Moth', 'Dew', 'Silver', 'Glimmer', 'Willow'], elite: ['Thorn', 'Black', 'Unseelie', 'Gloaming'] },
  alchemists: { plain: ['Gilded', 'Mercurial', 'Azure', 'Sulphur', 'Glass'], elite: ['Black', 'Caustic', 'Quicksilver', 'Ashen'] },
  knights: { plain: ['White', 'Lion', 'Gold', 'True', 'Royal'], elite: ['Black', 'Iron', 'Silent', 'Grey'] },
  orcs: { plain: ['Tusk', 'Skull', 'Mud', 'Big', 'Red'], elite: ['Black', 'Bloody', 'Sneaky', 'Gutting'] },
};

/** The hour the guilds meet each day (their members, their perks, a new guild wanted). */
export const GUILD_HOUR = 17;
/** No guild before this day, nor in a town of fewer grown-ups. */
export const GUILD_FROM_DAY = 5;
export const GUILD_PEOPLE = 4;
/** Days between foundings (or a vote that failed). */
export const GUILD_GAP_DAYS = 4;
/** At most one guild for this many grown-ups. */
export const GUILD_PER_PEOPLE = 4;
/** How many may join a guild (the elite squad fewer). */
export const MEMBERS_MOST = 6;
export const ELITE_MOST = 4;
/** Fewest fit people for a guild to be founded. */
export const MEMBERS_LEAST = 2;
/** The elite squad wants a town this strong, fighters this seasoned, and to have been raided. */
export const ELITE_PEOPLE = 10;
export const ELITE_LEVEL = 8;
/** How badly a role must be wanted before anyone acts (`needOf`). */
export const NEED_AT = 3;
/** The share of foundings put to the council (when it sits); the rest someone simply starts. */
export const COUNCIL_SHARE = 0.4;

/** The perks. */
export const WARDEN_FIGHT = 1.15;
export const ELITE_FIGHT = 1.3;
export const MENDER_CARE = 1.25;
export const GUILD_WORK = 1.2;
/** A rangers' day: meat and hide a member, the land permitting. */
export const RANGER_MEAT = 1;
export const RANGER_HIDE = 0.5;
/** A merchants' day: coins a member, and the leader's Social a level. */
export const MERCHANT_DUES = 2;
export const MERCHANT_PER_SOCIAL = 0.5;
/** A member's spirits from belonging. */
export const MEMBER_MORALE = 2;
