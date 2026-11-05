import type { ChunkRecord, WorldRecord } from '../storage/world-storage';
import { chunkDimension } from '../session/dimension-chunk-records';
import { deriveWorldSeed32, parseWorldSeed64 } from '../world/seed64';
import { WORLD_FILE_MAX_BYTES } from './world-archive-limits';
export { WORLD_FILE_MAX_BYTES } from './world-archive-limits';

// Versioned binary container (not an opaque JSON download).
// 8-byte magic, u16 version, u16 reserved, u32 metadata length, u32 chunk count,
// UTF-8 metadata, then [dimension u8, cx i32, cz i32, size u32, raw bytes]*,
// and a trailing CRC32 of everything preceding it. All numbers little endian.
const MAGIC = new TextEncoder().encode('MCWORLD1');
const VERSION = 1;
const HEADER_SIZE = 20;
const CHUNK_HEADER_SIZE = 13;
const MAX_FILE_BYTES = WORLD_FILE_MAX_BYTES;
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
// Runtime chunk layout is fixed at 16 × 16 blocks and 48 vertical blocks.
const CHUNK_BYTES = 16 * 16 * 48;
const MAX_CHUNKS = 25000;
const dimensions = ['overworld', 'nether', 'end'] as const;
export const WORLD_FILE_EXTENSION = '.mcraft';

export interface WorldArchive {
  world: WorldRecord;
  chunks: ChunkRecord[];
}

