## Snapshot speed (after 0.189.0)

`node tools/perf-sim.mjs` on `test/fixtures/late-town.json.gz`: before, step 1.28 ms and snapshot 13.80 ms; after, step 1.16 ms and snapshot 6.2 ms (the old numbers were 1.2 and 12.3). The delta is 2.7 ms to make (was 3.2), 27 KB a tick (unchanged).

Most of the cost was `powerOfPerson` (via `personFighter`/`kitOf`), run for every party of every destination, the raid's town power and the founder's duel list on every snapshot. Rules are untouched; these are view-only:

- `snapshot.ts` `destPower`: the party's power and the foes to expect go through `slow()` (kept 50 ticks or until a command, like the party plan they come from).
- `raidPowers`: the town's power is kept by `brief()` (10 ticks); raiders and allies stay live.
- `founderView`: `duels` goes through `slow(s, 'duels')`.
- `buildings.ts` `withStockScope(s, f)`: `snapshot()` sums the stores once; `totalStock` inside the scope returns a copy of it (it was summed three times a snapshot, by `craftView` and `foreshadow` too).
- `snapDelta.ts`: the land's `regrow`, `rich` and `rubble` objects (stringified every tick) are looked over at the pools' pace (`POOLS_EVERY`), like `wear`.

Test: `test/snapSpeed.test.ts` (the scoped total equals the plain one; a snapshot's party power equals the plain sum).
