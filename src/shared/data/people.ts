// People data: names, looks, recruit types, traits and jobs (DESIGN §7, §15).

import type { Rng } from '../rng';
import { ORIGINS, type OriginId } from './origins';
import type { Skill } from './skills';

export const NAMES = [
  'Arn', 'Bera', 'Cato', 'Dagna', 'Edda', 'Fen', 'Gudrun', 'Hakon', 'Ida', 'Joro', 'Kel', 'Lif', 'Maren', 'Nils', 'Orla',
  'Pell', 'Runa', 'Sten', 'Tova', 'Ulf', 'Vesna', 'Wren', 'Yrsa', 'Asa', 'Brand', 'Carro', 'Doran', 'Elka', 'Frode', 'Hild',
] as const;

/** Name syllables for each people. Their 16-by-16 combinations give every origin its own large pool. */
const NAME_PARTS: Record<OriginId, readonly [readonly string[], readonly string[]]> = {
  settlers: [['Al', 'Bel', 'Cal', 'Dar', 'El', 'Fen', 'Gar', 'Had', 'Ise', 'Jon', 'Lio', 'Mar', 'Ned', 'Or', 'Pet', 'Ros'], ['a', 'en', 'ia', 'an', 'ie', 'er', 'in', 'or', 'el', 'et', 'is', 'yn', 'on', 'al', 'wyn', 'ric']],
  lich: [['Mor', 'Ash', 'Os', 'Vel', 'Grim', 'Mal', 'Ner', 'Ebon', 'Ves', 'Sable', 'Thorn', 'Wraith', 'Dusk', 'Cair', 'Noct', 'Corv'], ['a', 'en', 'eth', 'ius', 'ora', 'is', 'oth', 'iel', 'yr', 'ian', 'ara', 'or', 'une', 'e', 'el', 'yn']],
  druid: [['Ail', 'Bran', 'Ciar', 'Dara', 'Eira', 'Fionn', 'Gwen', 'Iona', 'Lugh', 'Mae', 'Niamh', 'Oisin', 'Ronan', 'Sio', 'Taran', 'Una'], ['a', 'an', 'en', 'eth', 'in', 'is', 'na', 'ra', 'wen', 'wyn', 'el', 'iel', 'or', 'oc', 'ith', 'e']],
  vampire: [['Aless', 'Boris', 'Carm', 'Dimit', 'Eliz', 'Ily', 'Katar', 'Luc', 'Mira', 'Nico', 'Radu', 'Sera', 'Vlad', 'Zora', 'Is', 'Val'], ['a', 'an', 'ena', 'ina', 'ian', 'ica', 'imir', 'islav', 'ena', 'escu', 'or', 'ov', 'eva', 'ina', 'el', 'ette']],
  werewolf: [['Arne', 'Bjorn', 'Dag', 'Eirik', 'Freya', 'Gunn', 'Hald', 'Inga', 'Kari', 'Leif', 'Magn', 'Ragn', 'Sigr', 'Tor', 'Ulf', 'Yrsa'], ['a', 'ald', 'ar', 'dis', 'en', 'hild', 'i', 'ild', 'olf', 'run', 'sten', 'ulf', 'var', 'y', 'or', 'wyn']],
  robot: [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'], ['-01', '-02', '-03', '-04', '-05', '-06', '-07', '-08', '-09', '-10', '-11', '-12', '-13', '-14', '-15', '-16']],
  dwarves: [['Ald', 'Bald', 'Brun', 'Dain', 'Dur', 'Eber', 'Farin', 'Gimli', 'Hadr', 'Kili', 'Morr', 'Nori', 'Oin', 'Thrain', 'Thorin', 'Vig'], ['a', 'ar', 'din', 'dis', 'en', 'gar', 'grim', 'i', 'in', 'lin', 'mund', 'ra', 'ri', 'run', 'ur', 'ulf']],
  merfolk: [['Aeg', 'Amph', 'Anem', 'Calyp', 'Coral', 'Delph', 'Eury', 'Galat', 'Iant', 'Marin', 'Ner', 'Oce', 'Pelag', 'Thal', 'Thet', 'Trit'], ['a', 'ander', 'ara', 'ea', 'ene', 'ia', 'ion', 'is', 'issa', 'on', 'ora', 'os', 'ria', 'us', 'yne', 'eus']],
  nomads: [['Ayl', 'Batu', 'Dara', 'Esen', 'Farid', 'Gul', 'Jamal', 'Kamil', 'Ley', 'Mira', 'Nuri', 'Orhan', 'Samir', 'Tariq', 'Yas', 'Zara'], ['a', 'an', 'bek', 'han', 'i', 'im', 'in', 'ira', 'jan', 'mir', 'ra', 'rin', 'un', 'ya', 'zade', 'gul']],
  fae: [['Ael', 'Ari', 'Cael', 'Elar', 'Elow', 'Fael', 'Fey', 'Iri', 'Lira', 'Lun', 'Meli', 'Naer', 'Nim', 'Syl', 'Thia', 'Vael'], ['a', 'an', 'elle', 'en', 'eth', 'ia', 'iel', 'ina', 'ion', 'ith', 'or', 'ora', 'riel', 'wen', 'wyn', 'ys']],
  alchemists: [['Ari', 'Basil', 'Cass', 'Cleo', 'Dari', 'Elian', 'Farah', 'Hadi', 'Jas', 'Kali', 'Leand', 'Mira', 'Nad', 'Pax', 'Safi', 'Zeno'], ['a', 'an', 'ander', 'as', 'ene', 'eus', 'ia', 'ian', 'is', 'ius', 'ora', 'os', 'ra', 'ria', 'us', 'ya']],
  knights: [['Ald', 'Alis', 'Bertr', 'Cec', 'Edm', 'Eleanor', 'Gaw', 'Geoff', 'Isab', 'Lancel', 'Marg', 'Perc', 'Rich', 'Row', 'Stef', 'Wulf'], ['a', 'ald', 'bert', 'dric', 'elle', 'en', 'fred', 'ian', 'ica', 'in', 'lyn', 'mund', 'ric', 'stan', 'win', 'wyn']],
  orcs: [['Azog', 'Bagr', 'Brug', 'Drog', 'Ghaz', 'Gor', 'Grish', 'Karg', 'Krul', 'Mog', 'Murg', 'Naz', 'Ogg', 'Ruk', 'Urz', 'Yaz'], ['a', 'ak', 'ash', 'ga', 'gash', 'gul', 'ka', 'lok', 'nak', 'naz', 'ra', 'rok', 'sha', 'thak', 'uk', 'za']],
};

/** At least 256 names per origin, with the original common names retained for settlers. */
export const ORIGIN_NAMES = Object.fromEntries(ORIGINS.map((origin) => {
  const [heads, tails] = NAME_PARTS[origin];
  const made = heads.flatMap((head) => tails.map((tail) => head + tail));
  return [origin, [...new Set(origin === 'settlers' ? [...NAMES, ...made] : made)]];
})) as unknown as Record<OriginId, readonly string[]>;

/** The combined reserve is used only if a town ever exhausts its own people's pool. */
export const ALL_PERSON_NAMES = [...new Set([...NAMES, ...Object.values(ORIGIN_NAMES).flat()])];

/** Pick a free name for one of the town's own people, falling back to the combined reserve only if needed. */
export function personName(rng: Pick<Rng, 'pick'>, origin: OriginId, taken: readonly string[]): string {
  const ownFree = ORIGIN_NAMES[origin].filter((name) => !taken.includes(name));
  const reserveFree = ALL_PERSON_NAMES.filter((name) => !taken.includes(name));
  return rng.pick(ownFree.length ? ownFree : reserveFree.length ? reserveFree : ALL_PERSON_NAMES);
}

/* ------------------------------------------------------------ looks */

export interface Look {
  gender: 'm' | 'f';
  skin: string;
  hair: string;
  hairColor: string;
  beard: boolean;
  /** Colour of the hide tunic. */
  outfit: string;
  /** A ready-made founder's own pieces (data/founders.ts): another body (bone, or a machine's frame tinted by
   *  `skin`), ears, eyes, what they always wear (worn over and instead of the everyday clothes), and how tall they're
   *  drawn (a dwarf is shorter). */
  body?: 'skeleton' | 'orc';
  ears?: 'elf' | 'big';
  eyes?: 'red';
  wear?: string[];
  height?: number;
}

// Townsfolk are rolled from these (natural colours). The founder can also be given the extra hair dyes and cloth
// colours further down.
export const SKINS = ['#fbe3cf', '#f0cfa8', '#e8c29a', '#e3b890', '#d6a67c', '#c9956a', '#b5825a', '#a0704a', '#8c5e3e', '#7a5236', '#654230', '#4e3224'];
export const HAIR_COLORS = [
  '#1a1414', '#2a1c14', '#3c3434', '#4a3020', '#5a4636', '#6e4a2c', '#9a6e40', '#b88a58', '#c49a62', '#e0c890', '#f0dca8', '#8a3a22', '#b0542a', '#a8a29a',
];
export const HAIR_STYLES = ['plain', 'long', 'ponytail', 'unkempt', 'messy1', 'messy2', 'loose', 'bedhead', 'shoulderl', 'bangs', 'shortknot', 'longknot'];
/** Hair dyes a founder can be given (on top of HAIR_COLORS): white, flame red, and bright dyes. */
export const DYED_HAIR_COLORS = ['#ece8e0', '#c8281c', '#e07830', '#d8589c', '#8a4ac0', '#3a5ac8', '#2a9a9a', '#3a9a4a'];
export const HAIR_CHOICES = [...HAIR_COLORS, ...DYED_HAIR_COLORS];
export const HIDE_COLORS = ['#8a6a48', '#7a5a3a', '#9c7c54', '#6c5040', '#8c7458', '#5a4838', '#a88c68', '#b89c74'];
/** Dyed cloth a founder can wear (on top of HIDE_COLORS). */
export const CLOTH_COLORS = ['#e0d8c4', '#b8a888', '#c8a040', '#b86a2a', '#8a2a24', '#6a2a4a', '#5a3a7a', '#2a4a7a', '#3a6a8a', '#2a6a5a', '#4a6a2a', '#2e2a28'];
export const OUTFIT_CHOICES = [...HIDE_COLORS, ...CLOTH_COLORS];

export function randomLook(rng: Rng, elder = false): Look {
  const gender = rng.chance(0.5) ? 'm' : 'f';
  return {
    gender,
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIR_STYLES),
    hairColor: elder ? rng.pick(['#d8d4cc', '#b8b2a8', '#9a948c']) : rng.pick(HAIR_COLORS),
    beard: gender === 'm' && rng.chance(elder ? 0.8 : 0.4),
    outfit: rng.pick(HIDE_COLORS),
  };
}

