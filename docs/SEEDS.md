# World seeds and generator compatibility

MauriceCraft's seed is the identity of a procedurally generated world. Starting
with **terrain generator v5**, new worlds use the full unsigned 64-bit range
(0 through 18446744073709551615), represented as decimal strings in saved
metadata. JavaScript `number` cannot safely represent all these values.

## Entering and sharing seeds

The New World field accepts positive 64-bit integers, signed 64-bit negative
integers (two's-complement conversion), and phrases of at most 128 characters.
The same input text always maps to the same 64-bit world seed in generator v5.
The world list shows the original entered text (when supplied), and the `/seed`
command shows the canonical 64-bit decimal value for sharing. Random worlds
generate two 32-bit entropy words and combine both halves losslessly.

## Preserving existing worlds

- **v1–v4** worlds keep their exact stored numeric 32-bit seed and original
  generation rules, including all unexplored terrain. **Do not upgrade their
  `generatorVersion` in place.**
- **v5** records add `seed64` to the existing `worlds` metadata and retain
  `seed` as a deterministically mixed 32-bit terrain stream for existing
  noise algorithms. An independent feature stream uses the same full 64-bit
  identity with different domain separation.
- **v6** worlds (including existing exported `.mcraft` saves) preserve their
  original Nether terrain generation for every unvisited chunk.
- **v7** newly created worlds add deterministic biome vegetation, glowing
  cave formations, and distinctive rock outcrops in the Nether. Decoration
  is gated by generator version, so importing or loading a v6 world does not
  silently alter its landscape. Creative and Peaceful mob-spawning fixes
  apply to all world versions without changing saved terrain.
- Restoring a v5 world validates the canonical seed and its derived terrain
  stream before resetting runtime state. An invalid record is left untouched
  and the user is shown a load error; there is no silent regeneration.
- IndexedDB schema, database name, chunk keys, block IDs and saves from
  older versions are unchanged.

## Performance and tests

SplitMix64-derived values are calculated only on world creation/restore,
not for each block or noise sample. Tests verify lossless unsigned-range
parsing, upper-half avalanche, distinct feature streams, collision handling,
v4 compatibility, damaged-v5 rejection, and mobile/desktop save/reload.
