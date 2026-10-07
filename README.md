# Chronos Settlement

(Formerly Little Town.)

A pixel-art town that runs itself, like an ant farm. One founder at a campfire grows a town from the Stone Age to
the stars, and you watch, steer and send people out. It is played mainly as a **phone web app** (a PWA, hosted on
GitHub Pages), with a Windows desktop overlay (Electron) besides. TypeScript and PixiJS.

The game as it stands is described here and, in much more detail, in [CLAUDE.md](CLAUDE.md) (the working notes,
feature by feature). [DESIGN.md](DESIGN.md) is the original design document from before the game was built; the
game left it behind in many places. Art and music credits are in [CREDITS.md](CREDITS.md); the choice events are
listed in [EVENTS.md](EVENTS.md); [PLAN.md](PLAN.md) is the plan the townsfolk's economy was built from.

## Running it

```bash
npm install
npm run typecheck      # tsc --noEmit
npm test               # the headless sim tests (node test runner)
npm run web            # the phone version, into out/web (what GitHub Pages serves)
npm run build          # desktop and renderer only, into out/
npm start              # build and launch the Electron overlay
npm run dist           # the Windows installer (needs Windows)
```

To preview the phone version, serve `out/web` with any static server and open it at a phone size (393x852 is what
it's designed for). After the first visit it works offline. To install it on Android, open the hosted address in
Chrome and choose ⋮ → Add to Home screen.

Saves: the phone keeps its town in the browser's storage (keys `littletown.*`); the desktop in
`%APPDATA%\Little Town`. Both catch up on time away: the first half hour away passes as in play, the rest at a
quarter pace, and at most one game day passes however long you're gone. Raiders who arrive while you're away wait
at the gate for you (up to twelve real hours), and one choice event can hold the town for your answer.

## The screen

- **The town** fills the screen: a top-down map of a wide land (192x192 cells) with the town in its vale, named
  regions round it, and the fog of the unknown beyond. Drag to pan, pinch to zoom; tap anything for its card
  (a townsperson, a building, a cell, a raider, a place found on the land, an animal). A **minimap** sits in the
  corner (☰ → Minimap turns it on and off), and the **news bubble** at the right edge counts what's new: red for
  threats and losses, gold for what wants you (a question, a stranger at the gate, a caravan, a quest), blue for
  the rest. Open it to read, and to jump to the thing.
- **The clock bar** shows the day and hour, people, beds and coins, the game speed (1×, 2×, 3×) and the raid or
  battle when one is on.
- **Seven tabs** along the bottom: **Town**, **People**, **Studies**, **Market**, **Trips**, **War** and
  **Chronicle** (the Annals). Each is split into sub-tabs. The peoples' looks rename them (the Lich's Town is the
  Necropolis, the Druids' the Grove, and so on).
- **The ☰ menu:** zoom, Music, Minimap, New town…, Phone alerts… (ntfy: raids, deaths, your hero's big moments,
  delves, war), and the version.
- Big moments take the whole screen: a **choice event** (a picture, the story, two or three answers, and what came
  of it), a **raid battle** on its board, a watched party's **fight** in the old Final Fantasy style, a **mine** being
  dug, an **envoy**, a hero's **evolution** with illuminated cards for the two roads.

## Founding a town

New town (☰, or the game-over card) asks one question a page:

1. **Who founds the town:** one of twelve peoples (see Origins below).
2. **Your founder:** one of that people's three ready-made founders, each with a story, a calling of their own and a
   look; only the name can be changed. Each may bring a companion.
3. **How it begins:** a scenario (Lone Founder, Band of Three, Lost Tribe, Well Supplied).
4. **Where:** one of ten lands: forest, desert, tundra, coast, fenlands, jungle, highlands, ashlands, steppe or
   taiga (the Tide Clan is always on the coast; the Deep Hold always under a mountain).
5. **How dangerous:** Easy, Normal or Hard, and ironman.
6. **How many realms share the world:** 2 to 12. This sets the size of the conquest map and how many rival powers
   there are (five realms is the town and the four powers of old).
7. **Ready to found it**, and the founder's **line**: a new line, or a descendant of a legend (a town you played
   before, kept in the Hall of Legends: an heirloom, coins and renown come down).

