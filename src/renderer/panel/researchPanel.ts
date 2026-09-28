// Research panel: what's being researched, the queue, and every topic by branch.

import { BUILDINGS } from '../../shared/data/buildings';
import { ERA_NAMES, ERAS, eraReached, nextEra } from '../../shared/data/eras';
import { ITEMS } from '../../shared/data/items';
import { BRANCH_NAMES, TOPICS, TOPIC_BY_ID, type Branch, type Topic } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import { canQueue, prereqsMet } from '../../shared/sim/research';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, duration, el } from './dom';
import { topicKnown } from './secrets';

/** Changes whenever something this panel shows changes (progress to the whole percent). */
export const researchKey = (s: Snapshot) => {
  const r = s.research;
  const pct = Object.fromEntries(Object.entries(r.progress).map(([k, v]) => [k, Math.floor(v * 100)]));
  return JSON.stringify([s.era, s.unlockAll, r.done, r.revealed, r.queue, pct, r.slots, r.station, r.speed, s.plan?.research]);
};

/** Buildings and craftable items each topic unlocks, from their data. */
const BUILDINGS_BY_TOPIC = new Map<string, string[]>();
for (const b of BUILDINGS) if (b.research) BUILDINGS_BY_TOPIC.set(b.research, [...(BUILDINGS_BY_TOPIC.get(b.research) ?? []), b.name]);
for (const i of ITEMS) for (const r of i.research) BUILDINGS_BY_TOPIC.set(r, [...(BUILDINGS_BY_TOPIC.get(r) ?? []), i.name]);

const remaining = (s: Snapshot, t: Topic) => (t.seconds * (1 - (s.research.progress[t.id] ?? 0))) / s.research.speed;

export function renderResearch(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const r = s.research;
  const send = (type: 'queueResearch' | 'cancelResearch' | 'researchNext', topic: string) => bridge?.command({ type, topic });
  const out: HTMLElement[] = [];

  // Now and next
  const head = el('div', 'panel-head');
  head.append(el('span', '', `Research queue ${r.queue.length}/${r.slots}`), el('span', '', `Researching at ${r.station} (×${r.stationMult})`));
  out.push(head);
  const queue = el('div', 'queue');
  if (!r.queue.length) queue.append(el('div', 'empty', 'Nothing left to study for now. Some research waits on the next era (and the next era can wait on an expedition).'));
  r.queue.forEach((id, i) => {
    const t = TOPIC_BY_ID[id];
    const p = r.progress[id] ?? 0;
    const row = el('div', 'queue-row');
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(p * 100)}%`;
    bar.append(fill);
    row.append(el('span', 'queue-name', `${i + 1}. ${t.name}`), bar, el('span', 'queue-time', `${Math.floor(p * 100)}% · ${duration(remaining(s, t))} left`));
    const canGoNext = i > 0 && t.prereqs.every((q) => r.done.includes(q));
    if (canGoNext) row.append(button('Do next', () => send('researchNext', id), { cls: 'place small' }));
    row.append(button('Cancel', () => send('cancelResearch', id), { cls: 'place small', title: 'Progress is kept if you queue it again' }));
    queue.append(row);
  });
  out.push(queue);

  // Every topic of the eras reached (newest era first), by branch
  const era = s.unlockAll ? 'space' : s.era;
  const eras = ERAS.filter((e) => eraReached(era, e) && TOPICS.some((t) => (t.era ?? 'neolithic') === e)).reverse();
  for (const e of eras) {
    const topics = TOPICS.filter((t) => (t.era ?? 'neolithic') === e && topicKnown(s, t.id));
    if (eras.length > 1) out.push(el('h1', 'era-head', `${ERA_NAMES[e]} era${topics.every((t) => r.done.includes(t.id)) ? ' (all researched)' : ''}`));
    const branches = [...new Set(topics.map((t) => t.branch))] as Branch[];
    for (const branch of branches) {
      out.push(el('h2', '', BRANCH_NAMES[branch]));
      const grid = el('div', 'cards');
      for (const t of topics.filter((q) => q.branch === branch)) grid.append(card(t, s));
      out.push(grid);
    }
  }
  const next = nextEra(era);
  if (next && TOPICS.some((t) => t.era === next)) out.push(el('div', 'hint', `More research opens in the ${ERA_NAMES[next]} era.`));
  return out;
}

function card(t: Topic, s: Snapshot): HTMLElement {
  const r = s.research;
  const done = r.done.includes(t.id);
  const queuedAt = r.queue.indexOf(t.id);
  const rs = { done: r.done, queue: r.queue, progress: r.progress };
  const era = s.unlockAll ? 'space' : s.era;
  const check = canQueue(rs, t.id, era);
  const available = prereqsMet(rs, t.id, era).ok;
  const c = el('div', done ? 'card done' : !available && queuedAt < 0 ? 'card locked' : 'card');

  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', t.name), el('span', 'card-size', done ? 'Researched' : `~${duration(remaining(s, t))}`));
  c.append(top);

  const unlocks = [...(BUILDINGS_BY_TOPIC.get(t.id) ?? []), ...(t.unlocks ? [t.unlocks] : [])].join(', ');
  if (unlocks) c.append(el('div', 'purpose', `Unlocks: ${unlocks}`));
  if (t.prereqs.length || t.requiresCount) {
    const needs = t.prereqs.map((p) => `${r.done.includes(p) ? '✓ ' : ''}${TOPIC_BY_ID[p].name}`);
    if (t.requiresCount) needs.push(`${t.requiresCount} other topics`);
    c.append(el('div', 'lock', `Needs: ${needs.join(', ')}`));
  }
  if (!done) {
    if (queuedAt >= 0) c.append(el('div', 'lock', `In queue (#${queuedAt + 1})`));
    else if (check.ok || available) c.append(el('div', 'lock', 'Can be studied: the town will get to it'));
    else if (t.requiresCount) c.append(el('div', 'lock short', check.reason ?? '')); // "(n so far)"; other missing prereqs are listed above
  }
  const p = r.progress[t.id];
  if (!done && queuedAt < 0 && p) c.append(el('div', 'lock', `${Math.floor(p * 100)}% done earlier`));
  return c;
}
