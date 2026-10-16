// The New Town description sheets' moving scenes, as data (scenePlayer.ts plays them): a backdrop from art/backdrops with
// its layers scrolling at their own pace, a few actors (the origin's founders as their paper dolls, creatures from the
// pack sheets) walking, working or fighting, and particles (rain, sparks, wisps...) on top. Tune a scene here without
// touching the player. The picture is 320x180 "art pixels": positions are shares of the width and height, sizes are
// pixels at that size. Everything loops over `LOOP` seconds.

import type { Biome, Difficulty } from '../../shared/data/biomes';
import type { OriginId } from '../../shared/data/origins';
import type { Skill } from '../../shared/data/skills';

export const LOOP = 8;
export const VIEW_W = 320;
export const VIEW_H = 180;

export type Anim = 'idle' | 'walk' | 'work' | 'attack' | 'shoot' | 'read' | 'talk' | 'kneel' | 'cheer';
export type FxKind =
  | 'rain' | 'snow' | 'leaves' | 'petals' | 'embers' | 'sparks' | 'bubbles' | 'wisps' | 'fireflies' | 'dust' | 'smoke' | 'steam'
  | 'bats' | 'birds' | 'fish' | 'mist' | 'ash' | 'flash';

export interface Actor {
  /** A paper doll (the index of a founder, the first one named if it's off the end) or a creature (a pack sheet id). */
  who: number | string;
  anim: Anim;
  /** From and to along the width over the loop (equal: it stays), then it comes round again. */
  x: [number, number];
  /** Where its feet are, down the height (0.9). */
  y?: number;
  /** Its height in art pixels. */
  h: number;
  /** Which way it faces (by default the way it travels, else right); a paper doll can also face us (f) or away (b). */
  face?: 'l' | 'r' | 'f' | 'b';
  /** Where in the loop it starts (0 to 1). */
  phase?: number;
  /** Drifting up and down as in water. */
  bob?: number;
}
export interface Fx {
  kind: FxKind;
  n: number;
  /** Where it comes from (a share of the width and height); anywhere if left out. */
  at?: [number, number];
  colour?: string;
}
/** A thing on the stage (panel/eventProps.ts names them): stood with its foot at (x, y), shares of the width and height. */
export interface Prop {
  id: string;
  x: number;
  /** Where its foot is, down the height (0.9). */
  y?: number;
  /** Drawn bigger or smaller than its own size (1). */
  k?: number;
  flip?: boolean;
  /** Hung on the wall or laid behind everyone, whatever its foot. */
  back?: boolean;
  /** Drawn in the order of something standing here (down the height) rather than of its foot: bread on a table. */
  z?: number;
}
/** Townsfolk gathered: `n` of the dolls from `from` (the event's cast puts its crowd last), spread over `x` in up to two
 *  rows between `y`, all facing one way, murmuring (a small shift now and then) and raising their hands at a vote. */
export interface Crowd {
  n: number;
  x: [number, number];
  y: [number, number];
  h: number;
  face: 'l' | 'r' | 'f' | 'b';
  from?: number;
  anim?: Anim;
  /** One row only (a bucket line; an audience along the front, heads and shoulders): two when there are more than three. */
  rows?: 1 | 2;
}
export interface SceneScript {
  /** A painted background (art/backdrops), or a set laid from the pack's tiles (`set:hall`, `set:cottage`). */
  back: string;
  /** How far the nearest layer goes by each second (art px; the far ones go slower), minus is leftward. */
  scroll?: number;
  /** A wash laid over the backdrop: colour and strength. */
  tint?: [string, number];
  actors: Actor[];
  fx: Fx[];
  /** The stage's things, and its gathered townsfolk. */
  props?: Prop[];
  crowd?: Crowd[];
  /** The actor who speaks while the card is read (by its place in `actors`): the talk pose and a small bob. */
  speaker?: number;
  /** The ground shaking (art px). */
  shake?: number;
}

const A = (who: number | string, anim: Anim, x: [number, number], h: number, o: Partial<Actor> = {}): Actor => ({ who, anim, x, h, ...o });

