## The settlers only

The owner's call: "let's simplify even more. Only using the settlers. Once that's perfect we can bring in the others."
Changes "Five peoples to found a town as" (`docs/notes/five-origins.md`, `orcs-for-knights.md`).

- `PLAYABLE_ORIGINS` (`data/origins.ts`) is `['settlers']`. The other twelve peoples stay in the game, whole: older
  towns of theirs load and play as before, and they still turn up as strangers, rivals and powers. Adding an id back
  to the list offers it again (and brings back the New town screen's first step).
- The New town screen (`panel/newGamePanel.ts`) skips "Who founds the town?" while only one people is playable
  (`FIRST`): it opens on the founder, counts its steps from there ("Step 1 of 6"), and Back stops at it.
- Their art made so far (Oct 22-23: casts, children, tools, weapons, run and hurt for dwarves, orcs, lich, Blood Court,
  knights) stays in `art/iso/folk`, ready for when each comes back.

Tests: `test/playableOrigins.test.ts` (only the settlers offered; every hidden people's older town still steps).
