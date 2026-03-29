# Quick Start Guide

Get AutoSales AI running locally in under 10 minutes.

---

## Prerequisites

Make sure you have the following installed on your machine:

| Tool | Version | Purpose |
|------|---------|---------|
| **Docker** | v24+ | Container runtime for PostgreSQL (and optional full-stack deployment) |
| **Docker Compose** | v2.20+ | Multi-container orchestration |
| **Node.js** | v20+ | Next.js frontend runtime |
| **pnpm** | v9+ | Package manager (monorepo workspaces) |
| **Python** | 3.11+ | Agent backend runtime |
| **Git** | any | Clone the repository |

You will also need at least one of the following:

- **LLM API key**: Anthropic API key, OpenAI API key, or a ChatGPT Plus/Pro subscription (for OpenAI Codex OAuth)
- **Email credentials**: Microsoft Outlook (Azure AD app), Gmail (Google Cloud OAuth2), or any IMAP/SMTP server

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/adikam/autosales-ai.git
cd autosales-ai
```

## Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure the required sections:

### LLM Provider (required -- at least one)

```env
# Option A: Anthropic (Claude)
LLM_PROVIDER=anthropic
LLM_MODEL=anthropic/claude-sonnet-4-6
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx

# Option B: OpenAI (API key)
LLM_PROVIDER=openai
LLM_MODEL=openai/gpt-4o
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# Option C: OpenAI Codex (uses your ChatGPT subscription -- no API billing)
LLM_PROVIDER=openai-codex
OPENAI_CODEX_CLIENT_ID=your_oauth_client_id
OPENAI_CODEX_SUBSCRIPTION_TIER=plus
# After setup, run: autosales providers auth login --provider openai-codex
```

You can configure a **fallback chain** so the system automatically tries the next provider if one fails:

```env
PROVIDER_FALLBACK_CHAIN=anthropic,openai
```

### Database (pre-configured for Docker)

```env
DATABASE_URL=postgresql://autosales:your_secure_password@localhost:5432/autosales
```

If you are using the provided Docker Compose setup, the default credentials work out of the box. Change `DB_PASSWORD` for production.

### Email Provider (required -- at least one)

```env
# --- Option A: Generic IMAP/SMTP (works with most email providers) ---
EMAIL_PROVIDER=imap
IMAP_HOST=imap.your-provider.com
IMAP_PORT=993
IMAP_USER=sales@yourdomain.com
IMAP_PASSWORD=your_email_password
IMAP_USE_SSL=true
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=sales@yourdomain.com
SMTP_PASSWORD=your_email_password
SMTP_USE_TLS=true

# --- Option B: Microsoft Outlook / Office 365 ---
EMAIL_PROVIDER=outlook
OUTLOOK_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OUTLOOK_CLIENT_SECRET=your_client_secret
OUTLOOK_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OUTLOOK_USER_EMAIL=sales@yourdomain.com

# --- Option C: Gmail ---
EMAIL_PROVIDER=gmail
GMAIL_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPx-xxxxxxxxxxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_USER_EMAIL=sales@yourdomain.com
```

### Application Settings

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
AGENT_API_URL=http://localhost:8000
JWT_SECRET=generate_a_strong_random_secret_here
HEARTBEAT_INTERVAL_MINUTES=30
AGENT_MAX_EMAILS_PER_HOUR=20
```

## Step 3: Start the Database with Docker Compose

Start PostgreSQL with the pgvector extension:

```bash
# From the project root
docker compose -f docker/docker-compose.yml up db -d
```

Verify the database is running:

```bash
docker compose -f docker/docker-compose.yml ps
```

You should see `autosales-db` in the `running (healthy)` state.

## Step 4: Run Database Migrations

Apply the SQL migrations to create the schema:

```bash
# Connect to the database and run migrations
docker compose -f docker/docker-compose.yml exec db \
  psql -U autosales -d autosales \
  -f /dev/stdin < supabase/migrations/001_initial_schema.sql

docker compose -f docker/docker-compose.yml exec db \
  psql -U autosales -d autosales \
  -f /dev/stdin < supabase/migrations/002_agent_system.sql
```

Alternatively, if you have `psql` installed locally:

```bash
psql "postgresql://autosales:your_secure_password@localhost:5432/autosales" \
  -f supabase/migrations/001_initial_schema.sql

psql "postgresql://autosales:your_secure_password@localhost:5432/autosales" \
  -f supabase/migrations/002_agent_system.sql
```

Verify the tables were created:

```bash
docker compose -f docker/docker-compose.yml exec db \
  psql -U autosales -d autosales -c "\dt"
```

You should see tables including `prospects_data`, `deals`, `activities`, `agent_memory`, `agent_runs`, `follow_up_queue`, `price_locks`, and `price_offers`.

## Step 5: Seed Data (Optional)

Load sample data to explore the dashboard before connecting your own accounts:

```bash
cd packages/agent
python -m autosales.cli seed
```

This creates sample contacts, deals across various pipeline stages, and demo activity logs so you can see how the dashboard looks with real data.

## Step 6: Install Dependencies and Start the Agent Backend

