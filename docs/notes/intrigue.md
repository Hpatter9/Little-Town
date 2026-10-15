## House intrigue (the owner's ask on the ruling house from 0.96.0: own the town, a mafia, bribes, blackmail and murder for the council)

Extends HISTORY.md "Generations and dynasties" and "Town politics and law". New state `s.intrigue` (`IntrigueState`, optional, so
old saves load; nothing is made until the autopilot is on and the town has `INTRIGUE_PEOPLE` grown-ups after `INTRIGUE_FROM_DAY`).
Files: `sim/intrigue.ts` (rules and `intrigueView`), `data/intrigue.ts` (every number), the Families tab
(`renderer/panel/familyPanel.ts` `intrigueBlocks`), test `test/intrigue.test.ts`. `intrigueHourly` runs once a day at 03:00
(`INTRIGUE_HOUR`, after the night's crime and before the dynasty's dawn) from `sim.ts`, on its own side stream
`${seed}:intrigue:${tick}`. It never draws from the town's stream.

**Houses own the town.** A house is a dynasty house (`housesOf`). `IntrigueState.books[root]` (`HouseBook`) is its chest (`purse`),
what it has drawn, its crimes and (maybe) its ring. `of` maps each person to their house's root (refreshed each night, so the
sums between nights are deterministic). `houseCut(s, owner, n)` is called from `property.ts collectRent` and `ambition.ts
takeSale`: `HOUSE_TITHE` (35%) of what a landlord or keeper takes in goes to their house's chest (the fraction of a coin is
carried in `book.carry`; the founder's own takings are never tithed). Each night a house whose purse is `BUY_SPARE` x a price
buys a building (`buyProperty`): the town's homes, shops, workshops and fields (not public works) at `TOWN_SELLS_AT`, or a
neighbour's in debt (`FORCED_DEBT`) at `FORCED_PRICE`, which pays off what they owed. A house holds at most `OWN_SHARE_MOST` of the
town's sellable buildings. The new owner is the house's steward (its adult with the fewest holdings, never the founder), so
rent and takings keep flowing through `houseCut`. `dynasty.ts strengthOf` adds `wealthStrength` (the purse / `WEALTH_PER_STRENGTH`,
capped), and `bestWay` counts it ("by its wealth").

**A mafia** (`Mafia`, `foundMafia`/`mafiaDay`). A house with a purse of `MAFIA_PURSE` and a hard-natured member
(`HARD_NATURES`, the boss) may turn to crime (`MAFIA_CHANCE` a night, `MAFIA_MOST` rings). It hires up to `MUSCLE_MOST` knives
(paid `MUSCLE_WAGE` a day). Each night it calls on venues: shops pay `PROTECTION_SHARE` of yesterday's takings (taverns
`TAVERN_SHARE`); a proud or stern keeper refuses (`REFUSE_CHANCE`) and gets an "accident": the shop damaged (`ACCIDENT_HP`) or a
beating (`ACCIDENT_BEAT`, and `ACCIDENT_DEADLY` of it fatal). The treasury's own venues are skimmed (`TILL_SKIM`), and with muscle
a share of yesterday's trade is smuggled off the caravans (`SMUGGLE_SHARE`). `Mafia.heat` rises with each take; the nightly
chance of being found out is `EXPOSE_BASE + heat x EXPOSE_HEAT + guards x EXPOSE_GUARD` (+ `EXPOSE_HARSH` under harsh law).
Found out (`exposeMafia`): a knife or the boss is tried (queued, see below), `ARREST_DEADLY` of the time the boss dies resisting,
two of those who paid start a feud with the house, and the ring breaks up (`BREAK_UP`) or lies low `LIE_LOW_DAYS`.

**Taking the council.** The four blocs' speakers (`speakers`: the best-spoken member of each) are the council's seats. A scheming
house (`scheme`: `SCHEME_CHANCE` a night with `SCHEME_PURSE` or a ring, `SCHEME_GAP_DAYS` between, at most two a night) picks a
rival speaker and a method by what it has: a **bribe** (`BRIBE_COST`; the taker's nature decides, an honest one throws the purse
back in public), **blackmail** (needs a secret: `secretsAbout` = a crime nobody saw (`hideCrime`, from `politics.ts crime`), a big
debt, a lover; a target that fights back airs the secret and names the blackmailer, and `CORNERED_KILLS` of the time kills them),
**fear** (a ring's muscle; a beaten target who talks names the men) or **murder**. A successful hold (`Hold`, `HOLD_DAYS`) makes
`politics.ts callVote` call `swingVote`: the held speaker's own vote goes and the house's position counts `SEAT_VOTES`
(`housePosition`: a ring wants harsh law and curfew gone and the tax low, other houses follow their head's bloc). A house with
more than half the seats is whispered of. `Method` weights are in `METHOD_WEIGHT`.

**Murder** (`houseMurder`, `Plot`). A hard house with a ring or a hot feud may have a rival speaker or the ruling house's heir
killed (never when `recentKill`). The knife (a hired man, else the schemer) succeeds at `MURDER_SUCCESS` less a guard's bite; a
failed knife dies (`KNIFE_FALLS`) or is taken and may name its master (`KNIFE_NAMES`). A clean job (`ACCIDENT_SHARE`) is an
"accident" (`ACCIDENTS`); otherwise a knife in the dark, and the house may pin it on a patsy (`FRAME_CHANCE`: an enemy of the dead,
else the poorest hand; the patsy is tried for it). Each night a hidden plot is found out with `UNCOVER_BASE + guards x UNCOVER_GUARD`
(`uncover`): the patsy is cleared, the real culprit is tried, a feud starts (`startFeud`, heat 60), the house is shamed (a morale
mark), and the wronged house may swear revenge (`REVENGE_CHANCE`; `revengeDay` strikes openly some days later, which is itself a
murder to be tried). A house with `BANISH_AT` known crimes has its head run out of town (`banishIfEnough`).

**Trials.** The court takes one case at a time (`politics.ts trial` leaves a pending prompt alone), so intrigue queues its
trials in `IntrigueState.trials` and `drainTrials` calls them when it is free. A trial of a house member goes through `trial` ->
`blackSheep` -> `dynastyScandal`, so the ruling house's scandal works as before.

**The owner's rule: the leader never changes by intrigue.** `slay` is the only place intrigue kills, and refuses `s.mainId`; the
founder is also excluded from every target, culprit, patsy, steward, muscle and boss pool. A takeover of the ruling house
(dynasty.ts) still does not change `s.mainId`. Jilting is untouched.

**Visible.** Whispers (`Whisper`, `whisper`) hint at hidden deeds as non-key news; what comes to light is a key news item and goes in
`IntrigueState.log`, which `dynastyYearLines` adds to the year's chronicle (`intrigueYearLines`). `snapshot.intrigue`
(`IntrigueView`, slow) -> the Families tab: a card per rich or guilty house (holdings, chest, council seats, known ring,
known crimes on tap, a whispered rumour while nothing is proved) and a Whispers card. The People panel's key
(`townsfolkPanel.ts`) includes it.

Not done / for the coordinator: the gossip lines (`sim/gossip.ts READS`) don't yet read the whispers (that file belongs to the
town-culture chat); a `rumour` kind there could read `Folk say ...` / `They say ...` notices. `diary.ts` could call
`secretsAbout` so a diary hints at a secret a person keeps.
