## A smarter town (claude/smarter-town; the owner's ask: "Is there any way to implement a basic AI into the game for the town?", answered as smarter built-in rules: no network, deterministic)

Long headless towns were run and every grown-up's task logged tick by tick, to find where the townsfolk act daft, and
the worst of it was fixed with plain rules. Changes "Nobody starves in bed (fixed)" (in "Injuries, lasting harm..."),
"Sickbeds", "Builders build, the rest carry" and "Faster paths". No new state, no new random draws: every rule reads
what's already there.

**The probe** (`tools/town-probe.ts`, run `node tools/town-probe.mjs [days] [late|fresh|all]`): the late-game fixture
(`test/fixtures/late-town.json.gz`, and the same with its raid at the gate left out) for 4 days, and four fresh
settler towns (`probe-a` band, `probe-b` tribe, `probe-c` supplied, `probe-d` tribe; autopilot and `townBuilds` on, as
a player who builds what the town recommends) for 35 days, into winter. It plays as the phone does: a raid's fight on
screen holds the town (`fightOnScreen`: only the battle steps), and a question the founder must answer is answered with
its first choice. It counts, of grown-up time: each task's share; idle while awake (and idle with a free gather cell or
an unmanned site waiting); hungry (under `HUNGRY`) and hungry at work; badly hurt (`needsSickbed`) and hurt at work;
each fetch's trip (hauler to store to site) against the best store; meals' walks against the nearest food; going to
bed hungry with food in store; hungry during a raid's warning; who turns out against a raid; the most on one job;
food days at winter's start; and deaths by cause.

**What was found** (before, same seeds):
1. **Going to bed hungry (the most often, and seen on every tap card as a low food bar and the "Hungry" mood):** a
   quarter of all bedtimes (25% in the late town, 15% in the fresh ones) were with food under `HUNGRY` and food in the
   stores. Bedtime came before the hunger check, so they slept on it and woke under 0.25 ("Hungry", -10 mood), and the
   dawn's count of hungry folk (dynasty.ts `HUNGRY_BELLY`) rears the children hungry. The late town was hungry 18% of
   its time, the fresh ones 11%.
