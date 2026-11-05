import { describe, expect, it } from 'vitest';
import { deriveWorldSeed32, nextWorldSeed64, parseWorldSeed64, parseWorldSeedInput64 } from '../../src/game/world/seed64';

describe('lossless 64-bit world seeds', () => {
  it('parses the full unsigned uint64 range without floating-point rounding', () => {
    expect(parseWorldSeed64('0')).toBe(0n);
    expect(parseWorldSeed64('4294967296')).toBe(1n << 32n);
    expect(parseWorldSeed64('18446744073709551615')).toBe((1n << 64n) - 1n);
    for (const invalid of ['', '-1', '+1', '01', '1.1', '1e5', '18446744073709551616']) {
      expect(() => parseWorldSeed64(invalid)).toThrow('Invalid 64-bit world seed');
    }
  });

  it('accepts exact 64-bit numeric seeds, negatives and stable phrases', () => {
    expect(parseWorldSeedInput64('')).toBeNull();
    expect(parseWorldSeedInput64('  4294967296 ')).toBe('4294967296');
    expect(parseWorldSeedInput64('18446744073709551615')).toBe('18446744073709551615');
    expect(parseWorldSeedInput64('-1')).toBe('18446744073709551615');
    expect(parseWorldSeedInput64('MauriceCraft v5')).toBe(parseWorldSeedInput64(' MauriceCraft v5 '));
    expect(parseWorldSeedInput64('MauriceCraft v5')).not.toBe(parseWorldSeedInput64('mauricecraft v5'));
    for (const invalid of ['18446744073709551616', '-9223372036854775809', 'A'.repeat(129)]) {
      expect(() => parseWorldSeedInput64(invalid)).toThrow(RangeError);
    }
  });

  it('mixes the upper and lower 32 bits into two independent deterministic streams', () => {
    const lowOnly = '1';
    const highAndLow = '4294967297';
    const max = '18446744073709551615';
    for (const domain of ['terrain', 'features'] as const) {
      const first = deriveWorldSeed32(lowOnly, domain);
      const second = deriveWorldSeed32(highAndLow, domain);
      expect(first).not.toBe(second);
      expect(first).toBe(deriveWorldSeed32(lowOnly, domain));
      expect(second).toBe(deriveWorldSeed32(highAndLow, domain));
      for (const seed of [lowOnly, highAndLow, max]) {
        const word = deriveWorldSeed32(seed, domain);
        expect(word).toBeGreaterThanOrEqual(0);
        expect(word).toBeLessThan(0x100000000);
        expect(Number.isInteger(word)).toBe(true);
      }
    }
    expect(deriveWorldSeed32(max, 'terrain')).not.toBe(deriveWorldSeed32(max, 'features'));
  });

  it('avoids reuse of existing seeds and covers values beyond 32 bits', () => {
    const first = nextWorldSeed64(new Set(), () => [0xffffffff, 0xffffffff]);
    expect(first).toBe('18446744073709551615');
    const used = new Set([first, '3']);
    const generated = [[0xffffffff, 0xffffffff], [1, 0]] as const;
    let index = 0;
    expect(nextWorldSeed64(used, () => generated[index++])).toBe('4294967296');
  });

  it('falls back after repeated collisions and validates injected entropy', () => {
    expect(nextWorldSeed64(new Set(['0', '1']), () => [0, 0])).toBe('2');
    expect(() => nextWorldSeed64(new Set(), () => [-1, 0])).toThrow('unsigned 32-bit');
    expect(() => nextWorldSeed64(new Set(), () => [0, 0x100000000])).toThrow('unsigned 32-bit');
  });

  it('produces distinct full-world stream pairs for differing upper 32-bit words', () => {
    const streamPair = (seed: string) => [
      deriveWorldSeed32(seed, 'terrain'), deriveWorldSeed32(seed, 'features'),
    ];
    const signatures = Array.from({ length: 128 }, (_, high) =>
      streamPair(((BigInt(high) << 32n) | 123n).toString()).join(':'));
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});
