## Sagas told plainly, and plainer recaps

Sagas now announce themselves and tell their whole story when they end. Changes the "Sagas" section of HISTORY.md.

- **Beginning** (`beginSaga`, `sim/sagas.ts`): the key notice reads "A saga begins: <title>. <blurb> Follow it under Trips, in Quests." The news bubble (`situationNotices`, `mobile/notices.ts`) also shows each saga under way (`saga:<run>:<turns>`, new again each turn) and any saga ended in the last 8 days (`sagaend:...`), both opening Trips > Quests.
- **Progress**: `SagaRun.turns` (optional) counts chapters. The Quests tab (`panel/expeditionsPanel.ts`) shows "Under way, turn N", and the card's details give day began, turns so far and where it stands.
- **Ending** (`finish`, `tellSaga`): a few short lines in order: how it began (day and blurb), how many days and turns it ran, who took part, the last two lines of the story, the ending, what it brought, and "It ended well / with mixed fortune / badly." Kept on `sagasDone[].story` (and `began`, both optional) and shown in the news bubble, the event box (`setOutcome`), the Journal and the finished saga's card ("What happened"). A saga that ends on a choice no longer has its outcome overwritten by the choice's short line.
- **While you were away** (`awayBefore`/`awaySummary`): sagas begun and ended in that time get a line each.
- **Wording**: `tellRaid` (`sim/raidRecap.ts`) and `awaySummary.ts` rewritten in short plain sentences ("harm" is now "damage", "felled" is "killed", "came out of the west" is "came from the west"). Tests that checked the old words were updated to match.