/* ------------------------------------------------------------ recruit types */

export interface RecruitType {
  id: string;
  name: string;
  /** Skill level ranges; unlisted skills roll 1..3. */
  skills: Partial<Record<Skill, [number, number]>>;
  /** Skills a passion is most likely to land on. */
  passionFor: Skill[];
}

export const RECRUIT_TYPES: Readonly<Record<string, RecruitType>> = {
  founder: { id: 'founder', name: 'Founder', skills: { gathering: [3, 4], construction: [2, 3], research: [2, 3] }, passionFor: ['gathering', 'construction', 'research'] },
  wanderer: { id: 'wanderer', name: 'Wanderer', skills: {}, passionFor: [] },
  hunter: { id: 'hunter', name: 'Hunter', skills: { melee: [4, 8], ranged: [4, 8], animals: [2, 5] }, passionFor: ['melee', 'ranged'] },
  gatherer: { id: 'gatherer', name: 'Gatherer', skills: { gathering: [4, 8], farming: [3, 7] }, passionFor: ['gathering', 'farming'] },
  crafter: { id: 'crafter', name: 'Crafter', skills: { crafting: [4, 8], construction: [4, 8] }, passionFor: ['crafting', 'construction'] },
  child: { id: 'child', name: 'Child', skills: {}, passionFor: [] },
  werewolf: { id: 'werewolf', name: 'Werewolf', skills: { melee: [8, 12], gathering: [3, 6] }, passionFor: ['melee'] },
  vampire: { id: 'vampire', name: 'Vampire', skills: { melee: [6, 10], social: [6, 10], research: [4, 7] }, passionFor: ['social', 'melee'] },
  hermit: { id: 'hermit', name: 'Hermit', skills: { research: [5, 9], medicine: [3, 6], melee: [1, 2] }, passionFor: ['research', 'medicine'] },
  elder: { id: 'elder', name: 'Elder', skills: { research: [5, 9], social: [4, 8], melee: [1, 1], ranged: [1, 1] }, passionFor: ['research', 'social'] },
};

