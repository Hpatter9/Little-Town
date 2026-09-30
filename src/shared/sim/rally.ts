// Rally in a fight (CLAUDE.md, "More to watch"): in a raid, the player can tap a defender and rally them, a burst of
// courage: harder, faster blows for a few seconds and a second wind. Then the town must wait a while to rally again.

import { raidActive } from './raids';
import { maxHp, notify, type GameState, type Person } from './state';
import { TICK_HZ } from './time';

/** How long a rally lasts, and how long before another (ticks). */
export const RALLY_TICKS = 15 * TICK_HZ;
export const RALLY_COOLDOWN = 40 * TICK_HZ;
/** A rallied defender's blows: this much harder, and this much more often. */
export const RALLY_DAMAGE = 1.6;
export const RALLY_SPEED = 2;
/** The second wind: this share of their health back, and this much morale. */
const RALLY_HEAL = 0.25;
const RALLY_MORALE = 10;

/** Whether someone is rallied right now. */
export const rallied = (s: GameState, p: Person) => (p.rallied ?? -1) > s.tick;

/** Whether the player can rally them now: a defender in a raid, on their feet, and the town's rally ready. */
export const canRally = (s: GameState, p: Person) => raidActive(s) && p.task?.type === 'defend' && !p.downed && p.away === null && s.tick >= (s.rallyReady ?? 0);

/** Rally a defender. Returns whether it took. */
export function rally(s: GameState, id: number): boolean {
  const p = s.people.find((q) => q.id === id);
  if (!p || !canRally(s, p)) return false;
  p.rallied = s.tick + RALLY_TICKS;
  p.hp = Math.min(maxHp(p), p.hp + Math.round(maxHp(p) * RALLY_HEAL));
  p.morale = Math.min(100, p.morale + RALLY_MORALE);
  s.rallyReady = s.tick + RALLY_COOLDOWN;
  notify(s, `${p.name} rallies, and fights like ten!`);
  return true;
}

/** How someone's card shows the rally: 'ready' (the button), 'on', 'wait' (cooling down), or null (not fighting). */
export function rallyState(s: GameState, p: Person): 'ready' | 'on' | 'wait' | null {
  if (rallied(s, p)) return 'on';
  if (!raidActive(s) || p.task?.type !== 'defend' || p.downed || p.away !== null) return null;
  return s.tick >= (s.rallyReady ?? 0) ? 'ready' : 'wait';
}
