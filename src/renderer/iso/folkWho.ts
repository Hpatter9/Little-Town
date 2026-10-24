// Which isometric look a person wears and in which colours: the ONE rule the map (iso/folkSprite.ts) and the
// menus' portraits (art/folkPortrait.ts) both use, so a face on a card is always the figure on the map. Pure.

import { ITEM_BY_ID, type Slot } from '../../shared/data/items';
import { dressOf, isFolkChild, isFounderLook, lookPath, pickLook, type FolkLookPick, type FolkState } from './folkRules';
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

/** The founder's id, as of the last snapshot (main.ts and panel.ts set it: the snapshot's `mainId`), so every view that
 *  draws someone dresses the founder in their own look without passing a flag. An heir who takes over is the founder
 *  from the next snapshot. */
let founderId: number | null = null;
export function setFolkFounder(id: number | null | undefined): void {
  founderId = id ?? null;
}

/** The look and colours for someone, from what a snapshot (or an obituary) says: id, people, sex, skin, hair and outfit,
 *  age, body armour; `founder` says outright whether they're the founder (else: their id is the last snapshot's). */
export function folkWho(st: Pick<FolkState, 'id' | 'origin' | 'look' | 'lifeStage' | 'growsUpIn' | 'founder'> & { gear: Partial<Record<Slot, string>> }): FolkWho {
  const body = st.gear.body ? ITEM_BY_ID[st.gear.body] : undefined;
  const founder = st.founder ?? (founderId !== null && st.id === founderId);
  const pick = pickLook({ ...st, founder }, undefined, dressOf(body?.weight));
  // (the founder's look is a signature costume, worn in its own colours)
  const tint = isFounderLook(pick.look) ? null : tintOf(st, pick.people);
  return { pick, tint, variant: tintKey(tint), path: lookPath(pick, null), child: isFolkChild(st) };
}
