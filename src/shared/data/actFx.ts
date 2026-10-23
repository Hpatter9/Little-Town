// Which effect plays where a spell or skill lands (the pure choice; renderer/fight/actLooks.ts wraps it): the owner's
// asks that the fights use the effect packs well, with a variety that makes sense, and that each effect matches the
// skill or the reason it went off. The 5000 Pixel Effects pack has every element (fire, ice, lightning, light, dark,
// forest, poison, star, blood, moon, crystal, water, earth, wind, sand) in thirty shapes (a bolt, an orb, a burst, a
// pillar, rain, a nova, spikes, a rune ring, a dome, sparkles...). An act is matched by what it does first, then by
// its element and its shape:
//   - a mend sparkles up in light, a cleansing rings out, a raising is a pillar, a summons opens a circle;
//   - a ward or a shield is a dome (the pack's filled disc would hide the one it guards); another blessing is a ring
//     at the feet with a small icon over the head (`STATUS_CUE`: an arrow up for Inspired, a red cross for Berserk);
//   - a hindrance shows what it is: stars for a stun, smoke and "zzz" for sleep, roots for a hold, falling arrows for
//     a weakening, a flash for a blinding, a glyph for a doom;
//   - a blade is a slash, a club or a fist a thud, claws an X, an arrow its landing (the arrow itself flies);
//   - a spell's strike by its name (a "rain" rains, a "nova" rings out) else a bolt, orb or burst; on all of them an
//     explosion, a nova, a wave or rain.
// An act with no element of its own takes one from what it inflicts or its name (Bone Armour is dark, Barkskin forest,
// a poison cloud poison), never the old catch-all arcane. Ultimates keep the big Craftpix and pvfx sheets, chosen by
// what they do. The ids are `px:<element>-<family>` (art/effects.ts has the atlas) or one of the older sheets' names.
// `PROC_CUE` is the word and icon for why a blow landed as it did (a crit, a block, a spell reflected).

import { ABILITIES, ABILITY_BY_ID, type AbilityDef } from './abilities';
import { BAD_STATUS, type Effect, type Element, type Proc, type Status } from './effects';
import { KIT_BY_ID, KIT_FX } from './kitItems';
import { SPELL_BY_ID } from './spells';

/** The pack's fifteen elements, for each of the game's. */
export const PX_ELEMENT: Record<Element, string> = {
  physical: 'white', fire: 'fire', ice: 'ice', lightning: 'lightning', holy: 'light', dark: 'dark', nature: 'forest', poison: 'poison',
  arcane: 'star', blood: 'blood', time: 'moon', sound: 'crystal', water: 'water', earth: 'earth', wind: 'wind',
};
export type PxFamily = 'hit' | 'burst' | 'slash' | 'bolt' | 'orb' | 'explosion' | 'aura' | 'sparkle' | 'shield' | 'circle' | 'pillar' | 'rain' | 'vortex' | 'wave' | 'puff' | 'status' | 'debuff' | 'spikes' | 'spread' | 'cross' | 'smoke' | 'splash' | 'strike' | 'flame' | 'nova' | 'gather' | 'cut' | 'rune' | 'pool' | 'glyph';
export const PX_FAMILIES: readonly PxFamily[] = ['hit', 'burst', 'slash', 'bolt', 'orb', 'explosion', 'aura', 'sparkle', 'shield', 'circle', 'pillar', 'rain', 'vortex', 'wave', 'puff', 'status', 'debuff', 'spikes', 'spread', 'cross', 'smoke', 'splash', 'strike', 'flame', 'nova', 'gather', 'cut', 'rune', 'pool', 'glyph'];
/** The neutral white effects have only these shapes. */
const WHITE: readonly PxFamily[] = ['hit', 'burst', 'cross', 'puff', 'smoke', 'sparkle'];

