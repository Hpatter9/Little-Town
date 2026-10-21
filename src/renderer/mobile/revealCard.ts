// Reveals on the phone (the owner's aim: rare things should feel rare, and rewards opened, not listed). A full-screen
// card slides up when something rare happens: a mythic calling comes among the town, a unique weapon is found, a
// legend at the gate is found out, a dweller of the Underdark slain, the dragon sighted or slain, a saga ended, a
// legendary deed. It shows the picture large, the name, a line of lore and how rare it is; one tap closes it. A party
// home opens its haul like a chest: the commonest first, the best last, after a pause, with a glow.
//
// The sim keeps the record (`snapshot.rare`, sim/rare.ts); the words are in mobile/reveals.ts. The cards wait in a queue
// and never come over a raid, a fight, a cutscene or an event: they show after. The keys
// shown are kept per town (`littletown.reveals`), so a card comes once; a town first seen here starts with all it
// already has, unshown. The ☰ menu can turn them off (`littletown.revealsOff`). Other pages' moments use `showReveal`.

import { ENEMIES } from '../../shared/data/enemies';
import { ITEM_BY_ID } from '../../shared/data/items';
import type { Material } from '../../shared/data/materials';
import { DEPTH_BY_N } from '../../shared/data/underdark';
import type { Snapshot } from '../../shared/sim/snapshot';
import { creatureThumb } from '../art/creatureThumbs';
import { emblemCanvas } from '../art/emblems';
import { itemIcon } from '../art/icons';
import { stockIcon } from '../art/materialIcons';
import { REVEAL_SOUND } from '../sfx';
import { icon } from '../ui/icon';
import { reducedMotion } from '../ui/motion';
import { freshReveals, haulOrder, revealsOf, uniqueLore, type HaulLine, type RevealTone, type RevealWords } from './reveals';

export type { RevealTone } from './reveals';

/** A card to show (the API for the other pages: milestones, a favourite's death...). */
export interface RevealCard {
  /** The small line over the name ("A mythic calling"). */
  kind: string;
  title: string;
  lore?: string;
  /** How rare, in the game's voice. */
  rarity?: string;
  tone?: RevealTone;
  /** The picture: an image's URL, an element, or a stat icon by name (ui/icon.ts). */
  img?: string;
  art?: HTMLElement | null;
  icon?: string;
  /** A dedupe id: a card with a key already queued or shown this session is dropped. */
  key?: string;
  /** A haul, opened line by line like a chest (mobile/reveals.ts `haulOrder`). */
  haul?: HaulLine[];
  /** A thing with a card of its own in the menus (a unique: its whole story, panel/itemCard.ts): "More…" opens it. */
  more?: { item: string };
}

/** Opens an item's card in the menus (mobile.ts sets it: the menus are another frame). */
let openItem: ((id: string) => void) | null = null;
export function setItemOpener(fn: (id: string) => void): void {
  openItem = fn;
}

const OFF_KEY = 'littletown.revealsOff';
const KNOWN_KEY = 'littletown.reveals';
/** Between one line of a haul and the next, and the pause before the best (ms). */
const LINE_MS = 320;
const RARE_PAUSE_MS = 650;

export function revealsOn(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== '1';
  } catch {
    return true;
  }
}
export function setRevealsOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, '1');
  } catch {
    /* (private mode: on for this visit) */
  }
}

const queue: RevealCard[] = [];
const keys = new Set<string>();
let box: HTMLElement | null = null;
let showing = false;
/** What holds the cards back (set by `startReveals`: a raid, a fight, an event...). */
let held: () => boolean = () => false;
let chime: () => void = () => {};

/** Show a card (queued behind any others; held while something else has the screen). */
export function showReveal(card: RevealCard): void {
  if (!revealsOn()) return;
  if (card.key) {
    if (keys.has(card.key)) return;
    keys.add(card.key);
  }
  queue.push(card);
  next();
}

/** Show the next card, if nothing holds it back. */
function next(): void {
  if (showing || !queue.length || held()) return;
  const card = queue.shift()!;
  showing = true;
  draw(card);
}

