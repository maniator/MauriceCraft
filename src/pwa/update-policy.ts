/** Only change app versions when the menu is ready and saved gameplay is safe. */
export function canApplyUpdate(
  menuVisible: boolean,
  gameReady: boolean,
  played: boolean,
  savedAfterPlaying: boolean,
  menuEdited = false,
): boolean {
  return menuVisible && gameReady && ((!played && !menuEdited) || savedAfterPlaying);
}

/** A controlling worker can belong to another tab. Reload only this tab when safe. */
export function createDeferredReload(isSafe: () => boolean, reload: () => void) {
  let pending = false;
  const tryReload = (): boolean => {
    if (!pending || !isSafe()) return false;
    pending = false;
    reload();
    return true;
  };
  return {
    request(): boolean {
      pending = true;
      return tryReload();
    },
    tryReload,
  };
}

/** A successful write only authorizes the pause that captured its snapshot. */
export function matchesCurrentSavedRevision(
  persisted: { pauseToken: number | null; revision: number },
  activePauseToken: number | null,
  activeRevision: number,
  allowInitialMenu = false,
): boolean {
  if (persisted.revision !== activeRevision) return false;
  if (activePauseToken === null) return allowInitialMenu && persisted.pauseToken === null;
  return persisted.pauseToken === activePauseToken;
}
