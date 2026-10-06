// How far along a watched trip, and a fight, are: the progress bars over the fight screen (fightHud.ts) and the raid's
// battle bar (battle/battleHud.ts). No DOM here, so the tests can check the sums.

export interface TripLike {
  phase: 'out' | 'work' | 'back';
  /** 0..1 through the current phase. */
  phaseProgress: number;
  /** A delve: the room they're in (0 at the door) of how many, and whether the boss is beaten. */
  delve?: { room: number; rooms: number; cleared: boolean } | null;
}

/** The whole trip as one share, 0..1: a third out, a third there (a delve by its rooms), a third home. */
export function tripShare(v: TripLike): number {
  const p = clamp(v.phaseProgress);
  if (v.phase === 'out') return p / 3;
  if (v.phase === 'back') return (2 + p) / 3;
  const d = v.delve;
  const there = d && d.rooms > 0 ? (d.cleared ? 1 : clamp(d.room / d.rooms)) : p;
  return (1 + there) / 3;
}

/** What the trip's bar says: where they are, and how far. */
export function tripLabel(v: TripLike, dest: string): string {
  const pct = Math.round(tripShare(v) * 100);
  const where = v.phase === 'out' ? `On the way to ${dest}` : v.phase === 'back' ? 'Heading home' : v.delve ? `Room ${v.delve.room} of ${v.delve.rooms}` : `At ${dest}`;
  return `${where} · ${pct}%`;
}

/** A fight's share done: the foes' health gone (all of it, across their side), 0..1. With waves still to come (an
 *  assault), the waves before count as done and this one fills its part. */
export function fightShare(foes: { hp: number; maxHp: number; down: boolean }[], wave = 0, waves = 0): number {
  const max = foes.reduce((a, f) => a + Math.max(1, f.maxHp), 0);
  const left = foes.reduce((a, f) => a + (f.down ? 0 : Math.max(0, f.hp)), 0);
  const here = max > 0 ? 1 - left / max : 1;
  if (waves > 1 && wave > 0) return clamp((wave - 1 + here) / waves);
  return clamp(here);
}

/** A raid's share decided: the raiders beaten or got through, of all that came (0..1). */
export function raidShare(killed: number, through: number, total: number): number {
  return total > 0 ? clamp((killed + through) / total) : 0;
}

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
