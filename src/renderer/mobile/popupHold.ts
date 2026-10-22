// The pop-ups only the page knows of (a reveal card, the event box with what came of an answer, a raid's recap) hold the
// town while they are up, and let it go when they are not. Each registers its element once; whether it is up is read
// from the element itself (in the page and not `hidden`), so closing, hiding or removing it releases the hold with no
// call to remember, and a card that is gone can't leave the town held. The sim's own questions need none of this:
// sim/popups.ts reads them from the state.

import type { Bridge } from '../../shared/ipc';

/** One unbroken hold lasts at most this long (real ms): a card left up on a page nobody is at lets the town go on. */
const MOST_MS = 10 * 60_000;
const CHECK_MS = 250;

const cards = new Set<HTMLElement>();
let timer = 0;
let bridge: Pick<Bridge, 'holdCards'> | null = null;
let on = false;
let since = 0;

const up = (el: HTMLElement) => el.isConnected && !el.hidden && getComputedStyle(el).display !== 'none';

/** Whether any registered card is up now (and not past its limit). */
export function cardUp(now = performance.now()): boolean {
  let any = false;
  for (const el of cards) {
    if (!el.isConnected) cards.delete(el); // (taken out of the page: forgotten)
    else if (up(el)) any = true;
  }
  if (!any) since = 0;
  else if (!since) since = now;
  return any && now - since < MOST_MS;
}

/** Cards in other documents of the page (the strip's recap): read through their own `__cardUp`. */
let others: (() => boolean)[] = [];
if (typeof window !== 'undefined') (window as unknown as { __cardUp?: () => boolean }).__cardUp = () => cardUp();

function check(): void {
  const now = cardUp() || others.some((f) => f());
  if (now === on) return;
  on = now;
  bridge?.holdCards?.(now);
}

/** Start watching the registered cards, telling `b` when the first goes up and the last comes down. */
export function startPopupHold(b: Pick<Bridge, 'holdCards'>, also: (() => boolean)[] = []): void {
  bridge = b;
  others = also;
  timer ||= window.setInterval(check, CHECK_MS);
}

/** A card that holds the town while it is shown. Call once, with the element that stays in the page. */
export function holdWhileUp(el: HTMLElement): void {
  cards.add(el);
  if (bridge) check();
}
