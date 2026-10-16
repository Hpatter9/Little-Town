// The New Town tiles' and description sheet's styles (newTownTiles.ts), kept out of the shared style blocks in panel.html so
// they can be restyled on their own. Added to the page once, the first time a grid is made.

export const NEW_TOWN_CSS = `
/* the New Town tiles and description sheet (newTownTiles.ts): a symbol over a name; a tap opens the sheet */
.nt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.nt-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px 8px;
  min-height: 44px;
  background: #2a1f16;
  border: 1px solid #4a3722;
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.nt-tile.on {
  border-color: #ffd84a;
  background: #3b2b1e;
  box-shadow: inset 0 0 0 1px #ffd84a, 0 0 8px rgba(255, 216, 74, 0.35);
}
.nt-name {
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
}
.nt-sym {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: radial-gradient(#4a3722, #1b130d 75%);
  border: 1px solid rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
.nt-sym.land .nt-scene {
  flex: none;
  width: 114px;
}
.nt-sym.figure .nt-doll {
  width: 64px;
  height: 64px;
  background: none;
  border: none;
}
.nt-glyph {
  display: block;
  flex: none;
  image-rendering: pixelated;
}
.nt-chosen {
  margin: 0 0 8px;
  color: #ffd84a;
  font-size: 12px;
}
.nt-scene {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #14100c;
}
.nt-anim {
  display: block;
  image-rendering: pixelated;
}
.nt-layer {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}
.nt-figures {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 4%;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 6px;
}
.nt-figure {
  width: 30%;
  max-width: 140px;
  height: auto;
  aspect-ratio: 1;
  image-rendering: pixelated;
  background: none;
  border: none;
  filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.45));
}
.nt-back {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
}
.nt-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 560px;
  max-height: 88%;
  background: #211812;
  border: 1px solid #7a5a33;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  overflow: hidden;
}
.nt-sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 8px;
}
.nt-sheet-name {
  margin: 10px 12px 4px;
  color: #e8c88a;
  font-size: 17px;
}
.nt-sheet-text {
  margin: 4px 12px;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-line;
}
.nt-sheet-nav {
  display: flex;
  gap: 10px;
  padding: 8px 12px 12px;
  background: #211812;
  border-top: 1px solid #4a3722;
}
.nt-sheet-nav button {
  flex: 1;
  min-height: 44px;
}
.nt-sheet-nav .next {
  background: #6b4b25;
  border-color: #c79a55;
}
@media (min-aspect-ratio: 3/2) {
  /* held sideways the sheet is a panel down the right-hand side */
  .nt-back {
    align-items: stretch;
    justify-content: flex-end;
  }
  .nt-sheet {
    width: 52%;
    max-width: none;
    max-height: none;
    border: none;
    border-left: 1px solid #7a5a33;
    border-radius: 0;
  }
  .nt-grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }
  .nt-sheet .nt-scene {
    width: 62%;
    margin: 0 auto;
  }
}
`;

let added = false;
export function addNewTownStyles(): void {
  if (added) return;
  added = true;
  const st = document.createElement('style');
  st.dataset.for = 'new-town';
  st.textContent = NEW_TOWN_CSS;
  document.head.append(st);
}
