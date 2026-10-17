## Stragglers, found: people in the ranch pens (branch claude/stuck-foes-2)

Changes HISTORY "Stragglers sent away" (that net was not the cause) and "Pens bought, bred" / "Animal husbandry" (what the ranch may keep).

**The cause.** Not a raid, a band or the renderer. The ranch (`sim/ranch.ts`) catches a downed raider or keeps a tamed one
if `natureOf(kind) === 'beast'`. `natureOf` calls anything on a sprite sheet a beast unless it is marked, so the packs'
people (kunoichi, dart ninja, ...) passed: a downed shinobi was "roped" into the pen. Pen beasts are drawn as foes
(`ranchFigures` in `main.ts`, nameless, standing about in the pen in the middle of town) and never leave, so they outlast
every raid, along with the caught rats.

**The fix.** `penKind(kind)` in `ranch.ts`: an explicit `nature` decides, else a beast whose sprite is not a pack sheet
(`PACK_SHEETS`). `addBeast` refuses anything else, the two raid-end paths use it (plus their boss check), and
`ranchHourly` lets out a pack person already in an old save's pens ("was let out of the pens"). Rats, wolves, boars
and the rest still pen. No draw from any stream; `natureOf` itself is unchanged (its other users keep their hashes).

Test: `test/ranch.test.ts` (last test). Tool: `tools/stuck-scan2.mjs` (steps the late-town fixture for days, forcing a
raid every half day, and reports any foe-like figure in the snapshot that stays put for a day, by list).
