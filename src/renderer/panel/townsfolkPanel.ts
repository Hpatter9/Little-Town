// Townsfolk panel: the wanderer waiting to be let in, everyone in a short row each, and the job priority grid. Tap
// someone to inspect them: their picture in what they wear, their gear laid out as in Diablo (each piece in its slot
// round them, tap one for its stats), what they carry, how they fight, and everything else about them.

import { mapBeside, showOnMap } from './townOverview';
import { hkDraw, hkLayers, hkWhoOf, onHkLoad } from '../art/hkFolk';
import { pieceLabel, plusOf, qualityOf } from '../../shared/data/quality';
import { ITEM_BY_ID, SLOT_NAMES, SLOTS, type Slot } from '../../shared/data/items';
import { MATERIAL_NAMES } from '../../shared/data/materials';
import { stockIcon } from '../art/materialIcons';
import { CENTRE_X, FEET_Y, FRAME_SIZE, loadLpc, lpcCanvas } from '../art/lpc/lpcCompose';
import { heldWeapon, wardrobe, wornLayers } from '../art/held';
import { FOOD_VALUE, JOB_NAMES, JOBS, PRIORITY_NAMES, type Priority } from '../../shared/data/people';
import { itemIcon } from '../art/icons';
import { emblemCanvas } from '../art/emblems';
import { CLASS_DEFS, STAGE_LEVELS } from '../../shared/data/classes';
import { ATTR_ABOUT, ATTR_KEYS, ATTR_NAMES } from '../../shared/data/attributes';
import { WEIGHT_NAMES } from '../../shared/data/armour';
import { FAMILIES } from '../../shared/data/weapons';
import type { Material } from '../../shared/data/materials';
import { MONSTER_NAMES, ORDER_NAMES, type MonsterKind, type StandingOrder } from '../../shared/data/monsters';
import { SKILL_NAMES, SKILLS } from '../../shared/data/skills';
import { SKILL_TEXT } from '../../shared/data/describe';
import { CLASS_ABOUT, ROLE_ABOUT } from '../../shared/data/classAbout';
import type { Bridge } from '../../shared/ipc';
import type { PersonView, Snapshot, VisitorView } from '../../shared/sim/snapshot';
import { bleedLeft } from '../../shared/format';
import { button, el } from './dom';
import { itemStats } from './details';

/** Changes whenever something this panel shows changes (needs and morale to the whole percent). */
export const townsfolkKey = (s: Snapshot) =>
  JSON.stringify([
    s.people.map((p) => [p.id, p.job, p.doing, p.detail, p.recent, p.order, p.sick, p.gear, p.gearQ, p.coins, p.owns, p.debt, p.income, p.bedroll, p.carryCapacity, p.partner, p.married, p.friends, p.rivals, p.enemies, p.devoted, p.body.wounds, p.body.lasting, p.body.fitted, p.growsUpIn !== null && Math.ceil(p.growsUpIn / 24), Math.round(p.hp), p.downed, p.bleedMinutes, Math.round(p.morale), Math.round(p.moodTarget), Math.round(p.needs.food * 100), Math.round(p.needs.rest * 100), p.priorities, p.autoPriorities, p.bed, SKILLS.map((k) => [p.skills[k].level, Math.floor(p.skills[k].progress * 10)])]),
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
    s.people.map((p) => [p.clsName, p.stage, p.level, Math.round(p.levelProgress * 20), p.away, p.battle, p.kit.length, p.carrying]),
    inspecting,
    chosenSlot,
    chosenSkill, // (a tapped skill, spell or trait opens its card: the tap must redraw)
    classOpen,
    s.theme,
    lpcLoaded,
  ]);

/** Who's being inspected (null: the list), and the slot whose piece is shown below their gear. */
let inspecting: number | null = null;
let chosenSlot: Slot | null = null;
/** Whose class path is open (tapped on their class). */
let classOpen: number | null = null;

/** High -> Normal -> Low -> Off -> High. */
const NEXT: Record<Priority, Priority> = { 1: 2, 2: 3, 3: 0, 0: 1 };

