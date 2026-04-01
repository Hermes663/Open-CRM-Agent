import type {
  Activity,
  AgentRun,
  Contact,
  Deal,
  DealWithRelations,
  DealStage,
  PipelineSummary,
  SettingsStatus,
} from "./types";

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getDeals(stage?: DealStage): Promise<Deal[]> {
  const params = stage ? `?stage=${encodeURIComponent(stage)}` : "";
  return requestJson<Deal[]>(`/api/deals${params}`);
}

export async function getDeal(id: string): Promise<DealWithRelations> {
  return requestJson<DealWithRelations>(`/api/deals/${id}`);
}

export async function updateDeal(id: string, data: Partial<Deal>): Promise<Deal> {
  return requestJson<Deal>(`/api/deals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getActivities(dealId: string): Promise<Activity[]> {
  return requestJson<Activity[]>(`/api/deals/${dealId}/activities`);
}

export async function addActivity(
  dealId: string,
  data: {
    activity_type: string;
    description?: string | null;
    body?: string | null;
    metadata?: Record<string, unknown>;
    agent_name?: string | null;
    created_by?: string | null;
  },
): Promise<Activity> {
  return requestJson<Activity>(`/api/deals/${dealId}/activities`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPipelineSummary(): Promise<PipelineSummary[]> {
  return requestJson<PipelineSummary[]>("/api/pipeline");
}

export async function getContacts(): Promise<Contact[]> {
  return requestJson<Contact[]>("/api/contacts");
}

export async function getAgentRuns(limit = 20): Promise<AgentRun[]> {
  return requestJson<AgentRun[]>(`/api/agent/runs?limit=${limit}`);
}

export async function triggerHeartbeat(): Promise<void> {
  await requestJson("/api/agent/trigger", {
    method: "POST",
  });
}

export async function runAgent(agentName: string, dealId: string): Promise<unknown> {
  return requestJson(`/api/agent/run/${agentName}`, {
    method: "POST",
    body: JSON.stringify({ deal_id: dealId }),
  });
}

export async function getSettingsStatus(): Promise<SettingsStatus> {
  return requestJson<SettingsStatus>("/api/settings/status");
}
