// The event cards' scenes (the owner's ask: "the images need to relate to what's on the card ... a council voting should
// be a town hall looking setup with the council talking to the townsfolk. And actually have the townsfolk involved"):
// one for each scene an event names (data/eventSceneIds.ts, `scene` on each event), played by scenePlayer.ts. The
// dolls are the event's cast (eventCast.ts `SLOT`): the townsperson it's about, the founder, three more grown-ups, the
// outsiders it brings, then the crowd of townsfolk. The props are panel/eventProps.ts's. The questions that aren't choice
// events (a council's vote, a trial, an envoy...) pick theirs by kind; anything else falls back to the old guess from
// the title (`eventFamily`).

import { EVENT_BY_ID, EVENTS, type EventDef } from '../../shared/data/events';
import type { EventSceneId } from '../../shared/data/eventSceneIds';
import { SLOT } from './eventCast';
import { eventFamily, type Actor, type Anim, type Crowd, type EventFamily, type Prop, type SceneScript } from './sceneScripts';

const { lead: L, founder: F, elder: E1, elder2: E2, elder3: E3, stranger: S, stranger2: S2, stranger3: S3, knight: K, priest: PR, merchant: M } = SLOT;

const A = (who: number | string, anim: Anim, x: number | [number, number], h: number, o: Partial<Actor> = {}): Actor => ({ who, anim, x: typeof x === 'number' ? [x, x] : x, h, ...o });
const P = (id: string, x: number, y = 0.93, o: Partial<Prop> = {}): Prop => ({ id, x, y, ...o });
/** The crowd: townsfolk from the cast's crowd places. */
const C = (n: number, x: [number, number], y: [number, number], h: number, face: Crowd['face'], anim?: Anim, rows?: 1): Crowd => ({ n, x, y, h, face, from: SLOT.crowd, ...(anim ? { anim } : {}), ...(rows ? { rows } : {}) });
/** An audience along the front of the picture, backs to us: heads and shoulders under what they're watching. */
const AUDIENCE = (n: number, x: [number, number] = [0.05, 0.95]): Crowd => C(n, x, [1.04, 1.04], 34, 'b', undefined, 1);
/** A row of the same prop: a fence, a field of crops. */
const row = (id: string, from: number, to: number, step: number, y: number, o: Partial<Prop> = {}): Prop[] => {
  const out: Prop[] = [];
  for (let x = from; x <= to + 1e-9; x += step) out.push(P(id, Math.round(x * 1000) / 1000, y, o));
  return out;
};

