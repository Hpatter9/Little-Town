// Research panel: what's being researched, the queue, and every topic by branch.

import { BUILDINGS } from '../../shared/data/buildings';
import { ERA_NAMES, nextEra } from '../../shared/data/eras';
import { ITEMS } from '../../shared/data/items';
import { TOPICS, TOPIC_BY_ID, type Topic } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import { canQueue, prereqsMet, seatNeeded } from '../../shared/sim/research';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, duration, el } from './dom';
import { renderTree } from './techTree';
import { forgone, studyPace, topicName } from '../../shared/data/originResearch';

/** Changes whenever something this panel shows changes (progress to the whole percent). */
export const researchKey = (s: Snapshot) => {
  const r = s.research;
  const pct = Object.fromEntries(Object.entries(r.progress).map(([k, v]) => [k, Math.floor(v * 100)]));
  return JSON.stringify([selected, s.era, s.unlockAll, r.done, r.revealed, r.queue, r.picked, r.shelved, r.seat, pct, r.slots, r.station, r.stations, r.speed, s.plan?.research]);
};

/** Buildings and craftable items each topic unlocks, from their data. */
const BUILDINGS_BY_TOPIC = new Map<string, string[]>();
for (const b of BUILDINGS) if (b.research) BUILDINGS_BY_TOPIC.set(b.research, [...(BUILDINGS_BY_TOPIC.get(b.research) ?? []), b.name]);
for (const i of ITEMS) for (const r of i.research) BUILDINGS_BY_TOPIC.set(r, [...(BUILDINGS_BY_TOPIC.get(r) ?? []), i.name]);

const remaining = (s: Snapshot, t: Topic) => (t.seconds * studyPace(t.id, s.origin.id) * (1 - (s.research.progress[t.id] ?? 0))) / s.research.speed;
/** A topic by the town's own people's name for it (data/originResearch.ts). */
const nameOf = (s: Snapshot, id: string) => topicName(id, s.origin.id);

/** The topic tapped in the tree (its card shows under it). */
let selected: string | null = null;

export function renderResearch(s: Snapshot, bridge: Bridge | undefined, rerender: () => void = () => {}): HTMLElement[] {
  const r = s.research;
  const send = (type: 'queueResearch' | 'cancelResearch' | 'researchNext', topic: string) => bridge?.command({ type, topic });
  const move = (topic: string, dir: -1 | 1) => bridge?.command({ type: 'moveResearch', topic, dir });
  const out: HTMLElement[] = [];

  // Now and next
  const head = el('div', 'panel-head');
  head.append(el('span', '', `Research queue ${r.queue.length}/${r.slots}`), el('span', '', `${r.stations.filter((st) => st.who).length}/${r.stations.length} stations in use`));
  out.push(head);
  const queue = el('div', 'queue');
  if (!r.queue.length) queue.append(el('div', 'empty', 'Nothing left to study for now. Some research waits on the next era (and the next era can wait on an expedition).'));
  r.queue.forEach((id, i) => {
    const t = TOPIC_BY_ID[id];
    const p = r.progress[id] ?? 0;
    const pick = r.picked.indexOf(id);
    const row = el('div', pick >= 0 ? 'queue-row picked' : 'queue-row');
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(p * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'queue-name', `${i + 1}. ${pick >= 0 ? '✋ ' : ''}${nameOf(s, id)}`), bar, el('span', 'queue-time', `${Math.floor(p * 100)}% · ${duration(remaining(s, t))} left · ${pick >= 0 ? 'your pick' : 'the town\'s choice'}`));
    if (pick >= 0) {
      // (reordered among the player's picks)
      if (pick > 0) row.append(button('▲', () => move(id, -1), { cls: 'place small', title: 'Earlier' }));
      if (pick < r.picked.length - 1) row.append(button('▼', () => move(id, 1), { cls: 'place small', title: 'Later' }));
    } else {
      row.append(button('Pick', () => send('queueResearch', id), { cls: 'place small', title: 'Make it your pick: it goes first' }));
    }
    row.append(button('Remove', () => send('cancelResearch', id), { cls: 'place small', title: 'Progress is kept if you pick it again' }));
    queue.append(row);
  });
  out.push(queue);
  out.push(el('div', 'hint', r.picked.length ? '✋ Your picks are studied first, in your order. The town fills the rest of the queue itself.' : 'The town chooses what to study. Tap a topic in the tree and Pick it to have it studied first.'));
  if (r.seat) out.push(el('div', r.seat.next && !r.seat.building ? 'lock' : 'hint', seatLine(r.seat)));

  // where it's studied: one person at each station, each on a topic of their own where there is one
  out.push(el('h2', '', 'Stations'));
  for (const st of r.stations) {
    const row = el('div', 'queue-row');
    row.append(el('span', 'queue-name', `${st.label} ×${st.mult}`), el('span', 'queue-time', st.who ? `${st.who}${st.topic ? `: ${st.topic}` : ''}` : 'free'));
    out.push(row);
  }
  out.push(el('div', 'hint', 'One person studies at each station at a time. The town builds more, and better ones, as it grows.'));

  // the tech tree (techTree.ts), and the card of the topic tapped in it
  const era = s.unlockAll ? 'space' : s.era;
  out.push(el('h2', '', 'Tech tree'));
  out.push(el('div', 'hint', 'Left to right: the eras, each branching out as it goes. Green is learned, gold being studied, lit what the town can study next. Tap a topic for more.'));
  out.push(
    renderTree(s, selected, (id) => {
      selected = selected === id ? null : id;
      rerender();
    }),
  );
  if (selected && TOPIC_BY_ID[selected]) out.push(card(TOPIC_BY_ID[selected], s, bridge));
  const next = nextEra(era);
  if (next && TOPICS.some((t) => t.era === next)) out.push(el('div', 'hint', `More research opens in the ${ERA_NAMES[next]} era.`));
  return out;
}