/** The pack's element of a status, for an act that has none of its own (a poison cloud is poison, a sleep the moon's). */
const STATUS_PX: Record<Status, string> = {
  stun: 'lightning', sleep: 'moon', freeze: 'ice', stop: 'moon', poison: 'poison', burn: 'fire', bleed: 'blood', slow: 'moon', silence: 'crystal', blind: 'light',
  weak: 'dark', vulnerable: 'blood', charm: 'star', doom: 'dark', fear: 'dark',
  haste: 'wind', regen: 'forest', shield: 'light', protect: 'light', berserk: 'blood', focus: 'star', reflect: 'crystal', invisible: 'wind', taunt: 'fire',
  thorns: 'forest', lifelink: 'blood', inspired: 'light',
};
/** What a name says of its element, tried in order, for an act with no element of its own. */
const NAME_PX: [RegExp, string][] = [
  [/frost|\bice|winter|cold|glacier|snow|chill/i, 'ice'],
  [/mirror|reflect|crystal|prism/i, 'crystal'],
  [/blood|crimson|sangu|vein|haemo|hemo|red mist|frenzy|rage|fury/i, 'blood'],
  [/bone|grave|death|dead|soul|shadow|dread|night|dark|wraith|\bhex|curse|doom|pale|vampir|terror|evil|\bbats?\b|\boil\b|slick/i, 'dark'],
  [/time|temporal|clock|chrono|rewind|deja|echo|stasis|hasten|slow\b|slowga|stop\b/i, 'moon'],
  [/song|ballad|anthem|note|dirge|lullaby|requiem|discord|hymn|chant|waltz|kiai|countersong|finale|\bcry\b|howl|roar|shout/i, 'crystal'],
  [/thorn|root|bark|wild|nature|grove|leaf|bloom|\bvine|growth|rejuven|bear|wolf|beast|tranquil/i, 'forest'],
  [/earth|stone|ground|rock|quake|titan|bastion|bulwark|diamond|caltrop|spike|\bpit\b/i, 'earth'],
  [/poison|venom|toxic|acid|plague|\brot\b|nightshade|toad/i, 'poison'],
  [/fire|flame|burn|ember|scorch|phoenix|flare/i, 'fire'],
  [/storm|thunder|lightning|shock|spark|tesla|volt|overcharge/i, 'lightning'],
  [/water|tide|\bsea\b|undine/i, 'water'],
  [/wind|gust|gale|step|swift|march|veil|dance/i, 'wind'],
  [/holy|divine|light|bless|faith|prayer|sanct|consecrat|grace|valour|oath|miracle|heal|cure|mend/i, 'light'],
  [/arcane|mana|astral|spirit|rune|star|moon|mirror|spell|planes/i, 'star'],
];

/** The big sheets an ultimate keeps (Craftpix's Pixel Magic, pvfx and Alenia), by the element of its strike. */
const ULTIMATE: Record<Element, string[]> = {
  physical: ['slash_gold', 'slash_wind'], fire: ['mg_ground_fire', 'mg_flame', 'mg_flare', 'orchid'], ice: ['frost'], lightning: ['mg_strike', 'shock'],
  holy: ['holy'], dark: ['mg_sigil', 'void', 'dark_flames'], nature: ['roots', 'leaves'], poison: ['mg_creep', 'venom_ward'],
  arcane: ['mg_shards', 'prism'], blood: ['blood_storm', 'blood_bubble'], time: ['hourglass'], sound: ['moths', 'mg_sparks'],
  water: ['splash', 'foam'], earth: ['mg_spikes', 'spines'], wind: ['leaves', 'mg_puff'],
};
/** An ultimate that strikes nothing: a great mending, a great ward, a great summons. */
const ULTIMATE_MEND = ['life_fountain', 'suture'];
const ULTIMATE_WARD = ['parry', 'gold_vortex'];
const ULTIMATE_CALL = ['portal', 'conjure'];

