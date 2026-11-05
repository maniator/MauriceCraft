import type { ChunkRecord, WorldRecord, WorldStorage } from '../storage/world-storage';
import { WORLD_FILE_MAX_BYTES } from '../storage/world-archive-limits';
import { prepareImportedWorld, worldArchiveFilename } from './world-transfer';
import { deriveWorldSeed32, nextWorldSeed64, parseWorldSeedInput64, type WorldSeedWords } from '../world/seed64';

export interface SaveBatch {
  records: ChunkRecord[];
  /** Re-mark modified chunks so a failed write can be retried safely. */
  restoreDirty: () => void;
}

export interface WorldSessionDependencies {
  openStorage: () => Promise<WorldStorage>;
  isWorldReady: () => boolean;
  setWorldReady: (ready: boolean) => void;
  snapshotWorld: (world: WorldRecord) => WorldRecord;
  collectSaveBatch: (world: WorldRecord) => SaveBatch;
  applyLoadedWorld: (world: WorldRecord, chunks: readonly ChunkRecord[]) => void;
  prepareNewWorld: (world: WorldRecord) => void;
  startPlaying: () => void;
  modeLabel: (mode: unknown) => string;
  showHint: (message: string, duration: number) => void;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, (now - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' h ago';
  return Math.floor(seconds / 86400) + ' d ago';
}

/** World names are human-readable; IDs must not depend on name or order. */
export const CURRENT_WORLD_GENERATOR_VERSION = 7;

/** Full 32-bit seeds; avoid reuse among locally saved worlds where possible. */
export function nextWorldSeed(worlds: readonly WorldRecord[], random: () => number = Math.random): number {
  const used = new Set(worlds.map(world => world.seed));
  for (let attempt = 0; attempt < 32; attempt++) {
    const seed = Math.floor(random() * 0x100000000) >>> 0;
    if (!used.has(seed)) return seed;
  }
  let seed = 0;
  while (used.has(seed)) seed = (seed + 1) >>> 0;
  return seed;
}

/**
 * Text seeds use stable UTF-16 string hashing. Numeric seeds keep their prior
 * signed/unsigned 32-bit meaning, so existing seed-sharing instructions work.
 */
export function parseWorldSeedInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 128) throw new RangeError('Keep seeds to 128 characters or fewer.');
  if (/^-?\d+$/.test(value)) {
    const seed = Number(value);
    if (!Number.isSafeInteger(seed) || seed < -2147483648 || seed > 4294967295) {
      throw new RangeError('Numeric seeds must be between -2147483648 and 4294967295.');
    }
    return seed >>> 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0;
  }
  return hash >>> 0;
}

/** New v5 world seed IDs stay distinct from locally stored worlds. */
export function nextSavedWorldSeed64(worlds: readonly WorldRecord[], randomWords?: () => WorldSeedWords): string {
  const occupied = new Set(worlds.map(world => world.seed64 ?? String(world.seed)));
  return nextWorldSeed64(occupied, randomWords);
}

export function nextWorldName(worlds: readonly WorldRecord[]): string {
  let highestNumber = 0;
  for (const world of worlds) {
    const match = /^World (\d+)$/.exec(world.name);
    if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
  }
  return 'World ' + (highestNumber + 1);
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error('World session is missing #' + id);
  return element as T;
}

/**
 * Owns the IndexedDB connection, serialized autosaves, menu world list, and
 * world lifecycle. Gameplay state remains with the game runtime callbacks.
 */
