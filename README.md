# Chronos Settlement

(Formerly Little Town.)

A pixel-art idle town builder that lives in a thin strip above the Windows taskbar. You start with one
founder at a campfire and grow a town from the Neolithic to the Space age, where the town builds a ship
and leaves for the stars. The full design is in [DESIGN.md](DESIGN.md); art and music credits are in
[CREDITS.md](CREDITS.md).

## Running it

```bash
npm install
npm start
```

`npm start` builds into `out/` and launches the Electron overlay. Other scripts:

| Script | What it does |
|---|---|
| `npm run build` | Build only (`node build.mjs`) |
| `npm run typecheck` | TypeScript check |
| `npm test` | The headless sim tests |
| `npm run check` | Typecheck, build and test |
| `npm run dist` | Build the Windows installer: `dist/Chronos Settlement Setup <version>.exe` |

The installer is per-user, so it doesn't need admin rights. It adds Start menu and desktop shortcuts, and it can
be removed from Windows' Apps list. Saves and settings live in `%APPDATA%\Little Town` (the old name, kept so existing towns carry on) and survive an
uninstall or reinstall. The installer isn't code-signed, so the first run shows a SmartScreen warning.
Choose "More info" and then "Run anyway".

Command-line flags: `--seed=<text>` starts a new town on that seed (the old save becomes a backup), and
`--biome=forest|desert|tundra|coast` picks its biome.

The renderer also runs in a plain browser for previewing: serve `out/renderer` and open `index.html`.
It runs its own copy of the sim, and takes `?seed=`, `?biome=` and `?speed=` in the URL.

### The phone (web) version

`npm run web` builds a version for phones into `out/web/`, a folder to put on any static https host. It's the
same strip and panels in one page (`src/renderer/mobile/`):
- The town runs along the bottom, scaled up for fingers.
- Tab buttons above the town open the menus, which fill the space above it.
- The ☰ menu has New town, Music and Town size.
- A tap selects, a drag scrolls, and a long press cancels. Placing a building takes two taps: one to see where it
  goes, a second to build it.
- Whatever you tap shows in a card at the top of the screen, with its buttons:
  - **Land:** what's left there. A tap only selects it; gathering starts when you press **Gather here** on the
    card.
  - **Buildings:** the same options as the desktop's bar over a building.
  - **People and visitors:** health, needs and best skills. You can let a visitor in or turn them away from
    the card.
  - The trade caravan, the expedition and raiders show there too.
- The Research and Expeditions buttons fill up as research and a trip go along, as on the desktop.
- The Expedition Board opens on a world map (`assets/World map.jpg`):
  - Home and every destination you can reach are marked, placed in `src/shared/data/worldMap.ts`.
  - Tap a place on the map, or a destination's card, to plant a flag on it with the route from home. Tapping
    the map also jumps to that destination's card.
  - Parties that are out move along their routes, and turn red while fighting.
- On its side, the phone drops the title bar:
  - The tabs (and the ☰) run across the top.
  - The town fills the rest of the screen.
  - Menus and the selection card open over the right half of the town, so the left half stays in view.
- The phone keeps its own town in the browser's storage and catches up on time away, as the desktop does.
- The strip draws a whole sky, since it isn't see-through to a desktop:
  - The sky's colour follows the day, warm at dawn and dusk, and greyer under cloud.
  - Clouds drift on the wind.
  - Birds cross by day and bats flit at dusk.
  - A rainbow appears after rain.
  - Weather comes in spells of a few hours and follows the season: rain, summer storms with lightning, fog,
    and winter snow. It's only for looks.
  - Autumn leaves blow past, and fireflies come out on summer nights.
  - The page above the strip takes the same sky colour.
- After the first visit it works offline.

To install it on Android, open the hosted address in Chrome and choose ⋮ → Add to Home screen.

## Playing

- **The town runs itself, like an ant farm** (`src/shared/sim/planner.ts`). Four times a game hour it takes
  stock and decides:
  - **research:** what it needs most (beds, food, storage, the next era), tilted by its direction;
  - **gathering:** it marks trees, rocks and marsh for what it's short of, and to clear room to build;
  - **building:** homes a bed ahead of its people (as fast as it can feed them), a field per two people, more
    storage as it fills, one of every workshop it learns, a better research station, era capstones, and
    towers and walls once raiders come;
  - **crafting:** the lumber, bricks and other materials its builds need, a tool for each worker, weapons and
    armour after raids, and medicine;
  - **newcomers:** it lets them in when a bed is free.

  Your part is the town's **direction** (Growth, Defence, Trade or Knowledge, under Plan) and sending
  **expeditions** (the next era needs the Bear Cave's totem). The Plan tab shows what it's building, what it
  decided last and why, and what it's gathering for.
- **The strip:** scroll with the mouse wheel or drag, and click buildings and people for their details. The
  tabs on the right open the panels: Plan, Research, Expeditions, Townsfolk, Crafting, Trade and the Journal.
- **The tray icon:**
  - **New game…:** choose a biome, difficulty and ironman.
  - **Slim ticker:** shrink the strip to a slim line.
  - **Hide strip.**
  - **Music.**
  - **Phone alerts…:** off unless you enter your own ntfy topic.
  - **Open saves folder.**
- **Time away:** the town keeps going while the game is closed or the PC sleeps. When you come back the
  missed time is simulated (the clock bar says "Catching up…"), and a "while you were away" report goes
  into the Journal.
- **Losing:** if the founder dies, or the whole town gives up in despair, the game is over. The Occult
  branch and later medicine offer ways back from death.
- **Death is common:** anyone knocked down in town bleeds out in about 2 game hours unless someone saves
  them. The clock bar names whoever is bleeding, and a blood drop floats over them.
  - Raiders out to kill finish off the fallen they find at their feet.
  - Once the raiders are gone (or running off empty-handed), free townsfolk tend the wounded where they lie.
    Medicine skill decides whether it works; a failed try opens the wound further.
  - A bandage or poultice in storage always works.
  - A Healer's Hut (Neolithic) slows the bleeding. An Infirmary slows it more (a Hospital or Trauma Center
    more still) and takes in everyone downed once a raid ends.
  - The founder is always carried to safety in town.
  - Hunger kills too: someone starving loses health instead of healing. With nothing in storage, the hungry
    pick wild berries off the trees nearby, which keeps an untended town alive for a while, not forever.
  - A Graveyard lays the dead to rest: mourning weighs less and grief passes sooner. A Necromancer can call
    them back up to defend the town.
