## A card Town home, folded sections, a "why" line (the UI restructure)

The owner's ask: "Menus that look better and more thought out." This is the structure half (content and layout of the
panels); the look half (frame, theme variables, icons, motion) is `claude/ui-look`'s. Everything here uses plain class
names with the few layout rules in one injected style block, so the look can restyle them.

Changes HISTORY.md sections: "The menus redone" (the Town overview's tiles are now a dashboard, the tiles kept in a
closed "At a glance" section), "Every menu in sub-tabs" (the open tab's sections fold; the tab row is sticky), "Tap for
more" (a swipe right closes the card opened last), "Mood drives what the town builds" (the planner's reasons are shown).

**The dashboard** (`panel/dashboard.ts`, `dashboard(s, bridge, rerender)`): the Town's Overview opens on cards
(`.dash` grid of `.dash-card`): Food (days left and a ▲/▼/▬ trend, sampled hourly by `noteFood(snap)` called from
`panel.ts`, so the arrow shows after three hours of game time with the menu up), Danger (the raid at the gate or a
doom's signs, the wall's progress, guards), Spirits (with a bar), Treasury, Faith, Building now (with a progress bar
and the why line) and the realm line when at war. The most urgent card, by an urgency number each card works out, gets
`.card-urgent`. A tap goes to the card's tab *and opens its section* (`jumpToSection`, then scrolls to it). `dashboardKey`
is the card text as drawn, so the Overview key (`buildPanel.ts buildKey`) changes only when something the eye can see does.

**Folded sections** (`panel/structure.ts`, `foldSections`): in each tabbed menu (Town, Studies, People, Quests, Market, War)
the open tab's `h2` headings become `section.section` (`.section-head` button, `.section-title`, `.section-count`,
`.section-body`), with counts from `panel/counts.ts` (`countsFor(menu, snap)`: "In town 273 built", "Being built 8 under
way", "People 37 · 3 away"). A section with more than 8 things inside starts closed when the tab has three or more
sections; "At a glance" always starts closed. Open or closed is remembered per viewer in `localStorage`
`littletown.fold.<menu>.<heading words>`; toggling edits the DOM and storage only, so it needs no redraw and is not in any key.
A tab with one section is left as it was. `inTabs` (`subtabs.ts`) takes a `fold` function for the tab's content.

**Sticky tab bar:** `.menu-tabs { position: sticky; top: 0 }` in the injected style. **Swipe right:** `installSwipe(body,
closeLatestCard)` (`structure.ts`, `details.ts closeLatestCard`): a short, flat swipe to the right closes the card
opened last, else a sheet's Cancel/Close (the muster sheet). A swipe starting on `.no-swipe` things is left alone.

**Pictures:** the People rows already had the paper-doll face and the guild badge; they now carry the calling's emblem
(`emblemCanvas(p.roadId, 18)`, `.calling-mark`). Guild member chips gain the face. The Town's building cards gain a
thumbnail (`structure.ts thumb(defId)`, `.thumb`): the strip frame's `window.__picture({building})` (already there for the
feed) is read through the parent page, cached as a data URL per building, and filled a moment after the card is drawn
without a redraw; on the desktop, where the menu has no strip beside it, no thumbnail shows.

**The why line** (`sim/whyLines.ts`, `townWhy(s)`): the planner already records `plan.build` and `plan.research` with
reasons; the snapshot's optional `why?: { build?, research?, craft? }` turns them into sentences ("Building a granary
because food stores run out in 3 days."), and the craft line is worked out from the first workshop order. It is derived at
snapshot time and never written to the state, so saves and `tools/sim-hash.mjs` are unchanged. Shown on the dashboard's
Building card, under the dashboard for studying and making, under Direction, and on the Studies queue (`.why-line`).

**Icons:** until the look chat's `icon(name)` is in, numbers carry icons from the existing sheets (`structure.ts sheetIcon`,
`materialIcon`). Swap `sheetIcon(...)` calls in `dashboard.ts` for `icon(name)` at merge.

Test: `test/whyLines.test.ts`.