const rsOf = (s: Snapshot) => ({ done: s.research.done, queue: s.research.queue, progress: s.research.progress, revealed: s.research.revealed, picked: s.research.picked });

/** What the seat holds back (sim/research.ts: a topic of an age waits on the seat raised to that age's stage). */
function seatLine(seat: NonNullable<Snapshot['research']['seat']>): string {
  if (seat.building) return `🏛 The seat is being rebuilt as the ${seat.next ?? 'next stage'}: the new age's studies open when it stands.`;
  if (!seat.next) return `🏛 The seat stands at its last stage: ${seat.name}.`;
  return `🏛 The seat is the ${seat.name}. Studies of the ${seat.nextEra} age wait until it is raised to the ${seat.next}.`;
}

function card(t: Topic, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const r = s.research;
  const done = r.done.includes(t.id);
  const queuedAt = r.queue.indexOf(t.id);
  const rs = rsOf(s);
  const era = s.unlockAll ? 'space' : s.era;
  const seat = r.seat?.stage;
  const check = canQueue(rs, t.id, era, s.origin.id, seat);
  const pre = prereqsMet(rs, t.id, era, s.origin.id, seat);
  const available = pre.ok;
  const picked = r.picked.includes(t.id);
  const c = el('div', done ? 'card done' : !available && queuedAt < 0 ? 'card locked' : 'card');

  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', nameOf(s, t.id)), el('span', 'card-size', done ? 'Researched' : `~${duration(remaining(s, t))}`));
  c.append(top);
  // (a people's own name: the shared one under it, so the topic can be told from another town's; and how quickly
  // they take to it)
  if (nameOf(s, t.id) !== t.name) c.append(el('div', 'hint', `Known elsewhere as ${t.name}`));
  const pace = studyPace(t.id, s.origin.id);
  if (pace < 0.95) c.append(el('div', 'purpose', `${s.origin.name} take to this: studied ${Math.round((1 - pace) * 100)}% quicker`));
  else if (pace > 1.05) c.append(el('div', 'lock', `Foreign to ${s.origin.name}: studied ${Math.round((pace - 1) * 100)}% slower`));

  const unlocks = [...(BUILDINGS_BY_TOPIC.get(t.id) ?? []), ...(t.unlocks ? [t.unlocks] : [])].join(', ');
  if (unlocks) c.append(el('div', 'purpose', `Unlocks: ${unlocks}`));
  if (t.prereqs.length || t.requiresCount) {
    const needs = t.prereqs.filter((p) => !forgone(p, s.origin.id)).map((p) => `${r.done.includes(p) ? '✓ ' : ''}${nameOf(s, p)}`);
    if (t.requiresCount) needs.push(`${t.requiresCount} other topics`);
    c.append(el('div', 'lock', `Needs: ${needs.join(', ')}`));
  }
  const needSeat = seatNeeded(t.id);
  if (!done && r.seat && needSeat > 1) c.append(el('div', r.seat.stage >= needSeat ? 'purpose' : 'lock short', `${r.seat.stage >= needSeat ? '✓ ' : '🏛 '}Needs the seat at stage ${needSeat} (now ${r.seat.stage}: ${r.seat.name})`));
  if (!done) {
    if (queuedAt >= 0) c.append(el('div', 'lock', `In queue (#${queuedAt + 1})${picked ? ': your pick' : ': the town\'s choice'}`));
    else if (check.ok || available) c.append(el('div', 'lock', 'Can be studied: the town will get to it, or pick it'));
    else if (t.requiresCount) c.append(el('div', 'lock short', check.reason ?? '')); // "(n so far)"; other missing prereqs are listed above
    else if (pre.reason?.startsWith('Opens')) c.append(el('div', 'lock short', pre.reason));
    // (picking by hand: first in the queue)
    if (!picked && available) c.append(button('✋ Pick: study this first', () => bridge?.command({ type: 'queueResearch', topic: t.id }), { cls: 'place' }));
    if (picked) c.append(button('Remove from the queue', () => bridge?.command({ type: 'cancelResearch', topic: t.id }), { cls: 'place small' }));
  }
  const p = r.progress[t.id];
  if (!done && queuedAt < 0 && p) c.append(el('div', 'lock', `${Math.floor(p * 100)}% done earlier`));
  return c;
}
