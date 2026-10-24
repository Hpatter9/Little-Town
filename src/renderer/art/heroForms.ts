// The Craftpix hero sheets the fighting callings once fought in, and the founder's id. Nothing draws a townsperson in
// these now (the owner's call: "no switching sprites, they need to be consistent"; docs/notes/raid-looks.md): the list
// is kept as the record of which pack forms the callings used, which test/mythic.test.ts checks the mythic callings'
// own forms against. No Pixi here.

import type { ClassId } from '../../shared/data/classes';
import type { PackSheetId } from '../../shared/data/packSheets';

/** The hero packs' sheets the fighting callings used (a line's sheet; several: picked by the person's id). */
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
/** The founder's person id (they are made first: `newGame`). */
export const FOUNDER_ID = 1;
