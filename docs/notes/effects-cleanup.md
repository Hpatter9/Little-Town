## Effects that match what went off

The owner's ask: "Clean up the effects so they look better and match the skill or reason they proc better." It changes
the HISTORY.md sections "Combat effects" (how an effect is chosen), "The flashier raid screen" (the impacts and the new
cues), "Combat actions" and "Watching a party's fights" (the fight screen's effects and numbers). No new art: every
effect and cue is a strip of the 5000 Pixel Effects atlas or one of the Craftpix, pvfx and Alenia sheets already in
`src/renderer/art/effects/` (credited in `CREDITS.md`). The Craftpix magic pack's own icons were looked at for the cues
and passed over: they are framed spell icons, too busy at 22 px.

**What was wrong (the inventory, before).** All 479 acts (160 spells, 283 skills, 26 ultimates, 10 battle items) were
listed with what they do and the effect they played (the table below). Found:
- **The arcane catch-all.** An act whose effects had no element (a status, a ward, a summons, a cleansing) got the star
  (arcane) colour: Poison Cloud and Plague were purple-blue smoke, Sleep Charm, Doom, Terror, Evil Eye, Earthbind,
  Winter's Grasp, Bone Armour, Sanguine Shield and Barkskin all star-blue. 193 of the 479 acts were `px:star-*` (52 now, the arcane acts' own).
- **Every ward the same solid disc.** `px:*-shield` is a filled, hatched disc: at the board's size it hid the one it
  guarded whole. 34 acts played it, 33 of them the one star disc, whatever the ward (holy, bone, blood, bark, stone, time).
- **Names misread.** "Warden's Wrath" matched "ward" and played a shield for a strike; "Fireball" missed `\bball\b`
  and played a flame; "Divine" matched forest's "vine".
- **Ultimates by an element they did not have.** An ultimate with no element fell back to arcane, so Divine Grace (a
  great mending) and Call of the Wild (a summons) played the magic-missile sheet; Storm of Arrows and Titan's Wrath a
  plain pop.
- **Blows all one slash.** The raid board played Craftpix's gold sword slash for every close blow (a club, a fist, a
  wolf's bite) and for every arrow, bolt and stone landing. A stunned unit and an opened chest both showed `mg_sparks`.
  Bow skills (Aimed Shot, Poison Arrow...) flew nothing on the board or the fight screen.
- **A "crit" that was not one.** The juice drew its crit cross and orange "!!" on any blow worth half a health bar; a
  true crit (a skill's or a weapon's) showed nothing of its own. Blocks, shields soaking a blow, reflected spells, thorns,
  resisted holds and counters were all invisible, or a bare "Miss".
- **Statuses unseen.** A stun, a sleep, a haste coming on showed nothing but text in the unit box.
- **Town spells.** Sea fog and the smoke bombs played the frost sheet, a dust storm iron spines, hellfire a rainbow
  prism, the orcs' berserk a fire slash.
- **One hook was wrong too:** `hold_the_line` is both a passive (`pathSkills.ts`) and an active skill
  (`moreAbilities.ts`); `ABILITY_BY_ID` holds the passive, so its effect had nothing to go on.

**What it does now.** `src/shared/data/actFx.ts` (`actFx(id)`, pure) chooses by what the act does first:
- **The element:** the strike's; a plain blow takes its rider's (a bleeding cut is blood, a poisoned arrow poison);
  else what the name says (`NAME_PX`: bone, grave and shadow are dark, bark and thorn forest, song and dirge crystal,
  time and clock the moon, mirror crystal...); else what it lays on (`STATUS_PX`: poison poison, sleep the moon, freeze
  ice, haste wind, regen forest...); a mending stays light unless its name says otherwise (never the wind). A ward
  takes its ward's colour (a guard's taunt does not make a shield fire). `actElement(id)` is that element, and the orb
  that flies and the gathering at a caster's hands are drawn in it.
- **The shape:** a mend sparkles up, a cleansing rings out (`burst`), a raising is a pillar, a summons a circle; a ward
  a dome (`aura`: no act plays the solid disc now); another blessing a ring at the feet (`circle`) with its icon over the
  head; a hindrance by what it lays on (`curseShape`: stars for a stun, smoke for a sleep or a poison, spikes for a
  freeze, a rune for a time stop, falling arrows for a weakening, a burst for a blinding, an X for a silence, a glyph
  for a doom); nets, snares, binds and entanglings the pvfx roots; war cries, howls and roars a nova; caltrops spikes;
  an oil slick a pool. A skill's blow by the arms in its name: `ARCHERY` (shot, arrow, volley, nock...) lands as a hit
  and flies an arrow (`actArrow(id)`), `CLAWS` (bite, claw, maul, gore...) an X, `BLUNT` (bash, slam, fist, palm, kick,
  staff...) a thud or a ground wave, `BLADE` a Craftpix slash of its element (`SLASH_SHEET`: fire, lightning, poison,
  water, wind, gold); an elemental art with no blade in its name is drawn as a spell. A spell's strike keeps the old
  name `HINTS` (now whole words) then a bolt, orb, burst or strike, an explosion, nova, wave, rain or pillar on all.
- **Ultimates** by what they do: a strike by its element (`ULTIMATE`), a bow's the magic missiles, a beast's or a
  brawler's fury Craftpix's pop; a great mending `life_fountain`/`suture`, a summons `portal`/`conjure`, a ward
  `parry`/`gold_vortex`.
- **Size:** `FAMILY_SCALE` sizes each shape against the others (an impact 0.75, an area wave 1.05); `SOLID` shapes (an
  explosion's blob, a pillar, smoke) are drawn at 0.8 alpha so the unit under them shows. On the board an effect is never
  wider than `FX_MOST` (96 world px, about a tile and a half) or `ULT_MOST` (150) for an ultimate; icon strips (a stun's
  stars) are drawn at `ICON_SCALE` 0.45. The board's act scale went 1.3 → 1.1 (ultimates 1.7 → 1.5); the juice's
  impacts are a little smaller (0.9 / 1.2 / 1.45, was 1.05 / 1.5 / 1.9).

**Procs: why it landed as it did.** The sim now tells the watcher (renderer-only data; nothing new is drawn from the
dice, so every town plays out as before): `Proc` (`data/effects.ts`: `crit`, `block`, `shield`, `reflect`, `thorns`,
`resist`, `counter`) on `Combatant.pop.why` (`sim/actions.ts`: a crit in `apply`, a shield soaking in `strike`, a
spell reflected over its caster, thorns over the striker, a hold resisted in `setStatus`; `sim/combat.ts`: a plain
blow's crit and block, a guard's counter) and on the board's `hits[].why` (`sim/tactics.ts`: plain blows read
`blowNote`, the note `hitDamage` leaves of its crit or block; spells read the arena's pops; "Shield", "Resist" and
"Reflect" are said where nothing was taken; a blocked blow says "Block", not "Miss"). Snapshot: `pop.why` on a
fighter, `why` on a board hit. `PROC_CUE` gives each its word and icon ("Crit!" with a gold "!", "Block" with a shield,
"Counter!" with a gold cross...). On the board (`BattleJuice.cue`) the icon (22 px) and word (12 px) rise over the head
beside the number and fade over `CUE_LIFE` 1.4 s (no rise under Reduce motion; a second at the same place stacks above
the first; at most `CUE_CAP` 10); the crit cross now plays only on a true crit. On the fight screen the number carries
the word in the cue's colour ("31 Crit!", "Block").

**Status cues.** `STATUS_CUE` (every status: Stunned with stars, Asleep "zzz", Poisoned, Haste, Inspired with an arrow
up, Berserk with a red cross, Taunt "!", Charmed a heart...). The board (`TacticsScene.renderCues`) and the fight screen
(`FightScene.stSeen`, a 12 px icon over the head for `CUE_MS` 1.1 s) show one when a status newly comes on a fighter
(seen in the snapshot, so only what truly took; nothing for statuses already on as the board is first seen).

**The board's other effects:** a close blow by the arms that struck it (`TacFx.melee`, `meleeLook` from the weapon's
or the creature's name: `MELEE_FX` blade `slash_gold`, blunt `px:white-hit`, claw `px:white-cross`); an arrow, bolt or
spear lands as `px:white-hit`, a stone `px:white-burst`; a stun `px:white-star`, a chest `px:gold-sparkle`. **Town
spells** (`town/spellLooks.ts`): fog `px:water-smoke`, smoke bombs `px:white-smoke`, the dust storm `px:sand-smoke`,
hellfire `px:fire-pillar`, the broadside `px:fire-explosion`, the orcs' berserk `px:blood-aura`. `SHEET_FILES` names each
older sheet's PNG.

**Tests:** `test/actFx.test.ts` (every spell, skill, ultimate and battle item maps to an effect whose picture exists: a
strip in `pixelfx.json` or a sheet in `SHEET_FILES` whose file is there; so do the town spells' looks, every status and
proc cue and the close blows; many shapes, none over a quarter, star effects under 12%; the fixes above named one by
one), `test/procs.test.ts` (crit, shield, reflect, thorns, resist told on the pop; `blowNote`'s crit and block, and the
same dice with or without it). Not done: the town map's trail battle (`map/mapBattle.ts`) plays the new `actFx`
effects but shows no cues (it has no per-fighter statuses in its view); the fight screen's cues are icons only, no word
(its figures are small).

