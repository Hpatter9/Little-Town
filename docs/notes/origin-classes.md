## Each people's own base callings, and the mythic callings (the owner's asks: "3 extra base classes per origin with the same number of evolutions as the regular classes"; "mythic rare classes. Only a few that show up very very rarely. Like a summoner")

Changes the HISTORY.md sections "Classes and levels", "Class paths", "Evolutions that matter", "Stat points", "Skills
and levels run to 100" and "A calling's weapon in hand".

**Each people's own base callings**

- **Three for each of the thirteen peoples** (39 in all), each a whole tree as deep as a shared base calling's: the
  base, two stage-1 roads, two stage-2 roads from each, two stage-3 roads from each, and an ascended form after
  every stage-3 road (23 nodes a calling, 897 in all). The shape is `CallingTree` in `data/callings/kit.ts`; each
  people's trees are in `data/callings/<people>.ts`; `data/originCallings.ts` gathers them (`ORIGIN_CALLINGS`,
  `callingNodes`, `callingId`: node ids `oc_<people>_<id>`, skill ids the same). Every node has a name, text, lore, a
  signature skill, a stat lean, an emblem (the calling's own colours), an archetype (`cls`, one of the 26 classes,
  for its gear, spells and class skills), and from the nearest node up its road a fighting form (`form`: a pack
  sheet, or `'doll'` for the townsperson in their people's dress) and a weapon kind of its own (`arms`).
- **In the tree** (`data/paths.ts`): `CALLING_PATHS` (`PathNode.calling`, `origin`), `callingBases(origin)`,
  `formOf`, `armsOf`. `roadsFrom` keeps a calling's roads open to whoever stands on it. Skills join
  `PATH_ABILITIES` (`data/abilities.ts`), leans `LEANS` (`data/pathAttrs.ts`), emblems `COMPOSITIONS` and
  `BASE_COLOURS` (`data/emblems.ts`), crossroads scenes `FORK` (`data/pathLore.ts`).
- **Who takes them** (`sim/classes.ts`): `basePulls(s, p)` weighs the eight shared bases and, with the autopilot
  on, the three of the person's people (`p.origin`, else the town's) by the same fit, theirs times
  `ORIGIN_CALLING_LEAN` (1.6: about two in five of a town's folk start on one). A stranger of another people takes
  their own people's. In a town run by hand only the shared eight, as before (plain-town hashes unchanged).
- **Balance** (`data/levels.ts`): a calling's numbers are its archetype's, as the shared callings', at every stage;
  the people's edge (`ORIGIN_EDGE`, `ORIGIN_EVOLVE`) only on the ascended form (`originEdge`). Base skills are small
  passives (0.12 at most); stage skills keep to the shared ones' sizes (tested: passives 0.3/0.5/0.8 by stage, a
  skill's power times hits 3.2 at most).
- **Their weapon:** `canWear` lets someone wield their road's `arms` kind on top of their archetype's.
- **Seen:** the People roster and the person card read the node's name, lore and emblem, as for any calling (no
  panel changes; the Our ways tab has no class list). While they fight, the map and the raid board draw the road's
  form over the Himeko look (`roadForm` in `art/heroForms.ts`, in `map/mapPeople.ts`), and so does the party fight
  screen (`fight/fightView.ts`; the fighter view carries `road`). `'doll'` callings fight as themselves.
- The evolution card on a people's own calling says all its roads are theirs.

**The mythic callings**

- **Five mythic trees** (`data/callings/mythic.ts` `MYTHIC_TREES`, gathered in `data/mythic.ts` `MYTHIC_CALLINGS`;
  ids `my_<id>`), the same depth, open to any people. **The Summoner went up to them**: the shared Summoner road
  (Summoner, Conjurer, Beastcaller and all after, ids as they were) now grows from the first mythic calling, the
  Pact-born (`roads: ['summoner', ...]` grafts it), and leaves `PATHS` for `MYTHIC_PATHS`. The Wanderer has a new
  second road in its place (`WANDERER_ROAD`: the Spirit Wayfarer), and the merfolk's Tidecaller now opens beside it.
  Old saves on the Summoner's road keep their nodes, and are mythic now.
