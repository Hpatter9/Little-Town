// Raiders' wounds (the owner's ask: a raider hurt in the legs during the fight is slowed, and can be run down as it
// retreats, to be captured or killed). A blow that lands on a raider may lame it (`legWound`, rolled where the raid's
// recap tallies every blow, so the town's blows, the towers' and the traps' all count): `Raider.lame`, a share of its
// pace lost (`LAME_PER` a wound, up to `LAME_MOST`), which `speedOf` (defenses.ts) takes off its every step, coming on
// and running away alike. A lame raider running from the fight with a fighter of the town close by may be run down
// (`runDown`, on the battle map and in town): a person is taken alive (sure to be a prisoner: `takePrisoners`), a beast
// or a monster killed. The recap tells how many were.

import { ENEMIES } from '../data/enemies';
import { isHuman } from './prisoners';
import { before, credit } from './raidRecap';
import { notify, type GameState, type Person, type Raider } from './state';

/** The share of solid blows that find a leg (by the blow's share of its health, doubled, up to whole). */
export const LEG_SHARE = 0.3;
/** Pace lost to each leg wound, and the most a raider can lose. */
export const LAME_PER = 0.3;
export const LAME_MOST = 0.65;
/** How near (battle-map cells, or px in town) a fighter must be to run a lame runner down, and the chance each tick. */
export const RUN_DOWN_CELLS = 2.4;
export const RUN_DOWN_PX = 64;
export const RUN_DOWN_CHANCE = 0.1;

/** A roll of the sim's own (from the raider and the tick: no draw from the town's stream, so a raid replays the same). */
function roll(id: number, tick: number, salt: number): number {
  let h = (id * 374761393 + tick * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const lameOf = (rd: Raider) => rd.lame ?? 0;

/** A blow of `dmg` has landed on `rd`: it may be lamed. (An epic boss shrugs it off.) */
export function legWound(s: GameState, rd: Raider, dmg: number): void {
  if (rd.down || rd.gone || rd.ally || dmg <= 0 || ENEMIES[rd.kind]?.kit) return;
  const chance = LEG_SHARE * Math.min(1, (2 * dmg) / Math.max(1, rd.maxHp));
  if (roll(rd.id, s.tick, Math.round(dmg)) >= chance) return;
  const was = lameOf(rd);
  rd.lame = Math.min(LAME_MOST, was + LAME_PER);
  if (!was) rd.lamed = true;
}

/** Each tick, a lame raider running away with `catcher` near: it may be run down. True if it was. */
export function tryRunDown(s: GameState, rd: Raider, catcher: Person | undefined): boolean {
  if (!catcher || rd.down || rd.gone || rd.ally || !lameOf(rd)) return false;
  if (roll(rd.id, s.tick, 7) >= RUN_DOWN_CHANCE * (lameOf(rd) / LAME_PER)) return false;
  const was = before([rd]);
  rd.down = true;
  rd.runDown = true;
  if (isHuman(rd.kind)) rd.taken = true;
  rd.lastHit = s.tick;
  credit(s, catcher.id, was); // (the catcher has the credit for it)
  catcher.lastBlow = s.tick;
  const name = ENEMIES[rd.kind]?.name ?? 'raider';
  notify(s, rd.taken ? `${catcher.name} ran down a limping ${name.toLowerCase()} and took them alive.` : `${catcher.name} ran down a limping ${name.toLowerCase()} and finished it.`);
  return true;
}
