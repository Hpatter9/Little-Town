## Battle items in the townsfolk's pouches (the owner's ask: "carry battle items in their own inventory too and use them in battle: potions, or special items to help with the fight")

Each grown-up with a calling carries a small **pouch** (`Person.kit?: string[]`, item ids), and uses what is in it as an
action in any fight. New files: `data/kitItems.ts` (the items), `sim/kit.ts` (hand-out, planner demand, raider potions),
`sim/kitFight.ts` (the choice in a fight), `test/kit.test.ts`.

- **The items** (`KIT_ITEMS`, merged into `ITEMS` as `KIT_RECIPES`, slot null, crafted like any stock item): Healing Potion
  (40% of health) and Greater Healing Potion (75%) at the apothecary (`physick`, the greater also `glassblowing`); Mana
  Draught (60% of the mana pool; `physick` + `arcane_arts`) and Antidote (clears poison, burn and bleed) at the apothecary;
  Smoke Bomb (`invisible` 8 s) and Oil Flask (fire blow + burn) at the kiln; Throwing Knife and Whetstone (`berserk` 30 s)
  at the smithy (`iron_working`); Ward Charm (`protect` 45 s) at the bone carver's; Combat Stim (haste 25 s and 30% health)
  at the pharmacy (`trauma_surgery`). `use` is `heal | mana | cure | escape | throw | buff`; `KIT_FX` is what the fight views
  draw for each. Icons are cells of DawnLike's Potion sheet (and its ShortWep, Rock and Amulet sheets): already credited.
- **Room:** `kitCap(p)` = `KIT_BASE` (2) + one per 15 levels + one for a pack on the back, at most `KIT_MOST` (6).
- **Hand-out** (`restockKits`, hourly in `sim.ts` after `hourlyItems`, autopilot only): the stores' battle items go into the
  pouches of those with a calling, defenders first, then the main character, then by melee/ranged skill (casters a point
  up), one item a person a round for three rounds, each person's `WISHES` in order (casters: `CASTER_WISHES`, draughts
  first). No manual controls.
- **Orders** (`planCrafting` step 4a in `planner.ts`): one order at a time while the town has two days' food, of the most
  wanted kit item the town has the station, research and makings for (`kitNeed`: 0 once the stores and pouches hold one
  more than the people who'd carry it; heal 10, mana 8, cure 6, escape 5, buff 4, throw 3); otherwise it gathers for it.
- **In a fight** (`useKitItem` from `takeTurn` in `actions.ts`, so the expedition/skirmish/delve fight, the raid map and the
  tactics board all use it): `Combatant.bag` is the pouch (the party fight's `Fighter.bag` is a copy that `keepBag` writes
  back in `expeditions.ts` and `roamers.ts`; the raid map's and the board's stand-ins hold the person's own array).
  `pickKitItem`: a potion under `HEAL_BELOW` (0.5) of health (the smallest that mends 60% of what is missing, else the
  strongest); an antidote while poisoned, burning or bleeding; a draught when the caster has less mana than their cheapest
  spell or under `DRY_SHARE` (0.3); smoke under `ESCAPE_BELOW` (0.3) with foes about; a charm, whetstone or stim at the
  start (a status they don't have yet); a thrown knife or flask `THROW_CHANCE` (0.5) of turns, and only one that hits at
  least `THROW_BEATS` (1.2) times as hard as their own blow. **A drink or a buff is a quick action** (`useKitItem` returns
  `'quick'`: they still act that turn); a throw takes the turn (`'turn'`). **No drink or smoke when one blow of theirs would
  end the fight** (one foe left at or under their average hit). The item is taken from the pouch, applied through the same
  engine as a skill (`useItemAction`, `ActMeta.item`), and logged by name so the views show it like a spell (`actLooks.ts`,
  `fightView.ts` and `actFx.ts` look the name up in `KIT_BY_ID`/`KIT_FX`).
- **Side stream:** the only draw is `new Rng(hashSeed(`kit:${tick}:${who}:${bagSize}`))` (the arena has no town seed), and
  the town's stream is never touched; the fight's own stream is drawn from only when an item is used.
- **Raider loot:** `raiderPotions` (at the end of a raid, `raids.ts`): each fallen raider of the people kinds
  (`natureOf` = person) has `RAIDER_POTION` (0.12) of leaving a potion (a fifth of them Greater), into the stores.
- **The card** lists the pouch: `PersonView.pouch`/`pouchCap`, a line in the top block of the person's card in the Townsfolk tab (in its key).
- Not done (design calls): buying them in the shop with a person's own coins; raiders drinking their potions in the fight.