/* ------------------------------------------------------------ the peoples */

export const ORIGIN_SCRIPTS: Record<OriginId, SceneScript> = {
  // a cabin going up, a wagon load carried in, smoke from the chimney
  settlers: {
    back: 'summer_1',
    scroll: 0,
    actors: [A(0, 'work', [0.3, 0.3], 46, { y: 0.93 }), A(1, 'walk', [0.05, 0.95], 44, { y: 0.96 }), A(2, 'walk', [0.9, 0.2], 40, { y: 0.9, phase: 0.5 })],
    fx: [{ kind: 'smoke', n: 7, at: [0.6, 0.4], colour: '#cfcfcf' }, { kind: 'sparks', n: 5, at: [0.34, 0.8], colour: '#ffe9a0' }, { kind: 'birds', n: 2 }, { kind: 'leaves', n: 5 }],
  },
  // skeletons raised from the graves, green wisps
  lich: {
    back: 'battle_graves',
    scroll: 0,
    tint: ['#0a2a14', 0.25],
    actors: [A(0, 'shoot', [0.5, 0.5], 46, { y: 0.9 }), A('skeleton_warrior', 'walk', [0.05, 0.4], 40, { y: 0.9 }), A('skeleton_spearman', 'walk', [0.95, 0.62], 44, { y: 0.93, phase: 0.3 }), A('skeleton_warrior', 'attack', [0.8, 0.8], 38, { y: 0.88, face: 'l' })],
    fx: [{ kind: 'wisps', n: 14, colour: '#8cff9a' }, { kind: 'mist', n: 3, colour: '#6fa97a' }, { kind: 'bats', n: 2 }],
  },
  // a storm called among the trees, leaves driven on the wind
  druid: {
    back: 'forest_1',
    scroll: 0,
    tint: ['#102418', 0.2],
    actors: [A(0, 'shoot', [0.5, 0.5], 48, { y: 0.92 }), A(1, 'walk', [0.9, 0.7], 40, { y: 0.88 }), A('satyr_1', 'idle', [0.15, 0.15], 40, { y: 0.9, face: 'r' })],
    fx: [{ kind: 'rain', n: 36 }, { kind: 'leaves', n: 16 }, { kind: 'flash', n: 1, colour: '#d8f2ff' }],
  },
  // a torchlit court, bats overhead
  vampire: {
    back: 'moon_3',
    scroll: 0,
    tint: ['#300008', 0.25],
    actors: [A(0, 'idle', [0.42, 0.42], 48, { y: 0.93 }), A(1, 'walk', [0.9, 0.58], 44, { y: 0.93 }), A('hk_ghost', 'idle', [0.15, 0.2], 40, { y: 0.8, bob: 3 })],
    fx: [{ kind: 'bats', n: 7 }, { kind: 'embers', n: 8, at: [0.1, 0.85], colour: '#ff8a3a' }, { kind: 'embers', n: 8, at: [0.9, 0.85], colour: '#ff8a3a' }, { kind: 'mist', n: 2, colour: '#7a2a3a' }],
  },
  // howling under the moon in the snow
  werewolf: {
    back: 'moon_2',
    scroll: 0,
    actors: [A('werewolf_white', 'attack', [0.55, 0.55], 54, { y: 0.93, face: 'l' }), A(0, 'walk', [0.05, 0.3], 44, { y: 0.9 }), A('werewolf_black', 'walk', [0.98, 0.78], 44, { y: 0.88, face: 'l', phase: 0.4 })],
    fx: [{ kind: 'snow', n: 40 }, { kind: 'mist', n: 2, colour: '#aab8d8' }],
  },
  // the foundry pours: steam, sparks, workers on their rounds
  robot: {
    back: 'industrial_day',
    scroll: 0,
    actors: [A('robot_infantry', 'walk', [0.1, 0.9], 40, { y: 0.93 }), A(0, 'work', [0.45, 0.45], 46, { y: 0.94 }), A('robot_swordsman', 'attack', [0.78, 0.78], 38, { y: 0.9, face: 'l' })],
    fx: [{ kind: 'steam', n: 9, at: [0.3, 0.55], colour: '#e8eef2' }, { kind: 'sparks', n: 14, at: [0.5, 0.82], colour: '#ffb84a' }, { kind: 'smoke', n: 6, at: [0.8, 0.4], colour: '#8a8a8a' }],
  },
  // hammers ringing in the glowing hold
  dwarves: {
    back: 'crystal_2',
    scroll: 0,
    tint: ['#3a1800', 0.15],
    actors: [A(0, 'work', [0.3, 0.3], 46, { y: 0.93 }), A(1, 'work', [0.62, 0.62], 46, { y: 0.93, face: 'l', phase: 0.3 }), A(2, 'walk', [0.02, 0.98], 36, { y: 0.97 })],
    fx: [{ kind: 'sparks', n: 16, at: [0.37, 0.82], colour: '#ffcf5a' }, { kind: 'sparks', n: 12, at: [0.56, 0.82], colour: '#ffcf5a' }, { kind: 'wisps', n: 8, colour: '#9fe8ff' }, { kind: 'dust', n: 6 }],
  },
  // diving through the waves with fish and bubbles
  merfolk: {
    back: 'underwater_1',
    scroll: 6,
    actors: [A(0, 'walk', [0.1, 0.9], 44, { y: 0.55, bob: 8 }), A(1, 'walk', [0.95, 0.15], 40, { y: 0.7, bob: 6, phase: 0.4 }), A('squidman', 'idle', [0.82, 0.82], 46, { y: 0.92, bob: 3 })],
    fx: [{ kind: 'bubbles', n: 26 }, { kind: 'fish', n: 8 }],
  },
  // wagons rolling on past the oasis, the dust blowing
  nomads: {
    back: 'oasis_1',
    scroll: -14,
    actors: [A(0, 'walk', [0.3, 0.55], 46, { y: 0.93 }), A(1, 'walk', [0.15, 0.4], 42, { y: 0.9, phase: 0.2 }), A(2, 'walk', [0.0, 0.25], 40, { y: 0.95, phase: 0.5 })],
    fx: [{ kind: 'dust', n: 26 }, { kind: 'birds', n: 2 }],
  },
  // dancing lights in a glade of fireflies
  fae: {
    back: 'forest_5',
    scroll: 0,
    actors: [A(0, 'shoot', [0.4, 0.4], 46, { y: 0.92 }), A('kitsune', 'walk', [0.9, 0.62], 40, { y: 0.9, face: 'l' }), A(1, 'idle', [0.2, 0.2], 40, { y: 0.85, bob: 2 })],
    fx: [{ kind: 'fireflies', n: 30, colour: '#c8ff9a' }, { kind: 'wisps', n: 8, colour: '#ff9af0' }, { kind: 'petals', n: 8 }],
  },
  // a lab that bubbles with coloured smoke
  alchemists: {
    back: 'steampunk_3',
    scroll: 0,
    actors: [A(0, 'work', [0.35, 0.35], 46, { y: 0.93 }), A(1, 'read', [0.7, 0.7], 44, { y: 0.93, face: 'l' }), A('hk_imp', 'walk', [0.05, 0.95], 26, { y: 0.97, phase: 0.6 })],
    fx: [{ kind: 'bubbles', n: 14, at: [0.5, 0.78], colour: '#8aff7a' }, { kind: 'smoke', n: 6, at: [0.5, 0.7], colour: '#c47aff' }, { kind: 'steam', n: 6, at: [0.8, 0.5], colour: '#d8e8c8' }, { kind: 'sparks', n: 6, at: [0.36, 0.8], colour: '#7aeaff' }],
  },
  // a charge, banners, dust
  knights: {
    back: 'battle_hall',
    scroll: 0,
    actors: [A('knight_1', 'walk', [0.0, 1.0], 46, { y: 0.93 }), A('knight_2', 'walk', [-0.25, 0.75], 46, { y: 0.9 }), A(0, 'walk', [-0.45, 0.55], 46, { y: 0.96 }), A('knight_3', 'attack', [0.85, 0.85], 44, { y: 0.92, face: 'l' })],
    fx: [{ kind: 'dust', n: 20, at: [0.5, 0.95] }, { kind: 'sparks', n: 8, at: [0.8, 0.7], colour: '#fff4c0' }],
  },
  // a palisade stormed by torchlight
  orcs: {
    back: 'wasteland_3',
    scroll: 0,
    actors: [A('hk_orc_grunt', 'walk', [0.0, 0.55], 44, { y: 0.93 }), A('hk_orc_brute', 'walk', [-0.2, 0.7], 48, { y: 0.9 }), A(0, 'attack', [0.8, 0.8], 46, { y: 0.93, face: 'l' }), A('hk_orc_archer', 'idle', [0.2, 0.2], 40, { y: 0.97 })],
    fx: [{ kind: 'embers', n: 16, at: [0.85, 0.8], colour: '#ff7a2a' }, { kind: 'smoke', n: 6, at: [0.7, 0.5], colour: '#4a4a4a' }, { kind: 'ash', n: 10 }, { kind: 'flash', n: 1, colour: '#ffb060' }],
  },
};

