// DOM UI on the strip: the clock (full view), the tab dock (full view) and the slim ticker (minimal view).
// Every element that should capture the mouse carries [data-hit]; everything else is click-through.

import { PANELS, type Bridge, type PanelId, type StripState } from '../shared/ipc';
import { ERA_NAMES } from '../shared/data/eras';
import { MATERIAL_NAMES, MATERIALS, type Material } from '../shared/data/materials';
import { FOOD_VALUE } from '../shared/data/people';
import type { Snapshot } from '../shared/sim/snapshot';
import { bleedLeft, expeditionFill, researchFill } from '../shared/format';

export interface Hud {
  apply(state: StripState): void;
  update(snap: Snapshot): void;
}

export function createHud(bridge: Bridge): Hud {
  let paused = false;
  let stripMode: StripState['mode'] = 'full';
  const togglePause = () => bridge.command({ type: 'setPaused', paused: !paused });

  // Clock: day, season, time of day, pause.
  const clock = el('div', { id: 'clock', 'data-hit': '' });
  const clockText = el('span', { class: 'clock-text' });
  const pause = el('button', { class: 'tab pause' });
  pause.addEventListener('click', togglePause);
  const stock = el('span', { class: 'stock' });
  const raid = el('span', { class: 'raid-badge', hidden: '' });
  const doom = el('span', { class: 'raid-badge doom-badge', hidden: '' });
  const launch = el('span', { class: 'raid-badge launch-badge', hidden: '' });
  const bleed = el('span', { class: 'raid-badge bleed-badge', hidden: '' });
  const hunger = el('span', { class: 'raid-badge bleed-badge', hidden: '' });
  const foodDays = el('span', { class: 'food-days' });
  let musicOn = false;
  const music = el('button', { class: 'tab music', title: 'Music on/off' }, '♪');
  music.addEventListener('click', () => bridge.setMusic(!musicOn));
  clock.append(clockText, pause, music, raid, bleed, hunger, doom, launch, foodDays, stock);
  const flash = el('div', { id: 'raid-flash', hidden: '' });
  document.body.append(flash);
  // an epic boss's health bar, across the top of the strip
  const bossBox = el('div', { id: 'boss-bar', hidden: '' });
  const bossName = el('div', { class: 'boss-name' });
  const bossTrack = el('div', { class: 'boss-track' });
  const bossFill = el('div', { class: 'boss-fill' });
  bossTrack.append(bossFill);
  bossBox.append(bossName, bossTrack);
  document.body.append(bossBox);

  // Tab dock.
  const dock = el('div', { id: 'dock', 'data-hit': '' });
  const tabs = new Map<PanelId, HTMLButtonElement>();
  // (the Research tab fills up as the topic being studied is learned, the Expeditions tab as the party due home
  // soonest makes its way)
  const fills = new Map<PanelId, { bar: HTMLElement; pct: number }>([
    ['research', { bar: el('span', { class: 'tab-fill', hidden: '' }), pct: -1 }],
    ['expeditions', { bar: el('span', { class: 'tab-fill trip', hidden: '' }), pct: -1 }],
  ]);
  for (const p of PANELS) {
    const b = el('button', { class: 'tab' });
    const fill = fills.get(p.id);
    if (fill) b.append(fill.bar);
    b.append(el('span', { class: 'tab-label' }, p.label));
    b.addEventListener('click', () => bridge.togglePanel(p.id));
    tabs.set(p.id, b);
    dock.append(b);
  }
  const collapse = el('button', { class: 'tab collapse', title: 'Shrink to the slim ticker' }, 'Minimize ▾');
  collapse.addEventListener('click', () => bridge.setMode('minimal'));
  dock.append(collapse);

  // Slim ticker.
  const ticker = el('div', { id: 'ticker', 'data-hit': '', hidden: '' });
  const tickerText = el('span', { class: 'clock-text' });
  const tickerPause = el('button', { class: 'tab pause' });
  tickerPause.addEventListener('click', togglePause);
  const expand = el('button', { class: 'tab expand', title: 'Show the full town' }, 'Expand ▴');
  expand.addEventListener('click', () => bridge.setMode('full'));
  ticker.append(el('span', { class: 'ticker-name' }, 'Chronos Settlement'), tickerText, tickerPause, expand);

  document.body.append(clock, dock, ticker);

  return {
    apply(s) {
      stripMode = s.mode;
      musicOn = s.music;
      music.classList.toggle('active', s.music);
      clock.hidden = dock.hidden = s.mode !== 'full';
      ticker.hidden = s.mode !== 'minimal';
      for (const [id, b] of tabs) b.classList.toggle('active', s.panel === id);
    },
    update(snap) {
      for (const [id, f] of fills) {
        const now = id === 'research' ? researchFill(snap.research) : expeditionFill(snap.expeditions);
        if ((now?.pct ?? -1) === f.pct) continue;
        f.pct = now?.pct ?? -1;
        f.bar.hidden = !now;
        f.bar.style.width = `${Math.max(0, f.pct)}%`;
        tabs.get(id)!.title = now?.title ?? '';
      }
      const boss = snap.bossBar;
      bossBox.hidden = !boss;
      if (boss) {
        const t = `${boss.name}${boss.enraged ? ' (enraged!)' : ''} · ${boss.where}`;
        if (bossName.textContent !== t) bossName.textContent = t;
        bossFill.style.width = `${Math.max(0, Math.round((boss.hp / boss.maxHp) * 100))}%`;
        bossBox.classList.toggle('enraged', boss.enraged);
      }
      paused = snap.paused;
      const c = snap.calendar;
      const sky = c.daylight > 0.5 ? '☀' : '☾'; // sun / moon
      const season = c.season[0].toUpperCase() + c.season.slice(1) + (c.year > 1 ? ` Y${c.year}` : '');
      const time = `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
      const era = snap.era === 'neolithic' ? '' : `${ERA_NAMES[snap.era]} · `;
      const text = `${sky} ${era}Day ${c.day} · ${season} · ${time}`;
      for (const t of [clockText, tickerText]) {
        if (t.textContent !== text) t.textContent = text;
        t.classList.toggle('paused', paused);
      }
      for (const b of [pause, tickerPause]) {
        b.textContent = paused ? 'Resume' : 'Pause';
        b.classList.toggle('active', paused);
      }
      const held = MATERIALS.filter((m) => (snap.stock[m] ?? 0) > 0).map((m) => `${MATERIAL_NAMES[m]} ${snap.stock[m]}`);
      const r = snap.raid;
      raid.hidden = !r;
      flash.hidden = !r || stripMode !== 'full';
      if (r) {
        const t = r.phase === 'warning' ? `${r.name} in ${Math.ceil(r.secondsToArrival)}s` : `${r.name} in town!`;
        if (raid.textContent !== t) raid.textContent = t;
      }
      // anyone bleeding out in town: who has least time left (a dressing or an infirmary saves them)
      const dying = snap.people.filter((p) => p.away === null && p.bleedMinutes !== null).sort((a, b) => a.bleedMinutes! - b.bleedMinutes!);
      bleed.hidden = !dying.length;
      if (dying.length) {
        const t = `${dying[0].name} bleeding out: ${bleedLeft(dying[0].bleedMinutes)}${dying.length > 1 ? ` (+${dying.length - 1})` : ''}`;
        if (bleed.textContent !== t) bleed.textContent = t;
        bleed.title = 'Downed and bleeding. A poultice or bandage in storage is used on them each hour; after a raid, an Infirmary saves everyone.';
      }
      // anyone starving (in town): the famine is on
      const starving = snap.people.filter((p) => p.away === null && p.needs.food <= 0.02 && p.monster !== 'undead').length;
      hunger.hidden = !starving;
      if (starving) {
        const t = `${starving} starving!`;
        if (hunger.textContent !== t) hunger.textContent = t;
        hunger.title = 'No food to be had: they lose health every hour until they eat. Plant fields, hunt, or trade for food.';
      }
      const d = snap.doom;
      doom.hidden = !d;
      if (d) {
        const t = d.phase === 'signs' ? `${d.name} coming (${Math.ceil(d.hoursLeft)}h)` : d.name === 'Plague' ? `Plague: ${d.sick} sick` : `${d.name}: ${Math.ceil(d.hoursLeft)}h left`;
        if (doom.textContent !== t) doom.textContent = t;
      }
      // while the main process simulates time away, say so (the town fast-forwards meanwhile)
      const badge =
        snap.catchingUp != null ? `Catching up… ${Math.floor(snap.catchingUp * 100)}%` : snap.launchHours != null ? `Lift-off in ${Math.ceil(snap.launchHours)}h` : null;
      launch.hidden = badge === null;
      if (badge !== null && launch.textContent !== badge) launch.textContent = badge;
      // how long the stored food lasts everyone who eats (the undead don't), in days; red under a day
      const eaters = snap.people.filter((p) => p.monster !== 'undead' && p.away === null).length; // (parties carry their own)
      const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (snap.stock[m] ?? 0) * v, 0);
      const days = eaters ? food / eaters : Infinity;
      const foodText = days === Infinity ? '' : `Food ${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
      if (foodDays.textContent !== foodText) foodDays.textContent = foodText;
      foodDays.classList.toggle('low', days < 1);
      foodDays.title = 'How long the stored food lasts everyone, at a meal a day each';
      const town = `People ${snap.housing.people} · Beds ${snap.housing.beds}` + (snap.shop || snap.coins ? ` · ● ${snap.coins} coins` : '');
      const stockText = `${town} · Stored ${snap.storageUsed}/${snap.storageCapacity}` + (held.length ? ': ' + held.join(' · ') : '');
      if (stock.textContent !== stockText) stock.textContent = stockText;
    },
  };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}
