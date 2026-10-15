## The night watch (the owner's ask: "to combat the parties coming in at night, I'd like to have guards patrol or post up at gates at night")

Changes HISTORY "Night prowlers" (a prowl met at the wall is smaller), "The odds weighed" / the probe (a watchman at the way in
may meet it), "Visiting bands" (disguised bandits seen through), "Town jobs" / guards (the roster beside the hired guards) and
"Lights at the gates first" (the gate lamp helps the watch). The hired guards already kept shifts, walked the wall with torches
and stood sentry on the gates (`onShift`, `wallWalk`, `gatePost` in sim/people.ts); this sets who is on the watch by the
danger and makes the watch bite.

**The roster** (`src/shared/sim/nightWatch.ts`, `nightWatchHourly` hourly from sim.ts beside `oddsHourly`, autopilot only).
At noon (`nightIndex` turns over then) the town sets the watch for the coming night, in `s.watch` (`{ night, ids, alert?,
spotted?, caught?, missed? }`, all optional). The hired guards on the night shift (odd ids) keep it as before; besides them
`watchWanted` posts townsfolk, so a town with no guard hired is covered too: `max(1, hired night guards) + danger(s)`,
at most a third of the grown-ups, less the hired. `danger` is one for each of a prowl lately (`s.lastProwl`), a probe waiting or
sneaks met lately (`watch.alert`), a raid lately, a ring wall not yet standing all round, and two on the Defence direction
(`WATCH_DANGER_DAYS` 4). Never under `WATCH_LEAST_PEOPLE` (4) grown-ups, in a castle/hold/horde town (`ringTown`), or the
founder. Candidates are grown-ups at home on their feet, not running a station, defend not off, the better fighters first, and
they keep the watch `WATCH_STINT` (3) nights running, then the next in turn.

**On the beat.** `onShift` is true for a roster member in the watch hours (`WATCH_FROM` 19 to `WATCH_UNTIL` 6: `onNightWatch`);
`chooseTask` gives them a `patrol` task before their own work (`patrolTask`, the old defend-job branch pulled out): after a
band near the town, else up on a gate (`gatePost`), else with no wall standing half of the watch holds the camp's edge, one
on each side (`edgePost`, a patrol task with `hold: true` so they stand there), else the wall walk or the long way round. They
are seen with a torch at night as every guard on shift is (`onWatch`, lightMap). Roster members sleep by day, 8 to 16
(townsfolk.ts `nightWatch`, which the hired guards had), so they are up for it and are off day work meanwhile. The tap card
says "On the night watch" (or ", at a gate") by night, "On patrol" otherwise (snapshot.ts).

**The watch bites.** `spotAt(s, at, rng)`: the watchmen on patrol within `WATCH_SPOT_RANGE` (10) cells of the way in each have
`WATCH_SPOT_BASE` 0.3 + 0.008 a fighting level (+0.15 for a sentry up on a gate), at most 0.7 each, combined, times the moon
(`moonLight`: `WATCH_DARK` 0.7 on the new moon, `WATCH_BRIGHT` 1.15 on the full), times `WATCH_LAMP` 1.25 with a lit lamp
within 5 cells (the gate lamps), at most `WATCH_SPOT_MOST` 0.95. A long wall with two guards has blind stretches: out of sight
nothing is seen.
- A **prowl** (sim/prowlers.ts): spotted, the raid is begun at the gap as before but with `WATCH_CAUGHT_SHARE` (0.5) of the
  budget (`caughtBudget`): the watch meets them at the wall, the alarm is raised, the news names the watchman. Not spotted,
  as before.
- A **probe** (sim/raidOdds.ts `oddsHourly`): first `watchMeetsProbe` picks the way in (a gate, else a gap, else the town's
  edge, on the watch stream) and rolls `spotAt`; spotted, the few sneaks (`probe.n`, the kind's cheapest foe each) are a small
  inside raid at the gate and the probe is over. Otherwise the old proxy (`PROBE_CATCH*`, guards and towers) and the
  steal/burn go on.
- **Disguised bandits** (sim/bands.ts `seenThrough`): the watch is the guards and the roster; the raid begun where they stand is
  marked as the watch's (`watchSawBandits`).
The raid carries `Raid.watched` ("at the east gate") and `Raid.watchers`; the recap gains `RaidRecap.watched` and a line
("The night watch spotted them ..."). When the raid is won (`raidRecap` calls `watchWon`): the news "The night watch caught the
night thieves at the east gate", `s.watch.caught`, `yearRaids.watched` (the chronicle says "The night watch caught sneaks N
times"), and each watchman who was in the fight earns the deed `watched` (titles the Watchful, Nightwarden, Warden of the
Dark: data/deeds.ts) and `WATCH_XP` (5) in their fighting skill. A raid got away from with loot is not counted. Watchmen are hurt
or killed in the fight as any defender is.

**Shown.** The Plan tab's Guards section gains a line (`watchLine`: how many are on the night watch, more while the nights
are dangerous, how often it has caught sneaks; `s.guards.watch`, in the panel's key).

**Rules kept.** Own side stream `new Rng(hashSeed(`${s.seed}:watch:${s.tick}:<tag>`))` (`watchRng`); nothing drawn from the
town's stream except by `startRaid` when a watched raid starts. Autopilot only. New fields optional (`GameState.watch`,
`Raid.watched/watchers`, `RaidRecap.watched`, `yearRaids.watched`, task `hold`). Tests: `test/nightWatch.test.ts`.
