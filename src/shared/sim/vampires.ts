// The Blood Court's blood (data/vampires.ts): the tithe at dusk, the pens' and the prisoners' blood, and the vampires
// drinking from the store.
import { BLOOD_FARM, BLOOD_KEEP, BLOOD_PER_FEED, BLOOD_PER_HEAD, BLOOD_PER_PRISONER, FARM_CELLS, TITHE_HOUR, TITHE_PER_THRALL } from '../data/vampires';
import { depositNear, storages } from './buildings';
import { isChild } from './social';
import { addStock, campXY, notify, type GameState } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** A town of the Blood Court: it keeps the blood tithe from its founding. */
export const bloodTown = (s: Pick<GameState, 'origin'>) => s.origin === 'vampire';
/** Whether the town's vampires are fed by a tithe (the Court's always; another town's once it chose one). */
export const tithed = (s: Pick<GameState, 'origin' | 'tithe'>) => bloodTown(s) || !!s.tithe;

/** How many prisoners the town's blood farms hold. */
export const farmCells = (s: Pick<GameState, 'buildings'>) => s.buildings.filter((b) => b.def === BLOOD_FARM.id && b.status === 'done').length * FARM_CELLS;

/** Blood in store. */
export const bloodInStore = (s: GameState) => storages(s).reduce((n, b) => n + (b.store.blood ?? 0), 0);

/** A vampire drinks from the store, if there's blood in it. */
export function drinkBlood(s: GameState): boolean {
  for (const st of storages(s)) {
    if ((st.store.blood ?? 0) >= BLOOD_PER_FEED) {
      addStock(st.store, 'blood', -BLOOD_PER_FEED);
      return true;
    }
  }
  return false;
}

/** Each dusk in a blood town: the thralls' tithe (while the store is under `BLOOD_KEEP`), the beasts' and the
 *  prisoners' blood go to the store. */
export function bloodHourly(s: GameState): void {
  if (!bloodTown(s) || s.tick % TICKS_PER_HOUR !== 0 || calendar(s.tick).hour !== TITHE_HOUR) return;
  // Thralls are spared while the store holds enough (the Court bleeds its own only as far as it needs to).
  const thralls = bloodInStore(s) >= BLOOD_KEEP ? 0 : s.people.filter((p) => p.away === null && !isChild(p) && !p.monster && !p.machine).length;
  const heads = s.buildings.reduce((n, b) => n + (b.status === 'done' ? (b.herd?.head ?? 0) : 0), 0);
  const bled = Math.min(s.prisoners.length, farmCells(s));
  const blood = Math.floor(thralls * TITHE_PER_THRALL + heads * BLOOD_PER_HEAD + bled * BLOOD_PER_PRISONER);
  if (blood <= 0) return;
  depositNear(s, campXY(s), { blood });
  notify(s, `The tithe: ${blood} blood from ${thralls} thrall${thralls === 1 ? '' : 's'}${bled ? `, ${bled} prisoner${bled === 1 ? '' : 's'}` : ''}${heads ? ' and the pens' : ''}.`);
}

export interface BloodView {
  /** Blood in store, and the reserve past which the thralls are spared. */
  store: number;
  keep: number;
  spared: boolean;
  /** Where tonight's tithe comes from: the thralls, the pens' beasts, the Blood Farm's cells. */
  thralls: number;
  heads: number;
  farms: number;
  cells: number;
  prisoners: number;
  /** About how much comes in at dusk. */
  nightly: number;
}

/** The Court's blood, for the Town menu (Our ways) and the overview. Null outside a blood town. */
export function bloodView(s: GameState): BloodView | null {
  if (!bloodTown(s)) return null;
  const store = bloodInStore(s);
  const spared = store >= BLOOD_KEEP;
  const thralls = s.people.filter((p) => p.away === null && !isChild(p) && !p.monster && !p.machine).length;
  const heads = s.buildings.reduce((n, b) => n + (b.status === 'done' ? (b.herd?.head ?? 0) : 0), 0);
  const cells = farmCells(s);
  const prisoners = s.prisoners.length;
  return {
    store,
    keep: BLOOD_KEEP,
    spared,
    thralls,
    heads,
    farms: s.buildings.filter((b) => b.def === BLOOD_FARM.id && b.status === 'done').length,
    cells,
    prisoners,
    nightly: Math.floor((spared ? 0 : thralls) * TITHE_PER_THRALL + heads * BLOOD_PER_HEAD + Math.min(prisoners, cells) * BLOOD_PER_PRISONER),
  };
}
