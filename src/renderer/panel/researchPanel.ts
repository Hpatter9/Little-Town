// Research panel (the Studies menu), in two tabs: what's being studied (the topics lined up, and the stations), and the tech tree.

import { BUILDINGS } from '../../shared/data/buildings';
import { ERA_NAMES, nextEra } from '../../shared/data/eras';
import { ITEMS } from '../../shared/data/items';
import { TOPICS, TOPIC_BY_ID, type Topic } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import { TICKS_PER_HOUR } from '../../shared/sim/time';
import { prereqsMet, seatNeeded } from '../../shared/sim/research';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, duration, el } from './dom';
import { renderTree } from './techTree';
import { forgone, laneName, studyPace, topicName } from '../../shared/data/originResearch';

/** Changes whenever something this panel shows changes (progress to the whole percent). */
export const researchKey = (s: Snapshot) => {
  const r = s.research;
  const pct = Object.fromEntries(Object.entries(r.progress).map(([k, v]) => [k, Math.floor(v * 100)]));
  return JSON.stringify([selected, s.era, s.unlockAll, r.done, r.revealed, r.queue, r.offer, Math.ceil(r.offerLeft / TICKS_PER_HOUR), r.seat, pct, r.slots, r.station, r.stations, r.speed, s.plan?.research]);
};

/** Buildings and craftable items each topic unlocks, from their data. */
const BUILDINGS_BY_TOPIC = new Map<string, string[]>();
for (const b of BUILDINGS) if (b.research) BUILDINGS_BY_TOPIC.set(b.research, [...(BUILDINGS_BY_TOPIC.get(b.research) ?? []), b.name]);
for (const i of ITEMS) for (const r of i.research) BUILDINGS_BY_TOPIC.set(r, [...(BUILDINGS_BY_TOPIC.get(r) ?? []), i.name]);

/** What a topic unlocks, in one short line. */
const unlocksOf = (t: Topic) => [...(BUILDINGS_BY_TOPIC.get(t.id) ?? []), ...(t.unlocks ? [t.unlocks] : [])].join(', ');

const remaining = (s: Snapshot, t: Topic) => (t.seconds * studyPace(t.id, s.origin.id) * (1 - (s.research.progress[t.id] ?? 0))) / s.research.speed;
/** A topic by the town's own people's name for it (data/originResearch.ts). */
const nameOf = (s: Snapshot, id: string) => topicName(id, s.origin.id);

/** The topic tapped in the tree (its card shows under it). */
let selected: string | null = null;

export function renderResearch(s: Snapshot, bridge: Bridge | undefined, rerender: () => void = () => {}): HTMLElement[] {
  const r = s.research;
  // (a double tap, or one tap sent twice, must not do the thing twice)
  let sentAt = 0;
  const study = (topic: string) => {
    const now = Date.now();
    if (now - sentAt < 600) return;
    sentAt = now;
    bridge?.command({ type: 'studyOffer', topic });
  };
  const out: HTMLElement[] = [];
  const toggle = (id: string) => {
    selected = selected === id ? null : id;
    rerender();
  };

  // Studying now: what's under way, and how far it is
  out.push(el('h2', '', 'Studying now'));
  if (s.why?.research) out.push(el('div', 'why-line', s.why.research));
  if (!r.queue.length) out.push(el('div', 'empty', r.offer.length ? 'Nothing under way: choose a topic below.' : 'Nothing to study for now. More opens with the next era, and the next era can wait on an expedition.'));
  for (const id of r.queue) {
    const p = r.progress[id] ?? 0;
    const now = el('div', 'rs-now');
    const top = el('div', 'rs-top');
    const name = el('span', 'rs-name tappable', `${nameOf(s, id)} ${selected === id ? '▾' : '▸'}`);
    name.addEventListener('click', () => toggle(id));
    top.append(name, el('span', 'queue-time', `${Math.floor(p * 100)}% · ${duration(remaining(s, TOPIC_BY_ID[id]))} left`));
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(p * 100)}%`;
    bar.append(fill);
    now.append(top, bar);
    const who = r.stations.filter((st) => st.who && st.topic === nameOf(s, id)).map((st) => st.who);
    now.append(el('div', 'hint', who.length ? `Being studied by ${who.join(', ')}` : 'Waiting for someone to sit down and study it'));
    out.push(now);
    if (selected === id) out.push(card(TOPIC_BY_ID[id], s));
  }
  if (r.seat) out.push(el('div', r.seat.next && !r.seat.building ? 'lock' : 'hint', seatLine(r.seat)));

  // Choose: three topics on offer, one to be studied
  if (r.offer.length) {
    out.push(el('h2', '', 'Choose a topic'));
    const hours = Math.max(1, Math.ceil(r.offerLeft / TICKS_PER_HOUR));
    out.push(el('div', 'hint', r.offerLeft > 0 ? `Tap Study on one. If you don't, the town chooses in about ${hours === 1 ? 'an hour' : `${hours} hours`}.` : 'The town is about to choose.'));
    for (const id of r.offer) {
      const t = TOPIC_BY_ID[id];
      const box = el('div', 'rs-offer');
      const top = el('div', 'rs-top');
      const name = el('span', 'rs-name tappable', `${nameOf(s, id)} ${selected === id ? '▾' : '▸'}`);
      name.addEventListener('click', () => toggle(id));
      top.append(name, el('span', 'queue-time', `~${duration(remaining(s, t))}`));
      box.append(top, el('div', 'rs-line', laneName(t.branch, s.origin.id)));
      const unlocks = unlocksOf(t);
      box.append(el('div', 'rs-info wrap', unlocks ? `Unlocks: ${unlocks}` : 'Makes the town better at what it already does.'));
      box.append(button('Study', () => study(id), { cls: 'rs-btn wide study' }));
      out.push(box);
      if (selected === id) out.push(card(t, s));
    }
  }

  // Stations: where it's studied
  out.push(el('h2', '', 'Stations'));
  for (const st of r.stations) {
    const row = el('div', 'queue-row');
    row.append(el('span', 'queue-name', `${st.label} ×${st.mult}`), el('span', 'queue-time', st.who ? `${st.who}${st.topic ? `: ${st.topic}` : ''}` : 'free'));
    out.push(row);
  }
  out.push(el('div', 'hint', `${r.stations.filter((st) => st.who).length}/${r.stations.length} in use. One person studies at each station at a time.`));

  // All topics: the tech tree (techTree.ts), to browse; and the card of the topic tapped in it
  const era = s.unlockAll ? 'space' : s.era;
  out.push(el('h2', '', 'All topics'));
  out.push(el('div', 'hint', 'To browse only. Green is learned, gold being studied. Tap a topic for more.'));
  out.push(renderTree(s, selected, toggle));
  // (a topic shown above has its card open there already)
  if (selected && TOPIC_BY_ID[selected] && !r.queue.includes(selected) && !r.offer.includes(selected)) out.push(card(TOPIC_BY_ID[selected], s));
  const next = nextEra(era);
  if (next && TOPICS.some((t) => t.era === next)) out.push(el('div', 'hint', `More research opens in the ${ERA_NAMES[next]} era.`));
  return out;
}

