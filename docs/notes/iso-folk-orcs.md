## The peoples' own casts begin: the orcs

The first of the peoples' own iso casts: `src/renderer/art/iso/folk/orcs/` holds three looks, `man_brute`,
`woman_orc` and `man_shaman` (PixelLab: a settler front view edited into the people's dress, turned to 8 directions),
each with `walk`, `idle`, `death` and `attack_1h` (a punch: PixelLab's mannequin has no weapon template). The casting
peoples (liches, druids, fae, alchemists) will get a thrown spell as `cast_1h` instead.

- `iso/folkRules.ts`: `FOLK_LOOKS.orcs`. Look names start `man_`/`woman_` so `pickLook` matches them to the person's
  sex. A people's cast has no armed looks: `<look>+axe` is missing, so the bare look is used.
- `FALLBACK`: `chop` and `hammer` no longer fall back to `attack_1h` (a cast with no tools idles at its work rather
  than punching the tree).
- Test: `test/isoFolk.test.ts` (a people's cast by sex; the chore fallback).
- The other ten peoples (3 looks each) follow as their animations finish; the coordinator's `assemble_folk.py` lays
  them out with the same names (`RENAME`).