- **Odds** (`sim/classes.ts` `mythicRoll`, `mythicOdds`, on a side stream `${seed}:mythic:${id}`; autopilot only):
  `MYTHIC_ODDS` 1 in 400 when someone takes their first calling; `MYTHIC_HEIR_ODDS` 0.25 for the child of two
  ascended parents; `MYTHIC_OMEN_ODDS` 0.2 for the first to take a calling after an ascension (`s.mythicOmen`, set
  by `ascend`, spent either way). Which of the five: by fit, as the bases.
- **Feel:** a people's edge below the top, and `MYTHIC_EDGE` 1.4 / `MYTHIC_EVOLVE` 1.5 on the ascended form (above
  `ORIGIN_EDGE` 1.2 / 1.25). Fighting forms from sheets no other calling uses (hk_demon_lord, hk_demon, gorgon_2/3,
  hk_tyrant, hk_ogre_horned, minotaur_3). When one comes among the town (`mythicBorn`): their `title`, a ✨ news line
  and a line for the year's chronicle (`born`, with {name} and {town}; `s.mythics`, `mythicYearLines` in
  `sim/annals.ts`). Their emblem glows violet (`Emblem.mythic`, `art/emblems.ts`); on the map they shimmer
  (`isMythic` in `map/mapPeople.ts`).

