// Research rules: the queue, what finished topics change, and where research happens.

import { ERA_NAMES, eraReached, type Era } from '../data/eras';
import { forgone, topicName } from '../data/originResearch';
import type { OriginId } from '../data/origins';
import { RESEARCH_QUEUE_BASE, RESEARCH_STATIONS, TOPIC_BY_ID, type ResearchRule } from '../data/research';
import type { WorkAnim } from '../data/terrain';
import { SEAT_ERAS, SEAT_STAGE, seatOf } from '../data/seats';
import type { GameState, Person } from './state';

export interface ResearchState {
  done: string[];
  /** Topics in the order they will be researched; the first is being worked on. */
  queue: string[];
  /** Work done so far per topic (0..1). Kept when a topic is dequeued, so cancelling loses nothing. */
  progress: Record<string, number>;
  /** Hidden topics the town has discovered. */
  revealed?: string[];
  /** Topics the player picked by hand, in the order they want them: these go first in the queue, and the planner
   *  never takes them out (pickResearch). */
  picked?: string[];
  /** Topics the player took out of the queue: the planner leaves them be while it has anything else to study. */
  shelved?: string[];
}

export interface Modifiers {
  gather: Record<WorkAnim, number>;
  researchSlots: number;
  researchSpeed: number;
  carryBonus: number;
  storage: number;
  cropSpeed: number;
  /** How much fields tire and take blight. */
  soil: number;
  /** Extra build and craft queue slots. */
  queueSlots: number;
  /** The origin levers research pulls too (sim/origin.ts multiplies them in). */
  rules: Record<ResearchRule, number>;
  /** Grades added to what crafters make. */
  quality: number;
  /** The wait before a power can be called again, and how long its effect lasts, as multipliers. */
  powerRecharge: number;
  powerLasts: number;
  /** The care of the hurt: healing pace, bleeding-out time, and the share of health the downed get up at. */
  careHeal: number;
  careBleed: number;
  careFeet: number;
}

/** Combined effects of every finished topic. */
export function modifiers(r: Pick<ResearchState, 'done'>): Modifiers {
  const m: Modifiers = {
    gather: { chop: 1, mine: 1, forage: 1 },
    researchSlots: RESEARCH_QUEUE_BASE,
    researchSpeed: 1,
    carryBonus: 0,
    storage: 1,
    cropSpeed: 1,
    soil: 1,
    queueSlots: 0,
    rules: { build: 1, craft: 1, travellers: 1, prices: 1, fight: 1, guard: 1, day: 1, night: 1 },
    quality: 0,
    powerRecharge: 1,
    powerLasts: 1,
    careHeal: 1,
    careBleed: 1,
    careFeet: 1,
  };
  for (const id of r.done) {
    for (const e of TOPIC_BY_ID[id]?.effects ?? []) {
      switch (e.type) {
        case 'gatherSpeed':
          m.gather[e.anim] *= e.mult;
          break;
        case 'researchSlots':
          m.researchSlots += e.add;
          break;
        case 'researchSpeed':
          m.researchSpeed *= e.mult;
          break;
        case 'carry':
          m.carryBonus += e.add;
          break;
        case 'storage':
          m.storage *= e.mult;
          break;
        case 'cropSpeed':
          m.cropSpeed *= e.mult;
          break;
        case 'soil':
          m.soil *= e.mult;
          break;
        case 'queueSlots':
          m.queueSlots += e.add;
          break;
        case 'rule':
          m.rules[e.rule] *= e.mult;
          break;
        case 'quality':
          m.quality += e.add;
          break;
        case 'powers':
          m.powerRecharge *= e.recharge;
          m.powerLasts *= e.lasts ?? 1;
          break;
        case 'care':
          m.careHeal *= e.heal ?? 1;
          m.careBleed *= e.bleed ?? 1;
          m.careFeet *= e.feet ?? 1;
          break;
        case 'eraCapstone':
          break;
      }
    }
  }
  return m;
}

const cached = new WeakMap<readonly string[], { n: number; m: Modifiers }>();

/** modifiers(), remembered until another topic is finished (for the levers asked for every tick). Don't change it. */
export function researchMods(r: Pick<ResearchState, 'done'>): Modifiers {
  const hit = cached.get(r.done);
  if (hit && hit.n === r.done.length) return hit.m;
  const m = modifiers(r);
  cached.set(r.done, { n: r.done.length, m });
  return m;
}

/** Whether a topic belongs to another origin's heritage (and so is never studied or shown here). */
export const foreignHeritage = (id: string, origin: OriginId | undefined) => {
  const o = TOPIC_BY_ID[id]?.origin;
  return !!o && o !== (origin ?? 'settlers');
};

export interface QueueCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether a topic's prerequisites are met (done, or queued ahead of it) and its era has come. Ignores
 * queue space. A capstone's "n other topics" counts only topics of its own era.
 */
