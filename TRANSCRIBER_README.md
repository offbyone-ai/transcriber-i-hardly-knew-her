# Transcriber - I Hardly Knew Her

An offline-first, multi-tenant transcription application with local recording, local transcription (Whisper), and hierarchical organization.

## Features

- 🎙️ **Local Recording** - Record audio directly in the browser
- 🗣️ **Local Transcription** - Powered by Whisper.cpp (WASM)
- 📂 **Hierarchical Organization** - Subjects → Recordings
- 🔐 **Multi-tenant Auth** - Secure user authentication
- 💾 **Offline-First** - Works completely offline after initial auth
- 🎨 **7 Theme Presets** - Customizable color schemes
- 📱 **PWA Ready** - Install as a desktop/mobile app

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Bun + Hono
- **Auth**: better-auth with email/password
- **Database**: 
  - Server: bun:sqlite (auth data)
  - Client: Dexie/IndexedDB (user data)
- **Transcription**: Whisper.cpp (WebAssembly)
- **Monorepo**: BHVR stack (Bun + Hono + Vite + React)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Installation

```bash
# Install dependencies
bun install

# Start all services
bun run dev
```

This will start:
- Client: http://localhost:5173
- Server: http://localhost:3000

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server
BETTER_AUTH_SECRET=<your-secret-key-min-32-chars>
BETTER_AUTH_URL=http://localhost:3000

# Client
VITE_SERVER_URL=http://localhost:3000
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Available Theme Presets

1. **Default** - Light/Dark neutral grays
2. **Spotify** - Green on black
3. **Ghibli Studio** - Nature-inspired greens
4. **Marvel** - Bold reds and blues
5. **Ocean** - Cool blues and teals
6. **Sunset** - Warm oranges and yellows

Switch themes in the app settings or use the `useTheme()` hook.

## Development Status

See [PROGRESS.md](./PROGRESS.md) for detailed development status.

### ✅ Completed
- [x] Project setup (BHVR monorepo)
- [x] Tailwind CSS v4 + Theme system
- [x] better-auth configuration
- [x] Dexie/IndexedDB setup
- [x] Shared TypeScript types

### 🚧 Next Steps
- [ ] React Router setup
- [ ] UI components (shadcn/ui style)
- [ ] Authentication pages
- [ ] Recording functionality
- [ ] Whisper integration
- [ ] PWA configuration

## License

MIT
