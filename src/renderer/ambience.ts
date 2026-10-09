// The land's soundscape (the owner's ask: a huge immersive overhaul), made in the browser with the Web Audio API: there
// are no sound files to fetch. Beds of filtered noise for the wind, the rain and the river or sea, each following
// ambientMix (ambienceMix.ts); and short calls scheduled at random: birdsong by day, crickets, frogs, owls and wolves
// by night, the fire's crackle, axes, picks and hammers of whoever works in view (panned by where they stand), thunder
// after the lightning, and a war horn when a raid comes. On with the music (the ♪ button); silent while the strip is
// hidden.

import { gateContext, wake } from './audioGate';
import type { AmbientMix } from './ambienceMix';
import { ZONE_KINDS, type Animal, type ZoneKind, type ZoneMix } from './soundZones';

const MASTER = 0.55;
/** The sound effects (the cues: the hammer, the axe, blows, coins...) over the land's own sound (the owner: none were
 *  heard; a hammer peaked at the wind's level, a tenth of the music's), through a limiter so a flurry doesn't clip. */
export const CUE_GAIN = 4;
const FADE = 1.2;

/** A sound to play now: what, and where across the screen (-1 left to 1 right). */
export type Cue =
  | 'chop' | 'mine' | 'build' | 'thunder' | 'horn' | 'quack' | 'splash' | 'crunch' | 'squelch' | 'bark' | 'meow' | 'cluck' | 'roar'
  // a building coming down (main.ts: vibration.ts `collapsesBetween`)
  | 'collapse'
  // the town's life and its fights (main.ts `soundEffects`)
  | 'clash' | 'arrow' | 'thud' | 'hurt' | 'fall' | 'spell' | 'heal' | 'coin' | 'levelup' | 'chime' | 'rooster' | 'bell'
  | 'door' | 'cheer' | 'fanfare' | 'dirge' | 'rumble' | 'whoosh' | 'saw' | 'anvil' | 'gallop' | 'baby'
  // each weapon its own (sfx.ts `weaponCue`), the foes' blows, the defences
  | 'slash' | 'bash' | 'stab' | 'crossbow' | 'throw' | 'zap' | 'gunshot' | 'burst' | 'laser' | 'boom' | 'block' | 'bite'
  | 'snap' | 'ballista' | 'ult'
  // the work: each trade its own (sfx.ts `stationCue`), the fields, a tree coming down, a building finished
  | 'built' | 'timber' | 'crumble' | 'reap' | 'till' | 'loom' | 'pound' | 'bubble' | 'chisel' | 'machine' | 'page';

/** Sounds by place (soundZones.ts): how loud each zone's bus is at full level (a share of the master), so a tavern in
 *  the middle of the view sits about with the rain. */
export const ZONE_GAIN: Readonly<Record<ZoneKind, number>> = { tavern: 1.3, fiddle: 1.1, market: 1.3, hymns: 1.2, forge: 1.2, workshop: 1.1, herd: 1.3 };
/** How fast a zone's level and pan follow the view (s): a zone fades in and out as the view moves. */
const ZONE_FADE = 0.7;

export interface Ambience {
  /** Each frame: on or off, the mix, the seconds since the last, and the sounds by place (soundZones.ts). */
  update(on: boolean, mix: AmbientMix, dt: number, zones?: ZoneMix): void;
  cue(kind: Cue, pan?: number, delay?: number): void;
  /** How loud, a share of full (the ☰ menu's slider: volume.ts). */
  setLevel(level: number): void;
  /** For previews: whether the sound has started. */
  readonly running: boolean;
}

