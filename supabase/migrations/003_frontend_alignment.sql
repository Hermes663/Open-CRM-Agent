-- ============================================================================
-- Migration 003: Frontend Alignment
-- Adds columns to deals that the CRM frontend expects, plus a
-- contacts-friendly view over prospects_data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. deals - Add frontend-expected columns
-- ----------------------------------------------------------------------------
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_name    VARCHAR(300);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_name    VARCHAR(200);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_email   VARCHAR(255);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS value           DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS priority_score  INTEGER DEFAULT 50;

-- Keep value/priority_score in sync with value_eur/priority
CREATE OR REPLACE FUNCTION sync_deal_value_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync value <-> value_eur
    IF NEW.value IS DISTINCT FROM OLD.value AND (OLD.value_eur IS NOT DISTINCT FROM NEW.value_eur) THEN
        NEW.value_eur := NEW.value;
    ELSIF NEW.value_eur IS DISTINCT FROM OLD.value_eur THEN
        NEW.value := NEW.value_eur;
    END IF;
    -- Sync priority_score <-> priority
    IF NEW.priority_score IS DISTINCT FROM OLD.priority_score AND (OLD.priority IS NOT DISTINCT FROM NEW.priority) THEN
        NEW.priority := NEW.priority_score;
    ELSIF NEW.priority IS DISTINCT FROM OLD.priority THEN
        NEW.priority_score := NEW.priority;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_deal_values
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION sync_deal_value_fields();
ALTER TABLE deals ADD COLUMN IF NOT EXISTS agent_name      VARCHAR(50);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS owner_id        UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT now();

-- Sync agent_name ↔ assigned_agent via trigger
CREATE OR REPLACE FUNCTION sync_deal_agent_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.agent_name IS DISTINCT FROM OLD.agent_name THEN
        NEW.assigned_agent := NEW.agent_name;
    ELSIF NEW.assigned_agent IS DISTINCT FROM OLD.assigned_agent THEN
        NEW.agent_name := NEW.assigned_agent;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_deal_agent
    BEFORE INSERT OR UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION sync_deal_agent_fields();

-- Backfill company_name from prospects_data for existing deals
UPDATE deals d
SET company_name = p.company_name,
    contact_name = CONCAT_WS(' ', p.first_name, p.surname),
    contact_email = p.email
FROM prospects_data p
WHERE d.customer_id = p.customer_id
  AND d.company_name IS NULL;

-- ----------------------------------------------------------------------------
-- 2. v_contacts - Frontend-friendly view of prospects_data
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_contacts AS
SELECT
    customer_id AS id,
    CONCAT_WS(' ', first_name, surname) AS full_name,
    company_name,
    email,
    phone,
    country,
    language,
    company_research AS research_summary,
    created_at,
    updated_at
FROM prospects_data;

-- Enable Supabase Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE deals;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_runs;
