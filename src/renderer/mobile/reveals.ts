// The pure part of the phone's reveals (mobile/revealCard.ts draws them): which rare things in the snapshot's record
// (`snapshot.rare`, sim/rare.ts) are new since the phone last looked, the words for each card, and a party's haul put in
// the order a chest opens (the commonest first, the best last). No DOM, so the tests read it.

import { DEED_KINDS, DEED_TITLES } from '../../shared/data/deeds';
import { ENEMIES } from '../../shared/data/enemies';
import { ITEM_BY_ID } from '../../shared/data/items';
import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { MYTHIC_CALLINGS, mythicId } from '../../shared/data/mythic';
import { SAGA_BY_ID } from '../../shared/data/sagas';
import { SPECIALS, type SpecialId } from '../../shared/data/specials';
import { WORTH } from '../../shared/data/trade';
import { DEPTH_BY_N } from '../../shared/data/underdark';
import type { RareView } from '../../shared/sim/rare';

/** A card's colour: violet for a mythic, gold for a unique or a legend, the dark's red for what came out of it. */
export type RevealTone = 'mythic' | 'unique' | 'legend' | 'dark' | 'gold';

/** What a reveal card says (its picture is found by `art`: mobile/revealCard.ts). */
export interface RevealWords {
  /** One id a card, never shown twice. */
  key: string;
  /** The small line over the name ("A mythic calling"). */
  kind: string;
  title: string;
  lore?: string;
  /** In the game's voice, how rare it is ("Few towns ever see one"). */
  rarity?: string;
  tone: RevealTone;
  /** The picture: an enemy's sprite, a calling's emblem, an item's icon, or a stat icon by name. */
  art?: { foe?: string; emblem?: string; item?: string; icon?: string };
}

/** The special newcomers whose secret, found out, is a legend rather than a trouble. */
const LEGENDARY_SPECIALS: ReadonlySet<string> = new Set<SpecialId>(['veiled', 'archmage', 'heir']);
const DRAGON_SEEN = ['omen', 'demand', 'paid', 'wrath', 'driven', 'slain'];

/** A unique's line of lore (its description, before the numbers). */
export const uniqueLore = (id: string): string => (ITEM_BY_ID[id]?.description ?? '').split(' Unique ')[0];

/** The mythic tree a base id belongs to (`my_<id>`). */
export const mythicTreeOf = (road: string) => MYTHIC_CALLINGS.find((t) => mythicId(t.base.id) === road);

