import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const swBuildTag = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      filename: `sw-${swBuildTag}.js`,
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['spot-logo.svg'],
      manifest: {
        name: 'SPOT - 대구소프트웨어마이스터고 방송부',
        short_name: 'SPOT',
        id: '/',
        scope: '/',
        start_url: '/',
        lang: 'ko',
        description: '대구소프트웨어마이스터고 방송부 노래 신청 시스템',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['music', 'education', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        runtimeCaching: [
          {
            // 공개 읽기 전용 엔드포인트만 캐시 (인증/관리자 API 제외)
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && (
                url.pathname === '/api/songs/today' ||
                url.pathname === '/api/songs/schedule' ||
                url.pathname === '/api/songs/daily'
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-public-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/auth': 'http://localhost:4000',
      '/api': 'http://localhost:4000',
    },
  },
})
