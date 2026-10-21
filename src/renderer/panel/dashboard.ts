// The Town's home (the UI restructure): a dashboard of cards, one a thing the owner asks about first: food, danger,
// spirits, the treasury, faith, what's being built, and the realm when it is at war. Each is a tap to its section; the
// most urgent is marked `.card-urgent`. The planner's "why" shows under what it's building.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import type { Bridge, PanelId } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { el } from './dom';
import { foodDays, goTo } from './townOverview';
import { jumpToSection, sheetIcon } from './structure';
import { stockIcon } from '../art/materialIcons';
import { TICKS_PER_HOUR } from '../../shared/sim/time';

/* ---- food's direction: sampled once an hour of game time while the menu is up */
const samples: { tick: number; days: number }[] = [];
export function noteFood(s: Snapshot): void {
  const days = foodDays(s);
  if (!isFinite(days)) return;
  const last = samples[samples.length - 1];
  if (last && s.tick < last.tick) samples.length = 0; // (a different game)
  if (!last || s.tick - last.tick >= TICKS_PER_HOUR) samples.push({ tick: s.tick, days });
  if (samples.length > 12) samples.shift();
}
/** ▲ food is gaining, ▼ falling, ▬ steady, '' before there is enough to tell. */
export function foodTrend(s: Snapshot): string {
  const days = foodDays(s);
  const old = samples.find((p) => s.tick - p.tick >= 3 * TICKS_PER_HOUR);
  if (!old || !isFinite(days)) return '';
  const d = days - old.days;
  return d > Math.max(0.15, old.days * 0.05) ? '▲' : d < -Math.max(0.15, old.days * 0.05) ? '▼' : '▬';
}

const moodOf = (s: Snapshot) => (s.people.length ? Math.round(s.people.reduce((n, p) => n + p.morale, 0) / s.people.length) : 0);

interface Card {
  id: string;
  label: string;
  icon: HTMLElement | null;
  value: string;
  sub: string[];
  urgency: number;
  to: () => void;
  bar?: number;
  wide?: boolean;
}

/** What shows on the dashboard, to a redraw key (only what the eye can see: the words and bars as drawn). */
export function dashboardKey(s: Snapshot): string {
  return JSON.stringify(cards(s, undefined, () => {}).map((c) => [c.id, c.value, c.sub, c.urgency > 0, c.bar === undefined ? -1 : Math.floor(c.bar * 20)]));
}