export function prereqsMet(r: ResearchState, id: string, era: Era = 'neolithic', origin?: OriginId, seat?: number): QueueCheck {
  const t = TOPIC_BY_ID[id];
  if (!t) return { ok: false, reason: 'Unknown topic' };
  const need = seatNeeded(id);
  if (seat !== undefined && seat < need) return { ok: false, reason: `Needs the seat raised to its ${ERA_NAMES[SEAT_ERAS[need - 1]]} stage` };
  if (foreignHeritage(id, origin)) return { ok: false, reason: 'Another people\'s heritage' };
  if (forgone(id, origin)) return { ok: false, reason: 'Not studied by your people' };
  if (t.hidden && !(r.revealed ?? []).includes(t.id)) return { ok: false, reason: 'Undiscovered' };
  if (!eraReached(era, t.era)) return { ok: false, reason: `Opens in the ${ERA_NAMES[t.era!]} era` };
  // (a topic this people never studies stands as met for what comes after it)
  const missing = t.prereqs.filter((p) => !r.done.includes(p) && !r.queue.includes(p) && !forgone(p, origin));
  if (missing.length) return { ok: false, reason: `Needs ${missing.map((p) => topicName(p, origin)).join(', ')}` };
  if (t.requiresCount) {
    const sameEra = (d: string) => (TOPIC_BY_ID[d]?.era ?? 'neolithic') === (t.era ?? 'neolithic');
    const others = r.done.filter((d) => !t.prereqs.includes(d) && sameEra(d)).length;
    if (others < t.requiresCount) return { ok: false, reason: `Needs ${t.requiresCount} other topics researched (${others} so far)` };
  }
  return { ok: true };
}

/** Whether a topic can be added to the queue (prerequisites may be queued ahead of it). */
export function canQueue(r: ResearchState, id: string, era: Era = 'neolithic', origin?: OriginId, seat?: number): QueueCheck {
  if (r.done.includes(id)) return { ok: false, reason: 'Already researched' };
  if (r.queue.includes(id)) return { ok: false, reason: 'Already queued' };
  const pre = prereqsMet(r, id, era, origin, seat);
  if (!pre.ok) return pre;
  if (r.queue.length >= modifiers(r).researchSlots) return { ok: false, reason: 'Research queue is full' };
  return { ok: true };
}

export function queueResearch(r: ResearchState, id: string, era: Era = 'neolithic', origin?: OriginId, seat?: number): QueueCheck {
  const check = canQueue(r, id, era, origin, seat);
  if (check.ok) r.queue.push(id);
  return check;
}

/** Remove a topic from the queue, along with anything queued that depends on it. The player's removal (`byHand`)
 *  shelves them, so the planner doesn't put them straight back. */
export function cancelResearch(r: ResearchState, id: string, byHand = false): void {
  if (!r.queue.includes(id)) return;
  const drop = new Set([id]);
  for (const q of r.queue) if (TOPIC_BY_ID[q].prereqs.some((p) => drop.has(p))) drop.add(q);
  r.queue = r.queue.filter((q) => !drop.has(q));
  if (r.picked) r.picked = r.picked.filter((q) => !drop.has(q));
  if (byHand) r.shelved = [...new Set([...(r.shelved ?? []), ...drop])];
}

/** Move a topic to the front of the queue, if its prerequisites are all done. (Behind the player's picks, if it
 *  isn't one.) */
export function researchNext(r: ResearchState, id: string): void {
  const i = r.queue.indexOf(id);
  if (i <= 0) return;
  if (!TOPIC_BY_ID[id].prereqs.every((p) => r.done.includes(p))) return;
  r.queue.splice(i, 1);
  r.queue.unshift(id);
  if (!(r.picked ?? []).includes(id)) orderQueue(r);
}

/** The seat's stage (data/seats.ts) a topic waits on: its era's (Stone Age 1, Medieval 2...). */
export const seatNeeded = (id: string): number => Math.max(1, SEAT_ERAS.indexOf(TOPIC_BY_ID[id]?.era ?? 'neolithic') + 1);

/** The stage the town's seat stands at, for the research gate; undefined (no gate) for a town without one, or with
 *  every topic unlocked. */
export function seatStageNow(s: GameState): number | undefined {
  if (s.cheats?.unlockAll) return undefined;
  const seat = seatOf(s.buildings);
  if (!seat) return undefined;
  const stage = SEAT_STAGE[seat.def]?.stage ?? 1;
  // (being rebuilt, it stands at the stage before)
  return Math.max(1, seat.status === 'done' ? stage : stage - 1);
}

/** The player's picks first, in their order (each after its own picked prerequisites), then the town's own. */
function orderQueue(r: ResearchState): void {
  // (each topic once: a repeat in either list is dropped)
  const picked = [...new Set(r.picked ?? [])].filter((id) => r.queue.includes(id));
  r.picked = picked;
  const out: string[] = [];
  const put = (id: string) => {
    if (out.includes(id)) return;
    for (const p of TOPIC_BY_ID[id].prereqs) if (picked.includes(p)) put(p);
    out.push(id);
  };
  for (const id of picked) put(id);
  r.queue = [...new Set([...out, ...r.queue])];
}

