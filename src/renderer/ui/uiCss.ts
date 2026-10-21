// The shared look's stylesheet (the owner's ask: menus that look better and more thought out), put into every page
// (the menus, the phone's page, the town strip) by ui/frame.ts. Everything here is a CSS variable or a class any panel
// can use:
//
// - The frame set (pack sprites tinted for the people, ui/frame.ts): --ui-frame (the rim round menus and cards, its
//   slice --ui-cut), --ui-btn / --ui-btn-down / --ui-btn-off / --ui-btn-on (a button's face, held, can't be pressed, and
//   chosen), --ui-chip / --ui-chip-on, --ui-divider (under a heading), --ui-handle (a sheet's grip).
// - Classes: .ui-frame (a framed box), .ui-frame-big (the event box, the news page), .ui-btn, .ui-tab, .ui-chip,
//   .ui-divider, .ui-handle, .ui-icon (ui/icon.ts), and the type scale .ui-head, .ui-body, .ui-small, .ui-label.
// - The type scale: --ui-fs-head, --ui-fs-body, --ui-fs-small, --ui-fs-label. Motion: --ui-fast, --ui-slow (never over
//   250 ms), --ui-ease. Night (html.ui-night, deeper with --ui-night 0..1): the menus dimmer and warmer.
//
// The skins (skins.ts) still give each people its colours, ornaments and fonts; the frames go over their code-drawn
// borders, so the selectors here are the skins' own (parts()) under html.ui-look.ui-look, one class stronger.

import { parts } from '../skins';

const U = 'html.ui-look.ui-look';

/** Every selector of a list, with something added to each ('a, b' + ':active' -> 'a:active, b:active'). */
const each = (list: string, add: string): string => list.split(', ').map((x) => x + add).join(', ');
/** Two ids' weight, so a tab, a chip or the chosen outweighs the skins' button selector (an id among its :not()s). */
const BOOST = ':not(#ui-0):not(#ui-1)';
const boost = (list: string): string => each(list, BOOST);