export function renderTownsfolk(s: Snapshot, bridge: Bridge | undefined, rerender: () => void = () => undefined): HTMLElement[] {
  startLpc(rerender);
  const who = inspecting === null ? undefined : s.people.find((p) => p.id === inspecting);
  if (who) return inspectView(who, s, bridge, rerender);
  inspecting = null;

  const out: HTMLElement[] = [];
  const head = el('div', 'panel-head');
  const food = (s.stock.berries ?? 0) + (s.stock.meat ?? 0);
  head.append(el('span', '', `People ${s.housing.people} · Beds ${s.housing.beds}`), el('span', '', `Food in storage: ${food}`));
  out.push(head);
  if (s.housing.beds <= s.housing.people && !s.visitor) {
    out.push(el('div', 'hint', 'Wanderers only come while a bed is free. Build a Lean-to (Basic Shelter research).'));
  }
  if (s.visitor) out.push(visitorCard(s.visitor, s, bridge));

  out.push(el('h2', '', 'People'));
  if (s.turnable.length) out.push(turningRow(s, bridge));
  const list = el('div', 'folk-list');
  for (const p of s.people) list.append(folkRow(p, s, () => {
    inspecting = p.id;
    chosenSlot = null;
    listScroll = scroller()?.scrollTop ?? 0;
    rerender();
    const box = scroller();
    if (box) box.scrollTop = 0;
  }));
  out.push(list);

  out.push(el('h2', '', 'Jobs'));
  out.push(priorityGrid(s, bridge));
  out.push(el('div', 'hint', 'Click a cell to cycle High, Normal, Low, Off. People do High jobs first. Auto sets them from skills. Defend: when raiders come, anyone not set to Off fights; the rest shelter (safest in a bed).'));

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

/** The menu's scrolling body, and where the list was scrolled to before someone was inspected. */
const scroller = () => document.getElementById('body');
let listScroll = 0;

/* ------------------------------------------------------------ the list */

/** One short row: their face, name, calling and level, what they're up to, their health and spirits, and any
 *  trouble. Tap for the rest. */
function folkRow(p: PersonView, s: Snapshot, open: () => void): HTMLElement {
  const row = el('button', 'folk-row');
  row.addEventListener('click', open);
  row.append(face(p, s));
  const mid = el('span', 'folk-mid');
  const name = el('span', 'folk-name', `${p.name}${p.id === s.mainId ? ' (you)' : ''}`);
  const what = el('span', 'folk-class', `${p.job ? `${p.job.title} · ` : ''}${p.natureName} · ${p.cls ? `${p.clsName} · Lv ${p.level}` : p.growsUpIn !== null ? 'Child' : `${p.typeName} · Lv ${p.level}`} · ${p.ageYears}y${p.elder ? ' · Elder' : ''}${p.coins !== null ? ` · ● ${p.coins}` : ''}${p.owns.length ? ' · 🏠' : ''}`);
  const doing = el('span', 'folk-doing', p.away !== null ? `Away: ${p.away}` : p.doing);
  mid.append(name, what, doing);
  const right = el('span', 'folk-right');
  right.append(miniBar(p.hp / p.maxHp, 'hp'), miniBar(p.morale / 100, 'mood'));
  const flag = p.downed === 'bleeding' ? 'Bleeding!' : p.downed ? 'Down' : p.breakdown ? 'Upset' : p.sick ? 'Sick' : p.needs.food < 0.15 ? 'Hungry' : p.needs.rest < 0.15 ? 'Worn out' : '';
  if (flag) right.append(el('span', 'folk-flag', flag));
  row.append(mid, right, el('span', 'folk-go', '›'));
  return row;
}

function miniBar(value: number, kind: 'hp' | 'mood'): HTMLElement {
  const b = el('span', `mini-bar ${kind}`);
  const f = el('span', value < 0.25 ? 'low' : '');
  f.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  b.title = kind === 'hp' ? 'Health' : 'Morale';
  b.append(f);
  return b;
}

/* ------------------------------------------------------------ inspecting someone */

/** The inspect page's tabs (the owner's ask), and the one open (kept while the panel redraws and between people). */
type InspectTab = 'equipment' | 'character' | 'background' | 'skills';
const INSPECT_TABS: [InspectTab, string][] = [
  ['equipment', 'Equipment'],
  ['character', 'Character'],
  ['background', 'Background'],
  ['skills', 'Skills'],
];
let inspectTab: InspectTab = 'equipment';
/** The skill, spell or trait tapped on the Skills or Character tab, whose card shows under the list. */
let chosenSkill: string | null = null;

function inspectView(p: PersonView, s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement[] {
  const back = button('‹ Everyone', () => {
    inspecting = null;
    rerender();
    const box = scroller();
    if (box) box.scrollTop = listScroll;
  }, { cls: 'place small quiet back-btn' });

  // who they are, over every tab
  const card = el('div', 'card person inspect');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${p.name}${p.id === s.mainId ? ' (you)' : ''}`), el('span', 'card-size', `${p.typeName} · ${p.bed ? `bed: ${p.bed}` : 'no bed'}`));
  card.append(top, el('div', 'lock', p.away !== null ? `Away on an expedition: ${p.away}` : p.doing));
  card.append(classRow(p, bridge, rerender));
  // (on the phone, the map beside the menu: go and look at them there)
  if (p.away === null && mapBeside()) card.append(button('Show on the map', () => showOnMap(bridge, { person: p.id }), { cls: 'place small quiet' }));

  const tabs = el('div', 'row inv-tabs inspect-tabs');
  for (const [k, name] of INSPECT_TABS) {
    const b = el('button', `inv-tab${inspectTab === k ? ' on' : ''}`, name);
    b.addEventListener('click', () => {
      inspectTab = k;
      chosenSkill = null;
      rerender();
    });
    tabs.append(b);
  }

  const body = el('div', `inspect-body tab-${inspectTab}`);
  if (inspectTab === 'equipment') equipmentTab(p, s, rerender, body);
  else if (inspectTab === 'character') characterTab(p, bridge, rerender, body);
  else if (inspectTab === 'background') backgroundTab(p, s, body);
  else skillsTab(p, rerender, body);

  const out: HTMLElement[] = [back, card, tabs, body];
  const turn = turnButtons(p, s, bridge);
  if (turn) out.push(turn);
  if (p.monster) out.push(orderRow(p, bridge));
  return out;
}

/** Their gear, Diablo-style, the piece picked, and what they carry. */
function equipmentTab(p: PersonView, s: Snapshot, rerender: () => void, out: HTMLElement): void {
  const left = el('div', 'inspect-col');
  left.append(paperDoll(p, s, rerender));
  const right = el('div', 'inspect-col');
  right.append(pieceCard(p), el('h2', '', 'Inventory'), bag(p));
  out.append(left, right);
}

/** How they'd fight, their body and spirits, and their traits. */
function characterTab(p: PersonView, bridge: Bridge | undefined, rerender: () => void, out: HTMLElement): void {
  const left = el('div', 'inspect-col');
  left.append(el('h2', '', 'In a fight'), fightCard(p, bridge));
  const right = el('div', 'inspect-col');
  right.append(el('h2', '', 'Health and spirits'));
  const life = el('div', 'card person');
  const bars = el('div', 'bars');
  bars.append(
    bar('Health', p.hp / p.maxHp, p.downed ? (p.downed === 'bleeding' ? `bleeding out: ${bleedLeft(p.bleedMinutes)} left!` : 'down, recovering') : `${Math.round(Math.min(p.hp, p.maxHp))}/${p.maxHp}`),
    bar('Morale', p.morale / 100, `${Math.round(p.morale)} → ${Math.round(p.moodTarget)}`),
    // (the dead and machines have no hunger or weariness to show)
    ...(p.tireless ? [] : [bar('Food', p.needs.food, ''), bar('Rest', p.needs.rest, '')]),
  );
  if (p.tireless) life.append(el('div', 'lock short', 'Needs neither food nor sleep.'));
  life.append(bars);
  if (p.breakdown) life.append(el('div', 'lock short', p.breakdown));
  if (p.sick) life.append(el('div', 'lock short', 'Sick.'));
  // their body: wounds, lasting harm, prosthetics, and what they can still do (sim/injuries.ts)
  const b = p.body;
  if (b.wounds.length) life.append(el('div', 'lock short', `Wounds: ${b.wounds.join(', ')}`));
  if (b.lasting.length) life.append(el('div', 'lock', `For good: ${b.lasting.join(', ')}`));
  if (b.fitted.length) life.append(el('div', 'purpose', `Fitted: ${b.fitted.join(', ')}`));
  if (b.wounds.length || b.lasting.length) {
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    life.append(el('div', 'hint', `Sight ${pct(b.sight)} · Hands ${pct(b.handling)} · Moving ${pct(b.moving)}${b.pain > 0.04 ? ` · Pain ${pct(b.pain)}` : ''}`));
  }
  if (p.moodReasons.length) {
    const reasons = el('div', 'reasons');
    for (const r of p.moodReasons) reasons.append(el('span', r.value >= 0 ? 'good' : 'bad', `${r.text} ${r.value > 0 ? '+' : ''}${r.value}`));
    life.append(reasons);
  }
  right.append(life);
  if (p.traits.length) {
    right.append(el('h2', '', 'Traits'));
    const tc = el('div', 'card person');
    tc.append(traitsList(p, rerender));
    const t = p.traits.find((x) => `trait:${x.name}` === chosenSkill);
    if (t) tc.append(infoCard(t.name, 'Trait', t.description));
    right.append(tc);
  }
  out.append(left, right);
}

/** Who they are and where they came from: their age and people, nature, ambition, job, purse and ties, and lately. */
function backgroundTab(p: PersonView, s: Snapshot, out: HTMLElement): void {
  const left = el('div', 'inspect-col');
  left.append(el('h2', '', 'Who they are'));
  const who = el('div', 'card person');
  // their own story first (data/backstories.ts)
  if (p.story) who.append(el('div', 'story', p.story));
  if (p.titles.length) who.append(el('div', 'story titles', `Called ${p.titles.join(', ')}, for the sagas.`));
  // (a special newcomer's secret, once the town knows it: sim/specials.ts)
  if (p.secret) who.append(el('div', 'story secret', `${p.secret.name}.`));
  if (p.ageText) who.append(el('div', 'lock', p.ageText));
  who.append(el('div', 'purpose', `${p.natureName}: ${p.natureLine}`));
  if (p.ambition) who.append(el('div', 'purpose', `Wants to be ${p.ambition.name.toLowerCase()}: ${p.ambition.line}`));
  if (p.trips) who.append(el('div', 'hint', `Trips made: ${p.trips}`));
  for (const d of p.detail) who.append(el('div', 'hint', d));
  if (p.id === s.mainId) who.append(el('div', 'hint', 'The founder: turns their hand to any work, building and study first.'));
  left.append(who);
  const right = el('div', 'inspect-col');
  const ties = relationsText(p);
  right.append(el('h2', '', 'Life'));
  const lifeCard = el('div', 'card person');
  if (ties) lifeCard.append(el('div', 'lock', ties));
  for (const r of p.recent.slice(0, 8)) lifeCard.append(el('div', 'hint', r));
  if (!ties && !p.recent.length) lifeCard.append(el('div', 'hint', 'Nothing much has happened to them yet.'));
  right.append(lifeCard);
  out.append(left, right);
}

/** Their work skills, spells, fighting skills and passives: tap one to see what it does. */
function skillsTab(p: PersonView, rerender: () => void, out: HTMLElement): void {
  const left = el('div', 'inspect-col');
  left.append(el('h2', '', 'Work skills'));
  const wc = el('div', 'card person');
  wc.append(el('div', 'hint', 'What they are good at, they do first; anything else, when there is work to be done. Tap a skill to see what it does.'));
  wc.append(skillsList(p, rerender));
  const k = SKILLS.find((x) => `skill:${x}` === chosenSkill);
  if (k) {
    const sk = p.skills[k];
    wc.append(infoCard(SKILL_NAMES[k], `Level ${sk.level}${sk.passion ? ' · passion: learns it 50% faster' : ''}`, SKILL_TEXT[k]));
  }
  left.append(wc);
  const right = el('div', 'inspect-col');
  right.append(el('h2', '', 'Spells and fighting skills'));
  const fc = el('div', 'card person');
  if (p.kit.length || p.passives.length) {
    const kit = el('div', 'kit');
    for (const a of p.kit) {
      const ult = a.pool === 'limit';
      const id = `act:${a.name}`;
      const c = el('button', `chip ${ult ? 'ult' : a.spell ? 'spell' : 'skill'}${chosenSkill === id ? ' on' : ''}`, `${ult ? '★' : a.spell ? '✦' : '⚔'} ${a.name}`);
      c.addEventListener('click', () => pick(id, rerender));
      kit.append(c);
    }
    for (const a of p.passives) {
      const id = `pas:${a.name}`;
      const c = el('button', `chip passive${chosenSkill === id ? ' on' : ''}`, `◇ ${a.name}`);
      c.addEventListener('click', () => pick(id, rerender));
      kit.append(c);
    }
    fc.append(el('div', 'hint', '✦ spell · ⚔ skill · ★ ultimate · ◇ always on. Tap one to see what it does.'), kit);
    const a = p.kit.find((x) => `act:${x.name}` === chosenSkill);
    if (a) {
      const ult = a.pool === 'limit';
      const kind = ult ? 'Ultimate' : a.spell ? 'Spell' : 'Skill';
      const cost = ult ? 'costs the full limit gauge' : `costs ${a.cost} ${a.pool === 'mp' ? 'mana' : 'stamina'}`;
      fc.append(infoCard(a.name, `${kind} · learned at level ${a.level} · ${cost}`, a.text));
    }
    const ps = p.passives.find((x) => `pas:${x.name}` === chosenSkill);
    if (ps) fc.append(infoCard(ps.name, `Passive · learned at level ${ps.level}`, ps.text));
  } else fc.append(el('div', 'hint', p.cls ? 'No spells or skills learned yet: they come with levels.' : 'No calling yet, so no spells or fighting skills.'));
  right.append(fc);
  out.append(left, right);
}

function pick(id: string, rerender: () => void): void {
  chosenSkill = chosenSkill === id ? null : id;
  rerender();
}

/** What a tapped skill, spell or trait does. */
function infoCard(name: string, sub: string, text: string): HTMLElement {
  const c = el('div', 'skill-info');
  c.append(el('div', 'skill-info-name', name), el('div', 'hint', sub), el('div', 'skill-info-text', text));
  return c;
}

/** Where each slot sits round the figure: left the head, body and weapon; right the charm, pack and off-hand; the
 *  tool under their feet. */
const DOLL: Record<Slot, string> = { head: 'head', body: 'body', weapon: 'weapon', charm: 'charm', pack: 'pack', offhand: 'offhand', tool: 'tool' };
/** A mark drawn faintly in an empty slot. */
const EMPTY_MARK: Record<Slot, string> = { head: '⛑', body: '🛡', weapon: '⚔', offhand: '◈', charm: '✧', pack: '🎒', tool: '⚒' };

function paperDoll(p: PersonView, s: Snapshot, rerender: () => void): HTMLElement {
  const doll = el('div', 'doll');
  const fig = el('div', 'doll-figure');
  fig.append(figure(p, s, 3));
  fig.append(el('div', 'doll-level', `${p.cls ? `${p.clsName} · Lv ${p.level}` : `Level ${p.level}`} · Aged ${p.ageYears}${p.elder ? ' · Elder' : ''}`));
  fig.append(el('div', 'hint doll-age', p.ageText));
  if (p.job) fig.append(el('div', 'hint doll-age', `${p.job.title} at the ${p.job.at}`));
  fig.append(el('div', 'hint doll-age', `${p.natureName}: ${p.natureLine}`));
  if (p.ambition) fig.append(el('div', 'hint doll-age', `Dreams of ${p.ambition.name.charAt(0).toLowerCase()}${p.ambition.name.slice(1)}: ${p.ambition.line}${p.trips ? ` ${p.trips} trip${p.trips > 1 ? 's' : ''} made.` : ''}`));
  doll.append(fig);
  const shown = chosenSlot ?? firstWorn(p);
  for (const slot of SLOTS) {
    const id = p.gear[slot];
    const def = id ? ITEM_BY_ID[id] : undefined;
    const cell = el('button', `doll-slot s-${DOLL[slot]}${def ? ' full' : ''}${shown === slot ? ' on' : ''}`);
    cell.style.gridArea = DOLL[slot];
    cell.title = def ? pieceLabel(def.name, p.gearQ[slot]) : `${SLOT_NAMES[slot]}: empty`;
    if (def) {
      const q = qualityOf(p.gearQ[slot]);
      cell.style.setProperty('--q', q.color);
      cell.append(itemIcon(def, slot === 'weapon' || slot === 'offhand' || slot === 'body' ? 3 : 2));
      const plus = plusOf(p.gearQ[slot]);
      if (plus) cell.append(el('span', 'doll-plus', `+${plus}`));
    } else cell.append(el('span', 'doll-empty', EMPTY_MARK[slot]));
    cell.append(el('span', 'doll-label', SLOT_NAMES[slot]));
    cell.addEventListener('click', () => {
      chosenSlot = slot;
      rerender();
    });
    doll.append(cell);
  }
  return doll;
}

const firstWorn = (p: PersonView): Slot | null => (['weapon', 'body', 'head', 'offhand', 'tool', 'charm', 'pack'] as Slot[]).find((k) => p.gear[k]) ?? null;

/** The piece in the chosen slot, as an item card: its name in its grade's colour, what it is, and what it does
 *  (worked out at its grade and +N). */
function pieceCard(p: PersonView): HTMLElement {
  const slot = chosenSlot ?? firstWorn(p);
  const box = el('div', 'card item-card');
  if (!slot) {
    box.append(el('div', 'lock short', 'Wears nothing worth the name yet. The town hands out gear from its stores (or, once it has money, they buy it with their wages).'));
    return box;
  }
  const id = p.gear[slot];
  const def = id ? ITEM_BY_ID[id] : undefined;
  if (!def) {
    box.append(el('div', 'lock short', `${SLOT_NAMES[slot]}: nothing in this slot.`));
    return box;
  }
  const qn = p.gearQ[slot];
  const q = qualityOf(qn);
  const head = el('div', 'item-head');
  head.append(itemIcon(def, 2));
  const name = el('span', 'item-name', pieceLabel(def.name, qn));
  name.style.color = q.color;
  head.append(name);
  box.append(head);
  box.append(el('div', 'item-kind', `${SLOT_NAMES[slot]} · ${q.name}${plusOf(qn) ? ` +${plusOf(qn)}` : ''}${def.tier ? ` · tier ${def.tier}` : ''}${def.unique ? ' · unique' : def.relic ? ' · relic' : ''}`));
  const lines = itemStats(def, qn);
  if (lines.length) {
    const ul = el('div', 'item-stats');
    for (const l of lines) ul.append(el('div', '', l));
    box.append(ul);
  }
  box.append(el('div', 'hint', def.description));
  return box;
}


/** What they carry, in a grid of cells as in Diablo's bag: a stack to a cell, the rest empty; and their coins. */
function bag(p: PersonView): HTMLElement {
  const box = el('div', 'card');
  const grid = el('div', 'bag');
  const stacks = (Object.entries(p.carrying) as [Material, number][]).filter(([, n]) => n > 0);
  const cells = Math.max(16, Math.ceil(stacks.length / 8) * 8);
  for (let i = 0; i < cells; i++) {
    const cell = el('div', 'bag-cell');
    const st = stacks[i];
    if (st) {
      const [m, n] = st;
      cell.classList.add('full');
      cell.title = `${MATERIAL_NAMES[m]} ×${n}`;
      const icon = stockIcon(m, 24);
      cell.append(icon ?? el('span', 'bag-word', MATERIAL_NAMES[m].slice(0, 3)));
      cell.append(el('span', 'bag-count', String(n)));
    }
    grid.append(cell);
  }
  box.append(grid);
  const held = stacks.reduce((n, [, v]) => n + v, 0);
  const foot = el('div', 'bag-foot');
  foot.append(el('span', '', `Carrying ${held} of ${p.carryCapacity}`));
  if (p.coins !== null) foot.append(el('span', 'coins', `● ${p.coins} coins${p.income ? ` · earned ${p.income.today} today${p.income.yesterday ? `, ${p.income.yesterday} yesterday` : ''}` : ''}${p.owns.length ? ` · owns ${p.owns.join(', ')}` : ''}${p.debt ? ` · owes ${p.debt} rent` : ''}`));
  if (p.bedroll) foot.append(el('span', '', 'Sleeps on a bedroll'));
  box.append(foot);
  return box;
}

/** How they'd fight if raiders came now, and the spells and skills they'd use. */
function fightCard(p: PersonView, bridge?: Bridge): HTMLElement {
  const box = el('div', 'card');
  const b = p.battle;
  const grid = el('div', 'fight-stats');
  const stat = (label: string, value: string) => {
    const c = el('div', 'fight-stat');
    c.append(el('span', 'fight-label', label), el('span', 'fight-value', value));
    grid.append(c);
  };
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  stat('Health', `${Math.round(Math.min(p.hp, p.maxHp))}/${p.maxHp}`);
  stat(b.ranged ? 'Damage (range)' : 'Damage', b.damage[0] === b.damage[1] ? String(b.damage[0]) : `${b.damage[0]}–${b.damage[1]}`);
  stat('Aim', pc(Math.min(1, b.accuracy)));
  stat('Range', `${b.range} ${b.range === 1 ? 'cell' : 'cells'}`);
  stat('Strikes true', pc(b.crit));
  stat('Armour', pc(b.armor));
  stat('Block', pc(b.block));
  stat('Dodge', pc(b.dodge));
  box.append(grid);
  // their attributes (data/attributes.ts): what their turns, blows, spells and pools come of
  const at = b.attrs;
  if (at) {
    const attrs = el('div', 'fight-stats attrs');
    const one = (label: string, v: number, title: string) => {
      const c = el('div', 'fight-stat');
      c.title = title;
      c.append(el('span', 'fight-label', label), el('span', 'fight-value', String(Math.round(v))));
      attrs.append(c);
    };
    for (const k of ATTR_KEYS) {
      one(k.toUpperCase(), at[k], `${ATTR_NAMES[k]}: ${ATTR_ABOUT[k]}${k === 'dex' ? ` (every ${(b.interval / 10).toFixed(1)} s)` : ''}`);
      // (a point to spend: a + beside the number)
      if (p.freePts > 0 && bridge) {
        const c = attrs.lastElementChild as HTMLElement;
        c.append(button('+', () => bridge.command({ type: 'spendStat', person: p.id, attr: k }), { cls: 'place small stat-plus', title: `Put a point into ${ATTR_NAMES[k]}` }));
      }
    }
    one('MP', b.mp, 'Mana: spells draw on it');
    one('SP', b.sp, 'Stamina: skills draw on it; a plain blow brings some back');
    box.append(attrs);
    if (p.freePts > 0) {
      const row = el('div', 'row');
      row.append(el('span', 'lock short', `${p.freePts} stat ${p.freePts === 1 ? 'point' : 'points'} to spend.`));
      if (bridge) row.append(button('Let them choose', () => bridge.command({ type: 'spendStat', person: p.id, attr: null }), { cls: 'place small quiet', title: `Spent the ${p.clsName}'s way: ${p.favours.map((k) => ATTR_NAMES[k]).join(' and ')} first` }));
      box.append(row);
    }
    // (what their calling leans to: how points are spent when they're left to choose)
    if (p.favours.length && p.cls) box.append(el('div', 'hint', `Left to themselves, a ${p.clsName} puts points into ${ATTR_NAMES[p.favours[0]]} first, then ${ATTR_NAMES[p.favours[1]]}.`));
  }
  if (p.kit.length) box.append(el('div', 'hint', `${p.kit.length} spells and skills: see the Skills tab.`));
  return box;
}

