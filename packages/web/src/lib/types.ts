// --- Pipeline Stages ---
export type PipelineStage =
  | "new_deal"
  | "first_email"
  | "qualifying"
  | "follow_up"
  | "negotiation"
  | "closing"
  | "won"
  | "lost";

export type DealStage = PipelineStage;

export interface StageConfig {
  id: PipelineStage;
  label: string;
  color: string;
  hex: string;
  collapsed?: boolean;
}

// --- Deal ---
export interface Deal {
  id: string;
  title?: string | null;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  value: number;
  value_pln?: number;
  stage: PipelineStage;
  priority_score: number;
  agent_name: string | null;
  stage_entered_at: string;
  expected_close_date?: string | null;
  tags?: string[];
  customer_id?: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  notes: string | null;
  currency?: string | null;
  lost_reason?: string | null;
}

// --- Customer / Prospect ---
export interface Contact {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  language?: string | null;
  research_summary?: string | null;
  created_at: string;
  updated_at: string;
  deal_count?: number;
  last_contact?: string | null;
}

export type Customer = Contact;

// --- Activity ---
export type ActivityType = string;

export interface Activity {
  id: string;
  deal_id: string;
  activity_type: ActivityType;
  description: string;
  subject?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown>;
  agent_name: string | null;
  created_by?: string | null;
  created_at: string;
}

// --- Deal with relations ---
export interface DealWithRelations extends Deal {
  customer: Contact | null;
  activities: Activity[];
}

// --- Pipeline stats ---
export interface PipelineStats {
  total_deals: number;
  total_value: number;
  won_this_month: number;
  win_rate: number;
}

export interface PipelineSummary {
  stage: DealStage;
  count: number;
  total_value: number;
}

// --- Agent run ---
export interface AgentRun {
  id: string;
  run_type: string;
  agent_name: string | null;
  status: "running" | "completed" | "failed" | "skipped";
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

// --- Dashboard metrics ---
export interface DashboardMetrics {
  active_deals: number;
  active_deals_trend: number;
  pipeline_value: number;
  pipeline_value_trend: number;
  emails_sent_7d: number;
  emails_sent_trend: number;
  agent_actions_24h: number;
  agent_actions_trend: number;
}

// --- Supabase helpers ---
export type DealInsert = Omit<Deal, "id" | "created_at" | "updated_at">;
export type DealUpdate = Partial<Omit<Deal, "id" | "created_at" | "updated_at">>;

export interface SettingsStatus {
  database_configured: boolean;
  heartbeat_interval_minutes: number;
  email_provider: string | null;
  email_configured: boolean;
  llm_provider: string | null;
  llm_configured: boolean;
}
