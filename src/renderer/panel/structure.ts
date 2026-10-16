// The menus' structure (the UI restructure): collapsible sections with counts in their headings, building thumbnails,
// the calling mark by a name, the swipe-right that closes a card, and the plain-class styles for them. The look is the
// shared style blocks' to restyle; the few rules here (injected below) only lay the pieces out.
//
// Classes: .section (.open), .section-head, .section-count, .section-body, .dash, .dash-card (.card-urgent),
// .thumb, .calling-mark, .why-line.

import { el } from './dom';
import { iconSheet } from '../art/icons';
import type { IconSheet } from '../../shared/data/items';

const FOLD = (menu: string, key: string) => `littletown.fold.${menu}.${key}`;
const folds = new Map<string, boolean>();

/** A heading's key: its words without counts or what follows a colon ("In town: 14 buildings" -> "in town"). */
export const headKey = (text: string): string => text.toLowerCase().split(':')[0].replace(/[0-9·]+/g, '').replace(/\s+/g, ' ').trim();

function readFold(menu: string, key: string): boolean | undefined {
  const k = FOLD(menu, key);
  if (folds.has(k)) return folds.get(k);
  try {
    const v = localStorage.getItem(k);
    if (v === '1' || v === '0') {
      folds.set(k, v === '1');
      return v === '1';
    }
  } catch {
    /* (a per-viewer convenience: the sections just start as they are by default) */
  }
  return undefined;
}
function writeFold(menu: string, key: string, open: boolean): void {
  folds.set(FOLD(menu, key), open);
  try {
    localStorage.setItem(FOLD(menu, key), open ? '1' : '0');
  } catch {
    /* (as above) */
  }
}
/** Open a section (and scroll to it on the next draw): a dashboard card's tap. */
let pending: { menu: string; key: string } | null = null;
export function jumpToSection(menu: string, heading: string): void {
  writeFold(menu, headKey(heading), true);
  pending = { menu, key: headKey(heading) };
}

/** A section's count words, by its heading: "14 · 2 under way". Undefined: the heading's own words say it. */
export type CountFor = (heading: string, body: HTMLElement[]) => string | undefined;

/** Sections with more than this many things inside start closed (when the tab has several), so a long tab reads as a
 *  table of contents first. */
const BIG = 8;
/** Sections that start closed whatever their size: the dashboard says it already (the old tiles). */
const QUIET = /^at a glance/;

/** Fold a tab's flat elements into collapsible sections: each `h2` and what follows it up to the next `h2`. What comes
 *  before the first heading, and sheets over the tabs, stay as they are. A tab with a single section is left open and
 *  unfolded. The open or closed state of each is remembered in localStorage (per viewer). */
export function foldSections(menu: string, els: HTMLElement[], countFor?: CountFor, joins?: RegExp): HTMLElement[] {
  // (a heading `joins` matches is a sub-heading: it stays inside the section before it)
  const isHead = (e: HTMLElement) => e.tagName === 'H2' && !joins?.test(e.textContent ?? '');
  const heads = els.filter(isHead).length;
  if (heads < 2) return els;
  const out: HTMLElement[] = [];
  let cur: { head: HTMLElement; body: HTMLElement[] } | null = null;
  const flush = () => {
    if (!cur) return;
    out.push(sectionOf(menu, cur.head, cur.body, heads, countFor));
    cur = null;
  };
  for (const e of els) {
    if (isHead(e)) {
      flush();
      cur = { head: e, body: [] };
    } else if (cur && !e.classList.contains('over-tabs')) cur.body.push(e);
    else out.push(e);
  }
  flush();
  return out;
}

/** One section folded on its own, in a tab that is not folded as a whole (the Chronicle's Milestones). Starts closed. */
export function foldedSection(menu: string, heading: string, body: HTMLElement[], count?: string): HTMLElement {
  return sectionOf(menu, el('h2', '', heading), body, 2, count ? () => count : undefined, true);
}

function sectionOf(menu: string, h2: HTMLElement, body: HTMLElement[], heads: number, countFor?: CountFor, closed = false): HTMLElement {
  const title = h2.textContent ?? '';
  const key = headKey(title);
  // (an empty section, or one a card inside is open in, is not shut on the reader)
  const big = body.length > BIG || body.some((b) => b.querySelectorAll('.card, .queue-row, .folk-row').length > BIG);
  const hasOpenCard = body.some((b) => [...b.querySelectorAll<HTMLElement>('.card.open')].length > 0 || b.classList.contains('open'));
  let open = readFold(menu, key) ?? (closed ? false : QUIET.test(key) || (heads >= 3 && big) ? false : true);
  if (hasOpenCard) open = true;
  const sec = el('section', `section${open ? ' open' : ''}`);
  sec.dataset.fold = key;
  const head = el('button', 'section-head');
  head.setAttribute('aria-expanded', String(open));
  const count = countFor?.(title, body);
  head.append(el('span', 'section-title', count && title.includes(':') ? title.split(':')[0] : title), count ? el('span', 'section-count', count) : '', el('span', 'section-caret', open ? '▾' : '▸'));
  const box = el('div', 'section-body');
  box.append(...body);
  box.hidden = !open;
  head.addEventListener('click', () => {
    const now = !sec.classList.contains('open');
    writeFold(menu, key, now);
    sec.classList.toggle('open', now);
    box.hidden = !now;
    head.setAttribute('aria-expanded', String(now));
    head.lastElementChild!.textContent = now ? '▾' : '▸';
  });
  sec.append(head, box);
  if (pending && pending.menu === menu && pending.key === key) {
    pending = null;
    window.setTimeout(() => sec.scrollIntoView({ block: 'start' }), 30);
  }
  return sec;
}