/** What a name says about a spell's shape, tried in order (whole words, so a "Warden" is no "ward"). */
const HINTS: [RegExp, PxFamily][] = [
  [/rain|hail|shower|deluge|downpour|meteor/i, 'rain'],
  [/pillar|beam|column|\bray\b|judgement|smite|banish/i, 'pillar'],
  [/nova|ring of|radiance|burst of|cataclysm/i, 'nova'],
  [/quake|tremor|wave|tide|surge|stomp|slam|rupture|shaker|breath/i, 'wave'],
  [/spike|thorn|spine|bramble|stalagmite|shard/i, 'spikes'],
  [/vortex|whirl|cyclone|maelstrom|tornado|spiral|tempest|storm|hurricane/i, 'vortex'],
  [/explosion|blast|bomb|detonat|cannon|grenade|mortar|boil|flask/i, 'explosion'],
  [/\borb|sphere|ball\b|globe/i, 'orb'],
  [/bolt|arrow|\bshot\b|lance|spear|dart|missile|javelin|pierce|needle|finger|coil/i, 'bolt'],
  [/flame|inferno|blaze|immolat|scorch|fire/i, 'flame'],
  [/smoke|fog|mist|cloud|miasma|haze/i, 'smoke'],
  [/splash|flood|drench|geyser|torrent/i, 'splash'],
  [/volley|barrage|spread|flurry|swarm|fan of|scatter|multishot|shrapnel|missiles|chain/i, 'spread'],
  [/\bcross\b|crossing/i, 'cross'],
  [/pool|puddle|ooze|acid|slime|venom/i, 'pool'],
  [/strike|thunder|lightning|jolt|zap|shock/i, 'strike'],
  [/slash|\bcut\b|cleave|blade|sword|rend|slice|scythe|reap|edge/i, 'slash'],
  [/drain|siphon|leech|absorb|tap\b|tithe|drink/i, 'gather'],
  [/curse|plague|wither|weaken|blight|enfeeble|\bage\b/i, 'debuff'],
  [/\bhex\b|rune|glyph|sigil|seal|mark/i, 'rune'],
];

/** A skill's blow by its name: a bow's, a blade's, a club's or fist's, a beast's. */
const ARCHERY = /\bshot\b|arrow|volley|nock|\bbow\b|killing field|hawkeye|rapid fire|heartseeker|storm of arrows|throwing/i;
const CLAWS = /claw|bite|maul|\brend|gore|pounce|fang|savage|tiger|sic 'em|lick/i;
const BLADE = /blade|edge|sword|slash|\bcut\b|rend|cleave|strike|phoenix|lance|thrust|dive|charge|iai|setsugekka|gaeshi|knives/i;
const BLUNT = /bash|slam|kick|fist|palm|punch|whack|charge|jump|stomp|mace|staff|hammer|club|shield|totem|crack|trample|stampede|buffet|sweep|pressure|hundred|thousand hands|wrench|dive|chi\b|net\b|trap|pit\b|snare|tripwire|garrotte|trance/i;
/** Craftpix's slashes for a blade of the element (else the pack's own `<element>-slash`). */
const SLASH_SHEET: Partial<Record<string, string[]>> = { white: ['slash_gold', 'slash_wind'], fire: ['slash_fire'], lightning: ['slash_lightning'], poison: ['slash_poison'], water: ['slash_water'], wind: ['slash_wind'] };

/** How a close blow looks where it lands, by the weapon or the creature's name. */
export type MeleeLook = 'blade' | 'blunt' | 'claw';
export function meleeLook(name: string): MeleeLook {
  if (/sword|blade|axe|dagger|knife|katana|sabre|saber|scimitar|scythe|sickle|cleaver|glaive|halberd|spear|lance|pike|rapier|claymore|falchion|machete|naginata|trident|tanto|wakizashi|odachi|kama/i.test(name)) return 'blade';
  if (/claw|fang|bite|maw|talon|wolf|bear|\brat\b|boar|spider|beast|hound|lion|tiger|drake|dragon|wyrm|serpent|snake|\bbat\b|jaw|werewolf|lizard|croc|ghoul|zombie|slime|ooze/i.test(name)) return 'claw';
  return 'blunt';
}
/** A close blow's effect where it lands: a blade's slash, a club's thud, claws' X. */
export const MELEE_FX: Record<MeleeLook, string> = { blade: 'slash_gold', blunt: 'px:white-hit', claw: 'px:white-cross' };

