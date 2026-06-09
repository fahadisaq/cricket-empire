/**
 * Seeded, deterministic RNG (mulberry32) + a SplitMix64-style string hash.
 *
 * Determinism is a core design pillar: the same match seed + same inputs must
 * always produce the same ball-by-ball outcome. This makes matches replayable,
 * commentary reproducible, fairness provable, and lets the AI run "what-if"
 * simulations without side effects.
 */

export class RNG {
  private state: number;

  constructor(seed: number) {
    // Ensure a non-zero 32-bit state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick a random element. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick() on empty array");
    return arr[this.int(0, arr.length - 1)]!;
  }

  /**
   * Sample an index from a weight array using a single random draw.
   * Weights need not be normalized.
   */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i]!;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** Box-Muller normal sample. */
  normal(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  /** In-place Fisher-Yates shuffle (returns the same array for chaining). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
}

/** Deterministic 32-bit hash of a string — used to derive seeds from IDs. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine multiple numeric seeds into one stable 32-bit seed. */
export function combineSeeds(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
