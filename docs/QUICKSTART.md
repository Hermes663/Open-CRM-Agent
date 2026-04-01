# Quick Start

This guide uses the runtime path that is actually supported in v1:

- PostgreSQL as the runtime database
- Next.js as the CRM frontend
- FastAPI as the agent backend
- SQL migrations from `supabase/migrations`

## Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24+ |
| Docker Compose | v2 |
| Node.js | 20+ |
| pnpm | 9+ |
| Python | 3.11+ |

## 1. Clone the repository

```bash
git clone https://github.com/Hermes663/Open-CRM-Agent.git
cd Open-CRM-Agent
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

At minimum configure:

```env
DATABASE_URL=postgresql://autosales:your_secure_password@localhost:5432/autosales
JWT_SECRET=replace_me
AGENT_API_URL=http://localhost:8000

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

`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and similar values are optional in v1.

## 3. Install Node dependencies

```bash
pnpm install
```

## 4. Start PostgreSQL

```bash
docker compose -f docker/docker-compose.yml up -d db
```

Wait until the `autosales-db` container is healthy:

```bash
docker compose -f docker/docker-compose.yml ps
```

## 5. Apply migrations

```bash
pnpm db:migrate
```

This applies all SQL files from `supabase/migrations`, including the runtime alignment migration for `follow_up_queue`.

## 6. Load demo data (optional but recommended for first run)

```bash
pnpm db:seed
```

## 7. Start the agent backend

```bash
pnpm agent:dev
```

Health check:

```bash
curl http://localhost:8000/agent/health
```

Expected fields include:

```json
{
  "status": "ok",
  "heartbeat_running": true,
  "email_provider_configured": true
}
```

## 8. Start the CRM frontend

Open a second terminal:

```bash
pnpm dev
```

## 9. Open the application

- dashboard: [http://localhost:3000](http://localhost:3000)
- pipeline: [http://localhost:3000/pipeline](http://localhost:3000/pipeline)
- agent runs: [http://localhost:3000/agent](http://localhost:3000/agent)

## 10. Useful smoke checks

Trigger heartbeat manually:

```bash
curl -X POST http://localhost:8000/agent/heartbeat
```

Run research for a specific deal:

```bash
curl -X POST http://localhost:8000/agent/run/research \
  -H "Content-Type: application/json" \
  -d '{"deal_id":"your-deal-id"}'
```

## Validation Commands

```bash
pnpm lint
pnpm build
pnpm agent:lint
pnpm agent:test
```
