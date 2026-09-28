// Research rules: the queue, what finished topics change, and where research happens.

import { ERA_NAMES, eraReached, type Era } from '../data/eras';
import { RESEARCH_QUEUE_BASE, RESEARCH_STATIONS, TOPIC_BY_ID } from '../data/research';
import type { WorkAnim } from '../data/terrain';
import type { GameState, Person } from './state';

export interface ResearchState {
  done: string[];
  /** Topics in the order they will be researched; the first is being worked on. */
  queue: string[];
  /** Work done so far per topic (0..1). Kept when a topic is dequeued, so cancelling loses nothing. */
  progress: Record<string, number>;
  /** Hidden topics the town has discovered. */
  revealed?: string[];
}

export interface Modifiers {
  gather: Record<WorkAnim, number>;
  researchSlots: number;
  researchSpeed: number;
  carryBonus: number;
  storage: number;
  cropSpeed: number;
  /** Extra build and craft queue slots. */
  queueSlots: number;
}

/** Combined effects of every finished topic. */
export function modifiers(r: Pick<ResearchState, 'done'>): Modifiers {
  const m: Modifiers = { gather: { chop: 1, mine: 1, forage: 1 }, researchSlots: RESEARCH_QUEUE_BASE, researchSpeed: 1, carryBonus: 0, storage: 1, cropSpeed: 1, queueSlots: 0 };
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
        case 'queueSlots':
          m.queueSlots += e.add;
          break;
        case 'eraCapstone':
          break;
      }
    }
  }
  return m;
}

export interface QueueCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Whether a topic's prerequisites are met (done, or queued ahead of it) and its era has come. Ignores
 * queue space. A capstone's "n other topics" counts only topics of its own era.
 */
export function prereqsMet(r: ResearchState, id: string, era: Era = 'neolithic'): QueueCheck {
  const t = TOPIC_BY_ID[id];
  if (!t) return { ok: false, reason: 'Unknown topic' };
  if (t.hidden && !(r.revealed ?? []).includes(t.id)) return { ok: false, reason: 'Undiscovered' };
  if (!eraReached(era, t.era)) return { ok: false, reason: `Opens in the ${ERA_NAMES[t.era!]} era` };
  const missing = t.prereqs.filter((p) => !r.done.includes(p) && !r.queue.includes(p));
  if (missing.length) return { ok: false, reason: `Needs ${missing.map((p) => TOPIC_BY_ID[p].name).join(', ')}` };
  if (t.requiresCount) {
    const sameEra = (d: string) => (TOPIC_BY_ID[d]?.era ?? 'neolithic') === (t.era ?? 'neolithic');
    const others = r.done.filter((d) => !t.prereqs.includes(d) && sameEra(d)).length;
    if (others < t.requiresCount) return { ok: false, reason: `Needs ${t.requiresCount} other topics researched (${others} so far)` };
  }
  return { ok: true };
}

/** Whether a topic can be added to the queue (prerequisites may be queued ahead of it). */
export function canQueue(r: ResearchState, id: string, era: Era = 'neolithic'): QueueCheck {
  if (r.done.includes(id)) return { ok: false, reason: 'Already researched' };
  if (r.queue.includes(id)) return { ok: false, reason: 'Already queued' };
  const pre = prereqsMet(r, id, era);
  if (!pre.ok) return pre;
  if (r.queue.length >= modifiers(r).researchSlots) return { ok: false, reason: 'Research queue is full' };
  return { ok: true };
}

export function queueResearch(r: ResearchState, id: string, era: Era = 'neolithic'): QueueCheck {
  const check = canQueue(r, id, era);
  if (check.ok) r.queue.push(id);
  return check;
}

/** Remove a topic from the queue, along with anything queued that depends on it. */
export function cancelResearch(r: ResearchState, id: string): void {
  if (!r.queue.includes(id)) return;
  const drop = new Set([id]);
  for (const q of r.queue) if (TOPIC_BY_ID[q].prereqs.some((p) => drop.has(p))) drop.add(q);
  r.queue = r.queue.filter((q) => !drop.has(q));
}

/** Move a topic to the front of the queue, if its prerequisites are all done. */
export function researchNext(r: ResearchState, id: string): void {
  const i = r.queue.indexOf(id);
  if (i <= 0) return;
  if (!TOPIC_BY_ID[id].prereqs.every((p) => r.done.includes(p))) return;
  r.queue.splice(i, 1);
  r.queue.unshift(id);
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
