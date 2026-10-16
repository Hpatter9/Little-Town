// The phone's top bar, quieter (the owner's ask): the town's mark and name, the day and season under a small arc the
// sun (or the moon) travels along, and one line of what's happening, in turn (anything urgent first and held). Pause
// and the game's speed sit at its end beside the ☰; everything else lives in the tabs. (People, beds and coins were
// taken off the bar earlier at the owner's ask, and stay off.)

import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { GAME_SPEEDS } from '../../shared/sim/battle';
import { FOOD_VALUE } from '../../shared/data/people';
import type { Material } from '../../shared/data/materials';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { bleedLeft, researchFill } from '../../shared/format';
import { lookOf } from './looks';
import { icon } from './icon';
import { STAT_TIPS, tipFor } from './tips';

/** How long each line of the turn stays (ms). */
const LINE_MS = 6000;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Where the sun (by day) or the moon (by night) is along the arc, 0 rising .. 1 setting. */
export function arcAt(hour: number): { t: number; sun: boolean } {
  const sun = hour >= 6 && hour < 18;
  const h = sun ? hour - 6 : (hour + 6) % 24;
  return { t: Math.max(0, Math.min(1, h / 12)), sun };
}

/** The urgent line (held while it lasts), and the rest to take in turn. */
export function topLines(s: Snapshot): { urgent: string | null; turn: string[] } {
  const r = s.raid;
  const dying = s.people.filter((p) => p.away === null && p.bleedMinutes !== null).sort((a, b) => a.bleedMinutes! - b.bleedMinutes!);
  const starving = s.people.filter((p) => p.away === null && p.needs.food <= 0.02 && p.monster !== 'undead').length;
  const d = s.doom;
  const urgent = s.catchingUp != null
    ? `Catching up… ${Math.floor(s.catchingUp * 100)}%`
    : r
      ? r.phase === 'warning' ? `${r.name} in ${Math.ceil(r.secondsToArrival)}s` : `${r.name} in town!`
      : dying.length
        ? `${dying[0].name} bleeding out: ${bleedLeft(dying[0].bleedMinutes)}${dying.length > 1 ? ` (+${dying.length - 1})` : ''}`
        : starving
          ? `${starving} starving!`
          : d
            ? d.phase === 'signs' ? `${d.name} coming (${Math.ceil(d.hoursLeft)}h)` : d.name === 'Plague' ? `Plague: ${d.sick} sick` : `${d.name}: ${Math.ceil(d.hoursLeft)}h left`
            : s.launchHours != null
              ? `Lift-off in ${Math.ceil(s.launchHours)}h`
              : null;
  const turn: string[] = [];
  if (s.news) turn.push(s.news.text);
  const study = researchFill(s.research);
  if (study) turn.push(study.title.replace(/^Researching /, 'Studying '));
  const sites = s.buildings.filter((b) => b.status === 'blueprint');
  if (sites.length) turn.push(`Building ${sites.slice(0, 2).map((b) => BUILDING_BY_ID[b.def]?.name ?? b.def).join(', ')}${sites.length > 2 ? ` and ${sites.length - 2} more` : ''}`);
  const eaters = s.people.filter((p) => !p.tireless && p.away === null).length;
  const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (s.stock[m] ?? 0) * v, 0);
  if (eaters) {
    const days = food / eaters;
    turn.push(`Food for ${days < 10 ? days.toFixed(1) : Math.round(days)} days`);
  }
  return { urgent, turn };
}

export interface TopBar {
  update(s: Snapshot): void;
}

