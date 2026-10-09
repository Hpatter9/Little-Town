// The land's soundscape (the owner's ask: a huge immersive overhaul), made in the browser with the Web Audio API: there
// are no sound files to fetch. Beds of filtered noise for the wind, the rain and the river or sea, each following
// ambientMix (ambienceMix.ts); and short calls scheduled at random: birdsong by day, crickets, frogs, owls and wolves
// by night, the fire's crackle, axes, picks and hammers of whoever works in view (panned by where they stand), thunder
// after the lightning, and a war horn when a raid comes. On with the music (the ♪ button); silent while the strip is
// hidden.

import type { AmbientMix } from './ambienceMix';

const MASTER = 0.55;
const FADE = 1.2;

/** A sound to play now: what, and where across the screen (-1 left to 1 right). */
export type Cue =
  | 'chop' | 'mine' | 'build' | 'thunder' | 'horn' | 'quack' | 'splash' | 'crunch' | 'squelch' | 'bark' | 'meow' | 'cluck' | 'roar'
  // the town's life and its fights (main.ts `soundEffects`)
  | 'clash' | 'arrow' | 'thud' | 'hurt' | 'fall' | 'spell' | 'heal' | 'coin' | 'levelup' | 'chime' | 'rooster' | 'bell'
  | 'door' | 'cheer' | 'fanfare' | 'dirge' | 'rumble' | 'whoosh' | 'saw' | 'anvil' | 'gallop' | 'baby';

export interface Ambience {
  /** Each frame: on or off, the mix, and the seconds since the last. */
  update(on: boolean, mix: AmbientMix, dt: number): void;
  cue(kind: Cue, pan?: number, delay?: number): void;
  /** For previews: whether the sound has started. */
  readonly running: boolean;
}

export function createAmbience(): Ambience {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let noise: AudioBuffer;
  const beds: Record<'wind' | 'rain' | 'water' | 'fire', { gain: GainNode; filter: BiquadFilterNode } | null> = { wind: null, rain: null, water: null, fire: null };
  let t = 0;
  const due = { birds: 1, crickets: 0.5, frogs: 1, owls: 3, wolves: 6, crackle: 0.3 };
  let mixNow: AmbientMix | null = null;
  let on = false;

  const start = (): boolean => {
    if (ctx) return true;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // two seconds of white noise, looped by every bed
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    beds.wind = bed('bandpass', 380, 0.6);
    beds.rain = bed('highpass', 1400, 0.4);
    beds.water = bed('lowpass', 520, 0.5);
    beds.fire = bed('bandpass', 1800, 2);
    // (the browser keeps the sound asleep until a touch: wake it on the next one)
    const wake = () => void ctx?.resume().catch(() => undefined);
    window.addEventListener('pointerdown', wake, { passive: true });
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

  /** A voice: an envelope on a gain, panned, into the master. */
  const voice = (pan: number, at: number) => {
    const g = ctx!.createGain();
    g.gain.value = 0;
    const p = ctx!.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(master);
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
      for (let i = 0; i < 2; i++) burst('bandpass', i ? 1600 : 1300, 3, 0.22, 0.03, pan, delay + i * 0.26, 0.05);
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
  };

  const level = (b: { gain: GainNode } | null, v: number) => {
    if (!b || !ctx) return;
    b.gain.gain.setTargetAtTime(v, ctx.currentTime, FADE);
  };

  return {
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    update(want, mix, dt) {
      if (want && !start()) return;
      if (!ctx) return;
      if (want !== on) {
        on = want;
        master.gain.setTargetAtTime(want ? MASTER : 0, ctx.currentTime, 0.6);
        if (want) void ctx.resume().catch(() => undefined);
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
    },
    cue(kind, pan = 0, delay = 0) {
      if (!ctx || !on) return;
      cues[kind](pan, delay);
    },
  };
}
