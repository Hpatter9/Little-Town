// The God creature's card (sim/creature.ts): its kind and name, age and size, its health, a bar from evil to good,
// its mood and what it's doing, its needs, what it has learned to like and shun, and its last deed waiting on praise
// or a scolding. Plain lines, shared by the phone's tap card and the Townsfolk menu's section. No Pixi, no DOM. Its "Now"
// line (`creatureNow`, like the founder's: panel/founderNow.ts) is for its menu and the card.

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
  eat: 'eating', sleep: 'asleep', wander: 'wandering', follow: 'at the founder\'s side', miracle: 'working a miracle',
};

/** What it is doing now, in plain words with an icon: dead (and when it comes back), away with a party, asleep, or its
 *  deed and whom it is with. */
export function creatureNow(c: CreatureView): { icon: string; now: string } {
  if (c.dead) return { icon: '🕯️', now: c.backIn === null ? `Dead (${c.dead}). It has no pen to come back to: build a Creature Pen.` : `Dead (${c.dead}). It comes back at its pen in ${c.backIn} hour${c.backIn === 1 ? '' : 's'}.` };
  if (c.away) return { icon: '🧭', now: `Away with ${c.away.founder ? 'the founder\'s' : 'a'} party, on the road to ${c.away.dest.replace(/_/g, ' ')}` };
  if (c.fighting) return { icon: '⚔️', now: 'Fighting the raiders' };
  if (c.asleep) return { icon: '💤', now: c.pen !== null ? 'Asleep in its pen' : 'Asleep by the camp' };
  const what: Partial<Record<CreatureView['doing'], string>> = {
    play: c.with ? `Playing with ${c.with}` : 'Playing', follow: c.with ? `At ${c.with}'s side` : "At the founder's side", heal: c.with ? `Tending ${c.with}` : 'Tending the hurt',
    scare: c.with ? `Prowling round ${c.with}` : 'Prowling', miracle: 'Working a miracle',
  };
  const icon = c.doing === 'miracle' ? '✨' : c.doing === 'play' || c.doing === 'follow' ? '🤝' : c.doing === 'eat' || c.doing === 'eat_crops' ? '🍖' : '▶️';
  const line = what[c.doing] ?? (DOING[c.doing] ?? c.doing);
  return { icon, now: line[0].toUpperCase() + line.slice(1) };
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function creatureCard(c: CreatureView): { title: string; lines: string[] } {
  const title = `${c.name} the ${c.kindName}`;
  if (c.dead) return { title, lines: [creatureNow(c).now] };
  if (c.away) return { title, lines: [creatureNow(c).now] };
  const lines = [
    `${c.stage[0].toUpperCase()}${c.stage.slice(1)} · ${c.ageDays} day${c.ageDays === 1 ? '' : 's'} old · health ${c.hp}/${c.maxHp}`,
    `${c.alignWord} by nature (${natureBar(c.align)})`,
    `${MOODS[c.mood]} · ${lowerFirst(creatureNow(c).now)}`,
    `Hunger ${c.hunger} · Rest ${c.rest} · Play ${c.play} (of 100)`,
  ];
  if (c.liked.length) lines.push(`Learned to like: ${c.liked.join(', ')}`);
  if (c.shunned.length) lines.push(`Learned to shun: ${c.shunned.join(', ')}`);
  if (c.spells.length) lines.push(`Spells: ${c.spells.map((x) => x.name).join(', ')}`);
  if (c.ask) lines.push(`Just now: ${c.ask.text} Praise or scold it?`);
  return { title, lines };
}
