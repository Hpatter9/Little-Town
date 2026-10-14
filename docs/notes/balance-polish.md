## Balance soak, button pass and first-hour clarity

A soak of every origin, a second pass over every menu on the phone, and a few first-hour labels. Small fixes only.

**The soak tool.** `tools/soak.ts` (run: `node tools/soak.mjs [days] [seeds] [origin,origin...]`, or `node tools/soak.mjs fixture [days] [seeds]` for the
late fixture) runs towns with the autopilot on and prints people, the lowest head-count, deaths (`s.fallen`) and wipes. `SKY=none|ship` forces the fixture into the
Industrial age (with a zeppelin); `CAUSES=1` tallies the causes of death; `TIMELINE=1` prints a town every 5 days. A won game carries on (the Grail ends the fixture).
Build once and run the `.cjs` copies side by side: parallel `node tools/soak.mjs` runs overwrite `out/soak.cjs`.

**What the soak found (20 days, 3 seeds each):** no origin dies out except one lone-founder wipe, no origin goes untouched at 40 days.
Settlers 3.0 people (deaths 0.7), lich 20, druid 4.3 (one wipe), vampire 3.3 (3.0 deaths), werewolf 7, robot 31 (6.7 deaths), dwarves 5 (0.3), merfolk 4.7, nomads
60 (3.3), fae 13, alchemists 6 (0.0; 4.5 deaths by day 40), knights 7.7, orcs 6.3. The fixture over 10 days: 46 people, 4 deaths.

**Fixes:**
- *A lone leader is not sent to a duel by default* (`risingEnvoyText`, `sim/risingPowers.ts`): the Shogunate's challenge defaulted to "accept" at even odds, and in a
  one-person town a loss ended the run (druid soak, day 18). The default is now "refuse" when the champion is the leader and no heir would be left (`heirOf`).
- *A party that cleared the Calamity's heart crashed the sim on its next tick* (`destinationOf` returned nothing once `heartCleared` shut the heart): `destinationOf`
  now asks `heartDestination(s, true)` for a party already out; the board still lists the heart only while it is open. Found by the 40-day dwarf soak.
- *A tap on a slow view seemed to do nothing for up to five seconds* (the trade house's "Close the route", the ranch, the arena, guilds...): `slow()` in
  `sim/snapshot.ts` now also drops its cache when a command comes in (`viewsChanged`, as `brief()` already did).

**Buttons (phone, 393x852 and 852x393, every Town/People/Studies/Market/Quests/Chronicle tab on the late fixture):** the Jobs table was cut off at the right with
no hint (`priorityGrid`: it now scrolls sideways under sticky names, with a "Swipe the table sideways" hint on phones); the guild member chips ran off the card
(`.guild-chips` wraps); a place's long threat chip ran off the screen (`.dest-chip` wraps). No dead tab was found; the buttons that looked inert were toggles
already on, or opened a card outside the menu.

**First hour:** the news bubble says "news" under its number; the welcome tip names the bubble and the speed controls; new tips `sendparty` (day 2, three people),
`food` (stores under a day) and `beds` (more people than beds) in `mobile/tips.ts`. No new controls.

**Sky pirates (0.7 of a raid's budget, unsoaked until now):** on the fixture forced into the Industrial age with a zeppelin, 6 seeds over 10 days ended 45.2 people
and 6.0 deaths against 46.0 and 4.0 without the ship: the cost is the airship's own crashes (`died when the Cloud Dancer came down` x2), about 2% of the
population, not 14%. Pirates did not raid in any of those runs, and 3 seeds over 30 days gave identical results at `SKY_RAID_SHARE` 0.7 and 1.0, so the cut has no
effect in a town whose ship has been lost (the ship was already gone by day 20 in the seed checked); nothing was changed. If flying is still thought too costly, the cheap lever is to fly only for sky-only places and long trips.
