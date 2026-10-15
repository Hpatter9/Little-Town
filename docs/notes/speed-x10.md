## Game speed ×5 and ×10

The clock bar's speed button (`hud.ts`) now cycles 1× → 2× → 3× → 5× → 10× → 1× (phone and desktop share it).
`GAME_SPEEDS` in `sim/battle.ts` lists the town's speeds (`BATTLE_SPEEDS` stays 1-3); `setGameSpeed` and the
`gameSpeed` command check (`commands.ts`) accept only those, so an old or odd saved `gameSpeed` falls back to 1×.
A raid's battle still runs at its own `battleSpeed` (`battleSpeedNow`), so a fight drops the pace from ×10 to the
battle speed and goes back after; the raid-skip run is unchanged. Nothing in the sim step changed.

`Sim.advance(ms, maxTicks, budgetMs)` takes a wall-clock budget; `GameLoop.pump` gives it `FRAME_BUDGET_MS` (40 ms).
Ticks that don't fit stay owed (capped at `maxTicks` worth) and are run on the next pumps, so input and drawing stay
responsive. The speed button is 34px wide (`index.html`) so "10×" fits.