/** Types that turn up at the edge of town, with relative odds. */
export const ARRIVING_TYPES: Readonly<Record<string, number>> = { wanderer: 4, gatherer: 2, crafter: 2, hunter: 2, elder: 1, hermit: 0.4 };

/* ------------------------------------------------------------ traits */

export interface Trait {
  id: string;
  name: string;
  description: string;
  /** Traits that can't be combined with this one. */
  excludes?: string[];
}

// Only traits with something to act on so far. Pyromaniac, Bloodlust... arrive with fire and later combat detail.
export const TRAITS: readonly Trait[] = [
  { id: 'hard_worker', name: 'Hard Worker', description: 'Works 20% faster.', excludes: ['lazy'] },
  { id: 'lazy', name: 'Lazy', description: 'Works 20% slower.', excludes: ['hard_worker'] },
  { id: 'quick_learner', name: 'Quick Learner', description: 'Gains skill 50% faster.' },
  { id: 'glutton', name: 'Glutton', description: 'Gets hungry 50% faster.' },
  { id: 'night_owl', name: 'Night Owl', description: 'Works 20% faster at night, 10% slower by day.' },
  { id: 'loner', name: 'Loner', description: 'Unhappy when more than four people live in town.' },
  { id: 'green_thumb', name: 'Green Thumb', description: 'Farms 25% faster and harvests 25% more.' },
  { id: 'tough', name: 'Tough', description: 'More health, and takes less damage.' },
  { id: 'coward', name: 'Coward', description: 'Backs out of the front line once hurt.' },
];