**Tests:** `test/originClasses.test.ts`, `test/mythic.test.ts`. `test/paths.test.ts` follows the Summoner's move
(the Conjurer's base is the Pact-born; the Summoner archetype is reached on the mythic tree).
**Tool:** `tools/calling-soak.mjs [days] [seeds] [origins] [one seed]` (people, deaths, own callings, raids; `plain`
for the plain-town hashes).

**Soak** (40 days, 3 seeds each, `tools/calling-soak.mjs`; before is main at 0.130.0): people / deaths / raids won,
driven off, pillaged; own = folk on their people's own callings at day 40.
- Liches: before 89 / 36 / 31, 79, 13; after 69 / 31 / 32, 86, 8; own 24 of 69.
- Knights: before 41 / 16 / 33, 52, 8; after 47 / 19 / 20, 33, 6 (one town of three fell, at 7 deaths); own 13 of 35.
- Orcs: before 41 / 18 / 28, 42, 17; after 45 / 13 / 40, 42, 13; own 17 of 42.
- Plain towns (autopilot off) hash the same before and after. Autopilot hashes move (who takes which calling).

**The callings** (base: archetype, form; then each stage-1 road with its stage-2 roads, their stage-3 roads and
ascended forms):

**settlers**

- **Frontier Hand** (ranger, samurai_archer): Trailblazer (Pathfinder: Claim Staker → Lord of the Far Claims, Wagon Scout → Master of the Wagon Road; Trapper: Bounty Tracker → Bane of Outlaws, Bear Trapper → King of the Pelt Trade) | Woodsman (Timberjack: Greatwood Feller → Bane of the Old Wood, Log Driver → Master of the Spring Drive; Stockade Builder: Blockhouse Keeper → Keeper of the Last Fort, Palisade Sergeant → Wall of the Frontier)
- **Homesteader** (warrior, ninja_peasant): Smallholder (Yeoman: Bowman of the Shire → Bow of the Shire, Freeholder → Heart of the Free Land; Herdsman: Drover → King of the Cattle Road, Hill Shepherd → Shepherd of the High Pastures) | Reaper (Harvester: Scythe Dancer → The Last Harvest, Thresher → Flail of the Fields; Granary Warden: Root-Cellar Keeper → Keeper of the Long Winter, Hedge Doctor → Keeper of Every Remedy)
- **Preacher** (white_mage, wanderer_mage): Circuit Rider (Revivalist: Hellfire Preacher → Voice in the Wilderness, Faith Healer → Hand of Providence; Hymn Leader: Psalm Singer → Voice of the Great Awakening, Barn-Dance Fiddler → Fiddler at the World's Edge) | Schoolteacher (Learner of Ways: Jack of All Peoples → Master of Every Way, Hedge Wizard → The Self-Taught Archmage; Justice of the Peace: Circuit Judge → The Last Word, Town Marshal → Law Beyond the River)

**lich**

- **Bonewright** (engineer, skeleton_warrior): Ossuary Mason (Vaultwright: Ossuary Bastion → The Wall of Ten Thousand, Crypt Gaoler → Keeper of the Sealed Door; Wardwright: Sigil Carver → The Last Inscription, Ribplate Knight → Lord of the Bone Plate) | Bone-Binder (Charnel Engineer: Ossuary Siegewright → Engine of the Dead, Skull-Slinger → Master of the Grinning Volley; Golem-Binder: Fleshless Artificer → Maker of Giants, Bone Puppeteer → King of Strings)
- **Corpse-Tender** (alchemist, hk_mummy): Embalmer (Natron Priest: Canopic Keeper → Lord of the Four Jars, Tomb Hierophant → Pharaoh of the Necropolis; Brine-Master: Salt Warden → Lord of the White Tide, Plague Vintner → The Rot Sovereign) | Sinew-Stitcher (Bone-Setter: Surgeon of the Dead → Master of the Unending Ward, Reliquarist → Keeper of Dead Saints; Flesh-Grafter: Patchwork Lord → The Thousand-Stitched, Charnel Physician → Harvester of Parts)
- **Shade-Caller** (necromancer, hk_ghost): Ghost-Herd (Wraith-Marshal: Barrow Captain → General of the Unquiet, Ghostbanner → Standard-Bearer of the Dead; Keener: Banshee Voice → The Last Lament, Dirge-Keeper → The Eternal Dirge) | Veilwalker (Haunt: Poltergeist → Storm of the Unseen, Cold Hand → The Grave's Own Hand; Deathwatcher: Sexton of Hours → Bell-Ringer of the End, Between-Walker → Lord of the Threshold)

**druid**

- **Beastspeaker** (beast_tamer, satyr_1): Pack-Friend (Wolfkin: Howl-Leader → Mother of Wolves, Bearward → Great Bear of the Hills; Antler Rider: Hart Lancer → The White Hart, Thunderhoof → Lord of the Running Herd) | Beastblood (Wildheart: Greatclaw → The Elder Beast, Thornhide → The Briar Beast; Feathersworn: Owl-Watcher → The Night Owl, Kestrel Shot → Lord of the High Air)
- **Grove Warden** (guardian, doll): Hedgewarden (Thornguard: Briarwall → The Unbroken Hedge, Rootbinder → Lord of the Deep Roots; Tree-Shepherd: Oakcaller → Father of Forests, Ironbark → The Walking Oak) | Mistletoe Priest (Greenmender: Springkeeper → Spring Eternal, Moss Saint → The Evergreen; Blightbane: Harvest Reaper → Lord of the Last Sheaf, Fireweed Keeper → The Green Fire)
- **Weather-Singer** (shaman, shaman_king): Rainbringer (Cloudherd: Thunder-Drummer → The Rolling Thunder, Hailcaller → Crown of Hail; Mistwalker: Fogshroud → The Grey Veil, Dew-Dancer → First Light of Morning) | Season-Teller (Frostsinger: Winter's Tongue → Heart of Winter, Solstice Keeper → Turner of the Year; Sunsinger: Harvest Cantor → Voice of the Harvest, Balefire Singer → The Midsummer Sun)

**vampire**

- **Thrallmaster** (warrior, samurai_commander): Overseer (Keep Marshal: Castellan of the Night → Lord of the Climbing Keep, Bloodsworn Captain → High Captain of the Court; Scourge: Flaymaster → The Red Lash, Cellarer → Master of the Red Cellars) | Kennel-Keeper (Belfry Master: Swarm-Lord → Lord of the Dark Sky, Nightwing → Lord of the Eaves; Hound-Warden: Hunter of Hunters → Bane of the Guild, Night Huntsman → Lord of the Wild Hunt)
- **Night Courtier** (bard, kunoichi): Masquer (Midnight Dancer: Blade Waltzer → Lord of the Last Dance, Keeper of Revels → Host of the Endless Ball; Mesmerist: Glamour-Weaver → The Waking Nightmare, Whisperer → The Voice Behind the Throne) | Court Poisoner (Wine-Steward: Court Vintner → Master of the Dark Vintage, Black Sommelier → The Last Cupbearer; Silk Knife: Red Knife → The Court's Own Blade, Kingmaker → The Hidden Crown)
- **Blood Alchemist** (alchemist, fire_wizard): Sanguinarian (Stillroom Master: Nocturne Elixirist → Keeper of the Undying Vintage, Cellar-Sage → The Red Philosopher; Leech-Doctor: Phlebotomist → Master of the Veins, Red Almoner → Saint of the Tithe) | Haemomancer (Blood-Smith: Clotblade → The Sanguine Sword, Heart-Forger → The Crimson Colossus; Vein-Witch: Bloodstorm Caller → Lord of the Red Rain, Heart-Stopper → The Last Heartbeat)

**werewolf**

- **Moon-stalker** (hunter, werewolf_black): Night Tracker (Blood-trail Hunter: Heartseeker → The Unerring Moon, Snarewright → Lord of Snares; Ghost-pelt: Shadow-jaw → The Fang Unseen, Throat-taker → Death in the Long Grass) | Ridge-runner (Hill-courser: Stormcourser → Wind of the High Hills, Border Prowler → Warden of the Hunting Grounds; Pack-binder: Wolf-sire → Sire of the Hill Packs, Pack-heart → The Heart of the Pack)
- **Den-mother** (shaman, doll): Den-keeper (Wound-licker: Moon-midwife → Mother of the Litter, Bone-setter → The Mending Moon; Cub-warden: Threshold Wolf → The Den That Does Not Fall, Grey Matron → Matriarch of the Hills) | Moon-singer (Wane-witch: Eclipse Crone → The Dark of the Moon, Silverbane Witch → Queen of the Waning; Hunt-chanter: Moonrise Chanter → Voice of the Rising Moon, Ghost-pack Caller → Keeper of the Ghost Pack)
- **Moon-brawler** (shapeshifter, werewolf_red): Bloodfang (Render: Red Ruin → The Red Moon Risen, Bonebreaker → The Jaws of the World; Thick-pelt: Scarback → The Wolf That Would Not Die, Den-breaker → Breaker of Dens) | Bound Wolf (Still Wolf: Crescent Fist → Master of the Bound Moon, Quiet Fang → The Unmoved Wolf; Alpha-challenger: Rite-fighter → The Undefeated Alpha, Hill Champion → Champion of the Great Hunt)

**robot**

- **Tinker-Unit** (engineer, robot_infantry): Patch-Unit (Weld-Medic: Restoration Core → The Great Restorer, Swarm Shepherd → Shepherd of the Grey Swarm; Salvager: Scrap Knight → King of the Scrapheap, Reclaimer → The Last Reclaimer) | Drone-Wright (Hive Controller: Drone Admiral → Admiral of the Thousand Wings, Sentry Architect → Architect of the Iron Ring; Spotter-Unit: Rail Marksman → The Unerring Rail, Overwatch Unit → Eternal Overwatch)
- **Gearwright** (warrior, robot_destroyer): Pistonarm (Steam Hammer: Pile-Driver → The Unstopping Piston, Crusher Frame → Grinder of Hosts; Overheat Frame: Meltdown Unit → The Walking Meltdown, Slag Titan → Titan of Slag) | Plate-wright (Gate Engine: Fortress Frame → The Walking Citadel, Shield Lattice → The Lattice Eternal; Magnet Frame: Lodestone Warden → Lodestar Unbroken, Arc Conductor → The Living Conductor)
- **Signal-Caller** (bard, robot_swordsman): Relay-Unit (Command Relay: Network Marshal → Voice of the Array, Tempo Engine → Keeper of the Array Clock; Jammer-Unit: Static Weaver → The Great Static, Null Field → The Silent Null) | Signal Blade (Pulse Duellist: Ion Blade → Ion Sovereign, Phase Blade → The Phased One; Beacon Knight: Lighthouse Frame → The Beacon Eternal, Star-Caller → Voice of the Fallen Ship)

**dwarves**

- **Tunneller** (warrior, doll): Sapper (Stonebreaker: Mountain Breaker → The Mountain's Fall, Siege Sapper → Lord of the Undermine; Trapwright: Sentrywright → Master of the Iron Watch, Pitmaster → Lord of a Thousand Pits) | Delver (Gloomwalker: Lightless Stalker → Lord of the Lightless Deep, Chasm Leaper → The Fall Without End; Lodefinder: Crystal Singer → Voice of the Crystal Deep, Gemheart → The Living Gem)
- **Runesmith** (spellblade, knight_3): Anvil Striker (Emberwright: Flamehammer → Hammer of the Deep Fire, Magma Smith → Lord of the Molten Deep; Steelwright: Hold Armourer → Armourer of Kings, Bladewright → Maker of Legends) | Runecarver (Rune Priest: Ancestor Speaker → Voice of the Forefathers, Keeper of Runes → The Unbroken Rune; Runecaster: Thunderwright → Lord of the Storm Anvil, Unmaker → Breaker of Spells)
- **Shieldwall** (knight, knight_2): Longbeard (Grudgebearer: Doomseeker → The Doom Unfound, Grudgekeeper → Lord of Grudges; Ironbreaker: Gatebreaker → The Ram of the Mountain, Ironclad → Mountain in Iron) | Doorwarden (Wallkeeper: Shieldlord → The Wall That Walks, Kinwarden → Shield of the Kin; Hornblower: Hall Drummer → The Drums of the Deep, Hold Captain → Marshal of the Mountain)

**merfolk**

- **Pearl Diver** (hunter, kunoichi): Harpooner (Whaler: Whalebreaker → Bane of Leviathans, Deepwater Lancer → Lance of the Abyss; Netcaster: Reef Trapper → Lord of the Nets, Drowner → The Undertow) | Silent Diver (Inkblade: Murk Stalker → Shadow of the Trench, Eel Fang → The Drowned Lightning; Pearl Broker: Pearl Witch → Keeper of the Black Pearls, Conch Herald → Voice of the Conch)
- **Reef Warden** (guardian, squidman): Coral Shield (Coralback: Living Reef → Heart of the Reef, Shellwall → The Unsinkable; Breakwater: Harbour Warden → Lord of the Harbour, Surge Knight → Rider of the Ninth Wave) | Reef Tender (Kelp Weaver: Kelp Binder → Lord of the Drowned Forest, Tangle Sage → Elder of the Green Deep; Shoal Shepherd: Shark Rider → Ruler of the Shiver, Urchin Sower → The Spined Tide)
- **Tide Reader** (mage, wanderer_mage): Wave Singer (Siren: Shipwreck Singer → Voice of the Drowned, Whalesong Keeper → Song of the Great Whales; Shanty Caller: Sea Captain → Admiral of the Tides, Bosun → Master of the Fleet) | Undertow Mage (Maelstrom Adept: Riptide Magus → The Endless Undertow, Floodbringer → Bringer of the Great Flood; Brine Witch: Drowned Witch → Monarch of the Drowned, Fogweaver → The Endless Fog)

**nomads**

- **Far-rider** (ranger, samurai_archer): Grass Lancer (Thunder-hoof: Herd-breaker → The Stampede, Banner-rider → Standard of the Horde; Lasso Rider: Rope-master → Lord of the Long Rope, Eagle Hunter → Master of the Golden Eagle) | Dust-scout (Mirage-rider: Sand-ghost → The Rider Nobody Saw, Camp-raider → Terror of the Caravan Roads; Horizon Scout: Ridge-watcher → Eye of the Steppe, Signal-rider → Voice of the Beacon Hills)
- **Caravan-master** (bard, ninja_peasant): Wagon-warden (Circle-keeper: Wagon-fort Captain → The Rolling Fortress, Ox-hearted → The Unmoved Ox; Road-warden: Road-marshal → Warden of the Long Road, Ford-keeper → The Ford That Holds) | Silver-tongue (Spice Merchant: Incense-burner → Keeper of the Incense Road, Bitter-root Trader → The Bitter Bazaar; Fireside Teller: Road-singer → Singer of a Thousand Roads, Horde-herald → Herald of the Great Horde)
- **Sky-reader** (shaman, yamabushi_tengu): Wind-speaker (Thunder-drummer: Tempest Drummer → The Sky's Own Drum, Dust-devil Dancer → Mother of Whirlwinds; Hail-bringer: White-winter Caller → The White Winter, Bolt-rider → Bolt from the Blue) | Star-reader (Omen-teller: Fate-knotter → Weaver of the Long Sky, Dawn-watcher → The First Light; Spirit-rider: Ancestor-caller → Voice of the Eternal Sky, Bone Oracle → Oracle of the Burnt Bone)

**fae**

- **Trickster** (assassin, imp_pink): Will-o'-Wisp (Marsh Lantern: Drowning Light → The Lantern That Drowns, Mazemaker → Lord of the Endless Maze; Redcap: Bloodcap → King of the Redcaps, Nightmare Hob → The Thing Beneath) | Fetch (Mirror-Fetch: Glass Twin → The Face in Every Mirror, Ninefold Fox → Nine-Tailed Lord; Riddler: Riddle-Keeper → Master of Riddles, Jester of the Court → The Laughing King)
- **Dream-Weaver** (witch, imp_owlet): Sleep-Singer (Cradle-Singer: Keeper of Hush → The Long Lullaby, Moon-Singer → Voice of the Silver Moon; Night-Mare: Rider of Bad Dreams → Mare of the Black Hour, Dread-Spinner → The Waking Terror) | Hollow-Hill Seer (Hundred-Year Sleeper: Hollow-Hill Lord → Lord of the Hundred Years, Oracle of Mists → The Dreaming Eye; Mothwing: Starmoth → The Silver Moth, Dusk Moth → Monarch of Moths)
- **Thorn Knight** (knight, knight_3): Summer Knight (Rose Champion: Rosebrand → The Crimson Rose, Hedge-Lord → Lord of a Thousand Thorns; Sunlance: Midsummer Champion → Champion of the Summer Court, Noon Lancer → Lance of the Longest Day) | Winter Knight (Hoarfrost Blade: Knight of the Long Night → Champion of the Winter Court, Snow-Silent → The Silent Snow; Wild Huntsman: Keeper of the Hounds → Master of the Wild Hunt, Midnight Horn → The Hunt Eternal)

**alchemists**

- **Calciner** (alchemist, wanderer_mage): Quicksilver Adept (Leadbinder: Aurifex → Lord of the Gilded Hour, Saturnine Warden → Saturn Enthroned; Salt Sage: Brine Physician → Physician of the Last Salt, White Purifier → Sovereign of the Whitening) | Ash Reader (Athanor Keeper: Furnace Heart → The Living Athanor, Cinder Sage → Sage of the Last Ember; Vitriol Caster: Green Lion → The Devouring Lion, Magister of Solvents → Magister of Dissolution)
- **Bomb-wright** (engineer, ninja_peasant): Powder Sapper (Wall-breaker: Demolisher → Breaker of Walls, Fuse-master → Lord of the Long Fuse; Siege Chemist: Wildfire Brewer → Keeper of the Unquenchable, Thunderpot Gunner → Master of Thunder) | Smoke Dancer (Smokewalker: Vapour Knife → The Unseen Vapour, Fogbinder → Sovereign of Fog; Shrapnel Thrower: Shardslinger → Storm of Shards, Flare-wright → The Grand Pyrotechnist)
- **Elixir-brewer** (white_mage, doll): Apothecary (Tincturist: Panacean → Bearer of the Panacea, Plague Doctor → Doctor of the Black Year; Homunculist: Vatkeeper → Maker of the Little Folk, Galvanist → Lord of the Quickening Spark) | Draughtfist (Mutagenist: Chimera-blood → The Living Chimera, Wyrmblood Drinker → Wyrm Incarnate; Tonic Ascetic: Hasteblood → The Unslowed, Elixir Hermit → The Undying Hermit)

**knights**

- **Squire-at-Arms** (warrior, knight_1): Tourney Rider (Jouster: Champion of the Lists → King of the Tourney, Lance Breaker → The Shattering Lance; Hedge Knight: Questing Knight → Knight of the Long Road, Knight Disinherited → The Lord Returned) | Man-at-Arms (Halberdier: Pike Sergeant → Captain of the Square, Poleaxe Master → The Headsman; Banneret: Standard-Bearer → The Oriflamme, Liegeman → Hand of the Liege)
- **Herald** (bard, samurai_commander): Pursuivant (Blazoner: Keeper of the Rolls → King of Arms, Remembrancer → Voice of the Honoured Dead; Crier of the Lists: Master of the Lists → Lord of Tourneys, Trumpeter of the Van → The Last Trumpet) | Outrider (Liege's Courier: Hard Rider → Rider of the Last Message, Signal Archer → Arrow of Tidings; Envoy of the Order: Silver Tongue → Voice of Kings, Herald of Defiance → The Gauntlet Thrown)
- **Chaplain** (white_mage, wanderer_mage): Confessor (Vow-Warden: Keeper of Oaths → Saint of Vows, Flagellant → The Scourged Saint; Almoner: Hospitaller → Master of the Hospital, Mendicant → The Barefoot Saint) | War Chaplain (Relic Bearer: Grail Seeker → Keeper of the Grail, Reliquary Guard → Shield of the Relics; Militant Prior: Prior of the Sword → Abbot of Battles, Anointed Mace → Mace of Heaven)

**orcs**

- **Skull-taker** (hunter, hk_orc_grunt): Headchopper (Skullpiler: Trophy Lord → Lord of the Skull Mound, Bloodtusk → The Red Tusk; Axe-flinger: Axestorm → The Iron Rain, Skewerer → Impaler of Kings) | Skulker (Throat-cutter: Silent Tusk → The Green Shadow, Night-Skinner → Skinner of Kings; Trophy Hunter: Giant-Feller → Bane of Giants, Venomtusk → The Black Bile)
- **Warchanter** (bard, doll): War Drummer (Big Drum: Thunderdrum → The Drum That Shakes the World, Gongbasher → Herald of the Great Waaagh; Grogmaster: Feast-Lord → Lord of the Endless Feast, Brawl-Caller → King of the Pit) | Spirit-Howler (Bone-Seer: Skull-Speaker → Mouth of the Dead Horde, Storm-Spitter → Green Lightning; Warpaint Mystic: Bloodpainter → The Red Hand, Hexmaw → The Howling Hex)
- **Beast-rider** (beast_tamer, hk_orc_archer): Boar Rider (Tusk Charger: Boarlord → The Thundering Tusk, Gore-Lancer → Lance of the Horde; Plunder Rider: Road Reaver → Terror of the Roads, Thrall-Taker → Chainmaster of the Horde) | Beast-Breaker (Warg Keeper: Warg-Mother → Lord of a Thousand Fangs, Drake-Breaker → Rider of the Red Drake; Hide-Wearer: Bearskin → Great Bear of the Horde, Boarhide Brute → The Green Behemoth)

**mythic**

- **Pact-born** (summoner, hk_demon_lord): Summoner (Conjurer: Elementarch → Planeswalker, Voidbinder → Gatekeeper of the Void; Beastcaller: Drake Tamer → Dragon Caller, Lord of Hosts → King of the Wild Host) | Soulkeeper (Barrow Warden: Host of the Hollow Hills → King under the Barrow, Bell of the Drowned → The Tolling Deep; Caller of the High Lamps: Choir of Falling Stars → Herald of the Last Star, Moonwarden → The Moon's Own)
- **Dragon-blooded** (dragoon, hk_demon): Wyrm Lancer (Skyfall Knight: Knight of the Burning Sky → Lord of the Burning Sky, Drakeshield → The Unburnt Wall; Hoard-warden: Goldscale → Wyrm-King of the Hoard, Ember-tongue → Mouth of the Mountain) | Wyrmheart (Wyrmrage: Cinderwrath → Wrath of the Old Wyrm, Dragon-hearted → Heart of the Last Dragon; Wyrm-shepherd: Brood Keeper → Elder of the Brood, Wyrm-speaker → Voice of the Elder Wyrms)
- **Fate-touched** (chronomancer, gorgon_3): Seer of Threads (Thread-cutter: Unspinner → Last of the Fates, Weaver of Ends → The Loom Itself; Omen-reader: Voice of the Well → The Well at the World's Root, Foreteller → Speaker of the Unwritten) | Stone-eyed (Veiled Seer: Gaze of Stone → Keeper of the Stone Garden, Mirror-sighted → The Unlooked-at; Doom-sayer: Prophet of Ruin → The Last Prophecy, Unheeded → The One Who Was Right)
- **Twice-buried** (warrior, hk_tyrant): Grave-risen (Bone-oath: The Unburied → The Grave's Refusal, Coffin-breaker → Lord of the Broken Coffins; Ashen Revenant: Vengeance Unending → The Debt Never Paid, Ironbone Sentinel → The Wall That Will Not Fall) | Lich-born (Phylactery-keeper: Keeper of the Black Jar → The Jarred Heart, Ever-returning → Master of the Second Dawn; Grave-chill: Winter of Bones → The Long Winter Below, Bone-choir → Conductor of the Dead)
- **Doorborn** (spellblade, minotaur_3): Gatewright (Maze-runner: Heart of the Labyrinth → Lord of the Labyrinth, Corner-turner → The Wrong Turn; Rift-knight: Breaker of Seals → The Opened Sky, Warden of Thresholds → Keeper of Every Door) | Timeslipped (Hour-thief: Walker of Lost Days → The Day That Never Was, Echo of Tomorrow → Tomorrow's Shadow; Stranger from Elsewhere: Worldwalker → Walker of All Worlds, One Who Came Back → The Homecoming)

**wanderer road**

Druid (Archdruid: Green Sage → Heart of the Wood, Stormcaller → Voice of Thunder; Shapeshifter: Primal → Wild God, Manyform → The Thousand Shapes) | Spirit Wayfarer (Waymaker: Ley-tracer → Keeper of the Leylines, Pathfinder of the Old Ways → Walker of the First Road; Ancestor-speaker: Totem Keeper → The Standing Totem, Dreamhunter → Hunter in the Dream)
