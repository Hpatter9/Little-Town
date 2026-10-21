## No time away

The game only runs while it is open. Nothing is simulated for the time the app was closed or the page was hidden
(the owner's call, October 2026). This replaces the HISTORY.md sections "Offline pacing", "Raids wait for you", "A plain
return" and "Catch-up without recaps", and the away parts of "Choice events" (a choice event holding the town while
away) and "Phone alerts".

**What it does now**
- A saved town resumes exactly where it was saved, on the phone and the desktop (`simHost.ts` no longer calls any
  catch-up; the save's `savedAt` is only shown in the save list).
- `GameLoop.hidden` (set by the page's visibility events through the `hidden` message, and by the desktop's lock
  screen and fullscreen hiding) holds the clock: `pump()` resets `last` each tick, so the game stands still and
  carries on from the same tick when visible again, with no time owed. `held` (the loading screen) works the same.
  The player's own pause (`s.paused`) is never touched. The page already saved when going hidden (`hidden` message).
  Note: on the desktop the strip hidden behind a fullscreen app now also stands still.

**Deleted**
- `sim/offline.ts` (`awayPlayMs`, `awayRealMs`, `startCatchUp`, `catchUp`, `MAX_OFFLINE_MS`), `sim/awaySummary.ts`,
  `renderer/awayCard.ts` (the "Catching up…" screen and the "While you were away" card), their CSS, the
  `littletown:away-seen` event and `readAbsence` in `mobile/notices.ts`, `Snapshot.catchingUp` and `Snapshot.away`,
  `GameLoop.catchUp`/`catchingUp`, `favouriteAwayLines`, `openThreads`, `sim/highlights.ts` (the old morning report,
  already unused), `holdForEvent`/`holdEventClock` and `Event.held` (events.ts), `Raid.waiting`/`Raid.alone`, the
  gate prompt (`holdAtGate`, `openGate`, `raidAtGate`, `RAID_WAIT_MS`, `raidDueTick`).
- `sim/raidWait.ts` keeps only what protects the open game: `fightOnScreen` and `holdForFight` (a fight on screen stops
  the questions' clocks and nothing pops up over it).
- Phone alerts for a time away: `sim/forecast.ts`, `alerts.ts` `plan`/`scheduleAlerts`, and the simHost's look ahead are
  gone (an alert for something that can no longer happen while closed would be false). `alerts.ts` keeps the test
  alert, `cleanAlerts` and `cancelAlerts` (drops alerts an older version booked). The alerts panel and its settings
  are left as they were; the owner may want them removed too.
- README's wording about catching up; tools `perf-sim.ts` and `sim-hash.ts` now just step 28,800 ticks.

**Saves:** unchanged format. Old saves with `raid.waiting`/`alone`, `event.held`, a 'gate' prompt or old "While you
were away" journal entries load fine; the fields are ignored (a gate prompt, if answered, simply closes; a town left
paused by an old held event stays paused until the player unpauses).

**Tests removed (they covered only the deleted behaviour, not loosened):** `awaySummary.test.ts`, `raidWait.test.ts`,
`forecast.test.ts`, `highlights.test.ts`; the catch-up tests in `save.test.ts`; the away-card tests in
`favourites.test.ts`, `anticipation.test.ts` and `notices.test.ts`; the phone-alert and away-event tests in
`events.test.ts` and `hero.test.ts`. Added: a hidden page holds the game still and resumes with no catch-up
(`fightHold.test.ts`). `runtime.quiet` (watchAsk.ts) is kept: the tests use it.
