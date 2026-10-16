## The menus' new look (the owner's ask: "a better and nicer feel, menus that look better and more thought out")

The shared look of every menu, card and box, on the phone first. Renderer only: nothing under `src/shared/` changed
(so `tools/sim-hash.mjs` and its hashes are untouched). It changes the look described in "The menus redone",
"Every menu in sub-tabs", "Tap for more", "The news bubble", "Events told in full" and "The first hour" (the tips' box
keeps its own look); the content and order of the panels are as they were. The new files are under
`src/renderer/ui/`; the CSS is generated once by `ui/uiCss.ts` and put into all three pages (the menus, the phone's
page, the strip) by `ui/frame.ts`, so the pages' own style blocks only gained the top bar's rules
(`mobile/index.html`) and the strip's clock bar rule (`index.html`).

- **The pack art (`ui/art/`, CREDITS.md "The menus' frame set"):** `wood.png` the Craftpix Medieval Field Work
  window's carved frame (cropped and halved, 51x57, slice 9); `stone.png` the Craftpix 2D Top-Down Pixel Dungeon
  `walls_floor.png` raised slab (crop 2,80 44x48, slice 6); `gui0.png` DawnLike's `GUI/GUI0.png` whole (the rounded
  chip at 128,112 16x16 slice 5, the rod at 96,1 40x14, the stat marks). No Craftpix UI pack exists in
  `../chronos-assets` (checked: there is no wood-and-iron or stone-and-parchment GUI set), so the frames are cut from
  these three.

## The frame set (`ui/frame.ts`, `ui/uiCss.ts`)

- `applyUiLook(page, theme, cast, daylight)` is called with every snapshot by `panel/panel.ts`, `mobile/mobile.ts` and
  `hud.ts` (the strip). Only a change of people, alignment (in fifths, `alignStep`) or night does any work. It tints
  the pieces on a canvas (`tinted`) and sets CSS variables on the page's root: `--ui-frame` (the rim, its slice
  `--ui-cut` / `--ui-cut-px`), `--ui-btn`, `--ui-btn-down`, `--ui-btn-off`, `--ui-btn-on`, `--ui-chip`, `--ui-chip-on`,
  `--ui-divider`, `--ui-handle`, and the colours `--ui-surface`, `--ui-glow`, `--ui-face-text`, `--ui-on-text`. The
  root gets `html.ui-look` and `html.page-<page>`.
- What wears what: menus, cards, tap cards, the event box, the news page, the away card, the fight HUD's windows,
  the prompt and the top bar have the rim (`--ui-frame`; the big ones, `.ui-frame-big`, at 1.5x); every button the
  slab's face (pressed darker, `:disabled` greyed, the chosen and `button.primary` the accent slab with the people's
  glow); idle tabs (`.menu-tabs .inv-tab`, `.ui-tab`) the chip, the chosen tab the accent slab; the phone's tab bar a
  rim along its top, the chosen tab the slab; `.chip` the chip; `h2` in a menu the rod under it (`::after`); the
  menu's sheet and the news page a grip (`#sheet::before`); the news bubble keeps its tone (blue, gold, red) inside the
  slab's rim.
- Classes any panel can use: `.ui-frame`, `.ui-frame-big`, `.ui-btn`, `.ui-tab`, `.ui-chip`, `.ui-divider`,
  `.ui-handle`, `.ui-icon`, the type scale `.ui-head` / `.ui-body` / `.ui-small` / `.ui-label`; or `framed(el, kind)`.
- The skins (`skins.ts`) keep each people's colours, fonts and ornaments; the frames go over their code-drawn borders,
  using the skins' own selectors (`parts()`, now exported) under `html.ui-look.ui-look`, and `BOOST` (two `:not(#id)`s)
  where a tab or chip must outweigh the skins' button selector.
- The raid's tactics board is drawn in Pixi: `ui/pixiFrame.ts` `uiPlate(kind, w, h, tint)` nine-slices the same tinted
  slab (`frameCanvas`, `frameVersion` in frame.ts) for its unit boxes (a foe's reddened, a tower's greyed), its
  buttons (Skip, speed, Auto) and the ability box; `tactics/tacticsView.ts` falls back to its own boxes until the
  frames are tinted.

## Themed by people (`ui/looks.ts`)

