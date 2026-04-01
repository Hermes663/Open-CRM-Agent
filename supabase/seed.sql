-- =============================================================================
-- AutoSales-AI Seed Data
-- Realistic B2B prospect data for ADIKAM/MELIBRA chocolate company
-- Emails sanitized to @example.com
-- =============================================================================

-- Clean existing data (in dependency order)
TRUNCATE agent_runs, agent_memory, follow_up_queue, activities, deals, prospects_data CASCADE;

-- =============================================================================
-- 1. PROSPECTS DATA (13 prospects from real CSV, anonymized emails)
-- =============================================================================
INSERT INTO prospects_data (customer_id, email, first_name, surname, company_name, company_research, phone, country, language)
VALUES
  -- Finnish specialty food distributor
  (gen_random_uuid(), 'hanna.talso@example.com', 'Hanna', 'Talso', 'Herkkukartano',
   'Herkkukartano is a Finnish specialty food distributor supplying gourmet and confectionery products to retail chains and specialty stores across Finland.',
   '+358505128094', 'Finland', 'Finnish'),

  -- UK fruit & food wholesaler
  (gen_random_uuid(), 'pauline.fiddes@example.com', 'Pauline', 'Fiddes', 'Swansons Fruit Company Limited',
   'Swansons Fruit Company Limited is a UK-based food wholesaler supplying fresh produce and specialty food products to retailers across the United Kingdom.',
   NULL, 'United Kingdom', 'English'),

  -- French distributor
  (gen_random_uuid(), 'f.stagni@example.com', 'Frederic', 'Stagni', 'MC and CO',
   'MC and CO is a French food distribution company specializing in importing and distributing confectionery and specialty food products across France and neighboring markets.',
   '+33667381110', 'France', 'French'),

  -- Spanish specialty foods
  (gen_random_uuid(), 'a.kulic@example.com', 'Anna', 'Kulic', 'Delicat Aliment',
   'Delicat Aliment is a Spanish specialty food company distributing premium confectionery and gourmet products to retailers and foodservice operators in Spain and Portugal.',
   '+34933353000', 'Spain', 'Spanish'),

  -- Czech chocolate retailer
  (gen_random_uuid(), 'ales.borej@example.com', 'Ales', 'Borej', 'LuxusniCokolady, SELLLOT s.r.o.',
   'LuxusniCokolady (SELLLOT s.r.o.) is a Czech premium chocolate retailer specializing in luxury chocolate products, gift boxes, and artisan confectionery for the Czech and Slovak markets.',
   '+420 731 692 911', 'Czech Republic', 'Czech'),

  -- Dutch food distributor
  (gen_random_uuid(), 'j.dejong@example.com', 'Jacolien', 'de Jong', 'Tastemakers B.V.',
   'Tastemakers B.V. is a Dutch food distribution company specializing in sourcing and distributing innovative confectionery and snack products to retailers across the Benelux region.',
   '+31 183 508 140', 'Netherlands', 'Dutch'),

  -- Polish wholesale distributor (MAKRO)
  (gen_random_uuid(), 'joanna.michalczyk@example.com', 'Joanna', 'Michalczyk', 'Makro Cash and Carry Polska',
   'Makro Cash and Carry Polska is a wholesale chain offering a wide range of food and non-food products to business customers such as restaurants, retail shops, and other enterprises across Poland.',
   NULL, 'Poland', 'Polish'),

  -- Polish confectionery company
  (gen_random_uuid(), 'ewelina.pieczara@example.com', 'Ewelina', 'Pieczara', 'MAX SLODYCZE',
   'MAX SLODYCZE is a well-established Polish brand specializing in the production of sweets since 1960. The company emphasizes tradition and experience, offering products including crispy snack lines.',
   NULL, 'Poland', 'Polish'),

  -- Romanian sweets importer
  (gen_random_uuid(), 'daniel.preunca@example.com', 'Daniel', 'Preunca', 'Inter Conecter Srl',
   'Inter Conecter Srl delivers high-quality products to supermarkets, hypermarkets, gas stations, specialty stores, retail chains, bakeries, and pastry shops across Romania.',
   '+40723171474', 'Romania', 'Romanian'),

  -- Romanian distributor (large)
  (gen_random_uuid(), 'stefan.parascanu@example.com', 'Stefan', 'Parascanu', 'Grupul De Distributie Eta Srl',
   'Grupul De Distributie Eta SRL is a distribution company active since 1999 in Romania with nearly 300 employees and 180 modern vehicles, delivering to over 8,000 locations in NE Romania.',
   '+40 372 780 956', 'Romania', 'Romanian'),

  -- Romanian food distributor
  (gen_random_uuid(), 'adrian.gaitan@example.com', 'Adrian Marius', 'Gaitan', 'Gaitano Company Srl',
   'Gaitano Company Srl is a Romanian firm specializing in the import and distribution of food products, particularly sweets, within Romania through its own distribution network with 15 years experience.',
   '+40 230 551 581', 'Romania', 'Romanian'),

  -- French food platform
  (gen_random_uuid(), 'p.stretz@example.com', 'Philippe', 'Stretz', 'Foodhub',
   'Foodhub is a French food platform connecting producers with distributors and retailers, facilitating efficient sourcing of specialty food products including confectionery across France.',
   '+33 2 99 31 63 13', 'France', 'French'),

  -- Uzbek confectionery manufacturer
  (gen_random_uuid(), 'j.norboboev@example.com', 'Javokhir', 'Norboboev', 'Crafers LLC',
   'Crafers LLC is a leading confectionery and snack manufacturer in Uzbekistan, occupying a modern 35,000 m2 facility equipped with European machinery and employing 800 staff members.',
   '+998 99 797 79 10', 'Uzbekistan', 'Russian');


