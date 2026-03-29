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
}

// --- Customer / Prospect ---
export interface Customer {
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
}

// --- Activity ---
export type ActivityType =
  | "email_sent"
  | "email_received"
  | "research_completed"
  | "stage_changed"
  | "agent_decision"
  | "deal_created"
  | "follow_up_sent"
  | "note_added"
  | "call_logged";

export interface Activity {
  id: string;
  deal_id: string;
  activity_type: ActivityType;
  description: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  agent_name: string | null;
  created_at: string;
}

// --- Deal with relations ---
export interface DealWithRelations extends Deal {
  customer: Customer | null;
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
  agent_name: string;
  status: "running" | "completed" | "failed";
  deals_processed: number;
  actions_taken: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
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
