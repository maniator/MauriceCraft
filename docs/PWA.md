# Install and update MauriceCraft offline

MauriceCraft is an installable Progressive Web App (PWA) at
[maniator.github.io/MauriceCraft](https://maniator.github.io/MauriceCraft/).
It works as a standalone app on supported phones, Chromebooks and desktops.

## Install

1. Visit the live game **while online** and let the menu load.
2. Choose **Install MauriceCraft** when the button is offered, or use the browser's
   built-in Install app / Add to Home Screen menu (on iOS: Share → Add to Home Screen).
3. Open the installed app once while online. After the service worker finishes
   caching the build, reopening it without internet works.

The app icon includes 192px, 512px and maskable variants. Google Fonts are optional:
the game uses its bundled system-font fallback when offline.

## Automatic updates

`vite-plugin-pwa` uses Workbox to precache the production HTML, hashed JS/CSS chunks,
app icons and manifest. The updated worker downloads its asset list **before** offering an update.

The app checks for updates when it starts, becomes visible, reconnects to the
internet, and every hour while running. A ready update installs automatically
on the initial menu, or after you pause and the latest world snapshot has committed successfully and still matches the current
pause and menu-settings revision. Changes to mode, difficulty, or weather invalidate older save confirmations until the new settings persist. Another tab activating the worker cannot force a reload during gameplay.
**The app never forces a reload during active gameplay or after a failed save.**
If you close a tab while an update is waiting, browsers activate it after old
clients are gone, so the next launch uses the updated version.

HTML navigations use network-first with the cached game shell as an offline
fallback. Game assets are cached locally. Do not add network-only, critical
runtime assets without also including them in the offline build.

## Saves and storage

The Workbox service worker stores **only application files** in Cache Storage.
Worlds stay in the existing `blockcraft-worlds` IndexedDB on the same origin.
An update must never reset IndexedDB or purge world data. Clearing browser site
storage or uninstalling an app with storage deletion may still remove saves.

The PWA currently uses the GitHub Pages scope `/MauriceCraft/`. A custom domain
would use a **different browser origin**; worlds do not automatically transfer.
Add world export/import before moving the live game to a new domain.

## Verification

Run `npm run check:full`. Playwright tests check manifest icon dimensions,
service-worker installation, offline reload and persistent saved-world discovery
on desktop and mobile. Unit tests cover safe-update gating. The dev server
does **not** register a service worker; `npm run build && npm run preview` does.
