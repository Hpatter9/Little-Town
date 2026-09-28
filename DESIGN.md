# Town Builder Game — Design Document (working title)

A pixel-art idle / RPG / sandbox town builder that lives in a thin strip at the bottom of the desktop, just above the taskbar. You start with a lone main character at a campsite and grow it into a town, advancing through eras from Neolithic to Space. It is a completely new game, separate from Little Wayfarers, but it reuses the Little Wayfarers overlay approach and sprite set.

The player is usually working while the game runs, so the game must be low-effort to glance at, never block the desktop, and never need hotkeys.

---

## 1. Core Loop

1. **Expeditions** bring back materials, recruits, and discoveries.
2. **Materials** are spent on **buildings** and **crafting** only.
3. **Research** costs no materials. It is purely a timing system: the less skilled the researcher, the longer it takes.
4. New research unlocks new buildings, items, expeditions, and upgrades, which make the town and expeditions stronger.
5. A bigger, stronger town can take on longer and harder expeditions with better rewards.

Early on, the main character is the only worker, so the player must choose between expeditions, building, and researching. As townsfolk join, that time pressure eases and shifts into managing people.

Research workstations (e.g. Storyteller's Circle → Scriptorium → Lab → Computer Core) cost materials and raise research speed or unlock the next era's topics, so research capacity still draws on the expedition haul.

---

## 2. Pacing and Time

**Target length:** 4–6 weeks of real time from campsite to space launch, for a player checking in a few times a day.

**Universal time formula** for every timed action (build, craft, research, travel):

```
Time = BaseTime × EraMultiplier ÷ WorkerSpeed
```

- **EraMultiplier:** Neolithic 1×, Medieval 2.5×, Industrial 6×, Modern 15×, Robotic/Space 40× (tunable).
- **WorkerSpeed:** from the relevant skill, plus tools, workstation tier, and traits. Example: skill 1 is slow; skill 15 is about 4× faster.
- **Multiple workers** on one task stack with diminishing returns.
- Skill growth should cover roughly half of each era's slowdown; buildings, tools, and traits cover the rest. Investing in people and workstations is noticeably faster than not.

**Era time budget (targets)**

| Era | Real time | Typical action lengths |
|---|---|---|
| Neolithic | Days 1–3 | Seconds to a few minutes (e.g. tent 30s, research 2–5 min, short trip 3 min) |
| Medieval | ~Weeks 1–2 | Research 15–45 min, expeditions 20–60 min, first raids |
| Industrial | ~Weeks 2–3 | Big projects take hours |
| Modern | ~Weeks 3–4 | Research 3–6 hrs, overnight expeditions |
| Robotic/Space | ~Weeks 4–6 | Research 6–12 hrs, multi-day ship launch capstone |

**Queues and offline play**
- Build, craft, and research queues start at 2–3 slots and grow through Logistics/Society research and town hall upgrades.
- While the game is closed, townsfolk work through queued jobs, then go idle. Checking in to set up the next batch matters.
- Expeditions continue offline (they are time-based) using the party's stance and standing orders.

---

## 3. Losing (RimWorld-style)

- **Colony collapse:** everyone dies, or morale drops so low the survivors abandon the town.
- **Main character death = game over.**
- **Slow spirals:** a failed expedition costs your best fighters, the next raid hits harder, food runs out, morale drops.
- **World-dooming events** per era, with warning signs: plague and drought (early), famine or volcanic winter (mid), industrial pollution or war (later), rogue AI uprising or meteor (late). The space launch is the final escape.
- **Threat scaling** by town wealth, days survived, era, and difficulty setting.
- **Ironman mode** (single save) as an option.

**Softening main-character death**
- **Downed state:** at zero HP the main character falls with a bleed-out timer. A medic can stabilize them, or the party carries them home at reduced speed.
- **Higher retreat threshold** when the main character is badly hurt (set on the expedition board).
- **Revive options** (all found in the hidden Occult/Survival branch or as rare items, see §9).

---

## 4. The World and Town Layout

**Random generation**
- Each run uses a **seed** (shareable and replayable).
- Terrain features vary by seed: rivers, hills, forests, marsh, fertile soil.
- Future option: choose a **starting biome** (forest, desert, tundra, coast) with different resources and threats.

**One long scrollable town with depth**
- **Foreground:** the walkway where townsfolk move, market stalls, and front walls during raids.
- **Midground:** main buildings (homes, shops, tavern, workshops).
- **Background:** farms, fields, mines, pastures. Drawn at ~60% scale with parallax.
- Scroll with the mouse wheel while hovering, or drag. A "follow" button snaps to the action.

**Building placement**
- Each layer has its own horizontal tile grid. Buildings have a width in tiles (tent 2, tavern 5, castle keep may span layers).
- Place a **blueprint ghost** → townsfolk **haul materials** from storage → builders work (scaffolding + progress bar).
- **Hauling distance matters** on a long strip. Carts, extra stockpiles, and smart layout pay off.
- **Upgrades in place** through eras (tent → hut → cottage → house → apartment). Some grow wider when upgraded.
- **Adjacency bonuses:** smithy near mine, tavern near market (morale), farms near river.
- **Demolish** refunds part of the materials.
- **Fire spreads** between wooden buildings. Firebreaks and later brick/stone matter.
- **Storage capacity limits** require more stockpiles and warehouses as the town grows.

**Expanding the edges**
- Beyond the town are forest, rock, marsh, and hill tiles. Clearing them takes time and yields materials (forest → lumber, rocks → stone).
- Terrain gives reasons to expand in a direction (river → water mill, hills → mine, fertile soil → farms).
- As the town spreads, old edge walls become inner walls, creating layered defenses.

---

## 5. Research

- **~100 topics total**, 15–25 per era.
- **Time-only cost.** Speed comes from researcher skill, workstation tier, and traits.
- **Branches:**
  - **Construction:** new buildings, faster building
  - **Crafting:** tools, workstations, material refining
  - **Agriculture:** food, farms, animals, horses
  - **Military:** weapons, armor, walls, towers
  - **Medicine:** healing, injury recovery, disease
  - **Logistics:** queue size, carry weight, transport, storage
  - **Society:** morale, shops, attracting recruits and families
  - **Occult/Survival (hidden):** see §9
- **Hidden research:** some topics exist only after discovery (ancient tech from ruins, crafts taught by specific recruits, relics unlocking one-of-a-kind buildings).
- **Expedition discoveries** can halve a topic's research time or reveal hidden topics.

---

## 6. Content Scale

All content is **data-driven** (definition files, not code), so adding the fiftieth building is just a new entry and balancing means editing numbers in one place.

| Content | Per era | Total |
|---|---|---|
| Research topics | 15–25 | ~100 |
| Craftable items | 25–35 | ~150 |
| Buildings | 12–20 | ~80 + upgrades |
| Expedition destinations | 5–8 | ~35 |
| Traits, recruit types, random events | — | dozens each |

**Material chains by era** (raw → refined → components):
- **Neolithic:** wood, stone, flint, hide, clay, fiber, bone, herbs, food
- **Medieval:** iron, leather, cloth, lumber, bricks
- **Industrial:** steel, coal, glass, rubber
- **Modern:** concrete, plastics, electronics, fuel
- **Robotic/Space:** alloys, circuits, power cells, rare minerals

**Transport evolves with eras:** horses → carts → wagons → trucks → drones. Carry weight scales naturally.

---

## 7. Townsfolk

**Population:** up to 30–50 at the peak of a late-game town.

**Recruitment**
- **Wanderers** arrive on their own, drawn by reputation and amenities (a tavern and good food attract more).
- **Rescues** from expeditions.
- **Refugee groups and families** during events, sometimes a whole family at once.
- **Captured raiders** can be held and eventually converted (risky early).
- **Specialists** (barkeep, blacksmith, healer) appear once you have the building they'd run.
- Every arrival shows a card with skills and traits. Accept or turn away. **Housing caps** population.

**Skills** (levels 1–20; level by doing the work)
Construction, Crafting, Research, Farming, Cooking, Gathering/Mining, Medicine, Melee, Ranged, Trade/Social, Animal Handling.

**Passions:** each person has 1–3 passions that multiply XP gain in that skill.

**Traits** (1–3 per person)
- Positive: Hard Worker, Quick Learner, Tough, Green Thumb
- Negative: Lazy, Coward, Glutton, Pyromaniac
- Mixed: Night Owl, Loner, Bloodlust, Greedy (better trader, occasionally steals), Zealot (dislikes monster townsfolk)

**Jobs and roles**
- **Priority grid:** each job set to high / normal / low / off per person, with an **auto mode**.
- **Building operators:** named roles (Barkeep, Blacksmith, Merchant, Guard Captain, Healer). The operator's skill sets the building's output.

**Needs and morale**
- Needs: food, rest, shelter, recreation, safety. Beauty and comfort in later eras.
- High morale = work speed bonus. Low morale = slower work.
- At the breaking point: sulking, tavern binge, picking a fight, or leaving town.

**Relationships and families**
- Friends, rivals, couples. Couples can marry and have kids.
- Kids grow up over about a week of real time and inherit a parent's passion. A school gives better starting skills.
- A friend or partner dying is a major morale hit.

**Monster townsfolk**
- Werewolves and vampires can join as recruits. Powerful fighters with catches: werewolves go feral on full moons; vampires need to feed.

---

## 8. Expeditions

**Expedition Board** (pop-up panel): destination cards showing difficulty, round-trip time, recommended party strength, carry needs, and a loot preview (vague until scouted). Harder and longer = better, higher-level rewards.

**Types**
- **Gather:** bulk materials
- **Hunt:** food, hides, animal parts
- **Salvage ruins:** rare materials, blueprints
- **Rescue:** recruits and families
- **Trade run:** swap surplus goods
- **Clear a threat:** reduces raids for a while
- **Scout:** reveals new destinations
- **Legendary:** boss-level, era-defining rewards

**Party setup**
- Party size starts at 2–3, grows through research.
- Roles: fighter, scout, medic, porter.
- Front/back row formation, gear loadouts, supplies (running out of food hurts health and morale).
- Retreat threshold and **stance** (cautious / balanced / bold) that decides event handling while away.
- **Loot priority list** so the party knows what to drop if over the weight limit.
- **Horses** add carry weight and speed; they can be injured, stolen, or killed.

**The journey**
1. **Outbound:** the strip switches to **split view** — town on one side, marching party on the other. The party walks in a line Final Fantasy–style, followers trailing the leader. Horses/carts visible.
2. **Events en route:** mostly auto-resolved by stance. Occasional choice prompts with a timer and a default (e.g. strangers on the road: help / ignore / rob).
3. **Arrival:** automatic combat and gathering. The player does not control combat; stats, gear, and formation decide it.
4. **Return trip:** slower when loaded, ambush risk.

**Rewards and risks**
- Loot scales with difficulty and duration. XP for all members.
- Injuries and deaths are possible.
- Rare finds can halve research times or reveal hidden research.
- Party members aren't working at home, and raids can hit while fighters are away.
- **Recall** turns the party around, but it still has to walk back.

---

## 9. Hidden Occult/Survival Branch

**Hidden until revealed** by any of:
- A strange tome or relic from a cursed ruin or crypt (mid-tier expedition)
- A mysterious recruit (hermit, plague doctor) with forbidden knowledge
- The main character's first time being downed and surviving (a vision)

**Undead evolutions for the main character** (permanent, with trade-offs)
- **Vampire:** gained from a rare cursed-ruin event or dark ritual. Revives once per night cycle. Stronger and faster at night, weak in daylight, must feed periodically (drain a townsperson's health or buy blood from traders). Some townsfolk fear it (morale hit, may deter recruits).
- **Lich:** occult ritual using a **phylactery** crafted from rare materials. Always revives at the phylactery, which lives in town and can be targeted by raiders. If destroyed, the next death is final.

**Era-appropriate revives**
- Neolithic: spirit totem (one-time)
- Medieval: resurrection shrine (expensive, single-use)
- Industrial/Modern: trauma surgery, cryo pods (revive with lasting injuries)
- Robotic/Space: clone vats, consciousness upload (revive with some skill loss)

**Special items:** one-time charms and relics from legendary expeditions (e.g. "Death's Bargain" coin), and consumables like a phoenix feather or emergency medkit that auto-trigger on the downed state.

---

## 10. Raids and Defense

**Warning**
- A **lookout** building gives lead time. Better research and taller towers = more warning.
- The strip flashes and a notification appears with a choice: sound the alarm, recall an expedition, or pay them off.
- On alarm, civilians shelter; guards and drafted militia take position.

**Direction:** raiders come from the left or right edge, making walls and gates at each end natural chokepoints. Later threats break this: sappers through the background, airships, drop pods mid-town.

**Raider goals** (they retreat once achieved)
- Steal from stockpiles
- Kidnap townsfolk (sets up a rescue expedition)
- Burn buildings
- Hunt the main character
- Destroy a lich's phylactery

**Threats by era**
- Neolithic: wild beasts, rival tribes
- Medieval: bandits, warbands, sieges
- Industrial: gangs, rival armies with guns
- Modern: mechanized forces
- Robotic/Space: drone swarms, rogue AI, space pirates

**Defenses:** walls and gates (take damage, need repair via Construction), towers, traps, guard posts, later turrets, bunkers, shield generators. Guards on patrol shifts, trained through combat and a barracks. Cavalry once horses exist.

**Scaling:** raid strength by wealth, days survived, era, difficulty, with a cooldown between raids.

**Outcomes:** win → loot raiders, maybe capture prisoners. Lose → stolen materials, burned buildings, kidnapped townsfolk, injuries, deaths.

**The Hunter's Guild**
- A guild that hunts vampires, werewolves, and other monsters. If monster townsfolk live in town, guild parties raid specifically for them.
- **Guild reputation** tracks hostility. Sheltering monsters and fighting hunters raises it.
- When hunters arrive, the player chooses:
  - **Give them up:** lose that townsperson, friends lose morale, guild reputation improves.
  - **Hide them:** check using the best Social skill plus hiding spots (cellars, crypts). Failure means angrier hunters who attack anyway.
  - **Fight:** tougher-than-normal raid; the guild sends bigger parties next time.
- **Standing orders** per monster townsperson (always hide / always fight / give up) apply while the player is away.

**Offline raids and phone alerts (pre-scheduled)**
- Raids happen while the game is closed.
- On close, the game simulates ahead through the queues, determines when raids will hit, and schedules **phone push notifications** at those times via **ntfy** (delayed delivery). The player installs the ntfy app on their phone.
- Alerts include lead time so the player can get to the PC and respond; otherwise defenses and standing orders resolve it.
- On reopen, the game resolves everything and writes the "while you were away" journal entry.
- Optional alert types: deaths, expedition returns, choices waiting.

---

## 11. UI

**No hotkeys.** The player is working while the game runs; everything is clickable.

**Strip size:** 200 px tall in full view; ~32 px slim ticker in minimal mode.

**Modes**
- **Town view:** full scrollable town
- **Split view:** town + marching party during expeditions
- **Minimal:** slim ticker (resources, timers, alerts)
- **Hidden:** automatic when a fullscreen app is running

**Interaction**
- Click-through by default. The strip becomes interactive when the mouse hovers over it, and returns to click-through when the mouse leaves.
- **Tab buttons** at one end open panels. A **collapse button** toggles full view / slim ticker.
- Click a townsperson for a mini card (mood, job, skills). Hover buildings for tooltips.
- Pause button. Choose which monitor the strip lives on.

**HUD (always visible, compact):** era resource bar, queue slots with timers, day/night and season indicator, expedition progress.

**Pop-up panels** (rise above the strip): Build, Research tree (hidden branches appear once revealed), Expedition Board, Townsfolk roster (skills, traits, job priorities, standing orders), Crafting, Event choices, **Town Journal** (running history plus "while you were away" summary).

**Notifications:** in-strip messages for routine things, desktop notifications for bigger events, phone alerts via ntfy for raids and optional others.

---

## 12. Tech Stack

- **Electron:** transparent, frameless, always-on-top window docked above the taskbar. Reuse the Little Wayfarers overlay setup. Click-through with hover-based hit testing.
- **TypeScript** throughout.
- **PixiJS** for GPU-accelerated 2D rendering: sprite sheets, animation, layering, parallax, tinting for recolors, crisp pixel-art scaling (nearest-neighbor).
- **Low resource use:** reduced framerate in minimal mode; rendering stops when hidden.
- **Simulation separate from rendering:** fixed-tick game loop with a **seeded RNG**, so the sim is deterministic. Required for seed-based world gen and offline raid pre-scheduling.
- **Data-driven content:** research, items, buildings, enemies, expeditions, traits, events all in definition files.
- **Saves:** autosave to a local file with rolling backups; single-save option for ironman.
- **Offline:** on close, simulate ahead, schedule ntfy alerts; on open, resolve and journal.

## 13. Art Pipeline

- **Little Wayfarers sprite set:** Universal LPC spritesheet (CC-BY-SA 3.0 / GPL 3.0) assembled and recolored in code; random combinations give each townsperson a unique look.
- **PixelVault** weapon/armor icons for crafting and gear.
- **Whtdragon MV** creature sprites for enemies and wildlife.
- **LPC building and terrain tilesets** cover early eras.
- **Gaps:** late-era buildings and sci-fi characters. The owner is sourcing more late-game art.
- **Attribution file (CREDITS)** required by the LPC license.
- Characters ~48–64 px tall; background layer at ~60% scale.

---

## 14. Milestones

**Milestone 1 — Playable Neolithic camp** (the MVP)
- Overlay strip: full and minimal modes, hover interactivity, tab buttons, auto-hide for fullscreen apps
- Seeded random terrain, three-layer scrolling town, clearing land at the edges
- Main character gathering, building, researching; limited queues
- Neolithic content catalog (§15)
- A few recruit types with skills, passions, a handful of traits, basic needs, morale, job priorities
- Expedition Board with 3–5 destinations, split-view marching party, auto combat, carry weight, loot
- Beast and rival-tribe raids; palisade walls and gate; lookout warning
- Downed state; main character death = game over
- Save/load, offline progress through the queue, Town Journal with "while you were away" summary

**Milestone 2 — Medieval:** families, relationships, mental breaks, bandit raids with goals, horses, trade caravans, ntfy phone alerts.

**Milestone 3 — Dark secrets:** hidden research, Occult branch, vampires, werewolves, liches, Hunter's Guild, world-dooming events.

**Milestone 4 — Industrial and Modern:** both eras, transport evolution (carts → trucks), bigger raids.

**Milestone 5 — Robotic and Space:** final era content, ship-launch ending, ironman mode, biome selection, full balancing pass.

**Build approach:** one piece at a time, testing as you go. Suggested order for Milestone 1: overlay window → scrolling town render → sim tick + seeded RNG → main character movement and gathering → building placement → research → townsfolk → expeditions → combat → raids → save/offline/journal.

---

## 15. Milestone 1 — Neolithic Content Catalog

All numbers are starting points for tuning.

**Materials:** wood, stone, flint, fiber, hide, bone, clay, herbs, raw meat, berries.

### Research (time-only)

| Topic | Branch | Unlocks | Prereq |
|---|---|---|---|
| Fire Keeping | Crafting | Campfire cooking, Torch | — |
| Flint Knapping | Crafting | Flint Knife, Workbench | — |
| Foraging | Agriculture | Better gather yields, Forager job | — |
| Basic Shelter | Construction | Lean-to | — |
| Woodcutting | Construction | Stone Axe, faster forest clearing | Flint Knapping |
| Stoneworking | Construction | Stone Hammer, faster rock clearing | Flint Knapping |
| Cordage | Crafting | Rope, Sling, Snare | Foraging |
| Spear Hunting | Military | Spear, Hunt expeditions, Hunter's Lodge | Flint Knapping |
| Tanning | Crafting | Tanning Rack, Hide Armor, Hide Cap, Hide Tent | Spear Hunting |
| Food Preservation | Agriculture | Drying Rack, Dried Meat, slower spoilage | Fire Keeping |
| Pottery | Crafting | Kiln, Clay Pot, +storage | Fire Keeping |
| Herbalism | Medicine | Herb Garden, Poultice | Foraging |
| Scouting | Logistics | Scout expeditions, more destinations | Cordage |
| Palisades | Military | Palisade Wall, Palisade Gate | Woodcutting |
| Lookout | Military | Lookout Platform (raid warning) | Palisades |
| Early Agriculture | Agriculture | Garden Plot (wild grain) | Foraging |
| Oral Tradition | Society | Storyteller's Circle, +1 queue slot, research speed | Fire Keeping |
| Pack Carrying | Logistics | Backpack, +carry weight | Tanning, Cordage |
| Elder's Council (capstone) | Society | Elder Lodge; completing it opens the Medieval era | Oral Tradition + 10 others |

### Buildings

| Building | Layer | Width | Purpose |
|---|---|---|---|
| Campfire | Fore | 2 | Cooking, warmth, morale |
| Stockpile | Fore | 3 | Storage |
| Lean-to | Mid | 2 | Housing (1) |
| Hide Tent | Mid | 3 | Housing (2); upgrades from Lean-to |
| Workbench | Mid | 2 | Tool and weapon crafting |
| Drying Rack | Mid | 1 | Food preservation |
| Tanning Rack | Mid | 2 | Hide processing |
| Kiln | Mid | 2 | Pottery |
| Hunter's Lodge | Mid | 3 | Hunter role, hunt bonuses |
| Storyteller's Circle | Mid | 3 | Research workstation tier 1, morale |
| Herb Garden | Back | 3 | Herbs |
| Garden Plot | Back | 4 | Wild grain |
| Palisade Wall | Fore (edges) | 1 | Defense |
| Palisade Gate | Fore (edges) | 2 | Defense, passage |
| Lookout Platform | Mid | 2 | Raid warning |
| Elder Lodge | Mid | 5 | Era capstone; needs a rare material from the Bear Cave expedition |

### Craftable Items

| Item | Type | Notes |
|---|---|---|
| Flint Knife | Tool/weapon | Gathering bonus, weak melee |
| Stone Axe | Tool | Wood gathering, forest clearing |
| Stone Hammer | Tool | Stone gathering, rock clearing, construction speed |
| Wooden Club | Weapon | Basic melee |
| Spear | Weapon | Melee, reach |
| Fire-Hardened Spear | Weapon | Upgraded spear |
| Sling | Weapon | Basic ranged |
| Sling Stones | Ammo | For sling |
| Wicker Shield | Armor | Block chance |
| Hide Cap | Armor | Head |
| Hide Armor | Armor | Body |
| Bone Charm | Trinket | Small morale or luck bonus |
| Torch | Utility | Night work, fire |
| Rope | Component | Used in many recipes |
| Snare | Utility | Passive food trapping |
| Clay Pot | Utility | Storage, cooking |
| Waterskin | Supply | Expedition supply |
| Backpack | Utility | +carry weight |
| Bedroll | Utility | Rest quality, expedition rest |
| Poultice | Medicine | Heals injuries |
| Dried Meat | Food | Slow-spoiling |
| Travel Rations | Supply | Expedition food |

### Expeditions

| Destination | Type | Time | Rewards | Threats |
|---|---|---|---|---|
| Berry Thicket | Gather | ~3 min | Berries, fiber, herbs | Rare boar |
| Riverbank | Gather | ~6 min | Clay, flint, stone | Low |
| Deep Woods | Hunt | ~10 min | Hide, meat, bone | Wolves |
| Old Quarry | Gather | ~15 min | Stone, flint (bulk) | Rival tribe scouts |
| Bear Cave | Legendary | ~30 min | Rare material for Elder Lodge, big hide/bone haul | Cave Bear boss |

### Enemies

Wolf, Wolf Pack Alpha, Boar, Cave Bear (boss), Rival Tribesman (spear), Rival Slinger.

### Raids (Neolithic)

Wolf packs, boar charges, rival tribe scouting parties. Goals limited to stealing food and harming townsfolk in Milestone 1.

### Recruit Types

Wanderer (generalist), Hunter (Melee/Ranged), Gatherer (Gathering/Farming), Crafter (Crafting/Construction), Elder (Research/Social, weak fighter).

---

## 16. Open Items

- Game name (working title for now).
- Location of the Little Wayfarers sprite folders to reuse.
- Late-era art sources (owner is searching).
- All timings and costs are starting values to tune during play.
