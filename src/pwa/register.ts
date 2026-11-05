import { registerSW } from 'virtual:pwa-register';
import { canApplyUpdate, createDeferredReload, matchesCurrentSavedRevision } from './update-policy';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** Register Workbox and activate downloaded versions only when safe to reload. */
export function setupPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const installButton = document.getElementById('installApp') as HTMLButtonElement | null;
  let installPrompt: InstallPromptEvent | null = null;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener('click', () => {
    if (!installPrompt) return;
    const pending = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    void pending
      .prompt()
      .then(() => pending.userChoice)
      .catch(() => {});
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
  });

  const overlay = document.getElementById('overlay');
  const playButton = document.getElementById('play') as HTMLButtonElement | null;
  let played = false;
  let savedAfterPlaying = false;
  let menuEdited = false;
  let currentPauseToken: number | null = null;
  let worldRevision = 0;
  let updateAvailable = false;
  let applying = false;
  // A different tab can activate a waiting worker while this tab is playing.
  // The controlling event must not reload until this tab has saved its own edits.
  const safeToApply = (): boolean =>
    canApplyUpdate(
      !!overlay && !overlay.classList.contains('hidden'),
      playButton?.disabled === false,
      played,
      savedAfterPlaying,
      menuEdited,
    );
  const deferredReload = createDeferredReload(safeToApply, () => window.location.reload());
  function activateIfSafe(): void {
    if (deferredReload.tryReload() || !safeToApply()) return;
    if (!updateAvailable || applying) return;
    applying = true;
    // Workbox precaches the complete new build before this message is sent.
    void updateSW(true);
  }

  playButton?.addEventListener('click', () => {
    played = true;
    savedAfterPlaying = false;
    currentPauseToken = null;
  });
  window.addEventListener('mauricecraft:menu-paused', (event) => {
    currentPauseToken = (event as CustomEvent<number>).detail;
    savedAfterPlaying = false;
  });
  window.addEventListener('mauricecraft:world-mutated', () => {
    worldRevision++;
    menuEdited = true;
    // An older save can finish during a menu settings change. Wait for the
    // write that actually includes the newest revision before reloading.
    savedAfterPlaying = false;
  });
  window.addEventListener('mauricecraft:world-persisted', (event) => {
    const persisted = (event as CustomEvent<{ revision: number; pauseToken: number | null }>)
      .detail;
    if (!matchesCurrentSavedRevision(persisted, currentPauseToken, worldRevision, !played)) return;
    menuEdited = false;
    savedAfterPlaying = true;
    activateIfSafe();
  });
  if (overlay) {
    new MutationObserver(() => {
      // Starting a world from its row also hides the overlay without clicking Play.
      if (overlay.classList.contains('hidden')) {
        played = true;
        savedAfterPlaying = false;
        currentPauseToken = null;
      }
      activateIfSafe();
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }
  if (playButton) {
    new MutationObserver(activateIfSafe).observe(playButton, {
      attributes: true,
      attributeFilter: ['disabled'],
    });
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedReload() {
      // Workbox controlling fires in every open tab, not only the tab which
      // called updateSW(). Override the library's unconditional reload.
      deferredReload.request();
    },
    onNeedRefresh() {
      updateAvailable = true;
      activateIfSafe();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = (): void => {
        if (navigator.onLine) void registration.update().catch(() => {});
      };
      check();
      window.setInterval(check, 60 * 60 * 1000);
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    },
    onRegisterError(error) {
      console.warn('Offline installation is unavailable:', error);
    },
  });
}
