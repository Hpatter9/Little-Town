## Magic as a system of the town

Magic was only a set of combat actions (data/spells.ts). Now it's a system of the town too: the land has leylines, the
town gathers mana from them, studies seven schools, its casters learn spells by study and practice, and it works rites
that help it in and out of fights. Magic also bites: miscasts, madness, wild-magic surges, tears into other worlds and
cursed things. Only with the autopilot on, and only once the town has learned **Leyline Lore**. Its rolls are its own
side stream (`${seed}:magic:${tick}`), never the town's.

- **The data** (`src/shared/data/magic.ts`):
  - **Topics** (`MAGIC_TOPICS`, merged into `TOPICS` in research.ts):
    - Leyline Lore (`ley_lore`, Medieval, after The Arcane Arts) opens the **Mage Tower** (`mage_tower`) and the
      **Arcane Library** (`arcane_library`); both are in `MAGIC_BUILDINGS`, merged into `BUILDINGS`.
    - Seven schools come after it (`SCHOOLS`, `school_<id>`): Evocation, Abjuration, Restoration, Divination,
      Transmutation, Conjuration (after Transmutation) and The Forbidden Arts (Occult, after Conjuration).
    - The planner weighs them with `magicTopicWorth`: the lore +26 at six people, a school +12, the war schools +10 more
      once raided. This is a one-line hook in planner.ts `topicScore`.
  - **Spells by school:** each school teaches a list of the existing spells (`SCHOOL_SPELLS`) to any caster who studies
    it.
  - **Items** (`MAGIC_ITEMS` and `MAGIC_UNIQUES`, merged into `ITEMS`; the stations `mage_tower` and `arcane_library` are
    added to `Station`):
    - A tome per school (`tome_<school>`, made at the library). Kept in the stores, it makes study of its school
      `STUDY_TOME` faster.
    - Three **foci** (`FOCI`: Apprentice's Focus, Ley Crystal, Runed Orb; charms, made at the tower).
    - Three **enchanted** charms (`ENCHANTED`: the Leyheart, the Mantle of Stars, the Ring of Quiet Mending) and three
      **cursed** ones (`CURSED`: the Ashen Grimoire, the Hollow Crown, the Bloodstone). These are one-of-a-kind relics.
  - **Each people's flavour** (`FLAVOURS`): what they call mana (grave-essence, the green, aether, glamour, quintessence,
    moonlight...), how fast they gather it, the schools they're good at (`FAVOURED` 1.3: rites stronger, study quicker),
    a school they shun (the druids and the knights the Forbidden Arts), what their animated servants are (skeletal
    thralls, clockwork drones, homunculi, pixies...), how much the Blood Rite weighs on them (`bloodGuilt`: the liches and
    the Court 0.3), and the Moon Pack's mana at night (`night` 1.8).
- **The leylines** (`leyOf`, `leyAt` in `src/shared/sim/magic.ts`):
  - `LEY_LINES` (3) straight lines across the land from the seed. The first passes within `LEY_NEAR_CAMP` (18) cells of
    the camp.
  - Each is felt `LEY_HALF` (6) cells either side, with wells where they cross (`WELL_R` 8, `WELL_POWER` 1.5).
  - The whole is scaled by the biome (`LEY_BIOME`: the ashlands 1.4, the desert 0.8).
  - Cached by seed and land.
- **Mana** (`magicHourly`, hourly from sim.ts after portals):
  - Each finished tower gives `TOWER_MANA` (3) × (`TOWER_BASE` 0.4 + the ley under it) an hour, and each caster at home
    gives `CASTER_MANA` (0.25).
  - The store is capped at `MANA_CAP` 30, +60 a tower, +30 a library.
  - The town lays its first tower itself on the strongest ley near the camp (`placeTower`); the library is the planner's
    "learned to build it". Neither is laid before the town has `TOWER_PEOPLE` (6) grown-ups and a spare build slot (a
    one-line hook in planner.ts's "learned to build it" loop): a hamlet's stone goes on homes first.
- **Study** (`studyHourly`):
  - Each caster at home (`castsSpells`: data/spells.ts `SPELLCASTERS`) studies the most advanced spell of the town's
    schools they can reach (`nextStudy`: up to `STUDY_AHEAD` (5) levels past their own) and don't know.
  - A spell takes `STUDY_PER_LEVEL` (4) hours a level. Study is ×2 at the library (×1.4 at the tower), quicker with the
    tome, by Intellect (`STUDY_INT`), and for a favoured school.
  - The Forbidden Arts tempt only a witch, a necromancer, the half-mad, or a people that favours them.
  - Learned spells are `Person.arcana.spells` (`Arcana`: also the study in hand, practice, madness, rites, miscasts).
    They go into the fight's kit: `readySpells(cls, level, studied)` and `kitOf` in actions.ts.
  - A focus or a magic charm adds its `power` to the kit's spell power (`kitOf`). Foci go to casters who have none
    (`focusCasters`), and `canWear` keeps them out of anyone else's hands (classes.ts).
  - The library writes each school's tome once, and the tower makes foci while a caster lacks one (`wantTomes`, through
    `queueCraft`).
  - A caster with `MASTER_SPELLS` (10) learned makes their masterwork once: an enchanted charm (`masterworks`).
