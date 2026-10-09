// The game's own music (the owner's ask: more music, not always the same two songs). Pure: `PIECES` are the pieces
// (each a key, a mode, a tempo, a chord plan and its instruments), and `compose(piece, seed)` writes one out as notes
// (beats from the start, length in beats, MIDI pitch, instrument, loudness), different every time it's played but always
// the same piece: an A section, its repeat, a B section and the A again (twice over, the second time varied), the
// melody built from a motif that comes back. musicGen.ts plays it with Web Audio; music.ts picks what to play by mood.

export type Instrument = 'flute' | 'pluck' | 'harp' | 'bell' | 'pad' | 'organ' | 'brass' | 'bass' | 'kick' | 'snare' | 'hat' | 'tambour';
export type Mood = 'day' | 'night' | 'winter' | 'dark' | 'feast' | 'battle' | 'boss' | 'sea' | 'heroic';

export interface Piece {
  id: string;
  name: string;
  moods: Mood[];
  /** The key's root (MIDI), the mode's steps, beats a minute and beats a bar. */
  root: number;
  mode: number[];
  bpm: number;
  meter: 3 | 4;
  /** Scale degrees for the A section's four bars and the B section's. */
  a: number[];
  b: number[];
  lead: Instrument;
  /** What plays under the melody: broken chords, held chords, or a held root. */
  comp: 'arp' | 'chords' | 'drone' | 'strum';
  compInst: Instrument;
  drums: 'none' | 'light' | 'march' | 'heavy';
  /** How busy the melody is (0 sparse .. 1 busy). */
  busy: number;
}

const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];

