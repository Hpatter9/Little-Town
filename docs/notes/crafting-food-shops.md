## Food parts, and rare inputs on sale

Changes "Crafting chains" (0.187.0): food was left out of the chains, and the rare inputs came only with caravans.

**Food gets parts.** Five new parts in `PARTS` (`data/chains.ts`), made from raw food at the kitchen stations the town
already has: `pastry` (bakery, flour 2 + milk 1, x2), `cheese_wheel` (campfire, milk 4, x2), `broth` (campfire, meat 1 +
herbs 1, x2), `sausage` (smokehouse, meat 2 + herbs 1, x2), `preserves` (kiln, fruit 3, x2). The better dishes in
`data/items.ts` take them through `items`, as gear takes its parts: Fruit Tart (pastry, preserves), Meat Pie (pastry,
broth), and four new dishes, Cheese Pie, Sausage Roll, Jam Tart and Ploughman's Plate. The plain fare (roast, porridge,
berry bowl, eggs, tea, soups, stew, goat cheese, ale, wine, cider) is unchanged and made from raw food, so the tavern
always has a hearty meal, a sweet and a drink. The planner needed no change: `makeFirst` tries the dearest dish first
and, when its parts can't be made from spare stock, falls through to the plain fare; fare is still made only from spare
food once the town is `settled`. `deepen` still skips `fare`; the food chains are written out by hand. The "first age
stays simple" test in `test/chains.test.ts` now leaves fare out (the owner's exception).

**Rare inputs on sale.** `sim/rareStall.ts`: a town with a market stall (or a shop) has traders who keep silver,
heartwood, thick pelts, gems and pearls for sale. Stock per season (`stallCap`) depends on the age (gems from the
Industrial age) and the trade links (`tradeLinks`: powers on a trade, alliance or vassal stance, and the trade house's
tier, half a unit each), with pearls and gems only by trade; a side stream (`rarestall:<season>:<material>`) jitters it by
one. Price is the market price (`priceOf`) times `RARE_MARKUP` (3). The `buyRare` command (`commands.ts`, `sim.ts`) takes
`material`, `count` (up to `RARE_MOST`) and `who`: `'town'` pays from the treasury, `'founder'` from the founder's purse;
the goods go into the stores. What's been bought this season is kept in the optional `GameState.rareSold` (no save
bump). `snapshot.rareStall` feeds a "Rare goods" section at the top of the Market menu's Trade tab
(`panel/marketsPanel.ts`, heading added to `GROUPS`).

Tests: `test/foodChains.test.ts`.
