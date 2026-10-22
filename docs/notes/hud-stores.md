## Stores readout and the home button moved

The phone page's top right now shows a small readout of the town's coins and main materials, and the "back to the town"
button moved to the bottom left so it no longer sits where the fading notices appear (they stay at the bottom right).

- `renderer/mobile/storesReadout.ts` (`startStoresReadout`) builds the `#stores-readout` button from the snapshot's
  `stock` and `coins`; it redraws only when a figure changes. A tap sets `littletown.subtab.build` to `Stores` and opens
  the Town menu. It hides while a menu, a battle, a scene or an event card is open. CSS is in `mobile/index.html`.
- `renderer/mobile/storesPick.ts` (`readoutItems`, `short`) is the pure part: coins (once above 0), wood, stone, food
  (the edible materials summed), then up to two of the stage's materials the town holds (`STAGE`: iron, lumber, cloth,
  bricks, leather...), most plentiful first; five at most. Icons come from `art/materialIcons.ts` (`stockIcon`); coins are a
  CSS gold disc and food borrows the berries' icon. Test: `test/storesReadout.test.ts`.
- `#centre-town` (`renderer/main.ts`, CSS in `renderer/index.html`) is at `left: 8px` rather than right.
- No pickaxe button exists on this branch of main (the land-clearing and Surface/Underground controls are not in the
  phone page's code), so there was nothing to move; the underground "into the Underdark" action is a tap card.
- (At the merge) the land-clearing ⛏ button (`#clear-land`, `renderer/index.html`) moved to the left too, above the home
  button, so the notices at the bottom right are clear.
