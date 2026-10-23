// The Developer menu (developer mode, the owner's ask: "to play through quickly to see what bugs I run into"): a tab
// only while the ☰ menu's Developer mode is on. Every button sends a `dev` command (sim/dev.ts); the sim refuses them
// unless the town has developer mode on, and nothing here changes the town itself. What a tap changes is in `devKey`,
// so the menu redraws to show it.

import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { DevOrder } from '../../shared/sim/devOrders';
import { EVENTS } from '../../shared/data/events';
import { RAID_KINDS } from '../../shared/data/raids';
import { topicName } from '../../shared/data/originResearch';
import { button, el } from './dom';

/** What the menu shows, for its redraw key (panel.ts). */
export const devKey = (s: Snapshot): string =>
  JSON.stringify([s.dev, s.devSave, s.unlockAll, s.research.queue[0] ?? null, s.research.offer?.[0] ?? null, !!s.raid, s.fightOn, s.people.map((p) => `${p.id}:${p.level}:${!!p.downed}`).join(','), s.mainId, !!s.disaster, s.sagas.open.length, picked.event, picked.raid, picked.person]);

/** The choices made in the menu's lists (kept while it redraws). */
const picked: { event: string; raid: string; person: number | null } = { event: '', raid: '', person: null };

export function renderDev(s: Snapshot, bridge: Bridge, redraw: () => void): HTMLElement[] {
  const send = (order: DevOrder) => bridge.command({ type: 'dev', order });
  const row = (...kids: HTMLElement[]) => {
    const d = el('div', 'dev-row');
    d.append(...kids);
    return d;
  };
  const go = (label: string, order: DevOrder, opts: { disabled?: boolean; danger?: boolean } = {}) => button(label, () => send(order), { cls: `place dev-btn${opts.danger ? ' danger' : ''}`, disabled: opts.disabled });
  const note = (text: string) => el('p', 'dev-note', text);
  const pick = <T extends string>(options: [T, string][], value: T, set: (v: T) => void) => {
    const sel = el('select', 'dev-select');
    for (const [v, label] of options) {
      const o = el('option', '', label);
      o.value = v;
      sel.append(o);
    }
    sel.value = value;
    sel.addEventListener('change', () => (set(sel.value as T), redraw()));
    return sel;
  };
  if (!s.dev) return [el('h2', '', 'Developer'), note('Developer mode is off for this town. Turn it on in the ☰ menu.')];
  const out: HTMLElement[] = [];
  out.push(note('Developer mode: these act on the town at once. This town is marked a dev save.'));

  out.push(el('h2', '', 'Building'));
  out.push(row(go('Finish all building now', { op: 'finishBuilds' }), go(`Build orders at once: ${s.dev.build ? 'on' : 'off'}`, { op: 'instantBuild', on: !s.dev.build })));
  out.push(row(button(`Every building unlocked: ${s.unlockAll ? 'on' : 'off'}`, () => bridge.command({ type: 'cheatUnlockAll', on: !s.unlockAll }), { cls: 'place dev-btn' })));

  out.push(el('h2', '', 'Research'));
  const studying = s.research.queue[0] ?? s.research.offer?.[0];
  out.push(note(studying ? `${s.research.queue[0] ? 'Studying' : 'On offer'}: ${topicName(studying, s.origin.id)}` : 'Nothing to study now.'));
  out.push(row(go('Finish the study now', { op: 'finishResearch' }, { disabled: !studying })));

  out.push(el('h2', '', 'Fields and stores'));
  out.push(row(go('Harvest every field', { op: 'harvest' })));
  out.push(row(...[100, 1000, 10000].map((n) => go(`+${n} each`, { op: 'fill', amount: n }))));
  out.push(note('Adds food (grain), wood and stone to the stores, and coins to the treasury and the founder’s purse.'));

  out.push(el('h2', '', 'Time'));
  if (s.dev.skipHours !== null) out.push(row(el('span', 'dev-note', `Running on: ${s.dev.skipHours} hour${s.dev.skipHours === 1 ? '' : 's'} left`), go('Stop', { op: 'stopSkip' })));
  out.push(row(...([[1, '+1 hour'], [6, '+6 hours'], [24, '+1 day'], [72, '+3 days'], [240, '+10 days']] as const).map(([h, label]) => go(label, { op: 'skip', hours: h }))));
  out.push(note('Runs the town flat out once this menu is closed. Questions left open answer themselves and a raid on the way is fought by the town; a card on screen (a recap, a reveal) or a question for the founder holds it until closed.'));

  out.push(el('h2', '', 'Raids and fights'));
  const kinds = RAID_KINDS.filter((k) => k.weight > 0 || k.fromDay < 9999);
  out.push(row(go('Spawn a raid', { op: 'raid', kind: picked.raid || null }, { disabled: !!s.raid }), pick<string>([['', 'The town’s usual kind'], ...kinds.map((k) => [k.id, k.name] as [string, string])], picked.raid, (v) => (picked.raid = v))));
  out.push(row(go('Kill every raider', { op: 'killRaiders' }, { disabled: !s.raid, danger: true }), go('Win the fight now', { op: 'winFight' }, { disabled: !s.raid && !s.fightOn })));

  out.push(el('h2', '', 'People'));
  out.push(row(go('Heal everyone', { op: 'heal', id: null }), go('Founder +1 level', { op: 'levelUp', id: null, levels: 1 }), go('Founder +10 levels', { op: 'levelUp', id: null, levels: 10 })));
  const who = s.people.find((p) => p.id === picked.person) ?? s.people.find((p) => p.id === s.mainId) ?? s.people[0];
  if (who) {
    const folk: [string, string][] = s.people.map((p) => [String(p.id), `${p.name}${p.id === s.mainId ? ' (founder)' : ''} · Lv ${p.level}${p.downed ? ' · down' : ''}`]);
    out.push(row(pick(folk, String(who.id), (v) => (picked.person = Number(v)))));
    out.push(
      row(
        go('Kill', { op: 'kill', target: 'person', id: who.id }, { danger: true }),
        go('Knock down', { op: 'down', id: who.id }, { disabled: !!who.downed }),
        go('Heal', { op: 'heal', id: who.id }),
        go('+1 level', { op: 'levelUp', id: who.id, levels: 1 }),
      ),
    );
  }
  out.push(note('Or tap someone, a building or a raider on the map: its card has a Dev… button.'));

  out.push(el('h2', '', 'Events'));
  const events = [...EVENTS].sort((a, b) => a.title.localeCompare(b.title));
  if (!picked.event) picked.event = events[0]?.id ?? '';
  out.push(row(pick(events.map((e) => [e.id, `${e.title.replace(/\{[^}]*\}/g, '…')} (${e.id})`] as [string, string]), picked.event, (v) => (picked.event = v))));
  out.push(row(go('Put it to the town', { op: 'event', id: picked.event }, { disabled: !picked.event })));

  out.push(el('h2', '', 'Sagas'));
  out.push(row(go('Begin the God creature saga', { op: 'creatureSaga' }, { disabled: !!s.creature })));

  out.push(el('h2', '', 'Disasters'));
  out.push(row(...(['flood', 'wildfire', 'tornado', 'quake'] as const).map((k) => go(k[0].toUpperCase() + k.slice(1), { op: 'disaster', kind: k }, { disabled: !!s.disaster, danger: true }))));

  out.push(el('h2', '', 'The land'));
  out.push(row(go('Reveal the whole land', { op: 'reveal' })));
  return out;
}

/** The menu's own look: buttons a finger can hit, wrapping on a narrow screen. */
export function ensureDevStyle(): void {
  if (document.getElementById('dev-style')) return;
  const st = document.createElement('style');
  st.id = 'dev-style';
  st.textContent = `
.dev-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; align-items: center; }
.dev-row .dev-btn { min-height: 40px; min-width: 64px; flex: 1 1 auto; margin: 0; }
.dev-btn.danger { border-color: #c0392b; color: #ffb3a7; }
.dev-select { min-height: 40px; flex: 1 1 100%; max-width: 100%; font: inherit; padding: 4px 6px; }
.dev-note { opacity: 0.8; font-size: 0.9em; margin: 4px 0; }
`;
  document.head.append(st);
}
