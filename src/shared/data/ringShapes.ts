// The shape each people gives its ring wall (the owner's ask: the layout of the whole ring differs by origin, not
// only how its pieces look). sim/ringWall.ts `shapeRing` lays the line by it; the gates still stand on all four sides
// and the river is still pushed past.

export type RingShape = 'box' | 'star' | 'round' | 'octagon' | 'hexagon' | 'coffin' | 'grove' | 'scalloped' | 'flower' | 'jagged' | 'terraced';

/** What each shape is called on the wall's tap card. */
export const RING_SHAPE_NAMES: Record<RingShape, string> = {
  box: 'a square stockade',
  star: 'a star fort, with a bastion at each corner',
  round: 'a ring, round as a wagon circle',
  octagon: 'an eight-sided enclosure, laid out by the book',
  hexagon: 'a six-sided cell, like a honeycomb',
  coffin: 'a coffin-shaped close',
  grove: 'a ring that winds with the land, like a grove',
  scalloped: 'a scalloped ring, like a shell',
  flower: 'a ring in petals, like a flower',
  jagged: 'a jagged camp, all teeth',
  terraced: 'terraces, stepped like a hillside',
};

/** Each people's shape (the Court and the hold have walls of their own; the shape is there should they ever ring). */
export const RING_SHAPE_OF: Record<string, RingShape> = {
  settlers: 'box',
  knights: 'star',
  nomads: 'round',
  werewolf: 'round',
  alchemists: 'octagon',
  robot: 'hexagon',
  lich: 'coffin',
  druid: 'grove',
  merfolk: 'scalloped',
  fae: 'flower',
  orcs: 'jagged',
  dwarves: 'terraced',
  vampire: 'terraced',
};
