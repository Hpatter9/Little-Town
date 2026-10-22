## Werewolves in wolf form (iso), and the day's clock held in fights

**The wolf form in the isometric view.** A Moon Pack werewolf in its form (`mapPeople.ts`'s `wolfNow`: `monster === 'werewolf'`
on a full-moon night or in a fight) now wears `art/iso/folk/werewolf/man_beast` through the iso folk sprite, instead of the
old top-down figure. `FolkSprite.update(..., face, wolf)` takes a `wolf` flag: it picks `{ people: 'werewolf', look: 'man_beast' }`
(`WOLF_LOOK` in `iso/folkSprite.ts`), always bare (no armed suffix), and uses `variantOf(st.id)` as for the human look, so
the tint matches. `man_beast` stays out of `FOLK_LOOKS`, so it is never an everyday pick. Its walk, idle, `attack_1h` (the
punch) and death play; anything it lacks falls back through the usual chain. Still on the old sprites in the iso view: a
people's own calling forms (`roadForm`: a Bonewright's skeleton, a Gearwright's robot) and shapeshifters' beast shapes
(`v.beast`), as before.

**The day's clock holds in a fight.** `GameState.fightTicks?` (optional; missing in old saves = 0) counts the ticks the town was
held for a fight on screen. `fightClock` (`sim/popups.ts`) adds one per fight tick, alongside `s.tick++`. `s.tick` still
counts, so the battle's timers, raid arrival and everything keyed on it behave exactly as before. The calendar reads
`clockTick(s) = s.tick - fightTicks` (`sim/time.ts`): `calendarOf(s)` replaces `calendar(s.tick)` at its ~200 call sites, so the
hour, light, season and the top bar's clock wait during the fight and start again after it. Nothing is stored that can stick.
- Hour-of-day gates that also test `s.tick % TICKS_PER_HOUR` (ageing at 3, dynasty at 5, sea at dawn, the Blood Court's tithe,
  intrigue) now test `clockTick(s) % TICKS_PER_HOUR`, so they stay on the clock's hours after a held fight. Other hourly systems
  keep `s.tick % TICKS_PER_HOUR` (they fire hourly, on a phase that may differ from the clock's hour).
- Absolute ticks stored earlier and turned into a date (`calendar(p.bornTick)`, log days, `weather` spells) are left on
  `s.tick`; their dates can read a little later than the clock by the time held. `shop.ts`'s lodging morning and
  `raidOdds.ts`'s probe hour subtract `fightTicks` when they pick their tick.
- Changes HISTORY.md "Pop-ups hold the town / Fights: the town holds" — its "calendar moves with the fight" limit is gone.
- Tests: `test/fightClock.test.ts` (clock still through fight ticks and resuming; a raid battle holds the hour while
  `s.tick` counts; an old save reads the plain calendar).
