// What holds still for the open game: a raid's battle or a watched fight on the screen stops the questions' clocks and
// keeps anything else from popping up over it. (The raids' waiting at the gate for a player who was away went with the
// catch-up: the game no longer runs while it is closed.)

import type { GameState } from './state';

/** A raid's battle or a watched fight is on the screen (the owner's ask: the game pauses in the background then,
 *  and nothing else may pop up over it). A raid being skipped still counts: its battle plays alone, flat out, and a
 *  question waiting under it can't stop it (it once did: Skip left the fight standing still behind a hidden question). */
export function fightOnScreen(s: GameState): boolean {
  const r = s.raid;
  if (r && r.phase === 'active' && (r.battle || r.tactics)) return true;
  // (the board kept up a moment after the raid, for the word across it: sim/tactics.ts `tacticsOver`. Its clock is the
  //  tick, so the fight's clock must keep running: held for a question raised as the raid ended, the board never went,
  //  and the question and the recap, both waiting for the board to go, never showed)
  if (s.tacticsEnded && s.tick < s.tacticsEnded.until) return true;
  if (s.watching === undefined) return false;
  const e = s.expeditions.find((x) => x.id === s.watching) ?? s.skirmishes?.find((k) => k.e.id === s.watching)?.e ?? (s.arena?.bout?.id === s.watching ? s.arena.bout.e : undefined);
  return !!e?.battle;
}

/** Every tick of a fight on screen, the open questions' clocks stand still (none is answered for the player while
 *  they watch the fight), but the raid's own. */
export function holdForFight(s: GameState): void {
  if (!fightOnScreen(s)) return;
  for (const p of s.prompts) if (p.kind !== 'raid') p.expiresTick += 1;
}
