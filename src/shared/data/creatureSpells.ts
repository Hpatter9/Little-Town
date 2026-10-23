// The God creature's spells (the owner's ask: "Creature should be able to learn spells based on alignment or from
// watching townsfolk use them. Creature is a curious thing and always learning and adapting."). Its miracles come to it
// by its nature (`NATURE_SPELLS`: a good beast's healing, rain and shield, a cruel one's terror, fire and lightning);
// the rest it picks up by watching a townsperson cast (any spell of data/spells.ts). Every one is a real spell of the
// list, so its effects and the effect it plays (data/actFx.ts) are that spell's. The rules are in sim/creatureSpells.ts.

import { SPELL_BY_ID, type SpellDef } from './spells';

/** What a spell does when it works it in the town (not in a fight). */
export type TownMagic = 'heal' | 'rain' | 'shield' | 'terror' | 'fire' | 'lightning' | 'hunt' | 'bless' | 'show';

export interface NatureSpell {
  /** The spell of data/spells.ts. */
  id: string;
  /** Learned once its good or evil rating reaches `at` (good: at or above; cruel: at or below). */
  at: number;
  town: TownMagic;
}

export const NATURE_SPELLS: readonly NatureSpell[] = [
  { id: 'mend', at: 20, town: 'heal' },
  { id: 'healing_rain', at: 40, town: 'rain' },
  { id: 'holy_shield', at: 60, town: 'shield' },
  { id: 'terror', at: -20, town: 'terror' },
  { id: 'fireball', at: -40, town: 'fire' },
  { id: 'call_lightning', at: -60, town: 'lightning' },
];
export const NATURE_BY_ID: Readonly<Record<string, NatureSpell>> = Object.fromEntries(NATURE_SPELLS.map((n) => [n.id, n]));

/** Whether a rating has reached a nature spell. */
export const natureReaches = (n: NatureSpell, align: number) => (n.at > 0 ? align >= n.at : align <= n.at);

/** What a spell does in the town: a nature spell its own; one learned by watching by what it is for (a mend heals, a
 *  strike hunts game in the wild, a blessing lifts spirits, the rest are a show for the children). */
export function townMagicOf(id: string): TownMagic {
  const n = NATURE_BY_ID[id];
  if (n) return n.town;
  const use = SPELL_BY_ID[id]?.use;
  return use === 'heal' ? 'heal' : use === 'attack' ? 'hunt' : use === 'support' ? 'bless' : 'show';
}

/** How good or cruel working it in the town is (its rating moves by this). */
export const TOWN_ALIGN: Record<TownMagic, number> = { heal: 3, rain: 3, shield: 2, bless: 2, show: 1, hunt: 0, terror: -4, fire: -6, lightning: -5 };
/** The cruel ones are misdeeds: a happy beast works them less, an angry one more. */
export const CRUEL_MAGIC: ReadonlySet<TownMagic> = new Set(['terror', 'fire', 'lightning']);

/** The spell by name (a fight's log names what was cast: sim/combat.ts `acts`). */
export const SPELL_BY_NAME: Readonly<Record<string, SpellDef>> = Object.fromEntries(Object.values(SPELL_BY_ID).map((d) => [d.name, d]));

/** It knows at most this many spells (a new one pushes out the least used). */
export const SPELLS_MOST = 8;
/** A spell seen cast is learned at this chance, times its kind's `learn`, more each time it has seen it before
 *  (`SEEN_BONUS` a sighting, up to `WATCH_MOST`), less the higher the spell's level (`LEVEL_HARD`). */
export const WATCH_LEARN = 0.1;
export const SEEN_BONUS = 0.3;
export const WATCH_MOST = 0.6;
export const LEVEL_HARD = 60;
/** On the raid board it sees what's cast this many tiles away; in the town, a caster this many cells away, and a
 *  caster at home practises in its sight at `PRACTISE_SEEN` an hour. */
export const SIGHT_TILES = 6;
export const SIGHT_CELLS = 10;
export const PRACTISE_SEEN = 0.25;
/** How well it casts (0 to 1): a spell starts at `FIRST_SKILL` (`NATURE_SKILL` for one of its nature), and each use
 *  adds `PRACTICE`. */
export const FIRST_SKILL = 0.2;
export const NATURE_SKILL = 0.4;
export const PRACTICE = 0.05;
/** In a fight its spells hit at this share of its blow (more as it masters them: `spellPower`), and wait this many
 *  times their cooldown: strong, but not the whole battle. */
export const spellPower = (skill: number) => 0.45 + 0.45 * skill;
export const SPELL_SLOW = 1.6;
/** It works a spell in the town no oftener than every `MIRACLE_GAP_HOURS`. */
export const MIRACLE_GAP_HOURS = 5;