export function createTopBar(top: HTMLElement, bridge: Bridge): TopBar {
  const title = top.querySelector<HTMLElement>('#top-title') ?? el('span', '', '');
  const menuBtn = top.querySelector<HTMLElement>('#menu-btn');
  title.classList.add('top-name');
  const mark = el('span', 'top-mark');
  tipFor(mark, 'people');
  const main = el('div', 'top-main');
  const sub = el('div', 'top-sub');
  const arc = el('span', 'top-arc');
  const sun = icon('day') ?? el('span', '');
  const moon = el('span', 'top-moon');
  arc.append(sun, moon);
  const day = el('span', 'top-day');
  const when = el('span', 'top-when');
  when.append(arc, day);
  tipFor(when, 'day');
  const line = el('span', 'top-line');
  tipFor(line, 'news');
  sub.append(when, line);
  main.append(title, sub);
  const pause = el('button', 'top-btn top-pause');
  const fast = el('button', 'top-btn top-speed', '1×');
  pause.dataset.tip = 'Pause|Stops the town’s clock. Tap again to go on.';
  fast.dataset.tip = 'Speed|How fast the town runs: 1×, 2×, 3×, 5× or 10×. Tap to go faster.';
  let snap: Snapshot | null = null;
  pause.addEventListener('click', () => snap && bridge.command({ type: 'setPaused', paused: !snap.paused }));
  fast.addEventListener('click', () => {
    if (!snap) return;
    const speed = snap.speed ?? 1;
    bridge.command({ type: 'gameSpeed', speed: GAME_SPEEDS[(GAME_SPEEDS.indexOf(speed as never) + 1) % GAME_SPEEDS.length] });
  });
  const btns = el('div', 'top-btns');
  btns.append(pause, fast);
  if (menuBtn) btns.append(menuBtn);
  top.replaceChildren(mark, main, btns);
  top.classList.add('top-quiet');

  let lines: string[] = [];
  let at = 0;
  let shown = '';
  const show = (text: string) => {
    if (text === shown) return;
    shown = text;
    line.textContent = text;
    line.classList.remove('top-line-in');
    void line.offsetWidth;
    line.classList.add('top-line-in');
  };
  setInterval(() => {
    if (!lines.length || line.classList.contains('urgent')) return;
    at = (at + 1) % lines.length;
    show(lines[at]);
  }, LINE_MS);

  let markKey = '';
  return {
    update(s) {
      snap = s;
      const look = lookOf(s.theme);
      const name = s.townTitle ? `${s.townName} ${s.townTitle}` : s.townName;
      if (title.textContent !== name) title.textContent = name;
      if (markKey !== s.theme) {
        markKey = s.theme;
        mark.textContent = look.mark;
      }
      mark.dataset.tip = `${s.townName}|${s.housing.people} living here, ${s.housing.beds} beds.${s.align?.label ? ` The town is ${s.align.label.toLowerCase()}.` : ''}`;
      const c = s.calendar;
      const season = c.season[0].toUpperCase() + c.season.slice(1);
      const dayText = `Day ${c.day} · ${season}${c.year > 1 ? ` Y${c.year}` : ''}`;
      if (day.textContent !== dayText) day.textContent = dayText;
      const a = arcAt(c.hour + c.minute / 60);
      // (along a half circle 40 wide and 18 high, from the left horizon over to the right)
      const x = 20 - 20 * Math.cos(a.t * Math.PI);
      const y = 18 - 18 * Math.sin(a.t * Math.PI);
      const pos = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      sun.style.transform = pos;
      moon.style.transform = pos;
      sun.hidden = !a.sun;
      moon.hidden = a.sun;
      arc.classList.toggle('night', !a.sun);
      const p = s.paused ? '▶' : '❚❚';
      if (pause.textContent !== p) pause.textContent = p;
      pause.classList.toggle('on', s.paused);
      const sp = `${s.speed ?? 1}×`;
      if (fast.textContent !== sp) fast.textContent = sp;
      fast.classList.toggle('on', (s.speed ?? 1) > 1);
      const { urgent, turn } = topLines(s);
      lines = turn;
      line.classList.toggle('urgent', !!urgent);
      line.dataset.tip = urgent ? `Now|${urgent}` : STAT_TIPS.news;
      if (urgent) show(urgent);
      else if (!lines.includes(shown)) show(lines[at % Math.max(1, lines.length)] ?? '');
    },
  };
}
