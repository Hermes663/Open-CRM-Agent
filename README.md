<p align="center">
  <h1 align="center">OpenCRM</h1>
  <p align="center">
    <strong>Autonomous AI Sales Agent with CRM Dashboard</strong>
  </p>
  <p align="center">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
    <a href="#"><img src="https://img.shields.io/badge/python-3.12+-green.svg" alt="Python 3.12+"></a>
    <a href="#"><img src="https://img.shields.io/badge/Next.js-14-black.svg" alt="Next.js 14"></a>
    <a href="#"><img src="https://img.shields.io/badge/docker-compose-2496ED.svg" alt="Docker"></a>
    <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  </p>
</p>

---

OpenCRM is a fully autonomous AI sales development agent that handles the entire outbound sales process -- researching prospects, crafting personalized emails, following up on schedule, and qualifying leads -- while giving you complete visibility and control through a Pipedrive-inspired CRM dashboard. Deploy it on your own infrastructure, connect your email, and let it work around the clock.

## Key Features

- **Autonomous Operation** -- Heartbeat daemon runs continuously, picking up new leads and following up on existing conversations without human intervention
- **Infinite Memory** -- Three-tier memory system (working, episodic, semantic) with pgvector-powered search so the AI never forgets a conversation or loses context
- **CRM Dashboard** -- Pipedrive-style kanban board with drag-and-drop deal stages, contact profiles, activity timeline, and email thread viewer
- **Multi-Provider Email** -- Native support for Microsoft Outlook (Graph API), Gmail (OAuth2), and any IMAP/SMTP server
- **AI-Powered Agents** -- Specialized agents for research, qualification, follow-up, negotiation, and closing, each with distinct prompts and strategies
- **Self-Hosted** -- Full Docker Compose stack: no SaaS dependencies, no per-seat pricing, your data stays on your servers
- **One-Command VPS Deploy** -- Automated setup script for Ubuntu servers with SSL, systemd services, and monitoring out of the box
- **Open Source** -- MIT licensed. Fork it, extend it, build your sales empire on it

## Architecture Overview

```
                          +------------------+
                          |   CRM Dashboard  |
                          |   (Next.js 14)   |
                          +--------+---------+
                                   |
                              REST API
                                   |
+----------------+      +----------+----------+      +----------------+
|                |      |                     |      |                |
|  Email Inbox   +----->+    Agent Engine     +----->+  Email Outbox  |
|  (Outlook/     |      |    (FastAPI)        |      |  (SMTP/Graph)  |
|   Gmail/IMAP)  |      |                     |      |                |
+----------------+      +----+-------+--------+      +----------------+
                              |       |
                    +---------+       +---------+
                    |                           |
             +------+------+           +--------+--------+
             |  PostgreSQL  |           |   AI Agents     |
             |  + pgvector  |           |                 |
             |             |           |  - Research      |
             |  - Contacts  |           |  - Qualifier    |
             |  - Deals     |           |  - Follow-up    |
             |  - Emails    |           |  - Negotiator   |
             |  - Memory    |           |  - Closer       |
             +-------------+           +-----------------+
```

**How it works:** The heartbeat daemon polls for new inbound emails and scheduled follow-ups. The orchestrator routes each task to the appropriate AI agent. Agents use the memory system for context, generate responses via LLM, and send emails through your configured provider. Every action is logged and visible in the CRM dashboard.

## Quick Start

Get up and running in under 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/adikam/open-crm-agent.git
cd open-crm-agent

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env with your API keys and email credentials

# 3. Start everything with Docker Compose
docker compose up -d

# 4. Open the CRM dashboard
open http://localhost:3000

