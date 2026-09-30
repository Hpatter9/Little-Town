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
- **The shop and coins.** Once the town learns Barter it builds a **Trading Post**, and later rebuilds it
  bigger (a General Store with Carpentry, an Emporium with Glassblowing).
  - **Travellers** pass through every few hours. Each stops at the shop, buys what the town has spare (never
    food it needs, the totem, or anything a build is waiting on) for **coins**, browses a while, and walks on.
  - **The town buys from them** what it's short of. Anything it can't gather, grow or make (a desert's fiber,
    once the land is cleared of it) it buys at any price. Anything else it buys only for a building it's
    waiting on, keeping some coins back, or toward its usual stock once it's rich.
  - **Furnishings:** the town makes shelves, tables, stands, rugs and decorations for it, and the shopkeeper
    (the best Social person free) sets them out. A better-furnished shop (higher **appeal**) draws travellers
    more often, and they spend more. Each copy of a piece counts half as much as the one before, so the town goes
    for variety, and on a full floor better pieces replace the poorest.
  - **Attractiveness** is the shop's appeal plus its **renown**, and it decides who comes. Ordinary travellers come
    to any shop. From 18, **Merchants** come too; from 45, **Nobles**; from 90, **Magnates**. The grander they are,
    the bigger their purses.
  - **Wares** are fine goods the town crafts only to sell, each tier's unlocked by research: bone trinkets, baskets,
    figurines and salves for travellers; painted urns, sweet loaves, leather satchels and dyed cloth for merchants;
    iron brooches, glassware and steel cutlery for nobles; toys, radios and holo charms for magnates. The town makes
    them from what it has spare (never from what it can only buy), for the grandest customers it draws first.
  - **Renown** rises when a merchant, noble or magnate finds a ware of their standing, and falls when they leave
    disappointed. It fades a little each day. A town drawing customers it can't serve studies what makes their
    wares (Iron Working for nobles' brooches, say).
  - **Coins go back into the shop**, from what's left after a reserve: an **extension** when the floor is crowded
    (up to three, each two cells wider and one deeper), otherwise a **level** on the cheapest piece to improve
    (★ a second tier, ★★ polished and trimmed in brass; each adds half the piece's appeal again).
  - **Everything starts bare.** A new shop or tavern is one small room with a counter (or a bar). Every shelf, table,
    stand, hearth and rug is commissioned: the town orders one only when it can pay, the shopkeeper or barkeep asks a
    crafter, and the crafter is paid when it's done. More **rooms** are bought with coins too.
  - **Strangers are all different:** named ("Bram Tallow", "Ysolde of the Salt Road"), of some temper (a haggler, a
    big spender, picky, chatty, in a hurry), and each wants something in particular: a weapon, armour, a tool, one
    piece of gear, fine goods, a load of some material; or, at the tavern, a hearty meal, a drink, something sweet, or
    one dish. What they asked for and didn't find, the town makes.
  - **Keepers upsell** on their Social skill: a finer piece than a customer came for, something extra on the side, a
    better price, a second round; or, with nothing they want, something else instead (never the picky). They learn
    Social as they go.
  - **The tavern** (a Fireside Inn with Hospitality, after Barter, rebuilt as the Tavern with Brewing) sells fare the
    town cooks. Its furnishings give **comfort**: every guest is used to some, and one used to more walks out. The
    better-off need more, and spend more.
  - **Quality:** everything crafted (gear, wares, fare, furnishings) comes in eight grades, Poor, Common, Uncommon,
    Rare, Epic, Legendary, Mythic and Divine, rolled from the crafter's Crafting skill. Finer gear does more, finer
    furnishings add more appeal or comfort, and finer pieces sell for more. Grand customers want Uncommon or better.
  - **The townsfolk's own coins:** once there's a shop, the town pays a daily wage (more for the skilled, never over
    half its purse), and crafters earn a piece rate for what they make to sell. The townsfolk **buy their own gear**
    from the shop's stock (before there's a shop it's handed out free), and spend evenings at the tavern, which cheers
    them. The Plan tab shows yesterday's coins in and out: travellers at the shop and tavern fund the town.
  - **Tap anyone** to see what they're doing and why: a crafter's commission (who it's for, who asked, the price), the
    building someone keeps, and what they did lately.
  - **Tap the shop or tavern** (or a stranger) to see inside: a bird's-eye view of the counter, the furnishings and the
    travellers browsing, with what's for sale, what the town wants to buy, and the latest sales.
- **Research stations seat one person each** (the campfire, Storyteller's Circles, Scriptoria, Libraries,
  Universities, AI Cores). Each researcher takes a topic of their own from the queue where they can, so more stations
  means more topics at once; the town builds more, and better ones, as it grows. The Research tab shows who's where.
- **Nearly 200 research topics.** Besides the ones that open buildings and items, each era has topics that make the
  town steadily better at building, crafting, farming, fighting, trading and learning. Every origin also has its own
  **heritage** line of six topics, one or two an era from the Stone Age to the stars. The Lich learns Ossuary Rites
  and the Eternal Engine, the Druids Seed Lore and the Gaia Mind, the Knights Chivalry and Star Knights, and so on.
  Heritage sharpens what that people are good at, and makes their powers come back sooner. Only that origin sees it,
  at the top of each era in the Research tab. **Hide: Researched / Can't study yet** at the top of the tab cuts the
  list down to what's open now; the phone remembers the choice.
- **Becoming a lich:** once the hidden Occult branch yields Lichcraft, the founder is offered the Rite of the
  Phylactery (and if it's put off, a **Become a lich…** button waits on the Plan tab). Chosen, the town builds the
  phylactery; once it stands, the founder is a lich, and the whole game turns: grave-dark menus, bars and windows, mist,
  a drained town, and new names (Designs, Grimoire, Souls, Chronicle; Chronos Necropolis). It stays that way for good.
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
  into the Journal. The first half hour away passes as in play; after that the town slows to a quarter of the
  pace, and at most three game days (a season) pass however long you're gone, so a night away is a few days
  in the town, not weeks.
- **Livestock:** Domestication (Stone Age) brings the Chicken Coop (eggs) and the Goat Pen (milk); Animal
  Husbandry (Medieval) the Pig Sty (meat), the Sheep Fold (wool, spun into cloth at the loom) and the Cattle
  Pasture (milk, and a lot of meat and hide). They're built in the fields behind the town, and the animals
  wander about in them. Farmers tend them after the fields. Herds grow in spring and summer; when a pen is full,
  or food runs short, one goes to the pot. In winter they eat grain, and without it they starve one by one.
  Raiders who get away may drive some off. Eggs and cheese are served at the tavern too.
- **More farming:** Flax Growing (Stone Age) brings the Flax Field (fiber); Garden Crops (Stone Age) the
  Vegetable Patch, whose cabbages, carrots and beans grow on through the autumn; Orcharding (Stone Age) the Orchard,
  whose trees take a while to come into bearing and then fruit every year without sowing. Every harvest tires a
  field's soil and the next crop is smaller. Fields rest while fallow and all winter, and muck from the pens mends
  them. A worn-out field is left to rest unless the town is going hungry. Blight strikes now and then, worse in the
  wet and where one crop is grown everywhere, so the town plants a mix. Crop Rotation and Fertilisers soften both.
  Nobody sows in late autumn what can't ripen before winter. At the turn of winter a well-stocked town feasts at the
  harvest home, and a hungry one grumbles. The tavern serves vegetable soup, cider and fruit tarts. The town keeps
  its fields few and big: with the Ard Plough it ploughs two garden plots side by side into one Open Field, and with
  Crop Rotation an open field becomes an Estate Farm with a barn. Fields lie on the rising ground behind the town, so
  their crops show over the roofs.
- **Roomy shops and taverns:** the shop and the tavern are big rooms with aisles kept clear from the door to the
  counter. The keeper fills no more than half the floor; once it's that full the town saves up and pays to extend the
  place (up to five times), rather than cramming more in.
- **Out of the Stone Age:** the Elder Lodge needs the Bear Cave's totem. Send a party for it; if nobody goes, the Cave
  Bear comes down to the town a day and a half after the Elder's Council is learned. Kill it and the totem is yours.
- **When the founder dies:** their partner, a grown child or the town's most respected grown-up takes over, and the
  town mourns. The camp breaks apart only if no grown-up is left.
- **Rooms at the tavern:** the tavern has guest rooms upstairs (two at the Fireside Inn, more as it's extended and
  rebuilt as a Tavern), and the town puts a bed in each (a straw pallet, a box bed, a feather bed) once guests ask for
  somewhere to sleep. A guest who comes in the evening may take a bed for the night, paying more for a
  finer one; they sit up over their food, go to bed late, and set out in the morning. The Rooms line in the tavern's
  window says how many beds are taken tonight.
- **The land behind the town clears as the town grows:** clearing the land along the walkway clears the
  forest, hills or marsh behind it, so fields and pens can go there (a river stays a river).
- **A walled town:** once the town has a finished wall beyond each end, a wall is drawn round it far off behind
  the fields: stakes and watchtowers, stone with battlements, brick, concrete, or a shimmering force field.
- **Hide toggles:** the Research, Build and Crafting lists each have a **Hide:** row (researched, built, already
  have; and what can't be had yet). The phone remembers them.
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

## Origins

Chosen first on the New town screen, an origin changes how the whole game plays and looks: who the townsfolk are,
what they need, what they're good and bad at, three powers (spells or rituals) the town calls on by itself when the
moment's right (shown on the Plan tab with their cooldowns), and its own colours, fonts, menu names, town tint and
building style.

| Origin | Twist | Powers |
|---|---|---|
| **Settlers** | The classic game | None |
| **Lich** | A lich founder and the raised dead: no food, no sleep, slow healing, no children | Raise Dead, Bone Ward, Drain Life |
| **Druid Grove** | Fields and foraging fast, cleared forest grows back; builds slower, coarser crafts | Call Rain, Entangle, Bloom |
| **Blood Court** | A vampire founder, in a castle that climbs a floor at a time; the town works hard by night, thralls never despair | Mesmerise, Blood Feast, Night Terror |
| **Moon Pack** | A werewolf founder; wolves never raid, full moons make everyone fierce | Howl, Pack Hunt, Moon Frenzy |
| **Machine Colony** | Machines: no food, sleep or moods; fast research; nobody wanders in, units are assembled | Assemble, Overclock, Repair Swarm |
| **Deep Hold** | Dwarves: fast builders, finer crafts, tough; poor farmers | Deep Delve, Forge Blessing, Stone Skin |
| **Tide Clan** | Merfolk: great foragers, the sea gives fish, busy trade; pirates | Tide Call, Whirlpool, Sea Fog |
| **Nomad Caravan** | A tribe that follows the seasons until the Industrial age; fast building, twice the travellers, better prices; slower research | Trade Road, Swift Riders, Scouting Party |
| **Fae Court** | Strangers pay half again as much and may be charmed into staying; slow crafting | Glamour, Changeling, Faerie Ring |
| **Crucible** | Alchemists: fast research, newcomers gain a strange trait; poor builders | Transmute, Elixir, Volatile Flask |
| **Exiled Order** | Knights: armed from day one, fight hard, take less harm; slow crafting and research | Rally, Shield Wall, Oath of Mending |

Each origin builds its own way: homes are crypts, living trees, gothic houses, earth dens, metal pods, stone halls,
stilt huts, yurts, mushroom houses, alchemists' towers or keeps; walls are bone palisades, hedges, iron railings,
plated barriers and so on; and every other building is roofed and walled in the origin's materials and dressed in
its things (skulls and candles, vines, bats and banners, antennae, runes, nets and shells, flasks, heraldry).

The menus are made of the origin's stuff too. The Nomads' are a bright tent (striped awnings, stitched felt buttons,
pennants, rugs and rope). The Druids' hang from a bark branch with leaves. The Lich's are bordered in bones and
skulls. The Blood Court's are gothic stone, with spires, pointed arches and red stained glass. The rest have their
own: fur and claws, riveted plates, rune-carved stone, sea glass and shells, shimmering petals, brass and bubbling
flasks, or steel and heraldic banners.

### The Nomad Caravan's seasonal round

A nomad tribe doesn't stay put. Winter and spring it camps on its home ground; at midsummer it breaks camp and moves
a day's ride along the land to its summer pasture, and at midwinter it comes home, setting out at first light so the
tents are up again before dark. Its tents go on the wagons (homes, workshops, storage, the shop, the tavern, the
stable) and are pitched again at the new camp with all their materials, needing only a little work to stand. Fields,
mines and the great works are rooted: they stay where they were built, and the great works (the era capstones, and
in the end the Launch Site) always go up on the home ground, so nothing that takes years is lost to the road. The
view rides along with the caravan of wagons and pack animals (camels in the desert).

Its camp looks the part: work goes on under striped awnings, the shop is a bazaar stall that grows into a
pavilion and then a grand three-peaked one, the tavern is a feast tent, the stable a horse line, the stockpile a
laden cart, the lookout a tall pole with a pennant. While it stays put its wagons and pack animals wait at the edge of
the camp, and the ground it left keeps the marks of its tents (fire rings, flattened grass) until it comes back.
Once it settles, the caravan city rebuilds it all in adobe: domed houses, arcades and a caravanserai bazaar under
striped awnings.

While it wanders the tribe builds no walls: when raiders are sighted, the wagons are drawn up across both ends of
the camp, and put away again after. In the Industrial age it comes home one last time and settles: the home ground
becomes a caravan city, and it plays on to the stars like any other town. The Plan tab shows where it's camped and
when it moves next.

### The Blood Court's castle

A vampire town doesn't spread out: it builds up. Every hall, workshop, shop, tavern and bedchamber is a room of one
castle over the camp, seen in cutaway: coffins stood against the walls where the thralls sleep, shelves of books, a
forge, a feasting hall, a throne room, a chapel, sickbeds with bottles of blood. A room goes on the ground floor
while there's space, then on the next floor up once the one below is half built, up to five floors, with towers,
battlements, spires and red pennons over the top. Fields, mines, the graveyard and the walls stay outside, and when
the keep is full the town builds on outside it. People climb to the room they're working in, and sleep where they
can be seen. On the phone the view zooms out as the castle grows so it always fits, and upright the strip grows
taller to show it.

### Beasts, and things that come alive

- **The land's own beasts:** prides of lions (from day 4) and wild dog packs (from day 3) in the desert (wild dogs on
  the tundra too), crocodiles on the coast.
- **The Behemoth:** from day 8, now and then a beast raid comes with the Behemoth behind it: an epic beast that
  stamps the earth. Its horn is a relic.
- **Mimics:** a town with a shop may find, some night, that a chest a traveller left there has teeth. The Mimic
  starts inside the town with no warning; killed, its belly holds 45 coins.
- **Possessed tomes:** now and then, while someone studies at a library or better, its books tear themselves off
  the shelves and fly at the scholars. Beaten, they give up their secrets: every topic being studied jumps halfway
  to done.
- **Vampire bats** fly with the Countess's army, and wheel round a Blood Court's castle at night.
- **Walking mushrooms:** a druid grove's Entangle wakes two to fight for it.
- In the desert the trade caravan comes by camel.

### Rival origins

The origins you didn't pick are out there too. From day 8, in any era, now and then one sends its army against
you, led by its lord, who casts that origin's spells in the fight. Kill the lord and the town keeps its relic.
A rival never raids a town founded its own way.

| Rival | Army | The lord's spells | Relic |
|---|---|---|---|
| The Lich Lord | Flying skulls, zombies, wraiths, mummies | Drain Life, Raise the Fallen, Bone Ward | Phylactery |
| The Archdruid | Wolves, boars, treants | Entangle, Call Storm, Regrowth | Staff |
| The Countess | Thralls, night shades (and she carries people off) | Mesmerise, Blood Drain, Night Terror | Ring |
| The Alpha | Wolves, alphas, werewolves | Howl, Blood Frenzy | Pelt |
| The Overmind | Scout drones, iron sentries | Overclock, Repair Swarm, EMP (machines and turrets stop) | Core |
| The Thane | Hold warriors and crossbows, stone golems | Stone Skin, Rockfall (breaks walls) | Hammer |
| The Tide Queen | Tide warriors and callers, coral golems | Whirlpool, Sea Fog, High Tide | Trident |
| The Khan | Riders and horse archers | Arrow Volley, Plunder (takes coins) | Bow |
| The Queen of the Wild Hunt | Wisps, redcaps (they carry people off) | Glamour, Faerie Fire | Crown |
| The Mad Alchemist | Acid slimes, brass homunculi | Volatile Flask, Elixir, Transmute (breaks walls) | Philosopher's Stone |
| The Grand Master | Knights and crossbowmen of the Order | Rally, Shield Wall, Oath of Mending | Shield |

Every spell, the town's and the rival lords', is drawn as it's cast: a magic circle under the caster, its name
rising, and its own effect: lightning out of the sky, life drawn off in streams of light, roots bursting up round the
defenders, rain clouds, sea fog, shockwaves, vortices, wards, volleys of arrows, thrown flasks bursting, falling
rocks, swarms of bats, fountains of coins, auras, a wave rolling through the town.

Hexes on the defenders (held, fogged, EMP) and blessings on the army (frenzied, warded) show on the raid badge
with the seconds left.

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
