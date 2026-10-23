## The God creature, round two: its name, its pen, its spells, its life among the townsfolk

The owner's four asks, on the God creature (HISTORY.md "The great creature"; docs/notes/great-creature.md and
docs/notes/god-creatures.md): the town names it and always calls it by that name; it comes back at its pen when it dies,
the pen being a building opened by research whose building starts the saga; it learns spells by its nature or by
watching the townsfolk cast, "a curious thing, always learning and adapting"; and a menu of its own, and many ways to be
with the townsfolk (playing, helping, going on adventures if it likes them), the founder first. Changes "The great
creature" (its coming, its sleep, its death) and adds three files: `data/creatureSpells.ts`, `sim/creatureSpells.ts`,
`sim/creatureFolk.ts`. Every new rule runs with the autopilot on, on the creature's own side stream
(`${seed}:creature:${tick}:...`); every new `CreatureState` field is optional.

**The name** (sim/naming.ts `askCreatureName`, `CREATURE_NAMING`). When the player picks the creature
(`adoptCreature`), the town is asked to name it: the founder's naming question (`kind: 'name'`, `naming: { kind:
'creature', id: 'creature' }`), three names that fit its kind (`CREATURE_NAMES`, data/creature.ts: eight a kind) and a box
to type one, the last option keeping the name it goes by till then (the first of its kind's names free of the
townsfolk's own). `applyName` takes `kind: 'creature'` (a townsperson's name is refused); the `name` command takes it too,
so it is renamed from its menu. The name is `creature.name`, which the saga's `{beast}`, the news, its deeds, its card,
its menu and now a label under it on the map (map/mapCreature.ts `label`) all use; in a party's fights its fighter is
called by it, and on the raid board its spells are cast under it.

**The pen** (`CREATURE_PEN` `creature_pen`, `CREATURE_PEN_BUILDING` in data/creature.ts, merged into `BUILDINGS`):
the **Creature Pen**, 4 by 3, 30 wood, 12 stone, 4 hide, opened by the research that brought the saga (`great_beasts`,
God Creatures; its `unlocks` line now names the pen). The player orders it from the build menu (Town tab, Other) like
every building; the planner never lays it out and its studies don't count it (`NEVER` and `SELF_BUILT`, planner.ts), it
stands outside the castle (castle.ts `OUTSIDE`) in the farm quarter (layout.ts). Art: the kit's `pen` role
(iso/isoKits.ts `roleOf`: the kennels', ranch's and stable's), and for the old top-down view a pick of the ranch's
fences round a bed of hay (map/packBuildings.ts). `creatureArrives` begins the saga only once the topic is studied
**and** a pen stands (`penOf`). The creature lives there: it comes at the pen's front (`penFront`, so it is seen and not
hidden under the roof), and sleeps there (`bedOf`; the player's Rest too). A town whose creature or saga came before the
pen keeps both as they were.

**Coming back** (`creatureReturns`, from `creatureTick`). Dead (starved, in a raid, on the road), it is told whether
its pen stands, and comes back at the pen after `RESPAWN_HOURS` (18) game hours, weakened: `BACK_HP` (a quarter) of its
health, `BACK_SHRINK` (0.08) of its growth lost (never below `BORN_SIZE`), hungry and shaken; its name, its lessons, its
spells, its likings and its nature are all kept. `deaths` counts the times, `cameBack` the tick (the map fades it in out
of a flare of its halo, playing `getup`: `RISE_S`, `RISE_TICKS`). With no pen it waits, told once (`penless`), and comes
back as soon as one is built. An old save's dead creature comes back the same way, from the hour it is loaded. The saga
waits for it (data/creatureSaga.ts `grownOrGone`): it ends in its loss only when it is dead with no pen.

**Spells** (data/creatureSpells.ts, sim/creatureSpells.ts; `spells`, `seen`, `castAt` on its state). Every spell it
knows is a real one of data/spells.ts, so its effects and the effect it plays (data/actFx.ts) are that spell's.
- *By its nature* (`learnByNature`, hourly; `NATURE_SPELLS`): a good creature learns Mend at 20, Healing Rain at 40, Holy
  Shield at 60; a cruel one Terror at -20, Fireball at -40, Call Lightning at -60. Once known, kept.
- *By watching* (`creatureWatches`): a townsperson's spell cast in its sight is counted in `seen`, and learned at
  `WATCH_LEARN` (0.1) × its kind's `learn`, more each time it has seen it before (`SEEN_BONUS` 0.3 a sighting, at most
  `WATCH_MOST` 0.6), less for a great spell (`LEVEL_HARD`). It watches: on the raid board, a townsperson's spell cast
  within `SIGHT_TILES` (6) of its unit (tactics.ts `cast`); in a party's fight it is in (sim/creatureFolk.ts
  `watchBattle`, the fight's `acts`); in the town, a caster at home within `SIGHT_CELLS` (10) practising one of their
  spells, at `PRACTISE_SEEN` (a quarter) an hour each (`watchInTown`). It knows at most `SPELLS_MOST` (8); a new one
  pushes out the least used, never one of its nature's.
- *Getting better*: each cast adds `PRACTICE` (0.05) to the spell's `skill` (from `FIRST_SKILL` 0.2, or `NATURE_SKILL`
  0.4 for its nature's), up to 1.
- *In the town*: a new deed, **miracle** (`CREATURE_DEEDS.miracle`, the sheet's `miracle` move: iso/creatureRules.ts),
  at most every `MIRACLE_GAP_HOURS` (5) (`miracleFor`, `workMiracle`): what each does is its `TownMagic`
  (`townMagicOf`): a mend heals the hurt (the founder first), rain grows the fields, a shield or blessing lifts spirits,
  a spell of harm learned by watching hunts game in the wild, the rest are a show for the children; the cruel ones
  (only angry, or crueller than -40) terrify someone, call lightning on someone, or, in a rage, set a building alight
  (fire.ts `setFire`), else scorch a field. Its nature moves by the spell (`TOWN_ALIGN`), and the deed is asked about
  like any notable deed.
- *In fights*: its spells as a kit (`creatureKit`): each at `spellPower(skill)` (0.45 to 0.9) of a caster's, and
  `SPELL_SLOW` (1.6) times as slow to come round. On the raid board its unit gets the kit (tactics.ts `startTactics`),
  casts through the board's own choice (`bestCast`, `kitTurn`, `cast`, made to take its unit: `caster`, `isBeast`,
  `spellReach` with `BEAST_SPELL_REACH` 3), its blow scaled by its size (`might`); in a party's fight its fighter
  carries the kit (`takeTurn` uses it as anyone's).

**Among the townsfolk** (sim/creatureFolk.ts; `likes`, `nudged`, `fond`, `away` on its state).
- *Its likings* (`CREATURE_LIKINGS`: play, work, adventure, magic; -1 to 1): from its kind (`KIND_LIKES`: the ape
  plays, the wolf roams, the bull and the golem work...) and a roll (`startLikes`; an old save's creature has its kind's,
  `likeOf`). Each deed feeds one (`likingOf`) and its weight is × (1 + liking) (`deedWeight`); what it does content it
  comes to like (`LIKE_DRIFT` 0.02), miserable a little less. The player nudges one either way from its menu, gently:
  `NUDGE` (0.15), at most once in `NUDGE_HOURS` (2), half as much against its grain for a quick-tempered beast (the
  command `creatureNudge`, `nudgeLiking`). It is a creature, not a unit: there is no order to give it.
- *Playing*: its `play` deed now has a playmate (a child, a grown-up it is fond of, or the founder), lifts their
  spirits and is told with their name.
- *Helping*: hauling beside the founder when they carry, raising the founder's own building first.
- *Fondness* (`befriend`, `favourites`): it grows fond of whom it plays with, helps, heals and follows, the founder's
  ties counting double.
- *The founder first*: a new deed, **follow** (`FOUNDER_PULL` 1.6, more the fonder it is), walking at the founder's
  side; the founder's work, wounds and company weigh `FOUNDER_HELP` (2) times; a mend goes to the founder first.
- *Adventures* (`joinAdventures`, hourly): a party just out (in its first two hours): the founder's whenever it can (grown
  to 0.2, half its health, awake, no raid) unless it has come to shun adventure (`ADVENTURE_SHUN` -0.4); anyone else's
  only from `ADVENTURE_LIKE` (0.25), at `JOIN_CHANCE`. Away (`away`), it is off the map; in the party's fights it is one
  of them (`creatureFighter`, as big and strong as it is grown, with its spells; `CREATURE_REF`), keeps the wounds
  (`creatureBattleOver`; beaten down, it dies at `RAID_DEATH`), and comes home with the party (`creatureAwayTick`),
  fonder of the road if it went well. Hooked in at expeditions.ts `fightGroup`, `finishBattle` and the battle's step.

**Its history** (`history`, `remember`: forty kept): its coming, its naming, its spells found, its deaths and returns,
its adventures, and its gravest deeds.

**Its menu** (panel/townsfolkPanel.ts `beastSection`): the People menu has a **Creature** tab while the town has one
(panel/subtabs.ts `GROUPS`: The God creature, Its spells, Its likings, Its deeds, Its pen), and the creature's tap card
opens it ("<name> menu…": main.ts `openCreature`). It shows its card (name, kind, stage, age, the times it came back,
its nature's bar, mood, needs, the "Now" line: map/creatureCard.ts `creatureNow`, like the founder's), Praise and
Scold when a deed waits, Feed and Rest, a box to rename it; its spells with their mastery, how each came and how often
cast, and what it is watching and learning; its likings with Encourage and Discourage, what praise and scolding taught
it, and whom it is fond of; its deeds lately and its history by day; its pen. The snapshot's `CreatureView` grew
`backAgo`, `backIn`, `deaths`, `pen`, `away`, `spells`, `learning`, `likes`, `nudgeReady`, `friends`, `history`,
`with`. The tap card adds its spells.

Tests: `test/creature2.test.ts` (naming, the pen and the saga waiting for it, coming back and waiting for a pen, an old
town without a pen, nature's spells and a miracle on the founder, learning by watching, casting on the raid board,
adventures with the founder's party and another's, the founder first, nudging); `test/creature.test.ts`'s saga test now
builds the pen first.

**For the owner** (decided here; say if you want them otherwise):
- One name for the pen for every people, "Creature Pen" (the game has no per-people building names to hang others on).
- It comes back 18 game hours after it dies (18 minutes of play), with a quarter of its health and a little smaller.
- Its spells are drawn from the game's own spell list: Mend, Healing Rain and Holy Shield for a good creature; Terror,
  Fireball and Call Lightning for a cruel one; anything a townsperson casts near it may be learned.
- A cruel creature's fireball can set a building on fire in town when it is in a rage.
- It joins the founder's party unless it has come to dislike adventure strongly; others' only once it likes adventure.
- It sleeps at the front of its pen, not inside it, so it can be seen.
- The menu is a tab of the People menu (Creature), not a menu of its own along the bottom.

Screenshots in `docs/notes/god-creature-2/` (393x852 and 852x393, a late knights' town): the creature at its pen
(the knights' kit's barn) with its name under it and its tap card (`pen-name-card-tall`, `pen-card-wide`); its menu
(`menu-tall`, `menu-wide`, `menu-spells-deeds-tall`, `menu-likings-tall`, `menu-deeds-wide`); come back from the dead
at its pen, weakened, and the menu telling it (`respawn-at-pen-tall`, `respawn-menu-tall`, `respawn-deeds-tall`); and a
spell worked in the town, a Mend on the hurt founder, played with the miracle move and asked about (`spell-mend-tall`,
`spell-card-tall`, `spell-card-wide`).