-- =============================================================================
-- 2. DEALS (13 deals linked to prospects, spread across pipeline stages)
-- =============================================================================
WITH prospect_ids AS (
  SELECT customer_id, company_name, email, first_name, surname
  FROM prospects_data
)
INSERT INTO deals (id, title, customer_id, stage, value_pln, value_eur, currency, assigned_agent, priority, tags, company_name, contact_name, contact_email, value, priority_score, stage_entered_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  d.title,
  p.customer_id,
  d.stage,
  d.value_pln,
  d.value_eur,
  d.currency,
  d.assigned_agent,
  d.priority,
  d.tags,
  p.company_name,
  p.first_name || ' ' || p.surname,
  p.email,
  d.value_eur,
  d.priority_score,
  d.stage_entered_at,
  d.created_at,
  d.updated_at
FROM prospect_ids p
JOIN (VALUES
  -- Herkkukartano: won deal
  ('Herkkukartano', 'Herkkukartano - Finland Distribution Q1 2026', 'won',
   85000.00, 19500.00, 'EUR', 'human', 85,
   ARRAY['finland','retail','recurring'], 90,
   '2026-03-15 10:00:00+00'::timestamptz, '2025-12-01 09:00:00+00'::timestamptz, '2026-03-15 10:00:00+00'::timestamptz),

  -- Swansons: negotiation
  ('Swansons Fruit Company Limited', 'Swansons UK - Private Label Easter Range', 'negotiation',
   120000.00, 27500.00, 'GBP', 'human', 85,
   ARRAY['uk','private-label','seasonal'], 85,
   '2026-03-20 14:00:00+00'::timestamptz, '2026-01-15 11:00:00+00'::timestamptz, '2026-03-28 09:00:00+00'::timestamptz),

  -- MC and CO: qualifying
  ('MC and CO', 'MC and CO - French Market Entry', 'qualifying',
   95000.00, 21800.00, 'EUR', 'qualifier', 55,
   ARRAY['france','new-market','figurines'], 65,
   '2026-03-22 08:30:00+00'::timestamptz, '2026-02-10 10:00:00+00'::timestamptz, '2026-03-25 16:00:00+00'::timestamptz),

  -- Delicat Aliment: first_email
  ('Delicat Aliment', 'Delicat Aliment - Spain Gourmet Line', 'first_email',
   70000.00, 16000.00, 'EUR', 'qualifier', 55,
   ARRAY['spain','gourmet','premium'], 55,
   '2026-03-27 09:00:00+00'::timestamptz, '2026-03-25 14:00:00+00'::timestamptz, '2026-03-27 09:00:00+00'::timestamptz),

  -- LuxusniCokolady: follow_up
  ('LuxusniCokolady, SELLLOT s.r.o.', 'SELLLOT - Czech Premium Chocolate Supply', 'follow_up',
   45000.00, 10300.00, 'EUR', 'qualifier', 55,
   ARRAY['czech','premium','gift-boxes'], 60,
   '2026-03-18 11:00:00+00'::timestamptz, '2026-02-01 08:00:00+00'::timestamptz, '2026-03-26 14:00:00+00'::timestamptz),

  -- Tastemakers: closing
  ('Tastemakers B.V.', 'Tastemakers - Benelux Seasonal Collection', 'closing',
   110000.00, 25200.00, 'EUR', 'human', 85,
   ARRAY['netherlands','benelux','seasonal','lollipops'], 88,
   '2026-03-25 09:30:00+00'::timestamptz, '2025-11-20 10:00:00+00'::timestamptz, '2026-03-28 11:00:00+00'::timestamptz),

  -- Makro: new_deal
  ('Makro Cash and Carry Polska', 'Makro Polska - National Listing Proposal', 'new_deal',
   200000.00, 45900.00, 'PLN', 'human', 85,
   ARRAY['poland','wholesale','national-listing'], 92,
   '2026-03-28 08:00:00+00'::timestamptz, '2026-03-28 08:00:00+00'::timestamptz, '2026-03-28 08:00:00+00'::timestamptz),

  -- MAX SLODYCZE: lost
  ('MAX SLODYCZE', 'MAX SLODYCZE - Co-Packing Partnership', 'lost',
   60000.00, 13800.00, 'PLN', 'research', 30,
   ARRAY['poland','co-packing','competitor'], 30,
   '2026-02-28 15:00:00+00'::timestamptz, '2025-10-15 09:00:00+00'::timestamptz, '2026-02-28 15:00:00+00'::timestamptz),

  -- Inter Conecter: follow_up
  ('Inter Conecter Srl', 'Inter Conecter - Romania Sweets Import', 'follow_up',
   80000.00, 18400.00, 'EUR', 'qualifier', 55,
   ARRAY['romania','import','sweets'], 62,
   '2026-03-20 10:00:00+00'::timestamptz, '2026-01-20 11:00:00+00'::timestamptz, '2026-03-27 08:00:00+00'::timestamptz),

  -- Eta: qualifying
  ('Grupul De Distributie Eta Srl', 'Grup Eta - NE Romania Distribution', 'qualifying',
   90000.00, 20700.00, 'EUR', 'qualifier', 55,
   ARRAY['romania','distribution','regional'], 58,
   '2026-03-24 09:00:00+00'::timestamptz, '2026-02-15 10:00:00+00'::timestamptz, '2026-03-26 11:00:00+00'::timestamptz),

  -- Gaitano: negotiation
  ('Gaitano Company Srl', 'Gaitano - Romania National Distribution', 'negotiation',
   130000.00, 29900.00, 'EUR', 'human', 85,
   ARRAY['romania','national','sweets-import'], 82,
   '2026-03-22 14:00:00+00'::timestamptz, '2025-12-10 09:00:00+00'::timestamptz, '2026-03-27 16:00:00+00'::timestamptz),

  -- Foodhub: first_email
  ('Foodhub', 'Foodhub - French Artisan Chocolate Line', 'first_email',
   55000.00, 12600.00, 'EUR', 'research', 30,
   ARRAY['france','platform','artisan'], 40,
   '2026-03-28 07:00:00+00'::timestamptz, '2026-03-27 15:00:00+00'::timestamptz, '2026-03-28 07:00:00+00'::timestamptz),

  -- Crafers: new_deal
  ('Crafers LLC', 'Crafers - Uzbekistan Ingredient Supply', 'new_deal',
   35000.00, 8000.00, 'USD', 'research', 30,
   ARRAY['uzbekistan','ingredients','b2b'], 35,
   '2026-03-29 06:00:00+00'::timestamptz, '2026-03-29 06:00:00+00'::timestamptz, '2026-03-29 06:00:00+00'::timestamptz)

) AS d(company_match, title, stage, value_pln, value_eur, currency, assigned_agent, priority, tags, priority_score, stage_entered_at, created_at, updated_at)
ON p.company_name = d.company_match;


-- =============================================================================
-- 3. ACTIVITIES (18 activities linked to deals)
-- =============================================================================
WITH deal_refs AS (
  SELECT id AS deal_id, company_name, stage, title
  FROM deals
)
INSERT INTO activities (id, deal_id, activity_type, subject, body, metadata, created_by, created_at)
VALUES
  -- Herkkukartano (won) activities
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Herkkukartano'),
   'deal_created', 'New deal created for Herkkukartano Finland distribution',
   'Prospect identified through Finnish trade fair contact. Herkkukartano distributes specialty food across Finland.',
   '{"source": "trade_fair", "event": "FoodExpo Helsinki 2025"}'::jsonb,
   'hermes-orchestrator', '2025-12-01 09:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Herkkukartano'),
   'research_completed', 'Company research completed for Herkkukartano',
   'Herkkukartano supplies gourmet and confectionery products to Finnish retail chains. Good fit for MELIBRA seasonal figurines and premium chocolate lines.',
   '{"research_depth": "full", "fit_score": 0.87}'::jsonb,
   'research-agent', '2025-12-02 10:30:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Herkkukartano'),
   'email_sent', 'Initial outreach email sent to Hanna Talso',
   'Dear Hanna, I am reaching out from ADIKAM regarding our premium chocolate figurines and seasonal collections. We believe Herkkukartano would be an excellent distribution partner in Finland...',
   '{"template": "initial_outreach", "language": "en", "personalization_score": 0.82}'::jsonb,
   'email-agent', '2025-12-03 08:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Herkkukartano'),
   'stage_changed', 'Deal moved to won stage after contract signing',
   'Contract signed for Q1 2026 seasonal collection. Initial order of 5,000 units across 3 SKUs.',
   '{"from_stage": "closing", "to_stage": "won", "contract_value_eur": 19500}'::jsonb,
   'hermes-orchestrator', '2026-03-15 10:00:00+00'),

  -- Swansons (negotiation) activities
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Swansons Fruit Company Limited'),
   'email_sent', 'Sent private label proposal to Pauline Fiddes',
   'Dear Pauline, Following our discussion about private label chocolate Easter eggs, please find attached our production capabilities and MOQ details for the UK market...',
   '{"template": "proposal", "language": "en", "attachments": ["private_label_catalog.pdf"]}'::jsonb,
   'email-agent', '2026-02-10 09:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Swansons Fruit Company Limited'),
   'email_received', 'Reply from Pauline requesting samples and pricing',
   'Thank you for the proposal. We are interested in the Easter range. Could you send samples of 3 SKUs and provide FOB pricing for 10,000 and 25,000 unit orders?',
   '{"reply_time_hours": 48, "sentiment": "positive", "intent": "sample_request"}'::jsonb,
   'email-agent', '2026-02-12 14:30:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Swansons Fruit Company Limited'),
   'agent_decision', 'Escalated to negotiation - high value opportunity',
   'Deal value exceeds 25,000 EUR threshold. Moving to negotiation stage with priority escalation. Recommended sending samples via DHL Express.',
   '{"decision": "escalate", "reason": "high_value", "confidence": 0.91}'::jsonb,
   'hermes-orchestrator', '2026-03-20 14:00:00+00'),

  -- Tastemakers (closing) activities
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Tastemakers B.V.'),
   'research_completed', 'Deep research on Tastemakers B.V. distribution network',
   'Tastemakers B.V. covers Benelux with 2,000+ retail points. Strong in seasonal confectionery. Key decision maker: Jacolien de Jong, Purchasing Manager.',
   '{"research_depth": "deep", "retail_points": 2000, "region": "benelux"}'::jsonb,
   'research-agent', '2025-11-22 11:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Tastemakers B.V.'),
   'follow_up_sent', 'Follow-up with updated seasonal pricing',
   'Dear Jacolien, As discussed, here is our updated pricing for the Christmas and Easter seasonal collections with the volume discount applied for 15,000+ units...',
   '{"template": "follow_up_pricing", "language": "en", "discount_applied": true}'::jsonb,
   'email-agent', '2026-03-10 09:00:00+00'),

  -- Makro (new_deal) activities
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Makro Cash and Carry Polska'),
   'deal_created', 'High-priority deal created for Makro Polska national listing',
   'Makro Polska national listing opportunity identified. Category manager Joanna Michalczyk handles confectionery purchasing. Potential for 30+ store placement.',
   '{"source": "crm_import", "stores": 30, "category": "confectionery"}'::jsonb,
   'hermes-orchestrator', '2026-03-28 08:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Makro Cash and Carry Polska'),
   'research_completed', 'Makro Polska buyer research completed',
   'Joanna Michalczyk is Category Manager at MAKRO since Oct 2024, focusing on hot beverages, sweet and savory snacks, and packaging. Previously managed dairy and own brand categories.',
   '{"research_depth": "full", "buyer_identified": true, "buyer_tenure_months": 18}'::jsonb,
   'research-agent', '2026-03-28 08:30:00+00'),

  -- Gaitano (negotiation) activities
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Gaitano Company Srl'),
   'email_sent', 'Sent distribution partnership proposal to Adrian Gaitan',
   'Dear Adrian, ADIKAM would like to propose a national distribution partnership for Romania. With your 15 years of experience in sweets distribution, we see strong synergies...',
   '{"template": "partnership_proposal", "language": "en", "personalization_score": 0.88}'::jsonb,
   'email-agent', '2025-12-15 10:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Gaitano Company Srl'),
   'note_added', 'Meeting notes from video call with Gaitano team',
   'Video call with Adrian Gaitan and logistics manager. They handle distribution to 3,000+ points in Romania. Interested in MELIBRA figurines and seasonal lines. Need IFS certificate copy.',
   '{"meeting_type": "video_call", "duration_min": 45, "attendees": 3}'::jsonb,
   'hermes-orchestrator', '2026-02-20 15:00:00+00'),

  -- MAX SLODYCZE (lost) activities
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'MAX SLODYCZE'),
   'email_sent', 'Co-packing inquiry sent to MAX SLODYCZE',
   'Dear Ewelina, We are exploring co-packing partnerships for our crispy chocolate range. Would MAX SLODYCZE be interested in discussing production capacity and terms?',
   '{"template": "partnership_inquiry", "language": "pl"}'::jsonb,
   'email-agent', '2025-10-20 09:00:00+00'),

  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'MAX SLODYCZE'),
   'stage_changed', 'Deal marked as lost - competitor selected',
   'MAX SLODYCZE decided to partner with a local competitor for co-packing. They cited proximity and existing relationship as key factors.',
   '{"from_stage": "negotiation", "to_stage": "lost", "lost_reason": "competitor", "competitor": "local_manufacturer"}'::jsonb,
   'hermes-orchestrator', '2026-02-28 15:00:00+00'),

  -- Inter Conecter (follow_up)
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Inter Conecter Srl'),
   'follow_up_sent', 'Second follow-up to Daniel Preunca with sample tracking',
   'Dear Daniel, Our chocolate samples were shipped via DPD last week (tracking: RO2026031234). Please let us know once received. We look forward to your feedback on the MELIBRA range.',
   '{"template": "sample_follow_up", "language": "en", "shipping_carrier": "DPD"}'::jsonb,
   'email-agent', '2026-03-20 10:00:00+00'),

  -- Delicat Aliment (first_email)
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Delicat Aliment'),
   'email_sent', 'Initial outreach to Anna Kulic at Delicat Aliment',
   'Dear Anna, ADIKAM produces premium chocolate figurines and seasonal collections using Rainforest Alliance certified cocoa. We believe your gourmet distribution in Spain would be an ideal channel...',
   '{"template": "initial_outreach", "language": "en", "personalization_score": 0.75}'::jsonb,
   'email-agent', '2026-03-27 09:00:00+00'),

  -- Crafers (new_deal)
  (gen_random_uuid(),
   (SELECT deal_id FROM deal_refs WHERE company_name = 'Crafers LLC'),
   'deal_created', 'New deal created for Crafers LLC ingredient supply inquiry',
   'Crafers LLC in Uzbekistan operates a 35,000 m2 confectionery facility. They inquired about bulk chocolate couverture supply for their production lines.',
   '{"source": "inbound_inquiry", "facility_size_m2": 35000, "inquiry_type": "ingredient_supply"}'::jsonb,
   'hermes-orchestrator', '2026-03-29 06:00:00+00');