export function createAmbience(): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let cueBus: GainNode;
  let toCues = false;
  let noise: AudioBuffer;
  const beds: Record<'wind' | 'rain' | 'water' | 'fire', { gain: GainNode; filter: BiquadFilterNode } | null> = { wind: null, rain: null, water: null, fire: null };
  let t = 0;
  const due = { birds: 1, crickets: 0.5, frogs: 1, owls: 3, wolves: 6, crackle: 0.3 };
  let mixNow: AmbientMix | null = null;
  let on = false;
  let loudness = 1;
  // sounds by place: a bus each (its level and pan eased), a bed under some, calls into it, the fiddle's tune and the
  // hymns' chords scheduled ahead (soundZones.ts)
  const zoneBus = {} as Record<ZoneKind, { gain: GainNode; pan: StereoPannerNode }>;
  /** Set while a call plays into a zone's bus (`inZone`): `voice` connects there, and the bus pans it. */
  let into: AudioNode | null = null;
  const zoneDue = { laugh: 1, clink: 2, cry: 1.5, coins: 3, clang: 0.5, bellows: 2, shop: 0.8, herd: 2 };
  let zonesNow: ZoneMix | null = null;
  let fiddleAt = 0;
  let fiddleStep = 0;
  let hymnAt = 0;
  let hymnStep = 0;

  const start = (): boolean => {
    if (ctx) return true;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    gateContext(ctx);
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    cueBus = ctx.createGain();
    cueBus.gain.value = CUE_GAIN;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -12;
    limit.knee.value = 6;
    limit.ratio.value = 12;
    limit.attack.value = 0.002;
    limit.release.value = 0.15;
    cueBus.connect(limit).connect(master);
    // two seconds of white noise, looped by every bed
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    beds.wind = bed('bandpass', 380, 0.6);
    beds.rain = bed('highpass', 1400, 0.4);
    beds.water = bed('lowpass', 520, 0.5);
    beds.fire = bed('bandpass', 1800, 2);
    for (const k of ZONE_KINDS) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const pan = ctx.createStereoPanner();
      gain.connect(pan).connect(master);
      zoneBus[k] = { gain, pan };
    }
    // a room full of talk, a square full of it: noise in the voice's band, swelling and falling like speech; the
    // forge's fire roaring in its hearth
    murmur(zoneBus.tavern.gain, 650, 0.9, 3.1);
    murmur(zoneBus.market.gain, 1150, 0.8, 4.3);
    murmur(zoneBus.forge.gain, 260, 0.7, 0.6);
    // (the browser keeps the sound asleep until a touch: wake it on the next one)
    const wakeUp = () => wake(ctx);
    window.addEventListener('pointerdown', wakeUp, { passive: true });
    return true;
  };

  const bed = (type: BiquadFilterType, freq: number, q: number) => {
    const src = ctx!.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx!.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx!.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { gain, filter };
  };

  /** A bed for a place: noise in a band, its loudness swaying at `rate` (talk, a fire), into a zone's bus. */
  const murmur = (to: AudioNode, freq: number, q: number, rate: number) => {
    const src = ctx!.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx!.createGain();
    gain.gain.value = 0.09;
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx!.createGain();
    depth.gain.value = 0.05;
    lfo.connect(depth).connect(gain.gain);
    src.connect(filter).connect(gain).connect(to);
    src.start();
    lfo.start();
  };

  /** A voice: an envelope on a gain, panned, into the master (or a zone's bus, which pans it itself). */
  const voice = (pan: number, at: number) => {
    const g = ctx!.createGain();
    g.gain.value = 0;
    if (into) {
      g.connect(into);
      return { g, at };
    }
    const p = ctx!.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(toCues ? cueBus : master);
    return { g, at };
  };
  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, pan = 0, delay = 0) => {
    const at = ctx!.currentTime + delay;
    const v = voice(pan, at);
    const o = ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    o.connect(v.g);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(vol, at + Math.min(0.02, dur / 4));
    v.g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.start(at);
    o.stop(at + dur + 0.05);
    return o;
  };
  const burst = (type: BiquadFilterType, freq: number, q: number, dur: number, vol: number, pan = 0, delay = 0, attack = 0.004) => {
    const at = ctx!.currentTime + delay;
    const v = voice(pan, at);
    const src = ctx!.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(v.g);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(vol, at + attack);
    v.g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
    return f;
  };

  // the living things' calls
  const bird = () => {
    const pan = Math.random() * 1.6 - 0.8;
    const base = 2200 + Math.random() * 2400;
    const notes = 2 + Math.floor(Math.random() * 5);
    let at = 0;
    for (let i = 0; i < notes; i++) {
      const up = Math.random() < 0.5;
      const len = 0.05 + Math.random() * 0.1;
      tone('sine', base * (up ? 0.85 : 1.15), base * (up ? 1.2 : 0.8), len, 0.05, pan, at);
      at += len + 0.03 + Math.random() * 0.06;
    }
  };
  const cricket = () => {
    const pan = Math.random() * 1.8 - 0.9;
    const f = 4200 + Math.random() * 800;
    for (let i = 0; i < 3; i++) tone('sine', f, f, 0.035, 0.018, pan, i * 0.06);
  };
  const frog = () => {
    const pan = Math.random() * 1.4 - 0.7;
    const f = 180 + Math.random() * 140;
    tone('square', f, f * 0.8, 0.12, 0.02, pan);
    tone('square', f * 1.05, f * 0.85, 0.1, 0.016, pan, 0.16);
  };
  const owl = () => {
    const pan = Math.random() * 1.4 - 0.7;
    tone('sine', 410, 380, 0.35, 0.05, pan);
    tone('sine', 420, 360, 0.6, 0.05, pan, 0.55);
  };
  const howl = () => {
    const pan = Math.random() * 1.6 - 0.8;
    const at = ctx!.currentTime;
    const v = voice(pan, at);
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    const f = ctx!.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    o.connect(f).connect(v.g);
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx!.createGain();
    depth.gain.value = 9;
    lfo.connect(depth).connect(o.frequency);
    o.frequency.setValueAtTime(330, at);
    o.frequency.linearRampToValueAtTime(560, at + 0.7);
    o.frequency.linearRampToValueAtTime(520, at + 2.2);
    o.frequency.linearRampToValueAtTime(380, at + 2.9);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(0.035, at + 0.5);
    v.g.gain.linearRampToValueAtTime(0.03, at + 2.3);
    v.g.gain.exponentialRampToValueAtTime(0.0001, at + 3);
    o.start(at);
    lfo.start(at);
    o.stop(at + 3.1);
    lfo.stop(at + 3.1);
  };
  const crackle = (vol: number) => burst('highpass', 2500, 1, 0.03 + Math.random() * 0.04, 0.05 * vol, Math.random() * 0.4 - 0.2);

  // ---- sounds by place (soundZones.ts): each played into its zone's bus, which sets how loud and where
  const inZone = (k: ZoneKind, fn: () => void) => {
    into = zoneBus[k].gain;
    try {
      fn();
    } finally {
      into = null;
    }
  };
  /** A laugh from the tavern: a few falling "ha"s. */
  const laugh = () => {
    const f = 180 + Math.random() * 160;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      tone('sawtooth', f * (1.15 - i * 0.05), f * (1 - i * 0.06), 0.11, 0.022, 0, i * 0.15);
      burst('bandpass', f * 3.2, 4, 0.1, 0.012, 0, i * 0.15, 0.01);
    }
  };
  /** Mugs knocked together, a glass set down. */
  const clink = () => {
    const f = 2500 + Math.random() * 900;
    tone('sine', f, f * 0.995, 0.25, 0.025, 0);
    tone('sine', f * 1.34, f * 1.33, 0.18, 0.012, 0, 0.04);
    if (Math.random() < 0.5) tone('sine', 150, 90, 0.08, 0.04, 0, 0.3);
  };
  /** A hawker's cry: a voice gliding up and down through a vowel. */
  const cry = () => {
    const at = ctx!.currentTime;
    const v = voice(0, at);
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    const f = ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 850 + Math.random() * 300;
    f.Q.value = 3;
    const p = 190 + Math.random() * 120;
    o.frequency.setValueAtTime(p, at);
    o.frequency.linearRampToValueAtTime(p * 1.5, at + 0.25);
    o.frequency.linearRampToValueAtTime(p * 1.3, at + 0.55);
    o.frequency.linearRampToValueAtTime(p * 0.9, at + 0.9);
    o.connect(f).connect(v.g);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(0.03, at + 0.06);
    v.g.gain.setValueAtTime(0.03, at + 0.75);
    v.g.gain.exponentialRampToValueAtTime(0.0001, at + 0.95);
    o.start(at);
    o.stop(at + 1);
  };
  /** Coins counted onto a board. */
  const coins = () => {
    for (let i = 0; i < 4; i++) {
      const f = 3000 + Math.random() * 1800;
      tone('sine', f, f, 0.12, 0.012, 0, i * 0.09 + Math.random() * 0.03);
    }
  };
  /** The smith at the anvil: a ringing clang, another, and the little tap between. */
  const clang = () => {
    const f = 1250 + Math.random() * 250;
    for (const [at, vol] of [
      [0, 0.05],
      [0.42, 0.045],
      [0.62, 0.015],
    ] as const) {
      tone('triangle', f, f * 0.995, 0.7, vol, 0, at);
      tone('sine', f * 2.7, f * 2.7, 0.35, vol * 0.35, 0, at);
      burst('highpass', 4200, 1, 0.025, vol, 0, at, 0.001);
    }
  };
  /** The bellows: a long breath into the fire. */
  const bellows = () => {
    const f = burst('lowpass', 500, 0.8, 1.1, 0.06, 0, 0, 0.4);
    f.frequency.setValueAtTime(300, ctx!.currentTime);
    f.frequency.linearRampToValueAtTime(900, ctx!.currentTime + 0.6);
  };
  /** A workshop at it: a saw, a mallet, a clatter. */
  const shopWork = () => {
    const r = Math.random();
    if (r < 0.4) for (let i = 0; i < 3; i++) burst('bandpass', i % 2 ? 1500 : 1200, 3, 0.2, 0.05, 0, i * 0.24, 0.05);
    else if (r < 0.75)
      for (let i = 0; i < 3; i++) {
        tone('sine', 230, 150, 0.06, 0.05, 0, i * 0.2);
        burst('bandpass', 1200, 2, 0.04, 0.03, 0, i * 0.2, 0.001);
      }
    else {
      tone('square', 160, 130, 0.07, 0.02, 0);
      tone('square', 120, 100, 0.07, 0.018, 0, 0.16);
      burst('bandpass', 3800, 1.2, 0.25, 0.015, 0, 0.22, 0.03);
    }
  };
  /** A herd's call, by what's in the pen: a cow's moo, a sheep's or goat's bleat, a pig's grunts, the hens. */
  const herdCall = (a: Animal) => {
    if (a === 'hen') {
      for (let i = 0; i < 3; i++) tone('square', 460 + Math.random() * 80, 300, 0.05, 0.012, 0, i * 0.11);
      return;
    }
    if (a === 'pig') {
      for (let i = 0; i < 2; i++) {
        tone('square', 95 + Math.random() * 20, 70, 0.12, 0.03, 0, i * 0.17);
        burst('lowpass', 500, 1.5, 0.1, 0.03, 0, i * 0.17, 0.01);
      }
      return;
    }
    const at = ctx!.currentTime;
    const v = voice(0, at);
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    const f = ctx!.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    o.connect(f).connect(v.g);
    if (a === 'cattle') {
      // a long low moo, the mouth opening and closing on it
      const p = 105 + Math.random() * 25;
      f.frequency.setValueAtTime(320, at);
      f.frequency.linearRampToValueAtTime(700, at + 0.5);
      f.frequency.linearRampToValueAtTime(380, at + 1.3);
      o.frequency.setValueAtTime(p, at);
      o.frequency.linearRampToValueAtTime(p * 1.12, at + 0.4);
      o.frequency.linearRampToValueAtTime(p * 0.85, at + 1.3);
      v.g.gain.setValueAtTime(0, at);
      v.g.gain.linearRampToValueAtTime(0.06, at + 0.25);
      v.g.gain.linearRampToValueAtTime(0.045, at + 1.0);
      v.g.gain.exponentialRampToValueAtTime(0.0001, at + 1.45);
      o.start(at);
      o.stop(at + 1.5);
      return;
    }
    // a wavering bleat
    const p = (a === 'goat' ? 440 : 360) + Math.random() * 60;
    f.frequency.value = 1300;
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = a === 'goat' ? 9 : 7;
    const depth = ctx!.createGain();
    depth.gain.value = p * 0.06;
    lfo.connect(depth).connect(o.frequency);
    o.frequency.setValueAtTime(p, at);
    o.frequency.linearRampToValueAtTime(p * 0.92, at + 0.6);
    v.g.gain.setValueAtTime(0, at);
    v.g.gain.linearRampToValueAtTime(0.035, at + 0.05);
    v.g.gain.exponentialRampToValueAtTime(0.0001, at + 0.65);
    o.start(at);
    lfo.start(at);
    o.stop(at + 0.7);
    lfo.stop(at + 0.7);
  };
  /** The fiddler's jig (in D), round and round, a note at a time, scheduled a little ahead (`fiddleAt`); 0 is a rest. */
  const JIG = [74, 78, 81, 78, 74, 78, 81, 86, 85, 81, 78, 81, 79, 76, 73, 76, 74, 78, 81, 78, 74, 78, 81, 83, 81, 79, 78, 76, 74, 76, 74, 0];
  const fiddleNote = (at: number, midi: number, len: number, vol: number) => {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx!.createGain();
    g.gain.value = 0;
    g.connect(zoneBus.fiddle.gain);
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    const bp = ctx!.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.9;
    const lfo = ctx!.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx!.createGain();
    depth.gain.value = f * 0.006;
    lfo.connect(depth).connect(o.frequency);
    o.frequency.value = f;
    o.connect(bp).connect(g);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.03);
    g.gain.setValueAtTime(vol * 0.9, at + len * 0.7);
    g.gain.linearRampToValueAtTime(0, at + len);
    o.start(at);
    lfo.start(at);
    o.stop(at + len + 0.02);
    lfo.stop(at + len + 0.02);
  };
  const playFiddle = () => {
    const now = ctx!.currentTime;
    if (fiddleAt < now) fiddleAt = now + 0.05;
    const beat = 0.17;
    while (fiddleAt < now + 0.6) {
      const midi = JIG[fiddleStep % JIG.length];
      // (and the open A string droning under every bar, quietly)
      if (fiddleStep % 6 === 0) fiddleNote(fiddleAt, 57, beat * 5.5, 0.008);
      if (midi) fiddleNote(fiddleAt, midi, beat * 0.95, 0.022);
      fiddleStep++;
      fiddleAt += beat * (fiddleStep % 3 === 1 ? 1.12 : 0.94); // (the jig's lilt)
    }
  };
  /** The hymn: four voices singing a slow round of chords (in F), one each `HYMN_BAR` seconds. */
  const HYMN: number[][] = [
    [53, 60, 65, 69],
    [58, 62, 65, 70],
    [53, 60, 64, 69],
    [55, 60, 64, 67],
    [50, 57, 62, 65],
    [58, 62, 65, 70],
    [48, 55, 64, 67],
    [53, 60, 65, 69],
  ];
  const HYMN_BAR = 2.6;
  const singChord = (at: number, notes: number[]) => {
    for (const midi of notes) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const g = ctx!.createGain();
      g.gain.value = 0;
      g.connect(zoneBus.hymns.gain);
      const lp = ctx!.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      // (an "ah": the voice's vowel lifted)
      const vowel = ctx!.createBiquadFilter();
      vowel.type = 'peaking';
      vowel.frequency.value = 750;
      vowel.Q.value = 2;
      vowel.gain.value = 9;
      lp.connect(vowel).connect(g);
      for (const detune of [-7, 6]) {
        const o = ctx!.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(lp);
        o.start(at);
        o.stop(at + HYMN_BAR + 0.5);
      }
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.011, at + 0.7);
      g.gain.setValueAtTime(0.011, at + HYMN_BAR - 0.4);
      g.gain.linearRampToValueAtTime(0, at + HYMN_BAR + 0.45);
    }
  };
  const playHymn = () => {
    const now = ctx!.currentTime;
    if (hymnAt < now) hymnAt = now + 0.05;
    while (hymnAt < now + 1) {
      singChord(hymnAt, HYMN[hymnStep % HYMN.length]);
      hymnStep++;
      hymnAt += HYMN_BAR;
    }
  };
  /** Each frame: the zones' buses eased to their levels and pans (their beds with them), their calls when due. */
  const playZones = (z: ZoneMix, dt: number) => {
    const t0 = ctx!.currentTime;
    for (const k of ZONE_KINDS) {
      zoneBus[k].gain.gain.setTargetAtTime(z[k].level * ZONE_GAIN[k], t0, ZONE_FADE);
      zoneBus[k].pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, z[k].pan)), t0, ZONE_FADE);
    }
    const zcall = (k: keyof typeof zoneDue, rate: number, play: () => void) => {
      if (rate <= 0.001) return;
      zoneDue[k] -= dt;
      if (zoneDue[k] > 0) return;
      zoneDue[k] = (0.5 + Math.random()) / rate;
      play();
    };
    const lv = (k: ZoneKind) => z[k].level;
    zcall('laugh', lv('tavern') * 0.35, () => inZone('tavern', laugh));
    zcall('clink', lv('tavern') * 0.5, () => inZone('tavern', clink));
    zcall('cry', lv('market') * 0.3, () => inZone('market', cry));
    zcall('coins', lv('market') * 0.25, () => inZone('market', coins));
    zcall('clang', lv('forge') * 0.9, () => inZone('forge', clang));
    zcall('bellows', lv('forge') * 0.2, () => inZone('forge', bellows));
    zcall('shop', lv('workshop') * 0.7, () => inZone('workshop', shopWork));
    zcall('herd', lv('herd') * 0.3, () => inZone('herd', () => herdCall(z.herd.animal ?? 'cattle')));
    if (lv('fiddle') > 0.01) playFiddle();
    if (lv('hymns') > 0.01) playHymn();
  };

  const cues: Record<Cue, (pan: number, delay: number) => void> = {
    // an axe: a dull thud and the bite of the blade
    chop: (pan, delay) => {
      tone('sine', 140, 70, 0.12, 0.09, pan, delay);
      burst('bandpass', 1200, 1.5, 0.08, 0.07, pan, delay);
    },
    // a pick on stone: a bright clink
    mine: (pan, delay) => {
      tone('triangle', 2400 + Math.random() * 600, 2000, 0.18, 0.04, pan, delay);
      burst('highpass', 3000, 1, 0.05, 0.05, pan, delay);
    },
    // a hammer on a nail: knock, knock
    build: (pan, delay) => {
      tone('sine', 320, 200, 0.07, 0.07, pan, delay);
      burst('bandpass', 900, 2, 0.05, 0.05, pan, delay);
    },
    // thunder: a crack, then a long low roll
    thunder: (pan, delay) => {
      burst('lowpass', 1800, 0.5, 0.35, 0.35, pan, delay, 0.005);
      const f = burst('lowpass', 220, 0.7, 4.5, 0.55, pan, delay + 0.08, 0.25);
      f.frequency.setValueAtTime(320, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(90, ctx!.currentTime + delay + 4);
    },
    // a war horn: a low brassy swell, twice
    horn: (pan, delay) => {
      for (const [at, len] of [
        [0, 1.2],
        [1.5, 2.2],
      ] as const) {
        const start = ctx!.currentTime + delay + at;
        const v = voice(pan, start);
        const o = ctx!.createOscillator();
        o.type = 'sawtooth';
        const f = ctx!.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 700;
        o.connect(f).connect(v.g);
        o.frequency.setValueAtTime(110, start);
        o.frequency.linearRampToValueAtTime(146, start + 0.25);
        v.g.gain.setValueAtTime(0, start);
        v.g.gain.linearRampToValueAtTime(0.12, start + 0.3);
        v.g.gain.linearRampToValueAtTime(0.0001, start + len);
        o.start(start);
        o.stop(start + len + 0.05);
      }
    },
    quack: (pan, delay) => {
      tone('sawtooth', 620, 420, 0.12, 0.025, pan, delay);
      tone('sawtooth', 600, 400, 0.1, 0.02, pan, delay + 0.16);
    },
    splash: (pan, delay) => burst('bandpass', 1500, 0.8, 0.3, 0.06, pan, delay, 0.01),
    // a boot in snow: two short dry crunches, the second softer
    crunch: (pan, delay) => {
      burst('bandpass', 2300 + Math.random() * 900, 1.4, 0.07, 0.05, pan, delay, 0.004);
      burst('bandpass', 1700 + Math.random() * 700, 1.2, 0.06, 0.03, pan, delay + 0.05, 0.004);
    },
    // the town's animals: a dog's two quick barks, a cat's rising-falling mew, a hen's clucks
    bark: (pan, delay) => {
      const f = 330 + Math.random() * 140;
      tone('sawtooth', f, f * 0.62, 0.09, 0.05, pan, delay);
      burst('bandpass', f * 2.2, 2, 0.07, 0.03, pan, delay, 0.003);
      tone('sawtooth', f * 1.05, f * 0.6, 0.08, 0.04, pan, delay + 0.17);
    },
    meow: (pan, delay) => {
      tone('triangle', 520, 780, 0.18, 0.025, pan, delay);
      tone('triangle', 780, 460, 0.28, 0.022, pan, delay + 0.17);
    },
    cluck: (pan, delay) => {
      for (let i = 0; i < 3; i++) tone('square', 460 + Math.random() * 80, 300, 0.05, 0.012, pan, delay + i * 0.11);
    },
    // the dragon: a long, falling roar with a rumble under it
    roar: (pan, delay) => {
      tone('sawtooth', 210, 70, 1.6, 0.07, pan, delay);
      tone('sawtooth', 160, 55, 1.8, 0.05, pan, delay + 0.05);
      burst('lowpass', 300, 1, 1.8, 0.09, pan, delay, 0.15);
    },
    // a building coming down: the timbers' crack, the walls falling in, and a last few things sliding off
    collapse: (pan, delay) => {
      burst('highpass', 1800, 0.7, 0.12, 0.12, pan, delay, 0.002);
      burst('lowpass', 320, 0.8, 1.6, 0.3, pan, delay + 0.08, 0.04);
      tone('sine', 75, 32, 1.2, 0.12, pan, delay + 0.08);
      for (let i = 0; i < 5; i++) burst('bandpass', 700 + Math.random() * 1400, 1.5, 0.09, 0.05, pan, delay + 0.4 + i * 0.13 + Math.random() * 0.05, 0.002);
    },
    // a foot in the rain's mud: a low wet suck
    squelch: (pan, delay) => burst('lowpass', 420 + Math.random() * 200, 2, 0.12, 0.05, pan, delay, 0.02),
    // a sword on a shield: a bright ring over a short scrape
    clash: (pan, delay) => {
      const f = 1900 + Math.random() * 900;
      tone('triangle', f, f * 0.97, 0.35, 0.035, pan, delay);
      tone('sine', f * 1.51, f * 1.45, 0.25, 0.02, pan, delay);
      burst('highpass', 3500, 0.8, 0.08, 0.06, pan, delay, 0.002);
    },
    // a bow: the string's twang and the arrow's hiss away
    arrow: (pan, delay) => {
      tone('triangle', 180, 120, 0.12, 0.05, pan, delay);
      const f = burst('bandpass', 2500, 3, 0.3, 0.03, pan, delay + 0.02, 0.02);
      f.frequency.setValueAtTime(3500, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(1200, ctx!.currentTime + delay + 0.3);
    },
    // a blow landing on a body
    thud: (pan, delay) => {
      tone('sine', 110, 50, 0.14, 0.09, pan, delay);
      burst('lowpass', 700, 1, 0.07, 0.06, pan, delay, 0.002);
    },
    // a cry of pain
    hurt: (pan, delay) => {
      const f = 240 + Math.random() * 160;
      tone('sawtooth', f * 1.3, f * 0.8, 0.22, 0.03, pan, delay);
      burst('bandpass', f * 3, 3, 0.18, 0.015, pan, delay, 0.01);
    },
    // something heavy falls: a thump and a rattle
    fall: (pan, delay) => {
      tone('sine', 90, 40, 0.3, 0.1, pan, delay);
      burst('lowpass', 400, 1, 0.25, 0.07, pan, delay + 0.03, 0.01);
      burst('bandpass', 2400, 2, 0.12, 0.02, pan, delay + 0.1);
    },
    // a spell: a rising shimmer of fifths
    spell: (pan, delay) => {
      const base = 500 + Math.random() * 300;
      for (let i = 0; i < 5; i++) tone('sine', base * Math.pow(1.5, i % 3) * (1 + i * 0.12), base * Math.pow(1.5, i % 3) * (1.3 + i * 0.12), 0.4, 0.018, pan, delay + i * 0.05);
      const f = burst('bandpass', 3000, 4, 0.5, 0.02, pan, delay, 0.08);
      f.frequency.setValueAtTime(1500, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(6000, ctx!.currentTime + delay + 0.5);
    },
    // mending: three soft rising notes
    heal: (pan, delay) => {
      [523, 659, 784].forEach((f, i) => tone('sine', f, f, 0.5, 0.025, pan, delay + i * 0.09));
    },
    // coins: a little jingle
    coin: (pan, delay) => {
      for (let i = 0; i < 3; i++) {
        const f = 3200 + Math.random() * 1600;
        tone('sine', f, f * 0.99, 0.18, 0.018, pan, delay + i * 0.06 + Math.random() * 0.02);
      }
    },
    // a level gained: a quick bright arpeggio up
    levelup: (pan, delay) => {
      [523, 659, 784, 1047].forEach((f, i) => {
        tone('triangle', f, f, 0.3, 0.035, pan, delay + i * 0.08);
        tone('sine', f * 2, f * 2, 0.2, 0.012, pan, delay + i * 0.08);
      });
    },
    // something asks the player: two gentle chimes
    chime: (pan, delay) => {
      tone('sine', 880, 880, 0.9, 0.03, pan, delay);
      tone('sine', 880 * 2.76, 880 * 2.76, 0.4, 0.008, pan, delay);
      tone('sine', 1175, 1175, 1.1, 0.03, pan, delay + 0.18);
    },
    // dawn: a rooster's cock-a-doodle-doo
    rooster: (pan, delay) => {
      const steps: [number, number, number][] = [
        [600, 800, 0.12],
        [800, 700, 0.12],
        [700, 1000, 0.18],
        [1000, 600, 0.5],
      ];
      let at = 0;
      for (const [a, b, d] of steps) {
        tone('sawtooth', a, b, d, 0.022, pan, delay + at);
        at += d + 0.02;
      }
    },
    // a bell in a tower, far off: a struck partial series ringing out
    bell: (pan, delay) => {
      const f = 330 + Math.random() * 40;
      for (const [m, v, r] of [
        [1, 0.05, 3.5],
        [2.0, 0.02, 2.5],
        [2.76, 0.025, 2],
        [5.4, 0.01, 1],
      ] as const)
        tone('sine', f * m, f * m * 0.998, r, v, pan, delay);
    },
    // a door: a creak and a knock shut
    door: (pan, delay) => {
      tone('sawtooth', 300, 420, 0.3, 0.008, pan, delay);
      tone('sine', 140, 80, 0.08, 0.05, pan, delay + 0.32);
    },
    // a crowd's cheer: a swell of voices
    cheer: (pan, delay) => {
      burst('bandpass', 1100, 0.8, 1.6, 0.05, pan, delay, 0.25);
      burst('bandpass', 1700, 1.2, 1.3, 0.03, pan + 0.3, delay + 0.1, 0.3);
      for (let i = 0; i < 6; i++) {
        const f = 300 + Math.random() * 400;
        tone('sawtooth', f, f * 1.2, 0.3, 0.006, Math.random() * 1.4 - 0.7, delay + Math.random() * 0.8);
      }
    },
    // victory: a short brass fanfare
    fanfare: (pan, delay) => {
      const notes: [number, number, number][] = [
        [392, 0, 0.15],
        [523, 0.16, 0.15],
        [659, 0.32, 0.15],
        [784, 0.48, 0.6],
      ];
      for (const [f, at, d] of notes) {
        tone('sawtooth', f, f, d, 0.03, pan, delay + at);
        tone('square', f / 2, f / 2, d, 0.012, pan, delay + at);
      }
    },
    // a death: a low tolling bell
    dirge: (pan, delay) => {
      for (const at of [0, 1.6]) {
        tone('sine', 165, 164, 3, 0.06, pan, delay + at);
        tone('sine', 165 * 2.76, 165 * 2.7, 1.5, 0.015, pan, delay + at);
      }
    },
    // the ground shaking
    rumble: (pan, delay) => {
      burst('lowpass', 120, 1, 2.5, 0.25, pan, delay, 0.4);
      tone('sine', 45, 35, 2.4, 0.08, pan, delay);
    },
    // something passing fast: a flame, a swoop
    whoosh: (pan, delay) => {
      const f = burst('bandpass', 800, 1.5, 0.5, 0.06, pan, delay, 0.15);
      f.frequency.setValueAtTime(400, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(2400, ctx!.currentTime + delay + 0.45);
    },
    // a saw through wood, back and forth
    saw: (pan, delay) => {
      for (let i = 0; i < 2; i++) burst('bandpass', i ? 1600 : 1300, 3, 0.22, 0.09, pan, delay + i * 0.26, 0.05);
    },
    // a hammer on an anvil
    anvil: (pan, delay) => {
      const f = 1350 + Math.random() * 200;
      tone('triangle', f, f, 0.6, 0.035, pan, delay);
      tone('sine', f * 2.4, f * 2.4, 0.3, 0.012, pan, delay);
      burst('highpass', 4000, 1, 0.03, 0.04, pan, delay, 0.001);
    },
    // hooves on the road
    gallop: (pan, delay) => {
      for (let i = 0; i < 6; i++) {
        tone('sine', 200 + (i % 2) * 30, 120, 0.05, 0.03, pan, delay + i * 0.13 + (i % 3 === 2 ? 0.06 : 0));
        burst('lowpass', 900, 1, 0.04, 0.02, pan, delay + i * 0.13, 0.002);
      }
    },
    // a newborn's first cry
    baby: (pan, delay) => {
      tone('sawtooth', 450, 600, 0.4, 0.018, pan, delay);
      tone('sawtooth', 600, 420, 0.6, 0.018, pan, delay + 0.45);
    },
    // a blade swung: the air cut, a thin ring at the end
    slash: (pan, delay) => {
      const f = burst('bandpass', 2600, 2, 0.16, 0.06, pan, delay, 0.02);
      f.frequency.setValueAtTime(3600, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(900, ctx!.currentTime + delay + 0.15);
      const r = 2200 + Math.random() * 700;
      tone('triangle', r, r * 0.98, 0.14, 0.012, pan, delay + 0.1);
    },
    // a club or a mace landing: a deep blunt knock
    bash: (pan, delay) => {
      tone('sine', 170, 55, 0.2, 0.11, pan, delay);
      burst('lowpass', 520, 1, 0.11, 0.09, pan, delay, 0.002);
    },
    // a spear thrust: a short hiss and a thunk
    stab: (pan, delay) => {
      burst('bandpass', 1800, 2.5, 0.08, 0.04, pan, delay, 0.01);
      tone('sine', 240, 110, 0.09, 0.07, pan, delay + 0.07);
    },
    // a crossbow: the latch's clack, the stock's thunk, the bolt away
    crossbow: (pan, delay) => {
      tone('square', 900, 420, 0.03, 0.03, pan, delay);
      tone('triangle', 150, 85, 0.12, 0.07, pan, delay + 0.01);
      const f = burst('bandpass', 3000, 3, 0.18, 0.03, pan, delay + 0.03, 0.01);
      f.frequency.setValueAtTime(3000, ctx!.currentTime + delay + 0.03);
      f.frequency.exponentialRampToValueAtTime(1400, ctx!.currentTime + delay + 0.2);
    },
    // a stone or a knife thrown: a quick airy whirr
    throw: (pan, delay) => {
      const f = burst('bandpass', 900, 1.8, 0.26, 0.045, pan, delay, 0.08);
      f.frequency.setValueAtTime(600, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(1500, ctx!.currentTime + delay + 0.25);
    },
    // a bolt from a staff or a wand: a falling zing with a sparkle
    zap: (pan, delay) => {
      tone('sine', 1900, 380, 0.24, 0.03, pan, delay);
      tone('triangle', 2850, 600, 0.2, 0.012, pan, delay);
      burst('highpass', 5000, 1, 0.15, 0.015, pan, delay + 0.02, 0.01);
    },
    // a gun: a sharp crack and its boom
    gunshot: (pan, delay) => {
      burst('highpass', 1500, 0.7, 0.05, 0.22, pan, delay, 0.001);
      burst('lowpass', 700, 0.8, 0.35, 0.16, pan, delay, 0.002);
      tone('sine', 95, 38, 0.25, 0.1, pan, delay);
    },
    // an automatic weapon: a rattle of shots
    burst: (pan, delay) => {
      for (let i = 0; i < 4; i++) {
        burst('highpass', 1600, 0.7, 0.04, 0.12, pan, delay + i * 0.08, 0.001);
        tone('sine', 110, 50, 0.08, 0.05, pan, delay + i * 0.08);
      }
    },
    // an energy weapon: a buzzing pew
    laser: (pan, delay) => {
      tone('square', 1700, 220, 0.18, 0.025, pan, delay);
      tone('sine', 3200, 700, 0.16, 0.02, pan, delay);
    },
    // a blast: a cannon, a mortar, a rocket
    boom: (pan, delay) => {
      burst('highpass', 1200, 0.6, 0.06, 0.18, pan, delay, 0.001);
      burst('lowpass', 260, 0.8, 1.3, 0.32, pan, delay, 0.01);
      tone('sine', 70, 28, 1.1, 0.14, pan, delay);
    },
    // a blow turned on a shield: a dull clang
    block: (pan, delay) => {
      const f = 700 + Math.random() * 250;
      tone('triangle', f, f * 0.96, 0.32, 0.04, pan, delay);
      tone('triangle', f * 1.47, f * 1.4, 0.2, 0.02, pan, delay);
      tone('sine', 150, 80, 0.1, 0.07, pan, delay);
      burst('bandpass', 2400, 1.5, 0.05, 0.05, pan, delay, 0.001);
    },
    // a beast's snarl and snap
    bite: (pan, delay) => {
      const f = 150 + Math.random() * 60;
      const at = ctx!.currentTime + delay;
      const v = voice(pan, at);
      const o = ctx!.createOscillator();
      o.type = 'sawtooth';
      const lp = ctx!.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const lfo = ctx!.createOscillator();
      lfo.frequency.value = 32;
      const depth = ctx!.createGain();
      depth.gain.value = 40;
      lfo.connect(depth).connect(o.frequency);
      o.frequency.setValueAtTime(f, at);
      o.frequency.linearRampToValueAtTime(f * 1.3, at + 0.2);
      o.connect(lp).connect(v.g);
      v.g.gain.setValueAtTime(0, at);
      v.g.gain.linearRampToValueAtTime(0.06, at + 0.04);
      v.g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      o.start(at);
      lfo.start(at);
      o.stop(at + 0.35);
      lfo.stop(at + 0.35);
      burst('highpass', 2500, 1, 0.03, 0.06, pan, delay + 0.26, 0.001);
    },
    // a trap sprung: a click and iron jaws
    snap: (pan, delay) => {
      burst('highpass', 4000, 1, 0.02, 0.06, pan, delay, 0.001);
      tone('triangle', 1150, 1050, 0.2, 0.04, pan, delay + 0.02);
      tone('sine', 200, 90, 0.1, 0.07, pan, delay + 0.02);
    },
    // a tower's engine loosing: a heavy twang and the bolt's rush
    ballista: (pan, delay) => {
      tone('triangle', 95, 60, 0.3, 0.09, pan, delay);
      tone('sawtooth', 190, 120, 0.08, 0.02, pan, delay);
      const f = burst('bandpass', 1800, 2, 0.4, 0.04, pan, delay + 0.03, 0.03);
      f.frequency.setValueAtTime(1800, ctx!.currentTime + delay + 0.03);
      f.frequency.exponentialRampToValueAtTime(500, ctx!.currentTime + delay + 0.42);
    },
    // an ultimate: a gathering swell, a blast and a bright shimmer over it
    ult: (pan, delay) => {
      const f = burst('bandpass', 600, 1.5, 0.7, 0.07, pan, delay, 0.6);
      f.frequency.setValueAtTime(300, ctx!.currentTime + delay);
      f.frequency.exponentialRampToValueAtTime(2400, ctx!.currentTime + delay + 0.65);
      burst('lowpass', 240, 0.8, 1.2, 0.3, pan, delay + 0.65, 0.01);
      tone('sine', 65, 30, 1, 0.12, pan, delay + 0.65);
      for (let i = 0; i < 4; i++) tone('sine', 880 * Math.pow(1.5, i % 3), 1320 * Math.pow(1.5, i % 3), 0.6, 0.015, pan, delay + 0.7 + i * 0.06);
    },
    // a building finished: the last knocks and a bright two-note call
    built: (pan, delay) => {
      for (let i = 0; i < 3; i++) {
        tone('sine', 320, 200, 0.07, 0.06, pan, delay + i * 0.16);
        burst('bandpass', 900, 2, 0.05, 0.04, pan, delay + i * 0.16);
      }
      tone('triangle', 784, 784, 0.35, 0.03, pan, delay + 0.55);
      tone('triangle', 1047, 1047, 0.6, 0.03, pan, delay + 0.72);
    },
    // a tree coming down: the trunk's creak, then the crash through the branches
    timber: (pan, delay) => {
      const at = ctx!.currentTime + delay;
      const v = voice(pan, at);
      const o = ctx!.createOscillator();
      o.type = 'sawtooth';
      const lp = ctx!.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 500;
      lp.Q.value = 3;
      o.frequency.setValueAtTime(140, at);
      o.frequency.linearRampToValueAtTime(95, at + 0.6);
      o.connect(lp).connect(v.g);
      v.g.gain.setValueAtTime(0, at);
      v.g.gain.linearRampToValueAtTime(0.03, at + 0.1);
      v.g.gain.linearRampToValueAtTime(0.0001, at + 0.65);
      o.start(at);
      o.stop(at + 0.7);
      burst('highpass', 2200, 0.8, 0.6, 0.06, pan, delay + 0.6, 0.02);
      burst('lowpass', 380, 0.8, 0.9, 0.18, pan, delay + 0.68, 0.01);
      tone('sine', 80, 35, 0.6, 0.09, pan, delay + 0.7);
    },
    // a rock broken: a rattle of falling stones
    crumble: (pan, delay) => {
      for (let i = 0; i < 5; i++) burst('bandpass', 900 + Math.random() * 1600, 1.5, 0.07, 0.04, pan, delay + i * 0.06 + Math.random() * 0.04, 0.002);
      burst('lowpass', 300, 1, 0.4, 0.08, pan, delay, 0.01);
    },
    // a sickle through the grain: a dry swish
    reap: (pan, delay) => {
      const f = burst('highpass', 2400, 0.8, 0.2, 0.035, pan, delay, 0.04);
      f.frequency.setValueAtTime(1800, ctx!.currentTime + delay);
      f.frequency.linearRampToValueAtTime(3800, ctx!.currentTime + delay + 0.18);
    },
    // a hoe into the soil: a soft thud and the earth turned
    till: (pan, delay) => {
      tone('sine', 130, 70, 0.1, 0.06, pan, delay);
      burst('lowpass', 450, 1, 0.14, 0.05, pan, delay + 0.02, 0.005);
    },
    // a loom: the shuttle clacking across and the beater knocked home
    loom: (pan, delay) => {
      tone('square', 620, 520, 0.025, 0.02, pan, delay);
      tone('square', 680, 560, 0.025, 0.02, pan, delay + 0.2);
      tone('sine', 140, 90, 0.08, 0.06, pan, delay + 0.36);
    },
    // a cook's knife or a pestle: knocks on wood
    pound: (pan, delay) => {
      for (let i = 0; i < 3; i++) {
        tone('sine', 260, 170, 0.05, 0.05, pan, delay + i * 0.17);
        burst('bandpass', 1300, 2, 0.03, 0.03, pan, delay + i * 0.17, 0.001);
      }
    },
    // something bubbling in a still or a pot
    bubble: (pan, delay) => {
      for (let i = 0; i < 4; i++) {
        const f = 260 + Math.random() * 300;
        tone('sine', f, f * 2.6, 0.06, 0.03, pan, delay + i * 0.09 + Math.random() * 0.05);
      }
    },
    // a chisel on stone or a gem: bright little ticks
    chisel: (pan, delay) => {
      for (let i = 0; i < 2; i++) {
        tone('triangle', 3100 + Math.random() * 500, 2900, 0.06, 0.025, pan, delay + i * 0.14);
        burst('highpass', 4500, 1, 0.025, 0.03, pan, delay + i * 0.14, 0.001);
      }
    },
    // a machine at work: a clank and a hiss of steam
    machine: (pan, delay) => {
      tone('square', 140, 120, 0.08, 0.035, pan, delay);
      tone('square', 105, 95, 0.08, 0.03, pan, delay + 0.18);
      burst('bandpass', 4200, 1.2, 0.35, 0.025, pan, delay + 0.25, 0.04);
    },
    // a page turned
    page: (pan, delay) => burst('bandpass', 3200, 1, 0.22, 0.022, pan, delay, 0.06),
  };

  const level = (b: { gain: GainNode } | null, v: number) => {
    if (!b || !ctx) return;
    b.gain.gain.setTargetAtTime(v, ctx.currentTime, FADE);
  };

  return {
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    update(want, mix, dt, zones) {
      if (want && !start()) return;
      if (!ctx) return;
      if (want !== on) {
        on = want;
        master.gain.setTargetAtTime(want ? MASTER * loudness : 0, ctx.currentTime, 0.6);
        if (want) wake(ctx);
      }
      if (!on) return;
      t += dt;
      mixNow = mix;
      // the beds, the wind's strength swaying slowly
      const sway = 0.75 + 0.25 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1);
      level(beds.wind, 0.16 * mix.wind * sway);
      if (beds.wind) beds.wind.filter.frequency.setTargetAtTime(300 + 500 * mix.wind * sway, ctx.currentTime, 0.8);
      level(beds.rain, 0.13 * mix.rain);
      level(beds.water, 0.14 * mix.water * (0.85 + 0.15 * Math.sin(t * 0.5)));
      level(beds.fire, 0.012 * mix.fire);
      // the calls, each when it's due
      const call = (k: keyof typeof due, rate: number, play: () => void, spread = 1) => {
        if (rate <= 0) return;
        due[k] -= dt;
        if (due[k] > 0) return;
        due[k] = (spread * (0.5 + Math.random())) / rate;
        play();
      };
      call('birds', mix.birds * 0.7, bird);
      call('crickets', mix.crickets * 3, cricket);
      call('frogs', mix.frogs * 0.6, frog);
      call('owls', mix.owls, owl);
      call('wolves', mix.wolves, howl);
      call('crackle', mix.fire * 8, () => crackle(mixNow?.fire ?? 0));
      // the sounds by place, from where the view is
      zonesNow = zones ?? zonesNow;
      if (zonesNow) playZones(zonesNow, dt);
    },
    setLevel(v) {
      loudness = Math.max(0, Math.min(1, v));
      if (ctx && on) master.gain.setTargetAtTime(MASTER * loudness, ctx.currentTime, 0.15);
    },
    cue(kind, pan = 0, delay = 0) {
      if (!ctx || !on) return;
      toCues = true;
      try {
        cues[kind](pan, delay);
      } finally {
        toCues = false;
      }
    },
  };
}
