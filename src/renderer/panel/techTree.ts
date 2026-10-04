// The tech tree (the owner's ask): the classic look, read left to right. The eras are columns, each split by how deep
// a topic sits in its era's chain of prerequisites, so the tree branches out to the right and gets more advanced as it
// goes; the branches of research are the lanes top to bottom; lines run from each prerequisite to what it opens.
// Learned topics are green, the one being studied gold, what can be studied next lit, the rest dim, and the eras the
// town hasn't reached fainter still. Tap a topic for its card (the Research tab shows it under the tree).

import { ERA_NAMES, ERAS, eraReached, type Era } from '../../shared/data/eras';
import { BRANCH_NAMES, TOPICS, type Branch, type Topic } from '../../shared/data/research';
import { foreignHeritage, prereqsMet } from '../../shared/sim/research';
import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { topicKnown } from './secrets';

const NODE_W = 96;
const NODE_H = 28;
const COL_W = 118;
const ROW_H = 34;
const LANE_PAD = 8;
/** The lane's name sits in a row of its own at its top, above the topics. */
const LANE_HEAD = 15;
const HEAD_H = 24;
const GUTTER = 12;
/** The lanes, top to bottom (the town's own heritage last). */
const LANES: readonly Branch[] = ['construction', 'agriculture', 'crafting', 'military', 'medicine', 'logistics', 'society', 'occult', 'heritage'];

/** Where the tree was scrolled to (kept across redraws, so a tap doesn't jump it). */
let scrollX: number | null = null;

const eraOf = (t: Topic): Era => t.era ?? 'neolithic';

