import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));

/**
 * Emit a version.json alongside the build so the backend can advertise
 * what UI build it is serving.  The frontend compares its baked-in
 * __APP_VERSION__ against this file on startup to detect stale caches.
 */
function versionFilePlugin(): Plugin {
  return {
    name: 'version-file',
    writeBundle(options) {
      const dir = options.dir ?? resolve(__dirname, 'dist');
      const content = JSON.stringify({
        version: pkg.version,
        buildTime: new Date().toISOString(),
      });
      writeFileSync(resolve(dir, 'version.json'), content);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    versionFilePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],

      // Force the new service worker to take control immediately on update
      // rather than waiting for all tabs to close.
      workbox: {
        skipWaiting: true,
        clientsClaim: true,

        // Navigation requests (HTML) always go to the network first so that
        // a freshly-installed Python package is never masked by a cached
        // index.html from a previous version.
        navigationPreload: false,
        runtimeCaching: [
          {
            // index.html and any SPA navigation — network-first, short cache
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 },
            },
          },
          {
            // Content-hashed /assets/ bundles are immutable — cache-first is fine
            // because their URLs change with every build.
            urlPattern: /\/assets\/.+\.[a-f0-9]{8}\.(js|css|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'immutable-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],

        // Clean up caches from older SW versions on activation
        cleanupOutdatedCaches: true,
      },

      manifest: {
        name: 'LANscape',
        short_name: 'LANscape',
        description: 'Local Network Scanner',
        theme_color: '#0a84ff',
        background_color: '#262626',
        display: 'minimal-ui',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // Base path - use relative for Electron file:// protocol compatibility
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000,
    open: process.env.VITE_NO_OPEN !== 'true',
    hmr: {
      port: 3001, // Use different port for HMR to avoid conflicts
    },
    host: true // Allow external connections
  }
})