/* ------------------------------------------------------------ the lands: weather and wildlife */

export const BIOME_SCRIPTS: Record<Biome, SceneScript> = {
  forest: { back: 'forest_4', scroll: 0, actors: [A('satyr_1', 'idle', [0.2, 0.2], 40, { y: 0.92 }), A(0, 'walk', [0.9, 0.35], 44, { y: 0.94, face: 'l' })], fx: [{ kind: 'leaves', n: 14 }, { kind: 'fireflies', n: 8 }, { kind: 'birds', n: 3 }] },
  desert: { back: 'oasis_3', scroll: -8, actors: [A(0, 'walk', [0.1, 0.8], 44, { y: 0.94 })], fx: [{ kind: 'dust', n: 30 }, { kind: 'birds', n: 3 }] },
  tundra: { back: 'snowfield_1', scroll: -5, actors: [A('werewolf_white', 'walk', [0.95, 0.4], 40, { y: 0.92, face: 'l' }), A(0, 'walk', [0.1, 0.55], 44, { y: 0.94 })], fx: [{ kind: 'snow', n: 50 }, { kind: 'mist', n: 2, colour: '#d8e8f8' }] },
  coast: { back: 'ocean_3', scroll: -4, actors: [A(0, 'walk', [0.15, 0.7], 44, { y: 0.95 })], fx: [{ kind: 'birds', n: 6 }, { kind: 'bubbles', n: 10, at: [0.5, 0.65], colour: '#ffffff' }, { kind: 'dust', n: 6, colour: '#f0e8d0' }] },
  swamp: { back: 'abandoned_3', scroll: 0, actors: [A('hk_ghost', 'idle', [0.7, 0.7], 40, { y: 0.78, bob: 3 }), A(0, 'walk', [0.1, 0.5], 44, { y: 0.94 })], fx: [{ kind: 'mist', n: 4, colour: '#8a9aa8' }, { kind: 'fireflies', n: 18, colour: '#a0ff90' }, { kind: 'bats', n: 2 }] },
  jungle: { back: 'battle_jungle', scroll: 0, actors: [A(0, 'walk', [0.1, 0.85], 46, { y: 0.94 }), A('hk_slime_green', 'walk', [0.9, 0.5], 24, { y: 0.97, face: 'l' })], fx: [{ kind: 'rain', n: 40 }, { kind: 'leaves', n: 8 }, { kind: 'birds', n: 3 }] },
  highlands: { back: 'peaks_2', scroll: -6, actors: [A(0, 'walk', [0.1, 0.8], 44, { y: 0.95 }), A('minotaur_1', 'idle', [0.85, 0.85], 50, { y: 0.93, face: 'l' })], fx: [{ kind: 'birds', n: 5 }, { kind: 'dust', n: 8 }] },
  ashlands: { back: 'meadows_4', scroll: 0, tint: ['#401000', 0.2], actors: [A(0, 'walk', [0.15, 0.6], 44, { y: 0.94 }), A('hk_imp', 'walk', [0.9, 0.5], 30, { y: 0.96, face: 'l' })], fx: [{ kind: 'ash', n: 36 }, { kind: 'embers', n: 14, colour: '#ff7a2a' }, { kind: 'flash', n: 1, colour: '#ff9a50' }] },
  steppe: { back: 'summer_2', scroll: -10, actors: [A(0, 'walk', [0.1, 0.75], 44, { y: 0.95 })], fx: [{ kind: 'dust', n: 18 }, { kind: 'birds', n: 5 }, { kind: 'petals', n: 6 }] },
  taiga: { back: 'winter_1', scroll: -3, actors: [A(0, 'walk', [0.9, 0.35], 44, { y: 0.95, face: 'l' }), A('werewolf_white', 'idle', [0.15, 0.15], 36, { y: 0.93 })], fx: [{ kind: 'snow', n: 26 }] },
};

