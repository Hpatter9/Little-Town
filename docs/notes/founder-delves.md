## The founder leads delves, and the woodpile is shown (claude/founder-delves)

Two decisions of the owner's, following docs/notes/winter-plague-delves.md ("No delves in the first month" and "What's
left"). Changes HISTORY.md "Sending a party yourself" (a party raised with the founder at its head; the stake card's
warning names the heir), "Dungeon delves" (the founder's questions at a fork and the boss's door), "Founder quests, the
steward" (the Orders sheet's Lead a delve) and "Hard times" / winter (the woodpile's forecast and warning).

### The founder leads delves (`sim/founderDelves.ts`, new)

The town's own parties still go into a dungeon only under an adventurer and only at `DARE` (1.15) times its worst boss
(sim/parties.ts `dares`, unchanged), so a first-month town's own parties never delve. The founder has no bar:
- **Where:** the founder's card › Orders › **Lead a delve** lists every dungeon on the board (`knownDungeons`: found,
  reached, not lying quiet; the same rule as the Expeditions board, `destinationUnlocked`), and each dungeon's card on
  the Expeditions tab has **Lead a delve…** next to Send a party…. Either raises a party (`raiseFounderParty`, the
  muster op `founder`, sim/commands.ts and sim/sim.ts) with the founder at its head and whoever is willing behind them
  (`founderPartyFor`: picked as the town picks a party, sim/parties.ts `recruit`, from those `willing`, so the Orders
  list and the muster sheet show the same party); how boldly they go follows the founder's nature. It is not sent: the muster sheet opens on the Expeditions tab to look over, change and
  send, or call off. Nothing checks the party's strength (`sendMuster` never did). Disabled, with the reason, while the
  founder is away or down, a party is being raised, or `MAX_EXPEDITIONS` are out (`FounderView.delveBlock`).
- **The danger, shown first** (`delveRisk`): the dungeon's possible bosses with their guards, mildest first
  (`bossesOf`), each by its power level (sim/power.ts `powerOfGroup`, the scale every offer and the muster sheet already
  use), the likeliest (the middle one: each is rolled as likely as the next) and the worst, against the party's power
  (`powerOfParty`): "Your party 41 against the likeliest at the bottom, Gnasher, the Goblin King and 1 redcap (90), and
  at worst the Rat King and 2 giant rats (150). Every one of them is stronger than you." A word and a colour by the
  matchup against the worst (`DELVE_RISK` over `matchupOf`: Easy "Within your strength", Even "Even at worst", Risky
  "Risky", Deadly "Deadly") on the Orders list and on the muster sheet (`MusterView.risk`, a tinted box under the
  leader's word in place of the plain power line, with "Some of them may not come back." or "The bottom of it may kill
  them all."). The Orders list leads with the heir: "If you fall, Elen takes up the town." or "You have no heir: if
  you fall, the town ends with you." The stake card's founder warning (sim/stakes.ts `warningFor`) now says the same
  (it used to say an heir takes the town even with none).
- **The founder's choices down in the dark** (with the autopilot on): at a **fork** (`delve_fork`: the darker way, a
  treasure room next and every fight after harder, or the safer, a rest camp next) and at **the boss's door**
  (`delve_boss`: go down and face it, or turn back with what they found: `Delve.turnBack`), each telling the party's
  state (on their feet, health, torches), the boss's danger against the party's and the heir line. They are road
  prompts held for the founder (`holdForFounder`: no timer, no default), so the delve and the game wait for the answer,
  as on the road; answered through `answerCrossroads` (sim/muster.ts → `answerDelveAsk`). The road's own questions
  (crossroads, strangers) are as before. A delve without the founder takes the fork by its stakes, as before.
- **The end:** a commanded trip, so it ends in the one summary card (sim/muster.ts `debrief`; docs/notes/summary-cards.md).
- **Death:** the founder away bleeds out like anyone (sim/health.ts `knockDown` sets a bleed timer away from town); the
  party retreats when the founder goes down (combat.ts `endCheck`, as before). With no heir that's the game over.
- Optional new fields: `Delve.askedBoss`, `Delve.turnBack`; `FounderView.delves` (worked out on the snapshot's slow
  cache) and `.delveBlock`; `MusterView.risk`.

### The woodpile shown (`sim/hardship.ts` `woodpileForecast`, `warnWoodpile`)

- **The forecast** (autumn and winter, autopilot on; null otherwise, `Snapshot.firewood`): the logs on the woodpile,
  the winter's burning still wanted (`winterNeed`), a day's burning (`FIREWOOD_PER_HEAD` a head at home), the stores'
  wood and coal the hearths fall back on (coal at `HEAT_VALUE`), how many days it all lasts, and the warning: `cold`
  with the hearths out in winter, `short` when woodpile and stores together won't last the rest of the winter, all
  winter and in autumn from `WOODPILE_WARN_FROM` (6, data/hardship.ts: before that the gathering is under way). A
  heater (or a Deep Freeze kept warm) shows as heated, no warning.
- **The readout** (mobile/storesReadout.ts): in autumn and winter a firepit (the cutscenes' `scene/firepit.png`, cold:
  `firepit_cold.png`) and the woodpile's count after the other figures; amber with a tint when short, blue-grey when the
  hearths are cold (index.html `.sr-fire`). Its tooltip has the wanted and the days. Part of the readout's key.
- **Town › Stores** (panel/craftingPanel.ts `woodpileLine`): "Firewood: 6 logs on the woodpile, 36 wanted for the rest
  of the winter. With the stores' wood and coal it lasts about 2 days at 3.6 a day. It won't last the winter: gather
  wood." (red when warned). `s.firewood` is in `storesKey`.
- **The notice:** once a season (`GameState.woodWarned`, optional: the season counted from the first), when it turns
  short: "The firewood won't last the winter: … Gather wood before the hearths go cold." The hearths' own notice when
  they go cold is as before.

### Tests and shots

`test/founderDelves.test.ts`: a founder's delve into the Gremlin Warren a town's party wouldn't dare (no bar, the
founder leads, a commanded delve); the danger (bosses mildest first, likeliest and worst, deadly alone, the heir line
with and without an heir, on the muster view and the founder's card); the boss's door holds the game and turning back
leaves the boss be; the fork; the founder bleeding out away with no heir ends the game; autopilot off: no question.
`test/winterPlague.test.ts`: the woodpile's forecast (summer none, early autumn no warning, from day 6 short and
warned once a season, the stores counted at their heat, the days it lasts, cold in winter, autopilot off none).

Shots in `docs/notes/founder-delves/` (the phone build, 393x852 `-upright` and 852x393 `-side`; a settlers town made
headless and loaded as the phone's save): `orders-lead-a-delve`, `delve-muster-risk(-line)`, `delve-boss-question`,
`delve-summary`, `readout-firewood-short`, `stores-woodpile-short`, `readout-hearths-cold`, `stores-hearths-cold`.
