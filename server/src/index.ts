import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import type { ApiResponse } from 'shared/dist'
import { auth } from './auth'

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
    timeStr = `${elapsed.toFixed(2)}ms`
  } else {
    timeStr = `${(elapsed / 1000).toFixed(2)}s`
  }
  
  console.log(`--> ${method} ${path} ${status} ${timeStr}`)
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
app.use('/app/assets/*', serveStatic({ 
  root: './static',
  rewriteRequestPath: (path) => path.replace(/^\/app/, ''),
}))

// Also serve top-level /assets/* for backwards compatibility
app.use('/assets/*', serveStatic({ 
  root: './static',
}))

// Serve vite.svg at both /app/vite.svg (used by app) and /vite.svg
app.get('/app/vite.svg', serveStatic({ path: './static/vite.svg' }))
app.get('/vite.svg', serveStatic({ path: './static/vite.svg' }))

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
