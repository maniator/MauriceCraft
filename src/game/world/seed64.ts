/**
 * Lossless 64-bit world identities. JavaScript numbers cannot represent all
 * uint64 values; only small, precomputed uint32 streams enter terrain noise.
 */
const MASK64 = (1n << 64n) - 1n;
const MIX_INCREMENT = 0x9e3779b97f4a7c15n;
const DOMAIN_SALTS = {
  terrain: 0x243f6a8885a308d3n,
  features: 0x13198a2e03707344n,
} as const;

export type WorldSeedDomain = keyof typeof DOMAIN_SALTS;
export type WorldSeedWords = readonly [high: number, low: number];

export function parseWorldSeed64(value: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error('Invalid 64-bit world seed: expected an unsigned decimal string');
  }
  const parsed = BigInt(value);
  if (parsed > MASK64) throw new Error('Invalid 64-bit world seed: exceeds uint64 range');
  return parsed;
}

/** SplitMix64's avalanche, performed once per seed/domain, never per voxel. */
function mix64(value: bigint): bigint {
  let z = (value + MIX_INCREMENT) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return z ^ (z >> 31n);
}

/**
 * Both halves of the canonical uint64 seed affect two independently mixed
 * terrain streams. Two generated worlds cannot silently share a seed merely
 * because their low 32 bits match.
 */
export function deriveWorldSeed32(seed64: string, domain: WorldSeedDomain): number {
  const mixed = mix64(parseWorldSeed64(seed64) ^ DOMAIN_SALTS[domain]);
  return Number((mixed ^ (mixed >> 32n)) & 0xffffffffn);
}

function randomSeedWords(): WorldSeedWords {
  const words = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(words);
  } else {
    // Fallback for insecure local preview origins without Web Crypto.
    words[0] = Math.floor(Math.random() * 0x100000000);
    words[1] = Math.floor(Math.random() * 0x100000000);
  }
  return [words[0], words[1]];
}

/**
 * Generate a unique canonical seed against the locally saved worlds.
 * Accepts an injected word generator for deterministic unit tests.
 */
export function nextWorldSeed64(
  used: ReadonlySet<string>,
  randomWords: () => WorldSeedWords = randomSeedWords,
): string {
  for (let attempt = 0; attempt < 32; attempt++) {
    const [high, low] = randomWords();
    if (![high, low].every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) {
      throw new Error('Seed entropy must contain exactly two unsigned 32-bit words');
    }
    const candidate = ((BigInt(high) << 32n) | BigInt(low)).toString(10);
    if (!used.has(candidate)) return candidate;
  }
  let candidate = 0n;
  while (used.has(candidate.toString(10))) candidate++;
  if (candidate > MASK64) throw new Error('Every 64-bit world seed is already in use');
  return candidate.toString(10);
}

/**
 * Accept complete uint64 numbers, signed 64-bit negatives and stable phrase
 * seeds without ever converting their identity through a JavaScript number.
 */
export function parseWorldSeedInput64(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (text.length > 128) throw new RangeError('Keep seeds to 128 characters or fewer.');
  if (/^-?[0-9]+$/.test(text)) {
    const value = BigInt(text);
    if (value < -(1n << 63n) || value > MASK64) {
      throw new RangeError('Numeric seeds must fit in unsigned or signed 64-bit range.');
    }
    return (value & MASK64).toString(10);
  }
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash ^ BigInt(text.charCodeAt(i))) * 0x100000001b3n) & MASK64;
  }
  return hash.toString(10);
}