- **Special classes are rare callings.** A town can have only one of each at a time. Each needs its research
  (deep in the Occult, or Beast Lore), a master of its skill, and a deed done first:

  | Class | Research | Skill | Deed |
  |---|---|---|---|
  | **Necromancer** | Necromancy (Medieval, after Resurrection Rites) | Research 7 | The town has buried three of its own |
  | **Summoner** | Summoning (after the Blood Rite) | Research 6 | A Spirit Totem is given up |
  | **Blood Knight** | The Blood Oath (after the Blood Rite) | Melee 7 | The candidate has been cut down and lived |
  | **Beast Tamer** | Beast Lore | Animal Handling 6 | None beyond the skill |

  Each also costs a large offering of materials. A rare wanderer may arrive already trained, but never in a
  class the town already has.
- **The sky and the seasons:**
  - The sun and moon cross the sky in arcs. The moon changes phase each night; its full moon is the
    werewolves' full moon. Stars twinkle at night, with the odd shooting star.
  - The land changes with the season: fresh green and blossom in spring, deep green in summer, gold grass
    and red and orange trees in autumn, and snow in winter. The desert gets a pale, dry winter. The tundra
    thaws to moss in spring and summer.
- **Disasters** come every week or so, with a day of signs first:
  - **Any era:** drought, plague, a zombie outbreak (waves of the dead; the fallen rise) and the Deep
    Freeze. In the freeze, ice mages bring winter: nothing grows outdoors, the town must burn wood or coal to
    keep warm, and slaying their Frost Archmage breaks it.
  - **From the Medieval era:** ash winter.
  - **From the Industrial era:** smog, and the Rat Plague (swarms that eat the stores and spread sickness,
    until their Rat King is killed).
  - **Modern:** war, and a meltdown for a town with a power station (the reactor burns, fallout sickens
    everyone and stops the fields; a hospital helps).
  - **Space:** meteors and a machine uprising.

## The eras

Each era's capstone building opens the next. Time stretches as the eras go on: research, building and
travel take longer. Food doesn't stretch, because people eat on the same clock in every era.

| Era | Capstone | New in this era |
|---|---|---|
| Neolithic | Elder Lodge (needs the Bear Cave totem) | Gathering, tents, farming, first expeditions, wolves and rival tribes |
| Medieval | Town Hall | Iron, bread, horses, trade caravans, families, bandits, fire |
| Industrial | Power Station | Coal, steel, glass, factories, muskets, gangs, rival armies, smog |
| Modern | Mission Control | Oil, concrete, plastics, electronics, trucks, turrets, cryo pods, war |
| Robotic & Space | Launch Site (the ending) | Alloys, circuits, worker bots, shields, clone vats, drones, meteors |

## New-game options

The New town panel opens on a first run, from the tray's New game… and from the game-over card.

- **Scenario**
  - **Lone Founder:** the classic start.
  - **Band of Three:** with a gatherer and a hunter.
  - **Lost Tribe:** six people, including an elder and a child, and little food.
  - **Well Supplied:** alone, with a stockpile, and shelter-making already known.
- **Your founder**
  - A name (rolled if left blank) and looks, with a live preview.
  - A background (Forager, Hunter, Farmer, Builder, Scholar or Healer), which sets the starting skills and passions.
  - Up to two traits.
- **Biome**
  - **Forest:** the classic start.
  - **Desert:** rocky, dry and short of wood.
  - **Tundra:** cold, with poor crops and hungry wolves.
  - **Coast:** marshy, with rich foraging and busy trade.
- **Difficulty (Easy / Normal / Hard):** sets how big raids are, and how often raids and disasters come.
- **Ironman:** one save, no backups and no cheats.

## Code layout

| Path | What's there |
|---|---|
| `src/shared/data/` | Content tables: buildings, items, research, enemies, raids, eras, biomes, and more |
| `src/shared/sim/` | The deterministic 10 Hz simulation (seeded RNG, commands in, snapshots out) |
| `src/main/` | Electron main process: the game loop, saves, tray, phone alerts |
| `src/renderer/` | The PixiJS strip and the HTML panels |
| `test/` | Headless tests (`node:test`) |
