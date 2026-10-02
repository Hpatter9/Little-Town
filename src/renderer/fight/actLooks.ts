// Which effect sheet plays where a spell or skill lands, in the watched fights and on the raid's battle map: a skill
// that strikes is a slash in its element (Craftpix's Magic Slash pack), a spell one of the magic sheets for its
// element (Craftpix's Pixel Magic Sprite Effects and the older pvfx and Alenia sheets); mending is the healing glow.

import { ABILITY_BY_ID } from '../../shared/data/abilities';
import type { Effect, Element } from '../../shared/data/effects';
import { SPELL_BY_ID } from '../../shared/data/spells';
import type { SpriteFx } from '../town/spellLooks';

const SLASH: Record<Element, SpriteFx> = {
  physical: 'slash_gold', fire: 'slash_fire', lightning: 'slash_lightning', water: 'slash_water', ice: 'slash_water',
  poison: 'slash_poison', blood: 'slash_poison', dark: 'slash_poison', arcane: 'slash_poison', wind: 'slash_wind',
  nature: 'slash_wind', earth: 'slash_wind', sound: 'slash_wind', holy: 'slash_gold', time: 'slash_lightning',
};
/** Each element's spells; two looks where there are two, picked by the spell. */
const MAGIC: Record<Element, SpriteFx[]> = {
  physical: ['mg_pop', 'mg_bolt2'], fire: ['mg_ground_fire', 'mg_flame', 'mg_flare', 'orchid'], ice: ['frost'], lightning: ['mg_strike', 'shock'],
  holy: ['holy', 'suture'], dark: ['mg_sigil', 'void', 'dark_flames'], nature: ['roots', 'mg_creep', 'leaves'], poison: ['mg_creep', 'venom_ward'],
  arcane: ['mg_shards', 'prism', 'missile'], blood: ['blood', 'blood_bubble'], time: ['hourglass'], sound: ['mg_sparks', 'moths'],
  water: ['splash', 'foam'], earth: ['mg_spikes', 'spines'], wind: ['mg_puff', 'leaves'],
};

const hash = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cache = new Map<string, SpriteFx>();

/** The effect played on whoever a spell or skill (by id) touched. */
export function actSprite(id: string): SpriteFx {
  const got = cache.get(id);
  if (got) return got;
  const spell = SPELL_BY_ID[id];
  const effects: readonly Effect[] = spell?.effects ?? ABILITY_BY_ID[id]?.active?.effects ?? [];
  const strike = effects.find((e) => e.kind === 'damage' || e.kind === 'drain');
  const element = effects.find((e) => e.element)?.element;
  let fx: SpriteFx;
  if (!strike && effects.some((e) => e.kind === 'heal' || e.kind === 'revive')) fx = effects.some((e) => e.kind === 'revive') ? 'life_fountain' : 'heal';
  else if (!strike && effects.some((e) => e.kind === 'summon')) fx = 'conjure';
  // (a blessing on their own side: a ward or a charge of strength)
  else if (!strike && !element && effects.every((e) => e.target !== 'foe' && e.target !== 'foes' && e.target !== 'random_foes')) fx = hash(id) % 2 ? 'parry' : 'charge';
  else if (!spell && strike) fx = SLASH[element ?? 'physical'];
  else {
    const list = MAGIC[element ?? 'arcane'];
    fx = list[hash(id) % list.length];
  }
  cache.set(id, fx);
  return fx;
}

const byName = new Map<string, string>();
/** A spell's or skill's id by its name (the fights log names). */
export function actIdOf(name: string): string {
  if (!byName.size) {
    for (const sp of Object.values(SPELL_BY_ID)) byName.set(sp.name, sp.id);
    for (const a of Object.values(ABILITY_BY_ID)) byName.set(a.name, a.id);
  }
  return byName.get(name) ?? '';
}