-- =============================================================================
-- 4. FOLLOW-UP QUEUE (3 records)
-- =============================================================================
WITH followup_deals AS (
  SELECT id AS deal_id, customer_id, company_name
  FROM deals
  WHERE company_name IN (
    'LuxusniCokolady, SELLLOT s.r.o.',
    'Inter Conecter Srl',
    'Foodhub'
  )
)
INSERT INTO follow_up_queue (
  id, customer_id, deal_id, scheduled_at, template_id, status, sent_at, created_at, attempt, updated_at
)
VALUES
  (
    gen_random_uuid(),
    (SELECT customer_id FROM followup_deals WHERE company_name = 'LuxusniCokolady, SELLLOT s.r.o.'),
    (SELECT deal_id FROM followup_deals WHERE company_name = 'LuxusniCokolady, SELLLOT s.r.o.'),
    '2026-03-30 09:00:00+00'::timestamptz,
    'follow_up_2',
    'pending',
    NULL,
    '2026-03-25 09:00:00+00'::timestamptz,
    2,
    '2026-03-30 09:00:00+00'::timestamptz
  ),
  (
    gen_random_uuid(),
    (SELECT customer_id FROM followup_deals WHERE company_name = 'Inter Conecter Srl'),
    (SELECT deal_id FROM followup_deals WHERE company_name = 'Inter Conecter Srl'),
    '2026-03-31 08:00:00+00'::timestamptz,
    'follow_up_3',
    'pending',
    NULL,
    '2026-03-27 08:00:00+00'::timestamptz,
    3,
    '2026-03-31 08:00:00+00'::timestamptz
  ),
  (
    gen_random_uuid(),
    (SELECT customer_id FROM followup_deals WHERE company_name = 'Foodhub'),
    (SELECT deal_id FROM followup_deals WHERE company_name = 'Foodhub'),
    '2026-04-01 07:30:00+00'::timestamptz,
    'follow_up_1',
    'pending',
    NULL,
    '2026-03-29 07:30:00+00'::timestamptz,
    1,
    '2026-04-01 07:30:00+00'::timestamptz
  );

