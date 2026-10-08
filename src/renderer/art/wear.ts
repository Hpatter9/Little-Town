// How worn a building looks (art/weathered.ts paints it): pure, so it is tested.

/** How weathered a building is by its age in days: 0 new, 1 a little moss, 2 mossy with ivy, 3 old and overgrown. */
export function ageStage(days: number): 0 | 1 | 2 | 3 {
  return days < 6 ? 0 : days < 15 ? 1 : days < 30 ? 2 : 3;
}

/** How battered a wall or gate is (by its health): 0 sound, 1 cracked, 2 badly broken. */
export function damageStage(hp: number | undefined, most: number | undefined): 0 | 1 | 2 {
  if (hp === undefined || !most) return 0;
  const share = hp / most;
  return share > 0.75 ? 0 : share > 0.4 ? 1 : 2;
}

/** A fire put out leaves its marks this long (game days). */
export const SCORCH_DAYS = 3;

export interface Wear {
  age: 0 | 1 | 2 | 3;
  scorch: boolean;
  damage: 0 | 1 | 2;
  seed: number;
}

export const wearKey = (w: Wear) => `${w.age}${w.scorch ? 's' : ''}${w.damage}`;

