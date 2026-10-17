// The Credits screen's list: the packs and people the game is made from, curated from CREDITS.md (the full account,
// down to the single sprites, stays there). Plain data, so the main menu's bundle needs nothing else.

export interface CreditGroup {
  heading: string;
  lines: { pack: string; by: string; licence: string }[];
}

export const CREDITS: CreditGroup[] = [
  {
    heading: 'Pictures',
    lines: [
      { pack: 'DawnLike tileset (items, creatures, the menus’ marks)', by: 'DragonDePlatino, on DawnBringer’s palette', licence: 'CC-BY 4.0' },
      { pack: 'Universal LPC Spritesheet (the townsfolk’s layers)', by: 'Liberated Pixel Cup artists', licence: 'CC-BY-SA 3.0 / GPL 3.0' },
      { pack: 'Himeko Sutori sprite share (townsfolk and monsters)', by: 'Himeko Sutori, Septaroad Voyager, Showkaizer, Aleesa Tana', licence: 'Free with attribution' },
      { pack: 'Craftpix.net free packs (buildings, tilesets, foes, bosses, effects, backdrops, props)', by: 'Craftpix.net', licence: 'Free licence' },
      { pack: 'RPG Maker MV animal sprites (wolves, boars, horses, Duchess the goat)', by: 'whtdragon', licence: 'Free to use' },
      { pack: 'Super Pixel Effects Gigapack (sparks, blood)', by: 'Will Tice, unTied Games', licence: 'untiedgames.com licence' },
      { pack: '5000 Pixel Effects (the flames)', by: 'The pack’s publisher', licence: 'Licensed for use in games' },
    ],
  },
  {
    heading: 'Sound',
    lines: [
      { pack: 'Tiny RPG music (town, battle and boss themes)', by: 'Luis Zuno (@ansimuz)', licence: 'Free for any use' },
      { pack: 'The rest of the music and every sound effect', by: 'Made in the browser by the game’s own code', licence: '—' },
    ],
  },
  {
    heading: 'Lettering',
    lines: [
      { pack: 'Alegreya, Alegreya SC, Alegreya Sans', by: 'Juan Pablo del Peral, Huerta Tipográfica', licence: 'SIL Open Font Licence 1.1' },
      { pack: 'Cinzel, EB Garamond, IM Fell, Pirata One, Uncial Antiqua and the other faces', by: 'Their Google Fonts authors', licence: 'SIL Open Font Licence 1.1' },
    ],
  },
  {
    heading: 'Made with',
    lines: [
      { pack: 'PixiJS', by: 'The PixiJS contributors', licence: 'MIT' },
      { pack: 'Electron (the desktop overlay)', by: 'The Electron contributors', licence: 'MIT' },
    ],
  },
];

export const CREDITS_NOTE = 'Platino is hidden somewhere in the game, as DragonDePlatino asks. The full list, sprite by sprite, is in CREDITS.md.';
