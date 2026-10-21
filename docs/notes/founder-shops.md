## The founder's shops

Step 3 of playing the founder. The founder can own several town shops, taverns and stalls and run each (`sim/founderShops.ts`, data in `data/founderShops.ts`). It changes nothing about how buildings are ordered or placed.

**Buying** (`founderBuyShop`): the card's "Buy a shop" lists `buyableShops` (done venues with a `floor`, no owner, not a ring/room). The price is `businessPrice` (plot, makings and `BUSINESS_DAYS` of takings, `sim/ambition.ts`). The founder's purse pays it to the treasury and becomes `Building.owner`; the town's keeper goes and `Building.shop.run` (`{ stock, price, till, season?, last? }`, optional) marks a run shop (`isFounderShop`). One caveat: customers still come to one standing venue of each kind or line (`standing` in `sim/shop.ts`), so a second shop of the same kind is owned but gets no custom.

**Running it**: `founderShopStock` picks a stock line (`STOCK_LINES`: 2-3 a venue or specialty line; each has a `sales` multiplier and a `cost` share of takings for restocking) and `founderShopPrice` a level (`PRICE_LEVELS`: Low `sales` 0.85, draws customers (+4 `attractiveness`) and lifts every grown-up's morale 1 a day; Fair; High `sales` 1.25, −4 attractiveness, morale −1 a day).

**Managing it** (`founderShopManager`): the manager is the building's `operator`. A hired grown-up (`managerCandidates`: not a child, not already holding a job) is paid `managerWage` a day (`MANAGER_WAGE` × `PURSE_SCALE` × Social level); their Social skill scales sales (`managerSales`, 0.8 to 1.2). The founder's own id works the counter themselves for `SELF_SALES` 1.25, the best takings. `null` shuts it. `assignOperators` skips a founder's run shop, so with no manager nobody opens it. The autopilot never hires.

**Takings**: `takeSale` (`sim/ambition.ts`) hands a founder's run shop's sale to `founderSale`, which adds it to `run.till` (and `bookTakings`). At dawn `settleShops` (called from `founderTick`) pays the stock cost, the manager's wage (a manager who can't be paid even from the purse leaves), and gives the rest to the founder with `giveCoins`, so the usual tax at dawn (`collectTax`) takes its share. A loss is `shopLoss` (the till drops); a fire takes the shop's takings with it (`sim/fire.ts`). `run.season` keeps the season's takings and profit (`DAYS_PER_SEASON`).

**The card**: "Your shops" and "Buy a shop" in `panel/founderPanel.ts`; the snapshot's `FounderView` has `shops`, `buyable` and `hires`. Commands: `founderBuyShop`, `founderShopStock`, `founderShopPrice`, `founderShopManager` (`sim/commands.ts`, applied in `sim/sim.ts`). Not gated by the autopilot (they are the player's orders).

**Tests**: `test/founderShops.test.ts`.
