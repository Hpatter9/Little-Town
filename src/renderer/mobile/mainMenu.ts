// The main menu (the owner's ask: "a main menu like a typical game ... continue, new game, load game, settings, and
// credits"). It is the first thing the phone shows: the logo on its carved wood, a dim night behind, Duchess at the
// foot and the menu's five items; the loading screen (mobile/loading.ts, which hosts this) takes over once a town is
// picked. Pure DOM, no Pixi, no game state: what it needs of the page it is handed (`MenuHost`).

import { CREDITS, CREDITS_NOTE } from './credits';
import { deleteSlot, freeSlot, MAX_SLOTS, readSlots, switchTo, type SlotInfo, type Store } from './saveSlots';

/** Set before the page reloads for a picked town, so the new page goes straight to loading (not the menu again). */
export const ENTER_KEY = 'littletown.enter';

/** What the menu shows of the town in play (from the game's first snapshot, once it is in). */
export interface TownSummary {
  name: string;
  people: number;
  day: number;
  season: string;
}

export interface MenuHost {
  store: Store;
  /** Is there a town to continue (a save was found at start)? */
  hasSave: boolean;
  summary(): TownSummary | null;
  version: string;
  /** Go to the loading screen with the town in play. */
  enter(): void;
  /** Open the founding flow (the New town panel). */
  newGame(): void;
  /** Open the ☰ menu's settings over the menu. */
  settings(): void;
  /** Called before a slot is deleted or swapped, so the game doesn't save the old town back over it. */
  leaving(): void;
  /** A page (Load game, Credits) is up in place of the items: the screen makes room. */
  paged(on: boolean): void;
}

