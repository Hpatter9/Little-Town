// Material icons for the mined and refined materials (Free Mining Pixel Icons by CraftPix, 32px; see CREDITS.md).
// Materials without one are shown as text.

import type { Material } from '../../shared/data/materials';
import alloys from './materials/alloys.png';
import bricks from './materials/bricks.png';
import clay from './materials/clay.png';
import coal from './materials/coal.png';
import concrete from './materials/concrete.png';
import flint from './materials/flint.png';
import glass from './materials/glass.png';
import iron from './materials/iron.png';
import ironOre from './materials/iron_ore.png';
import rareMinerals from './materials/rare_minerals.png';
import steel from './materials/steel.png';
import stone from './materials/stone.png';

const URLS: Partial<Record<Material, string>> = {
  alloys: alloys,
  bricks: bricks,
  clay: clay,
  coal: coal,
  concrete: concrete,
  flint: flint,
  glass: glass,
  iron: iron,
  iron_ore: ironOre,
  rare_minerals: rareMinerals,
  steel: steel,
  stone: stone,
};

/** A small icon for a material (null if it has none). */
export function materialIcon(m: Material, size = 14): HTMLElement | null {
  const url = URLS[m];
  if (!url) return null;
  const e = document.createElement('img');
  e.src = url;
  e.width = e.height = size;
  e.style.imageRendering = 'pixelated';
  e.style.verticalAlign = 'middle';
  e.style.marginRight = '2px';
  return e;
}