```bash
# Install Python dependencies
cd packages/agent
pip install -e ".[dev]"

# Start the FastAPI agent backend
uvicorn autosales.main:app --reload --port 8000
```

You can also start the agent from the monorepo root:

```bash
pnpm agent:dev
```

Verify the agent is running:

```bash
curl http://localhost:8000/agent/health
```

Expected response:

```json
{
  "status": "ok",
  "heartbeat_running": true
}
```

## Step 7: Install Dependencies and Start the Web Frontend

Open a new terminal:

```bash
# Install Node.js dependencies (from project root)
pnpm install

# Start the Next.js development server
pnpm dev
```

The frontend starts on port 3000 by default.

## Step 8: Open the Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

You should see the AutoSales AI dashboard with the pipeline overview, key metrics, and recent activity.

## Step 9: First Steps

Now that everything is running, here is what to explore:

### Explore the Pipeline

- Navigate to the **Pipeline** view to see the kanban board
- If you loaded seed data, you will see sample deals across stages
- Drag and drop deals between columns to change their stage

### Trigger the Agent Manually

Use the API to trigger a heartbeat cycle (the agent checks for pending tasks):

```bash
curl -X POST http://localhost:8000/agent/heartbeat
```

Or trigger a specific agent for a specific deal:

```bash
curl -X POST http://localhost:8000/agent/run/research \
  -H "Content-Type: application/json" \
  -d '{"deal_id": "your-deal-uuid"}'
```

### Check Settings

- Navigate to **Settings** in the dashboard
- Review the email provider configuration
- Check the agent behavior settings (heartbeat interval, max emails per hour)

### Search Memory

Query the agent's memory system:

```bash
curl -X POST http://localhost:8000/agent/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "chocolate distributor Germany"}'
```

---

## Alternative: Full Docker Compose (No Local Setup)

If you prefer not to install Node.js and Python locally, you can run everything in Docker:

```bash
# Start all three services (db + web + agent)
docker compose -f docker/docker-compose.yml up -d

# Check status
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs -f
```

This starts:
- `autosales-db` -- PostgreSQL 16 + pgvector on port **5432**
- `autosales-web` -- Next.js CRM dashboard on port **3000**
- `autosales-agent` -- FastAPI agent engine on port **8000**

---

## OpenAI Codex Provider Setup (ChatGPT Subscription)

If you want to use your ChatGPT Plus or Pro subscription instead of paying per-token API fees:

```bash
# Install the CLI tool
cd packages/agent
pip install -e .

# Authenticate with your ChatGPT account (opens browser)
autosales providers auth login --provider openai-codex
```

This will:
1. Open your browser to the ChatGPT login page
2. After you log in, store OAuth tokens in `~/.autosales/auth-profiles.json`
3. The agent can now use your ChatGPT subscription for LLM calls

Set in your `.env`:

```env
LLM_PROVIDER=openai-codex
OPENAI_CODEX_SUBSCRIPTION_TIER=plus   # "plus" = 5h/week, "pro" = unlimited
```

---

## Troubleshooting

### Database container fails to start

```bash
# Check logs
docker compose -f docker/docker-compose.yml logs db

# Common fix: port 5432 already in use
# Either stop the other PostgreSQL instance or change the port mapping
# in docker/docker-compose.yml
```

### Agent cannot connect to database

Make sure the `DATABASE_URL` in your `.env` uses `localhost` (for local development) or `db` (when running inside Docker):

```env
# Local development (agent runs outside Docker, DB runs in Docker)
DATABASE_URL=postgresql://autosales:change_me_in_production@localhost:5432/autosales

# Full Docker Compose (agent runs inside Docker alongside DB)
DATABASE_URL=postgresql://autosales:change_me_in_production@db:5432/autosales
```

### Email sending failures

1. Verify email credentials in `.env`
2. Check agent logs: look for lines with `[email]` or `[channel]`
3. **Outlook**: ensure your Azure AD app has `Mail.ReadWrite` and `Mail.Send` permissions
4. **Gmail**: ensure OAuth2 scopes include `gmail.send` and `gmail.readonly`
5. **IMAP/SMTP**: verify your provider allows app passwords or less secure app access

### Frontend shows "Failed to fetch" errors

Make sure both the agent backend (port 8000) and the frontend (port 3000) are running. The frontend calls the agent API -- check CORS settings:

```env
# In the agent, CORS is configured to allow the frontend origin
# Default: http://localhost:3000
```

### Heartbeat not triggering agents

```bash
# Check heartbeat status
curl http://localhost:8000/agent/health

# Manually trigger a cycle
curl -X POST http://localhost:8000/agent/heartbeat
```

---

## Next Steps

- **[Architecture](ARCHITECTURE.md)** -- Understand how all the components fit together
- **[Deployment](DEPLOYMENT.md)** -- Deploy to a production VPS with SSL and monitoring
- **[agent-config/SOUL.md](../agent-config/SOUL.md)** -- Customize the agent's personality and behavior
- **[agent-config/PLAYBOOK.md](../agent-config/PLAYBOOK.md)** -- Configure sales strategies and cadences
