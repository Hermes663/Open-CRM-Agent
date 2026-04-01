-- ============================================================================
-- Migration 004: Runtime Alignment
-- Aligns follow-up tracking and operational indexes with the current app.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. deals - Operational lookup indexes
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deals_contact_email
    ON deals (LOWER(contact_email));

-- ----------------------------------------------------------------------------
-- 2. follow_up_queue - Align with agent runtime
-- ----------------------------------------------------------------------------
ALTER TABLE follow_up_queue
    ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals (id) ON DELETE CASCADE;

ALTER TABLE follow_up_queue
    ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1
    CHECK (attempt >= 1);

ALTER TABLE follow_up_queue
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE follow_up_queue f
SET deal_id = d.id
FROM LATERAL (
    SELECT id
    FROM deals
    WHERE customer_id = f.customer_id
    ORDER BY updated_at DESC
    LIMIT 1
) d
WHERE f.deal_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_deal
    ON follow_up_queue (deal_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_deal_status_scheduled
    ON follow_up_queue (deal_id, status, scheduled_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_up_queue_deal_attempt
    ON follow_up_queue (deal_id, attempt)
    WHERE deal_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_follow_up_queue_updated_at ON follow_up_queue;
CREATE TRIGGER trg_follow_up_queue_updated_at
    BEFORE UPDATE ON follow_up_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. v_pending_followups - include deal linkage and attempt
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pending_followups AS
SELECT
    f.id,
    f.customer_id,
    f.deal_id,
    p.email,
    p.first_name,
    p.surname,
    p.company_name,
    f.scheduled_at,
    f.template_id,
    f.status,
    f.attempt,
    f.created_at,
    f.updated_at
FROM follow_up_queue f
JOIN prospects_data p ON p.customer_id = f.customer_id
WHERE f.status = 'pending'
  AND f.scheduled_at <= now()
ORDER BY f.scheduled_at ASC;
