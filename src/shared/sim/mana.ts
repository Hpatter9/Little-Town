// A caster's mana (the owner's ask: casters can't cast all they want). Everyone with spells has a pool, its size by
// their Intellect and Wisdom (data/attributes.ts `maxManaOf`) and widened by a focus or a magic charm they carry
// (`FOCUS_MANA` × its power). Every spell costs it in every fight: an expedition's (combat.ts), the raid's tactics board
// (tactics.ts) and its trail (battle.ts) all draw on the same pool, kept on the person (`Person.mana`, left out while
// full) between fights, so a caster who spent it all in a raid comes to the next fight dry. It comes back a little each
// turn in a fight (`manaRegenOf`) and by the hour out of one (sim/magic.ts `manaHourly`: `MANA_REST` of the pool an
// hour, more on a leyline). A spell the caster can't pay for isn't cast; they strike instead (actions.ts `canPay`).

import { manaRegenOf, maxManaOf } from '../data/attributes';
import { SPELLCASTERS } from '../data/spells';
import { CURSED, ENCHANTED, FOCI } from '../data/magic';
import { ITEM_BY_ID } from '../data/items';
import { attributesOf } from './attributes';
import type { Person } from './state';

/** A focus or magic charm widens the pool by this much for each point of its spell power (a Ley Crystal's 0.2: +30%). */
export const FOCUS_MANA = 1.5;
/** Out of a fight, this share of the pool comes back an hour (times one and the leyline's strength where they stand). */
export const MANA_REST = 0.12;

/** Whether someone has a mana pool at all: a calling that casts, or spells learned by study. */
export const hasMana = (p: Pick<Person, 'cls'> & { arcana?: Person['arcana'] }) => (!!p.cls && SPELLCASTERS.has(p.cls)) || !!p.arcana?.spells.length;

/** The most mana someone can hold. */
export function manaMax(p: Person): number {
  const charm = p.gear?.charm;
  const widen = charm && (FOCI.includes(charm) || ENCHANTED.includes(charm) || CURSED.includes(charm)) ? (ITEM_BY_ID[charm]?.effects.power ?? 0) * FOCUS_MANA : 0;
  return Math.round(maxManaOf(attributesOf(p)) * (1 + widen));
}

/** Their mana now (full when never spent). */
export const manaNow = (p: Person): number => Math.max(0, Math.min(manaMax(p), p.mana ?? manaMax(p)));

/** Set their mana (kept only while short of full). */
export function setMana(p: Person, v: number): void {
  const most = manaMax(p);
  const n = Math.max(0, Math.min(most, Math.round(v * 10) / 10));
  if (n >= most) delete p.mana;
  else p.mana = n;
}

/** A turn's mana back in a fight. */
export function manaTurn(p: Person): void {
  if (p.mana === undefined) return;
  setMana(p, p.mana + manaRegenOf(attributesOf(p)));
}

/** An hour's mana back out of a fight, `ley` the leyline's strength where they are. */
export function manaRest(p: Person, ley: number): void {
  if (p.mana === undefined) return;
  setMana(p, p.mana + manaMax(p) * MANA_REST * (1 + ley));
}
