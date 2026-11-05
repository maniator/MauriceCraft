import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveManualChunk } from './src/build/manual-chunks.js';

// GitHub Pages project site is hosted under /MauriceCraft/.
export default defineConfig(({ command, isPreview }) => ({
  base: (command === 'build' || isPreview === true) ? '/MauriceCraft/' : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  plugins: [VitePWA({
    // Never forcibly reload gameplay; the client activates a waiting update
    // when the menu is shown after a successful saved-world write.
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      id: '/MauriceCraft/',
      name: 'MauriceCraft',
      short_name: 'MauriceCraft',
      description: 'Build, explore, and save voxel worlds, even offline.',
      start_url: '/MauriceCraft/',
      scope: '/MauriceCraft/',
      display: 'standalone',
      background_color: '#151e26',
      theme_color: '#151e26',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      navigateFallback: '/MauriceCraft/index.html',
      cleanupOutdatedCaches: true,
      skipWaiting: false,
      clientsClaim: true,
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
    },
  })],
}));