export function uiCss(): string {
  const P = parts(U);
  const cards = `${P.frame}, ${P.card}, ${U} .ui-frame, ${U} .glance-tile, ${U} #notice-sheet .notice-item, ${U} .event-body, ${U} #top`;
  const big = `${U} .ui-frame-big, ${U} .event-body, ${U} #fight-result, ${U} #raid-recap`;
  const btns = `${P.btn}, ${U} .ui-btn, ${U} .event-option, ${U} .notice-act, ${U} .notice-btn, ${U} #top .top-btn`;
  const tabs = `${U} .menu-tabs .inv-tab, ${U} .ui-tab, ${U} #tabs button`;
  return `
:root {
  --ui-fs-head: 15px; --ui-fs-body: 13px; --ui-fs-small: 11.5px; --ui-fs-label: 10.5px;
  --ui-fast: 140ms; --ui-slow: 220ms; --ui-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ui-cut: 9; --ui-cut-px: 9px; --ui-night: 0;
}
${U} { --ui-surface: rgba(40, 28, 18, 0.94); --ui-face-text: var(--text, #f1e2c2); --ui-on-text: #fff8ea; --ui-off-text: rgba(255, 255, 255, 0.55); }

/* ---------------------------------------------------------------- the type scale */
${U} .ui-head, ${U} h1 { font-size: var(--ui-fs-head); }
${U} .ui-body { font-size: var(--ui-fs-body); }
${U} .ui-small, ${U} .hint, ${U} .glance-sub, ${U} .more-hint { font-size: var(--ui-fs-small); }
${U} .ui-label, ${U} .glance-label { font-size: var(--ui-fs-label); letter-spacing: 0.07em; text-transform: uppercase; }
${U}.page-panel main h2, ${U} .notice-head h2 { font-size: var(--ui-fs-label); letter-spacing: 0.1em; }

/* ---------------------------------------------------------------- framed boxes */
${cards} {
  border-style: solid !important; border-width: var(--ui-cut-px) !important; border-color: rgba(0, 0, 0, 0.35) !important;
  border-image-source: var(--ui-frame, none) !important; border-image-slice: var(--ui-cut) !important;
  border-image-width: var(--ui-cut-px) !important; border-image-repeat: stretch !important; border-image-outset: 0 !important;
  border-radius: 0 !important; clip-path: none !important; background-clip: padding-box !important;
}
${big} { --ui-cut-px: calc(var(--ui-cut) * 1.5px); }
${U} .ui-frame, ${U} .event-body, ${U} #top { background-color: var(--ui-surface); }
${U}.page-panel header {
  border-style: solid !important; border-width: 0 0 var(--ui-cut-px) !important;
  border-image-source: var(--ui-frame, none) !important; border-image-slice: 0 var(--ui-cut) var(--ui-cut) !important;
  border-image-width: 0 0 var(--ui-cut-px) !important; border-image-repeat: stretch !important;
}
${U} .glance-tile { padding: 4px 6px !important; min-height: 52px; }
${U} .glance-tile.warn { background-color: rgba(192, 70, 50, 0.28) !important; }
${U} .card { padding: 4px 6px; }
${each(cards, ':focus-visible')} { outline: 2px solid var(--heading, #e8c88a); outline-offset: 1px; }

/* ---------------------------------------------------------------- buttons: the slab's face, held, can't, chosen */
${btns} {
  border-style: solid !important; border-width: 6px !important; border-color: rgba(0, 0, 0, 0.4) !important;
  border-image-source: var(--ui-btn, none) !important; border-image-slice: 6 fill !important; border-image-width: 6px !important;
  border-image-repeat: stretch !important; border-radius: 0 !important; clip-path: none !important;
  background: transparent !important; color: var(--ui-face-text) !important; box-shadow: none;
  image-rendering: pixelated; text-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
  transition: transform var(--ui-fast) var(--ui-ease), filter var(--ui-fast) var(--ui-ease);
  -webkit-tap-highlight-color: transparent;
}
${U} .place { padding: 0 9px; }
/* (the strip's buttons were drawn a set height: on the phone they grow to take the rim; the desktop's slim strip
   keeps its height with a thinner rim) */
${boost(`${U} body.embedded .tab`)} { height: auto !important; min-height: 32px; padding: 0 8px; line-height: 1.2; }
${boost(`${U}.page-strip body:not(.embedded) .tab`)} { border-width: 3px !important; border-image-width: 3px !important; }
${U} .place.small { padding: 0 5px; }
${each(btns, ':active:not(:disabled)')}, ${each(btns, '.ui-down:not(:disabled)')} {
  border-image-source: var(--ui-btn-down, var(--ui-btn, none)) !important; transform: translateY(1px);
}
${each(btns, ':disabled')}, ${each(btns, '[aria-disabled="true"]')} {
  border-image-source: var(--ui-btn-off, var(--ui-btn, none)) !important; color: var(--ui-off-text) !important; text-shadow: none;
}
${boost(`${P.on}, ${U} .ui-btn.on, ${U} .event-option.recommended, ${U} button.primary`)} {
  border-image-source: var(--ui-btn-on, var(--ui-btn, none)) !important; color: var(--ui-on-text) !important;
  box-shadow: 0 0 8px var(--ui-glow, transparent) !important; filter: none;
}
${boost(`${U} button.danger`)} { border-image-source: var(--ui-btn-down, var(--ui-btn, none)) !important; color: #ffb0a0 !important; }
/* (the news bubble keeps its tone inside the slab's rim: blue, gold for something that wants you, red a threat) */
${boost(`${U} #notice-bubble`)} { border-image-slice: 6 !important; background: #2a5a9a !important; background-clip: padding-box !important; color: #fff !important; }
${boost(`${U} #notice-bubble.tone-gold`)} { background: #b8882a !important; }
${boost(`${U} #notice-bubble.tone-red`)} { background: #a83224 !important; }
@media (hover: hover) {
  ${each(btns, ':hover:not(:disabled)')} { filter: brightness(1.12); }
}

/* ---------------------------------------------------------------- tabs: idle on a chip, the chosen on the slab */
${boost(tabs)} {
  border-style: solid !important; border-width: 5px !important; border-color: transparent !important;
  border-image-source: var(--ui-chip, none) !important; border-image-slice: 5 fill !important; border-image-width: 5px !important;
  border-radius: 0 !important; clip-path: none !important; background: transparent !important;
  color: var(--text-dim, #bfa981) !important; filter: none; box-shadow: none !important;
  transition: color var(--ui-fast) var(--ui-ease), transform var(--ui-fast) var(--ui-ease);
}
${boost(`${U} #tabs button`)} { border-image-source: none !important; }
${boost(`${each(tabs, '.on')}, ${U} .menu-tabs .inv-tab.on`)} {
  border-width: 6px !important; border-image-source: var(--ui-btn-on, var(--ui-chip-on, none)) !important; border-image-slice: 6 fill !important;
  border-image-width: 6px !important; color: var(--ui-on-text) !important; box-shadow: 0 0 8px var(--ui-glow, transparent) !important;
}
${boost(`${U} .menu-tabs .inv-tab`)} { padding: 1px 7px !important; }
${boost(`${U} .menu-tabs .inv-tab.on`)} { padding: 0 6px !important; }
${boost(each(tabs, ':active'))} { transform: translateY(1px); }
${U} #tabs button.on::after { display: none; }
${U} #tabs {
  border-style: solid !important; border-width: 0 !important; border-top-width: var(--ui-cut-px) !important;
  border-image-source: var(--ui-frame, none) !important; border-image-slice: var(--ui-cut) var(--ui-cut) 0 !important;
  border-image-width: var(--ui-cut-px) 0 0 !important; border-image-repeat: stretch !important; background: var(--ui-surface) !important;
}

/* ---------------------------------------------------------------- chips */
${boost(`${U} .chip, ${U} .ui-chip`)} {
  border-style: solid !important; border-width: 4px !important; border-color: transparent !important;
  border-image-source: var(--ui-chip, none) !important; border-image-slice: 5 fill !important; border-image-width: 4px !important;
  border-radius: 0 !important; clip-path: none !important; background: transparent !important; padding: 0 3px !important;
  color: var(--ui-face-text);
}
${boost(`${U} .chip.on, ${U} .ui-chip.on, ${U} button.chip.on`)} { border-image-source: var(--ui-chip-on, var(--ui-chip, none)) !important; color: var(--ui-on-text) !important; outline: 0; }

/* ---------------------------------------------------------------- dividers and a sheet's grip */
${U}.page-panel main h2::after, ${U} .ui-divider, ${U} .event-text + .event-advice::before {
  content: ''; display: block; height: 7px; margin-top: 3px; box-sizing: border-box;
  border-style: solid; border-width: 0 7px; border-color: transparent;
  border-image: var(--ui-divider, none) 0 8 fill / 0 7px stretch; opacity: 0.85;
}
${U} .ui-handle, ${U} #sheet::before, ${U} #notice-sheet::before {
  content: ''; display: block; width: 44px; height: 8px; margin: 0 auto; box-sizing: border-box;
  border-style: solid; border-width: 4px; border-color: transparent;
  border-image: var(--ui-handle, none) 5 fill / 4px stretch; opacity: 0.9; pointer-events: none;
}
${U} #sheet::before { position: absolute; top: 2px; left: 50%; margin-left: -22px; z-index: 2; }
${U} #notice-sheet::before { position: sticky; top: 2px; margin-bottom: -8px; z-index: 2; }

/* ---------------------------------------------------------------- icons (ui/icon.ts) */
.ui-icon { display: inline-block; flex: none; vertical-align: -3px; image-rendering: pixelated; }
${U} .glance-label { display: flex; align-items: center; gap: 4px; max-width: 100%; white-space: nowrap; letter-spacing: 0.04em; }
.glance-label .ui-icon { flex: none; opacity: 1; }

/* ---------------------------------------------------------------- motion: sheets slide up, tabs cross-fade,
   bars ease, numbers tick (ui/motion.ts); nothing over 250 ms */
@keyframes ui-up { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ui-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ui-tick { 0% { transform: translateY(-3px); color: var(--heading, #ffe08a); } 100% { transform: none; } }
${U} #sheet:not([hidden]), ${U} #notice-sheet:not([hidden]), ${U} #event-sheet:not([hidden]) .event-body,
${U} #inspect:not([hidden]), ${U} #menu:not([hidden]), ${U} #prompt:not([hidden]), ${U} #person-card:not([hidden]),
${U} #ui-tip:not([hidden]) { animation: ui-up var(--ui-slow) var(--ui-ease); }
${U} main.ui-xfade > * { animation: ui-fade var(--ui-slow) var(--ui-ease); }
${U} .ui-ticked { display: inline-block; animation: ui-tick var(--ui-slow) var(--ui-ease); }
${U} .bar-fill, ${U} .meter-fill, ${U} .tab-fill, ${U} .fp-bar, ${U} .boss-fill, ${U} .ff-gauge > * { transition: width var(--ui-slow) var(--ui-ease); }
@media (prefers-reduced-motion: reduce) {
  ${U} *, ${U} *::before, ${U} *::after { animation: none !important; transition: none !important; }
}

/* ---------------------------------------------------------------- night: dimmer and warmer, so a night raid doesn't
   blind (the menus' page under a veil; on the phone's page and the strip, each framed thing) */
${U}.page-panel::after {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 60;
  background: rgba(36, 18, 0, 0.32); mix-blend-mode: multiply; opacity: var(--ui-night); transition: opacity 0.25s;
}
${U}.ui-night #tabs, ${U}.ui-night #inspect, ${U}.ui-night #menu, ${U}.ui-night #notice-sheet,
${U}.ui-night #notice-bubble, ${U}.ui-night #event-sheet, ${U}.ui-night #prompt, ${U}.ui-night #person-card,
${U}.ui-night #banner, ${U}.ui-night .ff-window, ${U}.ui-night #fight-top, ${U}.ui-night #fight-bottom, ${U}.ui-night #ui-tip {
  filter: brightness(calc(1 - var(--ui-night) * 0.2)) sepia(calc(var(--ui-night) * 0.22));
}
/* (the top bar holds the ☰, which a filter would pin to the bar when it moves aside: a shade over its face instead) */
${U}.ui-night #top { box-shadow: inset 0 0 0 999px rgba(36, 18, 0, calc(var(--ui-night) * 0.3)); }
${U}.ui-night #top .top-main, ${U}.ui-night #top .top-mark { filter: brightness(calc(1 - var(--ui-night) * 0.15)) sepia(calc(var(--ui-night) * 0.2)); }

/* ---------------------------------------------------------------- the long-press tip (ui/tips.ts) */
#ui-tip {
  position: fixed; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 12px); z-index: 100;
  max-width: 420px; margin: 0 auto; box-sizing: border-box; padding: 6px 10px;
  color: var(--text, #f1e2c2); font: var(--ui-fs-small)/1.4 var(--font-body, sans-serif);
  background: linear-gradient(var(--ui-surface, rgba(30, 22, 14, 0.96)), var(--ui-surface, rgba(30, 22, 14, 0.96))), var(--bg, #1e150e);
  background-clip: padding-box;
  border: 9px solid rgba(0, 0, 0, 0.5); border-image: var(--ui-frame, none) var(--ui-cut) / var(--ui-cut-px) stretch;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55); pointer-events: none;
}
#ui-tip b { display: block; margin-bottom: 1px; font: 700 var(--ui-fs-body)/1.3 var(--font-display, inherit); color: var(--heading, #e8c88a); }
#ui-tip .ui-icon { float: left; margin: 1px 8px 0 0; }
`;
}
