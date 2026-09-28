// Item icons DawnLike doesn't have (guns, power tools, machines, the later eras' materials), drawn in code
// in the same 16px style: an 8-wide sheet built once as a data URL for the CSS sprites in icons.ts.

import { noTone, Painter } from './pixelArt';

const DARK = '#2a2a30';
const STEEL = '#8a94a0';
const STEEL_LIGHT = '#c0c8d0';
const WOOD = '#8a5a30';
const WOOD_DARK = '#5a3a1e';
const GLOW = '#8ad8f8';

/** The icons, in sheet order (the index is the icon's x; they all sit on row 0 or 1). */
export const CUSTOM_ICONS: Record<string, (p: Painter) => void> = {
  // tavern furnishings
  log_table: (p) => {
    p.rect(1, 5, 14, 5, WOOD);
    p.rect(1, 5, 14, 1, '#a87a48');
    p.rect(2, 10, 2, 4, WOOD_DARK);
    p.rect(12, 10, 2, 4, WOOD_DARK);
    p.rect(0, 12, 16, 2, '#5a3a1e');
  },
  stone_hearth: (p) => {
    p.rect(1, 3, 14, 12, '#6b6763');
    p.rect(4, 7, 8, 8, '#2a1a10');
    p.rect(5, 10, 6, 4, '#e8702a');
    p.rect(7, 11, 2, 2, '#ffd060');
  },
  barrels: (p) => {
    p.rect(2, 4, 6, 10, WOOD);
    p.rect(8, 6, 6, 8, WOOD_DARK);
    for (const y of [6, 11]) p.rect(2, y, 12, 1, '#3a3a40');
  },
  hide_rug: (p) => {
    p.rect(2, 5, 12, 7, '#a88258');
    p.rect(0, 6, 2, 2, '#a88258');
    p.rect(14, 9, 2, 2, '#a88258');
    p.rect(5, 7, 6, 2, '#7c5c3c');
  },
  oak_table: (p) => {
    p.rect(1, 5, 14, 4, '#a8703a');
    p.rect(2, 9, 2, 5, WOOD_DARK);
    p.rect(12, 9, 2, 5, WOOD_DARK);
    p.rect(6, 3, 3, 2, '#c8a050');
  },
  brick_hearth: (p) => {
    p.rect(1, 2, 14, 13, '#a4543a');
    for (let y = 4; y < 15; y += 3) p.rect(1, y, 14, 1, '#6a3424');
    p.rect(4, 7, 8, 8, '#2a1a10');
    p.rect(5, 10, 6, 4, '#e8702a');
  },
  tapestry: (p) => {
    p.rect(3, 1, 10, 14, '#8a2a3a');
    p.rect(5, 4, 6, 5, '#c8a050');
    p.rect(2, 1, 12, 1, WOOD_DARK);
  },
  upright_piano: (p) => {
    p.rect(2, 2, 12, 12, '#2a1a10');
    p.rect(3, 8, 10, 3, '#f0ece0');
    for (let x = 4; x < 13; x += 2) p.rect(x, 8, 1, 2, '#1a1a1a');
  },
  // fare
  roast_meat: (p) => {
    p.rect(3, 6, 9, 6, '#8a3a22');
    p.rect(4, 7, 7, 3, '#b0542a');
    p.rect(11, 8, 4, 2, '#e8e0cc');
  },
  porridge: (p) => {
    p.rect(3, 8, 10, 5, '#b0704a');
    p.rect(4, 7, 8, 2, '#e8d8a0');
    p.rect(9, 3, 1, 4, '#c8b8a0');
  },
  berry_bowl: (p) => {
    p.rect(3, 8, 10, 5, '#b0704a');
    for (const [x, y] of [[4, 6], [7, 5], [10, 6], [6, 7], [9, 7]]) p.rect(x, y, 2, 2, '#8a2a4a');
  },
  herb_tea: (p) => {
    p.rect(4, 7, 7, 7, '#c8b8a0');
    p.rect(11, 8, 2, 3, '#c8b8a0');
    p.rect(5, 7, 5, 2, '#5a9443');
    p.rect(6, 3, 1, 3, '#e8e8e8');
  },
  berry_wine: (p) => {
    p.rect(5, 5, 6, 9, '#b0704a');
    p.rect(6, 3, 4, 2, '#80502f');
    p.rect(5, 8, 6, 2, '#8a2a4a');
  },
  ale: (p) => {
    p.rect(4, 5, 7, 9, '#c8a050');
    p.rect(4, 4, 7, 2, '#f0f0e0');
    p.rect(11, 7, 2, 4, WOOD_DARK);
  },
  stew: (p) => {
    p.rect(2, 7, 12, 6, '#3a3a40');
    p.rect(3, 6, 10, 2, '#8a4a2a');
    p.rect(5, 6, 2, 1, '#6fd06a');
    p.rect(9, 3, 1, 3, '#c8c8c8');
  },
  meat_pie: (p) => {
    p.rect(2, 8, 12, 5, '#d0903a');
    p.rect(3, 6, 10, 3, '#e0a850');
    p.rect(6, 7, 4, 1, '#8a3a22');
  },
  honey_cake: (p) => {
    p.rect(3, 7, 10, 6, '#d0903a');
    p.rect(3, 6, 10, 2, '#f0c848');
    p.rect(7, 4, 2, 2, '#8a2a4a');
  },
  // shop wares
  bone_trinket: (p) => {
    for (let i = 0; i < 5; i++) p.rect(3 + i * 2, 5 + Math.abs(2 - i), 2, 2, '#e8e0cc');
    p.rect(7, 10, 2, 4, '#c8bca0');
  },
  reed_basket: (p) => {
    p.rect(3, 7, 10, 7, '#b89a58');
    for (let x = 4; x < 13; x += 2) p.rect(x, 7, 1, 7, '#8a7040');
    p.rect(4, 4, 8, 1, '#8a7040');
    p.rect(4, 4, 1, 3, '#8a7040');
    p.rect(11, 4, 1, 3, '#8a7040');
  },
  clay_figurine: (p) => {
    p.rect(5, 7, 7, 5, '#b0704a');
    p.rect(10, 5, 3, 3, '#b0704a');
    for (const x of [5, 7, 9, 11]) p.rect(x, 12, 1, 2, '#80502f');
  },
  herbal_salve: (p) => {
    p.rect(4, 7, 8, 6, '#c8b8a0');
    p.rect(4, 5, 8, 2, '#5a9443');
    p.rect(5, 8, 6, 1, '#8a8070');
  },
  painted_urn: (p) => {
    p.rect(5, 4, 6, 10, '#b0704a');
    p.rect(4, 6, 8, 6, '#b0704a');
    p.rect(4, 8, 8, 1, '#3a6ab0');
    p.rect(5, 10, 6, 1, '#5a9443');
    p.rect(6, 2, 4, 2, '#80502f');
  },
  sweet_loaves: (p) => {
    p.rect(2, 7, 7, 5, '#d0903a');
    p.rect(8, 6, 6, 6, '#c0802a');
    p.rect(4, 8, 1, 1, '#8a2a4a');
    p.rect(10, 8, 1, 1, '#8a2a4a');
  },
  leather_satchel: (p) => {
    p.rect(3, 6, 10, 8, '#7c4c2c');
    p.rect(3, 6, 10, 3, '#9a6a3a');
    p.rect(7, 8, 2, 2, '#e8c040');
    p.rect(5, 2, 6, 1, '#5a3a1e');
    p.rect(5, 2, 1, 4, '#5a3a1e');
    p.rect(10, 2, 1, 4, '#5a3a1e');
  },
  dyed_cloth: (p) => {
    p.rect(2, 4, 12, 9, '#8a2a3a');
    p.rect(2, 6, 12, 2, '#c8a050');
    p.rect(2, 10, 12, 1, '#3a6ab0');
  },
  iron_brooch: (p) => {
    p.rect(4, 4, 8, 8, '#9aa0a8');
    p.rect(6, 6, 4, 4, '#e05a8a');
    p.rect(4, 4, 8, 1, STEEL_LIGHT);
  },
  glassware: (p) => {
    p.rect(3, 4, 4, 5, '#a8d8e8');
    p.rect(4, 9, 2, 3, '#a8d8e8');
    p.rect(3, 12, 4, 1, '#a8d8e8');
    p.rect(9, 5, 5, 8, '#88c0d8');
    p.rect(10, 3, 3, 2, '#88c0d8');
  },
  steel_cutlery: (p) => {
    p.rect(4, 2, 1, 12, STEEL_LIGHT);
    p.rect(3, 2, 3, 3, STEEL);
    p.rect(8, 2, 2, 12, STEEL);
    p.rect(11, 2, 1, 5, STEEL_LIGHT);
    p.rect(11, 7, 2, 7, WOOD);
  },
  plastic_toys: (p) => {
    p.rect(2, 8, 5, 5, '#e05a8a');
    p.rect(8, 5, 6, 4, '#3a8ad8');
    p.rect(9, 9, 1, 2, '#2a2a30');
    p.rect(12, 9, 1, 2, '#2a2a30');
    p.rect(4, 5, 2, 3, '#f0c848');
  },
  radio_set: (p) => {
    p.rect(2, 5, 12, 8, '#7a4a2a');
    p.rect(3, 6, 6, 6, '#c8b8a0');
    for (let y = 7; y < 12; y += 2) p.rect(3, y, 6, 1, '#8a8070');
    p.rect(10, 7, 3, 3, DARK);
    p.rect(12, 2, 1, 3, STEEL);
  },
  holo_charm: (p) => {
    p.rect(6, 9, 4, 4, '#c0c8e0');
    p.rect(4, 3, 8, 6, 'rgba(138, 216, 248, 0.6)');
    p.rect(7, 4, 2, 4, GLOW);
    p.rect(5, 6, 6, 1, GLOW);
  },
  // shop furnishings
  crate_stand: (p) => {
    p.rect(3, 6, 10, 8, WOOD);
    p.rect(3, 6, 10, 1, '#a87a48');
    p.rect(3, 10, 10, 1, WOOD_DARK);
    p.rect(5, 3, 3, 3, '#d8a050');
    p.rect(9, 4, 3, 2, '#8a4a30');
  },
  plank_shelf: (p) => {
    p.rect(2, 2, 12, 12, WOOD_DARK);
    for (const y of [5, 9, 13]) p.rect(2, y, 12, 1, WOOD);
    p.rect(4, 3, 2, 2, '#d8a050');
    p.rect(8, 7, 3, 2, '#8a4a30');
    p.rect(5, 11, 3, 2, '#aab35c');
  },
  woven_mat: (p) => {
    p.rect(1, 5, 14, 7, '#b89a58');
    for (let x = 2; x < 15; x += 3) p.rect(x, 5, 1, 7, '#8a7040');
  },
  clay_urns: (p) => {
    p.rect(3, 5, 5, 8, '#b0704a');
    p.rect(4, 3, 3, 2, '#80502f');
    p.rect(9, 8, 5, 5, '#c88a5a');
    p.rect(10, 7, 3, 1, '#80502f');
  },
  trestle_table: (p) => {
    p.rect(1, 6, 14, 3, WOOD);
    p.rect(2, 9, 2, 5, WOOD_DARK);
    p.rect(12, 9, 2, 5, WOOD_DARK);
    p.rect(4, 4, 3, 2, '#d8a050');
    p.rect(9, 4, 3, 2, '#5a5a64');
  },
  herb_planter: (p) => {
    p.rect(4, 9, 8, 5, '#b0704a');
    p.rect(5, 4, 2, 5, '#5a9443');
    p.rect(8, 3, 2, 6, '#3e7234');
    p.rect(10, 5, 2, 4, '#7fb456');
  },
  oak_shelves: (p) => {
    p.rect(2, 1, 12, 14, '#5a3a22');
    for (const y of [4, 8, 12]) p.rect(2, y, 12, 1, '#8a5a30');
    p.rect(4, 2, 3, 2, '#9aa0a8');
    p.rect(9, 6, 3, 2, '#d8c8a8');
    p.rect(5, 10, 4, 2, '#d0903a');
  },
  display_table: (p) => {
    p.rect(1, 6, 14, 4, '#8a2a3a');
    p.rect(1, 10, 14, 2, '#6a1a2a');
    p.rect(4, 4, 3, 2, '#e8c040');
    p.rect(9, 4, 3, 2, '#9aa0a8');
  },
  wool_rug: (p) => {
    p.rect(1, 4, 14, 9, '#8a2a3a');
    p.rect(3, 6, 10, 5, '#c8a050');
    p.rect(5, 8, 6, 1, '#8a2a3a');
  },
  iron_lantern: (p) => {
    p.rect(7, 1, 2, 2, DARK);
    p.rect(5, 3, 6, 9, DARK);
    p.rect(6, 4, 4, 7, '#f0c060');
    p.rect(4, 12, 8, 2, DARK);
  },
  glass_cabinet: (p) => {
    p.rect(2, 1, 12, 14, WOOD_DARK);
    p.rect(3, 2, 10, 12, '#a8d8e8');
    p.rect(3, 2, 10, 1, '#e0f4fa');
    p.rect(5, 5, 2, 2, '#e8c040');
    p.rect(9, 9, 2, 2, '#e05a8a');
  },
  neon_sign: (p) => {
    p.rect(1, 4, 14, 8, '#2a2a30');
    p.rect(3, 6, 10, 1, '#ff5ab8');
    p.rect(3, 9, 7, 1, GLOW);
  },
  musket: (p) => {
    p.rect(1, 9, 9, 2, WOOD);
    p.rect(1, 10, 3, 3, WOOD_DARK);
    p.rect(9, 8, 6, 1, STEEL);
    p.rect(8, 8, 2, 3, STEEL);
    p.px(15, 7, STEEL_LIGHT);
  },
  rifle: (p) => {
    p.rect(1, 8, 5, 3, WOOD_DARK);
    p.rect(5, 7, 10, 2, DARK);
    p.rect(7, 9, 2, 3, DARK);
    p.rect(9, 5, 3, 2, STEEL);
    p.px(15, 7, STEEL_LIGHT);
  },
  laser_rifle: (p) => {
    p.rect(1, 8, 4, 3, '#4a5264');
    p.rect(4, 6, 10, 3, '#9aa4b8');
    p.rect(4, 6, 10, 1, '#d0d8e8');
    p.rect(7, 9, 2, 3, '#4a5264');
    p.rect(14, 7, 2, 1, GLOW);
    p.rect(8, 7, 3, 1, GLOW);
  },
  pistols: (p) => {
    for (const [x, y] of [[1, 3], [6, 8]] as const) {
      p.rect(x, y, 8, 2, STEEL);
      p.rect(x, y + 2, 3, 4, WOOD);
      p.px(x + 8, y, STEEL_LIGHT);
    }
  },
  chainsaw: (p) => {
    p.rect(1, 6, 6, 6, '#e0a030');
    p.rect(2, 4, 3, 2, DARK);
    p.rect(7, 7, 8, 3, STEEL);
    for (let x = 7; x < 15; x += 2) p.px(x, 6, DARK);
    for (let x = 8; x < 15; x += 2) p.px(x, 10, DARK);
  },
  power_drill: (p) => {
    p.rect(3, 4, 8, 4, '#d8b030');
    p.rect(4, 8, 3, 6, DARK);
    p.rect(11, 5, 2, 2, STEEL);
    p.rect(13, 5, 3, 2, STEEL_LIGHT);
  },
  plasma_cutter: (p) => {
    p.rect(2, 7, 7, 4, '#6a7480');
    p.rect(3, 11, 2, 3, '#454c56');
    p.rect(9, 8, 2, 2, STEEL_LIGHT);
    p.rect(11, 8, 4, 2, '#ff9af0');
    p.px(15, 8, '#ffffff');
  },
  truck: (p) => {
    p.rect(1, 6, 9, 5, '#4f5d43');
    p.rect(10, 7, 5, 4, '#5f7a4a');
    p.rect(11, 8, 3, 2, '#9fc4d4');
    for (const x of [4, 12]) {
      p.rect(x - 1, 11, 3, 3, DARK);
      p.px(x, 12, STEEL);
    }
  },
  worker_bot: (p) => {
    p.rect(4, 5, 8, 7, '#6a7480');
    p.rect(5, 2, 6, 3, '#9aa4b0');
    p.px(6, 3, '#ff4a3a');
    p.px(9, 3, '#ff4a3a');
    p.rect(6, 7, 4, 2, GLOW);
    p.rect(2, 6, 2, 4, '#454c56');
    p.rect(12, 6, 2, 4, '#454c56');
    p.rect(5, 12, 2, 3, '#454c56');
    p.rect(9, 12, 2, 3, '#454c56');
  },
  energy_shield: (p) => {
    p.ellipse(8, 8, 6, 7, 'rgba(138,216,248,0.55)');
    p.ellipse(8, 8, 4, 5, 'rgba(232,252,255,0.6)');
    p.rect(7, 12, 2, 3, '#6a7480');
  },
  powered_armor: (p) => {
    p.rect(3, 3, 10, 9, '#6a7480');
    p.rect(3, 3, 10, 2, '#9aa4b0');
    p.rect(1, 4, 2, 5, '#454c56');
    p.rect(13, 4, 2, 5, '#454c56');
    p.rect(7, 6, 2, 2, GLOW);
    p.rect(4, 12, 3, 3, '#454c56');
    p.rect(9, 12, 3, 3, '#454c56');
  },
  phoenix_feather: (p) => {
    for (let i = 0; i < 11; i++) {
      p.px(3 + i, 13 - i, '#f29434');
      p.px(4 + i, 13 - i, '#ffd96e');
      if (i > 2) p.px(2 + i, 12 - i, '#d4482a');
    }
    p.px(2, 14, WOOD_DARK);
  },
  cartridges: (p) => {
    for (const x of [3, 7, 11]) {
      p.rect(x, 5, 2, 8, '#d8a050');
      p.rect(x, 3, 2, 2, '#a86a30');
      p.px(x, 13, '#8a5a20');
    }
  },
  alloy: (p) => {
    p.rect(2, 8, 12, 4, '#9aa8c0');
    p.rect(4, 6, 8, 2, '#c0cce0');
    p.rect(2, 11, 12, 1, '#6a7890');
  },
  circuit: (p) => {
    p.rect(3, 3, 10, 10, '#2a6a4a');
    p.rect(6, 6, 4, 4, DARK);
    for (let i = 4; i < 13; i += 3) {
      p.px(i, 1, '#d8c060');
      p.px(i, 14, '#d8c060');
      p.px(1, i, '#d8c060');
      p.px(14, i, '#d8c060');
    }
  },
  power_cell: (p) => {
    p.rect(5, 3, 6, 11, '#454c56');
    p.rect(7, 1, 2, 2, STEEL);
    p.rect(6, 5, 4, 7, '#4ae080');
    p.rect(6, 5, 4, 1, '#b0ffd0');
  },
  crown: (p) => {
    p.rect(2, 8, 12, 5, '#e0b030');
    for (const x of [2, 7, 12]) p.rect(x, 4, 2, 4, '#e0b030');
    p.px(8, 10, '#d83a3a');
    p.px(4, 10, '#3a8ad8');
    p.px(11, 10, '#3a8ad8');
  },
  core: (p) => {
    p.ellipse(8, 8, 6, 6, '#454c56');
    p.ellipse(8, 8, 4, 4, '#ff6a3a');
    p.ellipse(8, 8, 2, 2, '#ffe0a0');
  },
};

export const CUSTOM_ORDER = Object.keys(CUSTOM_ICONS);
export const CUSTOM_ROWS = Math.ceil(CUSTOM_ORDER.length / 8);

let url: string | null = null;
/** The sheet as a data URL (built on first use). */
export function customSheetUrl(): string {
  if (url) return url;
  const canvas = document.createElement('canvas');
  canvas.width = 8 * 16;
  canvas.height = CUSTOM_ROWS * 16;
  const ctx = canvas.getContext('2d')!;
  CUSTOM_ORDER.forEach((id, i) => CUSTOM_ICONS[id](new Painter(ctx, canvas.width, canvas.height, shift((i % 8) * 16, Math.floor(i / 8) * 16, ctx))));
  url = canvas.toDataURL();
  return url;
}

/** (each icon is drawn at its cell's offset: the painter's tone hook can't move things, so the context is translated) */
function shift(ox: number, oy: number, ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, ox, oy);
  return noTone;
}