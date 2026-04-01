<p align="center">
  <h1 align="center">AutoSales AI</h1>
  <p align="center">
    <strong>Open-source autonomous AI sales agent with CRM interface</strong>
  </p>
  <p align="center">
    <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
    <a href="#"><img src="https://img.shields.io/badge/python-3.11+-green.svg" alt="Python 3.11+"></a>
    <a href="#"><img src="https://img.shields.io/badge/Next.js-14-black.svg" alt="Next.js 14"></a>
    <a href="#"><img src="https://img.shields.io/badge/docker-compose-2496ED.svg" alt="Docker"></a>
    <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  </p>
</p>

---

AutoSales AI is a fully autonomous AI-powered sales development representative (SDR) that handles the complete outbound sales cycle -- from prospect research and personalized email outreach to follow-up cadences and lead qualification. It ships with a Pipedrive-style CRM dashboard so you always have visibility and control over your pipeline. Self-hosted, open-source, and built to run 24/7 on your own infrastructure.

<!-- screenshot: dashboard overview -->

## Key Features

- **Autonomous Agent Loop** -- A heartbeat daemon runs continuously in the background, polling for new inbound emails, triggering scheduled follow-ups, and routing tasks to specialized AI agents without any human intervention.
- **Multi-Provider LLM Support** -- Plug-and-play provider system supporting Anthropic (Claude), OpenAI (API key), and OpenAI Codex (ChatGPT subscription via OAuth). Configurable fallback chains let you switch models on the fly.
- **Email Integration** -- Native connectors for Microsoft Outlook (Graph API), Gmail (OAuth2), and generic IMAP/SMTP servers. Send, receive, and track emails from any provider.
- **Pipedrive-Style Kanban Board** -- Drag-and-drop deal pipeline with eight stages (New Deal, First Email, Qualifying, Follow-up, Negotiation, Closing, Won, Lost), contact profiles, and activity timelines.
- **Real-Time Dashboard** -- Live metrics for active deals, pipeline value, emails sent, and agent actions with trend indicators.
- **Three-Tier Memory System** -- Working memory (current context), episodic memory (full conversation history with FTS), and semantic memory (pgvector embeddings for similarity search). The agent never loses context.
- **Self-Hosted** -- Full Docker Compose stack with PostgreSQL 16 + pgvector. No SaaS dependencies, no per-seat pricing, your data stays on your servers.
- **One-Command Deploy** -- Automated install script for Ubuntu VPS with systemd services, Nginx reverse proxy, and SSL via Let's Encrypt.

<!-- screenshot: kanban pipeline board -->

## Architecture

