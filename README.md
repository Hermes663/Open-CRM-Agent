# OpenCRM

Production-oriented CRM with an autonomous sales agent runtime.

OpenCRM is a working v1 stack that combines a CRM interface, an agent orchestration backend, and a PostgreSQL data model into one coherent runtime path. The project is built to operate as a real CRM system with agent-assisted workflows, not as a browser-only demo wired to mock data.

## What OpenCRM v1 Can Do

- render a working CRM dashboard, pipeline, contact list, deal detail view, activity timeline, agent operations page, and settings status page
- serve the UI through internal Next.js API routes instead of direct browser-side database access
- run a FastAPI agent backend with health checks, heartbeat orchestration, manual agent runs, and inbound email webhook handling
- persist deals, contacts, activities, follow-ups, agent memory, and agent run logs in PostgreSQL using SQL migrations
- execute three active sales agents: `research`, `qualifier`, and `followup`
- route outbound email through configurable providers for `imap`, `gmail`, or `outlook`
- support manual stage changes and manual agent execution from the CRM layer

## Current v1 Scope

- `negotiation` and `closing` remain visible as CRM stages, but they are handled manually in v1 and are not auto-routed to specialist agents
- PostgreSQL plus SQL migrations are the runtime source of truth
- Supabase is optional for local tooling and is not required for the main runtime path
- the UI uses server-side DTOs and polling-based refresh instead of browser-side Supabase realtime

## Runtime Architecture

| Layer | Technology | Responsibility |
|------|------------|----------------|
| CRM UI | `Next.js 14` | dashboard, pipeline, contacts, deal detail, settings, agent operations |
| UI API | `Next.js Route Handlers` | stable DTOs for deals, contacts, pipeline, activities, agent runs, settings |
| Agent Runtime | `FastAPI` | heartbeat, manual agent runs, webhook intake, orchestration, agent execution |
| Data Layer | `PostgreSQL` | canonical storage for CRM records, follow-up queue, agent memory, agent run history |
| Schema Control | `SQL migrations` | runtime alignment, repeatable setup, seedable local environments |
| Email Channels | `IMAP/SMTP`, `Gmail`, `Outlook` | configurable outbound and inbound provider paths |

## Public Endpoints

### CRM-side API

- `GET /api/pipeline`
- `GET /api/deals`
- `POST /api/deals`
- `GET /api/deals/[id]`
- `PATCH /api/deals/[id]`
- `GET /api/deals/[id]/activities`
- `POST /api/deals/[id]/activities`
- `GET /api/contacts`
- `GET /api/agent/runs`
- `POST /api/agent/trigger`
- `POST /api/agent/run/[agentName]`
- `GET /api/settings/status`

### Agent runtime API

- `GET /agent/health`
- `POST /agent/heartbeat`
- `POST /agent/run/{agent_name}`
- `POST /webhooks/email`

## Repository Layout

| Path | Purpose |
|------|---------|
| `packages/web` | Next.js CRM UI and internal API routes |
| `packages/agent` | FastAPI runtime, orchestrator, agent logic, email adapters |
| `supabase/migrations` | canonical SQL schema and runtime alignment migrations |
| `supabase/seed.sql` | seed data for local and test environments |
| `docker` | Dockerfiles and compose definitions for db, web, and agent |
| `scripts` | helper scripts for Python bootstrap, DB migration, and seed execution |

## Local Quick Start

```bash
git clone https://github.com/Hermes663/Open-CRM-Agent.git
cd Open-CRM-Agent

cp .env.example .env
pnpm install
pnpm agent:setup

docker compose -f docker/docker-compose.yml up -d db
pnpm db:migrate
pnpm db:seed
```

Start the services in separate terminals:

```bash
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

Production-style startup:

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
- [Architecture](docs/ARCHITECTURE.md)
