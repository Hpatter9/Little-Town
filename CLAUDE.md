# Chronos Settlement (formerly Little Town)

A pixel-art town that runs itself, like an ant farm. It's played mainly as a phone web app (a PWA on the
owner's Android, hosted on GitHub Pages). There's also a Windows desktop overlay (Electron): a strip above the
taskbar. TypeScript + PixiJS. `DESIGN.md` is the original design, and `README.md` covers how to play and build.

## Priorities (from the owner)

- **Phone first.** Design every change for the phone version. Before calling anything done, check it at phone
  sizes both upright (393x852) and sideways (852x393) in a browser preview.
- **Hands-off.** The town decides for itself what to research, gather, build and craft
  (`src/shared/sim/planner.ts`). The player only sets the town's **direction** (Growth, Defence, Trade or
  Knowledge, in the Plan tab) and sends **expeditions**. Don't add chores or manual controls.
- **Deaths should be common.** Raids, disasters and hunger are meant to bite.
- **Assets.** The project is free and private, so any sprite from the asset packs may be used. Credit the source
  in `CREDITS.md`. (The packs themselves aren't in the repo; sprites the game uses are already in `src`.)

## Commands

```bash
npm install
npm run typecheck      # tsc --noEmit
npm test               # headless sim tests (node test runner)
npm run web            # build the phone version into out/web (what GitHub Pages serves)
npm run build          # build only (desktop + renderer) into out/
npm run dist           # Windows installer (needs Windows; not for the cloud)
```

To preview the phone version, serve `out/web` with any static server and open it at a phone size.
`window.__game` is the game loop (`__game.sim.step()` fast-forwards), and `window.bridge.openPanel('build')`
opens a menu. Never launch Electron; the owner runs the desktop app themselves.

## Layout

- `src/shared/sim/`: the deterministic simulation. It runs at 10 ticks a second, with 600 ticks per game hour
  and 3-day seasons.
  - `sim.ts`: the step order.
  - `planner.ts`: the self-running town. It can be turned off with `state.autopilot = false`; the tests' `plainGame`
    helper does this.
  - `people.ts`: jobs and tasks.
  - `snapshot.ts`: what the renderers see.
  - `save.ts`: save versions and migrations.
- `src/shared/data/`: buildings, research, items, the world map spots, founding (backgrounds and scenarios), and
  so on.
- `src/renderer/`: the town strip.
  - `main.ts`: input, the phone's tap card and pinch.
  - `town/`: the views: sky, weather, seasons (via `art/palette.ts`).
  - `panel/`: the menus.
  - `mobile/`: the phone page. It holds the strip and the menus in two iframes that share one bridge;
    `mobileBridge.ts` runs the game in the page and saves to `localStorage`.
- `src/main/`: the Electron desktop app.
- `tools/build-web.mjs`: the phone build (manifest, offline service worker, icons).

## Conventions

- Run `npm run typecheck` and `npm test` after changes, and add tests for new rules in `test/`.
- After CSS changes, check the braces balance and that each `@media` block holds only what it should. A broken
  `@media` block once wrecked the phone layout.
- Saves on the phone use the keys `littletown.*`, and the desktop uses `%APPDATA%\Little Town`. Keep both, or
  existing towns are lost.

## Current work: the ant-farm redesign

- **Phase 1 is done:** the self-running town, direction, and a zoomed-out phone view with pinch-to-zoom.
- **Phase 2 is done:** coins and a shop (`src/shared/sim/shop.ts`, data in `src/shared/data/shop.ts`).
  - The planner researches Barter and builds a Trading Post, which grows by upgrade (General Store, then Emporium).
    Straight away if the land can't give what it needs (`unsourced`).
  - It crafts furnishings (items with `furnish` in `data/items.ts`), and the shopkeeper (an operator role) sets them
    out on the shop's floor grid (`shopLayout`). Appeal: more travellers, bigger purses.
  - Travellers (`s.travellers`) walk in, trade at the shop, and walk out. The planner decides what's for sale
    (`forSale`) and what to buy (`shoppingList`). Materials travellers sell count as sourceable once there's a
    shop, which is how desert towns get fiber.
  - Attractiveness (`attractiveness()`: appeal plus `s.renown`) sets the customer tiers that come (`CUSTOMER_TIERS` in
    `data/shop.ts`: travellers, merchants, nobles, magnates). Higher tiers want wares (items with `ware` in
    `data/items.ts`, unlocked by research). Served, renown rises; disappointed, it falls.
  - The planner makes wares from spare materials only, spends coins on the shop (`planShop`: extensions when crowded,
    else piece levels), and weights research toward wares for tiers it draws but can't serve (`wareGaps`).
  - Venues are general (`floor.venue` in `data/buildings.ts`: `shop` or `tavern`; the tavern chain is Fireside Inn →
    Tavern). They start bare; furnishings are commissioned (`CraftOrder.for`) only when the town can pay, and crafters
    are paid (`payCrafter` in `crafting.ts`). Renown, the log and unmet wants (`asked`) live on each venue's `b.shop`.
  - Strangers (`Traveller`) have a name, temper and `want`; keepers upsell on Social (`talkChance`). Tavern guests need
    comfort (`req`).
  - Quality (`data/quality.ts`, 8 grades) is rolled from Crafting skill; inventory qualities live in `s.itemQ`
    (kept in step by `qualitiesOf`), worn ones in `p.gearQ`.
  - Wages and gear buying: `sim/wages.ts`. With a shop, `equipAll`/`pickTool` stop handing gear out. The daily ledger
    is `s.ledger` (`earn` in `state.ts`); per-person activity is `p.recent` (`remember`).
  - Research: one person per station (`researchStations`, `freeStation`, `topicFor` in `research.ts`); the research
    task carries its station and topic.
  - The lich path: `offerLichRite`/`chooseLich`/`watchLich` in `occult.ts`, `s.lichChosen` then `s.lich` (permanent).
    `snapshot.theme` is `'lich'` once it's set; `src/renderer/theme.ts` holds the look (one stylesheet scoped to
    `html.theme-lich`) and the menus' new names, applied by the phone page, the panels and the strip's HUD.
  - The bird's-eye interior is the `shop` and `tavern` panels (`src/renderer/panel/shopPanel.ts`), opened by tapping the shop.
  - All the new state fields are optional (no save version bump): old saves load with no coins and no shop.
