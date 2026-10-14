// Choice events that only make sense for a town of the living (the owner's ask): a famine, a feast or a cook means
// nothing to a town where nobody eats (the lich's raised dead, the machines: `tireless` in sim/state.ts); a fever, a
// plague or a quack's tonic nothing to the undead or to steel; a wedding, a birth or a birthday nothing to those who
// neither pair nor age; a drunken brawl nothing to those who never drink. Each event listed here has its `when`
// joined with the town having such people (`fitEvents`, applied as EVENTS is put together in events.ts).
import type { GameState } from '../sim/state';
import type { EventDef } from './eventKit';

/** Someone who eats, sleeps, sickens and ages (not the raised dead, a lich or a machine: as `tireless`). */
const isLiving = (p: GameState['people'][number]) => !(p.monster === 'undead' || p.machine || p.undying);

/** The town has someone who eats (and so drinks, sickens and ages). */
export const living = (s: GameState) => s.people.some(isLiving);
/** The town has two grown-ups of the living, who could court, wed and have children. */
export const couples = (s: GameState) => s.people.filter((p) => isLiving(p) && p.bornTick == null).length >= 2;

/** Hunger and food: a famine, a hard winter's stores, feasts and cooking, the granary's rats. */
export const FOOD_EVENTS = [
  'rats', 'f_rats', 'hard_winter', 'long_winter', 'blight_famine', 'l_cook', 'l_stranger_feast', 'w_funeral_feast',
  'w_truce_feast', 'w_shrine_offerings', 'l_mushroom_glut', 'bad_berries',
] as const;
/** Sickness: fevers, plagues, the leech and the quack, cures, a miracle of healing, bad water. */
export const SICK_EVENTS = [
  'sick_traveller', 'fever_home', 'plague_ship', 'l_fever_scare', 'l_poison_spring', 'e_med_leech', 'e_med_plague_rumour',
  'e_ind_coal_dust', 'e_ind_smoke', 'e_ind_quack', 'e_mod_vaccine', 'e_mod_antibiotic', 'e_spc_void_sickness',
  'black_fever', 'miracle', 'calamity_well',
] as const;
/** Drink among the townsfolk: brawls, old rivals at their cups, the brewer's batch, stocks for drunks. */
export const DRINK_EVENTS = ['brawl', 'l_rival_friends', 'l_tasting', 'w_stocks'] as const;
/** Love, marriage, birth and birthdays. */
export const KIN_EVENTS = ['twins', 'proposal', 'l_proposal', 'midwife_herbs', 'l_birthday', 'founder_birthday'] as const;

const NEEDS: Record<string, (s: GameState) => boolean> = Object.fromEntries([
  ...[...FOOD_EVENTS, ...SICK_EVENTS, ...DRINK_EVENTS].map((id) => [id, living] as const),
  ...KIN_EVENTS.map((id) => [id, couples] as const),
]);

/** The events, each listed one asking for the people it needs as well as its own `when`. */
export function fitEvents(events: readonly EventDef[]): EventDef[] {
  return events.map((e) => {
    const need = NEEDS[e.id];
    if (!need) return e;
    const when = e.when;
    return { ...e, when: when ? (s: GameState) => need(s) && when(s) : need };
  });
}
