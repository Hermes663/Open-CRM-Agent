# Architecture

This document provides a technical deep-dive into the AutoSales AI system -- its monorepo structure, agent engine internals, memory system, LLM provider plugins, email channels, database schema, API surface, and deployment model.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Agent Engine](#agent-engine)
4. [Memory System](#memory-system)
5. [LLM Provider Plugin System](#llm-provider-plugin-system)
6. [Email Channels](#email-channels)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Deployment Model](#deployment-model)

---

## System Overview

AutoSales AI is organized as a **pnpm monorepo** containing two primary packages and shared configuration:

```
autosales-ai/                   (monorepo root)
  package.json                  pnpm workspace root, top-level scripts
  pnpm-workspace.yaml           defines packages/web and packages/agent
  .env.example                  all environment variables
  packages/
    web/                        Next.js 14 CRM frontend
    agent/                      Python FastAPI agent backend
  agent-config/                 Agent personality, knowledge, and prompts
  supabase/migrations/          SQL migration files
  docker/                       Docker Compose + Dockerfiles
  deploy/                       VPS deployment scripts + Nginx + systemd
```

The system is composed of three runtime services:

```
+-------------------------------------------------------------------+
|                       CRM Dashboard                               |
|                      (Next.js 14 + React 18 + Tailwind CSS)       |
+-------------------------------|-----------------------------------+
                                |
                           REST API
                                |
+-------------------------------|-----------------------------------+
|                       Agent Engine                                |
|                      (Python FastAPI + uvicorn)                   |
|                                                                   |
|   Heartbeat Daemon --> Orchestrator --> Agent Pool --> Email GW    |
|                            |                                      |
|                     Memory Manager                                |
|                  (Working + FTS + pgvector)                        |
|                            |                                      |
|                   LLM Provider Router                             |
|              (Anthropic / OpenAI / Codex)                         |
+-------------------------------|-----------------------------------+
                                |
+-------------------------------|-----------------------------------+
|                      PostgreSQL 16 + pgvector                     |
|   prospects_data | deals | activities | agent_memory | agent_runs |
+-------------------------------------------------------------------+
```

Data flows in two directions:

1. **Top-down (user-initiated)**: A user interacts with the CRM dashboard, which calls Next.js API routes. These read from / write to Supabase (PostgreSQL). The frontend can also trigger agent actions via the FastAPI backend.

2. **Bottom-up (agent-initiated)**: The heartbeat daemon periodically wakes up, queries the database for pending work (new emails, due follow-ups, stale deals), routes tasks through the orchestrator to specialized agents, which call LLM providers and email channels, then write results back to the database. The dashboard reflects these changes in real time.

---

## Monorepo Structure

### Root `package.json`

The root `package.json` provides convenience scripts that delegate to the appropriate package:

| Script | Action |
|--------|--------|
| `pnpm dev` | Start the Next.js frontend in development mode |
| `pnpm build` | Build the Next.js frontend for production |
| `pnpm agent:dev` | Start the FastAPI agent with `--reload` on port 8000 |
| `pnpm agent:start` | Start the FastAPI agent in production mode (2 workers) |
| `pnpm docker:up` | `docker compose up -d` using `docker/docker-compose.yml` |
| `pnpm docker:down` | Stop all Docker containers |
| `pnpm docker:logs` | Tail logs from all Docker containers |
| `pnpm db:migrate` | Run Prisma migrations (frontend ORM) |
| `pnpm db:studio` | Open Prisma Studio for visual database browsing |

### `packages/web/` -- Next.js 14 Frontend

```
packages/web/
  src/
    app/                        Next.js App Router pages
      page.tsx                  Dashboard overview (metrics, recent activity)
      pipeline/page.tsx         Kanban board with drag-and-drop
      contacts/page.tsx         Contact list with search
      deals/page.tsx            Deal detail views
      settings/page.tsx         Configuration panels
      api/                      Next.js API routes (server-side)
    components/
      dashboard/                Metric cards, trend indicators
      pipeline/                 Kanban columns, deal cards, drag handlers
      deals/                    Deal detail, activity timeline, email thread
      layout/                   Sidebar, header, navigation
    hooks/                      Custom React hooks (data fetching, state)
    lib/
      types.ts                  TypeScript types (Deal, Customer, Activity, etc.)
      api.ts                    API client for backend communication
      supabase.ts               Supabase client initialization
      constants.ts              Pipeline stages, colors, configuration
      utils.ts                  Shared utility functions
```

**Key frontend technologies:**
- **Next.js 14** with App Router for server-side rendering and API routes
- **React 18** with TypeScript for type-safe component development
- **Tailwind CSS** for utility-first styling
- **@hello-pangea/dnd** for accessible drag-and-drop on the kanban board
- **@supabase/supabase-js** for real-time database subscriptions
- **Lucide React** for consistent iconography
- **date-fns** for date formatting and manipulation

### `packages/agent/` -- Python FastAPI Backend

```
packages/agent/
  pyproject.toml                Hatchling build config, dependencies
  autosales/
    __init__.py
    main.py                     FastAPI app entry point, route definitions
    agents/
      base.py                   Abstract base agent class
      research.py               Research Agent implementation
      qualifier.py              Qualifier Agent implementation
      followup.py               Follow-up Agent implementation
    channels/
      base.py                   Abstract email channel interface
      outlook.py                Microsoft Graph API integration
      gmail.py                  Gmail OAuth2 integration
      imap_smtp.py              Generic IMAP/SMTP integration
    core/
      agent_runner.py           Executes agent tasks, wraps lifecycle
      heartbeat.py              HeartbeatDaemon -- periodic task scheduler
      orchestrator.py           Decision tree router for incoming tasks
    memory/
      manager.py                MemoryManager -- unified search interface
      fts_search.py             Full-text search via PostgreSQL tsvector
    providers/
      base.py                   BaseProvider ABC, data types (LLMRequest, LLMResponse)
      registry.py               Provider registry -- discovers and holds providers
      router.py                 Provider router -- fallback chain logic
      config.py                 Provider configuration from environment
      auth_profiles.py          OAuth token storage (~/.autosales/auth-profiles.json)
      anthropic_provider.py     Anthropic Claude provider
      openai_provider.py        OpenAI API provider
      openai_codex_provider.py  OpenAI Codex (ChatGPT subscription) provider
    integrations/
      supabase_client.py        Supabase/PostgreSQL client wrapper
    cli/                        Typer CLI commands
    utils/                      Logging, helpers, validators
```

---

## Agent Engine

The agent engine is the autonomous core of AutoSales AI. It consists of three interconnected subsystems: the heartbeat daemon, the orchestrator, and the agent pool.

### Heartbeat Daemon

The `HeartbeatDaemon` (in `core/heartbeat.py`) is a background task that runs inside the FastAPI process using APScheduler. It wakes up at a configurable interval (default: 30 minutes) and executes a cycle of checks:

```
HeartbeatDaemon.run_cycle()
  |
  +-- 1. Poll for new inbound emails
  |       -> Match sender to existing contact/deal
  |       -> Create inbound activity record
  |       -> Route to Orchestrator
  |
  +-- 2. Check for due follow-ups
  |       -> Query follow_up_queue WHERE status='pending' AND scheduled_at <= now()
  |       -> For each: trigger Follow-up Agent via Orchestrator
  |
  +-- 3. Check for stale deals
  |       -> Find deals with no activity for N days (configurable)
  |       -> Generate re-engagement suggestions
  |
  +-- 4. Report health metrics
          -> Log heartbeat cycle stats
          -> Record in agent_runs table
```

The heartbeat can also be triggered manually via `POST /agent/heartbeat`.

**Configuration:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HEARTBEAT_INTERVAL_MINUTES` | `30` | Minutes between automatic heartbeat cycles |
| `AGENT_MAX_EMAILS_PER_HOUR` | `20` | Rate limit for outbound emails |
| `AGENT_MAX_CONCURRENT_RESEARCH` | `5` | Maximum parallel research tasks |
| `AGENT_LOG_LEVEL` | `INFO` | Logging verbosity |

### Orchestrator Decision Tree

The `Orchestrator` (in `core/orchestrator.py`) examines each incoming task and routes it to the appropriate agent:

```
Incoming Task
    |
    +-- Is it a new contact with no enrichment data?
    |       YES --> Research Agent
    |
    +-- Is it an inbound email reply?
    |       |
    |       +-- Is the deal in "new_deal" or "first_email" stage?
    |       |       YES --> Qualifier Agent
    |       |
    |       +-- Is the deal in "qualifying" or later?
    |               YES --> Follow-up Agent
    |
    +-- Is it a scheduled follow-up from the queue?
    |       YES --> Follow-up Agent
    |
    +-- Is it a manual trigger from the dashboard?
            YES --> Execute the specified agent
```

### Agent Lifecycle

The `AgentRunner` (in `core/agent_runner.py`) manages the full lifecycle of each agent execution:

```
AgentRunner.run(agent_name, deal, context)
    |
    1. Create agent_runs record (status: 'running')
    2. Load deal and customer data from database
    3. Build working memory context:
       - Current deal state
       - Customer profile
       - Recent conversation history (episodic memory)
       - Similar past interactions (semantic memory search)
    4. Load agent-specific system prompt from agent-config/prompts/
    5. Merge SOUL.md personality + KNOWLEDGE.md context + PLAYBOOK.md strategy
    6. Call LLM provider via Provider Router:
       - Construct LLMRequest with system prompt + user message
       - Route through fallback chain if primary provider fails
    7. Parse structured LLMResponse
    8. Execute actions:
       - Send email (via email channel)
       - Update deal stage
       - Create activity record
       - Store conversation in memory
    9. Update agent_runs record (status: 'completed', tokens, cost, duration)
   10. Return AgentResult to caller
```

Each agent class (Research, Qualifier, Follow-up) extends `BaseAgent` and implements:
- `build_prompt(deal, context)` -- Constructs the LLM prompt with relevant data
- `parse_response(llm_response)` -- Extracts structured actions from the LLM output
- `execute_actions(actions, deal)` -- Carries out the decided actions

---

## Memory System

The memory system provides agents with context at three layers, from fast/narrow to slow/broad:

### Layer 1: Working Memory (In-Process)

- Scope: Current agent execution only
- Storage: In-memory Python objects
- Contents:
  - The active deal record and its current stage
  - The customer profile (name, company, country, language, research summary)
  - The last N activities on this deal (recent emails, stage changes, notes)
  - The agent's previous decisions for this deal (from agent_runs)
- Lifecycle: Created when an agent starts, discarded when the agent completes
- Purpose: Ensures the agent has immediate context without database queries during LLM prompt construction

### Layer 2: Episodic Memory (Full-Text Search)

- Scope: All historical interactions for a customer or deal
- Storage: `prospects_history` table with a generated `tsvector` column
- Search: PostgreSQL full-text search (GIN index) on customer messages, agent messages, and email subjects
- Access: `MemoryManager.search_conversations(query, customer_id)`
- Implementation: `memory/fts_search.py` constructs `to_tsquery` from the search input and ranks results by relevance
- Purpose: Retrieve past conversations that match specific keywords (e.g., "pricing for pralines" or "MOQ requirements")

### Layer 3: Semantic Memory (Vector Search)

- Scope: All content in the system, searchable by meaning
- Storage: `agent_memory` table with a `vector(1536)` column (pgvector extension)
- Index: IVFFlat with 100 lists for approximate nearest-neighbor search
- Content types: `conversation`, `research`, `note`, `decision`, `preference`
- Embedding model: OpenAI `text-embedding-3-small` (1536 dimensions)
- Search: Cosine similarity via `<=>` operator
- Access: `MemoryManager.semantic_search(query, customer_id, limit)`
- Purpose: Find conceptually similar interactions even when keywords do not match (e.g., searching "European chocolate distributor" finds conversations about "confectionery import business in Germany")

### Memory Flow During Agent Execution

```
Agent starts
    |
    +-- Load working memory
    |     (deal + customer + recent activities)
    |
    +-- Query episodic memory
    |     FTS: "What did we discuss with this customer before?"
    |     Returns: ranked list of past messages
    |
    +-- Query semantic memory
    |     Vector search: "Similar deals / conversations"
    |     Returns: top-K most relevant memory entries
    |
    +-- Merge into LLM prompt context
    |
    +-- Agent executes, generates response
    |
    +-- Store new interaction in episodic memory (prospects_history)
    +-- Generate embedding, store in semantic memory (agent_memory)
```

---

## LLM Provider Plugin System

The provider system is inspired by OpenClaw's `ProviderPlugin` architecture. It defines a common interface that all LLM providers implement, with a registry for discovery and a router for fallback logic.

### Base Interface (`providers/base.py`)

Every provider implements `BaseProvider`:

```python
class BaseProvider(ABC):
    id: str              # "anthropic", "openai", "openai-codex"
    label: str           # Human-readable name
    auth_type: AuthType  # API_KEY, OAUTH, or TOKEN
    env_vars: list[str]  # Environment variables for credentials

    async def authenticate(credential: AuthCredential) -> bool
    async def complete(request: LLMRequest, credential: AuthCredential) -> LLMResponse
    def get_models() -> list[ModelConfig]
    async def refresh_auth(credential: AuthCredential) -> AuthCredential
    async def check_health(credential: AuthCredential) -> bool
    def calculate_cost(model_id, input_tokens, output_tokens) -> float
```

**Shared data types:**
- `AuthCredential` -- Holds API key or OAuth tokens, serializable to JSON
- `ModelConfig` -- Static model metadata (context window, max tokens, cost per 1M tokens, capabilities)
- `LLMRequest` -- Provider-agnostic request (system prompt, user message, temperature, max tokens, JSON mode, streaming)
- `LLMResponse` -- Provider-agnostic response (content, model, tokens used, cost, latency)

### Provider Implementations

**Anthropic (`anthropic_provider.py`)**
- Auth: API key (`ANTHROPIC_API_KEY`)
- Models: Claude Sonnet 4, Claude Opus 4, etc.
- Features: JSON mode, streaming, extended thinking

**OpenAI (`openai_provider.py`)**
- Auth: API key (`OPENAI_API_KEY`)
- Models: GPT-4o, GPT-4o-mini, etc.
- Features: JSON mode, streaming, function calling

**OpenAI Codex (`openai_codex_provider.py`)**
- Auth: OAuth2 via ChatGPT subscription (Plus or Pro)
- Authentication flow:
  1. User runs `autosales providers auth login --provider openai-codex`
  2. Browser opens for ChatGPT login
  3. OAuth callback stores tokens in `~/.autosales/auth-profiles.json`
  4. Tokens are refreshed automatically when expired
- Billing: Flat-rate (included in ChatGPT subscription), no per-token cost
- Tier limits: Plus = 5 hours/week, Pro = unlimited

### Provider Registry (`providers/registry.py`)

The registry discovers all installed providers at startup and makes them available by ID:

```python
registry = ProviderRegistry()
registry.register(AnthropicProvider())
registry.register(OpenAIProvider())
registry.register(OpenAICodexProvider())

provider = registry.get("anthropic")  # Returns AnthropicProvider instance
```

### Provider Router (`providers/router.py`)

The router implements fallback logic based on the `PROVIDER_FALLBACK_CHAIN` environment variable:

```
LLMRequest arrives
    |
    +-- Try primary provider (LLM_PROVIDER)
    |       Success? --> Return LLMResponse
    |       Failure? --> Log error, try next in chain
    |
    +-- Try fallback provider #1
    |       Success? --> Return LLMResponse
    |       Failure? --> Try next
    |
    +-- Try fallback provider #2
    |       Success? --> Return LLMResponse
    |       Failure? --> Raise ProviderExhaustedError
```

### Auth Profiles (`providers/auth_profiles.py`)

OAuth credentials (for Codex and future providers) are stored in `~/.autosales/auth-profiles.json`:

```json
{
  "openai-codex": {
    "provider_id": "openai-codex",
    "auth_type": "oauth",
    "access_token": "ey...",
    "refresh_token": "rt-...",
    "expires_at": 1717200000.0,
    "email": "user@example.com"
  }
}
```

The file is created by the CLI (`autosales providers auth login`) and read by the provider at runtime. Tokens are refreshed automatically when `is_expired` returns `True`.

---

## Email Channels

The email subsystem provides a unified interface across three providers. Each channel implements `BaseChannel` with methods for sending, receiving, and listing emails.

### Microsoft Outlook (`channels/outlook.py`)

- **Protocol**: Microsoft Graph API v1.0
- **Authentication**: OAuth2 via Microsoft Entra ID (Azure AD)
- **Required permissions**: `Mail.ReadWrite`, `Mail.Send`, `User.Read`
- **Capabilities**:
  - Send mail with HTML body and attachments
  - Read inbox with server-side filtering
  - Reply to existing threads (maintains `In-Reply-To` / `References` headers)
  - Webhook subscriptions for real-time new-mail notifications
  - Automatic rate limiting and exponential backoff on 429 responses

### Gmail (`channels/gmail.py`)

- **Protocol**: Gmail API v1
- **Authentication**: OAuth2 via Google Cloud Console
- **Required scopes**: `gmail.send`, `gmail.readonly`, `gmail.modify`
- **Capabilities**:
  - Send mail via Gmail API (not SMTP)
  - List and read messages with label-based filtering
  - Thread-aware replies
  - Push notifications via Google Pub/Sub for real-time delivery
  - Attachment handling (base64 encoding/decoding)

### Generic IMAP/SMTP (`channels/imap_smtp.py`)

- **Protocols**: IMAP4 (reading) + SMTP (sending)
- **Authentication**: Username/password with SSL/TLS
- **Capabilities**:
  - Connect to any standard email provider (Zoho, Fastmail, self-hosted)
  - Poll inbox for new messages at configurable intervals
  - Send plain-text and HTML emails via SMTP
  - Support for STARTTLS and implicit TLS
  - IDLE command support for push-like notifications (where supported)

### Email Gateway (Unified Interface)

The email gateway selects the active channel based on the `EMAIL_PROVIDER` environment variable and exposes a single interface:

```python
gateway.send_email(to, subject, body, reply_to_message_id=None)
gateway.get_new_emails(since=datetime)
gateway.get_thread(thread_id)
gateway.mark_as_read(message_id)
```

---

## Database Schema

PostgreSQL 16 with the pgvector extension serves as the single source of truth. The schema is defined in two migration files.

### Migration 001: Core CRM Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `prospects_data` | Master customer/prospect records | `customer_id` (UUID PK), `email`, `first_name`, `surname`, `company_name`, `company_research`, `country`, `language`, `pipedrive_deal_id`, `channel`, `is_unsubscribed` |
| `prospects_history` | Conversation and interaction log | `customer_id` (FK), `customer_message`, `agent_message`, `agent_id`, `platform`, `email_subject`, `search_vector` (tsvector, added in 002) |
| `follow_up_queue` | Scheduled follow-up messages | `customer_id` (FK), `scheduled_at`, `template_id`, `status` (pending/sent/cancelled) |
| `price_locks` | Product pricing catalog with floor prices | `product_sku`, `product_name`, `price_floor_pln/eur`, `price_catalog_pln/eur`, `moq_units`, `discount_allowed_pct`, `requires_human_approval` |
| `price_offers` | Generated price quotes for customers | `customer_id` (FK), `products` (JSONB), `total_value_pln/eur`, `is_below_floor`, `status` (draft/sent/accepted/rejected/expired) |

### Migration 002: Agent System Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `deals` | Central CRM deal hub | `id` (UUID PK), `title`, `customer_id` (FK), `stage` (8-value enum), `value_pln/eur`, `assigned_agent` (research/qualifier/pricer/followup/closer/human), `priority` (0-100), `tags` (text[]) |
| `activities` | Timeline event log | `deal_id` (FK), `customer_id` (FK), `activity_type` (18-value enum), `subject`, `body`, `metadata` (JSONB), `created_by` |
| `agent_memory` | Vector embeddings for semantic retrieval | `deal_id` (FK), `customer_id` (FK), `content`, `content_type` (conversation/research/note/decision/preference), `embedding` (vector(1536)) |
| `agent_runs` | Audit log for every agent execution | `run_type` (heartbeat/webhook/manual), `agent_name`, `deal_id` (FK), `status`, `tokens_used`, `cost_usd`, `duration_ms`, `error_message` |

### Views

| View | Purpose |
|------|---------|
| `v_pending_followups` | Pending follow-ups that are due (joined with prospect data) |
| `v_active_deals` | Active deals with latest offer information |
| `v_pipeline_summary` | Deal counts and total values grouped by stage |
| `v_deal_with_latest_activity` | Deals joined with prospect data and the most recent activity (LATERAL join) |

### Indexes

- **B-tree indexes** on all foreign keys and commonly filtered columns (email, stage, status, created_at)
- **GIN index** on `prospects_history.search_vector` for full-text search
- **IVFFlat index** on `agent_memory.embedding` for approximate nearest-neighbor vector search (100 lists, cosine similarity)
- **Row Level Security** is enabled on all tables (policies to be configured per deployment)

---

## API Endpoints

AutoSales AI exposes two API surfaces: Next.js API routes (for the frontend) and FastAPI routes (for the agent engine).

### Next.js API Routes (port 3000)

These are server-side route handlers inside `packages/web/src/app/api/` that the React frontend calls. They query Supabase/PostgreSQL directly.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/deals` | List deals with pipeline view |
| `GET` | `/api/deals/:id` | Get deal details with customer and activities |
| `POST` | `/api/deals` | Create a new deal |
| `PUT` | `/api/deals/:id` | Update deal (stage, value, notes, etc.) |
| `DELETE` | `/api/deals/:id` | Delete a deal |
| `GET` | `/api/contacts` | List contacts with search and pagination |
| `GET` | `/api/contacts/:id` | Get contact profile |
| `POST` | `/api/contacts` | Create a new contact |
| `PUT` | `/api/contacts/:id` | Update contact |
| `GET` | `/api/stats` | Dashboard statistics and metrics |
| `GET` | `/api/settings` | Application settings |
| `PUT` | `/api/settings` | Update settings |

### FastAPI Agent Routes (port 8000)

These are defined in `packages/agent/autosales/main.py` and handle agent operations.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/agent/health` | Health check -- returns status and heartbeat state |
| `POST` | `/agent/heartbeat` | Manually trigger one heartbeat cycle |
| `POST` | `/agent/run/{agent_name}` | Run a specific agent for a deal (`RunAgentRequest`: `deal_id`, `extra_context`) |
| `POST` | `/agent/memory/search` | Semantic/FTS search across conversation memory (`MemorySearchRequest`: `query`, `customer_id`) |
| `POST` | `/webhooks/email` | Receive inbound email notifications from email provider webhooks |

### Request/Response Models

**RunAgentRequest:**
```json
{
  "deal_id": "uuid",
  "extra_context": { "key": "value" }
}
```

**Agent Run Response:**
```json
{
  "status": "ok",
  "action_taken": "email_sent",
  "stage_change": "new_deal -> first_email",
  "email_sent": true,
  "activity_log": "Sent personalized introduction email",
  "metadata": { "tokens_used": 1250, "cost_usd": 0.0038 }
}
```

**MemorySearchRequest:**
```json
{
  "query": "chocolate distributor in Germany",
  "customer_id": "uuid-or-null"
}
```

**EmailWebhookPayload:**
```json
{
  "from_addr": "prospect@example.com",
  "to_addr": "sales@yourdomain.com",
  "subject": "Re: Partnership opportunity",
  "body": "Thank you for reaching out...",
  "message_id": "optional-message-id"
}
```

---

## Deployment Model

AutoSales AI supports three deployment configurations: local development, Docker Compose, and production VPS.

### Local Development

Run each service separately on the host machine:

```
[Terminal 1]  docker compose -f docker/docker-compose.yml up db -d     (PostgreSQL)
[Terminal 2]  cd packages/agent && uvicorn autosales.main:app --reload  (Agent on :8000)
[Terminal 3]  pnpm dev                                                  (Web on :3000)
```

### Docker Compose (Full Stack)

All three services run in containers on a single host:

```
docker compose -f docker/docker-compose.yml up -d
```

Container topology:

```
+------------------+     +------------------+     +------------------+
| autosales-web    |     | autosales-agent  |     | autosales-db     |
| (Next.js)        |     | (FastAPI)        |     | (PostgreSQL 16   |
| Port: 3000       |---->| Port: 8000       |---->|  + pgvector)     |
|                  |     |                  |     | Port: 5432       |
+------------------+     +------------------+     +------------------+
         |                       |                       |
         +--------autosales-network (bridge)-----------+
```

- The `web` and `agent` services depend on `db` (with a health check gate)
- The `agent` service mounts `agent-config/` as a read-only volume
- Both `web` and `agent` read from the shared `.env` file
- PostgreSQL data is persisted in a named Docker volume (`pgdata`)

### Production VPS (Ubuntu + systemd + Nginx)

The `deploy/install.sh` script automates the full production setup:

```bash
# On a fresh Ubuntu 22.04+ VPS
curl -fsSL https://raw.githubusercontent.com/Hermes663/Open-CRM-Agent/main/deploy/install.sh | bash
```

What the install script does:

1. Installs system dependencies (Docker, Node.js 20, Python 3.11, pnpm, certbot)
2. Clones the repository to `/opt/autosales-ai`
3. Copies `.env.example` to `.env` and prompts for required values
4. Starts Docker Compose (PostgreSQL)
5. Runs database migrations
6. Builds the Next.js frontend
7. Installs and starts systemd services:

```
# /etc/systemd/system/autosales-agent.service
[Service]
ExecStart=/opt/autosales-ai/packages/agent/.venv/bin/uvicorn \
  autosales.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always

# /etc/systemd/system/autosales-web.service
[Service]
ExecStart=/usr/bin/pnpm start
WorkingDirectory=/opt/autosales-ai
Restart=always
```

8. Configures Nginx as a reverse proxy:

```
# /etc/nginx/sites-enabled/autosales
server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL via Let's Encrypt (certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;    # Next.js frontend
    }

    location /agent/ {
        proxy_pass http://127.0.0.1:8000;    # FastAPI agent
    }

    location /webhooks/ {
        proxy_pass http://127.0.0.1:8000;    # Email webhooks
    }
}
```

9. Requests a Let's Encrypt SSL certificate via certbot
10. Starts all services and runs a health check

### Service Management

```bash
# View service status
sudo systemctl status autosales-agent
sudo systemctl status autosales-web

# Restart services
sudo systemctl restart autosales-agent
sudo systemctl restart autosales-web

# View logs
sudo journalctl -u autosales-agent -f
sudo journalctl -u autosales-web -f

# Docker database
cd /opt/autosales-ai && docker compose -f docker/docker-compose.yml logs db
```

---

## Further Reading

- **[QUICKSTART.md](QUICKSTART.md)** -- Step-by-step local setup guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** -- Detailed production deployment guide
- **[agent-config/SOUL.md](../agent-config/SOUL.md)** -- Agent identity and personality configuration
- **[agent-config/KNOWLEDGE.md](../agent-config/KNOWLEDGE.md)** -- Product and company knowledge base
- **[agent-config/PLAYBOOK.md](../agent-config/PLAYBOOK.md)** -- Sales strategies and cadence configuration
