// What belonging to a guild does (sim/guilds.ts): read by raids.ts (blows), health.ts (healing) and townsfolk.ts (work,
// spirits). Kept apart from guilds.ts so those can read it without its imports.

import { ELITE_FIGHT, GUILD_WORK, MEMBER_MORALE, MENDER_CARE, WARDEN_FIGHT, type GuildRole } from '../data/guilds';
import type { GameState, Person } from './state';

export interface Guild {
  id: number;
  role: GuildRole;
  name: string;
  leader: number;
  members: number[];
  founded: number;
  /** Who started it: one of the town (`founder` their id), or the council's vote. */
  by: 'person' | 'council';
  founder?: number;
  /** The vote that brought it in. */
  votes?: { for: number; against: number };
  /** What it has done lately, newest first. */
  log: string[];
}

export const guildOf = (s: Pick<GameState, 'guilds'>, p: Person): Guild | undefined => s.guilds?.find((g) => g.members.includes(p.id));

/** A member's blows in a raid. */
export function guildFight(s: Pick<GameState, 'guilds'>, p: Person): number {
  const g = guildOf(s, p);
  return g?.role === 'elite' ? ELITE_FIGHT : g?.role === 'wardens' ? WARDEN_FIGHT : 1;
}

/** The town's healing while a menders' guild stands. */
export const guildCare = (s: Pick<GameState, 'guilds'>): number => (s.guilds?.some((g) => g.role === 'menders' && g.members.length) ? MENDER_CARE : 1);

/** A member at their guild's own work. */
export function guildWork(s: Pick<GameState, 'guilds'>, p: Person): number {
  const g = guildOf(s, p);
  if (!g) return 1;
  if (g.role === 'crafters' && (p.task?.type === 'craft' || p.task?.type === 'build')) return GUILD_WORK;
  if (g.role === 'scholars' && p.task?.type === 'research') return GUILD_WORK;
  return 1;
}

/** A member's spirits from belonging. */
export function guildMood(s: Pick<GameState, 'guilds'>, p: Person): { text: string; value: number } | null {
  const g = guildOf(s, p);
  return g ? { text: g.leader === p.id ? `Leads ${g.name}` : `One of ${g.name}`, value: MEMBER_MORALE } : null;
}
