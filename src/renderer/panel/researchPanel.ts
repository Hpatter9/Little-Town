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
import { forgone, laneName, studyPace, topicName } from '../../shared/data/originResearch';

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
  const lastSent = new Map<string, number>();
  const send = (type: 'queueResearch' | 'cancelResearch', topic: string) => {
    const key = `${type}:${topic}`;
    const now = Date.now();
    if (now - (lastSent.get(key) ?? 0) < 600) return;
    lastSent.set(key, now);
    bridge?.command({ type, topic });
  };
  const move = (topic: string, dir: -1 | 1) => bridge?.command({ type: 'moveResearch', topic, dir });
  const out: HTMLElement[] = [];
  const toggle = (id: string) => {
    selected = selected === id ? null : id;
    rerender();
  };

  // Studying now: the topic at the front, and how far it is
  out.push(el('h2', '', 'Studying now'));
  if (s.why?.research) out.push(el('div', 'why-line', s.why.research));
  const [first, ...rest] = r.queue;
  if (!first) out.push(el('div', 'empty', 'Nothing to study for now. More opens with the next era, and the next era can wait on an expedition.'));
  else {
    const p = r.progress[first] ?? 0;
    const now = el('div', 'rs-now');
    const top = el('div', 'rs-top');
    const name = el('span', 'rs-name tappable', `${nameOf(s, first)} ${selected === first ? '▾' : '▸'}`);
    name.addEventListener('click', () => toggle(first));
    top.append(name, el('span', 'queue-time', `${Math.floor(p * 100)}% · ${duration(remaining(s, TOPIC_BY_ID[first]))} left`));
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(p * 100)}%`;
    bar.append(fill);
    now.append(top, bar);
    const who = r.stations.filter((st) => st.who && st.topic === nameOf(s, first)).map((st) => st.who);
    now.append(el('div', 'hint', who.length ? `Being studied by ${who.join(', ')}` : 'Waiting for someone to sit down and study it'));
    out.push(now);
    if (selected === first) out.push(card(TOPIC_BY_ID[first], s, bridge));
  }
  if (r.seat) out.push(el('div', r.seat.next && !r.seat.building ? 'lock' : 'hint', seatLine(r.seat)));

  // The queue: in order, with clear buttons
  out.push(el('h2', '', 'Studying next'));
  if (!rest.length) out.push(el('div', 'empty', 'Nothing else queued: the town will choose, or add a topic from the list below.'));
  rest.forEach((id, i) => {
    const pick = r.picked.indexOf(id);
    const open = selected === id;
    const row = el('div', pick >= 0 ? 'rs-row picked' : 'rs-row');
    const name = el('span', 'rs-name tappable', `${i + 2}. ${pick >= 0 ? '✋ ' : ''}${nameOf(s, id)} ${open ? '▾' : '▸'}`);
    name.addEventListener('click', () => toggle(id));
    const btns = el('div', 'rs-btns');
    if (pick >= 0) {
      btns.append(button('▲', () => move(id, -1), { cls: 'rs-btn', title: 'Earlier', disabled: pick === 0 }), button('▼', () => move(id, 1), { cls: 'rs-btn', title: 'Later', disabled: pick >= r.picked.length - 1 }));
    } else {
      btns.append(button('✋ First', () => send('queueResearch', id), { cls: 'rs-btn', title: 'Make it your pick: it goes first' }));
    }
    btns.append(button('✕', () => send('cancelResearch', id), { cls: 'rs-btn', title: 'Remove it from the queue (progress is kept)' }));
    row.append(name, el('span', 'queue-time', `${duration(remaining(s, TOPIC_BY_ID[id]))}${pick >= 0 ? ' · your pick' : ' · the town\'s choice'}`), btns);
    out.push(row);
    if (open) out.push(card(TOPIC_BY_ID[id], s, bridge));
  });
  out.push(el('div', 'hint', `Queue ${r.queue.length}/${r.slots}. The ✋ picks are studied first, in your order. The town fills the rest itself.`));

  // Next to study: everything that could be added, by line
  const era = s.unlockAll ? 'space' : s.era;
  const rs = rsOf(s);
  const addable = TOPICS.filter((t) => !r.done.includes(t.id) && !r.queue.includes(t.id) && prereqsMet(rs, t.id, era, s.origin.id, r.seat?.stage).ok);
  out.push(el('h2', '', 'Next to study'));
  if (!addable.length) out.push(el('div', 'empty', 'Nothing new to add right now.'));
  const full = r.picked.length >= r.slots;
  const lines = new Map<string, Topic[]>();
  for (const t of addable) lines.set(laneName(t.branch, s.origin.id), [...(lines.get(laneName(t.branch, s.origin.id)) ?? []), t]);
  for (const [line, topics] of lines) {
    out.push(el('div', 'rs-line', line));
    for (const t of topics) {
      const row = el('div', 'rs-row');
      const name = el('span', 'rs-name tappable', `${nameOf(s, t.id)} ${selected === t.id ? '▾' : '▸'}`);
      name.addEventListener('click', () => toggle(t.id));
      const unlocks = unlocksOf(t);
      const info = el('span', 'rs-info', `~${duration(remaining(s, t))}${unlocks ? ` · ${unlocks}` : ''}`);
      info.title = unlocks;
      row.append(name, info, button('+ Add', () => send('queueResearch', t.id), { cls: 'rs-btn wide', title: full ? 'Your picks fill the queue' : 'Study it first', disabled: full }));
      out.push(row);
      if (selected === t.id) out.push(card(t, s, bridge));
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

  // the tech tree (techTree.ts), and the card of the topic tapped in it
  out.push(el('h2', '', 'Tech tree'));
  out.push(el('div', 'hint', 'Green is learned, gold being studied, lit what can be studied next. Tap a topic for more.'));
  out.push(
    renderTree(s, selected, (id) => {
      selected = selected === id ? null : id;
      rerender();
    }),
  );
  // (a topic listed above has its card open there already)
  if (selected && TOPIC_BY_ID[selected] && !r.queue.includes(selected) && !addable.some((o) => o.id === selected)) out.push(card(TOPIC_BY_ID[selected], s, bridge));
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

/** A topic's card (the tree's, the queue's, and the one a tapped topic name opens: infoCards.ts). */
export function topicCard(t: Topic, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  return card(t, s, bridge);
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
    if (queuedAt >= 0) c.append(el('div', 'lock', `In queue (#${queuedAt + 1})${picked ? ': your pick' : ': the town\'s choice'}`));
    else if (check.ok || available) c.append(el('div', 'lock', 'Can be studied: the town will get to it, or add it yourself'));
    else if (t.requiresCount) c.append(el('div', 'lock short', check.reason ?? '')); // "(n so far)"; other missing prereqs are listed above
    else if (pre.reason?.startsWith('Opens')) c.append(el('div', 'lock short', pre.reason));
    // (picking by hand: first in the queue)
    if (!picked && available) c.append(button('✋ Study this first', () => bridge?.command({ type: 'queueResearch', topic: t.id }), { cls: 'place' }));
    if (picked) c.append(button('Remove from the queue', () => bridge?.command({ type: 'cancelResearch', topic: t.id }), { cls: 'place small' }));
  }
  const p = r.progress[t.id];
  if (!done && queuedAt < 0 && p) c.append(el('div', 'lock', `${Math.floor(p * 100)}% done earlier`));
  return c;
}
