// What a defence piece does when it fires (data/defenses.ts): the blow, and its quirks: splash over those beside the
// one struck, a slow, a burn that goes on hurting, a chain to the next raiders, double by night, a rout. Shared by
// the raiders in the town (raids.ts fireDefenses) and on the battle map (battle.ts: towers and traps).
import { BURN_SECONDS, CHAIN_REACH, CHAIN_SHARE, SLOW_SECONDS, SPLASH_SHARE } from '../data/defenses';
import { ENEMIES } from '../data/enemies';
import type { BuildingDef } from '../data/buildings';
import type { Rng } from '../rng';
import { fogAim, wardOf } from './rivals';
import type { GameState, Raider } from './state';
import { calendar, TICK_HZ } from './time';

type Defense = BuildingDef['defense'] & object;

export interface Volley {
  /** Who the blow fell on (the first struck, the splash, the chain) and how hard. */
  struck: { rd: Raider; dmg: number }[];
  /** Whether the first shot landed at all. */
  hit: boolean;
}

/** A piece fires at `target`. `near(rd, px)` gives the raiders within reach of one (for splash and chain). The blow
 *  itself is dealt by `hurt` (the town's and the map's differ), the quirks are set here. */
export function fireAt(s: GameState, rng: Rng, d: Defense, target: Raider, near: (rd: Raider, px: number) => Raider[], hurt: (rd: Raider, dmg: number) => void): Volley {
  const out: Volley = { struck: [], hit: false };
  if (rng.next() >= d.accuracy - fogAim(s) - ENEMIES[target.kind].dodge / 2) return out;
  out.hit = true;
  const h = calendar(s.tick).hour;
  const night = d.night && (h >= 20 || h < 5) ? d.night : 1;
  const base = rng.int(d.damage[0], d.damage[1]) * wardOf(s) * night;
  const strike = (rd: Raider, dmg: number) => {
    hurt(rd, dmg);
    out.struck.push({ rd, dmg });
    if (d.slow) {
      rd.slow = Math.max(rd.slow ?? 0, d.slow);
      rd.slowUntil = s.tick + SLOW_SECONDS * TICK_HZ;
    }
    if (d.burn) rd.burn = { until: s.tick + BURN_SECONDS * TICK_HZ, dps: Math.max(rd.burn?.until ?? 0 > s.tick ? rd.burn!.dps : 0, d.burn) };
    if (d.rout && !ENEMIES[rd.kind].kit && rng.chance(d.rout)) rd.routed = true;
  };
  strike(target, base);
  if (d.splash) for (const rd of near(target, d.splash)) if (rd !== target && !rd.down && !rd.gone && !rd.ally) strike(rd, base * SPLASH_SHARE);
  if (d.chain) {
    let from = target;
    let share = CHAIN_SHARE;
    const done = new Set<Raider>([target]);
    for (let i = 0; i < d.chain; i++) {
      const next = near(from, CHAIN_REACH).find((rd) => !done.has(rd) && !rd.down && !rd.gone && !rd.ally);
      if (!next) break;
      done.add(next);
      strike(next, base * share);
      share *= CHAIN_SHARE;
      from = next;
    }
  }
  return out;
}

/** How much of a raider's speed is left to it now (a slow fading when its time is up). */
export const speedOf = (rd: Raider, tick: number) => (rd.slowUntil !== undefined && rd.slowUntil > tick ? Math.max(0, 1 - (rd.slow ?? 0)) : 1);

/** Each tick: the burning burn. */
export function tickBurns(s: GameState, raiders: Raider[], hurt: (rd: Raider, dmg: number) => void): void {
  for (const rd of raiders) {
    if (!rd.burn || rd.down || rd.gone) continue;
    if (rd.burn.until <= s.tick) {
      delete rd.burn;
      continue;
    }
    hurt(rd, rd.burn.dps / TICK_HZ);
  }
}
