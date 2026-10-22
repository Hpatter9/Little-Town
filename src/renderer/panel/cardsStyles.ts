// The rich cards' styles (personCard.ts, buildingCard.ts, the event box's story card, the raid recap's comic strip, the
// Chronicle's timeline), kept out of the shared style blocks so the look can restyle them on their own. Plain class names,
// all prefixed `pc-` (person), `bc-` (building), `ev-` (event), `rs-` (recap strip), `tl-` (timeline) or `card-fade`.
// Added to a page once, by the first card made there.

export const CARDS_CSS = `
/* cross-fade between a card's tabs */
.card-fade { animation: card-fade 200ms ease-out; }
@keyframes card-fade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .card-fade { animation: none; } }

.pc-sheet, .bc-sheet { display: flex; flex-direction: column; gap: 8px; }
.pc-head { display: flex; gap: 10px; align-items: flex-start; }
.pc-portrait-col { display: flex; flex-direction: column; gap: 5px; width: 92px; flex: none; }
.pc-portrait {
  position: relative; width: 92px; height: 92px; border-radius: 10px; overflow: hidden;
  background: radial-gradient(circle at 50% 30%, #4a3a28, #1c140c); border: 2px solid #6b5230;
}
.pc-portrait canvas { width: 100%; height: 100%; image-rendering: pixelated; display: block; }
.pc-badge { position: absolute; right: 3px; bottom: 3px; background: #1c140ccc; border-radius: 6px; padding: 1px; display: flex; }
.pc-calling { position: absolute; left: 3px; bottom: 3px; min-width: 22px; height: 22px; border-radius: 6px; background: #1c140ccc; color: #ffd84a; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
.pc-calling canvas { width: 20px; height: 20px; }
.pc-portrait.mythic { box-shadow: 0 0 8px 1px currentColor; }
.pc-mythic { align-self: center; margin: 2px 0; font-size: var(--ui-fs-small, 11px); }
.pc-bars { display: flex; flex-direction: column; gap: 3px; }
.pc-bar { position: relative; height: 12px; border-radius: 6px; background: #00000066; overflow: hidden; }
.pc-bar > i { position: absolute; inset: 0 auto 0 0; border-radius: 6px; transition: width 300ms ease-out; }
.pc-bar > span { position: absolute; inset: 0; font-size: 9px; line-height: 12px; padding-left: 6px; color: #fff; text-shadow: 0 1px 1px #000; white-space: nowrap; }
.pc-bar.hp > i { background: #c24040; } .pc-bar.mp > i { background: #4a7ae0; } .pc-bar.mood > i { background: #d8b040; } .pc-bar.food > i { background: #6aa84a; }
.pc-who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.pc-name { font-size: 18px; font-weight: 700; line-height: 1.1; }
.pc-fav { margin-left: 8px; min-width: 32px; min-height: 32px; padding: 0 6px; border-radius: 16px; border: 1px solid #4a3722; background: #2a1f16; color: #e8a0a0; font-size: 18px; line-height: 1; vertical-align: middle; font-family: inherit; }
button.pc-fav.on:not(#ui-0):not(#ui-1):not(#ui-2) { color: #ff4a5e !important; text-shadow: 0 0 6px #ff4a5e88; }
button.pc-fav:not(.on):not(#ui-0):not(#ui-1):not(#ui-2) { color: #e8d8c0 !important; }
.pc-fav:disabled { opacity: 0.4; }
.pc-doing { font-size: 12px; opacity: 0.85; }
.pc-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.pc-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; min-height: 22px; border-radius: 11px; font-size: 11px; background: #2a1f16; border: 1px solid #4a3722; color: inherit; font-family: inherit; }
.pc-chip.title { border-color: #ffd84a88; color: #ffd84a; }
.pc-chip.calling { border-color: #7aa8ff88; }
.pc-chip.warn { border-color: #e06060; color: #ff9090; }
.pc-tabs { display: flex; gap: 4px; }
.pc-tab { flex: 1; min-height: 44px; border-radius: 8px; border: 1px solid #4a3722; background: #2a1f16; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.pc-tab.on { border-color: #ffd84a; background: #3b2b1e; box-shadow: inset 0 0 0 1px #ffd84a; }
.pc-body { display: flex; flex-direction: column; gap: 8px; }
.pc-sec { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; margin-top: 2px; }
.pc-text { font-size: 13px; line-height: 1.45; }
.pc-diary { font-size: 12px; line-height: 1.4; padding-left: 8px; border-left: 2px solid #6b5230; opacity: 0.9; }
.pc-skill { display: grid; grid-template-columns: 82px 1fr 28px; gap: 6px; align-items: center; font-size: 12px; }
.pc-skill .pc-bar { height: 8px; } .pc-skill .pc-bar > i { background: #d8b040; }
.pc-skill b { text-align: right; }
.pc-spell { padding: 6px 8px; border-radius: 8px; background: #2a1f16; border: 1px solid #4a3722; font-size: 12px; }
.pc-spell b { color: #9ab8ff; }
.pc-kin { display: flex; flex-wrap: wrap; gap: 8px; }
.pc-rel { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 62px; min-height: 44px; padding: 3px; border-radius: 8px; background: #2a1f16; border: 1px solid #4a3722; color: inherit; font: inherit; font-size: 10px; text-align: center; cursor: pointer; }
.pc-rel canvas { width: 40px; height: 40px; image-rendering: pixelated; }
.pc-rel.gone { opacity: 0.6; cursor: default; }
.pc-rel.enemy { border-color: #e06060; } .pc-rel.devoted { border-color: #ff8ac0; } .pc-rel.friend { border-color: #6aa84a; }
.pc-rel small { opacity: 0.7; font-size: 9px; }
.pc-slot { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 8px; border-radius: 8px; background: #2a1f16; border: 1px solid #4a3722; }
.pc-slot small { opacity: 0.65; margin-left: auto; }
.pc-pouch { display: flex; gap: 6px; flex-wrap: wrap; }
.pc-pouch span { min-width: 36px; min-height: 36px; border-radius: 8px; background: #1c140c; border: 1px dashed #4a3722; display: flex; align-items: center; justify-content: center; }

/* on a phone on its side: the portrait stays at the left, the rest beside it */
@media (orientation: landscape) and (max-height: 560px) {
  .pc-sheet { display: grid; grid-template-columns: 100px 1fr; column-gap: 12px; align-items: start; }
  .pc-head { display: contents; }
  .pc-portrait-col { grid-column: 1; grid-row: 1 / span 4; }
  .pc-who, .pc-tabs, .pc-body, .pc-sheet > button { grid-column: 2; }
  .pc-sheet > button { justify-self: start; }
  .bc-sheet { display: grid; grid-template-columns: 150px 1fr; column-gap: 10px; align-items: start; }
  .bc-top { grid-column: 1; grid-row: 1 / span 6; }
  .bc-sheet > :not(.bc-top) { grid-column: 2; }
}

/* the building card */
.bc-top { position: relative; border-radius: 10px; overflow: hidden; background: linear-gradient(#3a5a3a, #1c2c1c); border: 2px solid #6b5230; min-height: 96px; display: flex; align-items: flex-end; justify-content: center; padding: 8px; }
.bc-top canvas { image-rendering: pixelated; height: 84px; width: auto; max-width: 100%; }
.bc-state { position: absolute; left: 6px; top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
.bc-state .pc-chip { background: #1c140ccc; }
.bc-name { font-size: 18px; font-weight: 700; }
.bc-name-form { display: flex; gap: 6px; margin: 8px 0; }
.bc-name-form input { flex: 1; min-width: 0; min-height: 40px; padding: 6px 10px; font: inherit; font-size: 16px; }
.bc-people { display: flex; flex-wrap: wrap; gap: 8px; }
.bc-making { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; background: #2a1f16; border: 1px solid #4a3722; font-size: 12px; }
.bc-ring { width: 44px; height: 44px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: conic-gradient(#ffd84a calc(var(--p, 0) * 1%), #00000066 0); position: relative; }
.bc-ring::after { content: attr(data-pct); position: absolute; inset: 5px; border-radius: 50%; background: #2a1f16; display: flex; align-items: center; justify-content: center; }
.bc-need { font-size: 12px; padding: 3px 8px; border-radius: 8px; background: #3a1f1f; border: 1px solid #7a3a3a; }
.bc-need.ok { background: #1f3a24; border-color: #3a7a48; }

/* the event box as a story card */
.ev-scene { position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: 34vh; overflow: hidden; border-radius: 10px; border: 2px solid #6b5230; background: #000; }
.event-art .ev-scene { position: absolute; inset: 0; max-height: none; aspect-ratio: auto; border: 0; border-radius: 0; }
.ev-scene canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; object-fit: cover; }
/* on its side the picture's column is near square: the whole scene shown, not its middle (the speaker stands at an edge) */
@media (orientation: landscape) and (max-height: 560px) { .event-art .ev-scene { background: transparent; } .event-art .ev-scene canvas { object-fit: contain; } }
.ev-seal { display: inline-flex; width: 22px; height: 22px; margin-right: 6px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #e8504a, #8a1c18); color: #ffe9a0; font-size: 12px; align-items: center; justify-content: center; vertical-align: middle; box-shadow: 0 1px 2px #000a; flex: none; }
.event-option.recommended { display: flex; align-items: center; justify-content: center; }
.ev-flourish { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 50% 60%, #ffe08acc, transparent 60%); animation: ev-flourish 900ms ease-out forwards; }
.ev-flourish i { position: absolute; left: 50%; top: 60%; width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: #ffd84a; box-shadow: 0 0 6px #ffd84a; animation: ev-spark 800ms ease-out forwards; }
@keyframes ev-flourish { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
@keyframes ev-spark { from { transform: rotate(var(--a)) translateX(0); opacity: 1; } to { transform: rotate(var(--a)) translateX(110px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ev-flourish, .ev-flourish i { animation-duration: 1ms; } }
.event-chose { animation: ev-chose 500ms ease-out; }
@keyframes ev-chose { from { transform: scale(0.9); opacity: 0; } 60% { transform: scale(1.04); } to { transform: none; opacity: 1; } }

/* the raid recap as a comic strip */
.rs-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0; }
.rs-panel { position: relative; border: 2px solid #1c140c; border-radius: 4px; background: #000; overflow: hidden; aspect-ratio: 16 / 9; }
.rs-panel canvas { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
.rs-cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 6px; font-size: 10px; line-height: 1.25; background: #fff4c8ee; color: #2a1a08; border-top: 2px solid #1c140c; }
.rs-chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.rs-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; min-height: 22px; border-radius: 11px; font-size: 11px; background: #2a1f16; border: 1px solid #4a3722; }
.rs-chip.fell { border-color: #e06060; color: #ff9a9a; } .rs-chip.shone { border-color: #ffd84a; color: #ffd84a; }
.rs-chip canvas { width: 20px; height: 20px; image-rendering: pixelated; }

/* the Chronicle's timeline strip */
.tl { margin-top: 10px; border-top: 1px solid #4a3722; padding-top: 6px; }
.tl-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
.tl-track { position: relative; height: 100px; min-width: 100%; }
.tl-line { position: absolute; left: 0; right: 0; top: 74px; height: 2px; background: #6b5230; }
.tl-tick { position: absolute; top: 70px; width: 1px; height: 10px; background: #6b5230; }
.tl-year { position: absolute; top: 80px; font-size: 10px; opacity: 0.7; transform: translateX(-50%); }
.tl-now { position: absolute; top: 2px; bottom: 2px; width: 2px; background: #ffd84a; box-shadow: 0 0 6px #ffd84a; }
.tl-now::after { content: 'now'; position: absolute; top: -2px; left: 4px; font-size: 9px; color: #ffd84a; }
.tl-ico { position: absolute; width: 28px; height: 28px; min-width: 28px; margin-left: -14px; padding: 0; border-radius: 50%; border: 1px solid #4a3722; background: #2a1f16; font-size: 14px; line-height: 26px; text-align: center; color: inherit; cursor: pointer; }
.tl-ico.on { border-color: #ffd84a; box-shadow: 0 0 6px #ffd84a; }
.tl-read { min-height: 32px; margin-top: 4px; padding: 6px 8px; font-size: 12px; border-radius: 8px; background: #2a1f16; border: 1px solid #4a3722; }
.tl-read b { color: #ffd84a; }
`;

let added = false;
/** Put the cards' styles in this page's head (once). */
export function addCardStyles(): void {
  if (added || typeof document === 'undefined') return;
  added = true;
  const st = document.createElement('style');
  st.dataset.for = 'cards';
  st.textContent = CARDS_CSS;
  document.head.append(st);
}
