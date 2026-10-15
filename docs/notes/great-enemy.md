## The Great Enemy (the owner's ask: one slow-building villain a town, a long arc for a game meant to last months)

- **The data** (`src/shared/data/greatEnemy.ts`): six Enemies (`GREAT_ENEMIES`, `EnemyKind`), each a person-like foe with
  a name, a seat on the world map (`SEAT_SPOTS`), a goal, a way of fighting, three lieutenants (`Lieutenant`: an enemy
  id, a name, the outpost it holds and its guard), an army (`GREAT_ENEMY_RAIDS`, merged into RAID_KINDS, weight 0: never
  rolled), a seat guard, omens, dreams, a stranger's warning, travellers lost, its agents' disguise, each stage's
  telling, its tribute demand, a picture, a backdrop, a colour for the world map, and a relic:
  - **tower**: Malgrith the Tower Lord, the Black Tower of Vorn (storm-mages, fallen knights, demons; Isolde the Ember
    Witch, Gorrath the Gate Warden, the Black Seneschal).
  - **brood**: Sarnath, Mother of Wyrms, the Smoking Peaks (drakes and wyrmlings; Vyrax the Drake Lord, the Wyrm
    Priest, Ossk, Warden of the Clutch).
  - **plague**: the Pale Prophet, the Bell Fen (the risen flock, plague rats, cultists; the Rat Mother, Old Toller the
    Bell Ringer, the Mourner).
  - **engine**: the Engine Mind, the Clockwork Deep (golems, sentries, drones; Unit Foreman, Blade Unit Seven, Gunner
    Prime).
  - **drowned**: the Drowned King, the Sunken Throne (drowned sailors, squid-kin, coral golems; Admiral Kell, the Tide
    Witch, the Deep Maw). A shore town's only (`enemyFit`: the coast biome or a sea town).
  - **undying**: Kharzul the Undying, the Field of Spears (bone legions, death knights, wraith archers; the Bone Marshal,
    Ser Hollow, the Gravecaller).
  The 24 foes (`GREAT_ENEMY_FOES`, merged into ENEMIES): the Enemies 1500 to 1800 health (deadlier than the Calamity's
  avatars), their lieutenants 540 to 780, every one a boss with a kit; all drawn from pack sheets already in the game
  (`packSheets.ts`: lightning_mage, wyvern, ninja_monk, robot_destroyer, pirate_zombie, samurai_commander for the
  Enemies; fire_wizard, hk_demon, knight_3, drakes, shaman_king, the DawnLike drakes and sea dragon, gorgon_2,
  hk_zombie_brute, hk_mummy, hk_juggernaut, robot_swordsman, robot_infantry, pirate_leader, squidman, skeleton_spearman,
  knight_2, champ_necromancer for the lieutenants), recoloured by `look`. No new sprite was copied in. Relics
  (`GREAT_ENEMY_TROPHIES`, merged into ITEMS: the Iron Crown of Vorn, the Heart of the Brood, the Bell of Stillness, the
  Engine Core, the Coral Crown, Kharzul's Banner); unique weapons (`GREAT_ENEMY_UNIQUES`, folded into data/uniques.ts'
  rows: one each Enemy, one shared by its three lieutenants). The **Victory Monument** (`MONUMENT_BUILDING`,
  `victory_monument`, in BUILDINGS; the planner's `NEVER`; drawn with the cave statue in map/packBuildings.ts).
- **Choosing** (`sim/greatEnemy.ts`): on day `ENEMY_CHOSEN_DAY` (2) at `ENEMY_HOUR` (9), `chooseEnemy` draws a kind
  weighted by `enemyFit(kind, biome, origin, shore, calamity)` from its own side stream (`${seed}:enemy:kind`). The
  drowned king only by the sea; the brood in the high, cold and burnt lands; the plague cult in fens, jungle and forest;
  the engine mind for the machines, alchemists and dwarves and in the wastes; the undying on the steppe and ashlands.
  Never a second dark lord or rot beside the town's Calamity (the tyrant halves the tower and all but rules out the
  undying; the rot rules out the plague), and seldom the undying for a lich town.
