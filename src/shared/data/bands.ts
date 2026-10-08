// Visiting bands (the owner's ask: "groups of people travel in to town: caravans who trade, travellers passing
// through, bandits trying to sneak in to attack from the inside, or refugees looking for aid and some rest"). A trade
// caravan's merchants and their wagon come in to the market and stay while it trades; travellers come in one gate,
// rest a while at the tavern or the fire, and go out the far gate; a band of "travellers" is now and then bandits in
// disguise, who loiter by day and strike from inside the town by night unless a guard on watch sees through them;
// refugees camp at the gate and ask for aid and rest, a question for the player. The bands themselves: sim/bands.ts.

export type BandKind = 'caravan' | 'travellers' | 'bandits' | 'refugees' | 'village';

/** From this day; each hour's chance of a band (besides a caravan's) while none is in town; the kinds' weights. */
export const BAND_FIRST_DAY = 2;
export const BAND_HOURLY = 1 / 28;
export const BAND_WEIGHTS: Readonly<Record<Exclude<BandKind, 'caravan' | 'village'>, number>> = { travellers: 5, refugees: 2, bandits: 2 };
/** Bandits in disguise only from this day, in a town of this many grown-ups. */
export const BANDITS_FROM_DAY = 4;
export const BANDITS_PEOPLE = 4;
/** How many come, by kind. */
export const BAND_SIZE: Readonly<Record<BandKind, [number, number]>> = { caravan: [2, 4], travellers: [2, 4], bandits: [3, 5], refugees: [2, 4], village: [1, 2] };
/** How long travellers rest on their way through (hours). */
export const PASS_HOURS: [number, number] = [1, 2];
/** Refugees wait this long at the gate for an answer (unanswered: fed if the stores can spare it, else turned away),
 *  rest this long when fed, eat this much food a head, and what each answer does to the town's reputation. */
export const REFUGEE_WAIT_HOURS = 10;
export const REFUGEE_REST_HOURS = 20;
export const REFUGEE_FOOD = 2;
export const REFUGEE_REPUTATION = { taken: 3, fed: 2, turned: -1 } as const;
export const REFUGEE_OPTIONS = ['Take them in', 'Give them food and rest', 'Turn them away'] as const;
/** Bandits strike between these hours; their strength against a raid's budget; a guard on watch sees through them
 *  each hour with this chance plus this much a level of their best fighting skill. */
export const STRIKE_FROM = 23;
export const STRIKE_UNTIL = 3;
export const BANDIT_BUDGET_SHARE = 0.7;
export const CATCH_BASE = 0.04;
export const CATCH_PER_LEVEL = 0.012;
/** The wagon rolls this far behind the lead merchant; a band walks this fast (px a second). */
export const WAGON_LAG = 44;
export const BAND_SPEED = 55;
/** What the members are called, by kind (bandits in disguise pass for travellers). */
export const MEMBER_KIND: Readonly<Record<BandKind, string>> = { caravan: 'merchant', travellers: 'traveller', bandits: 'traveller', refugees: 'refugee', village: 'carter' };
