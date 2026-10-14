# The monster ranch, and tournaments in the arena

Two DLC-sized features (the owner's asks). Both run only with the autopilot on, use their own side streams
(`${seed}:ranch:...`, `${seed}:arena:...`), and keep their state in new optional fields (`s.ranch`, `s.arena`): no save
version bump.

## The monster ranch

`src/shared/data/ranch.ts` (numbers, traits, names) and `src/shared/sim/ranch.ts` (rules). `s.ranch` (`RanchState`:
`beasts`, counts of `bred`, `sold`, `died`, `lost`, a `log`).

- **Where beasts come from:** a beast a Beast Tamer won over (data/taming.ts) and still standing when the raid ends is
  brought home (`ranchRaidOver`, from raids.ts `endRaid`); with a ranch standing and a Beastmaster (or a Beast Tamer)
  at home, a beast left down on the field may be roped and brought in (`CATCH_DOWNED`). No bosses.
- **The building:** the Beast Ranch (`RANCH_BUILDING`, 4x3, Domestication, merged into BUILDINGS; in the planner's
  `NEVER` and the castle's `OUTSIDE`). The town lays one itself (`buildRanch`) once it holds a beast (or has a Beast
  Tamer) and `RANCH_PEOPLE` grown-ups, or at `RANCH_PEOPLE_UNASKED` (6) with none, for its Beastmaster to catch beasts, and a second (`RANCHES_MOST`) when the first is full. Each holds `RANCH_ROOM`
  (6); without one the town keeps `LOOSE_ROOM` (2) tethered by the fire. Pack picture: the Village pack's awning as a
  shelter, the Fields pack's rails, the Medieval Field Work pack's hay, a bucket for the trough (`PICKS.beast_ranch`).
- **The Beastmaster:** an operator role (`OPERATORS.beast_ranch`, skill Animals). Trains every beast each morning
  (`TRAIN_XP`, more by Animals and the Gentle trait; levels to `BEAST_LEVEL_MOST`, each `PER_LEVEL` stronger), tends
  the sick (`TEND_CURE`), mends the hurt faster and catches beasts on the field. Breeding and training count as the
  deed `beasts` (titles Friend of Beasts, Beastmaster, Lord of the Menagerie).
- **The morning** (`ranchHourly` at `RANCH_HOUR` 7; jobs are set afresh every hour): fed from the stores (`feedOf` by
  tier; grazers (`GRAZERS`) grain and greens first, the rest meat and fish; `HUNGRY_FLEE` days unfed and it breaks out);
  mending, old age (`lifespanOf` by tier, old from `OLD_SHARE`, `OLD_DEATH`), sickness (`SICK_*`: more when hungry or
  crowded; deadly untended); breeding (a grown, fed male and female of one kind: `BREED_DAILY`; the cub takes each
  parent's trait at `INHERIT`, a new one at `MUTATE`, up to `TRAITS_MOST`; `gen` counts the generations); the work's
  haul; and selling (over room, or the stores under `SELL_FOOD_DAYS` of food, the least worth first; the old at 90% of
  their span for half; ledger line `ranch`).
- **Traits** (`BEAST_TRAITS`): strong, hardy, swift, fierce, keen-nosed, gentle, fertile, long-lived, and the bad ones
  sickly and skittish, each a multiplier on blows, health, the hunt, the haul, training, breeding, lifespan or sickness.
- **Jobs** (`setJobs`): a rideable beast (`RIDEABLE`, tier 1.5 or more) becomes a mount for a fighter (guards first);
  the fiercest meat-eaters guard (a third of the herd, every Fierce one) and fight beside the town in every raid
  (`ranchAllies`, from `startRaid`; `Raider.ranch`; struck down, it's hurt, or dies at 25%); the rest hunt (meat, a
  hide now and then, `HUNT_HURT`) or, grazers, haul (wood or stone). A rider strikes harder in raids (`mountFight`, in
  raids.ts `defenderAttack` and the mages' fire beside `guildFight`: `rideFight` by the mount's tier).
- **The player:** the `ranch` command: `op: 'name'` (any name up to 24 letters; `named`) or `op: 'keep'` (never sold).
- **Seen:** `snapshot.ranch` (`RanchView`) on the Market menu's **Ranch** tab (`panel/ranchPanel.ts`: a card a beast,
  health bar, traits as chips (the bad ones red), tapped: where it came from, its parents and generation, lifespan, diet,
  level, arena record, worth, a name box, Keep / Allow its sale). `snapshot.ranchPens` (`beastHome`: each beast's pen
  rectangle in world px) drives `ranchFigures` in main.ts: a third `MapRaiders` (`penned`) draws each beast from its
  creature sheet ambling between spots in its pen (by its id and the clock, `PEN_STEP_MS`).

## Tournaments and the arena

`src/shared/data/arena.ts` and `src/shared/sim/arena.ts`. `s.arena` (`ArenaState`: the season, its `ladder`, the
`card`, the `bout`, `past` bouts, `champions`, `renown`, who `rested` when).

- **The building:** the Arena (`ARENA_BUILDING`, 5x4, Spear Hunting), laid by the town itself (`buildArena`) at
  `ARENA_PEOPLE` (7) grown-ups with half as much again of its makings in store. Its job is the Arena Master
  (`OPERATORS.arena`, Social: a bigger gate). Pack picture: a ring of the Village pack's palisade stakes round trodden
  sand, logs for benches, a weapon rack, lanterns and the sword sign at the gate.
- **The season** (`arenaHourly`): the first `SEASON_DAYS` (6) days of spring, summer and autumn. At `CARD_HOUR` (noon)
  a bout is posted (`postCard`): every other day a grown, fit ranch beast if there is one, else one of the town's
  fighters (rested `REST_DAYS`, fit, at home; never the founder; the keenest by level, ambition and skill), against a
  visiting champion: a troop of a power the town knows (its raid kind's non-beast foes, named "Varn the Red of The Red
  Brotherhood") or a wanderer of the road (`WANDERERS`); a beast against a beast-keeper's beast of a near tier. The
  visitor is scaled to `MATCH_LEAST`..`MATCH_MOST` of the town fighter's might, so bouts are close. Not on a knights'
  tournament day.
- **The book:** the odds from the match (`odds`, paid less `HOUSE_CUT`, `PAYS_LEAST`..`PAYS_MOST`). Townsfolk bet as
  the card goes up (`townsfolkBet`: by nature, `BET_LEAN`; a share of their purse over `BET_KEEP`; most back the town,
  the greedy the favourite). The player bets from the treasury until the bout (`arenaBet`, the `arenaBet` command:
  `PLAYER_BETS` steps, replacing any bet, 0 takes it back). A bout called off returns every bet.
- **The bout** (`startBout` at `BOUT_HOUR` 17): shaped as a trip (`e.dest` `arena:<id>`, `arenaDestination`, scenery
  `arena` → the ruins scene), fought by the expeditions' turn-based fight (`startBattle`/`stepBattle`, the beast as a
  party fighter, `beastFighter`). The fighter is away in the ring (`ARENA_AWAY`; the snapshot says "the arena").
  Watchable: `s.watching` the bout's id (ids from `BOUT_IDS`, apart from the town's own), found by `arenaTrip` in the
  watch command, the snapshot's `watch`, `fightOn` and `fightOnScreen`. Each side yields under `YIELD`; only one struck
  down outright may die (`ARENA_DEATH`, `BEAST_DEATH`, `VISITOR_DEATH`), so deaths are real but rare.
