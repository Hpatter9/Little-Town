// Material icons for the mined and refined materials (Free Mining Pixel Icons by CraftPix, 32px; see CREDITS.md).
// The rest borrow a DawnLike item icon or a code-drawn one (`stockIcon`); a material with neither is shown as text.

import type { IconSheet, ItemDef } from '../../shared/data/items';
import type { Material } from '../../shared/data/materials';
import { itemIcon } from './icons';
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

/** Where the other materials' pictures are: a cell of a DawnLike sheet, or a code-drawn icon (customIcons.ts). */
const CELLS: Partial<Record<Material, ItemDef['icon']>> = {
  berries: { sheet: 'Food', x: 7, y: 2 },
  fruit: { sheet: 'Food', x: 0, y: 2 },
  vegetables: { sheet: 'Food', x: 0, y: 3 },
  grain: { sheet: 'Food', x: 6, y: 3 },
  flour: { sheet: 'Food', x: 0, y: 5 },
  bread: { sheet: 'Food', x: 1, y: 4 },
  milk: { sheet: 'Food', x: 7, y: 1 },
  herbs: { sheet: 'Food', x: 6, y: 1 },
  rations: { sheet: 'Food', x: 6, y: 4 },
  eggs: { sheet: 'Flesh', x: 1, y: 1 },
  meat: { sheet: 'Flesh', x: 3, y: 0 },
  dried_meat: { sheet: 'Flesh', x: 3, y: 4 },
  bone: { sheet: 'Flesh', x: 2, y: 0 },
  hide: { sheet: 'Flesh', x: 0, y: 8 },
  leather: { sheet: 'Flesh', x: 3, y: 8 },
  arrows: { sheet: 'Ammo', x: 4, y: 2 },
  sling_stones: { sheet: 'Ammo', x: 5, y: 0 },
  shot: { sheet: 'Ammo', x: 6, y: 0 },
  cartridges: { sheet: 'Ammo', x: 0, y: 0 },
  ...Object.fromEntries((['wood', 'fiber', 'lumber', 'cloth', 'oil', 'fuel', 'plastic', 'electronics', 'circuits', 'power_cells', 'totem'] as const).map((m) => [m, { sheet: 'Custom' as IconSheet, x: 0, y: 0, name: `mat_${m}` }])),
  wool: { sheet: 'Custom', x: 0, y: 0, name: 'wool' },
};

/** Any material's picture, `size` pixels square: its own icon, else a borrowed one (null if neither). */
export function stockIcon(m: Material, size = 16): HTMLElement | null {
  const own = materialIcon(m, size);
  if (own) return own;
  const icon = CELLS[m];
  return icon ? itemIcon({ icon } as ItemDef, size / 16) : null;
}
