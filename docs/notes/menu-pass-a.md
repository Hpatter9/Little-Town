## Menu pass A: Town, Studies, Market, the ☰ menu and Phone alerts

A tidy of the menus: at most four sub-tabs each, the one or two things a player comes for first, the rest one tap away,
and wording that no longer promises things the game has dropped. No rule of the simulation changed. Files:
`panel/subtabs.ts` (`GROUPS` for `build` and `trade`), `panel/buildPanel.ts`, `panel/dashboard.ts`,
`panel/townOverview.ts`, `panel/researchPanel.ts`, `panel/tradePanel.ts`, `panel/empirePanel.ts`,
`panel/alertsPanel.ts`, `mobile/mobile.ts`, `main.ts`.

**Town (`build`)**: eight tabs became four: Overview (cards, glance, powers, the days ahead), Buildings (being built, in
town, the building book), Stores (the stores, then Treasury, Tax and Guards) and More (Direction, Raid battles,
Promotions and stats, Town size, then faith, villages, council, the people's ways and magic, each once the town has
it). Tab names changed, so the redraw key's `on([...])` lists, the dashboard and glance tiles' links, and the strip's
"show the villages" (`littletown.subtab.build` = `More`) were moved with them. The levers no longer sit under the cards.
Removed: the why-lines repeated under Direction (the cards already show them), "decides for itself what and where",
"It builds them itself, as it needs them", the building details' "(the Plan tab sets its direction)" (there is no Plan
tab), "Last decided" (now "Latest"), "Callings and stats" and "Evolutions" (now "Promotions and stats", "Promotions: ask
me / they choose"), "The founder's purse" (now "The town's purse").

**Studies (`research`)**: still two tabs (Studying, Tech tree). "Research queue 3/3" is now "Studying 3/3"; the hints
under the list and the tree are one short line each; "the town will get to it" and "The town builds more [stations]" are
gone. The Town's Studying tile says "% done", not "queued".

**Market (`trade`)**: nine tabs became four: Shops, Trade (caravan, prices, trade house, trade empire, harbour),
Workshops, Animals (herds, horses, the ranch). The Trade empire hint pointed at "the Plan tab"; it now says Town, More.
A shop card's takings were shown as a raw float ("took 35.254000000000005"); now whole coins.

**The ☰ menu**: the flat list of settings is in three labelled groups (Sound and feel, Screen, Help), then Phone alerts;
the zoom slider's label says to pinch too, so the extra caption is gone.

**Phone alerts**: the intro no longer talks of raids waiting at the gate for twelve hours while you are away, or the game
looking ahead when you leave. It lists what you are told about and the three steps to set it up.

**Left alone, for the owner/coordinator**: there is no Plan menu (its one lever, Direction, is in Town, More); the sim's
own text ("Building a elder lodge because...", `sim/whyLines.ts`) and the "While you were away" card are the sim's, not
the menus'. Once the founder-led building and the three research offers land, Being built / Direction / the studying list
want a second pass to show the player's own orders.
