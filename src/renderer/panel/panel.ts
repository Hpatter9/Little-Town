// Pop-up panel window. One window serves every tab; the main process shows it and tells it which tab is open.

import { withDeltas } from '../deltaBridge';
import { PANELS, type Bridge, type PanelId, type StripState } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { buildKey, renderBuild, townStockKey } from './buildPanel';
import { craftingKey, renderStores, renderWorkshops } from './craftingPanel';
import { hostBridge, localBridge } from '../localBridge';
import { el } from './dom';
import { inTabs, selectTab, shownTab, tabKey } from './subtabs';
import { expeditionsKey, renderExpeditions } from './expeditionsPanel';
import { renderJournal } from './journalPanel';
import { guildMark, guildsOf } from '../art/guildMarks';
import { festivalsKey } from './festivalsPanel';
import { cultureKey } from './culturePanel';
import { renderResearch, researchKey } from './researchPanel';
import { patchTownsfolk, renderTownsfolk, townsfolkKey } from './townsfolkPanel';
import { arenaKey } from './arenaPanel';
import { renderTrade, tradeKey } from './tradePanel';
import { renderWar, warKey } from './warPanel';
import { renderAlerts } from './alertsPanel';
import { renderNewGame, restartNewGame } from './newGamePanel';
import { isVenuePanel, renderShop, shopKey, venueView } from './shopPanel';
import { hkKnow } from '../art/hkFolk';
import { applyTheme, currentTheme, panelLabel } from '../theme';
import { detailsKey, setDetailsRedraw } from './details';
import { legendsVersion, primeLegends } from '../legends';
import { applyUiLook } from '../ui/frame';
import { dressStats, wireTips } from '../ui/tips';
import { tickNumbers } from '../ui/motion';

declare global {
  interface Window {
    bridge?: Bridge;
  }
}


// In a plain browser (previewing), run a local stand-in; open a tab with window.bridge.togglePanel('research').
// (the desktop's snapshots come as what changed, put back together here: renderer/deltaBridge.ts)
const bridge = withDeltas(window.bridge) ?? (window.bridge = hostBridge() ?? localBridge());
const title = document.getElementById('title')!;
const body = document.getElementById('body')!;
document.getElementById('close')!.addEventListener('click', () => bridge?.closePanel());
// (the desktop app keeps the legends itself: ask for them, and draw again once they're in)
primeLegends(bridge, () => {
  renderedKey = '';
  render();
});

// (the shared look's held tips: ui/tips.ts)
wireTips();

let shown: PanelId | null = null;
/** The menu and sub-tab last drawn: a change cross-fades the new one in (ui/motion.ts). */
let shownTabKey = '';
let snap: Snapshot | null = null;
let renderedKey = '';
/** A finger (or the mouse) is down on the menu: a rebuild now would pull the button from under it and the tap would
 *  be lost (the owner: the Townsfolk page's buttons didn't work well), so redraws wait for it to lift. */
let pressing = false;
let pressTimer: number | null = null;
body.addEventListener('pointerdown', () => {
  pressing = true;
  if (pressTimer !== null) clearTimeout(pressTimer);
  // (never held for long: a press that never lifts, a scroll that ate the pointerup)
  pressTimer = window.setTimeout(release, 1500);
}, { capture: true, passive: true });
const release = () => {
  if (!pressing) return;
  pressing = false;
  if (pressTimer !== null) clearTimeout(pressTimer);
  pressTimer = null;
  // (after the click has gone through)
  window.setTimeout(render, 0);
};
for (const ev of ['pointerup', 'pointercancel'] as const) window.addEventListener(ev, () => window.setTimeout(release, 60), { capture: true, passive: true });

