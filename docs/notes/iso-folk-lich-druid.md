## The liches' and druids' own iso casts

`src/renderer/art/iso/folk/lich/` (`man_lord`, `woman_ghoul`, `man_skeleton`) and `folk/druid/` (`man_elder`,
`woman_druid`, `man_warden`), each with `walk`, `idle`, `death` and `cast_1h` (a thrown spell), laid out like the orcs
(docs/notes/iso-folk-orcs.md) and listed in `FOLK_LOOKS` (`iso/folkRules.ts`). A fight's `attack_1h`/`attack_2h` now
falls back to `cast_1h` before idling, so the casting peoples fight with their spell. Test: `test/isoFolk.test.ts`.
