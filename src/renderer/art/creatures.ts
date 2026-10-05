// Creature sprites (see CREDITS.md). Most are whtdragon's RPG Maker MV animal sheets: a 4x2 grid of blocks
// (or a single block, for the big ones), each block 3 walk frames across and 4 facings down (down, left,
// right, up). The Abomination comes from PackMonsters instead: one long animation strip that faces left.
// Some sheets are recoloured as they load (the wyvern becomes the red dragon).

import { loadImage } from './loadImage';
import { Rectangle, Texture } from 'pixi.js';

import type { CreatureSheetId } from '../../shared/data/enemies';
import { SHEETS, type CreatureSheet, type SheetDef } from './creatureSheets';
export type { CreatureSheet } from './creatureSheets';

/** (Every sheet an enemy can be drawn from must be loaded here: this fails to compile if one is missing.) */
const ENEMY_SHEETS: Record<CreatureSheetId, SheetDef> = SHEETS;
void ENEMY_SHEETS;

/** The usual frame size (the wolves, boars, horses). */
export const CREATURE_FRAME = 48;
/** A sheet's frame size. */
export const creatureSize = (sheet: CreatureSheet) => ({ w: SHEETS[sheet].w, h: SHEETS[sheet].h });
/** Where a sheet's art starts, from the top of the frame (0..1). */
export const creatureTop = (sheet: CreatureSheet) => SHEETS[sheet].top ?? 0;
/** Where a sheet's feet are, from the top of the frame (0..1). */
export const creatureFeet = (sheet: CreatureSheet) => SHEETS[sheet].feet ?? 1;

const FACING = { left: 1, right: 2 } as const;
const sheets = new Map<CreatureSheet, Texture>();
const frames = new Map<string, Texture>();

export async function loadCreatures(): Promise<void> {
  await Promise.all(
    (Object.keys(SHEETS) as CreatureSheet[]).map(async (id) => {
      const def = SHEETS[id];
      const im = await loadImage(def.url);
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
  if (def.pairs) return facing === 'right' ? -1 : 1;
  if (!def.strip) return 1;
  return (facing === 'right') !== !!def.facesRight ? -1 : 1;
};

/**
 * One frame of a creature, facing left or right. `frame` counts walk frames (0, 1, 2, ...); pass `attack`
 * for an attack pose on sheets that have one.
 */
/** A pack sheet's rows besides walking and attacking (the heroes have a second attack and a guard too). */
export type CreaturePose = 'idle' | 'hurt' | 'dead' | 'attack2' | 'defend';
/** How many frames a sheet's row has (0: it has no such row). */
export const creaturePoseFrames = (sheet: CreatureSheet, pose: CreaturePose | 'walk' | 'attack'): number => SHEETS[sheet].strip?.[pose]?.length ?? 0;

export function creatureFrame(sheet: CreatureSheet, block: number, facing: 'left' | 'right', frame: number, attack = false, pose?: CreaturePose): Texture {
  const def = SHEETS[sheet];
  // (frame numbers keep counting up; wrap them before caching)
  const posed = pose && def.strip?.[pose];
  const seq = def.strip ? (posed || (attack ? def.strip.attack : def.strip.walk)) : null;
  const n = def.pairs ? 2 : seq ? seq.length : 3;
  // (the dying row is shown at its end: lying still)
  const f = pose === 'dead' && posed ? n - 1 : ((Math.floor(frame) % n) + n) % n;
  const key = `${sheet}|${block}|${facing}|${f}|${!!seq && attack}|${posed ? pose : ''}`;
  let t = frames.get(key);
  if (!t) {
    const base = sheets.get(sheet)!;
    let x: number;
    let y: number;
    if (def.pairs) {
      x = ((block % def.pairs) * 2 + f) * def.w;
      y = Math.floor(block / def.pairs) * def.h;
    } else if (seq) {
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

/** Whether a sheet has its own dying frames (the Craftpix packs): the fallen are drawn lying down. */
export const creatureHasDeath = (sheet: CreatureSheet) => !!SHEETS[sheet].strip?.dead;
/** The last frame of its dying row (lying still). */
export const creatureDead = (sheet: CreatureSheet, facing: 'left' | 'right') => creatureFrame(sheet, 0, facing, (SHEETS[sheet].strip?.dead?.length ?? 1) - 1, false, 'dead');