/** The redraw key: changes only when something the open menu shows changes (snapshots arrive ten times a second). */
function keyOf(): string {
  if (!shown) return '';
  const key = !snap
    ? shown
    : shown === 'build'
      ? 'b' + buildKey(snap, shownTab('build')) + townStockKey(snap, shownTab('build') ?? tabKey('build'))
      : shown === 'research'
        ? 'r' + researchKey(snap)
        : shown === 'townsfolk'
          ? 't' + townsfolkKey(snap) + arenaKey(snap)
          : shown === 'expeditions'
            ? 'e' + expeditionsKey(snap)
            : shown === 'journal'
              ? 'j' + festivalsKey(snap.festivals) + '|' + cultureKey(snap.culture) + '|' + snap.journalHead + '|' + legendsVersion() + '|' + JSON.stringify(snap.ancestry ? [snap.ancestry.visits, snap.ancestry.log.length, snap.ancestry.place, snap.ancestry.heirloom] : null) + '|' + snap.met.length + '|' + snap.scenesSeen.length + '|' + snap.annals.fallen.length + '|' + snap.annals.chronicles.length + '|' + snap.annals.famous.map((f) => `${f.id}:${f.felled}:${f.level}:${f.titles.length}:${guildsOf({ guilds: snap?.guilds ?? [] }, f.id)[0]?.role ?? ''}`).join(',')
              : shown === 'crafting'
                ? 'c' + craftingKey(snap)
                : shown === 'trade'
                  ? 't2' + tradeKey(snap) + craftingKey(snap)
                  : shown === 'war'
                    ? 'w' + warKey(snap)
                  : isVenuePanel(shown)
                    ? shown + shopKey(snap, shown)
                  : shown === 'newgame'
                    ? 'n' + !!snap.gameOver + legendsVersion()
                    : shown;
  return `${key}|${tabKey(shown ?? '')}|${detailsKey()}`;
}

function render(): void {
  if (!shown) return;
  const keyed = keyOf();
  if (keyed === renderedKey) {
    // (the Townsfolk list's live details change ten times a second: patched into the rows as they stand)
    if (snap && shown === 'townsfolk') patchTownsfolk(snap, body);
    return;
  }
  // (a tap under way: the redraw waits for it, unless the page itself asked for it in the tap)
  if (pressing) return;
  renderedKey = keyed;
  const tab = PANELS.find((p) => p.id === shown);
  title.textContent = tab ? panelLabel(tab.id, tab.label, currentTheme()) : (shown === 'alerts' ? 'Phone alerts' : shown === 'newgame' ? 'New town' : isVenuePanel(shown) ? (venueView(snap, shown)?.name ?? (shown === 'shop' ? 'Shop' : shown === 'tavern' ? 'Tavern' : 'Shop')) : '');
  const scroll = body.scrollTop;
  if (snap && shown === 'journal') {
    // fetched separately: the whole journal is too big to send with every snapshot
    void bridge.getJournal().then((entries) => {
      if (renderedKey !== keyed) return; // moved on meanwhile
      const top = body.scrollTop;
      body.replaceChildren(...renderJournal(entries, snap?.met ?? [], snap?.annals, snap?.scenesSeen ?? [], (key) => (bridge.command({ type: 'scene', op: 'watch', key }), bridge.closePanel?.()), snap?.ancestry, snap?.festivals, snap?.culture, (id) => guildMark({ guilds: snap?.guilds ?? [] }, id)));
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
  // (drawing may have settled which sub-tab is open: the key as it is now, so the next snapshot doesn't redraw for nothing)
  renderedKey = keyOf();
  body.scrollTop = scroll;
  // (the shared look: the stats' icons and tips, numbers that changed ticked over, and a new tab faded in)
  dressStats(body);
  tickNumbers(body);
  const tabNow = `${shown}|${tabKey(shown ?? '')}`;
  if (tabNow !== shownTabKey) {
    shownTabKey = tabNow;
    body.classList.remove('ui-xfade');
    void body.offsetWidth;
    body.classList.add('ui-xfade');
    // (only the change fades in: the redraws after it, ten a second at most, come in as they are)
    window.setTimeout(() => body.classList.remove('ui-xfade'), 260);
  }
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
    applyUiLook('panel', next.theme, next.align?.cast ?? 0, next.calendar.daylight);
    render();
  });
  Promise.all([bridge.getState(), bridge.getSnapshot()]).then(([st, sn]) => {
    snap = sn;
    onState(st);
  });
}
