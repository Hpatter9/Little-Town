## Every raid hidden until spotted (changes "Fog that matters", rule 3)

Extends the fog rule for raids (`docs/notes/fog-rules.md`, `sim/raidSight.ts`, `data/raidSight.ts`) from the ordinary land raid to every raid that comes from outside.

- **Which raids:** `startRaid(..., veiled = true)` now veils any outside raid (the `!host` and `!fromSea` limits are gone). Callers that pass `true`: war hosts (`launchHost`, `factions.ts`), the Great Enemy's mark, host and last siege (`greatEnemy.ts`), saga raids (`sagas.ts`), nest raids (`nests.ts`), the grove's wolves (`grove.ts`), village rebels (`villages.ts`), the Cave Bear (`caveBear.ts`) and pirate landings (`seafaring.ts`). Raids from inside the town keep their rules (a point given as `inside`: night prowlers, bandits in disguise, sky pirates, shinobi, lurkers, the Deep and portals, the secret saboteur's clan at the gate), and so do the guild's ultimatum, a god's wrath and deserters.
- **Signs:** `sayVagueSign` picks from `HOST_SIGNS` ("Drums to the east...") for a host, `SEA_SIGNS` ("Sails on the west horizon.") for a raid from the sea, else `RAID_SIGNS`.
- **A source's own words wait too:** `raidNews(s, raid, text, important)` says a line now, or keeps it in `raid.veil.news` until the raid is seen (the host's "is here", the mark's, the grove's wolves, rebels, the bear, the pirate ship). `raidPromptWords(s, raid, title, text)` sets a source's title and text for the warning prompt, now or kept in `veil.title/text` (sagas). `announceRaid` applies both. `Raid.veil` gained optional `title`, `text`, `news` (old saves have none).
- **Lead time:** `SPOTTED_LEAD_TICKS` is 300 (30 seconds at normal speed), was 50. A town with no watch sees a raid only at its edge and gets that much; towers and gates see further out, so they get more. On a sighting `arrivesTick` and `leavesTick` move together, so a late sighting does not shorten the raid's stay.
- A nest raid that goes unseen no longer finds its nest from the tracks (that line told of the raid).

Tests: `test/fogRaidsAll.test.ts` (host, sea, a source's words kept, the lead time). The existing raid tests are unchanged.

### For the owner
- A war host's mustering (`musterHost`: "...will reach the town in N hours") is still announced, as a diplomatic warning. Only the host's approach to the town is hidden. Say if the muster should become a rumour too.
