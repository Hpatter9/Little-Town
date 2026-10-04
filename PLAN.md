# Plan: a town of people with lives of their own

The owner's direction (October 2026): the money stops being the town's and becomes the townsfolk's. Each person earns
by their work, keeps a purse, pays rent or buys land, pays tax; the founder's treasury (rent and tax) pays the guards.
People have a life goal, friendships and grudges, go adventuring on their own in parties that make sense, own shops,
hire, marry, hold funerals and feasts. Events carry weight and consequences. The art loses its last tents and clunky
code-drawn halls.

This document is the working plan. Each numbered step is a PR-sized piece with its own tests, soak and phone check;
`CLAUDE.md` gets a note as each lands. **Step 0 first: merge PR 16 as it stands** (shops, décor, the tech tree, town
size, levels to 100) so the economy rework starts from a clean base. The economy changes the save (purses, ownership,
land), so a **new save version** is expected at step 1; towns founded before it keep playing under the old rules until
the owner says otherwise.

## What has to exist for the economy to work (the owner asked)

- **Purses.** `Person.coins`. The town's `s.coins` becomes the **treasury** (the founder's). Every coin flow that today
  touches `s.coins` is reassigned: wages (gone: people earn directly), shop takings (to the owner's purse), crafters'
  pay (to the crafter), goods bought from travellers (by whoever buys them), venue upgrades (by the owner), events
  (sometimes the treasury, sometimes a person).
- **Prices for everything.** Already there: `WORTH` per material, `saleValue` per item at a quality. Needed: a **market**
  that buys what townsfolk bring (the shop buys harvests, pelts, ore, crafted goods at `BUY_RATE` of worth, the owner
  profiting when travellers buy it on) so a farmer or forager has someone to sell to.
- **Pay by job.** Each task kind pays when its product is sold or on delivery: gathering (per unit delivered), farming
  (per harvest), crafting (per piece, to the crafter, paid by whoever ordered it), building (a day rate from the
  treasury or the land's owner), guarding (a wage from the treasury), keeping a shop (the owner's profit; a hired hand
  gets a wage), research (a stipend from the treasury), adventuring (loot and bounties, split among the party by
  share). A table `PAY` in `data/economy.ts` so the owner can tune who gets rich.
- **Ownership.** `Building.owner` (a person id, or `treasury`). Homes are owned or rented (`Building.rent`); venues and
  workshops are businesses; land is a cell the town sells (`Land.owned`, a plot of a home's footprint). A person buys
  land and builds when they can afford it, else rents; the planner's building queue becomes **people's** building
  plans: the town (treasury) still builds the public works (walls, defences, the seat, roads, wells, studies, fields
  it owns), people build homes and businesses.
- **Rent and tax.** Daily: rent to the home's owner (the treasury for town-built homes), a head tax or a tithe on
  income (`TAX_RATE`) to the treasury; the Plan tab's direction gains a **tax lever** (low, fair, heavy: morale against
  treasury). Nobody starves for rent: arrears are a debt, with a mark on morale, and eviction only in a settled town
  with spare beds.
- **Guards.** A new job (operator role at the barracks/watchtower, or a standing `guard` calling) paid from the
  treasury; the number the town keeps follows the treasury and the direction (Defence hires more). Guards are the
  first on the raid map and patrol otherwise. With an empty treasury guards leave their post (they still fight if the
  raid comes to them, like anyone).
- **Life goals.** `Person.ambition`: farmer, crafter, keeper (wants a shop), adventurer, scholar, guard, homebody,
  wealthy (wants a fortune, by any road). Rolled from nature and skills at adulthood; it steers job choice
  (`assignOperators`, the Farm/craft priorities), spending (saving for land, a shop, gear), and whether they volunteer
  for expeditions. Adventurers who have made their pile may **retire** into a shop (the owner's picture: a few trips,
  then a business). Shown on the Townsfolk inspect page with their purse and property.
- **Businesses.** A keeper owns their venue (`owner`), pays its upkeep and upgrades from their own purse (the décor
  direction is theirs already), hires a **worker** when it's busy (a wage), and may **buy** another's shop (an offer the
  seller takes if they are poorer and not attached). Still one shop of each kind in a town.
- **Autonomous expeditions.** The board becomes a notice: parties form themselves. A trip is proposed by an
  adventurer (or by the treasury posting a bounty for a lair/cave/dungeon/scouting); they recruit by friendship and
  class into a **balanced party** (front line, ranged/damage, support/healer, a scout; `planParty` already picks by
  fitness and role, extend with relationships and ambition); they go only when **rested** (`needs.rest`, not within
  `TRIP_REST_DAYS` of the last trip), **healed** above a share of max HP, fed and equipped, the town left with its guards
  and half its grown-ups; never two enemies in one party, lovers and friends together. The player keeps **watching**
  (Watch, feed cards) and can still **forbid** a destination or **cheer** a party on; nothing to pick.
- **Relationships that bite.** Opinion already exists (friends, rivals, couples, chemistry, natures). Add: **enemies**
  (below `RIVAL` for days: refuse the same party, work apart, a brawl event), **devotion** (a friend at `DEVOTED` goes
  where the other goes, grieves longer), and the party rules above. Surface it: the inspect page's friends and
  enemies, a line on the tap card.
- **Where to see it.** A **Wealth** section on the Townsfolk tab (purse, income today, property, business, ambition,
  friends/enemies), a town ledger on the Plan tab (treasury, tax take, rent, guards' pay, public works), and the
  shop panel naming the owner and worker.
- **Events with weight.** An `EventEffect` set that bites: `busy` (everyone or a share held to a task for N hours: the
  fireline), `spread` (a follow-up event rolled later with odds: the fire reaches the town), `fire` (buildings alight
  spreading cell to cell unless fought; people fight it with buckets from the well: deaths from smoke), `offer`
  options whose text shows the cost against what's **available** (treasury or the richest purse), and consequences
  recorded in the journal. The fight-or-pay prompt shows "You have N coins" (the owner's ask).
- **Life's ceremonies.** Funerals (a mourning hour at the graveyard for someone with friends, morale restored a little
  by attending; a great funeral after a raid that took several, the whole town, a day of rest), **weddings** (a feast
  at the tavern, everyone's morale up; the couple's home), **feasts** (periodic: harvest home, midsummer, a victory,
  the founder's name-day: food and drink spent, morale up for a day; the tavern's owner profits).
- **Idle life.** An idle animation for anyone standing (the LPC idle breathing frames; keepers wipe the counter,
  lean on it; the smith's hammer taps; fishers cast), so nobody looks frozen.
- **Art.** Homes without tents: the lean-to, hide tent and longhouse get pack houses or a redrawn hut (the Village
  pack's houses 1–4 are taken: cottage, row house, workshops, and the inn; a hut and a longhouse need a new pack or
  a careful redraw on the fine grid); the elder lodge, town hall, trophy hall, factory and garage replaced with pack
  pictures where any fits, else redrawn front-on at the map's angle with the top-down painter's pieces.

## Steps, in order

0. **Merge PR 16.** Tests green, the soak read, the recap given.
1. **Purses and pay** (save version bump): `Person.coins`, the treasury, `PAY`, the shop buying from townsfolk, wages
   gone, crafters and keepers paid to their purse; the Townsfolk inspect page shows the purse and today's income.
   Soak: who gets rich over 15 days, nobody starves. Tests: pay flows per job.
2. **Ownership, land, rent and tax**: `Building.owner`, land plots, people's homes and businesses, the treasury's
   public works, rent, the tax lever, the town ledger. Guards paid from the treasury.
3. **Ambitions and retirement**: life goals steering jobs, spending and volunteering; buying a shop; hiring a worker.
4. **Relationships that bite**: enemies, devotion, grudges; the party rules.
5. **Autonomous expeditions**: self-forming balanced parties, rest and wounds respected, bounties from the treasury,
   the board as a notice; Watch stays.
6. **Events with weight**: busy, spread, fire, the cost shown against what's available; the fire chain as the first.
7. **Ceremonies and feasts**: funerals, weddings, feasts; idle animations.
8. **Art**: homes without tents, the halls redrawn or pulled from the packs.
9. Soak across origins, phone checks, PR.

## Decisions (the owner's answers)

1. **Old towns**: a new town for the economy (a new save version; old saves are refused as at the top-down change).
2. **Trips**: parties form themselves; the player keeps a **veto** on a destination and the treasury can post a
   **bounty** on one (recommended; building it so unless told otherwise).
3. **Tax**: a lever on the Plan tab. More tax, more treasury, unhappier townsfolk; too much and people leave.
4. **Homes and building**: townsfolk **buy land from the town and build on it**, with realistic weight: building takes
   much longer than now, **skill makes a huge difference**, most buildings need a high enough Crafting (Construction)
   to build at all, and a person can **hire builders** to go faster. The treasury still builds the public works.
5. **Guards**: a standing paid calling.
6. **The founder's purse is the treasury.**
7. A rich townsperson **may buy the town's general store**, but only at a price that makes sense for the founder to
   sell: a profitable shop is worth a great deal (its price from its takings).