export const EVENT_SCENES: Record<EventSceneId, SceneScript> = {
  /* ------------------------------------------------------------ the town's own business */
  // the hall: the council behind its table, one of them on their feet putting it to the townsfolk gathered before them
  council: {
    back: 'set:hall',
    props: [P('long_table', 0.5, 0.79, { k: 1.1 }), P('candles', 0.25, 0.78), P('candles', 0.75, 0.78), P('board', 0.89, 0.6, { back: true, k: 0.7 })],
    actors: [A(E2, 'idle', 0.4, 42, { y: 0.74, face: 'f' }), A(F, 'idle', 0.5, 44, { y: 0.745, face: 'f' }), A(E3, 'idle', 0.6, 42, { y: 0.74, face: 'f' }), A(E1, 'talk', 0.12, 42, { y: 0.86, face: 'r' })],
    speaker: 3,
    crowd: [AUDIENCE(8, [0.2, 0.97])],
    fx: [{ kind: 'dust', n: 4, colour: '#e8d8b0' }],
  },
  // the judge on the seat, the accused held before them, a witness speaking, the town crowding in
  trial: {
    back: 'set:hall',
    tint: ['#201008', 0.12],
    props: [P('throne', 0.5, 0.76), P('candles', 0.34, 0.76), P('candles', 0.66, 0.76), P('banner_brown', 0.5, 0.5, { back: true })],
    actors: [A(F, 'idle', 0.5, 42, { y: 0.78, face: 'f' }), A(L, 'idle', 0.38, 40, { y: 0.84, face: 'r' }), A(K, 'idle', 0.26, 42, { y: 0.84, face: 'r' }), A(E1, 'talk', 0.72, 40, { y: 0.84, face: 'l' })],
    speaker: 3,
    crowd: [AUDIENCE(8)],
    fx: [],
  },
  // a crowd in the square, fists up, one of them haranguing the founder at the hall door
  revolt: {
    back: 'summer_1',
    tint: ['#401808', 0.15],
    props: [P('door', 0.88, 0.95, { k: 0.9 }), P('fire', 0.06, 0.96, { k: 0.8 }), P('cask', 0.72, 0.96)],
    actors: [A(F, 'idle', 0.84, 44, { y: 0.95, face: 'l' }), A(L, 'talk', 0.66, 44, { y: 0.92, face: 'r' })],
    speaker: 1,
    crowd: [C(8, [0.1, 0.56], [0.88, 0.97], 42, 'r', 'cheer')],
    fx: [{ kind: 'embers', n: 10, at: [0.08, 0.88], colour: '#ff8a3a' }, { kind: 'smoke', n: 4, at: [0.08, 0.75], colour: '#5a5a5a' }],
  },
  // two at odds in the street, the neighbours watching
  quarrel: {
    back: 'summer_1',
    props: [P('fence', 0.08, 0.9), P('fence', 0.92, 0.9), P('cask', 0.2, 0.95)],
    actors: [A(L, 'talk', 0.42, 46, { y: 0.9, face: 'r' }), A(E1, 'attack', 0.58, 46, { y: 0.9, face: 'l' })],
    speaker: 0,
    crowd: [C(2, [0.12, 0.24], [0.88, 0.9], 40, 'r'), C(2, [0.76, 0.88], [0.88, 0.9], 40, 'l'), AUDIENCE(5, [0.2, 0.8])],
    fx: [{ kind: 'dust', n: 6, at: [0.5, 0.95] }],
  },
  // at home: someone telling the founder their trouble across the table
  home: {
    back: 'set:cottage',
    props: [P('shelf', 0.12, 0.74, { k: 0.8 }), P('table_small', 0.5, 0.9), P('bowl', 0.46, 0.79, { z: 0.91, k: 0.6 }), P('candle', 0.55, 0.8, { z: 0.91, k: 0.6 }), P('chair', 0.3, 0.9)],
    actors: [A(L, 'talk', 0.36, 44, { y: 0.92, face: 'r' }), A(F, 'idle', 0.66, 44, { y: 0.92, face: 'l' })],
    speaker: 0,
    crowd: [C(2, [0.82, 0.95], [0.8, 0.82], 38, 'l')],
    fx: [],
  },
  // one setting off down the road with a handcart, the others waving them off
  leaving: {
    back: 'summer_4',
    props: [P('sign', 0.86, 0.92), P('handcart', 0.66, 0.94)],
    actors: [A(L, 'walk', [0.42, 0.56], 44, { y: 0.94 })],
    crowd: [C(5, [0.04, 0.3], [0.9, 0.97], 40, 'r', 'cheer')],
    fx: [{ kind: 'dust', n: 6, at: [0.6, 0.96] }, { kind: 'birds', n: 3 }],
  },
  // the children at their games, a grown-up telling them something
  children: {
    back: 'summer_3',
    props: [P('hay_bale', 0.84, 0.9), P('fence', 0.1, 0.88), P('apple', 0.5, 0.97, { k: 0.7 })],
    actors: [A(L, 'talk', 0.26, 44, { y: 0.92, face: 'r' })],
    speaker: 0,
    crowd: [C(6, [0.38, 0.92], [0.88, 0.97], 36, 'l', 'cheer')],
    fx: [{ kind: 'petals', n: 6 }, { kind: 'birds', n: 2 }],
  },
  // the workshop: hammering at the bench, tools on the wall, someone come to watch
  workshop: {
    back: 'set:cottage',
    tint: ['#3a1800', 0.12],
    props: [P('tools', 0.3, 0.42, { back: true }), P('tools', 0.7, 0.42, { back: true, flip: true }), P('table', 0.48, 0.92), P('crate', 0.12, 0.93), P('cask', 0.88, 0.93)],
    actors: [A(L, 'work', 0.4, 44, { y: 0.88, face: 'r' }), A(E1, 'idle', 0.66, 42, { y: 0.88, face: 'l' })],
    crowd: [C(2, [0.78, 0.96], [0.97, 0.99], 38, 'b')],
    fx: [{ kind: 'sparks', n: 12, at: [0.5, 0.8], colour: '#ffcf5a' }, { kind: 'dust', n: 4 }],
  },
  // reading by candlelight among the shelves
  study: {
    back: 'set:cottage',
    tint: ['#100818', 0.25],
    props: [P('shelf', 0.18, 0.76), P('shelf', 0.82, 0.76), P('table_small', 0.5, 0.92), P('candles', 0.5, 0.82, { z: 0.93, k: 0.6 })],
    actors: [A(L, 'read', 0.36, 44, { y: 0.92, face: 'r' }), A(F, 'idle', 0.64, 42, { y: 0.9, face: 'l' })],
    crowd: [],
    fx: [{ kind: 'wisps', n: 6, colour: '#ffe9a0' }],
  },
  // the new machine at work, steam and sparks, the town looking on
  machine: {
    back: 'industrial_day',
    props: [P('crate', 0.7, 0.95), P('crate', 0.76, 0.95, { k: 0.8 }), P('tools', 0.84, 0.95)],
    actors: [A(L, 'work', 0.5, 44, { y: 0.93, face: 'r' }), A('robot_infantry', 'idle', 0.62, 40, { y: 0.93, face: 'l' })],
    crowd: [C(5, [0.06, 0.38], [0.9, 0.98], 40, 'r')],
    fx: [{ kind: 'steam', n: 8, at: [0.62, 0.55], colour: '#e8eef2' }, { kind: 'sparks', n: 10, at: [0.56, 0.82], colour: '#ffb84a' }],
  },
  // a stall, the merchant behind it, the townsfolk at the goods
  market: {
    back: 'summer_1',
    props: [P('stall', 0.56, 0.95), P('crate', 0.44, 0.96, { k: 0.8 }), P('apple', 0.44, 0.84, { z: 0.97, k: 0.7 }), P('cask', 0.72, 0.96), P('bread', 0.54, 0.96, { z: 0.97, k: 0.6 })],
    actors: [A(M, 'talk', 0.62, 44, { y: 0.97, face: 'l' }), A(L, 'idle', 0.4, 44, { y: 0.96, face: 'r' })],
    speaker: 0,
    crowd: [C(4, [0.04, 0.22], [0.9, 0.97], 40, 'r'), C(3, [0.84, 0.97], [0.9, 0.97], 40, 'l')],
    fx: [{ kind: 'birds', n: 2 }],
  },

  /* ------------------------------------------------------------ at the gate and on the road */
  // the gate, the guard at it, a stranger come up the road asking in
  gate: {
    back: 'summer_5',
    props: [P('gate', 0.22, 0.95, { k: 1.25 })],
    actors: [A(K, 'idle', 0.38, 44, { y: 0.96, face: 'r' }), A(S, 'walk', [0.95, 0.68], 44, { y: 0.95 }), A(F, 'idle', 0.5, 42, { y: 0.97, face: 'r' })],
    speaker: 1,
    fx: [{ kind: 'dust', n: 6, at: [0.75, 0.97] }, { kind: 'birds', n: 2 }],
  },
  // a weary band at the gate with everything they own on a cart
  refugees: {
    back: 'autumn_2',
    tint: ['#202030', 0.15],
    props: [P('gate', 0.18, 0.95), P('handcart', 0.86, 0.95), P('crate', 0.95, 0.96, { k: 0.7 })],
    actors: [A(K, 'idle', 0.34, 44, { y: 0.95, face: 'r' }), A(S, 'talk', 0.5, 42, { y: 0.94, face: 'l' }), A(S2, 'idle', 0.62, 40, { y: 0.92, face: 'l' }), A(S3, 'kneel', 0.72, 38, { y: 0.96, face: 'l' }), A(F, 'idle', 0.08, 42, { y: 0.97, face: 'r' })],
    speaker: 1,
    fx: [{ kind: 'leaves', n: 8 }, { kind: 'mist', n: 2, colour: '#a0a0b0' }],
  },
  // a herald under a banner before the founder and the elders
  envoy: {
    back: 'summer_2',
    props: [P('gate', 0.16, 0.93, { k: 1.1 }), P('banner_red', 0.82, 0.7), P('banner_red', 0.94, 0.72), P('horse', 0.97, 0.96)],
    actors: [A(K, 'talk', 0.66, 46, { y: 0.94, face: 'l' }), A(S, 'idle', 0.78, 42, { y: 0.92, face: 'l' }), A(F, 'idle', 0.34, 46, { y: 0.94, face: 'r' }), A(E1, 'idle', 0.22, 42, { y: 0.91, face: 'r' }), A(E2, 'idle', 0.14, 42, { y: 0.96, face: 'r' })],
    speaker: 0,
    crowd: [C(3, [0.02, 0.1], [0.9, 0.95], 38, 'r')],
    fx: [{ kind: 'birds', n: 3 }],
  },
  // a laden wagon pulled up, barrels and crates, the merchant at their wares
  caravan: {
    back: 'oasis_1',
    props: [P('wagon', 0.68, 0.95), P('cask', 0.86, 0.96), P('cask', 0.92, 0.96, { k: 0.85 }), P('crate', 0.52, 0.97, { k: 0.85 }), P('horse', 0.94, 0.88, { flip: true })],
    actors: [A(M, 'talk', 0.48, 44, { y: 0.95, face: 'l' }), A(F, 'idle', 0.3, 44, { y: 0.95, face: 'r' }), A(L, 'idle', 0.2, 42, { y: 0.92, face: 'r' })],
    speaker: 0,
    crowd: [C(3, [0.02, 0.14], [0.9, 0.97], 40, 'r')],
    fx: [{ kind: 'dust', n: 12 }, { kind: 'birds', n: 2 }],
  },
  // a cloaked figure by lamplight among the crates, making an offer
  shady: {
    back: 'moon_2',
    tint: ['#0a1030', 0.35],
    props: [P('crate', 0.74, 0.95), P('crate', 0.8, 0.95, { k: 0.8 }), P('cask', 0.86, 0.95), P('lantern', 0.52, 0.96)],
    actors: [A(S, 'talk', 0.62, 44, { y: 0.94, face: 'l' }), A(L, 'idle', 0.38, 44, { y: 0.94, face: 'r' })],
    speaker: 0,
    fx: [{ kind: 'fireflies', n: 6, at: [0.52, 0.8], colour: '#ffcf70' }, { kind: 'bats', n: 2 }],
  },
  // the party on the road
  road: {
    back: 'summer_4',
    scroll: -12,
    props: [],
    actors: [A(L, 'walk', [0.5, 0.5], 46, { y: 0.94 }), A(E1, 'walk', [0.36, 0.36], 42, { y: 0.9 }), A(E2, 'walk', [0.24, 0.24], 42, { y: 0.96 })],
    fx: [{ kind: 'dust', n: 10 }, { kind: 'birds', n: 3 }],
  },

  /* ------------------------------------------------------------ danger */
  // the palisade, a lookout on the gate pointing, smoke on the horizon
  raid_warning: {
    back: 'summer_5',
    tint: ['#401808', 0.18],
    props: [P('gate', 0.5, 0.97), ...row('fence', 0.06, 0.34, 0.07, 0.98), ...row('fence', 0.66, 0.94, 0.07, 0.98)],
    actors: [A(K, 'shoot', 0.5, 36, { y: 0.47, face: 'r' }), A(F, 'idle', 0.24, 44, { y: 0.93, face: 'r' }), A(L, 'idle', 0.76, 42, { y: 0.92, face: 'r' })],
    fx: [{ kind: 'smoke', n: 9, at: [0.9, 0.5], colour: '#3a3a3a' }, { kind: 'smoke', n: 6, at: [0.75, 0.52], colour: '#4a4a4a' }, { kind: 'embers', n: 6, at: [0.88, 0.58], colour: '#ff7a2a' }, { kind: 'birds', n: 4 }],
  },
  // the townsfolk at the fence fighting off the raiders
  battle: {
    back: 'battle_ruins',
    props: [P('fence', 0.5, 0.97), P('fence', 0.56, 0.97)],
    actors: [A(F, 'attack', 0.38, 46, { y: 0.93 }), A(L, 'attack', 0.26, 44, { y: 0.9 }), A(E1, 'shoot', 0.12, 42, { y: 0.95 }), A('hk_orc_grunt', 'attack', 0.66, 44, { y: 0.93, face: 'l' }), A('hk_orc_brute', 'walk', [1.1, 0.78], 48, { y: 0.9, face: 'l' })],
    fx: [{ kind: 'sparks', n: 12, at: [0.52, 0.72], colour: '#fff4c0' }, { kind: 'dust', n: 12, at: [0.5, 0.96] }],
  },
  // something out of the trees at the edge of the pens, the hunters with bows drawn
  beast: {
    back: 'forest_2',
    tint: ['#102418', 0.18],
    props: [P('tree', 0.92, 0.97, { k: 0.8 }), P('fence', 0.06, 0.95), P('fence', 0.16, 0.95), P('sheep', 0.1, 0.92, { flip: true })],
    actors: [A(L, 'shoot', 0.32, 44, { y: 0.94, face: 'r' }), A(K, 'shoot', 0.2, 42, { y: 0.97, face: 'r' }), A('werewolf_black', 'walk', [1.05, 0.72], 50, { y: 0.94, face: 'l' })],
    crowd: [C(2, [0.4, 0.48], [0.88, 0.9], 38, 'r')],
    fx: [{ kind: 'leaves', n: 8 }, { kind: 'mist', n: 2, colour: '#6fa97a' }],
  },
  // a great winged shadow over the hills, the town looking up
  dragon: {
    back: 'peaks_2',
    tint: ['#401000', 0.2],
    props: [P('house', 0.12, 0.96, { k: 0.7 })],
    actors: [A('hk_demon_lord', 'walk', [1.15, 0.55], 34, { y: 0.4, face: 'l', bob: 6 }), A(L, 'shoot', 0.36, 44, { y: 0.94, face: 'r' })],
    crowd: [C(6, [0.46, 0.96], [0.92, 0.98], 40, 'r')],
    fx: [{ kind: 'embers', n: 12, colour: '#ff7a2a' }, { kind: 'smoke', n: 5, at: [0.7, 0.5], colour: '#3a3a3a' }, { kind: 'flash', n: 1, colour: '#ffb060' }],
  },
  // a house afire, flames on the roof, the bucket line passing water up from the trough
  fire: {
    back: 'summer_1',
    tint: ['#401000', 0.28],
    props: [P('house', 0.7, 0.96, { k: 1.1 }), P('fire', 0.58, 0.6, { k: 2 }), P('fire', 0.7, 0.5, { k: 2.4 }), P('fire', 0.82, 0.6, { k: 1.9 }), P('fire', 0.62, 0.97, { k: 1.2 }), P('tub', 0.04, 0.97), P('bucket', 0.22, 0.99), P('bucket', 0.34, 0.99)],
    actors: [A(L, 'work', 0.48, 44, { y: 0.96, face: 'r' })],
    crowd: [C(4, [0.08, 0.42], [0.95, 0.95], 40, 'r', 'work', 1)],
    fx: [{ kind: 'smoke', n: 10, at: [0.66, 0.4], colour: '#2a2a2a' }, { kind: 'embers', n: 18, at: [0.66, 0.6], colour: '#ff8a3a' }, { kind: 'ash', n: 8 }],
  },
  // rain driving, the wind at the hay, folk running for the house
  storm: {
    back: 'skies_4',
    tint: ['#0a1020', 0.35],
    props: [P('house', 0.16, 0.96, { k: 0.85 }), P('haystack', 0.8, 0.96), P('cask', 0.62, 0.97)],
    actors: [A(L, 'walk', [0.85, 0.3], 44, { y: 0.95 }), A(E1, 'walk', [1.0, 0.45], 40, { y: 0.92, phase: 0.3 })],
    crowd: [C(2, [0.26, 0.32], [0.94, 0.97], 38, 'r')],
    fx: [{ kind: 'rain', n: 70 }, { kind: 'leaves', n: 10 }, { kind: 'flash', n: 1, colour: '#e0f0ff' }],
  },
  // the ground jolting, rocks down, folk cowering
  quake: {
    back: 'abandoned_3',
    tint: ['#2a1a08', 0.2],
    shake: 2,
    props: [P('house', 0.78, 0.97, { k: 0.85 }), P('rock', 0.4, 0.97), P('rock', 0.52, 0.98, { k: 0.7 }), P('rock', 0.6, 0.96, { k: 1.2 })],
    actors: [A(L, 'idle', 0.26, 44, { y: 0.94, face: 'r' })],
    crowd: [C(4, [0.06, 0.2], [0.92, 0.97], 40, 'r', 'kneel')],
    fx: [{ kind: 'dust', n: 26 }, { kind: 'smoke', n: 5, at: [0.78, 0.6], colour: '#a89878' }],
  },
  // the cold: the town huddled round a fire in the snow
  winter: {
    back: 'winter_1',
    props: [P('house', 0.86, 0.96, { k: 0.85 }), P('fire', 0.46, 0.95, { k: 0.9 }), P('lantern', 0.7, 0.96)],
    actors: [A(L, 'idle', 0.34, 42, { y: 0.94, face: 'r' }), A(F, 'idle', 0.58, 42, { y: 0.94, face: 'l' })],
    crowd: [C(3, [0.2, 0.3], [0.9, 0.92], 38, 'r'), C(2, [0.62, 0.7], [0.9, 0.92], 38, 'l')],
    fx: [{ kind: 'snow', n: 50 }, { kind: 'smoke', n: 5, at: [0.46, 0.8], colour: '#cfcfcf' }, { kind: 'embers', n: 6, at: [0.46, 0.92], colour: '#ff9a3a' }],
  },
  // the sun hard on dry ground, the well down to mud, a bucket come up empty
  drought: {
    back: 'oasis_3',
    tint: ['#603000', 0.2],
    props: [P('well', 0.5, 0.95), P('bucket', 0.6, 0.97), P('rock', 0.14, 0.95), P('rock', 0.9, 0.96, { k: 0.7 })],
    actors: [A(L, 'kneel', 0.42, 42, { y: 0.96, face: 'r' })],
    crowd: [C(4, [0.66, 0.94], [0.9, 0.96], 40, 'l')],
    fx: [{ kind: 'dust', n: 20 }],
  },
  // a bare table, empty bowls, thin folk sat before them
  famine: {
    back: 'set:cottage',
    tint: ['#101010', 0.35],
    props: [P('long_table', 0.52, 0.9, { k: 1.2 }), P('bowl', 0.4, 0.7, { z: 0.91, k: 0.7 }), P('bowl', 0.52, 0.7, { z: 0.91, k: 0.7 }), P('bowl', 0.64, 0.7, { z: 0.91, k: 0.7 }), P('candle', 0.88, 0.9, { k: 0.7 })],
    actors: [A(F, 'talk', 0.14, 42, { y: 0.9, face: 'r' })],
    speaker: 0,
    crowd: [C(5, [0.3, 0.74], [0.84, 0.84], 38, 'f', undefined, 1)],
    fx: [],
  },
  // sickbeds, a healer going between them, someone kneeling by a bed
  plague: {
    back: 'set:cottage',
    tint: ['#1c3010', 0.25],
    props: [P('sickbed', 0.22, 0.9, { k: 0.85 }), P('sickbed', 0.5, 0.9, { k: 0.85 }), P('bed', 0.8, 0.9, { k: 0.8 }), P('bucket', 0.36, 0.95), P('candle', 0.64, 0.9, { k: 0.7 })],
    actors: [A(PR, 'work', 0.62, 44, { y: 0.96, face: 'l' }), A(L, 'kneel', 0.34, 40, { y: 0.97, face: 'r' })],
    crowd: [C(1, [0.9, 0.96], [0.98, 0.98], 38, 'l')],
    fx: [{ kind: 'wisps', n: 6, colour: '#b6e070' }],
  },
  // the grey come over the land: ash falling, the town staring out at it
  calamity: {
    back: 'meadows_1',
    tint: ['#202020', 0.4],
    props: [P('fence', 0.08, 0.96), P('fence', 0.18, 0.96)],
    actors: [A(L, 'talk', 0.36, 44, { y: 0.94, face: 'l' })],
    speaker: 0,
    crowd: [C(5, [0.06, 0.3], [0.9, 0.97], 40, 'r'), C(3, [0.54, 0.8], [0.92, 0.96], 40, 'r')],
    fx: [{ kind: 'ash', n: 30 }, { kind: 'mist', n: 3, colour: '#8a8a8a' }],
  },

  /* ------------------------------------------------------------ the land and its work */
  // the crop in: sheaves stacked, the cart loading, everyone reaping
  harvest: {
    back: 'summer_2',
    props: [...row('crops', 0.06, 0.94, 0.11, 0.8, { k: 0.8 }), P('haystack', 0.2, 0.95), P('handcart', 0.58, 0.96), P('hay_bale', 0.84, 0.97)],
    actors: [A(L, 'work', 0.4, 44, { y: 0.94, face: 'r' })],
    crowd: [C(4, [0.62, 0.98], [0.86, 0.9], 38, 'l', 'work')],
    fx: [{ kind: 'leaves', n: 6 }, { kind: 'birds', n: 3 }],
  },
  // the pens: beasts behind the fence, the hay, someone at the trough
  farm: {
    back: 'summer_1',
    props: [...row('fence', 0.06, 0.62, 0.08, 0.84), P('cow', 0.18, 0.9), P('goat', 0.34, 0.88), P('sheep', 0.46, 0.91, { flip: true }), P('horse', 0.08, 0.86), P('hay_bale', 0.84, 0.95), P('tub', 0.68, 0.96), P('bucket', 0.62, 0.97)],
    actors: [A(L, 'work', 0.56, 44, { y: 0.95, face: 'r' }), A(E1, 'idle', 0.78, 42, { y: 0.93, face: 'l' })],
    speaker: 1,
    crowd: [C(2, [0.9, 0.98], [0.96, 0.98], 38, 'l')],
    fx: [{ kind: 'birds', n: 2 }],
  },
  // the town's well, a queue with buckets
  well: {
    back: 'summer_5',
    props: [P('well', 0.46, 0.94), P('bucket', 0.56, 0.96), P('bucket', 0.74, 0.98)],
    actors: [A(L, 'work', 0.36, 44, { y: 0.95, face: 'r' })],
    crowd: [C(4, [0.6, 0.96], [0.9, 0.96], 40, 'l')],
    fx: [{ kind: 'birds', n: 2 }],
  },
  // the mine: picks at the rock, an ore cart, a lamp
  mine: {
    back: 'crystal_2',
    tint: ['#100800', 0.3],
    props: [P('rock', 0.18, 0.96, { k: 1.4 }), P('rock', 0.86, 0.95, { k: 1.2 }), P('handcart', 0.6, 0.96), P('lantern', 0.44, 0.96), P('crate', 0.74, 0.97, { k: 0.8 })],
    actors: [A(L, 'work', 0.28, 44, { y: 0.95, face: 'l' }), A(E1, 'work', 0.78, 42, { y: 0.92, face: 'r' })],
    crowd: [],
    fx: [{ kind: 'sparks', n: 10, at: [0.22, 0.82], colour: '#ffcf5a' }, { kind: 'dust', n: 10 }],
  },
  // the shore: nets and casks on the strand, something out in the water
  sea: {
    back: 'ocean_3',
    props: [P('cask', 0.12, 0.96), P('crate', 0.2, 0.97, { k: 0.8 }), P('cask', 0.86, 0.96, { k: 0.8 })],
    actors: [A(L, 'work', 0.4, 44, { y: 0.95, face: 'r' }), A(E1, 'idle', 0.58, 42, { y: 0.94, face: 'r' })],
    crowd: [C(3, [0.66, 0.94], [0.93, 0.97], 40, 'r')],
    fx: [{ kind: 'birds', n: 6 }, { kind: 'bubbles', n: 8, at: [0.5, 0.7], colour: '#ffffff' }],
  },
  // out in the wild: a find among the trees and rocks
  wilds: {
    back: 'forest_4',
    props: [P('tree', 0.86, 0.98, { k: 0.85 }), P('rock', 0.62, 0.96), P('rock', 0.1, 0.97, { k: 0.8 })],
    actors: [A(L, 'idle', 0.5, 44, { y: 0.95, face: 'r' }), A(E1, 'walk', [0.12, 0.36], 42, { y: 0.93 })],
    fx: [{ kind: 'leaves', n: 10 }, { kind: 'fireflies', n: 8 }, { kind: 'birds', n: 2 }],
  },

  /* ------------------------------------------------------------ life and death */
  // the pair before the priest, the guests behind, petals in the air
  wedding: {
    back: 'summer_3',
    props: [P('banner_green', 0.3, 0.72), P('banner_green', 0.7, 0.72), P('bench', 0.14, 0.97), P('bench', 0.86, 0.97)],
    actors: [A(PR, 'talk', 0.5, 42, { y: 0.8, face: 'f' }), A(L, 'idle', 0.42, 44, { y: 0.9, face: 'r' }), A(E1, 'idle', 0.58, 44, { y: 0.9, face: 'l' })],
    speaker: 0,
    crowd: [C(3, [0.04, 0.26], [0.88, 0.94], 40, 'r'), C(3, [0.74, 0.96], [0.88, 0.94], 40, 'l'), AUDIENCE(4, [0.25, 0.75])],
    fx: [{ kind: 'petals', n: 18 }, { kind: 'birds', n: 3 }],
  },
  // the mother abed, the midwife at work, the cot ready
  birth: {
    back: 'set:cottage',
    tint: ['#301808', 0.15],
    props: [P('bed', 0.28, 0.9, { k: 0.9 }), P('cot', 0.62, 0.92), P('candle', 0.86, 0.9, { k: 0.7 }), P('tub', 0.44, 0.96, { k: 0.7 })],
    actors: [A(PR, 'work', 0.46, 44, { y: 0.92, face: 'l' }), A(L, 'cheer', 0.76, 44, { y: 0.93, face: 'l' })],
    crowd: [],
    fx: [{ kind: 'fireflies', n: 6, colour: '#ffe9a0' }],
  },
  // a deathbed by candlelight, the family round it
  deathbed: {
    back: 'set:cottage',
    tint: ['#0a0a18', 0.35],
    props: [P('bed', 0.32, 0.9), P('candles', 0.14, 0.88, { k: 0.8 })],
    actors: [A(L, 'kneel', 0.46, 42, { y: 0.96, face: 'l' }), A(F, 'idle', 0.6, 42, { y: 0.9, face: 'l' })],
    crowd: [C(3, [0.7, 0.94], [0.88, 0.94], 40, 'l')],
    fx: [{ kind: 'wisps', n: 4, colour: '#ffe9a0' }],
  },
  // a grave in the rain, the priest reading, mourners kneeling and standing
  funeral: {
    back: 'battle_graves',
    tint: ['#101820', 0.3],
    props: [P('coffin', 0.48, 0.97, { k: 0.8 }), P('tombstone', 0.2, 0.9), P('tombstone', 0.78, 0.88), P('cross', 0.9, 0.92, { k: 0.8 })],
    actors: [A(PR, 'read', 0.34, 44, { y: 0.94, face: 'r' })],
    speaker: 0,
    crowd: [C(3, [0.56, 0.72], [0.96, 0.98], 40, 'l', 'kneel'), C(4, [0.6, 0.94], [0.88, 0.9], 40, 'l')],
    fx: [{ kind: 'rain', n: 40 }, { kind: 'mist', n: 2, colour: '#8a9aa8' }],
  },
  // the hall's long table laden, the town sat at it, two dancing before it
  feast: {
    back: 'set:hall',
    tint: ['#402000', 0.12],
    props: [P('long_table', 0.5, 0.88, { k: 1.25 }), P('bread', 0.38, 0.67, { z: 0.89, k: 0.7 }), P('bowl', 0.47, 0.67, { z: 0.89, k: 0.7 }), P('apple', 0.55, 0.67, { z: 0.89 }), P('bread', 0.63, 0.67, { z: 0.89, k: 0.7 }), P('candles', 0.12, 0.8), P('candles', 0.88, 0.8), P('cask', 0.95, 0.96)],
    actors: [A(L, 'cheer', [0.3, 0.38], 42, { y: 0.97, face: 'r' }), A(E1, 'cheer', [0.48, 0.4], 42, { y: 0.97, face: 'l', phase: 0.5 })],
    crowd: [C(5, [0.3, 0.7], [0.8, 0.8], 38, 'f', undefined, 1), C(2, [0.08, 0.92], [0.86, 0.86], 40, 'f', 'cheer', 1)],
    fx: [{ kind: 'sparks', n: 6, at: [0.5, 0.95], colour: '#ffcf5a' }],
  },
  // the tavern: casks, a table of drinkers, a tale being told
  tavern: {
    back: 'set:cottage',
    tint: ['#402000', 0.22],
    props: [P('cask', 0.06, 0.88), P('cask', 0.13, 0.88), P('cask', 0.095, 0.73, { z: 0.881 }), P('round_table', 0.5, 0.94, { k: 1.2 }), P('bowl', 0.48, 0.82, { z: 0.95, k: 0.5 }), P('lantern', 0.3, 0.6, { back: true })],
    actors: [A(L, 'talk', 0.38, 44, { y: 0.92, face: 'r' }), A(F, 'cheer', 0.64, 42, { y: 0.92, face: 'l' })],
    speaker: 0,
    crowd: [C(4, [0.72, 0.96], [0.86, 0.95], 40, 'l')],
    fx: [{ kind: 'fireflies', n: 5, colour: '#ffcf70' }],
  },
  // a bonfire on the green, banners and a stall, the town dancing round it
  festival: {
    back: 'summer_3',
    tint: ['#402000', 0.1],
    props: [P('fire', 0.5, 0.95, { k: 1.4 }), P('banner_red', 0.16, 0.72), P('banner_green', 0.84, 0.72), P('stall', 0.9, 0.95, { k: 0.7 }), P('cask', 0.08, 0.96)],
    actors: [A(L, 'cheer', [0.32, 0.38], 44, { y: 0.95, face: 'r' }), A(E1, 'cheer', [0.68, 0.62], 42, { y: 0.95, face: 'l', phase: 0.5 })],
    crowd: [C(6, [0.12, 0.88], [0.86, 0.88], 38, 'f', 'cheer')],
    fx: [{ kind: 'embers', n: 12, at: [0.5, 0.88], colour: '#ff9a3a' }, { kind: 'petals', n: 8 }],
  },

  /* ------------------------------------------------------------ faith and the strange */
  // the shrine: the priest raised up in the light, the town on its knees
  miracle: {
    back: 'temple_2',
    tint: ['#fff0a0', 0.1],
    props: [P('candles', 0.34, 0.86), P('candles', 0.66, 0.86)],
    actors: [A(PR, 'cheer', 0.5, 46, { y: 0.86, face: 'f' }), A(L, 'idle', 0.4, 42, { y: 0.9, face: 'r' })],
    crowd: [C(7, [0.06, 0.94], [0.94, 0.99], 40, 'b', 'kneel')],
    fx: [{ kind: 'wisps', n: 18, colour: '#fff4b0' }, { kind: 'sparks', n: 8, at: [0.5, 0.45], colour: '#ffffff' }],
  },
  // a dark rite: candles in a ring, a cloaked reader, the faithful kneeling
  cult: {
    back: 'temple_4',
    tint: ['#2a0030', 0.3],
    props: [P('fire', 0.5, 0.97, { k: 0.8 }), P('candle', 0.3, 0.94), P('candle', 0.7, 0.94), P('candle', 0.4, 0.98), P('candle', 0.6, 0.98)],
    actors: [A(S, 'read', 0.5, 44, { y: 0.88, face: 'f' })],
    speaker: 0,
    crowd: [C(3, [0.08, 0.26], [0.92, 0.96], 40, 'r', 'kneel'), C(3, [0.74, 0.92], [0.92, 0.96], 40, 'l', 'kneel')],
    fx: [{ kind: 'wisps', n: 14, colour: '#c47aff' }, { kind: 'bats', n: 2 }],
  },
  // the graveyard at night, something pale among the stones
  ghost: {
    back: 'battle_graves',
    tint: ['#0a1020', 0.4],
    props: [P('tombstone', 0.56, 0.9), P('tombstone', 0.74, 0.92), P('cross', 0.88, 0.9, { k: 0.8 }), P('lantern', 0.3, 0.96)],
    actors: [A('hk_ghost', 'idle', 0.66, 40, { y: 0.8, bob: 3, face: 'l' }), A(L, 'idle', 0.22, 44, { y: 0.95, face: 'r' })],
    crowd: [C(2, [0.06, 0.14], [0.94, 0.96], 38, 'r')],
    fx: [{ kind: 'mist', n: 3, colour: '#8a9aa8' }, { kind: 'wisps', n: 8, colour: '#9ad8ff' }],
  },
  // a sign in the sky, the town out looking up at it, one pointing
  omen: {
    back: 'moon_3',
    props: [],
    actors: [A(L, 'shoot', 0.3, 44, { y: 0.94, face: 'r' })],
    speaker: 0,
    crowd: [C(7, [0.4, 0.82], [0.9, 0.97], 40, 'r')],
    fx: [{ kind: 'wisps', n: 10, colour: '#9ab8ff' }, { kind: 'fireflies', n: 16, colour: '#ffffff' }, { kind: 'flash', n: 1, colour: '#cfe0ff' }],
  },
  // the alchemist's bench: something bubbling, coloured smoke, a watcher at a safe distance
  magic: {
    back: 'set:cottage',
    tint: ['#200830', 0.3],
    props: [P('table', 0.44, 0.93), P('candles', 0.44, 0.8, { z: 0.94, k: 0.6 }), P('shelf', 0.86, 0.9, { k: 0.8 }), P('shelf', 0.12, 0.9, { k: 0.8 }), P('cask', 0.66, 0.93, { k: 0.7 })],
    actors: [A(L, 'work', 0.34, 44, { y: 0.92, face: 'r' }), A(E1, 'idle', 0.74, 42, { y: 0.92, face: 'l' })],
    fx: [{ kind: 'bubbles', n: 12, at: [0.44, 0.76], colour: '#8aff7a' }, { kind: 'smoke', n: 6, at: [0.44, 0.68], colour: '#c47aff' }, { kind: 'sparks', n: 6, at: [0.42, 0.8], colour: '#7aeaff' }],
  },
};

