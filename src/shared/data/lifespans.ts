// How long each people lives (the owner's request: townsfolk have an age, and a lifespan of their origin's). Days
// are days as a grown-up (sim/ageing.ts counts them from `grownAt`): in their prime until `elderDays`, elders after,
// and from `oldDays` each night may be their last. Years are what the Townsfolk tab shows: `grown` at coming of
// age, `old` at `oldDays`, straight between. The deathless (the undead, machines, vampires, a lich) have none.
import type { OriginId } from './origins';

export interface Lifespan {
  /** What one of them is called ("a dwarf"), and the people ("dwarves"). */
  one: string;
  many: string;
  /** Years old at coming of age, and at old age. */
  grown: number;
  old: number;
  /** Days grown before they're an elder, and before old age may take them. */
  elderDays: number;
  oldDays: number;
}

const human = (one: string, many: string, elderDays = 50, oldDays = 65, grown = 18, old = 70): Lifespan => ({ one, many, grown, old, elderDays, oldDays });

/** The living of each origin (the vampires' and liches' living thralls are human; machines never age). */
export const LIFESPANS: Record<OriginId, Lifespan> = {
  settlers: human('a settler', 'settlers'),
  knights: human('a knight', 'knights'),
  nomads: human('a nomad', 'nomads', 45, 60, 16, 62), // a hard life on the move
  alchemists: human('an alchemist', 'alchemists', 55, 75, 20, 82), // their elixirs
  lich: human('a townsperson', 'the living'),
  vampire: human('a thrall', 'the living'),
  robot: human('a machine', 'machines'), // (never used: machines are tireless)
  druid: human('a druid', 'druids', 60, 80, 18, 92),
  werewolf: human('a werewolf', 'werewolves', 40, 50, 18, 52), // the curse burns bright and short
  merfolk: human('a merrow', 'merfolk', 70, 90, 20, 120),
  dwarves: human('a dwarf', 'dwarves', 100, 130, 50, 250),
  fae: human('a fae', 'the fae', 160, 200, 60, 600),
};

/** The werewolf's curse sets the lifespan whatever the town: it burns the body out. */
export const CURSED_LIFESPAN: Lifespan = LIFESPANS.werewolf;

/** The human span, which the old-age odds are tuned for: a longer-lived people's odds climb that much slower. */
export const HUMAN_OLD_DAYS = 65;
