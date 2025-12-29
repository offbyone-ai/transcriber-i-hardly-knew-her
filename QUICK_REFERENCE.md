# Transcriber App - Quick Reference Card

## 🚀 Deployment Options

| Environment | Compose File | Use Case |
|-------------|--------------|----------|
| **Production** | `docker-compose.yml` | Manual server deployment |
| **Development** | `docker-compose.dev.yml` | Local testing |
| **Coolify** | `docker-compose.coolify.yml` | Platform deployment with automated backups |

## 📋 Quick Commands

### Development
```bash
bun run dev              # Start dev servers
bun run build:single     # Build for production
bun run test            # Run tests
```

### Docker - Production
```bash
# Setup
cp .env.docker.example .env.docker
openssl rand -base64 32  # Generate secret
# Edit .env.docker with secret

# Deploy
docker-compose --env-file .env.docker up -d
docker-compose logs -f transcriber
```

### Docker - Development
```bash
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f
```

### Coolify
```bash
# In Coolify Dashboard:
# 1. New Resource → Docker Compose
# 2. Git repo URL
# 3. Compose file: docker-compose.coolify.yml
# 4. Set env vars: BETTER_AUTH_SECRET, BETTER_AUTH_URL
# 5. Deploy

# View backup logs
docker logs transcriber-backup --tail 50

# Manual backup
docker exec transcriber-backup /backup.sh 7

# Download backup
docker cp transcriber-backup:/backups/auth_backup_*.db ./backup.db
```

### Backups
```bash
# Host-based (production)
./scripts/backup-db.sh 10        # Keep last 10

# Restore
./scripts/restore-db.sh backups/auth_backup_20251228_120000.db
```

## 🔐 Environment Variables

### Required
```env
BETTER_AUTH_SECRET=<generate-with-openssl>  # Min 32 chars
BETTER_AUTH_URL=https://your-domain.com
```

### Optional
```env
PORT=3000                    # Host port
BACKUP_RETENTION=7           # Backups to keep
```

## 📊 Architecture at a Glance

```
┌─────────────────────────────────────┐
│   Docker Container (~120MB)         │
│                                     │
│  Bun Executable (69MB)              │
│  ├── Hono API Server                │
│  ├── Static Files (React)           │
│  └── better-auth                    │
│                                     │
│  SQLite Database (Volume)           │
│  └── User auth data only            │
│                                     │
│  Client (IndexedDB)                 │
│  └── Recordings + Transcriptions    │
└─────────────────────────────────────┘
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build |
| `docker-compose.yml` | Production deployment |
| `docker-compose.dev.yml` | Development deployment |
| `docker-compose.coolify.yml` | Coolify with backups |
| `.env.docker.example` | Environment template |
| `scripts/backup-db.sh` | Manual backup script |
| `scripts/backup-db-container.sh` | Automated backup script |
| `scripts/restore-db.sh` | Restore script |

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| **[DOCKER.md](../DOCKER.md)** | Quick start guide |
| **[docs/COOLIFY.md](./COOLIFY.md)** | Complete Coolify guide (600+ lines) |
| **[docs/DEPLOYMENT.md](./DEPLOYMENT.md)** | General deployment guide |
| **[docs/VOLUMES.md](./VOLUMES.md)** | Volume management |
| **[PROGRESS.md](../PROGRESS.md)** | Project status |

## 🏥 Health & Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

### View Logs
```bash
# Docker
docker-compose logs -f transcriber

# Coolify
# Use dashboard Logs tab
```

### Resource Usage
```bash
docker stats transcriber-app
```

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Secret not set** | Add `BETTER_AUTH_SECRET` to `.env.docker` |
| **Port in use** | Change `PORT` in `.env.docker` |
| **Build fails** | Check `docker logs` and verify Dockerfile |
| **Backup fails** | Check volume mounts and permissions |
| **Database locked** | Restart container (WAL mode should prevent) |

## 🎯 Production Checklist

Before deploying:

- [ ] Generate secure `BETTER_AUTH_SECRET` (32+ chars)
- [ ] Set correct `BETTER_AUTH_URL` (https://)
- [ ] Configure domain/SSL (Coolify auto-handles)
- [ ] Test backup system works
- [ ] Set up monitoring/alerts
- [ ] Verify health checks pass
- [ ] Test user registration/login
- [ ] Test recording/transcription
- [ ] Review resource limits (512MB RAM, 1 CPU)

## 📦 Build Artifacts

| Item | Size | Description |
|------|------|-------------|
| Server Executable | 69MB | Bun compiled binary |
| Client Build | 560KB | React app (minified) |
| Docker Image | ~120MB | Final production image |
| Database | ~10KB/user | Auth data only |

## 🔄 Backup System

| Feature | Details |
|---------|---------|
| **Frequency** | Every 24 hours |
| **Retention** | Configurable (default: 7) |
| **Storage** | Persistent volume |
| **Method** | Atomic file copy (WAL-safe) |
| **Logging** | Timestamped to stdout |

## 🚦 Status

| Component | Status |
|-----------|--------|
| Core App | ✅ Complete |
| Docker Build | ✅ Complete |
| Coolify Deploy | ✅ Complete |
| Automated Backups | ✅ Complete |
| Documentation | ✅ Complete |
| CI/CD Pipeline | 🚧 TODO |
| PWA Features | 🚧 TODO |

---

**Last Updated:** 2025-12-28  
**Version:** 1.0.0-production-ready  
**Deployment:** Coolify-optimized with automated backups
