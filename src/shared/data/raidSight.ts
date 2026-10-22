// How a raid on its way is seen (sim/raidSight.ts): the fog of war hides it until it comes within sight.

/** How far from the town's edge a raid sets out, in land cells: it is seen once it is as near as someone can see. */
export const APPROACH_CELLS = 40;
/** The least warning once it is seen, in ticks (the time to answer: sound the alarm, pay them off). */
export const SPOTTED_LEAD_TICKS = 50;
/** The vague signs of something coming, said as the raid sets out ({where}: the quarter it comes from). */
export const RAID_SIGNS: readonly string[] = [
  'Birds rise from the woods to the {where}.',
  'Dust hangs low on the {where} horizon.',
  'The dogs bark toward the {where}, and will not settle.',
  'A hush falls over the {where} fields.',
];