export const MENU_CSS = `
#loading-screen .mm-root { display: contents; }
#loading-screen.paged .ls-logo { display: none; }
#loading-screen.paged .ls-front { justify-content: center; padding: env(safe-area-inset-top) 16px 100px; }
#loading-screen .mm { display: none; flex-direction: column; align-items: stretch; gap: 8px; width: min(86vw, 330px); box-sizing: border-box; }
#loading-screen.menu .mm { display: flex; animation: mm-in 420ms ease both; }
#loading-screen.menu .ls-bar, #loading-screen.menu .ls-line, #loading-screen.menu .ls-tip, #loading-screen.menu .ls-tap { display: none; }
@keyframes mm-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
#loading-screen [role=button] { cursor: pointer; -webkit-tap-highlight-color: transparent; outline-offset: 2px; }
#loading-screen .mm-item { position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; min-height: 48px; box-sizing: border-box; padding: 0 6px; text-align: center;
  border: 14px solid #5a3f25; border-image: url(loading/wood.png) 9 fill / 14px stretch; image-rendering: pixelated; background: none;
  font: 700 19px/20px 'Alegreya SC', Georgia, serif; letter-spacing: 0.07em; color: #f0d28a; text-shadow: 0 1px 0 #1e130a, 0 0 6px rgba(0,0,0,0.6);
  filter: drop-shadow(0 3px 5px rgba(0,0,0,0.55)); }
#loading-screen .mm-item:active:not(.off) { transform: translateY(1px); filter: brightness(0.9) drop-shadow(0 2px 3px rgba(0,0,0,0.5)); }
#loading-screen .mm-item.off { filter: grayscale(0.85) brightness(0.55); cursor: default; }
#loading-screen .mm-item small { display: block; margin-top: 2px; font: 400 12.5px/15px 'Alegreya Sans', system-ui, sans-serif; letter-spacing: 0.02em; color: #d8c8a6; text-shadow: 0 1px 1px #000; }
#loading-screen .mm-item.bright { filter: brightness(1.2) drop-shadow(0 0 10px rgba(255,200,110,0.65)); color: #ffe6a0; animation: mm-glow 2.2s ease-in-out infinite; }
@keyframes mm-glow { 50% { filter: brightness(1.3) drop-shadow(0 0 16px rgba(255,200,110,0.9)); } }
#loading-screen .mm-hint { text-align: center; font: 400 13.5px/1.3 'Alegreya Sans', system-ui, sans-serif; color: #e8c88a; text-shadow: 0 1px 2px #000; min-height: 17px; }
#loading-screen .mm-foot { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom) + 2px); text-align: center; pointer-events: none;
  font: 400 11px/14px 'Alegreya Sans', system-ui, sans-serif; color: rgba(232,214,176,0.95); text-shadow: 0 1px 3px #000, 0 0 6px #000; font-variant-numeric: tabular-nums; display: none; }
#loading-screen.menu .mm-foot { display: block; }
#loading-screen.menu > .ls-goat { bottom: calc(env(safe-area-inset-bottom) + 14px); }
#loading-screen .mm-page { display: none; flex-direction: column; gap: 8px; width: min(90vw, 380px); box-sizing: border-box; max-height: calc(100dvh - 64px - env(safe-area-inset-top)); }
#loading-screen .mm-page.on { display: flex; }
#loading-screen .mm-h { margin: 0; padding: 2px 0; text-align: center; font: 700 22px/1.1 'Alegreya SC', Georgia, serif; letter-spacing: 0.08em; color: #f0d28a; text-shadow: 0 2px 0 #1e130a; }
#loading-screen .mm-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; padding: 12px 14px; border-radius: 6px;
  background: rgba(24,16,10,0.88); border: 2px solid #6e4d2e; box-shadow: 0 6px 18px rgba(0,0,0,0.6); -webkit-overflow-scrolling: touch; }
#loading-screen .mm-card { display: block; font: inherit;  width: 100%; box-sizing: border-box; min-height: 56px; margin: 0 0 8px; padding: 8px 10px; text-align: left; border-radius: 4px;
  background: #3b2b1e; border: 1px solid #22170f; color: #f1e2c2; }
#loading-screen .mm-card.now { border-color: #c79a55; background: #4a3624; }
#loading-screen .mm-card b { display: block; font: 700 17px/1.15 'Alegreya SC', Georgia, serif; letter-spacing: 0.04em; color: #f0d28a; }
#loading-screen .mm-card span { display: block; margin-top: 2px; font: 400 13px/1.25 'Alegreya Sans', system-ui, sans-serif; color: #d8c8a6; }
#loading-screen .mm-row { display: flex; gap: 8px; margin: -2px 0 10px; }
#loading-screen .mm-small { flex: 1; min-height: 44px; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; border-radius: 4px; background: #2a1d13; border: 1px solid #6e4d2e; color: #e8c88a; font: 700 14px 'Alegreya Sans', system-ui, sans-serif; }
#loading-screen .mm-small.danger { color: #ffb0a0; border-color: #a0503c; }
#loading-screen .mm-note { text-align: center; font: 400 13px/1.3 'Alegreya Sans', system-ui, sans-serif; color: #bfa981; }
#loading-screen .mm-credit { margin: 0 0 10px; font: 400 13.5px/1.3 'Alegreya Sans', system-ui, sans-serif; color: #d8c8a6; user-select: text; }
#loading-screen .mm-credit b { display: block; color: #f1e2c2; font-weight: 700; }
#loading-screen .mm-credit i { font-style: normal; color: #bfa981; }
#loading-screen .mm-h3 { margin: 14px 0 6px; font: 700 15px 'Alegreya SC', Georgia, serif; letter-spacing: 0.08em; color: #e8c88a; border-bottom: 1px solid rgba(255,255,255,0.14); }
#loading-screen .mm-h3:first-child { margin-top: 0; }
#loading-screen .mm-title { text-align: center; font: 700 17px 'Alegreya SC', Georgia, serif; color: #f0d28a; }
#loading-screen .mm-ver { text-align: center; font: 400 12px 'Alegreya Sans', system-ui, sans-serif; color: #bfa981; margin-bottom: 10px; }
@media (orientation: landscape) and (max-height: 560px) {
  #loading-screen.menu .ls-front { right: 0; flex-direction: row; justify-content: center; align-items: center; gap: 4vw; padding: env(safe-area-inset-top) 12px 18px; }
  #loading-screen.menu .ls-logo { margin-left: env(safe-area-inset-left); }
  #loading-screen.paged .ls-logo { display: flex; }
  #loading-screen.paged .ls-front { padding: env(safe-area-inset-top) 12px 18px; }
  #loading-screen .mm { gap: 6px; width: min(40vw, 320px); }
  #loading-screen .mm-item { min-height: 44px; border-width: 12px; border-image-width: 12px; font-size: 17px; }
  #loading-screen .mm-item small { display: none; }
  #loading-screen .mm-item.continue small { display: block; }
  #loading-screen .mm-page { max-height: calc(100dvh - 24px); width: min(70vw, 440px); }
}
@media (prefers-reduced-motion: reduce) { #loading-screen.menu .mm { animation: none; } #loading-screen .mm-item.bright { animation: none; } }
`;

