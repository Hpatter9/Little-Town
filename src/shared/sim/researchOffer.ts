// Research is offered, not queued: the town is shown three topics it can study now, drawn at random, and one is
// chosen (by the player, or by the town once OFFER_WAIT_TICKS have passed). When that topic is finished, three new ones
// are drawn. The draw uses its own side stream, so it never moves the town's main one.

import { forgone } from '../data/originResearch';
import { TOPICS } from '../data/research';
import { hashSeed, Rng } from '../rng';
import { modifiers, prereqsMet, seatStageNow } from './research';
import type { GameState } from './state';
import { TICKS_PER_HOUR } from './time';

/** How many topics are offered at a time. */
export const OFFER_SIZE = 3;
/** How long the offer stands before a hands-off town chooses one itself: three game hours, three minutes of play.
 *  (Much longer starves a young town's first days of shelter and food: a town left alone grows less.) */
export const OFFER_WAIT_TICKS = TICKS_PER_HOUR * 3;
/** People a town needs before refinements (topics that only make it better at what it does) are offered. */
const OFFER_REFINE_AT = 4;

/** Whether a topic can be offered now: not done or underway, its prerequisites finished, its era and seat reached. */
function offerable(s: GameState, id: string): boolean {
  const r = s.research;
  const t = TOPICS.find((q) => q.id === id);
  if (!t || r.done.includes(id) || r.queue.includes(id)) return false;
  if (t.refinement && s.people.length < OFFER_REFINE_AT) return false;
  if (!t.prereqs.every((p) => r.done.includes(p) || forgone(p, s.origin))) return false;
  return prereqsMet(r, id, s.cheats?.unlockAll ? 'space' : s.era, s.origin, seatStageNow(s)).ok;
}

/** Every topic the town could be offered now. */
export const offerableTopics = (s: GameState): string[] => TOPICS.filter((t) => offerable(s, t.id)).map((t) => t.id);

/** Draws a fresh offer: up to three distinct topics, the same for the same seed and the same count of offers made. */
export function drawOffer(s: GameState): string[] {
  const r = s.research;
  const pool = offerableTopics(s);
  const rng = new Rng(hashSeed(`${s.seed}:research-offer:${r.offers ?? 0}`));
  // (the two the town would choose itself are always on offer, if they can be studied; the third is drawn)
  const out: string[] = [];
  for (const id of r.suggested ?? []) {
    const at = pool.indexOf(id);
    if (at >= 0) out.push(...pool.splice(at, 1));
  }
  while (out.length < OFFER_SIZE && pool.length) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return out;
}

/** Keeps the offer in step with the town: drawn when there is room to study and none stands, drawn again if any of
 *  it can no longer be studied. Called every tick; cheap unless it has to draw. */
export function keepOffer(s: GameState): void {
  const r = s.research;
  if (r.queue.length >= modifiers(r).researchSlots) {
    // (busy: no offer stands; the next is drawn when a topic finishes)
    if (r.offer?.length) r.offer = [];
    r.offerEmpty = false;
    return;
  }
  const offer = r.offer ?? [];
  if (offer.length && offer.every((id) => offerable(s, id))) return;
  // (nothing to offer: look again in an hour, not every tick)
  if (!offer.length && r.offerAt !== undefined && s.tick - r.offerAt < TICKS_PER_HOUR && r.offerEmpty) return;
  r.offer = drawOffer(s);
  r.offerAt = s.tick;
  r.offerEmpty = r.offer.length === 0;
  if (r.offer.length) r.offers = (r.offers ?? 0) + 1;
}

/** Study one of the offered topics. Does nothing for any other, so a second tap on the same one is harmless. */
export function chooseOffer(s: GameState, id: string): boolean {
  const r = s.research;
  if (!r.offer?.includes(id) || r.queue.length >= modifiers(r).researchSlots || !offerable(s, id)) return false;
  r.queue.push(id);
  r.offer = [];
  r.offerAt = s.tick;
  r.offerEmpty = false;
  keepOffer(s);
  return true;
}

/** Whether the offer has stood long enough that a hands-off town should choose (the planner then picks among them). */
export const offerOverdue = (s: GameState): boolean => !!s.research.offer?.length && s.tick - (s.research.offerAt ?? s.tick) >= OFFER_WAIT_TICKS;
