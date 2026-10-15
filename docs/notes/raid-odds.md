## The odds weighed, mercy or slaughter, skip at the alarm (the owner's ask)

The owner's report: the order that hunts the undead (the Monster Hunters' Guild, `hunters`: four hunters, a day after
a day, against a monster town of twenty) is wiped. Changes the HISTORY.md sections "Raids bite again", "Skip a raid to its recap" and "A recap after
every raid"; builds on "The realm" (war hosts).

**The odds weighed** (`sim/raidOdds.ts`, constants `ODDS_*` in `data/raids.ts`). When a raid's warning is up
(`updateRaid`, warning to active) `weighArrival` compares the attackers' might with the town's in one measure: a fighter
is worth the square root of its health times its damage a second (`raidPower`: the raiders' own `might` counted;
`townPower`: every grown-up on their feet and in town, walls and engines each adding at most `ODDS_WALL_SHARE` (half) of
the fighters' worth, and the town's allies in the raid). Under `ODDS_TURN` (0.5) a band of people (raid kinds, rival
peoples' raids, war hosts, pirates, the Hunter's Guild: anything that isn't wild beasts, the Great Enemy or a saga's
raid) doesn't attack: it holds at the edge (`Raid.parley`, the prompt below) and, answered, turns back (`turnBack`: the
raid ends at once with a recap, "turned back at the sight of your walls"). A band that turns back
gathers until its next coming would be a fair fight (`ODDS_FAIR` 0.7 of the town's might, at most `ODDS_GATHER_CAP` 3
times as big and tough): `raidOdds.extra` holds it in steps of `ODDS_GATHER_STEP`, and `gatherRaid` (called from
`startRaid`) makes the next band of people that much tougher and bigger (`gatherOf`; more raiders by copies, a host only
tougher). The Guild's turned-back hunters also leave `guildTarget` unset (it comes again with the day's next raid).
`raidOdds.streak` counts the turnings-back in a row: after `ODDS_GATHER_MAX` (3) they come whatever the odds; a weighed
band that goes in resets both. A war host that turns back is
reported by `hostOver` as withdrawing (no loss of attitude). Only with the autopilot on.

**Mercy or slaughter.** The same question ("Let them go" / "Hunt them down", a `raid` prompt, `ODDS_ASK_HOURS` to answer)
is put when the band is outmatched at the edge (`Raid.parley`) and when a fight is won: `askMercy`, once the battle on
the trail or board is over, every raider alive is fleeing, at least `MERCY_MIN_RAIDERS` came and one has fallen
(`Raid.mercyAsk`; the fleeing raiders wait, cornered, while it is open: `heldForMercy`). `answerOdds`:
- **Let them go** (`Raid.mercy = 'spared'`): the power they came from warms (`standWith` in factions.ts,
  `MERCY_STANDING`), `raidOdds.spared`++, alignment good (the Guild's anger `s.guild` falls `GUILD_MERCY`, a hunt raises it). At the edge they turn back (above).
- **Hunt them down** (`'hunted'`): their power cools (`SLAUGHTER_STANDING`), alignment evil, and fleeing raiders are run
  down (`huntDown`: `HUNT_CHANCE` a tick, nearest able grown-up credited, `HUNT_XP` melee experience, loot as for any
  fallen raider). At the edge they stay and fight. `oddsOver` (from `endRaid`): a raider got away, or by chance
  `GRUDGE_CHANCE`, leaves a grudge (`raidOdds.grudge`: kind and a day `GRUDGE_DAYS` ahead) and `ripeGrudge` (from
  `maybeStartRaid`) makes the next raid of that kind come, `GRUDGE_BIGGER` (1.5) times the size. A host's survivors leave none.
- **Unanswered:** the prompt's default is chosen by `lean`: the leader's nature (kind, cheerful, jolly, pious, dreamy,
  shy lean to mercy; stern, grumpy, bold, proud, greedy, gloomy to the hunt), what the town has done before
  (`raidOdds.spared/hunted`) and the alignment tally. **Alignment hook:** `alignHook` in raidOdds.ts only keeps
  `raidOdds.align`; replace its body with `alignPush(s, 'good' | 'evil', n)` when sim/alignment.ts lands.
- The recap names it: `RaidRecap.mercy` ('turned', 'spared', 'hunted') and a story line ("You let the survivors go.", "You
  hunted them down.", "One got away, and will remember.").

**Skip the battle at the alarm.** The raid warning prompt (`startRaid`) has one more option, last: "Skip the battle"
(`Raid.skipIt`). `skipRaidsTick` skips a raid with it as soon as it turns active, by the existing skip (the same ticks run
flat out with the town on auto: `raidSkip.ts`), so a skipped raid has the same deaths, experience, loot, injuries and
recap as one watched on auto: tested on the plain field, the trail and the board. The default answer is still "Sound the
alarm".

**State.** `GameState.raidOdds?` (`extra`, `streak`, `turned`, `spared`, `hunted`, `grudge`, `align`) and `Raid.parley`, `weighed`,
`mercyAsk`, `mercy`, `skipIt`, `turned`; all optional, older saves unchanged. Draws nothing from the town's stream: the
side stream `${seed}:odds:${tick}:...` (`sideRng`).

**Tests:** `test/raidOdds.test.ts` (four knights against twenty turn back and come back bigger; a fair band attacks; no
autopilot, no weighing; mercy; slaughter; a broken band run down for experience, one let go not; a grudge brings a bigger
raid; skip equals watch on the field, the trail and the board). `test/tactics.test.ts` boardNow(manual) sets
`raidOdds.extra = 3` so two bandits against four trained fighters still come on to the board.

**Tools:** `tools/soak-raids.mjs [days] [origin...]` (raids met, fought, turned back, deaths; `ODDS=1` logs each raid's
odds at its arrival; origin `fixture` is the mature town).

**Soak (40 days, `tools/soak-raids.mjs`; before then after).** raids met / fought / raid deaths / people at the end:
lich a 61/34/4/25 then 61/29/4/27 (11 turned back, 14 spared); lich b 68/34/5/39 then 66/31/7/34 (6 turned back, 9
spared); knights a 28/28/4/7 then 30/30/2/15 (2 hunted); knights b 10/10/2/7 unchanged; settlers b 30/30/9/8 unchanged;
settlers a 39/38/10/19 then 23/21/15/0 (one band turned back, and the town's later luck shifted: that town died).
The Hunter's Guild's daily four against a lich town were the case that turned back. The mature fixture town (34 people,
20 days) had no outmatched raid: 23 raids, 16 deaths, either way. `tools/sim-hash.mjs`: all five hashes unchanged (the six-day
towns meet no outmatched band; a raid prompt now carries "Skip the battle", which changes a saved town only while a
raid warning is open).