- **Menus take the whole screen on the phone** (the `menu-open` class in `mobile/index.html`): the town runs
  itself, so there's little to watch while a menu is open. The tabs stay visible (along the bottom upright).
- **Phase 3 is done** (the Tavern: see above).
- **Origins are done:** `src/shared/data/origins.ts` (defs: start, rules, powers), applied at founding in
  `newGame`; the rule multipliers are in `src/shared/sim/origin.ts` (asked for by people, farming, raids, crafting, the
  shop, townsfolk); powers in `src/shared/sim/powers.ts` (`castPowers`, cast by the town itself; buffs in `s.buffs`);
  looks in `src/renderer/theme.ts` (one palette per origin, CSS generated and scoped to `html.theme-<id>`, menu names,
  building tint). Undead and machines are both `tireless` (state.ts).
- **Rival origins are done:** `src/shared/data/rivals.ts` (each origin's lord, army and hostile spells), raid kinds
  `rival_*` in `data/raids.ts` (with `origin` and `leader`; never picked for the town's own origin), enemies and
  relics in `data/enemies.ts` and `data/items.ts`. `src/shared/sim/rivals.ts` casts the lords' spells
  (`rivalsInRaid`) and holds the hexes on `Raid.hex` that raids.ts and powers.ts read (`heldBack`, `fogAim`,
  `wardOf`, `frenzyOf`, `turretsDown`).
- **Origin buildings:** `src/renderer/art/originStyles.ts`: each origin's own homes, walls and gates; every other
  building gets its materials swapped (`reclad`) and dressing on top. `buildingArt` takes the style (the theme id).
- **Phase 4:** animal husbandry and more farming.