- **The end** (`endBout`): harm and wounds carried back, experience (melee or ranged by the blows), the victory window
  (`e.result`, kept `BOUT_LINGER` ticks), purses (`PURSE`, `LOSER_PURSE`; a beast's to the treasury), the deed `bouts`
  (titles the Brawler, Gladiator, Champion of the Sand), the book settled, the gate (`GATE_BASE` + a grown-up's share,
  the Arena Master's Social, renown; ledger line `arena`), renown (`RENOWN_WIN`/`RENOWN_LOSS` up to `RENOWN_MOST`, added
  to every venue's attractiveness in shop.ts, fading out of season), travellers drawn in for the evening, and the ladder
  (`WIN_POINTS`, `KO_POINTS`). The season's last bout is the final: `crown` gives the top of the ladder the crown (a
  townsperson the title Champion of the Arena and `CROWN_PRIZE`; a beast a crown on its record; a visitor takes it
  home), told in the event box.
- **The knights' tournament** (sim/chivalry.ts `tourney`) is not duplicated: its jousts count on the arena's ladder and
  fill its gate when the town has an arena (`noteJousts`).
- **Seen:** `snapshot.arena` (`ArenaView`) on the People menu's **Arena** tab (`panel/arenaPanel.ts`: the season and
  renown; the bout under way with Watch; tonight's card with the odds, the townsfolk's bets and the treasury's bet
  buttons; the Standings table; past bouts; the champions). The news bubble has a gold notice for the card (to the
  Arena tab) and for the bout under way (Watch).

## Balance

- The planner's research scoring gives +4 a building a topic opens; the ranch and the arena are left out of it
  (`SELF_BUILT` in planner.ts), so towns study as before. Soak (25 days, settlers twice, knights, druids, werewolves,
  orcs): every town that never built either plays out to the person as on main; the orc town built both and ran its
  bouts with the same people and deaths as on main.

## Fixed on the way

- The roaming bands' map view (`roamers` in main.ts) was updated every snapshot but never rendered, so bands on the land
  were never drawn; `roamers.render` (and the ranch's `penned.render`) are now called each frame.

Tests: `test/ranch.test.ts`, `test/arena.test.ts`.
