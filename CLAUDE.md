# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Transcriber is a privacy-first audio transcription app using the BHVR stack (Bun + Hono + Vite + React). All transcription runs locally in the browser via Whisper.cpp/WASM - no audio leaves the device.

## Commands

```bash
# Development
bun run dev              # Start all services (client + server)
bun run dev:client       # Vite dev server at http://localhost:5173
bun run dev:server       # Hono backend at http://localhost:3000

# Building
bun run build            # Build all workspaces with Turbo caching
bun run build:single     # Production: client → copy to server/static → compile executable

# Testing
bun run test             # Run vitest across workspaces
bun run test:e2e         # Playwright E2E tests
bun run test:e2e:headed  # E2E with visible browser

# Quality
bun run lint             # ESLint
bun run type-check       # TypeScript checking

# Database (server workspace)
bun run db:generate      # Generate Drizzle migrations
bun run db:migrate       # Run migrations
bun run db:push          # Push schema to database
bun run db:studio        # Open Drizzle Studio
```

## Architecture

### Monorepo Structure

Three workspaces managed by Turbo:
- **client/** - React 19 + Vite PWA with offline-first IndexedDB storage
- **server/** - Bun + Hono API with SQLite/Drizzle for auth only
- **shared/** - TypeScript types used across client and server

### Key Architectural Decisions

1. **Offline-First**: Core data (recordings, transcriptions, subjects) stored in IndexedDB via Dexie.js. Server only stores authentication data.

2. **Client-Side ML**: Whisper transcription runs in a Web Worker (`client/src/workers/transcription.worker.ts`) using @huggingface/transformers. Models (40-250MB) cached in browser after first download.

3. **Path Aliases**: Use `@/` for workspace-local imports, `@client/`, `@server/`, `@shared/` for cross-workspace.

4. **Shared Types**: Import from `shared` package for types used across boundaries.

5. **CORS Headers for WASM**: Vite configured with `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin` for SharedArrayBuffer support.

### Authentication

better-auth with SQLite backend supporting email/password and passkeys. Schema in `server/src/db/schema/auth-schema.ts`.

## Testing

- **Unit**: Vitest with happy-dom, React Testing Library
- **E2E**: Playwright (Chrome only, sequential execution)
- Config files: `client/vitest.config.ts`, `playwright.config.ts`

## Deployment

Production builds compile to a single Bun executable (~69MB) serving both API and static files. Docker images use Alpine runtime (~120MB total).

Required env vars:
```
BETTER_AUTH_SECRET=<min-32-chars>
BETTER_AUTH_URL=https://your-domain.com
```

## Domain Model

Users → Subjects → Recordings → Transcriptions (with word-level timestamps)

Multiple Whisper model sizes available: tiny.en, base.en, small.en
