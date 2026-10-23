// The founder card's "Now" line: what the founder is doing this moment, in plain words with an icon, and the order
// they're set to when it isn't what they're doing just now ("Set to: working at woodcutting for the day"). The words
// come from the snapshot: the person's own `doing` (sim/snapshot.ts `describe`, the same line the tap card shows), the
// trip they're on, and the founder's order. Pure, so the tests can call it.

import type { MusterView } from '../../shared/sim/muster';
import type { FounderView, PersonView } from '../../shared/sim/snapshot';

export interface FounderNow {
  icon: string;
  now: string;
  /** The order they're set to, when it differs from what they're doing (null: none, or it's what they're doing). */
  set: string | null;
}

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** The trip in words: "Leading a party: The Lost Shrine (day 2 of 4)", or "... (3 hours left)" on a short one. */
function tripLine(t: NonNullable<FounderView['trip']>): string {
  const how = t.days > 1 ? `day ${t.day} of ${t.days}` : `${t.hoursLeft} hour${t.hoursLeft === 1 ? '' : 's'} left`;
  const leg = t.phase === 'out' ? 'on the road' : t.phase === 'back' ? 'heading home' : 'there';
  const what = t.fighting ? 'fighting' : t.waiting ? 'waiting on your answer' : leg;
  return `${t.leads ? 'Leading a party' : 'With a party'}: ${t.name} (${how}, ${what})`;
}

/** What the founder is doing now and what they're set to. */
export function founderNow(f: PersonView, v: FounderView, muster: MusterView | null = null): FounderNow {
  const now = ((): { icon: string; now: string } => {
    if (f.downed === 'bleeding') return { icon: '🩸', now: 'Down and bleeding: someone must tend them' };
    if (f.downed === 'recovering') return { icon: '🩹', now: `Recovering from wounds: ${lower(f.doing)}` };
    if (v.trip) return { icon: v.trip.fighting ? '⚔️' : '🧭', now: tripLine(v.trip) };
    if (f.away !== null) return { icon: '🧭', now: `Away: ${f.away}` };
    if (f.activity === 'fight') return { icon: '⚔️', now: f.doing };
    if (f.activity === 'sleep') return { icon: '💤', now: f.doing };
    if (f.activity === 'walk') return { icon: '🚶', now: f.doing };
    return { icon: '▶️', now: f.doing };
  })();
  const raising = muster && (muster.leader === v.id || muster.members.some((m) => m.id === v.id)) ? `raising a party for ${muster.place}` : null;
  let set: string | null = v.order ? lower(v.order) : raising;
  // (the same thing in other words: walking where they were sent, asleep on a rest, exploring the way they were sent)
  if (set && now.now.toLowerCase() === set.toLowerCase()) set = null;
  if (v.orderKind === 'rest' && f.activity === 'sleep' && !f.downed) set = null;
  if (v.orderKind === 'explore' && now.now.startsWith('Exploring')) set = null;
  return { ...now, set };
}
