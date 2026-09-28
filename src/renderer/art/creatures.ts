// Creature sprites (see CREDITS.md). Most are whtdragon's RPG Maker MV animal sheets: a 4x2 grid of blocks
// (or a single block, for the big ones), each block 3 walk frames across and 4 facings down (down, left,
// right, up). The Abomination comes from PackMonsters instead: one long animation strip that faces left.
// Some sheets are recoloured as they load (the wyvern becomes the red dragon).

import { Rectangle, Texture } from 'pixi.js';
import type { CreatureSheetId } from '../../shared/data/enemies';
import bearUrl from './creatures/bear.png';
import drakesUrl from './creatures/drakes.png';
import golemsUrl from './creatures/golems.png';
import horrorUrl from './creatures/horror.png';
import horseUrl from './creatures/horse.png';
import skeleghoulsUrl from './creatures/skeleghouls.png';
import boarUrl from './creatures/wildboar.png';
import wolfUrl from './creatures/wolfdog.png';
import wolfmanUrl from './creatures/wolfman.png';
import wyvernUrl from './creatures/wyvern.png';
import zombieAnimalsUrl from './creatures/zombieanimals.png';
import champNecroUrl from './creatures/champ_necromancer.png';
import champSummonerUrl from './creatures/champ_summoner.png';
import champTamerUrl from './creatures/champ_beast_tamer.png';
import champKnightUrl from './creatures/champ_blood_knight.png';
import darkKnightUrl from './creatures/dark_knight.png';
import ghostsUrl from './creatures/ghosts.png';
import golems2Url from './creatures/golems2.png';
import snowmonkeyUrl from './creatures/snowmonkey.png';
import mouseUrl from './creatures/mouse.png';

export type CreatureSheet = 'mouse' |'wolf' | 'boar' | 'bear' | 'horse' | 'wyvern' | 'drakes' | 'golems' | 'skeleghouls' | 'zombieanimals' | 'wolfman' | 'horror' | 'dark_knight' | 'champ_necromancer' | 'champ_summoner' | 'champ_beast_tamer' | 'champ_blood_knight' | 'ghosts' | 'golems2' | 'snowmonkey';

interface SheetDef {
  url: string;
  /** Frame size. */
  w: number;
  h: number;
  /** Blocks across (4 for the usual 8-creature sheets, 1 for a single big creature). */
  blocksAcross: number;
  /** Recolour on load: green becomes red (the wyvern turned dragon). */
  redden?: boolean;
  /** An animation strip instead of facing rows: frames per row, and which frames walk and attack (it faces left). */
  strip?: { perRow: number; walk: number[]; attack: number[]; idle: number[] };
  /** (strips face left unless this says otherwise) */
  facesRight?: boolean;
  /** Where the art starts, as a share of the frame's height from the top (for placing health bars over small
   *  creatures in big frames). */
  top?: number;
}