/* ------------------------------------------------------------ the world's danger */

export const DANGER_SCRIPTS: Record<Difficulty, SceneScript> = {
  easy: { back: 'summer_4', scroll: -3, actors: [A(0, 'walk', [0.1, 0.7], 44, { y: 0.95 })], fx: [{ kind: 'birds', n: 4 }, { kind: 'petals', n: 8 }] },
  normal: { back: 'skies_2', scroll: -4, tint: ['#301020', 0.1], actors: [A(0, 'walk', [0.1, 0.6], 44, { y: 0.95 }), A('hk_zombie', 'walk', [1.0, 0.8], 40, { y: 0.95, face: 'l' })], fx: [{ kind: 'birds', n: 3 }, { kind: 'dust', n: 8 }] },
  hard: { back: 'skies_4', scroll: -6, tint: ['#300000', 0.3], actors: [A(0, 'attack', [0.4, 0.4], 46, { y: 0.93 }), A('horde_2', 'walk', [1.1, 0.62], 38, { y: 0.94, face: 'l' }), A('skeleton_warrior', 'attack', [0.62, 0.62], 40, { y: 0.93, face: 'l' }), A('hk_ogre', 'walk', [1.3, 0.85], 52, { y: 0.97, face: 'l', phase: 0.3 })], fx: [{ kind: 'embers', n: 16, colour: '#ff6a20' }, { kind: 'ash', n: 14 }, { kind: 'flash', n: 1, colour: '#ff5030' }] },
};

