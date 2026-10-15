## Generations and dynasties (the owner's ask: a long game should read as a family saga)

New state `s.dynasty` (`DynastyState`, optional, so old saves load; nothing is made until a dawn with the autopilot on).
Files: `sim/dynasty.ts` (rules and `dynastyView`), `data/dynasty.ts` (every number and the lean tables), the Families tab
(`renderer/panel/familyPanel.ts`), test `test/dynasty.test.ts`. `dynastyHourly` runs once a day at 05:00 from `sim.ts`
(after `politicsHourly`), autopilot only, on its own side stream `${seed}:dynasty:${tick}` (upbringing: `${seed}:dynasty:up:${id}`).
It never draws from the town's stream.

**Houses.** A house is a family line of `sim/lineage.ts`: `lineGroups(s)` (split out of `familiesView`, reads the record
only) gives each line's root and generations; `housesOf` maps every person to their root; `houseName` is "House of <root>".
Someone with no line yet (a lone founder) is their own root.

**Upbringing** (`leansOf`, `applyUpbringing`, called from `comeOfAge`). Each dawn every child in town is noted
(`Rearing`: raids lived through, hungry days = a quarter of the town under 0.3 food, trade days = yesterday's trade, shop,
goods and realm income against `TRADE_DAY_COINS`). At coming of age the strength (0..1) of four leans, `fight`, `farm`,
`trade`, `magic` (`LEAN_DEFS`), comes from that plus the parents' callings (a martial class role, a caster/healer role,
a bard or dancer or social 8+ or a shop owner, a druid or farming 6+; a parent counts for 0.5 x 0.6, so two make 0.6). The
top two leans of at least `LEAN_LEAST` add skill levels (rounded from the table x strength), a passion at 0.5+, and the
top one may turn the nature (chance strength x `NATURE_LEAN`, to one of the lean's own natures). Skills feed classes
(`classPull`) and attributes (`ATTR_PER_SKILL`), so callings and stats follow without touching either. The children also
inherit their house's feuds (-30 to the other house's grown-ups) and the favour of its bonds (+`BOND_NEWCOMER`).

**Feuds** (`Feud`, `startFeud`, `feudFrom`). A murder, assault or theft between two families (from `politics.ts crime`,
after the victim is picked) or a jilting (`jilt`: an unmarried partner leaves for someone they are warmer to) starts one;
at most `FEUD_MOST` live. The two houses' grown-ups sour by `FEUD_START` at once and by `FEUD_PRESSURE` each dawn (partners
excepted), so they reach ENEMY, brawl (`brawl` in social.ts is now exported) and are never sent on trips together. Each dawn a
hot feud may add an incident (chance heat / `FEUD_INCIDENT_DIV`): a brawl, sabotage (damage to the other's building, else
a coin theft) or a refusal to work (a sulk breakdown). A feud ends by a marriage across it, a shared ordeal (a raid
both houses fought, or a famine), or the council (any council meeting, `COUNCIL_END` each); peace leaves a thin bond.
**Bonds** (`Bond`): each raid fought side by side adds `BOND_RAID` between the houses of the top four fighters (from
`s.raidRecap.rows`); at `BOND_DECLARED` it is told and members warm to each other daily (`BOND_WARM`).

**The ruling house** (`RulingHouse`). Begins as the leader's (`s.mainId`); `strengthOf` sums levels, titles x5, foes felled,
coin, land, the leader's 12, less black sheep, debt and (for the ruling house) a crisis (-30%, 15 days) or scandal (-15,
20 days), and a little remembered renown of its dead. Stage: `rising` while young or still setting peaks, `declining`
below `DECLINE_BELOW` of its peak, else `peak` (changes at most every 4 days, each told). A house with 2+ grown-ups at
`RISE_MARGIN` x the ruler's strength (and at least `RISE_LEAST`) for `RISE_DAYS` days takes the seat (told "by its wealth",
"by force of arms" or "by the weight of its name in council"; the cast-down are sore for two days, the town dips); a house
with no living member dies out and the seat goes to the leader's line, else the strongest. `Reign`s are kept in `past`.
It does NOT change `s.mainId` (the player's founder). `dynastyDeath` (from `killPerson`, after `recordDeath`): the heir
(`heirOfHouse`) dying starts the crisis and a town-wide morale mark; the head dying names the successor.
`dynastyScandal` (from `blackSheep`) counts too.

**Heirlooms** (`Heirloom`). A unique, or Epic+ piece, worn by a family member becomes their house's (max `HEIRLOOMS_MOST`);
`s.ancestry.heirloom` brings its carried generations and curse into the story. On the holder's death at home it passes to
the heir (`heirOfEstate`; a child's goes to the chest); on the road it is lost with them. Out of the family's hands or gone
from the town for `HEIRLOOM_MISSING_DAYS` it is lost: the house is sore three days and the story says so; found again, it
says that too. Raids the holder fights add lines to its story.

**Views.** `snapshot.dynasty` (`DynastyView`, slow) -> the Families tab: a ruling-house card (stage, strength, head, heir,
crisis; tap for past reigns and the log), a feuds-and-friendships card, a card per heirloom (tap for the story), and
tags on each family card (crown, crossed swords, heart, diamond). The year's chronicle (`annals.ts writeChronicle`) gets
`dynastyYearLines`. Notices that matter are key journal entries.

Changes to existing systems: `HISTORY.md` "Schools, apprenticeships and family trees" - `comeOfAge` ends with
`applyUpbringing`, `familiesView` is built on `lineGroups`; "Town politics and law" - `crime` calls `feudFrom`.
