// How a raid on its way is seen (sim/raidSight.ts): the fog of war hides it until it comes within sight.

/** How far from the town's edge a raid sets out, in land cells: it is seen once it is as near as someone can see. */
export const APPROACH_CELLS = 40;
/** The least warning once it is seen, in ticks (the time to answer: sound the alarm, pay them off): 30 seconds at normal
 *  speed (10 ticks a second). A town with no watch sees them only at the edge and gets this much; towers and gates see them
 *  further out, so they warn earlier still. */
export const SPOTTED_LEAD_TICKS = 300;
/** The vague signs of a landing from the sea ({where}: the quarter it comes from). */
export const SEA_SIGNS: readonly string[] = [
  'Sails on the {where} horizon.',
  'Gulls scatter off the {where} shore, and a dark shape sits on the water.',
  'A ship\'s lantern winks far out to the {where}.',
];
/** The vague signs of an army on the march ({where}: the quarter it comes from). */
export const HOST_SIGNS: readonly string[] = [
  'Drums to the {where}, far off.',
  'A long dust-cloud crawls along the {where} road.',
  'Crows wheel over the {where} hills, and will not come down.',
];
/** The vague signs of something coming, said as the raid sets out ({where}: the quarter it comes from). */
export const RAID_SIGNS: readonly string[] = [
  'Birds rise from the woods to the {where}.',
  'Dust hangs low on the {where} horizon.',
  'The dogs bark toward the {where}, and will not settle.',
  'A hush falls over the {where} fields.',
];
