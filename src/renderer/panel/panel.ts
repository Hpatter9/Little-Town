// Pop-up panel window. One window serves every tab; the main process shows it and tells it which tab is open.

import { PANELS, type Bridge, type PanelId, type StripState } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { buildKey, renderBuild } from './buildPanel';
import { craftingKey, renderStores, renderWorkshops } from './craftingPanel';
import { hostBridge, localBridge } from '../localBridge';
import { el } from './dom';
import { inTabs, selectTab, tabKey } from './subtabs';
import { expeditionsKey, renderExpeditions } from './expeditionsPanel';
import { renderJournal } from './journalPanel';
import { renderResearch, researchKey } from './researchPanel';
import { patchTownsfolk, renderTownsfolk, townsfolkKey } from './townsfolkPanel';
import { renderTrade, tradeKey } from './tradePanel';
import { renderWar, warKey } from './warPanel';
import { renderAlerts } from './alertsPanel';
import { renderNewGame, restartNewGame } from './newGamePanel';
import { isVenuePanel, renderShop, shopKey, venueView } from './shopPanel';
import { hkKnow } from '../art/hkFolk';
import { applyTheme, currentTheme, panelLabel } from '../theme';
import { detailsKey, setDetailsRedraw } from './details';

declare global {
  interface Window {
    bridge?: Bridge;
  }
}


// In a plain browser (previewing), run a local stand-in; open a tab with window.bridge.togglePanel('research').
const bridge = window.bridge ?? (window.bridge = hostBridge() ?? localBridge());
const title = document.getElementById('title')!;
const body = document.getElementById('body')!;
document.getElementById('close')!.addEventListener('click', () => bridge?.closePanel());

let shown: PanelId | null = null;
let snap: Snapshot | null = null;
let renderedKey = '';

function render(): void {
  if (!shown) return;
  // Only rebuild the DOM when something visible changed (snapshots arrive ten times a second).
  const key = !snap
    ? shown
    : shown === 'build'
      ? 'b' + buildKey(snap) + craftingKey(snap)
      : shown === 'research'
        ? 'r' + researchKey(snap)
        : shown === 'townsfolk'
          ? 't' + townsfolkKey(snap)
          : shown === 'expeditions'
            ? 'e' + expeditionsKey(snap)
            : shown === 'journal'
              ? 'j' + snap.journalHead + '|' + snap.met.length + '|' + snap.scenesSeen.length + '|' + snap.annals.fallen.length + '|' + snap.annals.chronicles.length + '|' + snap.annals.famous.map((f) => `${f.id}:${f.felled}:${f.level}:${f.titles.length}`).join(',')
              : shown === 'crafting'
                ? 'c' + craftingKey(snap)
                : shown === 'trade'
                  ? 't2' + tradeKey(snap) + craftingKey(snap)
                  : shown === 'war'
                    ? 'w' + warKey(snap)
                  : isVenuePanel(shown)
                    ? shown + shopKey(snap, shown)
                  : shown === 'newgame'
                    ? 'n' + !!snap.gameOver
                    : shown;
  const keyed = `${key}|${tabKey(shown ?? '')}|${detailsKey()}`;
  if (keyed === renderedKey) {
    // (the Townsfolk list's live details change ten times a second: patched into the rows as they stand)
    if (snap && shown === 'townsfolk') patchTownsfolk(snap, body);
    return;
  }
  renderedKey = keyed;
  const tab = PANELS.find((p) => p.id === shown);
  title.textContent = tab ? panelLabel(tab.id, tab.label, currentTheme()) : (shown === 'alerts' ? 'Phone alerts' : shown === 'newgame' ? 'New town' : isVenuePanel(shown) ? (venueView(snap, shown)?.name ?? (shown === 'shop' ? 'Shop' : shown === 'tavern' ? 'Tavern' : 'Shop')) : '');
  const scroll = body.scrollTop;
  if (snap && shown === 'journal') {
    // fetched separately: the whole journal is too big to send with every snapshot
    void bridge.getJournal().then((entries) => {
      if (renderedKey !== keyed) return; // moved on meanwhile
      const top = body.scrollTop;
      body.replaceChildren(...renderJournal(entries, snap?.met ?? [], snap?.annals, snap?.scenesSeen ?? [], (key) => (bridge.command({ type: 'scene', op: 'watch', key }), bridge.closePanel?.())));
      body.scrollTop = top;
    });
    return;
  }
  // (each menu's sections in sub-tabs: subtabs.ts)
  const tabbed = (els: HTMLElement[]) => inTabs(shown!, els, render);
  // (the Town: its overview, buildings and treasury, and the stores; the Market: its shops, caravan and animals, and the
  // workshops: the menus' redo)
  if (snap && shown === 'build') body.replaceChildren(...tabbed([...renderBuild(snap, bridge, render), ...renderStores(snap, render)]));
  else if (snap && shown === 'research') body.replaceChildren(...tabbed(renderResearch(snap, bridge, render)));
  else if (snap && shown === 'townsfolk') body.replaceChildren(...tabbed(renderTownsfolk(snap, bridge, render)));
  else if (snap && shown === 'expeditions') body.replaceChildren(...tabbed(renderExpeditions(snap, bridge, render)));
  else if (snap && shown === 'trade') body.replaceChildren(...tabbed([...renderTrade(snap, bridge), ...renderWorkshops(snap, render)]));
  else if (snap && shown === 'war') body.replaceChildren(...tabbed(renderWar(snap, bridge, render)));
  else if (shown === 'alerts') body.replaceChildren(...renderAlerts(bridge));
  else if (snap && isVenuePanel(shown)) {
    hkKnow(snap.people); // (who's who, so the keeper is dressed as the map dresses them: art/hkFolk.ts)
    body.replaceChildren(...renderShop(snap, shown, render));
  }
  else if (snap && shown === 'newgame') body.replaceChildren(...renderNewGame(snap, bridge));
  else body.replaceChildren(el('p', 'empty', 'Loading…'));
  body.scrollTop = scroll;
}

// (a card opened or closed: details.ts)
setDetailsRedraw(() => render());

function onState(s: StripState): void {
  // (the old Crafting menu is the Market's Workshops now)
  if (s.panel === 'crafting') {
    selectTab('trade', 'Workshops');
    bridge?.openPanel('trade');
    return;
  }
  if (s.panel !== shown) {
    shown = s.panel;
    // (New Town opened afresh starts at its first question; its redraws while open keep the step)
    if (shown === 'newgame') restartNewGame();
    renderedKey = '';
    body.scrollTop = 0;
  }
  render();
}

if (bridge) {
  bridge.onState(onState);
  bridge.onSnapshot((next) => {
    snap = next;
    if (applyTheme(next.theme, 'panel')) renderedKey = ''; // (the look changed: redraw, with the new names)
    render();
  });
  Promise.all([bridge.getState(), bridge.getSnapshot()]).then(([st, sn]) => {
    snap = sn;
    onState(st);
  });
}
