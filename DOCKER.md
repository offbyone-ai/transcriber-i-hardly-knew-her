# Docker Deployment - Quick Start

## Prerequisites
- Docker & Docker Compose installed
- Port 3000 available

## Quick Deploy

### Production

```bash
# 1. Configure environment
cp .env.docker.example .env.docker

# 2. Generate secure secret
openssl rand -base64 32

# 3. Edit .env.docker and set:
#    - BETTER_AUTH_SECRET (paste the generated secret)
#    - BETTER_AUTH_URL (your domain or http://localhost:3000)

# 4. Build and run
docker-compose --env-file .env.docker up -d

# 5. View logs
docker-compose logs -f

# 6. Access app
open http://localhost:3000
```

### Development

```bash
# No .env file needed - uses dev defaults
docker-compose -f docker-compose.dev.yml up -d
```

## Build Optimizations

The Docker build uses Bun's advanced optimization flags:
- `--compile` - Compile to standalone executable
- `--minify` - Minify JavaScript code
- `--sourcemap` - Generate source maps for debugging
- `--bytecode` - Convert to bytecode for faster execution

**Result:** ~120MB final image (vs 500-800MB traditional Node.js)

## Docker Compose Files

- **`docker-compose.yml`** - Production-ready with resource limits and required secrets
- **`docker-compose.dev.yml`** - Development version with relaxed security

## Commands

### Production

```bash
# Build
docker-compose build

# Start/Stop
docker-compose --env-file .env.docker up -d
docker-compose down

# Logs
docker-compose logs -f transcriber

# Shell access
docker-compose exec transcriber sh

# Database backup
./scripts/backup-db.sh
```

### Development

```bash
# Start
docker-compose -f docker-compose.dev.yml up -d

# Stop
docker-compose -f docker-compose.dev.yml down

# Logs
docker-compose -f docker-compose.dev.yml logs -f
```

## Configuration

### Production (`docker-compose.yml`)
- **Resource limits:** 512MB RAM, 1 CPU
- **Required secrets:** BETTER_AUTH_SECRET must be set
- **Volume:** Named volume for data persistence
- **Health checks:** Automatic container health monitoring

### Development (`docker-compose.dev.yml`)
- **No resource limits:** Full system access
- **Default secrets:** Pre-configured for local testing
- **Separate volume:** Isolated from production data

Environment variables can be customized in `.env.docker`:
- `BETTER_AUTH_SECRET` - Auth secret (required for production)
- `BETTER_AUTH_URL` - Public URL where app is accessible
- `PORT` - Host port mapping (default: 3000)

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
