// Which isometric look a person wears and in which colours: the ONE rule the map (iso/folkSprite.ts) and the
// menus' portraits (art/folkPortrait.ts) both use, so a face on a card is always the figure on the map. Pure.

import { ITEM_BY_ID, type Slot } from '../../shared/data/items';
import { dressOf, isFolkChild, lookPath, pickLook, type FolkLookPick, type FolkState } from './folkRules';
import { tintKey, tintOf, type FolkTint } from './folkTint';

export interface FolkWho {
  pick: FolkLookPick;
  /** Their colours (null: the art as drawn, the peoples with colours of their own). The same for every look they
   *  wear (bare, armed, a child's), so picking up a tool never changes them. */
  tint: FolkTint | null;
  /** The tint's cache key (`tintKey`). */
  variant: string;
  /** The bare look's folder below the folk root (`settlers/woman_leather`). */
  path: string;
  /** A child: drawn smaller (CHILD_SCALE). */
  child: boolean;
}

/** The look and colours for someone, from what a snapshot (or an obituary) says: id, people, sex, skin, hair and outfit,
 *  age, body armour. */
export function folkWho(st: Pick<FolkState, 'id' | 'origin' | 'look' | 'lifeStage' | 'growsUpIn'> & { gear: Partial<Record<Slot, string>> }): FolkWho {
  const body = st.gear.body ? ITEM_BY_ID[st.gear.body] : undefined;
  const pick = pickLook(st, undefined, dressOf(body?.weight));
  const tint = tintOf(st, pick.people);
  return { pick, tint, variant: tintKey(tint), path: lookPath(pick, null), child: isFolkChild(st) };
}
