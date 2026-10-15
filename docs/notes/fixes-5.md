# Fixes 5 (branch claude/fixes-5)

Eight owner-approved fixes and small rules. Sim hashes (`node tools/sim-hash.mjs`): only item 4 changes them (see there);
everything else leaves them as on main. New state is optional, new randomness is on side streams.

## 1. An outmatched band may demand a toll or probe a weak spot (changes HISTORY "The odds weighed")

Besides turning back, a band of people that holds at the edge outmatched (`weighArrival`, sim/raidOdds.ts) now rolls
`outmatchedPlan` on the side stream `odds:<tick>:plan`: `'turn'` (as before: the mercy question, the next band bigger),
`'toll'` or `'probe'`. The chances (data/raids.ts `ODDS_TOLL_CHANCE` 0.3, `ODDS_PROBE_CHANCE` 0.25) are scaled by the
kind: a bribable kind asks a toll twice as often, one that steals or burns probes twice as often, a lord's army (a kind with
a `leader`) tolls more and probes less. Never a war host (an army) or the Guild's hunters.

- **Toll** (`askToll`, `payToll`): `tollFor` asks `TOLL_COINS_SHARE` (12%, at least `TOLL_MIN_COINS` 10) of a purse of at
  least twice that, else `TOLL_FOOD_SHARE` (15%) of the food held; a town with neither just gets the usual turn-back. A raid
  prompt with `['Pay the toll', 'Refuse the toll']` (`Raid.toll` holds the demand, `Raid.parley` the prompt). The default
  answer, if nobody picks, follows the leader's nature through `lean` (the mercy question's) and the treasury: pay if the
  leader leans gentle and the purse holds `TOLL_AFFORD` (3) times the toll, else refuse. Paid: they go, the raid ends
  with recap `mercy: 'toll'` ("demanded a toll of N coins to leave the town alone. You paid it, and they went."), and the
  gathering resets (`extra`, `streak` to 0, `raidOdds.tolls` counts). Refused (or not payable by then): they turn back as
  before, and the next comes bigger.
- **Probe** (`turnBack(s, r, 'probe')`, `planProbe`, `oddsHourly`): they turn back (the usual gathering, recap
  `mercy: 'probe'`, story "A few hung back in the dark, looking for a weak spot."), and `raidOdds.probe`
  (`{ kind, at, goal, n }`) waits for 2 in the morning (`PROBE_HOUR`). `oddsHourly` (called from sim.ts beside
  `boatsHourly`, autopilot only, not during a raid) resolves it: the watch catches it at `PROBE_CATCH` 0.3 plus 0.1 a guard and
  0.1 a watchtower (15% to 85%): "caught, driven off with nothing" (`raidOdds.caught`); otherwise a `burn` goal sets one
  flammable building alight (`fire.ts setFire`), else it steals `PROBE_TAKE` (6) a head (2 to 3 heads, `PROBE_PARTY`) of the
  most valuable good in the stores (`LOOT_VALUE`). Told in the news.
- Types: `RaidRecap.mercy` gains `'toll' | 'probe'`, `Raid.toll`, `GameState.raidOdds` gains `tolls`, `probes`, `caught`,
  `probe`. Tests: test/raidOdds.test.ts (toll paid and refused, the default, the probe and the catch).

## 2. Hunted war hosts leave a grudge (changes HISTORY "The odds weighed")

A host's band that the town hunted down (`r.mercy === 'hunted'`) and that lost someone to flight (or on the side-stream
chance `GRUDGE_CHANCE`) now leaves `Faction.grudge` on its power (`oddsOver`, sim/raidOdds.ts), with the recap line "the next
host will come bigger". The next `musterHost` (sim/factions.ts) takes it: the host is `HOST_GRUDGE_BIGGER` (1.35) times bigger,
up to that times `HOST_MOST`, the muster notice says "come to settle a grudge", and the flag is spent. Other bands keep
the town's own `raidOdds.grudge`. Test: test/raidOdds.test.ts.

## 3. Trade direction drives scouting (changes HISTORY "Scouting" / "Trade empire")

