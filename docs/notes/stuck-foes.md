## Stragglers sent away

The owner's report: "A shinobi and a rat are still in town after several raids. They seem like stuck characters."
Changes the sweeps in "Raids bite again" / "Tower-defence raids" (the raid's end), "Hostiles roaming the land" (a band
`fighting` a skirmish) and "Raiders lamed" (a limping runner that can't be run down is still a live raider).

**What was looked at.** Both kinds only ever appear in a raid (the Shinobi clan, `shinobi_night`, the rat swarm and the
Rat Plague's waves), so the sim holds them in `s.raid.raiders` and `endRaid` drops the whole list. Read and run with
`tools/stuck-scan.mjs` (forces six shinobi and six rat raids one after another on a young settlers town and on the
late-town fixture, then looks for a raid still on, a band left behind, prisoners): every raid ended and nothing was left
over. Also checked and found clean: `raiderWounds.ts` (a lame raider is a live raider in the raid, so it flees or is run
down), `prisoners.ts` (only human raiders are taken; a rat never), `roamers.ts` and `nests.ts` (neither group names a
shinobi or a rat except goblin nests' giant rats), `raidSkip.ts`, `raidWait.ts`, `raidOdds.ts` (a probe leaves
nothing on the map), the `debris` corpses (they expire at `DEBRIS_LASTS`), `snapDelta.ts` (a `raid: null` is sent) and
`map/mapRaiders.ts` (a sprite is destroyed the update its id is missing). The cause was not reproduced.

**Where a foe could outlive its owner, so the net goes there.** The in-town raid loop (`updateRaid`) has no stall rule
of its own (the tactics board has one, `STALL_TICKS`), so a raider that cannot step (a position gone to NaN, a
castle path that never opens) keeps the raid on for ever; and a band whose `fighting` names a skirmish that no longer
exists is skipped by `roamersTick` and kept by `roamersHourly` for ever.

**The net (`sim/strays.ts`, `strays(s)`, once an hour after `updateRaid`, autopilot only, no draws from any stream).**
- An active raid still going `STRAY_RAID_HOURS` (4) after its clock (`leavesTick`) has its live raiders sent away
  (`gone`) and the raid ends the next tick as usual. A raid waiting on the player (`parley`, `mercyAsk`) is left alone.
- A roaming band whose `fighting` skirmish is gone, or that is `STRAY_BAND_HOURS` (6) past its `until`, is removed.
- Each sweep puts "A straggler slipped away in the night." in the journal (`STRAY_LINE`).
Old saves heal on load for the same reason: nothing is stored.

Test: `test/strays.test.ts`. Tool: `tools/stuck-scan.mjs`.
