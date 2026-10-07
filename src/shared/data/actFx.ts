// Which effect plays where a spell or skill lands (the pure choice; renderer/fight/actLooks.ts wraps it): the owner's
// ask that the fights use the effect packs well, with a variety that makes sense, magic above all. The 5000 Pixel
// Effects pack has every element (fire, ice, lightning, light, dark, forest, poison, star, blood, moon, crystal,
// water, earth, wind, sand) in thirty shapes (a bolt, an orb, a burst, a pillar, rain, a nova, spikes, a rune ring,
// an aura, sparkles...), so an act is matched by its element and its shape: what its name says first (a "rain" rains,
// a "nova" rings out, a "ward" is a bubble shield), else what it does (a mend sparkles, a summons opens a circle, a
// curse's arrows fall, a flurry spreads, a blast explodes). Ultimates keep the big Craftpix and pvfx sheets, and a
// plain weapon art is a Craftpix slash. The ids are `px:<element>-<family>` (art/effects.ts has the atlas) or one
// of the older sheets' names.

import { ABILITY_BY_ID } from './abilities';
import type { Effect, Element } from './effects';
import { SPELL_BY_ID } from './spells';

/** The pack's fifteen elements, for each of the game's. */
export const PX_ELEMENT: Record<Element, string> = {
  physical: 'white', fire: 'fire', ice: 'ice', lightning: 'lightning', holy: 'light', dark: 'dark', nature: 'forest', poison: 'poison',
  arcane: 'star', blood: 'blood', time: 'moon', sound: 'crystal', water: 'water', earth: 'earth', wind: 'wind',
};
export type PxFamily = 'hit' | 'burst' | 'slash' | 'bolt' | 'orb' | 'explosion' | 'aura' | 'sparkle' | 'shield' | 'circle' | 'pillar' | 'rain' | 'vortex' | 'wave' | 'puff' | 'status' | 'debuff' | 'spikes' | 'spread' | 'cross' | 'smoke' | 'splash' | 'strike' | 'flame' | 'nova' | 'gather' | 'cut' | 'rune' | 'pool' | 'glyph';
/** The neutral white effects have only these shapes. */
const WHITE: readonly PxFamily[] = ['hit', 'burst', 'cross', 'puff', 'smoke', 'sparkle'];

/** The big sheets an ultimate keeps (Craftpix's Pixel Magic, pvfx and Alenia). */
const ULTIMATE: Record<Element, string[]> = {
  physical: ['slash_gold', 'mg_pop'], fire: ['mg_ground_fire', 'mg_flame', 'mg_flare', 'orchid'], ice: ['frost'], lightning: ['mg_strike', 'shock'],
  holy: ['holy', 'suture'], dark: ['mg_sigil', 'void', 'dark_flames'], nature: ['roots', 'mg_creep', 'leaves'], poison: ['mg_creep', 'venom_ward'],
  arcane: ['mg_shards', 'prism', 'missile'], blood: ['blood_storm', 'blood_bubble'], time: ['hourglass'], sound: ['mg_sparks', 'moths'],
  water: ['splash', 'foam'], earth: ['mg_spikes', 'spines'], wind: ['mg_puff', 'leaves'],
};
/** A weapon art with no element: one of Craftpix's slashes. */
const PLAIN_SLASH = ['slash_gold', 'slash_wind'];

/** What a name says about its shape, tried in order. */
const HINTS: [RegExp, PxFamily][] = [
  [/rain|hail|shower|deluge|downpour/i, 'rain'],
  [/pillar|beam|column|ray\b|lance of light|judgement|smite/i, 'pillar'],
  [/nova|ring of|radiance|burst of/i, 'nova'],
  [/quake|tremor|wave|tide|surge|stomp|slam|rupture/i, 'wave'],
  [/spike|thorn|spine|bramble|stalagmite/i, 'spikes'],
  [/shield|ward|aegis|barrier|protect|bulwark|guard|sanctuary/i, 'shield'],
  [/vortex|whirl|cyclone|maelstrom|tornado|spiral|tempest|storm/i, 'vortex'],
  [/rune|glyph|sigil|seal|hex|circle of|pentacle/i, 'rune'],
  [/explosion|blast|bomb|detonat|cannon|grenade|mortar/i, 'explosion'],
  [/orb|sphere|ball|globe|moon/i, 'orb'],
  [/bolt|arrow|shot|lance|spear|dart|missile|javelin|pierce|needle/i, 'bolt'],
  [/flame|inferno|blaze|immolat|scorch|fire/i, 'flame'],
  [/smoke|fog|mist|cloud|miasma|haze|shadow/i, 'smoke'],
  [/splash|flood|drench|geyser|torrent/i, 'splash'],
  [/volley|barrage|spread|flurry|swarm|fan of|scatter|multishot|shrapnel/i, 'spread'],
  [/\bcross\b|crossing|x-/i, 'cross'],
  [/pool|puddle|ooze|acid|slime|venom/i, 'pool'],
  [/aura|blessing|song|hymn|chant|inspire|anthem|rally|war cry|battle cry|roar/i, 'aura'],
  [/sparkle|heal|mend|cure|restore|regen|renew|salve|balm|grace/i, 'sparkle'],
  [/summon|call|conjure|raise|invoke|portal|gate/i, 'circle'],
  [/gather|charge|focus|drain|siphon|leech|absorb|meditat/i, 'gather'],
  [/strike|thunder|lightning|jolt|zap/i, 'strike'],
  [/slash|cut|cleave|blade|sword|rend|slice|scythe|reap/i, 'slash'],
  [/curse|plague|rot|wither|weaken|doom|blight|debuff|enfeeble/i, 'debuff'],
  [/poison|blind|sleep|lull|daze|stun|silence|freeze|slow/i, 'status'],
  [/mark|brand|omen|fate/i, 'glyph'],
];

