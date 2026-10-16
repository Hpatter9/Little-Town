// Tap anything for its card (the owner: "Make it so nearly everything is clickable with some sort of information"). A
// named thing in a menu (an item, a building, a research topic, a power of the realm, a god, a guild, a calling, a saga,
// a festival, a place, a line of the Chronicle) opens its card over the menu: a sheet from the bottom, with a ‹ back
// when one card was opened from another and a ✕ to close. A person's name opens their character sheet in the People tab.
//
// The card lives outside the menu's body, so the menu's redraws never touch it; it is drawn again only when its own key
// changes (`refreshCard`, called by panel.ts with each snapshot), so no menu's redraw key has to know about it. The cards
// themselves are drawn by itemCard.ts and infoCards.ts (registered with `registerCard`). Tappable text has one look
// everywhere (`.tap-link` in structure.ts: a dotted underline in the link colour), made by `tapLink` and `linked`.

import type { Bridge } from '../../shared/ipc';
import type { PersonView, Snapshot } from '../../shared/sim/snapshot';
import { addCardStyles } from './cardsStyles';
import { el } from './dom';
import { tapLink } from './structure';
import { face, inspectPerson } from './townsfolkPanel';
import { onHkLoad } from '../art/hkFolk';

export type CardRef =
  | { kind: 'item'; id: string }
  | { kind: 'building'; id: string }
  | { kind: 'topic'; id: string }
  | { kind: 'faction'; id: string }
  | { kind: 'god'; id: string }
  | { kind: 'guild'; id: number }
  | { kind: 'calling'; id: string }
  | { kind: 'saga'; id: string }
  | { kind: 'festival'; id: string }
  | { kind: 'place'; id: number }
  | { kind: 'event'; id: number; text: string; when: string; lines?: string[] };

/** What a card draws: its parts, and a key that says when it must be drawn again. */
export interface CardDraw {
  key: string;
  /** The kind of thing, small over the name ("A unique weapon"). */
  kind: string;
  title: string;
  /** The picture. */
  art?: () => HTMLElement | null;
  /** A line of lore under the name. */
  lore?: string;
  /** A glow round the card: a unique's gold, a dark thing's red. */
  tone?: 'unique' | 'dark' | 'mythic';
  body: () => HTMLElement[];
}
export type CardMaker = (ref: CardRef, s: Snapshot) => CardDraw | null;

const makers = new Map<CardRef['kind'], CardMaker>();
/** A kind of card (itemCard.ts, infoCards.ts). */
export function registerCard(kind: CardRef['kind'], make: CardMaker): void {
  makers.set(kind, make);
}

let bridge: Bridge | undefined;
let snap: Snapshot | null = null;
/** The cards opened, the top one shown. */
let stack: CardRef[] = [];
let drawnKey = '';
let box: HTMLElement | null = null;

/** The menu's bridge (panel.ts). */
export function setCardHost(b: Bridge | undefined): void {
  bridge = b;
}
export const cardBridge = (): Bridge | undefined => bridge;
/** The latest snapshot (the cards and `linked` read it), and the open card drawn again if what it shows changed. */
export function refreshCard(s: Snapshot): void {
  snap = s;
  if (stack.length) draw();
}
export const cardSnapshot = (): Snapshot | null => snap;

/** Open a thing's card (over any card open: ‹ goes back to it). */
export function openCard(ref: CardRef): void {
  const top = stack[stack.length - 1];
  if (top && refKey(top) === refKey(ref)) return;
  stack.push(ref);
  drawnKey = '';
  draw(true);
}
/** Close every card. */
export function closeCards(): void {
  stack = [];
  drawnKey = '';
  if (box) box.hidden = true;
}
/** Whether a card is open (a swipe closes it first: panel.ts). */
export const cardOpen = (): boolean => stack.length > 0;
/** Back one card (a swipe to the right); false when none is open. */
export function backCard(): boolean {
  if (!stack.length) return false;
  stack.pop();
  drawnKey = '';
  if (stack.length) draw(true);
  else if (box) box.hidden = true;
  return true;
}

/** Someone's character sheet, in the People tab (the cards close). */
export function openPerson(id: number): void {
  closeCards();
  inspectPerson(id);
  bridge?.openPanel('townsfolk');
}

const refKey = (r: CardRef): string => `${r.kind}:${r.id}`;

// (the portraits are drawn from the Himeko layers, loaded as they're first wanted: an open card is drawn again as they come)
onHkLoad(() => {
  if (!stack.length) return;
  drawnKey = '';
  draw();
});

