-- ============================================================================
-- Migration 001: Initial Schema
-- AutoSales AI - Core CRM and pricing tables
-- ============================================================================
-- Tables: prospects_data, prospects_history, follow_up_queue,
--         price_locks, price_offers
-- Views:  v_pending_followups, v_active_deals
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. prospects_data - Master customer/prospect record
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospects_data (
    customer_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) NOT NULL,
    first_name        VARCHAR(100),
    surname           VARCHAR(100),
    company_name      VARCHAR(255),
    company_research  TEXT,
    phone             VARCHAR(50),
    country           VARCHAR(100),
    language          VARCHAR(10),
    pipedrive_deal_id VARCHAR(50),
    pipedrive_person_id VARCHAR(50),
    pipedrive_stage_id  VARCHAR(50),
    channel           VARCHAR(50),
    is_unsubscribed   BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    notes             TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospects_data_email
    ON prospects_data (email);

CREATE INDEX IF NOT EXISTS idx_prospects_data_company
    ON prospects_data (company_name);

CREATE INDEX IF NOT EXISTS idx_prospects_data_pipedrive_deal
    ON prospects_data (pipedrive_deal_id);

CREATE INDEX IF NOT EXISTS idx_prospects_data_channel
    ON prospects_data (channel);

-- ----------------------------------------------------------------------------
-- 2. prospects_history - Conversation / interaction log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prospects_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id             UUID REFERENCES prospects_data (customer_id) ON DELETE CASCADE,
    customer_email          VARCHAR(255),
    customer_message        TEXT,
    agent_message           TEXT,
    agent_id                VARCHAR(100),
    platform                VARCHAR(50),
    date                    TIMESTAMPTZ DEFAULT now(),
    email_subject           VARCHAR(500),
    attachments             JSONB,
    pipedrive_stage_at_time VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_prospects_history_customer
    ON prospects_history (customer_id);

CREATE INDEX IF NOT EXISTS idx_prospects_history_date
    ON prospects_history (date DESC);

CREATE INDEX IF NOT EXISTS idx_prospects_history_platform
    ON prospects_history (platform);

-- ----------------------------------------------------------------------------
-- 3. follow_up_queue - Scheduled follow-up messages
-- ----------------------------------------------------------------------------
CREATE TYPE follow_up_status AS ENUM ('pending', 'sent', 'cancelled');

CREATE TABLE IF NOT EXISTS follow_up_queue (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID REFERENCES prospects_data (customer_id) ON DELETE CASCADE,
    scheduled_at     TIMESTAMPTZ NOT NULL,
    template_id      VARCHAR(100),
    status           follow_up_status DEFAULT 'pending',
    cancelled_reason TEXT,
    sent_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_customer
    ON follow_up_queue (customer_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_status_scheduled
    ON follow_up_queue (status, scheduled_at);

-- ----------------------------------------------------------------------------
-- 4. price_locks - Product pricing catalog with floor prices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_locks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_sku             VARCHAR(100) NOT NULL,
    product_name            VARCHAR(300) NOT NULL,
    product_ean             VARCHAR(50),
    category                VARCHAR(100),
    packaging_unit          VARCHAR(50),
    units_per_carton        INTEGER,
    cartons_per_pallet      INTEGER,
    price_floor_pln         DECIMAL(10, 2),
    price_floor_eur         DECIMAL(10, 2),
    price_catalog_pln       DECIMAL(10, 2),
    price_catalog_eur       DECIMAL(10, 2),
    moq_units               INTEGER,
    moq_cartons             INTEGER,
    discount_allowed_pct    DECIMAL(5, 2),
    requires_human_approval BOOLEAN DEFAULT FALSE,
    is_active               BOOLEAN DEFAULT TRUE,
    updated_at              TIMESTAMPTZ DEFAULT now(),
    updated_by              VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_price_locks_sku
    ON price_locks (product_sku);

CREATE INDEX IF NOT EXISTS idx_price_locks_category
    ON price_locks (category);

CREATE INDEX IF NOT EXISTS idx_price_locks_active
    ON price_locks (is_active);

-- ----------------------------------------------------------------------------
-- 5. price_offers - Generated price quotes for customers
-- ----------------------------------------------------------------------------
CREATE TYPE offer_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

CREATE TABLE IF NOT EXISTS price_offers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID REFERENCES prospects_data (customer_id) ON DELETE CASCADE,
    offer_date      TIMESTAMPTZ DEFAULT now(),
    valid_until     TIMESTAMPTZ,
    products        JSONB NOT NULL,
    total_value_pln DECIMAL(12, 2),
    total_value_eur DECIMAL(12, 2),
    logistics_terms TEXT,
    payment_terms   TEXT,
    is_below_floor  BOOLEAN DEFAULT FALSE,
    approved_by     VARCHAR(100),
    status          offer_status DEFAULT 'draft'
);

CREATE INDEX IF NOT EXISTS idx_price_offers_customer
    ON price_offers (customer_id);

CREATE INDEX IF NOT EXISTS idx_price_offers_status
    ON price_offers (status);

-- ----------------------------------------------------------------------------
-- 6. Triggers - auto-update updated_at timestamps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prospects_data_updated_at
    BEFORE UPDATE ON prospects_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_price_locks_updated_at
    BEFORE UPDATE ON price_locks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. Row Level Security - enabled but no policies yet
--    Proper RLS policies will be added in a dedicated migration.
-- ----------------------------------------------------------------------------
ALTER TABLE prospects_data   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_locks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_offers     ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 8. Views
-- ----------------------------------------------------------------------------

-- Pending follow-ups that still need to be sent
CREATE OR REPLACE VIEW v_pending_followups AS
SELECT
    f.id,
    f.customer_id,
    p.email,
    p.first_name,
    p.surname,
    p.company_name,
    f.scheduled_at,
    f.template_id,
    f.status,
    f.created_at
FROM follow_up_queue f
JOIN prospects_data p ON p.customer_id = f.customer_id
WHERE f.status = 'pending'
  AND f.scheduled_at <= now()
ORDER BY f.scheduled_at ASC;

-- Active deals with latest offer info
CREATE OR REPLACE VIEW v_active_deals AS
SELECT
    p.customer_id,
    p.email,
    p.first_name,
    p.surname,
    p.company_name,
    p.country,
    p.channel,
    p.pipedrive_deal_id,
    p.pipedrive_stage_id,
    po.id           AS latest_offer_id,
    po.offer_date,
    po.valid_until,
    po.total_value_eur,
    po.total_value_pln,
    po.status       AS offer_status,
    po.is_below_floor
FROM prospects_data p
LEFT JOIN LATERAL (
    SELECT *
    FROM price_offers o
    WHERE o.customer_id = p.customer_id
    ORDER BY o.offer_date DESC
    LIMIT 1
) po ON TRUE
WHERE p.is_unsubscribed = FALSE
ORDER BY po.offer_date DESC NULLS LAST;
