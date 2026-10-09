// Life's ceremonies (PLAN.md step 7): funerals, a great funeral after a day of many deaths, wedding feasts, and the
// town's feasts (midsummer, a victory). Each is a gathering: those it's for stop work and stand together a while at
// the graveyard, the tavern or the fire, and come away a little better for it.

/** The hour of the day gatherings are held, and how long each lasts (game hours). */
export const GATHER_HOUR = 18;
export const FUNERAL_HOURS = 2;
export const GREAT_FUNERAL_HOURS = 4;
export const FEAST_HOURS = 3;
/** This many deaths since the last funeral make it a great funeral: the whole town, a longer rite. */
export const GREAT_FUNERAL_DEATHS = 3;
/** What attending does: a funeral eases the grief of those who were close (its value times FUNERAL_EASE) and leaves a
 *  mark on the town; a feast cheers everyone. Morale and hours. */
export const FUNERAL_EASE = 0.5;
export const FUNERAL_MARK: [number, number] = [2, 24];
export const GREAT_FUNERAL_MARK: [number, number] = [4, 48];
export const WEDDING_FEAST_MARK: [number, number] = [6, 36];
export const FEAST_MARK: [number, number] = [6, 24];
/** A feast eats this much food a head (need units: a meal is about 0.35), and only if the stores hold FEAST_FOOD_DAYS
 *  days of food afterwards. The tavern is paid FEAST_COIN a head from the treasury when it's held there. */
export const FEAST_FOOD = 0.5;
export const FEAST_FOOD_DAYS = 3;
export const FEAST_COIN = 2;
/** A feast at midsummer (the second day of summer), and after a raid driven off. Never two within FEAST_GAP_HOURS. */
export const MIDSUMMER_DAY = 2;
export const FEAST_GAP_HOURS = 36;
/** Processions (the owner's ask): a funeral carries the coffin from where the dead lived to the graveyard, a wedding
 *  party walks from the couple's door to the feast, the faithful walk from the fire to the temple on a rite day. The
 *  head of the line moves at PROCESSION_PACE px a tick (a slow walk: people walk about 4.8), its guests in a column
 *  PROCESSION_GAP px apart behind it (the first two side by side at the head: the coffin's bearers, the couple); a
 *  procession shorter than PROCESSION_LEAST px isn't walked, and none takes longer than PROCESSION_MOST hours. */
export const PROCESSION_PACE = 1.6;
export const PROCESSION_GAP = 18;
export const PROCESSION_LEAST = 96;
export const PROCESSION_MOST = 1.5;
/** A rite at the temple: the pious go, and RITE_SHARE of the rest (by a roll of their own by the day); it lasts
 *  RITE_HOURS, the faithful kneeling in a ring before the temple's door. */
export const RITE_SHARE = 0.4;
export const RITE_HOURS = 1;
