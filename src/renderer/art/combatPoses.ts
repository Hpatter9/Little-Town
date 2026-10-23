// How townsfolk fight in the old LPC figure (the fallback while their own look loads): the blow for their weapon's
// family (a sword's swing, a spear's thrust, a bow drawn, a staff's cast), a flinch when struck and the fallen lying
// still. Shared by the map (map/mapPeople.ts) and the fight screen (fight/fightView.ts). (The combat forms from the
// Craftpix hero packs that fighting callings once took up are gone: the owner's call, "no switching sprites", so a
// townsperson fights in their own look.)

import { ITEM_BY_ID, type Slot } from '../../shared/data/items';
import type { FamilyId } from '../../shared/data/weapons';
import { FRAME_COUNT, type LpcAnim } from './lpc/lpc';

/** The LPC row each weapon family strikes with (none listed: a sword's swing). */
const ANIM_BY_FAMILY: Partial<Record<FamilyId, LpcAnim>> = {
  sp: 'thrust',
  pl: 'thrust',
  dg: 'thrust',
  bw: 'shoot',
  lb: 'shoot',
  cb: 'shoot',
  sl: 'shoot',
  th: 'shoot',
  pi: 'shoot',
  lg: 'shoot',
  sg: 'shoot',
  ag: 'shoot',
  en: 'shoot',
  st: 'spell',
  wd: 'spell',
};
/** The LPC blow for someone's weapon (`ranged`: they fight from range by their calling, so a cast when no weapon
 *  says otherwise; bare hands thrust). */
export function fightAnim(gear: Partial<Record<Slot, string>>, ranged = false): LpcAnim {
  const w = gear.weapon ? ITEM_BY_ID[gear.weapon] : undefined;
  if (w?.family && ANIM_BY_FAMILY[w.family]) return ANIM_BY_FAMILY[w.family]!;
  if (w?.effects?.ranged) return 'shoot';
  if (ranged) return 'spell';
  return w ? 'slash' : 'thrust';
}
/** How many ticks an LPC blow takes to play (the bow is slower to draw). */
export const BLOW_TICKS = 8;
export const SHOOT_TICKS = 13;

/** The LPC frame for someone fighting: a blow when they've just struck, a flinch when just hit, lying when down,
 *  else standing ready. */
export function fightPose(st: { sinceBlow: number; sinceHit: number; down: boolean }, anim: LpcAnim): [LpcAnim, number] {
  if (st.down) return ['hurt', FRAME_COUNT.hurt - 1];
  if (st.sinceHit < 3) return ['hurt', st.sinceHit < 2 ? 0 : 1];
  const span = anim === 'shoot' ? SHOOT_TICKS : BLOW_TICKS;
  if (st.sinceBlow < span) return [anim, Math.min(FRAME_COUNT[anim] - 1, Math.floor((st.sinceBlow / span) * FRAME_COUNT[anim]))];
  return ['walk', 0];
}
