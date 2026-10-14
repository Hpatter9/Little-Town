## Legends across towns (the owner's ask), and the desktop app brought up to the phone

### Legends across towns
Built on "Dynasties and legacy" (sim/legacy.ts, renderer/legends.ts, panel/legendsPanel.ts).

- **The legend carries more** (`Legend` in sim/legacy.ts, all optional, so older legends read as before):
  - `parent` (the legend this town's founder came of) and `forebears` (the line's founders before it, oldest first);
  - the town's name (`town`);
  - each hero's `cause` of death (from `s.fallen`);
  - the heirloom's `heirloomCarried` (generations), `heirloomGrade` and `cursed`.
  - The line's own heirloom is chosen first while the town still has it.
- **The Hall of Legends** (the Chronicle's Legends tab) is laid out in three parts:
  - **Our line**: this town's forebears, spirits, heirloom and old town (`snapshot.ancestry`, `ancestryView`).
  - **Lines of descent**: `linesOf` threads the legends by `parent` into chains of founders. A town whose parent is no
    longer kept still names its founders. The chain is drawn as `.legend-chain`.
  - **Every town**: newest first. The device now remembers 120 towns (`LEGENDS_MOST`; it was 40).
- **A descendant's town** carries its forebears as data from the founding: `foundAncestry` in sim/ancestors.ts, called
  by `inherit`, sets `s.ancestry` (`Ancestry`). Nothing reads the device's legends again, so the sim stays
  deterministic. Rolls come from the legend's id and the seed, or the side stream `${seed}:ancestors:${tick}`.
  Everything runs only with the autopilot on (`ancestorsHourly`, from sim.ts).
- **Spirits:** of a night (`VISIT_HOUR` 22, from day `VISIT_FROM_DAY`, `VISIT_GAP_DAYS` apart, `VISIT_CHANCE`) one of
  the old founder, its heroes or the line's older founders may come to the fire.
  - The first visit asks how the town honours them. It is a `ways` prompt, system `legacy`, answered by
    `answerLegacy` through heritage.ts:
    - a feast: food, a morale mark, and greater blessings after;
    - counsel: the current topic advanced;
    - rest: they come half as often.
  - The first visit also shows the way to the old place.
  - Later visits bless: the hurt mended (`BLESS_MEND`), a skill taught, or a morale mark.
  - In a raid not begun inside, a spirit may stand with the town (`ancestorAllies` from raids.ts: `ancestor_shade`
    allies; `ALLY_CHANCE`, more once the old place is laid to rest).
- **The heirloom** comes down at +1 for each generation that has carried it (`setHeirloomQ`; `MAX_PLUS` caps it).
  - A fresh heirloom is cursed on `CURSE_CHANCE`, by the legend's id, so it is the same every time. One carried before
    keeps its curse.
  - At `CURSE_HOUR` the curse may bite its bearer (`heirloomBearer`): a wound, or a sore mood.
- **The old town comes back:**
  - **A town that fell** lies in ruins on the new land. **One that stood** has its founder's barrow there.
    - Either way it is a `MapPlace` of kind `ruin` with `old: true`, laid by `layOldPlace`, `OLD_PLACE_NEAR`..`FAR`
      cells out on dry ground.
    - Its foes are restless shades (more for a town that lost many), or barrow guards, led by `old_champion` (the
      shade of its greatest).
    - It is found as the known land reaches it, or by the first spirit's visit (`oldPlaceFound`). Its destination is
      named and described by `oldPlaceDestination`.
    - Cleared by a party (`oldPlaceCleared`), its dead are laid to rest: coins to the treasury, the curse lifted, the
      heirloom +1, a morale mark, and the spirits closer.
  - **A town that stood** is also **the Old House**, a power of the realm (`old_house` in `FACTION_DEFS`, `kin: true`).
    - It is never drawn as a rival (`pickRivals`), and is added by `addOldHouse` only where `s.ancestry.oldTown` is
      `'power'`.
    - It is known from the founding, starting at `HOUSE_START`. Its goodwill rests `HOUSE_WARMTH` warmer, and the
      Realm card says why.
    - Its armies are of its people (`oldHouseRaid`).
    - At noon (`HOUSE_HOUR`, `HOUSE_GAP_DAYS` apart) it sends a gift, or one of the old town's living heroes rides over
      to teach.
    - In treaty or warm, its riders come to raids (`house_rider`, `HOUSE_ALLY_CHANCE`).
  - The ordinary diplomacy (envoys, treaties, war) applies to it as to any power.
- **Foes and friends:** `LEGEND_ENEMIES` in data/legends.ts, merged into `ENEMIES`. They are the Himeko ghost tinted,
  the skeleton warrior, and the Craftpix knight.
- **New Town:** the founder's line hint says what a descendant brings.
- Tests: `test/ancestors.test.ts`.

### The desktop app brought up to the phone
- **Legends:** kept in `<userData>/legends.json`, which is `%APPDATA%\Little Town\legends.json`, beside the saves
  (main/legends.ts: `readLegendsFile`, `keepLegendFile`, `legendById`).
  - A new town makes the old one a legend and inherits from the chosen heir, as on the phone.
  - The panels ask for them over the bridge (`Bridge.getLegends`, `IPC.getLegends`; `primeLegends` in
    renderer/legends.ts, redrawn when they arrive; `legendsVersion` is in the journal's and New Town's keys).
- **The sim off the main process:** main/simThread.ts runs the phone's host (shared/simHost.ts) in a Node
  `worker_threads` thread. It handles the game loop, the catch-up, the autosave's text, the alerts' look ahead, and
  new towns with legends.
  - main/simClient.ts (`SimClient`, no Electron) talks to it: commands, `saveText`, `journal`, `newTown`, `hide`
    (save and book the alerts before quitting), `restart` on a new town, and `whole()` for `getSnapshot`.
  - The host takes `seed`/`biome` at init (`--seed=`, `--biome=`), `hidden` with `book: false` (a fullscreen app
    hiding the strip saves without booking alerts), and `speed` (the tray's debug speed). It now always answers a
    booking (`booked` with none).
  - Should the thread fail before its first word, the game runs in the main process instead (`spawnSim`).
  - `out/simThread.js` is unpacked from the archive (`asarUnpack`).
- **Snapshots as what changed:** main keeps the whole snapshot (`SnapAssembler`) and sends each window the delta
  (`IPC.snapDelta`).
  - A window that has just opened, was hidden or reloaded gets the whole one first (`synced`, `SnapAssembler.seed`).
  - The page puts them back together (renderer/deltaBridge.ts `withDeltas`, used by the strip and the panels). A delta
    with nothing to build on asks for the whole one again (`IPC.snapResync`).
  - The preload's own `onSnapshot` does the same in its world, as a fallback.
  - The snapshot used to be copied to each window whole, ten times a second.
- **Cheap fixes:** the tray has Music volume and Sound effects volume (0 to 100%) and Show minimap. A minimap hidden
  with its × could never come back on the desktop.
- **Still phone-only** (left as they are):
  - tips (mobile/tips.ts);
  - the news bubble and its read marks (mobile/notices.ts);
  - the full-screen event box (eventSheet.ts; the desktop uses the strip's question card);
  - pinch zoom and the zoom slider (the desktop draws at 1, wheel only);
  - vibration;
  - the inspect card (the desktop has tooltips and the action bar);
  - the screen wake lock;
  - the debug `__raid`/`__saga` hooks (they're host messages; the tray doesn't offer them).
- Tests: `test/desktop.test.ts`.
