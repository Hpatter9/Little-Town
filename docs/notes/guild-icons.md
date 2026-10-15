## Guild icons

Each guild has a small round badge (DawnLike item glyph on a coloured token) shown by its members' names, so you can see who has joined which guild. Renderer only: the sim and snapshot are unchanged (a person's guilds are found from `snapshot.guilds`).

- `src/shared/data/guildEmblems.ts` (`GUILD_EMBLEMS`): one glyph and two colours per `GuildRole`. wardens Shield 4, menders Potion 0, rangers Ammo 8 (a bow), crafters Tool 9, merchants Money 0 (coins), scholars Book 40, elite ShortWep 1 (a dark blade).
- `src/renderer/art/guildMarks.ts`: `guildsOf(s, personId)`, `guildBadge(role, size, title)` (canvas), `guildMark(s, personId)` (the first guild's badge; its tooltip names all of them).
- Shown in: the People list rows (after the people mark), the inspect card (a line naming every guild, leader starred), the map tap card (`overlayUi.ts`, `createPersonCard.show(..., guilds)`), and the Guilds tab (`panel/guildPanel.ts`: badge on each guild card and on each member chip; leader starred). Membership was already in the People panel key.
- Not done: the fight HUD and Chronicle show names without a person id, so they cannot map to a guild without a sim change.
- Art is from DawnLike sheets already in `src/renderer/art/items` and credited.
