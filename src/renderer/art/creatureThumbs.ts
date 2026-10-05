// A creature's picture for the menus (the Bestiary page): a CSS crop of its sheet, no canvas and no Pixi, so hundreds
// of them draw at once. The menagerie's DawnLike sheet (its first frame) and the Craftpix pack sheets (their first idle
// frame); anything else has no picture here (the caller shows a mark).

import type { EnemyDef } from '../../shared/data/enemies';
import { DAWN_ACROSS } from '../../shared/data/menagerie';
import dawnUrl from './creatures/dawn.png';
import { PACK_LAYOUT, packUrl } from './creatures/packs';

/** A picture `size` px square for a foe, or null. */
export function creatureThumb(def: EnemyDef, size: number): HTMLElement | null {
  const sp = def.sprite;
  if (!('sheet' in sp)) return null;
  const e = document.createElement('div');
  e.className = 'thumb';
  e.style.width = e.style.height = `${size}px`;
  e.style.imageRendering = 'pixelated';
  e.style.backgroundRepeat = 'no-repeat';
  if (sp.sheet === 'dawn') {
    const k = size / 16;
    const x = (sp.block % DAWN_ACROSS) * 2 * 16;
    const y = Math.floor(sp.block / DAWN_ACROSS) * 16;
    e.style.backgroundImage = `url(${dawnUrl})`;
    e.style.backgroundSize = `${DAWN_ACROSS * 2 * 16 * k}px auto`;
    e.style.backgroundPosition = `${-x * k}px ${-y * k}px`;
    return e;
  }
  const p = PACK_LAYOUT[sp.sheet];
  if (!p) return null;
  // (a frame of its own size inside the square, so the next frame along never shows beside it)
  const row = Math.max(0, p.rows.indexOf('idle'));
  const k = size / Math.max(p.w, p.h);
  const f = document.createElement('div');
  f.style.width = `${p.w * k}px`;
  f.style.height = `${p.h * k}px`;
  f.style.backgroundImage = `url(${packUrl(sp.sheet)})`;
  f.style.backgroundSize = `${p.perRow * p.w * k}px auto`;
  f.style.backgroundPosition = `0 ${-row * p.h * k}px`;
  f.style.backgroundRepeat = 'no-repeat';
  if (!p.facesRight) f.style.transform = 'scaleX(-1)';
  e.style.display = 'flex';
  e.style.alignItems = 'flex-end';
  e.style.justifyContent = 'center';
  e.append(f);
  return e;
}
