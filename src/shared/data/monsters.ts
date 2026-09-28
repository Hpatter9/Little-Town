// Monster townsfolk and the Hunter's Guild (DESIGN §7, §10). Numbers are starting points for tuning.

export type MonsterKind = 'werewolf' | 'vampire' | 'undead';
/** What to do when the Hunter's Guild comes for a monster (also the answer while the player is away). */
export type StandingOrder = 'hide' | 'fight' | 'give_up';

export const MONSTER_NAMES: Record<MonsterKind, string> = { werewolf: 'Werewolf', vampire: 'Vampire', undead: 'Undead' };
export const ORDER_NAMES: Record<StandingOrder, string> = { hide: 'Always hide', fight: 'Always fight', give_up: 'Give them up' };

/** Once the Occult is known: chance a newcomer is a monster. Monsters are hardier. */
export const MONSTER_ARRIVAL = 0.12;
export const MONSTER_HP = 30;

/** Werewolves: a full moon every this many game days; on that night a werewolf mauls someone. */
export const FULL_MOON_DAYS = 6;
export const MAUL_DAMAGE = 14;
/** Vampires: feed every this many game hours, taking health from a sleeper; everyone sleeps uneasy. */
export const FEED_HOURS = 48;
export const BITE_DAMAGE = 12;
export const UNEASY_MORALE = -3;

/** The Guild: hostility per monster per game day (and its fall with none), and when they come. */
export const GUILD_PER_MONSTER_DAY = 12;
export const GUILD_DECAY_DAY = 5;
export const GUILD_THRESHOLD = 60;
/** Hiding: chance = base + per level of the best Social skill (and they're angrier when it fails). */
export const HIDE_BASE = 0.3;
export const HIDE_PER_SOCIAL = 0.05;

/* ------------------------------------------------------------ turning townsfolk (hidden) */

/** Undead (turned by a lich founder): never hungry or tired, immune to sickness and smog, and ignored by
 *  the walking dead. But they heal slowly, never marry or have children, the living find them unsettling,
 *  and wanderers shy away from a town of the dead. */
export const UNDEAD_HEAL = 0.3;
export const LIVING_AMONG_DEAD_MORALE = -4;
export const UNDEAD_TOWN_ARRIVALS = 0.3;
/** Vampires work best by night; with nobody living to feed on they go thirsty. */
export const VAMPIRE_NIGHT_WORK = 1.25;
export const VAMPIRE_DAY_WORK = 0.85;
export const THIRST_HP_PER_HOUR = 3;
export const THIRST_MORALE = -12;
/** Werewolves hit harder, and on a full moon with nobody living to maul, the pack hunts. */
export const WEREWOLF_DAMAGE = 3;
export const PACK_HUNT_MEAT = 3;
/** Turning someone frightens the living who remain. */
export const TURNING_FEAR_MORALE = -6;
export const TURNING_FEAR_HOURS = 24;