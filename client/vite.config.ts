import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/app',
  plugins: [react(), tailwindcss()],
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
  },
})
