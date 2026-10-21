// The founder's card (the player's character): their portrait, name, calling, purse, gear, health and what they are
// doing, and five actions: Go to, Work at, Give to the town, Rest and Name an heir (sim/founder.ts). Go to is done on
// the map: tap a building, then "Send the founder here" (main.ts).

import { ITEM_BY_ID, SLOT_NAMES, SLOTS } from '../../shared/data/items';
import { JOB_NAMES } from '../../shared/data/people';
import { GIVE_STEPS } from '../../shared/sim/founder';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { Bridge } from '../../shared/ipc';
import { itemIcon } from '../art/icons';
import { button, el } from './dom';
import { face } from './townsfolkPanel';

/** The redraw key: anything the card shows or a button changes. */
export function founderKey(s: Snapshot): string {
  const f = s.people.find((p) => p.id === s.mainId);
  if (!f || !s.founder) return 'none';
  return [f.name, f.clsName, f.level, Math.round(f.hp), f.maxHp, Math.round(f.morale), f.coins, f.doing, s.founder.order, s.founder.heir?.id, s.founder.heir?.named, s.founder.heirs.map((h) => h.id).join(','), Object.values(f.gear).join(','), s.coins].join('|');
}

export function renderFounder(s: Snapshot, bridge: Bridge): HTMLElement[] {
  const f = s.people.find((p) => p.id === s.mainId);
  const v = s.founder;
  if (!f || !v) return [el('p', 'empty', 'There is no founder.')];
  const out: HTMLElement[] = [];

  const head = el('div', 'founder-head');
  head.style.cssText = 'display:flex;gap:12px;align-items:center';
  const who = el('div');
  who.append(el('b', '', f.name), el('div', 'hint', f.clsName ? `${f.clsName} · level ${f.level}` : f.typeName), el('div', '', f.doing));
  head.append(face(f, s), who);
  out.push(head);

  out.push(el('div', 'lock', `Health ${Math.round(f.hp)}/${f.maxHp} · Morale ${Math.round(f.morale)} · Purse ${f.coins ?? 0} coins`));
  if (v.order) out.push(el('div', 'hint', `Told to: ${v.order.charAt(0).toLowerCase()}${v.order.slice(1)}.`));

  const kit = el('div', 'founder-kit');
  for (const slot of SLOTS) {
    const id = f.gear[slot];
    const def = id ? ITEM_BY_ID[id] : undefined;
    if (!def) continue;
    const row = el('div', 'founder-gear');
    row.style.cssText = 'display:flex;gap:6px;align-items:center';
    row.append(itemIcon(def, 1), el('span', '', def.name), el('small', '', SLOT_NAMES[slot]));
    kit.append(row);
  }
  if (!kit.childElementCount) kit.append(el('div', 'hint', 'Nothing worn or carried yet.'));
  out.push(el('h2', '', 'Gear'), kit);

  out.push(el('h2', '', 'Go to'));
  out.push(el('div', 'hint', 'Tap a building on the map, then “Send the founder here”.'));
  out.push(button('Back to the map', () => bridge.closePanel?.()));

  out.push(el('h2', '', 'Work at'));
  out.push(el('div', 'hint', 'Pick a job for the day. If there is none to do, they carry on as usual.'));
  const jobs = el('div', 'founder-jobs');
  jobs.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const j of v.jobs) jobs.append(button(JOB_NAMES[j], () => bridge.command({ type: 'founderWork', job: j })));
  if (v.order?.startsWith('Working')) jobs.append(button('The town’s choice', () => bridge.command({ type: 'founderWork', job: null })));
  out.push(jobs);

  out.push(el('h2', '', 'Give to the town'));
  out.push(el('div', 'hint', `The treasury holds ${s.coins ?? 0} coins.`));
  const gifts = el('div', 'founder-gifts');
  gifts.style.cssText = 'display:flex;gap:6px';
  for (const n of GIVE_STEPS) gifts.append(button(`${n} coins`, () => bridge.command({ type: 'founderGive', amount: n }), { disabled: (f.coins ?? 0) < 1 }));
  out.push(gifts);

  out.push(el('h2', '', 'Rest'));
  out.push(el('div', 'hint', 'Go home to heal and lift their spirits.'));
  out.push(button('Rest at home', () => bridge.command({ type: 'founderRest' })));

  out.push(el('h2', '', 'Name an heir'));
  out.push(el('div', 'hint', v.heir ? `${v.heir.name} would lead after you${v.heir.named ? ' (named)' : ''}. With no grown child, partner or named heir, the game ends when you die.` : 'You have no heir. With no grown child, partner or named heir, the game ends when you die.'));
  const heirs = el('div', 'founder-heirs');
  heirs.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  for (const h of v.heirs.slice(0, 12)) {
    const named = v.heir?.named && v.heir.id === h.id;
    heirs.append(button(`${h.name}${h.role === 'other' ? '' : ` (${h.role === 'child' ? 'child' : 'partner'})`}${named ? ' ✓' : ''}`, () => bridge.command({ type: 'founderHeir', person: named ? null : h.id })));
  }
  if (!v.heirs.length) heirs.append(el('div', 'hint', 'No grown-ups to name.'));
  out.push(heirs);
  return out;
}