/** The old guessed families, for whatever names no scene of its own (a saga's question, a people's own). */
const FAMILY_SCENE: Record<EventFamily, EventSceneId> = {
  raid: 'raid_warning', stranger: 'gate', plague: 'plague', storm: 'storm', feast: 'feast', envoy: 'envoy', miracle: 'miracle', cult: 'cult',
  death: 'funeral', war: 'battle', trade: 'caravan', wild: 'beast', omen: 'omen', road: 'road', council: 'council', generic: 'home',
};

/** What the card needs to know to pick its scene: the prompt's kind and words, the event's id when it's a choice
 *  event, and a question of the town's politics or a daughter village's. */
export interface SceneAsk {
  kind: string;
  title: string;
  text: string;
  eventId?: string | null;
  about?: string | null;
}

/** A pattern for an event's title or telling as put to the player: {who} and {founder} filled with any name, a fateful
 *  event's mark before it, anything after it (the cost said after the telling). */
const pattern = (t: string, head = '') => new RegExp(`^${head}${t.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(who|founder)\}/g, '.+?')}`);
let byWords: { def: EventDef; title: RegExp; text: RegExp }[] | null = null;
/** The choice event a question was put from, known by its words (when the snapshot didn't name it: two events open at
 *  once, only the newest is named). */
