## The wall as one building (branch claude/wall-as-one; the owner's ask: "one large building they work on from anywhere and the whole thing goes up together as one")

**What was wrong (found before any change).** HISTORY.md's "The wall raised as one construction" (0.67.0) put every
section *in work* at once, but each section stayed its own blueprint with its own `progress` and its own `delivered`,
so the wall still rose a section at a time, three ways:
- *Builders:* `findJob` 'construct' took the first site in the building list that was buildable with a free spot
  (`blueprintsNow(s).find(...)`), so every builder walked to the same piece and then the next one along: a crew
  clustered on one stretch (a piece has only a few spots round it) and finished it before moving on.
- *Hauling:* `haulOrder` puts the sites being built (someone at it, or `progress > 0`) first, so the materials went to
  the piece being built, then the next: one piece's makings at a time.
- *The picture:* each piece drew its own progress, so the map showed one stretch scaffolded and raised while the rest
  stood as ghosts.
- Measured on `tools/wall-probe.mjs` (new, below), settlers seed `wall-0` on the old code: the first piece turned from
  blueprint to built on day 10.07 and the last on day 16.98, **6.9 days** apart; five of the six towns (settlers and
  knights, seeds 0 to 2, 40 days) never had a ring standing at all within 40 days.

**What it does now.** While a ring is going up its pieces (the blueprints of the ring's generation that are in work) are
one site, in `sim/ringWall.ts`:
- `Ring.sec` (work done, in build-seconds summed over every piece) and `Ring.pool` (materials brought for the whole
  wall): one progress, one pool. `Ring.unlaid` (pieces not yet laid, their ground uncleared, counted by `planRing`).
  `ringTotals` (cost, build-seconds of the pieces in work and of all, plans included), `ringWorkShare`,
  `ringDeliveredShare`, `ringStillNeeded`, `ringCap` (work goes no further than the makings brought, and while a piece
  is still a plan or unlaid no further than the pieces in work and `RING_OPEN_CAP` 0.97), `ringBuildable`, `ringWork`,
  `ringDeliver`.
- `syncRing` (from `Sim.step`, after the people) writes the one progress and each piece's share of the makings into every
  piece's own `progress` and `delivered`, so the map, the planner (`stillNeeded`), the queue and the tap card all read
  the wall as one without being changed. `planner.ts shelveStalled` leaves the wall alone (`ringSite`).
- `finishRing` turns every piece of the construction (walls, gates and grates) from blueprint to built in the same
  tick, when the whole is done; one notice ("The town's wall is raised, all N pieces of it together"), and a deed for
  each builder. `planRing` then marks `ring.done` and takes the older ring down, as before.
- *Builders* (`people.ts`, `ringPick`, `ringBuilderOrder`): the nearest open spot along the line to where they stand,
  each builder already within `RING_CROWD_CELLS` (3) of a piece counting that piece `RING_CROWD_PULL` (5) cells
  further off, so the crew spreads along the wall. A builder's task is still `{type: 'build', building: <the piece>,
  spot}`; the work goes to the wall's count wherever along it they stand.
- *Haulers:* `haulOrder` lists the wall once; `ringHaulTarget` takes them to the piece of it nearest to them;
  `unreserved` counts what anyone is carrying to any part of the wall against the wall's one need.
- *The picture:* every piece shows the one progress, so the scaffolding and the part-raised courses (the mask by
  progress in `mapView.updateBlueprint`) rise all round together, and the whole wall stands in one tick. A piece of the
  wall is redrawn when its progress moves a hundredth (`mapView.ts`), not every tick (a hundred pieces move at once).
  The tap card's materials line shows whole units (`main.ts`).
- *Repairs after a breach stay per piece* (a hole is a hole): `ringSite` is null once `ring.done`, so a mended
  or upgraded piece of a standing wall is its own site, as before.
- *Old saves:* a ring with no `sec` (each piece with its own progress and makings) is pooled the first time
  `ringTotals` runs (`sec` = the sum of piece progress x build time, `pool` = the sum of what they held).
- *Kept:* the shape by people (`data/ringShapes.ts`), gates and grates, castle and hold rules, no roads through the
  ring, the planner's timing (`planRing` is unchanged but for `unlaid`), prowlers (`ring.done` is false until
  the whole wall is raised, and now it is raised at once). `ringProgress` (the one figure, `snapshot.wall`) still
  counts pieces standing: it now reads 0 of N until the wall stands, with the share rising.

**Constants:** `RING_OPEN_CAP` 0.97, `RING_CROWD_CELLS` 3, `RING_CROWD_PULL` 5.

**History it changes:** "The ring wall" (one blueprint for the whole wall, `RING_AT_ONCE`), "One coordinated wall
project" and "The wall raised as one construction": the pieces stay separate cells for pathing, damage and the joined
art, but their work, makings and finishing are one. "Builders build, the rest carry" / "construction crews": a builder
at the wall takes the nearest open spot along it (the other sites are as before).

**Tests:** `test/wallAsOne.test.ts` (one progress and one pool across a hundred pieces, work capped by the pool, no piece
built before the whole and the gates with it, the builders spread along the line, the builder's order, the old save
pooled, a breach mended a piece at a time). No existing test changed: `test/ringWall.test.ts` finishes pieces by hand
between planner passes and is unaffected.

**Tool:** `tools/wall-probe.mjs [days] [seeds] [origins]` logs for each town when the ring was laid and stood, the spread
between its first and last piece turning built, the crew's spread along the line, raids, people and deaths.