const hash = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(list: readonly T[], id: string) => list[hash(id) % list.length];

/** The family by what the act does, when its name says nothing. */
function shapeOf(effects: readonly Effect[], id: string, spell: boolean): PxFamily {
  const strike = effects.find((e) => e.kind === 'damage' || e.kind === 'drain');
  if (effects.some((e) => e.kind === 'revive')) return 'pillar';
  if (!strike && effects.some((e) => e.kind === 'heal' || e.kind === 'cleanse')) return 'sparkle';
  if (!strike && effects.some((e) => e.kind === 'summon')) return 'circle';
  if (strike?.kind === 'drain') return 'gather';
  if (strike) {
    const many = strike.target === 'foes' || strike.target === 'random_foes';
    if (!spell) return many ? pick(['wave', 'spread', 'cross'] as const, id) : pick(['slash', 'cut', 'hit'] as const, id);
    if ((strike.hits ?? 1) > 1) return 'spread';
    return many ? pick(['explosion', 'nova', 'wave', 'rain', 'pillar'] as const, id) : pick(['bolt', 'orb', 'hit', 'burst', 'strike'] as const, id);
  }
  const bad = effects.filter((e) => e.kind === 'status' && (e.target === 'foe' || e.target === 'foes' || e.target === 'random_foes'));
  if (bad.length) return pick(['debuff', 'status', 'glyph', 'rune'] as const, id);
  if (effects.some((e) => e.kind === 'dispel')) return 'puff';
  if (effects.some((e) => e.status === 'shield' || e.status === 'protect' || e.status === 'reflect')) return 'shield';
  return pick(['aura', 'sparkle', 'circle'] as const, id);
}

const cache = new Map<string, string>();
/** The effect for a spell or skill (by id): `px:<element>-<family>`, or an older sheet's name. */
export function actFx(id: string): string {
  const got = cache.get(id);
  if (got) return got;
  const spell = SPELL_BY_ID[id];
  const ability = ABILITY_BY_ID[id];
  const effects: readonly Effect[] = spell?.effects ?? ability?.active?.effects ?? [];
  const name = spell?.name ?? ability?.name ?? id;
  const strike = effects.find((e) => e.kind === 'damage' || e.kind === 'drain');
  const element = effects.find((e) => e.element)?.element;
  let fx: string;
  if (ability?.ultimate) fx = pick(ULTIMATE[element ?? 'arcane'], id);
  else if (!spell && strike && (!element || element === 'physical') && !HINTS.some(([re, fam]) => re.test(name) && fam !== 'slash' && fam !== 'cut')) fx = pick(PLAIN_SLASH, id);
  else {
    let family = HINTS.find(([re]) => re.test(name))?.[1] ?? shapeOf(effects, id, !!spell);
    // (a heal named for the sword, a ward named for the storm: the deed wins over a misleading name)
    const does = shapeOf(effects, id, !!spell);
    if ((does === 'sparkle' || does === 'shield' || does === 'circle') && !['sparkle', 'shield', 'circle', 'aura', 'pillar', 'rune', 'rain', 'nova', 'vortex', 'orb', 'smoke'].includes(family)) family = does;
    const px = PX_ELEMENT[element ?? (strike ? 'physical' : effects.some((e) => e.kind === 'heal' || e.kind === 'revive') ? 'holy' : 'arcane')];
    if (px === 'white' && !WHITE.includes(family)) fx = `px:${family === 'slash' || family === 'cut' ? 'star' : 'white'}-${WHITE.includes(family) ? family : family === 'slash' || family === 'cut' ? family : 'hit'}`;
    else fx = `px:${px}-${family}`;
  }
  cache.set(id, fx);
  return fx;
}

export const PX_FAMILIES: readonly PxFamily[] = ['hit', 'burst', 'slash', 'bolt', 'orb', 'explosion', 'aura', 'sparkle', 'shield', 'circle', 'pillar', 'rain', 'vortex', 'wave', 'puff', 'status', 'debuff', 'spikes', 'spread', 'cross', 'smoke', 'splash', 'strike', 'flame', 'nova', 'gather', 'cut', 'rune', 'pool', 'glyph'];
