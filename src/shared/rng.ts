// Deterministic seeded RNG (mulberry32). Everything that must replay from a seed goes through this.

/** Hash a string seed to a 32-bit unsigned integer (FNV-1a followed by a murmur3 finalizer). */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

/** Combine a base seed with salts into a new independent 32-bit seed. */
export function mixSeed(base: number, ...salts: number[]): number {
  let h = base >>> 0;
  for (const s of salts) h = fmix32(h ^ Math.imul((s | 0) + 0x9e3779b9, 0x85ebca6b));
  return h;
}

function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export class Rng {
  private s: number;

  /** `seed` is either a fresh seed or a `state` saved earlier (resumes the exact same sequence). */
  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  static from(base: number, ...salts: number[]): Rng {
    return new Rng(mixSeed(base, ...salts));
  }

  /** Internal state, so the sequence can be saved and resumed exactly. */
  get state(): number {
    return this.s;
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Pick a key from a weight table. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K {
    const keys = Object.keys(weights) as K[];
    let total = 0;
    for (const k of keys) total += weights[k];
    let r = this.next() * total;
    for (const k of keys) {
      r -= weights[k];
      if (r < 0) return k;
    }
    return keys[keys.length - 1];
  }
}