export function renderTree(s: Snapshot, selected: string | null, onSelect: (id: string) => void): HTMLElement {
  const r = s.research;
  const era = s.unlockAll ? 'space' : s.era;
  const topics = TOPICS.filter((t) => topicKnown(s, t.id) && !foreignHeritage(t.id, s.origin.id));
  const byId = new Map(topics.map((t) => [t.id, t]));
  const rs = { done: r.done, queue: r.queue, progress: r.progress, revealed: r.revealed };

  // how deep each topic sits in its era: one step right of the deepest prerequisite of the same era
  const depth = new Map<string, number>();
  const depthOf = (t: Topic, seen = new Set<string>()): number => {
    const d = depth.get(t.id);
    if (d !== undefined) return d;
    if (seen.has(t.id)) return 0;
    seen.add(t.id);
    let n = 0;
    for (const p of t.prereqs) {
      const q = byId.get(p);
      if (q && eraOf(q) === eraOf(t)) n = Math.max(n, depthOf(q, seen) + 1);
    }
    depth.set(t.id, n);
    return n;
  };
  for (const t of topics) depthOf(t);

  // the columns: each era's depths in turn
  const cols: { era: Era; depth: number }[] = [];
  const colOf = new Map<string, number>();
  for (const e of ERAS) {
    const mine = topics.filter((t) => eraOf(t) === e);
    if (!mine.length) continue;
    const deepest = Math.max(...mine.map((t) => depth.get(t.id) ?? 0));
    for (let d = 0; d <= deepest; d++) colOf.set(`${e}:${d}`, cols.push({ era: e, depth: d }) - 1);
  }
  const colX = (i: number) => GUTTER + i * COL_W;

  // the lanes: a branch each, as tall as its fullest column needs
  const lanes = LANES.filter((b) => topics.some((t) => t.branch === b));
  const pos = new Map<string, { x: number; y: number }>();
  let y = HEAD_H;
  const laneTops: { branch: Branch; top: number; h: number }[] = [];
  for (const b of lanes) {
    const cells = new Map<number, Topic[]>();
    for (const t of topics.filter((q) => q.branch === b)) {
      const c = colOf.get(`${eraOf(t)}:${depth.get(t.id) ?? 0}`)!;
      cells.set(c, [...(cells.get(c) ?? []), t]);
    }
    const tallest = Math.max(1, ...[...cells.values()].map((l) => l.length));
    const h = LANE_HEAD + tallest * ROW_H + LANE_PAD * 2;
    for (const [c, list] of cells) list.sort((p, q) => p.name.localeCompare(q.name)).forEach((t, i) => pos.set(t.id, { x: colX(c), y: y + LANE_HEAD + LANE_PAD + i * ROW_H }));
    laneTops.push({ branch: b, top: y, h });
    y += h;
  }
  const width = GUTTER * 2 + cols.length * COL_W;
  const height = y + LANE_PAD;

  const wrap = el('div', 'tree-wrap');
  const tree = el('div', 'tree');
  tree.style.width = `${width}px`;
  tree.style.height = `${height}px`;

  // the eras: a band each, named at the top, the town's own lit
  for (const e of ERAS) {
    const mine = cols.map((c, i) => (c.era === e ? i : -1)).filter((i) => i >= 0);
    if (!mine.length) continue;
    const band = el('div', `tree-era${ERAS.indexOf(e) % 2 ? ' odd' : ''}${e === era ? ' now' : ''}${eraReached(era, e) ? '' : ' ahead'}`);
    band.style.left = `${colX(mine[0]) - GUTTER / 2}px`;
    band.style.width = `${mine.length * COL_W}px`;
    band.style.height = `${height}px`;
    const name = el('div', 'tree-era-name', `${ERA_NAMES[e]}${e === era ? ' · now' : eraReached(era, e) ? '' : ' · ahead'}`);
    band.append(name);
    tree.append(band);
  }
  // the lanes' names, down the left (they stay put as the tree scrolls)
  for (const l of laneTops) {
    const lane = el('div', 'tree-lane');
    lane.style.top = `${l.top}px`;
    lane.style.height = `${l.h}px`;
    lane.append(el('span', 'tree-lane-name', l.branch === 'heritage' ? `${s.origin.name} heritage` : BRANCH_NAMES[l.branch]));
    tree.append(lane);
  }

  // the lines from each prerequisite to what it opens
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  for (const t of topics) {
    const to = pos.get(t.id)!;
    for (const p of t.prereqs) {
      const from = pos.get(p);
      if (!from) continue;
      const x0 = from.x + NODE_W;
      const y0 = from.y + NODE_H / 2;
      const x1 = to.x;
      const y1 = to.y + NODE_H / 2;
      const mid = (x0 + x1) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', x1 > x0 ? `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1}` : `M${x0},${y0} C${x0 + 30},${y0} ${x1 - 30},${y1} ${x1},${y1}`);
      const lit = r.done.includes(p);
      path.setAttribute('class', `tree-link${lit ? ' lit' : ''}${t.id === selected || p === selected ? ' sel' : ''}`);
      svg.append(path);
    }
  }
  tree.append(svg);

  // the topics
  for (const t of topics) {
    const p = pos.get(t.id)!;
    const done = r.done.includes(t.id);
    const queued = r.queue.includes(t.id);
    const open = !done && !queued && prereqsMet(rs, t.id, era, s.origin.id).ok;
    const ahead = !eraReached(era, eraOf(t));
    const state = done ? 'done' : queued ? 'queued' : ahead ? 'future' : open ? 'open' : 'locked';
    const n = el('div', `tn ${state}${t.id === selected ? ' sel' : ''}`, t.name);
    n.style.left = `${p.x}px`;
    n.style.top = `${p.y}px`;
    n.title = t.name;
    if (queued && r.progress[t.id]) {
      const bar = el('div', 'tn-bar');
      bar.style.width = `${Math.floor((r.progress[t.id] ?? 0) * 100)}%`;
      n.append(bar);
    }
    n.addEventListener('click', () => onSelect(t.id));
    tree.append(n);
  }
  wrap.append(tree);

  // (opened on the town's own era, and kept where it was scrolled to after that)
  const first = cols.findIndex((c) => c.era === era);
  const want = scrollX ?? Math.max(0, colX(Math.max(0, first)) - GUTTER - 4);
  requestAnimationFrame(() => {
    wrap.scrollLeft = want;
  });
  wrap.addEventListener('scroll', () => (scrollX = wrap.scrollLeft));
  return wrap;
}
