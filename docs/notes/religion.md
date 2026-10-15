## Religion and the gods made real (the DLC)

Changes "Gods and faith" (sim/faith.ts and data/gods.ts are unchanged; this sits on top of them). Also touches "Town politics
and law" (a heresy trial), "Step 7, life's ceremonies" (the priest at funerals) and "Town alignment" (cruel and merciful rites).

- **The data** (`src/shared/data/religion.ts`): the `Creed` (a `Domain`, `'none'` or `'cult'`), the natures that keep faith
  hard (`ZEALOUS`), drift from it (`DOUBTING`) and turn heretic (`HERETICAL`), `ZEAL_START` per nature and `NONE_SHARE`;
  the numbers for followers, priests, feast days (`FEAST_DAYS` 3, 5, 7, 9 of each season, in `DOMAINS` order), each god's
  nature (`NATURE_ACTS`), omens (`OMEN_AT` -25, `OMENS`), the greater wraths (`GREAT_WRATH_AT` -60, `GREAT_WRATH_CHANCE` 0.3,
  `CURSED_ROTS`, `PLAGUE_SHARE`, `STORM_STRIKES`, `STORM_KILLS`), miracles (`MIRACLE_AT` 60, `MIRACLE_GAP_DAYS` 10,
  `SPARE_CHANCE`, `STORM_CHANCE`, `FAMINE_AT`, `UNSPARED`), the rival cult (`CULT_PEOPLE` 7, `CULT_CHANCE`, `CULT_RECRUIT`,
  `DENOUNCE_CHANCE`, `CULT_NAMES`, `ORIGIN_CULT`), the pilgrimage (`PILGRIM_EVERY_DAYS` 18, `HOLY_PLACES` per people,
  `PILGRIM_RELIC`), the diary lines (`FAITH_LINES`) and two buildings never in the building book (`RELIGION_BUILDINGS`:
  `god_idol`, `cult_altar`), merged into `BUILDINGS`.
