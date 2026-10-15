## Balance pass 3 (claude/balance-3)

Six items, measured first. Tools written for it (all under `tools/`, each with a `.mjs` wrapper like `soak.mjs`):
`raid-bite` (per raid: how it ended on the board, townsfolk lost, stores taken, fires; `BITE_LOG=1` lists each raid),
`arc` (the Great Enemy + Calamity arc on a strong town: the fixture with its folk at level 40 and armed, the Enemy forced
into its omens and its plan run faster by `PLAN_BOOST` a day; `ARC_SAVE=<file>` writes the town as the Enemy marches),
`siege` (that saved town with the last siege forced, logged every half hour), `trade-births` (couples split by the trade
roads), and `PERSEED=1` on `soak` (each seed's people, not just the mean). All numbers are 40-day soaks on 6 seeds unless
said.

### 1. Raids bite (changes "Tactics battles", "Raids bite again", "Tower-defence raids")

What the numbers showed (3 seeds, 40 days): about 0.06 to 0.10 townsfolk lost per raid on a new town, 0.35 on the fixture;
the big raids ended on the clock far short of a result ("rival lich x33": 6 killed, the rest left at the three-hour mark).
**The cause is the clock, not the sheltering.** Board turns come one at a time, about 11 ticks each, so a board of 100 units
gives each unit one turn every two game hours: raiders spent the first seven hours walking in. A forced siege on a strong
63-person town (57 raiders, the Pale Prophet at 6816 hp): nothing fell for eleven hours, the 12-hour clock ended it with
the Enemy at full health, and the town "lost" a siege it was winning. (Scaling every raid's clock by its board size was
tried: raids then ran 13 to 17 hours, there were half as many of them in 40 days, and deaths per raid did not move, so it
was dropped for the siege rule below.) Three rules (`sim/tactics.ts`, `sim/raids.ts`):

- **A raid that is winning presses on.** At the clock, `raidersWinning` (the raiders' health left, waiting ones too, at
  `PRESS_RATIO` (2) times the town's standing fighters' or more, and the town has `PRESS_FIGHTERS` (6)) adds an hour, at
  most `PRESS_MAX` (2) times (`Tactics.pressed`). One that is losing routs on the clock as before. Towns of fewer than six
  fighters keep the old mercy: with no such gate, a founding town's first weeks (a few folk and a bear that wins) took
  settlers from 9.8 to 4.7 people and vampires from 4.0 to 2.5.
- **The Enemy's last siege is fought out.** While the field is held, a `Raid.enemy === 'siege'` has no clock (up to
  `SIEGE_MAX_HOURS` 72 from its arrival), or its leader, who comes on last, is never struck at. The same forced siege now
  ends at +44 hours with the Enemy dead and 62 of 63 alive (`tools/siege.mjs`).
- **Some of the sheltering are always caught out** (`caughtOut`, `CAUGHT_OUT` 0.1): a fixed share of the grown, not
  fighting folk (by a hash of seed, raid and person: no stream drawn) never get under a roof while the raid is in town
  (`people.ts` shelter task leaves them `idle`, so `exposed` finds them). Raiders in town already took stores, burnt
  buildings and downed fighters; they now have more to reach.