/* ------------------------------------------------------------ their picture */

/** The character sheet, loaded once; the panel is drawn again when it comes. */
let lpcLoading = false;
let lpcLoaded = false;
function startLpc(rerender: () => void): void {
  heroRerender = rerender;
  if (lpcLoading) return;
  lpcLoading = true;
  loadLpc().then(
    () => {
      lpcLoaded = true;
      rerender();
    },
    () => undefined,
  );
}

/** Them as they look in the town, in what they wear and with their weapon in hand, standing; composed pictures kept. */
const pictures = new Map<string, HTMLCanvasElement>();
/** A hero figure's height in the 64px frame (about an LPC townsperson's, as on the map: HERO_HEIGHT). */
const HERO_FIGURE = 50;
/** The Himeko pictures are drawn this many times the old frame's size. */
const HK_RES = 2;
/** Redraws the tab when a hero sheet comes in (set by the panel's render). */
let heroRerender: (() => void) | null = null;
// (redrawn when more of the townsfolk's layers have loaded)
onHkLoad(() => heroRerender?.());
function picture(p: PersonView, s: Snapshot): HTMLCanvasElement | null {
  // (everyone, founders too, as the map draws them: in the Himeko Sutori pack's dress, art/hkFolk.ts, standing facing
  // us with their weapon, feet where the old figure's were; the old look while their layers load)
  const keys = hkLayers(hkWhoOf(p), { fighting: true, activity: 'idle' });
  const hkKey = `hk|${keys.join('+')}`;
  const made = pictures.get(hkKey);
  if (made) return made;
  // (at twice the old frame's resolution: the pack's figures have finer detail than the old 64px frames)
  const hc = document.createElement('canvas');
  hc.width = hc.height = FRAME_SIZE * HK_RES;
  if (hkDraw(hc.getContext('2d')!, keys, 0, 0, CENTRE_X * HK_RES, FEET_Y * HK_RES, HERO_FIGURE * HK_RES)) {
    pictures.set(hkKey, hc);
    return hc;
  }
  if (!lpcLoaded) return null;
  let look = p.look;
  let wear: string[];
  if (p.typeName === 'Traveller' || p.look.wear) wear = wornLayers(p.gear, p.gearQ);
  else {
    const w = wardrobe({ id: p.id, gender: p.look.gender, typeName: p.typeName, gear: p.gear, coins: p.coins, child: p.growsUpIn !== null, founder: p.id === s.mainId }, s.theme, s.research.done.includes('weaving'));
    look = { ...p.look, outfit: w.outfit };
    wear = [...w.wear, ...wornLayers(p.gear, p.gearQ)];
  }
  const weapon = heldWeapon(p.gear, 'fight');
  const key = JSON.stringify([look, wear, weapon]);
  let c = pictures.get(key);
  if (!c) {
    if (pictures.size > 200) pictures.clear();
    c = lpcCanvas(look, 'walk', 0, weapon, wear);
    pictures.set(key, c);
  }
  return c;
}