- **The sim** (`src/shared/sim/religion.ts`, `religionHourly` and `religionTick` from sim.ts right after `faithHourly`;
  autopilot only; rolls from the side stream `${seed}:religion:${tick}:<what>`, never the town's; `s.religion`,
  `ReligionState`; `Person.creed` and `Person.zeal`, all optional):
  - **Creeds** (`creedOf`, kept from the first dawn; `pickCreed` is pure, by the seed and id: the god of what they're best
    at, or by chance, or none; a child takes a parent's; `seenCreed` for the menus, which never sets it). Each dawn zeal
    drifts `ZEAL_DRIFT` toward the nature's, a rite day lifts it `ZEAL_RITE`; the doubting low in zeal lapse
    (`LAPSE_CHANCE`), the godless may find the best pleased god (`CONVERT_CHANCE`). `isZealot`: zeal 80+ and a zealous nature.
  - **Favour at dawn** (`dawn`): every god asks `DEMAND_PER_HEAD` (0.6) a head a day, at most `DEMAND_MOST` (16), so a
    big town's neglected gods sour; followers add `FOLLOWER_FAVOUR` x zeal/50 each, a god nobody at home follows loses
    `UNFOLLOWED` (5) (the demand and that start only once there's a place of worship: before it, faith.ts's own `NEGLECT`
    is enough for a camp), idols add `IDOL_FAVOUR`, cultists cost every god `CULT_FAVOUR`, and `actsInNature`: the harvest god likes
    `harvestFullDays` of food and hates every starving mouth, the hearth god a happy town (and a glum one), the war god a raid
    driven off or pillaged (each `raidRecap` once), the sky god every party out. The rope angers the hearth god at once
    (`hearthHanging`, in `deathSeen`).
  - **The priests**: whoever holds a wayside shrine, temple or cathedral (new `OPERATORS` rows: Priest, High Priest,
    Social). At dawn (`FAITH_HOUR` for `PRIEST_HOURS`) the priest takes the new task `officiate` (people.ts, `priestDuty`,
    `altarSpot`; activity `pray`), and the least pleased god gets `PRIEST_RITE` + `PRIEST_PER_LEVEL` a Social level
    (`priestRite`). A god's feast day kept with a priest (`feastDay`): `FEAST_KEPT`, food from its offerings laid out, a
    morale mark; the war god's feast in a blood town (`BLOOD_RITES`: vampires, orcs, liches) is a blood offering
    (`alignPush` -2, `orderPush` +1), the hearth god's gives alms to the poor (`alignPush` +1). Without a priest it passes
    unkept (`FEAST_MISSED`; never in a camp with no altar). The priest says the words at a funeral (`funeralRites`: grief x `FUNERAL_RITES_EASE`), blesses
    the defenders when raiders are sighted (`blessRaid`: a `fight` mark `RAID_BLESSING`, more with the war god pleased, to the
    raid's end) and every party setting out (`blessTrips`: a lift `ROAD_BLESSING`).
  - **Omens and the greater wraths**: a god at `OMEN_AT` sends an omen ("An omen: ...", every `OMEN_GAP_DAYS`); only after
    one, at `GREAT_WRATH_AT`, its greater wrath (`greatWrath`; neither in a camp under `GREAT_WRATH_PEOPLE` (5), and the
    harvest god's never on a town already starving): the harvest god curses the harvest (`CURSED_ROTS` of the food in
    store above `CURSE_SPARES_DAYS` of it, crops x0.5 three days), the hearth god sends a plague (`PLAGUE_SHARE` sicken, the frailest dies), the war
    god sends wolves (a raid, `raidBudget`), the sky god a great storm (`STORM_STRIKES` bolts: roofs fired, people burned or
    killed). It spends `GREAT_WRATH_SPENDS`; the god's followers lose `ZEAL_WRATH` and `SCHISM_SHARE` of them turn to the
    best pleased god (a schism).
  - **Miracles** (`miracle`; one in `MIRACLE_GAP_DAYS`): a hearth god at `MIRACLE_AT` may spare someone dying in town
    (`deathSeen`, hooked in `killPerson` after the phoenix feather; never old age, the rope, exile or a sacrifice:
    `UNSPARED`); a sky god may scatter a raid on its way with a storm (`STORM_SCATTERS` of the raiders gone, the rest hurt;
    a line added to the raid's recap story via `recapNote`); a harvest god at `FAMINE_AT` may fill a starving town's granary
    (`famineBroken`, `FAMINE_DAYS` of grain). Each is a key notice (the news bubble), a sign, converts the godless
    (`MIRACLE_CONVERTS`), and raises an idol (`raiseIdol`, at most `IDOLS_MOST`). The year's chronicle names them
    (`religionYearLines` in annals.ts).
  - **The rival cult** (`cultDawn`): with `CULT_PEOPLE` grown-ups, `CULT_CHANCE` a day (more as gods sour), a heretical
    soul low in zeal and spirits founds the cult of a name (`ORIGIN_CULT` or `CULT_NAMES`); its black altar is set up
    (`cult_altar`); the town is asked (a `ways` prompt, system `religion`, answered by `answerReligion` through heritage.ts):
    root it out (a heresy trial for its leader, `orderPush` +2), let it be (`tolerated`), or hear it out (every god -8, some
    join, `alignPush` -1, `orderPush` -3). It recruits the low (`CULT_RECRUIT`); zealots denounce its members
    (`DENOUNCE_CHANCE`, a heresy trial); every `CULT_RITE_DAYS` at 23:00 its dark rite (`cultNight`: every god -3,
    `alignPush` -3, `orderPush` -2), with three or more a chance of a sacrifice (a townsperson killed, then their leader
    tried for murder). With no members left it ends and its altar comes down.
  - **The heresy trial** (sim/politics.ts `trial`, data/politics.ts `CrimeKind` gains `'heresy'`, never rolled as a crime):
    pardon, the stocks, exile or the rope; its own telling.
  - **Pilgrimage** (`pilgrimage`, at 09:00): once a temple or cathedral stands and the town has `PILGRIM_PEOPLE`, every
    `PILGRIM_EVERY_DAYS` the priest leads the most zealous (`PILGRIM_PARTY`) to the people's holy place (`pilgrimDestination`,
    id `pilgrim:<origin>`, a gather trip with bandits on the road; expeditions.ts `destinationOf`). Home (`pilgrimHome`,
    from expeditions.ts): every god `PILGRIM_FAVOUR`, the pilgrims' zeal and spirits up, `PILGRIM_RELIC` a Phoenix Feather.
- **Words**: the diary has a line on their faith (`faithDiaryLine`, `DiaryFacts.faith`); the town's talk reads miracles,
  heresy trials, the cult, converts, the wraths and the pilgrims (new `GossipKind`s and their sayings and replies).
- **Seen**: `snapshot.religion` (`ReligionView`) and `PersonView.creed` ("Follows Ceres (a zealot)", on the person's page).
  The Town menu's Faith tab (`panel/faithPanel.ts`): each god's card has its followers and feast day (tap: more); new
  sections **The faithful** (the priests, the godless and zealots, the cult, the pilgrims, the latest of the faith's news)
  and **Miracles** (both in `GROUPS`). `faithKey` joins the Town panel's redraw key (the Faith tab never redrew before).
- **Art**: the idol is the Forest Objects pack's idol tree (`art/packs/tree_idol.png`), also the druids' and the fae's
  wayside shrine; the cult's altar the Cave Objects pack's horned totem (`art/packs/cult_totem.png`). CREDITS.md.
- Tests: `test/religion.test.ts`.