function draw(card: RevealCard): void {
  addStyles();
  if (!box) {
    box = document.createElement('div');
    box.id = 'reveal-card';
    box.setAttribute('role', 'dialog');
    document.body.append(box);
  }
  const root = box;
  const inner = document.createElement('div');
  inner.className = `reveal-box ui-frame ui-frame-big tone-${card.tone ?? 'gold'}`;
  const pic = document.createElement('div');
  pic.className = 'reveal-pic';
  const art = card.art ?? (card.img ? Object.assign(new Image(), { src: card.img, alt: '' }) : card.icon ? icon(card.icon, 64) : null);
  if (art) pic.append(art);
  const kind = el('div', 'reveal-kind ui-label', card.kind);
  const title = el('div', 'reveal-title', card.title);
  inner.append(pic, kind, title);
  if (card.lore) inner.append(el('div', 'reveal-lore', card.lore));
  let rest: (() => boolean) | null = null;
  if (card.haul?.length) {
    const list = el('div', 'reveal-haul');
    inner.append(list);
    rest = openHaul(list, card.haul);
  }
  if (card.rarity) inner.append(el('div', 'reveal-rarity', card.rarity));
  // (a unique's whole story: who won it, who bears it; the card closes and its card opens in the menus)
  let more: string | null = card.more?.item ?? null;
  if (more && openItem) {
    const b = el('button', 'reveal-more ui-btn', 'More about it ›');
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      close();
      openItem?.(more!);
    });
    inner.append(b);
  } else more = null;
  inner.append(el('div', 'reveal-tap ui-small', more ? 'Tap anywhere else to close' : 'Tap to close'));
  root.replaceChildren(inner);
  root.hidden = false;
  root.classList.remove('in');
  void root.offsetWidth; // (so the slide starts again)
  root.classList.add('in');
  chime();
  const close = () => {
    root.hidden = true;
    root.onclick = null;
    showing = false;
    next();
  };
  root.onclick = (ev) => {
    // (a unique's line in a haul: its card in the menus)
    const line = (ev.target as HTMLElement).closest<HTMLElement>('.reveal-item[data-item]');
    if (line && openItem && !rest) {
      close();
      openItem(line.dataset.item!);
      return;
    }
    // (a chest still opening: the first tap lays it all out; the next closes)
    if (rest) {
      const r = rest;
      rest = null;
      if (r()) return;
    }
    close();
  };
}

/** Lay a haul out line by line, the best last after a pause; returns what lays out the rest at once (true: it did). */
function openHaul(list: HTMLElement, haul: HaulLine[]): () => boolean {
  const rows = haul.map((h) => {
    const row = el('div', `reveal-item${h.rare ? ' rare' : ''}${h.unique ? ' unique' : ''}`);
    const pic = h.unique ? (ITEM_BY_ID[h.id] ? itemIcon(ITEM_BY_ID[h.id], 2) : null) : stockIcon(h.id as Material, 32);
    if (pic) row.append(pic);
    row.append(el('span', 'reveal-item-name', h.n > 1 ? `${h.n} ${h.name.toLowerCase()}` : h.name));
    if (h.unique) row.dataset.item = h.id; // (a tap on it, once laid out, opens its card in the menus)
    return row;
  });
  if (reducedMotion()) {
    list.append(...rows);
    return () => false;
  }
  const timers: number[] = [];
  let at = 120;
  rows.forEach((row, i) => {
    if (haul[i].rare) at += RARE_PAUSE_MS;
    timers.push(window.setTimeout(() => list.append(row), at));
    at += LINE_MS;
  });
  return () => {
    const left = rows.filter((r) => !r.isConnected);
    for (const t of timers) clearTimeout(t);
    list.append(...left);
    return left.length > 0;
  };
}

/** The picture for a card from the record. */
function artOf(w: RevealWords): HTMLElement | null {
  const a = w.art ?? {};
  if (a.foe && ENEMIES[a.foe]) return creatureThumb(ENEMIES[a.foe], 112);
  if (a.emblem) return emblemCanvas(a.emblem, 112);
  if (a.item && ITEM_BY_ID[a.item]) return itemIcon(ITEM_BY_ID[a.item], 6);
  if (a.icon) return icon(a.icon, 64);
  return null;
}

