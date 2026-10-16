// Plays an event card's scene (eventScenes.ts) with the town's own people in it: the cast from eventCast.ts dressed
// as their paper dolls, and the outsiders the event brings (strangers, a herald, a priest, a merchant) dressed from a
// look drawn on the event's own id, so the same card always shows the same faces.

import { randomLook } from '../../shared/data/people';
import type { ClassId } from '../../shared/data/classes';
import { hashSeed, Rng } from '../../shared/rng';
import type { PersonView, PromptView, Snapshot } from '../../shared/sim/snapshot';
import { hkLayers, hkWhoOf, hkWhoOfLook } from '../art/hkFolk';
import { eventCast, SLOT } from './eventCast';
import { EVENT_SCENES, sceneFor } from './eventScenes';
import { playScene, sceneCue } from './scenePlayer';
import type { EventSceneId } from '../../shared/data/eventSceneIds';

const IDLE = { fighting: false, activity: 'idle' };
/** The outsiders' places and how each is dressed: on the road, in a knight's kit, a healer's robes. */
const OUTSIDERS: [number, { traveller?: boolean; cls?: ClassId }][] = [
  [SLOT.stranger, { traveller: true }], [SLOT.stranger2, { traveller: true }], [SLOT.stranger3, { traveller: true }],
  [SLOT.knight, { cls: 'knight' }], [SLOT.priest, { cls: 'white_mage' }], [SLOT.merchant, { traveller: true }],
];
/** The scenes whose crowd raises its hands when an answer is taken. */
const VOTES = new Set<EventSceneId>(['council', 'trial', 'revolt']);

export interface PlayedEvent {
  canvas: HTMLCanvasElement;
  /** An answer taken: the crowd votes, where the scene has one. */
  answered(): void;
}

/** Play the scene for prompt `p` into `container`. */
export function playEventScene(container: HTMLElement, p: PromptView, snap: Snapshot): PlayedEvent | null {
  const id = sceneFor({ kind: p.kind, title: p.title, text: p.text, eventId: p.eventId, about: p.about });
  const home = snap.people.filter((q) => q.away === null);
  const byId = new Map<number, PersonView>(home.map((q) => [q.id, q]));
  const founder = byId.has(snap.mainId) ? snap.mainId : (home[0]?.id ?? null);
  const lead = p.who != null && byId.has(p.who) ? p.who : null;
  const cast = eventCast(p.id, home.map((q) => ({ id: q.id, grown: q.growsUpIn === null })), lead, founder);
  const rng = new Rng(hashSeed(`outsiders:${p.id}`));
  const outsider = (n: number, o: { traveller?: boolean; cls?: ClassId }) => hkLayers(hkWhoOfLook(-1000 - n, randomLook(rng), o), IDLE);
  const doll = (pid: number | null | undefined, n: number) => {
    const q = pid != null ? byId.get(pid) : undefined;
    return q ? hkLayers(hkWhoOf(q), IDLE) : outsider(n, { traveller: true });
  };
  const dolls: string[][] = [];
  dolls[SLOT.lead] = doll(cast.lead, SLOT.lead);
  dolls[SLOT.founder] = doll(cast.founder, SLOT.founder);
  [SLOT.elder, SLOT.elder2, SLOT.elder3].forEach((at, i) => (dolls[at] = doll(cast.elders[i], at)));
  for (const [at, o] of OUTSIDERS) dolls[at] = outsider(at, o);
  cast.crowd.forEach((pid, i) => (dolls[SLOT.crowd + i] = doll(pid, SLOT.crowd + i)));
  const canvas = playScene(container, EVENT_SCENES[id], dolls);
  if (!canvas) return null;
  canvas.dataset.scene = id;
  return { canvas, answered: () => VOTES.has(id) && sceneCue(canvas, 'vote') };
}
