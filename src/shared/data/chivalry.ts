// The knights' code (the origins made deeper, the fourth; sim/chivalry.ts). In an Exiled Order town the grown-ups
// swear vows and are honoured or shamed by how they keep them; the town holds tournaments; the worthy are knighted;
// the liege lord calls for service; and an Order rich in honour rides out after the Holy Grail, which wins the game.

/** The hour of the day's reckoning (vows and the liege's call), and of the tournaments. */
export const CODE_HOUR = 9;
export const TOURNEY_HOUR = 12;

export type VowId = 'valour' | 'poverty' | 'temperance' | 'chastity' | 'vigil';
export interface Vow {
  id: VowId;
  name: string;
  text: string;
  /** Days it runs; kept to the end, it's fulfilled. */
  days: number;
}
export const VOWS: Record<VowId, Vow> = {
  valour: { id: 'valour', name: 'the Vow of Valour', text: 'to fell a foe of the town before the vow runs out', days: 8 },
  poverty: { id: 'poverty', name: 'the Vow of Poverty', text: 'to keep no more than a handful of coins (the rest goes to the Order) and own nothing', days: 6 },
  temperance: { id: 'temperance', name: 'the Vow of Temperance', text: 'to touch no drink at the tavern', days: 6 },
  chastity: { id: 'chastity', name: 'the Vow of Chastity', text: 'to take no partner', days: 10 },
  vigil: { id: 'vigil', name: 'the Vow of Vigil', text: 'to stand guard for the town', days: 6 },
};
export const VOW_IDS = Object.keys(VOWS) as VowId[];
/** Each morning a grown-up with no vow swears one on this chance; one sworn to poverty gives the Order what they hold past
 *  `POVERTY_MOST` coins, and breaks it by owning property. */
export const SWEAR_CHANCE = 0.25;
export const POVERTY_MOST = 30;
/** A vow fulfilled: honour, levels of fighting, spirits; broken: shame (the town's honour and their spirits). */
export const KEPT_HONOUR = 6;
export const KEPT_LEVELS = 1;
export const KEPT_MORALE = 8;
export const BROKEN_HONOUR = -8;
export const BROKEN_MORALE = -10;

/** Tournaments: every `TOURNEY_DAYS`, the town's `TOURNEY_ENTRANTS` best fighters joust against visiting knights
 *  (`VISITOR_LEVEL` plus the town's age): a win is coins (`TOURNEY_PURSE`), honour and renown; a fall may hurt. */
export const TOURNEY_DAYS = 7;
export const TOURNEY_ENTRANTS = 3;
export const VISITOR_LEVEL = 4;
export const TOURNEY_PURSE = 30;
export const TOURNEY_HONOUR = 4;
export const TOURNEY_HURT = 0.3;
export const TOURNEY_TRAVELLERS = 1.3;
/** Knighted: a grown-up with melee at `KNIGHT_LEVEL` who has kept a vow is dubbed (a title; spirits). */
export const KNIGHT_LEVEL = 8;
/** The liege's call: every `LIEGE_DAYS` the liege asks for `LIEGE_SENT` fighters for `LIEGE_HOURS`; they come home
 *  with `LIEGE_PAY` coins each and honour, now and then hurt or dead (`LIEGE_HURT`, `LIEGE_KILLS`). Refused, honour is
 *  lost and the liege takes `LIEGE_FINE` coins. */
export const LIEGE_DAYS = 8;
export const LIEGE_SENT = 2;
export const LIEGE_HOURS = 30;
export const LIEGE_PAY = 25;
export const LIEGE_HONOUR = 8;
export const LIEGE_REFUSED = -12;
export const LIEGE_FINE = 40;
export const LIEGE_HURT = 0.3;
export const LIEGE_KILLS = 0.08;
/** The Grail: at `GRAIL_HONOUR` in the Medieval age or later, the Order's best rides out alone for `GRAIL_HOURS` on each
 *  of the quest's stages; the odds by their level (`GRAIL_ODDS_*`); failed, they come home wounded (or not at all,
 *  `GRAIL_KILLS`) and the Order waits `GRAIL_WAIT_DAYS`. The third stage won finds the Grail, and wins the game. */
export const GRAIL_HONOUR = 60;
export const GRAIL_HOURS = 36;
export const GRAIL_ODDS_BASE = 0.3;
export const GRAIL_ODDS_PER_LEVEL = 0.02;
export const GRAIL_ODDS_MOST = 0.85;
export const GRAIL_KILLS = 0.25;
export const GRAIL_WAIT_DAYS = 4;
export const GRAIL_STAGES: { name: string; won: string; lost: string }[] = [
  {
    name: 'the Chapel Perilous',
    won: '{knight} came back from the Chapel Perilous grey-faced and silent, but with a strip of altar-cloth that glows faintly in the dark. The first sign is found.',
    lost: '{knight} came back from the Chapel Perilous raving about a black hand that put out every candle. Whatever is in that chapel, it was not ready for them.',
  },
  {
    name: 'the Fisher King\'s hall',
    won: '{knight} found the Fisher King\'s hall in the marshes and asked the question nobody else had thought to ask. The wounded king wept, and showed them the road.',
    lost: '{knight} sat at the Fisher King\'s table and saw the procession pass, and said nothing. In the morning the hall was gone, and so was the road.',
  },
  {
    name: 'the Grail Castle',
    won: '{knight} rode through the last gate of the Grail Castle and knelt. The cup was there, as the stories said, shining with its own light. They have brought it home.',
    lost: '{knight} reached the Grail Castle, but the bridge would not hold them. Not yet worthy, the voice said, and the mists closed.',
  },
];

export const HONOUR_NAMES: [number, string][] = [
  [80, 'Legendary'],
  [50, 'Renowned'],
  [25, 'Honourable'],
  [5, 'Respected'],
  [-20, 'Doubted'],
  [-101, 'Disgraced'],
];
