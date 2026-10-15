// Old grudges and old friendships between the peoples (the origins made deeper: every origin). How a power of the realm
// feels about the town by nature, before anything is done, added to its temper's rest (sim/factions.ts), so it drifts
// back there too; and the reason, for the Realm card.

import type { OriginId } from './origins';

type Pair = [OriginId, OriginId, number, string];

/** A pair of peoples, how they stand (−: an old grudge, +: an old friendship), and why. */
export const KINSHIP: readonly Pair[] = [
  ['vampire', 'werewolf', -30, 'the Court and the Pack have been at each other\'s throats since the first moon'],
  ['knights', 'lich', -25, 'the Order swore an oath against the restless dead'],
  ['knights', 'vampire', -20, 'the Order hunts what drinks blood'],
  ['dwarves', 'fae', -20, 'the hold forges cold iron, and the fair folk cannot forgive it'],
  ['druid', 'robot', -20, 'the grove has no love for things that never grew'],
  ['druid', 'alchemists', -10, 'the circle thinks the crucible poisons the earth'],
  ['merfolk', 'nomads', -5, 'the tide and the steppe have never understood each other'],
  ['lich', 'vampire', 10, 'the undead remember their own'],
  ['druid', 'fae', 20, 'the grove and the fair folk share the deep woods'],
  ['dwarves', 'knights', 15, 'the hold armed the Order in the old wars'],
  ['alchemists', 'robot', 15, 'the crucible and the machines both love a good mechanism'],
  ['merfolk', 'druid', 10, 'river and root are old friends'],
  ['nomads', 'werewolf', 10, 'the horde and the pack both run under the open sky'],
  ['orcs', 'dwarves', -30, 'the hold and the horde have warred over the mountains since the first iron'],
  ['orcs', 'knights', -25, 'the Order has hunted orcs from every land it ever held'],
  ['orcs', 'fae', -15, 'the horde burns the fair folk\'s woods for its fires'],
  ['orcs', 'werewolf', 10, 'the horde respects anything that hunts in a pack'],
  ['orcs', 'nomads', 5, 'the horde and the riders have traded horses and blows alike'],
  ['settlers', 'knights', 10, 'plain folk have always looked to the Order for help'],
];

/** How a power of people `them` feels about a town of people `us`, by nature alone. */
export function kinship(us: OriginId, them: OriginId | undefined): { value: number; why: string | null } {
  if (!them) return { value: 0, why: null };
  const k = KINSHIP.find(([a, b]) => (a === us && b === them) || (a === them && b === us));
  return k ? { value: k[2], why: k[3] } : { value: 0, why: null };
}