const hash = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(list: readonly T[], id: string) => list[hash(id) % list.length];

interface Act {
  id: string;
  name: string;
  spell: boolean;
  ult: boolean;
  effects: readonly Effect[];
}
/** The skills that are used, by id (an id a passive shares with an active skill is the active one's here). */
let ACTIVE: Map<string, AbilityDef> | null = null;
function actOf(id: string): Act {
  const spell = SPELL_BY_ID[id];
  ACTIVE ??= new Map(ABILITIES.filter((x) => x.active).map((x) => [x.id, x]));
  const ability = ACTIVE.get(id) ?? ABILITY_BY_ID[id];
  return {
    id,
    name: spell?.name ?? ability?.name ?? KIT_BY_ID[id]?.name ?? id,
    spell: !!spell,
    ult: !!ability?.ultimate,
    effects: spell?.effects ?? ability?.active?.effects ?? KIT_FX[id] ?? [],
  };
}

const strikeOf = (a: Act) => a.effects.find((e) => e.kind === 'damage' || e.kind === 'drain');
const foeward = (e: Effect) => e.target === 'foe' || e.target === 'foes' || e.target === 'random_foes';
/** The hindrances it lays on foes, and the blessings on friends, in order. */
const curses = (a: Act) => a.effects.filter((e) => e.kind === 'status' && e.status && BAD_STATUS.has(e.status) && foeward(e)).map((e) => e.status!);
const boons = (a: Act) => a.effects.filter((e) => e.kind === 'status' && e.status && !BAD_STATUS.has(e.status) && !foeward(e)).map((e) => e.status!);
const WARDS: readonly Status[] = ['shield', 'protect', 'reflect'];

/** The pack's element of an act: its strike's (a plain blow takes its rider's: a bleeding cut is blood's), else its
 *  name's, else what it lays on (a poison cloud is poison), else light for a mend, the star for the rest. */
function elementOfAct(a: Act): string {
  const strike = strikeOf(a);
  const el = a.effects.find((e) => (e.kind === 'damage' || e.kind === 'drain') && e.element && e.element !== 'physical')?.element;
  if (el) return PX_ELEMENT[el];
  if (strike) {
    const rider = curses(a).find((s) => s === 'bleed' || s === 'poison' || s === 'burn' || s === 'freeze');
    return rider ? STATUS_PX[rider] : 'white';
  }
  const named = NAME_PX.find(([re]) => re.test(a.name))?.[1];
  // (a mending is light unless its name says otherwise: a song's, the grove's, the blood's; never the wind's)
  if (a.effects.some((e) => e.kind === 'heal' || e.kind === 'revive')) return named && named !== 'wind' ? named : 'light';
  if (named) return named;
  // (a ward is the ward's colour, whatever else comes with it: a guard's taunt does not make the shield fire)
  const st = curses(a)[0] ?? boons(a).find((x) => WARDS.includes(x)) ?? boons(a)[0];
  if (st) return STATUS_PX[st];
  return a.effects.some((e) => e.kind === 'heal' || e.kind === 'revive' || e.kind === 'cleanse') ? 'light' : 'star';
}

/** The pack's element of a spell or skill (by id): what its orb, its gathering and its effect are drawn in. */
export function actElement(id: string): string {
  return elementOfAct(actOf(id));
}

