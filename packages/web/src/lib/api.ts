import { createClient } from "./supabase";
import type {
  Deal,
  DealWithRelations,
  Activity,
  AgentRun,
  PipelineSummary,
  DealStage,
} from "./types";

const supabase = createClient();

/* ------------------------------------------------------------------ */
/*  Deals                                                              */
/* ------------------------------------------------------------------ */

export async function getDeals(stage?: DealStage): Promise<Deal[]> {
  let query = supabase
    .from("deals")
    .select("*")
    .order("updated_at", { ascending: false });

  if (stage) {
    query = query.eq("stage", stage);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function getDeal(id: string): Promise<DealWithRelations> {
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .single();

  if (dealError) throw dealError;

  const [customerResult, activitiesResult] = await Promise.all([
    deal.customer_id
      ? supabase
          .from("prospects_data")
          .select("*")
          .eq("id", deal.customer_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("activities")
      .select("*")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    ...deal,
    customer: customerResult.data ?? null,
    activities: (activitiesResult.data ?? []) as Activity[],
  } as DealWithRelations;
}

export async function updateDeal(
  id: string,
  data: Partial<Deal>
): Promise<Deal> {
  const { data: updated, error } = await supabase
    .from("deals")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated as Deal;
}

/* ------------------------------------------------------------------ */
/*  Activities                                                         */
/* ------------------------------------------------------------------ */

export async function getActivities(dealId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Activity[];
}

export async function getRecentActivities(
  limit: number = 20
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Activity[];
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                           */
/* ------------------------------------------------------------------ */

export async function getPipelineSummary(): Promise<PipelineSummary[]> {
  const { data, error } = await supabase.from("deals").select("stage, value_pln");

  if (error) throw error;

  const summaryMap = new Map<DealStage, PipelineSummary>();

  for (const deal of data ?? []) {
    const existing = summaryMap.get(deal.stage as DealStage);
    if (existing) {
      existing.count += 1;
      existing.total_value += deal.value_pln ?? 0;
    } else {
      summaryMap.set(deal.stage as DealStage, {
        stage: deal.stage as DealStage,
        count: 1,
        total_value: deal.value_pln ?? 0,
      });
    }
  }

  return Array.from(summaryMap.values());
}

/* ------------------------------------------------------------------ */
/*  Agent runs                                                         */
/* ------------------------------------------------------------------ */

export async function getAgentRuns(limit: number = 10): Promise<AgentRun[]> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AgentRun[];
}

/* ------------------------------------------------------------------ */
/*  Agent control                                                      */
/* ------------------------------------------------------------------ */

const AGENT_API_URL =
  process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://localhost:8000";

export async function triggerHeartbeat(): Promise<void> {
  const response = await fetch(`${AGENT_API_URL}/api/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Agent heartbeat failed: ${response.statusText}`);
  }
}
