// The Chronicle's timeline strip (the owner-approved UI overhaul), at the foot of the journal: the years as ticks along a
// line, and the town's deaths, raids, miracles, wars, founder changes and festivals as small icons on it. Tap one to read
// its line; the current day is marked; the strip scrolls sideways and opens at the present. Built from the journal's
// entries and the hall's fallen, so it needs nothing new from the sim. It updates itself in place: no panel redraw.

import type { AnnalsView, JournalEntryView } from '../../shared/sim/snapshot';
import { DAYS_PER_SEASON } from '../../shared/sim/time';
import { el } from './dom';
import { linkedParts } from './infoCard';
import { addCardStyles } from './cardsStyles';

type Kind = 'death' | 'raid' | 'miracle' | 'war' | 'founder' | 'festival';
const ICON: Record<Kind, string> = { death: '✝', raid: '⚔', miracle: '✨', war: '🚩', founder: '👑', festival: '🎉' };
const NAME: Record<Kind, string> = { death: 'A death', raid: 'A raid', miracle: 'A miracle', war: 'A war', founder: 'The founder', festival: 'A festival' };
/** The order a line is tried in (a miracle at a festival is a miracle). */
const WORDS: [Kind, RegExp][] = [
  ['miracle', /miracle/i],
  ['founder', /founder.*(dies|died|falls|fell|passes|steps|hands)|new (leader|founder)|takes (up )?the (reins|lead)|the (heir|town) (is led|now follows)|succeed(s|ed) .* as (leader|founder)/i],
  ['war', /\bwar\b|siege|invasion|besieg|declares war|army (marches|arrives)|conquest/i],
  ['festival', /festival|feast|midsummer|midwinter|harvest (fair|home)|wedding/i],
  ['raid', /raid|raiders|bandits? (attack|came|arrive)|attacked by|ambush|\bsiege\b/i],
];

const PX_PER_DAY = 6;
/** Room at the left, so the first day's icon isn't cut off. */
const PAD = 24;
const DAYS_PER_YEAR = DAYS_PER_SEASON * 4;

interface Mark {
  kind: Kind;
  day: number;
  text: string;
}

/** The marks for the strip, oldest first (deaths from the hall's record; the rest from the journal's lines). */
export function timelineMarks(entries: JournalEntryView[], annals?: AnnalsView): Mark[] {
  const out: Mark[] = [];
  const hall = annals?.fallen ?? [];
  for (const f of hall) out.push({ kind: 'death', day: f.day, text: `${f.name}${f.founder ? ', a founder,' : ''} died ${f.cause}.` });
  for (const e of entries) {
    if (e.lines) continue;
    if (/ has died /.test(e.text)) {
      if (!hall.length) out.push({ kind: 'death', day: e.day, text: e.text });
      continue;
    }
    const w = WORDS.find(([, re]) => re.test(e.text));
    if (w) out.push({ kind: w[0], day: e.day, text: e.text });
  }
  return out.sort((a, b) => a.day - b.day);
}

/** The strip. `nowDay`: today (the marker). */
export function timelineStrip(entries: JournalEntryView[], annals: AnnalsView | undefined, nowDay: number): HTMLElement {
  addCardStyles();
  const marks = timelineMarks(entries, annals);
  const box = el('div', 'tl');
  const scroll = el('div', 'tl-scroll');
  const track = el('div', 'tl-track');
  const last = Math.max(nowDay, marks.at(-1)?.day ?? 0, 1);
  track.style.minWidth = `${Math.max(260, PAD + (last + 6) * PX_PER_DAY + marks.length * 4)}px`;
  track.append(el('div', 'tl-line'));
  for (let d = 0; d <= last + 4; d += DAYS_PER_YEAR) {
    const x = PAD + d * PX_PER_DAY;
    const tick = el('div', 'tl-tick');
    tick.style.left = `${x}px`;
    const label = el('div', 'tl-year', `Year ${Math.floor(d / DAYS_PER_YEAR) + 1}`);
    label.style.left = `${x + 18}px`;
    track.append(tick, label);
  }
  const now = el('div', 'tl-now');
  now.style.left = `${PAD + nowDay * PX_PER_DAY}px`;
  track.append(now);

  const read = el('div', 'tl-read', marks.length ? 'Tap a mark to read it.' : 'Nothing marked yet: deaths, raids, miracles, wars, new founders and festivals will appear here.');
  const buttons: HTMLElement[] = [];
  // two lanes above the line, so crowded days don't stack on one spot
  const laneEnd = [-99, -99];
  marks.forEach((m, i) => {
    // (the lane that is free soonest; a crowded day pushes its later marks along a little rather than stacking them)
    const lane = laneEnd[0] <= laneEnd[1] ? 0 : 1;
    const x = Math.max(PAD + m.day * PX_PER_DAY, laneEnd[lane] + 30);
    laneEnd[lane] = x;
    const b = el('button', 'tl-ico', ICON[m.kind]);
    b.style.left = `${x}px`;
    b.style.top = `${lane ? 4 : 34}px`;
    b.title = `${NAME[m.kind]}, day ${m.day}`;
    b.addEventListener('click', () => {
      for (const o of buttons) o.classList.remove('on');
      b.classList.add('on');
      read.replaceChildren(el('b', '', `${NAME[m.kind]} · year ${Math.floor((m.day - 1) / DAYS_PER_YEAR) + 1}, day ${m.day}: `), ...linkedParts(m.text)); // (the names in it tappable: infoCard.ts)
    });
    buttons.push(b);
    track.append(b);
    void i;
  });
  track.style.minWidth = `${Math.max(parseFloat(track.style.minWidth), Math.max(...laneEnd) + 30)}px`;
  scroll.append(track);
  box.append(el('div', 'pc-sec', 'Timeline'), scroll, read);
  // opens at the present
  const toNow = () => {
    scroll.scrollLeft = Math.max(0, PAD + nowDay * PX_PER_DAY - scroll.clientWidth + 40);
  };
  requestAnimationFrame(toNow);
  return box;
}