2. **The whole town stands hungry through a raid's warning:** the alarm comes before every need, so with a lookout's
   hour (or a watchtower's two) of warning, everyone stood at the rally point not eating: 56% of the warning's
   person-ticks hungry in the late town, 48% in probe-b.
3. **Trapped and starving with food in store (rare, but the worst thing to watch):** someone standing in a one-cell
   gap, built round (a building above and below) with rock either side, had no way out: `pathTo` found none and the
   straight line stopped at the rock, so they stood "walking to eat" for a day and more, starving. probe-a: 24 434
   starving person-ticks, most of them two or three people stuck like this.
4. **Held to an event's work till they starve:** someone set to an event's toil (a fireline to cut: `s.busy`), on strike,
   or at a funeral or feast was meant to "eat when they must", and `chooseTask` did offer them a meal, but `updatePerson`
   switches only to a more urgent task and those rank above eating, so they worked on to nothing: in probe-d five of
   the tribe stood chopping at 0.00 food for hours (19 718 starving person-ticks in that run).
5. **The badly hurt work on:** with no sickbed free (most early towns have none), someone under half their health kept
   gathering and hauling at the awake healing pace: 69% of the hurt time in probe-c was at work.
6. **Haulers fetch from the store at their back:** the store nearest the hauler, not the one on the way, so the trip
   ran 7% longer than it needed in the late town (34.5 cells against 32.2), 1% in the fresh ones.
- Looked for and not a problem worth a rule: idling with work waiting (0.1–0.4% of grown-up time; the idle time there
  is is evenings with nothing to do), meals at the nearest food (always), the hungry at work (under 1%), defenders
  turning out (92–99% of the able), food before winter (4–13 days of food at winter's start, no hunger deaths in any
  run). The most on one job reaches 90–100%, but that's the dawn's gathering and the streets laid in spare time, both
  capped by the cells there are. Deaths in the late town are the Dragon (Vermithrax burns 8–9 in four days).

**What changed** (`sim/people.ts` `chooseTask`, `findJob`, `findCraft`; `sim/walk.ts`; `sim/townsfolk.ts`):
- **A supper before bed:** someone going to bed under `SUPPER` (townsfolk.ts: `HUNGRY` plus a night's sleep at
  `ASLEEP_HUNGER`, about 0.57) eats first while the stores hold food, so they wake above `HUNGRY`. HISTORY's "Nobody
  starves in bed" once dropped a forced meal before bed because it cost lone founders; this one is only for those who'd
  wake hungry, and its probe (36 lone founders, 10 days) gives 3.33 people where it was 3.31.
- **A meal while the raid's warning runs** (`mealBeforeRaid`): with the alarm up but the raiders still `RAID_MEAL_TICKS`
  (half an hour) or more off, the hungry eat first, then take up arms or shelter; a defender already at the rally point
  who grows hungry leaves it to eat (the one switch to a less urgent task `updatePerson` allows). With the raiders
  nearly here, straight to arms as before.
- **A meal breaks off event work, a strike or a funeral** (`MEAL_BREAKS`: `toil`, `protest`, `attend`, and `defend` for
  the meal before the raid): `updatePerson` lets a meal `chooseTask` offers take over from them, though they outrank it.
- **A way out for the boxed-in** (`wayOut` in walk.ts): when no path is found and the walker's own cell has no open
  side (rock, or a building that isn't where they're going), they scramble to the nearest open cell within
  `WAY_OUT_CELLS` (4) that has a way on from it. Not boxed in, the walk is as before.
- **The badly hurt go home to bed:** with no sickbed free, someone under `SICK_AT` lies in their own bed (a `sleep` task
  with `sick`, so they stay till `MENDED`, up only to eat), healing at the bed's pace (three times awake). Not the founder
  while the player has given them an order.
- **Makings fetched on the way** (`storeOnTheWay`): a hauler's or crafter's fetch is from the store that makes the whole
  trip (to the store, then on to the site or station) shortest.

**After** (same seeds; the fresh towns play out differently from the first changed choice on, so their numbers
compare as totals over the four, and the probe's idle count now includes the hungry, before and after alike):
- Hungry: late town 18.3% of the time to 1.2%; fresh towns 10.8% to 1.3%.
- To bed hungry with food in store: late 25.0% to 0%; fresh 14.5% to 0%.
- Hungry through a raid's warning: late 56.2% to 0%; fresh 48.1% to 3.5%.
- Hurt at work: fresh 19.7% to 0.4% (probe-c 68.7% to 0.7%).
- Fetch trip against the best store: late 34.5 against 32.2 cells to 33.7 against 33.7; fresh 31.8 against 31.4 to
  28.9 against 28.9 (always the best).
- Starving person-ticks: probe-a 2 600 to 158 (and 24 434 to 275 in the run that found the trapped walkers); the four
  fresh towns 3 229 to 3 494 in all, the rest being brief stretches walking to food after an empty spell (the late
  town's 700 or so are people the fixture starts at nearly empty food). Hunger deaths: none before or after.
- Idle with work waiting: late 0.1% to 0.0%, fresh 0.4% to 0.5%. People at day 35 in the four fresh towns: 46 to 59.
- Lone founders, 36 seeds, 10 days: 3.31 people to 3.33.
- Speed (`tools/perf-sim.mjs`, 3000 ticks of the late town): step 1.62 ms before, 1.60–1.62 ms after; two game days
  flat out 4.0–4.5 s both (the machine's noise).

Tests: `test/smarterTown.test.ts` (a supper for the would-be hungry and not the fed; none with empty stores; a meal
before the raiders arrive, and for a defender who grows hungry at the line; straight to arms when they're nearly here;
the hurt home to bed, healing faster; the store on the way; the boxed-in walker out to eat; someone held to event work
breaking off to eat). Each rule's test fails on the old code.

**What's left:**
- Other traps than a single boxed cell: a pocket of several cells closed off by buildings and rock would still hold
  anyone inside it (none was seen in these runs).
- Gathering picks the nearest marked cell to the gatherer, not counting the walk home to a store with room.
- The planner's recommendations were not judged here (the town no longer builds by itself, so a probe can't see whether
  a recommendation was useless without a player); a good next step is a probe that follows them and scores what each
  building did.
- The dawn rush (half the town out to the same few marked cells at once) could be spread over the morning.