export const PIECES: readonly Piece[] = [
  { id: 'morning', name: 'Morning in the Valley', moods: ['day'], root: 60, mode: IONIAN, bpm: 92, meter: 4, a: [0, 5, 3, 4], b: [5, 3, 0, 4], lead: 'flute', comp: 'arp', compInst: 'harp', drums: 'none', busy: 0.5 },
  { id: 'market', name: 'Market Day', moods: ['day', 'feast'], root: 62, mode: MIXOLYDIAN, bpm: 112, meter: 4, a: [0, 6, 3, 0], b: [3, 6, 4, 0], lead: 'pluck', comp: 'strum', compInst: 'pluck', drums: 'light', busy: 0.7 },
  { id: 'oldroad', name: 'The Old Road', moods: ['day'], root: 57, mode: DORIAN, bpm: 84, meter: 4, a: [0, 3, 0, 4], b: [2, 3, 6, 4], lead: 'flute', comp: 'arp', compInst: 'harp', drums: 'none', busy: 0.45 },
  { id: 'hearth', name: 'Hearthsong', moods: ['day', 'night', 'winter'], root: 65, mode: IONIAN, bpm: 76, meter: 3, a: [0, 3, 4, 0], b: [5, 1, 4, 4], lead: 'bell', comp: 'chords', compInst: 'pad', drums: 'none', busy: 0.35 },
  { id: 'fields', name: 'Fields of Gold', moods: ['day'], root: 55, mode: IONIAN, bpm: 100, meter: 4, a: [0, 4, 5, 3], b: [3, 0, 3, 4], lead: 'pluck', comp: 'arp', compInst: 'harp', drums: 'light', busy: 0.55 },
  { id: 'jig', name: 'The Merry Jig', moods: ['feast'], root: 67, mode: IONIAN, bpm: 132, meter: 3, a: [0, 4, 0, 4], b: [3, 0, 4, 0], lead: 'flute', comp: 'strum', compInst: 'pluck', drums: 'march', busy: 0.85 },
  { id: 'starlight', name: 'Starlight', moods: ['night'], root: 64, mode: AEOLIAN, bpm: 64, meter: 4, a: [0, 5, 3, 6], b: [5, 6, 0, 4], lead: 'bell', comp: 'chords', compInst: 'pad', drums: 'none', busy: 0.3 },
  { id: 'watch', name: 'The Long Watch', moods: ['night'], root: 62, mode: DORIAN, bpm: 70, meter: 4, a: [0, 3, 0, 6], b: [3, 4, 3, 0], lead: 'flute', comp: 'drone', compInst: 'pad', drums: 'none', busy: 0.35 },
  { id: 'frost', name: 'Frost Hollow', moods: ['winter', 'night'], root: 59, mode: AEOLIAN, bpm: 72, meter: 4, a: [0, 2, 5, 4], b: [5, 3, 0, 4], lead: 'bell', comp: 'arp', compInst: 'harp', drums: 'none', busy: 0.4 },
  { id: 'snowfall', name: 'Snowfall', moods: ['winter'], root: 62, mode: LYDIAN, bpm: 80, meter: 3, a: [0, 1, 0, 4], b: [5, 1, 3, 4], lead: 'flute', comp: 'chords', compInst: 'pad', drums: 'none', busy: 0.4 },
  { id: 'waltz', name: 'The Crypt Waltz', moods: ['dark'], root: 57, mode: HARMONIC, bpm: 88, meter: 3, a: [0, 3, 4, 0], b: [5, 3, 4, 4], lead: 'organ', comp: 'strum', compInst: 'pluck', drums: 'none', busy: 0.5 },
  { id: 'bloodmoon', name: 'Blood Moon', moods: ['dark', 'night'], root: 52, mode: PHRYGIAN, bpm: 68, meter: 4, a: [0, 1, 0, 6], b: [5, 1, 3, 0], lead: 'bell', comp: 'drone', compInst: 'organ', drums: 'none', busy: 0.3 },
  { id: 'steel', name: 'Steel and Fire', moods: ['battle'], root: 50, mode: HARMONIC, bpm: 140, meter: 4, a: [0, 5, 3, 4], b: [5, 3, 1, 4], lead: 'brass', comp: 'arp', compInst: 'pluck', drums: 'heavy', busy: 0.75 },
  { id: 'charge', name: 'The Charge', moods: ['battle'], root: 57, mode: AEOLIAN, bpm: 150, meter: 4, a: [0, 6, 5, 4], b: [3, 4, 5, 4], lead: 'brass', comp: 'strum', compInst: 'pluck', drums: 'heavy', busy: 0.7 },
  { id: 'dreadlord', name: 'The Dread Lord', moods: ['boss'], root: 49, mode: PHRYGIAN, bpm: 120, meter: 4, a: [0, 1, 0, 6], b: [5, 1, 4, 4], lead: 'organ', comp: 'drone', compInst: 'pad', drums: 'heavy', busy: 0.6 },
  { id: 'tides', name: 'Tides', moods: ['sea', 'day'], root: 63, mode: LYDIAN, bpm: 80, meter: 4, a: [0, 1, 4, 0], b: [5, 1, 3, 4], lead: 'harp', comp: 'arp', compInst: 'harp', drums: 'none', busy: 0.45 },
  { id: 'banners', name: 'Banners on the Wall', moods: ['heroic', 'day'], root: 58, mode: IONIAN, bpm: 104, meter: 4, a: [0, 3, 4, 0], b: [5, 3, 1, 4], lead: 'brass', comp: 'chords', compInst: 'pad', drums: 'march', busy: 0.55 },
  { id: 'greenwood', name: 'The Greenwood', moods: ['day', 'sea'], root: 60, mode: DORIAN, bpm: 96, meter: 3, a: [0, 6, 3, 0], b: [3, 0, 6, 4], lead: 'flute', comp: 'arp', compInst: 'harp', drums: 'light', busy: 0.6 },
];
export const PIECE_BY_ID: Readonly<Record<string, Piece>> = Object.fromEntries(PIECES.map((p) => [p.id, p]));

