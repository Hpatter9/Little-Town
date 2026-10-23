## The founder's "Now" line

The founder's card (the Founder tab's first screen, and the top of its Orders sheet) now says in plain words what the
founder is doing at the moment, with an icon. Under it is the order they're set to, when that's something else: "▶️
Researching Oral Tradition at the campfire", or "🚶 Eating" over "Set to: working at farm for the day". This replaces
the plain doing line in the card's head and the old "Told to:" line.

- **The words** (`panel/founderNow.ts`, `founderNow(f, founderView, muster)`, pure): the person's own `doing` (the same
  line the tap card and the townsfolk list show: `describe` in `sim/snapshot.ts`; there's no second describer). These
  cases come first:
  - downed and bleeding: "Down and bleeding: someone must tend them";
  - downed and mending: "Recovering from wounds: badly hurt, resting in the hut";
  - on a trip: "Leading a party: The Lost Shrine (day 2 of 4, on the road)", or "With a party: ... (3 hours left,
    waiting on your answer)" on a trip shorter than a day; it says "fighting" while the trip's battle is on;
  - away elsewhere: "Away: the arena".

  Icons: 🩸 bleeding, 🩹 mending, 🧭 on a trip, ⚔️ fighting (at home or on the trip), 💤 asleep, 🚶 walking, ▶️
  anything else.
- **Set to:** the founder's order in words (`FounderView.order`). While a muster they lead or are in is being raised,
  it reads "raising a party for <place>". It is left out when it says the same as the Now line (a walk to where they
  were sent), when they're asleep on a rest order, and when they're exploring on an explore order.
- **The describer** (`describe`, the wander case) now names the founder's own walks, which used to read "Idling at
  camp": "Walking to the <building>" on a Go to order, and "Exploring to the <wind>" on an Explore order. Anyone
  else's explore walk reads "Off to look at the land beyond".
- **The snapshot** (`FounderView`, both fields optional):
  - `orderKind`: `go`, `work`, `rest` or `explore`;
  - `trip` (`founderTrip`): the destination's name, the leg, whether the founder leads, whether a fight or a question
    is holding the trip, the day out of the total days, and the hours left. The days count whole game days of the
    trip's planned out, work and back ticks.
- **Live:** the card's redraw key (`founderKey`) holds the line's icon and words and the Set to words (`nowKey`), not
  any coordinates, so the card redraws only when the words change. The bleeding line leaves out the minutes left, so
  the card doesn't redraw every game minute.
- **Phone:** one line for Now (it wraps when the doing line is long) and one small hint line for Set to. Upright
  (393x852) the four big buttons stay on the first screen. Sideways (852x393) the first row of buttons stays on it, as
  before. The screenshots are in `docs/notes/founder-doing/`.
- **Tests:** `test/founderNow.test.ts` covers:
  - working; set to a job but eating; walking to where they were sent;
  - asleep, on a rest order and without one; fighting; downed, both bleeding and mending;
  - on a trip, leading it or along, counted in days and in hours, and fighting;
  - away; raising a party;
  - the describer's walk wording, through a real step and snapshot.

## The founder in one place

The owner asked for the founder's tab to hold everything about the founder, and for the founder to come off the town's
People list. The founder's tab now has three sub-tabs: **Founder** (the card: the Now line, purse, gear and the four
big buttons, as before), **Character** (new) and **Story**.

- **Character** (`renderFounderCharacter` in `panel/founderPanel.ts`, under its own `h2` "Character", with
  `['Character', /^Character$/]` added to the founder's `GROUPS` in `panel/subtabs.ts`): the same pages the People tab
  draws for anyone else, reused, not copied (`founderCharacter` in `panel/townsfolkPanel.ts`, which calls
  `inspectView`).
  - The character sheet (`personCard.ts`): the portrait, bars, calling, titles, and the Story, Skills, Kin and Kit tabs.
  - "All details…" leads to the older pages: Equipment, Character (where stat points are spent), Background and
    Skills, and the calling's road.
  - There's no "‹ Everyone" back button. A relative tapped on the sheet opens in the People tab.
  - The founder tab's redraw key takes in this page's own key (`founderCharacterKey`), built the same way as the
    People tab's key for the person inspected (`whoKey`, now shared by both).
- **Off the list** (`panel/folkList.ts`, `listedFolk`, pure): the People tab's list leaves out the founder. In their
  place, a small button above the list, "<name> (you): the founder's tab ›", opens the founder's tab. The counts
  still include the founder, because they come from the sim and not from the list: the head's "People N", the
  overview's tile and housing (`snapshot.housing.people` is `s.people.length`).
- **Every way in leads to the founder's tab:**
  - Anything that asks the People tab to inspect the founder (a tapped name or portrait through `openPerson`, a
    relative on someone's sheet, the ♥ followed row, the families and guilds lists) is caught in `panel.ts`
    (`takeFounder`), which opens the founder's tab on Character instead.
  - On the map, the founder's tap card offers "The founder…" and no longer "Townsfolk…". The person card's details
    button opens the founder's tab when the person is the founder (`main.ts`).
- **Phone:** the Character tab at 393x852 and 852x393 reads as the People tab's sheet does. Screenshots:
  `*-character.png`, `*-character-details.png` and `*-people.png` (the list without the founder, "People 4" for three
  listed).
- **Test:** `test/founderNow.test.ts`, "the People list leaves out the founder, and the town still counts them".