/** Their whole figure, `scale` times over. */
function figure(p: PersonView, s: Snapshot, scale: number): HTMLElement {
  const c = el('canvas', 'pixel-figure');
  c.width = FRAME_SIZE * HK_RES;
  c.height = FRAME_SIZE * HK_RES;
  c.style.width = `${FRAME_SIZE * scale}px`;
  c.style.height = `${FRAME_SIZE * scale}px`;
  const src = picture(p, s);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (src) g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Their head and shoulders, for the list. */
const FACE = 26;
export function face(p: PersonView, s: Snapshot): HTMLElement {
  const c = el('canvas', 'pixel-figure folk-face');
  c.width = c.height = FACE * HK_RES;
  const src = picture(p, s);
  // (the head sits about 40 pixels above the feet in a 64-pixel frame; the picture may be drawn finer than that)
  const r = src ? src.width / FRAME_SIZE : 1;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (src) g.drawImage(src, (CENTRE_X - FACE / 2 + 1) * r, (FEET_Y - 52) * r, FACE * r, FACE * r, 0, 0, c.width, c.height);
  return c;
}

function visitorCard(v: VisitorView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const c = el('div', 'card arrival');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${v.name}, ${v.typeName.toLowerCase()}`), el('span', 'card-size', v.leaving ? 'Leaving' : `Leaves in ${Math.ceil(v.hoursLeft)}h`));
  c.append(el('div', 'lock', 'Is at the edge of town and asks to join.'), top, skillsList(v), traitsList(v));
  if (v.cls) c.append(el('div', 'lock short', `${v.clsName}, level ${v.level}: ${CLASS_DEFS[v.cls].description}`));
  if (!v.leaving) {
    // (the player's call: people join only by their leave; a bed matters less than hands, but is said)
    const noBed = s.housing.beds <= s.housing.people;
    c.append(el('div', noBed ? 'lock short' : 'lock', noBed ? 'No free bed yet: taken in, they sleep rough until a home is built.' : 'Yours to decide: take them in, or send them on their way.'));
    const row = el('div', 'row');
    row.append(button('Take them in', () => bridge?.command({ type: 'acceptVisitor' })), button('Send them on', () => bridge?.command({ type: 'rejectVisitor' }), { cls: 'place quiet' }));
    c.append(row);
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

/** Their class and level, and the way to the next level. Only the class they are now is named; tapped, it opens
 *  the path they've come along (the stages they've passed) and what the next one needs, left unnamed: what they'll
 *  become is a mystery until it comes. */
function classRow(p: PersonView, _bridge: Bridge | undefined, rerender: () => void = () => undefined): HTMLElement {
  const row = el('div', 'row class-row');
  if (!p.cls) {
    if (p.growsUpIn === null) row.append(el('span', 'lock short', `Level ${p.level}. Their calling will come to them soon.`));
    return row;
  }
  const def = CLASS_DEFS[p.cls];
  const bar = el('span', 'skill-bar');
  const fill = el('span', '');
  fill.style.width = `${Math.round(p.levelProgress * 100)}%`;
  bar.append(fill);
  bar.title = `${Math.round(p.levelProgress * 100)}% of the way to level ${p.level + 1}`;
  const open = classOpen === p.id;
  const chip = button(`${open ? '▾' : '▸'} ${p.clsName} · Lv ${p.level}`, () => {
    classOpen = open ? null : p.id;
    rerender();
  }, { cls: `chip class-chip${p.founderCalling ? ' founder' : ''}`, title: 'Their calling: tap for the path so far' });
  if (p.road && p.roadId) row.prepend(emblemCanvas(p.roadId, 34));
  row.append(chip, bar);
  const box = el('div', '');
  box.append(row);
  if (open) {
    const path = el('div', 'class-path');
    const past = p.clsPast;
    if (p.founderCalling) path.append(el('div', 'hint founder-calling', 'A founder\'s calling: theirs alone, and no one else\'s.'));
    path.append(el('div', 'hint', past.length ? `The path so far: ${past.join(' → ')} → ${p.clsName} (now)` : `${p.clsName} is where their path begins.`));
    if (p.road) {
      path.append(el('div', 'purpose', p.road.text));
      if (!p.road.next.length) path.append(el('div', 'lock short', 'The last of their line: there is nothing further to become.'));
      else {
        const asking = p.road.promptId !== null;
        path.append(el('div', 'lock short', asking ? 'They stand at the fork now: choose their road, or let them.' : p.road.at !== null && p.level >= p.road.at && p.stage === 3 ? `Level ${p.road.at} reached; the last form takes an ascension: a small chance each day, or a deed worthy of legend.` : `At level ${p.road.at} (now ${p.level}) they may become:`));
        for (const [i, n] of p.road.next.entries()) {
          const card = el('div', 'road-option');
          const head = el('div', 'road-option-head');
          head.append(emblemCanvas(n.id, 44), el('div', 'road-name', n.name));
          card.append(head, el('div', 'hint', n.text), el('div', 'purpose', n.lore));
          if (asking && _bridge) card.append(button(`Become ${n.name}`, () => _bridge.command({ type: 'answerPrompt', prompt: p.road!.promptId!, option: i }), { cls: 'place small' }));
          path.append(card);
        }
        if (asking && _bridge) path.append(button('Let them choose', () => _bridge.command({ type: 'answerPrompt', prompt: p.road!.promptId!, option: p.road!.next.length }), { cls: 'place small quiet' }));
      }
    } else path.append(el('div', 'lock short', nextStage(p)));
    // what the calling is, how it fights, and what it brings the town
    const about = CLASS_ABOUT[p.cls];
    if (about) {
      path.append(el('div', 'purpose', about.what), el('div', 'purpose', about.fights));
      const good = (Object.entries(def.affinity) as [keyof typeof SKILL_NAMES, number][]).sort((a, b) => b[1] - a[1]).map(([k]) => SKILL_NAMES[k].toLowerCase());
      if (good.length) path.append(el('div', 'hint', `In town they take to ${good.length > 1 ? `${good.slice(0, -1).join(', ')} and ${good.at(-1)}` : good[0]}.`));
    }
    box.append(path);
  }
  const role = ROLE_ABOUT[def.role];
  box.append(el('div', 'lock', `Role: ${role.name}. ${role.text}`));
  box.append(el('div', 'hint', `${p.clsText} Wears ${def.armour.map((w) => WEIGHT_NAMES[w].toLowerCase()).join(', ')}; wields ${def.weapons.map((f) => FAMILIES[f].name.toLowerCase() + 's').join(', ')}.`));
  return box;
}

/** What it takes to reach their next stage, without saying what it is. */
function nextStage(p: PersonView): string {
  const last = STAGE_LEVELS.length - 1;
  if (p.stage >= last) return 'The last of their line: there is nothing further to become.';
  const at = STAGE_LEVELS[p.stage + 1];
  if (p.stage + 1 < last) {
    return p.level >= at ? 'Their next calling is upon them: it comes within the hour.' : `Next: ??? — they change at level ${at} (now ${p.level}, ${at - p.level} to go).`;
  }
  // (the last stage takes an ascension too)
  return p.level >= at
    ? `Next: ??? — they've reached level ${at}; now it takes an ascension: a small chance each day, or a deed worthy of legend.`
    : `Next: ??? — it takes level ${at} (now ${p.level}, ${at - p.level} to go), and then an ascension: a small chance each day, or a deed worthy of legend.`;
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
  if (p.devoted.length) parts.push(`Devoted to ${p.devoted.join(', ')} (goes where they go)`);
  const friends = p.friends.filter((n) => !p.devoted.includes(n));
  if (friends.length) parts.push(`Friends: ${friends.join(', ')}`);
  if (p.rivals.length) parts.push(`Can't stand: ${p.rivals.join(', ')}`);
  if (p.enemies.length) parts.push(`Enemies: ${p.enemies.join(', ')} (never in one party; may come to blows)`);
  return parts.join(' · ');
}

function skillsList(p: Pick<PersonView, 'skills'>, rerender: () => void = () => undefined): HTMLElement {
  const g = el('div', 'skills');
  for (const k of SKILLS) {
    const sk = p.skills[k];
    const id = `skill:${k}`;
    const cell = el('button', `${sk.level >= 6 ? 'skill good' : sk.level <= 1 ? 'skill weak' : 'skill'}${chosenSkill === id ? ' on' : ''}`);
    cell.append(el('span', '', `${SKILL_NAMES[k]}${sk.passion ? ' ★' : ''}`), el('span', 'lvl', String(sk.level)));
    cell.addEventListener('click', () => pick(id, rerender));
    g.append(cell);
  }
  return g;
}

function traitsList(p: Pick<PersonView, 'traits'>, rerender: () => void = () => undefined): HTMLElement {
  const d = el('div', 'traits');
  for (const t of p.traits) {
    const id = `trait:${t.name}`;
    const s = el('button', `chip${chosenSkill === id ? ' on' : ''}`, t.name);
    s.addEventListener('click', () => pick(id, rerender));
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
