## The main menu and save slots

The owner's ask: "a main menu like a typical game ... continue, new game, load game, settings, and credits", then, as
a correction, "the main menu leads into the loading screen". The phone now opens on the menu; picking a town shows the
loading screen (0.153.0, "The loading screen and the game's logo") and then the game. Renderer and save plumbing only:
nothing in `src/shared/sim/` changed.

**The flow.** `mobile/loading.ts` hosts both. It has a `mode`: `menu` (the start) or `loading`. In the menu the logo
sits at the top on its carved wood (sun fixed, every window lit), the player's town at night is painted dimly behind it
once the first snapshot is in (a first run: the founding fire), Duchess is in her corner (always the `chew` gag), the
items are below the logo and the version line is at the foot. The clock stays held (`GameLoop.held`) until the
reveal. Continue (or a Load game card for the town in play) calls `enterLoading()`: the bar, line and tip take the
menu's place and `shownAt` restarts, so a town already warm shows the screen for `MIN_SHOW_MS` and then reveals as
before, with Duchess's "Mehh.". The screen is now kept, hidden, after the reveal (`running` stops the frame loop), and
`LoadingHost.onReveal` callbacks are kept and run at every reveal (they release the clock).
`LoadingHost.showMenu()` brings the menu back. The menu is first, so the page starts light: it is in the loading
bundle (`loading.js`), which already loaded first; the strip and the game load behind it as before.

**New game** hides the screen (`peek(true)`, the 'gone' class) and opens the existing New town panel (`mobile.ts`
`setActions`). Closing the panel unfounded brings the menu back (`applyState`). Founding goes through
`bridge.newGame`, which sets `sessionStorage['littletown.enter']` (`ENTER_KEY`) before `location.reload()`; a page
started with that flag (or `?nomenu`) skips the menu and goes straight to loading. A first run no longer opens the
New town panel on its own while the menu is up (`mobileBridge` `started.fresh && !menuUp()`).

**Settings** opens the ☰ menu's own list over the menu (`body.mm-settings`: `#menu` is centred at z-index 1001, same
`drawMenu`, no second copy of the settings code). With the menu up, the items that open a panel behind the screen
(New town…, Phone alerts…) are left out and a "Back to the main menu" item leads it. The ☰ menu gains "Main menu"
(`bridge.suspend()`: holds the clock, saves, then `showMenu()`).

**Save slots** (`mobile/saveSlots.ts`, pure, takes a `Store`): the town in play is still `littletown.save`. Other towns
wait in `littletown.slot.<n>` (n 1..`MAX_SLOTS` 6); `littletown.slots` is the index `[{n, name, origin, biome, day,
people, savedAt}]` and `littletown.slot.current` says which slot is in play. The slot in play has an index entry but no
slot key (one copy, not two: localStorage is about 5 MB). First run of this build: `readSlots` makes the old save slot
1, in play, nothing copied. `mobileBridge` refreshes the entry from the snapshot on each save (`noteCurrent`).
`switchTo(n)` parks the town in play in its slot, moves the chosen one into `littletown.save` and the page reloads (with
the enter flag); if the browser has no room it puts everything back and says so. `deleteSlot(n)` (the play slot too:
its text goes, and `window.__noSave` stops the page saving it back) asks first on the card. `beginTown` (on a new town)
parks the old one in its slot and gives the new town a free one; with all six full, or a town only just begun, the new
town takes the slot in play and the old one is the one `littletown.backup`, as before. The menu says "Slots full: it
takes the town in play" under New game then, and "Full" on the Load page. `test/saveSlots.test.ts` covers migration,
parking, switching (and a switch that doesn't fit), the cap and delete.

**Continue** shows the town's name, people and season/day (the snapshot once it is in, the slot index before) and is
greyed, not hidden, with no save; on a first run New game glows (`.bright`) and the menu says "Your story begins
here: found a town." **Credits** (`mobile/credits.ts`: pack, author, licence line, curated from CREDITS.md) in a
scrolling card.

**Look.** Items are the frame set's carved wood (`loading/wood.png` as a `border-image`, 9 px cut), Alegreya SC in the
UI gold, Duchess and the night as before, cards in the ☰ menu's dark wood. They are `div role=button`, not `<button>`,
because the page's theme dresses every `<button>` with `!important` (they came out stone-blue for the knights).
`prefers-reduced-motion` stills the menu's entrance and glow. Landscape puts the logo left and the items right.
Tap targets are at least 44 px.

Files: `src/renderer/mobile/{loading,mainMenu,credits,saveSlots,mobile,mobileBridge,index.html}`,
`src/shared/ipc.ts` (`Bridge.suspend?`), `tools/build-web.mjs` (the version defines for `loading.js`; the service
worker caches by walking `out/web`, so `loading.js` needed nothing), `test/saveSlots.test.ts`. HISTORY.md sections this
touches: "The loading screen and the game's logo" (the screen now follows the menu and is kept after the reveal),
"The first hour" (a first run waits for New game), "Offline pacing" (the clock is held at the menu too).

Checked at 393x852 and 852x393 in headless Chromium (screenshots in the session scratchpad, `shots/`): the menu as the
first thing seen (about 0.35 s in: logo, buttons and Duchess already up), first run (Continue and Load greyed, New game
glowing, founding fire behind), with a save (Continue "Pine Keep · 37 people · Winter, day 34", the late-town fixture
dimly behind), Load game with two slots (In play marked, Delete on each), Credits, Settings over the menu, the New town
panel from New game. Flows run in the browser: Continue to the loading screen to the game with the tick moving; ☰ Main
menu back with the tick held; picking another slot reloads straight to loading.
