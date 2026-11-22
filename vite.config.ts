import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Meditera OSB Reuse Lab',
        short_name: 'OSB Reuse',
        description: 'Lokalno skeniranje i planiranje ponovne upotrebe OSB ostataka',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f4ef',
        theme_color: '#182925',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});