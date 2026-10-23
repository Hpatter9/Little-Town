## Five peoples to found a town as

The owner's call (October 2026): each people's animations cost a lot to draw, so a new town is founded as one of five
peoples: the **Settlers, the Deep Hold (dwarves), the Exiled Order (knights), the Lich and the Blood Court
(vampire)**. The other eight (druids, Moon Pack, machines, merfolk, nomads, fae, alchemists, orcs) are hidden from new
towns only; their code and data stay whole so they can come back. This changes "Origins in general" (and "Origins are
done").

**The switch** (`data/origins.ts`): `PLAYABLE_ORIGINS`, the ids a new town can be, and `isPlayableOrigin(id)`.
`ORIGINS` is untouched: it is still every people the sim knows (saves, rivals, strangers, tables keyed by origin).
To offer a people again, add its id to `PLAYABLE_ORIGINS`.

**Where it is used:**
- The New town screen's first step (`panel/newGamePanel.ts`, `drawOrigins`) lists `PLAYABLE_ORIGINS` (five tiles).
  The founder, scenario, place and danger steps follow the chosen people, so a hidden people's three ready-made
  founders (`data/founders.ts`) are never shown. The four scenarios belong to no people and are unchanged.
- `cleanNewGameOptions` (`data/founding.ts`, the check on what the panel sends, on the phone in `simHost.ts` and on
  the desktop in `main/main.ts`) accepts only a playable origin, and a ready-made founder (`founder.pick`) only of
  the chosen people. Anything else is refused (null), as any other bad choice is.
- There is no random or "surprise me" pick of the player's people: left out, a town is the Settlers, as before.
- `README.md`'s Origins section says which five are offered.

**Old saves:** nothing in `sim/` reads `PLAYABLE_ORIGINS`. `newGame` still founds any origin (tools such as
`ORIGIN=druid node tools/make-save.mjs` and the tests use that), and a saved town of a hidden people loads and plays
exactly as before.

**Left as it was (NPCs; no balance or random-stream changes):** rival lords and their spells (`sim/rivals.ts`), the
realm's powers, envoys and war hosts (`sim/factions.ts`), rising powers, strangers and their kinship
(`sim/strangers.ts`, `data/kinship.ts`), visiting bands (`sim/bands.ts`), faction caravans (`sim/trade.ts`), and the
conquest's realms (switched off). All still draw from every people in `ORIGINS`. Their art holds up: every hidden
people still has its own isometric cast (`iso/folkRules.ts` `FOLK_LOOKS`), so a druid or orc newcomer in a settlers
town is drawn as one; nothing falls back badly.

**Tests:** `test/playableOrigins.test.ts`: the founding choices are exactly the five, a hidden people's origin and its
ready-made founders are refused, and a town of each hidden people survives a save and load and keeps stepping. The
tests that loop over `ORIGINS` (balance, research, seats, `newTownRuns`, founders' data) still test every people,
since old towns run them.

**Screenshots** (`docs/notes/five-origins/`): the New town screen at 393x852 and 852x393 with five peoples, and a
druid save (`ORIGIN=druid`) loaded and playing at both sizes. Sideways (852x393) the New town screen's tile row is
squeezed by the description pane below it, so the five tiles show only their tops: that is the panel's existing
sideways layout (not changed here), left for a later fix.
