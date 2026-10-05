// Town Journal: the running history of the town, newest first, grouped by day. "While you were away"
// reports stand out as cards. A filter at the top narrows it to the key events, or to the dead.

import type { JournalEntryView } from '../../shared/sim/snapshot';
import { platino } from '../art/icons';
import { el } from './dom';

type Filter = 'all' | 'key' | 'deaths';
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['key', 'Key events'],
  ['deaths', 'Deaths'],
];
/** (kept while the panel re-renders) */
let filter: Filter = 'all';

const isDeath = (e: JournalEntryView) => / has died /.test(e.text);

export function renderJournal(entries: JournalEntryView[]): HTMLElement[] {
  if (!entries.length) return [el('p', 'empty', 'Nothing has happened yet. Events, discoveries and news from the road will be written here.')];
  const list = el('div');
  const row = el('div', 'row inv-tabs menu-tabs');
  const draw = () => {
    row.replaceChildren(
      ...FILTERS.map(([f, label]) => {
        const b = el('button', `inv-tab${filter === f ? ' on' : ''}`, label);
        b.addEventListener('click', () => ((filter = f), draw()));
        return b;
      }),
    );
    const shown = filter === 'all' ? entries : filter === 'key' ? entries.filter((e) => e.key || e.lines) : entries.filter(isDeath);
    list.replaceChildren(...(shown.length ? entryRows(shown) : [el('p', 'empty', filter === 'deaths' ? 'Nobody has died. Yet.' : 'Nothing like that yet.')]));
    if (filter === 'all' && entries.length >= 200) list.append(platino()); // for those who read all the way back
  };
  draw();
  return [row, list];
}

function entryRows(entries: JournalEntryView[]): HTMLElement[] {
  const out: HTMLElement[] = [];
  let day = -1;
  for (const e of [...entries].reverse()) {
    if (e.day !== day) {
      day = e.day;
      out.push(el('h2', 'journal-day', e.when.replace(/ · \d\d:\d\d$/, '')));
    }
    const time = e.when.slice(-5);
    if (e.lines) {
      const c = el('div', 'card away');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', e.text), el('span', 'card-size', time));
      const list = el('ul', 'away-lines');
      for (const line of e.lines) list.append(el('li', '', line));
      c.append(top, list);
      out.push(c);
    } else {
      const row = el('div', e.key ? 'journal-row key' : 'journal-row');
      row.append(el('span', 'journal-time', time), el('span', '', e.text));
      out.push(row);
    }
  }
  return out;
}
