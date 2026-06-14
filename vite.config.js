import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-*.png', 'icon-*.svg'],
      manifest: {
        name: 'CLMTP — Gestion d\'entrepôt',
        short_name: 'CLMTP',
        description: 'Logiciel de gestion d\'entrepôt multi-sites CLMTP',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        icons: [
          { src: '/icon-72.png',  sizes: '72x72',  type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-96.png',  sizes: '96x96',  type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-128.png', sizes: '128x128',type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-144.png', sizes: '144x144',type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-152.png', sizes: '152x152',type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-192.png', sizes: '192x192',type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-384.png', sizes: '384x384',type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512',type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'Stocks',   url: '/?page=stock',   icons: [{ src: '/icon-96.png', sizes: '96x96' }] },
          { name: 'Scanner',  url: '/?page=scanner', icons: [{ src: '/icon-96.png', sizes: '96x96' }] },
          { name: 'OR',       url: '/?page=ordres',  icons: [{ src: '/icon-96.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
})
