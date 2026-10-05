// Which of the Craftpix hero sheets a fighting calling or a founder takes (no Pixi here: the New Town panel uses it
// too, to show a founder as the map will draw them). Re-exported by combatPoses.ts.

import { CLASS_DEFS, type ClassId } from '../../shared/data/classes';
import type { PackSheetId } from '../../shared/data/packSheets';
import { PACK_LAYOUT, packUrl } from './creatures/packs';
import { loadImage } from './loadImage';

/** The hero packs' sheets for the fighting callings (a line's sheet; several: picked by the person's id). */
export const HERO_FORM: Partial<Record<ClassId, PackSheetId[]>> = {
  knight: ['knight_1', 'knight_2', 'knight_3'],
  guardian: ['knight_2', 'knight_3'],
  warrior: ['samurai_commander'],
  dragoon: ['samurai_commander'],
  samurai: ['samurai'],
  spellblade: ['samurai'],
  archer: ['samurai_archer'],
  ranger: ['samurai_archer'],
  hunter: ['samurai_archer'],
  monk: ['ninja_monk'],
  assassin: ['kunoichi'],
  dancer: ['kunoichi'],
  witch: ['fire_wizard'],
  shaman: ['wanderer_mage'],
  chronomancer: ['lightning_mage'],
};
/** The combat form of someone of this calling (none: they fight as themselves). */
export function heroSheet(cls: ClassId | null, id: number): PackSheetId | null {
  const list = cls ? HERO_FORM[cls] : undefined;
  return list ? list[id % list.length] : null;
}
/** A founder's form, worn always (the owner's ask: the founders stand out as special everywhere): their calling's
 *  hero, else one by how their class fights (a shooter the archer, a caster or healer a wizard, the rest the samurai).
 *  Decided by the class, never by stats that shift as they level, so the New Town card shows the same form
 *  (`founderSheet(base, FOUNDER_ID, ...)` in panel/newGamePanel.ts); `ranged`/`caster` only for one with no class. */
export function founderSheet(cls: ClassId | null, id: number, ranged: boolean, caster: boolean): PackSheetId {
  const def = cls ? CLASS_DEFS[cls] : undefined;
  const shoots = def ? def.ranged : ranged;
  const casts = def ? def.role === 'caster' || def.role === 'healer' : caster;
  return heroSheet(cls, id) ?? (casts ? (['fire_wizard', 'wanderer_mage', 'lightning_mage'] as PackSheetId[])[id % 3] : shoots ? 'samurai_archer' : 'samurai');
}
/** The founder's person id (they are made first: `newGame`). */
export const FOUNDER_ID = 1;

/* -------------------------------------------- a hero's idle frame on a plain canvas (the panels, the feed) */

const idleImages = new Map<string, HTMLImageElement>();
const waiting = new Map<string, (() => void)[]>();
/** The hero sheet's image once loaded (null until then; every `then` asked meanwhile is called when it comes). */
export function heroImage(sheet: PackSheetId, then: () => void): HTMLImageElement | null {
  const ready = idleImages.get(sheet);
  if (ready) return ready;
  const list = waiting.get(sheet);
  if (list) {
    list.push(then);
    return null;
  }
  waiting.set(sheet, [then]);
  void loadImage(packUrl(sheet)).then(
    (img) => {
      idleImages.set(sheet, img);
      for (const f of waiting.get(sheet) ?? []) f();
      waiting.delete(sheet);
    },
    () => waiting.delete(sheet),
  );
  return null;
}
/** Draw the sheet's first idle frame facing right, its figure `figure` px tall, feet at (`cx`, `feetY`). */
export function drawHeroIdle(g: CanvasRenderingContext2D, img: HTMLImageElement, sheet: PackSheetId, cx: number, feetY: number, figure: number): void {
  const lay = PACK_LAYOUT[sheet];
  if (!lay) return;
  const row = Math.max(0, lay.rows.indexOf('idle'));
  const k = figure / lay.figure;
  const w = lay.w * k;
  const h = lay.h * k;
  g.save();
  g.imageSmoothingEnabled = false;
  if (!lay.facesRight) {
    g.translate(cx * 2, 0);
    g.scale(-1, 1);
  }
  g.drawImage(img, 0, row * lay.h, lay.w, lay.h, cx - w / 2, feetY - h, w, h);
  g.restore();
}
