## A new town that stood still (the tutorial's veil)

The owner's report: "The town isn't doing anything and it doesn't seem like time is passing. I just started a new one."
Changes "Pop-ups hold the town" (`popupHold.ts`) and "The first-town tutorial" (docs/notes/first-town-tutorial.md).

**The cause.** The first-town tutorial registers its veil (`.tut-veil`) with `holdWhileUp`, so the town is held while a
step is read. The veil sits inside the tutorial's root, which starts `hidden`; but the veil itself did not, and
`popupHold.ts` judged a card up from the element alone (`hidden` and its own computed `display`, blind to its parents).
So from the moment the page loaded the veil counted as a card up: the page told the game `cards on`, and the clock stood
at tick 0 (until the hold's ten-minute limit, `MOST_MS`). Every page load was held: the main menu, a new town, a loaded
one; whether the tutorial was pending, done or skipped.

**The fix.**
- `mobile/popupHold.ts`: `shown(el, displayOf)` (pure, with `ShownNode`) walks the card and everything it sits in; a card
  is up only if none is `hidden` or `display: none`. A card in a hidden box can't hold the town again.
- `mobile/tutorial.ts`: the veil starts hidden, and only shows while a step is being read (as `draw` already set it).

The tutorial still holds the town while its card is read, "Show me" lets it run, and Skip ends it (checked in a phone
preview from the main menu: New game → Accept ×6 → found).

Tests: `test/newTownRuns.test.ts`: a new town of each origin, autopilot on, nothing holding it at the start, runs three
game hours (a player answering each card as it comes, the founding story an hour in among them) with its clock moving and
its people set to work; and `shown` (a card inside a hidden or `display: none` box is not up).

## The ⛏ and path buttons lit while on

The owner's ask: "Make it look like the road or clear boxes are selected when in use." The `#clear-land.on` and
`#draw-path.on` styles in the strip (`index.html`) were never seen: the shared look (`ui/uiCss.ts`, `html.ui-look`) paints
every button with its slab border-image and a clear fill, `!important`. Now `uiCss.ts` has a rule for the two modes on: the
chosen slab (`--ui-btn-on`) over a gold fill, a gold outline and glow, pressed in a pixel (and `index.html`'s own `.on`
got the same outline and glow for pages without the look).

The banner that names the mode: clearing's had only Cancel, though its marks are kept as each drag ends; it now has Done
alone (`Banner.show(…, done, only)` in `overlayUi.ts`). The path's keeps Done and Cancel. Sideways the phone's title bar
lay over the banner and hid its words: `mobile.ts` `layout` hands the strip `--top-over` (how far the title bar reaches
over it, in the page's px, sideways only) and the embedded `#banner` hangs below it.

Screenshots (393x852 and 852x393, off, clearing, drawing): `docs/notes/new-town-stuck/buttons-*.png`; a new town running
and the tutorial's first card: `new-town-running.png`, `new-town-tutorial.png`.