const SEASONS: Record<string, string> = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

/** "just now", "3 hours ago", "2 days ago". */
export function ago(then: number, now: number): string {
  if (!then) return 'not yet saved';
  const m = Math.max(0, Math.round((now - then) / 60000));
  if (m < 2) return 'just now';
  if (m < 90) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
/** A button that the page's theme can't restyle (it dresses every <button>): a div with a button's manners. */
const btn = (cls: string, text?: string): HTMLElement => {
  const b = el('div', cls, text);
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      b.click();
    }
  });
  return b;
};
const setOff = (b: HTMLElement, off: boolean) => {
  b.classList.toggle('off', off);
  b.setAttribute('aria-disabled', String(off));
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface MainMenu {
  root: HTMLElement;
  /** The menu's items, in the front column (beside or under the logo). */
  items: HTMLElement;
  /** The version line, laid at the foot of the screen. */
  foot: HTMLElement;
  /** The Load and Credits pages, shown in place of the items. */
  pages: HTMLElement;
  /** Show the items again (the pages closed), with the latest of what the town is. */
  home(): void;
  /** The town's summary has come (or changed). */
  refresh(): void;
}

export function createMainMenu(host: MenuHost): MainMenu {
  const root = el('div', 'mm-root');
  const items = el('div', 'mm');
  const hint = el('div', 'mm-hint');
  const foot = el('div', 'mm-foot', host.version);
  const pages = el('div', 'mm-pages');
  pages.style.display = 'contents';
  const item = (cls: string, label: string, small?: string) => {
    const b = btn(`mm-item ${cls}`);
    b.append(document.createTextNode(label));
    if (small !== undefined) b.append(el('small', undefined, small));
    return b;
  };
  const cont = item('continue', 'Continue', '');
  const fresh = item('new', 'New game');
  const load = item('load', 'Load game');
  const settings = item('settings', 'Settings');
  const credits = item('credits', 'Credits');
  items.append(cont, fresh, load, settings, credits, hint);

  const showItems = (on: boolean) => {
    items.style.display = on ? '' : 'none';
    host.paged(!on);
  };
  const page = (title: string, build: (body: HTMLElement) => void, back = 'Back') => {
    pages.replaceChildren();
    const p = el('div', 'mm-page on');
    const body = el('div', 'mm-scroll');
    build(body);
    const b = item('back', back);
    b.addEventListener('click', home);
    p.append(el('div', 'mm-h', title), body, b);
    pages.append(p);
    showItems(false);
    return body;
  };
  function home(): void {
    pages.replaceChildren();
    showItems(true);
    refresh();
  }

  function refresh(): void {
    const book = readSlots(host.store, Date.now());
    const free = freeSlot(book.slots);
    const s = host.summary();
    const me = book.slots.find((x) => x.n === book.current);
    setOff(cont, !host.hasSave);
    cont.replaceChildren(document.createTextNode('Continue'));
    if (host.hasSave) {
      const name = s?.name ?? me?.name ?? 'Your town';
      const people = s?.people ?? me?.people ?? 0;
      const day = s?.day ?? me?.day ?? 0;
      const season = s?.season ? `${SEASONS[s.season] ?? s.season}, ` : '';
      cont.append(el('small', undefined, [name, people ? plural(people, 'person', 'people') : '', day ? `${season}day ${day}` : ''].filter(Boolean).join(' · ')));
    } else cont.append(el('small', undefined, 'No town yet'));
    fresh.classList.toggle('bright', !host.hasSave);
    fresh.replaceChildren(document.createTextNode('New game'));
    if (host.hasSave && free === null) fresh.append(el('small', undefined, 'Slots full: it takes the town in play'));
    setOff(load, book.slots.length === 0);
    hint.textContent = host.hasSave ? '' : 'Your story begins here: found a town.';
  }

  cont.addEventListener('click', () => host.hasSave && host.enter());
  fresh.addEventListener('click', () => host.newGame());
  settings.addEventListener('click', () => host.settings());

  const reloadInto = () => {
    try {
      sessionStorage.setItem(ENTER_KEY, '1');
    } catch {}
    location.reload();
  };

  load.addEventListener('click', () => {
    if (load.classList.contains('off')) return;
    page('Load game', (body) => {
      const draw = () => {
        const book = readSlots(host.store, Date.now());
        body.replaceChildren();
        const now = Date.now();
        for (const sl of book.slots) body.append(card(sl, sl.n === book.current, now, draw));
        body.append(el('div', 'mm-note', book.slots.length >= MAX_SLOTS ? `Slots ${book.slots.length} of ${MAX_SLOTS}: Full. Delete one to found another.` : `Slots ${book.slots.length} of ${MAX_SLOTS}`));
        if (!book.slots.length) body.append(el('div', 'mm-note', 'No saved towns yet.'));
      };
      draw();
    });
  });
  const card = (sl: SlotInfo, now: boolean, at: number, redraw: () => void): HTMLElement => {
    const wrap = el('div');
    const c = btn(`mm-card${now ? ' now' : ''}`);
    c.append(
      el('b', undefined, sl.name || 'Your town'),
      el('span', undefined, [sl.people ? plural(sl.people, 'person', 'people') : '', sl.day ? `day ${sl.day}` : '', sl.origin].filter(Boolean).join(' · ') || 'A town'),
      el('span', undefined, `${now ? 'In play · ' : ''}saved ${ago(sl.savedAt, at)}`),
    );
    const row = el('div', 'mm-row');
    const del = btn('mm-small', 'Delete');
    const msg = el('div', 'mm-note');
    del.addEventListener('click', () => {
      row.replaceChildren();
      const yes = btn('mm-small danger', now ? 'Yes, delete the town in play' : 'Yes, delete it');
      const no = btn('mm-small', 'Keep it');
      no.addEventListener('click', redraw);
      yes.addEventListener('click', () => {
        host.leaving();
        deleteSlot(host.store, sl.n);
        if (now) reloadInto0();
        else redraw();
      });
      row.append(yes, no);
    });
    c.addEventListener('click', () => {
      if (now) return host.enter();
      host.leaving();
      const r = switchTo(host.store, sl.n);
      if (r.ok) reloadInto();
      else msg.textContent = r.reason === 'full' ? 'No room in the browser to swap towns. Delete a slot first.' : 'That town could not be found.';
    });
    row.append(del);
    wrap.append(c, row, msg);
    return wrap;
  };
  // (a deleted town in play: the page starts over with nothing to continue)
  const reloadInto0 = () => location.reload();

  credits.addEventListener('click', () => {
    page('Credits', (body) => {
      body.append(el('div', 'mm-title', 'Chronos Settlement'), el('div', 'mm-ver', host.version));
      for (const g of CREDITS) {
        body.append(el('div', 'mm-h3', g.heading));
        for (const l of g.lines) {
          const p = el('p', 'mm-credit');
          p.append(el('b', undefined, l.pack), document.createTextNode(l.by), document.createElement('br'), el('i', undefined, l.licence));
          body.append(p);
        }
      }
      body.append(el('div', 'mm-note', CREDITS_NOTE));
    });
  });

  root.append(items, pages);
  refresh();
  return { root, items, foot, pages, home, refresh };
}
