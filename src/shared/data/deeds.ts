// Titles earned by deeds (the owner's ask: titles from accomplishments, not only kills and trips).
// Each deed a townsperson does is counted on `Person.deeds` (sim/deeds.ts); at each step of its ladder they
// take that step's title (`DEED_TITLES`), and keep the ones they had.

export type DeedKind =
  | 'defended' // raids beaten off with them in the fight
  | 'built' // buildings finished with their hands on them
  | 'crafted' // pieces made at a station
  | 'healed' // bleeding stopped and surgeries done
  | 'studied' // topics learned at their desk
  | 'bosses' // bosses brought down
  | 'delves' // dungeons cleared
  | 'sagas' // sagas ended as their hero
  | 'beasts' // beasts bred and trained at the ranch, as its Beastmaster
  | 'bouts'; // bouts won in the arena

export interface DeedLadder {
  /** What the deed is called on the People page ("Raids defended"). */
  label: string;
  /** The steps: how many, and the title that comes with it. */
  steps: readonly (readonly [number, string])[];
}

export const DEED_TITLES: Record<DeedKind, DeedLadder> = {
  defended: { label: 'Raids defended', steps: [[2, 'the Steadfast'], [6, 'Wall of the Town'], [15, 'Shield of the People']] },
  built: { label: 'Buildings raised', steps: [[5, 'the Builder'], [15, 'Master Builder'], [40, 'Raiser of Halls']] },
  crafted: { label: 'Pieces made', steps: [[10, 'the Handy'], [30, 'Master Crafter'], [80, 'the Artificer']] },
  healed: { label: 'Lives tended', steps: [[3, 'the Mender'], [10, 'Bonesetter'], [25, 'Hand of Mercy']] },
  studied: { label: 'Topics learned', steps: [[3, 'the Learned'], [8, 'Sage'], [20, 'Keeper of Lore']] },
  bosses: { label: 'Bosses felled', steps: [[1, 'Giantsbane'], [3, 'Bane of Monsters'], [6, 'the Legend']] },
  delves: { label: 'Dungeons cleared', steps: [[1, 'Delver'], [3, 'Deepwalker'], [6, 'Lord of the Depths']] },
  sagas: { label: 'Sagas ended', steps: [[1, 'the Storied'], [3, 'Hero of Tales']] },
  beasts: { label: 'Beasts raised', steps: [[3, 'Friend of Beasts'], [10, 'Beastmaster'], [25, 'Lord of the Menagerie']] },
  bouts: { label: 'Arena bouts won', steps: [[1, 'the Brawler'], [4, 'Gladiator'], [10, 'Champion of the Sand']] },
};

export const DEED_KINDS = Object.keys(DEED_TITLES) as DeedKind[];
