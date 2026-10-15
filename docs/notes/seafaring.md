## Seafaring and islands (claude/seafaring; the owner's request)

The sea made a real place, on top of "Boats" and "The merfolk's shore" (HISTORY.md; boats, fishing and island trips
were already there). Autopilot only, on a side stream (`hashSeed(`${seed}:sea:${tick}:...`)`); `sim/seafaring.ts`
(`seafaringHourly`, called after `boatsHourly`) and `data/seafaring.ts`.

- **Harbour** (`HARBOUR` in BUILDINGS, shore, research `shipwrighting`): planned by the town (`planHarbour`) once it has
  a boatyard, a boat, 8 grown folk and the makings. Berths +2 (`fleetMost`), catch x1.5, squalls and the night monster
  x0.5/x0.6. Boats moor at it (`quay`, the snapshot's `mooring`). **Galleon** (`GALLEON`, research `galleons`).
- **Fishing:** `catchFactor`: the season's shoal (`SHOALS`; inshore for dugout/longboat, deep for carrack and up, wrong
  ground x0.6), harbour, merfolk escort. A squall that batters a fishing boat can sink her (`squallSinks`: hull under
  30%, else 12%); 2-3 townsfolk aboard drown (swimmers rarely). Catch kept in `s.sea` (`SeaBook`).
- **Ships age:** `Boat.built`; past 24 days the hull wears daily; a worn-out boat at home is broken up.
- **Monster:** by night from day 12 a serpent/kraken mauls or sinks a moored boat (x0.3 for merfolk). `sea_serpent`
  joins the medieval `SEA_FOES`.
- **Wrecks** (`washUp`, from any sinking and `wreck`): timber/cloth on the beach, sometimes castaways (a `refugees`
  band). Autumn/winter drift wrecks.
- **Pirates:** `SEA_RAID_KIND` (`sea_raiders`, in RAID_KINDS, never random) landed by `pirates()` every 9-16 days
  from day 8, medieval on, budget x0.7, raiders placed on the nearest beach (`beachNear`), `Raid.landing`. Pushes
  `nextRaidTick` out a day.
- **Isles:** `SEA_ISLES` (Herring Isle fishing, Ember Isle volcano, the Wreck Isle haunted, the Tidewrights' Isle trade
  with another people), merged via boats.ts `ISLANDS`/`ISLAND_SPOTS`. Gull Rocks is the bird-rock. Expeditions use the
  existing picker.
- **Colonies** (`s.colonies`, `Colony`): a town of 12+ (merfolk 7) founds one from day 20 (merfolk 9) on an isle in
  `COLONY_ISLES`; folk leave the town like a village's; goods sail home every 3 days in a free boat (storm risk);
  loyalty drifts, pirates raid, below 12 it breaks away. Max 2 (merfolk 3).
- **Merfolk:** start with a dugout, fish with no yard, monsters x0.3, a leviathan escort sometimes boosts the catch,
  and the Tide Clan claims isles for other towns on a fixed day 22-70 per seed (`claimDay`); never in a merfolk town.
- **Seen:** snapshot `seafaring` (`harbourReport`); Harbour tab in the Market menu, sailing boats and wakes
  (`map/mapBoats.ts`), sea lanes/colony flags/claim rings on the world map.
- Tests: `test/seafaring.test.ts`.
