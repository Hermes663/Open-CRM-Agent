# Deployment Guide

Deploy AutoSales AI to a VPS for production use. This guide covers single-server deployment with Docker, SSL, and monitoring.

## Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 vCPUs | 4 vCPUs |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 40 GB SSD |
| Network | Public IPv4 | Public IPv4 + IPv6 |

Tested providers: Hetzner, DigitalOcean, Linode, AWS EC2, Vultr.

## Option 1: One-Command Install

SSH into your server and run:

```bash
curl -sSL https://raw.githubusercontent.com/adikam/autosales-ai/main/deploy/install.sh | bash
```

This script will:
1. Install Docker and Docker Compose
2. Clone the repository to `/opt/autosales-ai`
3. Generate secure passwords and secrets
4. Prompt you for required configuration (domain, email credentials, API keys)
5. Set up Nginx reverse proxy with SSL (Let's Encrypt)
6. Create systemd services for auto-start
7. Start all services
8. Print your dashboard URL

After installation, open `https://your-domain.com` in your browser.

## Option 2: Manual Install

### Step 1: Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

Log out and back in for the group change to take effect.

### Step 2: Clone and Configure

```bash
# Clone to /opt
sudo mkdir -p /opt/autosales-ai
sudo chown $USER:$USER /opt/autosales-ai
git clone https://github.com/adikam/autosales-ai.git /opt/autosales-ai
cd /opt/autosales-ai

# Create production environment file
cp .env.example .env.production
```

Edit `.env.production` with your production values:

```env
# Production settings
NODE_ENV=production
APP_SECRET=<generate-a-64-char-random-string>
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# Database
DATABASE_URL=postgresql://autosales:<strong-password>@db:5432/autosales
POSTGRES_PASSWORD=<strong-password>

# LLM
OPENAI_API_KEY=sk-...

# Email provider (configure one)
OUTLOOK_CLIENT_ID=...
OUTLOOK_CLIENT_SECRET=...
OUTLOOK_TENANT_ID=...

# Domain
DOMAIN=your-domain.com
ADMIN_EMAIL=admin@your-domain.com
```

Generate a secure secret:

```bash
openssl rand -hex 32
```

### Step 3: Start Services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Verify all containers are running:

```bash
docker compose -f docker-compose.prod.yml ps
```

## SSL/HTTPS with Let's Encrypt

### Automatic (via install script)

The one-command install handles SSL automatically using Certbot.

### Manual Setup

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com \
  --non-interactive --agree-tos --email admin@your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certbot automatically creates a cron job for renewal.

## Domain Configuration

### DNS Records

Add these records at your DNS provider:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<your-server-ip>` | 300 |
| A | `www` | `<your-server-ip>` | 300 |
| CNAME | `api` | `your-domain.com` | 300 |

### Nginx Configuration

The install script creates `/etc/nginx/sites-available/autosales-ai`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/autosales-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Systemd Services

The install script creates a systemd service for automatic startup and restart:

`/etc/systemd/system/autosales-ai.service`:

```ini
[Unit]
Description=AutoSales AI
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/autosales-ai
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.production up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Manage the service:

```bash
# Enable auto-start on boot
sudo systemctl enable autosales-ai

# Start/stop/restart
sudo systemctl start autosales-ai
sudo systemctl stop autosales-ai
sudo systemctl restart autosales-ai

# Check status
sudo systemctl status autosales-ai
```

## Monitoring and Logs

### Application Logs

```bash
# All services
cd /opt/autosales-ai
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f engine
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f db
```

### Health Check Endpoint

```bash
curl https://your-domain.com/api/health
```

### Resource Monitoring

```bash
# Container resource usage
docker stats

# Disk usage
df -h
docker system df
```

### Log Rotation

Docker logs can grow large. Configure log rotation in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker after changing:

```bash
sudo systemctl restart docker
```

## Backup and Restore

### Database Backup

Create a backup:

```bash
# Dump the database
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U autosales -d autosales --format=custom \
  > backup_$(date +%Y%m%d_%H%M%S).dump
```

### Automated Daily Backups

Add to crontab (`crontab -e`):

```
0 2 * * * cd /opt/autosales-ai && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U autosales -d autosales --format=custom > /opt/backups/autosales_$(date +\%Y\%m\%d).dump 2>/dev/null && find /opt/backups -name "autosales_*.dump" -mtime +30 -delete
```

This runs at 2 AM daily and keeps 30 days of backups.

### Restore from Backup

```bash
# Stop the application
docker compose -f docker-compose.prod.yml stop engine web

# Restore the database
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U autosales -d autosales --clean --if-exists \
  < backup_20260101_020000.dump

# Restart
docker compose -f docker-compose.prod.yml start engine web
```

### Full Server Backup

For a complete backup including configuration:

```bash
tar czf autosales-full-backup.tar.gz \
  /opt/autosales-ai/.env.production \
  /opt/autosales-ai/docker-compose.prod.yml \
  /etc/nginx/sites-available/autosales-ai \
  /opt/backups/
```

## Updating to New Versions

### Standard Update

```bash
cd /opt/autosales-ai

# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Run any new migrations
docker compose -f docker-compose.prod.yml exec engine python -m alembic upgrade head
```

### Update with Downtime Window

For major version updates:

```bash
cd /opt/autosales-ai

# 1. Create a backup first
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U autosales -d autosales --format=custom > pre-update-backup.dump

# 2. Stop services
docker compose -f docker-compose.prod.yml down

# 3. Pull latest code
git pull origin main

# 4. Rebuild and start
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 5. Run migrations
docker compose -f docker-compose.prod.yml exec engine python -m alembic upgrade head

# 6. Verify health
curl https://your-domain.com/api/health
```

### Rollback

If an update causes issues:

```bash
# Check the previous commit
git log --oneline -5

# Revert to previous version
git checkout <previous-commit-hash>

# Rebuild
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Restore database if needed
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U autosales -d autosales --clean --if-exists < pre-update-backup.dump
```

## Security Checklist

Before going to production, verify:

- [ ] Changed the default admin password
- [ ] Set a strong `APP_SECRET` (64+ random characters)
- [ ] Set a strong `POSTGRES_PASSWORD`
- [ ] SSL/HTTPS is active and redirecting HTTP
- [ ] Firewall rules: only ports 80, 443, and 22 are open
- [ ] SSH key authentication is enabled (password auth disabled)
- [ ] Database port (5432) is not exposed to the internet
- [ ] `.env.production` file permissions: `chmod 600 .env.production`
- [ ] Automated backups are configured and tested
- [ ] Log rotation is configured
