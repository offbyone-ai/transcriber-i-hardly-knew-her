import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Server port for API proxy (default 3000, configurable via API_PORT env var)
const API_PORT = process.env.API_PORT || process.env.PORT || 3000

// Detect if building for Tauri (native app)
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined

// PWA configuration (only used for web builds, not Tauri)
const pwaConfig = VitePWA({
  registerType: 'prompt',
  injectRegister: null,
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    globIgnores: ['**/onnx/**', '**/whisper/**'],
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 5,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'cdn-cache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 30,
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
})

// Mock for PWA virtual module when building for Tauri (no service worker needed)
const pwaMockPlugin = {
  name: 'pwa-mock',
  resolveId(id: string) {
    if (id === 'virtual:pwa-register/react') {
      return '\0virtual:pwa-register/react'
    }
    return null
  },
  load(id: string) {
    if (id === '\0virtual:pwa-register/react') {
      // Return a mock implementation for Tauri builds
      return `
        export function useRegisterSW() {
          return {
            needRefresh: [false, () => {}],
            offlineReady: [false, () => {}],
            updateServiceWorker: () => Promise.resolve(),
          }
        }
      `
    }
    return null
  },
}

export default defineConfig({
  // Use /app for web, / for Tauri native app
  base: isTauri ? '/' : '/app',
  plugins: [
    react(),
    tailwindcss(),
    // Only include PWA plugin for web builds, mock it for Tauri
    ...(isTauri ? [pwaMockPlugin] : [pwaConfig]),
  ],
  // Define Tauri environment variable for client-side detection
  define: {
    __TAURI_BUILD__: JSON.stringify(isTauri),
  },
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', '@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'export-pdf': ['jspdf'],
          'export-docx': ['docx'],
        },
      },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
      {
        name: 'configure-worker-transformers',
        config() {
          return {
            optimizeDeps: {
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
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