function cards(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): Card[] {
  const go = (panel: PanelId, tab: string, section: string) => () => {
    jumpToSection(panel, section);
    goTo(bridge, 'build', panel, tab, rerender);
  };
  const out: Card[] = [];
  // food
  const days = foodDays(s);
  const trend = foodTrend(s);
  out.push({
    id: 'food',
    label: 'Food',
    icon: stockIcon('berries', 16),
    value: days === Infinity ? 'No need' : `${days < 10 ? days.toFixed(1) : Math.round(days)} days${trend ? ` ${trend}` : ''}`,
    sub: ['in store for those who eat'],
    urgency: days < 2 ? 90 : days < 4 ? 40 : 0,
    to: go('build', 'Stores', 'Stores'),
  });
  // danger: the raid at the gate, a sign of disaster, the wall, and who keeps the night watch
  const g = s.guards;
  const dsub: string[] = [];
  let dvalue = 'Quiet';
  let durg = 0;
  if (s.raid) {
    dvalue = s.raid.name;
    dsub.push(s.raid.phase === 'warning' ? `at the gate in ${Math.max(1, Math.ceil(s.raid.secondsToArrival / 60))} min` : 'fighting now');
    dsub.push(`power ${s.raid.power} against the town's ${s.raid.townPower}: ${s.raid.matchup}`);
    durg = 100;
  } else if (s.doom) {
    dvalue = s.doom.name;
    dsub.push(s.doom.phase === 'signs' ? `signs: ${Math.ceil(s.doom.hoursLeft)}h` : 'upon us');
    durg = s.doom.phase === 'active' ? 95 : 60;
  } else dsub.push('no raiders in sight');
  dsub.push(s.wall ? `wall ${s.wall.done}/${s.wall.of} raised` : 'wall: none going up');
  dsub.push(`${g.n} of ${g.wanted} guards`);
  out.push({ id: 'danger', label: 'Danger', icon: sheetIcon('ShortWep', 0), value: dvalue, sub: dsub, urgency: durg, to: go('build', 'Treasury', 'Guards') });
  // spirits
  const mood = moodOf(s);
  const low = s.people.filter((p) => p.morale < 30).length;
  out.push({
    id: 'mood',
    label: 'Spirits',
    icon: sheetIcon('Music', 0),
    value: `${mood} · ${mood >= 60 ? 'content' : mood >= 35 ? 'getting by' : 'unhappy'}`,
    sub: [low ? `${low} close to breaking` : 'nobody close to breaking'],
    urgency: mood < 35 ? 70 : low >= 3 ? 30 : 0,
    to: () => goTo(bridge, 'build', 'townsfolk', 'People', rerender),
    bar: mood / 100,
  });
  // the purse
  out.push({ id: 'treasury', label: 'Treasury', icon: sheetIcon('Money', 0), value: `${s.coins ?? 0} coins`, sub: [`tax: ${s.tax}`], urgency: (s.coins ?? 0) < 5 && s.guards.n > 0 ? 25 : 0, to: go('build', 'Treasury', 'Treasury') });
  // faith
  if (s.faith.on && s.faith.gods.length) {
    const worst = [...s.faith.gods].sort((a, b) => a.favour - b.favour)[0];
    out.push({
      id: 'faith',
      label: 'Faith',
      icon: sheetIcon('Amulet', 0),
      value: worst.mood === 'wrathful' ? 'Wrathful' : worst.favour < 0 ? 'Uneasy' : 'At peace',
      sub: [worst.favour < 0 ? `${worst.name} is ${worst.mood}` : 'all four content', s.faith.nextRite !== null ? `next rite in ${s.faith.nextRite} days` : ''].filter(Boolean),
      urgency: worst.mood === 'wrathful' ? 65 : 0,
      to: go('build', 'Faith', 'The gods'),
    });
  }
  // what's going up now, with the planner's reason
  const site = s.buildings.filter((b) => b.status === 'blueprint');
  const lead = [...site].sort((a, b) => b.progress - a.progress)[0];
  const bsub: string[] = [];
  if (lead) bsub.push(`${Math.floor(lead.progress * 100)}% built${site.length > 1 ? ` · ${site.length - 1} more waiting` : ''}`);
  if (s.why?.build) bsub.push(s.why.build);
  out.push({
    id: 'building',
    label: 'Building now',
    icon: sheetIcon('Tool', 0),
    value: lead ? (BUILDING_BY_ID[lead.def]?.name ?? lead.def) : 'Nothing',
    sub: bsub.length ? bsub : ['nothing going up right now'],
    urgency: 0,
    to: go('build', 'Buildings', 'Being built'),
    bar: lead?.progress,
    wide: true,
  });
  // the realm, at war
  const foes = s.realm.factions.filter((f) => f.stance === 'war' && f.known);
  if (foes.length || s.war?.wars.length) {
    out.push({
      id: 'realm',
      label: 'The realm',
      icon: sheetIcon('Shield', 0),
      value: foes.length ? `At war with ${foes[0].name}${foes.length > 1 ? ` +${foes.length - 1}` : ''}` : 'Wars in the realm',
      sub: [s.war ? s.war.season.name : ''].filter(Boolean),
      urgency: foes.length ? 50 : 10,
      to: go('expeditions', 'Realm', 'The realm'),
      wide: true,
    });
  }
  // the most urgent, if any is
  const top = out.reduce((b, c) => (c.urgency > b.urgency ? c : b), out[0]);
  if (top.urgency <= 0) top.urgency = 0;
  return out.map((c) => ({ ...c, urgency: c === top ? c.urgency : 0 }));
}

/** The dashboard: the cards, and under them the planner's other reasons (studying, making). */
export function dashboard(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement[] {
  const grid = el('div', 'dash');
  for (const c of cards(s, bridge, rerender)) {
    const t = el('button', `dash-card dash-${c.id}${c.urgency > 0 ? ' card-urgent' : ''}${c.wide ? ' wide' : ''}`);
    const label = el('span', 'dash-label');
    if (c.icon) label.append(c.icon);
    label.append(c.label);
    const value = el('span', 'dash-value', c.value);
    t.append(label, value);
    for (const line of c.sub) t.append(el('span', line.startsWith('Building a') || line.startsWith('Studying') ? 'dash-sub why-line' : 'dash-sub', line));
    if (c.bar !== undefined) {
      const bar = el('span', 'dash-bar');
      const fill = el('i');
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, c.bar)) * 100)}%`;
      bar.append(fill);
      t.append(bar);
    }
    t.addEventListener('click', c.to);
    grid.append(t);
  }
  const out: HTMLElement[] = [grid];
  const more = [s.why?.research, s.why?.craft].filter((x): x is string => !!x);
  for (const w of more) out.push(el('div', 'why-line', w));
  return out;
}
