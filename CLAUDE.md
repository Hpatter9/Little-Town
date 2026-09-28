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
  - The bird's-eye interior is the `shop` panel (`src/renderer/panel/shopPanel.ts`), opened by tapping the shop.
  - All the new state fields are optional (no save version bump): old saves load with no coins and no shop.
- **Menus take the whole screen on the phone** (the `menu-open` class in `mobile/index.html`): the town runs
  itself, so there's little to watch while a menu is open. The tabs stay visible (along the bottom upright).
- **Phase 3:** a **Tavern**, built on the same plan.
- **Phase 4:** animal husbandry and more farming.
