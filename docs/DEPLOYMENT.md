# Deployment Guide

This guide documents the deployment path that matches the current repository:

- `docker/docker-compose.yml` is the canonical compose file
- PostgreSQL is the runtime source of truth
- migrations are SQL files under `supabase/migrations`
- the agent API lives at `/agent/*`, not `/api/*`

## Recommended Production Flow

## 1. Clone the repository

```bash
git clone https://github.com/Hermes663/Open-CRM-Agent.git /opt/autosales-ai
cd /opt/autosales-ai
```

## 2. Prepare environment

```bash
cp .env.example .env
```

Set at least:

```env
DATABASE_URL=postgresql://autosales:your_secure_password@db:5432/autosales
JWT_SECRET=replace_me
AGENT_API_URL=http://agent:8000

LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=...

EMAIL_PROVIDER=imap
IMAP_HOST=...
IMAP_USER=...
IMAP_PASSWORD=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASSWORD=...
```

## 3. Start the database first

```bash
docker compose -f docker/docker-compose.yml up -d db
```

Wait for health:

```bash
docker compose -f docker/docker-compose.yml ps
```

## 4. Apply migrations

```bash
bash scripts/db_migrate.sh
```

## 5. Start web and agent services

```bash
docker compose -f docker/docker-compose.yml up -d web agent
```

## 6. Verify runtime health

```bash
curl http://localhost:8000/agent/health
docker compose -f docker/docker-compose.yml ps
```

## Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| `db` | `5432` | PostgreSQL |
| `web` | `3000` | Next.js dashboard |
| `agent` | `8000` | FastAPI agent runtime |

## Reverse Proxy Example

If you front the app with Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /agent/ {
        proxy_pass http://127.0.0.1:8000/agent/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhooks/ {
        proxy_pass http://127.0.0.1:8000/webhooks/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Upgrade Procedure

```bash
cd /opt/autosales-ai
git pull
pnpm install
bash scripts/db_migrate.sh
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
```

## Backups

Database dump:

```bash
docker compose -f docker/docker-compose.yml exec -T db \
  pg_dump -U autosales -d autosales --format=custom \
  > autosales_$(date +%Y%m%d_%H%M%S).dump
```

Restore:

```bash
cat autosales_YYYYMMDD_HHMMSS.dump | docker compose -f docker/docker-compose.yml exec -T db \
  pg_restore -U autosales -d autosales --clean --if-exists
```

## Install Script

For an interactive bootstrap on a fresh machine:

```bash
curl -sSL https://raw.githubusercontent.com/Hermes663/Open-CRM-Agent/main/deploy/install.sh | bash
```
