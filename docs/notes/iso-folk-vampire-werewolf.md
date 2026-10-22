## The Blood Court's and the Moon Pack's own iso casts

`src/renderer/art/iso/folk/vampire/` (`man_lord`, `woman_lady`, `man_thrall`) and `folk/werewolf/` (`man_hunter`,
`woman_huntress`, `man_beast`), each with `walk`, `idle`, `death` and `attack_1h` (a punch), laid out like the orcs
(docs/notes/iso-folk-orcs.md) and listed in `FOLK_LOOKS` (`iso/folkRules.ts`). The Moon Pack's `man_beast` (the
wolf-headed form) is left out of the everyday looks: it's there for drawing a werewolf in its form in the iso view
later (`map/mapPeople.ts` still draws the form the old way).
