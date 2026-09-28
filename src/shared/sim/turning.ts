// Turning townsfolk (hidden): a lich founder can raise the living as undead; a vampire or a werewolf in town
// can pass on their curse. One person at a time, or the whole town. Each kind has its gifts and its costs
// (see data/monsters.ts); every monster in town also stokes the Hunter's Guild.

import { MONSTER_NAMES, TURNING_FEAR_HOURS, type MonsterKind } from '../data/monsters';
import { becomeMonster } from './monsters';
import { notify, personFx, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

/** The founder is a lich (their phylactery stands). */
export const isLich = (s: GameState) => s.buildings.some((b) => b.def === 'phylactery' && b.status === 'done');

/** The curses that can be passed on right now, and by whom. */
export function turnable(s: GameState): MonsterKind[] {
  const out: MonsterKind[] = [];
  if (isLich(s)) out.push('undead');
  if (s.people.some((p) => p.monster === 'vampire' && p.away === null)) out.push('vampire');
  if (s.people.some((p) => p.monster === 'werewolf' && p.away === null)) out.push('werewolf');
  return out;
}

export function canTurn(s: GameState, p: Person, kind: MonsterKind): { ok: boolean; reason?: string } {
  if (!turnable(s).includes(kind)) return { ok: false, reason: `Nobody in town can make a ${MONSTER_NAMES[kind].toLowerCase()}` };
  if (p.monster) return { ok: false, reason: `${p.name} is already a ${MONSTER_NAMES[p.monster].toLowerCase()}` };
  if (p.bornTick != null) return { ok: false, reason: 'Not a child' };
  if (p.away !== null) return { ok: false, reason: 'Away' };
  if (p.id === s.mainId) return { ok: false, reason: 'Not the founder' };
  return { ok: true };
}

function turn(s: GameState, p: Person, kind: MonsterKind): void {
  becomeMonster(s, p, kind);
  personFx(s, p.id, kind);
  if (kind === 'undead') {
    // the dead don't marry
    const partner = s.people.find((q) => q.id === p.partner);
    if (partner) partner.partner = null;
    p.partner = null;
    p.married = false;
    p.needs = { food: 1, rest: 1 };
  }
}

/** Turn one person. The living who remain are frightened for a while. */
export function turnPerson(s: GameState, id: number, kind: MonsterKind): { ok: boolean; reason?: string } {
  const p = s.people.find((q) => q.id === id);
  if (!p) return { ok: false, reason: 'Unknown person' };
  const check = canTurn(s, p, kind);
  if (!check.ok) return check;
  turn(s, p, kind);
  s.turningFearUntil = s.tick + TURNING_FEAR_HOURS * TICKS_PER_HOUR;
  notify(s, TURN_TEXT[kind](p.name), true);
  return { ok: true };
}

/** Turn everyone who can be turned. */
export function turnTown(s: GameState, kind: MonsterKind): number {
  const who = s.people.filter((p) => canTurn(s, p, kind).ok);
  for (const p of who) turn(s, p, kind);
  if (who.length) notify(s, TOWN_TEXT[kind](who.length), true);
  return who.length;
}

const TURN_TEXT: Record<MonsterKind, (name: string) => string> = {
  undead: (n) => `${n} breathes their last, and rises again at the lich's word: undead now.`,
  vampire: (n) => `${n} was given the dark kiss. They are a vampire now.`,
  werewolf: (n) => `${n} was bitten under the moon. They are a werewolf now.`,
};
const TOWN_TEXT: Record<MonsterKind, (n: number) => string> = {
  undead: (n) => `The lich's will sweeps the town: ${n} ${n === 1 ? 'soul rises' : 'souls rise'} as the undead. This is a haven of the dead now.`,
  vampire: (n) => `One night of blood: ${n} townsfolk ${n === 1 ? 'wakes' : 'wake'} as vampires. The town belongs to the night.`,
  werewolf: (n) => `The whole town howls at the moon: ${n} more werewolves. The pack is complete.`,
};

/** How many of the town are undead (the dead outnumbering the living scares wanderers off). */
export const undeadShare = (s: GameState) => (s.people.length ? s.people.filter((p) => p.monster === 'undead').length / s.people.length : 0);
