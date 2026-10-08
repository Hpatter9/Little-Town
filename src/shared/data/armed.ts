// What a fighter needs in hand (the owner's ask: "for townsfolk to use skills or attack in certain ways they need
// their weapon, like an archer can't attack without a bow"). Read by sim/combat.ts (a shooter without a ranged weapon
// fights up close; bare hands hit at `UNARMED_MULT` but for those who fight with them) and sim/actions.ts (a calling's
// skills come only with its weapon in hand; spells need nothing).

import { CLASS_DEFS } from './classes';
import { ITEM_BY_ID } from './items';

/** Callings that fight bare-handed (the monk's fists, the shapeshifter's claws, a dancer's feet). */
export const fightsBare = (cls: string | null | undefined) => cls === 'monk' || cls === 'shapeshifter' || cls === 'dancer';

/** Whether someone has what their calling's skills need: a ranged weapon for a shooter, any weapon for one who fights
 *  up close (but those who fight bare-handed); casters' and healers' skills need nothing in hand. */
export function armedForSkills(cls: string | null | undefined, weapon: string | null | undefined): boolean {
  const c = cls ? CLASS_DEFS[cls as keyof typeof CLASS_DEFS] : undefined;
  if (!c || c.role === 'caster' || c.role === 'healer') return true;
  const def = weapon ? ITEM_BY_ID[weapon] : undefined;
  if (c.ranged && c.role !== 'support') return !!def?.effects.ranged;
  return !!def || fightsBare(cls);
}
