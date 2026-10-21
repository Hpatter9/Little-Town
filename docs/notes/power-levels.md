## Power levels

One rough number for anyone who can fight, and a short label for how two sides match, so the owner knows what to
expect before a fight or a duel. A guide only: it reads the fighter and never changes how a fight works, and it draws
no random numbers.

- `src/shared/sim/power.ts` (pure, no Pixi or DOM). `powerOfFighter(f)` takes a `Fighter` (combat.ts) and gives the
  square root of how long it lasts (`maxHp` over armour, block and dodge) times how hard it hits (average blow, strikes
  true, aim against a typical foe's `TYPICAL_DODGE`, blows a second), times `POWER_SCALE`. A fresh townsperson reads
  about 10-15, a wolf 11, a cave bear 48.
- `powerOfPerson(p)` goes through `personFighter` (level, stats, class, weapon, armour, wounds and lost parts), then
  lowers by the share of health they have left. `powerOfEnemy(kind, might)` uses `unitFighter` (`might` is a raid
  raider's multiplier). `powerOfGroup`, `powerOfParty` add up (a side of ten reads about ten times one of them).
- `matchupOf(mine, theirs)`: Easy (theirs under 0.65 of yours), Even (under 1.15), Risky (under 1.8), Deadly.
  `powerLine` words it: "Your party 240 vs about 310: Risky". `placeFoes(d)` / `foesToExpect(d)`: what a place's
  road fights and (for a dungeon) bosses come to.
- Shown in: the person card chip and the People list row and Kit tab (`PersonView.battle.power`); the raid warning in
  the top bar, the strip HUD and the Town tile (`RaidView.power`, `townPower`, `matchup`) and a raider's or roaming
  band's tap card (`RaiderView.power`, `RoamerView.power`); the Bestiary; expedition destination cards and details,
  the muster sheet (`MusterView.powerLine`) and quest and hunt offers (`DestinationView.partyPower`, `foesPower`,
  `matchup`); the arena card (`ArenaView.card.power`, `matchup`).
- `test/power.test.ts` calibrates it against the real fight rules: of two foes where one reads at least 1.5 times the
  other, the stronger wins at least three in four fights; a person who reads stronger than a foe beats it; wounds
  lower the reading; the labels follow the ratio.
