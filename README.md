<p align="center">
  <h1 align="center">OpenCRM</h1>
  <p align="center">
    <strong>Production-oriented CRM and autonomous sales agent runtime</strong>
  </p>
</p>

---

This repository ships a working v1 stack built around:

- `Next.js 14` for the CRM dashboard
- `FastAPI` for the agent runtime
- `PostgreSQL` plus SQL migrations as the runtime source of truth
- three active agents: `research`, `qualifier`, `followup`

`negotiation` and `closing` remain visible as CRM stages, but automated routing to specialist agents is intentionally disabled in v1.

## What Works in v1

- dashboard, pipeline, contact list, deal detail, activity timeline
- internal Next.js API routes used by the UI instead of direct browser-side Supabase reads
- FastAPI heartbeat at `/agent/heartbeat`
- manual agent runs at `/agent/run/{agent_name}`
- database migrations and seed scripts driven from `supabase/migrations` and `supabase/seed.sql`
- email provider selection for `imap`, `gmail`, or `outlook`

## Repository Layout

| Path | Purpose |
|------|---------|
| `packages/web` | Next.js CRM UI |
| `packages/agent` | FastAPI runtime, orchestrator, agent logic |
| `supabase/migrations` | Canonical SQL schema and runtime alignment migrations |
| `docker` | Dockerfiles and compose files |
| `scripts` | Helper scripts for DB migration, seed, and Python env bootstrap |

## Local Quick Start

```bash
git clone https://github.com/Hermes663/Open-CRM-Agent.git
cd Open-CRM-Agent

cp .env.example .env
pnpm install

docker compose -f docker/docker-compose.yml up -d db
pnpm db:migrate
pnpm db:seed

pnpm agent:dev
pnpm dev
```

After startup:

- dashboard: [http://localhost:3000](http://localhost:3000)
- agent API: [http://localhost:8000](http://localhost:8000)
- FastAPI docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Required Environment Variables

Minimum runtime configuration:

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

Supabase-related variables remain optional and are not required for the v1 runtime path.

## Verification

```bash
pnpm lint
pnpm build
pnpm agent:lint
pnpm agent:test
```

## Docker

Production-style stack:

```bash
docker compose -f docker/docker-compose.yml up -d db
bash scripts/db_migrate.sh
docker compose -f docker/docker-compose.yml up -d web agent
```

Development override:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up
```

## Documentation

- [Quick Start](docs/QUICKSTART.md)
- [Deployment](docs/DEPLOYMENT.md)
