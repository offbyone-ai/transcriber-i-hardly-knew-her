# Docker Deployment Guide

Complete guide for deploying the Transcriber app using Docker with Bun executable optimization.

---

## Overview

The Transcriber app uses a multi-stage Docker build that compiles the server into a standalone Bun executable for optimal performance and minimal image size.

### Key Features
- **Bun Executable:** Server compiled to standalone binary
- **Multi-stage Build:** Minimal final image size
- **Static File Serving:** Client build served directly from server
- **SQLite Persistence:** Database stored in Docker volume
- **Health Checks:** Built-in container health monitoring
- **Efficient:** Low memory and CPU usage

---

## Prerequisites

- Docker 20.10+ ([installation guide](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ ([installation guide](https://docs.docker.com/compose/install/))
- 2GB+ available disk space
- Port 3000 available (or configure different port)

---

## Quick Start

### 1. Configure Environment

```bash
# Copy environment template
cp .env.docker.example .env.docker

# Generate secure auth secret
openssl rand -base64 32

# Edit .env.docker and set BETTER_AUTH_SECRET
nano .env.docker
```

### 2. Build and Run

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Access Application

Open browser to: `http://localhost:3000`

---

## Build Process

The `build:single` script creates a production-ready deployment:

```bash
# Step 1: Build all packages (shared, client, server)
bun run build

# Step 2: Copy client build to server/static
bun run copy:static

# Step 3: Compile server to standalone executable
bun run build:executable
```

### What Gets Built

**Client Build (`client/dist`):**
- Optimized JavaScript bundles
- Minified CSS
- Static assets
- index.html with routing support

**Server Executable (`server/transcriber`):**
- Standalone Bun binary (~50MB)
- Includes all dependencies
- No node_modules needed
- Serves client + API

---

## Docker Image Architecture

### Stage 1: Build (oven/bun:1.3.4-slim)
- Install dependencies
- Build all packages
- Compile to executable
- ~800MB temporary image

### Stage 2: Runtime (chainguard/glibc-dynamic:latest)
- Copy executable only
- Copy static files
- Minimal base image (~50MB)
- Final image: ~120MB total

### Image Size Comparison
- Traditional Node.js image: ~500-800MB
- Bun with node_modules: ~300-400MB
- **Bun executable (this):** ~120MB

---

## Configuration

### Environment Variables

**Required:**
```env
BETTER_AUTH_SECRET=<generated-secret-min-32-chars>
BETTER_AUTH_URL=http://localhost:3000
```

**Optional:**
```env
NODE_ENV=production
PORT=3000
DATABASE_PATH=/app/data/auth.db
```

### Docker Compose Variables

Edit `docker-compose.yml` to customize:

```yaml
ports:
  - "3000:3000"  # Change to "8080:3000" for port 8080

volumes:
  - transcriber-data:/app/data  # Named volume for persistence

environment:
  PORT: 3000  # Internal container port
```

---

## Volume Management

### Database Persistence

SQLite database is stored in Docker volume:

```bash
# List volumes
docker volume ls | grep transcriber

# Inspect volume
docker volume inspect transcriber_transcriber-data

# Backup database
docker cp transcriber-app:/app/data/auth.db ./backup-auth.db

# Restore database
docker cp ./backup-auth.db transcriber-app:/app/data/auth.db
```

### Volume Location

**Linux:** `/var/lib/docker/volumes/transcriber_transcriber-data/_data`  
**Mac:** `~/Library/Containers/com.docker.docker/Data/vms/0/`  
**Windows:** `\\wsl$\docker-desktop-data\data\docker\volumes\`

---

## Production Deployment

### 1. Set Production Environment

```bash
# Create production .env.docker
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://your-domain.com
NODE_ENV=production
PORT=3000
```

### 2. Update docker-compose.yml

```yaml
services:
  transcriber:
    build:
      args:
        VITE_SERVER_URL: https://your-domain.com
    environment:
      BETTER_AUTH_URL: https://your-domain.com
    restart: always  # Changed from unless-stopped
```

### 3. Build Production Image

```bash
# Build with production settings
docker-compose build --build-arg VITE_SERVER_URL=https://your-domain.com

# Start container
docker-compose up -d
```

### 4. Reverse Proxy Setup

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy Example:**
```caddy
your-domain.com {
    reverse_proxy localhost:3000
}
```

---

## Docker Commands Reference

### Build Commands

```bash
# Build image
docker-compose build

# Build with no cache (clean build)
docker-compose build --no-cache

# Build with specific Bun version
docker-compose build --build-arg BUN_VERSION=1.3.4
```

### Container Management

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# Restart containers
docker-compose restart

# View logs
docker-compose logs -f

# View logs (last 100 lines)
docker-compose logs --tail=100

# Execute command in container
docker-compose exec transcriber sh

# View container stats
docker stats transcriber-app
```

### Image Management

```bash
# List images
docker images | grep transcriber

# Remove old images
docker image prune

# Remove specific image
docker rmi transcriber-i-hardly-knew-her-transcriber

# Tag image for registry
docker tag transcriber-i-hardly-knew-her-transcriber:latest registry.example.com/transcriber:latest

# Push to registry
docker push registry.example.com/transcriber:latest
```

---

## Health Checks

### Built-in Health Check

Container includes health check endpoint:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' transcriber-app

# View health check logs
docker inspect transcriber-app | jq '.[0].State.Health'
```

### Manual Health Check

```bash
# From host
curl http://localhost:3000/health

# From container
docker-compose exec transcriber wget -qO- http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-28T12:00:00.000Z"
}
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker-compose logs transcriber
```

**Common issues:**
- Port 3000 already in use → Change port in docker-compose.yml
- Missing .env.docker → Copy from .env.docker.example
- Invalid BETTER_AUTH_SECRET → Must be 32+ characters

### Database Errors

**Reset database:**
```bash
# Stop container
docker-compose down

# Remove volume
docker volume rm transcriber_transcriber-data

# Restart (creates new database)
docker-compose up -d
```

### Build Failures

**Clear Docker cache:**
```bash
# Remove build cache
docker builder prune

# Rebuild from scratch
docker-compose build --no-cache
```

**Check build logs:**
```bash
docker-compose build 2>&1 | tee build.log
```

### Static Files Not Serving

**Verify static files copied:**
```bash
docker-compose exec transcriber ls -la /app/static
```

**Rebuild with logs:**
```bash
docker-compose build --progress=plain
```

### High Memory Usage

**Check container stats:**
```bash
docker stats transcriber-app
```

**Set memory limits:**
```yaml
services:
  transcriber:
    mem_limit: 512m
    mem_reservation: 256m
```

---

## Performance Optimization

### Image Size Reduction

Already optimized:
- Multi-stage build
- Chainguard base image (minimal)
- Bun executable (no node_modules)
- Static files only (no source code)

### Runtime Performance

**CPU Limits:**
```yaml
services:
  transcriber:
    cpus: '0.5'  # Limit to 0.5 CPU cores
```

**Memory Limits:**
```yaml
services:
  transcriber:
    mem_limit: 512m
    mem_reservation: 256m
```

### Caching Strategy

Docker build uses layer caching:
1. Dependencies layer (cached unless package.json changes)
2. Source code layer (cached unless files change)
3. Build layer (cached unless source changes)

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker-compose build
      
      - name: Run tests
        run: docker-compose run --rm transcriber bun test
      
      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
          docker push your-registry/transcriber:latest
```

---

## Security Best Practices

1. **Use secrets management:**
   ```bash
   # Don't commit .env.docker
   echo ".env.docker" >> .gitignore
   ```

2. **Run as non-root:**
   - Already configured in Dockerfile
   - Uses `nonroot` user from Chainguard image

3. **Keep images updated:**
   ```bash
   # Update base images
   docker-compose pull
   docker-compose build --pull
   ```

4. **Scan for vulnerabilities:**
   ```bash
   docker scan transcriber-i-hardly-knew-her-transcriber
   ```

5. **Use HTTPS in production:**
   - Configure reverse proxy with SSL
   - Set BETTER_AUTH_URL to https://

---

## Monitoring

### Container Logs

```bash
# Follow logs
docker-compose logs -f

# Export logs
docker-compose logs > transcriber.log
```

### Resource Usage

```bash
# Real-time stats
docker stats transcriber-app

# Export stats to file
docker stats --no-stream transcriber-app > stats.txt
```

### Health Monitoring

Set up external monitoring:
- Uptime Robot
- Pingdom
- Custom health check script

---

## Backup and Restore

### Backup

```bash
# Stop container
docker-compose down

# Backup database
docker run --rm -v transcriber_transcriber-data:/data -v $(pwd):/backup busybox tar czf /backup/transcriber-backup.tar.gz /data

# Restart container
docker-compose up -d
```

### Restore

```bash
# Stop container
docker-compose down

# Restore database
docker run --rm -v transcriber_transcriber-data:/data -v $(pwd):/backup busybox tar xzf /backup/transcriber-backup.tar.gz -C /

# Restart container
docker-compose up -d
```

---

## Upgrading

### Pull Latest Code

```bash
# Pull changes
git pull origin main

# Rebuild image
docker-compose build

# Restart with new image
docker-compose up -d
```

### Zero-Downtime Upgrade

```bash
# Build new image
docker-compose build

# Start new container (parallel)
docker-compose up -d --no-deps --build transcriber

# Old container automatically replaced
```

---

## Cost Estimates

### Hosting Options

**DigitalOcean Droplet ($6/month):**
- 1 CPU, 1GB RAM
- 25GB SSD
- Sufficient for small-medium usage

**AWS Lightsail ($5/month):**
- 0.5 CPU, 512MB RAM
- 20GB SSD
- Good for low traffic

**Self-hosted (Raspberry Pi):**
- One-time hardware cost
- Minimal power consumption
- Full control

### Resource Requirements

**Minimum:**
- 512MB RAM
- 1 CPU core
- 10GB disk

**Recommended:**
- 1GB RAM
- 1-2 CPU cores
- 20GB disk

---

## Support and Resources

- Docker Documentation: https://docs.docker.com
- Bun Documentation: https://bun.sh/docs
- Project Issues: [GitHub Issues]
- Community: [Discord/Forum]

---

**Last Updated:** 2025-12-28  
**Docker Version:** 24.0+  
**Bun Version:** 1.3.4