Under `s.direction === 'trade'`, for a region still to scout (a `scout` destination not in `s.scouted`), the parties
(sim/parties.ts, data/parties.ts): `tradeScout` adds `PULL_TRADE_SCOUT` (5) to the place's pull, `partyGapHours` is
`TRADE_SCOUT_GAP_HOURS` (5) not `PARTY_GAP_HOURS` (8) while one is choosable (sooner), and `dares` takes an `ease` of
`TRADE_SCOUT_DARE` (0.85) for that trip's danger bar (further afield). Nothing under any other direction. Test:
test/parties.test.ts.

## 4. Alignment drifts toward neutral (changes HISTORY "A town's alignment")

The slow hourly drift (`alignmentHourly`, sim/alignment.ts) pulls the bar toward 0, at the same rate
(`DRIFT_PER_HOUR`), not toward the people's `homeOf` (which stays the starting point, the mood's reference and what the
Our ways card shows). The bar for a knights town (home 40) now sinks back; a vampire town's (-45) rises. The order axis still
drifts toward its own home. **This is the only change that moves the sim hashes**: fixture, knights, vampire and dwarves
change (their homes aren't 0); settlers (home 0) is identical. Checked by reverting just this line: all hashes then match main.
Test: test/alignment.test.ts.

## 5. The Drowned King's anger and the pirates (changes HISTORY "Seafaring")

`kingAnger(s)` (sim/seafaring.ts, constants in data/seafaring.ts): 0 unless the Great Enemy is the Drowned King and still
standing; else his plan's share of the siege (`PLAN_AT.siege`) plus `KING_REFUSED` 0.12 for each tribute refused less 0.12 for each paid,
less `KING_EASED` 0.3 for `KING_EASE_DAYS` (8) after a tribute paid, clamped to 0..1. In `pirates`, the gap to the next crew is cut
by up to `KING_GAP_CUT` (40%) and the crew is swollen by up to `KING_BUDGET_MORE` (+50%): tougher and more of them, past the
usual raid size cap (`swellCrew`, as `gatherRaid` does), with no number drawn (the town's stream is untouched; anger 0 is
byte-for-byte as before). Test: test/seafaring.test.ts.

## 6. Merfolk on the raid board show tails in water (changes HISTORY "The merfolk rework", "Merfolk tails")

Renderer only. The top-down board (tactics/tacticsView.ts) passed `swimming: false` for every townsperson. A merfolk
(`PersonView.mer`) standing on a `water` or `shallows` tile now draws as `swimming` (cut at the waist, the map's tail
trailing behind); on land, legs and fins as before. The map's own raid battle (map/mapBattle.ts) draws its people with
`MapPeople`, which already reads `swimming` from the snapshot (`wetAt`), so nothing changed there. Not previewed on a live
water board (none was to hand); typecheck and the build pass.

## 7. Guild badges in the fight HUD and the Chronicle (changes HISTORY "Guild icons")

Renderer only: the HUD had the ids (a fighter's `ref`, an expedition member's `id`) all along, and the snapshot already has
`guilds`, so no sim or snapshot change was needed. `FightHud.update(v, speed, guilds)` (fight/fightHud.ts) shows the first
guild's badge (`guildMark`) beside the name on the party's rows, the trip's member list and the victory screen's rows.
The Chronicle's Heroes tab (`renderHeroes(a, guildMark)`) shows it by "The famous" (the living; panel.ts passes it and
adds the famous' guilds to the journal's redraw key). **Not done:** the fallen. People leave their guild when they die, and
nothing records the guild on the `Fallen` entry; a badge there needs a `guild` field written at death (a sim change, so the
hashes would move). Also not done: the raid battle bar's chips and the raid recap's rows. Not previewed with a guild in a
fight; typecheck and build pass.

## 8. House doors a person fits through (changes HISTORY "Walls and doors stand taller than the townsfolk")

Renderer only (map/packBuildings.ts `HOME_DOORS`, `homeDoorTexture`, in `packDressing`). The homes' pack pictures
(cottage, row houses, lean-to, hide tent, longhouse, apartments) have no door, or one 0.25 to 0.6 of a person tall. Each
home in the timber look now has a door hung over its front (a share of the width: the middle, or two for the row houses
and apartments), `HOME_DOOR_H` 44 px against a person's 48: cut from the dungeon pack's wooden door (`art/delve/doors.png`, already
in the repo and credited), its arch kept and the planks drawn down to the sill, in a dark frame. Previewed at 393x852 and
852x393 on a 30-day town (longhouse and lean-tos); the cottage and row house were not in it, the same code places them.
Workshops, shops, taverns and the nomad looks are as before.
