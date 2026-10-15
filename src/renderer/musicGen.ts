// Plays a composed piece (musicScore.ts) with the Web Audio API: every instrument is a little synth (no sound files).
// Notes are scheduled a moment ahead by a timer, so the playing holds steady while the page is busy; a soft echo
// (a convolver on a made-up room) sits under it all. `play` starts a piece and calls back when it's done; `stop`
// fades it out.

import { gateContext, wake } from './audioGate';
import { compose, pieceSeconds, type Instrument, type Note, type Piece } from './musicScore';

const AHEAD = 0.25;
const TICK_MS = 60;

export interface Player {
  play(piece: Piece, seed: number, done: () => void): void;
  stop(fadeSeconds?: number): void;
  setVolume(v: number): void;
  readonly playing: Piece | null;
}

const freq = (p: number) => 440 * Math.pow(2, (p - 69) / 12);

export function createPlayer(): Player | null {
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  gateContext(ctx);
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);
  // a room: a short decaying noise as the echo's shape
  const verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  verb.connect(wet).connect(out);
  const dry = ctx.createGain();
  dry.connect(out);
  dry.connect(verb);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  window.addEventListener('pointerdown', () => wake(ctx), { passive: true });

  let volume = 0.2;
  let piece: Piece | null = null;
  let notes: Note[] = [];
  let next = 0;
  let t0 = 0;
  let spb = 0.5;
  let endsAt = 0;
  let timer: number | null = null;
  let onDone: (() => void) | null = null;
  let gen = 0;

  const env = (g: GainNode, at: number, a: number, peak: number, hold: number, rel: number) => {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + a);
    if (hold > 0) g.gain.setValueAtTime(peak, at + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + Math.max(0, hold) + rel);
  };
  const osc = (type: OscillatorType, f: number, at: number, stop: number, dest: AudioNode, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(dest);
    o.start(at);
    o.stop(stop);
    return o;
  };
  const hit = (filter: BiquadFilterType, f: number, at: number, dur: number, v: number) => {
    const g = ctx.createGain();
    g.connect(dry);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const flt = ctx.createBiquadFilter();
    flt.type = filter;
    flt.frequency.value = f;
    src.connect(flt).connect(g);
    env(g, at, 0.002, v, 0, dur);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.05);
  };

  /** One note on its instrument. */
  const sound = (i: Instrument, p: number, at: number, d: number, v: number) => {
    const f = freq(p);
    const g = ctx.createGain();
    g.connect(dry);
    const end = at + d;
    switch (i) {
      case 'flute': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = f * 4;
        lp.connect(g);
        const o = osc('triangle', f, at, end + 0.3, lp);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5;
        const depth = ctx.createGain();
        depth.gain.value = f * 0.006;
        lfo.connect(depth).connect(o.frequency);
        lfo.start(at + 0.15);
        lfo.stop(end + 0.3);
        osc('sine', f * 2, at, end + 0.3, lp);
        env(g, at, 0.06, v * 0.22, d * 0.8, 0.25);
        break;
      }
      case 'pluck':
      case 'harp': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(f * (i === 'harp' ? 8 : 6), at);
        lp.frequency.exponentialRampToValueAtTime(f * 1.5, at + 0.4);
        lp.connect(g);
        osc(i === 'harp' ? 'triangle' : 'sawtooth', f, at, at + 2, lp);
        env(g, at, 0.004, v * (i === 'harp' ? 0.22 : 0.12), 0, i === 'harp' ? 1.4 : 0.6);
        break;
      }
      case 'bell': {
        for (const [m, a, r] of [
          [1, 1, 2.2],
          [2.76, 0.4, 1.2],
          [5.4, 0.2, 0.6],
        ] as const) {
          const pg = ctx.createGain();
          pg.connect(g);
          osc('sine', f * m, at, at + r + 0.1, pg);
          env(pg, at, 0.003, a, 0, r);
        }
        g.gain.value = v * 0.18;
        break;
      }
      case 'pad': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        lp.connect(g);
        osc('sawtooth', f, at, end + 1, lp, -8);
        osc('sawtooth', f, at, end + 1, lp, 8);
        env(g, at, Math.min(0.6, d / 3), v * 0.08, Math.max(0, d - 0.6), 0.8);
        break;
      }
      case 'organ': {
        for (const [m, a] of [
          [1, 1],
          [2, 0.5],
          [3, 0.25],
          [0.5, 0.4],
        ] as const) {
          const pg = ctx.createGain();
          pg.gain.value = a;
          pg.connect(g);
          osc('sine', f * m, at, end + 0.2, pg);
        }
        env(g, at, 0.03, v * 0.09, Math.max(0, d - 0.05), 0.15);
        break;
      }
      case 'brass': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(f * 1.2, at);
        lp.frequency.linearRampToValueAtTime(f * 5, at + 0.08);
        lp.frequency.exponentialRampToValueAtTime(f * 2.5, at + 0.4);
        lp.connect(g);
        osc('sawtooth', f, at, end + 0.2, lp);
        osc('sawtooth', f, at, end + 0.2, lp, 6);
        env(g, at, 0.04, v * 0.11, Math.max(0, d * 0.85 - 0.04), 0.15);
        break;
      }
      case 'bass': {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;
        lp.connect(g);
        osc('triangle', f, at, end + 0.2, lp);
        osc('sine', f / 2, at, end + 0.2, lp);
        env(g, at, 0.01, v * 0.3, Math.max(0, d * 0.7), 0.2);
        break;
      }
      case 'kick': {
        const o = osc('sine', 120, at, at + 0.4, g);
        o.frequency.setValueAtTime(130, at);
        o.frequency.exponentialRampToValueAtTime(42, at + 0.25);
        env(g, at, 0.002, v * 0.6, 0, 0.3);
        break;
      }
      case 'snare':
        hit('bandpass', 1800, at, 0.16, v * 0.35);
        osc('triangle', 190, at, at + 0.1, g);
        env(g, at, 0.002, v * 0.15, 0, 0.08);
        break;
      case 'hat':
        hit('highpass', 7000, at, 0.04, v * 0.25);
        break;
      case 'tambour':
        hit('bandpass', 5200, at, 0.09, v * 0.3);
        break;
    }
  };

  const pump = () => {
    if (!piece) return;
    const horizon = ctx.currentTime + AHEAD;
    while (next < notes.length && t0 + notes[next].t * spb < horizon) {
      const n = notes[next++];
      const at = Math.max(ctx.currentTime, t0 + n.t * spb);
      sound(n.i, n.p, at, n.d * spb, n.v);
    }
    if (ctx.currentTime > endsAt) {
      const cb = onDone;
      halt();
      cb?.();
    }
  };
  const halt = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    piece = null;
    onDone = null;
  };

  return {
    get playing() {
      return piece;
    },
    play(p, seed, done) {
      halt();
      gen++;
      wake(ctx);
      piece = p;
      notes = compose(p, seed);
      next = 0;
      spb = 60 / p.bpm;
      t0 = ctx.currentTime + 0.1;
      endsAt = t0 + pieceSeconds(p, notes) + 2.5;
      onDone = done;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(volume, ctx.currentTime, 0.4);
      timer = window.setInterval(pump, TICK_MS);
      pump();
    },
    stop(fade = 1.5) {
      const g = gen;
      out.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
      window.setTimeout(() => {
        if (g === gen) halt();
      }, fade * 1000);
      onDone = null;
    },
    setVolume(v) {
      volume = v;
      if (piece) out.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
    },
  };
}