/* ------------------------------------------------------------ how it begins */

export const SCENARIO_SCRIPTS: Record<string, SceneScript> = {
  // a campfire and a few berries
  lone: { back: 'summer_2', scroll: 0, tint: ['#201030', 0.15], actors: [A(0, 'idle', [0.5, 0.5], 46, { y: 0.93 })], fx: [{ kind: 'embers', n: 10, at: [0.4, 0.9], colour: '#ff9a3a' }, { kind: 'fireflies', n: 10 }] },
  // three on the road
  band: { back: 'summer_5', scroll: -12, actors: [A(0, 'walk', [0.45, 0.45], 46, { y: 0.94 }), A(1, 'walk', [0.3, 0.3], 42, { y: 0.9 }), A(2, 'walk', [0.15, 0.15], 40, { y: 0.96 })], fx: [{ kind: 'dust', n: 14 }, { kind: 'birds', n: 3 }] },
  // a burning village behind, folk fleeing from it
  tribe: { back: 'abandoned_3', scroll: -16, tint: ['#401000', 0.25], actors: [A(0, 'walk', [0.2, 0.7], 46, { y: 0.94 }), A(1, 'walk', [0.05, 0.55], 40, { y: 0.9, phase: 0.2 }), A(2, 'walk', [-0.1, 0.4], 38, { y: 0.96, phase: 0.5 })], fx: [{ kind: 'embers', n: 22, at: [0.2, 0.55], colour: '#ff6a20' }, { kind: 'smoke', n: 8, at: [0.2, 0.5], colour: '#303030' }, { kind: 'ash', n: 14 }] },
  // a store of wood and stone, work going on
  supplied: { back: 'summer_1', scroll: 0, actors: [A(0, 'work', [0.4, 0.4], 46, { y: 0.94 }), A(1, 'walk', [0.9, 0.55], 42, { y: 0.92, face: 'l' })], fx: [{ kind: 'sparks', n: 8, at: [0.45, 0.82], colour: '#ffe9a0' }, { kind: 'smoke', n: 6, at: [0.6, 0.4], colour: '#cfcfcf' }, { kind: 'leaves', n: 6 }] },
};

