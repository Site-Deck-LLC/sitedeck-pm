import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA shell (Sprint 9 Task 5)
    //
    // `registerType: 'autoUpdate'` means the new SW replaces the
    // old one as soon as it's installed — no "refresh to update"
    // prompt. The site is the PM's working tool; they should
    // never have to think about the shell.
    //
    // `injectRegister: 'auto'` lets the plugin handle the SW
    // registration glue in the built HTML.
    //
    // The manifest is declared inline so we don't need a separate
    // web-manifest.json file in the public/ folder — keeps the
    // PWA shell in a single config and matches the SiteDeck brand.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'favicon.svg'],
      manifest: {
        name: 'SiteDeck PM',
        short_name: 'SiteDeck',
        description: 'Construction project management for superintendents in the field.',
        theme_color: '#1B2A4A',
        background_color: '#F7F8FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell + key static assets on install.
        // Sprint 11: runtime caching for select GET endpoints so
        // field crews can keep working when the signal drops
        // (basements, rebar cages, metal buildings). Network-first
        // with 5-minute timeout fallback to cache. 1-hour expiry.
        // POST/PATCH/DELETE and the agent/notifications endpoints
        // are NEVER cached — those are always-live and could be
        // dangerous to replay.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Project list — needed for the landing screen.
            urlPattern: /^\/api\/v1\/projects(?:\?.*)?$/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-projects',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Schedule activities — needed for offline Gantt viewing.
            urlPattern: /^\/api\/v1\/projects\/[^/]+\/schedule\/activities/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-schedule',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // IFC drawing list — needed for offline reference on site.
            urlPattern: /^\/api\/v1\/projects\/[^/]+\/documents\/ifc/,
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-documents',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Don't enable the SW in `vite dev` — the offline page
        // would intercept HMR and confuse contributors.
        enabled: false,
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Target modern browsers only. The native fetch / dynamic
    // import / optional chaining baseline lets Vite skip the
    // compat polyfills that the default `modules` target keeps
    // around, shaving ~40KB off the initial bundle.
    target: 'es2020',
    rollupOptions: {
      output: {
        // Vendor splitting: keep `react` and `firebase` in their
        // own chunk so the hash stays stable across deploys that
        // only touch our app code. Browsers cache the vendor
        // chunk on the first visit; subsequent deploys don't
        // force a re-download of React.
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase'
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
