// Townsfolk panel: the wanderer waiting to be let in, the job priority grid, and everyone's details.

import { ITEM_BY_ID, SLOT_NAMES, SLOTS } from '../../shared/data/items';
import { FOOD_VALUE, JOB_NAMES, JOBS, PRIORITY_NAMES, type Priority } from '../../shared/data/people';
import { itemIcon } from '../art/icons';
import { CLASS_DEFS } from '../../shared/data/classes';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { MONSTER_NAMES, ORDER_NAMES, type MonsterKind, type StandingOrder } from '../../shared/data/monsters';
import { SKILL_NAMES, SKILLS } from '../../shared/data/skills';
import type { Bridge } from '../../shared/ipc';
import type { PersonView, Snapshot, VisitorView } from '../../shared/sim/snapshot';
import { bleedLeft } from '../../shared/format';
import { button, el } from './dom';

/** Changes whenever something this panel shows changes (needs and morale to the whole percent). */
export const townsfolkKey = (s: Snapshot) =>
  JSON.stringify([
    s.people.map((p) => [p.id, p.doing, p.order, p.sick, p.gear, p.bedroll, p.carryCapacity, p.partner, p.married, p.friends, p.rivals, p.growsUpIn !== null && Math.ceil(p.growsUpIn / 24), Math.round(p.hp), p.downed, p.bleedMinutes, Math.round(p.morale), Math.round(p.moodTarget), Math.round(p.needs.food * 100), Math.round(p.needs.rest * 100), p.priorities, p.autoPriorities, p.bed, SKILLS.map((k) => [p.skills[k].level, Math.floor(p.skills[k].progress * 10)])]),
    s.visitor && [s.visitor.id, Math.ceil(s.visitor.hoursLeft), s.visitor.leaving],
    s.housing,
    s.prisoners.map((p) => [p.id, Math.floor(p.conviction * 100), p.hungry]),
    s.stock.berries,
    s.stock.meat,
    Math.round((Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (s.stock[m] ?? 0) * v, 0)),
    s.people.map((p) => [p.cls, p.monster]),
    s.turnable,
    confirmTurn,
    s.research.done.length,
    s.people.map((p) => p.trainable.map((c) => c.reason)), // (what's missing for a calling changes with the town)
  ]);

/** High -> Normal -> Low -> Off -> High. */
const NEXT: Record<Priority, Priority> = { 1: 2, 2: 3, 3: 0, 0: 1 };

export function renderTownsfolk(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const out: HTMLElement[] = [];
  const head = el('div', 'panel-head');
  const food = (s.stock.berries ?? 0) + (s.stock.meat ?? 0);
  head.append(el('span', '', `People ${s.housing.people} · Beds ${s.housing.beds}`), el('span', '', `Food in storage: ${food}`));
  out.push(head);
  if (s.housing.beds <= s.housing.people && !s.visitor) {
    out.push(el('div', 'hint', 'Wanderers only come while a bed is free. Build a Lean-to (Basic Shelter research).'));
  }
  if (s.visitor) out.push(visitorCard(s.visitor, s));

  out.push(el('h2', '', 'Jobs'));
  out.push(priorityGrid(s, bridge));
  out.push(el('div', 'hint', 'Click a cell to cycle High, Normal, Low, Off. People do High jobs first. Auto sets them from skills. Defend: when raiders come, anyone not set to Off fights; the rest shelter (safest in a bed).'));

  out.push(el('h2', '', 'People'));
  if (s.turnable.length) out.push(turningRow(s, bridge));
  for (const p of s.people) {
    const card = personCard(p, p.id === s.mainId);
    card.append(classRow(p, bridge));
    const turn = turnButtons(p, s, bridge);
    if (turn) card.append(turn);
    if (p.monster) card.append(orderRow(p, bridge));
    out.push(card);
  }

  if (s.prisoners.length) {
    out.push(el('h2', '', 'Prisoners'));
    out.push(el('div', 'hint', 'Taken in raids. They eat a ration a day and may slip away; in time they come round and join the town (faster with someone good at Social).'));
    for (const pr of s.prisoners) {
      const c = el('div', 'card person');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', pr.name), el('span', 'card-size', `once a ${pr.was.toLowerCase()}${pr.hungry ? ' · hungry' : ''}`));
      c.append(top, bar('Won over', pr.conviction, `${Math.floor(pr.conviction * 100)}%`), button('Set free', () => bridge?.command({ type: 'releasePrisoner', prisoner: pr.id }), { cls: 'place small quiet' }));
      out.push(c);
    }
  }
  return out;
}

