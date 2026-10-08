// Hostiles roaming the town's land (the owner's ask: "wild animals, roaming dead, bandits... there to attack the
// townsfolk if they're walking through; this would also help make the walls more necessary; guards would have to
// patrol the nearby terrain; if an area is unsafe, less travellers come through; when townsfolk are caught, a fight
// happens: the FF type fight, not the raid battle"). The rules are in sim/roamers.ts.

import type { Era } from './eras';

export type RoamerKind = 'beasts' | 'dead' | 'bandits';

/** Who roams, by kind and age (a group of foes, as the expeditions' fights take). The beasts of a land with its own
 *  (data/places.ts `BIOME_BEASTS`) are those. */
export const ROAMER_GROUPS: Record<RoamerKind, Partial<Record<Era, Record<string, number>[]>>> = {
  beasts: {
    neolithic: [{ wolf: 2 }, { boar: 1 }, { wolf: 3 }],
    medieval: [{ wolf: 3 }, { boar: 2 }, { wolf_alpha: 1, wolf: 2 }],
    industrial: [{ wolf: 3, wolf_alpha: 1 }, { boar: 3 }],
    modern: [{ wolf: 4, wolf_alpha: 1 }, { boar: 3 }],
    space: [{ wolf: 4, wolf_alpha: 1 }],
  },
  dead: {
    neolithic: [{ zombie: 1 }, { zombie: 2 }],
    medieval: [{ zombie: 2 }, { zombie: 3 }],
    industrial: [{ zombie: 3 }],
    modern: [{ zombie: 4 }],
    space: [{ zombie: 4 }],
  },
  bandits: {
    neolithic: [{ rival_spear: 2 }, { rival_spear: 1, rival_slinger: 1 }],
    medieval: [{ bandit: 2 }, { bandit: 1, bandit_archer: 1 }],
    industrial: [{ gangster: 2 }, { gangster: 3 }],
    modern: [{ raider: 2 }, { raider: 3 }],
    space: [{ space_pirate: 2 }],
  },
};

/** What a band is called in the news. */
export const ROAMER_NAME: Record<RoamerKind, string> = { beasts: 'wild beasts', dead: 'the restless dead', bandits: 'bandits' };

/** From this day (0-based) on, in a town of `ROAM_PEOPLE` grown-ups (a lone founder caught on the land had nobody to
 *  tend them, and bled out: half of eight lone towns were lost); checked each hour, a new band comes on this chance
 *  while there are fewer than `ROAMERS_LEAST` + one a `ROAMERS_PER` grown-ups (up to `ROAMERS_MOST`). */
export const ROAM_FIRST_DAY = 1;
export const ROAM_PEOPLE = 3;
export const ROAM_HOURLY = 0.04;
export const ROAMERS_LEAST = 1;
export const ROAMERS_PER = 6;
export const ROAMERS_MOST = 4;
/** Bandits from this day on; the dead come out at night (they crumble at dawn) but on a blighted land. */
export const BANDITS_ROAM_FROM = 3;
export const NIGHT_FROM = 20;
export const NIGHT_UNTIL = 5;
/** A band wanders off after this many hours. */
export const ROAM_HOURS: [number, number] = [18, 40];

/** Where a band appears: this many cells beyond the town's edge, up to so many more (inside the open land). */
export const SPAWN_BEYOND = 7;
export const SPAWN_SPREAD = 16;
/** How far it wanders from where it came (cells); its pace wandering and running someone down (px a tick: people
 *  walk 4.8, so a band outruns them). */
export const WANDER_CELLS = 6;
export const WANDER_PACE = 1.2;
export const CHASE_PACE = 5.5;
/** It sees someone this far off (cells), and gives up the chase this far from where it came. */
export const SEE_CELLS = 6;
export const GIVE_UP_CELLS = 14;
/** Caught: within this many px. Those within `HELP_CELLS` come to help (up to `SKIRMISH_MOST` in all). */
export const CATCH_PX = 22;
export const HELP_CELLS = 4;
export const SKIRMISH_MOST = 4;
/** Without a finished ring wall, a band comes no nearer the camp by day than the town's edge less this (cells); by
 *  night it comes right in. With one, it never crosses it. */
export const DAY_KEEP_OFF = 2;

/** Guards on watch go after a band this many cells beyond the town's edge. */
export const PATROL_REACH = 14;
/** A guard on watch walks out this far beyond the town's edge on their round. */
export const PATROL_OUT = 5;

/** Travellers and visiting bands come so much less often for each band roaming within `UNSAFE_CELLS` of the camp. */
export const ROAM_DETER = 0.35;
export const UNSAFE_CELLS = 40;

/** On a loss, each of the party who went down is killed by what caught them on this chance (the dead and bandits
 *  finish their work; beasts drag one off). */
export const ROAM_KILLS = 0.35;
/** The fight's foes are kept on the snapshot this long after it ends (the victory screen). */
export const SKIRMISH_LINGER = 80;

/** A skirmish's place, shaped as a destination for the fight screen (`wild:<kind>`; sim/expeditions.ts `destinationOf`). */
export const isWildDest = (id: string) => id.startsWith('wild:');
export function wildDestination(id: string): import('./expeditions').Destination {
  const kind = (id.slice(5) as RoamerKind) in ROAMER_NAME ? (id.slice(5) as RoamerKind) : 'beasts';
  return {
    id,
    name: 'the wilds',
    type: 'clear',
    outSeconds: 0,
    workSeconds: 0,
    secondsPerUnit: 1,
    loot: {},
    threats: ROAMER_NAME[kind],
    encounters: { arrival: 0, ambush: 0, groups: [] },
    recommendedParty: 1,
    scenery: kind === 'dead' ? 'thicket' : 'woods',
    description: `Caught by ${ROAMER_NAME[kind]} out on the town's land.`,
  };
}
