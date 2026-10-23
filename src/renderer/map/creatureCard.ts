// The God creature's card (sim/creature.ts): its kind and name, age and size, its health, a bar from evil to good,
// its mood and what it's doing, its needs, what it has learned to like and shun, and its last deed waiting on praise
// or a scolding. Plain lines, shared by the phone's tap card and the Townsfolk menu's section. No Pixi, no DOM.

import type { CreatureView } from '../../shared/sim/creature';

/** A bar of ten from evil (left) to good (right), with a marker where it stands. */
export function natureBar(align: number): string {
  const at = Math.max(0, Math.min(10, Math.round((align + 100) / 20)));
  return `Evil ${'▬'.repeat(at)}◆${'▬'.repeat(10 - at)} Good`;
}

const MOODS: Record<CreatureView['mood'], string> = { happy: 'Happy', bored: 'Bored', angry: 'Angry', afraid: 'Afraid', lonely: 'Lonely' };
const DOING: Partial<Record<CreatureView['doing'], string>> = {
  haul: 'hauling', build: 'helping the builders', guard: 'on guard', hunt: 'hunting', farm: 'in the fields', play: 'playing with the children',
  heal: 'tending the hurt', fight: 'fighting', eat_crops: 'in the crops', steal: 'at the stores', scare: 'prowling', eat_villager: 'hunting townsfolk',
  eat: 'eating', sleep: 'asleep', wander: 'wandering',
};

export function creatureCard(c: CreatureView): { title: string; lines: string[] } {
  const title = `${c.name} the ${c.kindName}`;
  if (c.dead) return { title, lines: [`Dead: ${c.dead}.`] };
  const lines = [
    `${c.stage[0].toUpperCase()}${c.stage.slice(1)} · ${c.ageDays} day${c.ageDays === 1 ? '' : 's'} old · health ${c.hp}/${c.maxHp}`,
    `${c.alignWord} by nature (${natureBar(c.align)})`,
    `${MOODS[c.mood]} · ${c.asleep ? 'asleep' : (DOING[c.doing] ?? c.doing)}`,
    `Hunger ${c.hunger} · Rest ${c.rest} · Play ${c.play} (of 100)`,
  ];
  if (c.liked.length) lines.push(`Learned to like: ${c.liked.join(', ')}`);
  if (c.shunned.length) lines.push(`Learned to shun: ${c.shunned.join(', ')}`);
  if (c.ask) lines.push(`Just now: ${c.ask.text} Praise or scold it?`);
  return { title, lines };
}