function visitorCard(v: VisitorView, s: Snapshot): HTMLElement {
  const c = el('div', 'card arrival');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${v.name}, ${v.typeName.toLowerCase()}`), el('span', 'card-size', v.leaving ? 'Leaving' : `Leaves in ${Math.ceil(v.hoursLeft)}h`));
  c.append(el('div', 'lock', 'Is at the edge of town and asks to join.'), top, skillsList(v), traitsList(v));
  if (v.cls) c.append(el('div', 'lock short', `A rare ${CLASS_DEFS[v.cls].name}: ${CLASS_DEFS[v.cls].description}`));
  if (!v.leaving) {
    // (the town lets newcomers in itself, when a bed is free for them)
    const noBed = s.housing.beds <= s.housing.people;
    c.append(el('div', noBed ? 'lock short' : 'lock', noBed ? 'No free bed yet: the town will let them in once a home is built (or they move on).' : 'The town is letting them in.'));
    // another mouth to feed, when the stores are thin
    const eaters = s.people.filter((p) => p.monster !== 'undead' && p.away === null).length + 1;
    const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (s.stock[m] ?? 0) * v, 0);
    // (only when it's dire: a small town needs every pair of hands it can get)
    if (food / eaters < 1) c.append(el('div', 'lock short', `Food is very short: with them, stores last everyone ${(food / eaters).toFixed(1)} days. Another pair of hands can gather or farm, though.`));
  }
  return c;
}

function priorityGrid(s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const t = el('table', 'grid');
  const hr = el('tr');
  hr.append(el('th', '', ''), el('th', '', 'Auto'), ...JOBS.map((j) => el('th', '', JOB_NAMES[j])));
  t.append(hr);
  for (const p of s.people) {
    const tr = el('tr');
    tr.append(el('td', 'grid-name', p.name));
    if (p.growsUpIn !== null) {
      const td = el('td', 'lock', 'Too young to work');
      td.colSpan = JOBS.length + 1;
      tr.append(td);
      t.append(tr);
      continue;
    }
    const auto = el('input');
    auto.type = 'checkbox';
    auto.checked = p.autoPriorities;
    auto.title = 'Set priorities from skills';
    auto.addEventListener('change', () => bridge?.command({ type: 'setAutoPriorities', person: p.id, on: auto.checked }));
    const at = el('td');
    at.append(auto);
    tr.append(at);
    for (const job of JOBS) {
      const pr = p.priorities[job];
      const td = el('td');
      td.append(
        button(PRIORITY_NAMES[pr], () => bridge?.command({ type: 'setPriority', person: p.id, job, priority: NEXT[pr] }), {
          cls: `prio p${pr}${p.autoPriorities ? ' auto' : ''}`,
        }),
      );
      tr.append(td);
    }
    t.append(tr);
  }
  return t;
}

function personCard(p: PersonView, isMain: boolean): HTMLElement {
  const c = el('div', 'card person');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${p.name}${isMain ? ' (you)' : ''}`), el('span', 'card-size', `${p.typeName} · ${p.bed ? `bed: ${p.bed}` : 'no bed'}`));
  c.append(top, el('div', 'lock', p.doing));

  const bars = el('div', 'bars');
  bars.append(
    bar('Morale', p.morale / 100, `${Math.round(p.morale)} → ${Math.round(p.moodTarget)}`),
    bar('Health', p.hp / p.maxHp, p.downed ? (p.downed === 'bleeding' ? `bleeding out: ${bleedLeft(p.bleedMinutes)} left!` : 'down, recovering') : `${Math.round(p.hp)}/${p.maxHp}`),
    bar('Food', p.needs.food, ''),
    bar('Rest', p.needs.rest, ''),
  );
  c.append(bars);
  if (p.moodReasons.length) {
    const reasons = el('div', 'reasons');
    for (const r of p.moodReasons) reasons.append(el('span', r.value >= 0 ? 'good' : 'bad', `${r.text} ${r.value > 0 ? '+' : ''}${r.value}`));
    c.append(reasons);
  }
  c.append(skillsList(p), traitsList(p), gearRow(p));
  const ties = relationsText(p);
  if (ties) c.append(el('div', 'lock', ties));
  return c;
}

/** What each curse gives and takes (the turning is hidden until a lich, vampire or werewolf is in town). */
const CURSES: Record<MonsterKind, { name: string; gifts: string }> = {
  undead: { name: 'undead', gifts: 'Never hungry or tired, immune to sickness and smog, ignored by the walking dead. But they heal slowly, never marry, unsettle the living, and a town of the dead draws few wanderers.' },
  vampire: { name: 'a vampire', gifts: 'Hardier, and they work best by night. But they must feed on the living (or prisoners), and go thirsty without.' },
  werewolf: { name: 'a werewolf', gifts: 'Hardier, and they hit harder. But on full moons they maul the living; with none left, the pack hunts for meat.' },
};
/** A whole-town turning waits for a second click. */
let confirmTurn: MonsterKind | null = null;

function turningRow(s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const box = el('div', 'card arrival');
  box.append(el('div', 'lock', 'The dark gift can be passed on. Every monster in town angers the Hunter\'s Guild.'));
  for (const k of s.turnable) {
    const row = el('div', 'row');
    const living = s.people.filter((p) => !p.monster && p.growsUpIn === null && p.id !== s.mainId).length;
    const sure = confirmTurn === k;
    row.append(
      button(sure ? `Yes: turn all ${living}` : `Turn the whole town into ${CURSES[k].name}…`, () => {
        if (sure) {
          bridge?.command({ type: 'turnTown', kind: k });
          confirmTurn = null;
        } else confirmTurn = k;
      }, { cls: sure ? 'place small on' : 'place small quiet', disabled: !living, title: CURSES[k].gifts }),
    );
    if (sure) row.append(button('Cancel', () => (confirmTurn = null), { cls: 'place small quiet' }));
    box.append(row, el('div', 'lock short', CURSES[k].gifts));
  }
  return box;
}