export interface Note {
  /** When (beats from the piece's start), how long (beats), MIDI pitch, what plays it, how loud (0..1). */
  t: number;
  d: number;
  p: number;
  i: Instrument;
  v: number;
}

/** A small seeded stream (mulberry32). */
function stream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The pitch of scale step `n` (any integer) in the piece's key, from octave `oct` (MIDI). */
export function stepPitch(piece: Piece, n: number, oct = 0): number {
  const len = piece.mode.length;
  const o = Math.floor(n / len);
  const d = ((n % len) + len) % len;
  return piece.root + 12 * (o + oct) + piece.mode[d];
}

/** Rhythms for a bar of the melody (beats), by meter and busyness. */
const RHYTHMS: Record<3 | 4, number[][]> = {
  4: [[1, 1, 2], [2, 1, 1], [1, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [1.5, 0.5, 2], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1, 1, 1], [3, 1], [4]],
  3: [[1, 1, 1], [2, 1], [1, 0.5, 0.5, 1], [0.5, 0.5, 1, 1], [1.5, 0.5, 1], [3], [1, 2]],
};

/** Write a piece out: about two passes of A A B A. */
export function compose(piece: Piece, seed: number): Note[] {
  const rnd = stream(seed * 2654435761 + piece.root * 97 + piece.bpm);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const bar = piece.meter;
  const notes: Note[] = [];
  // rhythms weighted by busyness: busy pieces lean to the denser ones
  const rhythms = [...RHYTHMS[bar]].sort((x, y) => y.length - x.length);
  const rhythm = () => rhythms[Math.min(rhythms.length - 1, Math.floor(rnd() * rhythms.length * (1.2 - piece.busy)))];
  // a phrase of two bars over two chords: notes walk the scale, landing on the chord on the strong beats
  const phrase = (chords: number[], start: number, ending: boolean): { t: number; d: number; n: number }[] => {
    const out: { t: number; d: number; n: number }[] = [];
    let n = chords[0] + pick([0, 2, 4]);
    for (let b = 0; b < chords.length; b++) {
      let t = 0;
      for (const d of rhythm()) {
        const strong = t === 0 || (bar === 4 && t === 2);
        if (strong) {
          // the nearest chord tone
          const tones = [0, 2, 4].map((k) => chords[b] + k);
          const near = tones.flatMap((x) => [x - 7, x, x + 7]).sort((p, q) => Math.abs(p - n) - Math.abs(q - n))[0];
          n = near;
        } else n += pick([-2, -1, -1, 1, 1, 2, 0]);
        n = Math.max(-2, Math.min(11, n));
        out.push({ t: start + b * bar + t, d, n });
        t += d;
      }
    }
    if (ending) {
      const last = out[out.length - 1];
      last.n = chords[chords.length - 1] === 0 ? 7 : last.n;
    }
    return out;
  };
  const section = (plan: number[], at: number, motif: { t: number; d: number; n: number }[] | null, vary: boolean, ending: boolean) => {
    const first = motif ?? phrase(plan.slice(0, 2), 0, false);
    // the motif, then an answer over the second two chords
    for (const m of first) notes.push({ t: at + m.t, d: m.d * 0.95, p: stepPitch(piece, m.n + (vary && rnd() < 0.25 ? pick([-1, 1]) : 0), 0), i: piece.lead, v: 0.55 });
    const answer = phrase(plan.slice(2, 4), 0, ending);
    for (const m of answer) notes.push({ t: at + 2 * bar + m.t, d: m.d * 0.95, p: stepPitch(piece, m.n, 0), i: piece.lead, v: 0.5 });
    // underneath: the chords and the bass
    plan.forEach((deg, k) => accompany(piece, deg, at + k * bar, notes, rnd));
    return first;
  };
  let at = 0;
  for (let pass = 0; pass < 2; pass++) {
    const motifA = section(piece.a, at, null, false, false);
    at += 4 * bar;
    section(piece.a, at, motifA, pass === 1, true);
    at += 4 * bar;
    section(piece.b, at, null, false, false);
    at += 4 * bar;
    section(piece.a, at, motifA, true, true);
    at += 4 * bar;
  }
  // a last held chord
  for (const k of [0, 2, 4]) notes.push({ t: at, d: bar * 1.5, p: stepPitch(piece, k, -1), i: piece.compInst === 'pluck' ? 'harp' : piece.compInst, v: 0.35 });
  notes.push({ t: at, d: bar * 1.5, p: stepPitch(piece, 0, -2), i: 'bass', v: 0.5 });
  return notes.sort((x, y) => x.t - y.t);
}