## What the town does by itself

The town decides what to study, gather, build, craft and sell (`src/shared/sim/planner.ts`). It lays out roads and
districts, clears land, farms a mix of crops that tire the soil, keeps animals, builds a shop and a tavern and then
four more stores, keeps a ring wall round itself once it's big enough, raises defences and guards, buys and sells
with caravans, trades with the realm's powers, honours its gods, holds funerals, weddings and feasts, and sends out
its own parties. Townsfolk earn coins by their work, buy land, build homes, pay rent and tax, open businesses,
retire from adventuring into a shop, marry, fall out, grow old and die. Every one has a nature, an ambition, a
story, a calling and a road through it, and gear they wear.

Deaths are meant to be common: raids, beasts, disasters, plague, hunger, the sea, old age. The founder's death
passes the town to an heir while a grown-up is left.

## What you do

- **Set the direction** (Town tab): Growth, Defence, Trade or Knowledge; the tax lever; the town's size (5, 10, 20,
  40 or no limit); whether evolutions and stat points are put to you or left to the town; how raids are fought.
- **Answer** the questions: strangers at the gate (take them in or send them on), choice events (about 525, some of
  them fateful), envoys, the dragon's demands, secrets found out, sagas, a party asking to be watched.
- **Trips** (Trips tab): parties form themselves and an adventurer leads them, but you hold a **veto** on any place
  and can post a **bounty** on one; or **raise a party yourself** (pick who goes, persuade or order the unwilling,
  choose careful or bold, the rations, the horses) and answer at the crossroads. Watch any fight on the FF screen.
  Dungeons to delve, lairs to clear, scouting, trade caravans, guild hunts, islands by boat, strongholds to storm,
  the dragon's lair.
- **Raids:** fought on a tactics board by default (a grid cut from the land at the gate, the town's wall along it,
  turns by a clock, height, facing, cover; Auto plays it for you, or turn Auto off and give each townsperson their
  orders), or on the old trail with towers and traps. Rally a defender; cast a held power; read the recap after.
- **The realm** (Trips → Realm): gifts, peace, trade, alliances, marriages, demands, war; war hosts come against
  the town, and the whole town can storm a stronghold.
- **The War** (War tab): see below.

## The Conquest

Win the game by owning the whole world, by conquest or alliance. (The launch to the stars and the Moon Pack's
Great Hunt still win too.)

- **The world** is a map of provinces (six a realm), each a country of one of the ten lands with a settlement
  (hamlet to capital), a fort, what it yields a day to its holder and, often, a landmark (a shrine, a mine, ruins,
  a lair that must be cleared, a crossroads, a harbour). Every realm starts with its capital and one province; the
  rest is free.
- **Troops and squads** (War → Barracks): recruits come each day from the provinces held and train into troops of
  eighteen kinds by age and study (militia to riflemen) and one kind of each people's own; troops are nameless. A
  **squad** is a hero of the town with up to nine troops in formation. The hero carries the squad: their level,
  gear and calling set their own strength, their command makes every troop fight harder, and the strongest lead the
  most. A capped hero in fine gear with three troops beats a green one with nine.
- **Armies** (War → Armies): a general's squad and up to five more, raised at the capital. **Every march is your
  order:** pick an army, tap a province on the map, and it goes the shortest way through free or friendly land,
  taking free provinces as it comes to them. Leave garrisons from the army's train, or a bare province may rise
  against you. Heroes marching are away from the town and come home with the army; the founder may go, at risk.
- **Battles:** an army arriving at a province held against it fights on a 12x8 board, the squads as pieces, the
  defenders behind their fort's walls (siege troops batter them), a beat a side; clashes are resolved at once with
  counters (spears beat horse, horse rides down archers, and so on). Troops die for good and squads rout. A hero
  struck down is wounded, captured or killed (about 60/30/10; the founder far gentler); captives are ransomed or
  freed when their province falls.
- **The rival realms** spread over free land, clear lairs, take your provinces when at war with you and each other's
  when at feud. Capitals fall only to your armies. The game is won when every province is yours, or an ally's or a
  vassal's.

