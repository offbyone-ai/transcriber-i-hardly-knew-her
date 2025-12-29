# Coolify Deployment Guide

Complete guide for deploying the Transcriber app to Coolify with automated backups.

## Table of Contents
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Automated Backups](#automated-backups)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites
- Coolify instance running and accessible
- Domain name configured (optional, can use IP)
- Git repository access

### 1. Create New Service in Coolify

1. Log into your Coolify dashboard
2. Click **New Resource** → **Docker Compose**
3. Configure the source:
   - **Type:** Git Repository
   - **Repository URL:** Your git repository URL
   - **Branch:** `main` (or your deployment branch)
   - **Build Pack:** Docker Compose

### 2. Set Compose File

In the Coolify service settings, specify:
```
docker-compose.coolify.yml
```

### 3. Configure Environment Variables

In Coolify's environment variable section, add:

```env
# REQUIRED
BETTER_AUTH_SECRET=<generate-with-openssl-rand-base64-32>
BETTER_AUTH_URL=https://your-domain.com

# OPTIONAL
PORT=3000
BACKUP_RETENTION=7
```

**Generate BETTER_AUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Configure Domain (Optional)

If using a domain:
1. Go to **Domains** tab in Coolify
2. Add your domain: `transcriber.yourdomain.com`
3. Enable **HTTPS** (Let's Encrypt automatic)
4. Update `BETTER_AUTH_URL` to match: `https://transcriber.yourdomain.com`

### 5. Deploy

Click **Deploy** button in Coolify dashboard.

Coolify will:
- Clone your repository
- Build the Docker image using `Dockerfile`
- Start both containers (app + backup)
- Configure networking and SSL
- Monitor health checks

## Configuration

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTER_AUTH_SECRET` | **Yes** | - | Auth encryption key (min 32 chars) |
| `BETTER_AUTH_URL` | **Yes** | - | Public URL where app is accessible |
| `PORT` | No | `3000` | Port mapping (host:container) |
| `BACKUP_RETENTION` | No | `7` | Number of backups to retain |
| `COOLIFY_CONTAINER_NAME` | No | `transcriber-app` | Container name prefix (auto-set by Coolify) |

### Resource Limits

The `docker-compose.coolify.yml` file includes production-ready resource limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'      # Max 1 CPU core
      memory: 512M     # Max 512MB RAM
    reservations:
      cpus: '0.25'     # Reserved 0.25 CPU
      memory: 128M     # Reserved 128MB RAM
```

**Adjust if needed** by editing `docker-compose.coolify.yml` in your repository.

### Volumes

Two persistent volumes are created:

1. **`transcriber-data`** - Application data
   - Path: `/app/data`
   - Contains: `auth.db` (SQLite database)
   - Managed by: Main app container

2. **`transcriber-backups`** - Database backups
   - Path: `/backups`
   - Contains: Daily database backups
   - Managed by: Backup sidecar container

**Coolify automatically manages volume persistence** across deployments.

## Automated Backups

The deployment includes a **backup sidecar container** that runs automated daily backups.

### How It Works

1. **Backup container** runs alongside the main app
2. Every 24 hours, creates a timestamped backup
3. Stores backups in persistent volume
4. Automatically removes old backups (keeps last N)
5. Logs all backup operations

### Backup Configuration

Configure backup behavior with environment variables:

```env
# Keep last 7 backups (default)
BACKUP_RETENTION=7

# Keep last 30 backups (1 month)
BACKUP_RETENTION=30

# Keep all backups (0 = unlimited)
BACKUP_RETENTION=0
```

### View Backup Logs

In Coolify dashboard:
1. Go to your service
2. Click **Logs** tab
3. Filter by container: `transcriber-backup`

Example logs:
```
[Backup] Starting SQLite database backup at Fri Dec 28 19:00:00 UTC 2025
[Backup] Creating backup: auth_backup_20251228_190000.db
[Backup] Backup completed successfully
[Backup] Location: /backups/auth_backup_20251228_190000.db
[Backup] Size: 48K
[Backup] Cleaning up old backups (keeping last 7)...
[Backup] 7 backup(s) retained
[Backup] Done at Fri Dec 28 19:00:02 UTC 2025
[Backup] Sleeping for 24 hours...
```

### Manual Backup

To trigger a manual backup:

1. **Via Coolify console:**
   ```bash
   # Open shell in backup container
   docker exec -it <backup-container-name> sh
   
   # Run backup script
   /backup.sh 7
   ```

2. **Via Coolify SSH:**
   ```bash
   # SSH into Coolify server
   ssh your-coolify-server
   
   # Find container
   docker ps | grep backup
   
   # Run backup
   docker exec <container-id> /backup.sh 7
   ```

### Download Backups

To download backups to your local machine:

```bash
# Find backup container
docker ps | grep backup

# List available backups
docker exec <container-id> ls -lh /backups

# Copy backup to host
docker cp <container-id>:/backups/auth_backup_20251228_190000.db ./local-backup.db

# Download from Coolify server to local
scp your-coolify-server:~/local-backup.db ./backup.db
```

### Restore from Backup

**⚠️ WARNING: This will replace your current database!**

1. **Stop the app:**
   ```bash
   docker stop <app-container-name>
   ```

2. **Copy backup to data volume:**
   ```bash
   # Find backup container
   docker ps -a | grep backup
   
   # Copy specific backup
   docker exec <backup-container-id> cp /backups/auth_backup_20251228_190000.db /data/auth.db
   ```

3. **Restart the app:**
   ```bash
   docker start <app-container-name>
   ```

Or use Coolify's **Restart** button in the dashboard.

## Monitoring

### Health Checks

The app container includes automatic health checks:

```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 5s
```

**Check health status** in Coolify dashboard:
- Green indicator = Healthy
- Red indicator = Unhealthy (check logs)

### View Logs

1. **Real-time logs:**
   - Coolify Dashboard → Service → **Logs** tab
   - Filter by container: `transcriber-app` or `transcriber-backup`

2. **Historical logs:**
   ```bash
   # SSH into Coolify server
   docker logs <container-name> --tail 100
   ```

### Metrics

Coolify provides built-in metrics:
- CPU usage
- Memory usage
- Network I/O
- Disk usage

Access via: **Service → Metrics** tab

### Alerts

Configure alerts in Coolify:
1. Go to **Settings** → **Notifications**
2. Add notification channels (Email, Slack, Discord, etc.)
3. Configure triggers:
   - Container stopped
   - Health check failed
   - High resource usage
   - Deployment failed

## Troubleshooting

### App Won't Start

**Check logs:**
```bash
docker logs <container-name> --tail 50
```

**Common issues:**

1. **Missing BETTER_AUTH_SECRET:**
   ```
   Error: BETTER_AUTH_SECRET is required
   ```
   → Add secret in Coolify environment variables

2. **Port already in use:**
   ```
   Error: bind: address already in use
   ```
   → Change PORT environment variable in Coolify

3. **Build failed:**
   → Check Coolify build logs
   → Ensure `docker-compose.coolify.yml` is in repo root
   → Verify Dockerfile syntax

### Backup Container Issues

**Check backup logs:**
```bash
docker logs <backup-container-name> --tail 50
```

**Common issues:**

1. **Database not found:**
   ```
   [Backup] Warning: Database not found at /data/auth.db
   ```
   → Wait for app to initialize and create database
   → Check app container is running

2. **Permission denied:**
   ```
   [Backup] Error: Backup failed
   ```
   → Check volume permissions
   → Verify volume is properly mounted

3. **Backup container not running:**
   ```bash
   docker ps -a | grep backup
   ```
   → Check container status
   → View logs for crash reason
   → Restart via Coolify dashboard

### Database Corruption

**Symptoms:**
- App fails to start
- Auth errors
- Database locked errors

**Recovery steps:**

1. **Check database integrity:**
   ```bash
   docker exec <container-name> sqlite3 /app/data/auth.db "PRAGMA integrity_check;"
   ```

2. **If corrupted, restore from backup:**
   See [Restore from Backup](#restore-from-backup) section

3. **If no backups available:**
   ```bash
   # Delete corrupted database (users will need to re-register)
   docker exec <container-name> rm /app/data/auth.db
   
   # Restart app (will create new database)
   docker restart <container-name>
   ```

### Out of Disk Space

**Check volume usage:**
```bash
# Coolify dashboard → Service → Metrics
# Or via SSH:
docker exec <backup-container-id> du -sh /backups
```

**Solutions:**

1. **Reduce backup retention:**
   ```env
   BACKUP_RETENTION=3  # Keep only last 3 backups
   ```

2. **Clean old backups manually:**
   ```bash
   docker exec <backup-container-id> sh -c "cd /backups && ls -t auth_backup_*.db | tail -n +4 | xargs rm -f"
   ```

3. **Increase server disk space** (Coolify server settings)

### SSL/HTTPS Issues

**Check domain configuration:**
1. Coolify Dashboard → Service → **Domains** tab
2. Verify domain points to correct IP
3. Check Let's Encrypt certificate status

**Common issues:**

1. **Certificate not renewing:**
   → Check DNS records
   → Verify port 80/443 are accessible
   → Check Coolify Let's Encrypt logs

2. **Mixed content warnings:**
   → Ensure `BETTER_AUTH_URL` uses `https://`
   → Verify all API calls use HTTPS

### High Memory Usage

**Check current usage:**
```bash
docker stats <container-name>
```

**If exceeding 512MB limit:**

1. **Increase memory limit** in `docker-compose.coolify.yml`:
   ```yaml
   limits:
     memory: 1024M  # Increase to 1GB
   ```

2. **Commit and redeploy** via Coolify

3. **Monitor** to ensure issue is resolved

## Production Checklist

Before going live, verify:

- [ ] `BETTER_AUTH_SECRET` is set (strong, random, 32+ chars)
- [ ] `BETTER_AUTH_URL` matches your domain (https://)
- [ ] Domain is configured with SSL/HTTPS
- [ ] Health checks are passing
- [ ] Backup container is running
- [ ] First backup has completed successfully
- [ ] Coolify alerts are configured
- [ ] Resource limits are appropriate
- [ ] Test user registration and login
- [ ] Test transcription functionality

## Scaling Considerations

### Current Architecture Limitations

- **Single instance:** No horizontal scaling (single SQLite database)
- **Auth data only:** SQLite suitable for 50K+ users
- **Heavy data in client:** Recordings/transcriptions in IndexedDB

### If You Need to Scale

Consider these approaches:

1. **Vertical scaling:**
   - Increase CPU/memory limits
   - Use faster disk (SSD)
   - Current setup handles 10K+ concurrent users

2. **Database upgrade (if needed for >50K users):**
   - Migrate to PostgreSQL
   - Use Coolify's managed PostgreSQL
   - Update `better-auth` configuration

3. **Multi-region:**
   - Deploy multiple instances in different regions
   - Use load balancer
   - Shared database or federation

**For most use cases, current setup is sufficient.**

## Support

### Documentation

- **General Deployment:** [docs/DEPLOYMENT.md](./DEPLOYMENT.md)
- **Docker Basics:** [DOCKER.md](../DOCKER.md)
- **Volume Management:** [docs/VOLUMES.md](./VOLUMES.md)
- **Project Progress:** [PROGRESS.md](../PROGRESS.md)

### Getting Help

1. **Check logs first** (most issues have clear error messages)
2. **Review troubleshooting section** above
3. **Coolify community:** https://coolify.io/docs
4. **Project repository:** Check issues/discussions

---

**Last Updated:** 2025-12-28  
**Coolify Version:** 4.x  
**Docker Compose Version:** 3.8+