-- =============================================================================
-- 5. AGENT RUNS (5 records)
-- =============================================================================
INSERT INTO agent_runs (id, run_type, agent_name, status, input_summary, output_summary, tokens_used, cost_usd, duration_ms, error_message, started_at, completed_at)
VALUES
  -- Successful daily orchestration run
  (gen_random_uuid(), 'heartbeat', 'hermes-orchestrator', 'completed',
   'Heartbeat cycle: 8 active deals scanned', '12 actions taken across pipeline',
   45200, 0.68, 34500, NULL,
   '2026-03-28 06:00:00+00', '2026-03-28 06:00:34+00'),

  -- Research agent batch run
  (gen_random_uuid(), 'heartbeat', 'research', 'completed',
   '3 new deals requiring company research', '6 research summaries generated',
   82100, 1.23, 67800, NULL,
   '2026-03-28 06:01:00+00', '2026-03-28 06:02:08+00'),

  -- Email agent run
  (gen_random_uuid(), 'heartbeat', 'qualifier', 'completed',
   '5 deals ready for outreach', '5 personalized emails sent',
   31400, 0.47, 22100, NULL,
   '2026-03-28 06:03:00+00', '2026-03-28 06:03:22+00'),

  -- Failed run (API timeout)
  (gen_random_uuid(), 'manual', 'hermes-orchestrator', 'failed',
   'Manual trigger: full pipeline refresh', NULL,
   2100, 0.03, 30000, 'OpenAI API timeout after 30s - deal pipeline refresh failed. Retrying in next scheduled run.',
   '2026-03-27 18:00:00+00', '2026-03-27 18:00:30+00'),

  -- Successful evening follow-up run
  (gen_random_uuid(), 'heartbeat', 'hermes-orchestrator', 'completed',
   'Heartbeat cycle: 13 deals scanned', '18 actions taken including follow-ups',
   67800, 1.02, 52300, NULL,
   '2026-03-29 06:00:00+00', '2026-03-29 06:00:52+00');