```
+------------------------------------------------------------------+
|                       CRM Dashboard                              |
|                      (Next.js 14 + React 18 + Tailwind CSS)      |
|                                                                  |
|   +----------+  +-----------+  +---------+  +----------+        |
|   | Kanban   |  | Contacts  |  | Deal    |  | Settings |        |
|   | Pipeline |  | Manager   |  | Detail  |  | Panel    |        |
|   +----------+  +-----------+  +---------+  +----------+        |
+---------|--------------------------------------------------------+
          |
     Next.js API Routes (REST)
          |
+---------|--------------------------------------------------------+
|         v            Agent Engine (Python FastAPI)                |
|                                                                  |
|  +-------------+   +--------------+   +---------------------+    |
|  | Heartbeat   |   | Orchestrator |   | Email Gateway       |    |
|  | Daemon      |   | (decision    |   | (Outlook / Gmail /  |    |
|  | (APScheduler|   |  tree router)|   |  IMAP+SMTP)         |    |
|  +------+------+   +------+-------+   +----------+----------+    |
|         |                 |                       |               |
|  +------+-----------------+-----------------------+----------+    |
|  |                    Agent Pool                             |    |
|  |  +-----------+ +-----------+ +------------+               |    |
|  |  | Research  | | Qualifier | | Follow-up  |               |    |
|  |  | Agent     | | Agent     | | Agent      |               |    |
|  |  +-----------+ +-----------+ +------------+               |    |
|  +-----------------------------------------------------------+    |
|         |                                                        |
|  +------+----------------------------------------------------+    |
|  |              LLM Provider Plugin System                    |    |
|  |  +-----------+ +-----------+ +------------------+          |    |
|  |  | Anthropic | | OpenAI    | | OpenAI Codex     |          |    |
|  |  | (API key) | | (API key) | | (OAuth / ChatGPT)|          |    |
|  |  +-----------+ +-----------+ +------------------+          |    |
|  +------------------------------------------------------------+    |
|         |                                                        |
|  +------+----------------------------------------------------+    |
|  |              Memory System                                 |    |
|  |  +-----------+ +-------------+ +-------------------+       |    |
|  |  | Working   | | Episodic    | | Semantic          |       |    |
|  |  | Memory    | | Memory (FTS)| | Memory (pgvector) |       |    |
|  |  +-----------+ +-------------+ +-------------------+       |    |
|  +------------------------------------------------------------+    |
+---------|--------------------------------------------------------+
          |
+---------|--------------------------------------------------------+
|         v              PostgreSQL 16 + pgvector                  |
|                                                                  |
|  +-----------+ +--------+ +----------+ +---------+ +-----------+ |
|  | prospects | | deals  | | activit- | | agent_  | | agent_    | |
|  | _data     | |        | | ies      | | memory  | | runs      | |
|  +-----------+ +--------+ +----------+ +---------+ +-----------+ |
|  +-----------+ +----------+ +-----------+ +--------------------+ |
|  | follow_up | | price_   | | price_    | | prospects_history  | |
|  | _queue    | | locks    | | offers    | | (FTS index)        | |
|  +-----------+ +----------+ +-----------+ +--------------------+ |
+------------------------------------------------------------------+
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| UI Components | hello-pangea/dnd (drag-and-drop), Lucide icons, class-variance-authority |
| Backend API | Python 3.11+, FastAPI, Pydantic v2, uvicorn |
| AI / LLM | Anthropic Claude, OpenAI GPT-4o, OpenAI Codex (ChatGPT subscription) |
| Database | PostgreSQL 16, pgvector extension, Supabase client SDK |
| Memory | Working memory (in-process), FTS (tsvector), Semantic search (pgvector 1536d) |
| Email | Microsoft Graph API, Gmail OAuth2, IMAP/SMTP |
| Scheduling | APScheduler (heartbeat daemon) |
| Infrastructure | Docker, Docker Compose, Nginx, systemd, Let's Encrypt |
| CLI | Typer (agent management commands) |
| Dev Tools | Ruff (linter), pytest, pnpm workspaces |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Hermes663/Open-CRM-Agent.git
cd Open-CRM-Agent

# Configure environment
cp .env.example .env
# Edit .env -- set at least one LLM API key and email credentials

# Start all services
docker compose -f docker/docker-compose.yml up -d

# Open the CRM dashboard
open http://localhost:3000
```

For the full step-by-step walkthrough (local development without Docker, migrations, seed data), see the **[Quick Start Guide](QUICKSTART.md)**.

<!-- screenshot: email composer with AI-generated draft -->

## Project Structure

```
autosales-ai/
  package.json                 # pnpm monorepo root
  pnpm-workspace.yaml
  .env.example                 # All configuration variables
  docker/
    docker-compose.yml         # Production compose (db + web + agent)
    Dockerfile.web             # Next.js container
    Dockerfile.agent           # FastAPI container
  packages/
    web/                       # Next.js 14 CRM frontend
      src/app/                 # App Router pages (dashboard, pipeline, contacts, settings)
      src/components/          # React components (kanban, deals, layout)
      src/lib/                 # Types, API client, Supabase helpers
    agent/                     # Python FastAPI agent backend
      autosales/
        agents/                # Research, Qualifier, Follow-up agents
        channels/              # Outlook, Gmail, IMAP/SMTP email connectors
        core/                  # AgentRunner, Heartbeat daemon, Orchestrator
        memory/                # MemoryManager, FTS search
        providers/             # LLM provider plugins (Anthropic, OpenAI, Codex)
        integrations/          # Supabase client, external APIs
        cli/                   # Typer CLI commands
        main.py                # FastAPI app entry point
  agent-config/                # Agent personality and behavior
    SOUL.md                    # Core identity, personality, behavioral boundaries
    KNOWLEDGE.md               # Product catalog, company context
    PLAYBOOK.md                # Sales strategies and cadences
    prompts/                   # Per-agent system prompts
  supabase/
    migrations/                # SQL migration files (001_initial, 002_agent_system)
  deploy/
    install.sh                 # One-command VPS setup script
    nginx/                     # Nginx reverse proxy config
    systemd/                   # Service unit files
  docs/
    QUICKSTART.md              # Step-by-step setup guide
    ARCHITECTURE.md            # Technical deep-dive
    DEPLOYMENT.md              # Production deployment guide
```

