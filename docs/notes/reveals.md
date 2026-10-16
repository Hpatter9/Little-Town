## Reveals: rare moments, opened hauls and the legends shelf

The owner's aim: rare things should feel rare, and rewards should be opened, not listed. Three parts, all on the phone,
none adding a draw or a control.

**The rare-moment cards** (`mobile/revealCard.ts`, the words in `mobile/reveals.ts`). A full-screen card slides up
(under 250 ms; still with reduced motion) when something rare happens: a mythic calling comes among the town (violet,
the calling's emblem), a unique weapon is found or forged (gold, its icon), a legend at the gate is found out (the
veiled Champion, the Archmage, the heir: `LEGENDARY_SPECIALS`; the troubles, plague, curse and the rest, aren't cards),
a dweller of the Underdark slain, the dragon sighted and slain, a saga ended, a deed ladder's top title won. Each shows
the picture large, the kind, the name, a line of lore and a rarity line in the game's voice ("Few towns ever see one").
One tap closes it; several queue. They are held while a raid, the tactics board, a watched fight, the mine or the
Deep, a cutscene, the event box or the "While you were away" card has the screen, and while the town catches up, and
show after. The keys shown are kept per town seed (`littletown.reveals`), so each comes once; a town first seen on the
phone (or a new one founded) starts with all it already has, unshown. The ☰ menu's "Reveal cards: on/off" turns them
off (`littletown.revealsOff`). A soft rising bell plays with each (`reveal` cue in `ambience.ts`, `REVEAL_SOUND` in
`sfx.ts`, through the strip's `__ambience`). The API for other pages (milestones, a favourite's death):
`showReveal({ kind, title, lore?, rarity?, tone?, img?, art?, icon?, key?, haul? })`, tone one of `mythic`, `unique`,
`legend`, `dark`, `gold`; `key` drops a repeat. `window.__reveal` is the same, for previews.

**Hauls opened like a chest** (in `revealCard.ts`; the order in `reveals.ts` `haulOrder`). The renderer keeps each
party's loot as last seen in the snapshot; when the party leaves the list (home: `comeHome` in sim/expeditions.ts), its
haul opens line by line (`LINE_MS` 320), the commonest first by `WORTH` (data/trade.ts), the dearest last after a pause
(`RARE_PAUSE_MS` 650) with a glow when it's worth `RARE_WORTH` (9: gold and up) or more. A unique found as it came home
comes last of all, glowing, and takes the place of its own card. A dweller slain on that trip adds its hoard
(`DEPTH_BY_N[n].hoard`), so the Lost Hold and the deep lairs open the same way; delves too ("The delvers are home"). The
first tap lays out what's left; the next closes. Hauls that came home while the town caught up are left to the away card.

**The legends shelf** (`panel/shelfPanel.ts`, the Chronicle's new **Shelf** tab beside Legends in
`panel/journalPanel.ts`; its key `shelfKey` joins the Chronicle's redraw key in `panel/panel.ts`). Every rare thing the
town has seen, as folded sections with counts ("Mythic callings: 1 of 5 mythic lines"): the mythic trees, the unique
weapons, the secrets at the gate, the sagas, the Underdark's dwellers, the Dragon, the legendary deeds, and the bosses
(`SHELF_BOSSES`: every foe with a boss's kit but the dragons and the dwellers). A tile is the sprite when seen (glowing
for a mythic, a unique or the dark), a dark shape with a "?" while not; hold one for its lore (`data-tip`). The
Chronicle draws its own filter tabs rather than `GROUPS` sub-tabs, so `panel/subtabs.ts` is unchanged.

**The record** (`sim/rare.ts` `rareView`, the snapshot's optional `rare`). Read from what the sim already keeps:
`s.mythics`, `s.uniques`, `s.sagasDone`, the Underdark's `deeps[n - 1].slain`, `s.dragon`. What nothing kept is noted in
a new optional `s.seen` (`sim/seen.ts` `noteSeen`: each id once, with the autopilot on only): `bosses` (in `bossSlain`,
sim/bosses.ts), `deeds` (a ladder's top title, `TOP_DEED_TITLES`, in `awardDeedTitles`, sim/deeds.ts), `specials` (a
secret found out, in `reveal` and the saboteur's strike, sim/specials.ts). No draws: the sim-hash with `seen` left out
is the same as before. Tests: `test/seen.test.ts`, `test/reveals.test.ts`.

Changes the HISTORY.md sections "Titles from deeds", "Special newcomers", "Epic bosses" (the bosses' notes under
"Raids") and "The annals" (the Chronicle's tabs) only by the recording above.