/* ------------------------------------------------------------ watching the snapshots */

interface Known {
  seed: string;
  keys: string[];
}
function readKnown(): Known | null {
  try {
    const k = JSON.parse(localStorage.getItem(KNOWN_KEY) ?? 'null') as Known | null;
    return k && typeof k.seed === 'string' && Array.isArray(k.keys) ? k : null;
  } catch {
    return null;
  }
}
function saveKnown(k: Known): void {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(k));
  } catch {
    /* (full or private: shown again next visit at worst) */
  }
}

/** A party away, as last seen: where, and what it carried. */
interface Away {
  name: string;
  delve: boolean;
  loot: Record<string, number>;
}

/** Watch the snapshots for rare things and parties home, and hold the cards while something else has the screen. */
export function startReveals(bridge: { onSnapshot(cb: (s: Snapshot) => void): void }, strip: HTMLIFrameElement): void {
  let last: Snapshot | null = null;
  let known: Set<string> | null = null;
  let seed = '';
  let away = new Map<number, Away>();
  held = () => {
    const s = last;
    if (!s) return true;
    if (s.raid || s.tactics || s.battle || s.watch || s.mine || s.scene?.playing) return true;
    if (document.body.classList.contains('battle') || document.body.classList.contains('event-open')) return true;
    return false;
  };
  chime = () => {
    const amb = (strip.contentWindow as (Window & { __ambience?: { cue(c: string, pan?: number, delay?: number): void } }) | null)?.__ambience;
    amb?.cue(REVEAL_SOUND.cue, REVEAL_SOUND.pan, REVEAL_SOUND.delay);
  };
  bridge.onSnapshot((snap) => {
    last = snap;
    const rare = snap.rare;
    if (rare) {
      const titled = (t: string) => snap.people.find((p) => p.titles.includes(t))?.name ?? null;
      const all = revealsOf(rare, { titled, dragonLair: snap.dragon?.lair ?? null });
      if (snap.seed !== seed || !known) {
        // (a town first seen on this phone, or after a new one is founded: what it has already is passed by)
        seed = snap.seed;
        const k = readKnown();
        known = new Set(k?.seed === seed ? k.keys : all.map((w) => w.key));
        away = new Map();
        saveKnown({ seed, keys: [...known] });
      }
      const fresh = freshReveals(all, known);
      // a party home: its haul, with any unique found as it came home last in the chest (its own card left out)
      const now = new Set(snap.expeditions.map((e) => e.id));
      const inChest = new Set<string>();
      for (const [id, a] of away) {
        if (now.has(id)) continue;
        const uniques = fresh.filter((w) => w.key.startsWith('unique:')).map((w) => w.key.slice(7));
        const hoard = fresh.filter((w) => w.key.startsWith('dweller:')).map((w) => DEPTH_BY_N[Number(w.key.slice(8))]?.hoard ?? {});
        const loot: Record<string, number> = { ...a.loot };
        for (const h of hoard) for (const [m, n] of Object.entries(h)) loot[m] = (loot[m] ?? 0) + (n ?? 0);
        const haul = haulOrder(loot, uniques);
        for (const u of uniques) inChest.add(`unique:${u}`);
        if (!haul.length) continue;
        const best = haul[haul.length - 1];
        showReveal({
          kind: a.delve ? 'The delvers are home' : 'The party is home',
          title: `From ${a.name}`,
          lore: best.unique ? `${best.name}: ${uniqueLore(best.id)}` : undefined,
          tone: best.unique ? 'unique' : 'gold',
          icon: 'stores',
          haul,
          key: `haul:${seed}:${id}`,
        });
      }
      away = new Map(snap.expeditions.map((e) => [e.id, { name: e.destName, delve: !!e.delve, loot: { ...e.loot } }]));
      for (const w of fresh) {
        known.add(w.key);
        if (inChest.has(w.key)) continue;
        showReveal({ kind: w.kind, title: w.title, lore: w.lore, rarity: w.rarity, tone: w.tone, art: artOf(w), key: w.key, ...(w.key.startsWith('unique:') ? { more: { item: w.key.slice(7) } } : {}) });
      }
      if (fresh.length) saveKnown({ seed, keys: [...known] });
    }
    next();
  });
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let styled = false;
function addStyles(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'reveal-css';
  st.textContent = `
#reveal-card { position: fixed; inset: 0; z-index: 45; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); background: rgba(8, 6, 12, 0.72); cursor: pointer; }
#reveal-card[hidden] { display: none; }
#reveal-card .reveal-box { --reveal-glow: #e8c060; width: min(360px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 18px 16px 12px;
  text-align: center; color: var(--ui-face-text, #f1e2c2); background-color: var(--ui-surface, rgba(40, 28, 18, 0.96)); box-shadow: 0 0 28px var(--reveal-glow); }
#reveal-card.in .reveal-box { animation: reveal-up var(--ui-slow, 220ms) var(--ui-ease, ease-out) both; }
@keyframes reveal-up { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
#reveal-card .tone-mythic { --reveal-glow: #a070ff; }
#reveal-card .tone-unique { --reveal-glow: #f0b040; }
#reveal-card .tone-legend { --reveal-glow: #ffe8a0; }
#reveal-card .tone-dark { --reveal-glow: #d04848; }
#reveal-card .tone-gold { --reveal-glow: #c8a050; }
#reveal-card .reveal-pic { display: flex; align-items: center; justify-content: center; min-height: 112px; margin: 2px auto 8px; }
#reveal-card .reveal-pic > * { image-rendering: pixelated; filter: drop-shadow(0 0 10px var(--reveal-glow)); max-width: 100%; }
#reveal-card .reveal-pic > img { width: 112px; height: auto; }
#reveal-card .reveal-kind { color: var(--reveal-glow); margin-bottom: 4px; }
#reveal-card .reveal-title { font-size: calc(var(--ui-fs-head, 15px) + 4px); font-weight: bold; line-height: 1.25; margin-bottom: 8px; }
#reveal-card .reveal-lore { font-size: var(--ui-fs-body, 13px); line-height: 1.45; opacity: 0.92; margin-bottom: 10px; }
#reveal-card .reveal-rarity { font-size: var(--ui-fs-small, 11.5px); font-style: italic; color: var(--reveal-glow); margin: 8px 0 4px; }
#reveal-card .reveal-tap { opacity: 0.55; margin-top: 8px; }
#reveal-card .reveal-haul { display: flex; flex-direction: column; gap: 4px; align-items: stretch; margin: 4px 0 6px; min-height: 28px; }
#reveal-card .reveal-item { display: flex; align-items: center; gap: 8px; padding: 3px 8px; border-radius: 3px; background: rgba(0, 0, 0, 0.22);
  font-size: var(--ui-fs-body, 13px); text-align: left; animation: reveal-pop var(--ui-fast, 140ms) var(--ui-ease, ease-out) both; }
#reveal-card .reveal-item.rare { background: rgba(255, 210, 120, 0.16); box-shadow: 0 0 12px var(--reveal-glow); font-weight: bold; animation-duration: var(--ui-slow, 220ms); }
#reveal-card .reveal-item.unique { box-shadow: 0 0 14px #f0b040; }
#reveal-card .reveal-item[data-item] .reveal-item-name { text-decoration: underline dotted; text-underline-offset: 3px; }
#reveal-card .reveal-more { margin: 6px auto 2px; min-height: 40px; padding: 0 16px; font: inherit; cursor: pointer; }
@keyframes reveal-pop { from { transform: scale(0.85); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  #reveal-card.in .reveal-box, #reveal-card .reveal-item { animation: none; }
}
@media (orientation: landscape) and (max-height: 500px) {
  #reveal-card .reveal-box { width: min(560px, 100%); display: grid; grid-template-columns: 128px 1fr; column-gap: 14px; text-align: left; align-items: start; }
  #reveal-card .reveal-pic { grid-row: 1 / span 7; min-height: 0; margin: 0; }
}
`;
  document.head.append(st);
}