- **The rites** (`RITES`, `RITE_ORDER`; `ritesHourly`, one an hour):
  - Each hour the town casts the first rite it wants that it has the mana and a caster for. The caster is the one best
    at that school (`riteCaster`).
  - A rite's strength (`potency`) is +`POTENCY_PER_SPELL` (0.15) per spell of its school the caster knows, ×1.3 if the
    school is favoured.
  - **The Great Ward** (Abjuration, 25 mana): a raid on its way loses `WARD_SAP` (0.15 × potency, at most 0.4) of every
    raider's health.
  - **Firestorm** (Evocation): `STORM_HITS` (3) raiders burned for `STORM_BURN` (0.45) of their health × potency; the
    burned are struck from the host.
  - **Foresight** (Divination): a raid seen coming arrives `FORESIGHT_HOURS` (2) later. With no raid on, it tells the
    next raid within `OMEN_HOURS` (12).
  - **Rite of Mending** (Restoration): up to `MEND_MOST` (6) of the downed, hurt and sick: the downed stop bleeding, the
    hurt get back `MEND_SHARE` (0.4) of their health, and the sick are eased.
  - **Breaking of Curses** (Abjuration): a cursed charm worn is broken.
  - **Rain-calling** (Transmutation): ends a drought, or puts out a wildfire, within the hour.
  - **Enchanting the Tools** (Transmutation): all work is `ENCHANT_WORK` (1.12) faster for `ENCHANT_HOURS` (24). This is
    a one-line hook in townsfolk.ts `workFactor`.
  - **Scrying** (Divination): maps the nearest unmapped region of the world map.
  - **Animation** (Conjuration): a servant, up to `SERVANTS_MOST` (2) + one per tower. Each eats `SERVANT_UPKEEP` (0.6)
    mana an hour and fetches wood and stone. Starved, one turns on someone (`SERVANT_TURNS`, a share of their health)
    and is gone.
  - **The Blood Rite** (Forbidden, below `BLOOD_WHEN` of the cap): bleeds a prisoner dry, else a townsperson
    (`BLOOD_TAKES`; it may kill), for `BLOOD_MANA` (45). It is only cast with a prisoner to bleed, or in a town of
    `TOWER_PEOPLE` grown-ups. It may leave a cursed charm behind.
  - Alignment: rites push `alignPush`/`orderPush` (the Blood Rite −3 and −0.5 order, scaled by `bloodGuilt`; Mending
    +0.5; the Ward +0.3 order). A mad mage cast out costs −1, and one who kills −2.
- **What it costs:**
  - **Wild magic.** Every rite stirs the wild magic (`flux`: `FLUX_PER_MANA` per mana spent). It settles
    (`FLUX_SETTLES`), and a tower on a line stronger than 1 stirs it a little (`FLUX_LEY`).
  - **Miscasts.** The chance is `danger` × (1 + 2 × flux) × (1 − mastery) × (1 − a focus's steadiness) × (1 +
    madness). Mastery is practice/(practice + `MASTERY_HALF`), at most 0.8. The outcomes (`MISCAST_ODDS`):
    - a backlash burn (`BACKLASH` 0.45 of their health);
    - madness (+`MAD_MISCAST` 0.35);
    - death ("torn apart by a miscast"; never the founder);
    - the spell running wild (+0.35 flux);
    - a tear into another world (`tearRift` in sim/portals.ts), else a surge.
  - **Madness.** It grows with Forbidden rites (`MAD_FORBIDDEN`), high wild magic (`MAD_FLUX`) and cursed charms, and
    settles slowly (`MAD_SETTLES`). Past `MAD_AT` the mage is put to the town (`askMadness`: a `ways` prompt, system
    'magic', answered by `answerMagic` through heritage.ts `answerWays`). The answers:
    - lock them in the tower for `LOCK_DAYS` (5), which is the default;
    - let them work on: `MAD_TURNS` (0.35) they kill someone;
    - send them away (never offered for the founder).
  - **Surges.** Past `SURGE_AT` (1) the wild magic surges (`surge`), then falls back to `SURGE_LEAVES`:
    - buildings near the tower catch fire (`SURGE_FIRES`);
    - people within `SURGE_R` (14) cells are burned (`SURGE_WOUNDS`) or killed (`SURGE_KILLS`);
    - a grey pox may break out (`SURGE_PLAGUE`: the plague doom with 2 to 4 sick);
    - a tear may open (`SURGE_TEAR`);
    - a cursed charm may be left behind (`SURGE_CURSE`).
  - **Cursed charms** drain their bearer (`CURSE_DRAIN`) and add to their madness (`CURSE_MADNESS`) every hour, until a
    ward-wright breaks them.
