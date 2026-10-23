// Developer mode's orders (the owner's ask: "a developer mode button in the settings... to play through quickly to see
// what bugs I run into"): what each one is, and its checks for a command that came over IPC. Kept apart from
// sim/dev.ts (which carries them out) so commands.ts needn't pull in half the sim to parse one.

/** The disasters one can be set off by hand (sim/disasters.ts `DisasterKind`). */
export const DEV_DISASTERS = ['flood', 'wildfire', 'tornado', 'quake'] as const;
export type DevDisaster = (typeof DEV_DISASTERS)[number];

/** The most hours one fast-forward may run (ten days: a season). */
export const DEV_SKIP_MOST_HOURS = 240;
/** The most of each thing one fill adds, and the most levels one level-up gives. */
export const DEV_FILL_MOST = 100000;
export const DEV_LEVELS_MOST = 99;

export type DevOrder =
  /** Every building under way (and the ring wall's pieces, and the planned streets) finished now; or one of them. */
  | { op: 'finishBuilds' }
  | { op: 'finishBuilding'; id: number }
  /** Whether every new order is built the moment it is placed. */
  | { op: 'instantBuild'; on: boolean }
  /** The topic being studied learned now (the first on offer, when none is). */
  | { op: 'finishResearch' }
  /** Every field reaped now, its crop into the stores. */
  | { op: 'harvest' }
  /** So much food, wood and stone into the stores, and coins into the treasury and the founder's purse. */
  | { op: 'fill'; amount: number }
  /** Kill one townsperson, raider or band on the land; every raider at once; knock someone down (bleeding). */
  | { op: 'kill'; target: 'person' | 'raider' | 'roamer'; id: number }
  | { op: 'killRaiders' }
  | { op: 'down'; id: number }
  /** The raid and every fight on screen won now. */
  | { op: 'winFight' }
  /** Mend one townsperson, or everyone (null). */
  | { op: 'heal'; id: number | null }
  /** Run the town on for so many hours, flat out; or stop a run under way. */
  | { op: 'skip'; hours: number }
  | { op: 'stopSkip' }
  /** A raid set out now (of a kind, or the town's usual pick: null). */
  | { op: 'raid'; kind: string | null }
  /** A choice event put to the town now (data/events.ts). */
  | { op: 'event'; id: string }
  /** So many levels to a townsperson (null: the founder). */
  | { op: 'levelUp'; id: number | null; levels: number }
  /** The God creature's saga begun now (sim/creature.ts). */
  | { op: 'creatureSaga' }
  | { op: 'disaster'; kind: DevDisaster }
  /** The whole land seen (the fog of war lifted). */
  | { op: 'reveal' };

const int = (x: unknown): x is number => Number.isInteger(x);
const idOrNull = (x: unknown): x is number | null => x === null || int(x);

/** Check an order that came over IPC. */
export function parseDevOrder(raw: unknown): DevOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  switch (o.op) {
    case 'finishBuilds':
    case 'finishResearch':
    case 'harvest':
    case 'killRaiders':
    case 'winFight':
    case 'stopSkip':
    case 'creatureSaga':
    case 'reveal':
      return { op: o.op };
    case 'finishBuilding':
      return int(o.id) ? { op: 'finishBuilding', id: o.id } : null;
    case 'instantBuild':
      return typeof o.on === 'boolean' ? { op: 'instantBuild', on: o.on } : null;
    case 'fill':
      return int(o.amount) && o.amount > 0 && o.amount <= DEV_FILL_MOST ? { op: 'fill', amount: o.amount } : null;
    case 'kill':
      return (o.target === 'person' || o.target === 'raider' || o.target === 'roamer') && int(o.id) ? { op: 'kill', target: o.target, id: o.id } : null;
    case 'down':
      return int(o.id) ? { op: 'down', id: o.id } : null;
    case 'heal':
      return idOrNull(o.id) ? { op: 'heal', id: o.id } : null;
    case 'skip':
      return int(o.hours) && o.hours >= 1 && o.hours <= DEV_SKIP_MOST_HOURS ? { op: 'skip', hours: o.hours } : null;
    case 'raid':
      return o.kind === null || typeof o.kind === 'string' ? { op: 'raid', kind: o.kind as string | null } : null;
    case 'event':
      return typeof o.id === 'string' && o.id.length < 80 ? { op: 'event', id: o.id } : null;
    case 'levelUp':
      return idOrNull(o.id) && int(o.levels) && o.levels >= 1 && o.levels <= DEV_LEVELS_MOST ? { op: 'levelUp', id: o.id, levels: o.levels } : null;
    case 'disaster':
      return (DEV_DISASTERS as readonly unknown[]).includes(o.kind) ? { op: 'disaster', kind: o.kind as DevDisaster } : null;
  }
  return null;
}
