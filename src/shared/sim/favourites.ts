// Favourites (the owner's aim: stakes you feel; the player cares about particular people). The player may pin up to
// `FAVOURITES_MOST` townsfolk (the ♥ on the character sheet, the `favourite` command). It is a view preference and
// nothing more: no rule of the town reads it. Favourites head the "While you were away" card (sim/awaySummary.ts), get
// a ♥ in the news (mobile/notices.ts), lend the top bar one of their doings and sit at the top of the People tab. When
// a favourite dies their slot frees (`favouriteDied`, from `recordFallen`) and they are kept on `s.favouritesGone`,
// so the phone can show their obituary card once. Their name-days (`nameDays`) are for the calendar.

import { calendar, DAYS_PER_SEASON, SEASONS, type Season } from './time';
import type { GameState, Person } from './state';

/** Townsfolk the player may follow at once. */
export const FAVOURITES_MOST = 3;
/** Favourites who died, kept for their last card (the newest last). */
export const FAVOURITES_GONE_KEPT = 6;

export const favouritesOf = (s: Pick<GameState, 'favourites'>): number[] => s.favourites ?? [];
export const isFavourite = (s: Pick<GameState, 'favourites'>, id: number): boolean => (s.favourites ?? []).includes(id);

/** Why a favourite can't be pinned (null: it can). */
export function favouriteRefusal(s: GameState, id: number, on: boolean): string | null {
  const has = isFavourite(s, id);
  if (!on) return has ? null : 'not a favourite';
  if (has) return 'already a favourite';
  if (!s.people.some((p) => p.id === id)) return 'nobody by that id';
  if (favouritesOf(s).length >= FAVOURITES_MOST) return `${FAVOURITES_MOST} at most`;
  return null;
}

/** The `favourite` command: pin or unpin someone. */
export function setFavourite(s: GameState, id: number, on: boolean): boolean {
  if (favouriteRefusal(s, id, on)) return false;
  if (on) s.favourites = [...favouritesOf(s), id];
  else {
    s.favourites = favouritesOf(s).filter((x) => x !== id);
    if (!s.favourites.length) delete s.favourites;
  }
  return true;
}

/** A favourite has died: their slot frees, and they are kept for their last card. */
export function favouriteDied(s: GameState, id: number): void {
  if (!isFavourite(s, id)) return;
  s.favourites = favouritesOf(s).filter((x) => x !== id);
  if (!s.favourites.length) delete s.favourites;
  const gone = (s.favouritesGone ??= []);
  gone.push(id);
  if (gone.length > FAVOURITES_GONE_KEPT) gone.splice(0, gone.length - FAVOURITES_GONE_KEPT);
}

export interface NameDay {
  id: number;
  name: string;
  season: Season;
  /** The day of the season (1 to `DAYS_PER_SEASON`). */
  day: number;
}

/** The favourites' name-days, for the calendar: the day of the year they were born, or (born before the town, or
 *  come from elsewhere) a day their id gives them. */
export function nameDays(s: GameState): NameDay[] {
  const out: NameDay[] = [];
  for (const id of favouritesOf(s)) {
    const p = s.people.find((q) => q.id === id);
    if (!p) continue;
    if (p.bornTick != null && p.bornTick > 0) {
      const c = calendar(p.bornTick);
      out.push({ id, name: p.name, season: c.season, day: c.dayOfSeason });
    } else out.push({ id, name: p.name, season: SEASONS[id % SEASONS.length], day: (id % DAYS_PER_SEASON) + 1 });
  }
  return out;
}

/** The "While you were away" card's first lines (sim/awaySummary.ts): one for each favourite the player had when they
 *  left (`had`), how they fared since `since`: dead, a close call, or well and at what (`doing`). */
export function favouriteAwayLines(s: GameState, had: readonly { id: number; name: string }[], since: number, doing: (p: Person) => string): { tone: 'bad' | 'good' | 'news'; text: string }[] {
  const out: { tone: 'bad' | 'good' | 'news'; text: string }[] = [];
  for (const { id, name } of had) {
    const p = s.people.find((q) => q.id === id);
    const f = !p ? [...(s.fallen ?? [])].reverse().find((q) => q.id === id) : undefined;
    if (f) {
      out.push({ tone: 'bad', text: `♥ ${f.name} died ${f.cause}.` });
      continue;
    }
    if (!p) {
      out.push({ tone: 'bad', text: `♥ ${name} is gone from the town.` });
      continue;
    }
    const near = p.closeCalls?.filter((c) => c.tick >= since).at(-1);
    if (near) out.push({ tone: 'news', text: `♥ ${near.text}` });
    else out.push({ tone: 'good', text: `♥ ${p.name} is well${p.away !== null ? ', away from the town' : `: ${doing(p).charAt(0).toLowerCase()}${doing(p).slice(1)}`}.` });
  }
  return out;
}
