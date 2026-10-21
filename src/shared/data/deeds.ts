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
  | 'bouts' // bouts won in the arena
  | 'watched' // sneaks caught on the night watch
  | 'campaigns'; // campaigns of the realm's wars fought and won (sim/war/campaigns.ts)

export interface DeedLadder {
  /** What the deed is called on the People page ("Raids defended"). */
  label: string;
  /** The steps: how many, and the title that comes with it. */
  steps: readonly (readonly [number, string])[];
}

/** How many of a deed each title takes (raised in 0.162: a first title now takes a real run of deeds, about two and a
 *  half times what it did, and the top rung is rare). Titles already won are kept. */
export const DEED_STEPS: Record<DeedKind, readonly number[]> = {
  defended: [5, 15, 40],
  built: [12, 40, 100],
  crafted: [25, 80, 200],
  healed: [8, 25, 60],
  studied: [8, 20, 45],
  bosses: [2, 5, 10],
  delves: [2, 5, 10],
  sagas: [2, 5],
  beasts: [8, 25, 60],
  bouts: [3, 10, 25],
  watched: [5, 15, 35],
  campaigns: [2, 5, 10],
};

const ladder = (kind: DeedKind, label: string, titles: string[]): DeedLadder => ({ label, steps: titles.map((t, i) => [DEED_STEPS[kind][i], t] as const) });

export const DEED_TITLES: Record<DeedKind, DeedLadder> = {
  defended: ladder('defended', 'Raids defended', ['the Steadfast', 'Wall of the Town', 'Shield of the People']),
  built: ladder('built', 'Buildings raised', ['the Builder', 'Master Builder', 'Raiser of Halls']),
  crafted: ladder('crafted', 'Pieces made', ['the Handy', 'Master Crafter', 'the Artificer']),
  healed: ladder('healed', 'Lives tended', ['the Mender', 'Bonesetter', 'Hand of Mercy']),
  studied: ladder('studied', 'Topics learned', ['the Learned', 'Sage', 'Keeper of Lore']),
  bosses: ladder('bosses', 'Bosses felled', ['Giantsbane', 'Bane of Monsters', 'the Legend']),
  delves: ladder('delves', 'Dungeons cleared', ['Delver', 'Deepwalker', 'Lord of the Depths']),
  sagas: ladder('sagas', 'Sagas ended', ['the Storied', 'Hero of Tales']),
  beasts: ladder('beasts', 'Beasts raised', ['Friend of Beasts', 'Beastmaster', 'Lord of the Menagerie']),
  bouts: ladder('bouts', 'Arena bouts won', ['the Brawler', 'Gladiator', 'Champion of the Sand']),
  watched: ladder('watched', 'Sneaks caught on the watch', ['the Watchful', 'Nightwarden', 'Warden of the Dark']),
  campaigns: ladder('campaigns', 'Campaigns won', ['the Veteran', 'Warhorse', 'Marshal of the Realm']),
};

export const DEED_KINDS = Object.keys(DEED_TITLES) as DeedKind[];
