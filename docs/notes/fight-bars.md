## Fight bars, labelled

The side-view fight HUD (`fight/fightHud.ts`, CSS in `index.html`) reads clearer. Renderer only; the sim and snapshot
are unchanged (`FighterView` already carried `hp`/`maxHp`). Changes the "Watching a party's fights" HUD.

- Party rows: a short labelled `Turn` gauge beside the name (26px); under it a long `HP` bar with `hp/max` over it
  (green, amber under a quarter, red when down); then `MP`, `SP` and `Limit` bars side by side, each named.
- Foes: each kind's row has a life bar with numbers on it (the kind's living foes added together, "×3" in the
  name) and the short `Turn` gauge. Past three kinds (`.ff-foes.crowd`) rows go one line each (name, bar) and the
  foes' turn gauge is hidden to keep the window short.
- Helpers `turnGauge` and `meter` in `fightHud.ts`; classes `.ff-meter`, `.ff-gauge`, `.ff-lab`, `.ff-turnwrap`.
- Preview: `__skirmish(...)` (main's debug hook) starts a watched skirmish.
