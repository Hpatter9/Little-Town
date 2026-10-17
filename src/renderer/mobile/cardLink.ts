// Open a thing's card (panel/infoCard.ts) in the menus from the phone page: the news, a reveal card, a haul. The menus
// are a frame of their own, so this goes through the window function the menus put up (`__openCard`, panel.ts), which
// opens the menu asked for and lays the card over it. Kept free of the menus' modules: only the card's address goes over.

import type { PanelId } from '../../shared/ipc';
import type { CardRef } from '../panel/infoCard';

type MenuWin = Window & { __openCard?: (ref: CardRef, menu?: PanelId) => void };
let frame: HTMLIFrameElement | null = null;

/** The menus' frame (mobile.ts). */
export function setMenuFrame(f: HTMLIFrameElement): void {
  frame = f;
}

/** Open a card over a menu (`menu`, else the one open; the Chronicle when none is). */
export function openCardInMenu(ref: CardRef, menu: PanelId = 'journal'): void {
  const win = frame?.contentWindow as MenuWin | null;
  win?.__openCard?.(ref, menu);
}