const rsOf = (s: Snapshot) => ({ done: s.research.done, queue: s.research.queue, progress: s.research.progress, revealed: s.research.revealed });

/** What the seat holds back (sim/research.ts: a topic of an age waits on the seat raised to that age's stage). */
function seatLine(seat: NonNullable<Snapshot['research']['seat']>): string {
  if (seat.building) return `🏛 The seat is being rebuilt as the ${seat.next ?? 'next stage'}: the new age's studies open when it stands.`;
  if (!seat.next) return `🏛 The seat stands at its last stage: ${seat.name}.`;
  return `🏛 The seat is the ${seat.name}. Studies of the ${seat.nextEra} age wait until it is raised to the ${seat.next}.`;
}

/** A topic's card (the tree's, the queue's, and the one a tapped topic name opens: infoCards.ts). */
export function topicCard(t: Topic, s: Snapshot, _bridge?: Bridge): HTMLElement {
  return card(t, s);
}

function card(t: Topic, s: Snapshot): HTMLElement {
  const r = s.research;
  const done = r.done.includes(t.id);
  const queuedAt = r.queue.indexOf(t.id);
  const rs = rsOf(s);
  const era = s.unlockAll ? 'space' : s.era;
  const seat = r.seat?.stage;
  const pre = prereqsMet(rs, t.id, era, s.origin.id, seat);
  const available = pre.ok;
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

  const unlocks = unlocksOf(t);
  if (unlocks) c.append(el('div', 'purpose', `Unlocks: ${unlocks}`));
  if (t.prereqs.length || t.requiresCount) {
    const needs = t.prereqs.filter((p) => !forgone(p, s.origin.id)).map((p) => `${r.done.includes(p) ? '✓ ' : ''}${nameOf(s, p)}`);
    if (t.requiresCount) needs.push(`${t.requiresCount} other topics`);
    c.append(el('div', 'lock', `Needs: ${needs.join(', ')}`));
  }
  const needSeat = seatNeeded(t.id);
  if (!done && r.seat && needSeat > 1) c.append(el('div', r.seat.stage >= needSeat ? 'purpose' : 'lock short', `${r.seat.stage >= needSeat ? '✓ ' : '🏛 '}Needs the seat at stage ${needSeat} (now ${r.seat.stage}: ${r.seat.name})`));
  if (!done) {
    if (queuedAt >= 0) c.append(el('div', 'lock', 'Being studied now'));
    else if (available) c.append(el('div', 'lock', 'Can be studied: it may be offered'));
    else if (t.requiresCount) c.append(el('div', 'lock short', pre.reason ?? '')); // "(n so far)"; other missing prereqs are listed above
    else if (pre.reason?.startsWith('Opens')) c.append(el('div', 'lock short', pre.reason));
  }
  const p = r.progress[t.id];
  if (!done && queuedAt < 0 && p) c.append(el('div', 'lock', `${Math.floor(p * 100)}% done earlier`));
  return c;
}
