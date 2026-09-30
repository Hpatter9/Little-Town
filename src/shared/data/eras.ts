// The eras, in order (DESIGN §2). Content from a later era stays hidden until the town reaches it.

export const ERAS = ['neolithic', 'medieval', 'industrial', 'modern', 'space'] as const;
export type Era = (typeof ERAS)[number];

export const ERA_NAMES: Record<Era, string> = {
  neolithic: 'Neolithic',
  medieval: 'Medieval',
  industrial: 'Industrial',
  modern: 'Modern',
  space: 'Robotic & Space',
};

/** Whether the town has reached `era` (or gone past it). */
export const eraReached = (current: Era, era: Era = 'neolithic') => ERAS.indexOf(current) >= ERAS.indexOf(era);

/** The earlier of two eras. */
export const earlier = (a: Era, b: Era): Era => (ERAS.indexOf(a) <= ERAS.indexOf(b) ? a : b);

/** The era after this one (null at the end). */
export const nextEra = (e: Era): Era | null => ERAS[ERAS.indexOf(e) + 1] ?? null;