Measured (final rules; `raid-bite`, 3 seeds): townsfolk lost a raid, settlers 0.10 -> 0.07, knights 0.06 -> 0.14, orcs 0.09 ->
0.08 (no change that a few seeds can show: small towns are left alone on purpose); the fixture (2 seeds) 0.35 -> 0.49, 57 -> 68
raids, 58 -> 66 people. The 40-day soaks (6 seeds, mean people at day 40 / deaths), main -> now: settlers 9.8/6.5 -> 8.8/8.2,
knights 15.0/5.0 -> 9.5/6.2, orcs 12.8/6.8 -> 11.8/6.7, vampires 4.0/5.3 -> 5.7/5.8, merfolk 9.5/4.2 -> 8.8/9.2. (A later run
with every raid's clock scaled to its board: settlers 7.5, orcs 9.7, knights 10.2, vampires 5.2.)

**Knobs for the owner:** `PRESS_RATIO`, `PRESS_MAX`, `PRESS_FIGHTERS`, `CAUGHT_OUT`. The first, harsher try (ratio 1, 5
presses, 20% caught out, no size gate) put settlers at 0.23 deaths a raid and 2.7 people.

### 2. Orc and knight soaks: chance across seeds, not a rule (no change)

Bisected by switching systems off (6 seeds): orcs on main 12.8 people (per seed spread 1 to 23, standard error about 2.7),
with the wild (herds, predators, nests) off 9.3; knights on main 15.0, with dynasties, intrigue and ancestors off 12.3.
Neither goes up when the system is off, and a single people's seeds range from 1 to 18: the 14 -> 7 and 10 -> 7 were the
spread of 3 seeds. Nothing softened.

### 3. Staff away at trading posts (changes "Trade empire")

Measured with `trade-births` on the fixture under Trade: about 21% of married-couple time was a couple split by the road
(one partner away on the trade roads). `families` (`sim/social.ts`) only looks at pairs who are both in town, so each split
couple had no children; and `launch` always took the two lowest ids, repeatedly. Fixed in `sim/tradeEmpire.ts`: `sparest`
chooses post staff and caravan drivers from those with no partner at home first, then a whole couple together, a half couple
only to make up the number. (Hauling: an away adult is one fewer carrier, held to `HOME_FOLK_LEAST` 7 at home: by design.)
Under the final rule the split share fell to 14.2% (one seed, 25 days). The "4.5 fewer people" itself is within the noise of 3 seeds (fixture on Trade, base 60.0, empire fix alone 54.0, per seed
72/62/46 against 47/65/50). Tests in `test/tradeEmpire.test.ts`.

### 4. Alignment drift for the dark peoples (changes "Town alignment" and the "Alignment drifts toward neutral" note)

Vampires with the drift toward 0: 4.0 people; with it toward their home point (-45): 6.3 (same 6 seeds). Real, if modest.
`driftTargetOf` (`data/alignment.ts`): a people whose home point is `DARK_HOME` (-15) or darker (vampires, liches, orcs)
drifts back toward its own home; every other people toward neutral as before (knights, druids, settlers...). The rate
(`DRIFT_PER_HOUR`) is unchanged and slow. Test updated in `test/alignment.test.ts` (a vampire town at home stays there, and
drifts back to it from a kinder bar).

### 5. The merfolk soak (changes "The merfolk rework")

Per seed, people at day 40: 16, 2, 14, 7, 2, 16. Not drownings (1 death of 25), not pirates (1): the Tide Clan began with
**two** founders (the other peoples with one companion have a third from wanderers; merfolk travellers come by ship), and
the first death (a saga's lost boy, a tornado, a cave bear) left a town of two that never grew: buildings jumped to 100+ by
day 10 in the seeds that kept three, and stayed at 20 in the others. `origins.ts`: the Tide Clan now starts with a gatherer
and a hunter. Test in `test/origins.test.ts`. The lowest town of the six at day 40 was 2 or 1 people on main (low 1.7 on
average); with three founders it is low 2.7, and every seed ends at 2 or more, but the spread is still wide (6, 2, 13, 6, 18, 8
against 16, 2, 14, 7, 2, 16: standard deviation 5.6 against 6.4), and deaths a town doubled (4.2 -> 9.2: more folk to lose, and
the raid rules above). The seed that stays at 2 loses its founders to a cave bear in the first fortnight. Not steady yet: the
early game of a tiny town is the noise, and a wanderer's arrival needs the player's leave (the owner's rule).

### 6. The Enemy + Calamity arc on a strong town

`arc`: the fixture levelled and armed (37 folk, growing to 90), the plan run at +0.8 a day. The stages fire in order:
Enemy omens, Calamity stage 1, Enemy stirring, Calamity 2, Calamity 3, Enemy march with Calamity 4, hosts every 6 days,
siege with Calamity 5 (dread 100). Found and fixed: the siege clock above (a 90-person town lost both sieges and the game:
the first lost 22 people to the sack, the second ended it); "The last siege comes in 0 hours" (a forced siege's
`siegeIn`) now reads "at the gate now" (`notices.ts`, `expeditionsPanel.ts`).

### Hashes (`tools/sim-hash.mjs`, 6 days)

Main: fixture `1e25ceb1a860`, settlers `5f599c1ea736`, knights `ec655be1e4fb`, vampire `e4c201102006`, dwarves `f1e18b031a22`.
Now: fixture `28a5ceb44ec7`, vampire `a650f5c6bf2e`; settlers, knights and dwarves unchanged. The fixture changes because its
catch-up week has tactics raids (the pressing and caught-out rules; reverting `raids.ts`, `tactics.ts` and `people.ts` returns
the old hash, and `tradeEmpire.ts` and `sim.ts` alone do not move it); the vampire's changes with its alignment drift.
