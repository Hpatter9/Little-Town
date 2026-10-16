## Tap anything for its card, and the story of every unique (the owner: "Make it so nearly everything is clickable with some sort of information. I went to look at the legendary unique weapon we made and I can't click on it. I want to know all about it. Like who made it, what makes it unique, and who's using it, etc.")

Changes the HISTORY.md sections "Unique weapons and boss loot" (the record kept), "Tap for more" (cards over the menus),
"Reveals: rare moments, opened hauls and the legends shelf" (the Shelf's tiles, the reveal card's "More about it", the
haul's unique line), "The news bubble" (an "About it" action), "A queued study's card opens under its row" (the tappable
look now shared), "The annals" (the Chronicle's lines) and "Favourites, obituaries and close calls" (the obituary's
names).

**The story of each unique** (`sim/provenance.ts`). Kept on the optional `GameState.uniqueLog` (`UniqueRecord` by item
id), noted where the thing already happens, with no draws and nothing in the sim reading it:
- how it came (`how`: `forged`, `found`, `quest`, `saga`) and the day (`day`, the calendar's): `noteUnique` in
  `finishPiece` (sim/crafting.ts: the maker, the station's name, its piece `qn` as rolled), `dropLoot` (sim/bosses.ts:
  the boss's name), `questsDone` (sim/quests.ts: the party and the place) and a saga's `unique` effect (sim/sagas.ts:
  the hero and the saga's title). A boss slain on a trip names the party as the finders (`noteFinders`, from
  sim/expeditions.ts' victory);
- its bearers in turn (`bearers`: id, name, the day they took it up): `uniquesHourly` (from the step, once a game hour)
  reads who holds each unique in any slot and adds anyone new to it;
- its deeds: raiders felled with it in hand (`felled`, from `credit` in sim/raidRecap.ts, where the felled counts are
  already kept) and bosses brought down by its bearer (`bosses`, names: a raid's in `credit`, a trip's in
  `noteBossFelled`);
- its end (`gone`: the day, how, with whom): a bearer dying on the road takes it with them (`noteBearerDied`, from
  `killPerson` in sim/health.ts; at home it goes back to the armoury as before), and one found nowhere in the town in
  the hourly look is marked gone.
Only in a town run by its autopilot (as `noteSeen`). A unique found before the log has none: a record starts the first
time someone takes it up, its coming unknown (`how` left out, `day` 0), and the card says "Forged before the
chronicles" or "Found before the chronicles". The snapshot's `uniques` is now `UniqueView` (`uniqueViews`): the
holder in any slot (it was the weapon slot only) with `holderId`, where it is (`at`: `hand`, `away`, `armoury`, `gone`),
its piece now (`qn`) and the `story`.

**Cards over the menus** (`panel/infoCard.ts`). A tapped name opens its card as a sheet from the bottom of the menu,
outside the menu's body, so no menu's redraw key has to know about it: `refreshCard` (panel.ts, each snapshot) draws it
again only when its own key changes. A card opened from a card stacks (‹ Back; a swipe or Escape goes back one; ✕ or a
tap outside closes all; the menu shut closes them). A person's name or portrait opens their character sheet in the
People tab (`inspectPerson`, a small export of townsfolkPanel.ts). Kinds: `item`, `building` (a kind of building),
`topic`, `faction`, `god`, `guild`, `calling`, `saga`, `festival`, `place`, `event` (a Chronicle line). Pieces the
cards share: `sec`, `para`, `portrait`/`portraits`, `factRows`, `cardLink`, `personLink`. `linked(text)` turns every
name in a line that has a card (or a living person) into a link, from an index built once a snapshot: people, the
uniques and trophies, the known powers, the gods, the guilds, the sagas, the festivals, the found places, the buildings
the town has (six letters and up, so "Well" in a sentence is left alone) and the topics learned (likewise).

**The item card** (`panel/itemCard.ts`). A unique: its icon large, "A unique spear", its name in gold, its lore line, then
"What makes it unique" (one of a kind; `UNIQUE_EDGE` harder than any made of its family; its own quirks beyond its
family's, from the data's effect fields in plain words via `quirkWords`; who carries it in the world, a quest's, a
saga's or the guild's forge), "Its numbers" (`itemStats` at its piece now), "Made by" / "Found by" (how, where, the day,
the maker or the party as portraits, its grade as it came out), "Borne by" (every bearer as a portrait, "now, since day
N" on the one who has it), "Deeds" and "Where it is now" (in whose hand, away with whom on which trip, in the armoury,
lost with whom on which day). Anything else: what it does, kind, how many the town has (stores and worn), where it is
made (the station a link to its building card) and what it takes, its research (links), what it goes into (links), the
callings that use it, and who carries one (portraits). A trophy says which boss it was won from.

**The small cards** (`panel/infoCards.ts`): a building (its picture from the strip, `thumb`; its purpose, how many stand,
cost, its research; who works and lives there), a research topic (the tree's own card, now exported as `topicCard` from
researchPanel.ts, with its pick button), a power of the realm (its lord, seat, stance and mood, its town, its troops, an
old tie, a host on the way, its deeds as a rising power, the council of war's view), a god (what it keeps, its favour,
blessing, wrath, offerings, where it is worshipped, its signs), a guild (its gift, founding, members as portraits, its
log), a calling (its five stages, how it fights, what it wears, how rare, who walks it), a saga (the story so far, or how
it ended and its hero), a festival (when, its food, ware, god, gift and song, last time), a place (what waits there, a
mine), a Chronicle line (the whole line, linked, and the people it names as portraits).

**Where they open.** The Shelf (a seen unique's or saga's tile; hold still shows the lore), a person's Kit tab (each piece
worn and each pouch slot), the inspect page's piece name, the calling and guild chips on the character sheet, the
sheet's diary and "Lately" lines (linked), the Trips tab's unique weapons (the name; "Carried by" the bearer's name) and
sagas, the stores' picked item, the workshops' recipes and the crafting queue, the shop's wares, stock, gear and
furnishings, the Chronicle (every line's names, and the line itself), the away lines in the Chronicle, the obituaries and
the midwinter chronicles (Heroes), the gods (Faith), the guilds, the powers of the realm (Trips), the next festival. On
the phone page (`mobile/cardLink.ts` `openCardInMenu`, through the menus' `window.__openCard`): a unique's reveal card has
"More about it ›" (`RevealCard.more`), a haul's unique line opens it once laid out (`data-item`), and a news line naming a
unique gets "About it" (`NoticeAction` kind `card`). On the War tab's island map (0.149.0), a picked province's holder
opens its power's card, when the realm knows it (one line in `provinceCard`, panel/warPanel.ts).

**One look for tappable text** (`tapLink` in panel/structure.ts, `.tap-link`): a dotted underline in the people's heading
colour (`--heading`), the same dotted underline the research queue used in 0.137.0. A tap on it never opens or closes an
`expandable` card it sits in (`no-expand`).

**Checks.** `test/provenance.test.ts`: forged → maker, day, station and piece; a plain game keeps nothing; each bearer
added once a turn; a unique from before the log; raiders felled and bosses as deeds (through `credit`); dying on the road
loses it, at home it goes back to the armoury; the snapshot's view. `tools/sim-hash.mjs` (now with `STRIP=a,b` to leave
top-level fields out of the hash): with `STRIP=uniqueLog` all five hashes match main; without it only hash-b (a knights'
town that forges or finds a unique) changes.
