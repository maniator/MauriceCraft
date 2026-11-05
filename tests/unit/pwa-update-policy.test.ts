import { describe, expect, it, vi } from 'vitest';
import {
  canApplyUpdate,
  createDeferredReload,
  matchesCurrentSavedRevision,
} from '../../src/pwa/update-policy';

describe('safe automatic PWA updates', () => {
  it('updates on the initial menu only before any unsaved settings edits', () => {
    expect(canApplyUpdate(true, true, false, false)).toBe(true);
    expect(canApplyUpdate(true, true, false, false, true)).toBe(false);
    expect(canApplyUpdate(true, true, false, true, true)).toBe(true);
    // Persisted initial-menu edits have no gameplay pause token.
    expect(matchesCurrentSavedRevision({ pauseToken: null, revision: 1 }, null, 1, true)).toBe(
      true,
    );
    expect(matchesCurrentSavedRevision({ pauseToken: null, revision: 0 }, null, 1, true)).toBe(
      false,
    );
    expect(matchesCurrentSavedRevision({ pauseToken: null, revision: 1 }, null, 1)).toBe(false);
  });

  it('never reloads during gameplay or before the game menu is ready', () => {
    expect(canApplyUpdate(false, true, true, true)).toBe(false);
    expect(canApplyUpdate(true, false, false, false)).toBe(false);
  });

  it('waits until the paused world has been saved successfully', () => {
    expect(canApplyUpdate(true, true, true, false)).toBe(false);
    expect(canApplyUpdate(true, true, true, true)).toBe(true);
  });
  it('defers cross-tab controller takeover until this tab completes its own pause save', () => {
    let menuVisible = false;
    let currentPauseSaved = false;
    const reload = vi.fn();
    const gate = createDeferredReload(
      () => canApplyUpdate(menuVisible, true, true, currentPauseSaved),
      reload,
    );
    expect(gate.request()).toBe(false); // A different tab activated the worker.
    expect(reload).not.toHaveBeenCalled();
    menuVisible = true; // This tab opened its menu but has not saved yet.
    expect(gate.tryReload()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    currentPauseSaved = true;
    expect(gate.tryReload()).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(gate.tryReload()).toBe(false); // One reload only.

    // A later update cannot reuse a save confirmation from an earlier pause.
    currentPauseSaved = false;
    menuVisible = false;
    expect(gate.request()).toBe(false);
    currentPauseSaved = true; // Save completed, but the player resumed.
    expect(gate.tryReload()).toBe(false);
    menuVisible = true;
    expect(gate.tryReload()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('rejects an earlier pause or in-flight save after changing menu settings', () => {
    expect(matchesCurrentSavedRevision({ pauseToken: 4, revision: 0 }, 4, 0)).toBe(true);
    // Mode changes while the first pause write is still in flight.
    expect(matchesCurrentSavedRevision({ pauseToken: 4, revision: 0 }, 4, 1)).toBe(false);
    // After the newer mode/difficulty/weather snapshot actually commits.
    expect(matchesCurrentSavedRevision({ pauseToken: 4, revision: 1 }, 4, 1)).toBe(true);
    // A late success from an older pause never authorizes the current pause.
    expect(matchesCurrentSavedRevision({ pauseToken: 4, revision: 1 }, 5, 1)).toBe(false);
    // No stored world or active pause means updates must remain pending.
    expect(matchesCurrentSavedRevision({ pauseToken: null, revision: 1 }, null, 1)).toBe(false);
  });
});
