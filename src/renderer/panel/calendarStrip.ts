// The days ahead (the Town's Overview; sim/calendar.ts): a strip of the coming days, each with the marks of what the town
// knows is coming (the festival, the season's first day, the rite, a caravan, a hunt closing, an omen), then those
// days told in a line each. Read-only: nothing to press but the section's fold. Tap a day or a mark for its tip.

import type { Snapshot } from '../../shared/sim/snapshot';
import type { CalendarKind } from '../../shared/sim/calendar';
import { el } from './dom';
import { icon } from '../ui/icon';

const ICON: Record<CalendarKind, string> = { festival: 'food', season: 'day', rite: 'gods', caravan: 'coins', hunt: 'raid', omen: 'night', 'name-day': 'people', other: 'news' };
const MARK: Record<CalendarKind, string> = { festival: '✦', season: '❀', rite: '✝', caravan: '●', hunt: '⚔', omen: '☾', 'name-day': '♥', other: '•' };
const NAME: Record<CalendarKind, string> = { festival: 'Festival', season: 'A new season', rite: 'The rite', caravan: 'Caravan', hunt: 'The Guild', omen: 'An omen', 'name-day': 'A name-day', other: 'Of note' };

const markOf = (k: CalendarKind) => icon(ICON[k], 16) ?? el('span', 'cal-mark', MARK[k]);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Changes when what the strip shows changes. */
export const calendarKey = (s: Snapshot) => (s.upcoming ?? []).map((d) => [d.day, d.entries.map((e) => e.text)]);

/** The section: its heading, the strip and the lines. Nothing at all on a snapshot from before the calendar. */
export function renderCalendar(s: Snapshot): HTMLElement[] {
  const days = s.upcoming;
  if (!days?.length) return [];
  ensureStyle();
  const strip = el('div', 'cal-strip');
  for (const d of days) {
    const cell = el('div', `cal-day ui-frame${d.today ? ' today' : ''}${d.dayOfSeason === 1 ? ' turn' : ''}`);
    cell.append(el('span', 'cal-num ui-small', d.today ? 'Today' : `Day ${d.day}`), el('span', 'cal-season ui-label', cap(d.season)));
    const marks = el('span', 'cal-marks');
    for (const e of d.entries) {
      const m = markOf(e.kind);
      m.dataset.tip = `${NAME[e.kind]}|${e.text}${e.guess ? ' (it may not come true)' : ''}`;
      marks.append(m);
    }
    cell.append(marks);
    cell.dataset.tip = `${d.today ? 'Today' : `Day ${d.day}`}, ${d.season}|${d.entries.length ? d.entries.map((e) => e.text).join('. ') : 'Nothing the town knows of yet.'}`;
    strip.append(cell);
  }
  const list = el('div', 'cal-list');
  for (const d of days)
    for (const e of d.entries) {
      const row = el('div', `cal-row ui-chip${e.guess ? ' guess' : ''}`);
      row.append(markOf(e.kind), el('span', 'cal-when', d.today ? 'Today' : `Day ${d.day}`), el('span', 'cal-text', e.text));
      list.append(row);
    }
  const out: HTMLElement[] = [el('h2', '', 'The days ahead'), el('div', 'hint', 'What the town knows of the coming days. Omens are a seer\'s guess, and may not come true.'), strip];
  if (list.childElementCount) out.push(el('div', 'ui-divider'), list);
  else out.push(el('div', 'hint', 'Nothing marked yet.'));
  return out;
}

const STYLE = `
.cal-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; margin: 6px 0; }
.cal-day { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 3px 2px; min-height: 52px; min-width: 0; text-align: center; }
.cal-day.today { box-shadow: 0 0 0 2px #c8a050 inset; }
.cal-day.turn .cal-season { font-weight: 700; }
.cal-num { font-weight: 600; white-space: nowrap; }
.cal-season { font-size: 0.72em; opacity: 0.75; }
.cal-marks { display: flex; flex-wrap: wrap; justify-content: center; gap: 1px; min-height: 16px; }
.cal-mark { display: inline-block; width: 16px; text-align: center; }
.cal-list { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
.cal-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.cal-row.guess .cal-text { font-style: italic; opacity: 0.85; }
.cal-when { flex: none; font-size: 0.85em; opacity: 0.8; min-width: 3.6em; }
.cal-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
@media (min-width: 640px) {
  .cal-strip { grid-template-columns: repeat(10, minmax(0, 1fr)); }
  .cal-day { min-height: 44px; }
}
`;
let styled = false;
function ensureStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'calendar-style';
  st.textContent = STYLE;
  document.head.append(st);
}
