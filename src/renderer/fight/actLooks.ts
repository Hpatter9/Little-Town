// Which effect sheet plays where a spell or skill lands, in the watched fights, on the raid's battle map and the
// tactics board: the choice is data/actFx.ts (by the act's element and shape, from the 5000 Pixel Effects atlas, the
// Craftpix slashes and the big sheets for ultimates); town/spellsView.ts's `sheetOf` turns the id into frames.

import { ABILITY_BY_ID } from '../../shared/data/abilities';
import { actFx } from '../../shared/data/actFx';
import { SPELL_BY_ID } from '../../shared/data/spells';
import type { SpriteFx } from '../town/spellLooks';

/** The effect played on whoever a spell or skill (by id) touched. */
export const actSprite = (id: string): SpriteFx => actFx(id) as SpriteFx;

const byName = new Map<string, string>();
/** A spell's or skill's id by its name (the fights log names). */
export function actIdOf(name: string): string {
  if (!byName.size) {
    for (const sp of Object.values(SPELL_BY_ID)) byName.set(sp.name, sp.id);
    for (const a of Object.values(ABILITY_BY_ID)) byName.set(a.name, a.id);
  }
  return byName.get(name) ?? '';
}