**Pictures** (`docs/notes/effects-cleanup/`): `contact-1.png` to `contact-3.png`, before and after for forty-odd acts
and the board's own effects (three frames each, on grass); `raid-upright-*.png` (393x852) and `raid-sideways-*.png`
(852x393), a wolf raid on the isometric board with spells and blows going off; `cue-preview-upright.png`, the cues'
look (forced over the units from the console, so more at once than a real fight shows).

### Every act's effect

Bold: changed. Cue: the status whose icon pops (when it takes). Flies: a bow skill's arrow (spells aimed at foes fly
their element's orb as before).

| Id | Name | Kind | What it does | Effect before | Effect now | Cue | Flies |
|---|---|---|---|---|---|---|---|
| `spark` | Spark | spell | damage/lightning → foe | `px:lightning-hit` | **`px:lightning-burst`** |  |  |
| `mend` | Mend | spell | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `ward` | Ward | spell | status:shield → ally | `px:star-shield` | **`px:light-aura`** | shield |  |
| `flash` | Flash | spell | status:blind → foe | `px:star-status` | **`px:light-burst`** | blind |  |
| `dispel_magic` | Dispel Magic | spell | cleanse → ally | `px:star-sparkle` | **`px:light-burst`** |  |  |
| `quicken` | Quicken | spell | status:haste → self | `px:star-sparkle` | **`px:wind-circle`** | haste |  |
| `fire_bolt` | Fire Bolt | spell | damage/fire → foe status:burn → foe | `px:fire-bolt` | `px:fire-bolt` | burn |  |
| `frost_shard` | Frost Shard | spell | damage/ice → foe status:slow → foe | `px:ice-hit` | **`px:ice-spikes`** | slow |  |
| `thunder_jolt` | Thunder Jolt | spell | damage/lightning → foe status:stun → foe | `px:lightning-strike` | `px:lightning-strike` | stun |  |
| `flame_wave` | Flame Wave | spell | damage/fire → foes | `px:fire-wave` | `px:fire-wave` |  |  |
| `ice_lance` | Ice Lance | spell | damage/ice → foe status:freeze → foe | `px:ice-bolt` | `px:ice-bolt` | freeze |  |
| `chain_lightning` | Chain Lightning | spell | damage/lightning → random_foes | `px:lightning-strike` | **`px:lightning-spread`** |  |  |
| `arcane_missiles` | Arcane Missiles | spell | damage/arcane → foe | `px:star-bolt` | `px:star-bolt` |  |  |
| `blizzard` | Blizzard | spell | damage/ice → foes status:slow → foes | `px:ice-rain` | `px:ice-rain` | slow |  |
| `fireball` | Fireball | spell | damage/fire → foes status:burn → foes | `px:fire-orb` | `px:fire-orb` | burn |  |
| `thunderstorm` | Thunderstorm | spell | damage/lightning → foes status:stun → foes | `px:lightning-vortex` | `px:lightning-vortex` | stun |  |
| `mana_shield` | Mana Shield | spell | status:shield → self | `px:star-shield` | **`px:star-aura`** | shield |  |
| `meteor` | Meteor | spell | damage/fire → foes status:burn → foes | `px:fire-wave` | **`px:fire-rain`** | burn |  |
| `arcane_torrent` | Arcane Torrent | spell | damage/arcane → foe | `px:star-splash` | `px:star-splash` |  |  |
| `absolute_zero` | Absolute Zero | spell | damage/ice → foes status:freeze → foes | `px:ice-nova` | `px:ice-nova` | freeze |  |
| `cataclysm` | Cataclysm | spell | damage/fire → foes damage/lightning → foes | `px:fire-nova` | `px:fire-nova` |  |  |
| `hex_bolt` | Hex Bolt | spell | damage/dark → foe status:weak → foe | `px:dark-rune` | **`px:dark-bolt`** | weak |  |
| `wither` | Wither | spell | damage/dark → foe status:weak → foe | `px:dark-debuff` | `px:dark-debuff` | weak |  |
| `poison_cloud` | Poison Cloud | spell | status:poison → foes | `px:star-smoke` | **`px:poison-smoke`** | poison |  |
| `evil_eye` | Evil Eye | spell | status:fear → foe | `px:star-status` | **`px:dark-debuff`** | fear |  |
| `sleep_charm` | Sleep Charm | spell | status:sleep → foes | `px:star-status` | **`px:moon-smoke`** | sleep |  |
| `blood_hex` | Blood Hex | spell | status:vulnerable → foe drain/dark → foe | `px:dark-rune` | `px:dark-rune` | vulnerable |  |
| `witches_brew` | Witches' Brew | spell | heal → allies status:regen → allies | `px:light-sparkle` | `px:light-sparkle` | regen |  |
| `nightshade` | Nightshade | spell | damage/poison → foes status:poison → foes | `px:poison-rain` | `px:poison-rain` | poison |  |
| `curse_of_ages` | Curse of Ages | spell | status:slow → foes status:weak → foes | `px:star-debuff` | **`px:dark-debuff`** | slow |  |
| `mirror_hex` | Mirror Hex | spell | status:reflect → ally | `px:star-rune` | **`px:crystal-aura`** | reflect |  |
| `doom_curse` | Doom | spell | status:doom → foe | `px:star-debuff` | **`px:dark-glyph`** | doom |  |
| `crone_call` | The Crone's Call | spell | summon → self status:fear → foes | `px:star-circle` | **`px:dark-circle`** | fear |  |
| `cure` | Cure | spell | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `holy_light` | Holy Light | spell | damage/holy → foe | `px:light-orb` | **`px:light-burst`** |  |  |
| `protect` | Protect | spell | status:protect → ally | `px:star-shield` | **`px:light-aura`** | protect |  |
| `purify` | Purify | spell | cleanse → ally | `px:star-sparkle` | **`px:light-burst`** |  |  |
| `regen` | Regen | spell | status:regen → weakest | `px:star-sparkle` | **`px:forest-sparkle`** | regen |  |
| `cura` | Cura | spell | heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `holy_shield` | Holy Shield | spell | status:shield → weakest | `px:star-shield` | **`px:light-aura`** | shield |  |
| `smite` | Smite | spell | damage/holy → foe | `px:light-pillar` | `px:light-pillar` |  |  |
| `raise` | Raise | spell | revive → fallen | `px:light-circle` | **`px:light-pillar`** |  |  |
| `sanctuary` | Sanctuary | spell | status:protect → allies status:regen → allies | `px:star-shield` | **`px:light-aura`** | protect |  |
| `curaga` | Curaga | spell | heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `banish` | Banish | spell | damage/holy → foes | `px:light-pillar` | `px:light-pillar` |  |  |
| `divine_ward` | Divine Ward | spell | status:shield → allies | `px:star-shield` | **`px:light-aura`** | shield |  |
| `arise` | Arise | spell | revive → fallen heal → allies | `px:light-pillar` | `px:light-pillar` |  |  |
| `miracle` | Miracle | spell | heal → allies cleanse → allies revive → fallen | `px:light-pillar` | `px:light-pillar` |  |  |
| `bone_dart` | Bone Dart | spell | damage/dark → foe | `px:dark-bolt` | `px:dark-bolt` |  |  |
| `life_tap` | Life Tap | spell | drain/dark → foe | `px:dark-gather` | `px:dark-gather` |  |  |
| `raise_dead` | Raise Dead | spell | summon → self | `px:star-circle` | **`px:dark-circle`** |  |  |
| `corpse_blast` | Corpse Blast | spell | damage/dark → foes | `px:dark-explosion` | `px:dark-explosion` |  |  |
| `plague` | Plague | spell | status:poison → foes status:weak → foes | `px:star-debuff` | **`px:poison-smoke`** | poison |  |
| `bone_armour` | Bone Armour | spell | status:shield → self | `px:star-shield` | **`px:dark-aura`** | shield |  |
| `soul_rend` | Soul Rend | spell | drain/dark → foe | `px:dark-slash` | `px:dark-slash` |  |  |
| `terror` | Terror | spell | status:fear → foes | `px:star-rune` | **`px:dark-debuff`** | fear |  |
| `wraith_call` | Wraith Call | spell | summon → self | `px:star-circle` | **`px:dark-circle`** |  |  |
| `death_coil` | Death Coil | spell | damage/dark → foe | `px:dark-burst` | **`px:dark-bolt`** |  |  |
| `army_of_the_dead` | Army of the Dead | spell | summon → self summon → self summon → self | `px:star-circle` | **`px:dark-circle`** |  |  |
| `finger_of_death` | Finger of Death | spell | damage/dark → foe | `px:dark-bolt` | `px:dark-bolt` |  |  |
| `grave_lord` | Grave Lord | spell | summon → self drain/dark → foes | `px:dark-gather` | `px:dark-gather` |  |  |
| `call_spirit` | Call Spirit | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `spirit_bolt` | Spirit Bolt | spell | damage/arcane → foe | `px:star-bolt` | `px:star-bolt` |  |  |
| `call_wolf` | Call Wolf | spell | summon → self | `px:star-circle` | **`px:forest-circle`** |  |  |
| `call_salamander` | Call Salamander | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `spirit_link` | Spirit Link | spell | status:lifelink → allies | `px:star-sparkle` | **`px:star-circle`** | lifelink |  |
| `call_treant` | Call Treant | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `astral_blast` | Astral Blast | spell | damage/arcane → foes | `px:star-explosion` | `px:star-explosion` |  |  |
| `call_undine` | Call Undine | spell | summon → self | `px:star-circle` | **`px:water-circle`** |  |  |
| `call_golem` | Call Golem | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `soul_barrier` | Soul Barrier | spell | status:shield → allies | `px:star-shield` | **`px:dark-aura`** | shield |  |
| `call_drake` | Call Drake | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `planar_rift` | Planar Rift | spell | damage/arcane → foes | `px:star-pillar` | `px:star-pillar` |  |  |
| `convergence` | Convergence | spell | summon → self summon → self damage/arcane → foes | `px:star-explosion` | `px:star-explosion` |  |  |
| `thorn` | Thorn | spell | damage/nature → foe | `px:forest-spikes` | `px:forest-spikes` |  |  |
| `rejuvenate` | Rejuvenate | spell | status:regen → weakest | `px:star-circle` | **`px:forest-sparkle`** | regen |  |
| `entangle` | Entangle | spell | damage/nature → foes status:slow → foes | `px:forest-rain` | `px:forest-rain` | slow |  |
| `moonbeam` | Moonbeam | spell | damage/arcane → foe | `px:star-pillar` | `px:star-pillar` |  |  |
| `barkskin` | Barkskin | spell | status:protect → ally | `px:star-shield` | **`px:forest-aura`** | protect |  |
| `healing_rain` | Healing Rain | spell | heal → allies status:regen → allies | `px:light-rain` | `px:light-rain` | regen |  |
| `wild_growth` | Wild Growth | spell | status:regen → allies | `px:star-circle` | **`px:forest-sparkle`** | regen |  |
| `insect_swarm` | Insect Swarm | spell | status:poison → foes status:blind → foes | `px:star-spread` | **`px:poison-smoke`** | poison |  |
| `bear_shape` | Shape of the Bear | spell | status:berserk → self status:protect → self | `px:star-shield` | **`px:forest-aura`** | berserk |  |
| `call_lightning` | Call Lightning | spell | damage/lightning → random_foes | `px:lightning-circle` | **`px:lightning-strike`** |  |  |
| `hurricane` | Hurricane | spell | damage/wind → foes status:slow → foes | `px:wind-nova` | **`px:wind-vortex`** | slow |  |
| `tranquility` | Tranquility | spell | heal → allies cleanse → allies | `px:light-sparkle` | **`px:forest-sparkle`** |  |  |
| `wrath_of_nature` | Wrath of Nature | spell | damage/nature → foes status:stun → foes | `px:forest-wave` | `px:forest-wave` | stun |  |
| `spirit_strike` | Spirit Strike | spell | damage/arcane → foe | `px:star-strike` | `px:star-strike` |  |  |
| `healing_totem` | Healing Totem | spell | status:regen → allies | `px:star-sparkle` | **`px:light-sparkle`** | regen |  |
| `shock` | Shock | spell | damage/lightning → foe | `px:lightning-burst` | **`px:lightning-strike`** |  |  |
| `hex_of_frailty` | Hex of Frailty | spell | status:weak → foe status:vulnerable → foe | `px:star-rune` | **`px:dark-debuff`** | weak |  |
| `spirit_walk` | Spirit Walk | spell | status:invisible → self | `px:star-circle` | `px:star-circle` | invisible |  |
| `earthbind` | Earthbind | spell | status:slow → foes | `px:star-debuff` | **`px:earth-debuff`** | slow |  |
| `ancestral_call` | Ancestral Call | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `chain_heal` | Chain Heal | spell | heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `voodoo_curse` | Voodoo Curse | spell | drain/dark → foe | `px:dark-debuff` | `px:dark-debuff` |  |  |
| `storm_totem` | Storm Totem | spell | damage/lightning → random_foes | `px:lightning-vortex` | `px:lightning-vortex` |  |  |
| `spirit_link_totem` | Spirit Link Totem | spell | status:lifelink → allies | `px:star-circle` | `px:star-circle` | lifelink |  |
| `ancestors_wrath` | Ancestors' Wrath | spell | damage/arcane → foes heal → allies | `px:star-explosion` | `px:star-explosion` |  |  |
| `time_bolt` | Time Bolt | spell | damage/time → foe | `px:moon-bolt` | `px:moon-bolt` |  |  |
| `haste` | Haste | spell | status:haste → ally | `px:star-aura` | **`px:wind-circle`** | haste |  |
| `slow_spell` | Slow | spell | status:slow → foe | `px:star-status` | **`px:moon-debuff`** | slow |  |
| `rewind` | Rewind | spell | heal → weakest | `px:light-sparkle` | **`px:moon-sparkle`** |  |  |
| `accelerate` | Accelerate | spell | status:haste → allies | `px:star-aura` | **`px:wind-circle`** | haste |  |
| `age` | Age | spell | damage/time → foe status:weak → foe | `px:moon-burst` | **`px:moon-debuff`** | weak |  |
| `stasis` | Stasis | spell | status:stop → foe | `px:star-debuff` | **`px:moon-rune`** | stop |  |
| `temporal_shield` | Temporal Shield | spell | status:shield → allies | `px:star-shield` | **`px:moon-aura`** | shield |  |
| `time_loop` | Time Loop | spell | damage/time → foe | `px:moon-spread` | `px:moon-spread` |  |  |
| `slowga` | Slowga | spell | damage/time → foes status:slow → foes | `px:moon-status` | **`px:moon-rain`** | slow |  |
| `chronoshift` | Chronoshift | spell | revive → fallen status:haste → allies | `px:light-pillar` | **`px:moon-pillar`** | haste |  |
| `time_stop` | Time Stop | spell | status:stop → foes | `px:star-status` | **`px:moon-rune`** | stop |  |
| `flame_blade` | Flame Blade | spell | damage/fire → foe status:burn → foe | `px:fire-flame` | `px:fire-flame` | burn |  |
| `frost_edge` | Frost Edge | spell | damage/ice → foe status:slow → foe | `px:ice-hit` | **`px:ice-slash`** | slow |  |
| `shock_blade` | Shock Blade | spell | damage/lightning → foe status:stun → foe | `px:lightning-slash` | **`px:lightning-strike`** | stun |  |
| `arcane_shield` | Arcane Shield | spell | status:shield → self | `px:star-shield` | **`px:star-aura`** | shield |  |
| `blink_strike` | Blink Strike | spell | damage/arcane → foe | `px:star-strike` | `px:star-strike` |  |  |
| `elemental_burst` | Elemental Burst | spell | damage/fire → foes | `px:fire-nova` | `px:fire-nova` |  |  |
| `spell_reflect` | Spell Reflect | spell | status:reflect → self | `px:star-shield` | **`px:crystal-aura`** | reflect |  |
| `arcane_cataclysm` | Arcane Cataclysm | spell | damage/arcane → foes | `px:star-explosion` | **`px:star-nova`** |  |  |
| `lay_on_hands` | Lay on Hands | spell | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `holy_strike` | Holy Strike | spell | damage/holy → foe | `px:light-strike` | `px:light-strike` |  |  |
| `divine_protection` | Divine Protection | spell | status:protect → allies | `px:star-shield` | **`px:light-aura`** | protect |  |
| `consecrate` | Consecrate | spell | damage/holy → foes | `px:light-rain` | `px:light-rain` |  |  |
| `aura_of_valour` | Aura of Valour | spell | status:inspired → allies | `px:star-aura` | **`px:light-circle`** | inspired |  |
| `judgement` | Judgement | spell | damage/holy → foe | `px:light-pillar` | `px:light-pillar` |  |  |
| `blood_strike` | Blood Strike | spell | drain/blood → foe | `px:blood-strike` | `px:blood-strike` |  |  |
| `crimson_pact` | Crimson Pact | spell | status:lifelink → self | `px:star-sparkle` | **`px:blood-circle`** | lifelink |  |
| `haemorrhage` | Haemorrhage | spell | damage/blood → foe status:bleed → foe | `px:blood-orb` | **`px:blood-burst`** | bleed |  |
| `blood_boil` | Blood Boil | spell | damage/blood → foes | `px:blood-nova` | **`px:blood-explosion`** |  |  |
| `sanguine_shield` | Sanguine Shield | spell | status:shield → self | `px:star-shield` | **`px:blood-aura`** | shield |  |
| `exsanguinate` | Exsanguinate | spell | drain/blood → foes | `px:blood-gather` | `px:blood-gather` |  |  |
| `ballad_of_valour` | Ballad of Valour | spell | status:inspired → allies | `px:star-orb` | **`px:crystal-circle`** | inspired |  |
| `lullaby` | Lullaby | spell | status:sleep → foes | `px:star-status` | **`px:crystal-smoke`** | sleep |  |
| `song_of_rest` | Song of Rest | spell | heal → allies | `px:light-aura` | **`px:crystal-sparkle`** |  |  |
| `quick_march` | Quick March | spell | status:haste → allies | `px:star-sparkle` | **`px:wind-circle`** | haste |  |
| `discord` | Discord | spell | status:weak → foes | `px:star-status` | **`px:crystal-debuff`** | weak |  |
| `shattering_note` | Shattering Note | spell | damage/sound → foes | `px:crystal-wave` | `px:crystal-wave` |  |  |
| `anthem_of_heroes` | Anthem of Heroes | spell | status:protect → allies status:inspired → allies | `px:star-aura` | **`px:crystal-aura`** | protect |  |
| `requiem` | Requiem | spell | damage/sound → foes status:fear → foes | `px:crystal-rain` | `px:crystal-rain` | fear |  |
| `sword_dance` | Sword Dance | spell | damage/physical → random_foes | `px:star-slash` | **`slash_gold`** |  |  |
| `mesmerise` | Mesmerise | spell | status:charm → foe | `px:star-status` | `px:star-status` | charm |  |
| `healing_waltz` | Healing Waltz | spell | heal → allies | `px:light-sparkle` | **`px:crystal-sparkle`** |  |  |
| `wind_step` | Wind Step | spell | status:haste → allies | `px:star-aura` | **`px:wind-circle`** | haste |  |
| `dance_of_death` | Dance of Death | spell | damage/physical → random_foes | `px:white-hit` | **`slash_wind`** |  |  |
| `hunters_mark` | Hunter's Mark | spell | status:vulnerable → foe | `px:star-glyph` | **`px:blood-debuff`** | vulnerable |  |
| `natures_grace` | Nature's Grace | spell | heal → self | `px:light-sparkle` | **`px:forest-sparkle`** |  |  |
| `entangling_shot` | Entangling Shot | spell | damage/nature → foe status:slow → foe | `px:forest-bolt` | `px:forest-bolt` | slow |  |
| `inner_peace` | Inner Peace | spell | heal → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `chi_blast` | Chi Blast | spell | damage/arcane → foe | `px:star-explosion` | `px:star-explosion` |  |  |
| `diamond_body` | Diamond Body | spell | status:protect → self status:thorns → self | `px:star-shield` | **`px:earth-aura`** | protect |  |
| `transcendence` | Transcendence | spell | status:haste → self heal → self status:focus → self | `px:light-sparkle` | `px:light-sparkle` | haste |  |
| `call_companion` | Call Companion | spell | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `wild_roar` | Wild Roar | spell | status:fear → foes | `px:star-aura` | **`px:crystal-nova`** | fear |  |
| `call_the_pack` | Call the Pack | spell | summon → self summon → self summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `acid_flask` | Acid Flask | spell | damage/poison → foe status:vulnerable → foe | `px:poison-pool` | **`px:poison-explosion`** | vulnerable |  |
| `fire_flask` | Fire Flask | spell | damage/fire → foes | `px:fire-flame` | **`px:fire-explosion`** |  |  |
| `healing_draught` | Healing Draught | spell | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `smoke_bomb` | Smoke Bomb | spell | status:blind → foes | `px:star-explosion` | **`px:white-smoke`** | blind |  |
| `elixir_of_vigour` | Elixir of Vigour | spell | status:regen → allies status:haste → allies | `px:star-sparkle` | **`px:forest-sparkle`** | regen |  |
| `philosophers_fire` | Philosopher's Fire | spell | damage/fire → foes status:burn → foes dispel → foes | `px:fire-flame` | `px:fire-flame` | burn |  |
| `first_aid` | First Aid | skill | heal → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `battle_cry` | Battle Cry | skill | status:inspired → allies | `px:star-aura` | **`px:crystal-nova`** | inspired |  |
| `second_wind` | Second Wind | skill | heal → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `shield_bash` | Shield Bash | skill | damage/physical → foe status:stun → foe | `px:white-hit` | `px:white-hit` | stun |  |
| `provoke` | Provoke | skill | status:taunt → self | `px:star-circle` | **`px:fire-circle`** | taunt |  |
| `valiant_charge` | Valiant Charge | skill | damage/physical → foe | `px:white-hit` | `px:white-hit` |  |  |
| `rallying_banner` | Rallying Banner | skill | status:inspired → allies status:protect → allies | `px:star-aura` | **`px:light-aura`** | inspired |  |
| `guarded_stance` | Guarded Stance | skill | status:protect → self | `px:star-shield` | **`px:light-aura`** | protect |  |
| `holy_strike_art` | Holy Strike | skill | damage/holy → foe | `px:light-strike` | **`px:light-slash`** |  |  |
| `lay_on_hands_art` | Lay on Hands | skill | heal → ally | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `smite_art` | Smite | skill | damage/holy → foe status:weak → foe | `px:light-pillar` | `px:light-pillar` | weak |  |
| `judgement_art` | Judgement | ultimate | damage/holy → foes status:protect → allies heal → allies | `holy` | `holy` | protect |  |
| `shield_charge` | Shield Charge | skill | damage/physical → foe status:stun → foe | `px:white-hit` | `px:white-hit` | stun |  |
| `consecrate_art` | Consecrate | skill | status:regen → allies status:weak → foes | `px:star-glyph` | **`px:light-debuff`** | weak |  |
| `oath_of_light` | Oath of Light | skill | revive → fallen status:inspired → allies | `px:light-pillar` | `px:light-pillar` | inspired |  |
| `power_strike` | Power Strike | skill | damage/physical → foe | `px:white-hit` | **`slash_wind`** |  |  |
| `cleave` | Cleave | skill | damage/physical → foes | `slash_wind` | `slash_wind` |  |  |
| `berserk` | Berserk | skill | status:berserk → self | `px:star-circle` | **`px:blood-circle`** | berserk |  |
| `whirlwind` | Whirlwind | skill | damage/physical → foes | `px:white-hit` | **`slash_wind`** |  |  |
| `war_cry` | War Cry | skill | status:fear → foes status:inspired → allies | `px:star-aura` | **`px:crystal-nova`** | fear |  |
| `savage_blow` | Savage Blow | skill | damage/physical → foe status:bleed → foe | `slash_wind` | **`px:blood-cross`** | bleed |  |
| `intimidate` | Intimidate | skill | status:fear → foe status:weak → foe | `px:star-rune` | **`px:dark-debuff`** | fear |  |
| `ground_slam` | Ground Slam | skill | damage/earth → foes status:slow → foes | `px:earth-wave` | `px:earth-wave` | slow |  |
| `titans_wrath` | Titan's Wrath | ultimate | damage/physical → foes status:berserk → self | `mg_pop` | `mg_pop` | berserk |  |
| `execute` | Execute | skill | damage/physical → foe | `slash_gold` | `slash_gold` |  |  |
| `rampage` | Rampage | skill | damage/physical → random_foes | `slash_gold` | `slash_gold` |  |  |
| `undying_rage` | Undying Rage | skill | heal → self status:berserk → self status:regen → self | `px:light-sparkle` | **`px:blood-sparkle`** | berserk |  |
| `aimed_shot` | Aimed Shot | skill | damage/physical → foe | `px:white-hit` | `px:white-hit` |  | arrow |
| `twin_shot` | Twin Shot | skill | damage/physical → foe | `px:white-hit` | `px:white-hit` |  | arrow |
| `camouflage` | Camouflage | skill | status:invisible → self | `px:star-aura` | **`px:wind-smoke`** | invisible |  |
| `wild_volley` | Wild Volley | skill | damage/physical → random_foes | `px:white-hit` | `px:white-hit` |  | arrow |
| `poison_arrow` | Poison Arrow | skill | damage/physical → foe status:poison → foe | `px:white-hit` | **`px:poison-hit`** | poison | arrow |
| `wardens_wrath` | Warden's Wrath | skill | damage/nature → foes | `px:forest-shield` | **`px:forest-rain`** |  |  |
| `hamstring` | Hamstring | skill | damage/physical → foe status:slow → foe | `slash_gold` | `slash_gold` | slow |  |
| `barbed_arrow` | Barbed Arrow | skill | damage/physical → foe status:bleed → foe | `px:white-hit` | **`px:blood-hit`** | bleed | arrow |
| `natures_balm` | Nature's Balm | skill | heal → ally cleanse → ally | `px:light-sparkle` | **`px:forest-sparkle`** |  |  |
| `storm_of_arrows` | Storm of Arrows | ultimate | damage/physical → foes status:bleed → foes | `mg_pop` | **`missile`** | bleed |  |
| `entangle_art` | Entangle | skill | status:stop → foes status:slow → foes | `px:star-rune` | **`roots`** | stop |  |
| `hail_of_thorns` | Hail of Thorns | skill | damage/nature → foes status:poison → foes | `px:forest-rain` | `px:forest-rain` | poison |  |
| `wildlords_call` | Wildlord's Call | skill | summon → self summon → self | `px:star-circle` | **`px:forest-circle`** |  |  |
| `piercing_shot` | Piercing Shot | skill | damage/physical → foe | `px:white-hit` | `px:white-hit` |  | arrow |
| `rapid_fire` | Rapid Fire | skill | damage/physical → foe | `px:white-hit` | `px:white-hit` |  | arrow |
| `arrow_rain` | Arrow Rain | skill | damage/physical → foes | `px:white-hit` | `px:white-hit` |  | arrow |
| `crippling_shot` | Crippling Shot | skill | damage/physical → foe status:slow → foe | `px:white-hit` | `px:white-hit` | slow | arrow |
| `hawkeye_volley` | Hawkeye Volley | skill | damage/physical → foes | `px:white-hit` | `px:white-hit` |  | arrow |
| `leg_shot` | Leg Shot | skill | damage/physical → foe status:slow → foe | `px:white-hit` | `px:white-hit` | slow | arrow |
| `pinning_shot` | Pinning Shot | skill | damage/physical → foe status:stop → foe | `px:white-hit` | `px:white-hit` | stop | arrow |
| `blinding_shot` | Blinding Shot | skill | damage/physical → foe status:blind → foe | `px:white-hit` | `px:white-hit` | blind | arrow |
| `heartseeker` | Heartseeker | ultimate | damage/physical → foe status:bleed → foe | `slash_gold` | **`missile`** | bleed |  |
| `double_nock` | Double Nock | skill | damage/physical → foe | `slash_gold` | **`px:white-hit`** |  | arrow |
| `fire_arrows` | Fire Arrows | skill | damage/fire → foes status:burn → foes | `px:fire-bolt` | **`px:fire-rain`** | burn | arrow |
| `killing_field` | Killing Field | skill | damage/physical → random_foes | `slash_gold` | **`px:white-hit`** |  | arrow |
| `shift_shape` | Shift Shape | skill | status:protect → self heal → self | `px:light-sparkle` | `px:light-sparkle` | protect |  |
| `bite` | Bite | skill | damage/physical → foe status:bleed → foe | `slash_wind` | **`px:blood-cross`** | bleed |  |
| `howl` | Howl | skill | status:inspired → allies status:fear → foes | `px:star-rune` | **`px:crystal-nova`** | fear |  |
| `maul_and_rend` | Maul and Rend | skill | damage/physical → foe damage/physical → foes | `slash_gold` | **`px:white-cross`** |  |  |
| `rending_claws` | Rending Claws | skill | damage/physical → foe status:bleed → foe | `slash_wind` | **`px:blood-cross`** | bleed |  |
| `pounce` | Pounce | skill | damage/physical → foe status:stun → foe | `slash_wind` | **`px:white-cross`** | stun |  |
| `lick_wounds` | Lick Wounds | skill | heal → self cleanse → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `primal_fury` | Primal Fury | ultimate | damage/physical → foes status:berserk → self status:haste → self | `mg_pop` | `mg_pop` | berserk |  |
| `savage_roar` | Savage Roar | skill | status:fear → foes | `px:star-aura` | **`px:crystal-nova`** | fear |  |
| `gore` | Gore | skill | damage/physical → foe status:vulnerable → foe | `slash_gold` | **`px:white-cross`** | vulnerable |  |
| `wing_buffet` | Wing Buffet | skill | damage/physical → foes status:slow → foes | `slash_wind` | **`px:earth-wave`** | slow |  |
| `whip_crack` | Whip Crack | skill | damage/physical → foe status:stun → foe | `slash_gold` | **`px:white-hit`** | stun |  |
| `soothe_beast` | Soothe Beast | skill | status:charm → foe | `px:star-status` | **`px:forest-status`** | charm |  |
| `feral_howl` | Feral Howl | skill | status:inspired → allies status:haste → allies | `px:star-circle` | **`px:crystal-nova`** | inspired |  |
| `stampede` | Stampede | skill | damage/physical → foes status:stun → foes | `slash_gold` | **`px:earth-wave`** | stun |  |
| `lord_of_beasts` | Lord of Beasts | skill | summon → self | `px:star-circle` | **`px:forest-circle`** |  |  |
| `sic_em` | Sic 'Em | skill | damage/physical → foe | `slash_wind` | **`px:white-cross`** |  |  |
| `hobble` | Hobble | skill | damage/physical → foe status:slow → foe | `slash_wind` | `slash_wind` | slow |  |
| `mend_companion` | Mend Companion | skill | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `call_of_the_wild` | Call of the Wild | ultimate | summon → self summon → self status:berserk → allies status:haste → allies | `missile` | **`portal`** | berserk |  |
| `maul` | Maul | skill | damage/physical → foe status:bleed → foe | `slash_gold` | **`px:blood-cross`** | bleed |  |
| `trample` | Trample | skill | damage/physical → foes status:slow → foes | `slash_gold` | **`px:earth-wave`** | slow |  |
| `wild_bond` | Wild Bond | skill | status:regen → allies status:inspired → allies | `px:star-aura` | **`px:forest-sparkle`** | regen |  |
| `staff_strike` | Staff Strike | skill | damage/physical → foe status:stun → foe | `px:white-hit` | `px:white-hit` | stun |  |
| `focus` | Focus | skill | status:focus → self | `px:star-circle` | `px:star-circle` | focus |  |
| `blink` | Blink | skill | status:invisible → self | `px:star-sparkle` | **`px:wind-circle`** | invisible |  |
| `frost_nova` | Frost Nova | skill | damage/ice → foes status:freeze → foes | `px:ice-nova` | `px:ice-nova` | freeze |  |
| `scorch` | Scorch | skill | damage/fire → foe status:burn → foe | `px:fire-flame` | `px:fire-flame` | burn |  |
| `mana_shield_art` | Mana Shield | skill | status:shield → self | `px:star-shield` | **`px:star-aura`** | shield |  |
| `meteor_art` | Meteor | ultimate | damage/fire → foes status:burn → foes status:stun → foes | `orchid` | `orchid` | burn |  |
| `arcane_surge` | Arcane Surge | skill | damage/arcane → foe | `px:star-wave` | `px:star-wave` |  |  |
| `winters_grasp` | Winter's Grasp | skill | status:freeze → foes status:slow → foes | `px:star-rune` | **`px:ice-spikes`** | freeze |  |
| `thunderstorm_art` | Thunderstorm | skill | damage/lightning → random_foes | `px:lightning-vortex` | `px:lightning-vortex` |  |  |
| `frostfire_bolt` | Frostfire Bolt | skill | damage/fire → foe damage/ice → foe | `px:fire-bolt` | `px:fire-bolt` |  |  |
| `familiar` | Familiar | skill | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `shadow_step` | Shadow Step | skill | status:invisible → self | `px:star-smoke` | **`px:dark-smoke`** | invisible |  |
| `coven_pact` | Coven Pact | skill | status:focus → allies | `px:star-sparkle` | **`px:star-circle`** | focus |  |
| `evil_eye_art` | Evil Eye | skill | status:weak → foe damage/dark → foe | `px:dark-hit` | **`px:dark-orb`** | weak |  |
| `hex_bolt_art` | Hex Bolt | skill | damage/dark → foe status:vulnerable → foe | `px:dark-rune` | **`px:dark-bolt`** | vulnerable |  |
| `toad_curse` | Toad Curse | skill | status:weak → foe status:slow → foe | `px:star-debuff` | **`px:dark-debuff`** | weak |  |
| `healing_brew` | Healing Brew | skill | heal → weakest cleanse → ally | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `grand_hex` | Grand Hex | ultimate | status:doom → foes status:weak → foes damage/dark → foes | `mg_sigil` | `mg_sigil` | doom |  |
| `bat_swarm` | Bat Swarm | skill | summon → self summon → self | `px:star-circle` | **`px:dark-circle`** |  |  |
| `night_terror` | Night Terror | skill | status:fear → foes status:sleep → foes | `px:star-glyph` | **`px:dark-debuff`** | fear |  |
| `soul_jar` | Soul Jar | skill | revive → fallen | `px:light-pillar` | **`px:dark-pillar`** |  |  |
| `curse_of_ages_art` | Curse of Ages | skill | status:slow → foes status:vulnerable → foes | `px:star-debuff` | **`px:dark-debuff`** | slow |  |
| `mace_of_faith` | Mace of Faith | skill | damage/holy → foe | `px:light-cut` | **`px:light-burst`** |  |  |
| `blessing` | Blessing | skill | status:inspired → allies | `px:star-aura` | **`px:light-circle`** | inspired |  |
| `turn_undead` | Turn Undead | skill | damage/holy → foes status:fear → foes | `px:light-spread` | **`px:light-pillar`** | fear |  |
| `prayer` | Prayer | skill | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `holy_light_art` | Holy Light | skill | damage/holy → foe status:blind → foe | `px:light-hit` | **`px:light-burst`** | blind |  |
| `sanctuary_art` | Sanctuary | skill | status:shield → allies | `px:star-shield` | **`px:light-aura`** | shield |  |
| `purify_art` | Purify | skill | cleanse → allies | `px:star-sparkle` | **`px:light-burst`** |  |  |
| `divine_grace` | Divine Grace | ultimate | heal → allies revive → fallen cleanse → allies status:regen → allies | `missile` | **`suture`** | regen |  |
| `benediction` | Benediction | skill | heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `holy_nova` | Holy Nova | skill | damage/holy → foes heal → allies | `px:light-nova` | `px:light-nova` |  |  |
| `miracle_art` | Miracle | skill | revive → fallen | `px:light-pillar` | `px:light-pillar` |  |  |
| `ward_of_faith` | Ward of Faith | skill | status:protect → allies | `px:star-shield` | **`px:light-aura`** | protect |  |
| `flurry` | Flurry | skill | damage/physical → foe | `px:white-hit` | **`slash_wind`** |  |  |
| `pressure_point` | Pressure Point | skill | damage/physical → foe status:stun → foe | `slash_wind` | **`px:white-hit`** | stun |  |
| `hundred_fists` | Hundred Fists | skill | damage/physical → foe | `slash_wind` | **`px:white-hit`** |  |  |
| `dragon_kick` | Dragon Kick | skill | damage/physical → foe status:stun → foe | `slash_wind` | **`px:white-hit`** | stun |  |
| `palm_strike` | Palm Strike | skill | damage/physical → foe status:weak → foe | `px:white-hit` | `px:white-hit` | weak |  |
| `leg_sweep` | Leg Sweep | skill | damage/physical → foes status:stun → foes | `slash_gold` | **`px:earth-wave`** | stun |  |
| `chi_wave` | Chi Wave | skill | heal → weakest damage/arcane → foe | `px:star-wave` | `px:star-wave` |  |  |
| `thousand_hands` | Thousand Hands | ultimate | damage/physical → foe status:stun → foe | `slash_gold` | **`mg_pop`** | stun |  |
| `tiger_claw` | Tiger Claw | skill | damage/physical → foe status:bleed → foe | `slash_gold` | **`px:blood-cross`** | bleed |  |
| `serenity` | Serenity | skill | cleanse → self heal → self status:focus → self | `px:light-sparkle` | `px:light-sparkle` | focus |  |
| `rising_phoenix` | Rising Phoenix | skill | damage/fire → foe status:haste → self | `px:fire-cut` | **`slash_fire`** | haste |  |
| `backstab` | Backstab | skill | damage/physical → foe | `slash_gold` | `slash_gold` |  |  |
| `poison_blade` | Poison Blade | skill | damage/physical → foe status:poison → foe | `px:star-slash` | **`slash_poison`** | poison |  |
| `vanish` | Vanish | skill | status:invisible → self | `px:star-aura` | **`px:wind-smoke`** | invisible |  |
| `fan_of_knives` | Fan of Knives | skill | damage/physical → foes | `px:white-hit` | **`slash_wind`** |  |  |
| `shadow_dance` | Shadow Dance | skill | status:haste → self status:invisible → self | `px:star-smoke` | **`px:dark-smoke`** | haste |  |
| `assassinate` | Assassinate | skill | damage/physical → foe | `slash_gold` | `slash_gold` |  |  |
| `throat_cut` | Throat Cut | skill | damage/physical → foe status:silence → foe | `slash_gold` | `slash_gold` | silence |  |
| `blinding_powder` | Blinding Powder | skill | status:blind → foes | `px:star-status` | **`px:light-burst`** | blind |  |
| `hamstring_cut` | Hamstring | skill | damage/physical → foe status:slow → foe | `slash_wind` | `slash_wind` | slow |  |
| `death_mark` | Death Mark | ultimate | status:vulnerable → foe damage/physical → foe status:doom → foe | `mg_pop` | **`slash_wind`** | vulnerable |  |
| `garrotte` | Garrotte | skill | damage/physical → foe status:stop → foe | `px:white-hit` | `px:white-hit` | stop |  |
| `smoke_bomb_art` | Smoke Bomb | skill | status:invisible → allies status:blind → foes | `px:star-explosion` | **`px:white-smoke`** | blind |  |
| `thousand_cuts` | Thousand Cuts | skill | damage/physical → random_foes | `slash_wind` | `slash_wind` |  |  |
| `dark_pact` | Dark Pact | skill | status:focus → self | `px:star-sparkle` | **`px:dark-circle`** | focus |  |
| `bone_wall` | Bone Wall | skill | status:shield → allies | `px:star-shield` | **`px:dark-aura`** | shield |  |
| `bone_shard` | Bone Shard | skill | damage/dark → foe | `px:dark-slash` | **`px:dark-spikes`** |  |  |
| `pale_touch` | Pale Touch | skill | drain/dark → foe | `px:dark-gather` | `px:dark-gather` |  |  |
| `raise_bats` | Raise Bats | skill | summon → self | `px:star-circle` | **`px:dark-circle`** |  |  |
| `wither_art` | Wither | skill | status:weak → foes damage/dark → foes | `px:dark-debuff` | `px:dark-debuff` | weak |  |
| `army_of_the_dead_art` | Army of the Dead | ultimate | summon → self summon → self damage/dark → foes status:fear → foes | `void` | `void` | fear |  |
| `soul_rot` | Soul Rot | skill | status:poison → foes | `px:star-debuff` | **`px:dark-smoke`** | poison |  |
| `grave_chill` | Grave Chill | skill | damage/ice → foes status:slow → foes | `px:dark-gather` | **`px:ice-explosion`** | slow |  |
| `death_coil_art` | Death Coil | skill | drain/dark → foe | `px:dark-gather` | **`px:dark-bolt`** |  |  |
| `dread_aura` | Dread Aura | skill | status:fear → foes status:vulnerable → foes | `px:star-aura` | **`px:dark-debuff`** | fear |  |
| `empower_summons` | Empower Summons | skill | status:inspired → allies | `px:star-circle` | **`px:light-circle`** | inspired |  |
| `twin_bond` | Twin Bond | skill | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `soul_siphon` | Soul Siphon | skill | drain/arcane → foe | `px:star-gather` | `px:star-gather` |  |  |
| `planeswalk` | Planeswalk | skill | status:invisible → allies status:haste → allies | `px:star-circle` | `px:star-circle` | invisible |  |
| `lesser_spirit` | Lesser Spirit | skill | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `spirit_bolt_art` | Spirit Bolt | skill | damage/arcane → foe | `px:star-bolt` | `px:star-bolt` |  |  |
| `bind_wounds` | Bind Wounds | skill | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `hungry_spirits` | Hungry Spirits | skill | drain/arcane → foe damage/arcane → foes | `px:star-gather` | `px:star-gather` |  |  |
| `grand_summoning` | Grand Summoning | ultimate | summon → self status:shield → allies | `mg_shards` | **`conjure`** | shield |  |
| `spirit_shackles` | Spirit Shackles | skill | status:stop → foes status:weak → foes | `px:star-status` | **`roots`** | stop |  |
| `astral_armour` | Astral Armour | skill | status:shield → allies | `px:star-shield` | **`px:star-aura`** | shield |  |
| `banish_art` | Banish | skill | damage/arcane → foe status:silence → foe | `px:star-hit` | **`px:star-pillar`** | silence |  |
| `spirit_mend` | Spirit Mend | skill | heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `rending_blow` | Rending Blow | skill | damage/physical → foe status:bleed → foe | `slash_wind` | **`px:blood-cross`** | bleed |  |
| `crimson_charge` | Crimson Charge | skill | damage/blood → foe | `px:blood-gather` | **`px:blood-burst`** |  |  |
| `blood_frenzy` | Blood Frenzy | skill | status:berserk → self status:lifelink → self | `px:star-sparkle` | **`px:blood-circle`** | berserk |  |
| `open_vein` | Open Vein | skill | damage/physical → foe status:bleed → foe | `slash_gold` | **`px:blood-burst`** | bleed |  |
| `drink_deep` | Drink Deep | skill | drain/blood → foe | `px:blood-gather` | `px:blood-gather` |  |  |
| `red_mist` | Red Mist | skill | status:fear → foes status:berserk → self | `px:star-smoke` | **`px:blood-smoke`** | fear |  |
| `blood_tithe` | Blood Tithe | skill | drain/blood → foes | `px:blood-gather` | `px:blood-gather` |  |  |
| `exsanguinate_art` | Exsanguinate | ultimate | damage/blood → foes status:bleed → foes heal → self | `blood_bubble` | `blood_bubble` | bleed |  |
| `hemorrhage` | Haemorrhage | skill | damage/physical → foe status:vulnerable → foe | `slash_wind` | `slash_wind` | vulnerable |  |
| `crimson_pact_art` | Crimson Pact | skill | status:lifelink → allies status:inspired → allies | `px:star-circle` | **`px:blood-circle`** | lifelink |  |
| `throne_of_blood` | Throne of Blood | skill | status:protect → self status:berserk → self heal → self | `px:light-sparkle` | **`px:blood-sparkle`** | protect |  |
| `blood_rite` | Blood Rite | skill | heal → allies status:bleed → foes | `px:light-sparkle` | **`px:blood-sparkle`** | bleed |  |
| `cutting_words` | Cutting Words | skill | damage/sound → foe status:weak → foe | `px:crystal-slash` | **`px:crystal-strike`** | weak |  |
| `dirge` | Dirge | skill | status:slow → foes | `px:star-debuff` | **`px:crystal-debuff`** | slow |  |
| `countersong` | Countersong | skill | cleanse → allies | `px:star-aura` | **`px:crystal-burst`** |  |  |
| `magnum_opus` | Magnum Opus | skill | status:haste → allies status:inspired → allies heal → allies | `px:light-sparkle` | `px:light-sparkle` | haste |  |
| `lullaby_art` | Lullaby | skill | status:sleep → foes | `px:star-status` | **`px:crystal-smoke`** | sleep |  |
| `ballad_of_courage` | Ballad of Courage | skill | status:inspired → allies | `px:star-orb` | **`px:blood-circle`** | inspired |  |
| `discord_art` | Discord | skill | damage/sound → foes status:silence → foes | `px:crystal-wave` | **`px:crystal-nova`** | silence |  |
| `soothing_song` | Soothing Song | skill | heal → allies | `px:light-aura` | **`px:crystal-sparkle`** |  |  |
| `grand_finale` | Grand Finale | ultimate | damage/sound → foes status:stun → foes status:haste → allies status:inspired → allies | `moths` | **`mg_sparks`** | stun |  |
| `march` | March | skill | status:haste → allies | `px:star-circle` | **`px:wind-circle`** | haste |  |
| `requiem_art` | Requiem | skill | status:doom → foes damage/sound → foes | `px:crystal-spread` | **`px:crystal-explosion`** | doom |  |
| `song_of_rest_art` | Song of Rest | skill | heal → allies cleanse → allies status:regen → allies | `px:light-aura` | **`px:crystal-sparkle`** | regen |  |
| `sickle_sweep` | Sickle Sweep | skill | damage/physical → foes | `slash_wind` | **`px:earth-wave`** |  |  |
| `wolf_shape` | Shape of the Wolf | skill | status:haste → self status:berserk → self | `px:star-aura` | **`px:forest-circle`** | haste |  |
| `avatar_of_the_wild` | Avatar of the Wild | skill | status:protect → self status:regen → self status:berserk → self | `px:star-shield` | **`px:forest-aura`** | protect |  |
| `thorn_whip` | Thorn Whip | skill | damage/nature → foe status:bleed → foe | `px:forest-spikes` | `px:forest-spikes` | bleed |  |
| `rejuvenate_art` | Rejuvenate | skill | status:regen → weakest | `px:star-aura` | **`px:forest-sparkle`** | regen |  |
| `entangling_roots` | Entangling Roots | skill | status:stop → foes | `px:star-glyph` | **`roots`** | stop |  |
| `moonbeam_art` | Moonbeam | skill | damage/arcane → foe status:blind → foe | `px:star-pillar` | `px:star-pillar` | blind |  |
| `wrath_of_the_wild` | Wrath of the Wild | ultimate | damage/nature → foes status:stop → foes heal → allies | `leaves` | **`roots`** | stop |  |
| `bear_shape_art` | Shape of the Bear | skill | status:protect → self status:taunt → self heal → self | `px:light-sparkle` | **`px:forest-sparkle`** | protect |  |
| `swarm` | Swarm | skill | damage/nature → foes status:poison → foes | `px:forest-spread` | `px:forest-spread` | poison |  |
| `stormcall` | Stormcall | skill | damage/lightning → random_foes | `px:lightning-vortex` | `px:lightning-vortex` |  |  |
| `circle_of_life` | Circle of Life | skill | revive → fallen heal → allies | `px:light-rune` | **`px:light-pillar`** |  |  |
| `tonic` | Tonic | skill | heal → ally cleanse → ally | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `caltrops` | Caltrops | skill | status:slow → foes status:bleed → foes | `px:star-status` | **`px:earth-spikes`** | slow |  |
| `transmute` | Transmute | skill | status:weak → foes status:vulnerable → foes | `px:star-hit` | **`px:dark-debuff`** | weak |  |
| `grand_elixir` | Grand Elixir | skill | heal → allies cleanse → allies status:haste → allies | `px:light-sparkle` | `px:light-sparkle` | haste |  |
| `acid_flask_art` | Acid Flask | skill | damage/poison → foe status:vulnerable → foe | `px:poison-pool` | **`px:poison-explosion`** | vulnerable |  |
| `smoke_flask` | Smoke Flask | skill | status:blind → foes | `px:star-smoke` | **`px:white-smoke`** | blind |  |
| `stimulant` | Stimulant | skill | status:haste → ally status:inspired → ally | `px:star-sparkle` | **`px:wind-circle`** | haste |  |
| `fire_flask_art` | Fire Flask | skill | damage/fire → foes status:burn → foes | `px:fire-flame` | **`px:fire-explosion`** | burn |  |
| `philosophers_fire_art` | Philosopher's Fire | ultimate | damage/fire → foes status:burn → foes heal → allies | `mg_ground_fire` | `mg_ground_fire` | burn |  |
| `antidote` | Antidote | skill | cleanse → allies heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `frost_flask` | Frost Flask | skill | damage/ice → foes status:freeze → foes | `px:ice-wave` | **`px:ice-explosion`** | freeze |  |
| `elixir_of_life` | Elixir of Life | skill | revive → fallen heal → ally | `px:light-pillar` | `px:light-pillar` |  |  |
| `quick_repair` | Quick Repair | skill | status:shield → ally | `px:star-shield` | **`px:light-aura`** | shield |  |
| `deploy_turret` | Deploy Turret | skill | summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `overcharge` | Overcharge | skill | damage/lightning → foe | `px:lightning-gather` | **`px:lightning-burst`** |  |  |
| `flashbang` | Flashbang | skill | status:blind → foes status:stun → foes | `px:star-status` | **`px:light-burst`** | blind |  |
| `drone_swarm` | Drone Swarm | skill | summon → self summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `wrench_whack` | Wrench Whack | skill | damage/physical → foe status:stun → foe | `slash_wind` | **`px:white-hit`** | stun |  |
| `oil_slick` | Oil Slick | skill | status:slow → foes status:vulnerable → foes | `px:star-debuff` | **`px:dark-pool`** | slow |  |
| `field_dressing` | Field Dressing | skill | heal → weakest | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `shock_prod` | Shock Prod | skill | damage/lightning → foe status:stun → foe | `px:lightning-cut` | **`px:lightning-strike`** | stun |  |
| `siege_mode` | Siege Mode | ultimate | summon → self damage/fire → foes status:burn → foes | `mg_ground_fire` | `mg_ground_fire` | burn |  |
| `grenade` | Grenade | skill | damage/fire → foes | `px:fire-explosion` | `px:fire-explosion` |  |  |
| `tesla_arc` | Tesla Arc | skill | damage/lightning → random_foes | `px:lightning-spread` | `px:lightning-spread` |  |  |
| `repair_drone` | Repair Drone | skill | heal → allies status:shield → allies | `px:light-sparkle` | `px:light-sparkle` | shield |  |
| `jump` | Jump | skill | damage/physical → foe | `slash_wind` | **`px:white-hit`** |  |  |
| `lance_charge` | Lance Charge | skill | damage/physical → foe status:stun → foe | `px:white-hit` | `px:white-hit` | stun |  |
| `high_jump` | High Jump | skill | damage/physical → foe | `slash_gold` | **`px:white-hit`** |  |  |
| `skewer` | Skewer | skill | damage/physical → foes | `slash_gold` | `slash_gold` |  |  |
| `dragon_dive` | Dragon Dive | skill | damage/fire → foes | `px:fire-spread` | **`px:fire-wave`** |  |  |
| `thrust` | Thrust | skill | damage/physical → foe status:bleed → foe | `slash_wind` | **`px:blood-slash`** | bleed |  |
| `leg_sweep_lance` | Sweeping Lance | skill | damage/physical → foes | `px:white-hit` | **`px:earth-wave`** |  |  |
| `dragon_breath` | Dragon Breath | skill | damage/fire → foes status:burn → foes | `px:fire-wave` | `px:fire-wave` | burn |  |
| `stardiver` | Stardiver | ultimate | damage/fire → foe damage/fire → foes status:stun → foes | `mg_flame` | `mg_flame` | stun |  |
| `geirskogul` | Geirskogul | skill | damage/physical → foes | `slash_wind` | `slash_wind` |  |  |
| `impale` | Impale | skill | damage/physical → foe status:vulnerable → foe | `slash_wind` | `slash_wind` | vulnerable |  |
| `sky_lord` | Sky Lord | skill | status:haste → self status:berserk → self status:protect → self | `px:star-shield` | **`px:light-aura`** | haste |  |
| `iaijutsu` | Iaijutsu | skill | damage/physical → foe | `slash_wind` | `slash_wind` |  |  |
| `crescent_moon` | Crescent Moon | skill | damage/physical → foes | `px:white-hit` | **`slash_gold`** |  |  |
| `blade_dance` | Blade Dance | skill | damage/physical → random_foes | `slash_wind` | `slash_wind` |  |  |
| `one_cut` | One Cut | skill | damage/physical → foe | `slash_gold` | `slash_gold` |  |  |
| `draw_cut` | Draw Cut | skill | damage/physical → foe | `slash_gold` | `slash_gold` |  |  |
| `tsubame_gaeshi` | Tsubame Gaeshi | skill | damage/physical → foe status:bleed → foe | `slash_gold` | **`px:blood-slash`** | bleed |  |
| `kiai` | Kiai | skill | status:fear → foes status:inspired → allies | `px:star-status` | **`px:crystal-nova`** | fear |  |
| `midare_setsugekka` | Midare Setsugekka | ultimate | damage/physical → foe status:bleed → foe | `mg_pop` | **`slash_wind`** | bleed |  |
| `hissatsu` | Hissatsu | skill | damage/physical → foe | `slash_wind` | `slash_wind` |  |  |
| `meditate` | Meditate | skill | status:focus → self heal → self | `px:light-sparkle` | `px:light-sparkle` | focus |  |
| `storms_edge` | Storm's Edge | skill | damage/wind → foes status:slow → foes | `px:wind-vortex` | `px:wind-vortex` | slow |  |
| `shield_wall` | Shield Wall | skill | status:protect → self status:taunt → self | `px:star-shield` | **`px:light-aura`** | protect |  |
| `bulwark` | Bulwark | skill | status:shield → allies | `px:star-shield` | **`px:earth-aura`** | shield |  |
| `last_bastion` | Last Bastion | skill | status:protect → allies status:taunt → self | `px:star-shield` | **`px:earth-aura`** | protect |  |
| `brace` | Brace | skill | status:protect → self | `px:star-shield` | **`px:light-aura`** | protect |  |
| `shield_slam` | Shield Slam | skill | damage/physical → foe status:stun → foe | `px:white-hit` | `px:white-hit` | stun |  |
| `hold_the_line` | Hold the Line | skill | status:taunt → self status:shield → self | `px:star-circle` | **`px:light-aura`** | taunt |  |
| `rally_point` | Rally Point | skill | status:inspired → allies heal → allies | `px:light-aura` | **`px:light-sparkle`** | inspired |  |
| `titan_wall` | Wall of the Titan | ultimate | status:shield → allies status:protect → allies status:taunt → self damage/earth → foes status:stun → foes | `mg_spikes` | `mg_spikes` | stun |  |
| `earthshaker` | Earthshaker | skill | damage/earth → foes status:slow → foes | `px:earth-spread` | **`px:earth-wave`** | slow |  |
| `stand_fast` | Stand Fast | skill | heal → self cleanse → self status:protect → self | `px:light-sparkle` | `px:light-sparkle` | protect |  |
| `totem_strike` | Totem Strike | skill | damage/physical → foe status:slow → foe | `px:white-hit` | `px:white-hit` | slow |  |
| `spirit_wolves` | Spirit Wolves | skill | summon → self summon → self | `px:star-circle` | `px:star-circle` |  |  |
| `purge` | Purge | skill | cleanse → allies | `px:star-sparkle` | **`px:light-burst`** |  |  |
| `spirit_jolt` | Spirit Jolt | skill | damage/lightning → foe | `px:lightning-strike` | `px:lightning-strike` |  |  |
| `healing_rain_art` | Healing Rain | skill | heal → allies | `px:light-rain` | `px:light-rain` |  |  |
| `earth_bind` | Earth Bind | skill | status:slow → foes status:stop → foes | `px:star-status` | **`roots`** | slow |  |
| `flame_totem` | Flame Totem | skill | damage/fire → foes | `px:fire-flame` | `px:fire-flame` |  |  |
| `ancestral_fury` | Ancestral Fury | ultimate | damage/lightning → foes summon → self heal → allies status:haste → allies | `shock` | `shock` | haste |  |
| `frost_shock` | Frost Shock | skill | damage/ice → foe status:slow → foe | `px:ice-cut` | **`px:ice-strike`** | slow |  |
| `earth_shield` | Earth Shield | skill | status:shield → ally status:regen → ally | `px:star-shield` | **`px:earth-aura`** | shield |  |
| `chain_heal_art` | Chain Heal | skill | heal → weakest heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `storm_totem_art` | Storm Totem | skill | damage/lightning → random_foes | `px:lightning-vortex` | `px:lightning-vortex` |  |  |
| `dual_cast` | Dual Cast | skill | damage/arcane → foe | `px:star-cut` | **`px:star-spread`** |  |  |
| `runeblade` | Runeblade | skill | damage/arcane → foe drain/arcane → foe | `px:star-rune` | **`px:star-slash`** |  |  |
| `spellstorm_blade` | Spellstorm Blade | skill | damage/lightning → foes damage/fire → foes | `px:lightning-vortex` | `px:lightning-vortex` |  |  |
| `flame_edge` | Flame Edge | skill | damage/fire → foe | `px:fire-flame` | `px:fire-flame` |  |  |
| `frost_edge_art` | Frost Edge | skill | damage/ice → foe status:slow → foe | `px:ice-slash` | `px:ice-slash` | slow |  |
| `arcane_guard` | Arcane Guard | skill | status:shield → self | `px:star-shield` | **`px:star-aura`** | shield |  |
| `storm_edge` | Storm Edge | skill | damage/lightning → foe status:stun → foe | `px:lightning-vortex` | `px:lightning-vortex` | stun |  |
| `elemental_tempest` | Elemental Tempest | ultimate | damage/fire → foes damage/ice → foes damage/lightning → foes | `orchid` | `orchid` |  |  |
| `mana_blade` | Mana Blade | skill | damage/arcane → foe drain/arcane → foe | `px:star-slash` | `px:star-slash` |  |  |
| `battle_trance` | Battle Trance | skill | status:focus → self status:haste → self | `px:star-circle` | `px:star-circle` | focus |  |
| `blade_storm` | Blade Storm | skill | damage/physical → foes damage/arcane → foes | `px:white-hit` | **`px:star-vortex`** |  |  |
| `runic_ward` | Runic Ward | skill | status:shield → allies status:focus → allies | `px:star-shield` | **`px:light-aura`** | shield |  |
| `deja_vu` | Deja Vu | skill | status:focus → allies | `px:star-aura` | **`px:moon-circle`** | focus |  |
| `time_skip` | Time Skip | skill | status:haste → allies status:slow → foes | `px:star-glyph` | **`px:moon-debuff`** | slow |  |
| `tick` | Tick | skill | damage/time → foe | `px:moon-hit` | **`px:moon-bolt`** |  |  |
| `slow_time` | Slow Time | skill | status:slow → foe | `px:star-status` | **`px:moon-debuff`** | slow |  |
| `rewind_art` | Rewind | skill | heal → weakest cleanse → ally | `px:light-sparkle` | **`px:moon-sparkle`** |  |  |
| `haste_self` | Hasten | skill | status:haste → ally | `px:star-sparkle` | **`px:moon-circle`** | haste |  |
| `stop_the_clock` | Stop the Clock | ultimate | status:stop → foes damage/time → foes status:haste → allies | `hourglass` | `hourglass` | stop |  |
| `age_art` | Age | skill | damage/time → foe status:weak → foe | `px:moon-hit` | **`px:moon-debuff`** | weak |  |
| `second_chance` | Second Chance | skill | revive → fallen | `px:light-pillar` | `px:light-pillar` |  |  |
| `time_bomb` | Time Bomb | skill | status:doom → foes damage/time → foes | `px:moon-explosion` | `px:moon-explosion` | doom |  |
| `echo` | Echo | skill | status:haste → allies status:regen → allies | `px:star-circle` | **`px:moon-sparkle`** | haste |  |
| `snare` | Snare | skill | status:slow → foe damage/physical → foe | `slash_gold` | **`px:white-hit`** | slow |  |
| `net` | Net | skill | status:stun → foe | `px:star-glyph` | **`roots`** | stun |  |
| `bear_trap` | Bear Trap | skill | damage/physical → foe status:bleed → foe | `slash_wind` | **`px:blood-burst`** | bleed |  |
| `explosive_shot` | Explosive Shot | skill | damage/fire → foes | `px:fire-bolt` | **`px:fire-rain`** |  | arrow |
| `gut_shot` | Gut Shot | skill | damage/physical → foe status:bleed → foe | `px:white-hit` | **`px:blood-hit`** | bleed | arrow |
| `tripwire` | Tripwire | skill | status:stop → foe damage/physical → foe | `slash_wind` | **`px:white-hit`** | stop |  |
| `hunters_eye` | Hunter's Eye | skill | status:focus → self status:vulnerable → foe | `px:star-glyph` | **`px:blood-debuff`** | vulnerable |  |
| `the_great_hunt` | The Great Hunt | ultimate | damage/physical → foe status:bleed → foe status:fear → foes | `slash_gold` | `slash_gold` | bleed |  |
| `spiked_pit` | Spiked Pit | skill | damage/physical → foes status:slow → foes | `px:white-hit` | **`px:earth-wave`** | slow |  |
| `flare` | Flare | skill | status:blind → foes | `px:star-rune` | **`px:fire-burst`** | blind |  |
| `killing_shot` | Killing Shot | skill | damage/physical → foe | `px:white-hit` | `px:white-hit` |  | arrow |
| `twirl` | Twirl | skill | damage/physical → foe | `slash_wind` | `slash_wind` |  |  |
| `allure` | Allure | skill | status:charm → foes | `px:star-glyph` | **`px:star-status`** | charm |  |
| `veil_dance` | Veil Dance | skill | status:invisible → self status:haste → allies | `px:star-aura` | **`px:wind-smoke`** | invisible |  |
| `last_dance` | The Last Dance | skill | damage/physical → foes status:inspired → allies | `slash_wind` | `slash_wind` | inspired |  |
| `fan_slash` | Fan Slash | skill | damage/physical → foe status:bleed → foe | `slash_gold` | **`px:blood-slash`** | bleed |  |
| `dazzle` | Dazzle | skill | status:blind → foe | `px:star-status` | **`px:light-burst`** | blind |  |
| `healing_dance` | Healing Dance | skill | heal → allies | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `dance_of_blades` | Dance of Blades | ultimate | damage/physical → random_foes status:haste → allies status:charm → foes | `slash_gold` | `slash_gold` | charm |  |
| `sword_dance_art` | Sword Dance | skill | damage/physical → foe | `slash_gold` | `slash_gold` |  |  |
| `war_dance` | War Dance | skill | status:inspired → allies status:berserk → allies | `px:star-aura` | **`px:wind-circle`** | inspired |  |
| `dance_of_the_dead` | Dance of the Dead | skill | revive → fallen status:haste → allies | `px:light-pillar` | **`px:dark-pillar`** | haste |  |
| `healing_potion` | Healing Potion | item | heal → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `greater_healing_potion` | Greater Healing Potion | item | heal → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `mana_draught` | Mana Draught | item | status:focus → self | `px:star-aura` | **`px:star-circle`** | focus |  |
| `antidote` | Antidote | item | cleanse → self | `px:light-sparkle` | `px:light-sparkle` |  |  |
| `smoke_bomb` | Smoke Bomb | item | status:invisible → self | `px:star-explosion` | **`px:white-smoke`** | blind |  |
| `oil_flask` | Oil Flask | item | damage/fire → foe status:burn → foe | `px:fire-cut` | **`px:fire-explosion`** | burn |  |
| `throwing_knife` | Throwing Knife | item | damage/physical → foe | `slash_wind` | **`px:white-hit`** |  | arrow |
| `whetstone` | Whetstone | item | status:berserk → self | `px:star-sparkle` | **`px:earth-circle`** | berserk |  |
| `ward_charm` | Ward Charm | item | status:protect → self | `px:star-shield` | **`px:light-aura`** | protect |  |
| `combat_stim` | Combat Stim | item | status:haste → self | `px:star-sparkle` | **`px:wind-circle`** | haste |  |