- `UI_LOOKS` (one per `ThemeId`, 13): `material`, `frame` ('wood' or 'stone'), `rim` (null: the sprite's own colours),
  `face`, `accent` (each a `Ramp`: four colours, shadow to highlight), `surface`, `glow`, `mark` (the top bar's).
  Carved wood (settlers, the sprite as drawn), dark stone and bone (liches), blood-red velvet (vampires), riveted brass
  (machines), coral (merfolk), birch and moss (druids, wood), snow and fur (Moon Pack), sandstone (nomads, the one light
  set, dark writing), gilt (knights), glass and copper (alchemists), iron and skulls (orcs), granite (dwarves), thorn and
  glow (fae, wood).
- `gradientMap(px, ramp)`: each pixel's lightness, stretched over the sprite's own range, picks its colour along the
  ramp at `RAMP_STOPS` [0, 0.42, 0.78, 1] (placed on the slab's outline, inner line, face and bevel).
- `alignRamp(ramp, cast)`: the alignment over it, a good town's frames warmer (toward gold), an evil one's colder
  (toward violet-blue), at most a fifth of the way; under |0.15| none. `pressedRamp`, `disabledRamp`.

## One type scale and one icon set (`ui/icon.ts`, `ui/uiCss.ts`)

- `--ui-fs-head` 15px, `--ui-fs-body` 13px, `--ui-fs-small` 11.5px, `--ui-fs-label` 10.5px (h1, body, hints and
  sub-lines, labels and menu headings).
- `icon(name, size)`: a stat's mark from the sheets in the game (`STAT_ICONS`: people, beds, food, spirits, coins,
  stores, building, studying, workshops, quests, shops, gods, age, raid, blood, skull, deep, day, night, health, attack,
  defence, mana, speed, xp, loss, turn, good, evil, yes, no, news); `statIcon(label)` by a menu's label (`statOf`).
- The Town menu's tiles get their icon and tip after each redraw (`dressStats` in `ui/tips.ts`, called from
  `panel.ts`), so `townOverview.ts` is unchanged. "Minimize" on the desktop strip is "Minimise".

## Motion and tap feedback (`ui/motion.ts`, `ui/frame.ts`)

- Sheets slide up (`ui-up`: the menu sheet, the news page, the event box, the tap card, the ☰ menu, the prompt, the
  tip); a new menu or sub-tab cross-fades in (`main.ui-xfade`, set by `panel.ts` only when the menu or sub-tab
  changes, cleared after 260 ms so the ten-a-second redraws don't fade); changed numbers on the Town tiles (or anything
  with `data-tick="<key>"`) tick over from the old value (`tickNumbers`, `leadingNumber`); bars ease their width.
  Nothing over 250 ms (`--ui-fast` 140 ms, `--ui-slow` 220 ms). `prefers-reduced-motion: reduce` turns all of it off.
- Every button is pressed while held (`.ui-down`, and `:active`) and clicks softly: the strip sets
  `window.__uiClick` (main.ts: ambience's `'page'` cue, the existing page-turn sound, at the sound effects' level and
  only with sound on), found from any page by `findClick`; at most one click per 60 ms.

## The quiet top bar (`ui/topBar.ts`, `mobile/index.html`)

- `createTopBar(top, bridge)`: the town's mark (`UI_LOOKS[...].mark`, on the chip) and name; under them a small arc
  the sun (DawnLike's sun mark) or the moon travels (`arcAt(hour)`: 6:00 to 18:00 the sun, then the moon), "Day N ·
  Season", and one line of what's happening (`topLines`): anything urgent first and held (catching up, a raid, someone
  bleeding out, starving, a doom, lift-off), else in turn every 6 s (`LINE_MS`) the latest news, the study, the
  building sites and the food. Pause and speed beside the ☰. People, beds and coins stay off the bar.
- The strip's own clock bar is hidden inside the phone's page (`body.embedded #clock`), except to hold the held power's
  Cast button in a raid. The news bubble moved up under the bar (64px; on its side under the tabs and the bar).
- On its side the bar is one slim row under the tabs at the left; the ☰ stays at the tabs' end; a menu open or a fight
  on the screen hides the bar but the ☰.

## Night mode

- `nightDepth(daylight)` 0..1 (`--ui-night`, `html.ui-night`): the menus' page under a warm multiply veil, and on the
  phone's page and the strip each framed thing (tab bar, tap card, ☰ menu, news, event box, prompt, fight HUD) dimmer
  and warmer by a filter; the top bar by an inset shade (a filter would pin the ☰ to it on its side).

## Long-press tips (`ui/tips.ts`)

- `wireTips()` in each page: holding a finger 450 ms (`HOLD_MS`) on anything with `data-tip` ("Title|text", and
  `data-tip-icon`), or a plain `title`, shows a small framed sheet (`#ui-tip`) at the bottom; the held tap itself is let
  go, and the next touch hides it. Texts: `STAT_TIPS` (the top bar's mark, day, line, pause and speed; the Town tiles),
  `FIGHT_TIPS` (the fight HUD's health, mana, stamina, limit and turn gauges, via `fightTip` in `fight/fightHud.ts`).

## Files outside `ui/` touched (small)

- `panel/panel.ts` (applyUiLook, wireTips, dressStats, tickNumbers, the cross-fade), `mobile/mobile.ts` (applyUiLook,
  the top bar, wireTips), `hud.ts` (applyUiLook, wireTips), `main.ts` (`__uiClick`), `skins.ts` (`parts` exported),
  `fight/fightHud.ts` (`fightTip` on two meters), `tactics/tacticsView.ts` (`uiPlate` in three boxes),
  `mobile/index.html` (the top bar's CSS, the bubble's top), `index.html` (the clock bar on the phone, the prompt's
  top). No `*Panel.ts` changed.
- Test: `test/uiLooks.test.ts` (13 looks, ramps dark to light, the gradient map, alignment warmth, pressed and greyed
  faces, night depth, the number tick's parsing).
