## The first-town tutorial

A short guided start for a NEW town, built on "The first hour" (tips, `mobile/tips.ts`) and the pop-up hold
(docs/notes/pause-popups.md), not a second tips system. Eight steps, each ringing the real control: look around (drag, pinch),
the ♛ founder button, the Town tab (the founder orders every building; the town picks the spot and recommends), the Studies
tab (three topics, pick one), the coins and materials readout, the ⛏ Clear land button, the fog, and pop-ups (✕, the ❓ button).

**Files**
- `mobile/tutorialSteps.ts` (pure, no DOM): `TUTORIAL_STEPS` (id, title, text, target, `done`), `stepDone(i, facts)` with
  `TutorialFacts` (`opened` menus since the step began, `moved`, `clearing`), and the storage rules (`littletown.tutorial`:
  `tutorialFounded` sets 'pending' unless it is already 'done'; `tutorialPending`; `tutorialFinished` sets 'done'), plus the
  `tutorialActive` flag.
- `mobile/tutorial.ts`: the cards. `createTutorial({ bridge, strip, zoom })` returns `start()`. A step starts "reading": a
  light veil (`.tut-veil`, registered with `holdWhileUp`) holds the town while the card is up. "Show me" drops the veil, the
  town runs, and the step is done by the thing itself (`stepDone`, polled every 300 ms) or by Next. Steps with nothing to do
  (the fog, pop-ups) end on Next / Done. Skip ends it for good. The card sits in the half of the screen away from its control
  (the tabs are at the bottom upright and at the top sideways: read from `#tabs`), and is hidden while a menu, a fight or the
  event box has the screen. The ring for ⛏ (a button inside the strip's iframe) is scaled by the strip's own scale.
- `mobile/mobile.ts`: makes the tutorial, starts it on the loading screen's `onReveal` when one is pending, and ☰ Settings →
  Help has "Replay the tutorial" (not offered from the main menu's Settings). Tab buttons carry `data-panel`.
- `mobile/mobileBridge.ts`: `newGame` calls `tutorialFounded` before the reload, so only a freshly founded town is shown it; a
  loaded save never is.
- `mobile/notices.ts`: the tips' notices wait while the tutorial runs (`tutorialActive`).
- Leaving the ⛏ step with Clear land still on turns it off.

Tests: `test/tutorial.test.ts` (when each step is done; the waiting steps; the flag: new town once, never again).
Checked in a phone preview (393x852 and 852x393) from New game through all eight steps.