- **Saves:** `GameState.magic?` (`MagicState`) and `Person.arcana?` (`Arcana`) are optional. Older saves start
  without them.
- **Seen:**
  - **Map marks:** the rites play on the map as `magic:<rite>` spells (`castSpellFx`). `LOOKS` in town/spellLooks.ts
    gives each school its pixel-effects strip (`SCHOOLS[].fx`), plus `magic:surge`, `magic:miscast` and `magic:mad`.
    Their names come from `spellName` in snapshot.ts (`MAGIC_FX_NAMES`).
  - **Snapshot:** `snapshot.magic` (`MagicView`: mana, cap, the wild magic, the schools, the casters, the rites, the
    counts, the log, the leylines and towers), and `PersonView.arcana` (`arcanaView`, in the fight view's cache).
  - **The Magic tab** in the Town menu (`renderer/panel/magicPanel.ts`, `magicSection`; `GROUPS` 'Magic'). It shows the
    mana and wild-magic bars, the schools, the casters (study and mind bars) and the rites. Its key is folded into
    `heritageKey`.
  - **The Townsfolk page:** a caster's **Spellbook** (every spell, 📖 for those learned by study, mastery, rites,
    madness, what they study).
  - **The leylines on the map:** they glow after dark (`renderer/map/mapLeylines.ts`, `MapLeylines` in the map's
    additive lights layer, so not by day), with wells and towers brighter and a slow pulse. They're synced from main.ts
    (`syncLeylines`).
  - **Building art:**
    - The tower is the Simple Summer pack's Magic Stone Tower (`art/packs/su_stonetower.png`), with a lamp on its
      crystal.
    - The library is laid from the Dungeon Props sheet already in the game (`dprops.png`: the glass jar, the shelves of
      tomes and potions, two reading tables).
  - **The fight screen** (fightView.ts) no longer paints its cast and impact circles. A cast plays the pixel-effects
    atlas's `<element>-gather` strip round the caster (`PX_ELEMENT`).
- **Tests:** `test/magic.test.ts`, `test/mana.test.ts`.

- **Changes other systems** (all small hooks):
  - "Turn-based fights where stats matter": `readySpells` and `kitOf` take studied spells and a focus's power; mana is
    kept between fights.
  - "Tactics battles" and "Tower-defence raids": spells cost mana there now.
  - "Class paths" (`canWear`).
  - "Combat effects" (the fight screen's cast).

### Mana that runs out (the owner's ask: "casters can just cast all they want; a mana bar under the health bar")

- **Why it felt free:** only an expedition's fight gave its fighters a pool (combat.ts `personFighter`). The raid's
  tactics board and its trail built their townsfolk without one, and `canPay` (actions.ts) lets a fighter with no pool
  cast anything. On the board, too, the player's order (`tacticsOrder` 'skill') never asked about the cost.
- **The pool** (`src/shared/sim/mana.ts`):
  - Who has one: a calling that casts, or anyone who has learned spells by study (`hasMana`).
  - Its size is `maxManaOf` (Intellect and Wisdom), widened by a focus or a magic charm (`FOCUS_MANA` 1.5 × its spell
    power: a Ley Crystal +30%).
  - It's kept on the person between fights (`Person.mana`, left out while full; `manaNow`, `setMana`).
- **Charged in every fight:**
  - **Expeditions:** a fight starts from what's left (`personFighter` `mp: manaNow(p)`) and writes it back at the end
    (expeditions.ts `finishBattle`).
  - **The tactics board and the trail:** the townsfolk's combatants read and charge the person's own pool (getters on
    `asPerson` in tactics.ts, `mapArena` in battle.ts).
  - **The player's orders on the board:** they can't pick a spell they can't pay for (the 'skill' order, and the menu's
    `ready`).
  - **Falling back:** a caster without the mana strikes instead.
- **Coming back:**
  - In a fight, `manaRegenOf` each turn (`manaTurn`: at each turn on the board, each action on the trail).
  - Out of a fight, `MANA_REST` (0.12) of the pool an hour, times (1 + the leyline's strength where they stand)
    (`manaRest`, from `manaHourly` in sim/magic.ts). This runs every hour whether or not the autopilot is on, like
    healing.
  - Potions are left to the battle-items chat.
- **Seen:**
  - `PersonView.mana` ([now, most], a fast field of the snapshot; null without a pool).
  - A thin blue bar under the health bar over people on the map in a raid (mapPeople.ts `hpBar`).
  - Under each unit box's health bar on the tactics board, with "MP n/m" beside HP (`TacUnitView.mp`/`mpMax`,
    tacticsView.ts `drawBars`).
  - On the Townsfolk page's "Health and spirits" (`manaBar`).
  - The side-view fight's HUD already had its MP meter under each party member's health (fightHud.ts); foes have no pool.