/** Every rare thing in the record, as the cards it would show (oldest first). A thing comes once: the keys say so. */
export function revealsOf(r: RareView, who: { titled: (title: string) => string | null; dragonLair?: string | null } = { titled: () => null }): RevealWords[] {
  const out: RevealWords[] = [];
  for (const m of r.mythics) {
    const t = mythicTreeOf(m.road);
    if (!t) continue;
    out.push({ key: `mythic:${m.id}`, kind: 'A mythic calling', title: m.who ? `${m.who}, ${t.base.name}` : t.base.name, lore: t.base.text, rarity: 'Few towns ever see one. The old powers give this to perhaps one in four hundred.', tone: 'mythic', art: { emblem: m.road } });
  }
  for (const id of r.uniques) {
    const def = ITEM_BY_ID[id];
    if (!def) continue;
    out.push({ key: `unique:${id}`, kind: 'A unique weapon', title: def.name, lore: uniqueLore(id), rarity: 'There is no other like it in all the world.', tone: 'unique', art: { item: id } });
  }
  for (const sp of r.specials) {
    if (!LEGENDARY_SPECIALS.has(sp.id)) continue;
    const d = SPECIALS[sp.id as SpecialId];
    if (!d) continue;
    out.push({ key: `special:${sp.id}`, kind: 'A legend at the gate', title: d.name, lore: d.truth.replace(/\{name\}/g, sp.who ?? 'The newcomer'), rarity: 'Not every wanderer who comes to the gate is only a wanderer. Most towns never learn the difference.', tone: 'legend', art: { icon: 'people' } });
  }
  for (const g of r.sagas) {
    const def = SAGA_BY_ID[g.id];
    if (!def) continue;
    const how = g.outcome === 'triumph' ? 'ended in triumph' : g.outcome === 'bittersweet' ? 'ended, at a cost' : 'ended in ruin';
    out.push({ key: `saga:${g.id}:${g.tick}`, kind: `A saga ${how}`, title: def.title, lore: g.hero ? `${def.blurb} Its hero: ${g.hero}.` : def.blurb, rarity: 'A tale the town will tell for as long as it stands.', tone: g.outcome === 'ruin' ? 'dark' : 'gold', art: { icon: 'quests' } });
  }
  for (const d of r.dwellers) {
    const depth = DEPTH_BY_N[d.depth];
    if (!depth) continue;
    out.push({ key: `dweller:${d.depth}`, kind: 'A dweller of the Underdark slain', title: ENEMIES[depth.dweller]?.name ?? 'The dweller', lore: `It guarded the way on down through ${depth.name}. Its hoard is the town's now.`, rarity: 'Few towns ever dig so deep, and fewer come back up.', tone: 'dark', art: { foe: depth.dweller } });
  }
  if (r.dragon && DRAGON_SEEN.includes(r.dragon.phase)) {
    const name = ENEMIES[r.dragon.kind]?.name ?? 'The Dragon';
    out.push({ key: `dragon:${r.dragon.kind}`, kind: 'A dragon sighted', title: name, lore: who.dragonLair ? `It has made its lair in ${who.dragonLair}, and it has seen the town.` : 'It has seen the town.', rarity: 'Most towns only ever hear of one in songs.', tone: 'dark', art: { foe: r.dragon.kind } });
    if (r.dragon.phase === 'slain') out.push({ key: `dragon-slain:${r.dragon.kind}`, kind: 'The dragon is slain', title: name, lore: 'The hills are quiet. Its bones will be shown to children for a hundred years.', rarity: 'It will be sung of for generations.', tone: 'legend', art: { foe: r.dragon.kind } });
  }
  for (const title of r.deeds) {
    const kind = DEED_KINDS.find((k) => DEED_TITLES[k].steps.some(([, t]) => t === title));
    const holder = who.titled(title);
    out.push({ key: `deed:${title}`, kind: 'A legendary deed', title: holder ? `${holder} ${title}` : title, lore: kind ? `${DEED_TITLES[kind].label}: ${DEED_TITLES[kind].steps[DEED_TITLES[kind].steps.length - 1][0]}, the top of the ladder.` : undefined, rarity: 'Few in any town ever earn it.', tone: 'gold', art: { icon: 'age' } });
  }
  return out;
}

/** The reveals not yet known (the keys the phone has shown or passed by). */
export const freshReveals = (all: readonly RevealWords[], known: ReadonlySet<string>): RevealWords[] => all.filter((w) => !known.has(w.key));

/** One thing in a haul, as the chest gives it up. */
export interface HaulLine {
  /** A material, or an item's id (a unique). */
  id: string;
  name: string;
  n: number;
  /** The rare one: last, after a pause, with a glow. */
  rare?: boolean;
  unique?: boolean;
}

/** A material's worth for the chest's order (an unknown one counts as plain). */
const worth = (m: string) => WORTH[m as Material] ?? 1;
/** The worth a material needs to glow at the end of the chest (gold, gems, a monster's heart...). */
export const RARE_WORTH = 9;

/** A haul in the order a chest opens: the commonest first, the dearest last; any unique after all of it. The last line
 *  glows when it's a unique, or dear enough. */
export function haulOrder(loot: Stock, uniques: readonly string[] = []): HaulLine[] {
  const mats = (Object.entries(loot) as [Material, number][])
    .filter(([m, n]) => n > 0 && MATERIAL_NAMES[m])
    .sort((a, b) => worth(a[0]) - worth(b[0]) || a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([m, n]): HaulLine => ({ id: m, name: MATERIAL_NAMES[m] ?? m, n: Math.round(n) }));
  const out = [...mats, ...uniques.map((id): HaulLine => ({ id, name: ITEM_BY_ID[id]?.name ?? id, n: 1, unique: true }))];
  const last = out[out.length - 1];
  if (last && (last.unique || worth(last.id) >= RARE_WORTH)) last.rare = true;
  return out;
}
