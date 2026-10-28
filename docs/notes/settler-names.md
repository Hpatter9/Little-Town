## Settler buildings named for what they are

The owner's ask: "Rename buildings for what they are", across the settlers' buildings. Every building a settler town
can build was checked three ways: its name, what it does in the sim (what it makes, stores or houses, who works it),
and the piece it is drawn with on the isometric map (`iso/isoKits.ts` `roleOf`/`pieceFor`, the settlers' kit in
`art/iso/kits/settlers/`). Only display names changed (with the purpose lines, research `unlocks` lines and hints that
named them): **no building id changed**, so saves and tests are untouched. Files: `data/buildings.ts`,
`data/stores.ts`, `data/workshops.ts`, `data/research.ts`, `data/sagas3.ts`, `maps/rooms.ldtk` (regenerated into
`data/interiorRooms.ts` by `node tools/ldtk-maps.mjs`), `panel/tradePanel.ts`, `panel/shopPanel.ts`,
`panel/empirePanel.ts`, `panel/marketsPanel.ts`, and comments in `sim/shop.ts`, `sim/trade.ts`, `sim/planner.ts`,
`data/crops.ts`. Screenshots of the build menu at 393x852 and 852x393: `docs/notes/settler-names/`.

### Renamed

| id | old name | new name | why |
|---|---|---|---|
| `garden_plot` | Garden Plot | Grain Plot | It grows wild grain; "garden" read as vegetables, which the Vegetable Patch grows. |
| `fireside_inn` | Fireside Inn | Alehouse | One bare room with a bar, and it grows into the Tavern; an inn (rooms to let) is the bigger house, not the smaller. |
| `apothecary` | Apothecary | Stillroom | The workshop where the apothecary (the job keeps that name) steeps tinctures; the shop is the Apothecary. |
| `apothecary_shop` | Apothecary Shop | Apothecary | The shop that sells medicine. |
| `furniture_store` | Furniture Maker | Furniture Shop | It sells furniture (made at the workbench and the cooperage); it makes none. |
| `weapon_store` | Weapons Store | Weapon Shop | British "shop", like the other shops. |
| `armour_store` | Armour Store | Armour Shop | As above. |
| `market` | Market Stall | Marketplace | Where trade caravans stop and the trade house keeps its yard, not one stall (purpose line now says so). |
| `rowhouse` | Row Houses | Terraced Houses | The British name. |
| `apartments` | Apartment Block | Block of Flats | The British name. |
| `trauma_center` | Trauma Center | Trauma Centre | British spelling (also the Trauma Surgery `unlocks` line). |
| `chip_fab` | Chip Fab | Microchip Works | "Fab" is jargon. |

Purpose lines made truer, names kept: `workbench` "Crafts tools, weapons and plain furniture." (it makes tables, beds,
shelves and barrels too); `kiln` "Fires pottery and bricks."

### Kept (the name already says what it is)

Campfire, Stockpile, Lean-to, Hide Tent, Longhouse, Cottage, Workbench, Drying Rack, Tanning Rack, Kiln, Hunter's
Lodge, Storyteller's Circle, Herb Garden, Flax Field, Chicken Coop, Goat Pen, Pig Sty, Sheep Fold, Cattle Pasture,
Vegetable Patch, Orchard, Open Field, Estate Farm, Healer's Hut, Infirmary, Hospital, Graveyard, Well, Granary, the
Palisade/Stone/Brick/Concrete/Force walls, gates and grates, Lookout Platform, Watchtower, Archer Tower, Militia Post,
Spike Pit, Pit Trap, Caltrops, Boiling Oil, Ballista, Catapult, Cannon, Gun Nest, Barracks, Stockade, Gaol, Prison,
Trading Post, General Store, Emporium, Tavern, Elder Lodge, Town Hall, Trophy Hall, Scriptorium, Library, School,
University, Mine, Bloomery, Smithy, Sawmill, Tannery, Loom, Windmill, Bakery, Smokehouse, Bone Carver's Hut, Basket
Weaver's, Brewery, Tailor's, Jeweller's, Cooperage, Chandlery, Dyeworks, Printing Press, Clockmaker's, Stable,
Wayside Shrine, Temple, Cathedral, Resurrection Shrine, Village Green, Quoits Pitch, Sparring Yard, Fishing Jetty,
Pleasure Garden, Bandstand, Theatre, Bathhouse, Bell Tower, Quarry, Boatyard, Harbour, Drill Yard, Archery Range,
Kennels, Siege Workshop, Monster Hunters' Guild, Beast Ranch, Arena, Statue, Ward Stone, Victory Monument, Shaft to
the Deep, Portal Arch, Mage Tower, Arcane Library, Arcane Academy, Creature Pen; the seat (Meeting Stone, Moot Hall,
Guildhall, Civic Hall, Council Spire); and the later ages' buildings (Coal Mine, Steelworks, Glassworks, Factory,
Gunsmith, Power Station, Oil Derrick, Refinery, Cement Works, Electronics Plant, Garage, Radio Tower, Cinema, the
turrets, Cryo Pod, Mission Control, Deep Mine, Alloy Foundry, Battery Plant, Robot Workshop, Drone Hub, Habitat Dome,
Hydroponics Bay, Fusion Reactor, Shield Generator, Clone Vat, AI Core, Launch Site, Cannery, Textile Mill, Appliance
Plant, Pharmacy, Biofabrication Lab, Nanoforge, Airship Mast).

### Art that shows something else (for new pictures; names not bent to it)

The settlers' kit has few pieces, so `roleOf` draws many buildings with a stand-in:
- **Every workshop** (sawmill, loom, tannery, kiln, bakery, windmill, mine, bloomery, workbench, racks, the craft
  shops...) is the kit's `workshop` piece: a smithy with an anvil and forge. Wanted first: a **windmill**, a **mine**
  head, a **sawmill**, a **kiln**, a **loom/weaver's** house, a **bakery**.
- **Campfire** is drawn as the `stockpile` shed, though the kit has its own `campfire` piece (a one-line fix in
  `ROLES`, left for the owner's call).
- **Graveyard** is drawn as the `chapel`: no graves.
- **Trading Post, General Store, Emporium and the four shops** are drawn as the open `market_stall`: they want a
  shopfront building. The Marketplace's stall fits.
- **Healer's Hut, Elder Lodge** and other halls fall back to the plain `cottage` or `longhouse`.