## Agent System

AutoSales AI uses a multi-agent architecture where specialized agents handle different phases of the sales cycle:

| Agent | Status | Role |
|-------|--------|------|
| **Research Agent** | Active | Enriches prospect data -- company info, recent news, tech stack, decision-maker identification |
| **Qualifier Agent** | Active | Analyzes inbound replies for sentiment and intent, scores leads against ICP criteria, updates deal stages |
| **Follow-up Agent** | Active | Manages multi-step follow-up cadences with context-aware personalized messages, respects timezone and rate limits |
| **Negotiation Stage** | Manual in v1 | Visible in the CRM, but not routed to a dedicated automation agent |
| **Closing Stage** | Manual in v1 | Visible in the CRM, but not routed to a dedicated automation agent |

The **Orchestrator** routes each task to the correct agent based on a decision tree that considers deal stage, conversation history, and whether the task was triggered by the heartbeat daemon, an inbound webhook, or a manual action from the dashboard.

<!-- screenshot: agent activity monitor -->

## Roadmap

**Phase 1 -- Core (current)**
- [x] CRM dashboard with drag-and-drop kanban pipeline
- [x] Multi-provider email integration (Outlook, Gmail, IMAP/SMTP)
- [x] Research, Qualifier, and Follow-up agents
- [x] Heartbeat daemon for autonomous 24/7 operation
- [x] Three-tier memory system with pgvector semantic search
- [x] Multi-provider LLM support with fallback chains
- [x] Docker Compose deployment
- [x] One-command VPS install script

**Phase 2 -- Growth**
- [ ] Multi-user support with role-based access control
- [ ] Team analytics and performance dashboards
- [ ] Webhook integrations (Slack, Zapier)
- [ ] Calendar booking integration
- [ ] A/B testing for email templates and agent strategies

**Phase 3 -- Scale**
- [ ] Dedicated negotiation and closing agents
- [ ] Voice call integration
- [ ] Custom agent builder (no-code UI)
- [ ] Agent template marketplace
- [ ] Multi-language dashboard UI

## Contributing

Contributions are welcome. Here is how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Commit** your changes: `git commit -m "Add my feature"`
4. **Push** to your branch: `git push origin feature/my-feature`
5. **Open** a Pull Request

Please ensure your code passes linting before submitting: `ruff check` for Python, `pnpm lint` for the frontend.

### Areas Where Help Is Needed

- Agent prompt engineering and evaluation frameworks
- Email deliverability optimization (SPF, DKIM, warm-up strategies)
- Dashboard UI/UX improvements
- Additional LLM provider plugins
- Test coverage (pytest for agent, vitest for frontend)
- Documentation and tutorials

## Documentation

- **[Quick Start Guide](QUICKSTART.md)** -- Get running locally in 10 minutes
- **[Architecture](ARCHITECTURE.md)** -- Technical deep-dive into every component
- **[Deployment Guide](DEPLOYMENT.md)** -- Production deployment on a VPS

## License

This project is licensed under the **MIT License**. See the [LICENSE](../LICENSE) file for details.

## Author

Built and maintained by **[ADIKAM Sp. z o.o.](https://adikam.com)** -- Borek Szlachecki, Poland.

---

Inspired by [OpenClaw](https://github.com/openclaw) (agent architecture), Hermes (autonomous orchestration patterns), and [Pipedrive](https://pipedrive.com) (CRM design philosophy).

---

<p align="center">
  <strong>If AutoSales AI helps your sales process, give it a star on GitHub.</strong>
</p>
