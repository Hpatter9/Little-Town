// Taming a beast in a fight (the owner's ask: it shouldn't work every time; the tamer's level, the creature's kind and
// difficulty, and more besides should play in). A Beast Tamer tries for a beast in reach now and then (`TAME_EVERY`
// in classes.ts), and the try is a roll at `tameChance`: the tamer's power (their level, their calling's stage and
// their skill with animals) against the beast's might (its tier, from its health as it stands in this raid, so a
// seasoned raid's beasts are harder) and its kind (the easy to gentle, the wild hard, a dragon's kind very hard; no boss
// ever), better the more it's been hurt, and worse each time it's been tried (it grows wary). A tamer holds only so many
// at once (`tamedMost`).

/** The chance at an even match, and how much each point of power over (or under) the beast's might moves it. */
export const TAME_BASE = 0.4;
export const TAME_PER_POINT = 0.06;
/** The least and most a try can have. */
export const TAME_LEAST = 0.03;
export const TAME_MOST = 0.85;
/** A beast hurt to nothing is this much easier (scaled by the share of its health gone). */
export const TAME_HURT = 0.9;
/** Each failed try makes the next on the same beast this much less likely. */
export const TAME_WARY = 0.12;

/** A beast's tier (1 to 10) from its health: a tier-1 creature has about 25, a tier-10 about 360. */
export const tierOf = (maxHp: number): number => Math.max(1, Math.min(10, 1 + (9 * (maxHp - 25)) / 335));

/** The kinds that take to a hand (+, easier) or don't (-, harder), by their names: worth that many points of might. */
const KINDS: [RegExp, number][] = [
  [/wolf|dog|hound|jackal|fox|boar|goat|ram|horse|pony|cat|lynx|hawk|falcon|owl|raven|crow|rat|bat/, -2],
  [/bear|lion|tiger|panther|leopard|crocodile|croc|snake|serpent|spider|scorpion|beetle|wasp|bee|ant\b/, 0],
  [/drake|wyvern|griffin|gryphon|basilisk|manticore|chimera|hydra|troll|ogre|yeti|mammoth|behemoth/, 3],
  [/dragon|wyrm|kraken|leviathan|phoenix|titan|elder|ancient/, 6],
];
export const kindPoints = (kind: string): number => KINDS.find(([re]) => re.test(kind))?.[1] ?? 1;

/** A beast's might against a tamer: its tier, doubled, and its kind's points. */
export const mightOf = (kind: string, maxHp: number): number => tierOf(maxHp) * 2 + kindPoints(kind);

/** A tamer's power: a point every 5 levels, two for each stage of their calling past the first, and a point for every
 *  ten levels of their skill with animals. */
export const tamerPower = (level: number, stage: number, animals: number): number => level / 5 + stage * 2 + animals / 10;

/** The chance one try tames the beast. */
export function tameChance(power: number, kind: string, maxHp: number, hp: number, tries: number): number {
  const hurt = 1 + TAME_HURT * (1 - Math.max(0, Math.min(1, hp / Math.max(1, maxHp))));
  const even = TAME_BASE + (power - mightOf(kind, maxHp)) * TAME_PER_POINT;
  return Math.max(TAME_LEAST, Math.min(TAME_MOST, even * hurt - tries * TAME_WARY));
}

/** How many beasts a tamer holds at once, by their calling's stage (0 to 4). */
export const tamedMost = (stage: number): number => 1 + Math.floor(stage / 2);