/** A bar of accompaniment: the comp over chord `deg`, the bass, the drums. */
function accompany(piece: Piece, deg: number, at: number, notes: Note[], rnd: () => number): void {
  const bar = piece.meter;
  const chord = [0, 2, 4].map((k) => stepPitch(piece, deg + k, -1));
  switch (piece.comp) {
    case 'arp': {
      const order = rnd() < 0.5 ? [0, 1, 2, 1] : [0, 2, 1, 2];
      for (let k = 0; k < bar * 2; k++) notes.push({ t: at + k * 0.5, d: 0.9, p: chord[order[k % order.length]] + (k >= bar * 2 - 2 && rnd() < 0.3 ? 12 : 0), i: piece.compInst, v: 0.28 });
      break;
    }
    case 'chords':
      for (const p of chord) notes.push({ t: at, d: bar * 0.98, p, i: piece.compInst, v: 0.22 });
      break;
    case 'drone':
      notes.push({ t: at, d: bar * 0.98, p: chord[0], i: piece.compInst, v: 0.24 }, { t: at, d: bar * 0.98, p: chord[2], i: piece.compInst, v: 0.16 });
      break;
    case 'strum':
      for (let k = 0; k < bar; k++) if (k > 0 || bar === 3) for (const p of chord) notes.push({ t: at + k + (k === 0 ? 0 : 0), d: 0.5, p, i: piece.compInst, v: 0.2 });
      break;
  }
  const root = stepPitch(piece, deg, -2);
  notes.push({ t: at, d: bar === 3 ? 1.8 : 1.8, p: root, i: 'bass', v: 0.45 });
  if (bar === 4) notes.push({ t: at + 2, d: 1.8, p: rnd() < 0.5 ? root : root + 7, i: 'bass', v: 0.4 });
  // drums
  const hit = (t: number, i: Instrument, v: number) => notes.push({ t: at + t, d: 0.2, p: 60, i, v });
  switch (piece.drums) {
    case 'light':
      for (let k = 0; k < bar; k++) hit(k + 0.5, 'tambour', 0.18);
      break;
    case 'march':
      hit(0, 'kick', 0.5);
      for (let k = 1; k < bar; k++) hit(k, 'snare', 0.25);
      for (let k = 0; k < bar * 2; k++) hit(k * 0.5, 'hat', 0.12);
      break;
    case 'heavy':
      hit(0, 'kick', 0.7);
      hit(bar === 4 ? 2 : 1.5, 'kick', 0.6);
      if (bar === 4) hit(2.5, 'kick', 0.4);
      for (let k = 1; k < bar; k += 2) hit(k, 'snare', 0.45);
      for (let k = 0; k < bar * 2; k++) hit(k * 0.5, 'hat', 0.15);
      break;
  }
}

/** Seconds a piece lasts. */
export const pieceSeconds = (piece: Piece, notes: Note[]) => {
  const end = notes.reduce((m, n) => Math.max(m, n.t + n.d), 0);
  return (end * 60) / piece.bpm;
};

/** The pieces for a mood (the day's when there are none of its own). */
export const piecesFor = (mood: Mood): Piece[] => {
  const xs = PIECES.filter((p) => p.moods.includes(mood));
  return xs.length ? xs : PIECES.filter((p) => p.moods.includes('day'));
};