/** The shape of a hindrance by what it lays on. */
function curseShape(st: Status, name: string): PxFamily | 'roots' {
  if (st === 'stop' && /root|entangl|bind|pin|net|snare|shackle|trip|grasp|garrotte/i.test(name)) return 'roots';
  const by: Record<string, PxFamily> = { stun: 'status', sleep: 'smoke', freeze: 'spikes', stop: 'rune', poison: 'smoke', burn: 'flame', bleed: 'splash', slow: 'debuff', silence: 'cross', blind: 'burst', weak: 'debuff', vulnerable: 'debuff', charm: 'status', doom: 'glyph', fear: 'debuff' };
  return by[st] ?? 'debuff';
}

/** The element's strip of a shape, or the nearest the pack has (the white ones have only six shapes). */
function px(el: string, fam: PxFamily): string {
  if (el !== 'white' || WHITE.includes(fam)) return `px:${el}-${fam}`;
  return `px:${fam === 'slash' || fam === 'cut' || fam === 'spread' || fam === 'bolt' || fam === 'strike' ? 'white-hit' : fam === 'wave' || fam === 'spikes' ? 'earth-' + fam : 'white-burst'}`;
}

function choose(a: Act): string {
  const el = elementOfAct(a);
  const strike = strikeOf(a);
  const raises = a.effects.some((e) => e.kind === 'revive');
  const mends = a.effects.some((e) => e.kind === 'heal' || e.kind === 'cleanse');
  const calls = a.effects.some((e) => e.kind === 'summon');
  const bad = curses(a);
  const good = boons(a);
  if (a.ult) {
    const strikeEl = a.effects.find((e) => (e.kind === 'damage' || e.kind === 'drain') && e.element)?.element;
    // (a bow's ultimate: the magic missiles; a beast's or a brawler's fury: Craftpix's burst)
    if (strike && (!strikeEl || strikeEl === 'physical')) return ARCHERY.test(a.name) ? 'missile' : CLAWS.test(a.name) || BLUNT.test(a.name) || /fury|wrath/i.test(a.name) ? 'mg_pop' : pick(ULTIMATE.physical, a.id);
    if (strike) return pick(ULTIMATE[strikeEl!], a.id);
    if (raises || mends) return pick(ULTIMATE_MEND, a.id);
    if (calls) return pick(ULTIMATE_CALL, a.id);
    if (good.some((s) => WARDS.includes(s))) return pick(ULTIMATE_WARD, a.id);
    return bad.length ? pick(ULTIMATE.dark, a.id) : 'holy';
  }
  if (strike) {
    const many = strike.target === 'foes' || strike.target === 'random_foes';
    const hinted = HINTS.find(([re]) => re.test(a.name))?.[1];
    if (strike.kind === 'drain' && !hinted) return px(el, 'gather');
    if (!a.spell) {
      // (a skill's blow: by the arms it is struck with)
      if (ARCHERY.test(a.name)) return px(el, hinted === 'explosion' ? 'explosion' : many ? (el === 'white' ? 'hit' : 'rain') : 'hit');
      if (CLAWS.test(a.name)) return px(el === 'white' ? 'white' : el, 'cross');
      if (hinted && hinted !== 'slash' && hinted !== 'strike' && el !== 'white') return px(el, hinted);
      if (BLUNT.test(a.name)) return many ? px(el === 'white' ? 'earth' : el, 'wave') : px(el, el === 'white' ? 'hit' : 'burst');
      // (a blade's art, plain or with its element in the edge: a slash; an elemental art struck without one, as a spell)
      if (el === 'white' || BLADE.test(a.name)) return SLASH_SHEET[el] ? pick(SLASH_SHEET[el]!, a.id) : px(el, many ? 'wave' : 'slash');
    }
    // (a dancer's or a duellist's blade spell: Craftpix's slash)
    if (el === 'white' && a.spell) return pick(SLASH_SHEET.white!, a.id);
    if (hinted) return px(el, hinted);
    if ((strike.hits ?? 1) > 1) return px(el, 'spread');
    return px(el, many ? pick(['explosion', 'nova', 'wave', 'rain', 'pillar'] as const, a.id) : pick(['bolt', 'orb', 'burst', 'strike'] as const, a.id));
  }
  if (raises) return px(el === 'star' ? 'light' : el, 'pillar');
  if (calls) return px(el, 'circle');
  if (a.effects.some((e) => e.kind === 'heal')) return px(el, /rain|shower/i.test(a.name) ? 'rain' : 'sparkle');
  if (a.effects.some((e) => e.kind === 'cleanse')) return px(el, 'burst');
  if (/smoke|fog|mist|cloud|veil|vanish|camouflage|shadow/i.test(a.name)) return px(el === 'star' || el === 'light' ? 'white' : el, 'smoke');
  // (a war cry, a howl, a roar: a ring of sound; a net, a snare, a bind: roots that hold; caltrops and pits: spikes)
  if (/\bcry\b|howl|roar|shout|kiai/i.test(a.name)) return px(el, 'nova');
  if (bad.length && /\bnet\b|snare|shackle|\bbind|root|entangl/i.test(a.name)) return 'roots';
  if (/caltrop|spike|\bpit\b/i.test(a.name)) return px(el, 'spikes');
  if (/slick|\boil\b|puddle/i.test(a.name)) return px(el, 'pool');
  if (bad.length) {
    const shape = curseShape(bad[0], a.name);
    return shape === 'roots' ? 'roots' : px(el, shape);
  }
  if (a.effects.some((e) => e.kind === 'dispel')) return px(el, 'puff');
  if (good.some((s) => WARDS.includes(s))) return px(el, 'aura');
  if (good.includes('regen')) return px(el, 'sparkle');
  // (another blessing: a ring at the feet; its icon pops over the head: `actCue`)
  return px(el, 'circle');
}

