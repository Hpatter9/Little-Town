## The build menu: tap Build, the town places it

Changes "The menus redone" / pins (HISTORY.md "pins"). The Town menu's Buildings tab is rebuilt for the phone.

- **Tap Build** on a card sends the existing `pinBuilding` command (`sim/pins.ts`): the planner's `planPins` runs straight
  after the seat, ahead of the town's own plans, finds the spot with `findSpot` and its builders put it up. No new command.
- **Being built** (`ordersBlock` in `panel/buildPanel.ts`) lists the player's orders (waiting, or going up, with progress)
  then the town's own sites, each with **Cancel** (unpins, and `demolish`es the blueprint).
- **Cards are grouped by kind** (`panel/buildKinds.ts`: `BUILD_KINDS`, `kindOf`): Homes, Food and farms, Workshops, Stores and
  trade, Defence, Faith and rest, Other. Headings are `Build: <kind>`; `GROUPS` in `panel/subtabs.ts` matches `Build: `.
- Each card: name, cost chips (short ones marked), one-line purpose, whether the stores hold it now, a full-width Build
  button (`.build-btn`, 44px high; cards are one column at 560px and under). Ring-wall pieces and seats are not listed.
- Removed: `LAYER_NAMES` ("Foreground (walkway)" and the like), the placement tips, the "Your wishes" block, and the
  "town decides for itself" wording. Test: `test/buildMenu.test.ts`.