- **The arc** (`s.greatEnemy`, `GreatEnemyState`; `greatEnemyHourly` from sim.ts after the Calamity): each morning its
  **plan** grows by `pace / DANGER_PACE`, a paced day (`paceDay`), and the stages come at `PLAN_AT` (omens 5, stirring
  15, march 32, siege 52 paced days: with nothing for or against it, game days 13, 38, 80 and 130; at about two and a
  half game days a real day of play, about 5, 15, 32 and 52 real days). `paceToday`: 1, plus `OUTPOST_HASTE` (0.2) for
  each outpost still standing (ignoring it speeds it), less `COUNTER_TOPICS` for each known (scouting, writing,
  fortification, oral tradition, physick) and `FAITH_SLOW` when the gods' favour sums past `FAITH_FAVOUR` with a shrine,
  temple or cathedral standing; held between `PACE_LEAST` and `PACE_MOST`.
  - **Omens**: an omen on a night (`OMEN_NIGHTLY` at `OMEN_HOUR`, a morale chill), and with it a dream (`e.dream`) that
    about half the town writes in their diaries the next day (sim/diary.ts `dreamOf`, "Last night I dreamed..."); a
    traveller lost now and then (`MISSING_DAILY`); a stranger's warning once (`WARNING_DAILY`, a told prompt), which
    reveals the seat; else the scouts find it (`SEAT_FOUND_DAILY`, more with Scouting and each mapped region).
  - **Stirring**: the seat is found if it wasn't; its three outposts go on the board (`enemy:<kind>:out<i>`); its blight
    creeps onto the town's land (`e.creep`, a cell at the land's edge toward its seat, `CREEP_PER_DAY` up to
    `CREEP_MOST`, a source in sim/blight.ts `blightSources`: fields grow slower, ward stones keep it off); its agents
    among the visitors (`AGENT_DAILY`: a fire, a theft or a killing, unless the watch unmasks them, more often with
    guards); raids bearing its mark (`MARK_CHANCE`, its army in place of a raid due within a day, `Raid.enemy` 'mark');
    every `FALL_EVERY_DAYS` a power of the realm falls to it (`powerFalls`, up to `POWERS_FALL_MOST`: an ally of the town
    razed, any other at war with the town at -100, `e.thralls`; freed at the peace); the Monster Hunters' Guild posts a
    purse on each lieutenant (`GUILD_PURSE`, into `s.bounties`, so the parties are drawn and paid by the usual bounty).
  - **The march**: every `HOST_EVERY_DAYS` a living lieutenant leads a host (`startRaid` with `host`: `HOST_SHARE` of the
    raid budget, up to `HOST_MOST`, a siege engine from the Medieval age, the lieutenant at its head: `Raid.enemy`
    'host', `enemyLt`); every `TRIBUTE_EVERY_DAYS` it demands tribute (a prompt of kind `enemy`, `answerEnemy` from
    roadEvents.ts: `tributeOf`, half as much again each time; paid, the plan slips `TRIBUTE_SETBACK`; refused, it hastens
    `REFUSED_HASTE` and a host comes the next morning; left unanswered, the town pays only if it holds twice the sum).
  - **The last siege**: warned `SIEGE_WARNING_HOURS` (36) ahead, then `startSiege`: its army at `SIEGE_SHARE` of the
    budget (more for each living lieutenant), up to `SIEGE_SIZE` plus `SIEGE_PER_LIEUTENANT`, two siege engines, the
    Enemy at its head and its living lieutenants beside it (`Raid.enemy` 'siege'). `greatEnemyRaidOver` (from raids.ts
    `endRaid`): any lieutenant down in one of its raids is slain; the Enemy down is the **peace** (`victory`: stage
    `peace`, its relic in the stores, the monument raised at once (or a blueprint over the wild), the town titled "the
    Bane of ..." and its hardest hitter (the raid's tally, else the best fighter) given "...'s Bane", the thralls freed,
    the blight gone, `PEACE_MORALE` for `PEACE_DAYS`; the town goes on). Lost, it is a sack: `SIEGE_BURN` buildings
    burn, `SACK_SLAIN` of the townsfolk are cut down (never the founder), the plan falls back to `SIEGE_REGROUP` short;
    the `SIEGES_TO_FALL`th (second) lost is the end of the town (`s.gameOver`, stage `fallen`).
- **The town fights back**: `PULL_OUTPOST` draws the town's own parties to the outposts (sim/parties.ts `pull`), never
  to the seat (`choosable` leaves `isEnemySeat` out: that's for the player's expeditions). An outpost cleared
  (`enemyPlaceCleared`, from sim/expeditions.ts as a place is cleared) slays its lieutenant (`slayLieutenant`:
  `LIEUTENANT_SETBACK` paced days off the plan, a morale lift, a scene). The seat (`enemy:<kind>:seat`, `seatOpen` once
  found, quiet `SEAT_QUIET_DAYS` after a strike) holds its seat guard doubled while a lieutenant lives (a win sets the
  plan back `SEAT_SETBACK`), and the Enemy itself once they are all dead (a win there is the peace, early).
- **Legends across towns**: simHost.ts puts `enemyLegend` on the legend as a town ends (`Legend & { enemy }`: its kind,
  name and fate), and a descendant's town whose forebears it broke meets the same Enemy (`inheritEnemy`:
  `e.vengeance`, told at the omens). The Hall of Legends card says who slew or broke the town (legendsPanel.ts).
- **Seen**: the Trips tab's Out now has **The Great Enemy** (expeditionsPanel.ts `greatEnemySection`, in `GROUPS`): its
  stage, the plan as a bar toward the siege, what's next and when, the latest omen, its lieutenants, the powers fallen
  to it, More (goal, way, seat, pace, sieges lost, title, slayer, the story so far, the arc), and its places' cards. The
  world map (worldMapView.ts) shows its seat once found (☠, tap to pick it when open), its outposts (⚑, ✕ slain) and its
  shadow spreading from the seat as the plan grows (`.map-spread`, its colour). A Town overview tile; the news bubble's
  standing notice from the stirring (red from the march, the siege's count-down) and its lines' tones (notices.ts); the
  yearly chronicle tells its turns (annals.ts, from `e.log`). Eight scenes (`data/greatEnemyScenes.ts`, merged into
  CUTSCENES: `enemy_omens`, `enemy_stirring`, `enemy_march`, `enemy_siege`, `enemy_lieutenant`, `enemy_victory`,
  `enemy_repelled`, `enemy_fallen`), the Enemy cast as `foe:{enemy}`.
- **Previews**: `__enemy(stage, kind)` in the phone page's console (mobileBridge.ts, simHost.ts `DEBUG`, `forceEnemy`)
  brings it straight to omens, stirring, march or the siege (which comes within the hour).
- Only with the autopilot on; every roll is its own side stream (`${seed}:enemy:...`). Optional state (`s.greatEnemy`,
  `Raid.enemy`, `Raid.enemyLt`); an older save's Enemy is chosen on its next morning and starts from nothing. Tests:
  `test/greatEnemy.test.ts`.