/** Turn one person (the living, grown, not the founder). */
function turnButtons(p: PersonView, s: Snapshot, bridge: Bridge | undefined): HTMLElement | null {
  if (!s.turnable.length || p.monster || p.growsUpIn !== null || p.id === s.mainId) return null;
  const row = el('div', 'row');
  for (const k of s.turnable) row.append(button(`Turn into ${CURSES[k].name}`, () => bridge?.command({ type: 'turnPerson', person: p.id, kind: k }), { cls: 'place small quiet', title: CURSES[k].gifts }));
  return row;
}

/** Their special class, or the classes the town has studied that they could train in. */
function classRow(p: PersonView, bridge: Bridge | undefined): HTMLElement {
  const row = el('div', 'row');
  if (p.cls) {
    const def = CLASS_DEFS[p.cls];
    row.append(el('span', 'chip', def.name), el('span', 'lock', def.description));
    return row;
  }
  if (p.growsUpIn !== null) return row;
  // (a calling is rare: one of each in a town, a master of its skill, and a deed done first; the button says
  // what's still missing)
  for (const { cls: k, reason } of p.trainable) {
    const def = CLASS_DEFS[k];
    const cost = (Object.entries(def.cost) as [Material, number][]).map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`).join(', ');
    row.append(
      button(`Train as ${def.name}`, () => bridge?.command({ type: 'trainClass', person: p.id, cls: k }), {
        cls: 'place small quiet',
        disabled: reason !== null,
        title: `${def.description} Needs ${SKILL_NAMES[def.skill]} ${def.level}. ${def.deedText} Uses ${cost}. Only one in a town.${reason ? `\nNot yet: ${reason}.` : ''}`,
      }),
    );
  }
  return row;
}

/** A monster's standing order for the Hunter's Guild. */
function orderRow(p: PersonView, bridge: Bridge | undefined): HTMLElement {
  const row = el('div', 'row');
  row.append(el('span', 'lock short', `${MONSTER_NAMES[p.monster as MonsterKind] ?? 'Monster'}. If the Hunter's Guild comes:`));
  for (const [id, name] of Object.entries(ORDER_NAMES) as [StandingOrder, string][]) {
    row.append(button(name, () => bridge?.command({ type: 'setOrder', person: p.id, order: id }), { cls: p.order === id ? 'place small on' : 'place small quiet' }));
  }
  return row;
}

function relationsText(p: PersonView): string {
  const parts: string[] = [];
  if (p.growsUpIn !== null) parts.push(`A child: grows up in ${Math.ceil(p.growsUpIn / 24)} game days`);
  if (p.partner) parts.push(`${p.married ? 'Married to' : 'Together with'} ${p.partner}`);
  if (p.friends.length) parts.push(`Friends: ${p.friends.join(', ')}`);
  if (p.rivals.length) parts.push(`Can't stand: ${p.rivals.join(', ')}`);
  return parts.join(' · ');
}

/** What they wear (handed out automatically: see the Crafting panel for spares). */
function gearRow(p: PersonView): HTMLElement {
  const g = el('div', 'gear');
  const worn = SLOTS.filter((slot) => p.gear[slot]);
  if (!worn.length) g.append(el('span', '', 'No gear'));
  for (const slot of worn) {
    const def = ITEM_BY_ID[p.gear[slot]!];
    const icon = itemIcon(def, 2);
    icon.title = `${SLOT_NAMES[slot]}: ${def.name} (${def.description})`;
    g.append(icon);
  }
  if (p.bedroll) g.append(el('span', '', 'Sleeps on a bedroll'));
  g.append(el('span', '', `Carries ${p.carryCapacity}`));
  return g;
}

function skillsList(p: PersonView): HTMLElement {
  const g = el('div', 'skills');
  for (const k of SKILLS) {
    const sk = p.skills[k];
    const cell = el('div', sk.level >= 6 ? 'skill good' : sk.level <= 1 ? 'skill weak' : 'skill');
    cell.append(el('span', '', `${SKILL_NAMES[k]}${sk.passion ? ' ★' : ''}`), el('span', 'lvl', String(sk.level)));
    cell.title = sk.passion ? 'Passion: learns this 50% faster' : '';
    g.append(cell);
  }
  return g;
}

function traitsList(p: PersonView): HTMLElement {
  const d = el('div', 'traits');
  for (const t of p.traits) {
    const s = el('span', 'chip', t.name);
    s.title = t.description;
    d.append(s);
  }
  return d;
}

function bar(label: string, value: number, text: string): HTMLElement {
  const r = el('div', 'bar-row');
  const b = el('div', 'bar');
  const f = el('div', value < 0.25 ? 'bar-fill low' : 'bar-fill');
  f.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  b.append(f);
  r.append(el('span', 'bar-label', label), b, el('span', 'bar-text', text));
  return r;
}
