// The cutscenes' props and held things (the owner's ask: "props involved like fire, an actual marshmallow on a stick,
// things like that to bring the scene to life"). A script (data/cutscenes.ts) places props on the stage by kind, and
// puts things in the actors' hands; this is what each kind is: its sprite (a file under src/renderer/art/, cut from
// the packs by tools/compose-scene-props.cjs or shared with the map's art), how big it's drawn, whether and where it
// burns, how it moves. Played by renderer/cutscene/sceneProps.ts. Pure data: the tests read it.

/** A flame on a burning thing: where (shares of its width from the left, and of its height up from its foot) and how
 *  big (1: a campfire's flame). */
export type FlameSpot = [number, number, number];

export interface PropDef {
  /** The sprite, a file under src/renderer/art/ (frames side by side when `frames` is set); the air has none. */
  art?: string;
  frames?: number;
  /** Drawn at this share of the file's pixels (the scene/ files are at twice the stage's pixel: 0.5). */
  scale: number;
  /** Tinted (a pot darkened to iron, a log dyed to a bedroll). */
  tint?: number;
  /** How it burns once lit: its flames, whether it smokes, and the light it throws (stage px about its foot). Things
   *  without `fire` burn too, with flames spread over them (`FLAMES_ANY`). */
  fire?: { spots: FlameSpot[]; smoke?: boolean; light: number };
  /** Burning from the start (a campfire). */
  lit?: boolean;
  /** Its sprite once doused or burned out (the cold firepit). */
  out?: string;
  /** How it moves of itself: a banner's frames in the wind, the goat, a flock. */
  anim?: 'flutter' | 'goat' | 'birds';
  /** A light of its own (a lantern): its reach in stage px. */
  glow?: number;
  /** Not a thing but the air: rain, snow, falling ash, fireflies (drawn over the whole stage). */
  weather?: 'rain' | 'snow' | 'ash' | 'fireflies';
  /** Lies flat on the ground (a scorch mark): drawn behind everything standing. */
  flat?: boolean;
  /** Things set on it (a table with food): their art and where (stage px from its middle and its top). */
  dressing?: [string, number, number][];
  /** What it says when startled (the goat). */
  bleat?: string;
}

/** Flames over anything lit that has no `fire` of its own. */
export const FLAMES_ANY: FlameSpot[] = [
  [0.25, 0.45, 0.7],
  [0.55, 0.75, 0.9],
  [0.8, 0.4, 0.6],
];

const S = 0.5; // (the scene/ files' scale)

