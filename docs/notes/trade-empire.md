## Trade empire (the owner's ask: growing rich is a way to survive, beside arms)

Under the **Trade** direction a town with a trade house (`marketOf(s)`, sim/markets.ts) grows a merchant empire on the
world map, and spends its coin on safety. New files: `src/shared/data/tradeEmpire.ts` (all the numbers),
`src/shared/sim/tradeEmpire.ts` (the rules, `s.empire`), `src/renderer/panel/empirePanel.ts` (the Market menu's **Trade
empire** tab), `test/tradeEmpire.test.ts`. Only with the autopilot on, and the posts, caravans, deals and tribute start
only under `s.direction === 'trade'`; a town on any other direction is byte-for-byte unchanged (`tools/sim-hash.mjs` is
identical). Side stream `new Rng(hashSeed(`${seed}:empire:${tick}:<salt>`))`, never the town's. `s.empire` is optional.

- **Trading posts** (`foundPost`, `Post`): at `EMPIRE_HOUR` a day, if the town has a stall, coin (`POST_COINS` plus the
  treasury's keep), goods (`POST_GOODS`), and `POST_FOLK` adults to spare (`HOME_FOLK_LEAST` kept at home), it founds a post
  at the best far market (`sitesOf`): the world map's regions once scouted (`REGION_SITES`; the two island ones need a shore
  town or a boat, `canSail`) and the strongholds of known powers not at war (`power:<id>`, goods by `makesOf`/`wantsOf`).
  The folk who go are townspeople with `Person.away = EMPIRE_AWAY` (-4000201; the snapshot says "on the trade roads"). Posts
  allowed: `POSTS_BASE` + the trade house's tier + a charter. At the turn of each season (`reckon`) a post pays
  `site.base` x level x called-bonus x monopoly, plus the cuts (`POST_CUT` of each sale at its market) its caravans
  earned; levels at `POST_LEVELS`. Posts are lost (`losePost`) to bandits (`POST_RAIDED` x danger, halved with 2 guards or
  hired swords), to the war (`POST_WAR`, or at once at a power gone to war), to a power's decree (`POST_DECREE` when a
  power's attitude is sour or the town's monopoly sours it; not under its protection); the folk die (`POST_FOLK_DIE`, a third
  of it for a decree) or walk home hurt; the site is shut to the town for `LOST_SITE_DAYS`.
- **Caravans and ships** (`dispatch`, `launch`, `onTheRoad`, `EmpireCaravan`): at `CARAVAN_HOUR`, up to 1 + house tier
  caravans (`caravansAllowed`), the town sets one out on the circuit home - one or two posts - home that earns most an
  hour (`plan`: carries the stores' spare that fetch `CARGO_MARGIN` more at a stop, sells there, buys the post's cheap
  goods with 70% of the purse, brings home what did not sell). Sea posts make it a ship. `DRIVERS` townspeople go with it
  (paid `DRIVER_PAY`). Danger per leg (`legRisk`): `ROAD_LOST` per 100 px x the site's danger, x`WAR_ROADS` in a war,
  x`SEA_STORM` for a ship, x`SAFE_GUARDS` with 2 guards, hired swords or an ally, x`CHARTER_SAFER`, x`PROTECT_SAFER`. The dice
  are cast at departure (`fate`): **lost** (the goods and purse are gone for good; each driver dies on `DRIVER_DIE`, the rest
  walk home hurt; a fortune lost is told in the event box) or **robbed** (`ROBBED_TAKE` of what comes home, from markets.ts).
  A caravan home deposits at the stores, pays coin to the treasury (ledger line `trade`) and moves prices (`noteFlow`).
- **Guilds and deals** (`offerDeal`, `dealsDaily`, `Deal`): every `DEAL_EVERY_DAYS`, with a post, standing above
  `STANDING_FLOOR` and fewer than `DEALS_MOST`, a merchant guild (`GUILDS`) offers one the town takes on its own:
  a **monopoly** on a good it has plenty of (a boom swing on the price through `s.market.swings`, posts x`MONOPOLY_POSTS`,
  the town must keep `MONOPOLY_KEEP` in store; the other powers resent it, `MONOPOLY_RESENT` at once and 1 per 3 days); a
  **charter** for `CHARTER_FEE` (one more post, safer roads); a **loan** (`LOAN_PER_TIER` x tier, `LOAN_INTEREST`, repaid
  from the treasury a day before it falls due). Kept: standing +`KEPT_STANDING`; broken (short of the monopoly good
  `MONOPOLY_SHORT_DAYS` running, or a loan unpaid: the richest post is attached): `BROKEN_STANDING`. `richTown`: a rich
  town (`RICH_COINS`, more for each) draws a merchant to settle now and then (`newcomer`, up to `SETTLERS_MOST`).
- **Money buys safety** (`empireTick` from sim.ts right after `maybeStartRaid`, `safety`, `wages`): a raid of people (a kind
  that steals or is bribable, not a host, calamity, saga or hunters) in its warning phase is **bought off** (`payTribute`:
  `TRIBUTE_BASE` + `TRIBUTE_PER_RAIDER` each, x(1 + `TRIBUTE_RISE` per tribute paid; eases one a season), never over
  `TRIBUTE_SHARE` of the purse; the council's pride refuses `TRIBUTE_PRIDE` of the time and fights). **Mercenaries**
  (soldiers and archers as allied raiders, like the grove's guardians) are hired each `MERC_DAYS` for `MERC_FEE` a head and
  `MERC_WAGE` a day, count 2 + tier + posts/2, and the fallen are not replaced; unpaid they leave. A **power's protection**
  (`PROTECT_FEE` x tier, `PROTECT_DAYS`): safer roads and posts, cheaper tribute, goodwill. No raids.ts or factions.ts edits.
- **Seen**: the world map (Trips tab) draws posts (⌂, ⚓ for sea posts, bolder as they grow) with a gold road home and the
  caravans (🐪) and ships (⛵) moving along the leg they are on (`WorldView.posts`, march kinds `caravan`/`ship`, from
  `empireOnMap` in worldLife.ts); the Market menu's **Trade empire** tab (`snapshot.empire`, `empireView`): posts, caravans out,
  deals, safety bought, takings, totals and a ledger; big deals and losses go to the journal (key notices) and the event box.
- **Also**: the year's chronicle gains the empire's lines (`sim/empireYear.ts`, called from annals.ts `writeChronicle`); `tools/soak.ts` takes
  `DIRECTION=trade`, `EMPIRE=1` (per-seed people and the empire's totals; `2` adds its ledger) and `SEEDOFF=n`.
- **Probes**: `tools/sim-hash.mjs` identical to main (the default direction never touches the empire). 40-day soak of settlers, dwarves,
  knights (2 seeds): identical to main without a direction; with Trade, settlers and knights identical (no region mapped or power met
  yet, little coin: the empire sleeps), dwarves 3.5 -> 5.5 people, 8 -> 5.5 deaths (hired swords). Late-town fixture, Trade, 20 days,
  8 seeds: 1-2 posts founded, 2-9 caravans each (200-640 coins made), one caravan lost, deaths 13.3 -> 10.7, people 51.3 -> 46.8.
