// What spells and skills do (data/spells.ts, data/abilities.ts; sim/actions.ts carries them out): damage of an
// element, healing, statuses that last a while, summons, revivals. Shared by both lists.

/** The elements a blow or spell can be. Foes may be weak or hardy to some (sim/actions.ts). */
export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'nature' | 'poison' | 'arcane' | 'blood' | 'time' | 'sound' | 'water' | 'earth' | 'wind';

/** Lasting effects on a fighter, good and ill. */
export type Status =
  // ill
  | 'stun' | 'sleep' | 'freeze' | 'stop' | 'poison' | 'burn' | 'bleed' | 'slow' | 'silence' | 'blind' | 'weak' | 'vulnerable' | 'charm' | 'doom' | 'fear'
  // good
  | 'haste' | 'regen' | 'shield' | 'protect' | 'berserk' | 'focus' | 'reflect' | 'invisible' | 'taunt' | 'thorns' | 'lifelink' | 'inspired';

export const BAD_STATUS: ReadonlySet<Status> = new Set<Status>(['stun', 'sleep', 'freeze', 'stop', 'poison', 'burn', 'bleed', 'slow', 'silence', 'blind', 'weak', 'vulnerable', 'charm', 'doom', 'fear']);

/** Who an effect lands on. */
export type Target = 'foe' | 'foes' | 'ally' | 'allies' | 'self' | 'weakest' | 'fallen' | 'random_foes';

export interface Effect {
  kind: 'damage' | 'heal' | 'status' | 'cleanse' | 'revive' | 'drain' | 'summon' | 'dispel';
  target: Target;
  /** How strong: damage or healing as a multiple of the user's power; a status's strength (poison per second...). */
  power?: number;
  element?: Element;
  status?: Status;
  /** How long a status lasts (seconds), and the chance it takes. */
  secs?: number;
  chance?: number;
  /** Strikes made (a flurry), and for random_foes how many are struck. */
  hits?: number;
  /** What's summoned (an enemy def id, fighting for the user's side). */
  summon?: string;
}

/** What the effect list mostly does, for choosing when to use it and which three spells to keep ready. */
export type Use = 'attack' | 'heal' | 'support' | 'control' | 'summon';

export function useOf(effects: readonly Effect[]): Use {
  if (effects.some((e) => e.kind === 'summon')) return 'summon';
  if (effects.some((e) => e.kind === 'heal' || e.kind === 'revive' || e.kind === 'cleanse')) return 'heal';
  if (effects.some((e) => e.kind === 'damage' || e.kind === 'drain')) return 'attack';
  if (effects.some((e) => e.kind === 'status' && e.status && BAD_STATUS.has(e.status))) return 'control';
  return 'support';
}

/* ------------------------------------------------------------ shorthand for the lists */

export const hit = (power: number, element: Element = 'physical', target: Target = 'foe', hits?: number): Effect => ({ kind: 'damage', target, power, element, ...(hits ? { hits } : {}) });
export const heal = (power: number, target: Target = 'weakest'): Effect => ({ kind: 'heal', target, power });
export const inflict = (status: Status, secs: number, target: Target = 'foe', chance = 1, power?: number): Effect => ({ kind: 'status', target, status, secs, ...(chance < 1 ? { chance } : {}), ...(power !== undefined ? { power } : {}) });
export const grant = (status: Status, secs: number, target: Target = 'self', power?: number): Effect => ({ kind: 'status', target, status, secs, ...(power !== undefined ? { power } : {}) });
export const drain = (power: number, element: Element = 'dark', target: Target = 'foe'): Effect => ({ kind: 'drain', target, power, element });
export const revive = (power: number): Effect => ({ kind: 'revive', target: 'fallen', power });
export const cleanse = (target: Target = 'ally'): Effect => ({ kind: 'cleanse', target });
export const summon = (what: string): Effect => ({ kind: 'summon', target: 'self', summon: what });
export const dispel = (target: Target = 'foe'): Effect => ({ kind: 'dispel', target });
