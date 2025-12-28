# Docker Deployment - Quick Start

## Prerequisites
- Docker & Docker Compose installed
- Port 3000 available

## Quick Deploy

```bash
# 1. Configure environment
cp .env.docker.example .env.docker
# Edit .env.docker and set BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)

# 2. Build and run
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Access app
open http://localhost:3000
```

## Build Optimizations

The Docker build uses Bun's advanced optimization flags:
- `--compile` - Compile to standalone executable
- `--minify` - Minify JavaScript code
- `--sourcemap` - Generate source maps for debugging
- `--bytecode` - Convert to bytecode for faster execution

**Result:** ~120MB final image (vs 500-800MB traditional Node.js)

## Commands

```bash
# Build
docker-compose build

# Start/Stop
docker-compose up -d
docker-compose down

# Logs
docker-compose logs -f

# Shell access
docker-compose exec transcriber sh

# Database backup
docker cp transcriber-app:/app/data/auth.db ./backup-auth.db
```

## Configuration

Edit `docker-compose.yml` to customize:
- Port mapping (default: 3000)
- Environment variables
- Volume persistence
- Resource limits

## Documentation

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete deployment guide.

## Architecture

```
┌─────────────────────────────────────┐
│   Docker Container (~120MB)         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Bun Executable (~50MB)      │  │
│  │  - API Server (Hono)         │  │
│  │  - Static File Serving       │  │
│  │  - Auth (better-auth)        │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Static Files                │  │
│  │  - React App (built)         │  │
│  │  - CSS, JS, Assets           │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  SQLite Database (volume)    │  │
│  │  - User data                 │  │
│  │  - Sessions                  │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Production Deployment

1. Update `VITE_SERVER_URL` in Dockerfile build args
2. Set secure `BETTER_AUTH_SECRET` in .env.docker
3. Configure reverse proxy (Nginx/Caddy)
4. Enable HTTPS
5. Set up backups

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for production guide.
