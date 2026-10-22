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
