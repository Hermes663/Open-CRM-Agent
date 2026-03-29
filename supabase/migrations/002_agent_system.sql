-- ============================================================================
-- Migration 002: Agent System
-- AutoSales AI - Multi-agent orchestration, memory, and audit tables
-- ============================================================================
-- Tables: deals, activities, agent_memory, agent_runs
-- Views:  v_pipeline_summary, v_deal_with_latest_activity
-- Also:   Full-text search on prospects_history, pgvector extension
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 1. deals - Central CRM deal hub
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(300) NOT NULL,
    customer_id         UUID REFERENCES prospects_data (customer_id) ON DELETE SET NULL,
    stage               VARCHAR(50) NOT NULL DEFAULT 'new_deal'
                        CHECK (stage IN (
                            'new_deal', 'first_email', 'qualifying',
                            'follow_up', 'negotiation', 'closing',
                            'won', 'lost'
                        )),
    value_pln           DECIMAL(12, 2),
    value_eur           DECIMAL(12, 2),
    currency            VARCHAR(3) DEFAULT 'EUR',
    assigned_agent      VARCHAR(50) DEFAULT 'research'
                        CHECK (assigned_agent IN (
                            'research', 'qualifier', 'pricer',
                            'followup', 'closer', 'human'
                        )),
    priority            INTEGER DEFAULT 50
                        CHECK (priority >= 0 AND priority <= 100),
    tags                TEXT[],
    lost_reason         TEXT,
    won_at              TIMESTAMPTZ,
    lost_at             TIMESTAMPTZ,
    expected_close_date DATE,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_stage
    ON deals (stage);

CREATE INDEX IF NOT EXISTS idx_deals_customer
    ON deals (customer_id);

CREATE INDEX IF NOT EXISTS idx_deals_assigned_agent
    ON deals (assigned_agent);

CREATE INDEX IF NOT EXISTS idx_deals_priority
    ON deals (priority DESC);

-- Auto-update updated_at (reuses function from migration 001)
CREATE TRIGGER trg_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. activities - Every action / event log
-- ----------------------------------------------------------------------------
CREATE TYPE activity_type AS ENUM (
    'email_sent',
    'email_received',
    'email_opened',
    'call_made',
    'call_received',
    'note_added',
    'research_completed',
    'stage_changed',
    'deal_created',
    'deal_won',
    'deal_lost',
    'follow_up_scheduled',
    'follow_up_sent',
    'quote_sent',
    'quote_accepted',
    'quote_rejected',
    'escalated_to_human',
    'human_responded',
    'agent_decision'
);

CREATE TABLE IF NOT EXISTS activities (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id        UUID REFERENCES deals (id) ON DELETE CASCADE,
    customer_id    UUID REFERENCES prospects_data (customer_id) ON DELETE SET NULL,
    activity_type  activity_type NOT NULL,
    subject        VARCHAR(500),
    body           TEXT,
    metadata       JSONB,
    created_by     VARCHAR(100) DEFAULT 'agent',
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_deal
    ON activities (deal_id);

CREATE INDEX IF NOT EXISTS idx_activities_type
    ON activities (activity_type);

CREATE INDEX IF NOT EXISTS idx_activities_created_at
    ON activities (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_customer
    ON activities (customer_id);

-- ----------------------------------------------------------------------------
-- 3. agent_memory - Vector embeddings for semantic retrieval
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_memory (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id       UUID REFERENCES deals (id) ON DELETE CASCADE,
    customer_id   UUID REFERENCES prospects_data (customer_id) ON DELETE SET NULL,
    content       TEXT NOT NULL,
    content_type  VARCHAR(50)
                  CHECK (content_type IN (
                      'conversation', 'research', 'note',
                      'decision', 'preference'
                  )),
    embedding     vector(1536),
    metadata      JSONB,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_deal
    ON agent_memory (deal_id);

CREATE INDEX IF NOT EXISTS idx_agent_memory_customer
    ON agent_memory (customer_id);

-- IVFFlat index for approximate nearest-neighbor search.
-- Requires at least ~1000 rows before it becomes effective.
-- For small datasets, exact (sequential) search is used automatically.
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding
    ON agent_memory
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ----------------------------------------------------------------------------
-- 4. agent_runs - Audit log for every agent execution
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type        VARCHAR(50) NOT NULL
                    CHECK (run_type IN ('heartbeat', 'webhook', 'manual')),
    agent_name      VARCHAR(50),
    deal_id         UUID REFERENCES deals (id) ON DELETE SET NULL,
    status          VARCHAR(20) DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
    input_summary   TEXT,
    output_summary  TEXT,
    tokens_used     INTEGER,
    cost_usd        DECIMAL(8, 4),
    duration_ms     INTEGER,
    error_message   TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
    ON agent_runs (status);

CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at
    ON agent_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_name
    ON agent_runs (agent_name);

CREATE INDEX IF NOT EXISTS idx_agent_runs_deal
    ON agent_runs (deal_id);

-- ----------------------------------------------------------------------------
-- 5. Full-text search on prospects_history
-- ----------------------------------------------------------------------------
ALTER TABLE prospects_history
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(customer_message, '') || ' ' ||
            coalesce(agent_message, '') || ' ' ||
            coalesce(email_subject, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_prospects_history_fts
    ON prospects_history
    USING GIN (search_vector);

-- ----------------------------------------------------------------------------
-- 6. Row Level Security - enabled on new tables
-- ----------------------------------------------------------------------------
ALTER TABLE deals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs   ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. Views
-- ----------------------------------------------------------------------------

-- Pipeline summary: deal counts and values per stage
CREATE OR REPLACE VIEW v_pipeline_summary AS
SELECT
    stage,
    COUNT(*)                   AS deal_count,
    COALESCE(SUM(value_eur), 0) AS total_value_eur,
    COALESCE(AVG(value_eur), 0) AS avg_value_eur
FROM deals
WHERE stage NOT IN ('won', 'lost')
GROUP BY stage
ORDER BY
    CASE stage
        WHEN 'new_deal'     THEN 1
        WHEN 'first_email'  THEN 2
        WHEN 'qualifying'   THEN 3
        WHEN 'follow_up'    THEN 4
        WHEN 'negotiation'  THEN 5
        WHEN 'closing'      THEN 6
    END;

-- Deal detail with prospect info and latest activity (LATERAL JOIN)
CREATE OR REPLACE VIEW v_deal_with_latest_activity AS
SELECT
    d.id              AS deal_id,
    d.title,
    d.stage,
    d.value_eur,
    d.value_pln,
    d.currency,
    d.assigned_agent,
    d.priority,
    d.tags,
    d.expected_close_date,
    d.created_at      AS deal_created_at,
    d.updated_at      AS deal_updated_at,
    -- Prospect info
    p.customer_id,
    p.email,
    p.first_name,
    p.surname,
    p.company_name,
    p.country,
    p.channel,
    -- Latest activity
    la.activity_id    AS latest_activity_id,
    la.activity_type  AS latest_activity_type,
    la.subject        AS latest_activity_subject,
    la.created_at     AS latest_activity_at,
    la.created_by     AS latest_activity_by
FROM deals d
LEFT JOIN prospects_data p ON p.customer_id = d.customer_id
LEFT JOIN LATERAL (
    SELECT
        a.id          AS activity_id,
        a.activity_type,
        a.subject,
        a.created_at,
        a.created_by
    FROM activities a
    WHERE a.deal_id = d.id
    ORDER BY a.created_at DESC
    LIMIT 1
) la ON TRUE
ORDER BY d.updated_at DESC;
