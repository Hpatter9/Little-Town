// Which isometric look a person wears and in which colour variant: the ONE rule the map (iso/folkSprite.ts) and the
// menus' portraits (art/folkPortrait.ts) both use, so a face on a card is always the figure on the map. Pure.

import { ITEM_BY_ID, type Slot } from '../../shared/data/items';
import { dressOf, lookPath, pickLook, type FolkLookPick, type FolkState } from './folkRules';
import { variantOf } from './folkTint';

export interface FolkWho {
  pick: FolkLookPick;
  variant: number;
  /** The bare look's folder below the folk root (`settlers/woman_leather`). */
  path: string;
}

/** The look and variant for someone, from what a snapshot (or an obituary) says: id, people, sex and outfit, body armour. */
export function folkWho(st: Pick<FolkState, 'id' | 'origin' | 'look'> & { gear: Partial<Record<Slot, string>> }): FolkWho {
  const body = st.gear.body ? ITEM_BY_ID[st.gear.body] : undefined;
  const pick = pickLook(st, undefined, dressOf(body?.weight));
  return { pick, variant: variantOf(st.id), path: lookPath(pick, null) };
}
