// Using a battle item in a fight (the pure half of sim/kit.ts, which hands them out and orders them): what a fighter
// reaches for and when, shown like a spell or a skill. Called from actions.ts `takeTurn`, so every fight, the party's,
// the raid map's and the tactics board, uses them alike. Its randomness is a side stream of its own: `kit:<tick>:<who>`.

import { KIT_BY_ID, type KitItem } from '../data/kitItems';
import { BAD_STATUS, type Status } from '../data/effects';
import { hashSeed, Rng } from '../rng';
import { has, useItemAction, type Arena, type Combatant } from './actions';

/** Heal at under this share of health; run for the smoke under `ESCAPE_BELOW`; a dry caster has under `DRY_SHARE` mana. */
export const HEAL_BELOW = 0.5;
export const ESCAPE_BELOW = 0.3;
export const DRY_SHARE = 0.3;
/** The chance on a turn that a fighter flings a throwing item (so they aren't all thrown at once). */
export const THROW_CHANCE = 0.5;
/** A thrown item is used only if it hits at least this many times as hard as the thrower's own blow. */
export const THROW_BEATS = 1.2;
/** The chance a fallen raider of the people kinds had a potion on them. */
export const RAIDER_POTION = 0.12;


/* ------------------------------------------------------------ in a fight */

const items = (f: Combatant): KitItem[] => (f.bag ?? []).map((id) => KIT_BY_ID[id]).filter((k): k is KitItem => !!k);
const best = (list: KitItem[], use: KitItem['use']) => list.filter((k) => k.use === use).sort((a, b) => b.rank - a.rank)[0];

/** What a fighter would use now, if anything: a potion under half health (the smallest that mends what's missing, else
 *  the strongest), an antidote while poisoned, a burning or bleeding, a draught when their spells are out of reach, smoke
 *  when badly hurt and still pressed, and at the fight's start a charm, a whetstone or a stim; now and then a thrown one. */
export function pickKitItem(a: Arena, f: Combatant): KitItem | null {
  const list = items(f);
  if (!list.length) return null;
  const foes = a.all().filter((o) => o.side !== f.side && !o.down);
  const share = f.hp / Math.max(1, f.maxHp);
  const heals = list.filter((k) => k.use === 'heal').sort((x, y) => (x.amount ?? 0) - (y.amount ?? 0));
  // (no drink when one blow of theirs would end the fight: they strike instead)
  const last = foes.length === 1 && foes[0].hp <= ((f.damage[0] + f.damage[1]) / 2) * (1 - Math.min(0.8, foes[0].armor));
  if (heals.length && share < HEAL_BELOW && !last) {
    const missing = 1 - share;
    return heals.find((k) => (k.amount ?? 0) >= missing * 0.6) ?? heals[heals.length - 1];
  }
  const ill = (['poison', 'burn', 'bleed'] as Status[]).some((x) => BAD_STATUS.has(x) && has(f, x, a.tick));
  const cure = best(list, 'cure');
  if (cure && ill) return cure;
  const spells = f.kit?.actions.filter((x) => x.pool === 'mp') ?? [];
  const draught = best(list, 'mana');
  if (draught && f.maxMp && spells.length && ((f.mp ?? 0) < Math.min(...spells.map((x) => x.cost)) || (f.mp ?? 0) < f.maxMp * DRY_SHARE)) return draught;
  if (!foes.length) return null;
  const smoke = best(list, 'escape');
  if (smoke && share < ESCAPE_BELOW && !last && !has(f, 'invisible', a.tick)) return smoke;
  if (process.env.KIT_X === 'nobuff') return null; // TEMP
  for (const k of list.filter((x) => x.use === 'buff').sort((x, y) => y.rank - x.rank)) {
    const status = k.effects.find((e) => e.status)?.status;
    if (status && !has(f, status, a.tick)) return k;
  }
  // (a thrown item takes the turn a blow would: only one that hits harder than the weapon does)
  const throws = list.filter((k) => k.use === 'throw' && throwPower(k) >= THROW_BEATS).sort((x, y) => throwPower(y) - throwPower(x));
  if (throws.length && new Rng(hashSeed(`kit:${a.tick}:${f.side}${f.ref}:${f.bag!.length}`)).chance(THROW_CHANCE)) return throws[0];
  return null;
}

/** How hard a thrown item hits, as a multiple of the thrower's blow (its blows and its burning). */
const throwPower = (k: KitItem) => k.effects.reduce((n, e) => n + (e.kind === 'damage' ? (e.power ?? 1) * (e.hits ?? 1) : e.status === 'burn' ? (e.power ?? 0.5) * 0.5 : 0), 0);

/** Their turn: use a battle item if one is worth it (it's used up, and shown like a spell or a skill). A drink or a
 *  buff is a quick action ('quick': they still act this turn); a thrown item takes the turn ('turn'). */
export function useKitItem(a: Arena, f: Combatant): 'turn' | 'quick' | false {
  if (!f.bag?.length) return false;
  const k = pickKitItem(a, f);
  if (!k) return false;
  f.bag.splice(f.bag.indexOf(k.id), 1);
  useItemAction(a, f, k);
  return k.use === 'throw' ? 'turn' : 'quick';
}
