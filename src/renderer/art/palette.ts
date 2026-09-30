// Earthy Neolithic palette for the placeholder art.

export const PAL = {
  grassDark: '#3d6630',
  grass: '#557f38',
  grassLight: '#6f9a45',
  grassTip: '#8cb457',

  dirtDark: '#5e4630',
  dirt: '#7d6042',
  dirtLight: '#977750',
  pebble: '#a89a86',

  trunkDark: '#3b2616',
  trunk: '#5a3a22',
  trunkLight: '#77502f',

  leafDark: '#2b5028',
  leaf: '#3e7234',
  leafLight: '#5a9443',
  leafTip: '#7fb456',

  pineDark: '#1f4034',
  pine: '#2b5842',
  pineLight: '#3c7252',

  rockDark: '#4a4644',
  rock: '#6b6763',
  rockLight: '#8b8680',
  rockTip: '#aaa49b',
  moss: '#5f7f3a',

  mud: '#54452f',
  marsh: '#4a6840',
  waterDark: '#2f5f8f',
  water: '#4382b8',
  waterLight: '#86b9e0',
  reed: '#8a9448',
  reedLight: '#aab35c',
  cattail: '#6b4428',

  soil: '#5c3f27',
  soilLight: '#74512f',

  flameRed: '#d4482a',
  flameOrange: '#f29434',
  flameYellow: '#ffd96e',
  ember: '#ffb347',
  ash: '#4a4240',

  flowers: ['#e6d25a', '#e0e0e8', '#c77dc9', '#e27a5a', '#6a8ee0', '#f0a0c0'],
} as const;

type Swap = Partial<Record<Exclude<keyof typeof PAL, 'flowers'>, string>>;
const BASE = { ...PAL };

/** The land through the year (summer is the palette as drawn). Spring: fresh green and blossom. Autumn: gold
 *  grass and red and orange leaves. Winter: snow on the ground and the pines, the broadleaf trees bare. */
const SEASONS: Record<string, Swap> = {
  spring: {
    grassDark: '#46742f', grass: '#62923e', grassLight: '#82b24e', grassTip: '#a6ce6c',
    leafDark: '#3a6a2c', leaf: '#4f8a38', leafLight: '#78b454', leafTip: '#f2c6d8',
  },
  autumn: {
    grassDark: '#62622a', grass: '#85803a', grassLight: '#a49848', grassTip: '#c2ac5a',
    leafDark: '#80361a', leaf: '#b85424', leafLight: '#dc8a30', leafTip: '#f0b848',
    moss: '#8a7a3a', marsh: '#6a6a40', reed: '#b09048', reedLight: '#c8a858',
  },
  winter: {
    grassDark: '#b4c0c8', grass: '#d6dee4', grassLight: '#e8eef2', grassTip: '#fafcfe',
    leafDark: '#4a3a2e', leaf: '#5c4838', leafLight: '#dde4ea', leafTip: '#f4f8fa',
    pineLight: '#dbe5ea', moss: '#9aa6ac', marsh: '#a8b4bc', water: '#7ea6c4', waterLight: '#dcebf6', reed: '#9a9270', reedLight: '#b0a88a',
  },
};
/** Some biomes' seasons differ: the desert has no snow (a cold, pale winter), and the tundra's snow only thaws
 *  to moss in spring and summer. */
const BIOME_SEASONS: Record<string, Record<string, Swap | null>> = {
  desert: { winter: { grassDark: '#a09070', grass: '#bcae8a', grassLight: '#cfc4a2', grassTip: '#e0d8bc', leafDark: '#4e5a38', leaf: '#6a7448', leafLight: '#8a9060', leafTip: '#a0a070' } },
  tundra: {
    spring: { grassDark: '#6e8468', grass: '#88a07c', grassLight: '#a4b896', grassTip: '#c4d4b8' },
    summer: { grassDark: '#687e5e', grass: '#809a70', grassLight: '#9cb286', grassTip: '#bccca6' },
    autumn: null, // (the biome's own frosty palette)
    winter: null,
  },
};

/** The little flowers dotted about: brightest in spring, seed heads in autumn, snow tufts in winter. (Recoloured
 *  rather than removed, so the layout of the land stays the same all year.) */
const SEASON_FLOWERS: Record<string, readonly string[]> = {
  spring: ['#f0dc5a', '#f4f0f8', '#d884d8', '#f08aa8', '#7898e8', '#f4b0c8'],
  autumn: ['#c89040', '#a86a30', '#d8b060', '#8a5a2a'],
  winter: ['#eef3f6', '#dfe7ec', '#f6f9fb', '#cfd9df'],
};

/** Recolour the land for the town's biome and the season. Art drawn afterwards uses it (art already drawn keeps
 *  its colours, so the town redraws its scenery when the season turns). */
export function applySeasonPalette(biome: string, season: string): void {
  Object.assign(PAL as unknown as Record<string, unknown>, BASE);
  applyBiomePalette(biome);
  const special = BIOME_SEASONS[biome];
  const swap = special && season in special ? special[season] : SEASONS[season];
  if (swap) Object.assign(PAL as unknown as Record<string, string>, swap);
  const dryWinter = biome === 'desert' && season === 'winter';
  (PAL as unknown as { flowers: readonly string[] }).flowers = (dryWinter ? SEASON_FLOWERS.autumn : SEASON_FLOWERS[season]) ?? BASE.flowers;
}

/** Recolour the land for the town's biome. */
export function applyBiomePalette(biome: string): void {
  const swaps: Record<string, Partial<Record<keyof typeof PAL, string>>> = {
    desert: {
      grassDark: '#a8864c', grass: '#c4a462', grassLight: '#d8bc7c', grassTip: '#e6cf96',
      marsh: '#9a9a58', moss: '#a09048', leaf: '#6a8a3e', leafDark: '#4e6a30', leafLight: '#8aa854',
    },
    tundra: {
      grassDark: '#b8c4cc', grass: '#d4dde4', grassLight: '#e8eef2', grassTip: '#f8fbfd',
      marsh: '#9aaab4', moss: '#8a9aa0', leaf: '#4a6a58', leafDark: '#34503f', leafLight: '#6a8a74',
    },
    coast: {
      grassDark: '#4a6e3a', grass: '#62884a', grassLight: '#7fa35c', grassTip: '#9cbe70', dirt: '#b0986a', dirtLight: '#c8b484',
    },
  };
  Object.assign(PAL as unknown as Record<string, string>, swaps[biome] ?? {});
}