The conquest sits beside everything else: it touches none of the raids, trips and quests.

## Origins

The twelve peoples. Each changes how the whole game plays and looks: who the townsfolk are, what they need, what
they're good and bad at, three powers the town casts by itself, a heritage line of research, a seat that grows
grander each era, its own homes, walls, menu materials and fonts, and troops of its own in the war.

| Origin | Twist | Powers |
|---|---|---|
| **Settlers** | The classic game | None |
| **Lich** | A lich founder and the raised dead: no food, no sleep, slow healing, no children; only the dead live there | Raise Dead, Bone Ward, Drain Life |
| **Druid Grove** | Fields and foraging fast, cleared forest grows back; builds slower; druids take a bear's shape to fight | Call Rain, Entangle, Bloom |
| **Blood Court** | A vampire founder; the town is one castle that grows room by room; blood is a resource (tithes, pens, prisoners bled in the Blood Farm) | Mesmerise, Blood Feast, Night Terror |
| **Moon Pack** | Werewolves; full-moon hunts, rival packs, the Alpha challenged; the Great Hunt wins | Howl, Pack Hunt, Moon Frenzy |
| **Machine Colony** | Machines: no food, sleep or moods; fast research; units are assembled | Assemble, Overclock, Repair Swarm |
| **Deep Hold** | Dwarves under a mountain: halls carved into the rock, veins dug for gold and gems; poor farmers; strangers turned away | Deep Delve, Forge Blessing, Stone Skin |
| **Tide Clan** | Merfolk on a coast half sea: homes in the shallows, swimming, fishing and pearls; raiders from the sea | Tide Call, Whirlpool, Sea Fog |
| **Nomad Caravan** | A tribe that follows the seasons until the Industrial age; twice the travellers, better prices | Trade Road, Swift Riders, Scouting Party |
| **Fae Court** | Strangers pay half again as much and may be charmed into staying; slow crafting | Glamour, Changeling, Faerie Ring |
| **Crucible** | Alchemists: fast research, newcomers gain a strange trait; poor builders | Transmute, Elixir, Volatile Flask |
| **Exiled Order** | Knights: armed from day one, fight hard, take less harm; slow crafting and research | Rally, Shield Wall, Oath of Mending |

The origins you didn't pick are the powers of the realm and the rivals of the conquest: their lords lead raids and
war hosts, cast their own spells, and hold strongholds and provinces of their own.

## The eras

Research is paced for a game of about three months of real time. Each era's capstone building opens the next.

| Era | Capstone | New in this era |
|---|---|---|
| Stone Age | Elder Lodge (needs the Bear Cave totem: send a party, or the Cave Bear comes to you) | Gathering, farming, pens, the first trips, the shop and tavern, beasts and rival tribes |
| Medieval | Town Hall | Iron, bread, horses, caravans, families, boats, siege engines, the Arcane Arts |
| Industrial | Power Station | Coal, steel, glass, factories, muskets, smog, steamships |
| Modern | Mission Control | Oil, concrete, electronics, trucks, turrets, cryo pods, war |
| Space | Launch Site (one ending) | Alloys, circuits, worker bots, shields, clone vats, drones, meteors |

## Code layout

| Path | What's there |
|---|---|
| `src/shared/data/` | Content tables: buildings, items, research, enemies, raids, events, classes, troops, the conquest world, and more |
| `src/shared/sim/` | The deterministic 10 Hz simulation (seeded RNG, commands in, snapshots out); `sim/conquest/` the war |
| `src/renderer/map/` | The top-down town: ground, buildings, people, weather, wildlife, battles |
| `src/renderer/panel/` | The menus (one HTML page in an iframe); `warPanel.ts` the War tab |
| `src/renderer/mobile/` | The phone page: the strip and the menus in two iframes, the event box, the news bubble |
| `src/renderer/fight/`, `tactics/`, `battle/` | The FF fight screen, the tactics board, the trail battle's bars |
| `src/main/` | The Electron desktop app |
| `tools/` | The builds, and the one-off scripts that cut sprites from the asset packs |
| `test/` | Headless tests (`node:test`) |

Sprites come from the asset packs credited in `CREDITS.md`; only the sprites the game uses are in this repo.