export const PROPS = {
  // fire
  campfire: { art: 'scene/firepit.png', scale: S, lit: true, out: 'scene/firepit_cold.png', fire: { spots: [[0.42, 0.35, 0.75], [0.58, 0.3, 0.6]], light: 44 } },
  firepit: { art: 'scene/firepit_cold.png', scale: S, fire: { spots: [[0.5, 0.35, 0.7]], light: 40 } },
  warren: { art: 'nests/warren.png', scale: 0.62, out: 'nests/warren.png', fire: { spots: [[0.2, 0.75, 1.1], [0.45, 0.95, 1.3], [0.7, 0.85, 1.2], [0.85, 0.5, 0.9], [0.5, 0.2, 0.8], [0.12, 0.35, 0.8]], smoke: true, light: 80 } },
  torch: { art: 'scene/torch.png', scale: 1.4, fire: { spots: [[0.85, 0.95, 0.35]], light: 26 }, lit: true },
  lantern: { art: 'scene/lamp.png', scale: S, glow: 22 },
  scorch: { art: 'scene/scorch.png', scale: 0.9, tint: 0x241a14, flat: true, fire: { spots: [[0.4, 0.3, 0.35], [0.7, 0.2, 0.3]], smoke: true, light: 14 } },
  cauldron: { art: 'scene/cauldron.png', scale: S, tint: 0x55555e, fire: { spots: [[0.3, 0.05, 0.4], [0.7, 0.05, 0.4]], light: 24 } },
  // the camp and the road
  tent: { art: 'scene/tent.png', scale: S },
  tent_side: { art: 'scene/tent_side.png', scale: S },
  bedroll: { art: 'scene/log.png', scale: S, tint: 0x6a7a9a },
  log: { art: 'scene/log.png', scale: S },
  stump: { art: 'scene/stump.png', scale: S },
  rock: { art: 'scene/rock.png', scale: S },
  cart: { art: 'scene/cart.png', scale: S },
  wagon: { art: 'scene/wagon.png', scale: S },
  barrel: { art: 'scene/barrel.png', scale: S },
  crate: { art: 'scene/crate.png', scale: S },
  hay: { art: 'scene/hay.png', scale: S },
  bucket: { art: 'scene/bucket.png', scale: S },
  sign: { art: 'scene/sign.png', scale: S },
  signpost: { art: 'scene/signpost.png', scale: S },
  chest: { art: 'clutter/chest.png', scale: 0.8 },
  gold: { art: 'clutter/gold2.png', scale: 0.8 },
  table: { art: 'scene/table.png', scale: S },
  feast: { art: 'scene/table.png', scale: S, dressing: [['scene/bread.png', -6, -3], ['scene/pie.png', 1, -3], ['scene/tankard.png', 7, -4], ['scene/apple.png', -1, -2]] },
  // war and the dead
  banner: { art: 'fields/flag.png', frames: 6, scale: 0.55, anim: 'flutter' },
  banner_red: { art: 'fields/flag.png', frames: 6, scale: 0.55, anim: 'flutter', tint: 0xd06050 },
  banner_black: { art: 'fields/flag.png', frames: 6, scale: 0.6, anim: 'flutter', tint: 0x403848 },
  grave: { art: 'scene/grave.png', scale: S },
  skull: { art: 'scene/skull.png', scale: S },
  bones: { art: 'deep/skeleton.png', scale: 0.55 },
  skulls: { art: 'nests/skulls.png', scale: 0.45 },
  // the living
  duchess: { art: 'scene/goat.png', frames: 6, scale: S, anim: 'goat', bleat: 'Mehh.' },
  birds: { art: 'birds.png', scale: 0.5, anim: 'birds' },
  // the air
  rain: { scale: 1, weather: 'rain' },
  snow: { scale: 1, weather: 'snow' },
  ash: { scale: 1, weather: 'ash' },
  fireflies: { scale: 1, weather: 'fireflies' },
} as const satisfies Record<string, PropDef>;
export type PropKind = keyof typeof PROPS;

/** What a hand holds: its sprite (a 16px DawnLike cell, drawn at `scale`), where it's gripped (px in the cell) and
 *  which way it points in the art (radians: DawnLike's blades point up and to the right). `carried` things are held up
 *  before the chest (a list, a tankard) rather than swung; a `stick` is drawn (no pack has a marshmallow on one). */
export interface HeldDef {
  art?: string;
  scale: number;
  grip?: [number, number];
  points?: number;
  carried?: boolean;
  /** Burns at its tip (a torch). */
  burns?: boolean;
  /** Drawn in code: a stick with a marshmallow on the end, toasting in a fire it's held to. */
  stick?: boolean;
}

const UP_RIGHT = -Math.PI / 4;
export const HELD = {
  sword: { art: 'scene/sword.png', scale: 0.8, grip: [3, 12], points: UP_RIGHT },
  torch: { art: 'scene/torch.png', scale: 0.8, grip: [3, 12], points: UP_RIGHT, burns: true },
  ladle: { art: 'scene/ladle.png', scale: 0.8, grip: [8, 3], points: -Math.PI * 0.6 },
  tankard: { art: 'scene/tankard.png', scale: 0.6, carried: true },
  list: { art: 'scene/list.png', scale: 0.65, carried: true },
  map: { art: 'scene/map.png', scale: 0.65, carried: true },
  pamphlet: { art: 'scene/pamphlet.png', scale: 0.55, carried: true },
  bread: { art: 'scene/bread.png', scale: 0.7, carried: true },
  cheese: { art: 'scene/cheese.png', scale: 0.7, carried: true },
  bucket: { art: 'scene/bucket.png', scale: 0.4, carried: true },
  lantern: { art: 'scene/lantern.png', scale: 0.7, carried: true, burns: true },
  axe: { art: 'scene/axe.png', scale: 0.8, grip: [3, 12], points: UP_RIGHT },
  marshmallow_stick: { scale: 1, stick: true },
} as const satisfies Record<string, HeldDef>;
export type HeldKind = keyof typeof HELD;