/** The player picks a topic by hand: queued ahead of the town's own choices (any of its prerequisites already queued
 *  are picked with it, so they come first). With the queue full, the last of the town's own choices makes room. */
export function pickResearch(r: ResearchState, id: string, era: Era = 'neolithic', origin?: OriginId, seat?: number): QueueCheck {
  if (r.done.includes(id)) return { ok: false, reason: 'Already researched' };
  if ((r.picked ?? []).includes(id)) return { ok: false, reason: 'Already picked' };
  const pre = prereqsMet(r, id, era, origin, seat);
  if (!pre.ok) return pre;
  const chain: string[] = [];
  const add = (q: string) => {
    if (chain.includes(q) || r.done.includes(q)) return;
    for (const p of TOPIC_BY_ID[q].prereqs) if (r.queue.includes(p)) add(p);
    chain.push(q);
  };
  add(id);
  const picked = r.picked ?? [];
  const slots = modifiers(r).researchSlots;
  // (full of the player's own picks: one must go first)
  if (new Set([...picked, ...chain]).size > slots) return { ok: false, reason: 'Research queue is full' };
  r.picked = [...picked, ...chain.filter((q) => !picked.includes(q))];
  if (!r.queue.includes(id)) r.queue.push(id);
  r.shelved = (r.shelved ?? []).filter((q) => !chain.includes(q));
  orderQueue(r);
  // (room made: the town's own choices from the back, and whatever of theirs depended on them)
  while (r.queue.length > slots) {
    const last = [...r.queue].reverse().find((q) => !r.picked!.includes(q));
    if (!last) break;
    cancelResearch(r, last);
  }
  return { ok: true };
}

/** Move one of the player's picks a place earlier (-1) or later (1) among the picks; never ahead of its own
 *  prerequisites, never behind what needs it. */
export function moveResearch(r: ResearchState, id: string, dir: -1 | 1): void {
  const picked = r.picked ?? [];
  const i = picked.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= picked.length) return;
  const [a, b] = dir < 0 ? [picked[j], id] : [id, picked[j]];
  // (b would come before a: not if b needs a)
  if (TOPIC_BY_ID[b].prereqs.includes(a)) return;
  picked[i] = picked[j];
  picked[j] = id;
  orderQueue(r);
}

/** Finished topics leave the picks too. */
export function tidyPicks(r: ResearchState): void {
  if (r.picked?.length) r.picked = r.picked.filter((q) => r.queue.includes(q));
}

/** Every place research can happen, best first: each finished research station (the campfire among them). One person
 *  studies at each at a time. */
export function researchStations(s: GameState): { buildingId: number; label: string; mult: number }[] {
  return s.buildings
    .filter((b) => b.status === 'done' && RESEARCH_STATIONS[b.def])
    .map((b) => ({ buildingId: b.id, label: RESEARCH_STATIONS[b.def].label, mult: RESEARCH_STATIONS[b.def].mult }))
    .sort((a, b) => b.mult - a.mult || a.buildingId - b.buildingId);
}

/** Who's studying at a station (or at the camp, for null), if anyone, besides `except`. */
export function studyingAt(s: GameState, station: number | null, except?: Person): Person | undefined {
  return s.people.find((q) => q !== except && q.away === null && q.task?.type === 'research' && q.task.station === station);
}

/** The best station nobody's studying at: a building id, null for the camp (only when the town has no station at all),
 *  or undefined when every one is taken. */
export function freeStation(s: GameState, p: Person): number | null | undefined {
  const all = researchStations(s);
  if (!all.length) return studyingAt(s, null, p) ? undefined : null;
  return all.find((st) => !studyingAt(s, st.buildingId, p))?.buildingId;
}

/** What someone should study: the first topic in the queue they can start (its prerequisites learned) that nobody
 *  else is on; else, helping with the first. */
export function topicFor(s: GameState, p: Person): string | undefined {
  const r = s.research;
  const taken = new Set(s.people.filter((q) => q !== p && q.away === null && q.task?.type === 'research').map((q) => (q.task as { topic?: string }).topic));
  const ready = r.queue.filter((id) => TOPIC_BY_ID[id]?.prereqs.every((pre) => r.done.includes(pre)));
  return ready.find((id) => !taken.has(id)) ?? ready[0] ?? r.queue[0];
}

/** Where research happens: the best finished research station, else the camp. */
export function researchStation(s: GameState): { buildingId: number | null; label: string; mult: number } {
  let best: { buildingId: number | null; label: string; mult: number } = { buildingId: null, label: 'camp', mult: 1 };
  for (const b of s.buildings) {
    const st = RESEARCH_STATIONS[b.def];
    if (b.status === 'done' && st && (best.buildingId === null || st.mult > best.mult)) best = { buildingId: b.id, label: st.label, mult: st.mult };
  }
  return best;
}