# 5. (Optional) Configure agents via the dashboard
# Navigate to Settings > Agents to customize behavior
```

For detailed setup instructions, see the [Quick Start Guide](docs/QUICKSTART.md).

## Screenshots

> Screenshots coming soon. Here is what you will see:

| Screen | Description |
|--------|-------------|
| **Kanban Board** | Drag-and-drop deal pipeline with stages: New Lead, Contacted, Qualified, Proposal, Negotiation, Closed Won/Lost |
| **Contact Profile** | Full contact details, company info, activity timeline, and email thread history |
| **Email Composer** | AI-suggested email drafts with tone controls, personalization tokens, and send scheduling |
| **Agent Dashboard** | Real-time view of agent activity, decisions made, emails sent, and performance metrics |
| **Settings** | Email provider configuration, agent tuning, pipeline customization, and team management |

## Architecture

The system is composed of three main services:

| Service | Tech | Purpose |
|---------|------|---------|
| **CRM Frontend** | Next.js 14, React, Tailwind CSS, shadcn/ui | Dashboard, email viewer, pipeline management |
| **Agent Engine** | Python 3.12, FastAPI, LangChain | AI agents, heartbeat daemon, orchestrator |
| **Database** | PostgreSQL 16 + pgvector | Contacts, deals, emails, memory vectors |

For the full architectural deep-dive, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend API | Python 3.12, FastAPI, Pydantic v2 |
| AI/LLM | OpenAI GPT-4o, LangChain |
| Database | PostgreSQL 16, pgvector, Drizzle ORM (frontend), SQLAlchemy (backend) |
| Email | Microsoft Graph API, Gmail OAuth2, IMAP/SMTP |
| Infra | Docker, Docker Compose, Nginx, Let's Encrypt |
| CI/CD | GitHub Actions |
| Monitoring | Structured logging, health endpoints |

## Agent System

OpenCRM uses a multi-agent architecture where each agent specializes in one phase of the sales cycle:

| Agent | Status | Description |
|-------|--------|-------------|
| **Research Agent** | Implemented | Enriches prospect data from LinkedIn, company websites, and public sources |
| **Qualifier Agent** | Implemented | Scores leads based on ICP fit, engagement signals, and conversation analysis |
| **Follow-up Agent** | Implemented | Manages follow-up cadences with contextual, personalized messages |
| **Negotiator Agent** | Planned | Handles objections, proposes solutions, navigates pricing discussions |
| **Closer Agent** | Planned | Drives conversations toward commitment, handles final logistics |

The **Orchestrator** sits above all agents and decides which agent handles each interaction based on deal stage, conversation context, and configurable rules.

## Roadmap

### Phase 1 -- Core (Current)
- [x] CRM dashboard with kanban pipeline
- [x] Email integration (Outlook, Gmail, IMAP)
- [x] Research, Qualifier, and Follow-up agents
- [x] Heartbeat daemon for autonomous operation
- [x] Three-tier memory system with semantic search
- [x] Docker Compose deployment

### Phase 2 -- Growth
- [ ] Multi-user support with role-based access
- [ ] Team analytics and performance dashboards
- [ ] Webhook integrations (Slack, Zapier)
- [ ] Calendar booking integration
- [ ] A/B testing for email templates

### Phase 3 -- Scale
- [ ] Negotiator and Closer agents
- [ ] Voice call integration
- [ ] Multi-language support
- [ ] Custom agent builder (no-code)
- [ ] Marketplace for agent templates

## Contributing

Contributions are welcome and appreciated. Here is how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Commit** your changes: `git commit -m "Add my feature"`
4. **Push** to your branch: `git push origin feature/my-feature`
5. **Open** a Pull Request

Please make sure your code passes linting (`ruff check` for Python, `next lint` for the frontend) before submitting.

### Areas Where Help Is Needed

- Agent prompt engineering and evaluation
- Email deliverability optimization
- Dashboard UI/UX improvements
- Additional email provider integrations
- Documentation and tutorials
- Test coverage

## Deployment

- **Local development**: `docker compose up` (see [Quick Start](docs/QUICKSTART.md))
- **VPS production**: One-command install script (see [Deployment Guide](docs/DEPLOYMENT.md))

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Credits

Built by [ADIKAM](https://adikam.com).

Inspired by:
- **OpenClaw** -- for the open-source AI agent architecture patterns
- **Agent Hermes** -- for autonomous agent orchestration concepts
- **Pipedrive** -- for the CRM dashboard design philosophy

---

<p align="center">
  <strong>If OpenCRM helps your sales process, give it a star on GitHub.</strong>
</p>
