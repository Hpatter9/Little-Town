## The Town and People menus redraw only for what the eye can see (changes HISTORY "The menus redone" / "Every menu in sub-tabs")

The phone's menus rebuild when their key (`panel.ts`) changes, and a rebuild under a finger loses the tap. The Town's key held the
whole `s.stock` (it changes with every haul) and the raw `s.ledger` (fractional day sums), and `craftingKey` (the crafting orders'
progress to the whole percent, every worn item) was added to it. Now:

- `buildKey` (`panel/buildPanel.ts`) drops `s.stock` and takes `ledgerKey` (the table's whole coins, as drawn).
- A new `townStockKey(s, tab)` adds the stock bits **by the open sub-tab**: Stores gets `storesKey` (the counts, the spare items, what is
  worn, the kind chip), Buildings gets the stock (its cost chips), Overview gets the food-days figure to the digit drawn plus the
  Workshops tile's order count and slots; every other tab gets none. `panel.ts` calls it with `tabKey('build')`.
- `craftingKey` (`panel/craftingPanel.ts`) is now its own part plus `storesKey`; the Market and Crafting menus keep what they had.
- Everything a button changes is still in the key (the sub-tab itself, the hide prefs, the kind chip, the direction, the powers...).
- The Town's key is now **scoped to the tab drawn** (`buildKey(s, tab)`): the powers' hourly countdown, the knights' honour and vows
  (`heritageKey`), the faith, the villages, the council's blocs and the ledger are in the key only for the tab that draws them, and the
  buildings' construction progress only for Buildings (the Buildings tab's stock is just the cost chips' "short or not": a count past the
  dearest building's cost changes nothing, `costChipsKey`). `subtabs.ts` `shownTab(menu)` is the tab the menu was last drawn on (null
  before the first draw: the whole key); `panel.ts` `keyOf()` uses it, and takes the key again after a draw so the settled tab costs no
  extra redraw. The sub-tab itself, the hide prefs, the kind chip, direction, pins, powers, laws, gods and the rest a button changes
  are still in the key of the tab that has the button.
- The People list was already patched in place (`patchTownsfolk`); it measured 0 redraws a minute before and after.

Measured on the late fixture on the phone page (393x852), the game run at 3x for 25 s a tab, redraws a minute **before -> after**:
Overview 22 -> 12, Buildings 48 -> 2, Stores 12 -> 0, Treasury 10 -> 0, People list 0 -> 0. What is left on Overview is what it draws
(the powers' "ready in Nh", the knights' tiles).

## The tactics board's mana bar (changes HISTORY "Tactics battles")

The caster's mana bar (a thin blue bar under the health, `tacticsView.ts` `drawBars`) was drawn at `y + 46..51` of the unit box, over the
"HP x/y · MP" line at `y + 48`. A box with a mana pool is now six pixels taller (`boxHeight`): the health text and the move line sit
below the bar, and the sideways layout's stacked box uses the real height. Checked on the fixture with a forced raid (a mage's turn) at 393x852 and 852x393: the bar sits between the health bar and the text,
nothing overlaps; the unit box's guild badge shows in its corner.

## The battle item pop-up in the fight view (changes HISTORY "Battle items in the townsfolk's pouches")

