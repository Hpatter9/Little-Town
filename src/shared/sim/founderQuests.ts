// Leading a trip yourself (step 4 of playing the founder). "Lead it yourself" on a quest or hunt offer raises a party with
// the founder at its head (sim/muster.ts) and sends it. On a trip the founder is on, every road question that has choices
// waits for the player, with no timer and no default, and the game is held until it is answered (`waitingOnFounder`,
// checked in the step).

import { dealStands } from './founderDealings';
import { HUNT_DEST } from './hunts';
import { addMember, askable, cancelMuster, makeLeader, raiseParty, sendMuster, dropMember } from './muster';
import { mostFor } from './parties';
import { destinationOf, type SendCheck } from './expeditions';
import { acceptQuest, type QuestSort } from './questBoard';
import { notify, type Expedition, type GameState, type Prompt } from './state';

/** Is the founder on this trip (leading it or along)? */
export const founderGoes = (s: GameState, e: Expedition): boolean => e.members.includes(s.mainId);

/** A road question for a trip the founder is on waits as long as it takes: no timer, no default. */
export function holdForFounder(s: GameState, e: Expedition, prompt: Prompt): void {
  if (!founderGoes(s, e)) return;
  prompt.waits = true;
  prompt.expiresTick = Number.MAX_SAFE_INTEGER;
}

/** Is the game held for an answer from the founder? A question whose trip is gone (called home, all lost) is dropped. */
export function waitingOnFounder(s: GameState): boolean {
  let waiting = false;
  const dropped: Prompt[] = [];
  for (const p of s.prompts) {
    if (!p.waits) continue;
    if (p.deal) {
      if (dealStands(s, p)) waiting = true;
      else dropped.push(p);
      continue;
    }
    if (p.expedition === null) {
      waiting = true; // (a dispute, a challenge or a trial for the founder: it waits until it is answered)
      continue;
    }
    const e = s.expeditions.find((x) => x.id === p.expedition && x.prompt === p.id);
    if (e && founderGoes(s, e)) waiting = true;
    else p.waits = undefined;
  }
  if (dropped.length) s.prompts = s.prompts.filter((p) => !dropped.includes(p));
  return waiting;
}

/** Where a quest or hunt offer sends a party. */
function destOf(s: GameState, sort: QuestSort, id: number): string | null {
  if (sort === 'quest') return (s.quests ?? []).find((q) => q.id === id)?.dungeon ?? null;
  return (s.hunts ?? []).some((h) => h.id === id) ? `${HUNT_DEST}${id}` : null;
}

/** Take up a quest or hunt and go for it at the head of a party. */
export function leadQuest(s: GameState, sort: QuestSort, id: number): SendCheck {
  const dest = destOf(s, sort, id);
  if (!dest) return { ok: false, reason: 'No such quest' };
  const f = s.people.find((p) => p.id === s.mainId);
  if (!f || !askable(s).includes(f)) return { ok: false, reason: `${f?.name ?? 'The founder'} can't go just now` };
  if (s.muster) return { ok: false, reason: 'A party is already being raised' };
  const d = destinationOf(s, dest);
  if (!d) return { ok: false, reason: 'Not on the board' };
  const raised = raiseParty(s, dest);
  if (!raised.ok) return raised;
  const m = s.muster!;
  if (!m.members.includes(f.id)) {
    // (the founder takes the place of the last one picked, if the party is full)
    if (m.members.length >= mostFor(s, d)) dropMember(s, m.members[m.members.length - 1]);
    const added = addMember(s, f.id);
    if (!added.ok) {
      cancelMuster(s);
      return added;
    }
  }
  makeLeader(s, f.id);
  const sent = sendMuster(s);
  if (!sent.ok) {
    cancelMuster(s);
    return sent;
  }
  // (it is taken up now, so the clock runs)
  if (sort === 'quest' ? (s.quests ?? []).some((q) => q.id === id && q.accepted === undefined) : (s.hunts ?? []).some((h) => h.id === id && h.accepted === undefined)) acceptQuest(s, sort, id);
  notify(s, `${f.name} leads the party themselves.`);
  return { ok: true };
}
