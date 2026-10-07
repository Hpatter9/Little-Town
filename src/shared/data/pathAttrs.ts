// How a townsperson's stat points are spent when they're left to choose (the owner's ask: it should follow the
// calling they chose). Each path node leans the archetype's growth (`GROWTH` in data/attributes.ts, by class) its own
// way: a Berserker all strength, a Titan's bulk, a Sharpshooter's eye, a Coven Mother's charm, the Summoner line's
// mind and charm. A node without a lean of its own takes the nearest up its road; the base callings take the
// archetype's growth as it is.

import { ATTR_KEYS, classAttrs, type Attrs } from './attributes';
import { lineage, PATH_BY_ID } from './paths';
import type { ClassId } from './classes';

type Lean = Partial<Attrs>;
const L = (str = 0, dex = 0, vit = 0, int = 0, wis = 0, cha = 0): Lean => ({ str, dex, vit, int, wis, cha });

/** Each node's lean: added to the archetype's shares (which sum to 1), then made shares again. */
export const LEANS: Record<string, Lean> = {
  // the Fighter's roads
  knight: L(0.1, 0, 0.15, 0, 0.1, 0.05), paladin: L(0.05, 0, 0.1, 0, 0.25, 0.1), crusader: L(0.2, 0, 0.1, 0, 0.1, 0.05), templar: L(0.05, 0, 0.1, 0.1, 0.25, 0.1),
  dragoon: L(0.15, 0.2, 0.05), wyvern_knight: L(0.1, 0.3, 0.05), lance_captain: L(0.2, 0.1, 0.1, 0, 0, 0.15),
  berserker: L(0.35, 0.05, 0.1), warlord: L(0.2, 0, 0.1, 0.05, 0.05, 0.2), titan: L(0.2, 0, 0.35), warchief: L(0.15, 0, 0.15, 0, 0.05, 0.25),
  blood_reaver: L(0.3, 0.1, 0.05), blood_lord: L(0.2, 0, 0.15, 0.05, 0, 0.2), gorefiend: L(0.3, 0.05, 0.2),
  // the Guard's
  sentinel: L(0.05, 0.05, 0.25, 0, 0.1), bulwark: L(0.05, 0, 0.4), aegis: L(0, 0, 0.3, 0, 0.25, 0.05), colossus: L(0.25, 0, 0.35), gatewarden: L(0.1, 0.1, 0.25, 0, 0.1), ironwall: L(0, 0, 0.45, 0, 0.1),
  shield_saint: L(0, 0, 0.25, 0, 0.3, 0.1),
  spellsword: L(0.15, 0.1, 0, 0.2), battlemage: L(0.1, 0.05, 0.05, 0.3), arcane_knight: L(0.1, 0, 0.15, 0.25), stormblade: L(0.1, 0.25, 0, 0.2), rune_knight: L(0.15, 0, 0.15, 0.2, 0.05), runeguard: L(0.05, 0, 0.3, 0.15, 0.1), hexblade: L(0.15, 0.1, 0, 0.2, 0, 0.1),
  // the Scout's
  archer: L(0, 0.3, 0.05), sharpshooter: L(0, 0.4), hawkeye: L(0, 0.35, 0, 0, 0.15), deadeye: L(0, 0.45, 0, 0.05),
  gunner: L(0.05, 0.25, 0.05, 0.15), musketeer: L(0.05, 0.3, 0.05, 0.1), artillerist: L(0.1, 0.15, 0.05, 0.3),
  ranger: L(0.05, 0.25, 0.1, 0, 0.1), hunter: L(0.15, 0.25, 0.1), beast_slayer: L(0.25, 0.2, 0.1), monster_hunter: L(0.2, 0.2, 0.15, 0.05),
  beast_tamer: L(0, 0.1, 0.1, 0, 0.2, 0.2), beastmaster: L(0.05, 0.1, 0.1, 0, 0.15, 0.3), packleader: L(0.1, 0.1, 0.15, 0, 0.1, 0.3),
  // the Rogue's
  assassin: L(0.1, 0.3), shadow: L(0, 0.4, 0, 0.05), nightblade: L(0.15, 0.3), phantom: L(0, 0.4, 0, 0.1, 0.05), venomist: L(0, 0.2, 0, 0.25), toxicant: L(0, 0.15, 0.05, 0.3), widowmaker: L(0.1, 0.3, 0, 0.15),
  duelist: L(0.1, 0.3, 0, 0, 0, 0.1), samurai: L(0.2, 0.2, 0, 0, 0.1), kensei: L(0.15, 0.25, 0, 0, 0.15), iaijutsu_master: L(0.1, 0.4, 0, 0, 0.1),
  blade_dancer: L(0.05, 0.35, 0, 0, 0, 0.15), mirage: L(0, 0.35, 0, 0.1, 0, 0.15), whirling_dervish: L(0.1, 0.35, 0.1, 0, 0, 0.1),
  // the Apprentice's
  elementalist: L(0, 0.05, 0, 0.35, 0.05), archmage: L(0, 0, 0, 0.45, 0.1), pyromancer: L(0, 0.1, 0, 0.4), cryomancer: L(0, 0, 0.05, 0.3, 0.15),
  chronomancer: L(0, 0.2, 0, 0.2, 0.15), time_weaver: L(0, 0.15, 0, 0.2, 0.25), fatespinner: L(0, 0.1, 0, 0.2, 0.2, 0.15),
  occultist: L(0, 0, 0, 0.3, 0.15, 0.1), witch: L(0, 0, 0, 0.25, 0.2, 0.15), hexer: L(0, 0.05, 0, 0.3, 0.05, 0.2), coven_mother: L(0, 0, 0.05, 0.15, 0.2, 0.3),
  necromancer: L(0, 0, 0.1, 0.3, 0.1, 0.1), deathcaller: L(0, 0, 0.05, 0.25, 0.1, 0.25), lich_adept: L(0, 0, 0.2, 0.35, 0.1),
  // the Acolyte's
  priest: L(0, 0, 0.05, 0.1, 0.3, 0.1), cleric: L(0.1, 0, 0.15, 0, 0.25, 0.05), high_priest: L(0, 0, 0.05, 0.1, 0.3, 0.2), hierophant: L(0, 0, 0, 0.2, 0.3, 0.15),
  inquisitor: L(0.15, 0.05, 0.1, 0.05, 0.2), witch_hunter: L(0.1, 0.25, 0.05, 0.05, 0.15), exorcist: L(0, 0, 0.1, 0.1, 0.3, 0.15),
  monk: L(0.15, 0.25, 0.1, 0, 0.1), master: L(0.1, 0.3, 0.1, 0, 0.15), grandmaster: L(0.15, 0.3, 0.1, 0, 0.2), fist_of_light: L(0.1, 0.2, 0.1, 0, 0.3, 0.05),
  shaman: L(0, 0.05, 0.05, 0.15, 0.25, 0.1), witch_doctor: L(0, 0, 0.1, 0.2, 0.2, 0.15), spirit_chief: L(0.05, 0, 0.1, 0.1, 0.2, 0.3),
  // the Wanderer's
  druid: L(0, 0.05, 0.05, 0.15, 0.25, 0.05), archdruid: L(0, 0, 0.05, 0.2, 0.35, 0.05), green_sage: L(0, 0, 0.1, 0.1, 0.4), stormcaller: L(0, 0.1, 0, 0.35, 0.15),
  shapeshifter: L(0.2, 0.15, 0.2), primal: L(0.3, 0.1, 0.25), manyform: L(0.15, 0.25, 0.15, 0, 0.1),
  summoner: L(0, 0, 0, 0.25, 0.15, 0.25), conjurer: L(0, 0, 0, 0.35, 0.1, 0.2), elementarch: L(0, 0, 0, 0.4, 0.1, 0.2), voidbinder: L(0, 0, 0.05, 0.35, 0, 0.3),
  beastcaller: L(0, 0, 0.05, 0.15, 0.25, 0.3), drake_tamer: L(0, 0, 0.15, 0.15, 0.15, 0.3), lord_of_hosts: L(0, 0, 0.05, 0.2, 0.15, 0.4),
  // the Minstrel's
  bard: L(0, 0.15, 0, 0.1, 0.1, 0.3), skald: L(0.2, 0.05, 0.1, 0, 0.05, 0.25), maestro: L(0, 0.1, 0, 0.25, 0.1, 0.3), warsinger: L(0.25, 0.1, 0.1, 0, 0, 0.3),
  dancer: L(0, 0.3, 0, 0, 0.05, 0.2), muse: L(0, 0.15, 0, 0.1, 0.2, 0.3), fire_dancer: L(0, 0.3, 0, 0.2, 0, 0.15),
  tinker: L(0, 0.2, 0, 0.3), alchemist: L(0, 0.15, 0.05, 0.35), bombardier: L(0.05, 0.3, 0.05, 0.25), philosopher: L(0, 0, 0, 0.35, 0.3),
  artificer: L(0.05, 0.15, 0.05, 0.35), machinist: L(0.1, 0.2, 0.1, 0.3), clockwork_sage: L(0, 0.1, 0, 0.35, 0.3),
};

const cache = new Map<string, Attrs>();
/** The shares a townsperson's points are spent by: their archetype's growth leaned the way of their road (the
 *  nearest node up it with a lean; an ascended form keeps its road's). Without a road, the archetype's alone. */
export function roadAttrs(cls: ClassId | null | undefined, road: string | null | undefined): Attrs {
  const base = classAttrs(cls);
  if (!road || !PATH_BY_ID[road]) return base;
  const key = `${cls ?? ''}|${road}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let lean: Lean | undefined;
  for (const n of lineage(road).reverse()) if ((lean = LEANS[n.id])) break;
  const out = { ...base };
  if (lean) {
    let sum = 0;
    for (const k of ATTR_KEYS) sum += out[k] = base[k] + (lean[k] ?? 0);
    for (const k of ATTR_KEYS) out[k] /= sum;
  }
  cache.set(key, out);
  return out;
}

/** The attributes a road favours most, best first (for "left to themselves, they'd put points into..."). */
export function roadFavours(cls: ClassId | null | undefined, road: string | null | undefined, n = 2): (keyof Attrs)[] {
  const w = roadAttrs(cls, road);
  return [...ATTR_KEYS].sort((a, b) => w[b] - w[a]).slice(0, n);
}
