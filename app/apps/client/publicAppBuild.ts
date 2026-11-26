import type { Plugin, PluginOption } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The public web app (T-168): the same client, built with its own entry
 * (`src/publicApp.tsx`) as a PWA for static hosting on Cloudflare Pages.
 * Its service worker precaches the app (the browser server and its
 * sqlite-wasm too, T-175) and keeps the church's reads from the bucket, so
 * it opens and works offline.
 */
export const isPublicAppBuild = process.env.VITE_PUBLIC_APP === '1'

/** Base path: `/` on Pages; a preview serves it under its own path. */
export const publicAppBase = process.env.VITE_PUBLIC_BASE || '/'

/** The desktop entry in index.html, swapped for the public app's. */
function publicEntry(): Plugin {
  return {
    name: 'church-hub-public-entry',
    transformIndexHtml: {
      // Before Vite reads the entry scripts out of the page.
      order: 'pre',
      handler: (html) => html.replace('/src/router.tsx', '/src/publicApp.tsx'),
    },
  }
}

export function publicAppPlugins(): PluginOption[] {
  return [
    publicEntry(),
    VitePWA({
      registerType: 'autoUpdate',
      // index.html already links public/site.webmanifest.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,webmanifest,wasm}'],
        // The app's largest chunks and the browser server are a few MB.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // head.json: the newest when online, the last one offline.
            urlPattern: ({ url }) =>
              url.pathname.includes('/churches/') &&
              url.pathname.endsWith('/head.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'church-head',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8 },
            },
          },
          {
            // Snapshots and segments never change once written.
            urlPattern: ({ url }) =>
              /\/churches\/[^/]+\/(snap|log)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'church-library',
              expiration: { maxEntries: 200 },
            },
          },
          {
            // The church's media index (cloud-media): the newest when
            // online, the last one offline.
            urlPattern: ({ url }) =>
              /\/churches\/[^/]+\/media\/index\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'church-media-index',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8 },
            },
          },
          {
            // Media files are named by their content: kept once loaded, so
            // they show offline. Images load as <img> (opaque, status 0);
            // a video's range requests are answered from a whole copy.
            urlPattern: ({ url }) =>
              /\/churches\/[^/]+\/media\/[0-9a-f]{64}$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'church-media',
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
              expiration: { maxEntries: 500, purgeOnQuotaError: true },
            },
          },
        ],
      },
    }),
  ]
}