/** Traits nobody is born with: they come from what happens to them. */
export const LATER_TRAITS: readonly Trait[] = [{ id: 'frail', name: 'Frail', description: 'Brought back from the cold: less health (each time).' }];

export const TRAIT_BY_ID: Readonly<Record<string, Trait>> = Object.fromEntries([...TRAITS, ...LATER_TRAITS].map((t) => [t.id, t]));

/* ------------------------------------------------------------ jobs */

/** 'defend' only matters during raids: anyone not set to Off fights, the rest shelter. */
export const JOBS = ['haul', 'construct', 'farm', 'craft', 'research', 'gather', 'defend'] as const;
export type Job = (typeof JOBS)[number];

export const JOB_NAMES: Record<Job, string> = { haul: 'Haul', construct: 'Construct', farm: 'Farm', craft: 'Craft', research: 'Research', gather: 'Gather', defend: 'Defend' };

/** The skill that makes someone good at a job (hauling needs none; defending uses the better of melee and ranged). */
export const JOB_SKILL: Record<Job, Skill | null> = { haul: null, construct: 'construction', farm: 'farming', craft: 'crafting', research: 'research', gather: 'gathering', defend: 'melee' };

/** 1 = high, 2 = normal, 3 = low, 0 = off. */
export type Priority = 0 | 1 | 2 | 3;
export const PRIORITY_NAMES: Record<Priority, string> = { 1: 'High', 2: 'Normal', 3: 'Low', 0: 'Off' };

/* ------------------------------------------------------------ food */

/** How much of the food need one unit restores (about two berries a day per person). In order of what
 *  gets eaten first at home (the least filling); expeditions pack from the other end. */
export const FOOD_VALUE: Partial<Record<string, number>> = { grain: 0.4, milk: 0.4, kelp: 0.4, berries: 0.5, eggs: 0.5, fish: 0.7, vegetables: 0.6, fruit: 0.6, meat: 0.7, dried_meat: 0.9, bread: 0.9, rations: 1 };
