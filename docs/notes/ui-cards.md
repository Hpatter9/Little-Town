## The rich cards (UI overhaul)

Renderer and phone page only: no sim change (`tools/sim-hash.mjs` identical). Styles are in `panel/cardsStyles.ts`
(`addCardStyles()`, once a page), plain classes the look can restyle. Changes these HISTORY.md sections: "Tap for more",
"Events told in full", "A recap after every raid", "The annals", "Watching a party's fights" (the scene player is reused).

**Person card as a character sheet** (`panel/personCard.ts`, `personSheet`). Portrait (`face`) with guild badge and calling
emblem, bars (`.pc-bar` hp/mp/mood/food), chips (`.pc-chip`: calling, age, nature, job, titles, guilds), tabs `.pc-tab`
Story / Skills / Kin / Kit. Kin and relations are tappable `.pc-rel` portraits (kin from `s.families`, others by name).
`townsfolkPanel.ts` draws it first for someone inspected (`sheetOn`); "All details…" goes to the older page (stat points,
evolutions) and "Character sheet" comes back. `personSheetKey()` is in `townsfolkKey`.

**Building card** (`panel/buildingCard.ts`, `buildingCard`, `buildingCardKey`). Sprite with state chips (`.bc-state`),
people portraits, progress rings (`.bc-ring`) for orders and crops, needs (`.bc-need`). `InspectInfo.building` (ipc.ts) is
set by main.ts; `mobile/mobile.ts` draws the card under the title, redrawing when the key changes.

**Event story card** (`mobile/eventSheet.ts`). A moving scene above the choices: `eventFamily(kind, title, text)` picks one
of `EVENT_SCRIPTS` (`sceneScripts.ts`: raid, stranger, plague, storm, feast, envoy, miracle, cult, death, war, trade, wild,
omen, road, council, generic) played by `playScene` with the subject's doll first. The recommended answer carries a wax
seal (`.ev-seal`); an answer gives a gold flash and sparks (`.ev-flourish`).

**Raid recap strip** (`battle/raidRecap.ts`, `strip()`). Four panels (`.rs-panel`: warning, clash, turning point, aftermath)
from `recapScript` (`sceneScripts.ts`; raiders' sprites by raid kind in `raiderSprites`), captions derived from the recap
(boss fall, best defender, towers, mercy, breach), chips (`.rs-chip`) for who fell and shone, existing text beneath.

**Chronicle timeline** (`panel/timelineStrip.ts`). Years as ticks, marks for deaths (from the hall), raids, miracles, wars,
founder changes and festivals (journal lines matched by words); tap one to read it; "now" marked; scrolls sideways.
`renderJournal` takes `nowDay`.

**Tab cross-fade.** `.card-fade` (200 ms) on a sheet body when the tab or person changes, not on every redraw.
