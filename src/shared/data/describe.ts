// Plain words for what a spell, a fighting skill, a passive skill or a work skill does: the Townsfolk tab shows them
// when one is tapped (the owner's ask). Worked out from the data, so they stay true as the numbers are tuned.

import type { Passive } from './abilities';
import type { Effect, Target } from './effects';
import type { Skill } from './skills';

const WHO: Record<Target, string> = {
  foe: 'one foe',
  foes: 'every foe',
  ally: 'a friend',
  allies: 'the whole party',
  self: 'themselves',
  weakest: 'the most hurt friend',
  fallen: 'a fallen friend',
  random_foes: 'foes at random',
};
const times = (n: number) => `${Math.round(n * 100) / 100}×`;
const STATUS: Record<string, string> = {
  stun: 'stuns', sleep: 'puts to sleep', freeze: 'freezes', stop: 'stops in time', poison: 'poisons', burn: 'burns', bleed: 'makes bleed',
  slow: 'slows', silence: 'silences', blind: 'blinds', weak: 'weakens', vulnerable: 'leaves open to harm', charm: 'charms', doom: 'dooms', fear: 'frightens',
  haste: 'quickens', regen: 'mends over time', shield: 'shields', protect: 'protects', berserk: 'sends berserk', focus: 'focuses', reflect: 'gives a mirror against spells to',
  invisible: 'hides', taunt: 'draws every blow to', thorns: 'gives thorns to', lifelink: 'links life to blows for', inspired: 'inspires',
};

/** One effect in words. */
function one(e: Effect): string {
  const who = e.target === 'random_foes' && e.hits ? `${e.hits} foes at random` : WHO[e.target];
  const el = e.element && e.element !== 'physical' ? ` ${e.element}` : '';
  const odds = e.chance !== undefined && e.chance < 1 ? ` (${Math.round(e.chance * 100)}% chance)` : '';
  const secs = e.secs ? ` for ${e.secs} s` : '';
  switch (e.kind) {
    case 'damage':
      return `Strikes ${who} for ${times(e.power ?? 1)} their power in${el || ' plain'} damage${e.hits && e.target !== 'random_foes' && e.hits > 1 ? `, ${e.hits} times` : ''}${odds}`;
    case 'heal':
      return `Heals ${who} for ${times(e.power ?? 1)} their power`;
    case 'drain':
      return `Drains ${who} for ${times(e.power ?? 1)} their power${el ? ` (${el.trim()})` : ''}, healing by as much`;
    case 'status':
      return `${(STATUS[e.status ?? ''] ?? 'affects').replace(/^./, (c) => c.toUpperCase())} ${who}${secs}${odds}`;
    case 'cleanse':
      return `Clears ill effects from ${who}`;
    case 'dispel':
      return `Strips good effects from ${who}`;
    case 'revive':
      return `Raises ${who} back to their feet${e.power ? ` with ${Math.round(e.power * 100)}% health` : ''}`;
    case 'summon':
      return `Calls ${e.summon ? e.summon.replace(/_/g, ' ') : 'an ally'} to fight on their side`;
  }
}

/** What a spell or fighting skill does, and how often it can be used. */
export function describeAct(effects: readonly Effect[], cooldownSecs?: number, ultimate = false): string {
  const parts = effects.map(one);
  if (ultimate) parts.push('Loosed when the limit gauge is full (it fills as they take and deal hurt)');
  else if (cooldownSecs) parts.push(`Ready again after ${Math.round(cooldownSecs)} s`);
  return parts.join('. ') + '.';
}

const PASSIVE: [keyof Passive, (v: number) => string][] = [
  ['hp', (v) => `${pct(v)} more health`],
  ['damage', (v) => `${pct(v)} more damage`],
  ['accuracy', (v) => `${pct(v)} better aim`],
  ['dodge', (v) => `${pct(v)} more dodge`],
  ['armor', (v) => `${pct(v)} more armour`],
  ['block', (v) => `${pct(v)} more block`],
  ['crit', (v) => `${pct(v)} more chance to strike true`],
  ['critDamage', (v) => `true strikes ${pct(v)} harder`],
  ['speed', (v) => `turns come ${pct(v)} sooner`],
  ['power', (v) => `${pct(v)} more spell power`],
  ['healing', (v) => `${pct(v)} more healing`],
  ['counter', (v) => `${pct(v)} chance to strike back when hit`],
  ['lifesteal', (v) => `heals ${pct(v)} of the hurt they deal`],
  ['thorns', (v) => `${pct(v)} of the hurt taken goes back to the striker`],
  ['guard', (v) => `${pct(v)} chance to take a blow meant for a hurt friend`],
  ['resist', (v) => `${pct(v)} chance to shrug off an ill effect`],
  ['regen', (v) => `mends ${pct(v)} of their health each second`],
  ['lastStand', (v) => `${pct(v)} more damage below a quarter health`],
  ['beast', (v) => `${pct(v)} more against beasts`],
  ['undead', (v) => `${pct(v)} more against the dead`],
  ['machine', (v) => `${pct(v)} more against machines`],
  ['pierce', (v) => `blows go ${pct(v)} through armour`],
  ['cleave', (v) => `blows carry ${pct(v)} on to the foe beside`],
  ['stun', (v) => `${pct(v)} chance a blow stuns`],
];
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** What a passive skill gives, always on. */
export function describePassive(p: Passive): string {
  const parts = PASSIVE.filter(([k]) => typeof p[k] === 'number' && p[k] !== 0).map(([k, f]) => f(p[k] as number));
  if (p.firstStrike) parts.push('acts first in a fight');
  return parts.length ? `Always on: ${parts.join(', ')}.` : 'Always on.';
}

/** What each work skill is for. */
export const SKILL_TEXT: Record<Skill, string> = {
  construction: 'Building and repairing. A higher level builds much faster, and bigger works of a later age want a skilled hand (below it, they go slower).',
  crafting: 'Working at the stations: tools, weapons, armour, wares and furnishings. Higher makes faster and rolls finer grades.',
  research: 'Study at a desk or station. Higher learns topics faster.',
  farming: 'Sowing, tending and reaping the fields. Higher works faster and brings in more.',
  cooking: 'Meals at the fire and the tavern\'s fare. Higher cooks faster and better.',
  gathering: 'Chopping, quarrying, foraging and digging. Higher gathers faster.',
  medicine: 'Tending the hurt and the sick, and surgery. Higher stops bleeding sooner, heals faster and botches less.',
  melee: 'Fighting hand to hand: blows land harder and more often.',
  ranged: 'Shooting and throwing: aim and damage at range.',
  social: 'Trade, talk and keeping the peace: better prices, upselling at the venues, and winning people over.',
  animals: 'Tending the pens, taming and riding. Higher keeps herds healthier and breeding.',
};
