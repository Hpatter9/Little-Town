## Seasons of war with the realm (claude/seasons-of-war; the owner's ask: the Conquest reworked for a hands-off town)

Changes HISTORY "The Conquest update" (its manual half removed, its world turned back on), "The realm" (envoys answered
by the town's council, hosts by the season, the Realm's buttons gone), "The living world map" (wars keep the seasons
and take provinces) and "Memory in the town" (war memorials). The rules are in `src/shared/sim/war/` and the numbers in
`src/shared/data/war.ts`; state `GameState.war` (`WarState`, optional; an older save is given one, and a world, when
first wanted). Only with the autopilot on; the dice are the war's own side stream (`warRng`:
`${seed}:war:${tick}:<salt>`), never the town's. Tests: `test/seasonsOfWar.test.ts`.

- **The call on the old conquest.** `CONQUEST.on` is **true** again, for what remains: the world of provinces
  (`sim/conquest/world.ts`, `conquest.ts`, trimmed: the old armies' fields are kept optional for older saves and never
  read), its painted map (`panel/warMap.ts`, `art/warTerrain.ts`, `art/warSprites.ts`), the powers' border marches
  (`sim/conquest/rivals.ts`: now only in the marching seasons; a town province's defence is a share of the town's might,
  `TOWN_LAND_GUARD`, more under Defence, `DEFENCE_GUARD`; `powersOnMap` takes in powers that came to hold land
  later), the win by every province held by the town or a friend (`checkConquestWin`), and the New Town page for how
  many realms share the world. **Deleted**, as manual controls a self-running town has no use for: the town's armies,
  squads, troop training, province battles, captives and march reports (`sim/conquest/armies.ts`, `squads.ts`,
  `battles.ts`, `marches.ts`, `warView.ts`, `panel/warBoard.ts`, the `conquest` command) with their four test files
  (`conquestArmies`, `conquestBattles`, `conquestMarches`, `conquestSquads`), and `test/conquestOff.test.ts` (it
  checked the feature was parked; its successor is the first test in seasonsOfWar.test.ts). The training grounds
  (`data/training.ts`) are never built. The data of `data/troops.ts` stays (the map's figures and the border marches'
  numbers).
- **The seasons** (`warSeason`, `SEASON_OF_WAR`): spring and summer `march`, autumn `harvest`, winter `hold`.
  - Hosts against the town (sim/factions.ts `factionsDaily`, by `hostOdds`): the chance x`MARCH_HOSTS` (1.6) in the
    marching seasons (reached between paced days `MARCH_RAMP_FROM` 6 and 16, `MARCH_RAMP_DAYS`, so a young town's first
    spring is as before), x`HARVEST_HOSTS` (0.8) in autumn (and a harvest host, `hostMustered`: half the size, no engines), none in winter, none from a power
    occupying the town. Drawn as before, so the town's dice keep their order. The rivals' ordinary raids lean the same
    way (`rivalRaidOdds` x1.4 in autumn, x0.6 in winter).
  - Wars between powers (`s.feuds`, sim/worldLife.ts): begin on `WAR_START_PLOT` (14) mornings in a hundred in autumn
    and winter, a third of that in the marching seasons (`OFF_SEASON`); end on `WAR_END_WINTER` (16) in winter, a third
    of it otherwise; up to `FEUDS_MOST` 3 at once.
