## Pop-ups hold the town

The owner's ask: the game pauses on any pop-up, such as events or fights. The "is a pop-up open" logic is in one place,
`sim/popups.ts` (`holdOf`), plus a small registry for cards only the page knows of (`mobile/popupHold.ts`). This extends
"A fight on screen holds the game" (`fightOnScreen`, `holdForFight`, HISTORY.md) and the loading screen's `held`.

**In the sim (`src/shared/sim/popups.ts`)**
- `holdOf(s)` returns `'fight'` (a raid's battle or tactics board, or a watched party/skirmish/bout fight, i.e.
  `fightOnScreen`), `'popup'` (a question for the player is up) or `null`. Nothing when `paused` or `gameOver`.
- `blocksTown(prompt)`: every question except the raid's own (its clock runs with the fight) and the gate's (the town is
  already paused for it), and except one that has already held the town `POPUP_MOST_TICKS` (6000, ten real minutes).
  That is the way out for a question nobody answers: `Prompt.stood` counts the held ticks, and past the cap the town goes
  on and the question's own clock times it out as ever.
- `EVENT_BOX_KINDS` is the list of questions that open the event box; the box (`mobile/eventSheet.ts`) and the strip's
  small card (`main.ts`) both read it now, instead of two copies of a long `||` chain.
- `Sim.step(hold)` / `Sim.advance(..., hold)`. With `'popup'` the tick applies the queued commands (so the answer lands) and
  nothing else, and counts `stood`. With `'fight'` it runs `fightStep`. With `null` it is the town as ever. The hold is a
  parameter, so headless runs (tests, time away, `holdForEvent`) play exactly as before.
- `GameLoop.pump` asks `holdOf` every frame, so a hold clears the moment its question is answered, skipped, timed out or
  removed. Nothing is stored that could stick. A raid being skipped (`raidSkip`) does not run flat out over a question.

**Fights: the town holds, the fight plays** (`Sim.fightStep`). The raid battle and the watched fights run on the town's
`s.tick`, so the tick still advances while a fight is on screen. What runs in a fight tick: `fightClock` (tick +1, the
questions' clocks held), `fightSpeedTick`, the defenders on the trail (they still walk to their spots, because the
set-up waits until they stand there), `updateRaid`, and for a watched party/skirmish/bout `updateExpeditions`,
`roamersTick`, `arenaTick`. Everything else stands still: the other townsfolk's needs, work and walking, the hourly
systems, farming, other raids and events, weather. Two honest limits: the calendar (time of day) moves with the fight's
ticks, since `calendar(s.tick)` is read in some 200 places and a separate fight clock would mean rewriting them; and a
watched party's trip and the other parties go on, since they run in the same `updateExpeditions` as the fight. Mine, Deep
and portal views are watches of a party or delve, not fights stepped on their own, so they follow the party rule.

**On the page (`src/renderer/mobile/popupHold.ts`)**
- `holdWhileUp(el)` registers a card's element once. It holds the town while the element is in the page and not hidden,
  checked every 250 ms, so closing, hiding or removing it releases the hold with no call to remember. One unbroken hold
  is cut at ten minutes (`MOST_MS`). A card in the strip's document (the raid recap) is read through
  `window.__cardUp`, and the page is the only one that tells the host.
- `Bridge.holdCards(on)` becomes `{ t: 'cards', on }` for the host (`shared/simHost.ts`), which sets `GameLoop.cardsUp`:
  the loop steps with `'popup'` (a fight on screen still wins and plays).
- Registered: the event box (`eventSheet.ts`, including its page of "what came of it"), reveal cards (`revealCard.ts`:
  rare things, a haul, favourites' obituaries and milestones all go through it), and the raid recap (`battle/raidRecap.ts`).

**What holds the town now:** every sim question except the raid's and the gate's (events, fateful and secret events,
sagas, road events, debriefs, envoys, the dragon, evolutions, refugees, villages, council/trial/revolt, a people's
"ways", the Great Enemy, strangers, rites, thirst, visitors; disputes, duels, deals and naming come through these);
a cutscene (it already paused the sim: `s.paused`); the event box's outcome page; reveal cards; the raid recap; and the
fights above. The founder's death is `gameOver` (the sim stands still); the heir choice is a new-game card, so no town is
running. Not held: the news bubble, tips and toasts.

**Tests:** `test/popups.test.ts` (a question stops the clock and answering restarts it; the ten-minute limit; the raid's
own question does not hold; a raid battle plays through its set-up while an idle townsperson's needs and place stand still).
Checked in a phone-size preview (393x852): the clock stood still with an event up and ran on after the answer.

**Close buttons, and choices that wait** (the owner's addition)
- Every pop-up has a corner ✕ (44 px): the event box (`.event-x`), reveal cards (`.reveal-x`), the raid recap and the "While you
  were away" card (`.rr-x`), the strip's small question card (`.prompt-x`). Closing releases the hold (the registry reads the element).
- A choice closed unanswered is **parked**: `Prompt.parked`, commands `parkPrompt` / `openPrompt` (`sim/popups.ts`). A parked
  choice no longer holds the town; its clock is cut to `PARK_WAIT_TICKS` (6 game hours) if longer, and `expirePrompts` then
  answers it with its default (the same pick as ever), which removes it and its button. Not parkable (`canPark`): the raid's own
  question, the gate's, and a debrief (closing that is reading it).
- The button: `mobile/waitingChoices.ts` (`#choices-bubble`, "❓ N", under the news bubble) opens the oldest parked choice
  (`openPrompt`). The desktop strip has its own small "N choices waiting" button (`overlayUi.ts`, `PromptCard.waiting`).
  `PromptView.parked` / `pinned` carry it to the renderer.
- **Founder choices:** a question with `Prompt.waits` (founder quests, disputes, duels, deals: main's `waitingOnFounder`) holds the town until answered even when closed, never times out, and the card says so
  ("The town waits for your answer"); its button is red. Nothing in main sets it yet: the founder-led quests (not on main) should set
  it on their questions. There is no heir-choice question on main (the founder's death with no heir is `gameOver`), so nothing to do there.
- Tests: park/open/auto-resolve/pinned/not-parkable in `test/popups.test.ts`. Phone preview (393x852, 852x393): the ✕ closes the box, the clock runs
  on, the "❓ 1" button reopens it, and the clock stands still while the box is up.
