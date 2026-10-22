// The Chronicle: the running history of the town, newest first, grouped by day, under four tabs (Events, People, Town,
// Library) each with a few filters. Entries from older saves with lines stand out as cards.

import type { AncestryView } from '../../shared/sim/ancestors';
import type { JournalEntryView } from '../../shared/sim/snapshot';
import { platino } from '../art/icons';
import { el } from './dom';
import { linked, openCard } from './infoCard';
import { renderBestiary } from './bestiaryPanel';
import { renderHeroes } from './heroesPanel';
import { renderLegends } from './legendsPanel';
import { renderShelf } from './shelfPanel';
import { renderMilestones } from './milestonesPanel';
import type { RareView } from '../../shared/sim/rare';
import type { AnnalsView } from '../../shared/sim/snapshot';
import type { FestivalsView } from '../../shared/sim/festivals';
import { renderFestivals } from './festivalsPanel';
import { renderCulture } from './culturePanel';
import type { CultureView } from '../../shared/sim/culture';
import { timelineStrip } from './timelineStrip';

type Filter = 'all' | 'key' | 'deaths' | 'festivals' | 'culture' | 'heroes' | 'milestones' | 'legends' | 'shelf' | 'bestiary' | 'scenes';
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['key', 'Key events'],
  ['deaths', 'Deaths'],
  ['festivals', 'Festivals'],
  ['culture', 'Culture'],
  ['heroes', 'Heroes'],
  ['milestones', 'Milestones'],
  ['legends', 'Legends'],
  ['shelf', 'Shelf'],
  ['bestiary', 'Bestiary'],
  ['scenes', 'Scenes'],
];
/** Four tabs along the top, each with its own few filters in a smaller row beneath (the menus' redo: four at most). */
const GROUPS: [string, Filter[]][] = [
  ['Events', ['all', 'key', 'deaths']],
  ['People', ['heroes', 'milestones', 'legends']],
  ['Town', ['festivals', 'culture', 'shelf']],
  ['Library', ['bestiary', 'scenes']],
];
const FILTER_NAME = new Map<Filter, string>(FILTERS);
/** (kept while the panel re-renders) */
let filter: Filter = 'all';

const isDeath = (e: JournalEntryView) => / has died /.test(e.text);

export function renderJournal(entries: JournalEntryView[], met: readonly string[] = [], annals?: AnnalsView, scenes: { key: number; title: string; tick: number }[] = [], watch?: (key: number) => void, ancestry?: AncestryView | null, festivals?: FestivalsView, culture?: CultureView, guildMark?: (personId: number) => HTMLElement | null, nowDay = 1, rare?: RareView): HTMLElement[] {
  const list = el('div');
  const row = el('div', 'row inv-tabs menu-tabs');
  const sub = el('div', 'row inv-tabs sub-filters');
  const draw = () => {
    const open = GROUPS.find(([, fs]) => fs.includes(filter)) ?? GROUPS[0];
    row.replaceChildren(
      ...GROUPS.map(([label, fs]) => {
        const b = el('button', `inv-tab${open[0] === label ? ' on' : ''}`, label);
        b.addEventListener('click', () => ((filter = fs[0]), draw()));
        return b;
      }),
    );
    sub.replaceChildren(
      ...(open[1].length > 1
        ? open[1].map((f) => {
            const b = el('button', `inv-tab small${filter === f ? ' on' : ''}`, FILTER_NAME.get(f) ?? f);
            b.addEventListener('click', () => ((filter = f), draw()));
            return b;
          })
        : []),
    );
    if (filter === 'heroes') {
      list.replaceChildren(...renderHeroes(annals ?? { fallen: [], chronicles: [], famous: [] }, guildMark));
      return;
    }
    if (filter === 'festivals') {
      list.replaceChildren(...renderFestivals(festivals));
      return;
    }
    if (filter === 'culture') {
      list.replaceChildren(...renderCulture(culture));
      return;
    }
    // (the generations and the town's firsts: milestonesPanel.ts)
    if (filter === 'milestones') {
      list.replaceChildren(...renderMilestones(annals ?? { fallen: [], chronicles: [], famous: [] }));
      return;
    }
    // (every rare thing the town has seen: shelfPanel.ts)
    if (filter === 'shelf') {
      list.replaceChildren(...renderShelf(rare));
      return;
    }
    if (filter === 'legends') {
      list.replaceChildren(...renderLegends(ancestry));
      return;
    }
    // (the cutscenes seen or passed by, to watch again: sim/cutscenes.ts)
    if (filter === 'scenes') {
      if (!scenes.length) {
        list.replaceChildren(el('p', 'empty', 'No scenes yet. The big moments are played out as they happen, and kept here to watch again.'));
        return;
      }
      list.replaceChildren(
        ...[...scenes].reverse().map((sc) => {
          const c = el('div', 'card scene-card');
          const top = el('div', 'card-top');
          top.append(el('span', 'card-name', `🎬 ${sc.title}`), el('span', 'card-size', `Day ${Math.floor(sc.tick / 14400) + 1}`));
          const b = el('button', 'primary', 'Watch again');
          b.addEventListener('click', () => watch?.(sc.key));
          c.append(top, b);
          return c;
        }),
      );
      return;
    }
    if (filter === 'bestiary') {
      list.replaceChildren(...renderBestiary(met, draw));
      return;
    }
    const shown = filter === 'all' ? entries : filter === 'key' ? entries.filter((e) => e.key || e.lines) : entries.filter(isDeath);
    // (the tabs show even before anything has happened: the Heroes and the Bestiary are there from the start)
    const none = !entries.length ? 'Nothing has happened yet. What happens in the town will be written here.' : filter === 'deaths' ? 'Nobody has died. Yet.' : 'Nothing like that yet.';
    list.replaceChildren(...(shown.length ? entryRows(shown) : [el('p', 'empty', none)]));
    if (filter === 'all' && entries.length >= 200) list.append(platino()); // for those who read all the way back
  };
  draw();
  return [row, sub, list, timelineStrip(entries, annals, nowDay)];
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
      for (const line of e.lines) list.append(linked(line, 'li'));
      c.append(top, list);
      out.push(c);
    } else {
      // (a name in the line opens its card or sheet; a tap anywhere else on the line opens the line's own card: infoCard.ts)
      const row = el('div', e.key ? 'journal-row key' : 'journal-row');
      row.append(el('span', 'journal-time', time), linked(e.text));
      row.addEventListener('click', () => openCard({ kind: 'event', id: e.id, text: e.text, when: e.when }));
      out.push(row);
    }
  }
  return out;
}