- **Strikes** (`sim/war/strikes.ts`, from worldLife's realm hour): each war strikes at most every `STRIKE_GAP_DAYS` (3),
  none in winter. A strike is a `Campaign` (`s.war.campaigns`) and a `feud` march on the world map (`March.camp`). In
  the marching seasons it is aimed at a province (`strikeTarget`: one beside the attacker's land, the capital only when
  it is the last); won, the province is the attacker's (`takeProvince`), and a power whose last province falls has
  fallen (`powerFalls`: stance `destroyed`, its folk scattered, a share to the victor, `s.war.fallen`), a landless
  rising power or the old house taking up its seat. A rising power met holds no land until it raises its banners over
  free land far from the town (`claimSeat`, daily). In autumn a strike is a harvest raid (`harvestLoss`: `HARVEST_LOSS`
  of the loser's folk, half of it of its troops, no province). The loser's deserters may make for the town
  (`DESERT_CHANCE` 0.12, doubled against a power the town marched on; never to a town under `DESERT_TOWN_LEAST` 5
  grown-ups, one band every `DESERT_GAP_HOURS` 96 at most): a band of `DESERT_SHARE` of its troops (2 to `DESERT_MOST` 7,
  never more than half the town's grown-ups) of its people, no lord, `DESERT_HOURS` later (`desertersHourly`).
- **Called to arms** (`sim/war/campaigns.ts`): a power the town is allied with (or at peace or trading with at
  `CALL_WARMTH` 25), one at war with a power the town is at war with (`COMMON_FOE_WARMTH` -20), or any not at war with
  the town that it thinks `CALL_PREFER` (15) better of than its foe (down to `CALL_COLDEST` -25) may call the town to its
  strike (`callTown`, one call every `CALL_GAP_DAYS` 6; needs `FIGHTERS_LEAST` grown-ups the town could field, `fighters`;
  a call blocked by another envoy at the gate is tried again each hour for `CALL_RETRY_HOURS`): an envoy `campaign`
  (`Prompt.envoy.camp`) asking for a levy (`levyFor`: a grown-up in `LEVY_PER` 4, 3 to 8): march, send `CAMPAIGN_COIN`
  (40) instead, or stay out. The strike waits on the answer and on the party (`strikeWaits`). Marching, the campaign is
  a destination, `assault:campaign:<id>`, fought as an assault (sim/factions.ts hooks: `assaultTargets` +
  `openCampaigns`, `assaultWaves` -> `campaignWaves`: the foe's troops in waves of about `CAMPAIGN_WAVE_TROOPS`, at most
  `CAMPAIGN_WAVES_MOST` 4, its toughest troop as captain last; `leviesFor` -> `campaignLevies`: the ally's own host
  `ALLY_HOST` 5-9 beside the party; `assaultDestination`, `assaultOver` -> `campaignOver`). The council raises the
  party itself (`sendParty`: the fittest, never the founder, half the grown-ups home), unless the player raises one
  from the War tab or the muster first (noted by `campaignsHourly`). Won: spoils (`SPOILS_PER_TROOP` of the foe's
  troops, at least `SPOILS_LEAST`, times the people's `spoils`, 0.6 of it beside an ally, half for a harvest raid) and
  a load of its goods (or grain), the foe's troops cut, the ally warmer, a deed `campaigns` for each who came home
  (`DEED_TITLES`: the Veteran, Warhorse, Marshal of the Realm; beside the night watch's `watched`), the victory feast, morale; the ally's strike carried.
  Lost: grief (morale). The recap is `s.war.recap`.
- **The council** (`sim/war/council.ts`): every envoy carries its pick as `Prompt.recommended` and `why`, and as the
  default (`warAdvice`, from `envoy`; only with the autopilot on, so the realm's own tests keep their defaults).
  `callScore`: the people's lean (`WAR_WAYS[origin].join`), an alliance +3, a just cause (the foe at war with the town,
  hating it, a warmonger or oathbreaker; doubled for a `just` people, who stay out without one), the profit (an easy
  war, plunder for the wicked), the direction (Defence +1, Growth -2, Trade -2 or -1, Knowledge -1), friends on both
  sides, too few fit to fight (`FIGHTERS_LEAST`) or too strong a foe; at `JOIN_AT` (2) it marches, else coin (rich,
  allied or peaceful) or stays out. Demands (`adviseDemand`): a `proud` people pays only a power `PROUD_BOWS` (2)
  times the town's might; much the weaker
  (x1.4), or Growth/Trade at x0.9, pays; the wicked or the warband answer a weaker power with war; Knowledge talks the
  sum down to `TALKED_DOWN` (0.6). Yielding (`adviseYield`): at `YIELD_AT` (2.6) times the town's might (x1.4 under
  Defence, x0.8 under Growth/Trade), sooner with a siege lost already, never for the proud. Peace, trade, alliances,
  marriages, surrenders and the conquered by direction and alignment. **The council's own doings** (`councilDaily`):
  Growth and Trade (not a proud people) send a gift a day to one power at war with the town (each every
  `PEACE_GIFT_EVERY_DAYS`, while the treasury holds `PEACE_TREASURY` times it) and take peace when they will; Knowledge (and Defence, for alliances) seeks treaties
  where the goodwill is, and in winter brokers peace between two friends at war (`BROKER_CHANCE`); the wicked (or the
  warband) break a treaty in winter with a power `BREAK_STRONGER` weaker and `BREAK_RICH_FOLK` rich (alignment and
  order down), and in the marching seasons take the war to a weaker power (`townCampaign`: won, the province is the
  town's); the nomads ride out on autumn harvest raids (`NOMAD_RAID_CHANCE`); the machines sell arms to both sides of
  every war, `ARMS_COINS` a war a marching season. The orcs' joining spends fury (`s.horde`), the knights' just wars
  raise the Order's honour (`s.order`). The Realm's buttons (gifts, treaties, war, demands) are gone: each power's card
  says what the council would do (`FactionView.council`, `councilLine`); storming a stronghold stays (an expedition).
- **War comes home** (`sim/war/siege.ts`): a spring or summer host of a power `SIEGE_STRONG` (1.5) times the town's
  might that has sent a host before may be a siege (`SIEGE_CHANCE` 0.35: `SIEGE_BIGGER` x1.3, half again the engines,
  `w.siege`), and asks the town to yield first (an envoy `yield`, `siegeHourly`). Yielded: **occupied**
  (`w.occupation`): a garrison (`GARRISON_SHARE` of the host, to `GARRISON_MOST` 14), at peace with the occupier, no
  host from it; each morning (`occupationDaily`) `OCCUPY_TAX` of the treasury over its keep and `OCCUPY_FOOD` of the
  food in store taken; the resistance grows (`RESIST_BASE` 6, +3 Defence, +2 a good town, +4 a proud people, +6 a
  wandering camp, less `RESIST_PER_GARRISON` a soldier, at least `RESIST_LEAST` 2); at 100 the town **rises** (the
  garrison as a raid begun inside the town, `startRaid` with `inside`): broken, the town is free (war with the occupier,
  the title the Liberator, the feast of liberation); else the rising is crushed (`RISING_HANGED` 2 hanged, the garrison
  +2, the resistance from nothing). An ally at war with the occupier frees the town on `ALLY_FREES` of the marching
  mornings; after `OCCUPY_DAYS_MOST` (15) the occupier, paid, marches off. Stood: held when the host breaks or
  `SIEGE_LOST_FELL` (0.35) of it falls (the Siege-breaker title, morale); else **lost**: the sack (`SACK_BURN` fires,
  `SACK_SLAIN` of those in the streets cut down) and the occupation; `SIEGES_TO_FALL` (2) sieges lost to the realm's
  powers end the town (the Great Enemy's rule, its own count kept apart). Hook: `siegeOver` from `hostOver`. A siege
  host's raid is `Raid.warSiege` and is fought out as the Enemy's last siege is (sim/tactics.ts: no clock while the field
  is held, at most `SIEGE_MAX_HOURS`). The resistance grows at least `RESIST_LEAST` (2) a day.
- **Memory** (`sim/war/memory.ts`): a death on a campaign, at the walls against a power's host, in the sack or on the
  gallows (`warFallen`, from annals.ts `recordFallen`) is one of the war dead (`w.dead`, `WAR_DEAD_MOST`); the partner
  is a war widow, the children war orphans (`Person.warLoss`, `warLossLine`); at `MEMORIAL_AT` (3) dead in one war, a
  memorial to its fallen (sim/memorials.ts `warMemorial`: an `Honoured` with `memorial` names, raised by statues.ts as
  a statue is; its card lists them, `deedsOf`). The year's chronicle tells the wars (`warYearLines`).
- **Seen.** The War tab (`panel/warPanel.ts`, to watch: sub-tabs Map, Wars, Home front, News): the map with the
  season's banner (`.war-season`), every march on it by kind (`MarchView`: a border march, a strike, a harvest raid
  dotted, the town's war party in gold led by one of its own; `drawMarks`), a province's card; the wars between known
  powers and the fallen; the campaigns (`CampaignView`: called, marching, won, lost, stayed out, sent coin, marched
  alone) with "Raise a party…" while one is open; the council's line on each power and the people's way
  (`WarWays.line`); the home front (a siege coming, the occupation and its resistance bar, sieges held and lost, the
  recap); the war dead, the widows and orphans, the memorials; the war news (`warNews`/`warLog`, `WAR_NEWS_MOST`). The
  view is `sim/war/view.ts` (`warView`, `snapshot.war`). The news bubble (mobile/notices.ts) has the siege, the
  occupation, a campaign called or marching, and the recap. The Expeditions world map shows the town's war party
  (march kind `campaign`) and a harvest raid's label.
- **Peoples' ways** (`WAR_WAYS`): orcs (join +4, proud, break their word when strong, spoils x1.3), knights (just
  wars only, proud, never break their word, spoils x0.8), nomads (harvest raids of their own, spoils x1.2), machines
  (arms to both sides, join -1), dwarves (proud, never break their word), vampires (join +1, spoils x1.2).
- **Tools.** `tools/soak.ts` takes `WAR=1` (each seed's joined, won, lost, spoils, war dead, sieges, occupation,
  fallen powers, wars, the town's provinces) and `WAR=2` (and the war news).
- **The War tab on the phone:** the map is fitted to the width, and sideways to the height (`terrainCell`), centred
  (`.war-map` fits its canvas). Checked at 393x852 and 852x393.
- **Probes (on main 0.121.0/0.122.0).** `tools/sim-hash.mjs`: every hash changes (fixture 45ba0aed2e31 ->
  9a0fffb1ba06; settlers 5aa972e69df5 -> c110ce446490; knights 8dd273d97ac8 -> 9e7b165f298c; vampire 0079254d1741 ->
  eb59b08f8018; dwarves 3859f268259d -> bdda7f36c2ee): the seasons of war run for every town with the autopilot on,
  and the War tab's border marches (their news lines take ids) shift the town's ids from the first days. 40-day soak,
  3 seeds, before -> after (people, deaths, none wiped): settlers 14.7/7.3 -> 13.3/10.0, knights 11.0/6.0 -> 11.7/4.7,
  orcs 9.3/7.7 -> 10.3/7.7 (a campaign joined on each seed, one lost in the field), machines 47.7/30.0 -> 40.3/51.3.
  An earlier round showed orcs a third down; switching the war's hourly rules off brought them back, and the deserters
  and the fit-fighters rule were changed (above). `tools/perf-sim.mjs`: step 1.68 -> 1.73 ms, snapshot 7.99 -> 8.18 ms,
  two days' catch-up 32.8 -> 35.6 s.