const cache = new Map<string, string>();
/** The effect for a spell or skill (by id): `px:<element>-<family>`, or an older sheet's name. */
export function actFx(id: string): string {
  let fx = cache.get(id);
  if (!fx) cache.set(id, (fx = choose(actOf(id))));
  return fx;
}

/** Whether a skill's blow is an arrow, a bolt or a thrown blade (the views fly one to the mark before it lands). */
export function actArrow(id: string): boolean {
  const a = actOf(id);
  return !a.spell && !a.ult && !!strikeOf(a) && ARCHERY.test(a.name);
}

/** The small icon and word over someone a status has just come on (an arrow up for Inspired, "zzz" for sleep): 32px
 *  strips of the pixel effects atlas. */
export interface Cue {
  fx: string;
  word: string;
  colour: number;
}
const GOOD = 0x8ae8ff;
const ILL = 0xffb080;
export const STATUS_CUE: Record<Status, Cue> = {
  stun: { fx: 'px:white-star', word: 'Stunned', colour: ILL },
  sleep: { fx: 'px:blue-zzz', word: 'Asleep', colour: ILL },
  freeze: { fx: 'px:blue-star', word: 'Frozen', colour: 0x9ad8ff },
  stop: { fx: 'px:moon-rune', word: 'Held', colour: ILL },
  poison: { fx: 'px:poison-smoke', word: 'Poisoned', colour: 0xa8f070 },
  burn: { fx: 'px:fire-flame', word: 'Burning', colour: 0xffa040 },
  bleed: { fx: 'px:blood-cut', word: 'Bleeding', colour: 0xff5050 },
  slow: { fx: 'px:moon-debuff', word: 'Slowed', colour: ILL },
  silence: { fx: 'px:white-cross', word: 'Silenced', colour: ILL },
  blind: { fx: 'px:white-dots', word: 'Blinded', colour: ILL },
  weak: { fx: 'px:dark-debuff', word: 'Weakened', colour: ILL },
  vulnerable: { fx: 'px:red-exclaim', word: 'Exposed', colour: 0xff6050 },
  charm: { fx: 'px:pink-heart', word: 'Charmed', colour: 0xff90d0 },
  doom: { fx: 'px:dark-glyph', word: 'Doomed', colour: 0xc080ff },
  fear: { fx: 'px:blue-sweat', word: 'Afraid', colour: ILL },
  haste: { fx: 'px:gold-dash', word: 'Haste', colour: GOOD },
  regen: { fx: 'px:forest-sparkle', word: 'Regen', colour: 0x8aff9a },
  shield: { fx: 'px:light-shield', word: 'Shield', colour: GOOD },
  protect: { fx: 'px:earth-shield', word: 'Protect', colour: GOOD },
  berserk: { fx: 'px:red-anger', word: 'Berserk', colour: 0xff6040 },
  focus: { fx: 'px:gold-star', word: 'Focus', colour: GOOD },
  reflect: { fx: 'px:crystal-shield', word: 'Reflect', colour: GOOD },
  invisible: { fx: 'px:white-smoke', word: 'Hidden', colour: GOOD },
  taunt: { fx: 'px:gold-exclaim', word: 'Taunt', colour: 0xffd060 },
  thorns: { fx: 'px:forest-spikes', word: 'Thorns', colour: GOOD },
  lifelink: { fx: 'px:red-heart', word: 'Lifelink', colour: GOOD },
  inspired: { fx: 'px:gold-levelup', word: 'Inspired', colour: 0xffe070 },
};
/** The word and icon for why a blow landed as it did (sim: `pop.why`, the board's `hits[].why`). */
export const PROC_CUE: Record<Proc, Cue> = {
  crit: { fx: 'px:gold-exclaim', word: 'Crit!', colour: 0xffa030 },
  block: { fx: 'px:light-shield', word: 'Block', colour: 0xd8e8ff },
  shield: { fx: 'px:star-shield', word: 'Shield', colour: 0xb0d0ff },
  reflect: { fx: 'px:crystal-shield', word: 'Reflect', colour: 0xc0f0ff },
  thorns: { fx: 'px:forest-spikes', word: 'Thorns', colour: 0xa8f070 },
  resist: { fx: 'px:white-puff', word: 'Resist', colour: 0xe0e0e0 },
  counter: { fx: 'px:gold-cross', word: 'Counter!', colour: 0xffd060 },
};