function checksum(bytes: Uint8Array, length = bytes.length): number {
  let value = 0xffffffff;
  for (let i = 0; i < length; i++) {
    value ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function position(value: unknown): value is Record<string, unknown> {
  return isObject(value) && finite(value.x) && finite(value.y) && finite(value.z);
}
function numberMap(value: unknown): boolean {
  return isObject(value) && Object.values(value).every(finite);
}
function validGameplayMetadata(record: Record<string, unknown>): boolean {
  const optional = (key: string, isValid: (value: unknown) => boolean): boolean =>
    record[key] === undefined || isValid(record[key]);
  const validDimension = (value: unknown): boolean =>
    typeof value === 'string' && dimensions.includes(value as (typeof dimensions)[number]);
  const validMode = (value: unknown): boolean =>
    ['creative', 'survival', 'adventure', 'spectator'].includes(String(value));
  const validDifficulty = (value: unknown): boolean =>
    ['peaceful', 'easy', 'normal', 'hard'].includes(String(value));
  const validRelic = (value: unknown): boolean => position(value) && typeof value.got === 'boolean';
  const validGolem = (value: unknown): boolean =>
    position(value) &&
    typeof value.kind === 'string' &&
    finite(value.hp) &&
    finite(value.hx) &&
    finite(value.hz);
  const validDrop = (value: unknown): boolean =>
    position(value) &&
    Number.isInteger(value.id) &&
    (value.id as number) > 0 &&
    Number.isInteger(value.count) &&
    (value.count as number) > 0 &&
    validDimension(value.dimension) &&
    finite(value.age);
  const validPlayer = (value: unknown): boolean =>
    position(value) && finite(value.yaw) && finite(value.pitch) && typeof value.fly === 'boolean';
  const validWeather = (value: unknown): boolean =>
    isObject(value) && typeof value.w === 'string' && finite(value.t) && finite(value.r);
  return (
    optional('seedText', (v) => typeof v === 'string' && v.length <= 128) &&
    optional('dimension', validDimension) &&
    optional('mode', validMode) &&
    optional('difficulty', validDifficulty) &&
    optional('enderDragonDefeated', (v) => typeof v === 'boolean') &&
    optional('omen', (v) => typeof v === 'boolean') &&
    optional('player', validPlayer) &&
    optional('spawn', (v) => v === null || position(v)) &&
    optional('portals', Array.isArray) &&
    optional('inv', numberMap) &&
    optional('toolWear', numberMap) &&
    optional(
      'hotbar',
      (v) => Array.isArray(v) && v.length === 9 && v.every((n) => Number.isInteger(n) && n >= 0),
    ) &&
    optional(
      'craftedRecipes',
      (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.length <= 256),
    ) &&
    optional('selected', (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 9) &&
    optional('tod', finite) &&
    optional('hp', finite) &&
    optional('hunger', finite) &&
    optional('sat', finite) &&
    optional('weather', validWeather) &&
    optional('relics', (v) => Array.isArray(v) && v.every(validRelic)) &&
    optional('golems', (v) => Array.isArray(v) && v.every(validGolem)) &&
    optional('itemDrops', (v) => Array.isArray(v) && v.every(validDrop))
  );
}

function validateWorld(data: unknown): asserts data is WorldRecord {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The file does not contain a world.');
  }
  const record = data as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    record.id.length < 1 ||
    record.id.length > 200 ||
    typeof record.name !== 'string' ||
    !record.name.trim() ||
    record.name.length > 200 ||
    typeof record.seed !== 'number' ||
    !Number.isInteger(record.seed) ||
    record.seed < -2147483648 ||
    record.seed > 0xffffffff ||
    !Number.isFinite(record.created) ||
    !Number.isFinite(record.lastPlayed)
  ) {
    throw new Error('The world metadata is invalid.');
  }
  if (
    record.generatorVersion !== undefined &&
    (!Number.isInteger(record.generatorVersion) || (record.generatorVersion as number) < 1)
  ) {
    throw new Error('The world has an invalid terrain generator version.');
  }
  if (((record.generatorVersion as number | undefined) ?? 1) >= 5) {
    if (typeof record.seed64 !== 'string') {
      throw new Error('The world is missing its canonical 64-bit seed.');
    }
    try {
      parseWorldSeed64(record.seed64);
      if (deriveWorldSeed32(record.seed64, 'terrain') !== record.seed) {
        throw new Error('The world 64-bit seed does not match its terrain seed.');
      }
    } catch {
      throw new Error('The world has invalid 64-bit seed metadata.');
    }
  }
  if (!validGameplayMetadata(record)) {
    throw new Error('The world contains invalid gameplay metadata.');
  }
}

function writeHeader(view: DataView, metadataSize: number, count: number): void {
  view.setUint16(8, VERSION, true);
  view.setUint16(10, 0, true);
  view.setUint32(12, metadataSize, true);
  view.setUint32(16, count, true);
}

function validateChunk(record: ChunkRecord): void {
  if (
    !Number.isInteger(record.cx) ||
    record.cx < -2147483648 ||
    record.cx > 2147483647 ||
    !Number.isInteger(record.cz) ||
    record.cz < -2147483648 ||
    record.cz > 2147483647 ||
    !(record.data instanceof Uint8Array) ||
    record.data.length !== CHUNK_BYTES ||
    !dimensions.includes(chunkDimension(record) as (typeof dimensions)[number])
  ) {
    throw new Error('The world contains an invalid chunk.');
  }
}

export function encodeWorldArchive(world: WorldRecord, chunks: readonly ChunkRecord[]): Uint8Array {
  validateWorld(world);
  if (chunks.length > MAX_CHUNKS) throw new Error('This world is too large to export.');
  const metadata = new TextEncoder().encode(JSON.stringify(world));
  if (metadata.length > MAX_METADATA_BYTES) throw new Error('World metadata is too large.');
  const seen = new Set<string>();
  let length = HEADER_SIZE + metadata.length + 4;
  for (const chunk of chunks) {
    validateChunk(chunk);
    const key = chunkDimension(chunk) + ':' + chunk.cx + ',' + chunk.cz;
    if (seen.has(key)) throw new Error('Duplicate chunks cannot be exported.');
    seen.add(key);
    length += CHUNK_HEADER_SIZE + chunk.data.length;
    if (length > MAX_FILE_BYTES) throw new Error('This world exceeds the 256 MB export limit.');
  }
  const bytes = new Uint8Array(length);
  bytes.set(MAGIC);
  const view = new DataView(bytes.buffer);
  writeHeader(view, metadata.length, chunks.length);
  bytes.set(metadata, HEADER_SIZE);
  let offset = HEADER_SIZE + metadata.length;
  for (const chunk of chunks) {
    const dimension = chunkDimension(chunk);
    bytes[offset] = dimensions.indexOf(dimension as (typeof dimensions)[number]);
    view.setInt32(offset + 1, chunk.cx, true);
    view.setInt32(offset + 5, chunk.cz, true);
    view.setUint32(offset + 9, chunk.data.length, true);
    offset += CHUNK_HEADER_SIZE;
    bytes.set(chunk.data, offset);
    offset += chunk.data.length;
  }
  view.setUint32(offset, checksum(bytes, offset), true);
  return bytes;
}

export function decodeWorldArchive(bytes: Uint8Array): WorldArchive {
  if (bytes.length < HEADER_SIZE + 4 || bytes.length > MAX_FILE_BYTES) {
    throw new Error('Unsupported or oversized world file.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error('Not a MauriceCraft .mcraft world file.');
  }
  if (view.getUint16(8, true) !== VERSION) {
    throw new Error('Unsupported world file version. Update MauriceCraft before importing.');
  }
  if (view.getUint16(10, true) !== 0) throw new Error('Unsupported world file flags.');
  const metadataSize = view.getUint32(12, true);
  const chunkCount = view.getUint32(16, true);
  if (metadataSize === 0 || metadataSize > MAX_METADATA_BYTES || chunkCount > MAX_CHUNKS) {
    throw new Error('The world file has invalid sizes.');
  }
  const end = bytes.length - 4;
  if (view.getUint32(end, true) !== checksum(bytes, end)) {
    throw new Error('The world file is damaged (checksum mismatch).');
  }
  if (HEADER_SIZE + metadataSize > end) throw new Error('The world file is truncated.');
  let world: unknown;
  try {
    world = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(HEADER_SIZE, HEADER_SIZE + metadataSize),
      ),
    ) as unknown;
  } catch {
    throw new Error('World metadata could not be read.');
  }
  validateWorld(world);
  let offset = HEADER_SIZE + metadataSize;
  const chunks: ChunkRecord[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < chunkCount; i++) {
    if (offset + CHUNK_HEADER_SIZE > end) throw new Error('The world file is truncated.');
    const dimension = dimensions[bytes[offset]];
    const cx = view.getInt32(offset + 1, true);
    const cz = view.getInt32(offset + 5, true);
    const size = view.getUint32(offset + 9, true);
    offset += CHUNK_HEADER_SIZE;
    if (!dimension || size !== CHUNK_BYTES || size > end - offset) {
      throw new Error('The world file contains an invalid chunk.');
    }
    const key = dimension + ':' + cx + ',' + cz;
    if (seen.has(key)) throw new Error('The world file contains duplicate chunks.');
    seen.add(key);
    chunks.push({
      k: '',
      w: world.id,
      cx,
      cz,
      ...(dimension === 'overworld' ? {} : { dimension }),
      data: bytes.slice(offset, offset + size),
    });
    offset += size;
  }
  if (offset !== end) throw new Error('The world file has unexpected trailing data.');
  return { world, chunks };
}
