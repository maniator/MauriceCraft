# GitHub Pages deployment

The GitHub Pages site is a **project site** at `https://maniator.github.io/MauriceCraft/`. Vite builds assets with the `/MauriceCraft/` base and outputs static files to `dist/`.

## Repository setup

1. On **maniator/MauriceCraft**, open **Settings → Pages**.
2. Change **Build and deployment → Source** from **Deploy from a branch** to **GitHub Actions**.
3. Pushes to `main` automatically run `Deploy GitHub Pages`, independently of the `CI` workflow. The Pages workflow performs its own production build before publishing.
4. Browse to `https://maniator.github.io/MauriceCraft/` and verify that the menu starts and a saved world can load.

**Do not select `dist/` as a Pages branch directory.** It is generated, not committed. While branch publishing remains enabled, the source HTML will not work as a built Vite site, so switch to Actions once the workflow is committed. The Pages settings are not changed by source commits.

The site must remain at the same origin/path for existing browser saves to be reachable. If deploying to a custom domain later, adjust the Vite base and be aware that IndexedDB storage does not transfer to the new origin automatically.

## Verified deployment

`.github/workflows/ci.yml` independently checks ESLint, strict TypeScript, unit coverage, a production build, and desktop/mobile Playwright smoke tests. A push to `main` also starts `.github/workflows/pages.yml`, which checks out that push, installs dependencies with `npm ci`, and runs its own TypeScript/production build before uploading the artifact for the `/MauriceCraft/` Pages site. A failed Pages build prevents publication, but a failed or cancelled gameplay CI run does not block a valid Pages build. Pull-request runs do not trigger publication; manual deployments are limited to `main`.

The official `actions/deploy-pages` action caps each publication attempt at 10 minutes, even if a longer `timeout` input is supplied. If the first attempt fails, the workflow makes **one additional attempt**, which is a separate deployment rather than a continuous 20- or 30-minute window. Backend failures such as a stuck `updating_pages` status can still require a later rerun or GitHub intervention. Deployment jobs are serialized without cancelling an active publish, reducing the risk of leaving an orphaned Pages deployment. The previous published site remains available if a new deployment fails.

## Offline PWA deployment

The production Vite build generates the scoped `sw.js` service worker and web app manifest, precaching HTML, hashed JS/CSS and icon assets. Workbox downloads updates in the background, and each client tab waits for a verified saved-world state before reloading, including edits made while the initial world menu is visible. Saved worlds remain in IndexedDB and are never deleted during service-worker cache cleanup. See [PWA](PWA.md) for offline testing and device installation.

## Moving to a custom domain

An origin change creates a separate IndexedDB database. Before changing domains, export each world to a `.mcraft` file from the old site and import it on the new one. See [world transfer](WORLD_FILES.md).