/** The status an act's cue shows (the first it lays on foes, else the first blessing), for its icon over the head. */
export function actCue(id: string): Status | null {
  const a = actOf(id);
  return curses(a)[0] ?? boons(a)[0] ?? null;
}

/** How big each shape is drawn against the others: an impact and an icon small, the area shapes larger. The board and
 *  the fight screen multiply their own size by it, so nothing covers a fighter whole. */
export const FAMILY_SCALE: Record<PxFamily, number> = {
  hit: 0.75, burst: 0.85, slash: 0.9, cut: 0.8, cross: 0.8, bolt: 0.8, orb: 0.75, strike: 0.95, flame: 0.8, gather: 0.7, spread: 0.9,
  explosion: 0.9, nova: 1, wave: 1.05, rain: 1, pillar: 0.95, vortex: 0.9, spikes: 0.95, splash: 0.9, pool: 1, smoke: 0.85, puff: 0.8,
  aura: 0.95, shield: 0.8, sparkle: 0.85, circle: 1, rune: 1, glyph: 1, debuff: 0.75, status: 0.75,
};
/** The shapes drawn solid (a fireball's blob, a pillar): drawn a little see-through, so the fighter behind still shows. */
export const SOLID: ReadonlySet<string> = new Set(['explosion', 'orb', 'pillar', 'shield', 'smoke', 'puff', 'flame', 'pool']);
export const familyOf = (fx: string): PxFamily | null => (fx.startsWith('px:') ? (fx.slice(fx.indexOf('-') + 1) as PxFamily) : null);
