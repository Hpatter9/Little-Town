## The last six peoples' own iso casts

`src/renderer/art/iso/folk/robot/` (`man_worker`, `man_guard`, `woman_android`), `merfolk/` (`man_mer`, `woman_mer`,
`man_fisher`), `nomads/` (`man_rider`, `woman_nomad`, `man_herder`), `fae/` (`man_fae`, `woman_fae`, `man_sprite`),
`alchemists/` (`man_master`, `woman_alchemist`, `man_apprentice`) and `knights/` (`man_knight`, `woman_knight`,
`man_squire`), laid out like the orcs (docs/notes/iso-folk-orcs.md) and listed in `FOLK_LOOKS` (`iso/folkRules.ts`).
Every people (the dwarves wear the settlers' dwarf looks) now has its own cast.

All have `walk`, `idle` and their attack (`attack_1h`, a punch; `cast_1h`, a thrown spell, for the fae and alchemists).
The month's PixelLab generations ran out before the deaths: only the machines and `merfolk/man_mer` have `death`; the
rest have no `hurt` either, so `iso/folkSprite.ts` lays the standing figure on its side (`sprite.rotation`) for a
look with no death drawn. The missing deaths (16 looks x 8 directions, about 220
generations) can be made after the allowance resets (Nov 21) with the coordinator's `pl_people.py` (`MOVES_ONLY=death`)
and laid in with `assemble_folk.py`.
