## Giving chase, and the flashier raid board (second pass)

**Giving chase** (`sim/chase.ts`, new). Until now raiders who got away were simply gone. When a raid ends with fugitives
(`gone`, not down, not run down by the town's hunt, not spared), `endRaid` calls `noteFugitives`, which keeps up to
`CHASE_RUNNERS` (8) of them on `s.chaseOffer` for `CHASE_HOURS` (3). Autopilot only, no numbers from the town's stream.
The snapshot's `chase` (`{ name, count, hoursLeft }`) shows the offer, and the raid recap card gets a "Give chase!" button
that sends the new `giveChase` command (`commands.ts`, `sim.ts` -> `giveChase`). It raises a Raid of its own
(`Raid.chase`, `s.raid`) fought on the tactics board:
- the fugitives keep their loot (`carrying`) and are wounded to at most `CHASE_WOUNDED` (70%) of their health; the board's
  `broken` is on from the start, so they run for the far edge at once and escape for good if they reach it;
- the town sends its `CHASE_FIGHTERS` (6) healthiest standing fighters (`chasers`), starting `CHASE_GAP` (3) tiles behind
  the nearest runner (`CHASE_AT` is the raiders' column), with a full charge, so the town takes the first turns;
- the ground the two sides cross is levelled (no boulders, hills, logs, traps) so the chase is not stopped by terrain;
- `updateChase` (called from `updateRaid` for a chase raid, skipping the rest of the raid logic) ends it: those struck
  down give up their `carrying` and their kind's loot to the nearest stores (`depositNear`), told in a notice. No recap
  card, feast, deeds or grudge. All gone: "they got away"; the town wiped: the chase is lost.
`tactics.ts` `startTactics` has the chase branches; `stepTactics` ends a chase as 'fled' when nobody was caught.
Test: `test/chase.test.ts` (offer, start distance and turn order, loot back in the stores).

**Flashier battles** (`battle/juice.ts`, `battle/juiceRules.ts`, `tactics/tacticsView.ts`): blows are tiered
(`blowTier`: normal, heavy, crit). Numbers grow and change colour with the tier (crit: 44px orange with "!!"); impacts are
bigger (the pack effect sheets already in `art/effects.ts`, plus a `px:white-cross` flash on a crit) with sparks thrown
(`SPARKS`, live sparks capped at `SPARK_CAP` 48, impact sprites at `IMPACT_CAP` 14). Hit-stop: a heavy blow, crit or kill
holds the board's clock (`HIT_STOP`, `KILL_STOP`); a short zoom punch leans the camera in on the blow (`ZOOM_PUNCH`,
`punch`, `focus`, eased by `fadePunch`); the final blow (the last foe felled) runs the board at `SLOWMO_RATE` for
`SLOWMO_SECS`. The board's clock is `TacticsView.clock`: it runs behind the real one while held and eases back
(`LAG_MAX_MS` caps it). Banner words slam in (`slamScale`): "FIRST BLOOD!" on the battle's first kill, "ROUTED!" when the
leader falls, plus the existing multi-kill words. Spell and skill effect sprites on the board are drawn about 1.5x larger.
**Reduce motion:** the ☰ menu has "Reduce motion" (`ui/motion.ts` `setReduceMotion`, key `littletown.reduceMotion`), and
`reducedMotion()` now also honours it (and the phone's own setting): no shake, hit-stop, zoom, slow-motion, sparks or
flash; numbers and banners still show. Extends HISTORY.md's "The flashier raid screen". Test: `test/juice.test.ts`.
