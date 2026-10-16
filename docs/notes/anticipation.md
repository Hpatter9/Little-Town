## Anticipation: hints, open threads and the days ahead (the owner's aim: a reason to come back)

- **Foreshadowing (`sim/foreshadow.ts`):** `foreshadow(s)` looks at what the town already has coming or brewing and
  says it as a few short hints in the town's voice, no numbers: a raid within `RAID_SEEN_HOURS` (12) of
  `nextRaidTick` ("Scouts saw campfires to the east"), a party on its way home within `PARTY_SEEN_HOURS` (24), a
  married couple with room for a child ("have cleared a corner for a cradle", `BIRTH_TALK` a day), a couple close to
  `MARRY` talking of a wedding, a wedding feast tonight (`feastDue`), a trial waiting (`politics.trial`), an unslain
  dweller in an opened depth of the Underdark, an envoy riding in (`envoyRider`) or a known power's riders seen
  (`ENVOY_TALK`), the season's last day, the festival two days off, tomorrow or this evening, two or more sick, food
  under `STORES_LOW_DAYS` (3), a caravan within `CARAVAN_SEEN_HOURS`. Each `Hint` has a `key`, `kind`, `hours` and
  `sure` (0..1). The player can't be sure: a true hint is spoken on `VOICED` (0.85) of days, and some are false
  alarms (campfires with no raid within `FALSE_RAID_CLEAR_HOURS`, `FALSE_RAID` a day; a cradle or riders that never
  come). `hintCandidates` gives every hint, voiced or not (the tests); `foreshadow` the nearest `HINTS_MOST` (4)
  spoken. It reads the state only and keeps nothing: every roll is a side stream by the day
  (`${seed}:foreshadow:<day>:<key>`), so a hint holds all day; off with the autopilot. The sim-hash doesn't move.
- **Shown:** `Snapshot.foreshadow` (optional). The top bar's turn (`ui/topBar.ts` `topLines`) takes them first, marked
  ⏳, behind any urgent line and ahead of the news. The news bubble (`mobile/notices.ts` `hintNotices`, added at the
  end of `situationNotices`) shows each as a blue ⏳ notice keyed `hint:<key>` with a line after it by kind
  (`HINT_AFTER`). Changes "The news bubble".
- **Open threads on the return card (`openThreads`, `sim/awaySummary.ts`):** after the recap, one to three lines
  (`THREADS_MOST`) of what's still hanging: a party still out (and where), a power's host on the march, a child of two
  ascended parents growing (or the mythic omen: the old powers stirring), then the nearest hints, one of a kind. They
  come only after something worth a card (a quiet absence still shows none), with the new tone `next` (dashed,
  italic, ⏳; `#away-card li.next` in `renderer/index.html`). Changes "A plain return" / "Catch-up without recaps"
  (still short: no padding).
- **The calendar (`sim/calendar.ts`):** `upcoming(s)` gives the next `CALENDAR_DAYS` (a season, today first) with
  what the town knows of them: the first day of a season, the festival on `FESTIVAL_DAY` (autopilot), the weekly rite
  where there's a shrine (`faith.lastRite` + `RITE_EVERY_DAYS`), the caravan expected (`nextCaravanTick`, with a
  market), the Guild's hunts closing (`hunts[].until`), and omens: a seer at home (`SEER_CLASSES`: white mage, shaman,
  witch, druid, chronomancer; the Fate-touched road `fateTouched`, `FATE_OMEN_CHANCE` 0.9 against `OMEN_CHANCE` 0.5)
  marks a day of each season with a vague omen (`omensFor`, side stream `${seed}:omen:<season>:<seer>`, at most
  `OMENS_MOST` 2, `guess: true`; whether it comes true is chance). Other systems add dates with
  `addCalendarSource(id, (s, from, to) => entries)`; the favourites' name-days (`nameDays`, sim/favourites.ts) are read in directly (kind `name-day`).
  `Snapshot.upcoming` (optional).
- **The days ahead (`panel/calendarStrip.ts`):** a folded section in the Town's Overview (`GROUPS` in
  `panel/subtabs.ts`): a strip of the days, five to a row (ten sideways, `min-width: 640px`) (`.cal-day.ui-frame`, today ringed, a mark per entry with
  its `data-tip`), then a line per date (`.cal-row.ui-chip`, omens in italics) under a `.ui-divider`. Read-only;
  `calendarKey` is in `buildKey`. Tests: `test/anticipation.test.ts`.