export function createWorldSession(deps: WorldSessionDependencies) {
  const worldsElement = requireElement<HTMLElement>('worlds');
  const storageNotice = requireElement<HTMLElement>('saveNote');
  const subtitle = requireElement<HTMLElement>('sub');
  const playButton = requireElement<HTMLButtonElement>('play');
  const newWorldButton = requireElement<HTMLButtonElement>('newworld');
  const saveButton = requireElement<HTMLButtonElement>('saveWorld');
  const importButton = requireElement<HTMLButtonElement>('importWorld');
  const importFileInput = requireElement<HTMLInputElement>('importWorldFile');
  const worldSeedInput = requireElement<HTMLInputElement>('worldSeed');
  worldSeedInput.addEventListener('input', () => worldSeedInput.setCustomValidity(''));
  let database: WorldStorage | null = null;
  let storageAvailable = false;
  let currentWorld: WorldRecord | null = null;
  let worlds: WorldRecord[] = [];
  let pendingSave: Promise<void> = Promise.resolve();
  let busy = false;
  let worldRevision = 0;
  let currentPauseToken: number | null = null;
  window.addEventListener('mauricecraft:world-mutated', () => { worldRevision++; });
  window.addEventListener('mauricecraft:menu-paused', event => {
    currentPauseToken = (event as CustomEvent<number>).detail;
  });

  async function persistSnapshot(): Promise<void> {
    if (!storageAvailable || !database || !currentWorld || !deps.isWorldReady()) return;
    const revision = worldRevision;
    const pauseToken = currentPauseToken;
    const metadata = deps.snapshotWorld(currentWorld);
    const batch = deps.collectSaveBatch(metadata);
    try {
      await database.saveWorld(metadata, batch.records);
      // The persisted snapshot, not the request time or an older menu save,
      // establishes which paused settings can safely survive a worker reload.
      window.dispatchEvent(new CustomEvent('mauricecraft:world-persisted', {
        detail: { revision, pauseToken },
      }));
    } catch (error) {
      batch.restoreDirty();
      throw error;
    }
  }

  /** Explicit save/export callers must see failures, not a swallowed rejection. */
  function saveWorldVerified(): Promise<void> {
    if (!storageAvailable || !database || !currentWorld || !deps.isWorldReady()) {
      return Promise.reject(new Error('This world is not ready for saving.'));
    }
    const attempt = pendingSave.then(persistSnapshot);
    pendingSave = attempt.catch(error => {
      console.error('MauriceCraft save failed:', error);
      deps.showHint('Saving failed. Your changes are still in memory; keep this tab open and try again.', 6500);
    });
    return attempt;
  }

  function saveWorld(reason?: 'menu', pauseToken?: number): Promise<void> {
    if (!storageAvailable || !database || !currentWorld || !deps.isWorldReady()) return pendingSave;
    const attempt = saveWorldVerified();
    if (reason === 'menu' && pauseToken !== undefined) {
      void attempt.then(() => {
        window.dispatchEvent(new CustomEvent<number>('mauricecraft:menu-saved', { detail: pauseToken }));
      }).catch(() => {});
    }
    return attempt.catch(() => {});
  }

  function setBusy(isBusy: boolean, status?: string): void {
    busy = isBusy;
    playButton.disabled = isBusy;
    newWorldButton.disabled = isBusy;
    saveButton.disabled = isBusy || !storageAvailable;
    importButton.disabled = isBusy || !storageAvailable;
    worldSeedInput.disabled = isBusy;
    worldsElement.classList.toggle('busy', isBusy);
    if (isBusy) {
      playButton.textContent = 'Loading…';
      subtitle.textContent = status ?? 'Loading…';
    }
  }

  function renderWorldList(): void {
    worldsElement.replaceChildren();
    storageNotice.textContent = storageAvailable
      ? 'Worlds save automatically in this browser, including every block you change.'
      : 'Saving is not available in this browser, so this world will be lost when you leave.';
    for (const world of worlds) {
      const selected = currentWorld?.id === world.id;
      const row = document.createElement('div');
      row.className = 'world' + (selected ? ' on' : '');
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'wmain';
      openButton.appendChild(document.createTextNode(world.name));
      const details = document.createElement('small');
      details.textContent = deps.modeLabel(world.mode) + ' · played ' +
        timeAgo(world.lastPlayed || world.created || Date.now()) +
        ' · Seed ' + (world.seedText ?? world.seed64 ?? world.seed) + ' · Terrain v' + (world.generatorVersion ?? 1);
      openButton.appendChild(details);
      openButton.addEventListener('click', () => {
        if (busy) return;
        if (selected) deps.startPlaying();
        else void loadWorld(world.id);
      });
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'wdel';
      deleteButton.textContent = 'Delete';
      deleteButton.setAttribute('aria-label', 'Delete ' + world.name);
      let confirmTimeout: ReturnType<typeof setTimeout> | undefined;
      deleteButton.addEventListener('click', () => {
        if (busy) return;
        if (confirmTimeout === undefined) {
          deleteButton.textContent = 'Sure?';
          deleteButton.classList.add('armed');
          confirmTimeout = setTimeout(() => {
            confirmTimeout = undefined;
            deleteButton.textContent = 'Delete';
            deleteButton.classList.remove('armed');
          }, 2500);
        } else {
          clearTimeout(confirmTimeout);
          confirmTimeout = undefined;
          void deleteWorld(world.id);
        }
      });
      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.className = 'wexport';
      exportButton.textContent = 'Export';
      exportButton.setAttribute('aria-label', 'Export ' + world.name);
      exportButton.disabled = !storageAvailable;
      exportButton.addEventListener('click', () => {
        if (!busy) void runTransfer('Exporting world…', () => exportWorld(world.id));
      });
      row.append(openButton, exportButton, deleteButton);
      worldsElement.appendChild(row);
    }
  }

  async function runTransfer(status: string, operation: () => Promise<string>): Promise<void> {
    if (busy) return;
    const oldPlayLabel = playButton.textContent;
    setBusy(true, status);
    try {
      const message = await operation();
      subtitle.textContent = message;
      deps.showHint(message, 3500);
    } catch (error) {
      console.error('MauriceCraft world transfer failed:', error);
      const reason = error instanceof Error ? error.message : 'Unknown error';
      subtitle.textContent = 'World operation failed: ' + reason;
      deps.showHint('World operation failed. Existing saves are unchanged. ' + reason, 6500);
    } finally {
      setBusy(false);
      playButton.textContent = oldPlayLabel;
      await refreshWorlds();
    }
  }

  async function exportWorld(id: string): Promise<string> {
    if (!database) throw new Error('Browser storage is unavailable.');
    // Ensure that an actively selected world includes every latest edit.
    if (currentWorld?.id === id) await saveWorldVerified();
    const world = await database.getWorld(id);
    if (!world) throw new Error('World not found.');
    const chunks = await database.getChunks(id);
    // The binary archive codec is needed only for explicit exports.
    const { encodeWorldArchive } = await import('../storage/world-archive');
    const bytes = encodeWorldArchive(world, chunks);
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = worldArchiveFilename(world.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'Exported ' + world.name + ' as a .mcraft file.';
  }

  async function importWorld(file: File): Promise<string> {
    if (!database) throw new Error('Browser storage is unavailable.');
    if (file.size < 24 || file.size > WORLD_FILE_MAX_BYTES) {
      throw new Error('Choose a valid .mcraft world file up to 256 MB.');
    }
    // Keep the archive parser out of normal gameplay and startup downloads.
    const { decodeWorldArchive } = await import('../storage/world-archive');
    const archive = decodeWorldArchive(new Uint8Array(await file.arrayBuffer()));
    if ((archive.world.generatorVersion ?? 1) > CURRENT_WORLD_GENERATOR_VERSION) {
      throw new Error('This world needs a newer MauriceCraft terrain version.');
    }
    if (currentWorld && deps.isWorldReady()) await saveWorldVerified();
    // Fresh UUID prevents collisions with saves from other browsers and devices.
    const id = 'w' + crypto.randomUUID().replace(/-/g, '');
    const imported = prepareImportedWorld(archive, await database.listWorlds(), id);
    await database.importWorld(imported.world, imported.chunks);
    return 'Imported ' + imported.world.name + '. Select it under Worlds to play.';
  }

  saveButton.addEventListener('click', () => {
    if (!busy) void runTransfer('Saving world…', async () => {
      await saveWorldVerified();
      return 'World saved successfully.';
    });
  });
  importButton.addEventListener('click', () => {
    if (!busy && storageAvailable) importFileInput.click();
  });
  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files?.[0];
    importFileInput.value = '';
    if (file && !busy) void runTransfer('Importing world…', () => importWorld(file));
  });

  async function refreshWorlds(): Promise<void> {
    if (storageAvailable && database) {
      try {
        worlds = (await database.listWorlds()).sort((left, right) => right.lastPlayed - left.lastPlayed);
      } catch (error) {
        console.error('MauriceCraft could not refresh world list:', error);
      }
    }
    renderWorldList();
  }

  function finishLoad(): void {
    if (!currentWorld) return;
    subtitle.textContent = currentWorld.name + '. Choose a mode and play.';
    playButton.textContent = 'Play';
    setBusy(false);
    renderWorldList();
    playButton.focus({ preventScroll: true });
  }

  async function loadWorld(id: string): Promise<void> {
    if (!database) return;
    setBusy(true, 'Loading world…');
    try {
      await saveWorld();
      deps.setWorldReady(false);
      const world = await database.getWorld(id);
      if (!world) throw new Error('World metadata not found');
      const storedChunks = await database.getChunks(id);
      currentWorld = world;
      await new Promise(resolve => setTimeout(resolve, 20));
      deps.applyLoadedWorld(world, storedChunks);
      finishLoad();
    } catch (error) {
      console.error('MauriceCraft could not load world:', error);
      deps.setWorldReady(false);
      currentWorld = null;
      setBusy(false);
      playButton.disabled = true;
      subtitle.textContent = 'Could not load this world. Its save is still in your browser. Select another world or create a new one.';
      deps.showHint('World load failed. Your saved data was not deleted.', 6000);
      renderWorldList();
    }
  }

  async function newWorld(seedOverride: string | null = null, seedText?: string): Promise<void> {
    setBusy(true, 'Building your world…');
    await saveWorld();
    deps.setWorldReady(false);
    await new Promise(resolve => setTimeout(resolve, 20));
    const now = Date.now();
    const seed64 = seedOverride ?? nextSavedWorldSeed64(worlds);
    const world: WorldRecord = {
      id: 'w' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36),
      name: nextWorldName(worlds), seed: deriveWorldSeed32(seed64, 'terrain'), seed64,
      generatorVersion: CURRENT_WORLD_GENERATOR_VERSION,
      ...(seedText ? { seedText } : {}),
      created: now, lastPlayed: now,
    };
    currentWorld = world;
    deps.prepareNewWorld(world);
    worldSeedInput.value = '';
    await saveWorld();
    await refreshWorlds();
    finishLoad();
  }

  async function deleteWorld(id: string): Promise<void> {
    if (busy || !database) return;
    const deletingCurrentWorld = currentWorld?.id === id;
    setBusy(true, 'Deleting…');
    try {
      await pendingSave;
      await database.deleteWorld(id);
    } catch (error) {
      console.error('MauriceCraft could not delete world:', error);
      setBusy(false);
      subtitle.textContent = 'World deletion failed. Your saved world has been kept.';
      deps.showHint('Could not delete the world. Its save has not been removed.', 5000);
      renderWorldList();
      return;
    }
    if (deletingCurrentWorld) {
      currentWorld = null;
      deps.setWorldReady(false);
    }
    await refreshWorlds();
    if (deletingCurrentWorld) {
      if (worlds.length) await loadWorld(worlds[0].id);
      else await newWorld();
    } else {
      setBusy(false);
    }
  }

  async function initialize(): Promise<void> {
    try {
      database = await deps.openStorage();
      storageAvailable = true;
    } catch (error) {
      console.warn('World storage unavailable; running in temporary mode:', error);
      storageAvailable = false;
    }
    if (storageAvailable && database) {
      try {
        worlds = (await database.listWorlds()).sort((a, b) => b.lastPlayed - a.lastPlayed);
      } catch (error) {
        console.error('Could not list saved worlds:', error);
        storageAvailable = false;
        worlds = [];
      }
    }
    renderWorldList();
    if (storageAvailable && worlds.length) await loadWorld(worlds[0].id);
    else await newWorld();
  }

  newWorldButton.addEventListener('click', () => {
    if (busy) return;
    let seed: string | null;
    try {
      seed = parseWorldSeedInput64(worldSeedInput.value);
    } catch (error) {
      worldSeedInput.setCustomValidity(error instanceof Error ? error.message : 'Invalid seed');
      worldSeedInput.reportValidity();
      worldSeedInput.focus();
      return;
    }
    void newWorld(seed, worldSeedInput.value.trim() || undefined)
      .catch(error => showWorldLifecycleError(error));
  });
  function showWorldLifecycleError(error: unknown): void {
    console.error('MauriceCraft world operation failed:', error);
    setBusy(false);
    subtitle.textContent = 'World operation failed. Your existing saved worlds have not been deleted.';
    deps.showHint('World operation failed. Check browser storage and try again.', 6000);
  }
  window.setInterval(() => {
    if (deps.isWorldReady()) void saveWorld();
  }, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveWorld();
  });
  window.addEventListener('pagehide', () => { void saveWorld(); });

  return { initialize, saveWorld, refreshWorlds,
    getSeedLabel: () => currentWorld?.seedText ?? currentWorld?.seed64 ?? String(currentWorld?.seed ?? 0),
    isStorageAvailable: () => storageAvailable };
}
