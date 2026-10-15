## Balance pass 4 (claude/balance-4)

Measured on main 0.120.0, 40-day soaks, 6 seeds each, religion on against off (a throwaway switch that turned the whole layer
off; removed again, nothing of it is in the branch). Mean people at day 40 / deaths.

### 1. Religion's soak swings were seed spread (no change; checks "Religion and the gods made real")

| people | religion off | religion on |
|---|---|---|
| liches | 26.0 / 8.2 | 28.7 / 11.7 |
| nomads | 84.5 / 29.3 | 81.5 / 32.7 |
| fae | 17.0 / 11.7 (1 of 6 starved out) | 23.0 / 9.3 |
| alchemists | 7.3 / 6.2 | 8.2 / 5.8 |
| dwarves | 6.7 / 4.7 (0 of 6 wiped) | 6.0 / 4.7 (1 of 6 wiped) |

Per-seed spread is 20 to 40 percent of the mean (liches 20 to 43, nomads 61 to 100, fae 7 to 37), so the earlier 3-seed jumps
(liches 18 -> 31, nomads 85 -> 63, fae 29 -> 23, alchemists 6 -> 9) are noise: with religion off the means are the same size
and in the same order. No mechanic was softened. The liches do not grow from religion: off 26.0, on 28.7, inside one standard
error (about 3). The undead are `tireless`, so the hearth god's plague (`greatWrath`) can only sicken the living few of a lich
town; it is not free favour, since favour only moves through followers, demands, rites and acts in nature.
The one dwarf town that ends is seed 5 with religion on (8 people with it off). Traced: a camp of 2 to 4 people for 22 days,
five of them starving together on days 23 to 26 before any greater wrath (only omens came, and the harvest god was at -17 when
the hunger began; his lesser wrath at -40 came after). Religion did not start it; the off run took another road.

### 2. Greater wraths no longer chain (changes "Religion and the gods made real", the greater wraths)

Before, one wrath a dawn at most, but the next god could strike the next day: a plague, a cursed harvest and a storm in one
week was possible. Now `WRATH_GAP_DAYS` (5, `data/religion.ts`) must pass since the last greater wrath of any god
(`ReligionState.lastWrath`, optional, set in `afterWrath`; `wrathReady`, checked in `dawn`). Within the gap the angry gods
still send omens. Test: `greater wraths never chain` in `test/religion.test.ts` (all four gods at -90 for 78 days: every
wrath at least five days from the last; it fails with the gate removed, "days 3 and 4 too close").

### 3. Alchemists' baseline for the magic merge

Main 0.120.0, alchemists, 6 seeds: 8.2 people, low 1.7, deaths 5.8 (per seed 7, 4, 11, 5, 15, 7); religion off 7.3 (1, 15, 7, 2,
10, 9). Religion is not what moved them: the magic chat's forced-run 12 -> 3 is a magic effect or its own seed spread, to be
judged against this baseline.