/* ------------------------------------------------------------ a founder at their work (by what they love best) */

const WORK: Partial<Record<Skill, { anim: Anim; fx: Fx[]; beast?: string }>> = {
  construction: { anim: 'work', fx: [{ kind: 'sparks', n: 10, at: [0.5, 0.8], colour: '#ffe9a0' }, { kind: 'dust', n: 6 }] },
  crafting: { anim: 'work', fx: [{ kind: 'sparks', n: 16, at: [0.5, 0.82], colour: '#ffb84a' }, { kind: 'smoke', n: 4, at: [0.7, 0.5], colour: '#8a8a8a' }] },
  farming: { anim: 'work', fx: [{ kind: 'leaves', n: 10 }, { kind: 'petals', n: 8 }, { kind: 'birds', n: 3 }] },
  gathering: { anim: 'work', fx: [{ kind: 'leaves', n: 12 }, { kind: 'fireflies', n: 6 }] },
  cooking: { anim: 'work', fx: [{ kind: 'smoke', n: 8, at: [0.5, 0.7], colour: '#d8d8d8' }, { kind: 'embers', n: 8, at: [0.5, 0.9], colour: '#ff9a3a' }] },
  research: { anim: 'read', fx: [{ kind: 'wisps', n: 12, colour: '#9ab8ff' }] },
  medicine: { anim: 'read', fx: [{ kind: 'wisps', n: 10, colour: '#9affc0' }, { kind: 'petals', n: 6 }] },
  melee: { anim: 'attack', fx: [{ kind: 'sparks', n: 10, at: [0.6, 0.7], colour: '#fff4c0' }, { kind: 'dust', n: 6 }], beast: 'skeleton_warrior' },
  ranged: { anim: 'shoot', fx: [{ kind: 'leaves', n: 8 }, { kind: 'birds', n: 2 }], beast: 'satyr_1' },
  animals: { anim: 'walk', fx: [{ kind: 'dust', n: 8 }, { kind: 'birds', n: 3 }], beast: 'werewolf_white' },
  social: { anim: 'walk', fx: [{ kind: 'fireflies', n: 14 }, { kind: 'petals', n: 8 }] },
};

/** A founder at what they do best, in their people's land: the doll first, a creature beside them if the work has one. */
export function founderScript(origin: OriginId, loves: Skill | undefined): SceneScript {
  const w = (loves && WORK[loves]) || WORK.social!;
  const base = ORIGIN_SCRIPTS[origin];
  const moving = w.anim === 'walk';
  const actors: Actor[] = [A(0, w.anim, moving ? [0.15, 0.6] : [0.4, 0.4], 52, { y: 0.94 })];
  if (w.beast) actors.push(A(w.beast, w.anim === 'attack' ? 'attack' : 'walk', [0.9, 0.7], 40, { y: 0.92, face: 'l' }));
  return { back: base.back, scroll: base.scroll ? base.scroll : 0, tint: base.tint, actors, fx: w.fx };
}

/* ------------------------------------------------------------ events and raids (the story cards, the raid recap) */

/** The families an event's scene comes from: its kind, then the words of its title and telling. The dolls are the event's
 *  townsperson first (when it's about one), then whoever else the caller has. */
