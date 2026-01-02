import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import type { ApiResponse } from 'shared/dist'
import { auth } from './auth'
import { transcriptionRoutes } from './transcription-routes'

const app = new Hono()

// Custom logger middleware with microsecond precision
app.use('*', async (c, next) => {
  const start = performance.now()
  const method = c.req.method
  const path = c.req.path
  
  console.log(`<-- ${method} ${path}`)
  
  await next()
  
  const end = performance.now()
  const elapsed = end - start
  const status = c.res.status
  
  // Format timing with appropriate precision
  let timeStr: string
  if (elapsed < 1) {
    timeStr = `${(elapsed * 1000).toFixed(0)}μs`
  } else if (elapsed < 1000) {
    timeStr = `${elapsed.toFixed(0)}ms`
  } else {
    timeStr = `${(elapsed / 1000).toFixed(1)}s`
  }
  
  console.log(`--> ${method} ${path} ${status} ${timeStr}`)
})

// Security headers for SharedArrayBuffer and Web Workers with WASM
app.use('*', async (c, next) => {
  await next()
  
  // These headers are required for SharedArrayBuffer and proper Web Worker + WASM support
  c.header('Cross-Origin-Embedder-Policy', 'require-corp')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  c.header('Cross-Origin-Resource-Policy', 'same-origin')
})

// Security headers required for SharedArrayBuffer and WASM (used by transformers.js)
// These must be set on HTML pages, not assets
app.use('*', async (c, next) => {
  await next()
  
  // Only add these headers to HTML responses (not assets)
  const contentType = c.res.headers.get('content-type')
  if (contentType && contentType.includes('text/html')) {
    c.res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
    c.res.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  }
})

// CORS configuration - only for API routes
app.use('/api/*', cors({
  origin: (origin) => origin || 'http://localhost:5173',
  credentials: true,
}))

// Mount better-auth handler
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

// Mount server-side transcription routes
app.route('/api/transcription', transcriptionRoutes)

// API routes
app.get('/api', (c) => {
  return c.text('Transcriber API Server')
})

app.get('/api/hello', async (c) => {
  const data: ApiResponse = {
    message: "Hello from Transcriber API!",
    success: true
  }

  return c.json(data, { status: 200 })
})

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Diagnostic page for testing routing
app.get('/diagnostic', serveStatic({ path: './static/diagnostic.html' }))

// Serve landing page at root
app.get('/', serveStatic({ path: './landing/index.html' }))

// Serve landing page assets (CSS, images, etc.) from /landing/ directory
// This must come before any catch-all routes
app.use('/landing/*', serveStatic({ 
  root: './',
}))

// Serve React app static assets (must come before SPA routes)
// Vite builds assets with /app prefix, so we need to handle /app/assets/*
// Note: .ts files in assets are actually compiled JS (Vite worker outputs)
app.use('/app/assets/*', serveStatic({ 
  root: './static',
  rewriteRequestPath: (path) => path.replace(/^\/app/, ''),
  mimes: {
    ts: 'application/javascript',
    js: 'application/javascript',
    mjs: 'application/javascript',
  }
}))

// Also serve top-level /assets/* for backwards compatibility
app.use('/assets/*', serveStatic({ 
  root: './static',
  mimes: {
    ts: 'application/javascript',
    js: 'application/javascript',
    mjs: 'application/javascript',
  }
}))

// Serve favicon.svg at both /app/favicon.svg (used by app) and /favicon.svg
app.get('/app/favicon.svg', serveStatic({ path: './static/favicon.svg' }))
app.get('/favicon.svg', serveStatic({ path: './static/favicon.svg' }))

// Serve React app at /app, /login, /signup routes (these need the SPA)
app.get('/app', serveStatic({ path: './static/index.html' }))
app.get('/login', serveStatic({ path: './static/index.html' }))
app.get('/signup', serveStatic({ path: './static/index.html' }))

// SPA fallback: serve index.html for all other /app/* routes (client-side routing)
// This must come LAST to avoid catching asset requests
app.get('/app/*', serveStatic({ path: './static/index.html' }))

export default app

// Start server when running in dev mode (not compiled executable)
// Note: When compiled with `bun build --compile`, Bun automatically starts
// the server using the exported default app, so this block is skipped
if (import.meta.main && !Bun.main.includes('transcriber')) {
  const port = process.env.PORT || 3000
  console.log(`🚀 Transcriber server starting on port ${port}`)
  
  Bun.serve({
    fetch: app.fetch,
    port: Number(port),
  })
  
  console.log(`✅ Server running at http://localhost:${port}`)
}