/* ---------------------------------------------------------------- pictures from the map frame */

type PictureFn = (h: { person?: number; building?: string }) => HTMLCanvasElement | null;
function pictureFn(): PictureFn | null {
  try {
    for (const f of Array.from(window.parent.document.querySelectorAll('iframe'))) {
      const w = f.contentWindow as (Window & { __picture?: PictureFn }) | null;
      if (w?.__picture) return w.__picture;
    }
    const own = (window.parent as Window & { __picture?: PictureFn }).__picture;
    if (own) return own;
  } catch {
    /* (the desktop's menu is a window of its own: no map beside it) */
  }
  return null;
}
const thumbs = new Map<string, string>();
/** A building's picture as the map draws it (from the strip beside the menu), for a list. Empty until the strip has the
 *  picture; filled in a moment later, with no redraw. */
export function thumb(defId: string, size = 40): HTMLElement {
  const box = el('span', 'thumb');
  box.style.width = box.style.height = `${size}px`;
  const fill = (url: string) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.className = 'thumb-img';
    box.replaceChildren(img);
  };
  const have = thumbs.get(defId);
  if (have) {
    fill(have);
    return box;
  }
  let tries = 0;
  const attempt = () => {
    const c = pictureFn()?.({ building: defId });
    if (c) {
      try {
        const url = c.toDataURL();
        thumbs.set(defId, url);
        fill(url);
      } catch {
        /* (a tainted canvas: no picture) */
      }
      return;
    }
    if (++tries < 8) window.setTimeout(attempt, 600);
  };
  attempt();
  return box;
}

/** A cell of one of the item icon sheets, `size` px (until the shared `icon(name)` helper is in). */
export function sheetIcon(sheet: IconSheet, index: number, size = 16): HTMLElement {
  const info = iconSheet(sheet);
  const e = el('span', 'num-icon');
  e.style.cssText = `display:inline-block;flex:none;width:${size}px;height:${size}px;image-rendering:pixelated;background-image:url(${info.url});background-size:${info.cols * size}px auto;background-position:-${(index % info.cols) * size}px -${Math.floor(index / info.cols) * size}px`;
  return e;
}

/* ---------------------------------------------------------------- swipe right closes */

/** A swipe to the right on the menu closes the most recently opened card, else a sheet's own close (muster). */
export function installSwipe(root: HTMLElement, closeCard: () => boolean): void {
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let live = false;
  root.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    live = e.touches.length === 1;
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = Date.now();
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (!live) return;
    live = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (dx < 80 || Math.abs(dy) > 45 || Math.abs(dx) < Math.abs(dy) * 2.5 || Date.now() - t0 > 600) return;
    // (a swipe that began on something that scrolls sideways is its own)
    const from = document.elementFromPoint(x0, y0);
    if (from?.closest('.no-swipe, input[type=range], canvas.tech-canvas')) return;
    if (!closeCard()) {
      const sheet = root.querySelector<HTMLElement>('.over-tabs');
      const btn = sheet && [...sheet.querySelectorAll<HTMLButtonElement>('button')].find((b) => /^(cancel|close|back)/i.test(b.textContent ?? ''));
      btn?.click();
    }
  }, { passive: true });
}

/* ---------------------------------------------------------------- minimal styles */

const STYLE = `
.section { margin: 6px 0; border: 1px solid rgba(120,90,60,0.5); border-radius: 6px; overflow: hidden; }
.section-head { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 6px 10px; text-align: left; background: rgba(60,40,26,0.55); color: inherit; border: 0; font: inherit; font-weight: 600; cursor: pointer; }
.section-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.section-count { opacity: 0.8; font-weight: 400; font-size: 0.9em; white-space: nowrap; }
.section-caret { opacity: 0.7; width: 1em; text-align: center; }
.section-body { padding: 4px 8px 8px; }
.section-body > h2:first-child { margin-top: 4px; }
.menu-tabs { position: sticky; top: 0; z-index: 5; background: #211811; padding: 4px 0; margin-top: 0; box-shadow: 0 -14px 0 #211811; }
.dash { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin: 6px 0 10px; }
.dash-card { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; text-align: left; color: inherit; font: inherit; background: rgba(60,40,26,0.55); border: 1px solid rgba(120,90,60,0.6); border-radius: 6px; min-height: 64px; cursor: pointer; }
.dash-card.wide { grid-column: 1 / -1; }
.dash-card.card-urgent { border-color: #d06a4a; box-shadow: 0 0 0 1px #d06a4a inset; background: rgba(120,40,24,0.35); }
.dash-label { font-size: 0.8em; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.04em; display: flex; gap: 4px; align-items: center; }
.dash-value { font-size: 1.25em; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.dash-sub { font-size: 0.85em; opacity: 0.85; }
.dash-bar { height: 5px; border-radius: 3px; background: rgba(0,0,0,0.35); overflow: hidden; margin-top: 3px; }
.dash-bar > i { display: block; height: 100%; background: #c8a050; }
.why-line { font-style: italic; opacity: 0.9; font-size: 0.85em; margin-top: 2px; }
.thumb { display: inline-flex; flex: none; align-items: center; justify-content: center; vertical-align: middle; margin-right: 8px; background: rgba(0,0,0,0.25); border-radius: 4px; overflow: hidden; }
.thumb-img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
.calling-mark { flex: none; vertical-align: middle; }
.card-top .thumb, .card-top .calling-mark { margin-right: 4px; }
`;
let styled = false;
export function ensureStructureStyle(): void {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'structure-style';
  st.textContent = STYLE;
  document.head.append(st);
}
