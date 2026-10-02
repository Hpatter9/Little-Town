// Where things are on the world map (assets/World map.jpg, 768x768 pixels): the town, and each expedition
// destination, placed on ground that suits it. The woods are in the forests, the quarries and caves in the
// mountains, the Meteor Crater on the icy island to the north-east, and the Pirate Flagship out at sea. Short
// trips lie near home and long ones far away.

import { BESTIARY_SPOTS } from './bestiary';
import { SCOUT_SPOTS } from './regions';
import { DUNGEON_SPOTS } from './dungeons';

export const MAP_SIZE = 768;

/** The town: in the green country east of the central lake, where the paths meet. */
export const MAP_HOME = { x: 395, y: 410 };

export const MAP_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  // (the new bosses' lairs: data/bestiary.ts)
  ...BESTIARY_SPOTS,
  // (each region's scouting trip goes to its middle: data/regions.ts)
  ...SCOUT_SPOTS,
  ...DUNGEON_SPOTS,
  berry_thicket: { x: 360, y: 470 },
  riverbank: { x: 275, y: 345 },
  deep_woods: { x: 530, y: 360 },
  old_quarry: { x: 240, y: 460 },
  bear_cave: { x: 120, y: 140 },
  iron_hills: { x: 390, y: 150 },
  old_ruins: { x: 215, y: 330 },
  bandit_camp: { x: 90, y: 330 },
  lost_village: { x: 165, y: 600 },
  coal_fields: { x: 230, y: 560 },
  abandoned_mill: { x: 330, y: 260 },
  gang_hideout: { x: 190, y: 220 },
  oil_fields: { x: 610, y: 470 },
  ghost_city: { x: 440, y: 620 },
  militia_compound: { x: 610, y: 590 },
  crater: { x: 620, y: 130 },
  fallen_satellite: { x: 590, y: 300 },
  rogue_foundry: { x: 680, y: 560 },
  dark_keep: { x: 420, y: 70 },
  dragon_lair: { x: 100, y: 650 },
  baron_manor: { x: 300, y: 520 },
  warlord_fort: { x: 650, y: 380 },
  pirate_flagship: { x: 330, y: 690 },
};