export type EventFamily = 'raid' | 'stranger' | 'plague' | 'storm' | 'feast' | 'envoy' | 'miracle' | 'cult' | 'death' | 'war' | 'trade' | 'wild' | 'omen' | 'road' | 'council' | 'generic';

const FAMILY_WORDS: [EventFamily, RegExp][] = [
  ['plague', /plague|sickness|\bsick\b|fever|disease|pox|blight|famine|rot\b/i],
  ['cult', /\bcult|heretic|sacrific|ritual|dark god|whisper/i],
  ['miracle', /miracle|blessing|divine|saint|holy|vision|resurrect|revive/i],
  ['storm', /storm|flood|lightning|gale|tempest|hail|drought|earthquake|quake|fire\b|wildfire|blizzard|cold snap/i],
  ['feast', /feast|festival|wedding|harvest|celebrat|fair\b|dance|bard|minstrel|birth|toast/i],
  ['raid', /raid|bandit|raider|wolves|wolf|attack|siege|ambush|thieves|pirate|marauder|slaver|hostile/i],
  ['war', /\bwar\b|army|host|conquest|invad|battle|assault|garrison/i],
  ['envoy', /envoy|ambassador|emissary|herald|tribute|treaty|alliance|embassy|lord\b|queen|king\b/i],
  ['trade', /caravan|merchant|trader|pedlar|peddler|market|goods|prices?\b|loan/i],
  ['stranger', /stranger|wanderer|traveller|traveler|newcomer|refugee|gate|beggar|pilgrim|knock/i],
  ['death', /death|died|dying|grave|funeral|ghost|haunt|undead|skeleton/i],
  ['omen', /omen|comet|eclipse|star|dream|prophe|oracle|sign\b|curse/i],
  ['wild', /beast|bear|monster|dragon|hunt|forest|creature|lair|nest|wild/i],
  ['council', /council|trial|law|edict|tax|vote|strike|revolt|crime|judge|elder/i],
];
const KIND_FAMILY: Record<string, EventFamily> = { envoy: 'envoy', refugees: 'stranger', council: 'council', trial: 'council', revolt: 'council', dragon: 'wild', enemy: 'raid', secret: 'stranger', road: 'road', watch: 'raid', debrief: 'raid', village: 'trade' };

/** Which family of scene an event gets: its words first (they say what it is), then its kind, else the generic scene.
 *  Only a fallback now: every choice event names its own scene (data/eventSceneIds.ts, panel/eventScenes.ts). */
export function eventFamily(kind: string, title: string, text: string): EventFamily {
  const words = `${title}. ${text}`;
  for (const [fam, re] of FAMILY_WORDS) if (re.test(words)) return fam;
  return KIND_FAMILY[kind] ?? 'generic';
}

/** The raiders' pack sprites by raid kind (the recap's comic strip draws them); kinds not listed get the match by name. */
const RAIDER_SPRITES: Record<string, string[]> = {
  wolves: ['werewolf_white', 'werewolf_black'], prowl_wolves: ['werewolf_black'], boars: ['boar_king'], rivals: ['hk_orc_grunt', 'hk_orc_archer'], prowl_scouts: ['hk_orc_grunt'],
  slimes: ['hk_slime_green', 'hk_slime_blue'], bandits: ['pirate_leader', 'samurai_archer'], band_bandits: ['pirate_leader'], prowl_thieves: ['kunoichi'], prowl_slavers: ['pirate_leader'], gang: ['ninja_peasant', 'pirate_leader'],
  army: ['knight_1', 'knight_2'], marauders: ['hk_orc_brute', 'hk_orc_grunt'], mechanized: ['robot_infantry', 'robot_swordsman'], zombies: ['hk_zombie', 'hk_zombie_brute'],
  frost: ['wanderer_mage', 'hk_tyrant'], rats: ['hk_slime_orange'], pirates: ['pirate_leader', 'pirate_zombie'], drones: ['robot_destroyer'], warband: ['hk_orc_warlord', 'hk_orc_grunt'],
  lions: ['werewolf_red'], wild_dogs: ['werewolf_red'], crocodiles: ['squidman'], rival_lich: ['skeleton_warrior', 'skeleton_spearman'], rival_druid: ['satyr_1', 'werewolf_white'],
};
export const raiderSprites = (kindId: string): string[] => RAIDER_SPRITES[kindId] ?? ['hk_orc_grunt', 'hk_orc_brute'];

