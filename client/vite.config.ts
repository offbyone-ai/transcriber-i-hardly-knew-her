import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  base: '/app',
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // User-controlled updates
      injectRegister: null, // We'll handle registration manually
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't precache the large ML model files
        globIgnores: ['**/onnx/**', '**/whisper/**'],
        // Allow larger files for WebLLM and Whisper
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        runtimeCaching: [
          {
            // Cache API responses (short-lived)
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache static assets from CDN
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Transcriber, I Hardly Knew Her',
        short_name: 'Transcriber',
        description: 'Privacy-first audio transcription - works offline with local AI',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/app',
        start_url: '/app',
        icons: [
          {
            src: '/app/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/app/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/app/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@client': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, '../server/src'),
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', 'onnxruntime-web'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
    plugins: () => [
      {
        name: 'configure-worker-transformers',
        config() {
          return {
            optimizeDeps: {
              // Don't pre-bundle in worker, let it be bundled normally
              include: ['@huggingface/transformers']
            }
          }
        }
      }
    ],
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      // Proxy API requests to the backend server in development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
