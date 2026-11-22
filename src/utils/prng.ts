/**
 * prng.ts
 * Generador pseudoaleatorio determinista Mulberry32 y utilidades de semilla diaria UTC.
 */

export function hashStringToSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export function createMulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getUtcDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rollSeededDice(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

export function pickSeededItem<T>(items: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, idx))];
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const rng = createMulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