const SHEETS: Record<CreatureSheet, SheetDef> = {
  wolf: { url: wolfUrl, w: 48, h: 48, blocksAcross: 4 },
  boar: { url: boarUrl, w: 48, h: 48, blocksAcross: 4 },
  bear: { url: bearUrl, w: 48, h: 48, blocksAcross: 4 },
  horse: { url: horseUrl, w: 48, h: 48, blocksAcross: 4 },
  // a green wyvern, turned red: Vermithrax
  wyvern: { url: wyvernUrl, w: 144, h: 96, blocksAcross: 1, redden: true },
  drakes: { url: drakesUrl, w: 48, h: 48, blocksAcross: 4 },
  golems: { url: golemsUrl, w: 48, h: 48, blocksAcross: 4 },
  skeleghouls: { url: skeleghoulsUrl, w: 48, h: 48, blocksAcross: 4 },
  zombieanimals: { url: zombieAnimalsUrl, w: 48, h: 48, blocksAcross: 4 },
  wolfman: { url: wolfmanUrl, w: 48, h: 52, blocksAcross: 4 },
  // Tiny RPG's Dark Knight: the Black Knight boss (a side-view strip that faces right)
  dark_knight: { url: darkKnightUrl, w: 48, h: 48, blocksAcross: 1, facesRight: true, strip: { perRow: 8, walk: [8, 9, 10], attack: [16, 17, 18], idle: [0, 1, 2, 3, 4, 5, 6, 7] } },
  // Pixel Champions: townsfolk who have taken up a special class (24px RPG Maker sheets)
  champ_necromancer: { url: champNecroUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_summoner: { url: champSummonerUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_beast_tamer: { url: champTamerUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_blood_knight: { url: champKnightUrl, w: 24, h: 24, blocksAcross: 4 },
  ghosts: { url: ghostsUrl, w: 48, h: 48, blocksAcross: 4 },
  // the Deep Freeze: an ice golem (block 1) and a white yeti (block 1)
  golems2: { url: golems2Url, w: 48, h: 48, blocksAcross: 4 },
  snowmonkey: { url: snowmonkeyUrl, w: 48, h: 48, blocksAcross: 4 },
  // the Rat Plague: brown rats (block 0), grey plague rats (5), and the black Rat King (3, drawn huge)
  mouse: { url: mouseUrl, w: 48, h: 48, blocksAcross: 4, top: 0.62 },
  horror: { url: horrorUrl, w: 80, h: 64, blocksAcross: 1, strip: { perRow: 5, walk: [4, 5, 6, 7, 8, 9], attack: [11, 13, 15, 17], idle: [0, 1, 2, 3] } },
};

/** (Every sheet an enemy can be drawn from must be loaded here: this fails to compile if one is missing.) */
const ENEMY_SHEETS: Record<CreatureSheetId, SheetDef> = SHEETS;
void ENEMY_SHEETS;

/** The usual frame size (the wolves, boars, horses). */
export const CREATURE_FRAME = 48;
/** A sheet's frame size. */
export const creatureSize = (sheet: CreatureSheet) => ({ w: SHEETS[sheet].w, h: SHEETS[sheet].h });
/** Where a sheet's art starts, from the top of the frame (0..1). */
export const creatureTop = (sheet: CreatureSheet) => SHEETS[sheet].top ?? 0;

const FACING = { left: 1, right: 2 } as const;
const sheets = new Map<CreatureSheet, Texture>();
const frames = new Map<string, Texture>();

export async function loadCreatures(): Promise<void> {
  await Promise.all(
    (Object.keys(SHEETS) as CreatureSheet[]).map(async (id) => {
      const def = SHEETS[id];
      const im = new Image();
      im.src = def.url;
      await im.decode();
      if (def.redden) {
        const c = document.createElement('canvas');
        c.width = im.width;
        c.height = im.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(im, 0, 0);
        const px = ctx.getImageData(0, 0, c.width, c.height);
        const d = px.data;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
          if (g <= r || g <= b) continue; // (only the greens: horns, eyes and claws keep their colour)
          d[i] = Math.min(255, g * 1.15);
          d[i + 1] = r * 0.45;
          d[i + 2] = b * 0.5;
        }
        ctx.putImageData(px, 0, 0);
        sheets.set(id, Texture.from(c));
      } else sheets.set(id, Texture.from(im));
    }),
  );
}

/** Strip sheets face one way only: the sprite is flipped to face right. */
export const creatureFlip = (sheet: CreatureSheet, facing: 'left' | 'right') => {
  const def = SHEETS[sheet];
  if (!def.strip) return 1;
  return (facing === 'right') !== !!def.facesRight ? -1 : 1;
};

/**
 * One frame of a creature, facing left or right. `frame` counts walk frames (0, 1, 2, ...); pass `attack`
 * for an attack pose on sheets that have one.
 */
export function creatureFrame(sheet: CreatureSheet, block: number, facing: 'left' | 'right', frame: number, attack = false): Texture {
  const def = SHEETS[sheet];
  // (frame numbers keep counting up; wrap them before caching)
  const seq = def.strip ? (attack ? def.strip.attack : def.strip.walk) : null;
  const n = seq ? seq.length : 3;
  const f = ((Math.floor(frame) % n) + n) % n;
  const key = `${sheet}|${block}|${facing}|${f}|${!!seq && attack}`;
  let t = frames.get(key);
  if (!t) {
    const base = sheets.get(sheet)!;
    let x: number;
    let y: number;
    if (seq) {
      const i = seq[f];
      x = (i % def.strip!.perRow) * def.w;
      y = Math.floor(i / def.strip!.perRow) * def.h;
    } else {
      const bx = (block % def.blocksAcross) * 3;
      const by = Math.floor(block / def.blocksAcross) * 4;
      x = (bx + f) * def.w;
      y = (by + FACING[facing]) * def.h;
    }
    t = new Texture({ source: base.source, frame: new Rectangle(x, y, def.w, def.h) });
    frames.set(key, t);
  }
  return t;
}
