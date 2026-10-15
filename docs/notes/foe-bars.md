## One bar per foe

The side-view fight HUD (`fight/fightHud.ts`, CSS in `index.html`) now gives every living foe its own row, where
"Fight bars, labelled" gave each kind one summed bar ("Wolf ×3"). Renderer only; the sim and snapshot are unchanged
(each `FighterView` already carries its own `hp`, `maxHp` and `atb`). Changes the foes' part of "Fight bars, labelled".

- Each row: the foe's name, its short `Turn` gauge (`atb`, "Next turn"), then its own life bar with `hp/max` over it.
  A foe that has fallen has no row.
- Numbering: a kind with more than one foe is numbered by its place in the battle (Wolf 1, Wolf 2, ...), counting the
  fallen too, so a number stays with its foe as the others fall. A lone foe keeps its plain name.
- Tiers, by the number of living foes on screen (`foes.classList`, set in `update()`):
  - up to three: the stacked layout (name and turn gauge over the bar), as before;
  - more than three (`.ff-foes.crowd`): one line each (name, turn gauge, bar);
  - more than six (`.ff-foes.tight`): smaller text, no turn gauge (`display: none`), thinner bars (7px) with smaller numbers;
  - more than ten (`.ff-foes.packed`): `max-height: 36vh` and `overflow-y: auto`, so the list scrolls inside its window
    and the window never grows past the fight log's and the fighters' room.
- The wave line ("Wave 2 of 3", assaults) stays at the top of the list and isn't counted as a foe.
- Key names: `foeRows`, `foeCount`, `kinds` and `seen` (numbering) in `fightHud.ts`; `.ff-foes.crowd`, `.ff-foes.tight`
  and `.ff-foes.packed` in `index.html`.