export function eventByWords(title: string, text: string): EventDef | undefined {
  byWords ??= EVENTS.map((def) => ({ def, title: pattern(def.title, '(?:⚡ )?'), text: pattern(def.text) }));
  const hits = byWords.filter((e) => e.title.test(title));
  return hits.length > 1 ? (hits.find((e) => e.text.test(text)) ?? hits[0]).def : hits[0]?.def;
}

/** The scene for a question on the event card. */
export function sceneFor(p: SceneAsk): EventSceneId {
  const def = p.eventId ? EVENT_BY_ID[p.eventId] : p.kind === 'event' ? eventByWords(p.title, p.text) : undefined;
  if (def?.scene) return def.scene;
  switch (p.kind) {
    case 'council': return p.about === 'trial' ? 'trial' : p.about === 'revolt' ? 'revolt' : 'council';
    case 'trial': return 'trial';
    case 'revolt': return 'revolt';
    case 'envoy': return 'envoy';
    case 'refugees': return 'refugees';
    case 'dragon': return 'dragon';
    case 'enemy': return 'raid_warning';
    case 'watch': return 'battle';
    case 'road': return 'road';
    // (a party's result is told on the road home; the year's chronicle at the chronicler's desk)
    case 'debrief': return /chronicle/i.test(p.title) ? 'study' : 'road';
    case 'village': return p.about === 'beset' ? 'raid_warning' : 'leaving';
    case 'secret': return 'gate';
  }
  return FAMILY_SCENE[eventFamily(p.kind, p.title, p.text)];
}
