// Each look's two fonts: a display face for titles, tabs and buttons, and a plain one to read at small sizes (the
// menus, the HUD, the tap card). All are Google Fonts under the SIL Open Font License, bundled from @fontsource into
// fonts/ at build time (build.mjs), so they work offline on the phone. Kept free of imports: build.mjs reads it too.

/** A bundled face: its family name, the @fontsource package it comes from, and the weights shipped. */
export interface FontFile {
  family: string;
  pkg: string;
  weights: number[];
}

export const FONT_FILES: FontFile[] = [
  { family: 'Alegreya', pkg: 'alegreya', weights: [400, 700] },
  { family: 'Alegreya SC', pkg: 'alegreya-sc', weights: [700] },
  { family: 'Alegreya Sans', pkg: 'alegreya-sans', weights: [400, 700] },
  { family: 'Pirata One', pkg: 'pirata-one', weights: [400] },
  { family: 'IM Fell English', pkg: 'im-fell-english', weights: [400] },
  { family: 'IM Fell English SC', pkg: 'im-fell-english-sc', weights: [400] },
  { family: 'Uncial Antiqua', pkg: 'uncial-antiqua', weights: [400] },
  { family: 'Crimson Text', pkg: 'crimson-text', weights: [400, 700] },
  { family: 'Grenze Gotisch', pkg: 'grenze-gotisch', weights: [600] },
  { family: 'EB Garamond', pkg: 'eb-garamond', weights: [400, 700] },
  { family: 'New Rocker', pkg: 'new-rocker', weights: [400] },
  { family: 'Orbitron', pkg: 'orbitron', weights: [600] },
  { family: 'Share Tech Mono', pkg: 'share-tech-mono', weights: [400] },
  { family: 'Cinzel', pkg: 'cinzel', weights: [700] },
  { family: 'Berkshire Swash', pkg: 'berkshire-swash', weights: [400] },
  { family: 'Quicksand', pkg: 'quicksand', weights: [500, 700] },
  { family: 'Marcellus SC', pkg: 'marcellus-sc', weights: [400] },
  { family: 'Fondamento', pkg: 'fondamento', weights: [400] },
  { family: 'MedievalSharp', pkg: 'medievalsharp', weights: [400] },
  { family: 'Metal Mania', pkg: 'metal-mania', weights: [400] },
];

/** The file a face and weight is shipped as, under fonts/. */
export const fontFile = (f: FontFile, w: number) => `${f.pkg}-latin-${w}-normal.woff2`;

/** A look's pair: [display, body]. Keyed by theme id ('town' is the base game, the settlers' look). */
export const FONTS: Record<string, [string, string]> = {
  town: ['Alegreya SC', 'Alegreya Sans'], // a storybook frontier: warm small caps over a clean humanist sans
  lich: ['Pirata One', 'IM Fell English'], // blackletter over the worn type of old grimoires
  druid: ['Uncial Antiqua', 'Crimson Text'], // the insular hand of the old groves
  vampire: ['Grenze Gotisch', 'EB Garamond'], // gothic hall, courtly book
  werewolf: ['New Rocker', 'Alegreya Sans'], // rough-cut and wild
  robot: ['Orbitron', 'Share Tech Mono'], // readout and terminal
  dwarves: ['Cinzel', 'Alegreya Sans'], // chiselled capitals, like carved runes
  merfolk: ['Berkshire Swash', 'Quicksand'], // flowing swashes, rounded as sea glass
  nomads: ['Marcellus SC', 'Alegreya Sans'], // flared caravan capitals
  fae: ['Fondamento', 'Quicksand'], // a light calligraphic hand
  alchemists: ['IM Fell English SC', 'IM Fell English'], // the printed plates of an old treatise
  knights: ['MedievalSharp', 'EB Garamond'], // the herald's hand and the chronicle
  orcs: ['Metal Mania', 'Alegreya Sans'], // hacked out with an axe
};

const FALLBACK_BODY = "'Segoe UI', system-ui, sans-serif";

/** The CSS font stacks for a look (display, body). */
export function fontStacks(theme: string): [string, string] {
  const [display, body] = FONTS[theme] ?? FONTS.town;
  return [`'${display}', '${body}', ${FALLBACK_BODY}`, `'${body}', ${FALLBACK_BODY}`];
}

/** @font-face for every bundled face (the browser fetches a file only when a face is used). */
export function fontFaces(base = 'fonts/'): string {
  return FONT_FILES.flatMap((f) =>
    f.weights.map(
      (w) => `@font-face { font-family: '${f.family}'; font-style: normal; font-weight: ${w}; font-display: swap; src: url('${base}${fontFile(f, w)}') format('woff2'); }`,
    ),
  ).join('\n');
}
