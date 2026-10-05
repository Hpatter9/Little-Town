// Which of the Craftpix hero sheets a fighting calling or a founder takes (no Pixi here: the New Town panel uses it
// too, to show a founder as the map will draw them). Re-exported by combatPoses.ts.

import { CLASS_DEFS, type ClassId } from '../../shared/data/classes';
import type { PackSheetId } from '../../shared/data/packSheets';

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
