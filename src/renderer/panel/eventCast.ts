// Who stands in an event card's scene (the owner's ask: "actually have the townsfolk involved"). The scene's dolls are
// laid out in fixed places (`SLOT`): the townsperson the event is about, the founder, three more of the town's grown-ups
// (the council at its table, the judge's men, the bride's kin), the outsiders the event brings (strangers, a knight or
// herald, a priest or healer, a merchant: dressed by the renderer), and then the crowd, real townsfolk. Who they are is
// picked from the event's own id, so the same card always shows the same faces (never Math.random). Pure: no DOM.

import { hashSeed, Rng } from '../../shared/rng';

export const SLOT = { lead: 0, founder: 1, elder: 2, elder2: 3, elder3: 4, stranger: 5, stranger2: 6, stranger3: 7, knight: 8, priest: 9, merchant: 10, crowd: 11 } as const;
/** The most of the crowd a scene shows. */
export const CROWD_MAX = 10;

export interface CastPerson {
  id: number;
  /** A grown-up (children stand at the back of a crowd, never at the council's table). */
  grown: boolean;
}

export interface EventCast {
  /** The one it's about (when nobody is named, a townsperson of the cast's picking: the founder only in a town of one). */
  lead: number | null;
  founder: number | null;
  /** Three grown-ups for the scene's other parts (repeated only when the town has too few). */
  elders: number[];
  /** The rest of the town, grown-ups first, as many as there are up to CROWD_MAX: never anyone twice. */
  crowd: number[];
}

/** The cast for an event's scene: `seed` is the event's own id (the prompt's), `people` the townsfolk at home. */
export function eventCast(seed: number, people: CastPerson[], lead: number | null, founder: number | null): EventCast {
  const rng = new Rng(hashSeed(`scene:${seed}`));
  const here = people.filter((p) => p.id !== lead && p.id !== founder);
  // (a steady shuffle: Fisher-Yates on the seeded stream)
  const order = [...here];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  // (nobody named: a grown-up stands in the middle of it, not the founder twice over)
  const stand = lead ?? order.find((p) => p.grown)?.id ?? order[0]?.id ?? founder;
  const rest = order.filter((p) => p.id !== stand);
  const grown = rest.filter((p) => p.grown);
  const young = rest.filter((p) => !p.grown);
  const pool = grown.length ? grown : rest;
  const elders = pool.length ? [0, 1, 2].map((i) => pool[i % pool.length].id) : [];
  const used = new Set(elders);
  const crowd = [...grown, ...young].filter((p) => !used.has(p.id)).slice(0, CROWD_MAX).map((p) => p.id);
  return { lead: stand, founder: founder ?? stand, elders, crowd };
}