export type RecapPanel = 'warning' | 'clash' | 'turn' | 'after';
/** The four panels of a raid told as a strip. Dolls: the best defender first, then others who fought. `raiders` are pack
 *  sprite ids; `how` is how it went. */
export function recapScript(panel: RecapPanel, raiders: string[], how: 'victory' | 'driven' | 'pillaged', night: boolean, boss: boolean): SceneScript {
  const r1 = raiders[0] ?? 'hk_orc_grunt';
  const r2 = raiders[1] ?? r1;
  const back = night ? 'moon_1' : 'battle_ruins';
  const tint: [string, number] | undefined = night ? ['#0a1030', 0.3] : undefined;
  switch (panel) {
    case 'warning':
      return { back, scroll: 0, tint, actors: [A(0, 'idle', [0.2, 0.2], 46, { y: 0.93 }), A(1, 'idle', [0.34, 0.34], 42, { y: 0.9 }), A(r1, 'walk', [1.1, 0.7], 40, { y: 0.93, face: 'l' }), A(r2, 'walk', [1.35, 0.85], 40, { y: 0.9, face: 'l' })], fx: [{ kind: 'dust', n: 10, at: [0.85, 0.96] }, { kind: 'birds', n: 4 }] };
    case 'clash':
      return { back, scroll: 0, tint, actors: [A(0, 'attack', [0.4, 0.4], 48, { y: 0.93 }), A(1, 'attack', [0.28, 0.28], 42, { y: 0.9 }), A(r1, 'attack', [0.62, 0.62], 44, { y: 0.93, face: 'l' }), A(r2, 'attack', [0.74, 0.74], 42, { y: 0.9, face: 'l' })], fx: [{ kind: 'sparks', n: 14, at: [0.52, 0.72], colour: '#fff4c0' }, { kind: 'dust', n: 12, at: [0.5, 0.96] }] };
    case 'turn':
      if (how === 'pillaged') return { back, scroll: 0, tint: ['#401000', 0.3], actors: [A(r1, 'attack', [0.4, 0.4], 48, { y: 0.93 }), A(r2, 'walk', [0.5, 0.8], 44, { y: 0.9 }), A(1, 'idle', [0.12, 0.12], 38, { y: 0.9 })], fx: [{ kind: 'embers', n: 16, at: [0.7, 0.8], colour: '#ff6a20' }, { kind: 'smoke', n: 7, at: [0.7, 0.45], colour: '#303030' }] };
      return { back, scroll: 0, tint, actors: [A(0, 'attack', [0.45, 0.45], 52, { y: 0.93 }), A(r1, boss ? 'idle' : 'idle', [0.7, 0.7], boss ? 56 : 44, { y: 0.93, face: 'l' })], fx: [{ kind: 'flash', n: 1, colour: '#fff8d0' }, { kind: 'sparks', n: 18, at: [0.58, 0.6], colour: '#ffd84a' }, { kind: 'wisps', n: 8, colour: '#ffffff' }] };
    case 'after':
      return { back, scroll: 0, tint: how === 'pillaged' ? ['#401000', 0.25] : tint, actors: [A(0, 'idle', [0.4, 0.4], 46, { y: 0.93 }), A(1, 'idle', [0.55, 0.55], 42, { y: 0.9, face: 'l' })], fx: how === 'pillaged' ? [{ kind: 'smoke', n: 8, at: [0.6, 0.5], colour: '#303030' }, { kind: 'ash', n: 14 }] : [{ kind: 'petals', n: 8 }, { kind: 'birds', n: 3 }, { kind: 'smoke', n: 3, at: [0.8, 0.5], colour: '#cfcfcf' }] };
  }
}
