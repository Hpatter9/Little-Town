## Favourites, obituaries and close calls

Stakes you feel (the owner's aim: the player cares about particular people, and a death lands). Three parts, none of
which changes how a town plays: no draws from the town's stream, no ids taken, and no rule reads any of it.

**Favourites** (`sim/favourites.ts`). The player may follow up to `FAVOURITES_MOST` (3) townsfolk: the ♥ beside the name
on the character sheet (`panel/personCard.ts`, the `favourite` command: `{ type: 'favourite', id, on }`, checked in
`sim/commands.ts`, applied in `sim/sim.ts` through `setFavourite`; `favouriteRefusal` says why not). Kept on the optional
`GameState.favourites` (dropped when empty); older saves have none. A view preference only.
- The "While you were away" card (`sim/awaySummary.ts`, changes "A plain return"): `awayBefore` notes the favourites
  (`favourites`, with their names), and `favouriteAwayLines` puts one line each first: died (and how), their close call
  since, or "♥ Mira is well: working at the forge" (`describe`, now exported from `sim/snapshot.ts`). A favourite's death
  or leaving is not told again below. A favourite who is simply well is no reason for the card by itself.
- The news bubble (`mobile/notices.ts`, changes "The news bubble"): `stakeNotices`, one separate pass over the Journal's
  notices: a line naming a favourite (living, or died since) gets a ♥ (title and mark); a close call is gold, marked ✚,
  with who it befell; "X has died" gets an "Obituary" button (kind `obit`); a dead favourite's funeral line ("…to lay X
  to rest", "…to bury its dead: …") gets "Watch" (kind `funeral`).
- The top bar's turn of lines (`ui/topBar.ts` `topLines`): "♥ Mira: working at the forge", a different favourite each
  game hour.
- The People tab (`panel/townsfolkPanel.ts` `followedRow`): their faces at the top, a tap opens each (with "Away",
  "Down!", "Shaken" or their doing). With nobody followed, the tip "Tap ♥ on someone to follow them." shows in one
  sitting only (`littletown.favouriteTip`). `townsfolkKey` has `s.favourites` and the inspected one's `shaken`.
- A favourite's death (`favouriteDied`, from `recordFallen`): their slot frees, and their id goes on
  `s.favouritesGone` (the last `FAVOURITES_GONE_KEPT`, 6). The phone page (`mobile/obituaryReveal.ts`
  `watchFavourites`) shows their obituary card once (`littletown.favouritesMourned`), with the last line "Your place
  among the followed is free."
- Name-days for the calendar: `nameDays(s)` gives each favourite's season and day (the day they were born; for those
  born before the town or come from elsewhere, a day their id gives).

**Obituaries** (`sim/obituary.ts`, changes "The annals"). `recordFallen` keeps `Fallen.obit` (optional; older fallen have
none), written once as they die so it never shifts: `age`, `line` (their nature's own words for how they died,
`data/natures.ts` `say` by `topicOfCause`: old, hungry, sick, sea, raid, else idle; picked on the side stream
`${seed}:obit:${id}`), `leaves` (partner, children), `known` (their two biggest deeds in words, `DEED_WORDS`, raiders
felled, trips; "leading the town" for the leader), and their `look`, `gear`, `cls`, `stage`, `founder` for a portrait.
`obituaryLines(f)` tells it in a few lines. Note `s.honoured` (sim/memorials.ts) holds the same fallen record, so the
obituary shows there too.
- The portrait of the dead: `art/fallenFace.ts` `fallenFace(f, size)`, from the kept look (Himeko layers); the strip's
  `__picture({ fallen })` draws it for the page.
- Shown as a card: for favourites, by itself; for anyone, from the news line's "Obituary"; and in the Chronicle's
  Heroes tab, where each of the fallen now opens on a tap to show it (`panel/heroesPanel.ts` `obituaryBox`, open ones
  kept in `openFallen` across redraws).
- The card's one button, "Watch": the strip's `__showOnMap({ funeral: id })` (`main.ts`) takes the camera to a funeral
  under way, else their grave (`graves.posOf`), else the graveyard. Read-only. Funerals themselves are unchanged
  ("Step 7, life's ceremonies"): every funeral is already announced in the Journal, naming the dead; a favourite's gets
  the ♥ and "Watch" in the news.
- The card itself is `mobile/revealStub.ts` `showReveal(card)` (`RevealCard`: key, kicker, title, lines, art, tone,
  actions), a stand-in for claude/reveals' `mobile/revealCard.ts`; when that lands, the import in
  `mobile/obituaryReveal.ts` moves to it and the stub goes.

**Close calls** (`sim/closeCalls.ts`). `closeCall(s, p, text)` where someone nearly died and did not, at events that
already fire:
- bleeding stopped by a townsperson (`sim/people.ts` `doTend`): "Bram nearly bled out in the raid; Osric stopped the
  bleeding.";
- a medkit on the spot (`sim/health.ts` `knockDown`);
- a raid that left someone standing with `SLIVER` (20%) of their health or less, told as the recap is put together
  (`raidCloseCalls`, from `sim/raidRecap.ts`), which also adds the raid's close calls of those who fought to the
  recap's story;
- a cave-in dug out alive, a flood below survived (`sim/underdark.ts`);
- a plague that turned (`sim/doom.ts` `spreadPlague`).
Kept on the person (`Person.closeCalls`, the last `CLOSE_CALLS_KEPT`, 3) and the town (`GameState.closeCalls`, the last
`TOWN_CLOSE_CALLS`, 40, each with `after`: the last id taken when it happened). The Journal's view (`journalView` in
`sim/snapshot.ts`) weaves them in just after that entry (a fractional id, `close` naming who), so they are in the
Chronicle and the news without taking an id or a place in `s.journal`. "Shaken" shows on their card and in the
followed row for `SHAKEN_HOURS` (12) after (`PersonView.shaken`, `isShaken`): a label, no effect. Their diary
(`sim/diary.ts` `nearly`) tells it in their words that day ("I nearly bled out; Osric stopped the bleeding. I could have
died.", `nearlyMine`) and for `NEARLY_DAYS` (3) after ("I keep thinking of how close I came.").

**Checks.** `test/favourites.test.ts`: the command's limits, a favourite's death, older saves, the obituary builder, the
close calls (medkit, tending, a raid's sliver) and their place in the Journal, the away card's order, the news marks.
`tools/sim-hash.mjs`: hash-b, hash-c and hash-d unchanged; the fixture and hash-a change only by the new fields (an
obituary on each of the fallen and on `s.honoured`, close calls on people and the town, recap lines): with those
stripped, all five match main.
