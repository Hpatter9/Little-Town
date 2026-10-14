## The skies (the owner's ask: a DLC-sized update)

Airships from the Industrial age, sky pirates, and flying creatures hunting the town. Modelled on the boats.
`src/shared/data/skies.ts` (the data) and `src/shared/sim/skies.ts` (the rules); every roll is the skies' own side
stream (`${seed}:skies:...`), and the places in the sky have no side drawn at founding (`destSides` skips `bySky`), so a
town without airships plays out as before (checked: fresh towns byte-identical to main through day 4.5).

- **The fleet:** `AIRSHIPS` (dirigible from Aeronautics, zeppelin from Rigid Airships, both Industrial; sky cruiser
  from Air Cruisers, Modern; sky frigate from Skyships, Space; `SKY_TOPICS` in the logistics branch, the planner scores
  them +20 at six people, +8 more on Growth or Trade): crew, `speed` (a trip's legs divided by it), `hull`, `cargo` (on
  top of the party's packs), `guns` (the share of a sky fight's foes driven off before it comes to blows). The **Airship
  Mast** (`AIRSHIP_MAST`, station `airship_mast`) builds them as crafting orders (`airship_<kind>`, `ItemDef.airship`);
  finished, `launchAirship` puts her in `s.airships` (`Airship`: kind, name from `AIRSHIP_NAMES` in turn, hull, away)
  and breaks up the worst past `AIRSHIPS_MOST` (3). Mended `SKY_REPAIR_SHARE` a dawn for a unit of steel or cloth; she
  flies only above `AIRWORTHY` (half).
- **The plan** (`planAirships`, hourly from `skiesHourly`, autopilot on): a mast once Aeronautics is learned and the
  town has 4 grown-ups (`findSpot`), then an airship, a second at 10 grown-ups, a better kind as each age brings one;
  one order at a time, only with the makings and 4 spare.
- **Flying anywhere:** `fliesWith` (every trip but the full moon's hunt and a fight on the land) takes the best free
  airship that seats the party; `sendExpedition` prefers her to a boat (`Expedition.airship`, `boardAirship`), the trip's
  legs go `flySpeed` times faster, and her hold adds to `partyCarry`. Four places only she reaches (`SKY_PLACES`,
  `Destination.bySky`, on the world map at `SKY_SPOTS`): the Cloud Isles (harpies), Gale's Roost (the sky pirates'
  harbour: Captain Hesper Gale, `captain_gale`, a boss with a kit, a relic trophy `gale_storm_saber` and the unique
  Cloudpiercer), the Roc's Eyrie (the Roc) and the Storm Crown (the Thunderbird, Modern). An island takes an airship
  when no boat is free. `canSend`, `mostFor` and the parties' `choosable` know all this.
- **Aloft** (`skyHour`, each hour out and back): a storm (`SKY_STORM_HOURLY` by season, `SKY_STORM_HURT`; a bad one
  may throw someone out, `THROWN`, who dies unless they catch a line, `CAUGHT_A_LINE`), guns from a power at war with the
  town (`FLAK_HOURLY` a power, `FLAK_HURT`), sky pirates (`SKY_PIRATE_HOURLY`, `SKY_PIRATE_GROUP` by age) or flyers
  (`FLYER_HOURLY`, `SKY_FLYERS`), fought on the FF screen with the skies' own stream. Her hull gone, `crash`: she's lost
  (`s.skies.lost`), the loot with her, each aboard dies at `CRASH_KILLS` (0.45), and the rest walk home from where she
  came down (`Expedition.crashed`). Nobody left alive, she never comes home (`airshipLost`).
- **Sky pirates** (`skyPiratesHourly`): a town that flies, or any town from the Modern age (`piratesMayCome`), from
  paced day `SKY_RAID_FROM_DAY`, never within `SKY_RAID_GAP_DAYS` of the last, and only in place of a raid due within
  `SKY_RAID_DUE` hours (like a nest's raid). Their ship is seen (`seePirates`: `s.skies.pirates`, a red notice) and
  `SKY_WARNING_HOURS` later they slide down their ropes into the middle of the town by the stores (`dropIn`:
  `startRaid(..., inside)` with `SKY_RAIDS` by the age, weight 0, `SKY_RAID_SHARE` (0.7) of a raid's budget): walls don't stop
  them. Gale's Roost cleared (`airshipHome` with the job done), they keep away `ROOST_QUIET_DAYS` (`s.skies.quietUntil`).
- **Hunters from the sky** (`skyHuntersHourly`, from day `SKY_HUNT_FIRST_DAY` 5 in a town of `SKY_HUNT_PEOPLE` 4, on
  `SKY_HUNT_HOURLY` 0.006 an hour, more in the highlands, one at a time): a roaming band with `Roamer.flying`
  (`SKY_HUNTERS` by age, birds by day and bats by night, from the menagerie). `moveFlyer` in sim/roamers.ts: it flies in
  from beyond the known land at full speed, circles over the town, and stoops on someone out in the open
  (`SKY_SEE_CELLS`); walls are no cover, only a roof (at a desk, at work at a station, and those indoors the prey leave
  out). Caught, a skirmish on the FF screen as with any band. The town shoots back (`skyVolley`, every `VOLLEY_TICKS`):
  each defence engine and each grown-up with a bow, gun, wand or staff within `VOLLEY_CELLS` hits on `VOLLEY_HIT`, a
  hit `VOLLEY_HURT`; at `FLEE_AT` it flies off, at 1 it falls and its carcass comes in. Guards don't chase it on foot.
  The land's bands count without the flyers, so their own spawning is as before.
- **Seen:** `snapshot.airships` (each with a `leg` while she's leaving or coming home over the town), `snapshot.mast`
  (its footprint), `snapshot.skyPirates` (coming, or over the raid), `RoamerView.flying/height/hurt`,
  `ExpeditionView.airship/crashed`, `DestinationView.bySky/airship` (`airshipLine`). `src/renderer/art/airshipArt.ts`:
  the steampunk cityscape pack's great airship (`art/skies/airship.png`) recoloured by a ramp per kind and for the
  pirates (black and plum), and the enemy spaceship pack's fifth ship for the sky frigate (`art/skies/skyfrigate.png`).
  `src/renderer/map/mapAirships.ts` (`MapAirships`): moored with her nose at the mast's head, flying out and home over
  the town, the pirates' ship coming in and hanging over the raid with its ropes down, each with a shadow on the land.
  The mast is a pick of the futuristic pack (the lattice pylon, a gas tank, a console and a box). A flying hunter is
  drawn lifted over its spot (`RaiderView.aloft` in mapRaiders.ts, its shadow on the ground, its bar the town's
  shooting). A watched voyage (`FightScene`) shows a sky backdrop (`SKY_LOOKS`: the cloud and cloudscape packs) and her
  gondola under the party (`aloft`, `showHull`). The Quests tab lists the airships, the mast's tap card who's moored,
  the news bubble the pirates coming and a hunter overhead. Inventory icons `airship_*` in customIcons.ts.
- `window.__skies('airship' | 'fly' | 'pirates' | 'hunter')` on the phone page for previews (`sim/skiesPreview.ts`).
- Tests: `test/skies.test.ts`.