function draw(fresh = false): void {
  const s = snap;
  const ref = stack[stack.length - 1];
  if (!ref || !s) return;
  const make = makers.get(ref.kind);
  const d = make?.(ref, s) ?? null;
  const key = `${refKey(ref)}|${stack.length}|${d?.key ?? ''}`;
  if (!fresh && key === drawnKey) return;
  drawnKey = key;
  addCardStyles();
  addStyles();
  if (!box) {
    box = el('div');
    box.id = 'info-card';
    box.setAttribute('role', 'dialog');
    box.addEventListener('click', (ev) => {
      if (ev.target === box) closeCards();
    });
    document.body.append(box);
  }
  const old = box.querySelector<HTMLElement>('.ic-box');
  const scroll = !fresh && old ? old.scrollTop : 0;
  const inner = el('div', `ic-box ui-frame${d?.tone ? ` tone-${d.tone}` : ''}`);
  const bar = el('div', 'ic-bar');
  if (stack.length > 1) {
    const back = el('button', 'ic-btn', '‹ Back');
    back.addEventListener('click', () => backCard());
    bar.append(back);
  }
  bar.append(el('span', 'ic-gap'));
  const shut = el('button', 'ic-btn', '✕');
  shut.title = 'Close';
  shut.addEventListener('click', () => closeCards());
  bar.append(shut);
  inner.append(bar);
  if (!d) inner.append(el('div', 'pc-text', 'Nothing more is known of it.'));
  else {
    const head = el('div', 'ic-head');
    const pic = el('div', 'ic-pic');
    const art = d.art?.();
    if (art) pic.append(art);
    const words = el('div', 'ic-words');
    words.append(el('div', 'ic-kind', d.kind), el('div', 'ic-title', d.title));
    if (d.lore) words.append(el('div', 'ic-lore', d.lore));
    head.append(pic, words);
    inner.append(head, ...d.body());
  }
  if (fresh) inner.classList.add('card-fade');
  box.replaceChildren(inner);
  box.hidden = false;
  inner.scrollTop = scroll;
}

/* ------------------------------------------------------------ pieces the cards share */

/** A small heading inside a card. */
export const sec = (text: string): HTMLElement => el('div', 'pc-sec', text);
/** A paragraph inside a card (tapped names in it open their cards). */
export const para = (text: string): HTMLElement => {
  const p = el('div', 'pc-text');
  p.append(...linkedParts(text));
  return p;
};

/** A person as a small portrait to tap (their sheet); one who is gone shows ✝ and their name. */
export function portrait(who: { id?: number; name: string }, note: string): HTMLElement {
  const s = snap;
  const p: PersonView | undefined = s ? (who.id !== undefined ? s.people.find((q) => q.id === who.id) : s.people.find((q) => q.name === who.name)) : undefined;
  const b = el('button', `pc-rel${p ? '' : ' gone'}`);
  if (p && s) {
    b.append(face(p, s));
    b.addEventListener('click', () => openPerson(p.id));
  } else b.append(el('span', '', '✝'));
  b.append(el('span', '', who.name), el('small', '', note));
  return b;
}
/** A row of portraits. */
export function portraits(items: HTMLElement[]): HTMLElement {
  const row = el('div', 'pc-kin');
  row.append(...items);
  return row;
}

/** Facts in two columns (a label and its value; rows with no value left out). Values may be elements (links). */
export function factRows(rows: [string, string | HTMLElement | number | null | undefined | false][]): HTMLElement {
  const box = el('div', 'facts');
  for (const [k, v] of rows) {
    if (v === null || v === undefined || v === false || v === '') continue;
    const val = el('span', 'fact-val');
    if (typeof v === 'object') val.append(v);
    else val.append(...linkedParts(String(v)));
    box.append(el('span', 'fact-key', k), val);
  }
  return box;
}

/** A link to a thing's card. */
export const cardLink = (text: string, ref: CardRef): HTMLElement => tapLink(el('span', '', text), () => openCard(ref));
/** A link to someone's sheet (plain text when they are no longer in the town). */
export function personLink(name: string, id?: number): HTMLElement {
  const p = snap?.people.find((q) => (id !== undefined ? q.id === id : q.name === name));
  return p ? tapLink(el('span', '', name), () => openPerson(p.id)) : el('span', '', name);
}

/* ------------------------------------------------------------ names in text */

type Target = { person: number } | { ref: CardRef };
/** The names a line of text may hold, and what each opens: built once a snapshot (`indexOf`). */
const finders = new Set<(s: Snapshot) => [string, CardRef][]>();
/** More names to find in text (infoCards.ts: buildings, topics, powers, gods...). */
export function registerNames(find: (s: Snapshot) => [string, CardRef][]): void {
  finders.add(find);
}

