// Pop-up panel window. One window serves every tab; the main process shows it and tells it which tab is open.

import { PANELS, type Bridge, type PanelId, type StripState } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { buildKey, renderBuild } from './buildPanel';
import { craftingKey, renderCrafting } from './craftingPanel';
import { hostBridge, localBridge } from '../localBridge';
import { el } from './dom';
import { expeditionsKey, renderExpeditions } from './expeditionsPanel';
import { renderJournal } from './journalPanel';
import { renderResearch, researchKey } from './researchPanel';
import { renderTownsfolk, townsfolkKey } from './townsfolkPanel';
import { renderTrade, tradeKey } from './tradePanel';
import { renderAlerts } from './alertsPanel';
import { renderNewGame } from './newGamePanel';

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
      ? 'b' + buildKey(snap)
      : shown === 'research'
        ? 'r' + researchKey(snap)
        : shown === 'townsfolk'
          ? 't' + townsfolkKey(snap)
          : shown === 'expeditions'
            ? 'e' + expeditionsKey(snap)
            : shown === 'journal'
              ? 'j' + snap.journalHead
              : shown === 'crafting'
                ? 'c' + craftingKey(snap)
                : shown === 'trade'
                  ? 't2' + tradeKey(snap)
                  : shown === 'newgame'
                    ? 'n' + !!snap.gameOver
                    : shown;
  if (key === renderedKey) return;
  renderedKey = key;
  title.textContent = PANELS.find((p) => p.id === shown)?.label ?? (shown === 'alerts' ? 'Phone alerts' : shown === 'newgame' ? 'New town' : '');
  const scroll = body.scrollTop;
  if (snap && shown === 'journal') {
    // fetched separately: the whole journal is too big to send with every snapshot
    void bridge.getJournal().then((entries) => {
      if (renderedKey !== key) return; // moved on meanwhile
      const top = body.scrollTop;
      body.replaceChildren(...renderJournal(entries));
      body.scrollTop = top;
    });
    return;
  }
  if (snap && shown === 'build') body.replaceChildren(...renderBuild(snap, bridge));
  else if (snap && shown === 'research') body.replaceChildren(...renderResearch(snap, bridge));
  else if (snap && shown === 'townsfolk') body.replaceChildren(...renderTownsfolk(snap, bridge));
  else if (snap && shown === 'expeditions') body.replaceChildren(...renderExpeditions(snap, bridge, render));
  else if (snap && shown === 'crafting') body.replaceChildren(...renderCrafting(snap, bridge));
  else if (snap && shown === 'trade') body.replaceChildren(...renderTrade(snap, bridge));
  else if (shown === 'alerts') body.replaceChildren(...renderAlerts(bridge));
  else if (snap && shown === 'newgame') body.replaceChildren(...renderNewGame(snap, bridge));
  else body.replaceChildren(el('p', 'empty', 'Loading…'));
  body.scrollTop = scroll;
}

function onState(s: StripState): void {
  if (s.panel !== shown) {
    shown = s.panel;
    renderedKey = '';
    body.scrollTop = 0;
  }
  render();
}

if (bridge) {
  bridge.onState(onState);
  bridge.onSnapshot((next) => {
    snap = next;
    render();
  });
  Promise.all([bridge.getState(), bridge.getSnapshot()]).then(([st, sn]) => {
    snap = sn;
    onState(st);
  });
}