A drink or a throw was logged as an ordinary act (`pool: 'sp'`, cost 0), so the banner read "Ann · 0 SP" with no icon and no line.
`ExpeditionView.acts` now carries `item` (the kit item's id) and, for an item, its `text` (the line from `data/kitItems.ts`).
`fight/fightHud.ts` draws the item's icon (`itemIcon`) before its name, "Ann drinks" / "throws" / "uses" for the cost line and the item's
text under it; the banner has a `.item` look (`index.html`). A drink is quick, so the skill that follows it logged the same tick: while the
item is under 15 ticks old it keeps the banner (`fightHud.ts`). Seen with a forced skirmish at both phone sizes (Oil Flask with its icon, "Sir Aldric throws"
and its line; Healing Potion "Sir Aldric drinks", "Drunk in a fight when hurt: 40% of their health back.").

## Guild badges for the fallen, the raid bar and the raid recap (changes HISTORY "7. Guild badges in the fight HUD and the Chronicle")

- `Fallen.guild?: { role, name, lead }` is set in `recordFallen` (`sim/annals.ts`) from the guild the person is in at the moment of
  death (the guilds drop the dead at the next count). No random draws; old saves have none.
- `art/guildMarks.ts`: `fallenGuildMark(f)` and `guildMarkOrFallen(snapshot, id)` (the living guild, else the one the person fell in).
- Shown: the Chronicle's fallen cards (`panel/heroesPanel.ts`), the raid recap's defender rows (`battle/raidRecap.ts`, so a slain
  defender keeps theirs), the raid bar's fighter chips (`battle/battleHud.ts`, `hud.guilds` set per snapshot in `main.ts`) and the
  tactics board's unit boxes (`tactics/tacticsView.ts`; `guildBadge` takes a `painted` callback so the Pixi texture is refreshed once the glyph is drawn).
- Test: `test/fixes6.test.ts`.

## Culture tab with a populated town (changes HISTORY "Town personality and culture")

Checked on the late fixture with a culture of five held ways, three rising and a log (the fixture itself has none: it predates the update),
at 393x852 and 852x393, the cards opened too: no overflow (the body is never wider than the page), no empty sections, nothing to fix.

## Battle items bought in the shop; raiders drink their potions (changes HISTORY "Battle items in the townsfolk's pouches")

- `buyKit(s)` (`sim/wages.ts`, run hourly with `buyGear`, autopilot only): each grown-up with a calling (`carriesKit`) and room in the
  pouch buys the next battle item they would carry (`kitWant`, `sim/kit.ts`, the same wish list the stores' hand-out uses) that is on the
  shop's shelves, at the same local price as gear (`localPrice`), if they can pay it over `SAVINGS_KEEP`; the coins go to the treasury
  (`earn(s, 'townsfolk')`), fighters first, one a person an hour.
- `raiderPouch(s, rd)` settles once (side stream `kit:raider:<id>`, `RAIDER_POTION` 0.12) whether a raider of the people kinds carries a
  potion, and keeps it on the raider (`Raider.kit?`). `raiderDrinks` drinks it under `HEAL_BELOW` (half) health, at the raider's turn on
  the raid map (`battle.ts`) and on the tactics board (`tactics.ts`, with a heal number and the tend effect). `raiderPotions` (after the
  raid) now hands over only the potions the fallen did *not* drink, so the chance of a find is the same overall.
- Tests: `test/kit.test.ts`.

## Alignment sayings in the town's speech (changes HISTORY "Town alignment" and "Town personality and culture")

`ALIGN_SAYINGS` and `alignTone` in `data/alignment.ts`: lines by topic for a town of the light (score >= `GOOD_AT`) or the dark (<= `EVIL_AT`).
`cultureView` (`sim/culture.ts`) mixes them into `CultureView.sayings`, which the map's speech already reads
(`speech.ts` `setTownSayings`, `SAYING_SHARE`). No new draws. Test: `test/fixes6.test.ts`.

## The banner and lamp tint by alignment (changes HISTORY "Town alignment")

Checked with `__align(80, 0)` and `__align(-80, 0)` on the late fixture: the page veil is gold or violet at both phone sizes; the map's one banner takes
`fff2cb` (good) and `d4bed8` (evil) from white (read off the live sprite; it is outside the default view, so only its tint value was seen), and at
night the street lamps' glow is warm yellow (good) and pink-violet (evil) at 393x852. Nothing needed fixing.

## The trade empire's ships sail with the fleet (changes HISTORY "Trade empire" / "Seafaring and islands")

- `sim/boats.ts`: `shipKind(s)` (the best of the town's fleet, else the best the town can build, else the first age's dugout) and
  `tradeShips(s)` (the empire's ships out on a voyage as boats away). The snapshot has `tradeShips`; `main.ts` hands them to `MapBoats.update`
  with the fleet, so they sail the same lane in the same sprites (nothing is drawn where the town has no mooring).
- The world map's marches carry `boat` for a ship (`empireOnMap`); `panel/worldMapView.ts` draws that boat's art in the token
  instead of the emoji (`boatToken`).

## Gossip and diaries from the intrigue's whispers (changes HISTORY "House intrigue" and "Everyone's own story")

- New gossip kind `whisper` (`data/gossip.ts`: sayings, replies; counted as bad news). `whisperGossip` (`sim/gossip.ts`) reads the
  intrigue's live whispers as talk (newest two, within `GOSSIP_HOURS`); the snapshot's `gossip` adds them after the journal's news.
  Read from state only, nothing is added to it.
- The diary (`sim/diary.ts`): `DiaryFacts.secret` is the first of `secretsAbout(s, p)` in the keeper's own words (`secretLine`: a debt,
  a lover, a hidden crime); about half the days it is written down (salt 41 of the diary's own hash rolls).
- Test: `test/fixes6.test.ts`.

## Sim hashes (`tools/sim-hash.mjs`), before and after

| | before | after |
|---|---|---|
| fixture (7 days caught up) | 45ba0aed2e31 | 288fc7ea0f32 |
| hash-a settlers | 5aa972e69df5 | abe1f840a3eb |
| hash-b knights | 8dd273d97ac8 | 38fab81d9136 |
| hash-c vampire | 0079254d1741 | c5c3fe891d3c |
| hash-d dwarves | 3859f268259d | 79489e80e179 |

- The **fixture** moved only because `Fallen.guild` is a new field in the serialized state (written in the fallen records and the memorial copies
  of them). With that field's text taken out of the serialized state before hashing, the fixture hash is 45ba0aed2e31, the same as before: no
  random draw or rule changed in it. (With the battle-item changes left out of the tree it is 288fc7ea0f32 too: it has no raids in those days.)
- The four **new towns** are unchanged (5aa9..., 8dd2..., 0079..., 3859...) by every item except the battle-item rules (the shop's kit buying and the
  raiders drinking, with `raiderPotions` reading its draw from the new `kit:raider:<id>` side stream instead of `kit:<tick>:<id>`): with `kit.ts`,
  `wages.ts`, `battle.ts` and `tactics.ts` left out they match the old hashes exactly. That move is the new rule, with its tests, not a stray draw.