let indexFor: Snapshot | null = null;
let index: { re: RegExp | null; to: Map<string, Target> } = { re: null, to: new Map() };
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function indexOf(s: Snapshot): typeof index {
  if (indexFor === s) return index;
  indexFor = s;
  const to = new Map<string, Target>();
  for (const f of finders) for (const [name, ref] of f(s)) if (name.length >= 4 && !to.has(name)) to.set(name, { ref });
  // (people last, so a person shares no name with a thing: they win)
  for (const p of s.people) if (p.name.length >= 3) to.set(p.name, { person: p.id });
  const names = [...to.keys()].sort((a, b) => b.length - a.length);
  index = { re: names.length ? new RegExp(`(?<![\\w'])(${names.map(esc).join('|')})(?![\\w])`, 'g') : null, to };
  return index;
}

/** A line of text as nodes, each name in it that has a card (or a person) made tappable. */
export function linkedParts(text: string): Node[] {
  const s = snap;
  if (!s) return [document.createTextNode(text)];
  const { re, to } = indexOf(s);
  if (!re) return [document.createTextNode(text)];
  const out: Node[] = [];
  let at = 0;
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const t = to.get(m[1]);
    if (!t) continue;
    if (m.index > at) out.push(document.createTextNode(text.slice(at, m.index)));
    out.push('person' in t ? personLink(m[1], t.person) : cardLink(m[1], t.ref));
    at = m.index + m[1].length;
  }
  if (at < text.length) out.push(document.createTextNode(text.slice(at)));
  return out;
}
/** A line of text in an element of its own, its names tappable. */
export function linked(text: string, tag: keyof HTMLElementTagNameMap = 'span', cls = ''): HTMLElement {
  const e = el(tag, cls);
  e.append(...linkedParts(text));
  return e;
}

/* ------------------------------------------------------------ the look */

let styled = false;
function addStyles(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = `
#info-card { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; background: rgba(0, 0, 0, 0.55); }
#info-card[hidden] { display: none; }
#info-card .ic-box { box-sizing: border-box; width: min(100%, 560px); max-height: calc(100% - 24px); overflow-y: auto; overscroll-behavior: contain;
  display: flex; flex-direction: column; gap: 8px; padding: 8px 14px 18px; border-radius: 14px 14px 0 0;
  background: var(--bg, #1c140c); color: var(--text, #f0e0c0); box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.6); }
#info-card .ic-box.tone-unique { box-shadow: 0 0 14px #f0b040; border-color: #f0b040; }
#info-card .ic-box.tone-dark { box-shadow: 0 0 14px #d04848; border-color: #d04848; }
#info-card .ic-box.tone-mythic { box-shadow: 0 0 14px #a070ff; border-color: #a070ff; }
#info-card .ic-bar { display: flex; align-items: center; gap: 6px; position: sticky; top: -8px; z-index: 1; padding: 4px 0; background: inherit; }
#info-card .ic-gap { flex: 1; }
#info-card .ic-btn { min-width: 44px; min-height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid #4a3722; background: #2a1f16; color: inherit; font: inherit; font-size: 14px; cursor: pointer; }
#info-card .ic-head { display: flex; gap: 12px; align-items: center; }
#info-card .ic-pic { flex: none; width: 84px; height: 84px; display: flex; align-items: center; justify-content: center; border-radius: 10px;
  background: radial-gradient(circle at 50% 35%, #4a3a28, #1c140c); border: 2px solid #6b5230; overflow: hidden; }
#info-card .tone-unique .ic-pic { border-color: #f0b040; box-shadow: inset 0 0 12px #f0b04066; }
#info-card .ic-pic canvas, #info-card .ic-pic img, #info-card .ic-pic > div { image-rendering: pixelated; max-width: 76px; max-height: 76px; }
#info-card .ic-words { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
#info-card .ic-kind { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; }
#info-card .ic-title { font-size: 19px; font-weight: 700; line-height: 1.15; }
#info-card .tone-unique .ic-title { color: #ffd84a; }
#info-card .ic-lore { font-size: 13px; line-height: 1.4; font-style: italic; opacity: 0.9; }
#info-card .facts { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 13px; }
#info-card .fact-key { opacity: 0.7; }
#info-card ul.ic-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.45; }
@media (orientation: landscape) and (max-height: 500px) {
  #info-card .ic-box { width: min(100%, 680px); max-height: calc(100% - 8px); }
  #info-card .ic-pic { width: 64px; height: 64px; }
}
`;
  document.head.append(st);
}
